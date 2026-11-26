// Live data types, archive seed, and resilient multi-layer synchronization with https://loto.iq/

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
  venue?: string;
  status: string; // "scheduled" | "finished" | "in_play" | ...
  phase?: string | null;
  score?: { home: number; away: number } | string | null;
  minute?: number | null;
  resultPick?: "1" | "X" | "2" | null;
}

export interface SportsPrizeTier {
  correct: number;
  amount: number;
  perTicket: boolean;
  grows: boolean;
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
  outcome?: ("1" | "X" | "2" | string)[] | null;
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
  governorate: string;
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
  // For loto42 & loto29
  drawNumber?: number;
  drawDate?: string;
  numbers?: number[];
  extraNumber?: number;
  matchedNumbers?: number[];
  extraMatched?: boolean;
  // For sports
  roundId?: string;
  roundName?: string;
  sportsPicks?: Record<number, SportsPickChoice>; // position (1..10) -> "1"|"X"|"2"
  correctMatchesCount?: number;
  // For scratch cards (sc500 / sc1k)
  scratchCells?: number[]; // sc500 6 amounts
  scratchWinningNums?: number[]; // sc1k 3 numbers
  scratchPlayerCells?: { num: number; prize: number }[]; // sc1k 12 cells
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

// Official Prize Tiers for Loto 42 & Loto 29
export const LOTO_42_PRIZE_TIERS = [
  { match: "6 أرقام متطابقة", label: "الجائزة الكبرى (الجاكبوت المتراكم)", dynamic: "jackpot" as const, fixedAmount: 101_666_930 },
  { match: "5 أرقام + الرقم الإضافي", label: "الجائزة الثانية (ميني جاكبوت)", dynamic: "miniJackpot" as const, fixedAmount: 39_761_980 },
  { match: "5 أرقام متطابقة", label: "الجائزة الثالثة", dynamic: null, fixedAmount: 2_500_000 },
  { match: "4 أرقام متطابقة", label: "الجائزة الرابعة", dynamic: null, fixedAmount: 150_000 },
  { match: "3 أرقام متطابقة", label: "الجائزة الخامسة", dynamic: null, fixedAmount: 5_000 },
];

export const LOTO_29_PRIZE_TIERS = [
  { match: "6 أرقام متطابقة", label: "الجائزة الكبرى (الجاكبوت المتراكم)", dynamic: "jackpot" as const, fixedAmount: 116_885_315 },
  { match: "5 أرقام متطابقة", label: "الجائزة الثانية", dynamic: null, fixedAmount: 150_000 },
  { match: "4 أرقام متطابقة", label: "الجائزة الثالثة", dynamic: null, fixedAmount: 15_000 },
  { match: "3 أرقام متطابقة", label: "الجائزة الرابعة (استرداد البطاقة)", dynamic: null, fixedAmount: 1_500 },
];

// Historical Archive Baseline so offline / 0ms initial load always has deep history,
// which is then merged seamlessly by `drawNumber` with live `loto.iq` responses!
function makeArchDraw(
  gameCode: "42_PLUS_1" | "6_29",
  drawNumber: number,
  dateStr: string,
  winningNumbers: number[],
  extraNumber: number | null = null
): LotoDrawOfficial {
  return {
    id: `arch-${gameCode}-${drawNumber}`,
    drawNumber,
    gameCode,
    status: "finalized",
    drawAt: new Date(`${dateStr}T20:50:00+03:00`).getTime(),
    price: gameCode === "42_PLUS_1" ? 2000 : 1500,
    jackpot: gameCode === "42_PLUS_1" ? 100_000_000 : 115_000_000,
    miniJackpot: gameCode === "42_PLUS_1" ? 38_000_000 : null,
    winningNumbers: [...winningNumbers].sort((a, b) => a - b),
    extraNumber,
  };
}

export const BASELINE_LOTO42_DRAWS: LotoDrawOfficial[] = [
  makeArchDraw("42_PLUS_1", 39, "2026-11-25", [1, 20, 21, 33, 34, 39], 27),
  makeArchDraw("42_PLUS_1", 29, "2026-10-21", [2, 13, 30, 31, 32, 34], 16),
  makeArchDraw("42_PLUS_1", 23, "2026-09-30", [3, 4, 10, 24, 28, 39], 20),
  makeArchDraw("42_PLUS_1", 22, "2026-09-26", [7, 8, 17, 18, 35, 38], 21),
  makeArchDraw("42_PLUS_1", 21, "2026-09-23", [3, 22, 29, 35, 37, 42], 34),
  makeArchDraw("42_PLUS_1", 20, "2026-09-19", [3, 4, 15, 26, 39, 41], 1),
  makeArchDraw("42_PLUS_1", 19, "2026-09-16", [1, 11, 15, 20, 24, 29], 23),
  makeArchDraw("42_PLUS_1", 18, "2026-09-12", [5, 15, 21, 31, 36, 37], 3),
  makeArchDraw("42_PLUS_1", 17, "2026-09-09", [4, 6, 12, 14, 36, 38], 15),
  makeArchDraw("42_PLUS_1", 16, "2026-09-05", [8, 9, 20, 25, 33, 35], 21),
  makeArchDraw("42_PLUS_1", 15, "2026-09-02", [2, 8, 18, 32, 38, 40], 37),
  makeArchDraw("42_PLUS_1", 14, "2026-08-29", [3, 8, 17, 25, 39, 40], 19),
  makeArchDraw("42_PLUS_1", 13, "2026-08-26", [5, 11, 16, 18, 29, 40], 19),
  makeArchDraw("42_PLUS_1", 12, "2026-08-22", [15, 16, 20, 26, 30, 39], 7),
  makeArchDraw("42_PLUS_1", 11, "2026-08-19", [6, 7, 10, 14, 22, 31], 24),
  makeArchDraw("42_PLUS_1", 10, "2026-08-15", [2, 5, 7, 14, 37, 40], 26),
  makeArchDraw("42_PLUS_1", 9, "2026-08-12", [15, 17, 18, 26, 30, 40], 8),
  makeArchDraw("42_PLUS_1", 8, "2026-08-08", [3, 13, 17, 32, 37, 40], 24),
  makeArchDraw("42_PLUS_1", 7, "2026-08-05", [2, 16, 24, 25, 29, 30], 32),
  makeArchDraw("42_PLUS_1", 6, "2026-08-01", [6, 8, 22, 23, 27, 31], 42),
  makeArchDraw("42_PLUS_1", 5, "2026-07-29", [7, 14, 17, 18, 26, 37], 33),
  makeArchDraw("42_PLUS_1", 4, "2026-07-25", [12, 14, 15, 17, 25, 41], 16),
  makeArchDraw("42_PLUS_1", 3, "2026-07-22", [1, 5, 13, 22, 33, 34], 9),
  makeArchDraw("42_PLUS_1", 2, "2026-07-18", [7, 9, 10, 19, 33, 40], 20),
  makeArchDraw("42_PLUS_1", 1, "2026-07-15", [20, 23, 29, 36, 38, 41], 42),
];

const HISTORICAL_29_TUPLES: [number, string, number[]][] = [
  [431, "2026-11-23", [6, 16, 17, 19, 24, 29]],
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
  [369, "2026-04-20", [2, 6, 7, 16, 24, 27]],
  [368, "2026-04-16", [1, 4, 6, 17, 21, 24]],
  [367, "2026-04-13", [2, 10, 11, 12, 23, 28]],
  [366, "2026-04-09", [1, 7, 12, 22, 26, 27]],
  [365, "2026-04-06", [3, 4, 7, 11, 24, 28]],
  [364, "2026-04-02", [2, 11, 14, 25, 28, 29]],
  [363, "2026-03-30", [1, 2, 5, 20, 23, 28]],
  [362, "2026-03-26", [3, 5, 13, 19, 20, 21]],
  [361, "2026-03-23", [9, 13, 19, 22, 27, 29]],
  [360, "2026-03-19", [10, 13, 16, 19, 28, 29]],
  [359, "2026-03-16", [9, 10, 11, 20, 28, 29]],
  [358, "2026-03-12", [1, 6, 8, 9, 22, 27]],
  [357, "2026-03-09", [1, 4, 8, 11, 12, 23]],
  [356, "2026-03-05", [3, 15, 21, 22, 25, 27]],
  [355, "2026-03-02", [2, 3, 9, 13, 16, 21]],
  [354, "2026-02-26", [4, 7, 8, 13, 14, 24]],
  [353, "2026-02-23", [6, 7, 8, 10, 17, 29]],
  [352, "2026-02-19", [1, 4, 19, 20, 23, 24]],
  [351, "2026-02-16", [4, 9, 15, 20, 22, 27]],
  [350, "2026-02-12", [1, 4, 8, 12, 13, 28]],
];

export const BASELINE_LOTO29_DRAWS: LotoDrawOfficial[] = HISTORICAL_29_TUPLES.map(
  ([num, dateStr, balls]) => makeArchDraw("6_29", num, dateStr, balls, null)
);

export const BASELINE_SNAPSHOT: LiveLotoSnapshot = {
  fetchedAt: 0,
  source: "baseline",
  loto42Current: {
    selling: {
      id: "drw_baseline_40",
      drawNumber: 40,
      gameCode: "42_PLUS_1",
      status: "open",
      drawAt: 1795888200000,
      salesCloseAt: 1795886400000,
      price: 2000,
      jackpot: 101_666_930,
      miniJackpot: 39_761_980,
      ticketsSold: 786,
      winningNumbers: null,
      extraNumber: null,
    },
    awaiting: null,
  },
  loto42Draws: BASELINE_LOTO42_DRAWS,
  loto29Current: {
    selling: {
      id: "drw_baseline_432",
      drawNumber: 432,
      gameCode: "6_29",
      status: "open",
      drawAt: 1795715400000,
      salesCloseAt: 1795713600000,
      price: 1500,
      jackpot: 116_885_315,
      miniJackpot: null,
      ticketsSold: 5486,
      winningNumbers: null,
      extraNumber: null,
    },
    awaiting: null,
  },
  loto29Draws: BASELINE_LOTO29_DRAWS,
  sportsRounds: [],
  scratchCards: [
    { code: "SC500", price: 500, topPrize: 10_000_000, onSale: true, topRemaining: 1 },
    { code: "SC1K", price: 1000, topPrize: 20_000_000, onSale: true, topRemaining: 1 },
  ],
  recentWinners: [],
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
  ingest(liveDraws, true); // Live official API wins over everything

  return Array.from(byNumber.values()).sort((a, b) => b.drawNumber - a.drawNumber);
}

// Fallback CORS JSON fetchers for purely static hosting environments (Vercel `out/` or Capacitor)
async function fetchViaCorsRelay(targetUrl: string): Promise<any | null> {
  const relays = [
    (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
    (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  ];

  for (const buildRelayUrl of relays) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(buildRelayUrl(targetUrl), {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });
      if (res.ok) {
        const text = await res.text();
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === "object") {
          return parsed;
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
  const [
    loto42Current,
    loto42P1,
    loto42P2,
    loto42P3,
    loto42P4,
    loto29Current,
    loto29P1,
    sportsData,
    scratchData,
    winnersData,
  ] = await Promise.all([
    fetchViaCorsRelay(`${base}/api/draws/current`),
    fetchViaCorsRelay(`${base}/api/draws/past?page=1`),
    fetchViaCorsRelay(`${base}/api/draws/past?page=2`),
    fetchViaCorsRelay(`${base}/api/draws/past?page=3`),
    fetchViaCorsRelay(`${base}/api/draws/past?page=4`),
    fetchViaCorsRelay(`${base}/api/draws/current?game=29`),
    fetchViaCorsRelay(`${base}/api/draws/past?game=29&page=1`),
    fetchViaCorsRelay(`${base}/api/sports/rounds`),
    fetchViaCorsRelay(`${base}/api/scratch/lobby`),
    fetchViaCorsRelay(`${base}/api/winners/recent`),
  ]);

  const loto42Draws = [
    ...(Array.isArray(loto42P1?.draws) ? loto42P1.draws : []),
    ...(Array.isArray(loto42P2?.draws) ? loto42P2.draws : []),
    ...(Array.isArray(loto42P3?.draws) ? loto42P3.draws : []),
    ...(Array.isArray(loto42P4?.draws) ? loto42P4.draws : []),
  ];
  const loto29Draws = Array.isArray(loto29P1?.draws) ? loto29P1.draws : [];
  const sportsRounds = Array.isArray(sportsData?.rounds) ? sportsData.rounds : [];
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
 * 1) Tries our own Next.js server route POST `/api/loto-iq` first (zero CORS, fastest).
 * 2) Automatically falls back to multi-provider CORS relays when running in static export (`out/` / mobile).
 */
export async function fetchLiveLotoIqSnapshot(): Promise<LiveLotoSnapshot | null> {
  // 1. Try server route first
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch("/api/loto-iq", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data && data.ok) {
        return {
          fetchedAt: data.fetchedAt || Date.now(),
          source: data.source || "loto.iq-direct",
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
    // Proceed to static/mobile relay fallback
  }

  // 2. Fallback to CORS JSON relays
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

    round.matches.forEach((m, idx) => {
      const userPick = ticket.sportsPicks?.[m.position];
      let actual: SportsPickChoice | null = null;
      if (Array.isArray(round.outcome) && round.outcome[idx]) {
        const o = String(round.outcome[idx]).toUpperCase();
        if (o === "1" || o === "X" || o === "2") actual = o;
      } else if (m.score && typeof m.score === "object") {
        const h = Number((m.score as any).home);
        const a = Number((m.score as any).away);
        if (Number.isFinite(h) && Number.isFinite(a) && m.status === "finished") {
          actual = h > a ? "1" : h < a ? "2" : "X";
        }
      }
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
