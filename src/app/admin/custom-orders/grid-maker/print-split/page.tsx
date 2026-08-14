"use client";
import React, { useState, useRef } from "react";
import { UploadCloud, Printer, Download, X } from "lucide-react";
import ToolHeader from "../components/ToolHeader";

export default function PrintSplitPage() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [cols, setCols] = useState(2);
  const [rows, setRows] = useState(2);
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

  const handleAction = async (action?: "share" | "download") => {
    if (!imageSrc || !imgRef.current) return;
    setIsProcessing(true);
    try {
      const img = imgRef.current;
      const pWidth = img.naturalWidth / cols;
      const pHeight = img.naturalHeight / rows;
      const newFiles: { url: string; name: string }[] = [];

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const canvas = document.createElement("canvas");
          canvas.width = pWidth; canvas.height = pHeight;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, c * pWidth, r * pHeight, pWidth, pHeight, 0, 0, pWidth, pHeight);
          
          await new Promise<void>((resolve) => {
            canvas.toBlob((blob) => {
              if (blob) newFiles.push({ url: URL.createObjectURL(blob), name: `print_part_${r+1}x${c+1}.jpg` });
              resolve();
            }, "image/jpeg", 1.0);
          });
        }
      }
      setResultFiles(newFiles);
    } finally { setIsProcessing(false); }
  };

  const handleDownloadAll = () => {
    resultFiles.forEach((f, i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = f.url; a.download = f.name;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      }, i * 300);
    });
  };

  return (
    <div className="min-h-screen bg-[#0f0f17]" dir="rtl">
      <div className="p-4">
        <ToolHeader 
          title="تقسيم للطباعة الدقيقة" 
          description="قسم صورتك لعدة أوراق لطباعتها كبوستر جداري كبير" 
          icon={<Printer className="w-5 h-5 text-white/80" />} 
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
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-lg">
                  <UploadCloud className="w-7 h-7 text-white" />
                </div>
                <p className="text-white font-bold">ارفع صورة البوستر</p>
              </div>
            </div>
          ) : (
            <div className="relative w-full flex justify-center bg-black/40 rounded-2xl p-4 min-h-[300px]">
              <div className="relative inline-block w-full max-w-sm overflow-hidden rounded-xl shadow-xl">
                <img ref={imgRef} src={imageSrc} className="w-full h-auto block opacity-60" />
                <div className="absolute inset-0 grid" style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`, gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                  {Array.from({ length: rows * cols }).map((_, i) => (
                    <div key={i} className="border border-white/30 border-dashed flex items-center justify-center bg-white/5 pointer-events-none">
                      <span className="bg-black/60 text-white font-bold rounded-full px-2 py-1 flex items-center justify-center text-[10px]">A4 {i + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
        </div>

        {imageSrc && (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-2xl p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-white/50 text-xs font-bold">أبعاد الملصق الجداري</h2>
                <div className="bg-rose-500/20 text-rose-300 px-2 py-1 rounded-lg text-[10px] font-bold">إجمالي: {cols * rows} ورقة A4</div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="flex justify-between text-[10px] font-medium text-white/50 mb-2">
                    <span>عدد الأوراق عرضاً (الأعمدة)</span><span className="text-rose-400 font-bold">{cols} أوراق</span>
                  </label>
                  <input type="range" min="1" max="10" value={cols} onChange={e => setCols(Number(e.target.value))} className="w-full accent-rose-500" />
                </div>
                <div>
                  <label className="flex justify-between text-[10px] font-medium text-white/50 mb-2">
                    <span>عدد الأوراق طولاً (الصفوف)</span><span className="text-rose-400 font-bold">{rows} أوراق</span>
                  </label>
                  <input type="range" min="1" max="10" value={rows} onChange={e => setRows(Number(e.target.value))} className="w-full accent-rose-500" />
                </div>
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
          <div className="bg-[#1a1a24] rounded-3xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-white/10">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
              <h2 className="text-lg font-bold text-white">أجزاء الطباعة ({resultFiles.length})</h2>
              <button onClick={() => setResultFiles([])} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white/70 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1">
              <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded-xl text-xs font-medium text-center">
                💡 لأجهزة الآيفون: لتجنب أي مشاكل بالتحميل، اضغط مطولاً على كل صورة بالأسفل واختر "حفظ في الصور".
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                {resultFiles.map((file, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <img src={file.url} className="w-full h-auto rounded-lg border-2 border-white/10 shadow-lg" />
                    <span className="mt-2 font-bold text-white/40 text-[10px]">الجزء {i + 1}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-white/10 bg-white/5">
              <button onClick={handleDownloadAll} className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all">
                <Download className="w-5 h-5" /> حفظ جميع الأوراق بالاستوديو
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
