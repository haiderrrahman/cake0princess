"use client";
import React, { useState, useRef } from "react";
import { UploadCloud, Crop } from "lucide-react";
import ToolHeader from "../components/ToolHeader";
import { processDownloadOrShare } from "../utils";
import ReactCrop, { type Crop as CropType, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number) {
  return centerCrop(makeAspectCrop({ unit: '%', width: 90 }, aspect, mediaWidth, mediaHeight), mediaWidth, mediaHeight);
}

export default function CropImagePage() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [crop, setCrop] = useState<CropType>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [aspect, setAspect] = useState<number | undefined>(undefined);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCrop(undefined);
      setImageSrc(URL.createObjectURL(e.target.files[0]));
    }
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (aspect) {
      const { width, height } = e.currentTarget;
      setCrop(centerAspectCrop(width, height, aspect));
    }
  };

  const handleRatio = (w: number, h: number) => {
    const ratio = w / h;
    setAspect(ratio);
    if (imgRef.current) {
      setCrop(centerAspectCrop(imgRef.current.width, imgRef.current.height, ratio));
    }
  };

  const handleAction = async (action: "share" | "download") => {
    if (!imageSrc || !imgRef.current || !completedCrop) {
      alert("يرجى تحديد جزء من الصورة للقص"); return;
    }
    setIsProcessing(true);
    try {
      const image = imgRef.current;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      canvas.width = Math.floor(completedCrop.width * scaleX);
      canvas.height = Math.floor(completedCrop.height * scaleY);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(
        image,
        completedCrop.x * scaleX, completedCrop.y * scaleY,
        completedCrop.width * scaleX, completedCrop.height * scaleY,
        0, 0, canvas.width, canvas.height
      );
      await processDownloadOrShare(canvas.toDataURL("image/jpeg", 1.0), `cropped_${Date.now()}.jpg`, action);
    } catch (e) {
      console.error(e); alert("حدث خطأ أثناء القص.");
    } finally { setIsProcessing(false); }
  };

  return (
    <div className="min-h-screen bg-[#0f0f17]" dir="rtl">
      <div className="p-4">
        <ToolHeader
          title="قص الصورة"
          description="اقتصاص جزء من الصورة"
          icon={<Crop className="w-5 h-5 text-white/80" />}
          onAction={handleAction}
          isProcessing={isProcessing}
          hasData={!!imageSrc}
        />

        <div
          onClick={() => !imageSrc && fileInputRef.current?.click()}
          className={`w-full rounded-2xl overflow-hidden mb-4 flex items-center justify-center ${
            !imageSrc ? "border-2 border-dashed border-white/20 bg-white/5 cursor-pointer hover:bg-white/8 min-h-[220px]" : ""
          }`}
        >
          {!imageSrc ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                <UploadCloud className="w-7 h-7 text-white" />
              </div>
              <p className="text-white font-bold">ارفع صورة</p>
            </div>
          ) : (
            <div className="w-full flex justify-center bg-black/40 py-2 rounded-xl">
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={aspect}
                className="max-h-[50vh]"
              >
                <img ref={imgRef} src={imageSrc} onLoad={onImageLoad} className="max-h-[50vh] object-contain rounded-lg" />
              </ReactCrop>
            </div>
          )}
          <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
        </div>

        {imageSrc && (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-2xl p-4">
              <p className="text-white/50 text-xs font-bold mb-3">نسبة القص</p>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { label: "حر", val: undefined },
                  { label: "1:1", val: 1 },
                  { label: "16:9", val: 16/9 },
                  { label: "9:16", val: 9/16 },
                  { label: "4:3", val: 4/3 },
                ].map(r => (
                  <button key={r.label} onClick={() => {
                    if (r.val) handleRatio(r.val > 1 ? r.val * 10 : r.val * 100, r.val > 1 ? 10 : 100);
                    else { setAspect(undefined); setCrop(undefined); }
                  }}
                    className={`py-3 text-[10px] font-bold rounded-xl transition-all ${
                      aspect === r.val ? "bg-emerald-500 text-white shadow-lg" : "bg-white/10 text-white/60 hover:bg-white/15"
                    }`}>
                    {r.label}
                  </button>
                ))}
              </div>
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
