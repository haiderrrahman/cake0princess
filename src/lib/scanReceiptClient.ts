import { detectProductCategory, calculateWarrantyExpiryDate } from "../app/admin/home-finance/productCategories";

const VALID_CATEGORIES = [
  "سوبر ماركت",
  "مطاعم وكوفيهات",
  "منزلية",
  "انشائية",
  "مواد سفري",
  "كهربائية",
  "صيدلية وعلاج",
  "سيارة",
  "تسوق وملابس",
  "فواتير وخدمات",
  "أخرى"
];

const CANDIDATE_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3.8-flash"
];

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
}

export async function scanReceiptWithGemini(
  base64DataUrls: string | string[],
  onProgress?: (status: string) => void
): Promise<ScannedReceiptData> {
  const apiKey =
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("مفتاح الذكاء الاصطناعي (NEXT_PUBLIC_GEMINI_API_KEY) غير مهيأ في متغيرات البيئة");
  }

  const urls = Array.isArray(base64DataUrls) ? base64DataUrls : [base64DataUrls];
  if (urls.length === 0) {
    throw new Error("لم يتم تمرير أي صورة للفاتورة");
  }

  onProgress?.(`جاري تجهيز ${urls.length > 1 ? `${urls.length} صور للفاتورة` : "صورة الفاتورة"}...`);

  const imageParts = urls.map((url) => {
    let mimeType = "image/jpeg";
    let base64 = url;

    if (url.includes(";base64,")) {
      const parts = url.split(";base64,");
      const mimeMatch = parts[0].match(/data:(.*?)$/);
      if (mimeMatch) mimeType = mimeMatch[1];
      base64 = parts[1];
    }

    if (mimeType.toLowerCase().includes("heic") || mimeType.toLowerCase().includes("heif")) {
      mimeType = "image/jpeg";
    }

    return {
      inline_data: {
        mime_type: mimeType,
        data: base64
      }
    };
  });

  onProgress?.(urls.length > 1 ? "جاري قراءة بنود الفواتير المرفقة بالذكاء الاصطناعي ⚡..." : "جاري قراءة بنود الفاتورة بالذكاء الاصطناعي ⚡...");

  const systemPrompt = `أنت مساعد خبير متخصص في قراءة وتحليل فواتير الشراء والإيصالات باللغة العربية والعراقية بدقة 100%.
قم باستخراج بيانات الفاتورة المرفقة وتحويلها إلى كائن JSON بالهيكل التالي:
{
  "storeName": "اسم المتجر أو السوبرماركت بدقة كما يظهر في الفاتورة",
  "date": "YYYY-MM-DD", // تاريخ الشراء إذا وجد، وإذا لم يوجد استخدم تاريخ اليوم بصيغة YYYY-MM-DD
  "category": "سوبر ماركت", // اختر الفئة الأنسب من: ["سوبر ماركت", "مطاعم وكوفيهات", "طلعات وجولات", "منزلية", "انشائية", "مواد سفري", "كهربائية", "صيدلية وعلاج", "سيارة", "تسوق وملابس", "فواتير وخدمات", "أخرى"]
  "totalAmount": 0, // المبلغ الإجمالي للفاتورة بالأرقام فقط (بدون فواصل أو نصوص)
  "items": [
    {
      "name": "اسم المادة أو المنتج كاملاً وواضحاً",
      "quantity": 1, // الكمية كرقم (إذا غير واضحة تكون 1)
      "price": 1000, // السعر الإجمالي لهذه المادة (الكمية × سعر المفرد) كرقم صحيح
      "category": "الفواكه والخضار", // اختر فئة المادة الأنسب من: ["الفواكه والخضار", "المخبوزات والمعجنات", "لحوم ودواجن", "مجمدات", "الألبان والأجبان", "المشروبات", "سناكات", "الشاي، القهوة والسكر", "الإفطار", "جاهز للأكل", "أساسيات الطبخ", "المياه", "المعلبات", "الصلصات", "القرطاسية واللوازم المدرسية", "العناية الشخصية", "منتجات صحية", "حلويات", "هواتف ذكية", "اللوازم المنزلية", "التوابل والاعشاب", "العناية بالطفل", "منظفات", "السكائر", "أجهزة منزلية", "صيدلية", "سفريات وورقيات", "كارتات"]
      "hasWarranty": false, // true إذا ذكرت الفاتورة ضمان أو كفالة لهذا المنتج (خاصة للأجهزة والإلكترونيات)
      "warrantyPeriod": "سنة واحدة" // فترة الضمان إن وجدت (مثال: "6 أشهر"، "سنة واحدة"، "سنتين")
    }
  ]
}

قواعد هامة جداً:
1. استخرج كافة المواد في الفاتورة بدون أي استثناء أو إهمال.
2. حقل "price" لكل مادة يجب أن يمثل السعر الإجمالي للمادة (الكمية × سعر المفرد).
3. حدد فئة كل مادة (category) بدقة من قائمة الفئات أعلاه (مثال: طماطة -> الفواكه والخضار، روبة -> الألبان والأجبان، لحم -> لحوم ودواجن...).
4. إذا ذكرت الفاتورة أو الإيصال ضماناً لأي جهاز أو مادة (مثال: ضمان سنة، كفالة 6 أشهر)، ضع hasWarranty: true واذكر warrantyPeriod.
5. أزل علامات العملة مثل "د.ع" أو "IQD" أو الفواصل العشرية واجعل الأسعار أرقاماً صحيحة (مثال: 1,250 تصبح 1250).
6. أرجع فقط كود JSON صالح تماماً، بدون أي نصوص تمهيدية أو ختامية.`;

  let resultText = "";
  let lastError: any = null;

  for (const model of CANDIDATE_MODELS) {
    try {
      const payload = {
        contents: [
          {
            parts: [
              { text: systemPrompt },
              ...imageParts
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          response_mime_type: "application/json"
        }
      };

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );

      if (res.status === 200) {
        const resData = await res.json();
        resultText = resData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (resultText) break;
      } else {
        const errText = await res.text();
        console.warn(`Gemini model ${model} status ${res.status}:`, errText.slice(0, 150));
        lastError = errText;
      }
    } catch (err: any) {
      console.warn(`Gemini model ${model} failed:`, err.message);
      lastError = err;
    }
  }

  if (!resultText) {
    throw new Error("تعذر قراءة الفاتورة بالذكاء الاصطناعي حالياً. يرجى التأكد من وضوح الصورة.");
  }

  let cleaned = resultText.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }

  const parsed = JSON.parse(cleaned);

  let cleanStoreName = (parsed.storeName || "").trim();
  if (cleanStoreName === "غير محدد" || cleanStoreName === "فاتورة مشتريات" || cleanStoreName === "فاتورة" || cleanStoreName === "متجر" || !cleanStoreName) {
    cleanStoreName = "";
  }

  const normalizedItems = Array.isArray(parsed.items)
    ? parsed.items.map((it: any, idx: number) => {
        const itemName = String(it.name || `منتج ${idx + 1}`).trim();
        const itemCat = String(it.category || "").trim() || detectProductCategory(itemName);
        const hasWarr = Boolean(it.hasWarranty || itemName.includes("ضمان") || itemName.includes("كفالة"));
        const warrPeriod = it.warrantyPeriod ? String(it.warrantyPeriod).trim() : (hasWarr ? "سنة واحدة" : undefined);
        const warrExpiry = hasWarr && warrPeriod ? calculateWarrantyExpiryDate(parsed.date || "", warrPeriod) : undefined;

        return {
          id: `item-${Date.now()}-${idx}-${Math.random().toString(36).substring(7)}`,
          name: itemName,
          quantity: Number(it.quantity) || 1,
          price: Number(it.price) || 0,
          category: itemCat,
          place: String(it.place || cleanStoreName || "").trim(),
          hasWarranty: hasWarr,
          warrantyPeriod: warrPeriod,
          warrantyExpiryDate: warrExpiry
        };
      })
    : [];

  let total = Number(parsed.totalAmount);
  if (!total || total <= 0) {
    total = normalizedItems.reduce((acc: number, item: any) => acc + (item.price || 0), 0);
  }

  let category = parsed.category || "سوبر ماركت";
  if (!VALID_CATEGORIES.includes(category)) {
    category = "سوبر ماركت";
  }

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const currentYear = now.getFullYear();
  let receiptDate = (parsed.date || "").trim();

  // Ensure date is in YYYY-MM-DD and aligns with the current year
  if (receiptDate && /^\d{4}-\d{2}-\d{2}$/.test(receiptDate)) {
    const [yearStr, monthStr, dayStr] = receiptDate.split("-");
    const yearNum = parseInt(yearStr, 10);
    // If POS receipt has an outdated year (e.g. 2024 instead of current 2026)
    if (yearNum !== currentYear) {
      receiptDate = `${currentYear}-${monthStr}-${dayStr}`;
    }
    // Never allow dates in the future
    if (receiptDate > todayStr) {
      receiptDate = todayStr;
    }
  } else {
    receiptDate = todayStr;
  }

  return {
    storeName: cleanStoreName || "سوبر ماركت",
    date: receiptDate,
    category,
    totalAmount: total,
    items: normalizedItems
  };
}
