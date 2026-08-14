"use client";
import React, { useState, useRef } from "react";
import { UploadCloud, FileVideo, RefreshCw, Download, X } from "lucide-react";
import ToolHeader from "../components/ToolHeader";
import { GifReader } from "omggif";

export default function GifSplitPage() {
  const [frames, setFrames] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsProcessing(true); setFrames([]);
      try {
        const file = e.target.files[0];
        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);
        const reader = new GifReader(buffer);
        const width = reader.width; const height = reader.height;
        const numFrames = reader.numFrames();
        
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        const imageData = ctx.createImageData(width, height);
        const extractedFrames: string[] = [];

        for (let i = 0; i < numFrames; i++) {
          reader.decodeAndBlitFrameRGBA(i, imageData.data);
          ctx.putImageData(imageData, 0, 0);
          extractedFrames.push(canvas.toDataURL("image/jpeg", 0.9));
        }
        setFrames(extractedFrames);
      } catch (err) {
        console.error(err); alert("تعذر قراءة ملف الـ GIF. تأكد من أن الملف سليم.");
      } finally { setIsProcessing(false); }
    }
  };

  const handleAction = async (action?: "share" | "download") => {
    if (frames.length === 0) return;
    setIsProcessing(true);
    try {
      // Multiple downloads fallback for saving to studio
      frames.forEach((frame, idx) => {
        setTimeout(() => {
          const a = document.createElement("a");
          a.href = frame; a.download = `frame_${idx + 1}.jpg`;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
        }, idx * 250);
      });
    } finally { setIsProcessing(false); }
  };

  return (
    <div className="min-h-screen bg-[#0f0f17]" dir="rtl">
      <div className="p-4">
        <ToolHeader
          title="تقسيم GIF"
          description="استخراج اللقطات من الصور المتحركة"
          icon={<FileVideo className="w-5 h-5 text-white/80" />}
          onAction={handleAction}
          isProcessing={isProcessing}
          hasData={frames.length > 0}
          customActionLabel="حفظ جميع اللقطات"
        />

        <div className="mb-4">
          {frames.length === 0 ? (
            <div onClick={() => !isProcessing && fileInputRef.current?.click()}
              className="w-full rounded-2xl border-2 border-dashed border-white/20 bg-white/5 cursor-pointer hover:bg-white/8 min-h-[220px] flex items-center justify-center transition-all">
              <div className="flex flex-col items-center gap-3 py-10">
                {isProcessing ? (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                      <RefreshCw className="w-7 h-7 text-white animate-spin" />
                    </div>
                    <p className="text-white font-bold">جاري استخراج اللقطات...</p>
                  </>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                      <UploadCloud className="w-7 h-7 text-white" />
                    </div>
                    <p className="text-white font-bold">ارفع صورة GIF</p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white/5 rounded-2xl p-4 min-h-[300px]">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-white/80 text-sm">تم استخراج {frames.length} لقطة</h2>
                <button onClick={() => setFrames([])} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white/60 text-xs font-bold transition-all">تغيير الصورة</button>
              </div>
              <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded-xl text-xs font-medium text-center">
                💡 لأجهزة الآيفون: لتجنب أي مشاكل بالتحميل، اضغط مطولاً على كل صورة بالأسفل واختر "حفظ في الصور".
              </div>
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {frames.map((src, i) => (
                  <div key={i} className="bg-black/40 rounded-xl overflow-hidden relative group aspect-square">
                    <span className="absolute top-1 right-1 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full z-10">{i + 1}</span>
                    <img src={src} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}
          <input type="file" accept="image/gif" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
        </div>
      </div>
    </div>
  );
}
