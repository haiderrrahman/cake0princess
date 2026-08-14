"use client";
import React, { useState, useRef } from "react";
import { UploadCloud, Grid3x3, Download, X } from "lucide-react";
import ToolHeader from "../components/ToolHeader";

export default function SplitImagePage() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [grid, setGrid] = useState(3);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultFiles, setResultFiles] = useState<{ url: string; name: string }[]>([]);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageSrc(URL.createObjectURL(e.target.files[0]));
      setResultFiles([]);
    }
  };

  const handleAction = async () => {
    if (!imageSrc || !imgRef.current) return;
    setIsProcessing(true);
    try {
      const img = imgRef.current;
      const pWidth = img.naturalWidth / grid;
      const pHeight = img.naturalHeight / grid;
      const newFiles: { url: string; name: string }[] = [];

      for (let r = 0; r < grid; r++) {
        for (let c = 0; c < grid; c++) {
          const canvas = document.createElement("canvas");
          canvas.width = pWidth; canvas.height = pHeight;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, c * pWidth, r * pHeight, pWidth, pHeight, 0, 0, pWidth, pHeight);
          
          await new Promise<void>(resolve => {
            canvas.toBlob(blob => {
              if (blob) newFiles.push({ url: URL.createObjectURL(blob), name: `split_${r+1}x${c+1}.jpg` });
              resolve();
            }, "image/jpeg", 1.0);
          });
        }
      }
      setResultFiles(newFiles);
    } finally { setIsProcessing(false); }
  };

  const handleDownloadAll = async () => {
    setIsProcessing(true);
    try {
      // Dynamic import to avoid SSR issues if any, but since this is use client, standard import is fine.
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      
      for (const f of resultFiles) {
        const response = await fetch(f.url);
        const blob = await response.blob();
        zip.file(f.name, blob);
      }
      
      const zipContent = await zip.generateAsync({ type: "blob" });
      const zipUrl = URL.createObjectURL(zipContent);
      
      const a = document.createElement("a");
      a.href = zipUrl;
      a.download = `split_images_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(zipUrl);
    } catch (e) {
      console.error(e);
      alert("حدث خطأ أثناء تحميل الملف المجمع.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f17]" dir="rtl">
      <div className="p-4">
        <ToolHeader
          title="تقسيم الصورة"
          description="لعمل صورة شبكية لإنستغرام"
          icon={<Grid3x3 className="w-5 h-5 text-white/80" />}
          onAction={handleAction}
          isProcessing={isProcessing}
          hasData={!!imageSrc}
          customActionLabel="تقسيم الآن"
        />

        <div className="mb-4">
          {!imageSrc ? (
            <div onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-2xl border-2 border-dashed border-white/20 bg-white/5 cursor-pointer hover:bg-white/8 min-h-[220px] flex items-center justify-center transition-all">
              <div className="flex flex-col items-center gap-3 py-10">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg">
                  <UploadCloud className="w-7 h-7 text-white" />
                </div>
                <p className="text-white font-bold">ارفع صورة</p>
              </div>
            </div>
          ) : (
            <div className="relative w-full flex justify-center">
              <img ref={imgRef} src={imageSrc} className="max-w-full max-h-[50vh] object-cover rounded-xl opacity-60" />
              <div className="absolute inset-0 flex justify-center">
                <div className="h-full aspect-square relative">
                   <div className="absolute inset-0 grid" style={{ gridTemplateRows: `repeat(${grid}, minmax(0, 1fr))`, gridTemplateColumns: `repeat(${grid}, minmax(0, 1fr))` }}>
                     {Array.from({ length: grid * grid }).map((_, i) => (
                       <div key={i} className="border border-white/50 border-dashed pointer-events-none" />
                     ))}
                   </div>
                </div>
              </div>
            </div>
          )}
          <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
        </div>

        {imageSrc && (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-2xl p-4">
              <p className="text-white/50 text-xs font-bold mb-3">عدد الأجزاء</p>
              <div className="grid grid-cols-4 gap-2">
                {[2, 3, 4, 5].map(num => (
                  <button key={num} onClick={() => setGrid(num)}
                    className={`py-3 text-sm font-bold rounded-xl transition-all ${
                      grid === num ? "bg-pink-600 text-white shadow-lg" : "bg-white/10 text-white/60 hover:bg-white/15"
                    }`}>
                    {num} × {num}
                  </button>
                ))}
              </div>
            </div>
            
            <button onClick={() => { setImageSrc(null); setResultFiles([]); }}
              className="w-full py-3 bg-white/5 text-white/40 hover:text-white/60 rounded-2xl font-medium text-sm transition-all">
              تغيير الصورة
            </button>
          </div>
        )}
      </div>

      {/* Results Modal */}
      {resultFiles.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="bg-[#1a1a24] rounded-3xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-white/10">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
              <h2 className="text-lg font-bold text-white">الصور المقطعة ({resultFiles.length})</h2>
              <button onClick={() => setResultFiles([])} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white/70 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1">
              <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded-xl text-xs font-medium text-center">
                💡 لأجهزة الآيفون: لتجنب أي مشاكل بالتحميل، اضغط مطولاً على كل صورة بالأسفل واختر "حفظ في الصور".
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                {resultFiles.map((file, i) => (
                  <div key={i} className="flex flex-col items-center group">
                    <img src={file.url} className="w-full aspect-square object-cover rounded-lg border-2 border-white/10 group-hover:border-white/30 transition-all" />
                    <span className="mt-1 font-bold text-white/40 text-[10px]">{i + 1}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-white/10 bg-white/5">
              <button onClick={handleDownloadAll} disabled={isProcessing} className="w-full py-3 bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all">
                <Download className="w-5 h-5" /> {isProcessing ? "جاري التجهيز..." : "تحميل كملف مضغوط (ZIP) في الاستوديو"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
