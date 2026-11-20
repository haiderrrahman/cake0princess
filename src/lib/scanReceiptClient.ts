import { detectProductCategory, calculateWarrantyExpiryDate, normalizeArabicText, PRODUCT_CATEGORIES } from "../app/admin/home-finance/productCategories";

// كل الأقسام المعتمدة بالنظام (أقسام المواد + أقسام المصاريف)
// سابقاً كان الطلب يطلب أقساماً من قائمة ويقبل من قائمة أخرى مختلفة، فيتحول أي قسم (سيارة، مطاعم، صيدلية...) إلى «سوبر ماركت»
const RECEIPT_CATEGORIES = [
  "سوبر ماركت", "السيارة والنقل", "مطاعم وكافيهات", "طلعات وجولات", "صيانة وترميم المنزل",
  "فواتير وخدمات منزلية", "ملابس وأحذية", "صيدلية وعلاج", "العناية بالطفل", "العناية الشخصية",
  "منظفات ومعقمات", "اللوازم المنزلية والأواني", "أثاث ومفروشات", "أجهزة كهربائية ومنزلية",
  "إلكترونيات وكمبيوتر", "هواتف واكسسوارات", "القرطاسية واللوازم المدرسية", "هدايا ومناسبات",
  "عطور وإكسسوارات وساعات", "كارتات وشحن", "السكائر والمعسل", "حيوانات أليفة وبيطرة", "أخرى ومتفرقات",
];

const ITEM_CATEGORIES = PRODUCT_CATEGORIES.map((c) => c.name);

const CATEGORY_ALIASES: Record<string, string> = {
  "سيارة": "السيارة والنقل",
  "سياره": "السيارة والنقل",
  "بنزين ووقود": "السيارة والنقل",
  "مطاعم وكوفيهات": "مطاعم وكافيهات",
  "مطعم": "مطاعم وكافيهات",
  "صيدلية": "صيدلية وعلاج",
  "صحة وطب": "صيدلية وعلاج",
  "تسوق وملابس": "ملابس وأحذية",
  "ملابس": "ملابس وأحذية",
  "فواتير وخدمات": "فواتير وخدمات منزلية",
  "منزلية": "اللوازم المنزلية والأواني",
  "اللوازم والأواني المنزلية": "اللوازم المنزلية والأواني",
  "كهربائية": "أجهزة كهربائية ومنزلية",
  "انشائية": "صيانة وترميم المنزل",
  "أخرى": "أخرى ومتفرقات",
  "دواء": "صيدلية وعلاج",
  "ادوية": "صيدلية وعلاج",
  "أدوية": "صيدلية وعلاج",
  "علاج": "صيدلية وعلاج",
  "خضار": "الفواكه والخضار",
  "فواكه": "الفواكه والخضار",
  "لحوم": "لحوم ودواجن وأسماك",
  "البان": "الألبان والأجبان",
  "ألبان": "الألبان والأجبان",
  "منظفات": "منظفات ومعقمات",
  "سكائر": "السكائر والمعسل",
  "وقود": "السيارة والنقل",
};

// أسطر ليست مواد (مجموع، ضريبة، خصم، باقي...)
const NON_ITEM_LINE = /^(ال)?(مجموع|اجمالي|الاجمالي|المبلغ الكلي|المبلغ|ضريبه|خصم|تخفيض|الباقي|باقي|نقدا|كاش|مدفوع|total|sub ?total|tax|vat|discount|change|cash|amount)(?=\s|$|:|\d)/i;

const FOOD_ITEM_CATEGORIES = new Set([
  "الفواكه والخضار", "المخبوزات والمعجنات", "لحوم ودواجن وأسماك", "الألبان والأجبان", "أساسيات ومؤونة الطبخ",
  "المعلبات والبقوليات", "الإفطار والمربيات", "مجمدات ومثلجات", "الصلصات والمقبلات", "التوابل والأعشاب",
  "المشروبات والعصائر", "المياه والشرب", "الشاي، القهوة والسكر", "حلويات وشوكولاته", "سناكات ومكسرات",
  "جاهز للأكل وسندويشات", "منظفات ومعقمات", "العناية الشخصية", "سوبر ماركت",
]);

function matchCategory(raw: any, allowed: string[]): string | null {
  const v = String(raw || "").trim();
  if (!v) return null;
  if (allowed.includes(v)) return v;
  const alias = CATEGORY_ALIASES[v];
  if (alias && allowed.includes(alias)) return alias;
  const n = normalizeArabicText(v);
  const hit = allowed.find((c) => normalizeArabicText(c) === n) || allowed.find((c) => normalizeArabicText(c).includes(n) || n.includes(normalizeArabicText(c)));
  return hit || null;
}

const CANDIDATE_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3.8-flash"
];

/** عدد الصور في كل طلب (الطلبات تُرسل بالتوازي للسرعة) */
const IMAGES_PER_BATCH = 4;
const REQUEST_TIMEOUT_MS = 45_000;

export interface ScannedReceiptData {
  storeName: string;
  date: string;
  category: string;
  totalAmount: number;
  items: {
    id: string;
    name: string;
    quantity: number;
    price: number;
    category?: string;
    place?: string;
    hasWarranty?: boolean;
    warrantyPeriod?: string;
    warrantyExpiryDate?: string;
    warrantyCardImage?: string;
  }[];
  /** أرقام الصور (من 0) التي جاءت منها هذه الفاتورة */
  imageIndexes?: number[];
}

function toImagePart(url: string) {
  let mimeType = "image/jpeg";
  let base64 = url;
  if (url.includes(";base64,")) {
    const parts = url.split(";base64,");
    const mimeMatch = parts[0].match(/data:(.*?)$/);
    if (mimeMatch) mimeType = mimeMatch[1];
    base64 = parts[1];
  }
  if (/heic|heif/i.test(mimeType)) mimeType = "image/jpeg";
  return { inline_data: { mime_type: mimeType, data: base64 } };
}

const SYSTEM_PROMPT = `أنت خبير بقراءة فواتير الشراء والإيصالات العراقية والعربية (مطبوعة أو مكتوبة باليد) بدقة عالية.
الصور المرفقة قد تحتوي على:
• فاتورة واحدة، أو
• عدة فواتير مختلفة من أماكن مختلفة (ماركت، صيدلية، محطة وقود، مطعم، محل ملابس...)، أو
• فاتورة طويلة مصوّرة بأكثر من صورة.

مهمتك: افصل كل فاتورة حقيقية لوحدها. الصور التي تكمّل نفس الفاتورة (نفس المحل والتاريخ وتكمّل القائمة) ادمجها بفاتورة واحدة بدون تكرار المواد الظاهرة بصورتين.

أرجع JSON فقط بهذا الشكل:
{
  "receipts": [
    {
      "imageIndexes": [0],
      "storeName": "اسم المحل كما يظهر (أو وصف قصير إن لم يظهر: صيدلية، محطة وقود...)",
      "date": "YYYY-MM-DD أو فارغ إن لم يظهر",
      "category": "قسم الفاتورة",
      "totalAmount": 0,
      "items": [
        { "name": "اسم المادة واضح", "quantity": 1, "price": 0, "category": "قسم المادة", "hasWarranty": false, "warrantyPeriod": "" }
      ]
    }
  ]
}

قواعد:
1. imageIndexes = أرقام الصور (كما مكتوبة قبل كل صورة) التي تخص هذه الفاتورة.
2. category للفاتورة من: ${RECEIPT_CATEGORIES.join("، ")}.
3. category لكل مادة من: ${ITEM_CATEGORIES.join("، ")}. (طماطة ← الفواكه والخضار، روبة ← الألبان والأجبان، بنزين ← السيارة والنقل، باراسيتامول ← صيدلية وعلاج).
4. price = السعر الإجمالي للسطر (الكمية × سعر المفرد) كرقم صحيح بالدينار، بدون فواصل أو "د.ع".
5. إذا الأسعار مكتوبة بالآلاف بشكل واضح (مثل 5 أو 2.5 بفاتورة يدوية والمجموع بالآلاف) حوّلها لدينار كامل (5000، 2500).
6. لا تضع أسطر المجموع والضريبة والخصم والباقي والنقد كمواد.
7. إذا ذُكر ضمان أو كفالة لمادة ضع hasWarranty: true واكتب warrantyPeriod.
8. إذا الصورة ليست فاتورة أو غير مقروءة تجاهلها.
9. JSON صالح فقط، بدون أي نص آخر.`;

async function callGemini(apiKey: string, urls: string[], offset: number): Promise<any[]> {
  const parts: any[] = [{ text: SYSTEM_PROMPT }];
  urls.forEach((u, i) => {
    parts.push({ text: `صورة رقم ${offset + i}:` });
    parts.push(toImagePart(u));
  });
  const payload = { contents: [{ parts }], generationConfig: { temperature: 0.1, response_mime_type: "application/json" } };

  let lastError: any = null;
  for (const model of CANDIDATE_MODELS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: ctrl.signal }
      );
      if (res.status === 200) {
        const data = await res.json();
        const text = String(data.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
        if (!text) continue;
        const cleaned = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
        const parsed = JSON.parse(cleaned);
        const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.receipts) ? parsed.receipts : parsed ? [parsed] : [];
        // أرقام الصور مطلقة؛ إن أرجع الموديل أرقاماً نسبية للدفعة نصححها
        return list.map((r: any) => ({
          ...r,
          imageIndexes: (Array.isArray(r.imageIndexes) ? r.imageIndexes : [])
            .map((n: any) => Number(n))
            .filter((n: number) => Number.isFinite(n))
            .map((n: number) => (n < offset ? n + offset : n)),
        }));
      }
      lastError = `${model}: ${res.status} ${(await res.text()).slice(0, 120)}`;
      console.warn("Gemini", lastError);
    } catch (err: any) {
      lastError = err?.name === "AbortError" ? `${model}: انتهت المهلة` : err?.message;
      console.warn("Gemini", lastError);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`تعذر قراءة الصور بالذكاء الاصطناعي حالياً (${lastError || "خطأ غير معروف"}). تأكد من الإنترنت ووضوح الصورة.`);
}

function normalizeDate(raw: any): string {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  let d = String(raw || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return todayStr;
  const [y, m, day] = d.split("-");
  // طابعات بعض المحلات تطبع سنة قديمة
  if (Number(y) !== now.getFullYear()) d = `${now.getFullYear()}-${m}-${day}`;
  return d > todayStr ? todayStr : d;
}

function normalizeReceipt(r: any): ScannedReceiptData {
  let storeName = String(r.storeName || "").trim();
  if (["غير محدد", "فاتورة مشتريات", "فاتورة", "متجر"].includes(storeName)) storeName = "";
  const date = normalizeDate(r.date);

  const items = (Array.isArray(r.items) ? r.items : [])
    .filter((it: any) => {
      const n = String(it?.name || "").trim();
      return n && !NON_ITEM_LINE.test(normalizeArabicText(n));
    })
    .map((it: any, idx: number) => {
      const name = String(it.name).trim();
      const category = matchCategory(it.category, ITEM_CATEGORIES) || detectProductCategory(name) || "أخرى ومتفرقات";
      const hasWarranty = Boolean(it.hasWarranty || name.includes("ضمان") || name.includes("كفالة"));
      const warrantyPeriod = String(it.warrantyPeriod || "").trim() || (hasWarranty ? "سنة واحدة" : undefined);
      return {
        id: `item-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        quantity: Number(it.quantity) > 0 ? Number(it.quantity) : 1,
        price: Math.max(0, Math.round(Number(String(it.price ?? 0).replace(/,/g, "")) || 0)),
        category,
        place: storeName,
        hasWarranty,
        warrantyPeriod,
        warrantyExpiryDate: hasWarranty && warrantyPeriod ? calculateWarrantyExpiryDate(date, warrantyPeriod) : undefined,
      };
    });

  // قسم الفاتورة: من الموديل إن كان معتمداً، وإلا من أغلب أقسام المواد
  let category = matchCategory(r.category, RECEIPT_CATEGORIES);
  if (!category) {
    const counts = new Map<string, number>();
    for (const it of items) {
      const c = FOOD_ITEM_CATEGORIES.has(it.category) ? "سوبر ماركت" : matchCategory(it.category, RECEIPT_CATEGORIES) || "سوبر ماركت";
      counts.set(c, (counts.get(c) || 0) + it.price);
    }
    category = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "سوبر ماركت";
  }

  // مادة غير معروفة بمحل متخصص (صيدلية، سيارات، ملابس...) تاخذ قسم المحل
  if (category !== "سوبر ماركت" && category !== "أخرى ومتفرقات") {
    const itemCat = matchCategory(category, ITEM_CATEGORIES);
    if (itemCat) for (const it of items) if (it.category === "أخرى ومتفرقات") it.category = itemCat;
  }

  const itemsTotal = items.reduce((s: number, it: any) => s + it.price, 0);
  const total = Number(String(r.totalAmount ?? 0).replace(/,/g, "")) || itemsTotal;

  return {
    storeName: storeName || category,
    date,
    category,
    totalAmount: total,
    items,
    imageIndexes: r.imageIndexes || [],
  };
}

/** دمج أجزاء نفس الفاتورة إذا وقعت بدفعتين مختلفتين (نفس المحل ونفس التاريخ) */
function mergeSplitReceipts(list: ScannedReceiptData[]): ScannedReceiptData[] {
  const out: ScannedReceiptData[] = [];
  for (const r of list) {
    const key = `${normalizeArabicText(r.storeName)}|${r.date}`;
    const prev = out.find((x) => `${normalizeArabicText(x.storeName)}|${x.date}` === key);
    if (!prev) {
      out.push({ ...r, items: [...r.items] });
      continue;
    }
    const seen = new Set(prev.items.map((i) => `${normalizeArabicText(i.name)}|${i.price}`));
    for (const it of r.items) {
      const k = `${normalizeArabicText(it.name)}|${it.price}`;
      if (!seen.has(k)) {
        prev.items.push(it);
        seen.add(k);
      }
    }
    prev.imageIndexes = [...(prev.imageIndexes || []), ...(r.imageIndexes || [])];
    prev.totalAmount = Math.max(prev.totalAmount, r.totalAmount, prev.items.reduce((s, i) => s + i.price, 0));
  }
  return out;
}

/**
 * قراءة صورة أو عدة صور فواتير — تُرجع كل فاتورة لوحدها.
 * الصور تُرسل بدفعات متوازية (أسرع)، والفاتورة المقسومة على دفعتين تُدمج تلقائياً.
 */
export async function scanReceiptsWithGemini(
  base64DataUrls: string | string[],
  onProgress?: (status: string) => void
): Promise<ScannedReceiptData[]> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("مفتاح الذكاء الاصطناعي (NEXT_PUBLIC_GEMINI_API_KEY) غير مهيأ في متغيرات البيئة");

  const urls = (Array.isArray(base64DataUrls) ? base64DataUrls : [base64DataUrls]).filter(Boolean);
  if (urls.length === 0) throw new Error("لم يتم تمرير أي صورة للفاتورة");

  const batches: { urls: string[]; offset: number }[] = [];
  for (let i = 0; i < urls.length; i += IMAGES_PER_BATCH) batches.push({ urls: urls.slice(i, i + IMAGES_PER_BATCH), offset: i });

  onProgress?.(urls.length > 1 ? `جاري قراءة ${urls.length} صور بالذكاء الاصطناعي ⚡...` : "جاري قراءة الفاتورة بالذكاء الاصطناعي ⚡...");

  let done = 0;
  const settled = await Promise.allSettled(
    batches.map((b) =>
      callGemini(apiKey, b.urls, b.offset).then((r) => {
        done += b.urls.length;
        if (batches.length > 1) onProgress?.(`تمت قراءة ${done} من ${urls.length} صور...`);
        return r;
      })
    )
  );

  const raw: any[] = [];
  const errors: string[] = [];
  settled.forEach((s) => (s.status === "fulfilled" ? raw.push(...s.value) : errors.push(s.reason?.message || "خطأ")));
  if (raw.length === 0) throw new Error(errors[0] || "لم يُعثر على فاتورة مقروءة بالصور");

  const receipts = mergeSplitReceipts(raw.map(normalizeReceipt)).filter((r) => r.items.length > 0 || r.totalAmount > 0);
  if (receipts.length === 0) throw new Error("لم يُعثر على مواد أو مبالغ مقروءة بالصور. صوّر الفاتورة بإضاءة أوضح.");
  if (errors.length) onProgress?.(`تعذرت قراءة بعض الصور: ${errors[0]}`);
  // الأقدم أولاً
  return receipts.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * للتوافق: قراءة الصور كفاتورة واحدة (تُدمج كل الفواتير، وكل مادة تحمل اسم محلها).
 */
export async function scanReceiptWithGemini(
  base64DataUrls: string | string[],
  onProgress?: (status: string) => void
): Promise<ScannedReceiptData> {
  const receipts = await scanReceiptsWithGemini(base64DataUrls, onProgress);
  if (receipts.length === 1) return receipts[0];
  const items = receipts.flatMap((r) => r.items.map((it) => ({ ...it, place: it.place || r.storeName })));
  const main = [...receipts].sort((a, b) => b.totalAmount - a.totalAmount)[0];
  return {
    storeName: receipts.map((r) => r.storeName).join(" + "),
    date: receipts[receipts.length - 1].date,
    category: main.category,
    totalAmount: receipts.reduce((s, r) => s + r.totalAmount, 0),
    items,
    imageIndexes: receipts.flatMap((r) => r.imageIndexes || []),
  };
}
