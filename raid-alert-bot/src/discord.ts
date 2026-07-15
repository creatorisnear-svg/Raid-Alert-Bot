import { config } from "./config";
import { RaidAlert } from "./pushListener";

function buildMention(): { mention: string; allowedMentions: Record<string, unknown> } {
  const target = config.pingTarget.toLowerCase();
  if (target === "everyone" || target === "@everyone" || target === "") {
    return {
      mention: "@everyone",
      allowedMentions: { parse: ["everyone"] },
    };
  }
  // Anything else is treated as a Discord role ID.
  const roleId = config.pingTarget.replace(/[<@&>]/g, "");
  return {
    mention: `<@&${roleId}>`,
    allowedMentions: { parse: [], roles: [roleId] },
  };
}

export async function postRaidAlert(alert: RaidAlert): Promise<void> {
  const { mention, allowedMentions } = buildMention();

  const lines = [`${mention} 🚨 **RAID ALERT**`];
  if (alert.body) {
    lines.push(alert.body);
  } else if (alert.title) {
    lines.push(alert.title);
  }
  const server = alert.data?.serverId;
  if (server && !String(alert.body).includes(String(server))) {
    lines.push(`Server: ${server}`);
  }

  const response = await fetch(config.discordWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: lines.join("\n"),
      allowed_mentions: allowedMentions,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord webhook post failed (${response.status}): ${text}`);
  }
}
