import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import webpush from 'web-push';
import { removeSubscription, upsertSubscription } from './pushStore.js';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(rootDir, 'dist');

config({ path: join(rootDir, '.env') });

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const isProduction = process.env.NODE_ENV === 'production';

function requireEnv(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

// Fail fast in production if required vars are missing
if (isProduction) {
  requireEnv('SALESFORCE_CLIENT_ID');
  requireEnv('SALESFORCE_CLIENT_SECRET');
  requireEnv('SALESFORCE_USERNAME');
  requireEnv('SALESFORCE_PASSWORD');
  requireEnv('VAPID_PUBLIC_KEY');
  requireEnv('VAPID_PRIVATE_KEY');
}

app.disable('x-powered-by');
if (isProduction) app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: false, // app loads Google Fonts; set CSP at your reverse proxy when you have final domain
    crossOriginEmbedderPolicy: false,
  })
);

app.use(express.json({ limit: '1mb' }));

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: isProduction ? 300 : 1000,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

if (!isProduction) {
  app.use(cors({ origin: true, credentials: true }));
} else if (process.env.CORS_ORIGINS) {
  const allowed = process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
  app.use(cors({ origin: allowed, credentials: true }));
}

let cachedToken = null;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

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
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    if (response.status === 401 && !retry) {
      cachedToken = null;
      return doCall(true);
    }

    return response;
  }

  return doCall(false);
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
  if (!VAPID_PUBLIC_KEY) {
    return res.status(503).json({ error: 'Push is not configured (missing VAPID_PUBLIC_KEY)' });
  }
  return res.json({ publicKey: VAPID_PUBLIC_KEY });
});

app.post('/api/push/subscribe', async (req, res) => {
  try {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return res.status(503).json({ error: 'Push is not configured (missing VAPID keys)' });
    }
    const { email, subscription } = req.body || {};
    await upsertSubscription(email, subscription);
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

app.get('/api/picklist/:object/:field', async (req, res) => {
  try {
    const { object, field } = req.params;
    const apiVersion = process.env.SALESFORCE_API_VERSION || '59.0';

    // 1. Get object info to find default record type ID
    const objRes = await callSalesforce(`/services/data/v${apiVersion}/ui-api/object-info/${object}`, {
      method: 'GET',
    });

    if (!objRes.ok) {
      const err = await objRes.text();
      return res.status(objRes.status).json({ success: false, message: `Failed to fetch object info: ${err}` });
    }

    const objData = await objRes.json();
    const rtId = objData.defaultRecordTypeId || '012000000000000AAA';

    // 2. Fetch picklist values for the field
    const pkRes = await callSalesforce(
      `/services/data/v${apiVersion}/ui-api/object-info/${object}/picklist-values/${rtId}/${field}`,
      { method: 'GET' }
    );

    if (!pkRes.ok) {
      const err = await pkRes.text();
      return res.status(pkRes.status).json({ success: false, message: `Failed to fetch picklist values: ${err}` });
    }

    const pkData = await pkRes.json();
    const values = (pkData.values || []).map((v) => v.label);

    res.json({ success: true, values });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get('/api/unique-values/:object/:field', async (req, res) => {
  const { object, field } = req.params;
  try {
    const apiVersion = process.env.SALESFORCE_API_VERSION || '59.0';
    const soql = `SELECT ${field} FROM ${object} WHERE ${field} != null ORDER BY CreatedDate DESC LIMIT 2000`;
    const response = await callSalesforce(`/services/data/v${apiVersion}/query?q=${encodeURIComponent(soql)}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ success: false, message: `Failed to fetch unique values: ${err}` });
    }

    const data = await response.json();
    const rawValues = (data.records || []).map(r => r[field]);
    const values = Array.from(new Set(rawValues)).filter(Boolean).sort();

    res.json({ success: true, values });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get('/api/health', (_, res) => {
  res.json({ ok: true, environment: isProduction ? 'production' : 'development' });
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
