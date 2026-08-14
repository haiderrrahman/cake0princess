"use client";

import React, { useState, useRef } from "react";
import imageCompression from "browser-image-compression";
import { Download, UploadCloud, Minimize2, RefreshCw, ChevronRight } from "lucide-react";
import Link from "next/link";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function FormatImagePage() {
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  
  const [compressedUrl, setCompressedUrl] = useState<string | null>(null);
  const [compressedFile, setCompressedFile] = useState<File | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Settings
  const [maxSizeMB, setMaxSizeMB] = useState(1);
  const [outputFormat, setOutputFormat] = useState<"jpeg" | "png" | "webp">("jpeg");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setOriginalFile(file);
      setOriginalUrl(URL.createObjectURL(file));
      setCompressedUrl(null);
      setCompressedFile(null);
    }
  };

  const handleProcess = async () => {
    if (!originalFile) return;
    setIsProcessing(true);
    
    try {
      const options = {
        maxSizeMB: maxSizeMB,
        maxWidthOrHeight: 2048,
        useWebWorker: true,
        fileType: `image/${outputFormat}`
      };
      
      const compressedBlob = await imageCompression(originalFile, options);
      const newFile = new File([compressedBlob], `compressed.${outputFormat}`, {
        type: `image/${outputFormat}`,
      });
      
      setCompressedFile(newFile);
      setCompressedUrl(URL.createObjectURL(newFile));
      
    } catch (error) {
      console.error("Error compressing image:", error);
      alert("حدث خطأ أثناء معالجة الصورة.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!compressedUrl || !compressedFile) return;
    const link = document.createElement("a");
    link.download = `optimized_${Date.now()}.${outputFormat}`;
    link.href = compressedUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8 dir-rtl" dir="rtl">
      
      {/* Dark Purple Gradient Header */}
      <header className="mb-8 bg-gradient-to-l from-[#1e1450] to-[#2d1c6d] rounded-[30px] p-6 shadow-xl relative overflow-hidden flex flex-col md:flex-row-reverse items-center justify-between gap-4">
        
        {/* Decorative background */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        
        <div className="flex items-center gap-4 z-10 w-full md:w-auto justify-end">
           <div className="text-right">
            <h1 className="text-2xl font-bold text-white flex items-center justify-end gap-2">
              ضغط وتحويل الصور
              <Minimize2 className="w-6 h-6 text-white/80" />
            </h1>
            <p className="text-white/70 mt-1 text-sm">تقليل حجم الصورة وتغيير صيغتها مع الحفاظ على جودتها</p>
          </div>
          <Link 
            href="/admin/custom-orders/grid-maker" 
            className="w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full flex shrink-0 items-center justify-center transition-all border border-white/20"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </Link>
        </div>
        
        <div className="z-10 w-full md:w-auto">
          {compressedUrl && (
            <button 
              onClick={handleDownload}
              className="w-full md:w-auto flex items-center justify-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white px-6 py-3 rounded-xl font-medium border border-white/30 transition-all active:scale-95"
            >
              <Download className="w-5 h-5" />
              <span>حفظ في الاستوديو</span>
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Sidebar Controls */}
        <aside className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold mb-4">خيارات التحويل</h2>
            
            <div className="space-y-6">
              
              {/* Output Format */}
              <div>
                <label className="text-sm font-medium text-slate-600 mb-2 block">الصيغة المطلوبة</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 outline-none focus:border-green-500"
                  value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value as any)}
                >
                  <option value="jpeg">JPG (أفضل للصور العادية)</option>
                  <option value="png">PNG (أفضل للشفافية)</option>
                  <option value="webp">WEBP (أفضل لسرعة المواقع)</option>
                </select>
              </div>

              {/* Max Size */}
              <div>
                <label className="text-sm font-medium text-slate-600 mb-2 flex justify-between">
                  <span>أقصى حجم (ميجابايت)</span>
                  <span className="font-bold">{maxSizeMB} MB</span>
                </label>
                <input
                  type="range" min="0.1" max="10" step="0.1" value={maxSizeMB}
                  onChange={(e) => setMaxSizeMB(parseFloat(e.target.value))}
                  className="w-full accent-green-600"
                />
              </div>

            </div>
            
            <button
              onClick={handleProcess}
              disabled={!originalFile || isProcessing}
              className="mt-8 w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold rounded-xl transition flex justify-center items-center gap-2"
            >
              {isProcessing && <RefreshCw className="w-4 h-4 animate-spin" />}
              {isProcessing ? "جاري المعالجة..." : "بدء الضغط والتحويل"}
            </button>

            {originalFile && (
              <button
                onClick={() => { setOriginalFile(null); setOriginalUrl(null); setCompressedUrl(null); }}
                className="mt-3 w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition"
              >
                اختيار صورة أخرى
              </button>
            )}
          </div>
        </aside>

        {/* Canvas Area */}
        <main className="flex-1 flex flex-col gap-6 items-center p-4 md:p-8">
          
          {!originalUrl ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full max-w-lg aspect-video border-2 border-dashed border-slate-300 rounded-3xl flex flex-col items-center justify-center bg-white cursor-pointer hover:bg-slate-50 transition"
            >
              <UploadCloud className="w-12 h-12 text-slate-400 mb-4" />
              <p className="text-slate-600 font-medium">اضغط لاختيار صورة للضغط/التحويل</p>
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
            </div>
          ) : (
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Original Image */}
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-bold text-slate-700">الصورة الأصلية</span>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-mono">
                    {formatBytes(originalFile?.size || 0)}
                  </span>
                </div>
                <div className="bg-slate-100 rounded-xl overflow-hidden aspect-video relative flex items-center justify-center">
                  <img src={originalUrl} alt="Original" className="max-w-full max-h-full object-contain" />
                </div>
              </div>

              {/* Compressed Image */}
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-green-100 ring-2 ring-green-500/10">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-bold text-green-700">النتيجة</span>
                  {compressedFile && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-md font-mono flex items-center gap-1">
                      {formatBytes(compressedFile.size)}
                      {/* Show savings percentage */}
                      <span className="text-[10px] opacity-70 ml-1">
                        ({Math.round(((originalFile!.size - compressedFile.size) / originalFile!.size) * 100)}% أقل)
                      </span>
                    </span>
                  )}
                </div>
                <div className="bg-slate-50 border border-dashed border-green-200 rounded-xl overflow-hidden aspect-video relative flex items-center justify-center">
                  {compressedUrl ? (
                    <img src={compressedUrl} alt="Compressed" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <span className="text-slate-400 text-sm">اضغط على زر المعالجة لبدء التحويل</span>
                  )}
                </div>
              </div>

            </div>
          )}
        </main>
      </div>

    </div>
  );
}
