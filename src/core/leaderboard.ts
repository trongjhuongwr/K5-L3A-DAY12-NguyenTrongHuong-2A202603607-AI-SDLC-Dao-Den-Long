export interface LeaderboardEntry {
  name: string;
  score: number;
  nights_won: number;
  achieved_at: string; // ISO 8601 with timezone, e.g. "2026-11-20T16:00:00+07:00"
  seed: number;
}

export const DEFAULT_LEADERBOARD: LeaderboardEntry[] = [
  {
    name: "May_Thu_Giu",
    score: 1680,
    nights_won: 3,
    achieved_at: "2026-11-20T14:30:00+07:00",
    seed: 42,
  },
  {
    name: "Ong_Dang",
    score: 1420,
    nights_won: 3,
    achieved_at: "2026-11-20T15:10:00+07:00",
    seed: 777,
  },
  {
    name: "Hai_Dang",
    score: 1150,
    nights_won: 2,
    achieved_at: "2026-11-20T15:45:00+07:00",
    seed: 1234,
  },
  {
    name: "Gio_Nom",
    score: 890,
    nights_won: 2,
    achieved_at: "2026-11-20T16:00:00+07:00",
    seed: 888,
  },
  {
    name: "Dom_Dom_Vang",
    score: 540,
    nights_won: 1,
    achieved_at: "2026-11-20T16:20:00+07:00",
    seed: 9999,
  },
];

export function validatePlayerName(name: string): boolean {
  if (!name || typeof name !== "string") return false;
  const trimmed = name.trim();
  if (trimmed.length < 3 || trimmed.length > 12) return false;
  // Support alphanumeric, underscores, and Vietnamese accented characters
  return /^[A-Za-z0-9_À-ỹ\s]{3,12}$/.test(trimmed);
}

export function sortAndPruneLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  const sorted = [...entries].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const timeA = new Date(a.achieved_at).getTime();
    const timeB = new Date(b.achieved_at).getTime();
    return timeA - timeB; // Older timestamp ranks higher on tie
  });
  return sorted.slice(0, 10);
}
