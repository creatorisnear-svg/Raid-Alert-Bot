/**
 * File-backed store of Expo push tokens for Android app subscribers.
 *
 * Follows the same pattern as subscribersStore.ts for web-push subscribers.
 * Data is stored in data/native-subscribers.json (relative to dist/ on
 * Koyeb -- mount a persistent volume at /app/data if you want tokens to
 * survive redeploys, same as the advice for subscribers.json).
 */

import fs from "fs";
import path from "path";

const DATA_FILE = path.join(__dirname, "..", "data", "native-subscribers.json");

function ensureDir(): void {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function loadNativeSubscribers(): string[] {
  ensureDir();
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed as string[];
    return [];
  } catch {
    return [];
  }
}

function saveNativeSubscribers(tokens: string[]): void {
  ensureDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(tokens, null, 2), "utf8");
}

/** Add a token. Returns true if it was newly added, false if already present. */
export function addNativeSubscriber(token: string): boolean {
  const tokens = loadNativeSubscribers();
  if (tokens.includes(token)) return false;
  tokens.push(token);
  saveNativeSubscribers(tokens);
  return true;
}

/** Remove a token by value. No-op if not found. */
export function removeNativeSubscriber(token: string): void {
  const tokens = loadNativeSubscribers().filter((t) => t !== token);
  saveNativeSubscribers(tokens);
}
