"use client";
import React, { useState, useRef, useEffect } from "react";
import { UploadCloud, FileText, Camera, Plus, Trash2, Download, Check, X, SlidersHorizontal, Image as ImageIcon } from "lucide-react";
import ToolHeader from "../components/ToolHeader";
import { processDownloadOrShare } from "../utils";
import ReactCrop, { type Crop as CropType, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import jsPDF from "jspdf";

type FilterType = "original" | "magic" | "bw" | "grayscale";

const FILTERS: { id: FilterType; name: string; css: string }[] = [
  { id: "original", name: "أصلي", css: "none" },
  { id: "magic", name: "سحري", css: "contrast(120%) saturate(150%) brightness(110%)" },
  { id: "bw", name: "أبيض وأسود", css: "grayscale(100%) contrast(200%) brightness(120%)" },
  { id: "grayscale", name: "تدرج رمادي", css: "grayscale(100%)" },
];

export default function DocumentScannerPage() {
  const [pages, setPages] = useState<string[]>([]);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [crop, setCrop] = useState<CropType>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [activeFilter, setActiveFilter] = useState<FilterType>("original");
  const [isProcessing, setIsProcessing] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCrop(undefined);
      setCompletedCrop(undefined);
      setActiveFilter("original");
      setCurrentImage(URL.createObjectURL(e.target.files[0]));
    }
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop({ unit: '%', width: 90, height: 90, x: 5, y: 5 });
  };

  const applyCropAndFilter = async () => {
    if (!currentImage || !imgRef.current) return;
    setIsProcessing(true);
    
    try {
      const image = imgRef.current;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      let sourceX = 0, sourceY = 0, sourceWidth = image.naturalWidth, sourceHeight = image.naturalHeight;
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;

      if (completedCrop && completedCrop.width > 0 && completedCrop.height > 0) {
        sourceX = completedCrop.x * scaleX;
        sourceY = completedCrop.y * scaleY;
        sourceWidth = completedCrop.width * scaleX;
        sourceHeight = completedCrop.height * scaleY;
      }

      canvas.width = sourceWidth;
      canvas.height = sourceHeight;
      
      const filterConfig = FILTERS.find(f => f.id === activeFilter)?.css || "none";
      ctx.filter = filterConfig;
      ctx.imageSmoothingQuality = 'high';
      
      ctx.drawImage(
        image,
        sourceX, sourceY, sourceWidth, sourceHeight,
        0, 0, canvas.width, canvas.height
      );
      
      const processedImage = canvas.toDataURL("image/jpeg", 0.95);
      setPages([...pages, processedImage]);
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
      <div className="p-4">
        {!currentImage ? (
          <>
            <ToolHeader
              title="الماسح الضوئي (Scanner)"
              description="تصوير وتجميع المستندات في ملف PDF"
              icon={<FileText className="w-5 h-5 text-white/80" />}
              onAction={() => {}}
              isProcessing={isProcessing}
              hasData={false}
            />

            <div className="grid grid-cols-2 gap-3 mb-6 mt-4">
              <button 
                onClick={() => cameraInputRef.current?.click()}
                className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 hover:scale-105 transition-all"
              >
                <Camera className="w-8 h-8 text-white" />
                <span className="text-white font-bold text-sm">التقاط مستند</span>
              </button>
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="bg-white/10 hover:bg-white/15 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 shadow-lg transition-all border border-white/5 hover:scale-105"
              >
                <ImageIcon className="w-8 h-8 text-white/80" />
                <span className="text-white/80 font-bold text-sm">استيراد صورة</span>
              </button>
            </div>

            <input type="file" accept="image/*" capture="environment" className="hidden" ref={cameraInputRef} onChange={handleImageUpload} />
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />

            {pages.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-white/80 font-bold text-sm">صفحات المستند ({pages.length})</h3>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {pages.map((p, i) => (
                    <div key={i} className="relative group aspect-[1/1.4] bg-white/5 rounded-xl border border-white/10 overflow-hidden shadow-lg">
                      <img src={p} className="w-full h-full object-cover" />
                      <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full">
                        {i + 1}
                      </div>
                      <button 
                        onClick={() => removePage(i)}
                        className="absolute top-2 left-2 bg-red-500/80 text-white p-1.5 rounded-full hover:bg-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  
                  <button 
                    onClick={() => cameraInputRef.current?.click()}
                    className="aspect-[1/1.4] bg-white/5 hover:bg-white/10 border-2 border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center gap-2 transition-colors"
                  >
                    <Plus className="w-6 h-6 text-white/50" />
                    <span className="text-white/50 text-xs font-bold">إضافة صفحة</span>
                  </button>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mt-6">
                  <h3 className="text-white/80 font-bold text-sm mb-4">خيارات التصدير والحفظ</h3>
                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={exportAsPDF}
                      disabled={isProcessing}
                      className="w-full bg-gradient-to-r from-pink-600 to-rose-500 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-pink-500/20 active:scale-[0.98] transition-all"
                    >
                      <FileText className="w-5 h-5" />
                      حفظ كملف PDF
                    </button>
                    <button 
                      onClick={exportAsImages}
                      disabled={isProcessing}
                      className="w-full bg-white/10 hover:bg-white/15 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                    >
                      <Download className="w-5 h-5" />
                      حفظ كصور في الاستوديو
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {pages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 opacity-50">
                <FileText className="w-16 h-16 text-white/30 mb-4" />
                <p className="text-white font-medium">لم تقم بمسح أي مستند بعد</p>
                <p className="text-white/60 text-xs mt-1">التقط صورة للبدء في مسح المستندات</p>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col h-[calc(100vh-2rem)]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-white font-bold text-lg">تحديد المستند</h2>
              <div className="flex gap-2">
                <button 
                  onClick={() => setCurrentImage(null)}
                  className="bg-white/10 p-2 rounded-full text-white/70 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
                <button 
                  onClick={applyCropAndFilter}
                  disabled={isProcessing}
                  className="bg-emerald-500 p-2 rounded-full text-white shadow-lg shadow-emerald-500/20"
                >
                  <Check className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 relative bg-black/50 rounded-2xl overflow-hidden flex flex-col justify-center items-center">
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                className="max-h-[60vh]"
              >
                <img 
                  ref={imgRef} 
                  src={currentImage} 
                  onLoad={onImageLoad} 
                  style={{ filter: FILTERS.find(f => f.id === activeFilter)?.css }}
                  className="max-h-[60vh] object-contain transition-all duration-300" 
                />
              </ReactCrop>
            </div>

            <div className="mt-4 bg-white/5 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3 text-white/70 text-xs font-bold">
                <SlidersHorizontal className="w-4 h-4" />
                فلاتر المسح
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {FILTERS.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setActiveFilter(f.id as FilterType)}
                    className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      activeFilter === f.id 
                        ? "bg-pink-600 text-white shadow-lg shadow-pink-500/20" 
                        : "bg-white/10 text-white/70 hover:bg-white/20"
                    }`}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-white/40 mt-3 text-center">
                قم بقص حواف المستند واختر الفلتر المناسب للحصول على أفضل نتيجة
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
