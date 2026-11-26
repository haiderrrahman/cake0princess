import { NextResponse } from "next/server";

const LOTO_BASE = "https://loto.iq";

const HEADERS = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept-Language": "ar,en-US;q=0.9,en;q=0.8",
};

async function fetchJsonSafe(path: string, timeoutMs = 9000): Promise<any | null> {
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

async function fetchAllPastDraws(gameParam?: string, maxPages = 12): Promise<any[]> {
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

// POST handler so Next.js `output: "export"` builds cleanly without static-GET conflicts,
// while working natively in `next dev` and server deployments.
export async function POST() {
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
      fetchAllPastDraws(undefined, 12),
      fetchJsonSafe("/api/draws/current?game=29"),
      fetchAllPastDraws("29", 12),
      fetchJsonSafe("/api/sports/rounds"),
      fetchJsonSafe("/api/scratch/lobby"),
      fetchJsonSafe("/api/winners/recent"),
    ]);

    const hasAnyLive =
      Boolean(loto42Current) ||
      loto42Draws.length > 0 ||
      Boolean(loto29Current) ||
      loto29Draws.length > 0 ||
      Boolean(sportsData?.rounds) ||
      Boolean(scratchData?.cards);

    if (!hasAnyLive) {
      return NextResponse.json(
        { ok: false, error: "تعذر الوصول مؤقتاً إلى خادم لوتو العراق" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      fetchedAt: Date.now(),
      source: "loto.iq-direct",
      loto42Current: loto42Current || null,
      loto42Draws,
      loto29Current: loto29Current || null,
      loto29Draws,
      sportsRounds: Array.isArray(sportsData?.rounds) ? sportsData.rounds : [],
      scratchCards: Array.isArray(scratchData?.cards) ? scratchData.cards : [],
      recentWinners: Array.isArray(winnersData?.winners) ? winnersData.winners : [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Sync failed" },
      { status: 500 }
    );
  }
}
