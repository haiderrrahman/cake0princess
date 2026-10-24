// Client-side AI Scanner for Sonar, Prescriptions, Medications, and Medical Reports using Google Gemini Vision

const CANDIDATE_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3.8-flash"
];

export interface ScannedHealthData {
  title: string;
  type: "sonar" | "medication" | "lab" | "report" | "other";
  typeNameArabic: string;
  suggestedMember?: string;
  doctorOrClinic?: string;
  date?: string;
  diagnosisOrReason?: string;
  findings?: string;
  instructions?: string;
  cost?: number;
  medications?: {
    name: string;
    dosage?: string;
    duration?: string;
    notes?: string;
  }[];
  notes?: string;
}

export async function scanHealthRecordWithGemini(
  base64DataUrls: string | string[],
  onProgress?: (status: string) => void
): Promise<ScannedHealthData> {
  const apiKey =
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("مفتاح الذكاء الاصطناعي (NEXT_PUBLIC_GEMINI_API_KEY) غير مهيأ");
  }

  const urls = Array.isArray(base64DataUrls) ? base64DataUrls : [base64DataUrls];
  if (urls.length === 0) {
    throw new Error("لم يتم تمرير أي صورة طبية للفحص");
  }

  onProgress?.(`جاري تجهيز ${urls.length > 1 ? `${urls.length} صور طبية` : "الصورة الطبية"}...`);

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

  onProgress?.("جاري قراءة وتحليل السونار أو العلاج بالذكاء الاصطناعي 🧠⚡...");

  const systemPrompt = `أنت طبيب ومساعد ذكي خبير متخصص في قراءة وتحليل المستندات والصور الطبية (تقارير وصور السونار، راشيتات ووصفات الأطباء، علب الأدوية، التحاليل المختبرية، والتقارير الطبية) باللغة العربية والإنجليزية والعراقية بدقة فائقة.

قم بقراءة المستند أو الصورة المرفقة واستخراج كامل البيانات الطبية بدقة، وأعد النتيجة بصيغة كائن JSON فقط بدون نصوص تمهيدية:
{
  "title": "عنوان واضح ومختصر للسجل (مثال: تقرير سونار بطن وحوض، راشيتة علاج التهاب صدرية، فحص دم شامل CBC، علاج سكر وضغط)",
  "type": "sonar", // اختر بدقة من: ["sonar", "medication", "lab", "report", "other"]
  "typeNameArabic": "سونار", // "سونار" أو "علاج وأدوية" أو "تحليل مختبري" أو "تقرير واستشارة" أو "أخرى"
  "suggestedMember": "إيمان", // إذا ظهر اسم المريض أو قرائن واضحة تشير لأحد أفراد العائلة اختر الأنسب من: ["حيدر", "إيمان", "رقية", "قنوت", "إيڤا"] وإلا اتركه فارغاً ""
  "doctorOrClinic": "اسم الطبيب المعالج أو العيادة أو المستشفى أو مركز السونار والمختبر",
  "date": "YYYY-MM-DD", // تاريخ الفحص أو الراشيتة بصيغة YYYY-MM-DD إذا وجد، وإذا لم يوجد استخدم تاريخ اليوم
  "diagnosisOrReason": "التشخيص الطبي أو سبب الفحص (مثال: التهاب حاد، فحص دوري، كشفية باطنية، متابعة حمل)",
  "findings": "أهم النتائج أو الملاحظات الواردة في السونار أو التقرير",
  "instructions": "طريقة الاستخدام، النصائح الطبية، الحمية أو موعد المراجعة القادمة إن وجد",
  "cost": 0, // الأجرة أو التكلفة بالأرقام فقط إن ظهرت في الوصل أو الفحص
  "medications": [ // إذا كانت الصورة تحتوي راشيتة أو علبة علاج أو أدوية، اذكر كل دواء بتفاصيله:
    {
      "name": "اسم الدواء العلمي أو التجاري مع العيار (مثال: Amoxicillin 500mg أو كبسول أوجمنتين)",
      "dosage": "الجرعة وتكرار الأخذ (مثال: حبة واحدة مرتين يومياً بعد الأكل)",
      "duration": "المدة (مثال: لمدة 5 أيام)",
      "notes": "أي تنبيه خاص (مثال: قبل النوم، مع شرب ماء كثير)"
    }
  ],
  "notes": "أي ملاحظات إضافية مهمة أو تحذيرات طبية مكتوبة"
}

ملاحظات هامة جداً:
1. إذا كانت الصورة عبارة عن سونار (Ultrasound): حدد type كـ "sonar" واكتب في findings ما رآه الطبيب (حجم الأعضاء، وجود حصى، عمر الجنين، سلامة النبض...).
2. إذا كانت الصورة راشيتة طبية أو علاج: حدد type كـ "medication" واستخرج جميع الأدوية بدقة في مصفوفة medications.
3. إذا كانت الصورة تحليلاً مختبرياً (Lab test): حدد type كـ "lab" واذكر الفحوصات والنتائج.
4. أرجع JSON نقي فقط بدون أي كلام إضافي أو كتل تعليمية Markdown.`;

  let lastError: Error | null = null;

  for (const model of CANDIDATE_MODELS) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                ...imageParts,
                { text: systemPrompt }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
            responseMimeType: "application/json"
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`Gemini model ${model} failed with status ${response.status}:`, errText.slice(0, 150));
        continue;
      }

      const resData = await response.json();
      const rawText = resData.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        continue;
      }

      let parsed: ScannedHealthData;
      try {
        let cleaned = rawText.trim();
        if (cleaned.startsWith("```json")) {
          cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
        } else if (cleaned.startsWith("```")) {
          cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
        }
        parsed = JSON.parse(cleaned);
      } catch (e) {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("لم يتمكن الذكاء الاصطناعي من قراءة محتوى المستند الطبي كـ JSON صالح");
        }
      }

      // Normalize types
      if (!parsed.type || !["sonar", "medication", "lab", "report", "other"].includes(parsed.type)) {
        const titleLower = (parsed.title || "").toLowerCase();
        if (titleLower.includes("سونار") || titleLower.includes("sonar") || titleLower.includes("ultra")) {
          parsed.type = "sonar";
        } else if (parsed.medications && parsed.medications.length > 0) {
          parsed.type = "medication";
        } else if (titleLower.includes("تحليل") || titleLower.includes("فحص دم") || titleLower.includes("lab")) {
          parsed.type = "lab";
        } else {
          parsed.type = "report";
        }
      }

      if (!parsed.typeNameArabic) {
        const map: Record<string, string> = {
          sonar: "سونار",
          medication: "علاج وأدوية",
          lab: "تحليل مختبري",
          report: "تقرير واستشارة",
          other: "سجل صحي"
        };
        parsed.typeNameArabic = map[parsed.type] || "سجل صحي";
      }

      if (!parsed.date) {
        parsed.date = new Date().toISOString().split("T")[0];
      }

      return parsed;
    } catch (err: any) {
      lastError = err;
      console.warn(`Gemini model ${model} encountered error:`, err?.message);
    }
  }

  throw lastError || new Error("فشلت جميع نماذج الذكاء الاصطناعي في فحص المستند الطبي. يرجى التأكد من وضوح الصورة والمحاولة مرة أخرى.");
}
