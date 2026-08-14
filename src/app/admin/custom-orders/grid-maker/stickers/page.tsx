"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { UploadCloud, Smile, Move } from "lucide-react";
import ToolHeader from "../components/ToolHeader";
import { processDownloadOrShare } from "../utils";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

type Sticker = { id: string; name: string; emoji: string; category: string; };

const STICKERS: Sticker[] = [
  { id: "🎂", name: "كيك عيد", emoji: "🎂", category: "كيك" }, { id: "🍰", name: "قطعة كيك", emoji: "🍰", category: "كيك" }, { id: "🧁", name: "كاب كيك", emoji: "🧁", category: "كيك" }, { id: "🍩", name: "دونت", emoji: "🍩", category: "كيك" }, { id: "🍫", name: "شوكولاتة", emoji: "🍫", category: "كيك" }, { id: "🍓", name: "فراولة", emoji: "🍓", category: "كيك" }, { id: "🍒", name: "كرز", emoji: "🍒", category: "كيك" }, { id: "🫐", name: "توت", emoji: "🫐", category: "كيك" }, { id: "🍋", name: "ليمون", emoji: "🍋", category: "كيك" }, { id: "🌹", name: "وردة", emoji: "🌹", category: "كيك" },
  { id: "🎉", name: "احتفال", emoji: "🎉", category: "مناسبات" }, { id: "🎊", name: "كونفتي", emoji: "🎊", category: "مناسبات" }, { id: "🎈", name: "بالون", emoji: "🎈", category: "مناسبات" }, { id: "🎁", name: "هدية", emoji: "🎁", category: "مناسبات" }, { id: "🥳", name: "فرح", emoji: "🥳", category: "مناسبات" }, { id: "💍", name: "خاتم", emoji: "💍", category: "مناسبات" }, { id: "💒", name: "زفاف", emoji: "💒", category: "مناسبات" }, { id: "🕯️", name: "شمعة", emoji: "🕯️", category: "مناسبات" }, { id: "🌟", name: "نجمة", emoji: "🌟", category: "مناسبات" }, { id: "⭐", name: "نجم", emoji: "⭐", category: "مناسبات" },
  { id: "❤️", name: "قلب أحمر", emoji: "❤️", category: "حب" }, { id: "💕", name: "قلبين", emoji: "💕", category: "حب" }, { id: "💖", name: "قلب لامع", emoji: "💖", category: "حب" }, { id: "💝", name: "قلب هدية", emoji: "💝", category: "حب" }, { id: "🥰", name: "عيون قلوب", emoji: "🥰", category: "حب" }, { id: "😍", name: "إعجاب", emoji: "😍", category: "حب" }, { id: "🌷", name: "زهرة", emoji: "🌷", category: "حب" }, { id: "🌺", name: "هيبيسكس", emoji: "🌺", category: "حب" },
  { id: "👑", name: "تاج ملكي", emoji: "👑", category: "فخامة" }, { id: "💎", name: "ماسة", emoji: "💎", category: "فخامة" }, { id: "✨", name: "بريق", emoji: "✨", category: "فخامة" }, { id: "💫", name: "دوامة نجمة", emoji: "💫", category: "فخامة" }, { id: "🌟", name: "نجمة مضيئة", emoji: "🌟", category: "فخامة" }, { id: "🦋", name: "فراشة", emoji: "🦋", category: "فخامة" },
  { id: "BEST", name: "الأفضل", emoji: "🏆", category: "نصوص" }, { id: "NEW", name: "جديد", emoji: "🆕", category: "نصوص" }, { id: "SALE", name: "تخفيض", emoji: "🏷️", category: "نصوص" },
];

type PlacedSticker = { id: string; sticker: Sticker; x: number; y: number; size: number; rotation: number; };
const CATEGORIES = ["الكل", ...Array.from(new Set(STICKERS.map(s => s.category)))];

export default function StickersPage() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [placed, setPlaced] = useState<PlacedSticker[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState("الكل");
  const [isProcessing, setIsProcessing] = useState(false);
  const [stickerSize, setStickerSize] = useState(60);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const draw = useCallback(() => {
    const img = imgRef.current; const canvas = canvasRef.current;
    if (!img || !canvas || !img.complete || !img.naturalWidth) return;
    const W = img.naturalWidth, H = img.naturalHeight;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, W, H);
    placed.forEach(ps => {
      ctx.save();
      ctx.translate(ps.x, ps.y);
      ctx.rotate((ps.rotation * Math.PI) / 180);
      ctx.font = `${ps.size}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ps.sticker.emoji, 0, 0);
      if (ps.id === selectedId) {
        ctx.strokeStyle = "#a855f7"; ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]);
        ctx.strokeRect(-ps.size/2 - 4, -ps.size/2 - 4, ps.size + 8, ps.size + 8);
        ctx.setLineDash([]);
      }
      ctx.restore();
    });
  }, [imageSrc, placed, selectedId]);

  useEffect(() => { if (imageSrc) draw(); }, [imageSrc, placed, selectedId, draw]);

  const addSticker = (sticker: Sticker) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const newSticker: PlacedSticker = { id: Date.now().toString(), sticker, x: canvas.width / 2, y: canvas.height / 2, size: Math.min(canvas.width, canvas.height) * (stickerSize / 200), rotation: 0 };
    setPlaced(p => [...p, newSticker]); setSelectedId(newSticker.id);
  };

  const selected = placed.find(p => p.id === selectedId);
  const updateSelected = (changes: Partial<PlacedSticker>) => setPlaced(p => p.map(s => s.id === selectedId ? { ...s, ...changes } : s));

  const handleAction = async (action: "share" | "download") => {
    const savedSel = selectedId; setSelectedId(null);
    await new Promise(r => setTimeout(r, 50));
    if (!canvasRef.current) return;
    setIsProcessing(true);
    try { await processDownloadOrShare(canvasRef.current.toDataURL("image/jpeg", 0.95), `stickers_${Date.now()}.jpg`, action); }
    finally { setIsProcessing(false); setSelectedId(savedSel); }
  };

  const filteredStickers = filterCat === "الكل" ? STICKERS : STICKERS.filter(s => s.category === filterCat);

  return (
    <div className="min-h-screen bg-[#0f0f17]" dir="rtl">
      <div className="p-4">
        <ToolHeader
          title="ملصقات على الصور"
          description="أضف ملصقات وإيموجي على صورتك"
          icon={<Smile className="w-5 h-5 text-white/80" />}
          onAction={handleAction}
          isProcessing={isProcessing}
          hasData={!!imageSrc}
        />

        <div className="mb-4">
          {!imageSrc ? (
            <div onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-2xl border-2 border-dashed border-white/20 bg-white/5 cursor-pointer hover:bg-white/8 min-h-[220px] flex items-center justify-center transition-all">
              <div className="flex flex-col items-center gap-3 py-10">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg">
                  <UploadCloud className="w-7 h-7 text-white" />
                </div>
                <p className="text-white font-bold">ارفع صورة</p>
              </div>
            </div>
          ) : (
            <div className="relative w-full flex justify-center bg-black/40 rounded-2xl p-4 min-h-[300px]">
              <img ref={imgRef} src={imageSrc} onLoad={draw} className="hidden" />
              <canvas ref={canvasRef} className="max-w-full max-h-[50vh] object-contain rounded-xl shadow-2xl bg-black cursor-crosshair"
                onClick={e => {
                  if (!canvasRef.current) return;
                  const rect = canvasRef.current.getBoundingClientRect();
                  const scaleX = canvasRef.current.width / rect.width;
                  const scaleY = canvasRef.current.height / rect.height;
                  const x = (e.clientX - rect.left) * scaleX;
                  const y = (e.clientY - rect.top) * scaleY;
                  const clicked = [...placed].reverse().find(ps => Math.abs(x - ps.x) < ps.size/2 + 10 && Math.abs(y - ps.y) < ps.size/2 + 10);
                  setSelectedId(clicked ? clicked.id : null);
                }} />
            </div>
          )}
          <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={e => { const f = e.target.files?.[0]; if (f) setImageSrc(URL.createObjectURL(f)); }} />
        </div>

        {imageSrc && (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-2xl p-4">
              <div className="flex flex-wrap gap-2 mb-4">
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setFilterCat(cat)}
                    className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-all", filterCat === cat ? "bg-pink-600 text-white shadow-lg" : "bg-white/10 text-white/50 hover:bg-white/15")}>
                    {cat}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-6 gap-2">
                {filteredStickers.map(sticker => (
                  <button key={sticker.id + sticker.name} onClick={() => addSticker(sticker)}
                    className="aspect-square flex items-center justify-center text-2xl bg-white/5 hover:bg-white/10 rounded-xl transition-all hover:scale-110">
                    {sticker.emoji}
                  </button>
                ))}
              </div>
              <div className="mt-4">
                <label className="flex justify-between text-xs text-white/50 mb-2 font-medium">
                  <span>حجم الملصق الافتراضي</span><span className="text-pink-400 font-bold">{stickerSize}</span>
                </label>
                <input type="range" min={20} max={150} value={stickerSize} onChange={e => setStickerSize(Number(e.target.value))} className="w-full accent-pink-500" />
              </div>
            </div>

            {selected && (
              <div className="bg-white/5 rounded-2xl p-4 space-y-4 border border-pink-500/20">
                <p className="text-[10px] font-bold text-pink-400 flex items-center gap-2 mb-2"><Move className="w-3 h-3" /> تحكم في الملصق المحدد</p>
                <div>
                  <label className="flex justify-between text-xs text-white/50 mb-2 font-medium">
                    <span>الحجم</span><span>{Math.round(selected.size)}px</span>
                  </label>
                  <input type="range" min={20} max={400} value={selected.size} onChange={e => updateSelected({ size: Number(e.target.value) })} className="w-full accent-pink-500" />
                </div>
                <div>
                  <label className="flex justify-between text-xs text-white/50 mb-2 font-medium">
                    <span>التدوير</span><span>{selected.rotation}°</span>
                  </label>
                  <input type="range" min={-180} max={180} value={selected.rotation} onChange={e => updateSelected({ rotation: Number(e.target.value) })} className="w-full accent-pink-500" />
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[{ label: "أعلى", dx: 0, dy: -20 }, { label: "أسفل", dx: 0, dy: 20 }, { label: "يمين", dx: 20, dy: 0 }, { label: "يسار", dx: -20, dy: 0 }].map(dir => (
                    <button key={dir.label} onClick={() => updateSelected({ x: selected.x + dir.dx, y: selected.y + dir.dy })} className="py-2 bg-white/10 hover:bg-white/15 rounded-lg text-[10px] font-bold text-white transition-all">{dir.label}</button>
                  ))}
                </div>
                <button onClick={() => { setPlaced(p => p.filter(s => s.id !== selectedId)); setSelectedId(null); }} className="w-full py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl font-bold text-xs transition-all">حذف الملصق</button>
              </div>
            )}

            {placed.length > 0 && (
              <div className="bg-white/5 rounded-2xl p-4">
                <p className="text-xs font-bold text-white/50 mb-3">الملصقات المضافة ({placed.length})</p>
                <div className="flex flex-wrap gap-2">
                  {placed.map(ps => (
                    <button key={ps.id} onClick={() => setSelectedId(ps.id)} className={cn("text-xl p-1.5 rounded-lg transition-all", ps.id === selectedId ? "bg-pink-500/20 ring-2 ring-pink-500" : "bg-white/5 hover:bg-white/10")}>{ps.sticker.emoji}</button>
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => { setImageSrc(null); setPlaced([]); setSelectedId(null); }}
              className="w-full py-3 bg-white/5 text-white/40 hover:text-white/60 rounded-2xl font-medium text-sm transition-all">
              تغيير الصورة
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
