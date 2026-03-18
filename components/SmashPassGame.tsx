"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  loadUserStats,
  saveUserStats,
  resetUserStats,
  type UserStats,
} from "@/lib/user-stats";

type TagState = "neutral" | "included" | "excluded";

export type Character = {
  id: number;
  name: string;
  franchise: string;
  image_url: string;
  tags: string[];
};

async function fetchTags(): Promise<string[]> {
  const res = await fetch("/api/tags");
  if (!res.ok) return [];
  return res.json();
}

async function fetchCharacter(
  included: string[],
  excluded: string[],
  excludeIds: number[]
): Promise<Character | null> {
  const params = new URLSearchParams();
  if (included.length) params.set("tags", included.join(","));
  if (excluded.length) params.set("exclude", excluded.join(","));
  if (excludeIds.length) params.set("excludeIds", excludeIds.join(","));
  const res = await fetch("/api/character/random?" + params.toString());
  if (!res.ok) return null;
  const data = await res.json();
  if (data?.error) return null;
  return data as Character;
}

export function SmashPassGame() {
  const [tags, setTags] = useState<Map<string, TagState>>(new Map());
  const [allTagNames, setAllTagNames] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [stats, setStats] = useState<UserStats>(() => loadUserStats());
  const [current, setCurrent] = useState<Character | null>(null);
  const [phase, setPhase] = useState<"init" | "playing" | "results" | "error">(
    "init"
  );
  const [busy, setBusy] = useState(false);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [voteStats, setVoteStats] = useState({
    yesVotes: 0,
    noVotes: 0,
    totalVotes: 0,
  });
  /** Last vote: true smash, false pass; null if skipped */
  const [lastVoteType, setLastVoteType] = useState<boolean | null>(null);

  const filteredTags = useMemo(() => {
    const q = search.toLowerCase();
    return allTagNames.filter((t) => t.toLowerCase().includes(q));
  }, [allTagNames, search]);

  const included = useMemo(() => {
    const out: string[] = [];
    tags.forEach((state, name) => {
      if (state === "included") out.push(name);
    });
    return out;
  }, [tags]);

  const excluded = useMemo(() => {
    const out: string[] = [];
    tags.forEach((state, name) => {
      if (state === "excluded") out.push(name);
    });
    return out;
  }, [tags]);

  const summary = useMemo(() => {
    if (included.length === 0 && excluded.length === 0) {
      return "No filters — all characters eligible.";
    }
    const parts: string[] = [];
    if (included.length)
      parts.push("Must include: " + included.join(", "));
    if (excluded.length)
      parts.push("Must exclude: " + excluded.join(", "));
    return parts.join(" · ");
  }, [included, excluded]);

  const loadCharacter = useCallback(async () => {
    setPhase("init");
    setBusy(true);
    const s = loadUserStats();
    setStats(s);
    const char = await fetchCharacter(
      included,
      excluded,
      s.interactedCharacters
    );
    setBusy(false);
    if (!char) {
      setCurrent(null);
      setPhase("error");
      return;
    }
    setCurrent(char);
    setPhase("playing");
    setLastVoteType(null);
  }, [included, excluded]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await fetchTags();
      if (cancelled) return;
      const m = new Map<string, TagState>();
      list.forEach((t) => m.set(t, "neutral"));
      setAllTagNames(list);
      setTags(m);
      const s = loadUserStats();
      setStats(s);
      const char = await fetchCharacter([], [], s.interactedCharacters);
      if (cancelled) return;
      if (!char) {
        setPhase("error");
        return;
      }
      setCurrent(char);
      setPhase("playing");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setTagState = (name: string, state: TagState) => {
    setTags((prev) => {
      const next = new Map(prev);
      next.set(name, state);
      return next;
    });
  };

  const onTagClick = (name: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      setTagState(name, "neutral");
      return;
    }
    const cur = tags.get(name) ?? "neutral";
    setTagState(name, cur === "included" ? "neutral" : "included");
  };

  const onTagContextMenu = (name: string, e: React.MouseEvent) => {
    e.preventDefault();
    const cur = tags.get(name) ?? "neutral";
    setTagState(name, cur === "excluded" ? "neutral" : "excluded");
  };

  const onTagMiddleMouse = (name: string, e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      setTagState(name, "neutral");
    }
  };

  const clearAll = () => {
    setTags((prev) => {
      const next = new Map(prev);
      next.forEach((_, k) => next.set(k, "neutral"));
      return next;
    });
  };

  const setVisibleState = (state: TagState) => {
    setTags((prev) => {
      const next = new Map(prev);
      filteredTags.forEach((name) => next.set(name, state));
      return next;
    });
  };

  function updateUserStatsAfterVote(voteType: boolean, yesPercentage: number) {
    const s = loadUserStats();
    const isMajority =
      (voteType && yesPercentage >= 50) || (!voteType && yesPercentage <= 50);
    if (voteType) s.yesVotesTotal++;
    else s.noVotesTotal++;
    const majorityPercentage = Math.max(yesPercentage, 100 - yesPercentage);
    const minorityPercentage = Math.min(yesPercentage, 100 - yesPercentage);
    if (isMajority) {
      s.majorityTotal++;
      s.majorityStreak++;
      s.minorityStreak = 0;
      s.lastEarnedPoints = Math.floor((majorityPercentage - 50) * 2);
      s.majorityPoints += s.lastEarnedPoints;
    } else {
      s.minorityTotal++;
      s.minorityStreak++;
      s.majorityStreak = 0;
      s.lastEarnedPoints = Math.floor((50 - minorityPercentage) * 3);
      s.minorityPoints += s.lastEarnedPoints;
    }
    saveUserStats(s);
    setStats(s);
  }

  async function handleVote(voteType: boolean) {
    if (!current || busy || phase !== "playing") return;
    setBusy(true);
    const s = loadUserStats();
    const res = await fetch(`/api/character/${current.id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: s.sessionId, voteType }),
    });
    const data = await res.json();
    if (!data.success) {
      setBusy(false);
      return;
    }
    s.interactedCharacters = [...s.interactedCharacters, current.id];
    saveUserStats(s);
    const yesPct = (data.newYesVotes / data.totalVotes) * 100;
    updateUserStatsAfterVote(voteType, yesPct);
    setVoteStats({
      yesVotes: data.newYesVotes,
      noVotes: data.newNoVotes,
      totalVotes: data.totalVotes,
    });
    setLastVoteType(voteType);
    setPhase("results");
    setBusy(false);
  }

  async function handleSkip() {
    if (!current || busy || phase !== "playing") return;
    setBusy(true);
    await fetch(`/api/character/${current.id}/skip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: loadUserStats().sessionId }),
    });
    const s = loadUserStats();
    s.lastEarnedPoints = 0;
    s.interactedCharacters = [...s.interactedCharacters, current.id];
    s.skipsTotal++;
    saveUserStats(s);
    setStats(s);
    const res = await fetch(`/api/character/${current.id}/results`);
    const data = await res.json();
    setVoteStats({
      yesVotes: data.voteStats.yesVotes,
      noVotes: data.voteStats.noVotes,
      totalVotes: data.voteStats.totalVotes,
    });
    setLastVoteType(null);
    setPhase("results");
    setBusy(false);
  }

  const yesPct =
    voteStats.totalVotes > 0
      ? Math.round((voteStats.yesVotes / voteStats.totalVotes) * 100)
      : 0;
  const noPct =
    voteStats.totalVotes > 0
      ? Math.round((voteStats.noVotes / voteStats.totalVotes) * 100)
      : 0;

  const yesPercentageCommunity =
    voteStats.totalVotes > 0
      ? (voteStats.yesVotes / voteStats.totalVotes) * 100
      : 0;
  const pointsLine =
    stats.lastEarnedPoints > 0 && lastVoteType !== null
      ? (() => {
          const isMajority =
            (lastVoteType && yesPercentageCommunity >= 50) ||
            (!lastVoteType && yesPercentageCommunity <= 50);
          return `Earned ${stats.lastEarnedPoints} points toward ${isMajority ? "Conventional" : "Unconventional"}.`;
        })()
      : null;

  const downBad =
    stats.yesVotesTotal + stats.noVotesTotal > 0
      ? Math.round(
          (stats.yesVotesTotal /
            (stats.yesVotesTotal + stats.noVotesTotal)) *
            100
        )
      : 0;

  return (
    <>
      <section
        className={`panel panel--filters${filtersCollapsed ? " collapsed" : ""}`}
      >
        <h2 className="panel__title">Filters</h2>
        <button
          type="button"
          className="btn filters-toggle"
          onClick={() => setFiltersCollapsed((c) => !c)}
          aria-expanded={!filtersCollapsed}
        >
          {filtersCollapsed ? "Show filters" : "Hide filters"}
        </button>
        <div className="tag-legend">
          Click: include · Right-click: exclude · Ctrl+click or middle-click:
          reset
        </div>
        <input
          type="search"
          className="tag-search"
          placeholder="Search tags…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search tags"
        />
        <div className="tag-actions">
          <button type="button" className="btn" onClick={clearAll}>
            Clear all
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setVisibleState("included")}
          >
            Include visible
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setVisibleState("excluded")}
          >
            Exclude visible
          </button>
        </div>
        <div
          className="tag-cloud"
          onContextMenu={(e) => e.preventDefault()}
        >
          {filteredTags.map((name) => {
            const state = tags.get(name) ?? "neutral";
            return (
              <button
                key={name}
                type="button"
                className={`tag-pill tag-pill--${state}`}
                onClick={(e) => onTagClick(name, e)}
                onContextMenu={(e) => onTagContextMenu(name, e)}
                onMouseDown={(e) => onTagMiddleMouse(name, e)}
              >
                {name}
              </button>
            );
          })}
        </div>
        <p className="filter-summary">{summary}</p>
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy}
          onClick={() => void loadCharacter()}
        >
          Apply filters &amp; next character
        </button>
      </section>

      {phase === "error" && (
        <div className="error-box">
          <p>No character matches these filters, or the pool is exhausted.</p>
          <p>Try different tags or reset your stats and reload.</p>
          <button
            type="button"
            className="btn btn--accent"
            disabled={busy}
            onClick={() => void loadCharacter()}
          >
            Try again
          </button>
        </div>
      )}

      {current && (phase === "playing" || phase === "results") && (
        <section className="panel">
          <div className="character-stage">
            {/* eslint-disable-next-line @next/next/no-img-element -- external URLs */}
            <img src={current.image_url} alt={current.name} />
          </div>

          {phase === "playing" && (
            <div className="vote-row">
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy}
                onClick={() => void handleVote(true)}
              >
                Smash
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => void handleVote(false)}
              >
                Pass
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => void handleSkip()}
              >
                Skip
              </button>
            </div>
          )}

          {phase === "results" && (
            <>
              <div className="character-meta">
                <h2>{current.name}</h2>
                <p className="franchise">{current.franchise}</p>
                <div className="character-tags">
                  {current.tags?.length ? (
                    current.tags.map((t) => <span key={t}>{t}</span>)
                  ) : (
                    <span>No tags</span>
                  )}
                </div>
              </div>

              <div className="results-block">
                <h3>Community</h3>
                {stats.lastEarnedPoints > 0 && pointsLine && (
                  <p className="results-stats">{pointsLine}</p>
                )}
                {lastVoteType === null && (
                  <p className="results-stats">Skipped — no points this round.</p>
                )}
                {stats.lastEarnedPoints > 0 && (
                  <p className="results-stats">
                    Majority streak: {stats.majorityStreak} · Minority streak:{" "}
                    {stats.minorityStreak}
                  </p>
                )}
                <div className="vote-bar" aria-hidden>
                  <div
                    className="vote-bar__yes"
                    style={{ width: `${yesPct}%` }}
                  />
                  <div
                    className="vote-bar__no"
                    style={{ width: `${noPct}%` }}
                  />
                </div>
                <div className="stats-grid">
                  <div>
                    <strong>{voteStats.yesVotes}</strong>
                    Smash ({yesPct}%)
                  </div>
                  <div>
                    <strong>{voteStats.noVotes}</strong>
                    Pass ({noPct}%)
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <strong>{voteStats.totalVotes}</strong>
                    Total votes
                  </div>
                </div>
                <div className="vote-row">
                  <button
                    type="button"
                    className="btn btn--accent"
                    disabled={busy}
                    onClick={() => void loadCharacter()}
                  >
                    Next character
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      <section className="panel">
        <h2 className="panel__title">Your stats</h2>
        <div className="results-stats">
          <p>
            Smash: {stats.yesVotesTotal} · Pass: {stats.noVotesTotal} · Skip:{" "}
            {stats.skipsTotal}
          </p>
          <p>Smash rate: {downBad}%</p>
          <p>
            Majority picks: {stats.majorityTotal} · Minority:{" "}
            {stats.minorityTotal}
          </p>
          <p>
            Conventional: {stats.majorityPoints} · Unconventional:{" "}
            {stats.minorityPoints}
          </p>
          <p>
            Streaks — majority: {stats.majorityStreak}, minority:{" "}
            {stats.minorityStreak}
          </p>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setStats(resetUserStats());
          }}
        >
          Reset stats
        </button>
      </section>
    </>
  );
}
