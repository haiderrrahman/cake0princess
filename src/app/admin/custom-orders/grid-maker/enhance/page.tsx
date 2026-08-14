"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  UploadCloud, Wand2, RefreshCw, SplitSquareHorizontal, Sliders, Palette,
  Star, Sparkles, RotateCw, FlipHorizontal, FlipVertical, Type,
  Sun, Eye, Wind, Frame, ChevronLeft, ChevronRight, Camera, Contrast, Droplets
} from "lucide-react";
import ToolHeader from "../components/ToolHeader";
import { processDownloadOrShare } from "../utils";

type Adjustments = {
  brightness: number; contrast: number; saturation: number;
  warmth: number; tint: number; highlights: number; shadows: number;
  sharpness: number; blur: number; vignette: number;
  hue: number; sepia: number; invert: number; grayscale: number;
  exposure: number; fade: number;
};
const DEFAULT_ADJ: Adjustments = {
  brightness: 100, contrast: 100, saturation: 100, warmth: 0, tint: 0,
  highlights: 0, shadows: 0, sharpness: 0, blur: 0, vignette: 0,
  hue: 0, sepia: 0, invert: 0, grayscale: 0, exposure: 0, fade: 0,
};

type Preset = { name: string; emoji: string; adj: Partial<Adjustments>; };
const PRESETS: Preset[] = [
  { name: "أصلي", emoji: "🖼️", adj: {} },
  { name: "كيك ناعم", emoji: "🎂", adj: { brightness: 108, contrast: 95, saturation: 110, warmth: 15, highlights: -10, shadows: 10 } },
  { name: "ذهبي دافئ", emoji: "✨", adj: { brightness: 105, contrast: 108, saturation: 115, warmth: 35, sepia: 10 } },
  { name: "روزغولد", emoji: "🌸", adj: { brightness: 108, contrast: 100, saturation: 90, warmth: 25, tint: 10, hue: -10 } },
  { name: "فاتح ونظيف", emoji: "🤍", adj: { brightness: 118, contrast: 88, saturation: 85, highlights: -20, shadows: 20 } },
  { name: "درامي", emoji: "🎭", adj: { brightness: 88, contrast: 140, saturation: 90, shadows: -25, highlights: -15, vignette: 40 } },
  { name: "فيلمي", emoji: "🎬", adj: { brightness: 95, contrast: 110, saturation: 80, fade: 15, vignette: 30, warmth: 10 } },
  { name: "بارد", emoji: "❄️", adj: { brightness: 105, contrast: 105, saturation: 95, warmth: -20, tint: -5 } },
  { name: "أبيض وأسود", emoji: "⬛", adj: { grayscale: 100, contrast: 115 } },
  { name: "عتيق", emoji: "📷", adj: { sepia: 60, contrast: 90, saturation: 70, vignette: 35, fade: 20 } },
  { name: "فيبران", emoji: "🌈", adj: { saturation: 150, contrast: 108, brightness: 103 } },
  { name: "ليلي", emoji: "🌙", adj: { brightness: 80, contrast: 130, saturation: 70, shadows: -20, vignette: 50 } },
];

type BorderStyle = { width: number; color: string; style: "none" | "solid" | "double" };
type TextOverlay = { text: string; x: number; y: number; size: number; color: string; bold: boolean; shadow: boolean };

export default function EnhancePage() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [adj, setAdj] = useState<Adjustments>({ ...DEFAULT_ADJ });
  const [activePreset, setActivePreset] = useState(0);
  const [splitView, setSplitView] = useState(false);
  const [splitX, setSplitX] = useState(50);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<"basic" | "color" | "effects" | "transform" | "border" | "text">("basic");
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [border, setBorder] = useState<BorderStyle>({ width: 0, color: "#ffffff", style: "solid" });
  const [textOverlay, setTextOverlay] = useState<TextOverlay>({ text: "", x: 10, y: 50, size: 32, color: "#ffffff", bold: true, shadow: true });

  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const origCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setAdj1 = (k: keyof Adjustments, v: number) => setAdj(p => ({ ...p, [k]: v }));
  const applyPreset = (preset: Preset, idx: number) => { setActivePreset(idx); setAdj({ ...DEFAULT_ADJ, ...preset.adj }); };

  const draw = useCallback(() => {
    const img = imgRef.current; const canvas = canvasRef.current;
    if (!img || !canvas || !img.complete || img.naturalWidth === 0) return;
    const W = img.naturalWidth, H = img.naturalHeight;
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad)); const sin = Math.abs(Math.sin(rad));
    const newW = Math.round(W * cos + H * sin); const newH = Math.round(W * sin + H * cos);
    canvas.width = newW; canvas.height = newH;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, newW, newH);
    ctx.save();
    ctx.translate(newW / 2, newH / 2);
    ctx.rotate(rad);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    const fStr = [`brightness(${adj.brightness + adj.exposure}%)`, `contrast(${adj.contrast}%)`, `saturate(${adj.saturation}%)`, `blur(${adj.blur}px)`, `sepia(${adj.sepia}%)`, `hue-rotate(${adj.hue}deg)`, `grayscale(${adj.grayscale}%)`, adj.invert > 0 ? `invert(${adj.invert}%)` : ""].filter(Boolean).join(" ");
    ctx.filter = fStr; ctx.drawImage(img, -W / 2, -H / 2, W, H); ctx.filter = "none";
    ctx.restore();
    if (adj.warmth !== 0) { ctx.globalCompositeOperation = "overlay"; ctx.globalAlpha = Math.abs(adj.warmth) / 200; ctx.fillStyle = adj.warmth > 0 ? "#ff8800" : "#0044ff"; ctx.fillRect(0, 0, newW, newH); ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1; }
    if (adj.tint !== 0) { ctx.globalCompositeOperation = "overlay"; ctx.globalAlpha = Math.abs(adj.tint) / 300; ctx.fillStyle = adj.tint > 0 ? "#00cc66" : "#cc00aa"; ctx.fillRect(0, 0, newW, newH); ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1; }
    if (adj.highlights !== 0) { ctx.globalCompositeOperation = adj.highlights > 0 ? "screen" : "multiply"; ctx.globalAlpha = Math.abs(adj.highlights) / 300; ctx.fillStyle = adj.highlights > 0 ? "#ffffff" : "#000000"; ctx.fillRect(0, 0, newW, newH); ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1; }
    if (adj.shadows !== 0) { ctx.globalCompositeOperation = adj.shadows > 0 ? "overlay" : "multiply"; ctx.globalAlpha = Math.abs(adj.shadows) / 400; ctx.fillStyle = adj.shadows > 0 ? "#888888" : "#000000"; ctx.fillRect(0, 0, newW, newH); ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1; }
    if (adj.fade > 0) { ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = adj.fade / 400; ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, newW, newH); ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1; }
    if (adj.vignette > 0) { const grad = ctx.createRadialGradient(newW/2, newH/2, Math.min(newW,newH)*0.3, newW/2, newH/2, Math.max(newW,newH)*0.75); grad.addColorStop(0, "rgba(0,0,0,0)"); grad.addColorStop(1, `rgba(0,0,0,${adj.vignette/100})`); ctx.fillStyle = grad; ctx.fillRect(0, 0, newW, newH); }
    if (border.width > 0) {
      const bw = border.width;
      ctx.strokeStyle = border.color; ctx.lineWidth = bw * 2;
      if (border.style === "double") { ctx.lineWidth = bw; ctx.strokeRect(bw/2, bw/2, newW-bw, newH-bw); ctx.strokeRect(bw*1.5, bw*1.5, newW-bw*3, newH-bw*3); }
      else { ctx.strokeRect(bw/2, bw/2, newW-bw, newH-bw); }
    }
    if (textOverlay.text) {
      ctx.font = `${textOverlay.bold ? "bold" : "normal"} ${textOverlay.size}px Arial`;
      ctx.fillStyle = textOverlay.color;
      if (textOverlay.shadow) { ctx.shadowColor = "rgba(0,0,0,0.7)"; ctx.shadowBlur = 8; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2; }
      ctx.fillText(textOverlay.text, (textOverlay.x/100)*newW, (textOverlay.y/100)*newH);
      ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
    }
  }, [adj, rotation, flipH, flipV, border, textOverlay]);

  const drawOrig = useCallback(() => {
    const img = imgRef.current; const canvas = origCanvasRef.current;
    if (!img || !canvas || !img.complete || img.naturalWidth === 0) return;
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    canvas.getContext("2d")!.drawImage(img, 0, 0);
  }, []);

  useEffect(() => { if (imageSrc) { draw(); drawOrig(); } }, [imageSrc, adj, rotation, flipH, flipV, border, textOverlay, draw, drawOrig]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImageSrc(URL.createObjectURL(file));
    setAdj({ ...DEFAULT_ADJ }); setActivePreset(0); setSplitView(false); setRotation(0); setFlipH(false); setFlipV(false);
  };

  const handleAction = async (action: "share" | "download") => {
    if (!canvasRef.current) return;
    setIsProcessing(true);
    try { await processDownloadOrShare(canvasRef.current.toDataURL("image/jpeg", 0.95), `enhanced_${Date.now()}.jpg`, action); }
    finally { setIsProcessing(false); }
  };

  const sliderBg = (val: number, min: number, max: number) => {
    const pct = ((val - min) / (max - min)) * 100;
    return `linear-gradient(to left, rgb(139 92 246) 0%, rgb(139 92 246) ${pct}%, rgba(255,255,255,0.1) ${pct}%, rgba(255,255,255,0.1) 100%)`;
  };

  const Slider = ({ label, k, min, max, unit = "" }: { label: string; k: keyof Adjustments; min: number; max: number; unit?: string }) => (
    <div className="mb-5">
      <label className="flex justify-between items-center text-[11px] text-white/60 mb-2 font-bold">
        <span>{label}</span>
        <span className="text-violet-300 font-black bg-violet-500/10 px-2 py-0.5 rounded-lg">{adj[k] as number}{unit}</span>
      </label>
      <input type="range" min={min} max={max} value={adj[k] as number}
        onChange={e => { setAdj1(k, Number(e.target.value)); setActivePreset(-1); }}
        className="w-full h-2 rounded-full appearance-none cursor-pointer accent-violet-500"
        style={{ background: sliderBg(adj[k] as number, min, max) }}
      />
    </div>
  );

  const tabs = [
    { id: "basic", label: "أساسي", icon: Sliders },
    { id: "color", label: "الألوان", icon: Palette },
    { id: "effects", label: "تأثيرات", icon: Wand2 },
    { id: "transform", label: "تحويل", icon: RotateCw },
    { id: "border", label: "إطار", icon: Frame },
    { id: "text", label: "نص", icon: Type },
  ];

  return (
    <div className="min-h-screen bg-[#0f0f17]" dir="rtl">
      <div className="p-4">
        <ToolHeader
          title="استوديو تعديل الصور"
          description="أدوات احترافية لتعديل وتحسين الصور بالكامل"
          icon={<Sparkles className="w-5 h-5 text-white/80" />}
          onAction={handleAction}
          isProcessing={isProcessing}
          hasData={!!imageSrc}
        />

        {!imageSrc ? (
          <div onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-3xl border-2 border-dashed border-white/20 bg-white/5 cursor-pointer hover:bg-white/10 min-h-[240px] flex items-center justify-center transition-all mb-4">
            <div className="flex flex-col items-center gap-3 py-10">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                <Camera className="w-8 h-8 text-white" />
              </div>
              <p className="text-white font-black text-lg">ارفع صورة</p>
              <p className="text-white/30 text-xs font-medium">اضغط لاختيار صورة من جهازك</p>
            </div>
          </div>
        ) : (
          <div className="mb-4">
            {/* Preview */}
            <div className="flex justify-center bg-black/50 rounded-3xl p-3 relative mb-3 min-h-[220px] items-center">
              <img ref={imgRef} src={imageSrc} onLoad={() => { draw(); drawOrig(); }} className="hidden" alt="" />
              {splitView ? (
                <div className="relative w-full max-w-xl overflow-hidden rounded-2xl shadow-2xl">
                  <canvas ref={origCanvasRef} className="w-full h-auto block" />
                  <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - splitX}% 0 0)` }}>
                    <canvas ref={canvasRef} className="w-full h-auto block" />
                  </div>
                  <div className="absolute inset-y-0 flex items-center pointer-events-none" style={{ left: `${splitX}%`, transform: "translateX(-50%)" }}>
                    <div className="w-0.5 h-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)]" />
                    <div className="absolute w-9 h-9 bg-black/60 backdrop-blur-sm rounded-full border-2 border-white flex items-center justify-center shadow-xl">
                      <div className="flex gap-0.5"><ChevronLeft className="w-3 h-3 text-white" /><ChevronRight className="w-3 h-3 text-white" /></div>
                    </div>
                  </div>
                  <input type="range" min={0} max={100} value={splitX} onChange={e => setSplitX(Number(e.target.value))} className="absolute inset-0 w-full opacity-0 cursor-col-resize" />
                  <div className="absolute top-2 right-2 bg-black/60 text-white text-[9px] font-bold px-2 py-1 rounded-full">بعد</div>
                  <div className="absolute top-2 left-2 bg-black/60 text-white text-[9px] font-bold px-2 py-1 rounded-full">قبل</div>
                </div>
              ) : (
                <canvas ref={canvasRef} className="max-w-full max-h-[45vh] rounded-2xl shadow-2xl block" />
              )}
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[
                { label: "قبل/بعد", icon: SplitSquareHorizontal, action: () => setSplitView(s => !s), active: splitView },
                { label: "+90° دوران", icon: RotateCw, action: () => setRotation(r => (r + 90) % 360), active: false },
                { label: "قلب أفقي", icon: FlipHorizontal, action: () => setFlipH(f => !f), active: flipH },
                { label: "استعادة كل شيء", icon: RefreshCw, action: () => { setAdj({ ...DEFAULT_ADJ }); setActivePreset(0); setRotation(0); setFlipH(false); setFlipV(false); setBorder({ width: 0, color: "#ffffff", style: "solid" }); setTextOverlay({ text: "", x: 10, y: 50, size: 32, color: "#ffffff", bold: true, shadow: true }); }, active: false },
              ].map((b, i) => {
                const Icon = b.icon;
                return (
                  <button key={i} onClick={b.action} className={`py-3 rounded-2xl text-xs flex flex-col items-center justify-center gap-1.5 transition-all font-black ${b.active ? "bg-violet-600 text-white shadow-lg shadow-violet-500/30" : "bg-white/8 text-white/60 hover:bg-white/12 border border-white/10"}`}>
                    <Icon className="w-4 h-4" />
                    <span className="text-[9px] text-center leading-tight">{b.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Presets */}
            <div className="mb-3">
              <p className="text-white/40 text-xs font-black mb-2 flex items-center gap-1.5"><Star className="w-3.5 h-3.5 text-amber-400" /> فلاتر جاهزة</p>
              <div className="flex overflow-x-auto gap-2 pb-2" style={{ scrollbarWidth: "none" }}>
                {PRESETS.map((p, i) => (
                  <button key={i} onClick={() => applyPreset(p, i)}
                    className={`flex flex-col items-center gap-1 py-2.5 px-4 rounded-2xl min-w-[70px] transition-all shrink-0 ${activePreset === i ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30" : "bg-white/5 text-white/60 hover:bg-white/10 border border-white/10"}`}>
                    <span className="text-xl">{p.emoji}</span>
                    <span className="text-[10px] font-black">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div className="bg-black/30 rounded-2xl p-1 mb-3 flex gap-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {tabs.map(t => {
                const Icon = t.icon;
                return (
                  <button key={t.id} onClick={() => setActiveTab(t.id as any)}
                    className={`flex-1 py-2.5 text-[9px] font-black rounded-xl flex flex-col items-center justify-center gap-1 transition-all whitespace-nowrap min-w-[48px] ${activeTab === t.id ? "bg-violet-600 text-white shadow-lg" : "text-white/40 hover:text-white/70 hover:bg-white/5"}`}>
                    <Icon className="w-3.5 h-3.5" /> {t.label}
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            <div className="bg-white/5 rounded-3xl p-4 border border-white/10">
              {activeTab === "basic" && <div>
                <Slider label="السطوع" k="brightness" min={0} max={200} unit="%" />
                <Slider label="التباين" k="contrast" min={0} max={200} unit="%" />
                <Slider label="التشبع" k="saturation" min={0} max={200} unit="%" />
                <Slider label="التعريض الضوئي" k="exposure" min={-50} max={50} />
                <Slider label="الوضوح" k="sharpness" min={0} max={100} />
              </div>}

              {activeTab === "color" && <div>
                <Slider label="الدفء" k="warmth" min={-100} max={100} />
                <Slider label="التدرج اللوني" k="tint" min={-100} max={100} />
                <Slider label="الإضاءة العلوية" k="highlights" min={-100} max={100} />
                <Slider label="الظلال" k="shadows" min={-100} max={100} />
                <Slider label="دوران اللون" k="hue" min={0} max={360} unit="°" />
              </div>}

              {activeTab === "effects" && <div>
                <Slider label="إطار داكن (Vignette)" k="vignette" min={0} max={100} unit="%" />
                <Slider label="سيبيا" k="sepia" min={0} max={100} unit="%" />
                <Slider label="أبيض وأسود" k="grayscale" min={0} max={100} unit="%" />
                <Slider label="تلاشي (Fade)" k="fade" min={0} max={80} unit="%" />
                <Slider label="تمويه (Blur)" k="blur" min={0} max={20} />
                <Slider label="عكس الألوان" k="invert" min={0} max={100} unit="%" />
              </div>}

              {activeTab === "transform" && <div className="space-y-5">
                <div>
                  <label className="text-[11px] text-white/60 font-black mb-3 flex justify-between">
                    <span>الدوران</span><span className="text-violet-300">{rotation}°</span>
                  </label>
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {[0, 90, 180, 270].map(deg => (
                      <button key={deg} onClick={() => setRotation(deg)} className={`py-2.5 rounded-xl text-xs font-black transition-all ${rotation === deg ? "bg-violet-600 text-white" : "bg-white/8 text-white/60 border border-white/10 hover:bg-white/15"}`}>{deg}°</button>
                    ))}
                  </div>
                  <input type="range" min={0} max={359} value={rotation} onChange={e => setRotation(Number(e.target.value))} className="w-full h-2 rounded-full appearance-none cursor-pointer accent-violet-500" style={{ background: sliderBg(rotation, 0, 359) }} />
                </div>
                <div>
                  <label className="text-[11px] text-white/60 font-black mb-3 block">القلب</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setFlipH(f => !f)} className={`py-3 rounded-2xl text-xs font-black flex items-center justify-center gap-2 transition-all ${flipH ? "bg-violet-600 text-white" : "bg-white/8 text-white/60 border border-white/10"}`}><FlipHorizontal className="w-4 h-4" /> أفقي</button>
                    <button onClick={() => setFlipV(f => !f)} className={`py-3 rounded-2xl text-xs font-black flex items-center justify-center gap-2 transition-all ${flipV ? "bg-violet-600 text-white" : "bg-white/8 text-white/60 border border-white/10"}`}><FlipVertical className="w-4 h-4" /> عمودي</button>
                  </div>
                </div>
              </div>}

              {activeTab === "border" && <div className="space-y-5">
                <div>
                  <label className="text-[11px] text-white/60 font-black mb-2 flex justify-between"><span>سماكة الإطار</span><span className="text-violet-300">{border.width}px</span></label>
                  <input type="range" min={0} max={80} value={border.width} onChange={e => setBorder(b => ({ ...b, width: Number(e.target.value) }))} className="w-full h-2 rounded-full appearance-none cursor-pointer accent-violet-500" style={{ background: sliderBg(border.width, 0, 80) }} />
                </div>
                <div>
                  <label className="text-[11px] text-white/60 font-black mb-2 block">نوع الإطار</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["solid", "double"] as const).map(s => (
                      <button key={s} onClick={() => setBorder(b => ({ ...b, style: s }))} className={`py-2.5 rounded-xl text-xs font-black transition-all ${border.style === s ? "bg-violet-600 text-white" : "bg-white/8 text-white/60 border border-white/10"}`}>
                        {s === "solid" ? "عادي" : "مزدوج"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-white/60 font-black mb-2 block">لون الإطار</label>
                  <div className="flex gap-2 flex-wrap">
                    {["#ffffff", "#000000", "#d4a017", "#ec4899", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"].map(c => (
                      <button key={c} onClick={() => setBorder(b => ({ ...b, color: c }))} className={`w-8 h-8 rounded-full border-2 transition-transform ${border.color === c ? "border-violet-400 scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} />
                    ))}
                    <div className="relative w-8 h-8 rounded-full overflow-hidden border border-white/20">
                      <input type="color" value={border.color} onChange={e => setBorder(b => ({ ...b, color: e.target.value }))} className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer" />
                    </div>
                  </div>
                </div>
              </div>}

              {activeTab === "text" && <div className="space-y-4">
                <div>
                  <label className="text-[11px] text-white/60 font-black mb-2 block">النص</label>
                  <input type="text" value={textOverlay.text} placeholder="اكتب نصاً على الصورة..." onChange={e => setTextOverlay(t => ({ ...t, text: e.target.value }))} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm font-bold outline-none focus:border-violet-500 placeholder-white/20" dir="rtl" />
                </div>
                <div>
                  <label className="text-[11px] text-white/60 font-black mb-2 flex justify-between"><span>حجم الخط</span><span className="text-violet-300">{textOverlay.size}px</span></label>
                  <input type="range" min={12} max={120} value={textOverlay.size} onChange={e => setTextOverlay(t => ({ ...t, size: Number(e.target.value) }))} className="w-full h-2 rounded-full appearance-none cursor-pointer accent-violet-500" style={{ background: sliderBg(textOverlay.size, 12, 120) }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-white/60 font-black mb-2 flex justify-between"><span>أفقي</span><span className="text-violet-300">{textOverlay.x}%</span></label>
                    <input type="range" min={0} max={100} value={textOverlay.x} onChange={e => setTextOverlay(t => ({ ...t, x: Number(e.target.value) }))} className="w-full h-2 rounded-full appearance-none cursor-pointer accent-violet-500" />
                  </div>
                  <div>
                    <label className="text-[11px] text-white/60 font-black mb-2 flex justify-between"><span>عمودي</span><span className="text-violet-300">{textOverlay.y}%</span></label>
                    <input type="range" min={0} max={100} value={textOverlay.y} onChange={e => setTextOverlay(t => ({ ...t, y: Number(e.target.value) }))} className="w-full h-2 rounded-full appearance-none cursor-pointer accent-violet-500" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-white/60 font-black mb-2 block">لون النص</label>
                  <div className="flex gap-2 flex-wrap">
                    {["#ffffff", "#000000", "#fbbf24", "#f472b6", "#60a5fa", "#34d399"].map(c => (
                      <button key={c} onClick={() => setTextOverlay(t => ({ ...t, color: c }))} className={`w-8 h-8 rounded-full border-2 transition-transform ${textOverlay.color === c ? "border-violet-400 scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} />
                    ))}
                    <div className="relative w-8 h-8 rounded-full overflow-hidden border border-white/20">
                      <input type="color" value={textOverlay.color} onChange={e => setTextOverlay(t => ({ ...t, color: e.target.value }))} className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setTextOverlay(t => ({ ...t, bold: !t.bold }))} className={`py-2.5 rounded-xl text-xs font-black transition-all ${textOverlay.bold ? "bg-violet-600 text-white" : "bg-white/8 text-white/60 border border-white/10"}`}>عريض (Bold)</button>
                  <button onClick={() => setTextOverlay(t => ({ ...t, shadow: !t.shadow }))} className={`py-2.5 rounded-xl text-xs font-black transition-all ${textOverlay.shadow ? "bg-violet-600 text-white" : "bg-white/8 text-white/60 border border-white/10"}`}>ظل النص</button>
                </div>
              </div>}
            </div>

            <button onClick={() => { setImageSrc(null); setAdj({ ...DEFAULT_ADJ }); setActivePreset(0); setRotation(0); setFlipH(false); setFlipV(false); }} className="w-full mt-3 py-3 bg-white/5 text-white/40 hover:text-white/70 hover:bg-white/8 rounded-2xl font-bold text-sm transition-all border border-white/10">تغيير الصورة</button>
          </div>
        )}
        <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
      </div>
    </div>
  );
}
