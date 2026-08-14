"use client";
import React, { useState } from "react";
import { Tag, Loader2 } from "lucide-react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import toast from 'react-hot-toast';

export default function QuickEntryCategory({ onSuccess }: { onSuccess: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");

  const submitCategory = async () => {
    if (!name) {
      toast.error("يرجى تعبئة اسم التصنيف");
      return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db, "categories"), {
        name,
        createdAt: serverTimestamp()
      });
      toast.success("تم إضافة التصنيف بنجاح");
      onSuccess();
    } catch (e) {
      toast.error("فشل الإضافة");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">اسم التصنيف الجديد</label>
        <div className="relative">
          <Tag className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" value={name} onChange={e => setName(e.target.value)}
            className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 pr-10 text-sm focus:ring-2 focus:ring-pink-500 outline-none"
            placeholder="اسم التصنيف"
          />
        </div>
      </div>

      <button
        onClick={submitCategory} disabled={submitting}
        className="w-full bg-gradient-to-l from-indigo-600 to-indigo-800 text-white py-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 mt-4 shadow-lg active:scale-95 transition"
      >
        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "إضافة التصنيف"}
      </button>
    </div>
  );
}
