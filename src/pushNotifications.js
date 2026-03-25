import { getVapidPublicKey, subscribePush } from './api/client';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export async function enableCasePushNotifications(email) {
  if (!email) return { success: false, message: 'Missing email' };
  if (!window.isSecureContext) {
    return { success: false, message: 'Push requires HTTPS (or localhost)' };
  }
  if (!('serviceWorker' in navigator)) return { success: false, message: 'Service worker not supported' };
  if (!('PushManager' in window)) return { success: false, message: 'Push not supported on this device/browser' };

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { success: false, message: 'Notification permission not granted' };

  const reg = await navigator.serviceWorker.ready;

  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    await subscribePush(email, existing);
    return { success: true, alreadySubscribed: true };
  }

  const keyRes = await getVapidPublicKey();
  const publicKey = keyRes?.publicKey;
  if (!publicKey) return { success: false, message: keyRes?.error || 'Missing VAPID public key' };

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  await subscribePush(email, subscription);
  return { success: true, alreadySubscribed: false };
}

