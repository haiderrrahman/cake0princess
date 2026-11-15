"use client";

/**
 * مصدر واحد لطلبات السوشيال (external_orders) ولدليل الزبائن.
 *
 * لماذا هذا الملف؟
 *  - سابقاً كانت كل صفحة تفتح مستمعاً خاصاً بها + getDocs إضافي، فتُحمَّل
 *    المجموعة كاملة 2-3 مرات عند كل فتح.
 *  - الصور كانت تُحفظ كنص base64 داخل مستند الطلب ثم يُنسخ كل شيء إلى
 *    localStorage (حدّه 5MB) فيفشل الكاش بصمت وتظهر بيانات قديمة أو لا شيء.
 *  - اقتراح الأسماء كان يعتمد فقط على مجموعة customers؛ إذا فشلت قراءتها
 *    (صلاحيات) أو لم يُسجَّل الزبون فيها لا يظهر أي اقتراح.
 *
 * الآن: مستمع واحد مشترك، كاش خفيف بدون صور، ودليل زبائن يُبنى من الطلبات
 * نفسها مدموجاً مع customers.
 */

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteField,
  doc,
  getDocs,
  getDocsFromServer,
  increment,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";

// ───────────────────────── أدوات عامة ─────────────────────────

/** تحويل أي صيغة تاريخ (Timestamp / {seconds} / ISO / رقم) إلى ميلي ثانية */
export function toMillis(v: any): number {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (typeof v?.toMillis === "function") return v.toMillis();
  if (typeof v?.toDate === "function") return v.toDate().getTime();
  if (typeof v?.seconds === "number") return v.seconds * 1000;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/** توحيد النص العربي للمطابقة: همزات، تاء مربوطة، ألف مقصورة، تشكيل، أرقام */
export function normalizeArabic(input: any): string {
  if (input === null || input === undefined) return "";
  return String(input)
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "") // تشكيل وتطويل
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/\s+/g, " ")
    .trim();
}

const digitsOnly = (s: any) => normalizeArabic(s).replace(/\D/g, "");

export const isDataUrl = (v: any): v is string =>
  typeof v === "string" && v.startsWith("data:");

/** أفضل صورة متاحة للطلب */
export function orderImage(o: any): string {
  return o?.imageUrl || o?.tempImageUrl || o?.image || "";
}

/** هل الطلب يحمل صورة مخزنة داخل المستند (base64)؟ */
export function hasEmbeddedImage(o: any): boolean {
  return isDataUrl(o?.imageUrl) || isDataUrl(o?.tempImageUrl) || isDataUrl(o?.image);
}

// ───────────────────────── الكاش الخفيف ─────────────────────────

const CACHE_KEY = "cache_social_orders_lite_v3";
const LEGACY_KEYS = ["cache_external_orders_v2", "cache_external_orders_all"];

/** نسخة خفيفة للكاش: بدون صور base64 وبتواريخ نصية */
function toLite(o: any): any {
  const lite: any = { ...o };
  for (const k of ["imageUrl", "tempImageUrl", "image"]) {
    if (isDataUrl(lite[k])) delete lite[k];
  }
  if (lite.createdAt && typeof lite.createdAt !== "string") {
    const ms = toMillis(lite.createdAt);
    lite.createdAt = ms ? new Date(ms).toISOString() : null;
  }
  if (lite.lastOrder && typeof lite.lastOrder !== "string") {
    const ms = toMillis(lite.lastOrder);
    lite.lastOrder = ms ? new Date(ms).toISOString() : null;
  }
  return lite;
}

function readCache(): any[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.data) ? parsed.data : [];
  } catch {
    return [];
  }
}

let cacheTimer: ReturnType<typeof setTimeout> | null = null;
function writeCacheSoon(orders: any[]) {
  if (typeof window === "undefined") return;
  if (cacheTimer) clearTimeout(cacheTimer);
  cacheTimer = setTimeout(() => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: orders.map(toLite) }));
    } catch {
      // إذا امتلأ التخزين نحذف الكاش بدل إبقاء نسخة قديمة مضللة
      try { localStorage.removeItem(CACHE_KEY); } catch {}
    }
  }, 400);
}

let legacyCleaned = false;
function cleanLegacyCaches() {
  if (legacyCleaned || typeof window === "undefined") return;
  legacyCleaned = true;
  // المفاتيح القديمة كانت تحمل الصور وتملأ حصة localStorage (5MB) فتُفشل كاش بقية الصفحات
  for (const k of LEGACY_KEYS) {
    try { localStorage.removeItem(k); } catch {}
  }
}

// ───────────────────────── المخزن المشترك ─────────────────────────

export interface SocialOrdersState {
  orders: any[];
  /** true حتى يصل أول رد (من الكاش أو من الخادم) */
  loading: boolean;
  /** true إذا كانت البيانات المعروضة من الكاش ولم يؤكدها الخادم بعد */
  fromCache: boolean;
  /** رسالة خطأ مقروءة إن فشل الاتصال/الصلاحيات */
  error: string | null;
}

let state: SocialOrdersState = { orders: [], loading: true, fromCache: false, error: null };
const listeners = new Set<(s: SocialOrdersState) => void>();
let unsubscribe: (() => void) | null = null;
let stopTimer: ReturnType<typeof setTimeout> | null = null;
let hydrated = false;
let retryCount = 0;

function sortOrders(list: any[]): any[] {
  return list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
}

function setState(patch: Partial<SocialOrdersState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
}

export function describeFirebaseError(err: any): string {
  const code = String(err?.code || "");
  if (code.includes("permission-denied") || code.includes("unauthorized")) {
    return "لا توجد صلاحية (قواعد Firebase ترفض العملية). تأكد من تسجيل الدخول بحساب الأدمن ومن نشر القواعد الجديدة.";
  }
  if (code.includes("unavailable") || code.includes("network") || code.includes("retry-limit")) {
    return "تعذر الاتصال بالخادم. تحقق من الإنترنت.";
  }
  if (code.includes("resource-exhausted") || code.includes("quota")) {
    return "تم تجاوز الحصة المسموحة في Firebase.";
  }
  return err?.message || "خطأ غير معروف";
}

function applyDocs(docs: any[], fromCache: boolean) {
  const orders = sortOrders(docs);
  setState({ orders, loading: false, fromCache, error: null });
  writeCacheSoon(orders);
}

function start() {
  if (stopTimer) {
    clearTimeout(stopTimer);
    stopTimer = null;
  }
  if (unsubscribe) return;

  if (!hydrated) {
    hydrated = true;
    cleanLegacyCaches();
    const cached = readCache();
    if (cached.length > 0) {
      state = { orders: sortOrders(cached), loading: false, fromCache: true, error: null };
    }
  }

  unsubscribe = onSnapshot(
    collection(db, "external_orders"),
    (snap) => {
      retryCount = 0;
      applyDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })), false);
    },
    (err) => {
      console.error("[socialOrders] listener error:", err);
      unsubscribe = null;
      setState({ loading: false, error: describeFirebaseError(err) });
      // إعادة محاولة محدودة (مثلاً: الجلسة لم تكن جاهزة لحظة الفتح، أو انقطاع مؤقت)
      if (retryCount < 3 && listeners.size > 0) {
        retryCount += 1;
        setTimeout(() => {
          if (!unsubscribe && listeners.size > 0) start();
        }, 2500 * retryCount);
      }
    }
  );
}

function stopLater() {
  if (stopTimer) clearTimeout(stopTimer);
  // نُبقي المستمع دقيقتين بعد مغادرة آخر صفحة حتى يكون الرجوع فورياً
  stopTimer = setTimeout(() => {
    if (listeners.size === 0 && unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }, 120_000);
}

/** اشتراك مباشر (لغير مكونات React أو للمنطق داخل useEffect) */
export function subscribeSocialOrders(cb: (s: SocialOrdersState) => void): () => void {
  listeners.add(cb);
  start();
  cb(state);
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) stopLater();
  };
}

/** تحديث يدوي من الخادم مباشرة */
export async function refreshSocialOrders(): Promise<number> {
  const snap = await getDocsFromServer(collection(db, "external_orders"));
  applyDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })), false);
  if (!unsubscribe && listeners.size > 0) start();
  return snap.size;
}

/** تعديل محلي فوري (تفاؤلي) ريثما يصل تحديث المستمع */
export function patchSocialOrderLocally(id: string, patch: Record<string, any>) {
  setState({ orders: state.orders.map((o) => (o.id === id ? { ...o, ...patch } : o)) });
}

/** تعديل محلي عام بنفس أسلوب setState(prev => ...) */
export function mutateSocialOrdersLocally(updater: any[] | ((prev: any[]) => any[])) {
  const next = typeof updater === "function" ? updater(state.orders) : updater;
  setState({ orders: next });
}

/** Hook: طلبات السوشيال من المخزن المشترك */
export function useSocialOrders(): SocialOrdersState {
  // نبدأ بحالة فارغة ثابتة لتطابق HTML المُصدَّر (لا أخطاء hydration) ثم نملأ فوراً بعد التركيب
  const [snapshot, setSnapshot] = useState<SocialOrdersState>({
    orders: [],
    loading: true,
    fromCache: false,
    error: null,
  });
  useEffect(() => subscribeSocialOrders(setSnapshot), []);
  return snapshot;
}

// ───────────────────────── دليل الزبائن والاقتراحات ─────────────────────────

export interface CustomerSuggestion {
  key: string;            // الاسم بعد التوحيد
  name: string;
  phone: string;
  address: string;
  platform: string;
  locationUrl: string;
  ordersCount: number;
  lastOrderAt: number;
  /** معرف مستند customers إن وُجد */
  customerId?: string;
  /** بيانات مستند customers الخام (للنقاط والمجاميع) */
  customerDoc?: any;
}

let customersCache: any[] = [];
let customersLoaded = false;
let customersPromise: Promise<any[]> | null = null;
const customerListeners = new Set<(c: any[]) => void>();

/** تحميل مجموعة customers مرة واحدة للجلسة؛ الفشل (صلاحيات) لا يكسر شيئاً */
export function loadCustomers(force = false): Promise<any[]> {
  if (customersPromise && !force) return customersPromise;
  customersPromise = getDocs(collection(db, "customers"))
    .then((snap) => {
      customersCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      customersLoaded = true;
      customerListeners.forEach((l) => l(customersCache));
      return customersCache;
    })
    .catch((err) => {
      console.warn("[socialOrders] تعذرت قراءة customers، سيُبنى الدليل من الطلبات فقط:", err?.code || err);
      customersLoaded = true;
      customersPromise = null; // نسمح بمحاولة لاحقة
      return customersCache;
    });
  return customersPromise;
}

/** إضافة/تحديث زبون في الكاش المحلي بعد الحفظ حتى يظهر في الاقتراحات فوراً */
export function upsertCustomerLocally(customer: any) {
  if (!customer?.id) return;
  const idx = customersCache.findIndex((c) => c.id === customer.id);
  customersCache =
    idx === -1
      ? [...customersCache, customer]
      : customersCache.map((c, i) => (i === idx ? { ...c, ...customer } : c));
  customerListeners.forEach((l) => l(customersCache));
}

/** بناء الدليل: الطلبات (الأحدث أولاً) + مستندات customers */
export function buildCustomerDirectory(orders: any[], customers: any[]): CustomerSuggestion[] {
  const map = new Map<string, CustomerSuggestion>();

  const ensure = (rawName: any): CustomerSuggestion | null => {
    const name = String(rawName ?? "").replace(/\s+/g, " ").trim();
    const key = normalizeArabic(name);
    if (!key) return null;
    let entry = map.get(key);
    if (!entry) {
      entry = { key, name, phone: "", address: "", platform: "", locationUrl: "", ordersCount: 0, lastOrderAt: 0 };
      map.set(key, entry);
    }
    return entry;
  };

  // الطلبات مرتبة من الأحدث للأقدم، فأول قيمة غير فارغة هي الأحدث
  for (const o of orders) {
    const e = ensure(o?.customerName);
    if (!e) continue;
    if (o.status !== "cancelled" && o.status !== "rejected") e.ordersCount += 1;
    const t = toMillis(o.createdAt) || toMillis(o.deliveryDate);
    if (t > e.lastOrderAt) e.lastOrderAt = t;
    if (!e.phone && o.customerPhone) e.phone = String(o.customerPhone);
    if (!e.address && o.address) e.address = String(o.address);
    if (!e.platform && o.platform) e.platform = String(o.platform);
    if (!e.locationUrl && o.locationUrl) e.locationUrl = String(o.locationUrl);
  }

  for (const c of customers) {
    const e = ensure(c?.name);
    if (!e) continue;
    // لو تكرر الاسم في customers نُبقي المستند الأغنى (الأكثر طلبات)
    if (!e.customerDoc || Number(c.ordersCount || 0) > Number(e.customerDoc.ordersCount || 0)) {
      e.customerId = c.id;
      e.customerDoc = c;
    }
    if (!e.phone && c.phone) e.phone = String(c.phone);
    if (!e.address && c.address) e.address = String(c.address);
    if (!e.platform && c.platform) e.platform = String(c.platform);
    if (!e.locationUrl && c.locationUrl) e.locationUrl = String(c.locationUrl);
    if (!e.ordersCount && c.ordersCount) e.ordersCount = Number(c.ordersCount) || 0;
    const t = toMillis(c.lastOrder) || toMillis(c.createdAt);
    if (t > e.lastOrderAt) e.lastOrderAt = t;
  }

  return Array.from(map.values()).sort((a, b) => b.lastOrderAt - a.lastOrderAt);
}

/** بحث في الدليل بالاسم (مع توحيد العربية) أو برقم الهاتف */
export function searchCustomers(directory: CustomerSuggestion[], query: string, limit = 8): CustomerSuggestion[] {
  const q = normalizeArabic(query);
  if (!q) return directory.slice(0, limit);
  const qDigits = q.replace(/\D/g, "");
  const tokens = q.split(" ").filter(Boolean);

  const scored: { s: CustomerSuggestion; score: number }[] = [];
  for (const s of directory) {
    let score = -1;
    if (s.key === q) score = 0;
    else if (s.key.startsWith(q)) score = 1;
    else if (s.key.includes(q)) score = 2;
    else if (tokens.length > 1 && tokens.every((t) => s.key.includes(t))) score = 3;
    else if (qDigits.length >= 3 && digitsOnly(s.phone).includes(qDigits)) score = 4;
    if (score >= 0) scored.push({ s, score });
  }
  scored.sort((a, b) => a.score - b.score || b.s.lastOrderAt - a.s.lastOrderAt);
  return scored.slice(0, limit).map((x) => x.s);
}

/** إيجاد زبون مطابق تماماً (بعد التوحيد) */
export function findCustomer(directory: CustomerSuggestion[], name: string): CustomerSuggestion | undefined {
  const key = normalizeArabic(name);
  if (!key) return undefined;
  return directory.find((s) => s.key === key);
}

/** Hook: دليل الزبائن جاهز للاقتراحات */
export function useCustomerDirectory(): { directory: CustomerSuggestion[]; ready: boolean } {
  const { orders, loading } = useSocialOrders();
  const [customers, setCustomers] = useState<any[]>([]);
  const [customersReady, setCustomersReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const onChange = (c: any[]) => { if (alive) setCustomers(c); };
    customerListeners.add(onChange);
    if (customersLoaded) {
      setCustomers(customersCache);
      setCustomersReady(true);
    }
    loadCustomers().then((c) => {
      if (!alive) return;
      setCustomers(c);
      setCustomersReady(true);
    });
    return () => {
      alive = false;
      customerListeners.delete(onChange);
    };
  }, []);

  const directory = useMemo(() => buildCustomerDirectory(orders, customers), [orders, customers]);
  return { directory, ready: !loading || customersReady };
}

/**
 * حفظ/تحديث بطاقة الزبون في customers عند إضافة أو تعديل طلب.
 *  - orderAmount: مبلغ الطلب الحالي.
 *  - previousAmount: عند التعديل فقط (مبلغ الطلب قبل التعديل) حتى لا يُحتسب الطلب مرتين.
 * فشل هذه العملية لا يمنع حفظ الطلب نفسه؛ تُرجع undefined.
 */
export async function saveCustomerFromOrder(
  directory: CustomerSuggestion[],
  data: { name: string; phone?: string; address?: string; platform?: string; locationUrl?: string },
  amounts: { orderAmount: number; previousAmount?: number }
): Promise<string | undefined> {
  const name = String(data.name || "").replace(/\s+/g, " ").trim();
  if (!name) return undefined;
  const isEdit = amounts.previousAmount !== undefined;
  const existing = findCustomer(directory, name);
  const prev = existing?.customerDoc;

  try {
    if (existing?.customerId) {
      const patch: Record<string, any> = {
        phone: data.phone || prev?.phone || existing.phone || "",
        address: data.address || prev?.address || existing.address || "",
        platform: data.platform || prev?.platform || existing.platform || "واتساب",
        ...(data.locationUrl ? { locationUrl: data.locationUrl } : {}),
      };
      if (isEdit) {
        const diff = amounts.orderAmount - (amounts.previousAmount || 0);
        if (diff !== 0) {
          patch.totalSpent = increment(diff);
          patch.points = increment(Math.floor(amounts.orderAmount / 1000) - Math.floor((amounts.previousAmount || 0) / 1000));
        }
      } else {
        patch.totalSpent = increment(amounts.orderAmount);
        patch.points = increment(Math.floor(amounts.orderAmount / 1000));
        patch.ordersCount = increment(1);
        patch.lastOrder = serverTimestamp();
      }
      await updateDoc(doc(db, "customers", existing.customerId), patch);
      upsertCustomerLocally({
        id: existing.customerId,
        name: prev?.name || name,
        phone: patch.phone,
        address: patch.address,
        platform: patch.platform,
        ...(data.locationUrl ? { locationUrl: data.locationUrl } : {}),
      });
      return existing.customerId;
    }

    const fresh = {
      name,
      phone: data.phone || existing?.phone || "",
      address: data.address || existing?.address || "",
      platform: data.platform || existing?.platform || "واتساب",
      locationUrl: data.locationUrl || existing?.locationUrl || "",
      points: Math.floor(amounts.orderAmount / 1000),
      totalSpent: amounts.orderAmount,
      ordersCount: 1,
    };
    const refDoc = await addDoc(collection(db, "customers"), {
      ...fresh,
      createdAt: serverTimestamp(),
      lastOrder: serverTimestamp(),
    });
    upsertCustomerLocally({ id: refDoc.id, ...fresh });
    return refDoc.id;
  } catch (err) {
    console.warn("[socialOrders] تعذر حفظ بطاقة الزبون (الطلب سيُحفظ على أي حال):", err);
    return undefined;
  }
}

/** انتظار وعد لمدة أقصاها ms ثم المتابعة بدون نتيجته */
export function withSoftTimeout<T>(p: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([p, new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms))]);
}

// ───────────────────────── الصور ─────────────────────────

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * صورة مصغرة جداً (≈10-25KB) تُحفظ داخل مستند الطلب للعرض الفوري فقط،
 * ريثما تُرفع الصورة الكاملة إلى Storage. لا تُثقل المستند ولا الكاش.
 */
export async function makeInlineThumbnail(file: Blob, maxDim = 320, quality = 0.6): Promise<string> {
  if (typeof window === "undefined") return "";
  try {
    const src = await readAsDataUrl(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("image decode failed"));
      el.src = src;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return "";
  }
}

/** رفع صورة الطلب إلى Storage وإرجاع الرابط */
export async function uploadOrderImage(orderId: string, file: Blob, ext = "jpg"): Promise<string> {
  const fileRef = ref(storage, `external_orders/${orderId}_${Date.now()}.${ext}`);
  await uploadBytes(fileRef, file, { contentType: file.type || "image/jpeg" });
  return getDownloadURL(fileRef);
}

/**
 * رفع الصورة في الخلفية ثم تحديث الطلب بالرابط النهائي.
 * عند الفشل تبقى المصغّرة داخل الطلب ويُعاد سبب الفشل الحقيقي.
 */
export async function attachOrderImage(orderId: string, file: Blob): Promise<{ ok: boolean; url?: string; reason?: string }> {
  try {
    const ext = (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const url = await uploadOrderImage(orderId, file, ext);
    await updateDoc(doc(db, "external_orders", orderId), {
      imageUrl: url,
      tempImageUrl: deleteField(),
      imagePending: deleteField(),
    });
    return { ok: true, url };
  } catch (err) {
    console.error("[socialOrders] image upload failed:", err);
    return { ok: false, reason: describeFirebaseError(err) };
  }
}

export interface MigrationResult {
  found: number;
  migrated: number;
  failed: number;
  /** سبب أول فشل (غالباً صلاحيات Storage) */
  reason?: string;
}

/**
 * نقل الصور المخزنة داخل مستندات الطلبات (base64) إلى Firebase Storage.
 * تُشغَّل مرة واحدة؛ بعدها يصير تحميل الصفحة خفيفاً جداً.
 */
export async function migrateEmbeddedImages(
  onProgress?: (done: number, total: number) => void
): Promise<MigrationResult> {
  const snap = await getDocsFromServer(collection(db, "external_orders"));
  const targets = snap.docs.filter((d) => hasEmbeddedImage(d.data()));
  const result: MigrationResult = { found: targets.length, migrated: 0, failed: 0 };

  let done = 0;
  for (const d of targets) {
    const data = d.data() as any;
    try {
      // نختار أكبر نسخة (الأعلى جودة) من الحقول الثلاثة
      const candidates = [data.imageUrl, data.tempImageUrl, data.image].filter(isDataUrl) as string[];
      const best = candidates.sort((a, b) => b.length - a.length)[0];
      const blob = await (await fetch(best)).blob();
      const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
      const url = await uploadOrderImage(`migrated_${d.id}`, blob, ext);
      const patch: Record<string, any> = { imageUrl: url, tempImageUrl: deleteField() };
      if (isDataUrl(data.image)) patch.image = deleteField();
      await updateDoc(doc(db, "external_orders", d.id), patch);
      result.migrated += 1;
    } catch (err: any) {
      result.failed += 1;
      if (!result.reason) result.reason = describeFirebaseError(err);
      // صلاحيات Storage مرفوضة: لا فائدة من تكرار المحاولة على البقية
      if (String(err?.code || "").includes("unauthorized")) {
        result.failed += targets.length - done - 1;
        break;
      }
    }
    done += 1;
    onProgress?.(done, targets.length);
  }
  return result;
}

// ───────────────────────── مبالغ ─────────────────────────

/** إدخال المبالغ بالآلاف: 55 تعني 55,000 د.ع */
export function parseIqdInput(val: string | number): number {
  let num = Number(String(val ?? "").replace(/,/g, "")) || 0;
  if (num > 0 && num < 1000) num *= 1000;
  return num;
}
