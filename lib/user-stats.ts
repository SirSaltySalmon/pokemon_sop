const STORAGE_KEY = "characterVotingStats";

export type UserStats = {
  majorityStreak: number;
  minorityStreak: number;
  majorityTotal: number;
  minorityTotal: number;
  yesVotesTotal: number;
  noVotesTotal: number;
  skipsTotal: number;
  majorityPoints: number;
  minorityPoints: number;
  lastEarnedPoints: number;
  interactedCharacters: number[];
  sessionId: string;
};

function generateSessionId(): string {
  return "sess-" + Math.random().toString(36).slice(2, 9);
}

function defaultStats(): UserStats {
  return {
    majorityStreak: 0,
    minorityStreak: 0,
    majorityTotal: 0,
    minorityTotal: 0,
    yesVotesTotal: 0,
    noVotesTotal: 0,
    skipsTotal: 0,
    majorityPoints: 0,
    minorityPoints: 0,
    lastEarnedPoints: 0,
    interactedCharacters: [],
    sessionId: generateSessionId(),
  };
}

export function loadUserStats(): UserStats {
  if (typeof window === "undefined") return defaultStats();
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return defaultStats();
  try {
    const parsed = JSON.parse(stored) as Partial<UserStats>;
    if (parsed && typeof parsed === "object") {
      const base = defaultStats();
      return {
        ...base,
        ...parsed,
        sessionId:
          typeof parsed.sessionId === "string"
            ? parsed.sessionId
            : base.sessionId,
        interactedCharacters: Array.isArray(parsed.interactedCharacters)
          ? parsed.interactedCharacters
          : [],
      };
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return defaultStats();
}

export function saveUserStats(stats: UserStats): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}

export function resetUserStats(): UserStats {
  const stats = defaultStats();
  saveUserStats(stats);
  return stats;
}

export { generateSessionId };
