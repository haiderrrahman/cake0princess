// Client-side AI Scanner specialized for Cake Baking Materials & Confectionery Invoices
// Using Google Gemini Vision Models (gemini-3.5-flash, gemini-3.1-flash-lite)

export const CAKE_INVENTORY_CATEGORIES = [
  "طحين وسكر",
  "كريمات",
  "حشوات",
  "شوكولاتة وكاكاو",
  "ألوان وإضافات",
  "منكهات وعطور",
  "عجينة سكر",
  "فواكه ومكسرات",
  "تغليف وزينة",
  "مستهلكات",
  "قوالب وصواني",
  "أدوات",
  "أخرى"
];

export const CAKE_INVENTORY_UNITS = [
  "كغم",
  "غرام",
  "لتر",
  "قطعة",
  "كيس",
  "سطل",
  "علبة",
  "كرتون",
  "سيت",
  "ورقة",
  "رول"
];

const CANDIDATE_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite"
];

export interface ScannedCakeItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  category: string;
  matchedInventoryId?: string;
  matchedInventoryName?: string;
  isNewItem?: boolean;
}

export interface ScannedCakeInvoiceData {
  storeName: string;
  date: string;
  invoiceNumber?: string;
  totalAmount: number;
  items: ScannedCakeItem[];
  rawSummary?: string;
}

export async function scanCakeInvoiceWithGemini(
  base64DataUrls: string | string[],
  onProgress?: (status: string) => void
): Promise<ScannedCakeInvoiceData> {
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

  onProgress?.("جاري قراءة بنود فاتورة مواد الكيك وتحليلها بالذكاء الاصطناعي 🎂⚡...");

  const systemPrompt = `أنت خبير حسابات ومساعد ذكي متخصص في قراءة وتحليل فواتير وقوائم مشتريات مواد الكيك، الحلويات، والمخابز في العراق بدقة 100%.
قم باستخراج كافة المواد والبيانات من صورة الفاتورة المرفقة وتحويلها إلى JSON بالهيكل التالي بدقة:

{
  "storeName": "اسم المتجر أو المعرض أو المطحنة أو المورد كما يظهر في الفاتورة، أو اسم معروف للمحل",
  "date": "YYYY-MM-DD", // تاريخ الشراء أو الفاتورة إذا كان مكتوباً. إذا لم يظهر تاريخ واضح، ضع تاريخ اليوم بتنسيق YYYY-MM-DD
  "invoiceNumber": "رقم الفاتورة إذا وجد أو نص فارغ",
  "totalAmount": 0, // المبلغ الإجمالي للفاتورة بالأرقام فقط كعدد صحيح
  "items": [
    {
      "name": "اسم المادة بدقة (مثال: طحين فاخر، كريمة فيزون، حشوة توت، ألواح شوكولاتة، قواعد كيك 20 سم، ورق زبدة)",
      "quantity": 1, // الكمية المشتراة كرقم (إذا كسر مثل نصف كيلو اجعله 0.5)
      "unit": "كغم", // اختر الأنسب من: ["كغم", "غرام", "لتر", "قطعة", "كيس", "سطل", "علبة", "كرتون", "سيت", "ورقة", "رول"]
      "unitPrice": 1000, // سعر الوحدة الواحدة كرقم صحيح (دينار عراقي)
      "totalPrice": 1000, // السعر الإجمالي لهذه المادة (الكمية × سعر المفرد) كرقم صحيح
      "category": "طحين وسكر" // اختر الفئة الأنسب حصراً من هذه القائمة:
      // ["طحين وسكر", "كريمات", "حشوات", "شوكولاتة وكاكاو", "ألوان وإضافات", "منكهات وعطور", "عجينة سكر", "فواكه ومكسرات", "تغليف وزينة", "مستهلكات", "قوالب وصواني", "أدوات", "أخرى"]
    }
  ]
}

قواعد أساسية صارمة:
1. استخرج كل مادة من مواد ومستلزمات الكيك ظهرت في الفاتورة ولا تهمل أي مادة.
2. حقل "totalPrice" لكل مادة يجب أن يكون (الكمية × سعر المفرد). إذا كانت الفاتورة تذكر فقط الإجمالي، فاحسب سعر المفرد.
3. جميع الأسعار والمبالغ يجب أن تكون أرقاماً صحيحة بدون فواصل أو حروف عملة (مثال: 12,500 تصبح 12500).
4. تأكد من تحديد وحدة القياس الأكثر دقة وتصنيف المادة بحسب تصنيفات مخزن الكيك.
5. أرجع فقط JSON صالح 100% بدون أي شرح إضافي أو مقدمات.`;

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
    throw new Error("تعذر قراءة فاتورة الكيك بالذكاء الاصطناعي حالياً. يرجى التأكد من وضوح الصورة وزاوية الإضاءة.");
  }

  let cleaned = resultText.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (parseErr) {
    console.error("JSON parse error:", cleaned);
    throw new Error("تعذر معالجة البيانات المستخرجة من الفاتورة. يرجى إعادة المحاولة.");
  }

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const currentYear = now.getFullYear();
  let receiptDate = (parsed.date || "").trim();

  if (receiptDate && /^\d{4}-\d{2}-\d{2}$/.test(receiptDate)) {
    const [yearStr, monthStr, dayStr] = receiptDate.split("-");
    const yearNum = parseInt(yearStr, 10);
    if (yearNum !== currentYear) {
      receiptDate = `${currentYear}-${monthStr}-${dayStr}`;
    }
    if (receiptDate > todayStr) {
      receiptDate = todayStr;
    }
  } else {
    receiptDate = todayStr;
  }

  const normalizedItems: ScannedCakeItem[] = Array.isArray(parsed.items)
    ? parsed.items.map((it: any, idx: number) => {
        const qty = Number(it.quantity) || 1;
        let unitPrice = Number(it.unitPrice) || 0;
        let totalPrice = Number(it.totalPrice) || 0;

        if (totalPrice <= 0 && unitPrice > 0) {
          totalPrice = unitPrice * qty;
        } else if (unitPrice <= 0 && totalPrice > 0 && qty > 0) {
          unitPrice = Math.round(totalPrice / qty);
        }

        let unit = String(it.unit || "كغم").trim();
        if (!CAKE_INVENTORY_UNITS.includes(unit)) {
          if (unit.includes("كيلو") || unit.includes("كغ")) unit = "كغم";
          else if (unit.includes("علب") || unit.includes("قوطي")) unit = "علبة";
          else if (unit.includes("كيس")) unit = "كيس";
          else if (unit.includes("سطل")) unit = "سطل";
          else if (unit.includes("لتر")) unit = "لتر";
          else if (unit.includes("كرتون")) unit = "كرتون";
          else unit = "قطعة";
        }

        let category = String(it.category || "طحين وسكر").trim();
        if (!CAKE_INVENTORY_CATEGORIES.includes(category)) {
          category = "أخرى";
        }

        return {
          id: `scanned-cake-${Date.now()}-${idx}-${Math.random().toString(36).substring(7)}`,
          name: String(it.name || `مادة كيك ${idx + 1}`).trim(),
          quantity: qty,
          unit,
          unitPrice,
          totalPrice,
          category,
          isNewItem: false
        };
      })
    : [];

  let total = Number(parsed.totalAmount);
  if (!total || total <= 0) {
    total = normalizedItems.reduce((acc, it) => acc + (it.totalPrice || 0), 0);
  }

  let cleanStoreName = (parsed.storeName || "").trim();
  if (
    cleanStoreName === "غير محدد" ||
    cleanStoreName === "فاتورة مشتريات" ||
    cleanStoreName === "فاتورة" ||
    cleanStoreName === "متجر" ||
    !cleanStoreName
  ) {
    cleanStoreName = "معرض مستلزمات الكيك";
  }

  return {
    storeName: cleanStoreName,
    date: receiptDate,
    invoiceNumber: parsed.invoiceNumber ? String(parsed.invoiceNumber).trim() : "",
    totalAmount: total,
    items: normalizedItems
  };
}
