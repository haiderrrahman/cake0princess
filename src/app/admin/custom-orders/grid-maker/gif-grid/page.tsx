"use client";
import React, { useState, useRef } from "react";
import { UploadCloud, LayoutGrid, RefreshCw } from "lucide-react";
import ToolHeader from "../components/ToolHeader";
import { processDownloadOrShare } from "../utils";
import { GifReader } from "omggif";

export default function GifGridPage() {
  const [gridDataUrl, setGridDataUrl] = useState<string | null>(null);
  const [cols, setCols] = useState(4);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processGif = async (file: File, columns: number) => {
    setIsProcessing(true); setGridDataUrl(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);
      const reader = new GifReader(buffer);
      const width = reader.width; const height = reader.height;
      const numFrames = reader.numFrames();
      const rows = Math.ceil(numFrames / columns);

      const gridCanvas = document.createElement('canvas');
      gridCanvas.width = width * columns; gridCanvas.height = height * rows;
      const gridCtx = gridCanvas.getContext('2d')!;
      
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width; tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext('2d')!;
      const imageData = tempCtx.createImageData(width, height);

      for (let i = 0; i < numFrames; i++) {
        reader.decodeAndBlitFrameRGBA(i, imageData.data);
        tempCtx.putImageData(imageData, 0, 0);
        const r = Math.floor(i / columns); const c = i % columns;
        gridCtx.drawImage(tempCanvas, c * width, r * height);
      }
      setGridDataUrl(gridCanvas.toDataURL("image/jpeg", 0.9));
    } catch (err) {
      console.error(err); alert("تعذر قراءة ملف الـ GIF. تأكد من أن الملف سليم.");
    } finally { setIsProcessing(false); }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) processGif(e.target.files[0], cols);
  };

  const handleAction = async (action: "share" | "download") => {
    if (!gridDataUrl) return;
    setIsProcessing(true);
    try { await processDownloadOrShare(gridDataUrl, `gif_grid_${Date.now()}.jpg`, action); }
    finally { setIsProcessing(false); }
  };

  return (
    <div className="min-h-screen bg-[#0f0f17]" dir="rtl">
      <div className="p-4">
        <ToolHeader
          title="شبكة GIF"
          description="تجميع لقطات الـ GIF في شبكة صور واحدة"
          icon={<LayoutGrid className="w-5 h-5 text-white/80" />}
          onAction={handleAction}
          isProcessing={isProcessing}
          hasData={!!gridDataUrl}
        />

        <div className="mb-4">
          {!gridDataUrl ? (
            <div onClick={() => !isProcessing && fileInputRef.current?.click()}
              className="w-full rounded-2xl border-2 border-dashed border-white/20 bg-white/5 cursor-pointer hover:bg-white/8 min-h-[220px] flex items-center justify-center transition-all">
              <div className="flex flex-col items-center gap-3 py-10">
                {isProcessing ? (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                      <RefreshCw className="w-7 h-7 text-white animate-spin" />
                    </div>
                    <p className="text-white font-bold">جاري المعالجة...</p>
                  </>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                      <UploadCloud className="w-7 h-7 text-white" />
                    </div>
                    <p className="text-white font-bold">ارفع صورة GIF</p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="relative w-full flex justify-center bg-black/40 rounded-2xl p-4 min-h-[300px]">
              <div className="bg-white/5 p-2 rounded-xl shadow-xl overflow-auto max-h-[50vh] border border-white/10">
                <img src={gridDataUrl} className="max-w-full h-auto block" />
              </div>
            </div>
          )}
          <input type="file" accept="image/gif" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
        </div>

        {gridDataUrl && (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-2xl p-4">
              <h2 className="text-white/50 text-xs font-bold mb-3">الأعمدة (الصور في السطر الواحد)</h2>
              <div className="grid grid-cols-4 gap-2">
                {[2, 3, 4, 5].map(num => (
                  <button key={num}
                    onClick={() => { setCols(num); const file = fileInputRef.current?.files?.[0]; if (file) processGif(file, num); }}
                    className={`py-3 text-sm font-bold rounded-xl transition-all ${
                      cols === num ? "bg-blue-600 text-white shadow-lg" : "bg-white/10 text-white/60 hover:bg-white/15"
                    }`}>
                    {num}
                  </button>
                ))}
              </div>
            </div>
            
            <button onClick={() => { setGridDataUrl(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
              className="w-full py-3 bg-white/5 text-white/40 hover:text-white/60 rounded-2xl font-medium text-sm transition-all">
              اختيار صورة أخرى
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
