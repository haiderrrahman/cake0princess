"use client";
import React, { useState, useRef, useEffect } from "react";
import { UploadCloud, Minimize2 } from "lucide-react";
import ToolHeader from "../components/ToolHeader";
import { processDownloadOrShare } from "../utils";

export default function CompressPage() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [quality, setQuality] = useState(75);
  const [format, setFormat] = useState("image/jpeg");
  const [originalSize, setOriginalSize] = useState(0);
  const [compressedSize, setCompressedSize] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setOriginalSize(file.size);
    setImageSrc(URL.createObjectURL(file));
  };

  const updateCompressedSize = () => {
    const img = imgRef.current; if (!img || !img.complete || !img.naturalWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    canvas.getContext("2d")!.drawImage(img, 0, 0);
    const dataUrl = canvas.toDataURL(format, quality / 100);
    setCompressedSize(Math.round((dataUrl.length - 22) * 3 / 4));
  };

  useEffect(() => { if (imageSrc) updateCompressedSize(); }, [quality, format, imageSrc]);

  const handleAction = async (action: "share" | "download") => {
    if (!imageSrc || !imgRef.current) return;
    setIsProcessing(true);
    try {
      const img = imgRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      const ext = format === "image/jpeg" ? "jpg" : "webp";
      await processDownloadOrShare(canvas.toDataURL(format, quality / 100), `compressed_${Date.now()}.${ext}`, action);
    } finally { setIsProcessing(false); }
  };

  const fmt = (b: number) => b > 1048576 ? `${(b/1048576).toFixed(1)} MB` : `${Math.round(b/1024)} KB`;
  const saving = originalSize > 0 && compressedSize > 0 ? Math.round((1 - compressedSize / originalSize) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#0f0f17]" dir="rtl">
      <div className="p-4">
        <ToolHeader
          title="ضغط الصور"
          description="قلل الحجم مع الحفاظ على الجودة"
          icon={<Minimize2 className="w-5 h-5 text-white/80" />}
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
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-600 to-rose-800 flex items-center justify-center shadow-lg">
                <UploadCloud className="w-7 h-7 text-white" />
              </div>
              <p className="text-white font-bold">ارفع صورة</p>
            </div>
          ) : (
            <img ref={imgRef} src={imageSrc} onLoad={updateCompressedSize}
              className="max-w-full max-h-[40vh] object-contain rounded-xl shadow-2xl" />
          )}
          <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
        </div>

        {imageSrc && (
          <div className="space-y-4">
            {/* Stats */}
            {originalSize > 0 && (
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <p className="text-white/40 text-[10px] mb-1">الأصلي</p>
                  <p className="text-white font-black text-sm">{fmt(originalSize)}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <p className="text-white/40 text-[10px] mb-1">المضغوط</p>
                  <p className="text-green-400 font-black text-sm">{fmt(compressedSize)}</p>
                </div>
                <div className={`rounded-xl p-3 text-center ${saving > 0 ? "bg-green-500/20" : "bg-white/5"}`}>
                  <p className="text-white/40 text-[10px] mb-1">التوفير</p>
                  <p className={`font-black text-sm ${saving > 0 ? "text-green-400" : "text-white"}`}>{saving}%</p>
                </div>
              </div>
            )}

            {/* Quality slider */}
            <div className="bg-white/5 rounded-2xl p-4">
              <label className="flex justify-between text-sm text-white/60 mb-3 font-medium">
                <span>جودة الصورة</span>
                <span className={`font-black ${quality < 50 ? "text-red-400" : quality < 75 ? "text-amber-400" : "text-green-400"}`}>
                  {quality}%
                </span>
              </label>
              <input type="range" min={10} max={100} value={quality}
                onChange={e => setQuality(Number(e.target.value))}
                className="w-full accent-red-500" />
              <div className="flex justify-between text-[10px] text-white/30 mt-1">
                <span>أصغر حجم</span><span>أعلى جودة</span>
              </div>
            </div>

            {/* Format */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { val: "image/jpeg", label: "JPG", desc: "للصور الفوتوغرافية" },
                { val: "image/webp", label: "WebP", desc: "حجم أصغر بكثير" },
              ].map(f => (
                <button key={f.val} onClick={() => setFormat(f.val)}
                  className={`py-3 rounded-xl font-bold transition-all ${format === f.val ? "bg-red-600 text-white" : "bg-white/10 text-white/60 hover:bg-white/15"}`}>
                  {f.label}<br /><span className="text-[10px] font-normal opacity-70">{f.desc}</span>
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
