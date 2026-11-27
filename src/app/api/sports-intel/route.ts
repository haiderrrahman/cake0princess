import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export interface LiveTeamIntel {
  name: string;
  normalizedKey: string;
  leagueCode: string;
  leagueAr: string;
  rank: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  ppg: number;
  powerScore: number; // 58..96 dynamic live strength
  formText?: string; // e.g. "WWDLW" if available
}

export interface LiveFinishedScore {
  leagueCode: string;
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  status: "played" | "live" | "scheduled";
  dateIso: string;
}

const LEAGUES: { code: string; nameAr: string }[] = [
  { code: "eng.1", nameAr: "الدوري الإنجليزي الممتاز" },
  { code: "esp.1", nameAr: "الدوري الإسباني" },
  { code: "ita.1", nameAr: "الدوري الإيطالي" },
  { code: "ger.1", nameAr: "الدوري الألماني" },
  { code: "fra.1", nameAr: "الدوري الفرنسي" },
  { code: "uefa.champions", nameAr: "دوري أبطال أوروبا" },
];

function normalizeTeamKey(raw: string): string {
  return (raw || "")
    .toLowerCase()
    .replace(/\bfc\b|\bcf\b|\bafc\b|\bsc\b|\bac\b|\bcd\b|\bud\b|\brcd\b|\brc\b/g, " ")
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchJsonSafe(url: string, timeoutMs = 8000): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; IraqLottoAnalytics/1.0)",
      },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function getStatVal(stats: any[], names: string[]): number {
  if (!Array.isArray(stats)) return 0;
  for (const n of names) {
    const found = stats.find(
      (s) => s?.name === n || s?.type === n || s?.abbreviation === n
    );
    if (found && found.value !== undefined && found.value !== null) {
      const num = Number(found.value);
      if (!Number.isNaN(num)) return num;
    }
  }
  return 0;
}

function computeDynamicPowerScore(
  rank: number,
  totalTeams: number,
  ppg: number,
  goalDiffPerGame: number,
  leagueCode: string
): number {
  // Base league strength adjustment
  const leagueBase =
    leagueCode === "eng.1"
      ? 79
      : leagueCode === "esp.1"
      ? 78
      : leagueCode === "uefa.champions"
      ? 83
      : 76.5;

  // PPG contribution: typical range 0.5..2.5 (mean ~1.38)
  const ppgDelta = (ppg - 1.38) * 9.5;
  // Goal difference per game: typical range -1.5..+2.0
  const gdDelta = Math.max(-6, Math.min(8, goalDiffPerGame * 4.5));
  // Rank percentile bonus
  const rankPct = totalTeams > 1 ? 1 - (rank - 1) / (totalTeams - 1) : 0.5;
  const rankDelta = (rankPct - 0.5) * 6;

  return Math.max(60, Math.min(96, Math.round(leagueBase + ppgDelta + gdDelta + rankDelta)));
}

async function fetchLeagueStandings(
  leagueCode: string,
  leagueAr: string
): Promise<LiveTeamIntel[]> {
  const data = await fetchJsonSafe(
    `https://site.api.espn.com/apis/v2/sports/soccer/${leagueCode}/standings`
  );
  if (!data) return [];

  const entries: any[] = [];
  if (Array.isArray(data.children)) {
    for (const child of data.children) {
      if (Array.isArray(child?.standings?.entries)) {
        entries.push(...child.standings.entries);
      }
    }
  } else if (Array.isArray(data?.standings?.entries)) {
    entries.push(...data.standings.entries);
  }

  const totalTeams = Math.max(entries.length, 18);
  const out: LiveTeamIntel[] = [];

  for (let idx = 0; idx < entries.length; idx++) {
    const e = entries[idx];
    const teamName: string = e?.team?.displayName || e?.team?.name || "";
    const shortName: string = e?.team?.shortDisplayName || "";
    if (!teamName) continue;

    const stats = e?.stats || [];
    const rank = getStatVal(stats, ["rank"]) || idx + 1;
    const played = getStatVal(stats, ["gamesPlayed", "GP"]);
    const wins = getStatVal(stats, ["wins", "W"]);
    const draws = getStatVal(stats, ["ties", "draws", "D"]);
    const losses = getStatVal(stats, ["losses", "L"]);
    const points = getStatVal(stats, ["points", "P", "PTS"]) || wins * 3 + draws;
    const goalsFor = getStatVal(stats, ["pointsFor", "goalsFor", "GF", "F"]);
    const goalsAgainst = getStatVal(stats, ["pointsAgainst", "goalsAgainst", "GA", "A"]);
    const goalDiff = getStatVal(stats, ["pointDifferential", "goalDifference", "GD"]) || goalsFor - goalsAgainst;

    const ppg = played > 0 ? Math.round((points / played) * 100) / 100 : 1.35;
    const gdPerGame = played > 0 ? goalDiff / played : 0;
    const powerScore = computeDynamicPowerScore(rank, totalTeams, ppg, gdPerGame, leagueCode);

    const noteStat = stats.find((s: any) => s?.name === "record" || s?.type === "total");
    const formText =
      typeof e?.team?.form === "string"
        ? e.team.form
        : typeof noteStat?.summary === "string"
        ? noteStat.summary
        : undefined;

    const item: LiveTeamIntel = {
      name: teamName,
      normalizedKey: normalizeTeamKey(teamName),
      leagueCode,
      leagueAr,
      rank,
      played,
      wins,
      draws,
      losses,
      points,
      goalsFor,
      goalsAgainst,
      goalDiff,
      ppg,
      powerScore,
      formText,
    };
    out.push(item);

    // Also index short display name if distinct
    const shortKey = normalizeTeamKey(shortName);
    if (shortKey && shortKey !== item.normalizedKey) {
      out.push({ ...item, normalizedKey: shortKey });
    }
  }

  return out;
}

async function fetchLeagueRecentScores(leagueCode: string): Promise<LiveFinishedScore[]> {
  // Fetch scoreboard covering the last 6 days through next 2 days
  const now = new Date();
  const start = new Date(now.getTime() - 6 * 86400 * 1000);
  const end = new Date(now.getTime() + 2 * 86400 * 1000);
  const fmtDate = (d: Date) =>
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(
      d.getUTCDate()
    ).padStart(2, "0")}`;

  const data = await fetchJsonSafe(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueCode}/scoreboard?dates=${fmtDate(
      start
    )}-${fmtDate(end)}`
  );
  if (!data || !Array.isArray(data.events)) return [];

  const scores: LiveFinishedScore[] = [];
  for (const ev of data.events) {
    const comp = ev?.competitions?.[0];
    if (!comp || !Array.isArray(comp.competitors) || comp.competitors.length < 2) continue;
    const home = comp.competitors.find((c: any) => c.homeAway === "home");
    const away = comp.competitors.find((c: any) => c.homeAway === "away");
    if (!home || !away) continue;

    const state = comp?.status?.type?.state; // "pre" | "in" | "post"
    const completed = Boolean(comp?.status?.type?.completed);
    const status: LiveFinishedScore["status"] =
      completed || state === "post" ? "played" : state === "in" ? "live" : "scheduled";

    if (status === "scheduled") continue;

    scores.push({
      leagueCode,
      homeName: home?.team?.displayName || home?.team?.name || "",
      awayName: away?.team?.displayName || away?.team?.name || "",
      homeScore: Number(home?.score) || 0,
      awayScore: Number(away?.score) || 0,
      status,
      dateIso: ev?.date || "",
    });
  }
  return scores;
}

export async function GET() {
  try {
    const [standingsBatches, scoresBatches] = await Promise.all([
      Promise.all(LEAGUES.map((l) => fetchLeagueStandings(l.code, l.nameAr))),
      Promise.all(
        ["eng.1", "esp.1", "ita.1", "ger.1", "uefa.champions"].map((code) =>
          fetchLeagueRecentScores(code)
        )
      ),
    ]);

    const teamsByKey: Record<string, LiveTeamIntel> = {};
    let totalTeamsLoaded = 0;
    for (const batch of standingsBatches) {
      for (const t of batch) {
        if (!teamsByKey[t.normalizedKey]) {
          teamsByKey[t.normalizedKey] = t;
          totalTeamsLoaded++;
        }
      }
    }

    const recentScores: LiveFinishedScore[] = scoresBatches.flat();

    return NextResponse.json(
      {
        ok: totalTeamsLoaded > 0 || recentScores.length > 0,
        fetchedAt: Date.now(),
        source: "espn-live-football",
        teamsCount: totalTeamsLoaded,
        scoresCount: recentScores.length,
        teamsByKey,
        recentScores,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "sports_intel_failed" },
      { status: 500 }
    );
  }
}
