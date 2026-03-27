import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';

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
      origin: true,
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
