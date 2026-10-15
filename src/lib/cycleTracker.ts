"use client";

import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

export interface CycleHistoryItem {
  id: string;
  startDate: string; // YYYY-MM-DD
  duration: number; // in days (e.g. 5)
  notes?: string;
  loggedAt?: string;
}

export interface CycleMemberSettings {
  memberName: "إيمان" | "رقية" | string;
  periodDuration: number; // default: 5 days (مرات أكثر أو أقل)
  cycleLength: number;    // default: 28 days (مرات أكثر أو أقل)
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
  lastPeriodDate: string;
  nextPeriodDate: string;
  daysSinceLastPeriod: number;
  isCurrentlyInPeriod: boolean;
  currentPeriodDay: number;      // 1 to periodDuration
  periodDaysRemaining: number;   // Days left in current period
  daysUntilNextPeriod: number;   // 1 = tomorrow, 0 = today, negative = late
  isDueTomorrow: boolean;
  isDueToday: boolean;
  isLate: boolean;
  cycleDay: number;              // Day 1 to cycleLength in total cycle
  currentPhase: {
    key: "menstrual" | "follicular" | "ovulation" | "luteal";
    title: string;
    description: string;
    badgeColor: string;
    icon: string;
  };
  progressPercentage: number;
}

// Default initial settings
export const DEFAULT_CYCLE_SETTINGS: Record<string, CycleMemberSettings> = {
  "إيمان": {
    memberName: "إيمان",
    periodDuration: 5,
    cycleLength: 28,
    lastPeriodDate: "2026-10-01", // sensible initial date
    customEmail: "",
    notes: "فترة الدورة منتظمة تقريباً 5 أيام كل 28 يوم",
    history: [
      { id: "h-1", startDate: "2026-10-01", duration: 5, notes: "دورة أكتوبر" },
      { id: "h-2", startDate: "2026-09-03", duration: 5, notes: "دورة سبتمبر" }
    ]
  },
  "رقية": {
    memberName: "رقية",
    periodDuration: 5,
    cycleLength: 28,
    lastPeriodDate: "2026-09-28",
    customEmail: "",
    notes: "دورة رقية 5 أيام كل 28 يوم قابلة للتعديل",
    history: [
      { id: "h-r1", startDate: "2026-09-28", duration: 5, notes: "دورة سبتمبر" }
    ]
  }
};

/**
 * Format Date to YYYY-MM-DD in local time
 */
export function formatToDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Add days to a YYYY-MM-DD string
 */
export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return formatToDateString(dt);
}

/**
 * Calculate difference in calendar days (date2 - date1)
 */
export function diffInDays(dateStr1: string, dateStr2: string): number {
  const [y1, m1, d1] = dateStr1.split("-").map(Number);
  const [y2, m2, d2] = dateStr2.split("-").map(Number);
  const dt1 = new Date(y1, m1 - 1, d1).getTime();
  const dt2 = new Date(y2, m2 - 1, d2).getTime();
  return Math.round((dt2 - dt1) / (1000 * 60 * 60 * 24));
}

/**
 * Core cycle status calculator
 */
export function calculateCycleStatus(
  settings: CycleMemberSettings,
  referenceDateStr: string = formatToDateString(new Date())
): CycleStatusInsight {
  const periodDuration = Math.max(1, settings.periodDuration || 5);
  const cycleLength = Math.max(periodDuration + 1, settings.cycleLength || 28);
  const lastPeriodDate = settings.lastPeriodDate || referenceDateStr;

  // Calculate next expected period start
  let nextPeriodDate = addDaysToDateString(lastPeriodDate, cycleLength);
  
  // If the lastPeriodDate is many cycles in the past, roll forward
  let daysDiff = diffInDays(lastPeriodDate, referenceDateStr);
  let effectiveLastStart = lastPeriodDate;
  
  if (daysDiff >= cycleLength) {
    const cyclesPassed = Math.floor(daysDiff / cycleLength);
    effectiveLastStart = addDaysToDateString(lastPeriodDate, cyclesPassed * cycleLength);
    nextPeriodDate = addDaysToDateString(effectiveLastStart, cycleLength);
    daysDiff = diffInDays(effectiveLastStart, referenceDateStr);
  }

  const isCurrentlyInPeriod = daysDiff >= 0 && daysDiff < periodDuration;
  const currentPeriodDay = isCurrentlyInPeriod ? daysDiff + 1 : 0;
  const periodDaysRemaining = isCurrentlyInPeriod ? Math.max(1, periodDuration - daysDiff) : 0;

  const daysUntilNext = diffInDays(referenceDateStr, nextPeriodDate);
  const isDueTomorrow = daysUntilNext === 1;
  const isDueToday = daysUntilNext === 0;
  const isLate = daysUntilNext < 0 && !isCurrentlyInPeriod;

  // Cycle day 1 to cycleLength
  const cycleDay = (daysDiff % cycleLength) + 1;
  const progressPercentage = Math.min(100, Math.round((cycleDay / cycleLength) * 100));

  // Determine current biological phase
  let currentPhase: CycleStatusInsight["currentPhase"] = {
    key: "follicular",
    title: "المرحلة الجرابية (نشاط وتجدد)",
    description: "ارتفاع تدريجي للطاقة والنشاط الذهني",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40",
    icon: "🌱"
  };

  if (isCurrentlyInPeriod) {
    currentPhase = {
      key: "menstrual",
      title: "فترة الدورة الشهرية (الحيض)",
      description: "فترة الراحة، شرب السوائل الدافئة، والتغذية الغنية بالحديد والمغنيسيوم",
      badgeColor: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40",
      icon: "🌸"
    };
  } else if (cycleDay >= 12 && cycleDay <= 16) {
    currentPhase = {
      key: "ovulation",
      title: "فترة التبويض (أعلى حيوية)",
      description: "ذروة الحيوية والنشاط الإيجابي",
      badgeColor: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40",
      icon: "✨"
    };
  } else if (cycleDay > 16) {
    currentPhase = {
      key: "luteal",
      title: "المرحلة الإفرازية (ما قبل الدورة)",
      description: "الاستعداد للدورة القادمة، تجنب الإجهاد والسكريات المفرطة",
      badgeColor: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40",
      icon: "🌙"
    };
  }

  return {
    memberName: settings.memberName,
    isConfigured: !!settings.lastPeriodDate,
    periodDuration,
    cycleLength,
    lastPeriodDate: effectiveLastStart,
    nextPeriodDate,
    daysSinceLastPeriod: daysDiff,
    isCurrentlyInPeriod,
    currentPeriodDay,
    periodDaysRemaining,
    daysUntilNextPeriod: daysUntilNext,
    isDueTomorrow,
    isDueToday,
    isLate,
    cycleDay,
    currentPhase,
    progressPercentage
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

  // Check local override (e.g. if family member explicitly selected "أنا إيمان" in browser)
  if (typeof window !== "undefined") {
    const forced = localStorage.getItem("force_iman_account");
    if (forced === "true") return true;
  }

  return false;
}

/**
 * Fetch cycle settings from Firestore with local fallback
 */
export async function getMemberCycleSettings(memberName: "إيمان" | "رقية" | string): Promise<CycleMemberSettings> {
  const defaultSetting = DEFAULT_CYCLE_SETTINGS[memberName] || {
    memberName,
    periodDuration: 5,
    cycleLength: 28,
    lastPeriodDate: formatToDateString(new Date()),
    history: []
  };

  try {
    const docRef = doc(db, "familyCycleSettings", memberName);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as CycleMemberSettings;
      return { ...defaultSetting, ...data };
    }
  } catch (err) {
    console.warn(`Could not fetch cycle settings for ${memberName} from Firestore, using cache:`, err);
  }

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
 * Save cycle settings to Firestore and local storage
 */
export async function saveMemberCycleSettings(settings: CycleMemberSettings): Promise<void> {
  const toSave: CycleMemberSettings = {
    ...settings,
    updatedAt: new Date().toISOString()
  };

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`cycle_settings_${settings.memberName}`, JSON.stringify(toSave));
    } catch {}
  }

  try {
    const docRef = doc(db, "familyCycleSettings", settings.memberName);
    await setDoc(docRef, toSave, { merge: true });
  } catch (err) {
    console.error(`Failed to save cycle settings for ${settings.memberName}:`, err);
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

  const docRef = doc(db, "familyCycleSettings", memberName);
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as CycleMemberSettings;
        callback({ ...defaultSetting, ...data });
      } else {
        callback(defaultSetting);
      }
    },
    (err) => {
      console.warn(`Error subscribing to cycle settings for ${memberName}:`, err);
      callback(defaultSetting);
    }
  );
}
