"use client";
import React, { useState, useRef, useEffect } from "react";
import { UploadCloud, Maximize } from "lucide-react";
import ToolHeader from "../components/ToolHeader";
import { processDownloadOrShare } from "../utils";

const PRESETS = [
  { label: "Instagram مربع", w: 1080, h: 1080 },
  { label: "Instagram Story", w: 1080, h: 1920 },
  { label: "Facebook غلاف", w: 820, h: 312 },
  { label: "WhatsApp", w: 800, h: 800 },
  { label: "HD", w: 1280, h: 720 },
  { label: "Full HD", w: 1920, h: 1080 },
];

export default function ResizeImagePage() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [width, setWidth] = useState<number | "">(800);
  const [height, setHeight] = useState<number | "">(800);
  const [maintainRatio, setMaintainRatio] = useState(true);
  const [aspectRatio, setAspectRatio] = useState(1);
  const [origW, setOrigW] = useState(0);
  const [origH, setOrigH] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    const img = new Image();
    img.src = url;
    img.onload = () => {
      setWidth(img.naturalWidth); setHeight(img.naturalHeight);
      setAspectRatio(img.naturalWidth / img.naturalHeight);
      setOrigW(img.naturalWidth); setOrigH(img.naturalHeight);
    };
  };

  const handleWidthChange = (val: number) => {
    setWidth(val);
    if (maintainRatio && val) setHeight(Math.round(val / aspectRatio));
  };
  const handleHeightChange = (val: number) => {
    setHeight(val);
    if (maintainRatio && val) setWidth(Math.round(val * aspectRatio));
  };

  const applyPreset = (w: number, h: number) => { 
    setWidth(w); 
    setHeight(h); 
    setAspectRatio(w / h);
    setMaintainRatio(false);
  };

  const handleAction = async (action: "share" | "download") => {
    if (!imageSrc || !imgRef.current || !width || !height) return;
    setIsProcessing(true);
    try {
      const img = imgRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = Number(width); canvas.height = Number(height);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      await processDownloadOrShare(canvas.toDataURL("image/jpeg", 0.95), `resized_${Date.now()}.jpg`, action);
    } finally { setIsProcessing(false); }
  };

  return (
    <div className="min-h-screen bg-[#0f0f17]" dir="rtl">
      <div className="p-4">
        <ToolHeader
          title="تغيير الحجم"
          description="غيّر أبعاد الصورة بالبكسل"
          icon={<Maximize className="w-5 h-5 text-white/80" />}
          onAction={handleAction}
          isProcessing={isProcessing}
          hasData={!!imageSrc}
        />

        {/* Upload / Preview */}
        <div
          onClick={() => !imageSrc && fileInputRef.current?.click()}
          className={`w-full rounded-2xl overflow-hidden mb-4 flex items-center justify-center ${
            !imageSrc ? "border-2 border-dashed border-white/20 bg-white/5 cursor-pointer hover:bg-white/8 min-h-[220px]" : "bg-black/20 p-4"
          }`}
        >
          {!imageSrc ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
                <UploadCloud className="w-7 h-7 text-white" />
              </div>
              <p className="text-white font-bold">ارفع صورة</p>
            </div>
          ) : (
            <img 
              ref={imgRef} 
              src={imageSrc} 
              className="max-w-full max-h-[40vh] shadow-2xl rounded-xl"
              style={{
                aspectRatio: width && height ? `${width}/${height}` : 'auto',
                objectFit: 'fill'
              }}
            />
          )}
          <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
        </div>

        {imageSrc && (
          <div className="space-y-4">
            {/* Size info */}
            <div className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-2.5">
              <span className="text-white/50 text-xs">الأبعاد الأصلية</span>
              <span className="text-white font-bold text-sm">{origW} × {origH} px</span>
            </div>

            {/* Presets */}
            <div>
              <p className="text-white/40 text-xs font-bold mb-2">أحجام جاهزة</p>
              <div className="grid grid-cols-3 gap-2">
                {PRESETS.map(p => (
                  <button key={p.label} onClick={() => applyPreset(p.w, p.h)}
                    className={`py-2 px-2 rounded-xl text-[10px] font-bold transition-all ${
                      width === p.w && height === p.h ? "bg-cyan-500 text-white" : "bg-white/10 text-white/70 hover:bg-white/15"
                    }`}>
                    {p.label}<br /><span className="text-[9px] opacity-60">{p.w}×{p.h}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-white/50 text-xs mb-1.5 block">العرض (px)</label>
                <input type="number" value={width} onChange={e => handleWidthChange(Number(e.target.value))}
                  className="w-full bg-white/10 border border-white/10 text-white rounded-xl px-3 py-2.5 outline-none focus:border-cyan-500 font-bold" />
              </div>
              <div>
                <label className="text-white/50 text-xs mb-1.5 block">الطول (px)</label>
                <input type="number" value={height} onChange={e => handleHeightChange(Number(e.target.value))}
                  className="w-full bg-white/10 border border-white/10 text-white rounded-xl px-3 py-2.5 outline-none focus:border-cyan-500 font-bold" />
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input type="checkbox" checked={maintainRatio} onChange={e => setMaintainRatio(e.target.checked)}
                className="w-4 h-4 accent-cyan-500 rounded" />
              <span className="text-sm text-white/70 font-medium">الحفاظ على نسبة العرض للطول</span>
            </label>

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
