/**
 * محرك حساب الدورة الشهرية — دوال صافية بدون أي اتصال بقاعدة البيانات.
 *
 * المبادئ:
 *  1. لا بيانات افتراضية وهمية: إن لم يُسجَّل شيء فالحالة «غير مهيأة».
 *  2. طول الدورة يُحسب من السجل الفعلي (متوسط آخر 6 دورات) لا من رقم ثابت 28.
 *  3. التوقع يُعرض كنطاق (أبكر/أرجح/أبعد) لأن التوقع بالتقويم تقريبي.
 *  4. الإباضة ونافذة الخصوبة تقديرية (الإباضة ≈ 14 يوماً قبل الدورة التالية،
 *     النافذة = 5 أيام قبلها + يومها) ولا تصلح لمنع الحمل ولا للتشخيص.
 *  5. ملاحظات صحية وفق الحدود المتعارف عليها طبياً:
 *     طول الدورة 21–35 يوماً، مدة الحيض 2–7 أيام، انقطاع 90 يوماً يستدعي مراجعة طبيب.
 */

// ───────────────────────── الأنواع ─────────────────────────

export type FlowLevel = "light" | "medium" | "heavy";
export type PainLevel = 0 | 1 | 2 | 3;

export interface PeriodEntry {
  id: string;
  startDate: string;      // YYYY-MM-DD أول يوم نزول
  endDate?: string;       // YYYY-MM-DD آخر يوم نزول (غير موجود = ما زالت مستمرة/لم يُسجَّل)
  duration?: number;      // عدد الأيام (حقل قديم؛ يُشتق من endDate إن وُجد)
  flow?: FlowLevel;
  pain?: PainLevel;
  symptoms?: string[];
  notes?: string;
  loggedAt?: string;
  /** سجلات أضافها النظام القديم تلقائياً ولم يؤكدها المستخدم */
  confirmed?: boolean;
}

/** اسم قديم للنوع نفسه (للتوافق) */
export type CycleHistoryItem = PeriodEntry;

export interface CycleMemberSettings {
  memberName: string;
  /** المدة المعتادة للحيض — تُستخدم فقط عند غياب سجل كافٍ */
  periodDuration: number;
  /** الطول المعتاد للدورة — يُستخدم فقط عند غياب سجل كافٍ */
  cycleLength: number;
  /** أحدث تاريخ بداية (مشتق من السجل؛ محفوظ للتوافق) */
  lastPeriodDate: string;
  customEmail?: string;
  notes?: string;
  history: PeriodEntry[];
  updatedAt?: string;
}

export type PhaseKey = "unknown" | "menstrual" | "follicular" | "fertile" | "luteal" | "late";

export interface HealthNote {
  level: "info" | "attention";
  title: string;
  text: string;
}

export interface CycleStats {
  /** أطوال الدورات المحسوبة من السجل (الأحدث أولاً) مع تاريخ بدايتها */
  cycles: { startDate: string; length: number; counted: boolean }[];
  /** عدد الدورات الداخلة في المتوسط */
  sampleSize: number;
  avgCycle: number;
  minCycle: number;
  maxCycle: number;
  variation: number;
  avgPeriod: number;
  /** مصدر الأرقام: السجل الفعلي أم الإعداد اليدوي */
  basis: "history" | "manual";
  confidence: "low" | "medium" | "high";
}

export interface UpcomingCycle {
  index: number;
  startDate: string;
  endDate: string;
  earliest: string;
  latest: string;
  daysUntilStart: number;
  ovulationDate: string | null;
  fertileStart: string | null;
  fertileEnd: string | null;
}

export interface CycleInsight {
  isConfigured: boolean;
  today: string;
  stats: CycleStats;

  // الدورة الحالية
  lastPeriodDate: string;
  daysSinceLastPeriod: number;
  cycleDay: number;
  cycleLength: number;
  periodDuration: number;

  // الحيض الحالي
  isCurrentlyInPeriod: boolean;
  /** الحيض مسجَّل كمستمر وتجاوز المدة المعتادة: نحتاج تأكيد الانتهاء */
  needsEndConfirmation: boolean;
  currentPeriodDay: number;
  periodDaysRemaining: number;
  currentEntryId: string | null;

  // التوقع
  nextPeriodDate: string;
  nextPeriodEarliest: string;
  nextPeriodLatest: string;
  daysUntilNextPeriod: number;
  isDueToday: boolean;
  isDueTomorrow: boolean;
  isLate: boolean;
  daysLate: number;

  // الخصوبة (تقديري)
  ovulationDate: string | null;
  fertileWindow: { start: string; end: string } | null;

  phase: PhaseKey;
  upcoming: UpcomingCycle[];
  healthNotes: HealthNote[];
  /** سجلات غير مؤكدة موروثة من النظام القديم */
  unconfirmedCount: number;
}

// ───────────────────────── ثوابت ─────────────────────────

export const DEFAULT_CYCLE_LENGTH = 28;
export const DEFAULT_PERIOD_DURATION = 5;

/** الحدود الطبية المتعارف عليها للبالغات */
export const NORMAL_CYCLE_MIN = 21;
export const NORMAL_CYCLE_MAX = 35;
export const NORMAL_PERIOD_MAX = 7;
export const AMENORRHEA_DAYS = 90;

/** دورات خارج هذا المدى تُستبعد من المتوسط (غالباً شهر لم يُسجَّل أو تسجيل مكرر) */
const COUNTED_CYCLE_MIN = 15;
const COUNTED_CYCLE_MAX = 60;
/** أقصى مدة نعتبر فيها حيضاً «مستمراً» بلا تسجيل انتهاء */
const MAX_OPEN_PERIOD_DAYS = 10;
const MAX_PERIOD_DAYS = 15;
const SAMPLE_CYCLES = 6;
const LUTEAL_DAYS = 14;

export const SYMPTOM_OPTIONS = [
  "تقلصات",
  "صداع",
  "ألم ظهر",
  "تعب",
  "انتفاخ",
  "تقلب مزاج",
  "غثيان",
  "ألم ثدي",
] as const;

export const FLOW_LABELS: Record<FlowLevel, string> = {
  light: "خفيف",
  medium: "متوسط",
  heavy: "غزير",
};

export const PAIN_LABELS = ["بدون ألم", "خفيف", "متوسط", "شديد"] as const;

const ARABIC_MONTHS = [
  "كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران",
  "تموز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول",
];
const ARABIC_DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

// ───────────────────────── التواريخ ─────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateString(s: any): s is string {
  if (typeof s !== "string" || !DATE_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d, 12);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function formatToDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayString(): string {
  return formatToDateString(new Date());
}

/** تحويل YYYY-MM-DD إلى تاريخ محلي عند الظهر (يتفادى مفاجآت المنطقة الزمنية) */
export function parseDateString(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
}

export function addDaysToDateString(dateStr: string, days: number): string {
  const dt = parseDateString(dateStr);
  dt.setDate(dt.getDate() + days);
  return formatToDateString(dt);
}

/** الفرق بالأيام (to − from) */
export function diffInDays(from: string, to: string): number {
  return Math.round((parseDateString(to).getTime() - parseDateString(from).getTime()) / 86400000);
}

export function formatArabicFriendlyDate(dateStr: string, withDayName = false): string {
  if (!isValidDateString(dateStr)) return "";
  const dt = parseDateString(dateStr);
  const base = `${dt.getDate()} ${ARABIC_MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
  return withDayName ? `${ARABIC_DAYS[dt.getDay()]}، ${base}` : base;
}

/** صيغة قصيرة بدون السنة: «12 تشرين الثاني» */
export function formatArabicShortDate(dateStr: string): string {
  if (!isValidDateString(dateStr)) return "";
  const dt = parseDateString(dateStr);
  return `${dt.getDate()} ${ARABIC_MONTHS[dt.getMonth()]}`;
}

export function getArabicMonthYear(dateStr: string): string {
  if (!isValidDateString(dateStr)) return "";
  const dt = parseDateString(dateStr);
  return `${ARABIC_MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
}

/** «يوم واحد / يومان / 3 أيام / 11 يوماً» */
export function daysLabel(n: number): string {
  const v = Math.abs(n);
  if (v === 0) return "0 يوم";
  if (v === 1) return "يوم واحد";
  if (v === 2) return "يومان";
  if (v <= 10) return `${v} أيام`;
  return `${v} يوماً`;
}

// ───────────────────────── تنظيف السجل ─────────────────────────

const clampInt = (v: any, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
};

/** آخر يوم نزول المعروف للسجل (من endDate أو من duration القديم) */
export function entryEnd(e: PeriodEntry): string | null {
  if (isValidDateString(e.endDate) && diffInDays(e.startDate, e.endDate) >= 0) {
    return e.endDate;
  }
  const d = Math.round(Number(e.duration));
  if (Number.isFinite(d) && d >= 1 && d <= MAX_PERIOD_DAYS) {
    return addDaysToDateString(e.startDate, d - 1);
  }
  return null;
}

/** مدة الحيض بالأيام إن كانت معروفة */
export function entryDuration(e: PeriodEntry): number | null {
  const end = entryEnd(e);
  return end ? diffInDays(e.startDate, end) + 1 : null;
}

const LEGACY_SEED_ID = /^h-(iman|ruq)-\d+$/;

/** سجل أضافه النظام القديم كقيمة افتراضية ولم يؤكده أحد */
export function isUnconfirmedSeed(e: PeriodEntry): boolean {
  return LEGACY_SEED_ID.test(e.id) && e.confirmed !== true;
}

/** تنظيف السجل: تواريخ صحيحة فقط، بلا تكرار، الأحدث أولاً */
export function normalizeHistory(history: any): PeriodEntry[] {
  if (!Array.isArray(history)) return [];
  const seen = new Set<string>();
  const out: PeriodEntry[] = [];
  const sorted = history
    .filter((h) => h && isValidDateString(h.startDate))
    .sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));

  for (const h of sorted) {
    if (seen.has(h.startDate)) continue;
    seen.add(h.startDate);
    const entry: PeriodEntry = {
      id: String(h.id || `p-${h.startDate}`),
      startDate: h.startDate,
    };
    const end = entryEnd(h);
    if (end) {
      entry.endDate = end;
      entry.duration = diffInDays(h.startDate, end) + 1;
    }
    if (h.flow === "light" || h.flow === "medium" || h.flow === "heavy") entry.flow = h.flow;
    if ([0, 1, 2, 3].includes(Number(h.pain)) && h.pain !== undefined && h.pain !== null) {
      entry.pain = Number(h.pain) as PainLevel;
    }
    if (Array.isArray(h.symptoms) && h.symptoms.length) {
      entry.symptoms = h.symptoms.map((s: any) => String(s)).slice(0, 12);
    }
    if (h.notes) entry.notes = String(h.notes).slice(0, 500);
    if (h.loggedAt) entry.loggedAt = String(h.loggedAt);
    if (h.confirmed === true) entry.confirmed = true;
    out.push(entry);
  }
  return out;
}

export function emptyCycleSettings(memberName: string): CycleMemberSettings {
  return {
    memberName,
    periodDuration: DEFAULT_PERIOD_DURATION,
    cycleLength: DEFAULT_CYCLE_LENGTH,
    lastPeriodDate: "",
    customEmail: "",
    notes: "",
    history: [],
  };
}

/** تحويل أي مستند محفوظ (قديم أو جديد) إلى إعدادات سليمة */
export function sanitizeSettings(raw: any, memberName: string): CycleMemberSettings {
  const base = emptyCycleSettings(memberName);
  if (!raw || typeof raw !== "object") return base;
  let history = normalizeHistory(raw.history);
  // مستندات قديمة قد تحمل lastPeriodDate بلا سجل مطابق
  if (isValidDateString(raw.lastPeriodDate) && !history.some((h) => h.startDate === raw.lastPeriodDate)) {
    const newest = history[0]?.startDate;
    if (!newest || raw.lastPeriodDate > newest) {
      history = normalizeHistory([
        {
          id: `p-${raw.lastPeriodDate}`,
          startDate: raw.lastPeriodDate,
          duration: clampInt(raw.periodDuration, 1, MAX_PERIOD_DAYS, DEFAULT_PERIOD_DURATION),
        },
        ...history,
      ]);
    }
  }
  return {
    memberName,
    periodDuration: clampInt(raw.periodDuration, 1, MAX_PERIOD_DAYS, DEFAULT_PERIOD_DURATION),
    cycleLength: clampInt(raw.cycleLength, COUNTED_CYCLE_MIN, COUNTED_CYCLE_MAX, DEFAULT_CYCLE_LENGTH),
    lastPeriodDate: history[0]?.startDate || "",
    customEmail: typeof raw.customEmail === "string" ? raw.customEmail.trim() : "",
    notes: typeof raw.notes === "string" ? raw.notes : "",
    history,
    ...(raw.updatedAt ? { updatedAt: String(raw.updatedAt) } : {}),
  };
}

// ───────────────────────── الإحصاءات ─────────────────────────

const mean = (arr: number[]) => arr.reduce((s, n) => s + n, 0) / arr.length;

export function computeStats(settings: CycleMemberSettings): CycleStats {
  const history = normalizeHistory(settings.history); // الأحدث أولاً
  const cycles: CycleStats["cycles"] = [];
  for (let i = 0; i < history.length - 1; i++) {
    // history[i+1] بداية الدورة، history[i] بداية التي بعدها
    const length = diffInDays(history[i + 1].startDate, history[i].startDate);
    cycles.push({
      startDate: history[i + 1].startDate,
      length,
      counted: length >= COUNTED_CYCLE_MIN && length <= COUNTED_CYCLE_MAX,
    });
  }
  const sample = cycles.filter((c) => c.counted).slice(0, SAMPLE_CYCLES).map((c) => c.length);

  const manualCycle = clampInt(settings.cycleLength, COUNTED_CYCLE_MIN, COUNTED_CYCLE_MAX, DEFAULT_CYCLE_LENGTH);
  const basis: CycleStats["basis"] = sample.length > 0 ? "history" : "manual";
  const avgCycle = sample.length > 0 ? Math.round(mean(sample)) : manualCycle;
  const minCycle = sample.length > 0 ? Math.min(...sample) : avgCycle;
  const maxCycle = sample.length > 0 ? Math.max(...sample) : avgCycle;
  const variation = maxCycle - minCycle;

  const durations = history
    .map(entryDuration)
    .filter((d): d is number => d !== null && d >= 1 && d <= MAX_PERIOD_DAYS)
    .slice(0, SAMPLE_CYCLES);
  const avgPeriod =
    durations.length > 0
      ? Math.round(mean(durations))
      : clampInt(settings.periodDuration, 1, MAX_PERIOD_DAYS, DEFAULT_PERIOD_DURATION);

  let confidence: CycleStats["confidence"] = "low";
  if (sample.length >= 4 && variation <= 7) confidence = "high";
  else if (sample.length >= 2) confidence = "medium";

  return { cycles, sampleSize: sample.length, avgCycle, minCycle, maxCycle, variation, avgPeriod, basis, confidence };
}

// ───────────────────────── الحالة والتوقع ─────────────────────────

function fertileFor(nextStart: string, currentStart: string, avgPeriod: number) {
  const ovulation = addDaysToDateString(nextStart, -LUTEAL_DAYS);
  // في الدورات القصيرة جداً قد يقع التقدير داخل أيام الحيض: لا نعرض تقديراً مضللاً
  if (diffInDays(currentStart, ovulation) < avgPeriod) {
    return { ovulationDate: null, fertileStart: null, fertileEnd: null };
  }
  return {
    ovulationDate: ovulation,
    fertileStart: addDaysToDateString(ovulation, -5),
    fertileEnd: ovulation,
  };
}

export function calculateCycleStatus(
  settings: CycleMemberSettings,
  referenceDate: string = todayString()
): CycleInsight {
  const today = isValidDateString(referenceDate) ? referenceDate : todayString();
  // نتجاهل أي سجل بتاريخ مستقبلي
  const history = normalizeHistory(settings.history).filter((h) => h.startDate <= today);
  const stats = computeStats({ ...settings, history });
  const unconfirmedCount = history.filter(isUnconfirmedSeed).length;

  const base: CycleInsight = {
    isConfigured: false,
    today,
    stats,
    lastPeriodDate: "",
    daysSinceLastPeriod: 0,
    cycleDay: 0,
    cycleLength: stats.avgCycle,
    periodDuration: stats.avgPeriod,
    isCurrentlyInPeriod: false,
    needsEndConfirmation: false,
    currentPeriodDay: 0,
    periodDaysRemaining: 0,
    currentEntryId: null,
    nextPeriodDate: "",
    nextPeriodEarliest: "",
    nextPeriodLatest: "",
    daysUntilNextPeriod: 0,
    isDueToday: false,
    isDueTomorrow: false,
    isLate: false,
    daysLate: 0,
    ovulationDate: null,
    fertileWindow: null,
    phase: "unknown",
    upcoming: [],
    healthNotes: [],
    unconfirmedCount,
  };

  if (history.length === 0) {
    base.healthNotes = [
      {
        level: "info",
        title: "ابدئي بتسجيل أول دورة",
        text: "سجّلي تاريخ بداية آخر دورة. بعد تسجيل دورتين متتاليتين يصير التوقع مبنياً على بياناتك الفعلية لا على متوسط عام.",
      },
    ];
    return base;
  }

  const latest = history[0];
  const last = latest.startDate;
  const daysSince = diffInDays(last, today);
  const knownEnd = entryEnd(latest);

  // ── الحيض الحالي ──
  let inPeriod = false;
  let needsEndConfirmation = false;
  if (knownEnd) {
    inPeriod = today <= knownEnd;
  } else if (daysSince < MAX_OPEN_PERIOD_DAYS) {
    inPeriod = true;
    needsEndConfirmation = daysSince >= stats.avgPeriod;
  } else {
    // مرّت 10 أيام بلا تسجيل انتهاء: نعتبرها انتهت ونطلب تسجيل التاريخ
    needsEndConfirmation = true;
  }
  const currentPeriodDay = inPeriod ? daysSince + 1 : 0;
  const expectedLen = knownEnd ? diffInDays(last, knownEnd) + 1 : stats.avgPeriod;
  const periodDaysRemaining = inPeriod ? Math.max(0, expectedLen - currentPeriodDay) : 0;

  // ── التوقع ──
  const next = addDaysToDateString(last, stats.avgCycle);
  let earliest: string;
  let latestDate: string;
  if (stats.sampleSize >= 3) {
    earliest = addDaysToDateString(last, Math.min(stats.minCycle, stats.avgCycle));
    latestDate = addDaysToDateString(last, Math.max(stats.maxCycle, stats.avgCycle));
  } else {
    earliest = addDaysToDateString(next, -2);
    latestDate = addDaysToDateString(next, 2);
  }
  const daysUntil = diffInDays(today, next);
  const isLate = daysUntil < 0 && !inPeriod;
  const daysLate = isLate ? -daysUntil : 0;

  // ── الخصوبة (تقديري) ──
  const fert = fertileFor(next, last, stats.avgPeriod);

  // ── المرحلة ──
  let phase: PhaseKey = "follicular";
  if (inPeriod) phase = "menstrual";
  else if (isLate) phase = "late";
  else if (fert.fertileStart && fert.fertileEnd && today >= fert.fertileStart && today <= fert.fertileEnd) phase = "fertile";
  else if (fert.ovulationDate && today > fert.ovulationDate) phase = "luteal";

  // ── الدورات القادمة ──
  const upcoming: UpcomingCycle[] = [];
  const spreadBefore = diffInDays(earliest, next);
  const spreadAfter = diffInDays(next, latestDate);
  for (let k = 1; k <= 3; k++) {
    const start = addDaysToDateString(last, stats.avgCycle * k);
    const prevStart = addDaysToDateString(last, stats.avgCycle * (k - 1));
    const f = fertileFor(start, prevStart, stats.avgPeriod);
    upcoming.push({
      index: k,
      startDate: start,
      endDate: addDaysToDateString(start, stats.avgPeriod - 1),
      // هامش الخطأ يتسع كلما ابتعد التوقع
      earliest: addDaysToDateString(start, -spreadBefore * k),
      latest: addDaysToDateString(start, spreadAfter * k),
      daysUntilStart: diffInDays(today, start),
      ovulationDate: f.ovulationDate,
      fertileStart: f.fertileStart,
      fertileEnd: f.fertileEnd,
    });
  }

  const insight: CycleInsight = {
    ...base,
    isConfigured: true,
    lastPeriodDate: last,
    daysSinceLastPeriod: daysSince,
    cycleDay: daysSince + 1,
    isCurrentlyInPeriod: inPeriod,
    needsEndConfirmation,
    currentPeriodDay,
    periodDaysRemaining,
    currentEntryId: latest.id,
    nextPeriodDate: next,
    nextPeriodEarliest: earliest,
    nextPeriodLatest: latestDate,
    daysUntilNextPeriod: daysUntil,
    isDueToday: daysUntil === 0 && !inPeriod,
    isDueTomorrow: daysUntil === 1 && !inPeriod,
    isLate,
    daysLate,
    ovulationDate: fert.ovulationDate,
    fertileWindow: fert.fertileStart && fert.fertileEnd ? { start: fert.fertileStart, end: fert.fertileEnd } : null,
    phase,
    upcoming,
  };
  insight.healthNotes = buildHealthNotes(insight, history);
  return insight;
}

// ───────────────────────── الملاحظات الصحية ─────────────────────────

function buildHealthNotes(insight: CycleInsight, history: PeriodEntry[]): HealthNote[] {
  const notes: HealthNote[] = [];
  const { stats } = insight;

  if (!insight.isCurrentlyInPeriod && insight.daysSinceLastPeriod >= AMENORRHEA_DAYS) {
    notes.push({
      level: "attention",
      title: `مرّ ${daysLabel(insight.daysSinceLastPeriod)} على آخر دورة مسجَّلة`,
      text: "إذا لم تكن هناك دورات لم تُسجَّل، فانقطاع الدورة 90 يوماً أو أكثر يستدعي مراجعة طبيبة نسائية لمعرفة السبب.",
    });
  } else if (insight.isLate && insight.daysLate >= 7) {
    notes.push({
      level: "info",
      title: `الدورة متأخرة ${daysLabel(insight.daysLate)} عن الموعد المتوقع`,
      text: "التأخر قد يحدث مع التوتر أو السفر أو تغيّر الوزن أو المرض. إذا كان الحمل محتملاً يمكن إجراء اختبار منزلي، وإذا تكرر التأخر فاستشيري الطبيبة.",
    });
  }

  if (stats.basis === "history" && stats.sampleSize >= 2) {
    if (stats.avgCycle < NORMAL_CYCLE_MIN) {
      notes.push({
        level: "attention",
        title: `متوسط الدورة ${stats.avgCycle} يوماً (أقصر من 21)`,
        text: "الدورات التي تتكرر بأقل من 21 يوماً تستحق استشارة طبية، خصوصاً إذا استمرت عدة أشهر.",
      });
    } else if (stats.avgCycle > NORMAL_CYCLE_MAX) {
      notes.push({
        level: "attention",
        title: `متوسط الدورة ${stats.avgCycle} يوماً (أطول من 35)`,
        text: "الدورات التي تتباعد أكثر من 35 يوماً بشكل متكرر تستحق استشارة طبية.",
      });
    }
  }

  if (stats.sampleSize >= 3 && stats.variation > 9) {
    notes.push({
      level: "attention",
      title: `تفاوت ${daysLabel(stats.variation)} بين أقصر وأطول دورة`,
      text: `الدورات الأخيرة تراوحت بين ${stats.minCycle} و${stats.maxCycle} يوماً. إذا استمر عدم الانتظام فاذكريه للطبيبة؛ والتوقعات هنا ستكون أقل دقة.`,
    });
  }

  const longPeriod = history.slice(0, 3).find((h) => (entryDuration(h) || 0) > NORMAL_PERIOD_MAX);
  if (longPeriod) {
    notes.push({
      level: "attention",
      title: `حيض استمر ${daysLabel(entryDuration(longPeriod) || 0)}`,
      text: "النزول لأكثر من 7 أيام، خصوصاً إذا كان غزيراً أو تكرر، يستحق مراجعة الطبيبة وفحص مخزون الحديد.",
    });
  }

  const severe = history.slice(0, 3).filter((h) => h.pain === 3).length;
  if (severe >= 2) {
    notes.push({
      level: "attention",
      title: "ألم شديد متكرر",
      text: "الألم الشديد الذي يعيق النشاط اليومي أو لا يستجيب للمسكنات المعتادة ليس أمراً يجب تحمّله؛ يُستحسن عرضه على الطبيبة.",
    });
  }

  if (stats.basis === "manual" || stats.sampleSize < 2) {
    notes.push({
      level: "info",
      title: "التوقع الحالي تقريبي",
      text:
        stats.sampleSize === 0
          ? `يعتمد على طول دورة مُدخل يدوياً (${stats.avgCycle} يوماً). سيتحسن تلقائياً بعد تسجيل الدورة القادمة.`
          : "يعتمد على دورة واحدة مسجَّلة فقط. كل دورة جديدة تُسجَّل تزيد الدقة.",
    });
  }

  if (insight.needsEndConfirmation) {
    notes.unshift({
      level: "info",
      title: "هل انتهت الدورة؟",
      text: "لم يُسجَّل تاريخ الانتهاء بعد. تسجيله يجعل حساب مدة الحيض ومتوسطها صحيحاً.",
    });
  }

  return notes;
}

// ───────────────────────── علامات التقويم ─────────────────────────

export interface DayMark {
  period?: boolean;     // نزول مسجَّل
  predicted?: boolean;  // نزول متوقع
  fertile?: boolean;    // نافذة خصوبة تقديرية
  ovulation?: boolean;  // إباضة تقديرية
}

/** علامات الأيام بين تاريخين (شاملة) لعرض التقويم */
export function buildDayMarks(
  settings: CycleMemberSettings,
  insight: CycleInsight,
  from: string,
  to: string
): Record<string, DayMark> {
  const marks: Record<string, DayMark> = {};
  const inRange = (d: string) => d >= from && d <= to;
  const mark = (d: string, key: keyof DayMark) => {
    if (!inRange(d)) return;
    marks[d] = { ...(marks[d] || {}), [key]: true };
  };
  const span = (start: string, end: string, key: keyof DayMark) => {
    const n = diffInDays(start, end);
    for (let i = 0; i <= n && i < 60; i++) mark(addDaysToDateString(start, i), key);
  };

  for (const h of normalizeHistory(settings.history)) {
    let end = entryEnd(h);
    if (!end) {
      // حيض مفتوح: نلوّن حتى اليوم (بحد أقصى) أو المدة المعتادة إن كان قديماً
      const open = diffInDays(h.startDate, insight.today);
      end =
        open >= 0 && open < MAX_OPEN_PERIOD_DAYS
          ? insight.today
          : addDaysToDateString(h.startDate, insight.periodDuration - 1);
    }
    span(h.startDate, end, "period");
  }

  if (!insight.isConfigured) return marks;

  const addFertile = (ov: string | null, fs: string | null, fe: string | null) => {
    if (!ov || !fs || !fe) return;
    span(fs, fe, "fertile");
    mark(ov, "ovulation");
  };
  // الدورة الحالية
  addFertile(insight.ovulationDate, insight.fertileWindow?.start || null, insight.fertileWindow?.end || null);
  // الدورات القادمة (لا نعرض توقعات إذا كانت الدورة متأخرة كثيراً: ستكون مضللة)
  if (insight.daysLate <= 14) {
    for (const u of insight.upcoming) {
      // لا نرسم توقعاً فوق أيام مضت
      if (u.endDate >= insight.today) {
        const start = u.startDate < insight.today ? insight.today : u.startDate;
        span(start, u.endDate, "predicted");
      }
      addFertile(u.ovulationDate, u.fertileStart, u.fertileEnd);
    }
  }
  return marks;
}

// ───────────────────────── تعديل السجل (دوال صافية) ─────────────────────────

export interface MutationResult {
  settings: CycleMemberSettings;
  error?: string;
}

function withHistory(settings: CycleMemberSettings, history: PeriodEntry[]): CycleMemberSettings {
  const clean = normalizeHistory(history);
  return { ...settings, history: clean, lastPeriodDate: clean[0]?.startDate || "" };
}

function newId(): string {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** التحقق من سجل قبل حفظه مقابل بقية السجلات */
export function validateEntry(
  history: PeriodEntry[],
  entry: { id?: string; startDate: string; endDate?: string },
  today: string = todayString()
): string | null {
  if (!isValidDateString(entry.startDate)) return "تاريخ البداية غير صالح";
  if (entry.startDate > today) return "لا يمكن تسجيل دورة بتاريخ مستقبلي";
  if (entry.endDate) {
    if (!isValidDateString(entry.endDate)) return "تاريخ الانتهاء غير صالح";
    if (entry.endDate < entry.startDate) return "تاريخ الانتهاء قبل تاريخ البداية";
    if (entry.endDate > today) return "تاريخ الانتهاء لا يمكن أن يكون في المستقبل";
    if (diffInDays(entry.startDate, entry.endDate) + 1 > MAX_PERIOD_DAYS) {
      return `مدة الحيض أطول من ${MAX_PERIOD_DAYS} يوماً. تأكدي من التواريخ`;
    }
  }
  const myEnd = entry.endDate || entry.startDate;
  for (const h of normalizeHistory(history)) {
    if (h.id === entry.id) continue;
    const hEnd = entryEnd(h) || h.startDate;
    // تداخل الفترتين
    if (entry.startDate <= hEnd && myEnd >= h.startDate) {
      return `يتداخل مع دورة مسجَّلة بتاريخ ${formatArabicFriendlyDate(h.startDate)}`;
    }
  }
  return null;
}

/** «بدأت الدورة» — سجل مفتوح بلا تاريخ انتهاء */
export function startPeriod(
  settings: CycleMemberSettings,
  startDate: string,
  today: string = todayString()
): MutationResult {
  const error = validateEntry(settings.history, { startDate }, today);
  if (error) return { settings, error };
  const entry: PeriodEntry = { id: newId(), startDate, loggedAt: new Date().toISOString(), confirmed: true };
  return { settings: withHistory(settings, [entry, ...settings.history]) };
}

/** «انتهت الدورة» — تحديد آخر يوم نزول */
export function endPeriod(
  settings: CycleMemberSettings,
  entryId: string,
  endDate: string,
  today: string = todayString()
): MutationResult {
  const target = settings.history.find((h) => h.id === entryId);
  if (!target) return { settings, error: "السجل غير موجود" };
  const error = validateEntry(settings.history, { id: entryId, startDate: target.startDate, endDate }, today);
  if (error) return { settings, error };
  const history = settings.history.map((h) =>
    h.id === entryId ? { ...h, endDate, duration: diffInDays(h.startDate, endDate) + 1, confirmed: true } : h
  );
  return { settings: withHistory(settings, history) };
}

/** إضافة أو تعديل سجل كامل */
export function upsertEntry(
  settings: CycleMemberSettings,
  entry: Omit<PeriodEntry, "id"> & { id?: string },
  today: string = todayString()
): MutationResult {
  const error = validateEntry(settings.history, entry, today);
  if (error) return { settings, error };
  const clean: PeriodEntry = {
    id: entry.id || newId(),
    startDate: entry.startDate,
    ...(entry.endDate
      ? { endDate: entry.endDate, duration: diffInDays(entry.startDate, entry.endDate) + 1 }
      : {}),
    ...(entry.flow ? { flow: entry.flow } : {}),
    ...(entry.pain !== undefined ? { pain: entry.pain } : {}),
    ...(entry.symptoms?.length ? { symptoms: entry.symptoms } : {}),
    ...(entry.notes?.trim() ? { notes: entry.notes.trim() } : {}),
    loggedAt: entry.loggedAt || new Date().toISOString(),
    confirmed: true,
  };
  const exists = settings.history.some((h) => h.id === clean.id);
  const history = exists
    ? settings.history.map((h) => (h.id === clean.id ? clean : h))
    : [clean, ...settings.history];
  return { settings: withHistory(settings, history) };
}

export function deleteEntry(settings: CycleMemberSettings, entryId: string): MutationResult {
  return { settings: withHistory(settings, settings.history.filter((h) => h.id !== entryId)) };
}

/** تأكيد السجلات الموروثة من النظام القديم */
export function confirmAllEntries(settings: CycleMemberSettings): MutationResult {
  return { settings: withHistory(settings, settings.history.map((h) => ({ ...h, confirmed: true }))) };
}

/** حذف السجلات غير المؤكدة الموروثة من النظام القديم */
export function removeUnconfirmedEntries(settings: CycleMemberSettings): MutationResult {
  return { settings: withHistory(settings, settings.history.filter((h) => !isUnconfirmedSeed(h))) };
}
