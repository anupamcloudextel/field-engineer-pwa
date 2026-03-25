import { promises as fs } from 'fs';
import { join } from 'path';

const STORE_PATH = join(process.cwd(), 'server', 'pushStore.json');

async function readJsonOrDefault() {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { users: {} };
    if (!parsed.users || typeof parsed.users !== 'object') return { users: {} };
    return parsed;
  } catch {
    return { users: {} };
  }
}

async function writeJson(data) {
  await fs.mkdir(join(process.cwd(), 'server'), { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export async function upsertSubscription(email, subscription) {
  const key = (email || '').trim().toLowerCase();
  if (!key) throw new Error('email is required');
  if (!subscription?.endpoint) throw new Error('subscription.endpoint is required');

  const store = await readJsonOrDefault();
  store.users[key] ||= { subscriptions: [], lastSeenCaseIds: [] };

  const subs = store.users[key].subscriptions;
  const exists = subs.some((s) => s.endpoint === subscription.endpoint);
  if (!exists) subs.push(subscription);

  await writeJson(store);
  return store.users[key];
}

export async function removeSubscription(email, endpoint) {
  const key = (email || '').trim().toLowerCase();
  if (!key) throw new Error('email is required');
  if (!endpoint) throw new Error('endpoint is required');

  const store = await readJsonOrDefault();
  if (!store.users[key]) return { subscriptions: [], lastSeenCaseIds: [] };

  store.users[key].subscriptions = (store.users[key].subscriptions || []).filter((s) => s.endpoint !== endpoint);
  await writeJson(store);
  return store.users[key];
}

export async function getAllUsers() {
  const store = await readJsonOrDefault();
  return store.users || {};
}

export async function setLastSeenCaseIds(email, ids) {
  const key = (email || '').trim().toLowerCase();
  if (!key) throw new Error('email is required');

  const store = await readJsonOrDefault();
  store.users[key] ||= { subscriptions: [], lastSeenCaseIds: [] };
  store.users[key].lastSeenCaseIds = Array.isArray(ids) ? ids : [];
  await writeJson(store);
  return store.users[key];
}

