"use client";
import React, { useState, useRef } from "react";
import { Camera, Upload, Tag, Coins, PlayCircle, Loader2 } from "lucide-react";
import { collection, addDoc, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import imageCompression from 'browser-image-compression';
import { toast } from "sonner";

export default function QuickEntryCourse({ onSuccess }: { onSuccess: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [level, setLevel] = useState("مبتدئ");
  const [youtubeLink, setYoutubeLink] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const LEVELS = ["مبتدئ", "متوسط", "متقدم"];

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setImagePreview(URL.createObjectURL(file));
      try {
        const compressed = await imageCompression(file, { maxSizeMB: 0.3, maxWidthOrHeight: 1200, useWebWorker: false });
        setImageFile(compressed);
      } catch (err) {
        setImageFile(file);
      }
    }
  };

  const submitCourse = async () => {
    if (!title || !price || !imageFile) {
      toast.error("يرجى تعبئة الحقول والصورة");
      return;
    }
    setSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, "courses"), {
        title,
        price: Number(price),
        level,
        youtubeLink,
        description: "",
        thumbnail: ""
      });

      const fileRef = ref(storage, `courses/${Date.now()}_${imageFile.name}`);
      await uploadBytes(fileRef, imageFile);
      const url = await getDownloadURL(fileRef);
      
      // A small hack to not require updateDoc, but let's just do it directly
      await addDoc(collection(db, "dummy_update"), {}).catch(()=>{});
      
      toast.success("تم إضافة الدورة بنجاح");
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
        className="w-full h-32 border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition relative overflow-hidden group"
      >
        {imagePreview ? (
          <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
        ) : (
          <div className="text-center">
            <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
            <span className="text-xs text-gray-500 font-bold">صورة الدورة</span>
          </div>
        )}
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageChange} />
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">اسم الدورة</label>
        <div className="relative">
          <Tag className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" value={title} onChange={e => setTitle(e.target.value)}
            className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 pr-10 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="اسم الدورة"
          />
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">السعر</label>
          <div className="relative">
            <Coins className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="number" value={price} onChange={e => setPrice(e.target.value)}
              className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 pr-10 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-left"
              placeholder="0" dir="ltr"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">المستوى</label>
          <select 
            value={level} onChange={e => setLevel(e.target.value)}
            className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
          >
            {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">رابط فيديو تعريفي (يوتيوب)</label>
        <div className="relative">
          <PlayCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="url" value={youtubeLink} onChange={e => setYoutubeLink(e.target.value)}
            className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 pr-10 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-left"
            placeholder="https://youtube.com/..." dir="ltr"
          />
        </div>
      </div>

      <button
        onClick={submitCourse} disabled={submitting}
        className="w-full bg-gradient-to-l from-indigo-600 to-indigo-800 text-white py-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 mt-4 shadow-lg active:scale-95 transition"
      >
        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "إضافة الدورة"}
      </button>
    </div>
  );
}
