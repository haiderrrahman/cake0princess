"use client";
import React, { useState, useRef } from "react";
import { UploadCloud, FlipHorizontal, RefreshCw, Download } from "lucide-react";
import ToolHeader from "../components/ToolHeader";
import { processDownloadOrShare } from "../utils";

export default function FlipImagePage() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [flipX, setFlipX] = useState(false);
  const [flipY, setFlipY] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setImageSrc(URL.createObjectURL(file)); setFlipX(false); setFlipY(false); }
  };

  const handleAction = async (action: "share" | "download") => {
    if (!imageSrc || !imgRef.current) return;
    setIsProcessing(true);
    try {
      const img = imgRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.translate(flipX ? canvas.width : 0, flipY ? canvas.height : 0);
      ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
      ctx.drawImage(img, 0, 0);
      await processDownloadOrShare(canvas.toDataURL("image/png"), `flipped_${Date.now()}.png`, action);
    } finally { setIsProcessing(false); }
  };

  return (
    <div className="min-h-screen bg-[#0f0f17]" dir="rtl">
      <div className="p-4">
        <ToolHeader
          title="قلب الصورة"
          description="انعكاس أفقي أو عمودي"
          icon={<FlipHorizontal className="w-5 h-5 text-white/80" />}
          onAction={handleAction}
          isProcessing={isProcessing}
          hasData={!!imageSrc}
        />

        {/* Upload first */}
        <div
          onClick={() => !imageSrc && fileInputRef.current?.click()}
          className={`relative w-full rounded-2xl overflow-hidden mb-4 flex items-center justify-center transition-all ${
            imageSrc
              ? "bg-transparent"
              : "border-2 border-dashed border-white/20 bg-white/5 cursor-pointer hover:bg-white/8 min-h-[260px]"
          }`}
        >
          {!imageSrc ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-lime-500 to-green-600 flex items-center justify-center shadow-lg">
                <UploadCloud className="w-8 h-8 text-white" />
              </div>
              <p className="text-white font-bold text-lg">ارفع صورة</p>
              <p className="text-white/40 text-sm">انقر للاختيار</p>
            </div>
          ) : (
            <img
              ref={imgRef}
              src={imageSrc}
              style={{ transform: `scaleX(${flipX ? -1 : 1}) scaleY(${flipY ? -1 : 1})` }}
              className="max-w-full max-h-[50vh] object-contain rounded-xl shadow-2xl transition-all duration-300"
            />
          )}
          <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
        </div>

        {/* Controls below */}
        {imageSrc && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setFlipX(!flipX)}
                className={`py-4 rounded-2xl font-black text-base flex flex-col items-center gap-2 transition-all ${
                  flipX ? "bg-lime-500 text-white shadow-lg shadow-lime-500/30" : "bg-white/10 text-white hover:bg-white/15"
                }`}
              >
                <FlipHorizontal className="w-6 h-6" />
                <span>أفقي ↔</span>
              </button>
              <button
                onClick={() => setFlipY(!flipY)}
                className={`py-4 rounded-2xl font-black text-base flex flex-col items-center gap-2 transition-all ${
                  flipY ? "bg-lime-500 text-white shadow-lg shadow-lime-500/30" : "bg-white/10 text-white hover:bg-white/15"
                }`}
              >
                <FlipHorizontal className="w-6 h-6 rotate-90" />
                <span>عمودي ↕</span>
              </button>
            </div>

            {(flipX || flipY) && (
              <button
                onClick={() => { setFlipX(false); setFlipY(false); }}
                className="w-full py-3 bg-white/5 hover:bg-white/10 text-white/60 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all"
              >
                <RefreshCw className="w-4 h-4" /> إعادة ضبط
              </button>
            )}

            <button
              onClick={() => { setImageSrc(null); setFlipX(false); setFlipY(false); }}
              className="w-full py-3 bg-white/5 text-white/40 hover:text-white/60 rounded-2xl font-medium text-sm transition-all"
            >
              تغيير الصورة
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
