// Client-side AI Scanner for Medicines and Home Needs using Google Gemini Vision

const CANDIDATE_MODELS = [
  "gemini-3.1-flash-lite", // Fastest ~1.3s response
  "gemini-3.5-flash",      // ~2.1s response
  "gemini-3.6-flash"       // Fallback ~2.5s response
];

export interface ScannedNeedItem {
  name: string;
  category: string;
  quantity: number;
  unit: string;
  estimatedPrice: number;
  notes: string;
  dosageOrSpecs?: string;
}

export async function scanNeedItemWithGemini(
  base64DataUrl: string,
  onProgress?: (status: string) => void
): Promise<ScannedNeedItem> {
  const apiKey =
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("مفتاح الذكاء الاصطناعي (NEXT_PUBLIC_GEMINI_API_KEY) غير مهيأ");
  }

  onProgress?.("جاري تجهيز وقراءة صورة الدواء أو المنتج 📸...");

  let mimeType = "image/jpeg";
  let base64 = base64DataUrl;

  if (base64DataUrl.includes(";base64,")) {
    const parts = base64DataUrl.split(";base64,");
    const mimeMatch = parts[0].match(/data:(.*?)$/);
    if (mimeMatch) mimeType = mimeMatch[1];
    base64 = parts[1];
  }

  if (mimeType.toLowerCase().includes("heic") || mimeType.toLowerCase().includes("heif")) {
    mimeType = "image/jpeg";
  }

  onProgress?.("جاري تحليل علبة الدواء / المنتج واستخراج الاسم والمواصفات بالذكاء الاصطناعي 🧠...");

  const systemPrompt = `أنت خبير ذكي متخصص في قراءة وتحليل صور علب الأدوية، عبوات المنتجات المنزلية، المستلزمات الغذائية، وأي منتجات يحتاجها المنزل والعائلة باللغتين العربية والإنجليزية.
قم بتحليل الصورة المرفقة واستخرج بيانات المادة بصيغة JSON حصراً:
{
  "name": "اسم الدواء أو المنتج التجاري/العلمي واضحاً (مثال: بنادول إكسترا 500 ملغ، حليب نيدو مجفف 900 غرام، صابون غسيل تايد، أوغمنتين 1 غرام)",
  "category": "أدوية وصيدلية", // اختر الفئة الأنسب من: ["أدوية وصيدلية", "سوبر ماركت", "منظفات", "عناية شخصية", "مستلزمات منزلية", "أغذية ومسواك", "سيارة", "أخرى"]
  "quantity": 1, // الكمية الافتراضية كرقم صحيح
  "unit": "علبة", // الوحدة الأنسب: "علبة", "شريط", "بطل", "كيس", "قطعة", "كغم", "لتر"
  "estimatedPrice": 0, // السعر التقديري بالدينار العراقي إن كان مدوناً على العلبة وإلا 0
  "notes": "العيار أو الجرعة أو الحجم أو أي تفاصيل مهمة (مثال: عيار 500mg، شراب سعال للأطفال، عبوة مضاعفة)",
  "dosageOrSpecs": "أي مواصفات إضافية أو تركيز"
}

قواعد أساسية:
1. إذا كانت الصورة علبة أو شريط دواء، استخرج الاسم التجاري والعيار بدقة تامة واجعل الفئة "أدوية وصيدلية".
2. إذا كانت الصورة منتجاً غذائياً أو مسواك أو منظف، استخرج الاسم والماركة والحجم بوضوح.
3. أرجع كود JSON فقط بدون علامات markdown.`;

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
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000)
        }
      );

      if (res.status === 200) {
        const resData = await res.json();
        resultText = resData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (resultText) break;
      } else {
        const errText = await res.text();
        console.warn(`Need scan model ${model} status ${res.status}:`, errText.slice(0, 150));
        lastError = errText;
      }
    } catch (err: any) {
      console.warn(`Need scan model ${model} error:`, err.message);
      lastError = err;
    }
  }

  if (!resultText) {
    throw new Error("تعذر قراءة صورة الدواء أو المنتج بالذكاء الاصطناعي حالياً. تأكد من وضوح الصورة وزاوية التصوير.");
  }

  let cleaned = resultText.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }

  const parsed = JSON.parse(cleaned);

  return {
    name: String(parsed.name || "منتج غير محدد").trim(),
    category: String(parsed.category || "أدوية وصيدلية").trim(),
    quantity: Math.max(1, Number(parsed.quantity) || 1),
    unit: String(parsed.unit || "علبة").trim(),
    estimatedPrice: Number(parsed.estimatedPrice) || 0,
    notes: String(parsed.notes || "").trim(),
    dosageOrSpecs: String(parsed.dosageOrSpecs || "").trim()
  };
}
