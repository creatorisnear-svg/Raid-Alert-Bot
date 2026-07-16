/**
 * On-device clan store.
 *
 * Clans are saved in AsyncStorage — no server registry, no env vars, no
 * config file edits needed. To add a clan, paste the bot URL in the app.
 * The app calls /api/config on that URL and auto-detects the name & colour.
 *
 * The AVIV clan is pre-seeded from EXPO_PUBLIC_BOT_URL on first launch.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export type Clan = {
  id: string;
  name: string;
  color: string;
  botUrl: string;
};

const STORAGE_KEY = 'clans_v3';
const BASE_URL = (process.env.EXPO_PUBLIC_BOT_URL ?? '').replace(/\/$/, '');

/** The clan baked into the APK at build time (EXPO_PUBLIC_BOT_URL). */
export const SEED_CLAN: Clan | null = BASE_URL
  ? { id: 'aviv', name: 'AVIV', color: '#e8430a', botUrl: BASE_URL }
  : null;

/** Shown immediately before AsyncStorage loads. Always has at least one entry. */
export const FALLBACK_CLANS: Clan[] = SEED_CLAN
  ? [SEED_CLAN]
  : [{ id: 'aviv', name: 'AVIV', color: '#e8430a', botUrl: '' }];

// ─────────────────────────────────────────────────────────────────────────────

/** Load all saved clans. Seeds AVIV on first launch if EXPO_PUBLIC_BOT_URL is set. */
export async function loadStoredClans(): Promise<Clan[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Clan[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* corrupt data — fall through to seed */ }

  // First launch: seed from the baked-in bot URL
  if (SEED_CLAN) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([SEED_CLAN]));
    return [SEED_CLAN];
  }
  return [];
}

/** Persist the full clan list. */
export async function saveClans(clans: Clan[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(clans));
}

/**
 * Add (or update) a clan by its bot URL.
 * Calls /api/config on the bot to auto-detect name, colour, and ID.
 * Throws if the URL is unreachable or not a recognised raid-alert-bot.
 */
export async function addClanByUrl(rawUrl: string): Promise<Clan> {
  const botUrl = rawUrl.trim().replace(/\/$/, '');
  if (!botUrl) throw new Error('Please enter a URL');

  let res: Response;
  try {
    res = await fetch(`${botUrl}/api/config`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(9000),
    });
  } catch {
    throw new Error("Can't reach that URL — check it and try again");
  }

  if (!res.ok) throw new Error(`Bot returned ${res.status} — wrong URL?`);

  let cfg: { clanName?: string; clanColor?: string; clanId?: string };
  try {
    cfg = (await res.json()) as typeof cfg;
  } catch {
    throw new Error("That URL didn't return a valid bot response");
  }

  const name  = (cfg.clanName  ?? 'Unknown').trim();
  const color = (cfg.clanColor ?? '#888888').trim();
  const id    = (cfg.clanId    ?? name.toLowerCase().replace(/[^a-z0-9]+/g, '-')).trim();
  const clan: Clan = { id, name, color, botUrl };

  const existing = await loadStoredClans();
  const updated  = [...existing.filter(c => c.id !== id), clan];
  await saveClans(updated);
  return clan;
}

/** Remove a clan by ID. Returns the updated list. */
export async function removeClanById(id: string): Promise<Clan[]> {
  const existing = await loadStoredClans();
  const updated  = existing.filter(c => c.id !== id);
  await saveClans(updated);
  return updated;
}
