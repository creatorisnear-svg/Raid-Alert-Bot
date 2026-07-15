/**
 * Clan registry — edit this file to add or remove clans.
 *
 * Each clan needs its own deployed raid-alert-bot instance (one per clan).
 * The botUrl should point to that clan's Koyeb (or other) deployment.
 *
 * For APK builds, set the URL as an EAS environment variable and reference
 * it here via process.env.EXPO_PUBLIC_*. Add matching entries to .env.example.
 */

export type Clan = {
  id: string;     // unique slug, used for storage key
  name: string;   // display name shown in the UI
  color: string;  // brand accent color (hex)
  botUrl: string; // base URL of this clan's raid-alert-bot deployment
};

export const AVAILABLE_CLANS: Clan[] = [
  {
    id: 'aviv',
    name: 'AVIV',
    color: '#e8430a',
    botUrl: (process.env.EXPO_PUBLIC_BOT_URL ?? '').replace(/\/$/, ''),
  },
  // ── Add more clans below ───────────────────────────────────────────────
  // Each clan needs its own deployed raid-alert-bot and its own env var.
  //
  // {
  //   id: 'tck',
  //   name: 'TCK',
  //   color: '#3498db',
  //   botUrl: (process.env.EXPO_PUBLIC_TCK_BOT_URL ?? '').replace(/\/$/, ''),
  // },
  // {
  //   id: 'nova',
  //   name: 'NOVA',
  //   color: '#9b59b6',
  //   botUrl: (process.env.EXPO_PUBLIC_NOVA_BOT_URL ?? '').replace(/\/$/, ''),
  // },
];

export const DEFAULT_CLAN = AVAILABLE_CLANS[0]!;
