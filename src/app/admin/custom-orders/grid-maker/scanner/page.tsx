"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import { useRouter } from "next/navigation";
import { ArrowRight, Camera, Image as ImageIcon, Plus, Trash2, CheckCircle2 } from "lucide-react";

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
  const [step, setStep] = useState<"camera" | "adjust" | "preview">("camera");
  const [libsReady, setLibsReady] = useState(false);
  const [hasCameraError, setHasCameraError] = useState(false);
  
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

  // Load Libs
  useEffect(() => {
    let mounted = true;
    loadScanningLibs()
      .then(() => {
        if (!mounted) return;
        scannerRef.current = new window.jscanify();
        setLibsReady(true);
      })
      .catch((err) => {
        console.error("Error loading CV:", err);
      });
    return () => { mounted = false; };
  }, []);

  // Camera Management
  useEffect(() => {
    if (step === "camera") {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [step]);

  const stopCamera = () => {
    if (reqAnimRef.current) {
      cancelAnimationFrame(reqAnimRef.current);
      reqAnimRef.current = 0;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    setHasCameraError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true"); // critical for iOS
        videoRef.current.play().catch(e => console.error("play error:", e));
      }
      processVideoFrame();
    } catch (e) {
      console.error("Camera access denied or unavailable", e);
      setHasCameraError(true);
    }
  };

  const processVideoFrame = () => {
    if (step !== "camera" || !videoRef.current || !overlayRef.current) {
      return; // Stop loop
    }

    const video = videoRef.current;
    const overlay = overlayRef.current;
    
    if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0 && video.videoHeight > 0) {
      const rect = video.getBoundingClientRect();
      if (overlay.width !== rect.width || overlay.height !== rect.height) {
        overlay.width = rect.width;
        overlay.height = rect.height;
      }
      
      const ctx = overlay.getContext("2d");
      if (ctx && libsReady && scannerRef.current && window.cv) {
        const procScale = 0.25; // slightly higher for better accuracy
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
              const mapToOverlay = (pt: any) => {
                const origX = pt.x / procScale;
                const origY = pt.y / procScale;
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
              
              ctx.fillStyle = "rgba(16, 185, 129, 0.2)"; // emerald green for professional look
              ctx.fill();
              ctx.strokeStyle = "rgba(16, 185, 129, 0.9)";
              ctx.lineWidth = 3;
              ctx.stroke();

              // Draw corner dots
              [p1, p2, p3, p4].forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
                ctx.fillStyle = "#10b981";
                ctx.fill();
              });

              liveCornersRef.current = [
                { x: cp.topLeftCorner.x / procScale, y: cp.topLeftCorner.y / procScale },
                { x: cp.topRightCorner.x / procScale, y: cp.topRightCorner.y / procScale },
                { x: cp.bottomRightCorner.x / procScale, y: cp.bottomRightCorner.y / procScale },
                { x: cp.bottomLeftCorner.x / procScale, y: cp.bottomLeftCorner.y / procScale }
              ];
            } else {
              ctx.clearRect(0, 0, overlay.width, overlay.height);
              liveCornersRef.current = null;
            }
          } catch (e) {}
        }
      }
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
        const mx = img.naturalWidth * 0.05;
        const my = img.naturalHeight * 0.05;
        setCorners([
          { x: mx, y: my },
          { x: img.naturalWidth - mx, y: my },
          { x: img.naturalWidth - mx, y: img.naturalHeight - my },
          { x: mx, y: img.naturalHeight - my },
        ]);
      }
      setStep("adjust");
    };
    img.src = dataUrl;
  };

  const handleFileSelected = useCallback(
    (file: File) => {
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

  // Adjust Render
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
      ctx.strokeStyle = "#10b981"; // emerald
      ctx.lineWidth = 3;
      ctx.fillStyle = "rgba(16, 185, 129, 0.2)";
      ctx.fill();
      ctx.stroke();

      corners.forEach((p) => {
        const x = p.x * scale;
        const y = p.y * scale;
        ctx.beginPath();
        ctx.arc(x, y, 16, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#10b981";
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
      if (d < 50) {
        closestDist = d;
        closest = i;
      }
    });
    if (closestDist < 50) {
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
    if (!rawImage || !corners) return null;
    
    // Fallback if OpenCV not ready
    if (!window.cv || !libsReady) {
      const cvs = document.createElement("canvas");
      cvs.width = rawImage.naturalWidth;
      cvs.height = rawImage.naturalHeight;
      const ctx = cvs.getContext("2d");
      if (ctx) ctx.drawImage(rawImage, 0, 0);
      return cvs.toDataURL("image/jpeg", 0.9);
    }

    const cv = window.cv;
    const src = cv.imread(rawImage);
    
    // Calculate proper output size based on points
    const w1 = Math.hypot(corners[0].x - corners[1].x, corners[0].y - corners[1].y);
    const w2 = Math.hypot(corners[2].x - corners[3].x, corners[2].y - corners[3].y);
    const outWidth = Math.max(w1, w2);
    
    const h1 = Math.hypot(corners[0].x - corners[3].x, corners[0].y - corners[3].y);
    const h2 = Math.hypot(corners[1].x - corners[2].x, corners[1].y - corners[2].y);
    const outHeight = Math.max(h1, h2);

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

    const outCanvas = document.createElement("canvas");
    outCanvas.width = outWidth;
    outCanvas.height = outHeight;
    cv.imshow(outCanvas, dst);
    
    src.delete();
    dst.delete();
    M.delete();
    srcTri.delete();
    dstTri.delete();

    // Filters via CSS Context
    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = outWidth;
    finalCanvas.height = outHeight;
    const fctx = finalCanvas.getContext("2d");
    if (!fctx) return outCanvas.toDataURL("image/jpeg", 0.95);

    if (filter === "magic") {
      fctx.filter = "contrast(1.3) brightness(1.2) saturate(1.2)";
    } else if (filter === "bw") {
      fctx.filter = "grayscale(100%) contrast(1.5) brightness(1.3)";
    } else if (filter === "gray") {
      fctx.filter = "grayscale(100%)";
    }
    
    fctx.drawImage(outCanvas, 0, 0);
    return finalCanvas.toDataURL("image/jpeg", 0.95);
  }, [rawImage, corners, filter, libsReady]);

  const confirmPage = () => {
    setBusy(true);
    // Add small delay to allow UI to update to "processing..."
    setTimeout(() => {
      const dataUrl = applyPerspectiveAndFilter();
      if (dataUrl) {
        setPages((prev) => [...prev, { id: crypto.randomUUID(), dataUrl }]);
      }
      setBusy(false);
      setStep("preview");
    }, 100);
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
    setStep("camera");
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#0f0f17] flex flex-col pt-safe pb-safe" dir="rtl">
      {/* Global Top Bar */}
      <div className="flex items-center justify-between p-4 bg-white/5 border-b border-white/10 z-50">
        <button 
          onClick={() => {
            stopCamera();
            router.push("/admin/custom-orders/grid-maker");
          }}
          className="bg-white/10 p-2 rounded-full text-white hover:bg-white/20 transition active:scale-90"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
        <h1 className="text-white font-bold text-sm tracking-wide">ماسح المستندات <span className="text-emerald-400">الاحترافي</span></h1>
        <div className="w-9" />
      </div>

      <style>{`
        .scn-btn { border: none; border-radius: 14px; padding: 14px 18px; font-weight: 700; cursor: pointer; transition: transform .15s ease, opacity .15s; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 14px; }
        .scn-btn:active { transform: scale(0.97); }
        .scn-btn:disabled { opacity: 0.5; pointer-events: none; }
        .scn-btn-primary { background: linear-gradient(135deg, #10b981, #059669); color: #fff; box-shadow: 0 4px 15px rgba(16,185,129,0.3); }
        .scn-btn-secondary { background: rgba(255,255,255,0.1); color: #fff; }
        .scn-filter { padding: 8px 14px; border-radius: 999px; border: 1.5px solid rgba(16,185,129,0.3); background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.7); font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
        .scn-filter.active { background: #10b981; color: #fff; border-color: #10b981; }
      `}</style>

      {/* Live Camera State */}
      <div className={`flex-1 relative bg-black flex flex-col ${step === "camera" ? 'flex' : 'hidden'}`}>
        {hasCameraError ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4">
              <Camera className="w-8 h-8 text-white/50" />
            </div>
            <p className="text-white font-bold mb-2">لا يمكن الوصول للكاميرا</p>
            <p className="text-white/50 text-xs mb-6 max-w-xs">يرجى التأكد من منح صلاحية الكاميرا للمتصفح، أو استخدم خيار رفع صورة من الاستوديو.</p>
            <button onClick={startCamera} className="scn-btn scn-btn-primary w-auto px-8 mb-4">
              إعادة المحاولة
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="scn-btn scn-btn-secondary w-auto px-8">
              اختيار من الاستوديو
            </button>
          </div>
        ) : (
          <>
            <div className="relative flex-1 overflow-hidden bg-black">
              <video 
                ref={videoRef} 
                className="absolute inset-0 w-full h-full object-cover" 
                autoPlay 
                playsInline 
                webkit-playsinline="true"
                muted 
              />
              <canvas 
                ref={overlayRef} 
                className="absolute inset-0 w-full h-full pointer-events-none" 
              />
              {!libsReady && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-[10px] text-white font-bold">تهيئة الذكاء الاصطناعي...</span>
                </div>
              )}
            </div>
            
            <div className="h-44 bg-black/90 backdrop-blur-md p-6 flex flex-col items-center justify-center gap-6">
              <div className="flex items-center justify-between w-full max-w-xs mx-auto">
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
                  className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
                >
                  <ImageIcon className="w-6 h-6" />
                </button>
                
                <button 
                  onClick={handleCapture}
                  className="w-20 h-20 rounded-full border-[3px] border-emerald-500 p-1 flex items-center justify-center active:scale-95 transition-transform"
                >
                  <div className="w-full h-full bg-white rounded-full" />
                </button>
                
                <button 
                  onClick={() => {
                    setStep("preview");
                  }}
                  className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center text-white relative active:scale-90 transition-transform"
                >
                  {pages.length > 0 && (
                    <div className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold">
                      {pages.length}
                    </div>
                  )}
                  <div className="text-xs font-bold flex flex-col items-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                </button>
              </div>
              <p className="text-white/50 text-xs font-bold text-center">وجه الكاميرا نحو المستند ثم اضغط لالتقاط الصورة</p>
            </div>
          </>
        )}
      </div>

      {/* Adjust State */}
      {step === "adjust" && rawImage && corners && (
        <div className="flex-1 flex flex-col p-4 animate-in fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold text-lg">تحديد الحواف</h3>
            <p className="text-emerald-400 text-xs font-bold bg-emerald-400/10 px-3 py-1.5 rounded-full">اسحب الزوايا لمطابقة الورقة</p>
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
          
          <div className="flex gap-3 mt-auto pt-2 pb-4">
            <button className="scn-btn scn-btn-secondary flex-1" onClick={startNewPage}>
              إلغاء
            </button>
            <button
              className="scn-btn scn-btn-primary flex-[2]"
              disabled={busy}
              onClick={confirmPage}
            >
              {busy ? "جارٍ المعالجة..." : "تأكيد واستمرار"}
            </button>
          </div>
        </div>
      )}

      {/* Preview State */}
      {step === "preview" && (
        <div className="flex-1 overflow-y-auto p-4 animate-in fade-in">
          <div className="bg-white/5 rounded-3xl p-5 border border-white/10 mb-4">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-bold text-lg">
                الملف الجاهز <span className="text-emerald-400 font-black">({pages.length})</span>
              </h3>
              <button 
                className="text-xs font-bold bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full text-white transition flex items-center gap-1.5"
                onClick={startNewPage}
              >
                <Plus className="w-3.5 h-3.5" /> إضافة صفحة
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              {(["magic", "bw", "gray", "original"] as FilterMode[]).map((f) => (
                <button
                  key={f}
                  className={`scn-filter w-full text-center justify-center ${filter === f ? "active" : ""}`}
                  onClick={() => setFilter(f)}
                >
                  {f === "magic" ? "سحري (ملون)" : f === "bw" ? "أبيض وأسود" : f === "gray" ? "تدرج رمادي" : "أصلي"}
                </button>
              ))}
            </div>
            <p className="text-white/40 text-[10px] mb-6 text-center">
              * الفلتر ينطبق على الصفحات التي ستقوم بالتقاطها للتو
            </p>

            {pages.length === 0 ? (
              <div className="text-center py-16 opacity-50 bg-black/20 rounded-2xl mb-2 border border-dashed border-white/10 flex flex-col items-center">
                <Camera className="w-12 h-12 mb-3 text-white/50" />
                <p className="text-white font-bold text-sm">لا توجد صفحات ممسوحة</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 mb-2">
                {pages.map((p, i) => (
                  <div key={p.id} className="relative aspect-[1/1.414] bg-black rounded-xl overflow-hidden border border-white/10 group">
                    <img src={p.dataUrl} alt="Page" className="w-full h-full object-cover" />
                    <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full backdrop-blur-sm shadow-lg">
                      {i + 1}
                    </div>
                    <button className="absolute top-2 left-2 bg-rose-500/90 hover:bg-rose-600 w-8 h-8 flex items-center justify-center rounded-full text-white shadow-lg transition transform hover:scale-110 active:scale-90" onClick={() => removePage(p.id)}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {pages.length > 0 && (
            <div className="space-y-3 pb-8">
              <button className="scn-btn scn-btn-primary h-14 text-base" onClick={exportPdf}>
                تصدير كـ PDF 📄
              </button>
              <button className="scn-btn scn-btn-secondary h-14" onClick={() => pages.forEach(p => {
                  const a = document.createElement("a");
                  a.href = p.dataUrl;
                  a.download = `scan-${p.id}.jpg`;
                  a.click();
              })}>
                حفظ كصور منفصلة 🖼️
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
