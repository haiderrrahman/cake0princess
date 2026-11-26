// Live data types, verified baseline snapshot, imminent-draw detector, and resilient sync with https://loto.iq/

import {
  VERIFIED_LOTO42_CURRENT,
  VERIFIED_LOTO42_DRAWS_OFFICIAL,
  VERIFIED_LOTO29_CURRENT,
  VERIFIED_LOTO29_DRAWS_OFFICIAL,
  VERIFIED_SPORTS_ROUNDS,
  VERIFIED_SCRATCH_CARDS,
  VERIFIED_RECENT_WINNERS,
} from "./lotoIqBaselineData";

export type IraqLotoGameId = "sports" | "loto42" | "loto29" | "sc500" | "sc1k";

export interface LotoDrawOfficial {
  id: string;
  drawNumber: number;
  gameCode: "42_PLUS_1" | "6_29";
  status: "open" | "closed" | "awaiting" | "finalized" | string;
  drawAt: number; // Unix ms
  salesOpenAt?: number;
  salesCloseAt?: number;
  price: number;
  jackpot: number;
  miniJackpot: number | null;
  ticketsSold?: number;
  winningNumbers: number[] | null;
  extraNumber: number | null;
}

export interface LotoCurrentState {
  selling: LotoDrawOfficial | null;
  awaiting: LotoDrawOfficial | null;
}

export interface SportsTeamInfo {
  nameAr: string;
  nameEn: string;
  logoUrl?: string;
  big?: boolean;
}

export interface SportsMatch {
  position: number;
  competition: {
    nameAr: string;
    nameEn: string;
    logoUrl?: string;
  };
  home: SportsTeamInfo;
  away: SportsTeamInfo;
  kickoffAt: number;
  venue?: string | null;
  status: string; // "scheduled" | "played" | "in_play" | ...
  phase?: string | null; // "finished" | null
  score?: { home: number; away: number } | null;
  minute?: number | null;
}

export interface SportsPrizeTier {
  correct: number;
  amount: number;
  perTicket: boolean;
  grows: boolean;
}

export interface SportsOutcomeTier {
  correct: number;
  winners: number;
  perWinner: number;
}

export interface SportsRound {
  id: string;
  number: number;
  leagueRound?: number;
  nameAr: string;
  nameEn: string;
  status: "open" | "closed" | "finalized" | "settled" | string;
  opensAt: number;
  closesAt: number;
  price: number;
  maxTicketsPerPlayer?: number;
  jackpot: number;
  tiers: SportsPrizeTier[];
  outcome?: SportsOutcomeTier[] | ("1" | "X" | "2" | string)[] | null;
  matches: SportsMatch[];
}

export interface ScratchCardLive {
  code: "SC500" | "SC1K" | string;
  price: number;
  topPrize: number;
  onSale: boolean;
  topRemaining: number;
}

export interface ScratchPrizeTierSpec {
  amount: number;
  winnersCount: number;
}

export interface RecentWinnerItem {
  tier: number;
  prize: number;
  name: string;
  governorate: string | null;
  drawNumber: number;
  drawAt: number;
}

export type SportsPickChoice = "1" | "X" | "2";

export interface UserLotoTicket {
  id: string;
  game: IraqLotoGameId;
  title: string;
  createdAt: string;
  cost: number;
  status: "pending" | "won" | "lost";
  prizeWon?: number;
  prizeLabel?: string;
  drawNumber?: number;
  drawDate?: string;
  numbers?: number[];
  extraNumber?: number;
  matchedNumbers?: number[];
  extraMatched?: boolean;
  roundId?: string;
  roundName?: string;
  sportsPicks?: Record<number, SportsPickChoice>;
  correctMatchesCount?: number;
  scratchCells?: number[];
  scratchWinningNums?: number[];
  scratchPlayerCells?: { num: number; prize: number }[];
}

export interface LiveLotoSnapshot {
  fetchedAt: number;
  source: string;
  loto42Current: LotoCurrentState | null;
  loto42Draws: LotoDrawOfficial[];
  loto29Current: LotoCurrentState | null;
  loto29Draws: LotoDrawOfficial[];
  sportsRounds: SportsRound[];
  scratchCards: ScratchCardLive[];
  recentWinners: RecentWinnerItem[];
}

export type UrgencyLevel = "critical" | "soon" | "normal";

export interface ImminentDrawAlert {
  id: string;
  game: IraqLotoGameId;
  roundId?: string;
  titleAr: string;
  subtitleAr: string;
  closesAtMs: number;
  drawAtMs: number;
  remainingMs: number;
  jackpot: number;
  price: number;
  urgency: UrgencyLevel;
}

// Official Scratch Card Specs from https://loto.iq/scratch/sc500 & /scratch/sc1k
export const SCRATCH_SPECS: Record<
  "SC500" | "SC1K",
  {
    gameId: "sc500" | "sc1k";
    code: "SC500" | "SC1K";
    nameAr: string;
    subtitleAr: string;
    url: string;
    price: number;
    topPrize: number;
    mechanicsAr: string;
    howToWinAr: string[];
    tiers: ScratchPrizeTierSpec[];
  }
> = {
  SC500: {
    gameId: "sc500",
    code: "SC500",
    nameAr: "طابق 3",
    subtitleAr: "بطاقة كشط فورية — 500 د.ع",
    url: "https://loto.iq/scratch/sc500",
    price: 500,
    topPrize: 10_000_000,
    mechanicsAr: "اكشط 6 خانات؛ إذا تطابقت 3 مبالغ متماثلة تربح ذلك المبلغ فوراً.",
    howToWinAr: [
      "تحتوي البطاقة على 6 خانات مخفية.",
      "اكشط جميع الخانات الست بالكامل.",
      "إذا ظهر نفس المبلغ 3 مرات في البطاقة تربح قيمة ذلك المبلغ مباشرة.",
    ],
    tiers: [
      { amount: 10_000_000, winnersCount: 1 },
      { amount: 1_000_000, winnersCount: 2 },
      { amount: 500_000, winnersCount: 5 },
      { amount: 100_000, winnersCount: 30 },
      { amount: 50_000, winnersCount: 950 },
      { amount: 20_000, winnersCount: 2_000 },
      { amount: 10_000, winnersCount: 5_000 },
      { amount: 5_000, winnersCount: 15_000 },
      { amount: 2_000, winnersCount: 40_000 },
      { amount: 1_000, winnersCount: 90_000 },
      { amount: 500, winnersCount: 300_000 },
    ],
  },
  SC1K: {
    gameId: "sc1k",
    code: "SC1K",
    nameAr: "جيب الكاس جيبه",
    subtitleAr: "بطاقة كشط فورية — 1,000 د.ع",
    url: "https://loto.iq/scratch/sc1k",
    price: 1000,
    topPrize: 20_000_000,
    mechanicsAr: "اكشط 3 أرقام رابحة و12 رقماً خاصاً بك؛ أي تطابق يمنحك الجائزة المكتوبة تحته.",
    howToWinAr: [
      "اكشط خانة الأرقام الرابحة الـ 3 في أعلى البطاقة.",
      "اكشط أرقامك الـ 12 في منطقة اللعب مع المبلغ الموجود تحت كل رقم.",
      "عند تطابق أي رقم من أرقامك مع أحد الأرقام الرابحة الثلاثة تربح الجائزة تحته فوراً.",
    ],
    tiers: [
      { amount: 20_000_000, winnersCount: 1 },
      { amount: 1_000_000, winnersCount: 2 },
      { amount: 500_000, winnersCount: 5 },
      { amount: 40_000, winnersCount: 600 },
      { amount: 20_000, winnersCount: 5_000 },
      { amount: 10_000, winnersCount: 15_150 },
      { amount: 4_000, winnersCount: 75_000 },
      { amount: 2_000, winnersCount: 100_000 },
      { amount: 1_000, winnersCount: 300_000 },
    ],
  },
};

export const LOTO_42_PRIZE_TIERS = [
  { match: "6 أرقام متطابقة", label: "الجائزة الكبرى (الجاكبوت المتراكم)", dynamic: "jackpot" as const, fixedAmount: 101_696_960 },
  { match: "5 أرقام + الرقم الإضافي", label: "الجائزة الثانية (ميني جاكبوت)", dynamic: "miniJackpot" as const, fixedAmount: 39_770_560 },
  { match: "5 أرقام متطابقة", label: "الجائزة الثالثة", dynamic: null, fixedAmount: 2_500_000 },
  { match: "4 أرقام متطابقة", label: "الجائزة الرابعة", dynamic: null, fixedAmount: 150_000 },
  { match: "3 أرقام متطابقة", label: "الجائزة الخامسة", dynamic: null, fixedAmount: 5_000 },
];

export const LOTO_29_PRIZE_TIERS = [
  { match: "6 أرقام متطابقة", label: "الجائزة الكبرى (الجاكبوت المتراكم)", dynamic: "jackpot" as const, fixedAmount: 116_955_342 },
  { match: "5 أرقام متطابقة", label: "الجائزة الثانية", dynamic: null, fixedAmount: 150_000 },
  { match: "4 أرقام متطابقة", label: "الجائزة الثالثة", dynamic: null, fixedAmount: 15_000 },
  { match: "3 أرقام متطابقة", label: "الجائزة الرابعة (استرداد البطاقة)", dynamic: null, fixedAmount: 1_500 },
];

function makeArchDraw29(drawNumber: number, dateStr: string, winningNumbers: number[]): LotoDrawOfficial {
  return {
    id: `arch-6_29-${drawNumber}`,
    drawNumber,
    gameCode: "6_29",
    status: "finalized",
    drawAt: new Date(`${dateStr}T20:50:00+03:00`).getTime(),
    price: 1500,
    jackpot: 90_000_000,
    miniJackpot: null,
    winningNumbers: [...winningNumbers].sort((a, b) => a - b),
    extraNumber: null,
  };
}

const OLDER_HISTORICAL_29: [number, string, number[]][] = [
  [416, "2026-10-01", [13, 14, 18, 19, 20, 25]],
  [415, "2026-09-28", [6, 12, 14, 18, 24, 26]],
  [414, "2026-09-24", [2, 5, 13, 19, 24, 27]],
  [413, "2026-09-21", [13, 16, 17, 21, 24, 25]],
  [412, "2026-09-17", [2, 5, 10, 17, 20, 27]],
  [411, "2026-09-14", [10, 11, 22, 24, 25, 27]],
  [410, "2026-09-10", [4, 5, 6, 8, 10, 26]],
  [409, "2026-09-07", [4, 6, 8, 14, 19, 24]],
  [408, "2026-09-03", [1, 10, 12, 20, 21, 23]],
  [407, "2026-08-31", [1, 7, 14, 18, 22, 26]],
  [406, "2026-08-27", [4, 5, 7, 12, 15, 28]],
  [405, "2026-08-24", [4, 8, 14, 16, 22, 29]],
  [404, "2026-08-20", [8, 9, 11, 14, 22, 28]],
  [403, "2026-08-17", [1, 2, 5, 11, 22, 27]],
  [402, "2026-08-13", [5, 6, 11, 17, 23, 27]],
  [401, "2026-08-10", [7, 10, 15, 23, 24, 28]],
  [400, "2026-08-06", [5, 16, 20, 21, 25, 27]],
  [399, "2026-08-03", [5, 6, 7, 16, 24, 26]],
  [398, "2026-07-30", [3, 8, 10, 12, 15, 25]],
  [397, "2026-07-27", [4, 6, 12, 13, 15, 18]],
  [396, "2026-07-23", [5, 12, 15, 16, 17, 26]],
  [395, "2026-07-20", [1, 2, 5, 6, 19, 26]],
  [394, "2026-07-16", [14, 15, 16, 27, 28, 29]],
  [393, "2026-07-13", [5, 17, 19, 22, 26, 27]],
  [392, "2026-07-09", [6, 10, 16, 19, 20, 23]],
  [391, "2026-07-06", [5, 10, 15, 16, 20, 28]],
  [390, "2026-07-02", [2, 10, 13, 14, 15, 27]],
  [389, "2026-06-29", [9, 16, 18, 20, 25, 27]],
  [388, "2026-06-25", [5, 11, 15, 17, 22, 26]],
  [387, "2026-06-22", [2, 6, 18, 20, 28, 29]],
  [386, "2026-06-18", [8, 10, 16, 19, 27, 29]],
  [385, "2026-06-15", [1, 15, 19, 21, 23, 29]],
  [384, "2026-06-11", [9, 17, 19, 20, 24, 26]],
  [383, "2026-06-08", [3, 9, 19, 22, 23, 25]],
  [382, "2026-06-04", [2, 6, 10, 15, 19, 28]],
  [381, "2026-06-01", [9, 13, 14, 18, 25, 26]],
  [380, "2026-05-28", [2, 4, 7, 8, 15, 24]],
  [379, "2026-05-25", [5, 11, 22, 25, 27, 29]],
  [378, "2026-05-21", [1, 4, 5, 12, 23, 28]],
  [377, "2026-05-18", [1, 2, 3, 13, 25, 29]],
  [376, "2026-05-14", [1, 16, 19, 24, 26, 29]],
  [375, "2026-05-11", [7, 10, 14, 15, 20, 28]],
  [374, "2026-05-07", [4, 12, 14, 22, 27, 29]],
  [373, "2026-05-04", [1, 2, 3, 23, 25, 28]],
  [372, "2026-04-30", [3, 10, 14, 18, 20, 21]],
  [371, "2026-04-27", [2, 6, 12, 13, 15, 28]],
  [370, "2026-04-23", [4, 9, 13, 19, 20, 22]],
];

export const BASELINE_LOTO42_DRAWS: LotoDrawOfficial[] = VERIFIED_LOTO42_DRAWS_OFFICIAL;

export const BASELINE_LOTO29_DRAWS: LotoDrawOfficial[] = [
  ...VERIFIED_LOTO29_DRAWS_OFFICIAL,
  ...OLDER_HISTORICAL_29.map(([n, dt, balls]) => makeArchDraw29(n, dt, balls)),
];

export const BASELINE_SPORTS_ROUNDS: SportsRound[] = VERIFIED_SPORTS_ROUNDS;

export const BASELINE_SNAPSHOT: LiveLotoSnapshot = {
  fetchedAt: 1795726051000,
  source: "loto.iq-verified",
  loto42Current: VERIFIED_LOTO42_CURRENT,
  loto42Draws: BASELINE_LOTO42_DRAWS,
  loto29Current: VERIFIED_LOTO29_CURRENT,
  loto29Draws: BASELINE_LOTO29_DRAWS,
  sportsRounds: BASELINE_SPORTS_ROUNDS,
  scratchCards: VERIFIED_SCRATCH_CARDS,
  recentWinners: VERIFIED_RECENT_WINNERS,
};

export function mergeDrawsDeduplicated(
  liveDraws: LotoDrawOfficial[],
  existingDraws: LotoDrawOfficial[],
  baselineDraws: LotoDrawOfficial[]
): LotoDrawOfficial[] {
  const byNumber = new Map<number, LotoDrawOfficial>();

  const ingest = (list: LotoDrawOfficial[], priority: boolean) => {
    for (const d of list || []) {
      if (!d || typeof d.drawNumber !== "number") continue;
      if (!Array.isArray(d.winningNumbers) || d.winningNumbers.length !== 6) continue;
      const cleanNums = d.winningNumbers
        .map(Number)
        .filter((n) => Number.isFinite(n) && n > 0)
        .sort((a, b) => a - b);
      if (cleanNums.length !== 6) continue;

      if (priority || !byNumber.has(d.drawNumber)) {
        byNumber.set(d.drawNumber, {
          ...d,
          winningNumbers: cleanNums,
          extraNumber:
            d.extraNumber !== null && d.extraNumber !== undefined && Number(d.extraNumber) > 0
              ? Number(d.extraNumber)
              : null,
        });
      }
    }
  };

  ingest(baselineDraws, false);
  ingest(existingDraws, true);
  ingest(liveDraws, true);

  return Array.from(byNumber.values()).sort((a, b) => b.drawNumber - a.drawNumber);
}

export function mergeSportsRoundsDeduplicated(
  liveRounds: SportsRound[],
  existingRounds: SportsRound[],
  baselineRounds: SportsRound[]
): SportsRound[] {
  const byId = new Map<string, SportsRound>();
  const ingest = (list: SportsRound[], priority: boolean) => {
    for (const r of list || []) {
      if (!r || !r.id || !Array.isArray(r.matches)) continue;
      if (priority || !byId.has(r.id)) {
        byId.set(r.id, r);
      }
    }
  };
  ingest(baselineRounds, false);
  ingest(existingRounds, true);
  ingest(liveRounds, true);

  // Sort open rounds by nearest `closesAt` first, then settled rounds by newest `closesAt`
  return Array.from(byId.values()).sort((a, b) => {
    const aOpen = a.status === "open" ? 0 : 1;
    const bOpen = b.status === "open" ? 0 : 1;
    if (aOpen !== bOpen) return aOpen - bOpen;
    if (a.status === "open") return a.closesAt - b.closesAt;
    return b.closesAt - a.closesAt;
  });
}

/**
 * Extracts actual "1" | "X" | "2" match outcome from a finished SportsMatch score
 */
export function getMatchActualOutcome(match: SportsMatch): SportsPickChoice | null {
  if (
    match.score &&
    typeof match.score === "object" &&
    (match.phase === "finished" || match.status === "played" || match.status === "finished")
  ) {
    const h = Number(match.score.home);
    const a = Number(match.score.away);
    if (Number.isFinite(h) && Number.isFinite(a)) {
      return h > a ? "1" : h < a ? "2" : "X";
    }
  }
  return null;
}

/**
 * Computes all imminent draws & rounds sorted by closest closing deadline.
 * - `critical`: closing in <= 6 hours (e.g., tonight's draw!)
 * - `soon`: closing in <= 30 hours (e.g., tomorrow's draw / round!)
 */
export function computeImminentDrawAlerts(
  loto42Current: LotoCurrentState | null,
  loto29Current: LotoCurrentState | null,
  sportsRounds: SportsRound[],
  nowMs = Date.now()
): ImminentDrawAlert[] {
  const alerts: ImminentDrawAlert[] = [];

  const pushDrawAlert = (
    game: "loto42" | "loto29",
    titleAr: string,
    selling?: LotoDrawOfficial | null
  ) => {
    if (!selling) return;
    const closeMs = selling.salesCloseAt || selling.drawAt;
    const rem = closeMs - nowMs;
    if (rem <= 0) return;
    const hours = rem / 3_600_000;
    const urgency: UrgencyLevel =
      hours <= 6 ? "critical" : hours <= 30 ? "soon" : "normal";
    alerts.push({
      id: `alert-${game}-${selling.drawNumber}`,
      game,
      titleAr: `${titleAr} — سحب #${selling.drawNumber}`,
      subtitleAr:
        urgency === "critical"
          ? "يسحب الليلة! التوليفة الذهبية جاهزة للاستعمال قبل إغلاق المبيعات"
          : "سحب قريب — التوليفة المحسوبة جاهزة للاستعمال",
      closesAtMs: closeMs,
      drawAtMs: selling.drawAt,
      remainingMs: rem,
      jackpot: selling.jackpot,
      price: selling.price,
      urgency,
    });
  };

  pushDrawAlert("loto42", "لوتو 42", loto42Current?.selling);
  pushDrawAlert("loto29", "لوتو 29", loto29Current?.selling);

  for (const r of sportsRounds) {
    if (r.status !== "open") continue;
    const rem = r.closesAt - nowMs;
    if (rem <= 0) continue;
    const hours = rem / 3_600_000;
    const urgency: UrgencyLevel =
      hours <= 6 ? "critical" : hours <= 30 ? "soon" : "normal";
    alerts.push({
      id: `alert-sports-${r.id}`,
      game: "sports",
      roundId: r.id,
      titleAr: `اللوتو الرياضي — ${r.nameAr}`,
      subtitleAr:
        urgency === "critical"
          ? "تغلق الجولة خلال ساعات قليلة! توقعات الـ 10 مباريات جاهزة"
          : "جولة قريبة الإغلاق — قسيمة الـ 10 مباريات جاهزة للاستعمال",
      closesAtMs: r.closesAt,
      drawAtMs: r.closesAt,
      remainingMs: rem,
      jackpot: r.jackpot,
      price: r.price,
      urgency,
    });
  }

  return alerts.sort((a, b) => a.remainingMs - b.remainingMs);
}

// Fallback CORS JSON fetchers for Capacitor mobile builds
async function fetchViaCorsRelay(targetUrl: string): Promise<any | null> {
  const relays: { build: (u: string) => string; unwrap?: boolean }[] = [
    {
      build: (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
      unwrap: true,
    },
    {
      build: (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
    },
  ];

  for (const relay of relays) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8500);
    try {
      const res = await fetch(relay.build(targetUrl), {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });
      if (res.ok) {
        const json = await res.json();
        const payload = relay.unwrap && typeof json?.contents === "string"
          ? JSON.parse(json.contents)
          : json;
        if (payload && typeof payload === "object") {
          return payload;
        }
      }
    } catch {
      // Try next relay
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

async function fetchLiveViaClientRelays(): Promise<LiveLotoSnapshot | null> {
  const base = "https://loto.iq";
  // Small staggered batches to avoid 429 rate-limits on public relays
  const [loto42Current, loto29Current, sportsData] = await Promise.all([
    fetchViaCorsRelay(`${base}/api/draws/current`),
    fetchViaCorsRelay(`${base}/api/draws/current?game=29`),
    fetchViaCorsRelay(`${base}/api/sports/rounds`),
  ]);

  const [loto42P1, loto29P1, scratchData, winnersData] = await Promise.all([
    fetchViaCorsRelay(`${base}/api/draws/past?page=1`),
    fetchViaCorsRelay(`${base}/api/draws/past?game=29&page=1`),
    fetchViaCorsRelay(`${base}/api/scratch/lobby`),
    fetchViaCorsRelay(`${base}/api/winners/recent`),
  ]);

  const loto42Draws = Array.isArray(loto42P1?.draws) ? loto42P1.draws : [];
  const loto29Draws = Array.isArray(loto29P1?.draws) ? loto29P1.draws : [];
  const sportsRounds = [
    ...(Array.isArray(sportsData?.rounds) ? sportsData.rounds : []),
    ...(Array.isArray(sportsData?.played) ? sportsData.played : []),
  ];
  const scratchCards = Array.isArray(scratchData?.cards) ? scratchData.cards : [];
  const recentWinners = Array.isArray(winnersData?.winners) ? winnersData.winners : [];

  if (
    !loto42Current &&
    loto42Draws.length === 0 &&
    !loto29Current &&
    sportsRounds.length === 0 &&
    scratchCards.length === 0
  ) {
    return null;
  }

  return {
    fetchedAt: Date.now(),
    source: "loto.iq-relay",
    loto42Current: loto42Current || null,
    loto42Draws,
    loto29Current: loto29Current || null,
    loto29Draws,
    sportsRounds,
    scratchCards,
    recentWinners,
  };
}

/**
 * Fetches live up-to-the-second data from https://loto.iq/ across all 5 games.
 * 1) Calls Next.js Serverless Route `/api/loto-iq` (now active on Vercel & local dev!).
 * 2) Falls back to staggered CORS relays on Capacitor static mobile builds.
 */
export async function fetchLiveLotoIqSnapshot(): Promise<LiveLotoSnapshot | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(`/api/loto-iq?t=${Date.now()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data && data.ok) {
        return {
          fetchedAt: data.fetchedAt || Date.now(),
          source: data.source || "loto.iq-live",
          loto42Current: data.loto42Current || null,
          loto42Draws: Array.isArray(data.loto42Draws) ? data.loto42Draws : [],
          loto29Current: data.loto29Current || null,
          loto29Draws: Array.isArray(data.loto29Draws) ? data.loto29Draws : [],
          sportsRounds: Array.isArray(data.sportsRounds) ? data.sportsRounds : [],
          scratchCards: Array.isArray(data.scratchCards) ? data.scratchCards : [],
          recentWinners: Array.isArray(data.recentWinners) ? data.recentWinners : [],
        };
      }
    }
  } catch {
    // Proceed to relay fallback
  }

  return fetchLiveViaClientRelays();
}

export function resolveLogoUrl(logoUrl?: string): string | null {
  if (!logoUrl) return null;
  if (logoUrl.startsWith("http://") || logoUrl.startsWith("https://")) return logoUrl;
  return `https://loto.iq${logoUrl.startsWith("/") ? "" : "/"}${logoUrl}`;
}

export function evaluateUserTicket(
  ticket: UserLotoTicket,
  loto42Draws: LotoDrawOfficial[],
  loto29Draws: LotoDrawOfficial[],
  sportsRounds: SportsRound[]
): UserLotoTicket {
  if (ticket.game === "loto42" || ticket.game === "loto29") {
    const draws = ticket.game === "loto42" ? loto42Draws : loto29Draws;
    const nums = ticket.numbers || [];
    if (nums.length !== 6) return ticket;

    let matchDraw = ticket.drawNumber
      ? draws.find((d) => d.drawNumber === ticket.drawNumber)
      : undefined;

    if (!matchDraw && ticket.drawDate) {
      const targetTs = new Date(ticket.drawDate).getTime();
      if (!Number.isNaN(targetTs)) {
        matchDraw = draws.find(
          (d) => Math.abs(d.drawAt - targetTs) <= 36 * 60 * 60 * 1000
        );
      }
    }

    if (!matchDraw || !Array.isArray(matchDraw.winningNumbers)) {
      return ticket;
    }

    const winSet = new Set(matchDraw.winningNumbers);
    const matched = nums.filter((n) => winSet.has(n));
    const extraMatched =
      ticket.game === "loto42" &&
      matchDraw.extraNumber !== null &&
      (ticket.extraNumber === matchDraw.extraNumber ||
        nums.includes(matchDraw.extraNumber));

    let prizeWon = 0;
    let prizeLabel = "لم تحالفك الجائزة في هذا السحب";
    let status: UserLotoTicket["status"] = "lost";

    if (ticket.game === "loto42") {
      if (matched.length === 6) {
        prizeWon = matchDraw.jackpot || 100_000_000;
        prizeLabel = "الجائزة الكبرى (6 من 6)! 👑";
        status = "won";
      } else if (matched.length === 5 && extraMatched) {
        prizeWon = matchDraw.miniJackpot || 39_000_000;
        prizeLabel = "الجائزة الثانية (5 + الإضافي)! 🥈";
        status = "won";
      } else if (matched.length === 5) {
        prizeWon = 2_500_000;
        prizeLabel = "الجائزة الثالثة (5 أرقام)! 🥉";
        status = "won";
      } else if (matched.length === 4) {
        prizeWon = 150_000;
        prizeLabel = "الجائزة الرابعة (4 أرقام)! 🌟";
        status = "won";
      } else if (matched.length === 3) {
        prizeWon = 5_000;
        prizeLabel = "الجائزة الخامسة (3 أرقام)! 🎁";
        status = "won";
      } else {
        prizeLabel = `تطابق ${matched.length} من 6`;
      }
    } else {
      if (matched.length === 6) {
        prizeWon = matchDraw.jackpot || 116_000_000;
        prizeLabel = "الجائزة الكبرى (6 من 6)! 👑";
        status = "won";
      } else if (matched.length === 5) {
        prizeWon = 150_000;
        prizeLabel = "الجائزة الثانية (5 أرقام)! 🥈";
        status = "won";
      } else if (matched.length === 4) {
        prizeWon = 15_000;
        prizeLabel = "الجائزة الثالثة (4 أرقام)! 🥉";
        status = "won";
      } else if (matched.length === 3) {
        prizeWon = 1_500;
        prizeLabel = "الجائزة الرابعة (3 أرقام)! 🎁";
        status = "won";
      } else {
        prizeLabel = `تطابق ${matched.length} من 6`;
      }
    }

    return {
      ...ticket,
      drawNumber: matchDraw.drawNumber,
      matchedNumbers: matched,
      extraMatched,
      prizeWon,
      prizeLabel,
      status,
    };
  }

  if (ticket.game === "sports" && ticket.roundId && ticket.sportsPicks) {
    const round = sportsRounds.find((r) => r.id === ticket.roundId);
    if (!round) return ticket;

    let resolvedCount = 0;
    let correct = 0;

    round.matches.forEach((m) => {
      const userPick = ticket.sportsPicks?.[m.position];
      const actual = getMatchActualOutcome(m);
      if (actual) {
        resolvedCount++;
        if (userPick === actual) correct++;
      }
    });

    if (round.status === "open" && resolvedCount < round.matches.length) {
      return { ...ticket, correctMatchesCount: correct };
    }

    if (resolvedCount === round.matches.length && resolvedCount > 0) {
      const tier = round.tiers?.find((t) => t.correct === correct);
      if (tier && correct >= 7) {
        return {
          ...ticket,
          status: "won",
          correctMatchesCount: correct,
          prizeWon: tier.amount,
          prizeLabel: `فوز بـ ${correct} من ${resolvedCount} مباريات صحيحة! 🏆`,
        };
      }
      return {
        ...ticket,
        status: "lost",
        correctMatchesCount: correct,
        prizeWon: 0,
        prizeLabel: `${correct} من ${resolvedCount} صحيحة (الفوز يبدأ من 7 مباريات)`,
      };
    }
  }

  return ticket;
}
