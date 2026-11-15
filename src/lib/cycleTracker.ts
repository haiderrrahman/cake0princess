"use client";

/**
 * تخزين بيانات متابعة الدورة الشهرية (Firestore) — الحسابات كلها في cycleEngine.ts
 *
 * مصدر واحد للحقيقة: home_finance/cycle_<member>
 *  - لا بيانات افتراضية وهمية.
 *  - لا نسخ في localStorage (بيانات صحية لا تُترك على الجهاز).
 *  - لا كتابة مزدوجة لمجموعتين.
 *  - familyCycleSettings تُقرأ مرة واحدة فقط كمصدر قديم إن لم يوجد المستند الأساسي.
 */

import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  CycleMemberSettings,
  emptyCycleSettings,
  sanitizeSettings,
} from "@/lib/cycleEngine";

export * from "@/lib/cycleEngine";

export type CycleMemberName = "إيمان" | "رقية";

export const CYCLE_MEMBERS: { name: CycleMemberName; docId: string }[] = [
  { name: "إيمان", docId: "cycle_iman" },
  { name: "رقية", docId: "cycle_ruqayya" },
];

/** توحيد اسم الفرد إلى أحد الاسمين المعتمدين */
export function normalizeMemberName(name: string): CycleMemberName {
  const s = String(name || "").trim().toLowerCase();
  if (s.includes("رق") || s.includes("ruq") || s.includes("roq")) return "رقية";
  return "إيمان";
}

export function getMemberDocKey(memberName: string): string {
  return normalizeMemberName(memberName) === "رقية" ? "cycle_ruqayya" : "cycle_iman";
}

function describeError(err: any): string {
  const code = String(err?.code || "");
  if (code.includes("permission-denied")) {
    return "لا توجد صلاحية لقراءة/حفظ البيانات. تأكدي من تسجيل الدخول بحساب العائلة ومن نشر قواعد Firebase الجديدة.";
  }
  if (code.includes("unavailable")) return "تعذر الاتصال بالخادم. تحققي من الإنترنت.";
  return err?.message || "خطأ غير معروف";
}

/** حذف نسخ قديمة من البيانات الصحية كانت تُحفظ في localStorage */
function purgeLegacyLocalCopies() {
  if (typeof window === "undefined") return;
  try {
    for (const m of CYCLE_MEMBERS) localStorage.removeItem(`cycle_settings_${m.name}`);
  } catch {}
}

async function readLegacy(memberName: CycleMemberName): Promise<any | null> {
  try {
    const snap = await getDoc(doc(db, "familyCycleSettings", memberName));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}

/** قراءة واحدة (تُستخدم للتنبيه اليومي) */
export async function getMemberCycleSettings(memberName: string): Promise<CycleMemberSettings> {
  const name = normalizeMemberName(memberName);
  const snap = await getDoc(doc(db, "home_finance", getMemberDocKey(name)));
  if (snap.exists()) return sanitizeSettings(snap.data(), name);
  const legacy = await readLegacy(name);
  return legacy ? sanitizeSettings(legacy, name) : emptyCycleSettings(name);
}

export interface CycleSubscriptionMeta {
  loading: boolean;
  error: string | null;
}

/** اشتراك لحظي في بيانات فرد */
export function subscribeToMemberCycleSettings(
  memberName: string,
  callback: (settings: CycleMemberSettings, meta: CycleSubscriptionMeta) => void
): () => void {
  const name = normalizeMemberName(memberName);
  purgeLegacyLocalCopies();
  let active = true;

  const unsub = onSnapshot(
    doc(db, "home_finance", getMemberDocKey(name)),
    async (snap) => {
      if (!active) return;
      if (snap.exists()) {
        callback(sanitizeSettings(snap.data(), name), { loading: false, error: null });
        return;
      }
      const legacy = await readLegacy(name);
      if (!active) return;
      callback(legacy ? sanitizeSettings(legacy, name) : emptyCycleSettings(name), { loading: false, error: null });
    },
    (err) => {
      console.warn(`[cycleTracker] subscription error for ${name}:`, err);
      if (active) callback(emptyCycleSettings(name), { loading: false, error: describeError(err) });
    }
  );

  return () => {
    active = false;
    unsub();
  };
}

/** إزالة undefined (Firestore يرفضها) */
function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

/** حفظ كامل للمستند. يرمي خطأ مقروءاً عند الفشل حتى تُبلَّغ المستخدمة بدل الصمت */
export async function saveMemberCycleSettings(settings: CycleMemberSettings): Promise<void> {
  const name = normalizeMemberName(settings.memberName);
  const clean = sanitizeSettings(settings, name);
  const toSave = stripUndefined({ ...clean, updatedAt: new Date().toISOString() });
  try {
    await setDoc(doc(db, "home_finance", getMemberDocKey(name)), toSave);
  } catch (err) {
    throw new Error(describeError(err));
  }
}

/**
 * هل الحساب الحالي هو حساب إيمان؟ (لتنبيهها اليومي)
 * يُشترط أن يكون الحساب من حسابات العائلة (أدمن)، ثم:
 *  - إن حُدِّد بريد في الإعدادات فالمطابقة عليه فقط.
 *  - وإلا نطابق الاسم/البريد، أو تفعيل يدوي على الجهاز.
 * سابقاً كان أي زبون للمتجر اسمه «إيمان» يستلم التنبيه.
 */
export function isImanAccount(
  user: { email?: string | null; displayName?: string | null } | null,
  customEmail?: string,
  isFamilyAccount = false
): boolean {
  if (!user || !isFamilyAccount) return false;
  const email = (user.email || "").toLowerCase().trim();
  const configured = (customEmail || "").toLowerCase().trim();
  if (configured) return email === configured;

  const name = (user.displayName || "").trim().toLowerCase();
  if (/iman|eman|eiman/.test(email) || /إيمان|ايمان|iman|eman/.test(name)) return true;

  if (typeof window !== "undefined") {
    try {
      return localStorage.getItem("force_iman_account") === "true";
    } catch {}
  }
  return false;
}
