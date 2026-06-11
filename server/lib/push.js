/**
 * @file Handles web push notifications using the `web-push` library, including generating/loading VAPID keys, sending notifications to all subscribed clients, and cleaning up invalid subscriptions. It provides a function to retrieve the public VAPID key for client registration and a function to broadcast notifications to all subscribers stored in the database.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const webpush = require("web-push");
const path = require("path");
const fs = require("fs");
const { getDataDir } = require("./claude-home");

// Lives in the shared data dir alongside the SQLite DB (see getDataDir), so the
// web app and the native apps reuse one set of VAPID keys.
const KEYS_PATH = path.join(getDataDir(), "vapid-keys.json");

function loadOrCreateVapidKeys() {
  if (fs.existsSync(KEYS_PATH)) {
    return JSON.parse(fs.readFileSync(KEYS_PATH, "utf8"));
  }
  const keys = webpush.generateVAPIDKeys();
  fs.mkdirSync(path.dirname(KEYS_PATH), { recursive: true });
  fs.writeFileSync(KEYS_PATH, JSON.stringify(keys, null, 2));
  return keys;
}

const vapidKeys = loadOrCreateVapidKeys();

webpush.setVapidDetails(
  "https://github.com/hoangsonww/Claude-Code-Agent-Monitor",
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

function getPublicKey() {
  return vapidKeys.publicKey;
}

/**
 * Fire a native OS notification when this process is the Electron main process
 * (i.e. the desktop app embeds the server in-process). Web Push is unreliable
 * inside Electron — Chromium-in-Electron ships without Firebase Cloud
 * Messaging credentials, so `pushManager.subscribe()` in the renderer either
 * fails or returns an endpoint that nothing can ever deliver to, leaving the
 * `push_subscriptions` table empty. Calling Electron's main-process
 * Notification API directly side-steps the push service entirely.
 *
 * Returns true when a notification was actually shown.
 *
 * @param {string} title
 * @param {string} body
 * @returns {boolean}
 */
function showNativeNotificationIfElectron(title, body) {
  if (!process.versions || !process.versions.electron) return false;
  try {
    // `require("electron")` only resolves inside the Electron runtime; in a
    // plain `node server/index.js` host it throws and we fall through.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Notification: ElectronNotification } = require("electron");
    if (!ElectronNotification) return false;
    if (
      typeof ElectronNotification.isSupported === "function" &&
      !ElectronNotification.isSupported()
    ) {
      return false;
    }
    new ElectronNotification({ title, body, silent: false }).show();
    return true;
  } catch {
    return false;
  }
}

/**
 * Dispatch a notification to every reachable surface:
 *   - A native Electron notification when hosted inside the desktop app.
 *   - A Web Push delivery to every subscribed browser endpoint.
 *
 * Both legs run unconditionally so whichever surface the user is on receives
 * the alert. Under `npm start` the native leg is a no-op; under the desktop
 * app the Web Push leg is typically a no-op (no FCM credentials in Electron,
 * so `push_subscriptions` is empty).
 *
 * Returns `{ native, pushed, failed }` so the caller can surface what actually
 * happened in its API response — silent failures stop looking like success.
 */
async function sendPushToAll(db, title, body) {
  const native = showNativeNotificationIfElectron(title, body);

  const subscriptions = db.prepare("SELECT * FROM push_subscriptions").all();
  if (subscriptions.length === 0) {
    return { native, pushed: 0, failed: 0 };
  }

  const payload = JSON.stringify({
    title,
    body,
    icon: "https://raw.githubusercontent.com/hoangsonww/Claude-Code-Agent-Monitor/main/client/public/favicon.ico",
    badge:
      "https://raw.githubusercontent.com/hoangsonww/Claude-Code-Agent-Monitor/main/client/public/favicon.ico",
    silent: false,
    sound: "default",
  });
  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
    )
  );

  // Remove subscriptions that are gone (HTTP 410); count what landed.
  let pushed = 0;
  let failed = 0;
  for (let index = 0; index < results.length; index++) {
    const result = results[index];
    if (result.status === "fulfilled") {
      pushed++;
    } else {
      failed++;
      if (result.reason?.statusCode === 410) {
        db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(
          subscriptions[index].endpoint
        );
      }
    }
  }

  return { native, pushed, failed };
}

module.exports = { getPublicKey, sendPushToAll, showNativeNotificationIfElectron };
