import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';
import webpush from 'web-push';
import { getAllUsers, removeSubscription, setLastSeenCaseIds, upsertSubscription } from './pushStore.js';
import { startSalesforceRealtime } from './salesforceRealtime.js';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(rootDir, 'dist');

config({ path: join(rootDir, '.env') });

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json());

if (!isProduction) {
  app.use(
    cors({
      origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173'],
      credentials: true,
    })
  );
} else if (process.env.CORS_ORIGINS) {
  app.use(
    cors({
      origin: process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim()),
      credentials: true,
    })
  );
}

let cachedToken = null;

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
const CASE_POLL_INTERVAL_MS = Number(process.env.CASE_POLL_INTERVAL_MS) || 60 * 1000;
const SALESFORCE_API_VERSION = process.env.SALESFORCE_API_VERSION || '59.0';
const SALESFORCE_REALTIME_ENABLED = (process.env.SALESFORCE_REALTIME_ENABLED || '').toLowerCase() === 'true';
const SALESFORCE_REALTIME_CHANNEL = process.env.SALESFORCE_REALTIME_CHANNEL || '/data/CaseChangeEvent';

const pushDebug = {
  lastSubscribeAt: null,
  lastTestPushAt: null,
  lastTestPushEmail: null,
  lastRealtimeEventAt: null,
  lastRealtimeCaseId: null,
  lastRealtimeCaseEmail: null,
  lastRealtimeAction: null, // sent | skipped_no_email | skipped_no_subscription | skipped_seen | fetch_failed
  lastRealtimeFetchStatus: null,
  lastRealtimeFetchError: null,
  lastRealtimeFetchBodySnippet: null,
  lastRealtimeFallbackSummary: null,
  lastPushSentAt: null,
  lastPushSentEmail: null,
  lastPushError: null,
};

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

async function getOAuthToken() {
  if (cachedToken) return cachedToken;

  const response = await fetch(process.env.OAUTH_URL || 'https://test.salesforce.com/services/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: process.env.SALESFORCE_CLIENT_ID,
      client_secret: process.env.SALESFORCE_CLIENT_SECRET,
      username: process.env.SALESFORCE_USERNAME,
      password: process.env.SALESFORCE_PASSWORD,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OAuth failed: ${err}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  return cachedToken;
}

async function callSalesforce(path, options = {}) {
  const baseUrl = process.env.SALESFORCE_BASE_URL || 'https://cloudextel--ceuat.sandbox.my.salesforce.com';

  async function doCall(retry = false) {
    const token = await getOAuthToken();
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });

    if (response.status === 401 && !retry) {
      // Access token likely expired – clear cache and retry once
      cachedToken = null;
      return doCall(true);
    }

    return response;
  }

  return doCall(false);
}

async function callSalesforceRest(path, options = {}) {
  const baseUrl = process.env.SALESFORCE_BASE_URL || 'https://cloudextel--ceuat.sandbox.my.salesforce.com';
  const token = await getOAuthToken();
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  return response;
}

function filterCasesForEmail(rawCases, email) {
  const userEmail = (email || '').trim().toLowerCase();
  const raw = rawCases || [];
  return raw.filter((r) => {
    const siteEmail = (r.ExtIPEmail__c || r.Site__r?.IPEmail__c || r.IPEmail__c || '').trim().toLowerCase();
    return siteEmail === userEmail;
  });
}

app.post('/api/oauth/token', async (_, res) => {
  try {
    cachedToken = null;
    const token = await getOAuthToken();
    res.json({ access_token: token });
  } catch (e) {
    res.status(401).json({ error: e.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const response = await callSalesforce('/services/apexrest/feapi/FE/login', {
      method: 'POST',
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post('/api/cases', async (req, res) => {
  try {
    const response = await callSalesforce('/services/apexrest/feapi/getcases', {
      method: 'POST',
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.put('/api/cases/update', async (req, res) => {
  try {
    const response = await callSalesforce('/services/apexrest/feapi/updatecase', {
      method: 'PUT',
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get('/api/push/vapidPublicKey', (_, res) => {
  if (!VAPID_PUBLIC_KEY) return res.status(503).json({ error: 'Push is not configured (missing VAPID_PUBLIC_KEY)' });
  return res.json({ publicKey: VAPID_PUBLIC_KEY });
});

app.post('/api/push/subscribe', async (req, res) => {
  try {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return res.status(503).json({ error: 'Push is not configured (missing VAPID keys)' });
    }
    const { email, subscription } = req.body || {};
    await upsertSubscription(email, subscription);
    pushDebug.lastSubscribeAt = new Date().toISOString();
    return res.json({ success: true });
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message });
  }
});

app.post('/api/push/unsubscribe', async (req, res) => {
  try {
    const { email, endpoint } = req.body || {};
    await removeSubscription(email, endpoint);
    return res.json({ success: true });
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message });
  }
});

app.post('/api/push/test', async (req, res) => {
  try {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return res.status(503).json({ error: 'Push is not configured (missing VAPID keys)' });
    }
    const { email, title, body, url } = req.body || {};
    await sendPushToUser(email, {
      title: title || 'Test Notification',
      body: body || 'Push is working.',
      url: url || '/',
    });
    pushDebug.lastTestPushAt = new Date().toISOString();
    pushDebug.lastTestPushEmail = (email || '').trim().toLowerCase();
    return res.json({ success: true });
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message });
  }
});

app.get('/api/push/status', async (_, res) => {
  const users = await getAllUsers();
  const summary = Object.entries(users).map(([email, u]) => ({
    email,
    subscriptions: Array.isArray(u?.subscriptions) ? u.subscriptions.length : 0,
    lastSeenCount: Array.isArray(u?.lastSeenCaseIds) ? u.lastSeenCaseIds.length : 0,
  }));

  res.json({
    configured: Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY),
    realtimeEnabled: SALESFORCE_REALTIME_ENABLED,
    realtimeChannel: SALESFORCE_REALTIME_CHANNEL,
    pollingIntervalMs: CASE_POLL_INTERVAL_MS,
    users: summary,
    debug: pushDebug,
  });
});

// Debug helper: verify caseId lookup for a specific email via Apex REST list and (if found) send push.
app.post('/api/push/notifyCase', async (req, res) => {
  try {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return res.status(503).json({ error: 'Push is not configured (missing VAPID keys)' });
    }
    const { email, caseId } = req.body || {};
    if (!email || !caseId) return res.status(400).json({ error: 'email and caseId are required' });

    const response = await callSalesforce('/services/apexrest/feapi/getcases', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    const data = await response.json();
    const rawCases = data?.cases || data?.records || [];
    const filtered = filterCasesForEmail(rawCases, email);
    const match = filtered.find((c) => String(c?.Id) === String(caseId));

    if (!match) {
      return res.json({ success: false, message: 'CaseId not found for this email via getcases', count: filtered.length });
    }

    await sendPushToUser(email, {
      title: 'Case Notification (manual)',
      body: `${match.CaseNumber || match.Subject || 'Case update'}`,
      url: `/case/${caseId}`,
    });
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, message: e?.message || String(e) });
  }
});

app.get('/api/health', (_, res) => {
  res.json({ ok: true, environment: isProduction ? 'production' : 'development' });
});

async function sendPushToUser(email, payload) {
  const users = await getAllUsers();
  const user = users[(email || '').trim().toLowerCase()];
  if (!user?.subscriptions?.length) return;

  const subs = user.subscriptions;
  const body = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, body);
        pushDebug.lastPushSentAt = new Date().toISOString();
        pushDebug.lastPushSentEmail = (email || '').trim().toLowerCase();
        pushDebug.lastPushError = null;
      } catch (e) {
        pushDebug.lastPushError = e?.message || String(e);
        // 410/404 means subscription is gone - remove it
        const status = e?.statusCode;
        if (status === 404 || status === 410) {
          await removeSubscription(email, sub.endpoint);
        }
      }
    })
  );
}

async function pollForNewCasesOnce() {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  const users = await getAllUsers();
  const emails = Object.keys(users);
  if (emails.length === 0) return;

  await Promise.all(
    emails.map(async (email) => {
      const user = users[email];
      if (!user?.subscriptions?.length) return;

      try {
        const response = await callSalesforce('/services/apexrest/feapi/getcases', {
          method: 'POST',
          body: JSON.stringify({ email }),
        });
        const data = await response.json();
        const rawCases = data?.cases || data?.records || [];
        const filtered = filterCasesForEmail(rawCases, email);

        const lastSeen = new Set((user.lastSeenCaseIds || []).map(String));
        const currentIds = filtered.map((c) => String(c.Id)).filter(Boolean);

        // On first run for a user: just set baseline (avoid spamming)
        if (lastSeen.size === 0) {
          await setLastSeenCaseIds(email, currentIds.slice(0, 200));
          return;
        }

        const newOnes = filtered.filter((c) => c?.Id && !lastSeen.has(String(c.Id)));
        if (newOnes.length > 0) {
          const newest = newOnes[0];
          await sendPushToUser(email, {
            title: 'New Case Assigned',
            body: `${newest.CaseNumber || newest.Subject || 'A new case was added.'}`,
            url: newest.Id ? `/case/${newest.Id}` : '/',
          });
        }

        await setLastSeenCaseIds(email, currentIds.slice(0, 200));
      } catch {
        // ignore transient errors
      }
    })
  );
}

// Poll for new cases on an interval (server-side)
if (!SALESFORCE_REALTIME_ENABLED) {
  setInterval(pollForNewCasesOnce, CASE_POLL_INTERVAL_MS);
}

async function getCaseIdFromRealtimeMessage(message) {
  const header = message?.payload?.ChangeEventHeader;
  const ids = header?.recordIds;
  if (Array.isArray(ids) && ids.length > 0) return String(ids[0]);
  return null;
}

async function fetchCaseForNotification(caseId) {
  // Need relationship fields (Site__r.IPEmail__c), so use SOQL query.
  const soql =
    `SELECT Id, CaseNumber, Subject, Status, CreatedDate, ` +
    `ExtIPEmail__c, Site__r.IPEmail__c ` +
    `FROM Case WHERE Id='${caseId.replace(/'/g, "\\'")}' LIMIT 1`;

  try {
    const res = await callSalesforceRest(
      `/services/data/v${SALESFORCE_API_VERSION}/query?q=${encodeURIComponent(soql)}`,
      { method: 'GET' }
    );
    pushDebug.lastRealtimeFetchStatus = res.status;

    if (!res.ok) {
      const txt = await res.text();
      pushDebug.lastRealtimeFetchBodySnippet = String(txt || '').slice(0, 300);
      return null;
    }

    const data = await res.json();
    const rec = data?.records?.[0];
    pushDebug.lastRealtimeFetchError = null;
    pushDebug.lastRealtimeFetchBodySnippet = null;
    return rec || null;
  } catch (e) {
    pushDebug.lastRealtimeFetchStatus = null;
    pushDebug.lastRealtimeFetchError = e?.message || String(e);
    return null;
  }
}

function extractEmailFromCase(c) {
  return (c?.ExtIPEmail__c || c?.Site__r?.IPEmail__c || '').trim().toLowerCase();
}

async function notifyUsersByApexRestLookup(caseId) {
  const users = await getAllUsers();
  const emails = Object.keys(users);
  if (emails.length === 0) return false;

  let sentAny = false;
  const summary = {
    checkedEmails: emails.length,
    callsOk: 0,
    callsFailed: 0,
    anyMatch: false,
    lastError: null,
  };

  await Promise.all(
    emails.map(async (email) => {
      const user = users[email];
      if (!user?.subscriptions?.length) return;

      const lastSeen = new Set((user.lastSeenCaseIds || []).map(String));
      if (lastSeen.has(String(caseId))) return;

      try {
        const response = await callSalesforce('/services/apexrest/feapi/getcases', {
          method: 'POST',
          body: JSON.stringify({ email }),
        });
        summary.callsOk += 1;
        const data = await response.json();
        const rawCases = data?.cases || data?.records || [];
        const filtered = filterCasesForEmail(rawCases, email);

        const match = filtered.find((c) => String(c?.Id) === String(caseId));
        if (!match) return;
        summary.anyMatch = true;

        await sendPushToUser(email, {
          title: 'New Case Assigned',
          body: `${match.CaseNumber || match.Subject || 'A new case was added.'}`,
          url: `/case/${caseId}`,
        });

        const nextIds = [String(caseId), ...(user.lastSeenCaseIds || []).map(String)].slice(0, 200);
        await setLastSeenCaseIds(email, nextIds);
        sentAny = true;
      } catch (e) {
        summary.callsFailed += 1;
        summary.lastError = e?.message || String(e);
        // ignore transient errors per-user
      }
    })
  );

  pushDebug.lastRealtimeFallbackSummary = summary;
  return sentAny;
}

// Cooldown map to prevent re-notifying the same case within 5 minutes
const realtimeCooldown = new Map();

// Salesforce realtime (CDC) -> instant push notifications
startSalesforceRealtime({
  enabled: SALESFORCE_REALTIME_ENABLED,
  baseUrl: process.env.SALESFORCE_BASE_URL || 'https://cloudextel--ceuat.sandbox.my.salesforce.com',
  apiVersion: SALESFORCE_API_VERSION,
  getOAuthToken,
  channel: SALESFORCE_REALTIME_CHANNEL,
  logger: console,
  onCaseEvent: async (message) => {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;
    pushDebug.lastRealtimeEventAt = new Date().toISOString();
    const caseId = await getCaseIdFromRealtimeMessage(message);
    if (!caseId) return;
    pushDebug.lastRealtimeCaseId = String(caseId);

    const c = await fetchCaseForNotification(caseId);
    if (!c) {
      // Some orgs/users can call Apex REST but not standard REST (/services/data).
      // Fallback: resolve ownership by looking up the case in each subscribed user's Apex REST case list.
      const sent = await notifyUsersByApexRestLookup(caseId);
      pushDebug.lastRealtimeAction = sent ? 'sent' : 'fetch_failed';
      return;
    }

    const email = extractEmailFromCase(c);
    pushDebug.lastRealtimeCaseEmail = email || null;
    if (!email) {
      pushDebug.lastRealtimeAction = 'skipped_no_email';
      return;
    }

    // Only notify if user has an active subscription
    const users = await getAllUsers();
    if (!users[email]?.subscriptions?.length) {
      pushDebug.lastRealtimeAction = 'skipped_no_subscription';
      return;
    }

    // Cooldown: don't re-notify same caseId within 5 minutes (prevents spam on rapid updates)
    const cooldownKey = `${email}:${caseId}`;
    const now = Date.now();
    if (realtimeCooldown.has(cooldownKey) && now - realtimeCooldown.get(cooldownKey) < 5 * 60 * 1000) {
      pushDebug.lastRealtimeAction = 'skipped_cooldown';
      return;
    }

    await sendPushToUser(email, {
      title: 'New Case Assigned',
      body: `${c.CaseNumber || c.Subject || 'A new case was added.'}`,
      url: `/case/${caseId}`,
    });
    pushDebug.lastRealtimeAction = 'sent';
    realtimeCooldown.set(cooldownKey, now);
  },
});

if (isProduction) {
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }
    return res.sendFile(join(distDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT} (${isProduction ? 'production' : 'development'})`);
});
