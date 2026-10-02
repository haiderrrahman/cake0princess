// Client-side AI Scanner for Medicines and Home Needs using Google Gemini Vision

const CANDIDATE_MODELS = [
  "gemini-3.1-flash-lite", // Fastest ~1.3s response
  "gemini-3.5-flash",      // ~2.1s response
  "gemini-3.6-flash"       // Fallback ~2.5s response
];

export interface ScannedNeedItem {
  id?: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  estimatedPrice: number;
  notes: string;
  dosageOrSpecs?: string;
  box_2d?: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000
  croppedImageUrl?: string;
  selected?: boolean;
}

/**
 * Fast client-side image cropper based on normalized bounding box (0-1000 scale).
 * Adds gentle padding and outputs a crisp, square-friendly JPEG data URL.
 */
export function cropItemFromImage(
  base64DataUrl: string,
  box_2d?: [number, number, number, number]
): Promise<string> {
  return new Promise((resolve) => {
    if (!box_2d || !Array.isArray(box_2d) || box_2d.length !== 4) {
      resolve(base64DataUrl);
      return;
    }

    const [ymin, xmin, ymax, xmax] = box_2d;
    if (ymax <= ymin || xmax <= xmin || ymax <= 0 || xmax <= 0) {
      resolve(base64DataUrl);
      return;
    }

    if (typeof window === "undefined") {
      resolve(base64DataUrl);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const origW = img.naturalWidth || img.width;
      const origH = img.naturalHeight || img.height;

      // Add gentle 4% padding around the bounding box so borders aren't cut off
      const padY = (ymax - ymin) * 0.04;
      const padX = (xmax - xmin) * 0.04;

      const normYmin = Math.max(0, (ymin - padY) / 1000);
      const normXmin = Math.max(0, (xmin - padX) / 1000);
      const normYmax = Math.min(1, (ymax + padY) / 1000);
      const normXmax = Math.min(1, (xmax + padX) / 1000);

      const cropX = Math.round(normXmin * origW);
      const cropY = Math.round(normYmin * origH);
      const cropW = Math.round((normXmax - normXmin) * origW);
      const cropH = Math.round((normYmax - normYmin) * origH);

      if (cropW < 20 || cropH < 20) {
        resolve(base64DataUrl);
        return;
      }

      // Max dimension for cropped thumbnail
      const maxDim = 500;
      let targetW = cropW;
      let targetH = cropH;
      if (targetW > maxDim || targetH > maxDim) {
        if (targetW > targetH) {
          targetH = Math.round((targetH * maxDim) / targetW);
          targetW = maxDim;
        } else {
          targetW = Math.round((targetW * maxDim) / targetH);
          targetH = maxDim;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(base64DataUrl);
        return;
      }

      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => resolve(base64DataUrl);
    img.src = base64DataUrl;
  });
}

/**
 * Scan a photo containing one or MULTIPLE medicines or home products.
 * Returns an array of detected items, each with its name, specs, and bounding box for cropping.
 */
export async function scanNeedItemWithGemini(
  base64DataUrl: string,
  onProgress?: (status: string) => void
): Promise<ScannedNeedItem[]> {
  const apiKey =
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("مفتاح الذكاء الاصطناعي (NEXT_PUBLIC_GEMINI_API_KEY) غير مهيأ");
  }

  onProgress?.("جاري فحص وقراءة الصورة واستكشاف الأدوية والمواد 📸...");

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

  onProgress?.("جاري تحليل واكتشاف كل دواء أو منتج على حدى بالذكاء الاصطناعي 🧠...");

  const systemPrompt = `أنت طبيب وصيدلي وخبير استثنائي في فحص وتحليل صور الأدوية والمستلزمات الطبية والمنتجات المنزلية.
مهمتك: اكتشاف وتحديد كافة الأدوية، علب العلاج، أشرطة الحبوب، أشربة الأطفال، أو المنتجات المنزلية الظاهرة في الصورة، سواء كانت مادة واحدة أو مجموعة مواد معاً.
لكل دواء أو منتج منفصل يظهر في الصورة، استخرج بياناته بدقة مع تحديد موقعه الهندسي المستطيل (box_2d) بصيغة JSON:
{
  "items": [
    {
      "name": "اسم الدواء أو المنتج التجاري/العلمي واضحاً (مثال: بنادول إكسترا 500 ملغ، أوغمنتين 1 غرام، شراب بروفين للأطفال، حليب نيدو مجفف)",
      "category": "أدوية وصيدلية", // اختر من: ["أدوية وصيدلية", "سوبر ماركت", "منظفات", "عناية شخصية", "مستلزمات منزلية", "أغذية ومسواك", "سيارة", "أخرى"]
      "quantity": 1, // الكمية الافتراضية
      "unit": "علبة", // الوحدة الأنسب: "علبة", "شريط", "بطل", "كيس", "قطعة", "كغم", "لتر"
      "estimatedPrice": 0, // السعر التقديري بالدينار العراقي إن كان مدوناً وإلا 0
      "dosageOrSpecs": "العيار أو التركيز أو الشكل الصيدلاني (مثال: 500mg كبسول، شراب 100ml، مرهم موضعي، 900 غرام)",
      "notes": "دواعي الاستعمال أو إرشادات مهمة باختصار (مثال: مسكن للألم وخافض حرارة، مضاد حيوي واسع الطيف)",
      "box_2d": [120, 80, 540, 480] // إحداثيات موقع هذا الدواء بالصورة بنسبة 0 إلى 1000 بصيغة [ymin, xmin, ymax, xmax]
    }
  ]
}

قواعد أساسية ومهمة:
1. إذا كانت الصورة تحتوي على أكثر من دواء أو علبة، افصل كل دواء كعنصر مستقل في مصفوفة "items" مع موقعه box_2d الخاص به لكي يتم قص صورته بدقة.
2. إذا كانت الصورة تحتوي على دواء واحد فقط، ضعه أيضاً في مصفوفة "items" مع صندوق box_2d يحدد العلبة بدقة لإزالة أي خلفية زائدة.
3. استخرج الاسم التجاري والعيار بدقة تامة واجعل الفئة "أدوية وصيدلية" للأدوية.
4. أرجع كود JSON فقط بدون علامات markdown.`;

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

  // Normalize parsed items to an array
  let rawList: any[] = [];
  if (Array.isArray(parsed)) {
    rawList = parsed;
  } else if (parsed && Array.isArray(parsed.items)) {
    rawList = parsed.items;
  } else if (parsed && typeof parsed === "object") {
    // Single item object
    rawList = [parsed];
  }

  if (rawList.length === 0) {
    throw new Error("لم نتمكن من التعرف على أدوية أو منتجات واضحة في الصورة، يرجى المحاولة بزاوية أخرى أو إضاءة أفضل.");
  }

  const items: ScannedNeedItem[] = rawList.map((item, index) => {
    let box: [number, number, number, number] | undefined = undefined;
    if (Array.isArray(item.box_2d) && item.box_2d.length === 4) {
      box = [
        Math.max(0, Math.min(1000, Number(item.box_2d[0]) || 0)),
        Math.max(0, Math.min(1000, Number(item.box_2d[1]) || 0)),
        Math.max(0, Math.min(1000, Number(item.box_2d[2]) || 1000)),
        Math.max(0, Math.min(1000, Number(item.box_2d[3]) || 1000))
      ];
    }

    return {
      id: `item_${Date.now()}_${index}`,
      name: String(item.name || "دواء/منتج غير محدد").trim(),
      category: String(item.category || "أدوية وصيدلية").trim(),
      quantity: Math.max(1, Number(item.quantity) || 1),
      unit: String(item.unit || (item.category === "أدوية وصيدلية" ? "علبة" : "قطعة")).trim(),
      estimatedPrice: Number(item.estimatedPrice) || 0,
      notes: String(item.notes || "").trim(),
      dosageOrSpecs: String(item.dosageOrSpecs || "").trim(),
      box_2d: box,
      selected: true
    };
  });

  return items;
}
