"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import { useRouter } from "next/navigation";
import { ArrowRight, Camera, Image as ImageIcon, Plus, Trash2 } from "lucide-react";

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

type Point = { x: number; y: number };
type FilterMode = "original" | "magic" | "bw" | "gray";

export type ScannedPage = {
  id: string;
  dataUrl: string;
};

export default function DocumentScannerPage() {
  const router = useRouter();
  const [step, setStep] = useState<"init" | "camera" | "adjust" | "preview">("init");
  const [libsReady, setLibsReady] = useState(false);
  const [loadingLibs, setLoadingLibs] = useState(true);
  
  const [rawImage, setRawImage] = useState<HTMLImageElement | null>(null);
  const [corners, setCorners] = useState<Point[] | null>(null);
  const [filter, setFilter] = useState<FilterMode>("magic");
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [busy, setBusy] = useState(false);
  
  // Camera refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const reqAnimRef = useRef<number>(0);
  const liveCornersRef = useRef<Point[] | null>(null);

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
        // Start camera if on mobile/desktop by default
        startCamera();
      })
      .catch((err) => {
        console.error(err);
        setLoadingLibs(false);
      });
    return () => {
      mounted = false;
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    if (reqAnimRef.current) cancelAnimationFrame(reqAnimRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setStep("camera");
      // Start processing loop
      processVideoFrame();
    } catch (e) {
      console.error("Camera access denied or unavailable", e);
      // Fallback to upload mode by jumping straight to preview without pages (or custom screen)
      setStep("preview"); 
    }
  };

  const processVideoFrame = () => {
    if (step !== "camera" || !videoRef.current || !overlayRef.current || !scannerRef.current || !window.cv) {
      reqAnimRef.current = requestAnimationFrame(processVideoFrame);
      return;
    }

    const video = videoRef.current;
    const overlay = overlayRef.current;
    
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      reqAnimRef.current = requestAnimationFrame(processVideoFrame);
      return;
    }

    // Match overlay size to video display size
    const rect = video.getBoundingClientRect();
    overlay.width = rect.width;
    overlay.height = rect.height;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;

    // Fast processing canvas (small size)
    const procScale = 0.2; 
    const procW = video.videoWidth * procScale;
    const procH = video.videoHeight * procScale;
    const procCanvas = document.createElement("canvas");
    procCanvas.width = procW;
    procCanvas.height = procH;
    const procCtx = procCanvas.getContext("2d");
    
    if (procCtx) {
      procCtx.drawImage(video, 0, 0, procW, procH);
      try {
        const mat = window.cv.imread(procCanvas);
        const contour = scannerRef.current.findPaperContour(mat);
        const cp = scannerRef.current.getCornerPoints(contour);
        mat.delete();
        
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        
        if (cp && cp.topLeftCorner) {
          // Map coordinates from procCanvas back to original video dimensions, then to bounding client rect
          const mapToOverlay = (pt: any) => {
            // pt is in procCanvas scale
            const origX = pt.x / procScale;
            const origY = pt.y / procScale;
            // Now origX/origY are in video intrinsic coords. Map to overlay rect:
            const overlayX = (origX / video.videoWidth) * overlay.width;
            const overlayY = (origY / video.videoHeight) * overlay.height;
            return { x: overlayX, y: overlayY };
          };
          
          const p1 = mapToOverlay(cp.topLeftCorner);
          const p2 = mapToOverlay(cp.topRightCorner);
          const p3 = mapToOverlay(cp.bottomRightCorner);
          const p4 = mapToOverlay(cp.bottomLeftCorner);
          
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.lineTo(p3.x, p3.y);
          ctx.lineTo(p4.x, p4.y);
          ctx.closePath();
          
          // Draw iOS style scanning box
          ctx.fillStyle = "rgba(255, 204, 0, 0.3)";
          ctx.fill();
          ctx.strokeStyle = "rgba(255, 204, 0, 0.9)";
          ctx.lineWidth = 3;
          ctx.stroke();

          // Save original coordinates for capture
          liveCornersRef.current = [
            { x: cp.topLeftCorner.x / procScale, y: cp.topLeftCorner.y / procScale },
            { x: cp.topRightCorner.x / procScale, y: cp.topRightCorner.y / procScale },
            { x: cp.bottomRightCorner.x / procScale, y: cp.bottomRightCorner.y / procScale },
            { x: cp.bottomLeftCorner.x / procScale, y: cp.bottomLeftCorner.y / procScale }
          ];
        } else {
          liveCornersRef.current = null;
        }
      } catch (e) {}
    }
    
    reqAnimRef.current = requestAnimationFrame(processVideoFrame);
  };

  const handleCapture = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    
    const img = new Image();
    img.onload = () => {
      setRawImage(img);
      if (liveCornersRef.current) {
        setCorners(liveCornersRef.current);
      } else {
        // Fallback margin
        const mx = img.naturalWidth * 0.05;
        const my = img.naturalHeight * 0.05;
        setCorners([
          { x: mx, y: my },
          { x: img.naturalWidth - mx, y: my },
          { x: img.naturalWidth - mx, y: img.naturalHeight - my },
          { x: mx, y: img.naturalHeight - my },
        ]);
      }
      stopCamera();
      setStep("adjust");
    };
    img.src = dataUrl;
  };

  const handleFileSelected = useCallback(
    (file: File) => {
      stopCamera();
      const img = new Image();
      img.onload = () => {
        setRawImage(img);
        detectCornersStatic(img);
        setStep("adjust");
      };
      img.src = URL.createObjectURL(file);
    },
    [] 
  );

  const detectCornersStatic = (img: HTMLImageElement) => {
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
    } catch (err) {}
    const mx = img.naturalWidth * 0.06;
    const my = img.naturalHeight * 0.06;
    setCorners([
      { x: mx, y: my },
      { x: img.naturalWidth - mx, y: my },
      { x: img.naturalWidth - mx, y: img.naturalHeight - my },
      { x: mx, y: img.naturalHeight - my },
    ]);
  };

  // -------------------------------------------------------------------------
  // رسم صورة التعديل (Adjust)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (step !== "adjust" || !rawImage || !corners) return;
    const canvas = adjustCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const scale = Math.min(1, 800 / rawImage.naturalWidth);
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
      ctx.strokeStyle = "#ec4899";
      ctx.lineWidth = 3;
      ctx.fillStyle = "rgba(236, 72, 153, 0.15)";
      ctx.fill();
      ctx.stroke();

      corners.forEach((p) => {
        const x = p.x * scale;
        const y = p.y * scale;
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
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
    return Math.min(1, 800 / rawImage.naturalWidth);
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
      if (d < 40) {
        closestDist = d;
        closest = i;
      }
    });
    if (closestDist < 40) {
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

  // -------------------------------------------------------------------------
  // تصحيح المنظور والفلاتر
  // -------------------------------------------------------------------------
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
    cv.warpPerspective(src, dst, M, new cv.Size(outWidth, outHeight), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

    // Generate output with CSS Filters on Canvas instead of OpenCV AdaptiveThreshold for much cleaner look
    const outCanvas = document.createElement("canvas");
    outCanvas.width = outWidth;
    outCanvas.height = outHeight;
    cv.imshow(outCanvas, dst);
    
    src.delete();
    dst.delete();
    M.delete();
    srcTri.delete();
    dstTri.delete();

    // Now apply clean filters
    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = outWidth;
    finalCanvas.height = outHeight;
    const fctx = finalCanvas.getContext("2d");
    if (!fctx) return outCanvas.toDataURL("image/jpeg", 0.92);

    if (filter === "magic") {
      fctx.filter = "contrast(130%) brightness(120%) saturate(120%)";
    } else if (filter === "bw") {
      fctx.filter = "grayscale(100%) contrast(150%) brightness(130%)";
    } else if (filter === "gray") {
      fctx.filter = "grayscale(100%)";
    }
    
    fctx.drawImage(outCanvas, 0, 0);
    return finalCanvas.toDataURL("image/jpeg", 0.92);
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
    }, 50);
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
    startCamera();
  };

  // -------------------------------------------------------------------------
  // واجهة العرض
  // -------------------------------------------------------------------------
  return (
    <div className="fixed inset-0 z-[100] bg-[#0f0f17] flex flex-col pt-safe pb-safe" dir="rtl">
      {/* Global Top Bar */}
      <div className="flex items-center justify-between p-4 bg-white/5 border-b border-white/10 z-50">
        <button 
          onClick={() => {
            stopCamera();
            router.push("/admin/custom-orders/grid-maker");
          }}
          className="bg-white/10 p-2 rounded-full text-white hover:bg-white/20 transition"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
        <h1 className="text-white font-bold text-sm">الماسح الضوئي الذكي</h1>
        <div className="w-9" />
      </div>

      <style>{`
        .scn-btn { border: none; border-radius: 14px; padding: 14px 18px; font-weight: 700; cursor: pointer; transition: transform .15s ease, opacity .15s; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 14px; }
        .scn-btn:active { transform: scale(0.97); }
        .scn-btn:disabled { opacity: 0.5; pointer-events: none; }
        .scn-btn-primary { background: linear-gradient(135deg, #ec4899, #8b5cf6); color: #fff; box-shadow: 0 4px 15px rgba(236,72,153,0.3); }
        .scn-btn-secondary { background: rgba(255,255,255,0.1); color: #fff; }
        .scn-filter { padding: 8px 14px; border-radius: 999px; border: 1.5px solid rgba(236,72,153,0.3); background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.7); font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
        .scn-filter.active { background: #ec4899; color: #fff; border-color: #ec4899; }
      `}</style>

      {/* Loading State */}
      {loadingLibs && (
        <div className="flex-1 flex flex-col items-center justify-center text-white/70">
          <div className="w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p>جارٍ تحميل محرك الذكاء الاصطناعي...</p>
        </div>
      )}

      {/* Live Camera State */}
      {!loadingLibs && step === "camera" && (
        <div className="flex-1 relative bg-black flex flex-col">
          <div className="relative flex-1 overflow-hidden bg-black">
            <video 
              ref={videoRef} 
              className="absolute inset-0 w-full h-full object-cover" 
              autoPlay 
              playsInline 
              muted 
            />
            <canvas 
              ref={overlayRef} 
              className="absolute inset-0 w-full h-full pointer-events-none" 
            />
          </div>
          
          <div className="h-40 bg-black/80 backdrop-blur-md p-6 flex flex-col items-center justify-center gap-6">
            <div className="flex items-center justify-center w-full gap-8">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelected(f);
                  e.target.value = "";
                }}
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white"
              >
                <ImageIcon className="w-6 h-6" />
              </button>
              
              <button 
                onClick={handleCapture}
                className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center active:scale-95 transition-transform"
              >
                <div className="w-16 h-16 bg-white rounded-full" />
              </button>
              
              <button 
                onClick={() => {
                  stopCamera();
                  setStep("preview");
                }}
                className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white relative"
              >
                <div className="text-xs font-bold">{pages.length}</div>
              </button>
            </div>
            <p className="text-white/50 text-xs">وجه الكاميرا نحو المستند لالتقاطه تلقائياً</p>
          </div>
        </div>
      )}

      {/* Adjust State */}
      {step === "adjust" && rawImage && corners && (
        <div className="flex-1 flex flex-col p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold text-lg">تحديد الحواف</h3>
            <p className="text-white/50 text-xs">اسحب الزوايا الدائرية لتطابق الورقة</p>
          </div>
          
          <div className="flex-1 bg-black/50 rounded-2xl p-2 flex items-center justify-center overflow-hidden mb-4 border border-white/10 relative">
            <canvas
              ref={adjustCanvasRef}
              className="max-w-full max-h-[60vh] touch-none rounded-lg"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            />
          </div>
          
          <div className="flex gap-3 mt-auto">
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

      {/* Preview State */}
      {step === "preview" && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
            <h3 className="text-white font-bold text-lg mb-4">
              المستند ({pages.length} صفحات)
            </h3>

            <div className="grid grid-cols-2 gap-2 mb-3">
              {(["magic", "bw", "gray", "original"] as FilterMode[]).map((f) => (
                <button
                  key={f}
                  className={`scn-filter w-full text-center justify-center ${filter === f ? "active" : ""}`}
                  onClick={() => setFilter(f)}
                >
                  {f === "magic" ? "سحري (ملون)" : f === "bw" ? "مستند أسود/أبيض" : f === "gray" ? "تدرج رمادي" : "أصلي"}
                </button>
              ))}
            </div>
            <p className="text-white/40 text-[11px] mb-6">
              يتم تطبيق الفلتر على الصفحات الجديدة.
            </p>

            {pages.length === 0 && (
              <div className="text-center py-12 opacity-50 bg-black/20 rounded-xl mb-6 border border-dashed border-white/10">
                <Camera className="w-12 h-12 mx-auto mb-3 text-white/50" />
                <p className="text-white">لا توجد صفحات ممسوحة</p>
                <button onClick={startNewPage} className="text-pink-400 font-bold mt-2 text-sm">افتح الكاميرا</button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-6">
              {pages.map((p, i) => (
                <div key={p.id} className="relative aspect-[1/1.4] bg-black rounded-xl overflow-hidden border border-white/10">
                  <img src={p.dataUrl} alt="Page" className="w-full h-full object-cover" />
                  <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] px-2 py-0.5 rounded-md backdrop-blur-sm">
                    {i + 1}
                  </div>
                  <button className="absolute top-2 left-2 bg-red-500/90 w-8 h-8 flex items-center justify-center rounded-full text-white" onClick={() => removePage(p.id)}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              
              <button 
                className="aspect-[1/1.4] bg-white/5 border-2 border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-white/10 transition"
                onClick={startNewPage}
              >
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-white/50" />
                </div>
                <span className="text-white/50 text-xs font-bold">إضافة صفحة</span>
              </button>
            </div>

            {pages.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-white/10">
                <button className="scn-btn scn-btn-primary" onClick={exportPdf}>
                  تصدير كـ PDF
                </button>
                <button className="scn-btn scn-btn-secondary" onClick={() => pages.forEach(p => {
                    const a = document.createElement("a");
                    a.href = p.dataUrl;
                    a.download = `scan-${p.id}.jpg`;
                    a.click();
                })}>
                  حفظ الصور في الاستوديو
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
