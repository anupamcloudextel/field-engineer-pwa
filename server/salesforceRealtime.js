import Faye from 'faye';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function startSalesforceRealtime({
  baseUrl,
  apiVersion = '59.0',
  getOAuthToken,
  onCaseEvent,
  channel = '/data/CaseChangeEvent',
  enabled = false,
  logger = console,
}) {
  if (!enabled) return { stop: async () => {} };

  let stopped = false;
  let client = null;
  let subscription = null;

  async function connectLoop() {
    while (!stopped) {
      try {
        const token = await getOAuthToken();
        const cometdUrl = `${baseUrl}/cometd/${apiVersion}/`;

        client = new Faye.Client(cometdUrl, {
          timeout: 60,
          retry: 5,
          interval: 0,
        });

        client.setHeader('Authorization', `Bearer ${token}`);

        subscription = client.subscribe(channel, async (message) => {
          try {
            await onCaseEvent(message);
          } catch (e) {
            logger.warn('Realtime case handler error', e?.message || e);
          }
        });

        logger.log(`Salesforce realtime subscribed: ${channel}`);

        // Keep loop alive while connected
        while (!stopped) {
          await sleep(30_000);
        }
      } catch (e) {
        logger.warn('Salesforce realtime connect failed; retrying', e?.message || e);
        await sleep(5_000);
      }
    }
  }

  connectLoop();

  return {
    stop: async () => {
      stopped = true;
      try {
        await subscription?.cancel?.();
      } catch {
        // ignore
      }
      try {
        client?.disconnect?.();
      } catch {
        // ignore
      }
    },
  };
}

