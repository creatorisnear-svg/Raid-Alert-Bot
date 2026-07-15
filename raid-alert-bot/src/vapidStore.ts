import fs from "fs";
import path from "path";
import webpush from "web-push";
import { config } from "./config";

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

const DATA_DIR = path.join(__dirname, "..", "data");
const VAPID_FILE = path.join(DATA_DIR, "vapid-keys.json");

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Loads this server's own VAPID key pair (used to send web push to clan
 * members' installed app -- NOT the same as KAOS's VAPID key, which we use
 * only to impersonate a device on KAOS's side).
 *
 * These keys MUST stay stable forever once clan members have subscribed:
 * every subscription is cryptographically tied to the public key it was
 * created with, so regenerating the pair invalidates every existing
 * install and forces everyone to reinstall/resubscribe.
 */
export function loadOrCreateVapidKeys(): VapidKeys {
  if (config.vapidKeysJson) {
    try {
      return JSON.parse(config.vapidKeysJson) as VapidKeys;
    } catch (err) {
      throw new Error(`Failed to parse VAPID_KEYS_JSON: ${(err as Error).message}`);
    }
  }

  ensureDataDir();
  if (fs.existsSync(VAPID_FILE)) {
    return JSON.parse(fs.readFileSync(VAPID_FILE, "utf-8")) as VapidKeys;
  }

  console.log("No stored VAPID keys found -- generating a new key pair for the clan app...");
  const keys = webpush.generateVAPIDKeys();
  fs.writeFileSync(VAPID_FILE, JSON.stringify(keys, null, 2));
  console.log(
    "=== New VAPID keys saved to data/vapid-keys.json ===\n" +
      "If you're deploying somewhere without a persistent disk (e.g. Koyeb),\n" +
      "copy the line below into the VAPID_KEYS_JSON environment variable so a\n" +
      "redeploy doesn't wipe them out -- if these keys ever change, every clan\n" +
      "member who installed the app will have to reinstall it.\n\n" +
      `VAPID_KEYS_JSON=${JSON.stringify(keys)}\n`
  );
  return keys;
}
