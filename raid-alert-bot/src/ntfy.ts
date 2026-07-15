/**
 * ntfy.sh push-notification alert.
 *
 * ntfy.sh is a free, open-source push notification service. Install the ntfy
 * app on your phone (iOS or Android), subscribe to your topic, and every raid
 * alert will send a high-priority notification that sounds + vibrates even
 * when the screen is off.
 *
 * Android: priority 5 ("max") bypasses Do Not Disturb on most Android versions.
 * iPhone: sounds and vibrates unless the physical mute switch is on -- iOS
 *         does not allow any third-party app to bypass the mute switch without
 *         Apple's special Critical Alerts entitlement.
 *
 * Setup (takes about 2 minutes):
 *   1. Pick a unique topic name -- treat it like a password since anyone who
 *      knows it can send to it. Something like "tck-raids-xk29qf" works well.
 *   2. Install the ntfy app (ntfy.sh/app) on every phone that needs alerts.
 *   3. In the app, tap + and subscribe to your topic name.
 *   4. Set NTFY_TOPIC in Koyeb's env vars. That's it -- no account needed.
 *
 * Required Koyeb env var:
 *   NTFY_TOPIC   -- your unique topic name, e.g. "tck-raids-xk29qf"
 *
 * Optional:
 *   NTFY_SERVER  -- self-hosted ntfy server URL. Defaults to https://ntfy.sh
 */

import { RaidAlert } from "./pushListener";

interface NtfyConfig {
  server: string;
  topic: string;
}

function loadNtfyConfig(): NtfyConfig | null {
  const topic = process.env.NTFY_TOPIC?.trim();
  if (!topic) return null;

  const server = (process.env.NTFY_SERVER?.trim() || "https://ntfy.sh").replace(/\/$/, "");
  return { server, topic };
}

export async function ntfyRaidAlert(alert: RaidAlert): Promise<void> {
  const cfg = loadNtfyConfig();
  if (!cfg) {
    console.log(
      "ntfy not configured -- skipping push notification " +
        "(set NTFY_TOPIC in Koyeb env vars to enable -- see .env.example)."
    );
    return;
  }

  const title = alert.title || "Raid Alert!";
  const body = alert.body ? alert.body : "Your base is under attack. Check Discord now.";

  const response = await fetch(`${cfg.server}/${cfg.topic}`, {
    method: "POST",
    headers: {
      // Priority 5 = max/urgent -- bypasses DND on Android
      Priority: "5",
      Title: title,
      Tags: "rotating_light",
      // Vibrate pattern in milliseconds: on,off,on,off,on
      "X-Actions": "view, Open Discord, https://discord.com",
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ntfy push failed (${response.status}): ${text}`);
  }

  console.log(`ntfy raid alert sent to topic "${cfg.topic}".`);
}
