function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.example.`
    );
  }
  return value;
}

export const config = {
  raidKey: required("RAID_KEY"),
  kaosApiKey: required("KAOS_API_KEY"),
  discordWebhookUrl: required("DISCORD_WEBHOOK_URL"),
  pingTarget: (process.env.PING_TARGET || "everyone").trim(),
  credentialsJson: process.env.CREDENTIALS_JSON || "",
  port: Number(process.env.PORT) || 8787,
  clanName: (process.env.CLAN_NAME || "TCK").trim(),
  vapidKeysJson: process.env.VAPID_KEYS_JSON || "",
  // Contact address required by the push spec (VAPID "subject"). Push
  // services use this to reach the sender if something's wrong, e.g. too
  // many notifications. Doesn't need to be real/monitored.
  vapidContactEmail: (process.env.VAPID_CONTACT_EMAIL || "mailto:admin@example.com").trim(),

  // ── Clan registry ──────────────────────────────────────────────────────
  // Unique slug for this clan (lowercase, no spaces). Used as the clan's ID
  // in the registry. Defaults to a slug of CLAN_NAME.
  clanId: (process.env.CLAN_ID || "").trim() ||
    (process.env.CLAN_NAME || "tck").toLowerCase().replace(/\s+/g, "-").trim(),
  // Brand colour shown in the Android app's clan picker.
  clanColor: (process.env.CLAN_COLOR || "#e8430a").trim(),
  // The publicly accessible URL of THIS bot (e.g. https://aviv-bot.koyeb.app).
  // Required for self-registration. Omit to skip registration.
  publicUrl: (process.env.CLAN_PUBLIC_URL || "").replace(/\/$/, "").trim(),
  // If this bot is NOT the main registry, point it at the registry bot's URL.
  // Leave blank on the registry bot itself.
  registryUrl: (process.env.CLAN_REGISTRY_URL || "").replace(/\/$/, "").trim(),
  // Shared secret. Must match on both the registry bot and all clan bots.
  registryKey: (process.env.CLAN_REGISTRY_KEY || "").trim(),
};

/** KAOS+'s VAPID public key -- embedded in bot-app.ka0s.uk's page source,
 * meant to be public (any client subscribing to KAOS+ push needs it). */
export const KAOS_VAPID_PUBLIC_KEY =
  "BK1HQ_7Wrsb85NjJtQ9HlCAQ3KxUwlgUej4hEy7aTHoszHk913Pob27Q0JWz5y48wZVtY9vVPAmaevT0VXmd764";

export const KAOS_REGISTER_DEVICE_URL =
  "https://bot-app.ka0s.uk/api.php?endpoint=register-device";
