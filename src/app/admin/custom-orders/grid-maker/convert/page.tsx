"use client";
import React, { useState, useRef } from "react";
import { UploadCloud, ArrowRightLeft } from "lucide-react";
import ToolHeader from "../components/ToolHeader";
import { processDownloadOrShare } from "../utils";

const FORMATS = [
  { val: "image/png",  label: "PNG",  desc: "جودة عالية • خلفية شفافة",  color: "from-blue-500 to-indigo-600" },
  { val: "image/jpeg", label: "JPG",  desc: "حجم أقل • مثالي للصور",      color: "from-orange-500 to-amber-600" },
  { val: "image/webp", label: "WebP", desc: "أحدث صيغة • أخف وزناً",     color: "from-teal-500 to-green-600" },
];

export default function ConvertImagePage() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [format, setFormat] = useState("image/png");
  const [isProcessing, setIsProcessing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImageSrc(URL.createObjectURL(file));
  };

  const handleAction = async (action: "share" | "download") => {
    if (!imageSrc || !imgRef.current) return;
    setIsProcessing(true);
    try {
      const img = imgRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      if (format === "image/jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      ctx.drawImage(img, 0, 0);
      const ext = format === "image/jpeg" ? "jpg" : format === "image/webp" ? "webp" : "png";
      await processDownloadOrShare(canvas.toDataURL(format, 0.95), `converted_${Date.now()}.${ext}`, action);
    } finally { setIsProcessing(false); }
  };

  const current = FORMATS.find(f => f.val === format)!;

  return (
    <div className="min-h-screen bg-[#0f0f17]" dir="rtl">
      <div className="p-4">
        <ToolHeader
          title="تحويل الصيغة"
          description="حوّل صورتك بين PNG و JPG و WebP"
          icon={<ArrowRightLeft className="w-5 h-5 text-white/80" />}
          onAction={handleAction}
          isProcessing={isProcessing}
          hasData={!!imageSrc}
        />

        {/* Upload / Preview */}
        <div
          onClick={() => !imageSrc && fileInputRef.current?.click()}
          className={`w-full rounded-2xl overflow-hidden mb-4 flex items-center justify-center ${
            !imageSrc ? "border-2 border-dashed border-white/20 bg-white/5 cursor-pointer hover:bg-white/8 min-h-[220px]" : ""
          }`}
        >
          {!imageSrc ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-green-600 flex items-center justify-center shadow-lg">
                <UploadCloud className="w-7 h-7 text-white" />
              </div>
              <p className="text-white font-bold">ارفع الصورة المراد تحويلها</p>
            </div>
          ) : (
            <img ref={imgRef} src={imageSrc} className="max-w-full max-h-[40vh] object-contain rounded-xl shadow-2xl" />
          )}
          <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
        </div>

        {imageSrc && (
          <div className="space-y-4">
            {/* Format badge */}
            <div className={`flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r ${current.color}`}>
              <ArrowRightLeft className="w-4 h-4 text-white" />
              <span className="text-white font-black">سيتم الحفظ كـ {current.label}</span>
            </div>

            {/* Format selection */}
            <div className="space-y-2">
              {FORMATS.map(f => (
                <button key={f.val} onClick={() => setFormat(f.val)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                    format === f.val
                      ? "border-teal-500 bg-teal-500/10"
                      : "border-white/10 bg-white/5 hover:border-white/20"
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center font-black text-white text-sm shrink-0`}>
                    {f.label}
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-sm ${format === f.val ? "text-teal-400" : "text-white"}`}>{f.label}</p>
                    <p className="text-white/40 text-xs">{f.desc}</p>
                  </div>
                  <div className={`ml-auto w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${format === f.val ? "border-teal-500 bg-teal-500" : "border-white/20"}`}>
                    {format === f.val && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                </button>
              ))}
            </div>

            <button onClick={() => setImageSrc(null)}
              className="w-full py-3 bg-white/5 text-white/40 hover:text-white/60 rounded-2xl font-medium text-sm transition-all">
              تغيير الصورة
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
