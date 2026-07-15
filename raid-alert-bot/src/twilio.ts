/**
 * Twilio phone-call alert.
 *
 * When a raid fires, this places a real incoming call to every number in
 * TWILIO_CALL_NUMBERS. A real call rings the phone even when the screen is
 * off or the ringer is set to silent (on most phones). Works on iPhone and
 * Android.
 *
 * All env vars are OPTIONAL -- if TWILIO_ACCOUNT_SID is not set the module
 * does nothing and logs a single "Twilio not configured" line so the bot
 * keeps working without it.
 *
 * Required Koyeb env vars (set all four or none):
 *   TWILIO_ACCOUNT_SID   -- from Twilio Console > Account Info
 *   TWILIO_AUTH_TOKEN    -- from Twilio Console > Account Info
 *   TWILIO_FROM_NUMBER   -- your Twilio phone number in E.164 format, e.g. +12015551234
 *   TWILIO_CALL_NUMBERS  -- comma-separated E.164 numbers to call, e.g. +447911123456,+14155551234
 *
 * Optional:
 *   TWILIO_CALL_MESSAGE  -- what the robot voice says. Default: "Raid alert! Your base is under attack."
 */

import { RaidAlert } from "./pushListener";

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  callNumbers: string[];
  callMessage: string;
}

function loadTwilioConfig(): TwilioConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim();
  const callNumbersRaw = process.env.TWILIO_CALL_NUMBERS?.trim();

  if (!accountSid || !authToken || !fromNumber || !callNumbersRaw) {
    return null;
  }

  const callNumbers = callNumbersRaw
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);

  if (callNumbers.length === 0) {
    return null;
  }

  const callMessage =
    process.env.TWILIO_CALL_MESSAGE?.trim() ||
    "Raid alert! Your base is under attack. Check Discord now.";

  return { accountSid, authToken, fromNumber, callNumbers, callMessage };
}

function buildTwiml(message: string, alert: RaidAlert): string {
  // Escape XML special chars in the dynamic parts
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  // Include the alert body in the spoken message if it has useful content
  const detail =
    alert.body && alert.body !== alert.title ? ` ${alert.body}.` : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-GB">${esc(message)}${esc(detail)}</Say>
  <Pause length="1"/>
  <Say voice="alice" language="en-GB">${esc(message)}${esc(detail)}</Say>
</Response>`;
}

async function placeCall(cfg: TwilioConfig, toNumber: string, alert: RaidAlert): Promise<void> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Calls.json`;

  const twiml = buildTwiml(cfg.callMessage, alert);

  const body = new URLSearchParams({
    To: toNumber,
    From: cfg.fromNumber,
    Twiml: twiml,
    // Hang up after 30 seconds if not answered so it doesn't ring forever
    Timeout: "30",
  });

  const credentials = Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString("base64");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Twilio call to ${toNumber} failed (${response.status}): ${text}`);
  }

  let callSid = "(unknown)";
  try {
    const json = JSON.parse(text) as { sid?: string };
    callSid = json.sid ?? callSid;
  } catch {
    // Not JSON -- fine, just log what we have
  }

  console.log(`Twilio call placed to ${toNumber} -- SID: ${callSid}`);
}

/**
 * Place raid-alert calls to all configured numbers.
 * Calls are made in parallel. Individual failures are logged but do not
 * throw so one bad number doesn't block the others.
 */
export async function callRaidAlert(alert: RaidAlert): Promise<void> {
  const cfg = loadTwilioConfig();
  if (!cfg) {
    console.log("Twilio not configured -- skipping phone call (set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, TWILIO_CALL_NUMBERS in Koyeb env vars to enable).");
    return;
  }

  console.log(`Placing Twilio raid-alert call to ${cfg.callNumbers.length} number(s)...`);

  await Promise.allSettled(
    cfg.callNumbers.map((number) =>
      placeCall(cfg, number, alert).catch((err: unknown) => {
        console.error(`Twilio call to ${number} failed:`, err);
      })
    )
  );
}
