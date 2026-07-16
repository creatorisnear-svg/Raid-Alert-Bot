/**
 * Typed API client for the AVIV Clan+ API server.
 *
 * Set EXPO_PUBLIC_API_URL to the API server's Koyeb URL.
 * Auth token is stored in AsyncStorage and sent as a Bearer header.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

export const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");

const TOKEN_KEY = "authToken_v1";

let _token: string | null = null;

export async function loadToken(): Promise<string | null> {
  _token = await AsyncStorage.getItem(TOKEN_KEY);
  return _token;
}

export async function saveToken(token: string): Promise<void> {
  _token = token;
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  _token = null;
  await AsyncStorage.removeItem(TOKEN_KEY);
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(init.headers as Record<string, string> ?? {}),
  };
  if (_token) headers["Authorization"] = `Bearer ${_token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (json as { error?: string }).error ?? `HTTP ${res.status}`);
  return json as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ApiUser = { id: number; discordId: string; username: string; avatar: string | null };

export type ApiClan = {
  id: number;
  name: string;
  imageUrl: string | null;
  role: "leader" | "member";
  silenced: boolean;
  memberCount: number;
  lastAlertAt: string | null;
  alertCount: number;
  hasRaidKey: boolean;
};

export type ApiAlert = {
  id: number;
  clanId: number;
  clanName: string;
  title: string;
  body: string;
  isTest: boolean;
  createdAt: string;
};

export type ApiInviteClan = {
  clanId: number;
  name: string;
  imageUrl: string | null;
  memberCount: number;
  leaderUsername: string;
};

// ─── API methods ──────────────────────────────────────────────────────────────

export const api = {
  /** Get the currently authenticated user. Throws ApiError(401) if not signed in. */
  me:          ()                          => request<ApiUser>("/api/auth/me"),

  /** All clans the authenticated user is a member of. */
  myClans:     ()                          => request<ApiClan[]>("/api/me/clans"),

  /** Alert history for a clan (most recent 50). */
  alerts:      (clanId: number)            => request<ApiAlert[]>(`/api/clans/${clanId}/alerts`),

  /** Register an Expo push token for this clan. */
  subNative:   (clanId: number, token: string) =>
    request<{ success: boolean }>(`/api/clans/${clanId}/native-push-subscribe`, {
      method: "POST",
      body:   JSON.stringify({ token }),
    }),

  /** Remove an Expo push token for this clan. */
  unsubNative: (clanId: number, token: string) =>
    request<void>(`/api/clans/${clanId}/native-push-subscribe`, {
      method: "DELETE",
      body:   JSON.stringify({ token }),
    }),

  /** Look up a clan by invite token (no auth required). */
  inviteLookup: (token: string)            => request<ApiInviteClan>(`/api/invite/${token}`),

  /** Join a clan via invite token (requires auth). */
  inviteJoin:   (token: string)            => request<unknown>(`/api/invite/${token}/join`, { method: "POST" }),

  /** Sign out — clears the server session. */
  logout:       ()                         => request<void>("/api/auth/logout", { method: "POST" }),
};
