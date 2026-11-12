"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  UploadCloud, 
  Printer, 
  Download, 
  FileText, 
  RotateCw, 
  Maximize2, 
  Grid, 
  Circle, 
  Square, 
  Sliders, 
  Check, 
  Eye, 
  RefreshCw,
  Sparkles,
  Scissors
} from "lucide-react";
import ToolHeader from "../components/ToolHeader";
import jsPDF from "jspdf";
import { toast } from "sonner";

type OrientationType = "portrait" | "landscape";
type FitModeType = "fit" | "fill" | "grid2" | "grid4" | "grid6" | "cupcakes12";
type GuideType = "none" | "circle20" | "circle18" | "circle15" | "cutlines";

export default function A4PrintPage() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<OrientationType>("portrait");
  const [fitMode, setFitMode] = useState<FitModeType>("fit");
  const [guide, setGuide] = useState<GuideType>("none");
  const [marginMm, setMarginMm] = useState<number>(5); // 0, 5, 10
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const printSheetRef = useRef<HTMLDivElement>(null);

  // Auto-detect orientation on upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        setImageSrc(url);
        // If image is wider than tall, default to landscape
        if (img.width > img.height * 1.2) {
          setOrientation("landscape");
        } else {
          setOrientation("portrait");
        }
        toast.success("تم تحميل الصورة بنجاح 📄 جاهزة للطباعة على ورقة A4");
      };
      img.src = url;
    }
  };

  // Instant Native Print Dialog
  const handleNativePrint = () => {
    if (!imageSrc) return;
    window.print();
  };

  // High-Resolution 300 DPI A4 Canvas Generator
  const generateA4Canvas = async (): Promise<HTMLCanvasElement> => {
    return new Promise((resolve, reject) => {
      if (!imageSrc) {
        reject(new Error("No image"));
        return;
      }
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        // Standard A4 dimensions at 300 DPI:
        // Portrait: 2480 x 3508 px
        // Landscape: 3508 x 2480 px
        const isPortrait = orientation === "portrait";
        const width = isPortrait ? 2480 : 3508;
        const height = isPortrait ? 3508 : 2480;

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;

        // Fill background white
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);

        // Calculate margin in pixels (A4 is 210mm wide -> ~11.8 px per mm at 300 DPI)
        const pxPerMm = width / (isPortrait ? 210 : 297);
        const marginPx = marginMm * pxPerMm;

        const printableWidth = width - marginPx * 2;
        const printableHeight = height - marginPx * 2;

        if (fitMode === "fit") {
          // Fit keeping aspect ratio
          const scale = Math.min(printableWidth / img.width, printableHeight / img.height);
          const drawW = img.width * scale;
          const drawH = img.height * scale;
          const drawX = marginPx + (printableWidth - drawW) / 2;
          const drawY = marginPx + (printableHeight - drawH) / 2;
          ctx.drawImage(img, drawX, drawY, drawW, drawH);
        } else if (fitMode === "fill") {
          // Stretch/Cover printable area
          ctx.drawImage(img, marginPx, marginPx, printableWidth, printableHeight);
        } else if (fitMode === "grid2") {
          // 2 images
          const cellH = printableHeight / 2;
          const cellScale = Math.min(printableWidth / img.width, cellH / img.height);
          const dw = img.width * cellScale;
          const dh = img.height * cellScale;
          for (let i = 0; i < 2; i++) {
            const dx = marginPx + (printableWidth - dw) / 2;
            const dy = marginPx + i * cellH + (cellH - dh) / 2;
            ctx.drawImage(img, dx, dy, dw, dh);
          }
        } else if (fitMode === "grid4") {
          // 4 images (2x2)
          const cellW = printableWidth / 2;
          const cellH = printableHeight / 2;
          const cellScale = Math.min(cellW / img.width, cellH / img.height);
          const dw = img.width * cellScale;
          const dh = img.height * cellScale;
          for (let r = 0; r < 2; r++) {
            for (let c = 0; c < 2; c++) {
              const dx = marginPx + c * cellW + (cellW - dw) / 2;
              const dy = marginPx + r * cellH + (cellH - dh) / 2;
              ctx.drawImage(img, dx, dy, dw, dh);
            }
          }
        } else if (fitMode === "grid6") {
          // 6 images (2 cols x 3 rows)
          const cellW = printableWidth / 2;
          const cellH = printableHeight / 3;
          const cellScale = Math.min(cellW / img.width, cellH / img.height);
          const dw = img.width * cellScale;
          const dh = img.height * cellScale;
          for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 2; c++) {
              const dx = marginPx + c * cellW + (cellW - dw) / 2;
              const dy = marginPx + r * cellH + (cellH - dh) / 2;
              ctx.drawImage(img, dx, dy, dw, dh);
            }
          }
        } else if (fitMode === "cupcakes12") {
          // 12 circles for cupcakes (3 cols x 4 rows)
          const cols = 3;
          const rows = 4;
          const cellW = printableWidth / cols;
          const cellH = printableHeight / rows;
          const diameter = Math.min(cellW, cellH) * 0.9;
          const radius = diameter / 2;

          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const cx = marginPx + c * cellW + cellW / 2;
              const cy = marginPx + r * cellH + cellH / 2;

              ctx.save();
              ctx.beginPath();
              ctx.arc(cx, cy, radius, 0, Math.PI * 2);
              ctx.clip();
              // Draw image centered in circle
              const scale = Math.max(diameter / img.width, diameter / img.height);
              const dw = img.width * scale;
              const dh = img.height * scale;
              ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
              ctx.restore();

              // Draw subtle cut guideline around each cupcake topper
              ctx.strokeStyle = "rgba(180, 180, 180, 0.6)";
              ctx.lineWidth = 2;
              ctx.setLineDash([8, 8]);
              ctx.beginPath();
              ctx.arc(cx, cy, radius, 0, Math.PI * 2);
              ctx.stroke();
              ctx.setLineDash([]);
            }
          }
        }

        // Draw Cake Circle Guide if selected
        if (guide.startsWith("circle")) {
          const diameterCm = guide === "circle20" ? 20 : guide === "circle18" ? 18 : 15;
          const diameterPx = (diameterCm * 10) * pxPerMm;
          const centerX = width / 2;
          const centerY = height / 2;

          ctx.strokeStyle = "#e11d48"; // Rose color
          ctx.lineWidth = 4;
          ctx.setLineDash([16, 12]);
          ctx.beginPath();
          ctx.arc(centerX, centerY, diameterPx / 2, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          // Guide Label
          ctx.fillStyle = "#e11d48";
          ctx.font = "bold 32px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(`دليل قص الكيك دائري: قطر ${diameterCm} سم`, centerX, centerY + (diameterPx / 2) + 40);
        }

        resolve(canvas);
      };
      img.onerror = reject;
    });
  };

  // Download High-Resolution PNG
  const handleDownloadImage = async () => {
    if (!imageSrc) return;
    setIsProcessing(true);
    try {
      const canvas = await generateA4Canvas();
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `A4_Print_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("تم تحميل صورة ورقة A4 عالية الدقة (300 DPI) بنجاح 📥");
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء تصدير الصورة");
    } finally {
      setIsProcessing(false);
    }
  };

  // Download PDF
  const handleDownloadPDF = async () => {
    if (!imageSrc) return;
    setIsProcessing(true);
    try {
      const canvas = await generateA4Canvas();
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const isPortrait = orientation === "portrait";
      const doc = new jsPDF({
        orientation: isPortrait ? "p" : "l",
        unit: "mm",
        format: "a4"
      });

      const pdfW = isPortrait ? 210 : 297;
      const pdfH = isPortrait ? 297 : 210;

      doc.addImage(imgData, "JPEG", 0, 0, pdfW, pdfH);
      doc.save(`A4_Document_${Date.now()}.pdf`);
      toast.success("تم إنشاء وتحميل ملف PDF بحجم A4 جاهز للطباعة 📄");
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء إنشاء ملف PDF");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f17] text-white pb-20" dir="rtl">
      
      {/* ─── PRINT CSS INJECTION FOR NATIVE PRINT ─── */}
      <style jsx global>{`
        @media print {
          body, html {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          /* Hide everything except the A4 print sheet */
          body * {
            visibility: hidden !important;
          }
          #a4-print-sheet, #a4-print-sheet * {
            visibility: visible !important;
          }
          #a4-print-sheet {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            border: none !important;
            box-shadow: none !important;
            transform: none !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
          @page {
            size: A4 ${orientation};
            margin: 0;
          }
        }
      `}</style>

      <div className="p-4 max-w-6xl mx-auto">
        <ToolHeader 
          title="طباعة ورقة A4 (الطباعة الغذائية وورق السكر)" 
          description="تجهيز وطباعة الصور بمقاس A4 القياسي (210×297 مم) بدقة 300 DPI للكيك والكب كيك والبوسترات" 
          icon={<Printer className="w-5 h-5 text-cyan-400" />} 
          onAction={() => handleNativePrint()}
          isProcessing={isProcessing}
          hasData={!!imageSrc}
          customActionLabel="طباعة الآن 🖨️"
        />

        {/* Upload Zone */}
        {!imageSrc ? (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-3xl border-2 border-dashed border-cyan-500/40 bg-cyan-500/5 hover:bg-cyan-500/10 cursor-pointer min-h-[300px] flex items-center justify-center transition-all p-8 mt-4 group"
          >
            <div className="flex flex-col items-center gap-3.5 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25 group-hover:scale-105 transition">
                <UploadCloud className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-black text-white">اضغط لاختيار صورة لطباعتها على ورقة A4</h3>
              <p className="text-xs text-cyan-200/60 max-w-sm">
                يدعم كافة أنواع الصور (JPG, PNG). سيتم ضبطها تلقائياً على مقاس ورقة A4 بدون تشويه للطباعة على ورق السكر والويفر والبوسترات.
              </p>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
                accept="image/*" 
                className="hidden" 
              />
            </div>
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            
            {/* Control Bar */}
            <div className="bg-[#1a1a2e] rounded-3xl p-5 border border-white/10 shadow-xl space-y-4">
              
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-400">اتجاه ورقة A4:</span>
                  <div className="flex bg-black/40 p-1 rounded-2xl border border-white/10">
                    <button
                      type="button"
                      onClick={() => setOrientation("portrait")}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                        orientation === "portrait"
                          ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-xs"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>عمودي (Portrait)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrientation("landscape")}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                        orientation === "landscape"
                          ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-xs"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5 rotate-90" />
                      <span>أفقي (Landscape)</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition cursor-pointer"
                  >
                    تغيير الصورة 🔄
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImageUpload} 
                    accept="image/*" 
                    className="hidden" 
                  />
                </div>
              </div>

              {/* Layout / Fit Mode Options */}
              <div>
                <span className="text-xs font-bold text-gray-400 block mb-2">طريقة ترتيب الصورة على الورقة:</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  <button
                    type="button"
                    onClick={() => setFitMode("fit")}
                    className={`p-2.5 rounded-2xl text-xs font-black transition border text-center cursor-pointer ${
                      fitMode === "fit"
                        ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                        : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                    }`}
                  >
                    <Maximize2 className="w-4 h-4 mx-auto mb-1" />
                    <span>احتواء كامل (Fit)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFitMode("fill")}
                    className={`p-2.5 rounded-2xl text-xs font-black transition border text-center cursor-pointer ${
                      fitMode === "fill"
                        ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                        : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                    }`}
                  >
                    <Square className="w-4 h-4 mx-auto mb-1" />
                    <span>تغطية كاملة (Fill)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFitMode("grid2")}
                    className={`p-2.5 rounded-2xl text-xs font-black transition border text-center cursor-pointer ${
                      fitMode === "grid2"
                        ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                        : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                    }`}
                  >
                    <Grid className="w-4 h-4 mx-auto mb-1" />
                    <span>صورتين (2x)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFitMode("grid4")}
                    className={`p-2.5 rounded-2xl text-xs font-black transition border text-center cursor-pointer ${
                      fitMode === "grid4"
                        ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                        : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                    }`}
                  >
                    <Grid className="w-4 h-4 mx-auto mb-1" />
                    <span>4 صور (4x)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFitMode("grid6")}
                    className={`p-2.5 rounded-2xl text-xs font-black transition border text-center cursor-pointer ${
                      fitMode === "grid6"
                        ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                        : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                    }`}
                  >
                    <Grid className="w-4 h-4 mx-auto mb-1" />
                    <span>6 صور (6x)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFitMode("cupcakes12")}
                    className={`p-2.5 rounded-2xl text-xs font-black transition border text-center cursor-pointer ${
                      fitMode === "cupcakes12"
                        ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                        : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                    }`}
                  >
                    <Circle className="w-4 h-4 mx-auto mb-1" />
                    <span>12 كب كيك دائرية</span>
                  </button>
                </div>
              </div>

              {/* Cake Cutting Guides */}
              <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-gray-400 flex items-center gap-1">
                    <Scissors className="w-3.5 h-3.5 text-rose-400" />
                    <span>دليل قص ورق السكر للكيك:</span>
                  </span>
                  
                  <button
                    type="button"
                    onClick={() => setGuide("none")}
                    className={`px-3 py-1 rounded-xl font-bold transition cursor-pointer ${
                      guide === "none" ? "bg-white/20 text-white" : "bg-white/5 text-gray-400"
                    }`}
                  >
                    بدون دليل
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuide("circle20")}
                    className={`px-3 py-1 rounded-xl font-bold transition cursor-pointer ${
                      guide === "circle20" ? "bg-rose-500 text-white" : "bg-white/5 text-gray-400"
                    }`}
                  >
                    دائرة قطر 20 سم
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuide("circle18")}
                    className={`px-3 py-1 rounded-xl font-bold transition cursor-pointer ${
                      guide === "circle18" ? "bg-rose-500 text-white" : "bg-white/5 text-gray-400"
                    }`}
                  >
                    دائرة قطر 18 سم
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuide("circle15")}
                    className={`px-3 py-1 rounded-xl font-bold transition cursor-pointer ${
                      guide === "circle15" ? "bg-rose-500 text-white" : "bg-white/5 text-gray-400"
                    }`}
                  >
                    دائرة قطر 15 سم
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-400">هوامش الورقة:</span>
                  <select
                    value={marginMm}
                    onChange={(e) => setMarginMm(Number(e.target.value))}
                    className="bg-black/40 border border-white/10 rounded-xl px-2.5 py-1 text-xs text-white font-bold outline-none"
                  >
                    <option value={0}>بدون هوامش (0 mm)</option>
                    <option value={5}>طبيعي (5 mm)</option>
                    <option value={10}>عريض (10 mm)</option>
                  </select>
                </div>
              </div>

            </div>

            {/* ─── LIVE REALISTIC A4 PREVIEW CANVAS ─── */}
            <div className="bg-black/60 rounded-3xl p-4 sm:p-8 border border-white/10 flex flex-col items-center justify-center overflow-x-auto min-h-[500px]">
              
              <div className="text-xs font-bold text-cyan-300 mb-3 flex items-center gap-1.5">
                <Eye className="w-4 h-4" />
                <span>معاينة ورقة A4 الحقيقية ({orientation === "portrait" ? "210 × 297 مم" : "297 × 210 مم"})</span>
              </div>

              {/* The Exact A4 Paper Sheet Element */}
              <div 
                id="a4-print-sheet"
                ref={printSheetRef}
                style={{
                  aspectRatio: orientation === "portrait" ? "210 / 297" : "297 / 210",
                  width: orientation === "portrait" ? "min(92vw, 420px)" : "min(92vw, 560px)",
                  padding: `${marginMm * 1.5}px`,
                }}
                className="bg-white text-slate-900 shadow-2xl rounded-sm relative overflow-hidden flex items-center justify-center select-none transition-all duration-300"
              >
                {/* Image Layout inside Sheet */}
                {fitMode === "fit" && (
                  <img 
                    src={imageSrc} 
                    alt="A4 Content" 
                    className="max-w-full max-h-full object-contain pointer-events-none" 
                  />
                )}

                {fitMode === "fill" && (
                  <img 
                    src={imageSrc} 
                    alt="A4 Content" 
                    className="w-full h-full object-cover pointer-events-none" 
                  />
                )}

                {fitMode === "grid2" && (
                  <div className="w-full h-full flex flex-col gap-2">
                    <div className="flex-1 overflow-hidden flex items-center justify-center border border-dashed border-gray-300">
                      <img src={imageSrc} alt="" className="max-w-full max-h-full object-contain" />
                    </div>
                    <div className="flex-1 overflow-hidden flex items-center justify-center border border-dashed border-gray-300">
                      <img src={imageSrc} alt="" className="max-w-full max-h-full object-contain" />
                    </div>
                  </div>
                )}

                {fitMode === "grid4" && (
                  <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-2">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="overflow-hidden flex items-center justify-center border border-dashed border-gray-300">
                        <img src={imageSrc} alt="" className="max-w-full max-h-full object-contain" />
                      </div>
                    ))}
                  </div>
                )}

                {fitMode === "grid6" && (
                  <div className="w-full h-full grid grid-cols-2 grid-rows-3 gap-2">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="overflow-hidden flex items-center justify-center border border-dashed border-gray-300">
                        <img src={imageSrc} alt="" className="max-w-full max-h-full object-contain" />
                      </div>
                    ))}
                  </div>
                )}

                {fitMode === "cupcakes12" && (
                  <div className="w-full h-full grid grid-cols-3 grid-rows-4 gap-1.5 p-1">
                    {[...Array(12)].map((_, i) => (
                      <div key={i} className="flex items-center justify-center p-0.5">
                        <div className="w-full aspect-square rounded-full overflow-hidden border-2 border-dashed border-gray-400 relative flex items-center justify-center">
                          <img src={imageSrc} alt="" className="w-full h-full object-cover" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Cake Cutting Circle Guide Overlay */}
                {guide.startsWith("circle") && (
                  <div 
                    style={{
                      width: guide === "circle20" ? "85%" : guide === "circle18" ? "76%" : "65%",
                      height: guide === "circle20" ? "85%" : guide === "circle18" ? "76%" : "65%",
                    }}
                    className="absolute border-2 border-dashed border-rose-500 rounded-full pointer-events-none flex items-center justify-center"
                  >
                    <span className="bg-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full absolute -top-3 shadow-xs">
                      دليل قص الكيك: {guide === "circle20" ? "20 سم" : guide === "circle18" ? "18 سم" : "15 سم"}
                    </span>
                  </div>
                )}
              </div>

            </div>

            {/* Action Buttons Bar */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleNativePrint}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 text-white font-black text-sm shadow-xl shadow-cyan-500/25 hover:opacity-95 active:scale-95 transition flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-5 h-5" />
                <span>طباعة الورقة مباشرة (Print A4) 🖨️</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={isProcessing}
                className="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-black text-sm border border-white/20 active:scale-95 transition flex items-center gap-2 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-cyan-400" />
                <span>تحميل ملف PDF جاهز للطباعة 📄</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadImage}
                disabled={isProcessing}
                className="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-black text-sm border border-white/20 active:scale-95 transition flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4 text-blue-400" />
                <span>تحميل صورة A4 عالية الدقة (300 DPI) 📥</span>
              </button>
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
