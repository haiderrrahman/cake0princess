"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ImagePlus, ZoomIn, ZoomOut, LayoutGrid, Trash2, RotateCw,
  Minus, Plus, Palette, Maximize2, ChevronLeft, ChevronRight,
  Move, Layers, Frame, Sliders, RefreshCw, Copy
} from "lucide-react";
import ToolHeader from "../components/ToolHeader";
import { processDownloadOrShare } from "../utils";

type Layout = {
  id: string;
  name: string;
  emoji: string;
  gridTemplate: string;
  cells: { id: string; gridArea: string }[];
};

const LAYOUTS: Layout[] = [
  {
    id: "2-vertical", name: "مستطيلين عمودي", emoji: "◫",
    gridTemplate: `"a b" 1fr / 1fr 1fr`,
    cells: [ { id: "a", gridArea: "a" }, { id: "b", gridArea: "b" } ]
  },
  {
    id: "2-horizontal", name: "مستطيلين أفقي", emoji: "⬒",
    gridTemplate: `"a" 1fr "b" 1fr / 1fr`,
    cells: [ { id: "a", gridArea: "a" }, { id: "b", gridArea: "b" } ]
  },
  {
    id: "2x2", name: "مربع 2×2", emoji: "⊞",
    gridTemplate: `"a b" 1fr "c d" 1fr / 1fr 1fr`,
    cells: [
      { id: "a", gridArea: "a" }, { id: "b", gridArea: "b" },
      { id: "c", gridArea: "c" }, { id: "d", gridArea: "d" },
    ]
  },
  {
    id: "top-main", name: "رئيسي أعلى", emoji: "▣",
    gridTemplate: `"a a" 2fr "b c" 1fr / 1fr 1fr`,
    cells: [ { id: "a", gridArea: "a" }, { id: "b", gridArea: "b" }, { id: "c", gridArea: "c" } ]
  },
  {
    id: "top-2-bottom-1", name: "2 أعلى و 1 أسفل", emoji: "◩",
    gridTemplate: `"a b" 1fr "c c" 2fr / 1fr 1fr`,
    cells: [ { id: "a", gridArea: "a" }, { id: "b", gridArea: "b" }, { id: "c", gridArea: "c" } ]
  },
  {
    id: "right-main", name: "رئيسي يمين", emoji: "▨",
    gridTemplate: `"b a" 1fr "c a" 1fr / 1fr 2fr`,
    cells: [ { id: "a", gridArea: "a" }, { id: "b", gridArea: "b" }, { id: "c", gridArea: "c" } ]
  },
  {
    id: "left-main", name: "رئيسي يسار", emoji: "▧",
    gridTemplate: `"a b" 1fr "a c" 1fr / 2fr 1fr`,
    cells: [ { id: "a", gridArea: "a" }, { id: "b", gridArea: "b" }, { id: "c", gridArea: "c" } ]
  },
  {
    id: "3x1", name: "ثلاث أفقي", emoji: "☰",
    gridTemplate: `"a" 1fr "b" 1fr "c" 1fr / 1fr`,
    cells: [ { id: "a", gridArea: "a" }, { id: "b", gridArea: "b" }, { id: "c", gridArea: "c" } ]
  },
  {
    id: "1x3", name: "ثلاث عمودي", emoji: "☷",
    gridTemplate: `"a b c" 1fr / 1fr 1fr 1fr`,
    cells: [ { id: "a", gridArea: "a" }, { id: "b", gridArea: "b" }, { id: "c", gridArea: "c" } ]
  },
  {
    id: "4x1", name: "أربع أفقي", emoji: "𝄘",
    gridTemplate: `"a" 1fr "b" 1fr "c" 1fr "d" 1fr / 1fr`,
    cells: [ { id: "a", gridArea: "a" }, { id: "b", gridArea: "b" }, { id: "c", gridArea: "c" }, { id: "d", gridArea: "d" } ]
  },
  {
    id: "1x4", name: "أربع عمودي", emoji: "𝄙",
    gridTemplate: `"a b c d" 1fr / 1fr 1fr 1fr 1fr`,
    cells: [ { id: "a", gridArea: "a" }, { id: "b", gridArea: "b" }, { id: "c", gridArea: "c" }, { id: "d", gridArea: "d" } ]
  },
  {
    id: "3x3", name: "شبكة 3×3", emoji: "▦",
    gridTemplate: `"a b c" 1fr "d e f" 1fr "g h i" 1fr / 1fr 1fr 1fr`,
    cells: "abcdefghi".split("").map(id => ({ id, gridArea: id }))
  },
  {
    id: "big-4small", name: "كبير + 4 صغار", emoji: "▤",
    gridTemplate: `"a a b" 1fr "a a c" 1fr "d e f" 1fr / 1fr 1fr 1fr`,
    cells: "abcdef".split("").map(id => ({ id, gridArea: id }))
  },
  {
    id: "center-focus", name: "مركز رئيسي", emoji: "◘",
    gridTemplate: `"a b c" 1fr "d e f" 2fr "g h i" 1fr / 1fr 2fr 1fr`,
    cells: "abcdefghi".split("").map(id => ({ id, gridArea: id }))
  },
  {
    id: "4x4", name: "شبكة 4×4", emoji: "▦",
    gridTemplate: `"a b c d" 1fr "e f g h" 1fr "i j k l" 1fr "m n o p" 1fr / 1fr 1fr 1fr 1fr`,
    cells: "abcdefghijklmnop".split("").map(id => ({ id, gridArea: id }))
  },
];

type CellData = {
  file: File | null;
  url: string | null;
  scale: number;
  x: number;
  y: number;
  rotation: number;
  flipH: boolean;
};

const defaultCell = (id: string): CellData => ({ file: null, url: null, scale: 1, x: 0, y: 0, rotation: 0, flipH: false });

export default function CollagePage() {
  const [activeLayout, setActiveLayout] = useState<Layout>(LAYOUTS[0]);
  const [cellsData, setCellsData] = useState<Record<string, CellData>>({});
  const [activeCellId, setActiveCellId] = useState<string | null>(null);
  const [gap, setGap] = useState(6);
  const [borderColor, setBorderColor] = useState("#ffffff");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [paperRatio, setPaperRatio] = useState<"1:1" | "4:3" | "3:4" | "16:9" | "9:16" | "A4">("1:1");
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<"layout" | "style" | "adjust">("layout");
  const [cornerRadius, setCornerRadius] = useState(0);
  const [padding, setPadding] = useState(8);
  const [shadow, setShadow] = useState(false);

  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const newCells: Record<string, CellData> = {};
    activeLayout.cells.forEach(c => {
      newCells[c.id] = cellsData[c.id] || defaultCell(c.id);
    });
    setCellsData(newCells);
    setActiveCellId(null);
  }, [activeLayout]);

  const updateCell = (id: string, updates: Partial<CellData>) => {
    setCellsData(p => ({ ...p, [id]: { ...p[id], ...updates } }));
  };

  const getAspect = () => {
    if (paperRatio === "A4") return "aspect-[1/1.414]";
    if (paperRatio === "4:3") return "aspect-[4/3]";
    if (paperRatio === "3:4") return "aspect-[3/4]";
    if (paperRatio === "16:9") return "aspect-video";
    if (paperRatio === "9:16") return "aspect-[9/16]";
    return "aspect-square";
  };

  const handleExport = async (action: "download" | "share") => {
    try {
      setIsExporting(true);
      setActiveCellId(null);
      await new Promise(r => setTimeout(r, 150));

      const base = 2000;
      let w = base, h = base;
      if (paperRatio === "A4") h = Math.round(base * 1.414);
      else if (paperRatio === "4:3") h = Math.round(base * 0.75);
      else if (paperRatio === "3:4") h = Math.round(base * 1.333);
      else if (paperRatio === "16:9") h = Math.round(base * 0.5625);
      else if (paperRatio === "9:16") h = Math.round(base * 1.778);

      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);

      // Use the DOM grid to figure out positions
      const gridEl = gridRef.current;
      if (!gridEl) return;
      const gridRect = gridEl.getBoundingClientRect();
      const scaleX = w / gridRect.width;
      const scaleY = h / gridRect.height;

      for (const cell of activeLayout.cells) {
        const cellEl = gridEl.querySelector(`[data-cell="${cell.id}"]`) as HTMLElement;
        if (!cellEl) continue;
        const cellRect = cellEl.getBoundingClientRect();
        const cx = (cellRect.left - gridRect.left) * scaleX;
        const cy = (cellRect.top - gridRect.top) * scaleY;
        const cw = cellRect.width * scaleX;
        const ch = cellRect.height * scaleY;

        // Draw cell background
        ctx.fillStyle = "#ffffff10";
        ctx.fillRect(cx, cy, cw, ch);

        const data = cellsData[cell.id];
        if (data?.url) {
          await new Promise<void>(res => {
            const img = new window.Image();
            img.onload = () => {
              ctx.save();
              ctx.beginPath();
              if (cornerRadius > 0) {
                const r = cornerRadius * scaleX;
                ctx.moveTo(cx + r, cy);
                ctx.lineTo(cx + cw - r, cy); ctx.arcTo(cx + cw, cy, cx + cw, cy + r, r);
                ctx.lineTo(cx + cw, cy + ch - r); ctx.arcTo(cx + cw, cy + ch, cx + cw - r, cy + ch, r);
                ctx.lineTo(cx + r, cy + ch); ctx.arcTo(cx, cy + ch, cx, cy + ch - r, r);
                ctx.lineTo(cx, cy + r); ctx.arcTo(cx, cy, cx + r, cy, r);
              } else {
                ctx.rect(cx, cy, cw, ch);
              }
              ctx.clip();

              const rI = img.width / img.height;
              const rB = cw / ch;
              let dw = cw, dh = ch;
              if (rI > rB) {
                dw = cw;
                dh = cw / rI;
              } else {
                dh = ch;
                dw = ch * rI;
              }

              ctx.translate(cx + cw / 2 + data.x * scaleX, cy + ch / 2 + data.y * scaleY);
              ctx.rotate((data.rotation * Math.PI) / 180);
              ctx.scale(data.scale * (data.flipH ? -1 : 1), data.scale);
              ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
              ctx.restore();
              res();
            };
            img.onerror = () => res();
            img.src = data.url!;
          });
        }

        // Draw cell border (gap lines) if gap > 0
        if (gap > 0) {
          ctx.strokeStyle = bgColor;
          ctx.lineWidth = gap * scaleX;
          ctx.strokeRect(cx, cy, cw, ch);
        }
      }

      await processDownloadOrShare(canvas.toDataURL("image/jpeg", 0.96), `collage_${Date.now()}.jpg`, action);
    } finally {
      setIsExporting(false);
    }
  };

  const hasData = Object.values(cellsData).some(c => c.url !== null);
  const activeCell = activeCellId ? cellsData[activeCellId] : null;

  return (
    <div className="min-h-screen bg-[#0f0f17]" dir="rtl">
      <div className="p-4">
        <ToolHeader
          title="كولاج الصور الاحترافي"
          description="دمج عدة صور في تصميم واحد رائع"
          icon={<Layers className="w-5 h-5 text-white/80" />}
          onAction={handleExport}
          isProcessing={isExporting}
          hasData={hasData}
        />

        {/* Preview Area */}
        <div className="mb-4 bg-[#0a0a14] rounded-3xl p-3 border border-white/10">
          <div className="w-full flex justify-center">
            <div className={`w-full max-w-[380px] ${getAspect()} relative`} onClick={() => setActiveCellId(null)}>
              <div
                ref={gridRef}
                className="absolute inset-0 overflow-hidden"
                style={{
                  backgroundColor: bgColor,
                  padding: `${padding}px`,
                  display: "grid",
                  gridTemplate: activeLayout.gridTemplate,
                  gap: `${gap}px`,
                }}
              >
                {activeLayout.cells.map(cell => {
                  const data = cellsData[cell.id] || defaultCell(cell.id);
                  const isActive = activeCellId === cell.id;
                  return (
                    <CellSlot
                      key={cell.id}
                      cell={cell}
                      data={data}
                      isActive={isActive}
                      cornerRadius={cornerRadius}
                      onActivate={() => { setActiveCellId(cell.id); setActiveTab("adjust"); }}
                      onImageChange={f => {
                        const r = new FileReader();
                        r.onload = e => {
                          updateCell(cell.id, { file: f, url: e.target?.result as string, scale: 1, x: 0, y: 0, rotation: 0, flipH: false });
                          setActiveCellId(cell.id);
                          setActiveTab("adjust");
                        };
                        r.readAsDataURL(f);
                      }}
                      onTransform={(updates) => updateCell(cell.id, updates)}
                      onRemove={() => updateCell(cell.id, { file: null, url: null, scale: 1, x: 0, y: 0 })}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Active Cell Controls (if selected with image) */}
        {activeCellId && activeCell?.url && (
          <div className="mb-3 bg-indigo-900/40 border border-indigo-500/30 rounded-2xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-indigo-300 text-xs font-black flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" /> تعديل الخلية المحددة
              </span>
              <button onClick={() => setActiveCellId(null)} className="text-white/40 text-xs font-bold">✕ إلغاء التحديد</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-white/50 font-black flex justify-between mb-1">
                  <span>التكبير</span><span className="text-indigo-300">{activeCell.scale.toFixed(2)}x</span>
                </label>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateCell(activeCellId, { scale: Math.max(0.2, activeCell.scale - 0.1) })} className="p-1.5 bg-white/10 rounded-lg text-white hover:bg-white/20"><ZoomOut className="w-3.5 h-3.5" /></button>
                  <input type="range" min={0.2} max={5} step={0.05} value={activeCell.scale}
                    onChange={e => updateCell(activeCellId, { scale: parseFloat(e.target.value) })}
                    className="flex-1 accent-indigo-500 h-2 rounded-full appearance-none" />
                  <button onClick={() => updateCell(activeCellId, { scale: Math.min(5, activeCell.scale + 0.1) })} className="p-1.5 bg-white/10 rounded-lg text-white hover:bg-white/20"><ZoomIn className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => updateCell(activeCellId, { scale: 1, x: 0, y: 0, rotation: 0, flipH: false })}
                  className="py-2 bg-white/8 text-white/60 rounded-xl text-[10px] font-black flex items-center justify-center gap-1 border border-white/10 hover:bg-white/15">
                  <RefreshCw className="w-3 h-3" /> إعادة ضبط
                </button>
                <button onClick={() => updateCell(activeCellId, { rotation: ((activeCell.rotation || 0) + 90) % 360 })}
                  className="py-2 bg-white/8 text-white/60 rounded-xl text-[10px] font-black flex items-center justify-center gap-1 border border-white/10 hover:bg-white/15">
                  <RotateCw className="w-3 h-3" /> تدوير
                </button>
                <button onClick={() => updateCell(activeCellId, { flipH: !activeCell.flipH })}
                  className={`py-2 rounded-xl text-[10px] font-black flex items-center justify-center gap-1 border transition-all ${activeCell.flipH ? "bg-indigo-600 text-white border-indigo-500" : "bg-white/8 text-white/60 border-white/10 hover:bg-white/15"}`}>
                  ↔ قلب
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Controls Tabs */}
        <div className="bg-black/30 rounded-2xl p-1 mb-3 flex gap-1">
          {[
            { id: "layout", label: "القوالب", icon: LayoutGrid },
            { id: "style", label: "الشكل والأبعاد", icon: Palette },
          ].map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id as any)}
                className={`flex-1 py-2.5 text-[10px] font-black rounded-xl flex items-center justify-center gap-1.5 transition-all ${activeTab === t.id ? "bg-indigo-600 text-white shadow-lg" : "text-white/40 hover:text-white/70 hover:bg-white/5"}`}>
                <Icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            );
          })}
        </div>

        {activeTab === "layout" && (
          <div className="bg-white/5 rounded-3xl p-4 border border-white/10">
            <h2 className="text-white/50 text-xs font-black mb-3">اختر قالب الكولاج</h2>
            <div className="grid grid-cols-3 gap-2">
              {LAYOUTS.map(l => (
                <button key={l.id} onClick={() => setActiveLayout(l)}
                  className={`flex flex-col items-center gap-2 p-2.5 rounded-2xl border transition-all ${activeLayout.id === l.id ? "border-indigo-500 bg-indigo-500/15 text-indigo-300" : "border-white/10 text-white/50 hover:bg-white/5"}`}>
                  <div className="w-full aspect-square relative overflow-hidden rounded-xl bg-white/5"
                    style={{ display: "grid", gridTemplate: l.gridTemplate, gap: "2px", padding: "3px" }}>
                    {l.cells.map(c => (
                      <div key={c.id} className={`rounded-[2px] ${activeLayout.id === l.id ? "bg-indigo-400/60" : "bg-white/40"}`} style={{ gridArea: c.gridArea }} />
                    ))}
                  </div>
                  <span className="text-[9px] font-black text-center leading-tight">{l.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === "style" && (
          <div className="bg-white/5 rounded-3xl p-4 border border-white/10 space-y-5">
            {/* Gap */}
            <div>
              <label className="flex justify-between text-[11px] text-white/60 font-black mb-2">
                <span>المسافة بين الصور (الخطوط)</span>
                <span className="text-indigo-300">{gap}px</span>
              </label>
              <input type="range" min={0} max={40} value={gap} onChange={e => setGap(parseInt(e.target.value))}
                className="w-full accent-indigo-500 h-2 rounded-full appearance-none"
                style={{ background: `linear-gradient(to left, rgb(99 102 241) 0%, rgb(99 102 241) ${(gap / 40) * 100}%, rgba(255,255,255,0.1) ${(gap / 40) * 100}%, rgba(255,255,255,0.1) 100%)` }}
              />
              <div className="flex justify-between text-[9px] text-white/30 mt-1 font-bold">
                <span>بدون فراغ</span><span>متوسط</span><span>فراغ كبير</span>
              </div>
            </div>

            {/* Padding */}
            <div>
              <label className="flex justify-between text-[11px] text-white/60 font-black mb-2">
                <span>هامش خارجي</span>
                <span className="text-indigo-300">{padding}px</span>
              </label>
              <input type="range" min={0} max={60} value={padding} onChange={e => setPadding(parseInt(e.target.value))}
                className="w-full accent-indigo-500 h-2 rounded-full appearance-none"
                style={{ background: `linear-gradient(to left, rgb(99 102 241) 0%, rgb(99 102 241) ${(padding / 60) * 100}%, rgba(255,255,255,0.1) ${(padding / 60) * 100}%, rgba(255,255,255,0.1) 100%)` }}
              />
            </div>

            {/* Corner Radius */}
            <div>
              <label className="flex justify-between text-[11px] text-white/60 font-black mb-2">
                <span>استدارة الزوايا</span>
                <span className="text-indigo-300">{cornerRadius}px</span>
              </label>
              <input type="range" min={0} max={40} value={cornerRadius} onChange={e => setCornerRadius(parseInt(e.target.value))}
                className="w-full accent-indigo-500 h-2 rounded-full appearance-none"
                style={{ background: `linear-gradient(to left, rgb(99 102 241) 0%, rgb(99 102 241) ${(cornerRadius / 40) * 100}%, rgba(255,255,255,0.1) ${(cornerRadius / 40) * 100}%, rgba(255,255,255,0.1) 100%)` }}
              />
            </div>

            {/* Paper Ratio */}
            <div>
              <label className="text-[11px] text-white/60 font-black mb-2 block">نسبة الأبعاد</label>
              <div className="grid grid-cols-3 gap-2">
                {(["1:1", "4:3", "3:4", "16:9", "9:16", "A4"] as const).map(r => (
                  <button key={r} onClick={() => setPaperRatio(r)}
                    className={`py-2 rounded-xl text-[10px] font-black transition-all ${paperRatio === r ? "bg-indigo-600 text-white" : "bg-white/8 text-white/50 border border-white/10 hover:bg-white/15"}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Background Color */}
            <div>
              <label className="text-[11px] text-white/60 font-black mb-2 block">لون الخلفية (لون الخطوط)</label>
              <div className="flex gap-2 flex-wrap">
                {["#ffffff", "#000000", "#1a1a2e", "#2d1b69", "#0f3460", "#533483", "#d4a017", "#1b1b2f"].map(c => (
                  <button key={c} onClick={() => setBgColor(c)}
                    className={`w-9 h-9 rounded-full border-2 transition-transform ${bgColor === c ? "border-indigo-400 scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }} />
                ))}
                <div className="relative w-9 h-9 rounded-full overflow-hidden border border-white/20">
                  <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} className="absolute -top-2 -left-2 w-14 h-14 cursor-pointer" />
                </div>
              </div>
              <p className="text-[9px] text-white/30 mt-1 font-bold">لون الخلفية هو نفسه لون الفواصل بين الصور</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CellSlot({ cell, data, isActive, cornerRadius, onActivate, onImageChange, onTransform, onRemove }: {
  cell: { id: string; gridArea: string };
  data: CellData;
  isActive: boolean;
  cornerRadius: number;
  onActivate: () => void;
  onImageChange: (f: File) => void;
  onTransform: (updates: Partial<CellData>) => void;
  onRemove: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Pan and Zoom state for interaction
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const touchDistance = useRef<number | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!data.url) return;
    e.stopPropagation();
    onActivate();
    if (e.pointerType === "touch") return; // Handled by touch events
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") return; // Handled by touch events
    if (!isDragging.current) return;
    e.stopPropagation();
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    onTransform({ x: data.x + dx, y: data.y + dy });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") return;
    isDragging.current = false;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  };

  const handleWheel = (e: WheelEvent) => {
    if (!isActive) return;
    e.preventDefault();
    e.stopPropagation();
    const zoomFactor = -e.deltaY * 0.002;
    const newScale = Math.min(Math.max(0.2, data.scale + zoomFactor), 5);
    onTransform({ scale: newScale });
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !isActive) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [isActive, data.scale, onTransform]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!data.url) return;
    e.stopPropagation();
    onActivate();
    
    if (e.touches.length === 1) {
      isDragging.current = true;
      lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      isDragging.current = false; // Cancel pan if pinch starts
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchDistance.current = Math.hypot(dx, dy);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!data.url) return;
    e.stopPropagation();

    if (e.touches.length === 1 && isDragging.current) {
      const dx = e.touches[0].clientX - lastPos.current.x;
      const dy = e.touches[0].clientY - lastPos.current.y;
      lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      onTransform({ x: data.x + dx, y: data.y + dy });
    } else if (e.touches.length === 2 && touchDistance.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const delta = dist - touchDistance.current;
      touchDistance.current = dist;
      
      const newScale = Math.min(Math.max(0.2, data.scale + delta * 0.01), 5);
      onTransform({ scale: newScale });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) touchDistance.current = null;
    if (e.touches.length === 0) isDragging.current = false;
  };

  return (
    <div
      ref={containerRef}
      data-cell={cell.id}
      className={`relative overflow-hidden transition-all duration-200 ${isActive ? "ring-2 ring-indigo-400 ring-offset-1 ring-offset-transparent z-10" : ""}`}
      style={{ gridArea: cell.gridArea, borderRadius: cornerRadius > 0 ? `${cornerRadius}px` : undefined }}
      onClick={e => { e.stopPropagation(); onActivate(); }}
    >
      {!data.url ? (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors border-2 border-dashed border-white/20"
          style={{ backgroundColor: "rgba(30, 41, 59, 0.6)" }}
          onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
        >
          <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center shadow-inner">
            <ImagePlus className="w-5 h-5 text-indigo-200" />
          </div>
          <span className="text-[10px] font-black text-white/60 tracking-wide">إضافة صورة</span>
          <input type="file" accept="image/*" className="hidden" ref={fileRef} onChange={e => { if (e.target.files?.[0]) onImageChange(e.target.files[0]); }} />
        </div>
      ) : (
        <>
          <div className="absolute inset-0 w-full h-full flex items-center justify-center">
            <motion.img
              src={data.url}
              className="w-full h-full object-contain select-none touch-none"
              style={{
                x: data.x,
                y: data.y,
                rotate: data.rotation || 0,
                scaleX: data.flipH ? -data.scale : data.scale,
                scaleY: data.scale,
                cursor: "move",
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              draggable={false}
            />
          </div>
          {isActive && (
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/70 backdrop-blur-md rounded-full px-2 py-1 z-20 shadow-xl border border-white/10">
              <button onClick={e => { e.stopPropagation(); onTransform({ scale: Math.max(0.2, data.scale - 0.15) }); }} className="p-1 text-white hover:bg-white/20 rounded-full transition-colors"><ZoomOut className="w-3 h-3" /></button>
              <span className="text-[8px] text-white/60 font-bold px-1">{data.scale.toFixed(1)}x</span>
              <button onClick={e => { e.stopPropagation(); onTransform({ scale: Math.min(5, data.scale + 0.15) }); }} className="p-1 text-white hover:bg-white/20 rounded-full transition-colors"><ZoomIn className="w-3 h-3" /></button>
              <div className="w-px h-3 bg-white/20 mx-0.5" />
              <button onClick={e => { e.stopPropagation(); fileRef.current?.click(); }} className="p-1 text-blue-300 hover:bg-white/20 rounded-full transition-colors"><ImagePlus className="w-3 h-3" /></button>
              <button onClick={e => { e.stopPropagation(); onRemove(); }} className="p-1 text-red-400 hover:bg-white/20 rounded-full transition-colors"><Trash2 className="w-3 h-3" /></button>
            </div>
          )}
          <input type="file" accept="image/*" className="hidden" ref={fileRef} onChange={e => { if (e.target.files?.[0]) onImageChange(e.target.files[0]); }} />
        </>
      )}
    </div>
  );
}
