"use client";
import React, { useState, useRef, useEffect } from "react";
import { UploadCloud, Scissors, RotateCcw, Eraser, Brush, Wand2 } from "lucide-react";
import ToolHeader from "../components/ToolHeader";
import { processDownloadOrShare } from "../utils";

type Mode = "magic" | "erase" | "restore";

export default function RemoveBgPage() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [tolerance, setTolerance] = useState(30);
  const [brushSize, setBrushSize] = useState(40);
  const [mode, setMode] = useState<Mode>("magic");
  const [isDrawing, setIsDrawing] = useState(false);
  const [clicks, setClicks] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const drawInitialImage = () => {
    const img = imgRef.current; const canvas = canvasRef.current;
    if (!img || !canvas || !img.complete || !img.naturalWidth) return;
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    canvas.getContext("2d")!.drawImage(img, 0, 0);
    setClicks(0);
  };

  const getCoordinates = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX = e.clientX;
    let clientY = e.clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const paint = (e: any) => {
    const canvas = canvasRef.current; 
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d")!;
    
    const { x, y } = getCoordinates(e);
    
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);

    if (mode === "erase") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.fill();
      ctx.globalCompositeOperation = "source-over"; 
    } else if (mode === "restore") {
      ctx.save();
      ctx.clip();
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
  };

  const handlePointerDown = (e: any) => {
    if (mode === "magic") {
      const canvas = canvasRef.current; if (!canvas) return;
      const ctx = canvas.getContext("2d")!;
      const { x: rawX, y: rawY } = getCoordinates(e);
      const x = Math.floor(rawX);
      const y = Math.floor(rawY);
      
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      const idx = (y * canvas.width + x) * 4;
      const [tR, tG, tB, tA] = [data[idx], data[idx+1], data[idx+2], data[idx+3]];
      if (tA === 0) return;
      
      const stack = [[x, y]]; const W = canvas.width, H = canvas.height;
      const visited = new Uint8Array(W * H);
      
      while (stack.length > 0) {
        const [cx, cy] = stack.pop()!;
        if (cx < 0 || cx >= W || cy < 0 || cy >= H || visited[cy*W+cx]) continue;
        visited[cy*W+cx] = 1;
        const i = (cy * W + cx) * 4;
        const diff = Math.sqrt((data[i]-tR)**2 + (data[i+1]-tG)**2 + (data[i+2]-tB)**2);
        if ((diff / 441.67) * 100 <= tolerance) {
          data[i+3] = 0;
          stack.push([cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]);
        }
      }
      ctx.putImageData(imgData, 0, 0);
      setClicks(c => c + 1);
    } else {
      setIsDrawing(true);
      paint(e);
    }
  };

  const handlePointerMove = (e: any) => {
    if (isDrawing && mode !== "magic") {
      paint(e);
    }
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
  };

  useEffect(() => { if (imageSrc) setTimeout(drawInitialImage, 100); }, [imageSrc]);

  const handleAction = async (action: "share" | "download") => {
    if (!canvasRef.current) return;
    setIsProcessing(true);
    try { await processDownloadOrShare(canvasRef.current.toDataURL("image/png"), `nobg_${Date.now()}.png`, action); }
    finally { setIsProcessing(false); }
  };

  return (
    <div className="min-h-screen bg-[#0f0f17]" dir="rtl">
      <div className="p-4">
        <ToolHeader
          title="إزالة الخلفية (يدوي احترافي)"
          description="قص وتفريغ الصور بمرونة بدون انترنت"
          icon={<Scissors className="w-5 h-5 text-white/80" />}
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
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-fuchsia-600 to-rose-600 flex items-center justify-center shadow-lg">
                  <UploadCloud className="w-7 h-7 text-white" />
                </div>
                <p className="text-white font-bold">ارفع صورة</p>
                <p className="text-white/40 text-xs">لبدء عملية الإزالة</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Toolbar */}
              <div className="flex gap-2 p-2 bg-white/5 rounded-2xl">
                <button onClick={() => setMode("magic")} className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all ${mode === "magic" ? "bg-fuchsia-600 text-white shadow-lg" : "text-white/50 hover:bg-white/10"}`}>
                  <Wand2 className="w-5 h-5" />
                  <span className="text-[10px] font-bold">عصا سحرية</span>
                </button>
                <button onClick={() => setMode("erase")} className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all ${mode === "erase" ? "bg-fuchsia-600 text-white shadow-lg" : "text-white/50 hover:bg-white/10"}`}>
                  <Eraser className="w-5 h-5" />
                  <span className="text-[10px] font-bold">فرشاة المسح</span>
                </button>
                <button onClick={() => setMode("restore")} className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all ${mode === "restore" ? "bg-fuchsia-600 text-white shadow-lg" : "text-white/50 hover:bg-white/10"}`}>
                  <Brush className="w-5 h-5" />
                  <span className="text-[10px] font-bold">استعادة</span>
                </button>
              </div>

              {/* Checkered canvas */}
              <div
                className="w-full flex justify-center rounded-2xl overflow-hidden relative touch-none"
                style={{ background: "repeating-conic-gradient(#1a1a2e 0% 25%, #16213e 0% 50%) 0 0 / 20px 20px" }}
              >
                <img ref={imgRef} src={imageSrc} onLoad={drawInitialImage} className="hidden" />
                <canvas 
                  ref={canvasRef} 
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                  className={`max-w-full max-h-[50vh] ${mode === "magic" ? "cursor-crosshair" : "cursor-crosshair"}`} 
                />
              </div>
            </div>
          )}
          <input type="file" accept="image/*" className="hidden" ref={fileInputRef}
            onChange={e => { const f = e.target.files?.[0]; if (f) setImageSrc(URL.createObjectURL(f)); }} />
        </div>

        {imageSrc && (
          <div className="space-y-3">
            {/* Settings */}
            <div className="bg-white/5 rounded-2xl p-4">
              {mode === "magic" ? (
                <>
                  <label className="flex justify-between text-sm text-white/60 mb-3">
                    <span>قوة إزالة اللون</span>
                    <span className="text-fuchsia-400 font-bold">{tolerance}%</span>
                  </label>
                  <input type="range" min={1} max={100} value={tolerance}
                    onChange={e => setTolerance(Number(e.target.value))} className="w-full accent-fuchsia-500" />
                </>
              ) : (
                <>
                  <label className="flex justify-between text-sm text-white/60 mb-3">
                    <span>حجم الفرشاة</span>
                    <span className="text-fuchsia-400 font-bold">{brushSize}px</span>
                  </label>
                  <input type="range" min={10} max={150} value={brushSize}
                    onChange={e => setBrushSize(Number(e.target.value))} className="w-full accent-fuchsia-500" />
                </>
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={drawInitialImage}
                className="flex-1 py-3 bg-fuchsia-600/20 hover:bg-fuchsia-600/30 text-fuchsia-400 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all">
                <RotateCcw className="w-4 h-4" /> تراجع / إعادة
              </button>
              <button onClick={() => setImageSrc(null)}
                className="flex-1 py-3 bg-white/5 text-white/40 hover:text-white/60 rounded-2xl font-medium text-sm transition-all">
                تغيير الصورة
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
