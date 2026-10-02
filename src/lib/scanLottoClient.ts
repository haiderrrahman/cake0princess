// Client-side Lotto image scanner using Google Gemini Vision

const CANDIDATE_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite"
];

export interface ScannedLottoData {
  game: "iraq_lotto" | "super_key";
  drawNumber?: number;
  drawDate?: string;
  winningNumbers?: number[];
  luckyNumber?: number;
  purchasedTickets?: {
    numbers: number[];
    luckyNumber?: number;
    cost?: number;
    status?: string;
  }[];
}

export async function scanLottoWithGemini(
  base64DataUrl: string,
  targetType: "ticket" | "draw" = "ticket",
  onProgress?: (status: string) => void
): Promise<ScannedLottoData> {
  const apiKey =
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("مفتاح الذكاء الاصطناعي (NEXT_PUBLIC_GEMINI_API_KEY) غير مهيأ");
  }

  onProgress?.(targetType === "ticket" ? "جاري قراءة بطاقة اللوتو المشتراة 🎫..." : "جاري قراءة أرقام السحب الفائزة 🎰...");

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

  onProgress?.("جاري تحليل الأرقام وتدقيقها بالذكاء الاصطناعي...");

  const isTicketScan = targetType === "ticket";

  const systemPrompt = `أنت مساعد ذكي فائق الدقة متخصص في قراءة وتحليل بطاقات ونتائج لوتو العراق (سوبر كي 42 ولوتو العراق الخيري 29).
المطلوب في هذه الصورة هو: ${isTicketScan ? "مسح واستخراج أرقام 'البطاقة المشتراة' للمستخدم (وليس الرقم الفائز لسحب سابق)." : "مسح واستخراج 'الرقم الفائز' الرسمي للسحب."}

قم بتحليل الصورة المرفقة واستخرج البيانات بصيغة JSON حصراً:
{
  "game": "iraq_lotto", // أو "super_key" إذا كان لوتو سوبر كي (42 رقم)
  "drawNumber": 416, // رقم السحب كرقم صحيح إن وجد
  "drawDate": "2026-10-01", // تاريخ السحب بصيغة YYYY-MM-DD
  "winningNumbers": ${isTicketScan ? "null" : "[13, 14, 18, 19, 20, 25]"}, // الأرقام الستة الفائزة الرسمية فقط إذا كان المطلوب سحب رسمي
  "luckyNumber": null, // رقم الحظ فقط إذا كان السحب سوبر كي (من 1 إلى 42) وإلا null
  "purchasedTickets": [
    // ${isTicketScan ? "ضع هنا أرقام البطاقة المشتراة الستة بالضبط:" : "بطاقات المستخدم إن وجدت"}
    // ملاحظة هامة: الرقم الترقيمي في بداية السطر (مثل 1. أو 2.) هو رقم السطر وليس رقم من أرقام اللوتو! بطاقة اللوتو تتكون دائماً من 6 أرقام فقط!
    {
      "numbers": [7, 8, 15, 19, 26, 28], // أرقام البطاقة الستة بالضبط
      "cost": 1500, // سعر البطاقة: 1500 دينار للوتو الخيري، 2650 دينار لسوبر كي
      "status": "pending"
    }
  ]
}

قواعد صارمة:
1. ${isTicketScan ? "هذه بطاقة مشتراة: يجب وضع أرقامها الستة في purchasedTickets حصراً ولا تضعها في winningNumbers." : "هذه نتيجة سحب: يجب وضع الأرقام الستة الفائزة في winningNumbers."}
2. سعر بطاقة لوتو العراق الخيري (29 رقم) هو دائماً 1500 دينار.
3. سعر بطاقة سوبر كي (42 رقم) هو دائماً 2650 دينار.
4. أرجع كود JSON فقط بدون أي علامات markdown أو مقدمات.`;

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
        console.warn(`Lotto scan model ${model} status ${res.status}:`, errText.slice(0, 150));
        lastError = errText;
      }
    } catch (err: any) {
      console.warn(`Lotto scan model ${model} error:`, err.message);
      lastError = err;
    }
  }

  if (!resultText) {
    throw new Error("تعذر قراءة صورة اللوتو بالذكاء الاصطناعي حالياً. تأكد من وضوح الصورة.");
  }

  let cleaned = resultText.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }

  const parsed = JSON.parse(cleaned);

  // Normalize numbers
  const winningNumbers = Array.isArray(parsed.winningNumbers)
    ? parsed.winningNumbers.map((n: any) => Number(n)).filter((n: number) => !isNaN(n) && n > 0).sort((a: number, b: number) => a - b)
    : [];

  const isSuperKey = String(parsed.game).toLowerCase().includes("super") || parsed.game === "super_key";

  const purchasedTickets = Array.isArray(parsed.purchasedTickets)
    ? parsed.purchasedTickets.map((t: any) => {
        let nums = Array.isArray(t.numbers)
          ? t.numbers.map((n: any) => Number(n)).filter((n: number) => !isNaN(n) && n > 0)
          : [];
        // If 7 numbers detected and first number is 1 or 2, remove line number
        if (nums.length === 7 && (nums[0] === 1 || nums[0] === 2 || nums[0] === 3 || nums[0] === 4)) {
          nums = nums.slice(1);
        }
        return {
          numbers: nums.sort((a: number, b: number) => a - b),
          luckyNumber: t.luckyNumber ? Number(t.luckyNumber) : undefined,
          cost: Number(t.cost) || (isSuperKey ? 2650 : 1500),
          status: String(t.status || "")
        };
      }).filter((t: any) => t.numbers.length === 6)
    : [];

  // Fallback: If user wanted a ticket scan but model put numbers in winningNumbers
  if (targetType === "ticket" && purchasedTickets.length === 0 && winningNumbers.length === 6) {
    purchasedTickets.push({
      numbers: winningNumbers,
      luckyNumber: parsed.luckyNumber ? Number(parsed.luckyNumber) : undefined,
      cost: Number(parsed.cost) || (isSuperKey ? 2650 : 1500),
      status: "pending"
    });
  }

  // Fallback: If user wanted a draw scan but model put numbers in purchasedTickets
  let finalWinningNumbers = winningNumbers;
  if (targetType === "draw" && finalWinningNumbers.length !== 6 && purchasedTickets.length > 0) {
    finalWinningNumbers = purchasedTickets[0].numbers;
  }

  // Parse date properly (convert e.g. "Thu 01 October 2026" or "2026-10-01" to YYYY-MM-DD)
  let dateStr = new Date().toISOString().split("T")[0];
  if (parsed.drawDate) {
    const raw = String(parsed.drawDate);
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      dateStr = raw;
    } else {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) {
        const yr = d.getFullYear();
        const mo = String(d.getMonth() + 1).padStart(2, "0");
        const da = String(d.getDate()).padStart(2, "0");
        dateStr = `${yr}-${mo}-${da}`;
      }
    }
  }

  return {
    game: isSuperKey ? "super_key" : "iraq_lotto",
    drawNumber: parsed.drawNumber ? Number(parsed.drawNumber) : undefined,
    drawDate: dateStr,
    winningNumbers: finalWinningNumbers.length === 6 ? finalWinningNumbers : undefined,
    luckyNumber: parsed.luckyNumber ? Number(parsed.luckyNumber) : undefined,
    purchasedTickets
  };
}
