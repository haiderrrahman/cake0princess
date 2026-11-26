// Client-side Iraq Lotto Vision Scanner using Google Gemini Vision
// Supports all 5 loto.iq games: Loto 42, Loto 29, Sports Loto (10 matches), طابق 3 (SC500), جيب الكاس جيبه (SC1K)

import { IraqLotoGameId, SportsPickChoice } from "./lotoIqService";

const CANDIDATE_MODELS = [
  "gemini-2.5-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-2.0-flash",
];

export interface ScannedIraqLotoResult {
  game: IraqLotoGameId;
  mode: "ticket" | "result";
  drawNumber?: number;
  drawDate?: string;
  cost?: number;
  // Loto 42 & Loto 29
  numbers?: number[];
  extraNumber?: number;
  // Sports Loto (10 matches)
  roundName?: string;
  sportsPicks?: Record<number, SportsPickChoice>;
  // Scratch cards
  scratchCells?: number[]; // SC500: 6 amounts
  scratchWinningNums?: number[]; // SC1K: 3 winning numbers
  scratchPlayerCells?: { num: number; prize: number }[]; // SC1K: up to 12 cells
  detectedWinAmount?: number;
  summaryAr?: string;
}

export async function scanIraqLotoImage(
  base64DataUrl: string,
  expectedGame?: IraqLotoGameId,
  onProgress?: (status: string) => void
): Promise<ScannedIraqLotoResult> {
  const apiKey =
    process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("مفتاح الذكاء الاصطناعي (NEXT_PUBLIC_GEMINI_API_KEY) غير مهيأ");
  }

  onProgress?.("جاري قراءة صورة بطاقة لوتو العراق بدقة فائقة 📸...");

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

  const gameHint = expectedGame
    ? `اللعبة المتوقعة من التبويب الحالي هي: "${expectedGame}".`
    : "حدد نوع اللعبة تلقائياً من الصورة.";

  const prompt = `أنت نظام رؤية حاسوبية فائق الدقة متخصص في قراءة بطاقات ونتائج موقع "لوتو العراق الرسمي" (loto.iq) للألعاب الخمس:
1. "loto42": لوتو 42 (6 أرقام من 1 إلى 42 + رقم إضافي اختياري، سعر البطاقة 2000 د.ع).
2. "loto29": لوتو 29 (6 أرقام من 1 إلى 29 بدون رقم إضافي، سعر البطاقة 1500 د.ع).
3. "sports": اللوتو الرياضي (10 مباريات كرة قدم، اختيارات كل مباراة من 1 إلى 10 هي "1" فوز المضيف أو "X" تعادل أو "2" فوز الضيف، السعر 5000 د.ع).
4. "sc500": بطاقة كشط "طابق 3" (سعرها 500 د.ع، تحتوي على 6 مبالغ مالية؛ إذا تطابقت 3 مبالغ تربح ذلك المبلغ).
5. "sc1k": بطاقة كشط "جيب الكاس جيبه" (سعرها 1000 د.ع، تحتوي على 3 أرقام رابحة في الأعلى و12 رقماً للاعب تحت كل منها مبلغ الجائزة؛ أي تطابق يربح المبلغ تحته).

${gameHint}
تنبيه مهم لبطاقات الأرقام (loto42 و loto29): تجاهل رقم السطر التسلسلي مثل (1. أو A أو #1) واستخرج الأرقام الـ 6 الفعلية فقط!

أرجع JSON نقي فقط بالشكل التالي:
{
  "game": "loto42" | "loto29" | "sports" | "sc500" | "sc1k",
  "mode": "ticket" | "result",
  "drawNumber": number | null,
  "drawDate": "YYYY-MM-DD" | null,
  "cost": number | null,
  "numbers": [6 أرقام مرتبة تصاعدياً في حال loto42 أو loto29] | null,
  "extraNumber": number | null,
  "roundName": "اسم جولة اللوتو الرياضي إن وجد" | null,
  "sportsPicks": { "1": "1", "2": "X", ... } | null,
  "scratchCells": [6 مبالغ كأرقام صحيحة لبطاقة طابق 3] | null,
  "scratchWinningNums": [3 أرقام رابحة لبطاقة جيب الكاس جيبه] | null,
  "scratchPlayerCells": [{ "num": number, "prize": number }] | null,
  "detectedWinAmount": number | null,
  "summaryAr": "وصف عربي مختصر ودقيق لما تمت قراءته والنتيجة"
}`;

  onProgress?.("جاري تدقيق الأرقام والخانات بالذكاء الاصطناعي 🧠...");

  let resultText = "";
  for (const model of CANDIDATE_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  { inline_data: { mime_type: mimeType, data: base64 } },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              response_mime_type: "application/json",
            },
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        resultText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (resultText) break;
      }
    } catch {
      // Try next candidate model
    }
  }

  if (!resultText) {
    throw new Error("تعذر قراءة الصورة حالياً. يرجى التأكد من وضوح إضاءة البطاقة والمحاولة مجدداً.");
  }

  const cleaned = resultText
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "");
  const parsed = JSON.parse(cleaned);

  const validGames: IraqLotoGameId[] = ["sports", "loto42", "loto29", "sc500", "sc1k"];
  const game: IraqLotoGameId = validGames.includes(parsed.game)
    ? parsed.game
    : expectedGame || "loto42";

  // Normalize numbers for Loto 42 / Loto 29
  let numbers: number[] | undefined;
  if (Array.isArray(parsed.numbers)) {
    const maxN = game === "loto29" ? 29 : 42;
    let rawNums = parsed.numbers
      .map((n: any) => Number(n))
      .filter((n: number) => Number.isFinite(n) && n >= 1 && n <= maxN);
    if (rawNums.length === 7 && rawNums[0] <= 4) {
      rawNums = rawNums.slice(1);
    }
    if (rawNums.length >= 6) {
      numbers = Array.from(new Set<number>(rawNums))
        .slice(0, 6)
        .sort((a, b) => a - b);
    }
  }

  // Normalize Sports picks
  let sportsPicks: Record<number, SportsPickChoice> | undefined;
  if (parsed.sportsPicks && typeof parsed.sportsPicks === "object") {
    sportsPicks = {};
    for (const [k, v] of Object.entries(parsed.sportsPicks)) {
      const pos = Number(k);
      const val = String(v).toUpperCase();
      if (pos >= 1 && pos <= 10 && (val === "1" || val === "X" || val === "2")) {
        sportsPicks[pos] = val;
      }
    }
  }

  // Exact verification for Scratch cards (never trust hallucinated math — compute exact match!)
  let detectedWinAmount: number | undefined =
    typeof parsed.detectedWinAmount === "number" ? parsed.detectedWinAmount : undefined;

  let scratchCells: number[] | undefined;
  if (Array.isArray(parsed.scratchCells)) {
    const cells: number[] = parsed.scratchCells
      .map((n: any) => Number(n))
      .filter((n: number) => Number.isFinite(n) && n > 0);
    scratchCells = cells;
    // Exact 3-of-a-kind verification for SC500 (طابق 3)
    const freq: Record<number, number> = {};
    for (const amt of cells) {
      freq[amt] = (freq[amt] || 0) + 1;
    }
    const winningAmts = Object.entries(freq)
      .filter(([, cnt]) => cnt >= 3)
      .map(([amt]) => Number(amt));
    detectedWinAmount = winningAmts.length > 0 ? Math.max(...winningAmts) : 0;
  }

  let scratchWinningNums: number[] | undefined;
  let scratchPlayerCells: { num: number; prize: number }[] | undefined;
  if (Array.isArray(parsed.scratchWinningNums) && Array.isArray(parsed.scratchPlayerCells)) {
    const winNums: number[] = parsed.scratchWinningNums
      .map((n: any) => Number(n))
      .filter((n: number) => Number.isFinite(n));
    const playerCells: { num: number; prize: number }[] = parsed.scratchPlayerCells
      .map((c: any) => ({ num: Number(c?.num), prize: Number(c?.prize) || 0 }))
      .filter((c: { num: number; prize: number }) => Number.isFinite(c.num));
    scratchWinningNums = winNums;
    scratchPlayerCells = playerCells;
    const winSet = new Set(winNums);
    detectedWinAmount = playerCells
      .filter((c) => winSet.has(c.num))
      .reduce((sum, c) => sum + c.prize, 0);
  }

  return {
    game,
    mode: parsed.mode === "result" ? "result" : "ticket",
    drawNumber: parsed.drawNumber ? Number(parsed.drawNumber) : undefined,
    drawDate: typeof parsed.drawDate === "string" ? parsed.drawDate : undefined,
    cost: parsed.cost ? Number(parsed.cost) : undefined,
    numbers,
    extraNumber:
      game === "loto42" && parsed.extraNumber ? Number(parsed.extraNumber) : undefined,
    roundName: parsed.roundName ? String(parsed.roundName) : undefined,
    sportsPicks,
    scratchCells,
    scratchWinningNums,
    scratchPlayerCells,
    detectedWinAmount,
    summaryAr: parsed.summaryAr ? String(parsed.summaryAr) : undefined,
  };
}
