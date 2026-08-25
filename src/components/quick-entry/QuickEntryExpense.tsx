"use client";
import React, { useState } from "react";
import { Receipt, Loader2, Tag, Calendar, ShoppingBag } from "lucide-react";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import FormattedNumberInput from "@/components/FormattedNumberInput";
import { toast } from "sonner";

const EXPENSE_CATEGORIES = ["كهرباء / ماء", "أدوات ومعدات", "مواد خام وتغليف", "إعلانات وتسويق", "صيانة", "أخرى"];

export default function QuickEntryExpense({ onSuccess }: { onSuccess: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [expTitle, setExpTitle] = useState("");
  const [expCategory, setExpCategory] = useState("كهرباء / ماء");
  const [expAmount, setExpAmount] = useState("");
  const [expDate, setExpDate] = useState(new Date().toISOString().split("T")[0]);
  const [expNotes, setExpNotes] = useState("");

  const submitExpense = async () => {
    if (!expTitle || !expAmount || !expDate) {
      toast.error("يرجى تعبئة الحقول الأساسية");
      return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db, "expenses"), {
        title: expTitle, category: expCategory,
        amount: Number(expAmount.replace(/,/g, '')), date: expDate, notes: expNotes,
        createdAt: new Date()
      });
      toast.success("تم تسجيل المصروف بنجاح");
      onSuccess();
    } catch (e) {
      toast.error("فشل التسجيل");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">عنوان المصروف</label>
        <div className="relative">
          <Receipt className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" value={expTitle} onChange={e => setExpTitle(e.target.value)}
            className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 pr-10 text-sm focus:ring-2 focus:ring-pink-500 outline-none"
            placeholder="مثال: فاتورة كهرباء"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">التصنيف</label>
        <div className="relative">
          <Tag className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select 
            value={expCategory} onChange={e => setExpCategory(e.target.value)}
            className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 pr-10 text-sm focus:ring-2 focus:ring-pink-500 outline-none appearance-none"
          >
            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">المبلغ</label>
          <div className="relative">
            <ShoppingBag className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <FormattedNumberInput
              value={expAmount} onChange={setExpAmount} placeholder="المبلغ"
              className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 pr-10 text-sm focus:ring-2 focus:ring-pink-500 outline-none text-left"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">التاريخ</label>
          <div className="relative">
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="date" value={expDate} onChange={e => setExpDate(e.target.value)}
              className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 pr-10 text-sm focus:ring-2 focus:ring-pink-500 outline-none text-left"
            />
          </div>
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">ملاحظات (اختياري)</label>
        <textarea 
          value={expNotes} onChange={e => setExpNotes(e.target.value)} rows={3}
          className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-pink-500 outline-none resize-none"
          placeholder="أي تفاصيل إضافية..."
        />
      </div>
      <button
        onClick={submitExpense} disabled={submitting}
        className="w-full bg-gradient-to-l from-red-600 to-red-800 text-white py-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 mt-4 shadow-lg active:scale-95 transition"
      >
        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "تسجيل المصروف"}
      </button>
    </div>
  );
}
