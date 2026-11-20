/**
 * محرك التنبؤ والتحذيرات الذكية لمصاريف البيت — دوال صافية بدون واجهة ولا قاعدة بيانات.
 *
 * يحسب:
 *   • توقع نهاية الدورة: كم راح تصرف، كم يبقى، ومتى يخلص الراتب بهذا المعدل، والحد اليومي الآمن.
 *   • مقارنة كل قسم بمعدلك في الدورات السابقة.
 *   • المهم مقابل الكماليات والتبذير، وشنو تبتعد عنه وشنو تحافظ عليه.
 *   • المشتريات الصغيرة المتكررة، ارتفاع الأسعار، والمواد اللي متوقع تحتاجها قريباً.
 *   • تحذيرات لحظية أثناء إدخال مصروف جديد.
 *
 * التنوع: النصائح تتبدل يومياً (وبزر «نصيحة أخرى») بدل تكرار نفس الرسالة كل مرة.
 */

import { classifyItemNature, normalizeArabicText } from "./productCategories";

// ───────────────────────── الأنواع ─────────────────────────

export interface InsightItem {
  name?: string;
  price?: number;
  quantity?: number;
  category?: string;
  place?: string;
}

export interface InsightExpense {
  id: string;
  name?: string;
  category?: string;
  amount: number;
  date: string;
  items?: InsightItem[];
}

export type InsightLevel = "danger" | "warning" | "tip" | "good";

export interface Insight {
  id: string;
  level: InsightLevel;
  icon: string;
  title: string;
  text: string;
  /** للترتيب داخل نفس المستوى */
  score: number;
}

export interface NatureGroup {
  label: string;
  amount: number;
  count: number;
}

export interface PriceWatchItem {
  name: string;
  /** آخر سعر قطعة */
  last: number;
  lastPlace: string;
  lastDate: string;
  /** السعر الذي قبله */
  prev: number;
  prevPlace: string;
  /** أرخص سعر بآخر 6 أشهر ومكانه */
  cheapest: number;
  cheapestPlace: string;
  /** نسبة الصعود عن السعر السابق */
  pct: number;
}

export interface HomeInsights {
  cycle: {
    spent: number;
    income: number;
    obligations: number;
    essential: number;
    optional: number;
    waste: number;
    daysElapsed: number;
    daysTotal: number;
    daysLeft: number;
    dailyAvg: number;
    projectedSpend: number;
    projectedBalance: number;
    /** كم تگدر تصرف يومياً لحد نهاية الدورة بدون عجز */
    safeDailyLimit: number;
    /** تاريخ نفاد الراتب المتوقع (YYYY-MM-DD) إن كان قبل نهاية الدورة */
    runOutDate: string | null;
    /** هل في دورات سابقة كافية للمقارنة */
    hasHistory: boolean;
  };
  /** تحذيرات مهمة (خطر + انتباه) — تُعرض كلها */
  alerts: Insight[];
  /** نصائح وتنبؤات متنوعة — مختارة ومدوّرة */
  tips: Insight[];
  /** شنو تبتعد عنه: أكبر بنود الكماليات والتبذير */
  avoid: NatureGroup[];
  /** شنو تحافظ عليه: أكبر البنود الأساسية */
  keep: NatureGroup[];
  /** مواد اشتريتها مؤخراً بسعر أعلى من قبل أو من محل أغلى */
  priceWatch: PriceWatchItem[];
}

export interface InsightContext {
  expenses: InsightExpense[];
  cycleStart: Date;
  cycleEnd: Date;
  today?: Date;
  /** دخل الدورة */
  income: number;
  /** فواتير وأقساط غير مدفوعة بعد بهذه الدورة */
  obligations?: number;
  budgetLimits?: Record<string, number>;
  /** رقم التدوير (يتغير يومياً أو بزر «نصيحة أخرى») */
  seed?: number;
}

export interface DraftExpense {
  name?: string;
  category?: string;
  amount: number;
  date?: string;
  items?: InsightItem[];
  /** عند التعديل: معرّف المصروف حتى لا يُحسب مرتين */
  excludeId?: string;
}

// ───────────────────────── أدوات ─────────────────────────

const DAY = 86400000;
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const parseDay = (s: string) => {
  const [y, m, d] = String(s || "").split("T")[0].split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
};
const daysBetween = (a: Date, b: Date) => Math.round((dayStart(b).getTime() - dayStart(a).getTime()) / DAY);
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const median = (arr: number[]) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
export const daysWord = (n: number) => (n === 1 ? "يوم واحد" : n === 2 ? "يومين" : n <= 10 ? `${n} أيام` : `${n} يوماً`);
const timesWord = (n: number) => (n === 1 ? "مرة" : n === 2 ? "مرتين" : n <= 10 ? `${n} مرات` : `${n} مرة`);

type Nature = "essential" | "optional" | "waste";

interface Line {
  expenseId: string;
  key: string;           // الاسم بعد التوحيد
  name: string;
  category: string;
  amount: number;
  unitPrice: number;
  date: string;          // YYYY-MM-DD
  nature: Nature;
  subTitle: string;      // عنوان المجموعة (حلويات، مشروبات...)
  /** سطر من مواد فاتورة (له سعر قطعة حقيقي) لا مصروف إجمالي */
  fromItem: boolean;
  /** المحل */
  place: string;
}

const natureCache = new Map<string, { nature: Nature; subTitle: string }>();
function natureOf(name: string, category: string): { nature: Nature; subTitle: string } {
  const k = `${name}|${category}`;
  const hit = natureCache.get(k);
  if (hit) return hit;
  const c = classifyItemNature(name, category);
  const nature: Nature = c.priority === "تبذير" ? "waste" : c.priority === "مال داعي" ? "optional" : "essential";
  const out = { nature, subTitle: c.subCategoryTitle || category || "عام" };
  if (natureCache.size > 5000) natureCache.clear();
  natureCache.set(k, out);
  return out;
}

/** تفكيك المصاريف إلى سطور (مواد الفاتورة، أو المصروف نفسه إن لم تكن مفصّلة) */
function toLines(expenses: InsightExpense[]): Line[] {
  const lines: Line[] = [];
  for (const e of expenses) {
    const date = String(e.date || "").split("T")[0];
    if (!date) continue;
    const items = (e.items || []).filter((it) => it && (it.name || "").trim() && Number(it.price) > 0);
    if (items.length > 0) {
      for (const it of items) {
        const name = String(it.name).trim();
        const category = it.category || e.category || "عام";
        const amount = Number(it.price) || 0;
        const qty = Number(it.quantity) > 0 ? Number(it.quantity) : 1;
        const n = natureOf(name, category);
        lines.push({ expenseId: e.id, key: normalizeArabicText(name), name, category, amount, unitPrice: amount / qty, date, fromItem: true, place: String(it.place || e.name || "").trim(), ...n });
      }
    } else if (Number(e.amount) > 0) {
      const name = String(e.name || e.category || "مصروف").trim();
      const category = e.category || "عام";
      const n = natureOf(name, category);
      lines.push({ expenseId: e.id, key: normalizeArabicText(name), name, category, amount: Number(e.amount), unitPrice: Number(e.amount), date, fromItem: false, place: String(e.name || "").trim(), ...n });
    }
  }
  return lines;
}

/** نوافذ الدورات السابقة بنفس طول الدورة الحالية */
function previousWindows(start: Date, end: Date, count: number) {
  const len = daysBetween(start, end) + 1;
  const out: { from: string; to: string }[] = [];
  for (let k = 1; k <= count; k++) {
    const to = new Date(start.getTime() - (k - 1) * len * DAY - DAY);
    const from = new Date(to.getTime() - (len - 1) * DAY);
    out.push({ from: ymd(from), to: ymd(to) });
  }
  return out;
}

/** تدوير حتمي بحسب البذرة (حتى تتنوع النصائح يومياً بدون عشوائية متقلبة) */
function rotate<T>(arr: T[], seed: number): T[] {
  if (arr.length < 2) return arr;
  const shift = ((seed % arr.length) + arr.length) % arr.length;
  return [...arr.slice(shift), ...arr.slice(0, shift)];
}

export function dailySeed(d = new Date()): number {
  return Math.floor(dayStart(d).getTime() / DAY);
}

// ───────────────────────── تاريخ الأسعار والتكرار ─────────────────────────

interface ItemHistory {
  name: string;
  dates: string[];
  unitPrices: number[];
  nature: Nature;
}

function buildItemHistory(lines: Line[]): Map<string, ItemHistory> {
  const map = new Map<string, ItemHistory>();
  const sorted = [...lines].sort((a, b) => a.date.localeCompare(b.date));
  for (const l of sorted) {
    // مصروف إجمالي (مطعم، محطة...) ليس له «سعر قطعة» ثابت ⇒ لا يدخل تتبع الأسعار والتكرار
    if (!l.fromItem || !l.key || l.key.length < 2) continue;
    let h = map.get(l.key);
    if (!h) {
      h = { name: l.name, dates: [], unitPrices: [], nature: l.nature };
      map.set(l.key, h);
    }
    // نفس المادة بنفس اليوم = عملية شراء واحدة
    if (h.dates[h.dates.length - 1] !== l.date) h.dates.push(l.date);
    h.unitPrices.push(l.unitPrice);
  }
  return map;
}

// ───────────────────────── تحليل الدورة (الواجهة الرئيسية) ─────────────────────────

export function buildHomeInsights(ctx: InsightContext): HomeInsights {
  const today = dayStart(ctx.today || new Date());
  const start = dayStart(ctx.cycleStart);
  const end = dayStart(ctx.cycleEnd);
  const todayStr = ymd(today);
  const startStr = ymd(start);
  const endStr = ymd(end);
  const seed = ctx.seed ?? dailySeed(today);
  const obligations = Math.max(0, ctx.obligations || 0);
  const income = Math.max(0, ctx.income || 0);

  const allLines = toLines(ctx.expenses);
  const inCycle = allLines.filter((l) => l.date >= startStr && l.date <= endStr);
  const isCurrentCycle = todayStr >= startStr && todayStr <= endStr;

  const daysTotal = Math.max(1, daysBetween(start, end) + 1);
  const daysElapsed = isCurrentCycle ? Math.max(1, daysBetween(start, today) + 1) : daysTotal;
  const daysLeft = isCurrentCycle ? Math.max(0, daysTotal - daysElapsed) : 0;

  const sum = (ls: Line[]) => ls.reduce((s, l) => s + l.amount, 0);
  const spent = sum(inCycle);
  const essential = sum(inCycle.filter((l) => l.nature === "essential"));
  const optional = sum(inCycle.filter((l) => l.nature === "optional"));
  const waste = sum(inCycle.filter((l) => l.nature === "waste"));

  // الدورات السابقة
  const windows = previousWindows(start, end, 3);
  const prevTotals = windows.map((w) => sum(allLines.filter((l) => l.date >= w.from && l.date <= w.to)));
  const validPrev = prevTotals.filter((t) => t > 0);
  const hasHistory = validPrev.length >= 1;
  const histAvgTotal = hasHistory ? validPrev.reduce((a, b) => a + b, 0) / validPrev.length : 0;

  // المعدل اليومي: نستبعد المصاريف الضخمة لمرة وحدة حتى لا تشوّه التوقع
  const perExpense = new Map<string, number>();
  for (const l of inCycle) perExpense.set(l.expenseId, (perExpense.get(l.expenseId) || 0) + l.amount);
  const expAmounts = Array.from(perExpense.values());
  const bigThreshold = Math.max(median(expAmounts) * 6, income > 0 ? income * 0.15 : 0);
  const oneOffs = expAmounts.filter((a) => bigThreshold > 0 && a >= bigThreshold).reduce((a, b) => a + b, 0);
  const routineDaily = (spent - oneOffs) / daysElapsed;
  const histDaily = hasHistory ? histAvgTotal / daysTotal : 0;
  // مزج معدل هذه الدورة مع معدلك السابق (أدق ببداية الدورة)
  const weightNow = Math.min(1, daysElapsed / 10);
  const blendedDaily = hasHistory ? routineDaily * weightNow + histDaily * (1 - weightNow) : routineDaily;
  const projectedSpend = Math.round(spent + blendedDaily * daysLeft);
  const projectedBalance = Math.round(income - projectedSpend - obligations);
  const available = income - spent - obligations;
  const safeDailyLimit = daysLeft > 0 ? Math.max(0, Math.floor(available / daysLeft)) : 0;

  let runOutDate: string | null = null;
  if (income > 0 && isCurrentCycle && blendedDaily > 0) {
    if (available <= 0) runOutDate = todayStr;
    else {
      const d = Math.floor(available / blendedDaily);
      if (d < daysLeft) runOutDate = ymd(new Date(today.getTime() + d * DAY));
    }
  }

  const alerts: Insight[] = [];
  const tips: Insight[] = [];
  const push = (i: Insight) => (i.level === "danger" || i.level === "warning" ? alerts : tips).push(i);

  // 1) توقع الراتب
  if (income > 0 && isCurrentCycle) {
    if (available <= 0) {
      push({ id: "budget-over", level: "danger", icon: "🚨", score: 100,
        title: "صرفت أكثر من دخل هذه الدورة",
        text: `المصروف ${fmt(spent)}${obligations ? ` + التزامات غير مدفوعة ${fmt(obligations)}` : ""} مقابل دخل ${fmt(income)} د.ع. أي صرف إضافي يصير عجز أو دين.` });
    } else if (runOutDate) {
      const d = parseDay(runOutDate)!;
      push({ id: "run-out", level: "danger", icon: "⏳", score: 95,
        title: `بهذا المعدل الفلوس تخلص يوم ${d.getDate()}/${d.getMonth() + 1}`,
        text: `قبل نهاية الدورة بـ${daysWord(daysBetween(d, end))}. حتى توصل لنهايتها لا تتجاوز ${fmt(safeDailyLimit)} د.ع باليوم.` });
    } else if (projectedBalance < income * 0.05) {
      push({ id: "tight", level: "warning", icon: "⚖️", score: 70,
        title: "الدورة راح تخلص على الحافة",
        text: `المتوقع يبقى ${fmt(Math.max(0, projectedBalance))} د.ع بس. الحد اليومي الآمن ${fmt(safeDailyLimit)} د.ع.` });
    } else {
      push({ id: "on-track", level: "good", icon: "✅", score: 40,
        title: `متوقع يبقى ${fmt(projectedBalance)} د.ع نهاية الدورة`,
        text: `تگدر تصرف لحد ${fmt(safeDailyLimit)} د.ع باليوم وتبقى ضمن الدخل.` });
    }
  }

  // 2) مقارنة الإجمالي بالدورات السابقة
  if (hasHistory && isCurrentCycle && daysElapsed >= 5) {
    const ratio = projectedSpend / histAvgTotal;
    if (ratio >= 1.2) {
      push({ id: "pace-total", level: "warning", icon: "📈", score: 60,
        title: `صرفك ماشي أعلى من معدلك بـ${pct(projectedSpend - histAvgTotal, histAvgTotal)}%`,
        text: `المتوقع ${fmt(projectedSpend)} د.ع لهذه الدورة، ومعدل دوراتك السابقة ${fmt(histAvgTotal)} د.ع.` });
    } else if (ratio <= 0.85) {
      push({ id: "pace-good", level: "good", icon: "🌱", score: 45,
        title: `ممتاز: أقل من معدلك بـ${pct(histAvgTotal - projectedSpend, histAvgTotal)}%`,
        text: `المتوقع ${fmt(projectedSpend)} د.ع مقابل معدل ${fmt(histAvgTotal)} د.ع. استمر هيج.` });
    }
  }

  // 3) الأقسام مقابل معدلها السابق + حدود الميزانية
  const catNow = new Map<string, number>();
  for (const l of inCycle) catNow.set(l.category, (catNow.get(l.category) || 0) + l.amount);
  if (hasHistory && daysElapsed >= 5) {
    for (const [cat, amt] of Array.from(catNow)) {
      const prev = windows
        .map((w) => sum(allLines.filter((l) => l.category === cat && l.date >= w.from && l.date <= w.to)))
        .filter((t) => t > 0);
      if (!prev.length) continue;
      const avg = prev.reduce((a, b) => a + b, 0) / prev.length;
      const projected = (amt / daysElapsed) * daysTotal;
      if (projected >= avg * 1.4 && projected - avg >= 15000) {
        push({ id: `cat-${cat}`, level: "warning", icon: "📊", score: 50 + Math.min(20, (projected - avg) / 10000),
          title: `${cat}: أعلى من معدلك بـ${pct(projected - avg, avg)}%`,
          text: `صرفت ${fmt(amt)} د.ع لحد الآن، والمتوقع ${fmt(projected)} مقابل معدل ${fmt(avg)} د.ع.` });
      }
    }
  }
  for (const [cat, limit] of Object.entries(ctx.budgetLimits || {})) {
    const lim = Number(limit) || 0;
    if (lim <= 0) continue;
    const amt = catNow.get(cat) || 0;
    if (amt >= lim) {
      push({ id: `limit-${cat}`, level: "danger", icon: "⛔", score: 90,
        title: `تجاوزت ميزانية ${cat}`, text: `صرفت ${fmt(amt)} من ${fmt(lim)} د.ع (${pct(amt, lim)}%).` });
    } else if (amt >= lim * 0.8) {
      push({ id: `limit-${cat}`, level: "warning", icon: "⚠️", score: 65,
        title: `اقتربت من ميزانية ${cat}`, text: `باقي ${fmt(lim - amt)} د.ع من ${fmt(lim)} (${pct(amt, lim)}% مصروف).` });
    }
  }

  // 4) الكماليات والتبذير
  const nonEssential = optional + waste;
  if (spent > 0 && nonEssential > 0) {
    const share = pct(nonEssential, spent);
    if (waste > 0) {
      push({ id: "waste", level: share >= 25 ? "warning" : "tip", icon: "🗑️", score: 55,
        title: `${fmt(waste)} د.ع تبذير بهذه الدورة`,
        text: `هذا مبلغ ما يرجع بفايدة. لو توقفه تماماً توفر تقريباً ${fmt((waste / daysElapsed) * daysTotal)} د.ع بالدورة.` });
    }
    if (share >= 20) {
      push({ id: "optional-share", level: share >= 35 ? "warning" : "tip", icon: "🍫", score: 52,
        title: `${share}% من صرفك كماليات`,
        text: `${fmt(nonEssential)} د.ع على أشياء مو ضرورية. تقليلها للنص يوفر ${fmt(nonEssential / 2)} د.ع هذه الدورة.` });
    }
  } else if (spent > 0 && inCycle.length >= 5) {
    push({ id: "no-waste", level: "good", icon: "💚", score: 35, title: "ماكو كماليات أو تبذير هذه الدورة", text: "كل صرفك على أساسيات. عاشت إيدك." });
  }

  // مجموعات «ابتعد عنه» و«حافظ عليه»
  const groupBy = (ls: Line[]) => {
    const m = new Map<string, NatureGroup>();
    for (const l of ls) {
      const g = m.get(l.subTitle) || { label: l.subTitle, amount: 0, count: 0 };
      g.amount += l.amount;
      g.count += 1;
      m.set(l.subTitle, g);
    }
    return Array.from(m.values()).sort((a, b) => b.amount - a.amount);
  };
  const avoid = groupBy(inCycle.filter((l) => l.nature !== "essential")).slice(0, 5);
  const keep = groupBy(inCycle.filter((l) => l.nature === "essential")).slice(0, 5);

  // 5) مشتريات صغيرة متكررة غير ضرورية
  const freq = new Map<string, { name: string; count: number; amount: number }>();
  for (const l of inCycle) {
    if (l.nature === "essential" || !l.key) continue;
    const f = freq.get(l.key) || { name: l.name, count: 0, amount: 0 };
    f.count += 1;
    f.amount += l.amount;
    freq.set(l.key, f);
  }
  for (const [key, f] of Array.from(freq)) {
    if (f.count >= 4) {
      push({ id: `freq-${key}`, level: "tip", icon: "🔁", score: 30 + f.count,
        title: `اشتريت ${f.name} ${timesWord(f.count)} بهذه الدورة`,
        text: `المجموع ${fmt(f.amount)} د.ع. تقليلها لمرة بالأسبوع يوفر حوالي ${fmt(f.amount * 0.5)} د.ع.` });
    }
  }

  // 6) ارتفاع الأسعار + 7) مواد متوقع تحتاجها قريباً
  const history = buildItemHistory(allLines.filter((l) => l.date <= todayStr));
  const homeBook = buildPriceBook(ctx.expenses, undefined, today);
  const recentFrom = ymd(new Date(today.getTime() - 14 * DAY));
  for (const [key, h] of Array.from(history)) {
    // الأسعار: آخر سعر مقابل معدل ما قبله
    if (h.unitPrices.length >= 3) {
      const last = h.unitPrices[h.unitPrices.length - 1];
      const before = h.unitPrices.slice(0, -1);
      const avg = before.reduce((a, b) => a + b, 0) / before.length;
      const lastDate = h.dates[h.dates.length - 1];
      if (lastDate >= recentFrom && avg > 0 && last >= avg * 1.4 && last - avg >= 500) {
        const recs = homeBook.get(key) || [];
        const lastRec = recs[recs.length - 1];
        const cheapRec = recs.length ? recs.reduce((a, b) => (b.unitPrice < a.unitPrice ? b : a)) : undefined;
        const where =
          cheapRec && cheapRec.place && cheapRec.unitPrice < last && normalizeArabicText(cheapRec.place) !== normalizeArabicText(lastRec?.place || "")
            ? ` أرخص كان ${fmt(cheapRec.unitPrice)} من ${cheapRec.place} (${shortDate(cheapRec.date)}) — اشتري من هناك.`
            : " قارن الأسعار بمحل ثاني.";
        push({ id: `price-${key}`, level: "warning", icon: "💸", score: 38 + Math.min(10, pct(last - avg, avg) / 10),
          title: `سعر ${h.name} صاعد ${pct(last - avg, avg)}%`,
          text: `آخر مرة ${fmt(last)} د.ع${lastRec?.place ? ` من ${lastRec.place}` : ""} ومعدلك ${fmt(avg)} د.ع.${where}` });
      }
    }
    // التنبؤ بالحاجة: مادة أساسية تتكرر بفترات منتظمة
    if (h.nature === "essential" && h.dates.length >= 3) {
      const gaps: number[] = [];
      for (let i = 1; i < h.dates.length; i++) {
        const a = parseDay(h.dates[i - 1]);
        const b = parseDay(h.dates[i]);
        if (a && b) gaps.push(daysBetween(a, b));
      }
      const usual = Math.round(median(gaps.slice(-5)));
      if (usual >= 3 && usual <= 45) {
        const last = parseDay(h.dates[h.dates.length - 1])!;
        const since = daysBetween(last, today);
        const dueIn = usual - since;
        if (dueIn >= -7 && dueIn <= 4) {
          push({ id: `need-${key}`, level: "tip", icon: "🛒", score: 33 - Math.abs(dueIn),
            title: dueIn <= 0 ? `غالباً تحتاج ${h.name} هسه` : `متوقع تحتاج ${h.name} خلال ${daysWord(dueIn)}`,
            text: `عادةً تشتريه كل ${daysWord(usual)}، وآخر مرة قبل ${daysWord(since)}.` });
        }
      }
    }
  }

  // مراقبة الأسعار: كل مادة اشتريتها آخر 30 يوم بسعر أعلى من سابقه أو من محل أغلى من أرخص محل
  const watchFrom = ymd(new Date(today.getTime() - 30 * DAY));
  const sixMonths = ymd(new Date(today.getTime() - 183 * DAY));
  const priceWatch: PriceWatchItem[] = [];
  for (const [key, recs] of Array.from(homeBook)) {
    if (recs.length < 2) continue;
    const lastRec = recs[recs.length - 1];
    if (lastRec.date < watchFrom || lastRec.date > todayStr) continue;
    const prevRec = recs[recs.length - 2];
    const recent = recs.filter((r) => r.date >= sixMonths);
    const cheap = (recent.length ? recent : recs).reduce((a, b) => (b.unitPrice < a.unitPrice ? b : a));
    const tol = (v: number) => Math.max(100, v * 0.05);
    const rose = lastRec.unitPrice - prevRec.unitPrice > tol(prevRec.unitPrice);
    const cheaperElsewhere =
      lastRec.unitPrice - cheap.unitPrice > tol(cheap.unitPrice) &&
      normalizeArabicText(cheap.place) !== normalizeArabicText(lastRec.place);
    if (!rose && !cheaperElsewhere) continue;
    const h = history.get(key);
    priceWatch.push({
      name: h?.name || key,
      last: lastRec.unitPrice, lastPlace: lastRec.place, lastDate: lastRec.date,
      prev: prevRec.unitPrice, prevPlace: prevRec.place,
      cheapest: cheap.unitPrice, cheapestPlace: cheap.place,
      pct: pct(lastRec.unitPrice - Math.min(prevRec.unitPrice, cheap.unitPrice), Math.min(prevRec.unitPrice, cheap.unitPrice)),
    });
  }
  priceWatch.sort((a, b) => b.pct - a.pct);

  // ترتيب + تنويع
  const levelRank: Record<InsightLevel, number> = { danger: 0, warning: 1, tip: 2, good: 3 };
  alerts.sort((a, b) => levelRank[a.level] - levelRank[b.level] || b.score - a.score);
  const dedupAlerts = alerts.filter((a, i) => alerts.findIndex((x) => x.id === a.id) === i);
  tips.sort((a, b) => b.score - a.score);
  const goods = tips.filter((t) => t.level === "good");
  const others = rotate(tips.filter((t) => t.level !== "good"), seed);
  const chosenTips = [...others.slice(0, 4), ...rotate(goods, seed).slice(0, 1)];

  return {
    cycle: {
      spent, income, obligations, essential, optional, waste,
      daysElapsed, daysTotal, daysLeft,
      dailyAvg: Math.round(spent / daysElapsed),
      projectedSpend, projectedBalance, safeDailyLimit, runOutDate, hasHistory,
    },
    alerts: dedupAlerts.slice(0, 6),
    tips: chosenTips,
    avoid,
    keep,
    priceWatch: priceWatch.slice(0, 8),
  };
}

// ───────────────────────── ذاكرة الأسعار ─────────────────────────

export interface PriceRecord {
  unitPrice: number;
  place: string;
  date: string;
}

export type PriceBook = Map<string, PriceRecord[]>;

/** آخر 12 شهراً من أسعار كل مادة (سعر القطعة + المحل + التاريخ)، الأقدم أولاً */
export function buildPriceBook(expenses: InsightExpense[], excludeId?: string, today: Date = new Date()): PriceBook {
  const from = ymd(new Date(dayStart(today).getTime() - 365 * DAY));
  const book: PriceBook = new Map();
  const lines = toLines(expenses.filter((e) => e.id !== excludeId))
    .filter((l) => l.fromItem && l.key && l.key.length >= 2 && l.unitPrice > 0 && l.date >= from)
    .sort((a, b) => a.date.localeCompare(b.date));
  for (const l of lines) {
    const arr = book.get(l.key) || [];
    arr.push({ unitPrice: Math.round(l.unitPrice), place: l.place, date: l.date });
    book.set(l.key, arr);
  }
  return book;
}

export interface PriceComparison {
  verdict: "new" | "higher" | "lower" | "same";
  last?: PriceRecord;
  /** أرخص سعر بآخر 6 أشهر */
  cheapest?: PriceRecord;
  /** الفرق عن آخر سعر (موجب = أغلى) */
  diff: number;
  pct: number;
  /** نص قصير جاهز للعرض */
  message: string;
}

const shortDate = (s: string) => {
  const d = parseDay(s);
  return d ? `${d.getDate()}/${d.getMonth() + 1}` : s;
};

/** مقارنة سعر مادة (سعر السطر ÷ الكمية) بآخر سعر وأرخص مكان */
export function comparePrice(book: PriceBook, name: string, linePrice: number, quantity = 1, place = "", today: Date = new Date()): PriceComparison | null {
  const key = normalizeArabicText(String(name || "").trim());
  const unit = Number(linePrice) / (Number(quantity) > 0 ? Number(quantity) : 1);
  if (!key || key.length < 2 || !(unit > 0)) return null;
  const hist = book.get(key);
  if (!hist || hist.length === 0) return { verdict: "new", diff: 0, pct: 0, message: "أول مرة تشتريها — راح نتذكر سعرها" };

  const last = hist[hist.length - 1];
  const from = ymd(new Date(dayStart(today).getTime() - 183 * DAY));
  const recent = hist.filter((h) => h.date >= from);
  const cheapest = (recent.length ? recent : hist).reduce((a, b) => (b.unitPrice < a.unitPrice ? b : a));
  const diff = Math.round(unit - last.unitPrice);
  const pctV = last.unitPrice > 0 ? Math.round((diff / last.unitPrice) * 100) : 0;
  // فرق أقل من 5% أو 100 دينار = نفس السعر
  const same = Math.abs(diff) <= Math.max(100, last.unitPrice * 0.05);
  const verdict: PriceComparison["verdict"] = same ? "same" : diff > 0 ? "higher" : "lower";

  const lastTxt = `${fmt(last.unitPrice)}${last.place ? ` من ${last.place}` : ""} (${shortDate(last.date)})`;
  const cheaperElsewhere =
    cheapest.unitPrice < unit - Math.max(100, unit * 0.05) &&
    normalizeArabicText(cheapest.place) !== normalizeArabicText(place)
      ? ` · أرخص كان ${fmt(cheapest.unitPrice)}${cheapest.place ? ` من ${cheapest.place}` : ""}`
      : "";
  let message = "";
  if (verdict === "higher") message = `⬆️ أغلى بـ${fmt(diff)} (${pctV}%) — آخر مرة ${lastTxt}${cheaperElsewhere}`;
  else if (verdict === "lower") message = `⬇️ أرخص بـ${fmt(-diff)} من آخر مرة ${lastTxt}`;
  else message = `= نفس سعرك السابق ${lastTxt}${cheaperElsewhere}`;
  return { verdict, last, cheapest, diff, pct: pctV, message };
}

// ───────────────────────── تحذيرات أثناء الإدخال ─────────────────────────

export function analyzeExpenseDraft(ctx: InsightContext, draft: DraftExpense): Insight[] {
  const out: Insight[] = [];
  const today = dayStart(ctx.today || new Date());
  const startStr = ymd(dayStart(ctx.cycleStart));
  const endStr = ymd(dayStart(ctx.cycleEnd));
  const draftDate = String(draft.date || ymd(today)).split("T")[0];
  const amount = Math.max(0, Number(draft.amount) || 0);
  if (amount <= 0 && !(draft.items || []).some((i) => (i.name || "").trim())) return out;

  const others = ctx.expenses.filter((e) => e.id !== draft.excludeId);
  const allLines = toLines(others);
  const inCycle = allLines.filter((l) => l.date >= startStr && l.date <= endStr);
  const draftLines = toLines([{ id: "__draft", name: draft.name, category: draft.category, amount, date: draftDate, items: draft.items }]);
  const spent = inCycle.reduce((s, l) => s + l.amount, 0);
  const income = Math.max(0, ctx.income || 0);
  const obligations = Math.max(0, ctx.obligations || 0);
  const draftInCycle = draftDate >= startStr && draftDate <= endStr;

  // 1) أثره على الدخل
  if (income > 0 && draftInCycle && amount > 0) {
    const daysLeft = Math.max(1, daysBetween(today, dayStart(ctx.cycleEnd)) + 1);
    const after = income - obligations - spent - amount;
    if (after < 0) {
      out.push({ id: "d-deficit", level: "danger", icon: "🚨", score: 100,
        title: "هذا المصروف يدخلك بعجز",
        text: `بعده تصير ناقص ${fmt(-after)} د.ع عن دخل الدورة (مع الالتزامات غير المدفوعة).` });
    } else {
      const perDay = Math.floor(after / daysLeft);
      const share = pct(amount, income - obligations - spent);
      out.push({ id: "d-left", level: share >= 30 ? "warning" : "tip", icon: "💰", score: 60,
        title: `يبقى ${fmt(after)} د.ع بعد هذا المصروف`,
        text: `يعني ${fmt(perDay)} د.ع باليوم لـ${daysWord(daysLeft)} الباقية${share >= 30 ? ` — هذا المصروف ياخذ ${share}% من المتبقي` : ""}.` });
    }
  }

  // 2) طبيعة المصروف
  const waste = draftLines.filter((l) => l.nature === "waste");
  const optional = draftLines.filter((l) => l.nature === "optional");
  if (waste.length) {
    const amt = waste.reduce((s, l) => s + l.amount, 0);
    out.push({ id: "d-waste", level: "warning", icon: "🗑️", score: 80,
      title: `تبذير: ${waste.slice(0, 3).map((l) => l.name).join("، ")}`,
      text: `${fmt(amt)} د.ع ما ترجع بفايدة. فكّر تلغيها من هذا المصروف.` });
  }
  if (optional.length) {
    const amt = optional.reduce((s, l) => s + l.amount, 0);
    const cycleOptional = inCycle.filter((l) => l.nature !== "essential").reduce((s, l) => s + l.amount, 0);
    out.push({ id: "d-optional", level: "tip", icon: "🍫", score: 50,
      title: `كماليات: ${optional.slice(0, 3).map((l) => l.name).join("، ")}${optional.length > 3 ? "…" : ""}`,
      text: `${fmt(amt)} د.ع منها مو ضرورية. صرفت على الكماليات ${fmt(cycleOptional)} د.ع لحد الآن هذه الدورة.` });
  }

  // 3) حد ميزانية القسم
  const cat = draft.category || "";
  const lim = Number(ctx.budgetLimits?.[cat]) || 0;
  if (cat && lim > 0 && draftInCycle) {
    const catSpent = inCycle.filter((l) => l.category === cat).reduce((s, l) => s + l.amount, 0) + amount;
    if (catSpent > lim) {
      out.push({ id: "d-limit", level: "danger", icon: "⛔", score: 90,
        title: `يتجاوز ميزانية ${cat}`, text: `يصير ${fmt(catSpent)} من ${fmt(lim)} د.ع (زيادة ${fmt(catSpent - lim)}).` });
    } else if (catSpent >= lim * 0.8) {
      out.push({ id: "d-limit", level: "warning", icon: "⚠️", score: 70,
        title: `قريب من ميزانية ${cat}`, text: `يصير ${fmt(catSpent)} من ${fmt(lim)} د.ع، يبقى ${fmt(lim - catSpent)}.` });
    }
  }

  // 4) أكبر من المعتاد لنفس القسم
  if (cat && amount > 0) {
    const perExp = new Map<string, number>();
    for (const l of allLines.filter((l) => l.category === cat)) perExp.set(l.expenseId, (perExp.get(l.expenseId) || 0) + l.amount);
    const vals = Array.from(perExp.values());
    const med = median(vals);
    if (vals.length >= 4 && med > 0 && amount >= med * 3 && amount - med >= 20000) {
      out.push({ id: "d-big", level: "tip", icon: "🔎", score: 45,
        title: `أكبر من المعتاد لـ${cat} بـ${(amount / med).toFixed(1)} مرة`,
        text: `مصروفك المعتاد بهذا القسم حوالي ${fmt(med)} د.ع. تأكد من المبلغ أو إنه ضروري.` });
    }
  }

  // 5) مواد اشتريتها مؤخراً + مقارنة الأسعار بآخر مرة وبأرخص مكان
  const history = buildItemHistory(allLines);
  const book = buildPriceBook(others, undefined, today);
  const recent: string[] = [];
  const pricey: string[] = [];
  const cheaper: string[] = [];
  for (const l of draftLines.filter((x) => x.fromItem)) {
    const h = history.get(l.key);
    if (h) {
      const last = parseDay(h.dates[h.dates.length - 1]);
      const dDate = parseDay(draftDate);
      if (last && dDate) {
        const since = daysBetween(last, dDate);
        if (since >= 0 && since <= 3 && l.nature === "essential") recent.push(`${l.name} (قبل ${since === 0 ? "اليوم" : daysWord(since)})`);
      }
    }
    const qty = l.amount > 0 && l.unitPrice > 0 ? l.amount / l.unitPrice : 1;
    const cmp = comparePrice(book, l.name, l.amount, qty, l.place, today);
    if (!cmp || !cmp.last) continue;
    if (cmp.verdict === "higher") pricey.push(`${l.name}: ${cmp.message.replace(/^⬆️ /, "")}`);
    else if (cmp.verdict === "lower") cheaper.push(`${l.name} (${fmt(-cmp.diff)} أرخص)`);
    else if (cmp.message.includes("أرخص كان")) pricey.push(`${l.name}: ${cmp.message.replace(/^= /, "")}`);
  }
  if (recent.length) {
    out.push({ id: "d-recent", level: "tip", icon: "🧺", score: 55,
      title: "اشتريتها مؤخراً", text: `${recent.slice(0, 3).join("، ")}. تأكد إنك فعلاً تحتاجها حتى ما تتكدس.` });
  }
  if (pricey.length) {
    out.push({ id: "d-price", level: pricey.length >= 3 ? "warning" : "tip", icon: "💸", score: 75,
      title: pricey.length === 1 ? "سعر صاعد عن السابق" : `${pricey.length} مواد سعرها صاعد عن السابق`,
      text: pricey.slice(0, 3).join(" | ") + (pricey.length > 3 ? ` | و${pricey.length - 3} غيرها` : "") });
  }
  if (cheaper.length) {
    out.push({ id: "d-cheaper", level: "good", icon: "🎉", score: 30,
      title: "أرخص من آخر مرة", text: cheaper.slice(0, 4).join("، ") });
  }

  const rank: Record<InsightLevel, number> = { danger: 0, warning: 1, tip: 2, good: 3 };
  return out.sort((a, b) => rank[a.level] - rank[b.level] || b.score - a.score).slice(0, 6);
}
