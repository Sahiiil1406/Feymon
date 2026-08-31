export type StoredPlayer = {
  playerId: string;
  name: string;
};

const KEY = "feymon_player_v1";

export function getStoredPlayer(): StoredPlayer | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredPlayer;
  } catch {
    return null;
  }
}

export function setStoredPlayer(p: StoredPlayer) {
  localStorage.setItem(KEY, JSON.stringify(p));
}

export function clearStoredPlayer() {
  localStorage.removeItem(KEY);
}
