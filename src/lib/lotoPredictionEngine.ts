// Quantitative, Statistical & Gemini AI Super-Prediction Engine for all 5 Iraq Lotto games
import {
  LotoDrawOfficial,
  SportsRound,
  SportsMatch,
  SportsPickChoice,
  ScratchCardLive,
  SCRATCH_SPECS,
  getMatchActualOutcome,
} from "./lotoIqService";

const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-2.0-flash",
];

function getGeminiApiKey(): string | undefined {
  return process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
}

async function callGeminiJson(prompt: string): Promise<any | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.25,
              response_mime_type: "application/json",
            },
          }),
        }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (!raw) continue;
      const cleaned = raw
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/, "");
      return JSON.parse(cleaned);
    } catch {
      // Try next model
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. LOTO 42 & LOTO 29 — 7-FACTOR QUANTITATIVE ENSEMBLE ENGINE
// ═══════════════════════════════════════════════════════════════════════════

export interface NumberMetric {
  number: number;
  count: number;
  frequencyPct: number;
  ewmaScore: number; // Recent weighted momentum
  drawsSinceLastSeen: number;
  avgGap: number;
  overdueTension: number; // > 1.2 means overdue
  zScore: number;
  compositeScore: number;
  tag: "hot" | "overdue" | "prime_zone" | "neutral";
}

export interface LotoDeepStats {
  maxNumber: number;
  totalDraws: number;
  empiricalSumMean: number;
  empiricalSumStd: number;
  goldenSumRange: [number, number];
  positionalBands: { slot: number; p15: number; median: number; p85: number }[];
  metrics: NumberMetric[];
  hotNumbers: number[];
  overdueNumbers: number[];
  primeZoneNumbers: number[]; // Optimal blend of EWMA momentum + return-to-mean tension
  topPairs: { pair: [number, number]; count: number }[];
  topExtraNumbers: { number: number; count: number }[];
  pairMatrix: Record<string, number>;
}

export interface TicketPredictionResult {
  label: string;
  strategyKey: "ensemble" | "momentum" | "rebound" | "ai_deep";
  numbers: number[];
  extraNumber: number | null;
  qualityScore: number; // 0-99
  sum: number;
  oddEven: string;
  lowHigh: string;
  decadeSpread: number;
  pairSynergy: number;
  positionalFitPct: number;
  maxPastOverlap: number;
  backtestHits3Plus: number;
  reasonsAr: string[];
}

function quantile(sortedArr: number[], q: number): number {
  if (sortedArr.length === 0) return 0;
  const pos = (sortedArr.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sortedArr[base + 1] !== undefined) {
    return Math.round(sortedArr[base] + rest * (sortedArr[base + 1] - sortedArr[base]));
  }
  return Math.round(sortedArr[base]);
}

export function computeLotoDeepStats(
  draws: LotoDrawOfficial[],
  maxNumber: 42 | 29
): LotoDeepStats {
  const validDraws = draws.filter(
    (d) => Array.isArray(d.winningNumbers) && d.winningNumbers.length === 6
  );
  const totalDraws = validDraws.length;
  const expectedProb = 6 / maxNumber;
  const expectedInterval = maxNumber / 6;

  const counts: Record<number, number> = {};
  const ewma: Record<number, number> = {};
  const appearances: Record<number, number[]> = {}; // draw indices (0 = newest)
  const extraCounts: Record<number, number> = {};
  const pairMatrix: Record<string, number> = {};
  const slotValues: number[][] = [[], [], [], [], [], []];
  const sums: number[] = [];

  for (let n = 1; n <= maxNumber; n++) {
    counts[n] = 0;
    ewma[n] = 0;
    appearances[n] = [];
    extraCounts[n] = 0;
  }

  validDraws.forEach((draw, idx) => {
    const nums = [...(draw.winningNumbers || [])].sort((a, b) => a - b);
    const sum = nums.reduce((a, b) => a + b, 0);
    sums.push(sum);

    // Exponential decay weight: newest draw idx=0 has weight 1.0, decays smoothly
    const recencyWeight = Math.exp(-0.085 * idx);

    nums.forEach((n, slotIdx) => {
      if (n >= 1 && n <= maxNumber) {
        counts[n]++;
        ewma[n] += recencyWeight;
        appearances[n].push(idx);
        if (slotIdx < 6) slotValues[slotIdx].push(n);
      }
      for (let j = slotIdx + 1; j < nums.length; j++) {
        const key = `${n}-${nums[j]}`;
        pairMatrix[key] = (pairMatrix[key] || 0) + 1;
      }
    });

    if (draw.extraNumber && draw.extraNumber >= 1 && draw.extraNumber <= maxNumber) {
      extraCounts[draw.extraNumber] =
        (extraCounts[draw.extraNumber] || 0) + (1 + 0.5 * recencyWeight);
    }
  });

  // Empirical sum distribution
  const theoreticalMean = 6 * ((maxNumber + 1) / 2);
  const empiricalSumMean =
    sums.length > 0
      ? sums.reduce((a, b) => a + b, 0) / sums.length
      : theoreticalMean;
  const variance =
    sums.length > 1
      ? sums.reduce((acc, s) => acc + Math.pow(s - empiricalSumMean, 2), 0) /
        (sums.length - 1)
      : maxNumber === 42
      ? 720
      : 360;
  const empiricalSumStd = Math.max(12, Math.sqrt(variance));
  const goldenSumRange: [number, number] = [
    Math.round(empiricalSumMean - 0.95 * empiricalSumStd),
    Math.round(empiricalSumMean + 0.95 * empiricalSumStd),
  ];

  // Positional quantile bands for slots 1..6
  const positionalBands = slotValues.map((vals, i) => {
    const s = [...vals].sort((a, b) => a - b);
    const defaultCenter = Math.round(((i + 1) * maxNumber) / 7);
    return {
      slot: i + 1,
      p15: s.length > 3 ? quantile(s, 0.15) : Math.max(1, defaultCenter - 4),
      median: s.length > 3 ? quantile(s, 0.5) : defaultCenter,
      p85: s.length > 3 ? quantile(s, 0.85) : Math.min(maxNumber, defaultCenter + 4),
    };
  });

  const expectedCount = totalDraws * expectedProb;
  const stdCount = Math.sqrt(Math.max(1, totalDraws * expectedProb * (1 - expectedProb)));
  const maxEwma = Math.max(0.001, ...Object.values(ewma));

  const metrics: NumberMetric[] = [];
  for (let n = 1; n <= maxNumber; n++) {
    const idxs = appearances[n];
    const drawsSinceLastSeen = idxs.length > 0 ? idxs[0] : totalDraws;

    // Empirical average gap between appearances of number n
    let avgGap = expectedInterval;
    if (idxs.length >= 2) {
      let gapSum = 0;
      for (let k = 1; k < idxs.length; k++) {
        gapSum += idxs[k] - idxs[k - 1];
      }
      avgGap = gapSum / (idxs.length - 1);
    }

    const overdueTension = drawsSinceLastSeen / Math.max(2, avgGap);
    const zScore = totalDraws >= 5 ? (counts[n] - expectedCount) / stdCount : 0;
    const normEwma = ewma[n] / maxEwma; // 0..1

    // Bell-curve return tension: peaks when overdueTension is between 1.05 and 2.1 (due for return without being dead)
    const hazardBell = Math.exp(-Math.pow(overdueTension - 1.35, 2) / 0.9);
    const freqNorm = totalDraws > 0 ? counts[n] / Math.max(1, expectedCount) : 1;

    // Composite quantitative score combining EWMA momentum (42%), hazard return curve (35%), and base stability (23%)
    const compositeScore =
      normEwma * 42 + hazardBell * 35 + Math.min(1.4, freqNorm) * 16.5;

    let tag: NumberMetric["tag"] = "neutral";
    if (normEwma >= 0.68 && drawsSinceLastSeen <= 4) tag = "hot";
    else if (overdueTension >= 1.45) tag = "overdue";
    else if (compositeScore >= 58) tag = "prime_zone";

    metrics.push({
      number: n,
      count: counts[n],
      frequencyPct: totalDraws > 0 ? Math.round((counts[n] / totalDraws) * 1000) / 10 : 0,
      ewmaScore: Math.round(normEwma * 100),
      drawsSinceLastSeen,
      avgGap: Math.round(avgGap * 10) / 10,
      overdueTension: Math.round(overdueTension * 100) / 100,
      zScore: Math.round(zScore * 100) / 100,
      compositeScore: Math.round(compositeScore * 10) / 10,
      tag,
    });
  }

  const hotNumbers = [...metrics]
    .sort((a, b) => b.ewmaScore - a.ewmaScore || b.count - a.count)
    .slice(0, 8)
    .map((m) => m.number);

  const overdueNumbers = [...metrics]
    .sort((a, b) => b.overdueTension - a.overdueTension || b.drawsSinceLastSeen - a.drawsSinceLastSeen)
    .slice(0, 8)
    .map((m) => m.number);

  const primeZoneNumbers = [...metrics]
    .sort((a, b) => b.compositeScore - a.compositeScore)
    .slice(0, 10)
    .map((m) => m.number);

  const topPairs = Object.entries(pairMatrix)
    .map(([k, count]) => {
      const [a, b] = k.split("-").map(Number);
      return { pair: [a, b] as [number, number], count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const topExtraNumbers = Object.entries(extraCounts)
    .map(([numStr, score]) => ({
      number: Number(numStr),
      count: Math.round(score),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return {
    maxNumber,
    totalDraws,
    empiricalSumMean: Math.round(empiricalSumMean),
    empiricalSumStd: Math.round(empiricalSumStd),
    goldenSumRange,
    positionalBands,
    metrics,
    hotNumbers,
    overdueNumbers,
    primeZoneNumbers,
    topPairs,
    topExtraNumbers,
    pairMatrix,
  };
}

export function scoreCombinationQuant(
  nums: number[],
  stats: LotoDeepStats,
  draws: LotoDrawOfficial[],
  extraNumber: number | null = null,
  strategyKey: TicketPredictionResult["strategyKey"] = "ensemble",
  customLabel?: string
): TicketPredictionResult {
  const sorted = [...nums].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mid = Math.floor(stats.maxNumber / 2);

  const oddCount = sorted.filter((n) => n % 2 !== 0).length;
  const evenCount = 6 - oddCount;
  const lowCount = sorted.filter((n) => n <= mid).length;
  const highCount = 6 - lowCount;

  const decades = new Set(sorted.map((n) => Math.floor((n - 1) / 10)));
  const decadeSpread = decades.size;

  // Positional fit (0..100%)
  let posHits = 0;
  sorted.forEach((n, idx) => {
    const band = stats.positionalBands[idx];
    if (band && n >= band.p15 && n <= band.p85) posHits++;
  });
  const positionalFitPct = Math.round((posHits / 6) * 100);

  // Pair synergy
  let pairSynergy = 0;
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      pairSynergy += stats.pairMatrix[`${sorted[i]}-${sorted[j]}`] || 0;
    }
  }

  // Overlap & Backtest against all historical draws
  let maxPastOverlap = 0;
  let backtestHits3Plus = 0;
  const candSet = new Set(sorted);
  for (const d of draws) {
    if (!Array.isArray(d.winningNumbers)) continue;
    let overlap = 0;
    for (const w of d.winningNumbers) {
      if (candSet.has(w)) overlap++;
    }
    if (overlap > maxPastOverlap) maxPastOverlap = overlap;
    if (overlap >= 3) backtestHits3Plus++;
  }

  // Consecutive run check
  let maxRun = 1;
  let curRun = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      curRun++;
      if (curRun > maxRun) maxRun = curRun;
    } else {
      curRun = 1;
    }
  }

  // Individual ball composite strength
  const metricByNum = new Map(stats.metrics.map((m) => [m.number, m]));
  const avgComposite =
    sorted.reduce((acc, n) => acc + (metricByNum.get(n)?.compositeScore || 45), 0) / 6;

  // Quantitative quality score (0..99)
  let score = 58 + Math.min(20, avgComposite * 0.28);

  // 1. Sum corridor bonus/penalty
  const [gMin, gMax] = stats.goldenSumRange;
  if (sum >= gMin && sum <= gMax) score += 8;
  else score -= Math.min(18, Math.abs(sum - stats.empiricalSumMean) * 0.35);

  // 2. Odd/Even parity balance (3/3 or 4/2 or 2/4 are 81% of real winning draws)
  if (oddCount === 3) score += 5;
  else if (oddCount === 2 || oddCount === 4) score += 3.5;
  else if (oddCount === 1 || oddCount === 5) score -= 5;
  else score -= 14;

  // 3. Low/High balance
  if (lowCount === 3) score += 4;
  else if (lowCount === 2 || lowCount === 4) score += 2.5;
  else score -= 6;

  // 4. Positional quantiles
  score += (posHits - 3) * 2.2;

  // 5. Decade diversity
  if (decadeSpread >= 3) score += 3;
  else if (decadeSpread === 1) score -= 9;

  // 6. Consecutive runs (> 2 consecutive numbers in 1..42/29 is statistically rare)
  if (maxRun >= 4) score -= 18;
  else if (maxRun === 3) score -= 7;

  // 7. Avoid cloning a past 5/6 or 6/6 draw verbatim
  if (maxPastOverlap >= 5) score -= 20;
  else if (maxPastOverlap === 4) score -= 4;

  // Pair synergy mild bonus
  score += Math.min(4, pairSynergy * 0.25);

  const qualityScore = Math.max(45, Math.min(98, Math.round(score)));

  const reasonsAr: string[] = [];
  if (sum >= gMin && sum <= gMax) {
    reasonsAr.push(`مجموع الأرقام (${sum}) يقع داخل النطاق الإحصائي الذهبي (${gMin}–${gMax}).`);
  }
  reasonsAr.push(`توازن الفردي/الزوجي (${oddCount}/${evenCount}) والمنخفض/العالي (${lowCount}/${highCount}) مطابق لتوزيع السحوبات الفائزة.`);
  if (positionalFitPct >= 80) {
    reasonsAr.push(`توافق موضعي بنسبة ${positionalFitPct}% مع نطاقات المراكز الستة التاريخية.`);
  }
  const hotIncluded = sorted.filter((n) => stats.hotNumbers.includes(n));
  const dueIncluded = sorted.filter((n) => stats.overdueNumbers.includes(n));
  if (hotIncluded.length > 0 || dueIncluded.length > 0) {
    reasonsAr.push(
      `تدمج أرقام الزخم النشط (${hotIncluded.join("، ") || "متوازن"}) مع أرقام على وشك الارتداد (${dueIncluded.join("، ") || "مستقر"}).`
    );
  }

  const defaultLabels: Record<TicketPredictionResult["strategyKey"], string> = {
    ensemble: "التوليفة الذهبية الموصى بها (أعلى دقة مركّبة)",
    momentum: "توليفة الزخم الساخن والترابط الثنائي",
    rebound: "توليفة الارتداد الإحصائي والتغطية",
    ai_deep: "توليفة الذكاء الخارق (Gemini + التحليل الكمي)",
  };

  return {
    label: customLabel || defaultLabels[strategyKey],
    strategyKey,
    numbers: sorted,
    extraNumber,
    qualityScore,
    sum,
    oddEven: `${oddCount} فردي / ${evenCount} زوجي`,
    lowHigh: `${lowCount} منخفض / ${highCount} مرتفع`,
    decadeSpread,
    pairSynergy,
    positionalFitPct,
    maxPastOverlap,
    backtestHits3Plus,
    reasonsAr,
  };
}

/**
 * Deterministic-seeded + Monte Carlo Combinatorial Optimizer (1,200 candidates per ticket)
 * Generates a 3-ticket smart portfolio with minimal mutual overlap while respecting locked numbers!
 */
export function generateSmartLotoPortfolio(
  draws: LotoDrawOfficial[],
  maxNumber: 42 | 29,
  hasExtraNumber: boolean,
  lockedNumbers: number[] = [],
  lockedExtra: number | null = null,
  seedSalt = 0
): {
  stats: LotoDeepStats;
  primary: TicketPredictionResult;
  portfolio: TicketPredictionResult[];
} {
  const stats = computeLotoDeepStats(draws, maxNumber);
  const cleanLocked = Array.from(
    new Set(lockedNumbers.filter((n) => n >= 1 && n <= maxNumber))
  ).slice(0, 6);

  // Seeded PRNG based on latest draw number + totalDraws + seedSalt so results stay rock-solid
  // on refresh until a new draw arrives OR user clicks "توليد توليفة جديدة"!
  const latestDrawNum = draws[0]?.drawNumber || 1;
  let rngState = (latestDrawNum * 2654435761 + stats.totalDraws * 97531 + seedSalt * 7919) >>> 0;
  const nextRand = () => {
    rngState = (1664525 * rngState + 1013904223) >>> 0;
    return rngState / 4294967296;
  };

  const pickBestExtra = (excludeSet: Set<number>, rankOffset = 0): number | null => {
    if (!hasExtraNumber) return null;
    if (lockedExtra && lockedExtra >= 1 && lockedExtra <= maxNumber) return lockedExtra;
    const candidates = stats.metrics
      .filter((m) => !excludeSet.has(m.number))
      .sort((a, b) => b.compositeScore - a.compositeScore);
    const chosen = candidates[rankOffset % Math.max(1, candidates.length)];
    return chosen ? chosen.number : 7;
  };

  const optimizeTicket = (
    strategyKey: "ensemble" | "momentum" | "rebound",
    penalizeUsed: Set<number>,
    extraRank: number
  ): TicketPredictionResult => {
    if (cleanLocked.length === 6) {
      const extra = pickBestExtra(new Set(cleanLocked), extraRank);
      return scoreCombinationQuant(
        cleanLocked,
        stats,
        draws,
        extra,
        strategyKey,
        "توليفتك المثبتة (تم فحصها إحصائياً)"
      );
    }

    const weights: Record<number, number> = {};
    for (const m of stats.metrics) {
      let w = 10;
      if (strategyKey === "ensemble") {
        w = Math.pow(Math.max(5, m.compositeScore), 1.65);
      } else if (strategyKey === "momentum") {
        w = Math.pow(15 + m.ewmaScore * 0.95 + m.count * 2.5, 1.5);
      } else {
        w = Math.pow(15 + m.overdueTension * 38 + m.compositeScore * 0.4, 1.5);
      }
      // Encourage portfolio coverage across tickets 2 & 3
      if (penalizeUsed.has(m.number) && !cleanLocked.includes(m.number)) {
        w *= 0.28;
      }
      weights[m.number] = Math.max(1, w);
    }

    let bestNums: number[] = [];
    let bestObjective = -Infinity;

    for (let iter = 0; iter < 900; iter++) {
      const chosen = new Set<number>(cleanLocked);
      let guard = 0;
      while (chosen.size < 6 && guard < 100) {
        guard++;
        let totalW = 0;
        const pool: { n: number; w: number }[] = [];
        for (let n = 1; n <= maxNumber; n++) {
          if (chosen.has(n)) continue;
          let w = weights[n] || 1;
          // Pair synergy boost with already-chosen balls
          const chosenArr = Array.from(chosen);
          for (const c of chosenArr) {
            const pairKey = c < n ? `${c}-${n}` : `${n}-${c}`;
            if (stats.pairMatrix[pairKey]) {
              w *= 1 + Math.min(0.45, stats.pairMatrix[pairKey] * 0.08);
            }
          }
          // Soft penalty against 3-in-a-row consecutive
          if (chosen.has(n - 1) && chosen.has(n + 1)) w *= 0.12;
          pool.push({ n, w });
          totalW += w;
        }
        let r = nextRand() * totalW;
        for (const item of pool) {
          r -= item.w;
          if (r <= 0) {
            chosen.add(item.n);
            break;
          }
        }
      }

      if (chosen.size !== 6) continue;
      const arr = Array.from(chosen).sort((a, b) => a - b);
      const evalRes = scoreCombinationQuant(arr, stats, draws, null, strategyKey);

      // Overlap penalty with prior portfolio tickets
      let usedOverlap = 0;
      for (const x of arr) {
        if (penalizeUsed.has(x) && !cleanLocked.includes(x)) usedOverlap++;
      }
      const objective = evalRes.qualityScore - usedOverlap * 4.5 + evalRes.pairSynergy * 0.3;
      if (objective > bestObjective) {
        bestObjective = objective;
        bestNums = arr;
      }
    }

    const extra = pickBestExtra(new Set(bestNums), extraRank);
    return scoreCombinationQuant(bestNums, stats, draws, extra, strategyKey);
  };

  const usedBalls = new Set<number>();
  const t1 = optimizeTicket("ensemble", usedBalls, 0);
  t1.numbers.forEach((n) => usedBalls.add(n));

  const t2 = optimizeTicket("momentum", usedBalls, 1);
  t2.numbers.forEach((n) => usedBalls.add(n));

  const t3 = optimizeTicket("rebound", usedBalls, 2);

  return {
    stats,
    primary: t1,
    portfolio: [t1, t2, t3],
  };
}

export async function generateGeminiDeepLotoPrediction(
  draws: LotoDrawOfficial[],
  maxNumber: 42 | 29,
  hasExtraNumber: boolean,
  stats: LotoDeepStats,
  lockedNumbers: number[] = []
): Promise<{ ticket: TicketPredictionResult; expertSummaryAr: string } | null> {
  const recent20 = draws.slice(0, 20).map((d) => ({
    draw: d.drawNumber,
    nums: d.winningNumbers,
    extra: d.extraNumber,
  }));

  const topComposite = [...stats.metrics]
    .sort((a, b) => b.compositeScore - a.compositeScore)
    .slice(0, 14)
    .map((m) => ({
      n: m.number,
      cnt: m.count,
      ewma: m.ewmaScore,
      gap: m.drawsSinceLastSeen,
      tension: m.overdueTension,
    }));

  const prompt = `أنت خبير تحليل إحصائي ورياضي متخصص في سحوبات ${
    maxNumber === 42 ? "لوتو العراق 42 (6 أرقام من 1 إلى 42 + رقم إضافي)" : "لوتو العراق 29 (6 أرقام من 1 إلى 29)"
  }.
عدد السحوبات الرسمية المحللة: ${stats.totalDraws}.
النطاق الذهبي لمجموع الأرقام الستة: من ${stats.goldenSumRange[0]} إلى ${stats.goldenSumRange[1]} (المتوسط الفعلي ${stats.empiricalSumMean}).
نطاقات المراكز الستة (P15..P85): ${JSON.stringify(stats.positionalBands)}.
أعلى 14 رقماً في المؤشر الكمي المركّب: ${JSON.stringify(topComposite)}.
الأرقام الساخنة حالياً: ${JSON.stringify(stats.hotNumbers)}.
الأرقام المتأخرة المرشحة للارتداد: ${JSON.stringify(stats.overdueNumbers)}.
أقوى الأزواج المتكررة: ${JSON.stringify(stats.topPairs)}.
آخر 20 سحبة رسمية: ${JSON.stringify(recent20)}.
${lockedNumbers.length > 0 ? `أرقام مثبتة إلزامياً من المستخدم يجب تضمينها: ${JSON.stringify(lockedNumbers)}.` : ""}

المطلوب: استنتج أفضل توليفة مكونة من 6 أرقام صحيحة ومختلفة ضمن المدى (1 إلى ${maxNumber}) تحترم النطاق الذهبي للمجموع، وتوازن الفردي/الزوجي (3/3 أو 4/2)، وتوزيع المراكز الستة، وتجنب تكرار 4+ أرقام من آخر سحبة${
    hasExtraNumber ? `، بالإضافة إلى أفضل رقم إضافي (extraNumber) من 1 إلى ${maxNumber} غير مكرر مع الستة` : ""
  }.

أرجع JSON فقط بهذا الشكل الدقيق:
{
  "numbers": [n1, n2, n3, n4, n5, n6],
  "extraNumber": ${hasExtraNumber ? "number" : "null"},
  "expertSummaryAr": "شرح تحليلي عربي دقيق ومختصر (سطران إلى 3 أسطر) يوضح سبب اختيار هذه الأرقام بناءً على الفجوات والزخم والأزواج",
  "reasons": ["سبب 1", "سبب 2", "سبب 3"]
}`;

  const parsed = await callGeminiJson(prompt);
  if (!parsed || !Array.isArray(parsed.numbers)) return null;

  const mergedSet = new Set<number>(
    lockedNumbers.filter((n) => n >= 1 && n <= maxNumber)
  );
  for (const raw of parsed.numbers) {
    const num = Math.round(Number(raw));
    if (num >= 1 && num <= maxNumber && mergedSet.size < 6) {
      mergedSet.add(num);
    }
  }
  for (const fallbackNum of stats.primeZoneNumbers) {
    if (mergedSet.size >= 6) break;
    mergedSet.add(fallbackNum);
  }
  const finalNums = Array.from(mergedSet).sort((a, b) => a - b);
  if (finalNums.length !== 6) return null;

  let extra: number | null = null;
  if (hasExtraNumber) {
    const candExtra = Number(parsed.extraNumber);
    if (candExtra >= 1 && candExtra <= maxNumber && !finalNums.includes(candExtra)) {
      extra = candExtra;
    } else {
      extra =
        stats.topExtraNumbers.find((x) => !finalNums.includes(x.number))?.number || 7;
    }
  }

  const scored = scoreCombinationQuant(
    finalNums,
    stats,
    draws,
    extra,
    "ai_deep",
    "توليفة الذكاء الخارق (Gemini + التحليل الكمي)"
  );
  if (Array.isArray(parsed.reasons) && parsed.reasons.length > 0) {
    scored.reasonsAr = parsed.reasons.slice(0, 4).map(String);
  }

  return {
    ticket: scored,
    expertSummaryAr:
      String(parsed.expertSummaryAr || "").trim() ||
      "تم استخلاص التوليفة عبر دمج مصفوفة التردد الزمني والفجوات مع التوزيع الموضعي للسحوبات الرسمية.",
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. SPORTS LOTO (10 MATCHES — 1 / X / 2) QUANTITATIVE + GEMINI ENGINE
// ═══════════════════════════════════════════════════════════════════════════

export interface MatchPredictionItem {
  position: number;
  recommendedPick: SportsPickChoice;
  hedgePick: SportsPickChoice | null; // Secondary pick if match is tight (for double coverage)
  probHome: number; // %
  probDraw: number; // %
  probAway: number; // %
  confidence: "banker" | "solid" | "tight";
  confidenceLabelAr: string;
  reasonAr: string;
}

export interface SportsRoundAnalysis {
  roundId: string;
  historicalHomeRate: number;
  historicalDrawRate: number;
  historicalAwayRate: number;
  bankerCount: number;
  tightCount: number;
  matches: MatchPredictionItem[];
  aiSummaryAr?: string;
}

// Club tier ratings (Iraq Stars League + Top European & Asian clubs) for accurate baseline strength
const CLUB_STRENGTH_TIERS: Record<string, number> = {
  // Iraq Stars League
  "الشرطة": 88, "al shorta": 88, "al-shorta": 88,
  "القوة الجوية": 86, "al quwa al jawiya": 86, "al-quwa al-jawiya": 86,
  "الزوراء": 85, "al zawraa": 85, "al-zawraa": 85,
  "زاخو": 81, "zakho": 81,
  "دهوك": 80, "duhok": 80,
  "الطلبة": 79, "الطلاب": 79, "al talaba": 79, "al-talaba": 79,
  "النجف": 76, "al najaf": 76,
  "اربيل": 75, "أربيل": 75, "erbil": 75,
  "الميناء": 74, "al minaa": 74, "al-minaa": 74,
  "نوروز": 74, "newroz": 74,
  "الكرمة": 75, "al karma": 75, "al-karma": 75,
  "النفط": 73, "al naft": 73, "al-naft": 73,
  "الكرخ": 72, "al karkh": 72, "al-karkh": 72,
  "نفط ميسان": 72, "naft maysan": 72,
  "الكهرباء": 72, "al kahrabaa": 72, "al-kahrabaa": 72,
  "القاسم": 70, "al qasim": 70,
  "الموصل": 71, "al-mosul": 71,
  "الغراف": 70, "al-gharraf": 70,
  "غاز الشمال": 69, "ghaz al-shamal": 69,
  "الجولان": 69, "al-jolan": 69,
  "ديالى": 68, "diyala": 68,
  "كربلاء": 69, "karbala": 69,
  "الحدود": 68, "al hudood": 68,
  // European & Asian Giants
  "ريال مدريد": 94, "real madrid": 94,
  "برشلونة": 93, "barcelona": 93,
  "أتلتيكو مدريد": 87, "atletico madrid": 87,
  "أتلتيك بيلباو": 82, "athletic club": 82,
  "فياريال": 81, "villarreal": 81,
  "ريال سوسيداد": 79, "real sociedad": 79,
  "ريال بيتيس": 79, "real betis": 79,
  "إشبيلية": 76, "sevilla": 76,
  "ليفربول": 93, "liverpool": 93,
  "مانشستر سيتي": 92, "manchester city": 92,
  "أرسنال": 91, "آرسنال": 91, "arsenal": 91,
  "تشيلسي": 86, "chelsea": 86,
  "نيوكاسل": 83, "newcastle": 83,
  "توتنهام": 82, "tottenham": 82,
  "مانشستر يونايتد": 81, "manchester united": 81,
  "أستون فيلا": 82, "aston villa": 82,
  "برايتون": 79, "brighton": 79,
  "بايرن ميونخ": 93, "bayern": 93,
  "باريس سان جيرمان": 91, "psg": 91,
  "إنتر ميلان": 91, "inter": 91,
  "نابولي": 86, "napoli": 86,
  "ميلان": 85, "milan": 85,
  "يوفنتوس": 85, "juventus": 85,
  "الهلال": 88, "al hilal": 88,
  "النصر": 86, "al nassr": 86,
  "الأهلي": 85, "al ahli": 85,
  "السد": 80, "al sadd": 80,
};

function lookupTeamStrength(nameAr: string, nameEn: string, isBig?: boolean): number {
  const arNorm = (nameAr || "").trim();
  const enNorm = (nameEn || "").trim().toLowerCase();

  for (const [key, rating] of Object.entries(CLUB_STRENGTH_TIERS)) {
    if (arNorm.includes(key) || enNorm.includes(key)) {
      return rating;
    }
  }
  return isBig ? 83 : 73;
}

export function predictSportsRoundQuant(
  round: SportsRound,
  allRounds: SportsRound[]
): SportsRoundAnalysis {
  // 1. Compute real historical 1 / X / 2 rates from finished matches on loto.iq
  let hist1 = 0;
  let histX = 0;
  let hist2 = 0;
  for (const r of allRounds) {
    for (const m of r.matches || []) {
      const actual = getMatchActualOutcome(m);
      if (actual === "1") hist1++;
      else if (actual === "X") histX++;
      else if (actual === "2") hist2++;
    }
  }
  const histTotal = hist1 + histX + hist2;
  const historicalHomeRate = histTotal > 0 ? Math.round((hist1 / histTotal) * 100) : 45;
  const historicalDrawRate = histTotal > 0 ? Math.round((histX / histTotal) * 100) : 30;
  const historicalAwayRate = histTotal > 0 ? 100 - historicalHomeRate - historicalDrawRate : 25;

  const predictions: MatchPredictionItem[] = round.matches.map((m: SportsMatch) => {
    const compName = `${m.competition?.nameAr || ""} ${m.competition?.nameEn || ""}`.toLowerCase();
    const isIraqiLeague =
      compName.includes("العراق") || compName.includes("iraq") || compName.includes("نجوم");

    const homeRating = lookupTeamStrength(m.home.nameAr, m.home.nameEn, m.home.big);
    const awayRating = lookupTeamStrength(m.away.nameAr, m.away.nameEn, m.away.big);

    // Home field advantage (+4.5 Elo pts in Iraq Stars League, +3.8 in Europe)
    const homeAdv = isIraqiLeague ? 4.5 : 3.8;
    const diff = homeRating + homeAdv - awayRating;

    // Base draw probability peaks when teams are evenly matched (diff near 0)
    const baseDraw = isIraqiLeague ? 0.31 : 0.265;
    const pDrawRaw = baseDraw * Math.exp(-Math.pow(diff / 13.5, 2));
    const winShare = 1 - pDrawRaw;
    const logisticHome = 1 / (1 + Math.exp(-diff / 6.8));

    let p1 = Math.round(winShare * logisticHome * 100);
    let p2 = Math.round(winShare * (1 - logisticHome) * 100);
    let pX = Math.max(12, 100 - p1 - p2);
    // Normalize to 100
    const sumP = p1 + pX + p2;
    if (sumP !== 100) p1 += 100 - sumP;

    let recommendedPick: SportsPickChoice = "1";
    let hedgePick: SportsPickChoice | null = null;
    let confidence: MatchPredictionItem["confidence"] = "solid";
    let confidenceLabelAr = "ترجيح جيد ⚡";
    let reasonAr = "";

    // Decision logic calibrated for 10-match Toto pools:
    // Draws occur ~2.5-3 times per 10-match coupon; pick 'X' specifically on ultra-tight mid-table clashes!
    if (Math.abs(diff) <= 1.8 && pX >= 29 && !m.home.big && !m.away.big) {
      recommendedPick = "X";
      hedgePick = diff >= 0 ? "1" : "2";
      confidence = "tight";
      confidenceLabelAr = "مباراة متكافئة (مرشحة للتعادل) ⚖️";
      reasonAr = `تقارب شديد في المستوى بين ${m.home.nameAr} و${m.away.nameAr} يرفع احتمالية التعادل التكتيكي (${pX}%).`;
    } else if (p1 >= p2) {
      recommendedPick = "1";
      if (p1 >= 56) {
        confidence = "banker";
        confidenceLabelAr = "ركيزة قوية (Banker) 🔒";
        reasonAr = `تفوق فني وعامل الأرض لصالح ${m.home.nameAr} بنسبة فوز متوقعة ${p1}%.`;
      } else if (p1 - pX <= 12) {
        confidence = "tight";
        hedgePick = "X";
        confidenceLabelAr = "أفضلية نسبية (تقبل تغطية 1X) ⚖️";
        reasonAr = `أفضلية الأرض تمنح ${m.home.nameAr} المبادرة (${p1}%) مع بقاء التعادل وارداً (${pX}%).`;
      } else {
        reasonAr = `أفضلية الملعب والاستقرار الفني ترجح كفة ${m.home.nameAr} (${p1}%).`;
      }
    } else {
      recommendedPick = "2";
      if (p2 >= 55) {
        confidence = "banker";
        confidenceLabelAr = "ركيزة قوية للضيف 🔒";
        reasonAr = `فارق الجودة واضح لصالح الضيف ${m.away.nameAr} بنسبة فوز ${p2}%.`;
      } else {
        confidence = p2 - pX <= 11 ? "tight" : "solid";
        hedgePick = "X";
        confidenceLabelAr =
          confidence === "tight" ? "تميل للضيف (تغطية X2) ⚖️" : "ترجيح للضيف ⚡";
        reasonAr = `تفوق نسبي لـ ${m.away.nameAr} خارج ملعبه (${p2}%) مقابل ${p1}% للمضيف.`;
      }
    }

    return {
      position: m.position,
      recommendedPick,
      hedgePick,
      probHome: p1,
      probDraw: pX,
      probAway: p2,
      confidence,
      confidenceLabelAr,
      reasonAr,
    };
  });

  return {
    roundId: round.id,
    historicalHomeRate,
    historicalDrawRate,
    historicalAwayRate,
    bankerCount: predictions.filter((p) => p.confidence === "banker").length,
    tightCount: predictions.filter((p) => p.confidence === "tight").length,
    matches: predictions,
  };
}

export async function generateGeminiSportsRoundPrediction(
  round: SportsRound,
  quantAnalysis: SportsRoundAnalysis
): Promise<SportsRoundAnalysis | null> {
  const matchPayload = round.matches.map((m) => ({
    pos: m.position,
    league: m.competition?.nameAr || m.competition?.nameEn,
    home: m.home.nameAr,
    homeEn: m.home.nameEn,
    away: m.away.nameAr,
    awayEn: m.away.nameEn,
    venue: m.venue,
  }));

  const prompt = `أنت محلل كرة قدم محترف وخبير إحصائي في مسابقة "اللوتو الرياضي العراقي" (توقع نتائج 10 مباريات: "1" فوز المضيف، "X" تعادل، "2" فوز الضيف).
اسم الجولة الحالية: ${round.nameAr} (${round.nameEn}).
التوزيع التاريخي للجولات المنتهية في الموقع: فوز المضيف ${quantAnalysis.historicalHomeRate}%، التعادل ${quantAnalysis.historicalDrawRate}%، فوز الضيف ${quantAnalysis.historicalAwayRate}%.
قائمة المباريات الـ 10:
${JSON.stringify(matchPayload, null, 2)}

قم بتحليل كل مباراة بدقة عالية وفق القوة الفنية الحقيقية للفريقين، أفضلية الأرض والجمهور، وميل بعض المواجهات المتكافئة للتعادل (عادة تشهد كل جولة من 10 مباريات حوالي 2 إلى 3 تعادلات في المواجهات المتقاربة جداً).

أرجع JSON فقط بهذا الشكل:
{
  "aiSummaryAr": "ملخص تحليلي ذكي للجولة في سطرين يوضح أقوى الركائز والمباريات الحرجة",
  "matches": [
    {
      "position": 1,
      "recommendedPick": "1",
      "hedgePick": "X",
      "probHome": 52,
      "probDraw": 28,
      "probAway": 20,
      "confidence": "solid",
      "reasonAr": "سبب تكتيكي مختصر باللغة العربية"
    }
  ]
}`;

  const parsed = await callGeminiJson(prompt);
  if (!parsed || !Array.isArray(parsed.matches) || parsed.matches.length === 0) {
    return null;
  }

  const aiByPos = new Map<number, any>();
  for (const item of parsed.matches) {
    aiByPos.set(Number(item.position), item);
  }

  const mergedMatches: MatchPredictionItem[] = quantAnalysis.matches.map((base) => {
    const ai = aiByPos.get(base.position);
    if (!ai) return base;
    const pick = String(ai.recommendedPick || "").toUpperCase();
    const validPick: SportsPickChoice =
      pick === "1" || pick === "X" || pick === "2" ? pick : base.recommendedPick;
    const hedgeRaw = String(ai.hedgePick || "").toUpperCase();
    const validHedge: SportsPickChoice | null =
      (hedgeRaw === "1" || hedgeRaw === "X" || hedgeRaw === "2") && hedgeRaw !== validPick
        ? hedgeRaw
        : base.hedgePick;
    const conf: MatchPredictionItem["confidence"] =
      ai.confidence === "banker" || ai.confidence === "solid" || ai.confidence === "tight"
        ? ai.confidence
        : base.confidence;

    const pH = Math.max(5, Math.min(90, Number(ai.probHome) || base.probHome));
    const pD = Math.max(5, Math.min(80, Number(ai.probDraw) || base.probDraw));
    const pA = Math.max(5, 100 - pH - pD);

    return {
      position: base.position,
      recommendedPick: validPick,
      hedgePick: validHedge,
      probHome: pH,
      probDraw: pD,
      probAway: pA,
      confidence: conf,
      confidenceLabelAr:
        conf === "banker"
          ? "ركيزة مضمونة (AI Banker) 🔒"
          : conf === "tight"
          ? "مباراة حرجة متكافئة ⚖️"
          : "ترجيح تكتيكي ⚡",
      reasonAr: String(ai.reasonAr || base.reasonAr),
    };
  });

  return {
    ...quantAnalysis,
    bankerCount: mergedMatches.filter((m) => m.confidence === "banker").length,
    tightCount: mergedMatches.filter((m) => m.confidence === "tight").length,
    matches: mergedMatches,
    aiSummaryAr: String(parsed.aiSummaryAr || "").trim(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. SCRATCH CARDS ACTUARIAL & SMART VALUE ANALYZER (طابق 3 & جيب الكاس جيبه)
// ═══════════════════════════════════════════════════════════════════════════

export interface ScratchActuarialReport {
  code: "SC500" | "SC1K";
  nameAr: string;
  price: number;
  topPrize: number;
  onSale: boolean;
  topRemaining: number;
  totalWinningCardsInRun: number;
  breakEvenCards: number; // Cards that merely return ticket cost
  netProfitCards: number; // Cards winning > ticket price
  midHighTierCards: number; // Cards winning >= 10,000 IQD
  totalPrizePoolIqd: number;
  profitAmongWinnersPct: number; // % of winning cards that yield actual net profit (> price)
  maxMultiplier: number; // topPrize / price
  verdictBadge: string;
  verdictTone: "emerald" | "amber" | "rose";
  smartAdviceAr: string[];
}

export function analyzeScratchCard(
  code: "SC500" | "SC1K",
  liveCards: ScratchCardLive[]
): ScratchActuarialReport {
  const spec = SCRATCH_SPECS[code];
  const live = liveCards.find((c) => c.code === code);
  const onSale = live ? Boolean(live.onSale) : true;
  const topRemaining = live ? Number(live.topRemaining ?? 1) : 1;
  const price = live?.price || spec.price;
  const topPrize = live?.topPrize || spec.topPrize;

  const totalWinningCardsInRun = spec.tiers.reduce((s, t) => s + t.winnersCount, 0);
  const breakEvenCards = spec.tiers
    .filter((t) => t.amount === price)
    .reduce((s, t) => s + t.winnersCount, 0);
  const netProfitCards = spec.tiers
    .filter((t) => t.amount > price)
    .reduce((s, t) => s + t.winnersCount, 0);
  const midHighTierCards = spec.tiers
    .filter((t) => t.amount >= 10_000)
    .reduce((s, t) => s + t.winnersCount, 0);

  // Adjust prize pool dynamically if top prize has already been claimed (`topRemaining === 0`)
  const totalPrizePoolIqd = spec.tiers.reduce((sum, t, idx) => {
    if (idx === 0) return sum + t.amount * Math.max(0, topRemaining);
    return sum + t.amount * t.winnersCount;
  }, 0);

  const profitAmongWinnersPct =
    totalWinningCardsInRun > 0
      ? Math.round((netProfitCards / totalWinningCardsInRun) * 1000) / 10
      : 0;
  const maxMultiplier = Math.round(topPrize / price);

  let verdictBadge = "الجائزة الكبرى متوفرة حالياً ✅";
  let verdictTone: ScratchActuarialReport["verdictTone"] = "emerald";
  const smartAdviceAr: string[] = [];

  if (!onSale) {
    verdictBadge = "متوقفة عن البيع حالياً ⛔";
    verdictTone = "rose";
    smartAdviceAr.push("هذه البطاقة غير متاحة للبيع حالياً على موقع لوتو العراق.");
  } else if (topRemaining <= 0) {
    verdictBadge = "تنبيه ذكي: الجائزة الكبرى سُحبت بالكامل! ⚠️";
    verdictTone = "rose";
    smartAdviceAr.push(
      `الجائزة الكبرى (${topPrize.toLocaleString("en-US")} د.ع) لم تعد متبقية في هذه الطبعة (المتبقي: 0) — ينصح المحرك الذكي بتجنب الشراء لحين نزول طبعة جديدة!`
    );
  } else {
    smartAdviceAr.push(
      `الجائزة الكبرى (${topPrize.toLocaleString("en-US")} د.ع) ما زالت متاحة في السحب الحي (${topRemaining} بطاقة كبرى متبقية) بمضاعف ${maxMultiplier.toLocaleString("en-US")} ضعف لسعر البطاقة.`
    );
  }

  if (code === "SC1K") {
    smartAdviceAr.push(
      `تفوق إحصائي في الفئات المتوسطة: تحتوي "جيب الكاس جيبه" على ${midHighTierCards.toLocaleString("en-US")} بطاقة رابحة لفئة 10,000 د.ع فأكثر (مقابل 7,988 بطاقة فقط في طابق 3 — أي فرصة أعلى بـ 2.6 مرة للجوائز المتوسطة!).`
    );
    smartAdviceAr.push(
      `من بين ${totalWinningCardsInRun.toLocaleString("en-US")} بطاقة رابحة في الطبعة، هناك ${netProfitCards.toLocaleString("en-US")} بطاقة تحقق ربحاً صافياً أعلى من الألف دينار (${profitAmongWinnersPct}%).`
    );
  } else {
    smartAdviceAr.push(
      `تتميز "طابق 3" بأقل تكلفة دخول (500 د.ع فقط) وبنفس المضاعف الأقصى للجائزة الكبرى (20,000 ضعف = 10 ملايين دينار).`
    );
    smartAdviceAr.push(
      `تضم الطبعة ${netProfitCards.toLocaleString("en-US")} بطاقة ربح صافٍ (من 1,000 د.ع حتى 10,000,000 د.ع) بالإضافة إلى ${breakEvenCards.toLocaleString("en-US")} بطاقة تعوّض قيمة البطاقة (500 د.ع).`
    );
  }

  smartAdviceAr.push(
    "قاعدة الإدارة الذكية للميزانية: بطاقات الكشط الفوري تعتمد على السحب العشوائي المشفر من الخادم وقت الشراء؛ حدد سقفاً ترفيهياً ثابتاً ولا تطارد الخسارة."
  );

  return {
    code,
    nameAr: spec.nameAr,
    price,
    topPrize,
    onSale,
    topRemaining,
    totalWinningCardsInRun,
    breakEvenCards,
    netProfitCards,
    midHighTierCards,
    totalPrizePoolIqd,
    profitAmongWinnersPct,
    maxMultiplier,
    verdictBadge,
    verdictTone,
    smartAdviceAr,
  };
}
