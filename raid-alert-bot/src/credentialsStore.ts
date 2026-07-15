import fs from "node:fs";
import path from "node:path";
import { config } from "./config";

const DATA_DIR = path.join(__dirname, "..", "data");
const CREDENTIALS_PATH = path.join(DATA_DIR, "credentials.json");

export interface StoredCredentials {
  gcm: {
    token: string;
    androidId: string;
    securityToken: string;
    appId: string;
  };
  keys: {
    publicKey: string; // base64
    privateKey: string; // base64
    authSecret: string; // base64
  };
}

/**
 * Loads previously generated push-device credentials, preferring (in order):
 * 1. the CREDENTIALS_JSON env var (survives Koyeb redeploys, since the
 *    filesystem there is not guaranteed to persist across them)
 * 2. the local data/credentials.json file (survives plain restarts)
 * 3. null, meaning the caller should generate fresh credentials and register
 *    them as a new device with KAOS.
 */
export function loadCredentials(): StoredCredentials | null {
  if (config.credentialsJson) {
    try {
      return JSON.parse(config.credentialsJson) as StoredCredentials;
    } catch {
      console.warn(
        "CREDENTIALS_JSON is set but is not valid JSON -- ignoring it."
      );
    }
  }
  if (fs.existsSync(CREDENTIALS_PATH)) {
    try {
      return JSON.parse(
        fs.readFileSync(CREDENTIALS_PATH, "utf-8")
      ) as StoredCredentials;
    } catch {
      console.warn("data/credentials.json is not valid JSON -- ignoring it.");
    }
  }
  return null;
}

export function saveCredentials(creds: StoredCredentials): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(creds, null, 2));
  console.log(
    "\n=== Push-device credentials saved to data/credentials.json ===\n" +
      "If you're deploying somewhere without a persistent disk (e.g. Koyeb),\n" +
      "copy the line below into the CREDENTIALS_JSON environment variable so\n" +
      "a redeploy doesn't have to re-register (and re-register would otherwise\n" +
      "briefly interrupt delivery while the new device is set up):\n\n" +
      `CREDENTIALS_JSON=${JSON.stringify(creds)}\n`
  );
}
