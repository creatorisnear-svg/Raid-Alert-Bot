import { pool } from "./index";

/**
 * Creates all application tables if they do not already exist.
 * Safe to run on every startup — uses IF NOT EXISTS throughout.
 * This replaces the need to manually run `drizzle-kit push` against
 * the production database after schema changes.
 */
export async function ensureSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id          SERIAL PRIMARY KEY,
        discord_id  TEXT NOT NULL UNIQUE,
        username    TEXT NOT NULL,
        avatar      TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS clans (
        id                   SERIAL PRIMARY KEY,
        name                 TEXT NOT NULL,
        image_url            TEXT,
        leader_id            INTEGER NOT NULL,
        is_private           BOOLEAN NOT NULL DEFAULT FALSE,
        raid_key             TEXT,
        kaos_api_key         TEXT,
        discord_server_id    TEXT,
        discord_channel_id   TEXT,
        discord_channel_name TEXT,
        ping_role            TEXT NOT NULL DEFAULT '',
        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS clan_members (
        clan_id   INTEGER NOT NULL,
        user_id   INTEGER NOT NULL,
        role      TEXT NOT NULL DEFAULT 'member',
        silenced  BOOLEAN NOT NULL DEFAULT FALSE,
        joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (clan_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS join_requests (
        id         SERIAL PRIMARY KEY,
        clan_id    INTEGER NOT NULL,
        user_id    INTEGER NOT NULL,
        status     TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS alert_log (
        id         SERIAL PRIMARY KEY,
        clan_id    INTEGER NOT NULL,
        title      TEXT NOT NULL,
        body       TEXT NOT NULL DEFAULT '',
        server_id  TEXT,
        is_test    BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id         SERIAL PRIMARY KEY,
        clan_id    INTEGER NOT NULL,
        user_id    INTEGER NOT NULL,
        endpoint   TEXT NOT NULL,
        p256dh     TEXT NOT NULL,
        auth       TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS invite_tokens (
        id         SERIAL PRIMARY KEY,
        clan_id    INTEGER NOT NULL UNIQUE,
        token      TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS native_push_subscriptions (
        id          SERIAL PRIMARY KEY,
        clan_id     INTEGER NOT NULL,
        user_id     INTEGER NOT NULL,
        expo_token  TEXT NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (clan_id, user_id, expo_token)
      );

      CREATE TABLE IF NOT EXISTS mobile_tokens (
        id          SERIAL PRIMARY KEY,
        token       TEXT NOT NULL UNIQUE,
        user_id     INTEGER NOT NULL,
        expires_at  TIMESTAMPTZ NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  } finally {
    client.release();
  }
}
