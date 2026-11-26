import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const LOTO_BASE = "https://loto.iq";

const HEADERS: Record<string, string> = {
  Accept: "application/json, text/plain, */*",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept-Language": "ar-IQ,ar;q=0.9,en-US;q=0.8,en;q=0.7",
  Referer: "https://loto.iq/",
  Origin: "https://loto.iq",
};

async function fetchJsonSafe(path: string, timeoutMs = 9500): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${LOTO_BASE}${path}`, {
      method: "GET",
      headers: HEADERS,
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

async function fetchAllPastDraws(gameParam?: string, maxPages = 10): Promise<any[]> {
  const allDraws: any[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const qs = gameParam ? `?game=${gameParam}&page=${page}` : `?page=${page}`;
    const data = await fetchJsonSafe(`/api/draws/past${qs}`);
    if (!data || !Array.isArray(data.draws) || data.draws.length === 0) {
      break;
    }
    allDraws.push(...data.draws);
    if (!data.hasMore) break;
  }
  return allDraws;
}

async function handleLiveSync() {
  try {
    const [
      loto42Current,
      loto42Draws,
      loto29Current,
      loto29Draws,
      sportsData,
      scratchData,
      winnersData,
    ] = await Promise.all([
      fetchJsonSafe("/api/draws/current"),
      fetchAllPastDraws(undefined, 10),
      fetchJsonSafe("/api/draws/current?game=29"),
      fetchAllPastDraws("29", 10),
      fetchJsonSafe("/api/sports/rounds"),
      fetchJsonSafe("/api/scratch/lobby"),
      fetchJsonSafe("/api/winners/recent"),
    ]);

    // Combine both open `rounds` and finished/settled `played` rounds from `/api/sports/rounds`!
    const sportsRounds = [
      ...(Array.isArray(sportsData?.rounds) ? sportsData.rounds : []),
      ...(Array.isArray(sportsData?.played) ? sportsData.played : []),
    ];

    const hasAnyLive =
      Boolean(loto42Current) ||
      loto42Draws.length > 0 ||
      Boolean(loto29Current) ||
      loto29Draws.length > 0 ||
      sportsRounds.length > 0 ||
      Boolean(scratchData?.cards);

    if (!hasAnyLive) {
      return NextResponse.json(
        { ok: false, error: "تعذر الوصول مؤقتاً إلى خادم لوتو العراق" },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        fetchedAt: Date.now(),
        source: "loto.iq-live",
        loto42Current: loto42Current || null,
        loto42Draws,
        loto29Current: loto29Current || null,
        loto29Draws,
        sportsRounds,
        scratchCards: Array.isArray(scratchData?.cards) ? scratchData.cards : [],
        recentWinners: Array.isArray(winnersData?.winners) ? winnersData.winners : [],
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Sync failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return handleLiveSync();
}

export async function POST() {
  return handleLiveSync();
}
