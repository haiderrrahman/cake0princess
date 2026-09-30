import { NextResponse } from 'next/server';
import fs from 'fs';
import { execSync } from 'child_process';
import os from 'os';
import path from 'path';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds

// Categories available in the app for auto-mapping
const VALID_CATEGORIES = [
  "سوبر ماركت",
  "مطاعم وكوفيهات",
  "منزلية",
  "صيدلية وعلاج",
  "سيارة",
  "تسوق وملابس",
  "فواتير وخدمات",
  "أخرى"
];

function convertHeicToJpeg(base64Data: string): { data: string; mimeType: string } {
  try {
    const tmpInput = path.join(os.tmpdir(), `receipt_${Date.now()}_${Math.random().toString(36).substring(7)}.heic`);
    const tmpOutput = path.join(os.tmpdir(), `receipt_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`);
    
    fs.writeFileSync(tmpInput, Buffer.from(base64Data, 'base64'));
    execSync(`sips -s format jpeg "${tmpInput}" --out "${tmpOutput}" 2>/dev/null`);
    
    if (fs.existsSync(tmpOutput)) {
      const converted = fs.readFileSync(tmpOutput).toString('base64');
      try { fs.unlinkSync(tmpInput); } catch (_) {}
      try { fs.unlinkSync(tmpOutput); } catch (_) {}
      return { data: converted, mimeType: 'image/jpeg' };
    }
  } catch (err) {
    console.error('HEIC conversion error:', err);
  }
  return { data: base64Data, mimeType: 'image/jpeg' };
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'مفتاح الذكاء الاصطناعي (GEMINI_API_KEY) غير مهيأ في الخادم' }, { status: 500 });
    }

    const body = await request.json();
    let { image, mimeType = 'image/jpeg' } = body;

    if (!image) {
      return NextResponse.json({ error: 'لم يتم إرسال صورة الفاتورة' }, { status: 400 });
    }

    // Strip data URI prefix if present
    if (image.includes(';base64,')) {
      const parts = image.split(';base64,');
      const mimeMatch = parts[0].match(/data:(.*?)$/);
      if (mimeMatch) mimeType = mimeMatch[1];
      image = parts[1];
    }

    // Check if HEIC/HEIF
    if (mimeType.toLowerCase().includes('heic') || mimeType.toLowerCase().includes('heif')) {
      const converted = convertHeicToJpeg(image);
      image = converted.data;
      mimeType = converted.mimeType;
    }

    const systemPrompt = `أنت مساعد خبير متخصص في قراءة وتحليل فواتير الشراء والإيصالات باللغة العربية والعراقية بدقة 100%.
قم باستخراج بيانات الفاتورة المرفقة وتحويلها إلى كائن JSON بالهيكل التالي:
{
  "storeName": "اسم المتجر أو السوبرماركت بدقة كما يظهر في الفاتورة",
  "date": "YYYY-MM-DD", // تاريخ الشراء إذا وجد، وإذا لم يوجد استخدم تاريخ اليوم بصيغة YYYY-MM-DD
  "category": "سوبر ماركت", // اختر الفئة الأنسب من: ["سوبر ماركت", "مطاعم وكوفيهات", "منزلية", "صيدلية وعلاج", "سيارة", "تسوق وملابس", "فواتير وخدمات", "أخرى"]
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

    // Try primary and fallback models to guarantee high availability
    const candidateModels = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];
    let lastError: any = null;
    let resultText = '';

    for (const model of candidateModels) {
      try {
        const payload = {
          contents: [
            {
              parts: [
                { text: systemPrompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: image
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            response_mime_type: 'application/json'
          }
        };

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.status === 200) {
          const resData = await res.json();
          resultText = resData.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (resultText) break;
        } else {
          const errData = await res.text();
          console.warn(`Model ${model} returned status ${res.status}:`, errData.slice(0, 200));
          lastError = errData;
        }
      } catch (err: any) {
        console.warn(`Model ${model} failed:`, err.message);
        lastError = err;
      }
    }

    if (!resultText) {
      return NextResponse.json({ 
        error: 'تعذر تحليل الفاتورة في الوقت الحالي. يرجى التأكد من وضوح الصورة والمحاولة مجدداً.',
        details: lastError?.message || String(lastError)
      }, { status: 502 });
    }

    // Clean JSON formatting if wrapped in code blocks
    let cleaned = resultText.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(cleaned);

    // Validate and normalize fields
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

    let category = parsed.category || 'سوبر ماركت';
    if (!VALID_CATEGORIES.includes(category)) {
      category = 'سوبر ماركت';
    }

    return NextResponse.json({
      success: true,
      data: {
        storeName: parsed.storeName || 'فاتورة مشتريات',
        date: parsed.date || new Date().toISOString().split('T')[0],
        category,
        totalAmount: total,
        items: normalizedItems
      }
    });

  } catch (error: any) {
    console.error('Scan receipt error:', error);
    return NextResponse.json({
      error: 'حدث خطأ أثناء معالجة الفاتورة',
      details: error.message
    }, { status: 500 });
  }
}
