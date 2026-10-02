// Client-side receipt scanner using Google Gemini AI

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
  }[];
}

export async function scanReceiptWithGemini(
  base64DataUrl: string,
  onProgress?: (status: string) => void
): Promise<ScannedReceiptData> {
  const apiKey =
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("مفتاح الذكاء الاصطناعي (NEXT_PUBLIC_GEMINI_API_KEY) غير مهيأ في متغيرات البيئة");
  }

  onProgress?.("جاري تجهيز الصورة...");

  let mimeType = "image/jpeg";
  let base64 = base64DataUrl;

  if (base64DataUrl.includes(";base64,")) {
    const parts = base64DataUrl.split(";base64,");
    const mimeMatch = parts[0].match(/data:(.*?)$/);
    if (mimeMatch) mimeType = mimeMatch[1];
    base64 = parts[1];
  }

  // If MIME is HEIC or HEIF, declare as image/jpeg since Gemini accepts JPEG/PNG/WEBP/HEIC
  if (mimeType.toLowerCase().includes("heic") || mimeType.toLowerCase().includes("heif")) {
    mimeType = "image/jpeg";
  }

  onProgress?.("جاري قراءة بنود الفاتورة بالذكاء الاصطناعي ⚡...");

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
      "price": 1000 // السعر الإجمالي لهذه المادة (الكمية × سعر المفرد) كرقم صحيح
    }
  ]
}

قواعد هامة جداً:
1. استخرج كافة المواد في الفاتورة بدون أي استثناء أو إهمال.
2. حقل "price" لكل مادة يجب أن يمثل السعر الإجمالي للمادة (الكمية × سعر المفرد).
3. أزل علامات العملة مثل "د.ع" أو "IQD" أو الفواصل العشرية واجعل الأسعار أرقاماً صحيحة (مثال: 1,250 تصبح 1250).
4. أرجع فقط كود JSON صالح تماماً، بدون أي نصوص تمهيدية أو ختامية.`;

  let resultText = "";
  let lastError: any = null;

  for (const model of CANDIDATE_MODELS) {
    try {
      const payload = {
        contents: [
          {
            parts: [
              { text: systemPrompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64
                }
              }
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

  const normalizedItems = Array.isArray(parsed.items)
    ? parsed.items.map((it: any, idx: number) => ({
        id: `item-${Date.now()}-${idx}-${Math.random().toString(36).substring(7)}`,
        name: String(it.name || `منتج ${idx + 1}`).trim(),
        quantity: Number(it.quantity) || 1,
        price: Number(it.price) || 0
      }))
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

  let cleanStoreName = (parsed.storeName || "").trim();
  if (cleanStoreName === "غير محدد" || cleanStoreName === "فاتورة مشتريات" || cleanStoreName === "فاتورة" || cleanStoreName === "متجر" || !cleanStoreName) {
    cleanStoreName = "";
  }

  return {
    storeName: cleanStoreName || "سوبر ماركت",
    date: receiptDate,
    category,
    totalAmount: total,
    items: normalizedItems
  };
}
