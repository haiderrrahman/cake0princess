"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

// ---------------------------------------------------------------------------
// إعدادات التحميل الديناميكي لمكتبتي OpenCV.js و jscanify
// ---------------------------------------------------------------------------
const OPENCV_SRC = "https://docs.opencv.org/4.7.0/opencv.js";
const JSCANIFY_SRC = "https://cdn.jsdelivr.net/gh/ColonelParrot/jscanify@master/src/jscanify.min.js";

declare global {
  interface Window {
    cv: any;
    jscanify: any;
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`فشل تحميل ${src}`));
    document.body.appendChild(script);
  });
}

async function loadScanningLibs(): Promise<void> {
  await loadScript(OPENCV_SRC);
  await new Promise<void>((resolve) => {
    if (window.cv && window.cv.Mat) {
      resolve();
      return;
    }
    const check = setInterval(() => {
      if (window.cv && window.cv.Mat) {
        clearInterval(check);
        resolve();
      }
    }, 100);
  });
  await loadScript(JSCANIFY_SRC);
}

// ---------------------------------------------------------------------------
// أنواع مساعدة
// ---------------------------------------------------------------------------
type Point = { x: number; y: number };
type FilterMode = "original" | "bw" | "gray";

export type ScannedPage = {
  id: string;
  dataUrl: string;
};

// ---------------------------------------------------------------------------
// المكوّن الرئيسي للصفحة
// ---------------------------------------------------------------------------
export default function DocumentScannerPage() {
  const router = useRouter();
  const [step, setStep] = useState<"capture" | "adjust" | "preview">("capture");
  const [libsReady, setLibsReady] = useState(false);
  const [loadingLibs, setLoadingLibs] = useState(true);
  const [rawImage, setRawImage] = useState<HTMLImageElement | null>(null);
  const [corners, setCorners] = useState<Point[] | null>(null);
  const [filter, setFilter] = useState<FilterMode>("bw");
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [busy, setBusy] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const adjustCanvasRef = useRef<HTMLCanvasElement>(null);
  const dragIndexRef = useRef<number | null>(null);
  const scannerRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;
    loadScanningLibs()
      .then(() => {
        if (!mounted) return;
        scannerRef.current = new window.jscanify();
        setLibsReady(true);
        setLoadingLibs(false);
      })
      .catch((err) => {
        console.error(err);
        setLoadingLibs(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleFileSelected = useCallback(
    (file: File) => {
      const img = new Image();
      img.onload = () => {
        setRawImage(img);
        detectCorners(img);
        setStep("adjust");
      };
      img.src = URL.createObjectURL(file);
    },
    [] 
  );

  const detectCorners = (img: HTMLImageElement) => {
    if (!libsReady || !window.cv || !scannerRef.current) {
      setCorners([
        { x: 0, y: 0 },
        { x: img.naturalWidth, y: 0 },
        { x: img.naturalWidth, y: img.naturalHeight },
        { x: 0, y: img.naturalHeight },
      ]);
      return;
    }
    try {
      const mat = window.cv.imread(img);
      const contour = scannerRef.current.findPaperContour(mat);
      const cp = scannerRef.current.getCornerPoints(contour);
      mat.delete();
      if (cp && cp.topLeftCorner) {
        setCorners([
          { x: cp.topLeftCorner.x, y: cp.topLeftCorner.y },
          { x: cp.topRightCorner.x, y: cp.topRightCorner.y },
          { x: cp.bottomRightCorner.x, y: cp.bottomRightCorner.y },
          { x: cp.bottomLeftCorner.x, y: cp.bottomLeftCorner.y },
        ]);
        return;
      }
    } catch (err) {
      console.warn("تعذّر الاكتشاف التلقائي للحواف، استخدم الزوايا الكاملة", err);
    }
    const mx = img.naturalWidth * 0.06;
    const my = img.naturalHeight * 0.06;
    setCorners([
      { x: mx, y: my },
      { x: img.naturalWidth - mx, y: my },
      { x: img.naturalWidth - mx, y: img.naturalHeight - my },
      { x: mx, y: img.naturalHeight - my },
    ]);
  };

  useEffect(() => {
    if (step !== "adjust" || !rawImage || !corners) return;
    const canvas = adjustCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const scale = Math.min(1, 700 / rawImage.naturalWidth);
    canvas.width = rawImage.naturalWidth * scale;
    canvas.height = rawImage.naturalHeight * scale;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(rawImage, 0, 0, canvas.width, canvas.height);

      ctx.beginPath();
      corners.forEach((p, i) => {
        const x = p.x * scale;
        const y = p.y * scale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.strokeStyle = "#ec4899"; // Pink for Cake Princess
      ctx.lineWidth = 3;
      ctx.fillStyle = "rgba(236, 72, 153, 0.15)";
      ctx.fill();
      ctx.stroke();

      corners.forEach((p) => {
        const x = p.x * scale;
        const y = p.y * scale;
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#ec4899";
        ctx.stroke();
      });
    };
    draw();
  }, [step, rawImage, corners]);

  const getScale = () => {
    if (!rawImage) return 1;
    return Math.min(1, 700 / rawImage.naturalWidth);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!corners) return;
    const canvas = adjustCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const scale = getScale();

    let closest = -1;
    let closestDist = Infinity;
    corners.forEach((p, i) => {
      const d = Math.hypot(p.x * scale - x, p.y * scale - y);
      if (d < closestDist) {
        closestDist = d;
        closest = i;
      }
    });
    if (closestDist < 30) {
      dragIndexRef.current = closest;
      canvas.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragIndexRef.current === null || !corners || !rawImage) return;
    const canvas = adjustCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = getScale();
    const x = Math.min(Math.max(e.clientX - rect.left, 0), canvas.width) / scale;
    const y = Math.min(Math.max(e.clientY - rect.top, 0), canvas.height) / scale;

    const next = [...corners];
    next[dragIndexRef.current] = { x, y };
    setCorners(next);
  };

  const handlePointerUp = () => {
    dragIndexRef.current = null;
  };

  const applyPerspectiveAndFilter = useCallback((): string | null => {
    if (!rawImage || !corners || !window.cv) return null;
    const cv = window.cv;

    const src = cv.imread(rawImage);

    const outWidth = 900;
    const outHeight = Math.round(outWidth * 1.414);

    const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      corners[0].x, corners[0].y,
      corners[1].x, corners[1].y,
      corners[2].x, corners[2].y,
      corners[3].x, corners[3].y,
    ]);
    const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0, 0,
      outWidth, 0,
      outWidth, outHeight,
      0, outHeight,
    ]);

    const M = cv.getPerspectiveTransform(srcTri, dstTri);
    const dst = new cv.Mat();
    cv.warpPerspective(
      src,
      dst,
      M,
      new cv.Size(outWidth, outHeight),
      cv.INTER_LINEAR,
      cv.BORDER_CONSTANT,
      new cv.Scalar()
    );

    if (filter === "gray") {
      cv.cvtColor(dst, dst, cv.COLOR_RGBA2GRAY);
    } else if (filter === "bw") {
      cv.cvtColor(dst, dst, cv.COLOR_RGBA2GRAY);
      cv.adaptiveThreshold(
        dst,
        dst,
        255,
        cv.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv.THRESH_BINARY,
        25,
        15
      );
    }

    const outCanvas = document.createElement("canvas");
    outCanvas.width = outWidth;
    outCanvas.height = outHeight;
    cv.imshow(outCanvas, dst);

    src.delete();
    dst.delete();
    M.delete();
    srcTri.delete();
    dstTri.delete();

    return outCanvas.toDataURL("image/jpeg", 0.92);
  }, [rawImage, corners, filter]);

  const confirmPage = () => {
    setBusy(true);
    setTimeout(() => {
      const dataUrl = applyPerspectiveAndFilter();
      if (dataUrl) {
        setPages((prev) => [...prev, { id: crypto.randomUUID(), dataUrl }]);
      }
      setBusy(false);
      setStep("preview");
    }, 30);
  };

  const downloadPage = (page: ScannedPage) => {
    const a = document.createElement("a");
    a.href = page.dataUrl;
    a.download = `scan-${page.id}.jpg`;
    a.click();
  };

  const exportPdf = () => {
    if (pages.length === 0) return;
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    pages.forEach((page, i) => {
      if (i > 0) pdf.addPage();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      pdf.addImage(page.dataUrl, "JPEG", 0, 0, pageWidth, pageHeight);
    });
    pdf.save("scanned-document.pdf");
  };

  const removePage = (id: string) => {
    setPages((prev) => prev.filter((p) => p.id !== id));
  };

  const startNewPage = () => {
    setRawImage(null);
    setCorners(null);
    setStep("capture");
  };

  const handleFinish = () => {
    router.push("/admin/custom-orders/grid-maker");
  };

  return (
    <div className="min-h-screen bg-[#0f0f17] flex flex-col pt-safe pb-safe" dir="rtl">
      {/* Global Top Bar */}
      <div className="flex items-center justify-between p-4 bg-white/5 border-b border-white/10">
        <button 
          onClick={handleFinish}
          className="bg-white/10 p-2 rounded-full text-white hover:bg-white/20 transition"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
        <h1 className="text-white font-bold">الماسح الضوئي الذكي</h1>
        <div className="w-9" />
      </div>

      <div className="flex-1 w-full max-w-md mx-auto p-4 overflow-y-auto">
        <style>{`
          .scn-card { background: rgba(255,255,255,0.05); border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); padding: 20px; }
          .scn-btn { border: none; border-radius: 14px; padding: 14px 18px; font-weight: 700; cursor: pointer; transition: transform .15s ease, opacity .15s; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 14px; }
          .scn-btn:active { transform: scale(0.97); }
          .scn-btn:disabled { opacity: 0.5; pointer-events: none; }
          .scn-btn-primary { background: linear-gradient(135deg, #ec4899, #8b5cf6); color: #fff; box-shadow: 0 4px 15px rgba(236,72,153,0.3); }
          .scn-btn-secondary { background: rgba(255,255,255,0.1); color: #fff; }
          .scn-btn-ghost { background: transparent; color: rgba(255,255,255,0.7); border: 1.5px solid rgba(255,255,255,0.2); }
          .scn-filter { padding: 8px 14px; border-radius: 999px; border: 1.5px solid rgba(236,72,153,0.3); background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.7); font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
          .scn-filter.active { background: #ec4899; color: #fff; border-color: #ec4899; }
          .scn-thumb { position: relative; border-radius: 12px; overflow: hidden; border: 1.5px solid rgba(255,255,255,0.1); background: #000; }
          .scn-thumb img { width: 100%; display: block; }
          .scn-remove { position: absolute; top: 6px; left: 6px; background: rgba(220,38,38,0.9); color: #fff; border: none; border-radius: 999px; width: 28px; height: 28px; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        `}</style>

        {loadingLibs && (
          <div className="scn-card text-center text-white/70 flex flex-col items-center justify-center py-12">
            <div className="w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p>جارٍ تحميل محرك الذكاء الاصطناعي...</p>
          </div>
        )}

        {!loadingLibs && step === "capture" && (
          <div className="scn-card text-center py-8">
            <div className="w-16 h-16 bg-pink-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl">
              📸
            </div>
            <h3 className="text-white font-bold text-lg mb-2">التقط صورة للمستند</h3>
            <p className="text-white/50 text-sm mb-8">
              سيتم التعرف على حواف الورقة وتصحيح المنظور تلقائياً
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelected(f);
                e.target.value = "";
              }}
            />

            <button
              className="scn-btn scn-btn-primary mb-3"
              onClick={() => fileInputRef.current?.click()}
            >
              التقاط بالكاميرا
            </button>
            <button
              className="scn-btn scn-btn-secondary"
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                input.onchange = () => {
                  const f = input.files?.[0];
                  if (f) handleFileSelected(f);
                };
                input.click();
              }}
            >
              رفع من الاستوديو
            </button>

            {pages.length > 0 && (
              <button
                className="scn-btn scn-btn-ghost mt-6"
                onClick={() => setStep("preview")}
              >
                عرض الصفحات الممسوحة ({pages.length})
              </button>
            )}
          </div>
        )}

        {step === "adjust" && rawImage && corners && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-lg">تحديد الحواف</h3>
              <p className="text-white/50 text-xs">اسحب الزوايا الدائرية لتطابق الورقة</p>
            </div>
            
            <div className="flex-1 bg-black/50 rounded-2xl p-2 flex items-center justify-center overflow-hidden mb-4 border border-white/10">
              <canvas
                ref={adjustCanvasRef}
                className="max-w-full max-h-[60vh] touch-none rounded-lg"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              />
            </div>
            
            <div className="flex gap-3">
              <button className="scn-btn scn-btn-secondary flex-1" onClick={startNewPage}>
                إلغاء
              </button>
              <button
                className="scn-btn scn-btn-primary flex-[2]"
                disabled={busy}
                onClick={confirmPage}
              >
                {busy ? "جارٍ المعالجة..." : "تأكيد ومسح"}
              </button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="scn-card">
            <h3 className="text-white font-bold text-lg mb-4">
              المستند ({pages.length} صفحات)
            </h3>

            <div className="flex gap-2 mb-3 flex-wrap">
              {(["bw", "gray", "original"] as FilterMode[]).map((f) => (
                <button
                  key={f}
                  className={`scn-filter ${filter === f ? "active" : ""}`}
                  onClick={() => setFilter(f)}
                >
                  {f === "bw" ? "أبيض وأسود" : f === "gray" ? "تدرج رمادي" : "صورة أصلية"}
                </button>
              ))}
            </div>
            <p className="text-white/40 text-xs mb-6">
              يتم تطبيق الفلتر على الصفحات الجديدة.
            </p>

            {pages.length === 0 && (
              <div className="text-center py-8 opacity-50">
                <p className="text-white">لا توجد صفحات ممسوحة</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-6">
              {pages.map((p, i) => (
                <div key={p.id} className="scn-thumb aspect-[1/1.4]">
                  <img src={p.dataUrl} alt="Page" className="w-full h-full object-cover" />
                  <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-md">
                    {i + 1}
                  </div>
                  <button className="scn-remove" onClick={() => removePage(p.id)}>
                    ✕
                  </button>
                </div>
              ))}
              
              <button 
                className="aspect-[1/1.4] bg-white/5 border-2 border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-white/10 transition"
                onClick={startNewPage}
              >
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-white/50" />
                </div>
                <span className="text-white/50 text-xs font-bold">إضافة صفحة</span>
              </button>
            </div>

            {pages.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-white/10">
                <button
                  className="scn-btn scn-btn-primary"
                  onClick={exportPdf}
                >
                  تصدير كـ PDF ({pages.length} صفحات)
                </button>
                <button
                  className="scn-btn scn-btn-secondary"
                  onClick={() => {
                    pages.forEach(p => downloadPage(p));
                  }}
                >
                  حفظ الصور في الاستوديو
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
