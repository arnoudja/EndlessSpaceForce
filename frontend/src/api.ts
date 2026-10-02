const API =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8787";

export interface Player {
  callsign: string;
  resources: number;
  idle_credits: number;
  weapon_kind: string;
  basic_rounds: number;
  vector_rounds: number;
  run_upgrade_level: number;
  checkpoint: string;
  snapshot_distance: number;
  snapshot_kills: number;
  disconnected_at: string | null;
  created_at: string;
}

export interface PlayerState {
  player: Player;
  carry_units_used: number;
  carry_cap: number;
  pending_idle_credits: number;
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? res.statusText);
  }
  return body as T;
}

export const api = {
  health: () => request<{ ok: boolean; service: string }>("/health"),
  createPlayer: (callsign: string) =>
    request<PlayerState>("/players", {
      method: "POST",
      body: JSON.stringify({ callsign }),
    }),
  getPlayer: (callsign: string) =>
    request<PlayerState>(`/players/${encodeURIComponent(callsign)}`),
  leave: (callsign: string, distance: number, kills: number) =>
    request<PlayerState>(`/players/${encodeURIComponent(callsign)}/leave`, {
      method: "POST",
      body: JSON.stringify({ distance, kills }),
    }),
  collectIdle: (callsign: string) =>
    request<PlayerState>(
      `/players/${encodeURIComponent(callsign)}/collect-idle`,
      { method: "POST", body: "{}" },
    ),
  configure: (
    callsign: string,
    body: {
      purse: "resources" | "idle";
      weapon_kind?: string;
      buy_basic?: number;
      buy_vector?: number;
    },
  ) =>
    request<PlayerState>(`/players/${encodeURIComponent(callsign)}/configure`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  runEnd: (
    callsign: string,
    body: {
      distance: number;
      kills: number;
      died: boolean;
      upgrade_level: number;
      basic_left: number;
      vector_left: number;
    },
  ) =>
    request<PlayerState>(`/players/${encodeURIComponent(callsign)}/run/end`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
