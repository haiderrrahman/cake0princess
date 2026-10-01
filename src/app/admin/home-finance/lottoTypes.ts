export type LottoGameType = "super_key" | "iraq_lotto";

export interface LottoDraw {
  id: string;
  game: LottoGameType;
  drawNumber: number;
  date: string; // YYYY-MM-DD
  numbers: number[]; // 6 numbers
  luckyNumber?: number; // Only for super_key
  createdAt?: string;
}

export interface LottoTicket {
  id: string;
  game: LottoGameType;
  ticketName?: string;
  numbers: number[]; // 6 numbers
  luckyNumber?: number; // for super_key
  drawDate: string; // YYYY-MM-DD
  drawNumber?: number;
  cost: number;
  expenseId?: string;
  status: "pending" | "matched";
  matchCount?: number;
  luckyMatched?: boolean;
  matchedNumbers?: number[];
  prizeTier?: string;
  createdAt: string;
}

export const INITIAL_SUPER_KEY_DRAWS: LottoDraw[] = [
  { id: "sk-23", game: "super_key", drawNumber: 23, date: "2026-09-30", numbers: [3, 4, 10, 24, 28, 39], luckyNumber: 20 },
  { id: "sk-22", game: "super_key", drawNumber: 22, date: "2026-09-26", numbers: [7, 8, 17, 18, 35, 38], luckyNumber: 21 },
  { id: "sk-21", game: "super_key", drawNumber: 21, date: "2026-09-23", numbers: [3, 22, 29, 35, 37, 42], luckyNumber: 34 },
  { id: "sk-20", game: "super_key", drawNumber: 20, date: "2026-09-19", numbers: [3, 4, 15, 26, 39, 41], luckyNumber: 1 },
  { id: "sk-19", game: "super_key", drawNumber: 19, date: "2026-09-16", numbers: [1, 11, 15, 20, 24, 29], luckyNumber: 23 },
  { id: "sk-18", game: "super_key", drawNumber: 18, date: "2026-09-12", numbers: [5, 15, 21, 31, 36, 37], luckyNumber: 3 },
  { id: "sk-17", game: "super_key", drawNumber: 17, date: "2026-09-09", numbers: [4, 6, 12, 14, 36, 38], luckyNumber: 15 },
  { id: "sk-16", game: "super_key", drawNumber: 16, date: "2026-09-05", numbers: [8, 9, 20, 25, 33, 35], luckyNumber: 21 },
  { id: "sk-15", game: "super_key", drawNumber: 15, date: "2026-09-02", numbers: [2, 8, 18, 32, 38, 40], luckyNumber: 37 },
  { id: "sk-14", game: "super_key", drawNumber: 14, date: "2026-08-29", numbers: [3, 8, 17, 25, 39, 40], luckyNumber: 19 },
  { id: "sk-13", game: "super_key", drawNumber: 13, date: "2026-08-26", numbers: [5, 11, 16, 18, 29, 40], luckyNumber: 19 },
  { id: "sk-12", game: "super_key", drawNumber: 12, date: "2026-08-22", numbers: [15, 16, 20, 26, 30, 39], luckyNumber: 7 },
  { id: "sk-11", game: "super_key", drawNumber: 11, date: "2026-08-19", numbers: [6, 7, 10, 14, 22, 31], luckyNumber: 24 },
  { id: "sk-10", game: "super_key", drawNumber: 10, date: "2026-08-15", numbers: [2, 5, 7, 14, 37, 40], luckyNumber: 26 },
  { id: "sk-9", game: "super_key", drawNumber: 9, date: "2026-08-12", numbers: [15, 17, 18, 26, 30, 40], luckyNumber: 8 },
  { id: "sk-8", game: "super_key", drawNumber: 8, date: "2026-08-08", numbers: [3, 13, 17, 32, 37, 40], luckyNumber: 24 },
  { id: "sk-7", game: "super_key", drawNumber: 7, date: "2026-08-05", numbers: [2, 16, 24, 25, 29, 30], luckyNumber: 32 },
  { id: "sk-6", game: "super_key", drawNumber: 6, date: "2026-08-01", numbers: [6, 8, 22, 23, 27, 31], luckyNumber: 42 },
  { id: "sk-5", game: "super_key", drawNumber: 5, date: "2026-07-29", numbers: [7, 14, 17, 18, 26, 37], luckyNumber: 33 },
  { id: "sk-4", game: "super_key", drawNumber: 4, date: "2026-07-25", numbers: [12, 14, 15, 17, 25, 41], luckyNumber: 16 },
  { id: "sk-3", game: "super_key", drawNumber: 3, date: "2026-07-22", numbers: [1, 5, 13, 22, 33, 34], luckyNumber: 9 },
  { id: "sk-2", game: "super_key", drawNumber: 2, date: "2026-07-18", numbers: [7, 9, 10, 19, 33, 40], luckyNumber: 20 },
  { id: "sk-1", game: "super_key", drawNumber: 1, date: "2026-07-15", numbers: [20, 23, 29, 36, 38, 41], luckyNumber: 42 }
];

export const INITIAL_IRAQ_LOTTO_DRAWS: LottoDraw[] = [
  { id: "il-10", game: "iraq_lotto", drawNumber: 10, date: "2026-09-28", numbers: [4, 9, 14, 18, 22, 27] },
  { id: "il-9", game: "iraq_lotto", drawNumber: 9, date: "2026-09-24", numbers: [2, 7, 11, 16, 23, 29] },
  { id: "il-8", game: "iraq_lotto", drawNumber: 8, date: "2026-09-21", numbers: [5, 10, 13, 20, 25, 28] },
  { id: "il-7", game: "iraq_lotto", drawNumber: 7, date: "2026-09-17", numbers: [3, 8, 15, 19, 24, 26] },
  { id: "il-6", game: "iraq_lotto", drawNumber: 6, date: "2026-09-14", numbers: [1, 6, 12, 17, 21, 28] }
];

export const GAME_DETAILS = {
  super_key: {
    title: "لوتو العراق سوبر كي",
    shortTitle: "سوبر كي (42)",
    maxNumber: 42,
    pickCount: 6,
    hasLuckyNumber: true,
    drawDaysArabic: "كل سبت وأربعاء",
    drawDays: [3, 6], // 3: Wednesday, 6: Saturday
    badgeColor: "from-amber-500 via-rose-500 to-purple-600",
    themeColor: "#8b5cf6"
  },
  iraq_lotto: {
    title: "لوتو العراق الخيري (6 من 29)",
    shortTitle: "لوتو العراق (29)",
    maxNumber: 29,
    pickCount: 6,
    hasLuckyNumber: false,
    drawDaysArabic: "كل اثنين وخميس",
    drawDays: [1, 4], // 1: Monday, 4: Thursday
    badgeColor: "from-red-600 via-pink-600 to-amber-500",
    themeColor: "#e11d48"
  }
};

/**
 * Returns the next upcoming draw date in YYYY-MM-DD
 */
export function getNextDrawDate(game: LottoGameType, fromDate = new Date()): string {
  const targetDays = GAME_DETAILS[game].drawDays;
  const currentDay = fromDate.getDay();
  let minDiff = 7;

  for (const day of targetDays) {
    let diff = (day - currentDay + 7) % 7;
    // If today is a draw day after 8 PM, take next draw day
    if (diff === 0 && fromDate.getHours() >= 20) {
      diff = 7;
    }
    if (diff < minDiff) {
      minDiff = diff;
    }
  }

  const nextDate = new Date(fromDate);
  nextDate.setDate(nextDate.getDate() + minDiff);
  return nextDate.toISOString().split("T")[0];
}

/**
 * Calculate frequencies of numbers from historical draws
 */
export function calculateLottoStats(draws: LottoDraw[], game: LottoGameType) {
  const max = GAME_DETAILS[game].maxNumber;
  const gameDraws = draws.filter(d => d.game === game);
  const totalDraws = gameDraws.length;

  const numberCounts: Record<number, number> = {};
  const luckyCounts: Record<number, number> = {};
  const lastSeenMap: Record<number, number> = {}; // draw index distance

  for (let i = 1; i <= max; i++) {
    numberCounts[i] = 0;
    luckyCounts[i] = 0;
    lastSeenMap[i] = totalDraws; // default never seen
  }

  gameDraws.forEach((draw, drawIdx) => {
    draw.numbers.forEach(n => {
      if (numberCounts[n] !== undefined) {
        numberCounts[n]++;
        if (lastSeenMap[n] === totalDraws) {
          lastSeenMap[n] = drawIdx; // distance from latest
        }
      }
    });
    if (draw.luckyNumber && luckyCounts[draw.luckyNumber] !== undefined) {
      luckyCounts[draw.luckyNumber]++;
    }
  });

  const frequencyList = Object.entries(numberCounts)
    .map(([num, count]) => ({
      number: Number(num),
      count,
      lastSeenDrawsAgo: lastSeenMap[Number(num)] ?? totalDraws,
      percentage: totalDraws > 0 ? Math.round((count / totalDraws) * 100) : 0
    }))
    .sort((a, b) => b.count - a.count);

  const hotNumbers = frequencyList.slice(0, 10).map(x => x.number);
  const coldNumbers = frequencyList.slice(-10).map(x => x.number);

  const luckyList = Object.entries(luckyCounts)
    .map(([num, count]) => ({ number: Number(num), count }))
    .sort((a, b) => b.count - a.count);

  const hotLuckyNumbers = luckyList.slice(0, 6).map(x => x.number);

  return {
    totalDraws,
    frequencyList,
    hotNumbers,
    coldNumbers,
    hotLuckyNumbers
  };
}

/**
 * Smart AI & Statistical Next Number Predictor
 */
export function predictNextNumbers(
  draws: LottoDraw[],
  game: LottoGameType,
  strategy: "balanced" | "hot" | "cold" | "random" = "balanced"
): { numbers: number[]; luckyNumber?: number } {
  const max = GAME_DETAILS[game].maxNumber;
  const stats = calculateLottoStats(draws, game);
  const chosen = new Set<number>();

  const pickFromPool = (pool: number[]) => {
    const available = pool.filter(n => !chosen.has(n));
    if (available.length === 0) return;
    const picked = available[Math.floor(Math.random() * available.length)];
    chosen.add(picked);
  };

  const pickRandom = () => {
    while (chosen.size < 6) {
      const candidate = Math.floor(Math.random() * max) + 1;
      chosen.add(candidate);
    }
  };

  if (strategy === "hot" && stats.hotNumbers.length >= 6) {
    // Pick mostly from top hot numbers
    while (chosen.size < 6 && chosen.size < stats.hotNumbers.length) {
      pickFromPool(stats.hotNumbers);
    }
    pickRandom();
  } else if (strategy === "cold" && stats.coldNumbers.length >= 6) {
    // Pick from overdue / cold numbers
    while (chosen.size < 6 && chosen.size < stats.coldNumbers.length) {
      pickFromPool(stats.coldNumbers);
    }
    pickRandom();
  } else if (strategy === "balanced") {
    // 3 Hot numbers + 2 Medium numbers + 1 Overdue number (Highest statistical likelihood)
    const hotPool = stats.hotNumbers;
    const coldPool = stats.coldNumbers;
    const mediumPool = stats.frequencyList.slice(8, 22).map(x => x.number);

    // Pick 3 hot
    for (let i = 0; i < 3; i++) pickFromPool(hotPool);
    // Pick 2 medium
    for (let i = 0; i < 2; i++) pickFromPool(mediumPool);
    // Pick 1 cold
    pickFromPool(coldPool);
    // Fallback if needed
    pickRandom();
  } else {
    // Pure lucky random
    pickRandom();
  }

  const sortedNumbers = Array.from(chosen).sort((a, b) => a - b);

  let luckyNumber: number | undefined;
  if (GAME_DETAILS[game].hasLuckyNumber) {
    if (strategy === "hot" && stats.hotLuckyNumbers.length > 0) {
      luckyNumber = stats.hotLuckyNumbers[Math.floor(Math.random() * Math.min(3, stats.hotLuckyNumbers.length))];
    } else {
      // Pick either hot lucky or random lucky
      luckyNumber = stats.hotLuckyNumbers[0] && Math.random() > 0.3
        ? stats.hotLuckyNumbers[Math.floor(Math.random() * stats.hotLuckyNumbers.length)]
        : Math.floor(Math.random() * max) + 1;
    }
  }

  return {
    numbers: sortedNumbers,
    luckyNumber
  };
}

/**
 * Match a ticket against a winning draw
 */
export function checkTicketMatch(ticket: LottoTicket, draw: LottoDraw) {
  const drawSet = new Set(draw.numbers);
  const matched = ticket.numbers.filter(n => drawSet.has(n));
  const matchCount = matched.length;

  let luckyMatched = false;
  if (ticket.luckyNumber && draw.luckyNumber) {
    luckyMatched = ticket.luckyNumber === draw.luckyNumber;
  }

  let prizeTier = "لم يُحالفك الحظ هذه المرة";
  if (matchCount === 6) {
    prizeTier = "الجائزة الكبرى (الجاكبوت)! 👑🎉";
  } else if (matchCount === 5 && luckyMatched) {
    prizeTier = "الجائزة الثانية (5 أرقام + رقم الحظ)! 🥈⭐";
  } else if (matchCount === 5) {
    prizeTier = "الجائزة الثالثة (5 أرقام كاملة)! 🥉✨";
  } else if (matchCount === 4) {
    prizeTier = "الجائزة الرابعة (4 أرقام متطابقة)! 🌟";
  } else if (matchCount === 3) {
    prizeTier = "الجائزة الخامسة (3 أرقام متطابقة)! 🎁";
  }

  return {
    matchedNumbers: matched,
    matchCount,
    luckyMatched,
    prizeTier,
    hasWon: matchCount >= 3
  };
}
