"use client";
import React, { useState, useRef } from "react";
import { Upload, Tag, Link as LinkIcon, Loader2 } from "lucide-react";
import { collection, addDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import imageCompression from 'browser-image-compression';
import toast from 'react-hot-toast';

export default function QuickEntryBanner({ onSuccess }: { onSuccess: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setImagePreview(URL.createObjectURL(file));
      try {
        const compressed = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1600, useWebWorker: false });
        setImageFile(compressed);
      } catch (err) {
        setImageFile(file);
      }
    }
  };

  const submitBanner = async () => {
    if (!title || !imageFile) {
      toast.error("يرجى إضافة عنوان وصورة البنر");
      return;
    }
    setSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, "banners"), {
        title,
        link,
        tag: "جديد",
        image: ""
      });

      const fileRef = ref(storage, `banners/${Date.now()}_${imageFile.name}`);
      await uploadBytes(fileRef, imageFile);
      const url = await getDownloadURL(fileRef);
      
      await addDoc(collection(db, "dummy_update"), {}).catch(()=>{});
      
      toast.success("تم إضافة البنر بنجاح");
      onSuccess();
    } catch (e) {
      toast.error("فشل الإضافة");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div 
        onClick={() => fileInputRef.current?.click()}
        className="w-full h-40 border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition relative overflow-hidden group"
      >
        {imagePreview ? (
          <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
        ) : (
          <div className="text-center">
            <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
            <span className="text-xs text-gray-500 font-bold">صورة البنر (عرضية)</span>
          </div>
        )}
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageChange} />
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">عنوان البنر</label>
        <div className="relative">
          <Tag className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" value={title} onChange={e => setTitle(e.target.value)}
            className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 pr-10 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
            placeholder="مثال: خصم 20% بمناسبة العيد"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">الرابط عند الضغط (اختياري)</label>
        <div className="relative">
          <LinkIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="url" value={link} onChange={e => setLink(e.target.value)}
            className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 pr-10 text-sm focus:ring-2 focus:ring-teal-500 outline-none text-left"
            placeholder="https://..." dir="ltr"
          />
        </div>
      </div>

      <button
        onClick={submitBanner} disabled={submitting}
        className="w-full bg-gradient-to-l from-teal-600 to-teal-800 text-white py-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 mt-4 shadow-lg active:scale-95 transition"
      >
        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "إضافة البنر"}
      </button>
    </div>
  );
}
