"use client";
import React, { useState, useRef, useCallback } from "react";
import { UploadCloud, FileText, Camera, Plus, Trash2, Download, Check, X, SlidersHorizontal, Image as ImageIcon } from "lucide-react";
import ToolHeader from "../components/ToolHeader";
import { processDownloadOrShare } from "../utils";
import jsPDF from "jspdf";
import createPerspective from "perspective-transform";

type FilterType = "original" | "magic" | "bw" | "grayscale";

const FILTERS: { id: FilterType; name: string; css: string }[] = [
  { id: "original", name: "أصلي", css: "none" },
  { id: "magic", name: "سحري", css: "contrast(120%) saturate(150%) brightness(110%)" },
  { id: "bw", name: "أبيض وأسود", css: "grayscale(100%) contrast(200%) brightness(120%)" },
  { id: "grayscale", name: "تدرج رمادي", css: "grayscale(100%)" },
];

async function applyPerspectiveWarp(
  imageSrc: string,
  corners: { x: number; y: number }[],
  filterCss: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const srcW = img.width;
      const srcH = img.height;

      const w1 = Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y);
      const w2 = Math.hypot(corners[2].x - corners[3].x, corners[2].y - corners[3].y);
      const h1 = Math.hypot(corners[3].x - corners[0].x, corners[3].y - corners[0].y);
      const h2 = Math.hypot(corners[2].x - corners[1].x, corners[2].y - corners[1].y);
      
      const dstW = Math.max(w1, w2);
      const dstH = Math.max(h1, h2);

      const srcCanvas = document.createElement("canvas");
      srcCanvas.width = srcW;
      srcCanvas.height = srcH;
      const srcCtx = srcCanvas.getContext("2d")!;
      srcCtx.drawImage(img, 0, 0);
      const srcData = srcCtx.getImageData(0, 0, srcW, srcH).data;

      const dstCanvas = document.createElement("canvas");
      dstCanvas.width = dstW;
      dstCanvas.height = dstH;
      const dstCtx = dstCanvas.getContext("2d")!;
      
      const srcPoints = [
        corners[0].x, corners[0].y,
        corners[1].x, corners[1].y,
        corners[2].x, corners[2].y,
        corners[3].x, corners[3].y,
      ];
      
      const dstPoints = [
        0, 0,
        dstW, 0,
        dstW, dstH,
        0, dstH,
      ];

      const transform = createPerspective(dstPoints, srcPoints);

      const dstImgData = dstCtx.createImageData(dstW, dstH);
      const dstData = dstImgData.data;

      for (let y = 0; y < dstH; y++) {
        for (let x = 0; x < dstW; x++) {
          const pt = transform.transform(x, y);
          const sx = pt[0];
          const sy = pt[1];
          const srcX = Math.round(sx);
          const srcY = Math.round(sy);
          
          if (srcX >= 0 && srcX < srcW && srcY >= 0 && srcY < srcH) {
            const srcIdx = (srcY * srcW + srcX) * 4;
            const dstIdx = (y * dstW + x) * 4;
            
            dstData[dstIdx] = srcData[srcIdx];
            dstData[dstIdx + 1] = srcData[srcIdx + 1];
            dstData[dstIdx + 2] = srcData[srcIdx + 2];
            dstData[dstIdx + 3] = srcData[srcIdx + 3];
          }
        }
      }

      dstCtx.putImageData(dstImgData, 0, 0);

      if (filterCss !== "none") {
        const finalCanvas = document.createElement("canvas");
        finalCanvas.width = dstW;
        finalCanvas.height = dstH;
        const finalCtx = finalCanvas.getContext("2d")!;
        finalCtx.filter = filterCss;
        finalCtx.drawImage(dstCanvas, 0, 0);
        resolve(finalCanvas.toDataURL("image/jpeg", 0.95));
      } else {
        resolve(dstCanvas.toDataURL("image/jpeg", 0.95));
      }
    };
    img.onerror = reject;
    img.src = imageSrc;
  });
}

function FourPointCrop({
  imageSrc,
  onCancel,
  onComplete,
}: {
  imageSrc: string;
  onCancel: () => void;
  onComplete: (corners: { x: number; y: number }[], filter: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [corners, setCorners] = useState<{ x: number; y: number }[]>([
    { x: 10, y: 10 },
    { x: 90, y: 10 },
    { x: 90, y: 90 },
    { x: 10, y: 90 },
  ]);
  const [activeCorner, setActiveCorner] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>("original");

  const handlePointerDown = (index: number, e: React.PointerEvent) => {
    e.preventDefault();
    setActiveCorner(index);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (activeCorner === null || !imgRef.current || !containerRef.current) return;
      
      const rect = imgRef.current.getBoundingClientRect();
      let xPos = e.clientX - rect.left;
      let yPos = e.clientY - rect.top;
      
      xPos = Math.max(0, Math.min(xPos, rect.width));
      yPos = Math.max(0, Math.min(yPos, rect.height));

      const newCorners = [...corners];
      newCorners[activeCorner] = {
        x: (xPos / rect.width) * 100,
        y: (yPos / rect.height) * 100,
      };
      setCorners(newCorners);
    },
    [activeCorner, corners]
  );

  const handlePointerUp = (e: React.PointerEvent) => {
    setActiveCorner(null);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleComplete = () => {
    if (!imgRef.current) return;
    const imgW = imgRef.current.naturalWidth;
    const imgH = imgRef.current.naturalHeight;
    const realCorners = corners.map(c => ({
      x: (c.x / 100) * imgW,
      y: (c.y / 100) * imgH,
    }));
    const filterCss = FILTERS.find(f => f.id === activeFilter)?.css || "none";
    onComplete(realCorners, filterCss);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#0f0f17] flex flex-col pt-safe pb-safe" dir="rtl">
      <div className="flex justify-between items-center p-4 bg-gradient-to-b from-black/80 to-transparent z-10 pt-safe">
        <h2 className="text-white font-bold text-lg">تحديد حواف المستند</h2>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
          <button
            onClick={handleComplete}
            className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 hover:scale-105 transition-all"
          >
            <Check className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div 
        className="flex-1 relative overflow-hidden flex flex-col justify-center items-center select-none touch-none"
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div className="relative inline-block max-w-[90vw] max-h-[70vh]">
          <img
            ref={imgRef}
            src={imageSrc}
            draggable={false}
            className="max-w-full max-h-[70vh] object-contain pointer-events-none"
            style={{ filter: FILTERS.find(f => f.id === activeFilter)?.css }}
            alt="Target"
          />
          
          <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
            <polygon
              points={corners.map(c => `${c.x}%,${c.y}%`).join(' ')}
              fill="rgba(59, 130, 246, 0.2)"
              stroke="#3b82f6"
              strokeWidth="2"
              strokeDasharray="5,5"
            />
          </svg>

          {corners.map((c, i) => (
            <div
              key={i}
              className="absolute w-8 h-8 -ml-4 -mt-4 cursor-move touch-none"
              style={{ left: `${c.x}%`, top: `${c.y}%` }}
              onPointerDown={(e) => handlePointerDown(i, e)}
            >
              <div className={`w-full h-full rounded-full border-[3px] border-white shadow-lg flex items-center justify-center ${activeCorner === i ? "bg-blue-500 scale-125" : "bg-blue-500/50 scale-100"} transition-transform`} />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-black/80 backdrop-blur-xl p-4 pb-safe z-10">
        <div className="flex items-center gap-2 mb-3 text-white/70 text-xs font-bold">
          <SlidersHorizontal className="w-4 h-4" />
          فلاتر المسح
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id as FilterType)}
              className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeFilter === f.id
                  ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30 border-none"
                  : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"
              }`}
            >
              {f.name}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-white/40 mt-3 text-center">
          اسحب الزوايا الأربعة لتحديد الورقة بدقة، وسيقوم النظام بتعديلها لجعلها مستقيمة
        </p>
      </div>
    </div>
  );
}


export default function DocumentScannerPage() {
  const [pages, setPages] = useState<string[]>([]);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCurrentImage(URL.createObjectURL(e.target.files[0]));
      e.target.value = "";
    }
  };

  const handleCropComplete = async (realCorners: { x: number; y: number }[], filterCss: string) => {
    if (!currentImage) return;
    setIsProcessing(true);
    try {
      const resultDataUrl = await applyPerspectiveWarp(currentImage, realCorners, filterCss);
      setPages(prev => [...prev, resultDataUrl]);
      setCurrentImage(null);
    } catch (e) {
      console.error(e);
      alert("حدث خطأ أثناء معالجة الصورة");
    } finally {
      setIsProcessing(false);
    }
  };

  const removePage = (index: number) => {
    setPages(pages.filter((_, i) => i !== index));
  };

  const exportAsImages = async () => {
    if (pages.length === 0) return;
    setIsProcessing(true);
    try {
      for (let i = 0; i < pages.length; i++) {
        await processDownloadOrShare(pages[i], `scanned_page_${i + 1}_${Date.now()}.jpg`, "download");
        await new Promise(r => setTimeout(r, 500));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const exportAsPDF = async () => {
    if (pages.length === 0) return;
    setIsProcessing(true);
    try {
      const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < pages.length; i++) {
        if (i > 0) pdf.addPage();
        
        const img = new Image();
        img.src = pages[i];
        await new Promise(resolve => { img.onload = resolve; });
        
        const imgRatio = img.width / img.height;
        const pdfRatio = pdfWidth / pdfHeight;
        
        let finalW = pdfWidth;
        let finalH = pdfWidth / imgRatio;
        
        if (finalH > pdfHeight) {
          finalH = pdfHeight;
          finalW = pdfHeight * imgRatio;
        }
        
        const x = (pdfWidth - finalW) / 2;
        const y = (pdfHeight - finalH) / 2;
        
        pdf.addImage(pages[i], 'JPEG', x, y, finalW, finalH);
      }
      
      pdf.save(`scanned_document_${Date.now()}.pdf`);
    } catch (e) {
      console.error(e);
      alert("حدث خطأ أثناء إنشاء ملف PDF");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f17]" dir="rtl">
      {isProcessing && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {currentImage ? (
        <FourPointCrop 
          imageSrc={currentImage} 
          onCancel={() => setCurrentImage(null)} 
          onComplete={handleCropComplete} 
        />
      ) : (
        <div className="p-4">
          <ToolHeader
            title="الماسح الضوئي (Scanner)"
            description="تصوير وتجميع المستندات بذكاء"
            icon={<FileText className="w-5 h-5 text-white/80" />}
            onAction={() => {}}
            isProcessing={isProcessing}
            hasData={false}
          />

          <div className="grid grid-cols-2 gap-3 mb-6 mt-4">
            <button 
              onClick={() => cameraInputRef.current?.click()}
              className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-5 flex flex-col items-center justify-center gap-3 shadow-[0_8px_30px_rgb(0,0,0,0.12)] shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all border border-indigo-400/20"
            >
              <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
                <Camera className="w-8 h-8 text-white" />
              </div>
              <span className="text-white font-black text-sm tracking-wide">التقاط مستند</span>
            </button>
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="bg-white/5 hover:bg-white/10 rounded-3xl p-5 flex flex-col items-center justify-center gap-3 shadow-xl transition-all border border-white/10 hover:scale-[1.02] active:scale-[0.98]"
            >
              <div className="bg-white/10 p-3 rounded-2xl">
                <ImageIcon className="w-8 h-8 text-white/80" />
              </div>
              <span className="text-white/80 font-bold text-sm">استيراد صورة</span>
            </button>
          </div>

          <input type="file" accept="image/*" capture="environment" className="hidden" ref={cameraInputRef} onChange={handleImageUpload} />
          <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />

          {pages.length > 0 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-bold text-sm">صفحات المستند ({pages.length})</h3>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {pages.map((p, i) => (
                  <div key={i} className="relative group aspect-[1/1.4] bg-white/5 rounded-2xl border border-white/10 overflow-hidden shadow-lg">
                    <img src={p} className="w-full h-full object-cover" />
                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-1 rounded-full border border-white/10">
                      {i + 1}
                    </div>
                    <button 
                      onClick={() => removePage(i)}
                      className="absolute top-2 left-2 bg-red-500/90 text-white p-2 rounded-full hover:bg-red-500 transition-colors shadow-lg active:scale-95"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                
                <button 
                  onClick={() => cameraInputRef.current?.click()}
                  className="aspect-[1/1.4] bg-white/5 hover:bg-white/10 border-2 border-dashed border-white/20 rounded-2xl flex flex-col items-center justify-center gap-3 transition-colors active:scale-[0.98]"
                >
                  <div className="bg-white/10 p-3 rounded-full">
                    <Plus className="w-6 h-6 text-white/70" />
                  </div>
                  <span className="text-white/50 text-xs font-bold">إضافة صفحة</span>
                </button>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-3xl p-5 mt-6 shadow-xl">
                <h3 className="text-white/80 font-bold text-sm mb-4 flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  خيارات التصدير والحفظ
                </h3>
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={exportAsPDF}
                    disabled={isProcessing}
                    className="w-full bg-gradient-to-r from-rose-500 to-pink-600 text-white py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-[0_8px_30px_rgb(0,0,0,0.12)] shadow-pink-500/30 active:scale-[0.98] transition-all"
                  >
                    <FileText className="w-5 h-5" />
                    حفظ كملف PDF
                  </button>
                  <button 
                    onClick={exportAsImages}
                    disabled={isProcessing}
                    className="w-full bg-white/10 hover:bg-white/15 text-white py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                  >
                    <ImageIcon className="w-5 h-5" />
                    حفظ كصور في الاستوديو
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {pages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 opacity-40">
              <div className="bg-white/5 p-6 rounded-3xl mb-4">
                <FileText className="w-16 h-16 text-white/50" />
              </div>
              <p className="text-white font-bold">لم تقم بمسح أي مستند بعد</p>
              <p className="text-white/60 text-xs mt-2">التقط صورة للبدء في مسح وتجميع المستندات</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
