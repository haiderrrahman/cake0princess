"use client";
import React, { useState, useRef, useCallback } from "react";
import { UploadCloud, Square } from "lucide-react";
import ToolHeader from "../components/ToolHeader";
import { processDownloadOrShare } from "../utils";
import Cropper from 'react-easy-crop';

export default function SquareImagePage() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageSrc(URL.createObjectURL(e.target.files[0]));
      setZoom(1); setCrop({ x: 0, y: 0 });
    }
  };

  const onCropComplete = useCallback((_: any, pixels: any) => setCroppedAreaPixels(pixels), []);

  const handleAction = async (action: "share" | "download") => {
    if (!imageSrc || !croppedAreaPixels) return;
    setIsProcessing(true);
    try {
      const image = new window.Image();
      image.src = imageSrc;
      await new Promise(r => image.onload = r);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      const size = croppedAreaPixels.width;
      canvas.width = size; canvas.height = size;
      ctx.imageSmoothingQuality = 'high';
      const scale = size / croppedAreaPixels.width;
      ctx.translate(-croppedAreaPixels.x * scale, -croppedAreaPixels.y * scale);
      ctx.drawImage(image, 0, 0, image.width * scale, image.height * scale);
      await processDownloadOrShare(canvas.toDataURL("image/jpeg", 0.95), `square_${Date.now()}.jpg`, action);
    } finally { setIsProcessing(false); }
  };

  return (
    <div className="min-h-screen bg-[#0f0f17]" dir="rtl">
      <div className="p-4">
        <ToolHeader
          title="صورة مربعة"
          description="قص الصورة بشكل مربع"
          icon={<Square className="w-5 h-5 text-white/80" />}
          onAction={handleAction}
          isProcessing={isProcessing}
          hasData={!!imageSrc}
        />

        <div className="mb-4">
          {!imageSrc ? (
            <div onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-2xl border-2 border-dashed border-white/20 bg-white/5 cursor-pointer hover:bg-white/8 min-h-[220px] flex items-center justify-center transition-all">
              <div className="flex flex-col items-center gap-3 py-10">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg">
                  <UploadCloud className="w-7 h-7 text-white" />
                </div>
                <p className="text-white font-bold">ارفع صورة</p>
              </div>
            </div>
          ) : (
            <div className="relative w-full h-[50vh] bg-black/50 rounded-2xl overflow-hidden shadow-2xl">
              <Cropper
                image={imageSrc}
                crop={crop} zoom={zoom} aspect={1}
                cropShape="rect" showGrid={true} minZoom={0.1}
                onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom}
              />
            </div>
          )}
          <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
        </div>

        {imageSrc && (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-2xl p-4">
              <label className="flex justify-between text-xs text-white/50 mb-3">
                <span>التقريب (Zoom)</span><span className="text-blue-400 font-bold">{Math.round(zoom * 100)}%</span>
              </label>
              <input type="range" value={zoom} min={0.1} max={3} step={0.1}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-blue-500" />
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
