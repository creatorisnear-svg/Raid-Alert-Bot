/**
 * Dynamic clan registry client.
 *
 * Instead of hard-coding clans in the APK, the app fetches the list from
 * the main AVIV bot at runtime. New clans appear automatically as soon as
 * their bot registers — no code change or APK rebuild needed.
 *
 * The registry is served by the AVIV bot at GET /api/clans.
 * Clans register themselves by calling POST /api/register-clan on startup.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = (process.env.EXPO_PUBLIC_BOT_URL ?? '').replace(/\/$/, '');

export type Clan = {
  id: string;
  name: string;
  color: string;
  botUrl: string;
  registeredAt?: string;
};

/** Shown immediately while the network request is in flight. */
export const FALLBACK_CLANS: Clan[] = [
  { id: 'aviv', name: 'AVIV', color: '#e8430a', botUrl: BASE_URL },
];

const CACHE_KEY = 'clanRegistry_v1';

/** Fetch the live clan list from the AVIV bot, cache it, and return it. */
export async function fetchClanRegistry(): Promise<Clan[]> {
  if (!BASE_URL) return FALLBACK_CLANS;

  const res = await fetch(`${BASE_URL}/api/clans`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) throw new Error(`Registry returned ${res.status}`);

  const data = (await res.json()) as Clan[];
  const valid = data.filter((c) => c.id && c.name && c.botUrl);

  if (valid.length > 0) {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(valid)).catch(() => {});
  }

  return valid.length > 0 ? valid : FALLBACK_CLANS;
}

/** Load the last-cached clan list (used before the network request finishes). */
export async function loadCachedClans(): Promise<Clan[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return FALLBACK_CLANS;
    const parsed = JSON.parse(raw) as Clan[];
    return parsed.length > 0 ? parsed : FALLBACK_CLANS;
  } catch {
    return FALLBACK_CLANS;
  }
}
