"use client";
import React, { useState, useRef, useEffect } from "react";
import { UploadCloud, Droplet, Crown, Image as ImageIcon, Type } from "lucide-react";
import ToolHeader from "../components/ToolHeader";
import { processDownloadOrShare } from "../utils";

// Preset logos available offline (served from /public)
const PRESET_LOGOS = [
  {
    id: "cake-princess",
    name: "كيك الأميرة",
    src: "/cake-logo-v3.png",
  },
];

export default function WatermarkPage() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [watermarkType, setWatermarkType] = useState<"text" | "image">("image");
  const [text, setText] = useState("Cake Princess");
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [opacity, setOpacity] = useState(70);
  const [size, setSize] = useState(15);
  const [position, setPosition] = useState<"bottom-right" | "bottom-left" | "top-right" | "top-left" | "center">("bottom-right");
  const [isProcessing, setIsProcessing] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoImgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const applyPresetLogo = (preset: typeof PRESET_LOGOS[0]) => {
    setLogoSrc(preset.src); setActivePresetId(preset.id);
    setWatermarkType("image"); setSize(15); setPosition("bottom-right"); setOpacity(80);
  };

  const drawWatermark = () => {
    if (!imageSrc || !imgRef.current || !canvasRef.current) return;
    const img = imgRef.current;
    if (!img.complete || img.naturalWidth === 0) return;
    const canvas = canvasRef.current;
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    
    ctx.globalAlpha = 1.0; ctx.drawImage(img, 0, 0);
    ctx.globalAlpha = opacity / 100;

    const margin = canvas.width * 0.05;
    let x = margin, y = margin;

    if (watermarkType === "text") {
      const fontSize = Math.max(20, canvas.width * (size / 100));
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.fillStyle = "white";
      const metrics = ctx.measureText(text);
      const w = metrics.width, h = fontSize;
      if (position.includes("right")) x = canvas.width - w - margin;
      else if (position === "center") x = (canvas.width - w) / 2;
      if (position.includes("bottom")) y = canvas.height - margin;
      else if (position === "center") y = (canvas.height + h) / 2;
      else y = margin + h;

      ctx.textBaseline = "bottom";
      ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2;
      ctx.fillText(text, x, y);
    } else if (logoSrc && logoImgRef.current) {
      const logo = logoImgRef.current;
      if (logo.complete && logo.naturalWidth > 0) {
        const ratio = logo.naturalWidth / logo.naturalHeight;
        const maxDim = Math.min(canvas.width, canvas.height) * (size / 100);
        let w = maxDim, h = maxDim;
        if (ratio > 1) h = w / ratio; else w = h * ratio;
        if (position.includes("right")) x = canvas.width - w - margin;
        else if (position === "center") x = (canvas.width - w) / 2;
        if (position.includes("bottom")) y = canvas.height - h - margin;
        else if (position === "center") y = (canvas.height - h) / 2;
        ctx.drawImage(logo, x, y, w, h);
      }
    }
    ctx.globalAlpha = 1.0; ctx.shadowColor = "transparent";
  };

  useEffect(() => { drawWatermark(); }, [imageSrc, logoSrc, watermarkType, text, opacity, size, position]);

  const handleAction = async (action: "share" | "download") => {
    if (!canvasRef.current) return;
    setIsProcessing(true);
    try { await processDownloadOrShare(canvasRef.current.toDataURL("image/jpeg", 0.95), `watermarked_${Date.now()}.jpg`, action); }
    finally { setIsProcessing(false); }
  };

  return (
    <div className="min-h-screen bg-[#0f0f17]" dir="rtl">
      <div className="p-4">
        <ToolHeader
          title="العلامة المائية"
          description="احمِ صورك بشعارك أو نص خاص"
          icon={<Droplet className="w-5 h-5 text-white/80" />}
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
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <UploadCloud className="w-7 h-7 text-white" />
              </div>
              <p className="text-white font-bold">ارفع الصورة</p>
            </div>
          ) : (
            <div className="w-full flex justify-center">
              <img ref={imgRef} src={imageSrc} onLoad={drawWatermark} className="hidden" />
              <canvas ref={canvasRef} className="max-w-full max-h-[40vh] object-contain rounded-xl shadow-2xl" />
            </div>
          )}
          <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={e => {
            const f = e.target.files?.[0]; if (f) setImageSrc(URL.createObjectURL(f));
          }} />
        </div>

        {imageSrc && (
          <div className="space-y-4">
            {/* Type selector */}
            <div className="flex bg-white/5 p-1 rounded-xl">
              <button onClick={() => setWatermarkType("image")}
                className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${
                  watermarkType === "image" ? "bg-violet-600 text-white" : "text-white/40 hover:text-white/60"
                }`}>
                <ImageIcon className="w-4 h-4" /> صورة (شعار)
              </button>
              <button onClick={() => setWatermarkType("text")}
                className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${
                  watermarkType === "text" ? "bg-violet-600 text-white" : "text-white/40 hover:text-white/60"
                }`}>
                <Type className="w-4 h-4" /> نص
              </button>
            </div>

            {/* Type Specific Content */}
            <div className="bg-white/5 rounded-2xl p-4">
              {watermarkType === "text" ? (
                <div>
                  <label className="text-white/50 text-xs mb-2 block">النص المائي</label>
                  <input type="text" value={text} onChange={e => setText(e.target.value)}
                    placeholder="اكتب علامتك هنا..." dir="auto"
                    className="w-full bg-white/5 border border-white/10 text-white placeholder-white/30 rounded-xl px-4 py-3 outline-none focus:border-violet-500 font-bold" />
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Presets */}
                  <div>
                    <p className="text-white/40 text-[10px] font-bold mb-2 flex items-center gap-1">
                      <Crown className="w-3 h-3 text-amber-400" /> لوغو جاهز
                    </p>
                    <div className="flex gap-2">
                      {PRESET_LOGOS.map(p => (
                        <button key={p.id} onClick={() => applyPresetLogo(p)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
                            activePresetId === p.id ? "border-violet-500 bg-violet-500/20 text-violet-300" : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                          }`}>
                          <img src={p.src} alt={p.name} className="w-6 h-6 object-contain" />
                          <span className="text-xs font-bold">{p.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Upload Custom Logo */}
                  {!logoSrc ? (
                    <button onClick={() => logoInputRef.current?.click()}
                      className="w-full py-3 border-2 border-dashed border-white/20 rounded-xl text-white/50 hover:bg-white/5 hover:border-violet-500/50 transition-colors flex items-center justify-center gap-2 text-sm font-bold">
                      <UploadCloud className="w-4 h-4" /> رفع شعار مخصص (PNG)
                    </button>
                  ) : (
                    <div className="flex items-center gap-3 bg-white/5 rounded-xl p-2 border border-white/10">
                      <img ref={logoImgRef} src={logoSrc} onLoad={drawWatermark} className="h-10 w-10 object-contain bg-white rounded p-1" />
                      <div className="flex-1">
                        <p className="text-xs font-bold text-white">{activePresetId ? PRESET_LOGOS.find(p=>p.id===activePresetId)?.name : "شعار مخصص"}</p>
                      </div>
                      <button onClick={() => { setLogoSrc(null); setActivePresetId(null); }} className="text-red-400 hover:text-red-300 text-xs font-bold px-3">
                        إزالة
                      </button>
                    </div>
                  )}
                  <input type="file" accept="image/png,image/svg+xml" className="hidden" ref={logoInputRef}
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) { setLogoSrc(URL.createObjectURL(f)); setActivePresetId(null); }
                    }} />
                </div>
              )}
            </div>

            {/* General Controls */}
            <div className="space-y-4 bg-white/5 rounded-2xl p-4">
              <div>
                <label className="flex justify-between text-xs text-white/50 mb-2">
                  <span>الشفافية</span><span className="text-violet-400 font-bold">{opacity}%</span>
                </label>
                <input type="range" min={5} max={100} value={opacity} onChange={e => setOpacity(Number(e.target.value))} className="w-full accent-violet-500" />
              </div>
              
              <div>
                <label className="flex justify-between text-xs text-white/50 mb-2">
                  <span>الحجم</span><span className="text-violet-400 font-bold">{size}%</span>
                </label>
                <input type="range" min={5} max={100} value={size} onChange={e => setSize(Number(e.target.value))} className="w-full accent-violet-500" />
              </div>

              <div>
                <label className="text-white/50 text-xs mb-2 block">الموقع</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: "top-right", label: "أعلى اليمين" },
                    { val: "top-left", label: "أعلى اليسار" },
                    { val: "center", label: "الوسط" },
                    { val: "bottom-right", label: "أسفل اليمين" },
                    { val: "bottom-left", label: "أسفل اليسار" },
                  ].map(pos => (
                    <button key={pos.val} onClick={() => setPosition(pos.val as any)}
                      className={`py-2 text-[10px] font-bold rounded-lg border transition-colors ${
                        position === pos.val ? 'bg-violet-500/20 border-violet-500 text-violet-300' : 'border-white/10 text-white/40 hover:bg-white/5'
                      }`}>
                      {pos.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button onClick={() => setImageSrc(null)}
              className="w-full py-3 bg-white/5 text-white/40 hover:text-white/60 rounded-2xl font-medium text-sm transition-all">
              تغيير الصورة الرئيسية
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
