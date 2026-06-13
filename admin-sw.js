/**
 * admin-sw.js — Alfonex Admin Panel Service Worker
 *
 * Responsibilities:
 *   1. Cache the app shell for offline / fast reload (optional, lightweight)
 *   2. Receive FCM background push messages and show rich notifications
 *   3. Handle notification clicks — focus existing tab or open the correct section
 */

// ── Firebase Messaging (background push support) ───────────────────────────────
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            'AIzaSyCTM2dhEVY5lFq7bNkIR7Gne-phh0nABXQ',
  authDomain:        'update1-b4bf5.firebaseapp.com',
  databaseURL:       'https://update1-b4bf5-default-rtdb.firebaseio.com',
  projectId:         'update1-b4bf5',
  storageBucket:     'update1-b4bf5.firebasestorage.app',
  messagingSenderId: '1049308656123',
  appId:             '1:1049308656123:web:c966f04f25a0322ac71b5e',
});

const messaging = firebase.messaging();

// ── Background message handler ─────────────────────────────────────────────────
// Fires when a push arrives while the admin tab is closed or in the background.
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  const data            = payload.data         || {};

  self.registration.showNotification(title || 'Alfonex Admin', {
    body:    body || '',
    icon:    '/logo.png',
    badge:   '/logo.png',
    tag:     data.tag    || 'admin-notification',  // tag deduplicates; same tag replaces old
    data:    { url: data.url || './index.html' },
    vibrate: [200, 100, 200],
    requireInteraction: true,  // notification stays until dismissed
    actions: [
      { action: 'open',    title: '👁 Open' },
      { action: 'dismiss', title: '✕ Dismiss' },
    ],
  });
});

// ── Direct push fallback (non-FCM Web Push) ────────────────────────────────────
// Handles standard Web Push payloads if you ever switch away from FCM.
self.addEventListener('push', (event) => {
  // FCM messaging.onBackgroundMessage already handles Firebase pushes,
  // so this only runs for non-FCM origins.
  if (!event.data) return;

  let payload = {};
  try { payload = event.data.json(); } catch { payload = { title: event.data.text() }; }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Alfonex Admin', {
      body:    payload.body  || '',
      icon:    payload.icon  || '/logo.png',
      badge:   '/logo.png',
      tag:     payload.tag   || 'admin-notification',
      data:    { url: payload.url || './index.html' },
      vibrate: [200, 100, 200],
      requireInteraction: true,
    })
  );
});

// ── Notification click handler ─────────────────────────────────────────────────
// 1. Dismiss the notification.
// 2. If an admin tab is already open → focus it (and navigate to the deep link).
// 3. Otherwise → open a new tab at the deep link URL.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || './index.html';
  const action    = event.action;

  // Clicking "Dismiss" action → just close, do nothing else
  if (action === 'dismiss') return;

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Find any existing admin tab
        const adminTab = clientList.find(
          (c) => c.url.includes('index.html') || c.url.includes(self.location.origin),
        );

        if (adminTab) {
          // Focus the existing tab and navigate it to the deep link
          return adminTab.focus().then(() => {
            if ('navigate' in adminTab) adminTab.navigate(targetUrl);
          });
        }

        // No existing tab — open one
        return clients.openWindow(targetUrl);
      })
  );
});

// ── Basic app-shell caching (offline support) ──────────────────────────────────
const CACHE_NAME = 'alfonex-admin-v1';
const SHELL      = ['./index.html', './logo.png', './manifest.json'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first for HTML (always fresh), cache-first for static assets
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Only intercept same-origin requests
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
