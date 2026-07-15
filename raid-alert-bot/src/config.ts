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
};

/** KAOS+'s VAPID public key -- embedded in bot-app.ka0s.uk's page source,
 * meant to be public (any client subscribing to KAOS+ push needs it). */
export const KAOS_VAPID_PUBLIC_KEY =
  "BK1HQ_7Wrsb85NjJtQ9HlCAQ3KxUwlgUej4hEy7aTHoszHk913Pob27Q0JWz5y48wZVtY9vVPAmaevT0VXmd764";

export const KAOS_REGISTER_DEVICE_URL =
  "https://bot-app.ka0s.uk/api.php?endpoint=register-device";
