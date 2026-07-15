import { logger } from "./logger";

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

interface DiscordChannel {
  id: string;
  name: string;
  type: number;
}

interface DiscordRole {
  id: string;
  name: string;
  color: number;
}

async function discordFetch(path: string): Promise<unknown> {
  if (!DISCORD_BOT_TOKEN) {
    throw new Error("DISCORD_BOT_TOKEN not configured");
  }
  const res = await fetch(`https://discord.com/api/v10${path}`, {
    headers: {
      Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Discord API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function getGuildTextChannels(guildId: string): Promise<DiscordChannel[]> {
  const channels = (await discordFetch(`/guilds/${guildId}/channels`)) as DiscordChannel[];
  // type 0 = text channel, type 5 = announcement channel
  return channels.filter((c) => c.type === 0 || c.type === 5).map((c) => ({ id: c.id, name: c.name, type: c.type }));
}

export async function getGuildRoles(guildId: string): Promise<DiscordRole[]> {
  const roles = (await discordFetch(`/guilds/${guildId}/roles`)) as DiscordRole[];
  return roles.filter((r) => r.name !== "@everyone").map((r) => ({ id: r.id, name: r.name, color: r.color }));
}

export async function postWebhookAlert(webhookUrl: string, content: string): Promise<void> {
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
  } catch (err) {
    logger.warn({ err }, "Failed to post Discord webhook");
  }
}

export async function postChannelAlert(
  channelId: string,
  content: string,
): Promise<void> {
  if (!DISCORD_BOT_TOKEN || !channelId) return;
  try {
    await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    });
  } catch (err) {
    logger.warn({ err }, "Failed to post Discord channel message");
  }
}
