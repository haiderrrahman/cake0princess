"use client";
import React, { useState, useRef, PointerEvent } from "react";
import { UploadCloud, Image as ImageIcon, Plus, Trash2, Move } from "lucide-react";
import ToolHeader from "../components/ToolHeader";
import { processDownloadOrShare } from "../utils";

type TextElement = {
  id: string;
  text: string;
  x: number; // percentage
  y: number; // percentage
  size: number;
  color: string;
  stroke: string;
};

export default function MemePage() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [texts, setTexts] = useState<TextElement[]>([]);
  const [activeTextId, setActiveTextId] = useState<string | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageSrc(URL.createObjectURL(e.target.files[0]));
      const newId = Date.now().toString();
      setTexts([{ id: newId, text: "نص جديد", x: 50, y: 15, size: 12, color: "#ffffff", stroke: "#000000" }]);
      setActiveTextId(newId);
    }
  };

  const addText = () => {
    const newId = Date.now().toString();
    const newText: TextElement = { id: newId, text: "نص جديد", x: 50, y: 50, size: 12, color: "#ffffff", stroke: "#000000" };
    setTexts([...texts, newText]);
    setActiveTextId(newId);
  };

  const removeText = (id: string) => {
    setTexts(texts.filter(t => t.id !== id));
    if (activeTextId === id) setActiveTextId(null);
  };

  const updateActiveText = (updates: Partial<TextElement>) => {
    setTexts(texts.map(t => t.id === activeTextId ? { ...t, ...updates } : t));
  };

  // Dragging logic
  const dragRef = useRef<{ id: string, startX: number, startY: number, initialX: number, initialY: number } | null>(null);

  const handlePointerDown = (e: PointerEvent, id: string) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const t = texts.find(x => x.id === id);
    if (!t) return;
    setActiveTextId(id);
    dragRef.current = { id, startX: e.clientX, startY: e.clientY, initialX: t.x, initialY: t.y };
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!dragRef.current || !containerRef.current) return;
    const { id, startX, startY, initialX, initialY } = dragRef.current;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = ((e.clientX - startX) / rect.width) * 100;
    const dy = ((e.clientY - startY) / rect.height) * 100;
    setTexts(texts.map(t => t.id === id ? { ...t, x: initialX + dx, y: initialY + dy } : t));
  };

  const handlePointerUp = (e: PointerEvent) => { 
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragRef.current = null; 
  };

  const handleAction = async (action: "share" | "download") => {
    const img = imgRef.current;
    if (!imageSrc || !img || !img.complete || !img.naturalWidth) return;
    setIsProcessing(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      texts.forEach(t => {
        if (!t.text.trim()) return;
        ctx.fillStyle = t.color;
        ctx.strokeStyle = t.stroke;
        ctx.lineWidth = Math.max(2, canvas.width * 0.005);
        const fontSize = Math.max(20, canvas.width * (t.size / 100));
        ctx.font = `900 ${fontSize}px Impact, 'Arial Black', sans-serif`;
        
        const px = (t.x / 100) * canvas.width;
        const py = (t.y / 100) * canvas.height;
        ctx.strokeText(t.text.toUpperCase(), px, py);
        ctx.fillText(t.text.toUpperCase(), px, py);
      });
      
      await processDownloadOrShare(canvas.toDataURL("image/jpeg", 0.95), `meme_${Date.now()}.jpg`, action);
    } finally { setIsProcessing(false); }
  };

  const active = texts.find(t => t.id === activeTextId);

  return (
    <div className="min-h-screen bg-[#0f0f17]" dir="rtl">
      <div className="p-4">
        <ToolHeader
          title="صانع الميمات"
          description="أضف نصوصاً حرة على صورتك واسحبها لأي مكان"
          icon={<ImageIcon className="w-5 h-5 text-white/80" />}
          onAction={handleAction}
          isProcessing={isProcessing}
          hasData={!!imageSrc}
        />

        {/* Upload / Preview */}
        <div className="mb-4">
          {!imageSrc ? (
            <div onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-2xl border-2 border-dashed border-white/20 bg-white/5 cursor-pointer hover:bg-white/8 min-h-[220px] flex items-center justify-center transition-all">
              <div className="flex flex-col items-center gap-3 py-10">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                  <UploadCloud className="w-7 h-7 text-white" />
                </div>
                <p className="text-white font-bold">ارفع الصورة</p>
              </div>
            </div>
          ) : (
            <div className="relative w-full flex justify-center bg-black/20 rounded-2xl p-2 overflow-hidden touch-none" ref={containerRef} onClick={() => setActiveTextId(null)}>
              <img ref={imgRef} src={imageSrc} className="max-w-full max-h-[50vh] object-contain shadow-2xl rounded-xl pointer-events-none" />
              
              {/* Draggable Texts overlay */}
              {texts.map(t => (
                <div 
                  key={t.id}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing hover:ring-2 ring-white/50 px-2 py-1 ${activeTextId === t.id ? 'ring-2 ring-amber-500 bg-black/20 rounded' : ''}`}
                  style={{ left: `${t.x}%`, top: `${t.y}%` }}
                  onPointerDown={(e) => handlePointerDown(e, t.id)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                >
                  <div
                    style={{
                      color: t.color,
                      fontSize: `${Math.max(16, t.size * 2)}px`,
                      fontWeight: 900,
                      fontFamily: "Impact, 'Arial Black', sans-serif",
                      textTransform: "uppercase",
                      whiteSpace: "nowrap",
                      WebkitTextStroke: `1px ${t.stroke}`,
                      textShadow: `1px 1px 0 ${t.stroke}, -1px -1px 0 ${t.stroke}, 1px -1px 0 ${t.stroke}, -1px 1px 0 ${t.stroke}`
                    }}
                  >
                    {t.text}
                  </div>
                  {activeTextId === t.id && (
                    <div className="absolute -top-3 -right-3 bg-rose-500 p-1 rounded-full cursor-pointer hover:scale-110 shadow-lg" onClick={(e) => { e.stopPropagation(); removeText(t.id); }}>
                      <Trash2 className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
        </div>

        {imageSrc && (
          <div className="space-y-4">
            <button onClick={addText}
              className="w-full py-3 bg-amber-600/20 hover:bg-amber-600/30 text-amber-500 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all">
              <Plus className="w-5 h-5" /> إضافة نص جديد
            </button>

            {active ? (
              <div className="bg-white/5 rounded-2xl p-4 space-y-4 border border-amber-500/30">
                <div className="flex items-center justify-between">
                  <span className="text-white font-bold text-sm">تعديل النص المحدد</span>
                  <Move className="w-4 h-4 text-white/40" />
                </div>
                
                <input type="text" value={active.text} onChange={e => updateActiveText({ text: e.target.value })}
                  placeholder="اكتب هنا..." dir="auto"
                  className="w-full bg-white/10 border border-white/10 text-white placeholder-white/30 rounded-xl px-4 py-3 outline-none focus:border-amber-500 font-bold transition-colors" />

                <div className="bg-white/5 rounded-xl p-3">
                  <label className="flex justify-between text-xs text-white/60 mb-2">
                    <span>حجم الخط</span><span className="text-amber-400 font-bold">{active.size}%</span>
                  </label>
                  <input type="range" min={4} max={50} value={active.size}
                    onChange={e => updateActiveText({ size: Number(e.target.value) })} className="w-full accent-amber-500" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-white/50 text-xs mb-2">لون النص</p>
                    <div className="h-10 rounded-lg overflow-hidden border border-white/10">
                      <input type="color" value={active.color} onChange={e => updateActiveText({ color: e.target.value })}
                        className="w-full h-full cursor-pointer scale-110 border-none" />
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-white/50 text-xs mb-2">لون الحدود</p>
                    <div className="h-10 rounded-lg overflow-hidden border border-white/10">
                      <input type="color" value={active.stroke} onChange={e => updateActiveText({ stroke: e.target.value })}
                        className="w-full h-full cursor-pointer scale-110 border-none" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center text-white/40 text-sm">
                اضغط على أي نص في الصورة لتعديله، أو اضف نصاً جديداً.
              </div>
            )}

            <button onClick={() => { setImageSrc(null); setTexts([]); setActiveTextId(null); }}
              className="w-full py-3 bg-white/5 text-white/40 hover:text-white/60 rounded-2xl font-medium text-sm transition-all">
              تغيير الصورة
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
