"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { UploadCloud, Frame } from "lucide-react";
import ToolHeader from "../components/ToolHeader";
import { processDownloadOrShare } from "../utils";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

type FrameDef = { id: string; name: string; emoji: string; category: string; draw: (ctx: CanvasRenderingContext2D, w: number, h: number, thick: number) => void; };

const FRAMES: FrameDef[] = [
  { id: "none", name: "بدون إطار", emoji: "🚫", category: "أساسي", draw: () => {} },
  { id: "gold-simple", name: "ذهبي فخم", emoji: "🥇", category: "ذهبي", draw: (ctx, w, h, t) => { const grad = ctx.createLinearGradient(0, 0, w, h); grad.addColorStop(0, "#f5e642"); grad.addColorStop(0.5, "#d4a017"); grad.addColorStop(1, "#f5e642"); ctx.strokeStyle = grad; ctx.lineWidth = t; ctx.strokeRect(t/2, t/2, w-t, h-t); } },
  { id: "gold-double", name: "ذهبي مزدوج", emoji: "👑", category: "ذهبي", draw: (ctx, w, h, t) => { const grad = ctx.createLinearGradient(0, 0, w, h); grad.addColorStop(0, "#f5e642"); grad.addColorStop(1, "#d4a017"); ctx.strokeStyle = grad; ctx.lineWidth = t * 0.6; ctx.strokeRect(t/2, t/2, w-t, h-t); ctx.lineWidth = t * 0.3; ctx.strokeRect(t * 1.2, t * 1.2, w - t*2.4, h - t*2.4); } },
  { id: "gold-ornament", name: "زخرفة ذهبية", emoji: "⚜️", category: "ذهبي", draw: (ctx, w, h, t) => {
      const grad = ctx.createLinearGradient(0, 0, w, h); 
      grad.addColorStop(0, "#f5e642"); grad.addColorStop(0.5, "#d4a017"); grad.addColorStop(1, "#f5e642"); 
      ctx.strokeStyle = grad; ctx.lineWidth = t * 0.4; ctx.strokeRect(t, t, w-t*2, h-t*2);
      ctx.lineWidth = t * 0.1; ctx.strokeRect(t * 1.6, t * 1.6, w-t*3.2, h-t*3.2);
      const cornerSize = t * 1.5; ctx.fillStyle = grad;
      ctx.fillRect(t*0.5, t*0.5, cornerSize, t*0.4); ctx.fillRect(t*0.5, t*0.5, t*0.4, cornerSize);
      ctx.fillRect(w - t*0.5 - cornerSize, t*0.5, cornerSize, t*0.4); ctx.fillRect(w - t*0.5 - t*0.4, t*0.5, t*0.4, cornerSize);
      ctx.fillRect(t*0.5, h - t*0.5 - t*0.4, cornerSize, t*0.4); ctx.fillRect(t*0.5, h - t*0.5 - cornerSize, t*0.4, cornerSize);
      ctx.fillRect(w - t*0.5 - cornerSize, h - t*0.5 - t*0.4, cornerSize, t*0.4); ctx.fillRect(w - t*0.5 - t*0.4, h - t*0.5 - cornerSize, t*0.4, cornerSize);
  }},
  { id: "vintage-gold", name: "ذهبي كلاسيكي", emoji: "🖼️", category: "ذهبي", draw: (ctx, w, h, t) => {
      const grad1 = ctx.createLinearGradient(0, 0, w, 0); grad1.addColorStop(0, "#B8860B"); grad1.addColorStop(0.5, "#FFD700"); grad1.addColorStop(1, "#B8860B");
      const grad2 = ctx.createLinearGradient(0, 0, 0, h); grad2.addColorStop(0, "#DAA520"); grad2.addColorStop(0.5, "#FFF8DC"); grad2.addColorStop(1, "#DAA520");
      ctx.lineWidth = t; ctx.strokeStyle = grad1; ctx.strokeRect(t/2, t/2, w-t, h-t);
      ctx.lineWidth = t * 0.3; ctx.strokeStyle = grad2; ctx.strokeRect(t*1.2, t*1.2, w-t*2.4, h-t*2.4);
      ctx.lineWidth = t * 0.1; ctx.strokeStyle = "#4a3c10"; ctx.strokeRect(t*1.4, t*1.4, w-t*2.8, h-t*2.8);
  }},
  { id: "royal-gold", name: "ملكي", emoji: "🏰", category: "ذهبي", draw: (ctx, w, h, t) => {
      ctx.fillStyle = "#1a1205"; ctx.fillRect(0, 0, w, t*2); ctx.fillRect(0, h-t*2, w, t*2); ctx.fillRect(0, 0, t*2, h); ctx.fillRect(w-t*2, 0, t*2, h);
      const grad = ctx.createLinearGradient(0, 0, w, h); grad.addColorStop(0, "#d4af37"); grad.addColorStop(0.5, "#f3e5ab"); grad.addColorStop(1, "#d4af37");
      ctx.strokeStyle = grad; ctx.lineWidth = t * 0.5; ctx.strokeRect(t, t, w-t*2, h-t*2);
      ctx.lineWidth = t * 0.2; ctx.strokeRect(t*1.7, t*1.7, w-t*3.4, h-t*3.4);
      ctx.beginPath(); ctx.arc(t, t, t*0.8, 0, Math.PI*2); ctx.fillStyle = grad; ctx.fill();
      ctx.beginPath(); ctx.arc(w-t, t, t*0.8, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(t, h-t, t*0.8, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(w-t, h-t, t*0.8, 0, Math.PI*2); ctx.fill();
  }},
  { id: "rose-gold", name: "روزغولد", emoji: "🌹", category: "ذهبي", draw: (ctx, w, h, t) => { const grad = ctx.createLinearGradient(0, 0, w, h); grad.addColorStop(0, "#f4c2c2"); grad.addColorStop(0.5, "#e8a598"); grad.addColorStop(1, "#d4a0a0"); ctx.strokeStyle = grad; ctx.lineWidth = t; ctx.strokeRect(t/2, t/2, w-t, h-t); ctx.strokeStyle = "#f0d0cc"; ctx.lineWidth = 2; ctx.strokeRect(t + 6, t + 6, w - (t+6)*2, h - (t+6)*2); } },
  { id: "white-clean", name: "أبيض نظيف", emoji: "🤍", category: "كلاسيك", draw: (ctx, w, h, t) => { ctx.strokeStyle = "#ffffff"; ctx.lineWidth = t; ctx.strokeRect(t/2, t/2, w-t, h-t); ctx.strokeStyle = "#f0f0f0"; ctx.lineWidth = 2; ctx.strokeRect(t + 4, t + 4, w - (t+4)*2, h - (t+4)*2); } },
  { id: "black-modern", name: "أسود عصري", emoji: "🖤", category: "كلاسيك", draw: (ctx, w, h, t) => { ctx.strokeStyle = "#1a1a1a"; ctx.lineWidth = t; ctx.strokeRect(t/2, t/2, w-t, h-t); } },
  { id: "pink-cake", name: "وردي كيك", emoji: "🎂", category: "كيك", draw: (ctx, w, h, t) => { const grad = ctx.createLinearGradient(0, 0, w, h); grad.addColorStop(0, "#ff6b9d"); grad.addColorStop(0.5, "#ff8fb3"); grad.addColorStop(1, "#ff6b9d"); ctx.strokeStyle = grad; ctx.lineWidth = t; ctx.strokeRect(t/2, t/2, w-t, h-t); ctx.fillStyle = "#fff"; const steps = Math.floor((w + h) / 30); for (let i = 0; i < steps; i++) { let x, y; const pos = (i / steps) * (2 * (w + h)); if (pos < w) { x = pos; y = t/2; } else if (pos < w + h) { x = w - t/2; y = pos - w; } else if (pos < 2*w + h) { x = w - (pos - w - h); y = h - t/2; } else { x = t/2; y = h - (pos - 2*w - h); } ctx.beginPath(); ctx.arc(x, y, t * 0.15, 0, Math.PI * 2); ctx.fill(); } } },
  { id: "floral", name: "زهور ناعمة", emoji: "🌸", category: "كيك", draw: (ctx, w, h, t) => { const grad = ctx.createLinearGradient(0, 0, w, h); grad.addColorStop(0, "#f9a8d4"); grad.addColorStop(0.5, "#c084fc"); grad.addColorStop(1, "#f9a8d4"); ctx.strokeStyle = grad; ctx.lineWidth = t * 0.7; ctx.strokeRect(t*0.35, t*0.35, w - t*0.7, h - t*0.7); const drawFlower = (cx: number, cy: number) => { const petals = 5; const r = t * 0.5; for (let i = 0; i < petals; i++) { const angle = (i / petals) * Math.PI * 2; const px = cx + Math.cos(angle) * r * 0.6; const py = cy + Math.sin(angle) * r * 0.6; ctx.beginPath(); ctx.arc(px, py, r * 0.35, 0, Math.PI * 2); ctx.fillStyle = "#f472b6"; ctx.fill(); } ctx.beginPath(); ctx.arc(cx, cy, r * 0.25, 0, Math.PI * 2); ctx.fillStyle = "#fbbf24"; ctx.fill(); }; drawFlower(t * 0.7, t * 0.7); drawFlower(w - t * 0.7, t * 0.7); drawFlower(t * 0.7, h - t * 0.7); drawFlower(w - t * 0.7, h - t * 0.7); } },
  { id: "pastel-purple", name: "باستيل بنفسجي", emoji: "💜", category: "باستيل", draw: (ctx, w, h, t) => { const grad = ctx.createLinearGradient(0, 0, w, h); grad.addColorStop(0, "#c4b5fd"); grad.addColorStop(1, "#a78bfa"); ctx.strokeStyle = grad; ctx.lineWidth = t; ctx.strokeRect(t/2, t/2, w-t, h-t); ctx.strokeStyle = "rgba(196,181,253,0.4)"; ctx.lineWidth = t * 0.3; ctx.strokeRect(t + 5, t + 5, w - (t+5)*2, h - (t+5)*2); } },
  { id: "pastel-mint", name: "نعناعي ناعم", emoji: "🌿", category: "باستيل", draw: (ctx, w, h, t) => { const grad = ctx.createLinearGradient(0, 0, w, h); grad.addColorStop(0, "#6ee7b7"); grad.addColorStop(1, "#34d399"); ctx.strokeStyle = grad; ctx.lineWidth = t; ctx.strokeRect(t/2, t/2, w-t, h-t); } },
  { id: "shadow-drop", name: "ظل داكن", emoji: "🌑", category: "تأثيرات", draw: (ctx, w, h, t) => { const makeEdge = (x: number, y: number, gx: number, gy: number) => { const g = ctx.createLinearGradient(x, y, gx, gy); g.addColorStop(0, `rgba(0,0,0,${t/100})`); g.addColorStop(1, "rgba(0,0,0,0)"); return g; }; const edge = t * 2; ctx.fillStyle = makeEdge(0, 0, edge, 0); ctx.fillRect(0, 0, edge, h); ctx.fillStyle = makeEdge(w, 0, w - edge, 0); ctx.fillRect(w - edge, 0, edge, h); ctx.fillStyle = makeEdge(0, 0, 0, edge); ctx.fillRect(0, 0, w, edge); ctx.fillStyle = makeEdge(0, h, 0, h - edge); ctx.fillRect(0, h - edge, w, edge); } },
  { id: "polaroid", name: "بولارويد", emoji: "📸", category: "تأثيرات", draw: (ctx, w, h, t) => { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, t * 0.6); ctx.fillRect(0, h - t * 1.4, w, t * 1.4); ctx.fillRect(0, 0, t * 0.6, h); ctx.fillRect(w - t * 0.6, 0, t * 0.6, h); } },
];
const CATEGORIES = Array.from(new Set(FRAMES.map(f => f.category)));

export default function FramesPage() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [selectedFrame, setSelectedFrame] = useState("none");
  const [frameThickness, setFrameThickness] = useState(40);
  const [filterCat, setFilterCat] = useState("الكل");
  const [isProcessing, setIsProcessing] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const draw = useCallback(() => {
    const img = imgRef.current; const canvas = canvasRef.current;
    if (!img || !canvas || !img.complete || !img.naturalWidth) return;
    const W = img.naturalWidth, H = img.naturalHeight;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0, W, H);
    const frame = FRAMES.find(f => f.id === selectedFrame);
    if (frame) frame.draw(ctx, W, H, frameThickness);
  }, [imageSrc, selectedFrame, frameThickness]);

  useEffect(() => { if (imageSrc) draw(); }, [imageSrc, selectedFrame, frameThickness, draw]);

  const handleAction = async (action: "share" | "download") => {
    if (!canvasRef.current) return;
    setIsProcessing(true);
    try { await processDownloadOrShare(canvasRef.current.toDataURL("image/jpeg", 0.95), `framed_${Date.now()}.jpg`, action); }
    finally { setIsProcessing(false); }
  };

  const filteredFrames = filterCat === "الكل" ? FRAMES : FRAMES.filter(f => f.category === filterCat);

  return (
    <div className="min-h-screen bg-[#0f0f17]" dir="rtl">
      <div className="p-4">
        <ToolHeader
          title="إطارات الصور"
          description="أضف إطاراً احترافياً لصورتك"
          icon={<Frame className="w-5 h-5 text-white/80" />}
          onAction={handleAction}
          isProcessing={isProcessing}
          hasData={!!imageSrc}
        />

        <div className="mb-4">
          {!imageSrc ? (
            <div onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-2xl border-2 border-dashed border-white/20 bg-white/5 cursor-pointer hover:bg-white/8 min-h-[220px] flex items-center justify-center transition-all">
              <div className="flex flex-col items-center gap-3 py-10">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center shadow-lg">
                  <UploadCloud className="w-7 h-7 text-white" />
                </div>
                <p className="text-white font-bold">ارفع صورة</p>
              </div>
            </div>
          ) : (
            <div className="relative w-full flex justify-center bg-black/40 rounded-2xl p-4 min-h-[300px]">
              <img ref={imgRef} src={imageSrc} onLoad={draw} className="hidden" />
              <canvas ref={canvasRef} className="max-w-full max-h-[50vh] object-contain rounded-xl shadow-2xl bg-[#0f0f17]" />
            </div>
          )}
          <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={e => { const f = e.target.files?.[0]; if (f) setImageSrc(URL.createObjectURL(f)); }} />
        </div>

        {imageSrc && (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-2xl p-4">
              <div className="flex flex-wrap gap-2 mb-4">
                {["الكل", ...CATEGORIES].map(cat => (
                  <button key={cat} onClick={() => setFilterCat(cat)}
                    className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-all", filterCat === cat ? "bg-amber-600 text-white shadow-lg" : "bg-white/10 text-white/50 hover:bg-white/15")}>
                    {cat}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {filteredFrames.map(frame => (
                  <button key={frame.id} onClick={() => setSelectedFrame(frame.id)}
                    className={cn("flex flex-col items-center gap-1 p-2 rounded-xl text-[10px] font-bold transition-all", selectedFrame === frame.id ? "bg-amber-500/20 border-2 border-amber-500 text-amber-300" : "bg-white/5 border-2 border-transparent text-white/50 hover:bg-white/10")}>
                    <span className="text-xl">{frame.emoji}</span>
                    <span className="text-center leading-tight truncate w-full">{frame.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {selectedFrame !== "none" && (
              <div className="bg-white/5 rounded-2xl p-4">
                <label className="flex justify-between text-xs font-bold text-white/50 mb-3">
                  <span>سُمك الإطار</span>
                  <span className="text-amber-400">{frameThickness}px</span>
                </label>
                <input type="range" min={10} max={120} value={frameThickness}
                  onChange={e => setFrameThickness(Number(e.target.value))}
                  className="w-full accent-amber-500" />
              </div>
            )}

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
