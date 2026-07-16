/**
 * File-backed registry of all clans that have registered with this bot.
 *
 * The main AVIV bot acts as the registry:
 *  • It registers itself on startup (if CLAN_PUBLIC_URL is set).
 *  • Other clan bots POST to /api/register-clan, which upserts an entry here.
 *  • The Android app fetches /api/clans, which reads this list.
 *
 * Mount a persistent volume at /app/data on Koyeb so entries survive redeploys.
 */

import fs from "fs";
import path from "path";

const DATA_FILE = path.join(__dirname, "..", "data", "clans.json");

export type RegisteredClan = {
  id: string;     // unique slug, e.g. "aviv"
  name: string;   // display name, e.g. "AVIV"
  color: string;  // hex accent colour, e.g. "#e8430a"
  botUrl: string; // public URL of that clan's raid-alert-bot
  registeredAt: string; // ISO timestamp
};

function ensureDir(): void {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function loadClans(): RegisteredClan[] {
  ensureDir();
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed as RegisteredClan[];
  } catch { /* file missing or corrupt — start fresh */ }
  return [];
}

export function upsertClan(clan: Omit<RegisteredClan, "registeredAt">): void {
  ensureDir();
  const existing = loadClans().filter((c) => c.id !== clan.id);
  existing.push({ ...clan, registeredAt: new Date().toISOString() });
  fs.writeFileSync(DATA_FILE, JSON.stringify(existing, null, 2), "utf8");
}

export function removeClan(id: string): void {
  ensureDir();
  const existing = loadClans().filter((c) => c.id !== id);
  fs.writeFileSync(DATA_FILE, JSON.stringify(existing, null, 2), "utf8");
}
