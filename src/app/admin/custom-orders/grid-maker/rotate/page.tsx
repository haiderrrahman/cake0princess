"use client";
import React, { useState, useRef } from "react";
import { UploadCloud, RotateCw } from "lucide-react";
import ToolHeader from "../components/ToolHeader";
import { processDownloadOrShare } from "../utils";

export default function RotateImagePage() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [customAngle, setCustomAngle] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setImageSrc(URL.createObjectURL(file)); setRotation(0); setCustomAngle(0); }
  };

  const totalRotation = rotation + customAngle;

  const handleAction = async (action: "share" | "download") => {
    if (!imageSrc || !imgRef.current) return;
    setIsProcessing(true);
    try {
      const img = imgRef.current;
      const rad = (totalRotation * Math.PI) / 180;
      const sin = Math.abs(Math.sin(rad)); const cos = Math.abs(Math.cos(rad));
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(img.naturalWidth * cos + img.naturalHeight * sin);
      canvas.height = Math.floor(img.naturalWidth * sin + img.naturalHeight * cos);
      const ctx = canvas.getContext("2d")!;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rad);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      await processDownloadOrShare(canvas.toDataURL("image/png"), `rotated_${Date.now()}.png`, action);
    } finally { setIsProcessing(false); }
  };

  return (
    <div className="min-h-screen bg-[#0f0f17]" dir="rtl">
      <div className="p-4">
        <ToolHeader
          title="تدوير الصورة"
          description="دوّر بزاوية حرة أو بضغطة واحدة"
          icon={<RotateCw className="w-5 h-5 text-white/80" />}
          onAction={handleAction}
          isProcessing={isProcessing}
          hasData={!!imageSrc}
        />

        {/* Upload / Preview */}
        <div
          onClick={() => !imageSrc && fileInputRef.current?.click()}
          className={`w-full rounded-2xl overflow-hidden mb-4 flex items-center justify-center transition-all ${
            !imageSrc ? "border-2 border-dashed border-white/20 bg-white/5 cursor-pointer hover:bg-white/8 min-h-[260px]" : ""
          }`}
        >
          {!imageSrc ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg">
                <UploadCloud className="w-8 h-8 text-white" />
              </div>
              <p className="text-white font-bold text-lg">ارفع صورة</p>
            </div>
          ) : (
            <img
              ref={imgRef}
              src={imageSrc}
              style={{ transform: `rotate(${totalRotation}deg)`, transition: "transform 0.3s ease" }}
              className="max-w-full max-h-[50vh] object-contain rounded-xl shadow-2xl"
            />
          )}
          <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
        </div>

        {/* Controls */}
        {imageSrc && (
          <div className="space-y-3">
            {/* Quick rotate */}
            <div className="grid grid-cols-4 gap-2">
              {[90, 180, 270, -90].map(deg => (
                <button key={deg}
                  onClick={() => setRotation(r => (r + deg) % 360)}
                  className="py-3 bg-white/10 hover:bg-white/15 text-white rounded-xl font-bold text-sm transition-all"
                >
                  {deg > 0 ? `+${deg}°` : `${deg}°`}
                </button>
              ))}
            </div>

            {/* Fine-tune slider */}
            <div className="bg-white/5 rounded-2xl p-4">
              <label className="flex justify-between text-sm text-white/60 mb-3 font-medium">
                <span>ضبط دقيق</span>
                <span className="text-orange-400 font-bold">{customAngle}°</span>
              </label>
              <input type="range" min={-45} max={45} value={customAngle}
                onChange={e => setCustomAngle(Number(e.target.value))}
                className="w-full accent-orange-500" />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-white/40 text-sm">الزاوية الكلية: <span className="text-white font-bold">{totalRotation}°</span></span>
              <button onClick={() => { setRotation(0); setCustomAngle(0); }}
                className="text-sm text-orange-400 font-bold hover:text-orange-300 transition-colors">
                إعادة ضبط
              </button>
            </div>

            <button onClick={() => { setImageSrc(null); setRotation(0); setCustomAngle(0); }}
              className="w-full py-3 bg-white/5 text-white/40 hover:text-white/60 rounded-2xl font-medium text-sm transition-all">
              تغيير الصورة
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
