import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const preferredRegion = ["fra1", "dxb1"];

const LOTO_BASE = "https://loto.iq";

const HEADERS: Record<string, string> = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "ar-IQ,ar;q=0.9,en-US;q=0.8,en;q=0.7",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

interface FetchResult {
  data: any | null;
  status: number;
  cfMitigated: string | null;
  err?: string;
}

async function fetchJsonDiag(path: string, timeoutMs = 9500): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${LOTO_BASE}${path}`, {
      method: "GET",
      headers: HEADERS,
      cache: "no-store",
      signal: controller.signal,
    });
    const cfMitigated = res.headers.get("cf-mitigated");
    if (!res.ok) {
      return { data: null, status: res.status, cfMitigated };
    }
    const data = await res.json();
    return { data, status: res.status, cfMitigated };
  } catch (e: any) {
    return { data: null, status: 0, cfMitigated: null, err: e?.message || "fetch_error" };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAllPastDraws(gameParam?: string, maxPages = 6): Promise<any[]> {
  const allDraws: any[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const qs = gameParam ? `?game=${gameParam}&page=${page}` : `?page=${page}`;
    const res = await fetchJsonDiag(`/api/draws/past${qs}`);
    if (!res.data || !Array.isArray(res.data.draws) || res.data.draws.length === 0) {
      break;
    }
    allDraws.push(...res.data.draws);
    if (!res.data.hasMore) break;
  }
  return allDraws;
}

async function handleLiveSync() {
  try {
    const [
      loto42CurRes,
      loto42Draws,
      loto29CurRes,
      loto29Draws,
      sportsRes,
      scratchRes,
      winnersRes,
    ] = await Promise.all([
      fetchJsonDiag("/api/draws/current"),
      fetchAllPastDraws(undefined, 5),
      fetchJsonDiag("/api/draws/current?game=29"),
      fetchAllPastDraws("29", 3),
      fetchJsonDiag("/api/sports/rounds"),
      fetchJsonDiag("/api/scratch/lobby"),
      fetchJsonDiag("/api/winners/recent"),
    ]);

    const sportsRounds = [
      ...(Array.isArray(sportsRes.data?.rounds) ? sportsRes.data.rounds : []),
      ...(Array.isArray(sportsRes.data?.played) ? sportsRes.data.played : []),
    ];

    const hasAnyLive =
      Boolean(loto42CurRes.data) ||
      loto42Draws.length > 0 ||
      Boolean(loto29CurRes.data) ||
      loto29Draws.length > 0 ||
      sportsRounds.length > 0 ||
      Boolean(scratchRes.data?.cards);

    if (!hasAnyLive) {
      const blockedByCloudflare = Boolean(
        loto42CurRes.cfMitigated ||
          loto29CurRes.cfMitigated ||
          sportsRes.cfMitigated ||
          loto42CurRes.status === 403
      );
      return NextResponse.json(
        {
          ok: false,
          blockedByCloudflare,
          upstreamStatus: loto42CurRes.status || sportsRes.status,
          cfMitigated: loto42CurRes.cfMitigated || sportsRes.cfMitigated,
          error: blockedByCloudflare
            ? "حماية Cloudflare في موقع loto.iq تمنع السحب الآلي من الخادم السحابي حالياً"
            : "تعذر الوصول مؤقتاً إلى خادم لوتو العراق",
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        fetchedAt: Date.now(),
        source: "loto.iq-live",
        loto42Current: loto42CurRes.data || null,
        loto42Draws,
        loto29Current: loto29CurRes.data || null,
        loto29Draws,
        sportsRounds,
        scratchCards: Array.isArray(scratchRes.data?.cards) ? scratchRes.data.cards : [],
        recentWinners: Array.isArray(winnersRes.data?.winners) ? winnersRes.data.winners : [],
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
