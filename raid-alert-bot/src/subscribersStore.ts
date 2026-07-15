import fs from "fs";
import path from "path";
import webpush from "web-push";

const DATA_DIR = path.join(__dirname, "..", "data");
const SUBSCRIBERS_FILE = path.join(DATA_DIR, "subscribers.json");

export type StoredSubscription = webpush.PushSubscription;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * File-backed list of clan members' installed-app push subscriptions.
 *
 * NOTE: on Koyeb's default (no attached volume) this directory is wiped on
 * every redeploy, so subscribers will need to reopen the app once after a
 * redeploy to resubscribe. Attach a persistent volume mounted at this
 * service's data/ directory to avoid that -- see README.
 */
export function loadSubscribers(): StoredSubscription[] {
  ensureDataDir();
  if (!fs.existsSync(SUBSCRIBERS_FILE)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, "utf-8")) as StoredSubscription[];
  } catch (err) {
    console.error("Failed to read subscribers.json, starting empty:", err);
    return [];
  }
}

function saveSubscribers(subs: StoredSubscription[]): void {
  ensureDataDir();
  fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(subs, null, 2));
}

export function addSubscriber(sub: StoredSubscription): { added: boolean; total: number } {
  const subs = loadSubscribers();
  const exists = subs.some((s) => s.endpoint === sub.endpoint);
  if (!exists) {
    subs.push(sub);
    saveSubscribers(subs);
  }
  return { added: !exists, total: subs.length };
}

export function removeSubscriberByEndpoint(endpoint: string): void {
  const subs = loadSubscribers().filter((s) => s.endpoint !== endpoint);
  saveSubscribers(subs);
}
