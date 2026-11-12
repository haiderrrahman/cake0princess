"use client";

import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

export interface CycleHistoryItem {
  id: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  duration: number;   // in days (e.g. 5)
  notes?: string;
  loggedAt?: string;
}

export interface PredictedCycle {
  cycleIndex: number;
  startDate: string;          // YYYY-MM-DD
  endDate: string;            // YYYY-MM-DD
  daysUntilStart: number;     // calendar days relative to today
  monthName: string;          // Arabic month + year
  ovulationDate: string;      // estimated peak ovulation date
  fertileWindowStart: string; // start of fertile days
  fertileWindowEnd: string;   // end of fertile days
  statusLabel: string;        // readable badge text
}

export interface CycleMemberSettings {
  memberName: "إيمان" | "رقية" | string;
  periodDuration: number; // default: 5 days
  cycleLength: number;    // default: 28 days
  lastPeriodDate: string; // YYYY-MM-DD
  customEmail?: string;   // Optional specific email for Iman
  notes?: string;
  history: CycleHistoryItem[];
  updatedAt?: string;
}

export interface CycleStatusInsight {
  memberName: string;
  isConfigured: boolean;
  periodDuration: number;
  cycleLength: number;
  lastPeriodDate: string;        // Actual latest period start date as set by user
  nextPeriodDate: string;        // Next expected period start date
  daysSinceLastPeriod: number;   // Days elapsed since lastPeriodDate
  isCurrentlyInPeriod: boolean;  // Today is within [lastPeriodDate, lastPeriodDate + periodDuration - 1]
  currentPeriodDay: number;      // 1 to periodDuration (if active)
  periodDaysRemaining: number;   // Days left in current period
  daysUntilNextPeriod: number;   // 1 = tomorrow, 0 = today, negative = late
  isDueTomorrow: boolean;
  isDueToday: boolean;
  isLate: boolean;
  daysLate: number;              // Positive count if late, else 0
  cycleDay: number;              // Day 1 to cycleLength
  currentPhase: {
    key: "menstrual" | "follicular" | "ovulation" | "luteal";
    title: string;
    description: string;
    badgeColor: string;
    icon: string;
  };
  progressPercentage: number;
  predictedCycles: PredictedCycle[];
  ovulationDate: string;
  fertileWindow: {
    start: string;
    end: string;
  };
}

// Arabic month names (Levant / Iraq standard)
const ARABIC_MONTHS = [
  "كانون الثاني",
  "شباط",
  "آذار",
  "نيسان",
  "أيار",
  "حزيران",
  "تموز",
  "آب",
  "أيلول",
  "تشرين الأول",
  "تشرين الثاني",
  "كانون الأول"
];

const ARABIC_DAYS = [
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت"
];

// Default initial settings with smart recent dates
export const DEFAULT_CYCLE_SETTINGS: Record<string, CycleMemberSettings> = {
  "إيمان": {
    memberName: "إيمان",
    periodDuration: 5,
    cycleLength: 28,
    lastPeriodDate: "2026-10-20",
    customEmail: "",
    notes: "دورة منتظمة تقريباً 5 أيام كل 28 يوماً",
    history: [
      { id: "h-iman-1", startDate: "2026-10-20", duration: 5, notes: "دورة تشرين الأول" },
      { id: "h-iman-2", startDate: "2026-09-22", duration: 5, notes: "دورة أيلول" }
    ]
  },
  "رقية": {
    memberName: "رقية",
    periodDuration: 5,
    cycleLength: 28,
    lastPeriodDate: "2026-10-25",
    customEmail: "",
    notes: "دورة رقية 5 أيام كل 28 يوماً",
    history: [
      { id: "h-ruq-1", startDate: "2026-10-25", duration: 5, notes: "دورة تشرين الأول" },
      { id: "h-ruq-2", startDate: "2026-09-27", duration: 5, notes: "دورة أيلول" }
    ]
  }
};

/**
 * Format Date object to YYYY-MM-DD
 */
export function formatToDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Safely parse YYYY-MM-DD string to local Date without UTC offset surprises
 */
export function parseDateString(dateStr: string): Date {
  if (!dateStr || !dateStr.includes("-")) return new Date();
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
}

/**
 * Add calendar days to a YYYY-MM-DD string
 */
export function addDaysToDateString(dateStr: string, days: number): string {
  const dt = parseDateString(dateStr);
  dt.setDate(dt.getDate() + days);
  return formatToDateString(dt);
}

/**
 * Calculate difference in calendar days (dateStr2 - dateStr1)
 */
export function diffInDays(dateStr1: string, dateStr2: string): number {
  const dt1 = parseDateString(dateStr1).getTime();
  const dt2 = parseDateString(dateStr2).getTime();
  return Math.round((dt2 - dt1) / (1000 * 60 * 60 * 24));
}

/**
 * Format date string to friendly Arabic label (e.g. "12 تشرين الثاني 2026")
 */
export function formatArabicFriendlyDate(dateStr: string, withDayName: boolean = false): string {
  if (!dateStr) return "";
  const dt = parseDateString(dateStr);
  const day = dt.getDate();
  const monthName = ARABIC_MONTHS[dt.getMonth()] || "";
  const year = dt.getFullYear();
  if (withDayName) {
    const dayName = ARABIC_DAYS[dt.getDay()] || "";
    return `${dayName}، ${day} ${monthName} ${year}`;
  }
  return `${day} ${monthName} ${year}`;
}

/**
 * Format date string to Month and Year in Arabic (e.g. "تشرين الثاني 2026")
 */
export function getArabicMonthYear(dateStr: string): string {
  if (!dateStr) return "";
  const dt = parseDateString(dateStr);
  const monthName = ARABIC_MONTHS[dt.getMonth()] || "";
  const year = dt.getFullYear();
  return `${monthName} ${year}`;
}

/**
 * Predict upcoming future cycles (up to `count` cycles)
 */
export function predictUpcomingCycles(
  lastStartDate: string,
  cycleLength: number,
  periodDuration: number,
  count: number = 6,
  referenceDateStr: string = formatToDateString(new Date())
): PredictedCycle[] {
  const predictions: PredictedCycle[] = [];
  if (!lastStartDate) return predictions;

  const cLength = Math.max(20, cycleLength || 28);
  const pDuration = Math.max(1, periodDuration || 5);

  // Find next cycle start based on lastStartDate
  let nextStart = addDaysToDateString(lastStartDate, cLength);

  // If the last start is very old, find the first future or current expected start
  let diffFromRef = diffInDays(referenceDateStr, nextStart);
  if (diffFromRef < -30) {
    // Bring it forward so the predictions reflect relevant upcoming cycles
    const elapsedCycles = Math.ceil(Math.abs(diffFromRef) / cLength);
    nextStart = addDaysToDateString(lastStartDate, elapsedCycles * cLength);
  }

  let currentLoopStart = nextStart;

  for (let i = 1; i <= count; i++) {
    const pStart = currentLoopStart;
    const pEnd = addDaysToDateString(pStart, pDuration - 1);
    const daysUntil = diffInDays(referenceDateStr, pStart);
    
    // Estimated ovulation day (typically 14 days before next period start)
    const ovulationDate = addDaysToDateString(pStart, Math.max(1, cLength - 14));
    const fertileWindowStart = addDaysToDateString(ovulationDate, -4);
    const fertileWindowEnd = addDaysToDateString(ovulationDate, 1);

    let statusLabel = "";
    if (daysUntil === 0) {
      statusLabel = "الموعد المتوقع اليوم 🌸";
    } else if (daysUntil === 1) {
      statusLabel = "الموعد المتوقع غداً ⏰";
    } else if (daysUntil < 0) {
      statusLabel = `متأخرة بـ ${Math.abs(daysUntil)} يوم ⏳`;
    } else {
      statusLabel = `بعد ${daysUntil} يوم 🗓️`;
    }

    predictions.push({
      cycleIndex: i,
      startDate: pStart,
      endDate: pEnd,
      daysUntilStart: daysUntil,
      monthName: getArabicMonthYear(pStart),
      ovulationDate,
      fertileWindowStart,
      fertileWindowEnd,
      statusLabel
    });

    currentLoopStart = addDaysToDateString(currentLoopStart, cLength);
  }

  return predictions;
}

/**
 * Core cycle status and prediction calculator
 */
export function calculateCycleStatus(
  settings: CycleMemberSettings,
  referenceDateStr: string = formatToDateString(new Date())
): CycleStatusInsight {
  const periodDuration = Math.max(1, settings.periodDuration || 5);
  const cycleLength = Math.max(periodDuration + 1, settings.cycleLength || 28);
  const lastPeriodDate = settings.lastPeriodDate || referenceDateStr;

  // Next expected cycle start date
  const nextPeriodDate = addDaysToDateString(lastPeriodDate, cycleLength);

  // Calendar days from last period start until reference date (today)
  const daysSinceLastPeriod = diffInDays(lastPeriodDate, referenceDateStr);

  // Is active period right now?
  const isCurrentlyInPeriod = daysSinceLastPeriod >= 0 && daysSinceLastPeriod < periodDuration;
  const currentPeriodDay = isCurrentlyInPeriod ? daysSinceLastPeriod + 1 : 0;
  const periodDaysRemaining = isCurrentlyInPeriod ? Math.max(1, periodDuration - daysSinceLastPeriod) : 0;

  // Days until next expected period
  const daysUntilNextPeriod = diffInDays(referenceDateStr, nextPeriodDate);
  const isDueTomorrow = daysUntilNextPeriod === 1;
  const isDueToday = daysUntilNextPeriod === 0;
  const isLate = daysUntilNextPeriod < 0 && !isCurrentlyInPeriod;
  const daysLate = isLate ? Math.abs(daysUntilNextPeriod) : 0;

  // Day in cycle: 1 to cycleLength
  const cycleDay = daysSinceLastPeriod >= 0 
    ? (daysSinceLastPeriod % cycleLength) + 1 
    : 1;

  const progressPercentage = Math.min(
    100,
    Math.max(5, Math.round((Math.min(cycleDay, cycleLength) / cycleLength) * 100))
  );

  // Biological Phases:
  // 1. Menstrual: Days 1 to periodDuration
  // 2. Follicular: After period until ovulation window (Day 6 to 11)
  // 3. Ovulation: Days 12 to 16
  // 4. Luteal: Day 17 to cycleLength
  let currentPhase: CycleStatusInsight["currentPhase"] = {
    key: "follicular",
    title: "المرحلة الجرابية (نشاط وتجدد)",
    description: "ارتفاع تدريجي للطاقة والنشاط الذهني والانتعاش",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40",
    icon: "🌱"
  };

  if (isCurrentlyInPeriod) {
    currentPhase = {
      key: "menstrual",
      title: "فترة الدورة الشهرية (الحيض)",
      description: "فترة الراحة، الدفء، شرب السوائل الدافئة، والتغذية الغنية بالحديد والمغنيسيوم",
      badgeColor: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40",
      icon: "🌸"
    };
  } else if (cycleDay >= 12 && cycleDay <= 16) {
    currentPhase = {
      key: "ovulation",
      title: "فترة التبويض (أعلى حيوية وإشراق)",
      description: "ذروة الحيوية والمزاج الإيجابي والنشاط البدني",
      badgeColor: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40",
      icon: "✨"
    };
  } else if (cycleDay > 16) {
    currentPhase = {
      key: "luteal",
      title: "المرحلة الإفرازية (ما قبل الدورة)",
      description: "الاستعداد للدورة القادمة، تجنب الإجهاد والسكريات المفرطة، والنوم الكافي",
      badgeColor: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40",
      icon: "🌙"
    };
  }

  // Calculate current cycle's ovulation & fertile window
  const ovulationDayOffset = Math.max(1, cycleLength - 14);
  const ovulationDate = addDaysToDateString(lastPeriodDate, ovulationDayOffset);
  const fertileWindow = {
    start: addDaysToDateString(ovulationDate, -4),
    end: addDaysToDateString(ovulationDate, 1)
  };

  // Generate Predictions for upcoming 6 cycles
  const predictedCycles = predictUpcomingCycles(
    lastPeriodDate,
    cycleLength,
    periodDuration,
    6,
    referenceDateStr
  );

  return {
    memberName: settings.memberName,
    isConfigured: !!settings.lastPeriodDate,
    periodDuration,
    cycleLength,
    lastPeriodDate,
    nextPeriodDate,
    daysSinceLastPeriod,
    isCurrentlyInPeriod,
    currentPeriodDay,
    periodDaysRemaining,
    daysUntilNextPeriod,
    isDueTomorrow,
    isDueToday,
    isLate,
    daysLate,
    cycleDay,
    currentPhase,
    progressPercentage,
    predictedCycles,
    ovulationDate,
    fertileWindow
  };
}

/**
 * Checks if the currently authenticated user is Iman
 */
export function isImanAccount(user: { email?: string | null; displayName?: string | null } | null, customEmail?: string): boolean {
  if (!user) return false;
  
  const email = (user.email || "").toLowerCase().trim();
  const name = (user.displayName || "").trim();

  // If a custom email is designated for Iman
  if (customEmail && email === customEmail.toLowerCase().trim()) {
    return true;
  }

  // Common keywords for Iman
  const emailMatch = email.includes("iman") || email.includes("eman") || email.includes("eiman");
  const nameMatch = name.includes("إيمان") || name.includes("ايمان") || name.toLowerCase().includes("iman") || name.toLowerCase().includes("eman");

  if (emailMatch || nameMatch) {
    return true;
  }

  // Check local override
  if (typeof window !== "undefined") {
    const forced = localStorage.getItem("force_iman_account");
    if (forced === "true") return true;
  }

  return false;
}

// Helper to normalize member name key for collection safety
function getMemberDocKey(memberName: string): string {
  return memberName === "رقية" ? "ruqayya" : "iman";
}

/**
 * Fetch cycle settings from Firestore with dual collection lookup and local fallback
 */
export async function getMemberCycleSettings(memberName: "إيمان" | "رقية" | string): Promise<CycleMemberSettings> {
  const defaultSetting = DEFAULT_CYCLE_SETTINGS[memberName] || {
    memberName,
    periodDuration: 5,
    cycleLength: 28,
    lastPeriodDate: formatToDateString(new Date()),
    history: []
  };

  // 1. Try familyCycleSettings
  try {
    const docRef = doc(db, "familyCycleSettings", memberName);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as CycleMemberSettings;
      return { ...defaultSetting, ...data };
    }
  } catch (err) {
    // Will fallback below
  }

  // 2. Try home_finance collection fallback (doc: cycle_settings_iman / cycle_settings_ruqayya)
  try {
    const hfKey = `cycle_settings_${getMemberDocKey(memberName)}`;
    const hfRef = doc(db, "home_finance", hfKey);
    const hfSnap = await getDoc(hfRef);
    if (hfSnap.exists()) {
      const data = hfSnap.data() as CycleMemberSettings;
      return { ...defaultSetting, ...data };
    }
  } catch (err) {
    // Will fallback to localStorage
  }

  // 3. Fallback to localStorage
  if (typeof window !== "undefined") {
    try {
      const local = localStorage.getItem(`cycle_settings_${memberName}`);
      if (local) {
        return { ...defaultSetting, ...JSON.parse(local) };
      }
    } catch {}
  }

  return defaultSetting;
}

/**
 * Save cycle settings to Firestore (dual collections for safety) and local storage
 */
export async function saveMemberCycleSettings(settings: CycleMemberSettings): Promise<void> {
  const toSave: CycleMemberSettings = {
    ...settings,
    updatedAt: new Date().toISOString()
  };

  // 1. Cache immediately to localStorage
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`cycle_settings_${settings.memberName}`, JSON.stringify(toSave));
    } catch {}
  }

  // 2. Save to familyCycleSettings
  try {
    const docRef = doc(db, "familyCycleSettings", settings.memberName);
    await setDoc(docRef, toSave, { merge: true });
  } catch (err) {
    console.warn(`Could not save to familyCycleSettings/${settings.memberName}, trying home_finance:`, err);
  }

  // 3. Also save to home_finance as guaranteed fallback
  try {
    const hfKey = `cycle_settings_${getMemberDocKey(settings.memberName)}`;
    const hfRef = doc(db, "home_finance", hfKey);
    await setDoc(hfRef, toSave, { merge: true });
  } catch (err) {
    console.error(`Failed to save fallback cycle settings for ${settings.memberName}:`, err);
  }
}

/**
 * Realtime listener for cycle settings
 */
export function subscribeToMemberCycleSettings(
  memberName: "إيمان" | "رقية" | string,
  callback: (settings: CycleMemberSettings) => void
): () => void {
  const defaultSetting = DEFAULT_CYCLE_SETTINGS[memberName] || {
    memberName,
    periodDuration: 5,
    cycleLength: 28,
    lastPeriodDate: formatToDateString(new Date()),
    history: []
  };

  // Check localStorage first for immediate initial render
  if (typeof window !== "undefined") {
    try {
      const local = localStorage.getItem(`cycle_settings_${memberName}`);
      if (local) {
        callback({ ...defaultSetting, ...JSON.parse(local) });
      }
    } catch {}
  }

  const docRef = doc(db, "familyCycleSettings", memberName);
  const unsubPrimary = onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as CycleMemberSettings;
        callback({ ...defaultSetting, ...data });
      }
    },
    (err) => {
      console.warn(`familyCycleSettings snapshot error for ${memberName}, listening to home_finance fallback`);
      // Listen to home_finance fallback if primary has error
      const hfKey = `cycle_settings_${getMemberDocKey(memberName)}`;
      const hfRef = doc(db, "home_finance", hfKey);
      return onSnapshot(hfRef, (hfSnap) => {
        if (hfSnap.exists()) {
          const data = hfSnap.data() as CycleMemberSettings;
          callback({ ...defaultSetting, ...data });
        }
      }, () => {});
    }
  );

  return unsubPrimary;
}

/**
 * Helper to update current period start date (correcting a mistake)
 */
export async function updateCycleStartDate(
  currentSettings: CycleMemberSettings,
  newStartDate: string
): Promise<CycleMemberSettings> {
  const duration = currentSettings.periodDuration || 5;
  const history = [...(currentSettings.history || [])];

  // If history exists, update the first/most recent item
  if (history.length > 0) {
    history[0] = {
      ...history[0],
      startDate: newStartDate,
      endDate: addDaysToDateString(newStartDate, duration - 1)
    };
  } else {
    history.push({
      id: `cycle-${Date.now()}`,
      startDate: newStartDate,
      endDate: addDaysToDateString(newStartDate, duration - 1),
      duration,
      notes: "تم تسجيل الدورة يدوياً",
      loggedAt: new Date().toISOString()
    });
  }

  const updated: CycleMemberSettings = {
    ...currentSettings,
    lastPeriodDate: newStartDate,
    history
  };

  await saveMemberCycleSettings(updated);
  return updated;
}

/**
 * Helper to log a new cycle start
 */
export async function logCycleEntry(
  currentSettings: CycleMemberSettings,
  startDate: string,
  duration?: number,
  notes?: string
): Promise<CycleMemberSettings> {
  const periodDuration = duration || currentSettings.periodDuration || 5;
  const newHistoryItem: CycleHistoryItem = {
    id: `cycle-${Date.now()}`,
    startDate,
    endDate: addDaysToDateString(startDate, periodDuration - 1),
    duration: periodDuration,
    notes: notes || `دورة ${formatArabicFriendlyDate(startDate)}`,
    loggedAt: new Date().toISOString()
  };

  const updatedHistory = [newHistoryItem, ...(currentSettings.history || [])].slice(0, 36);

  const updated: CycleMemberSettings = {
    ...currentSettings,
    lastPeriodDate: startDate,
    history: updatedHistory
  };

  await saveMemberCycleSettings(updated);
  return updated;
}

/**
 * Helper to update a specific history item
 */
export async function updateHistoryEntry(
  currentSettings: CycleMemberSettings,
  itemId: string,
  updatedFields: Partial<CycleHistoryItem>
): Promise<CycleMemberSettings> {
  const history = (currentSettings.history || []).map((item) => {
    if (item.id === itemId) {
      const duration = updatedFields.duration ?? item.duration;
      const startDate = updatedFields.startDate ?? item.startDate;
      return {
        ...item,
        ...updatedFields,
        duration,
        startDate,
        endDate: addDaysToDateString(startDate, duration - 1)
      };
    }
    return item;
  });

  // Sort history newest first
  history.sort((a, b) => b.startDate.localeCompare(a.startDate));

  // If the top item's start date changed, update lastPeriodDate as well
  const newestStartDate = history.length > 0 ? history[0].startDate : currentSettings.lastPeriodDate;

  const updated: CycleMemberSettings = {
    ...currentSettings,
    lastPeriodDate: newestStartDate,
    history
  };

  await saveMemberCycleSettings(updated);
  return updated;
}

/**
 * Helper to delete a specific history item
 */
export async function deleteHistoryEntry(
  currentSettings: CycleMemberSettings,
  itemId: string
): Promise<CycleMemberSettings> {
  const history = (currentSettings.history || []).filter((item) => item.id !== itemId);

  // If history still has items, sync lastPeriodDate with the newest one
  const newestStartDate = history.length > 0 ? history[0].startDate : currentSettings.lastPeriodDate;

  const updated: CycleMemberSettings = {
    ...currentSettings,
    lastPeriodDate: newestStartDate,
    history
  };

  await saveMemberCycleSettings(updated);
  return updated;
}
