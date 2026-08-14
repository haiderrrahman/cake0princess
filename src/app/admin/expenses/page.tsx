"use client";
import { customConfirm } from '@/lib/customConfirm';
import toast from 'react-hot-toast';
import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Search, Plus, Loader2, Trash2, Calendar, Receipt, DollarSign, Tag } from "lucide-react";
import { collection, addDoc, deleteDoc, doc, serverTimestamp, orderBy, query, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import FormattedNumberInput from "@/components/FormattedNumberInput";

export default function ExpensesAdmin() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("كهرباء / ماء");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [paidBy, setPaidBy] = useState<'haider' | 'cake' | ''>('');
  
  useEffect(() => {
    // Real-time sync — تحديث فوري عند أي تغيير في المصاريف
    const q = query(collection(db, "expenses"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error("Expenses snapshot error:", err);
      setLoading(false);
    });

    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    setDate(today);

    return () => unsub();
  }, []);

  const parseIqdInput = (val: string | number) => {
    let num = Number(val) || 0;
    if (num > 0 && num < 1000) num *= 1000;
    return num;
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !amount || !date) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, "expenses"), {
        title,
        category,
        amount: parseIqdInput(amount),
        date,
        notes,
        ...(paidBy ? { paidBy } : {}),
        createdAt: serverTimestamp(),
      });

      // Reset form
      setTitle("");
      setAmount("");
      setNotes("");
      setPaidBy('');
      setIsModalOpen(false);
      // No need to call fetchExpenses() — onSnapshot handles it automatically
    } catch (error) {
      console.error("Error adding expense:", error);
      toast.error("حدث خطأ أثناء إضافة المصروف");
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (await customConfirm("هل أنت متأكد من حذف هذا المصروف؟ لا يمكن التراجع عن هذا الإجراء.")) {
      try {
        await deleteDoc(doc(db, "expenses", id));
        setExpenses(expenses.filter(e => e.id !== id));
      } catch (error) {
        console.error("Error deleting expense:", error);
      }
    }
  };

  const filteredExpenses = expenses.filter(e => 
    e.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalHaider = filteredExpenses.filter(e => e.paidBy === 'haider').reduce((s, e) => s + Number(e.amount), 0);
  const totalCake = filteredExpenses.filter(e => e.paidBy === 'cake').reduce((s, e) => s + Number(e.amount), 0);
  const totalInventory = filteredExpenses.filter(e => e.isInventoryExpense).reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 p-6 animate-slide-up pb-24">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-[#1a0533] via-[#2d1060] to-[#0f3460] pt-20 pb-6 px-5 overflow-hidden mb-6">
        <div className="absolute top-0 right-0 w-72 h-72 bg-purple-600/20 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/15 blur-[80px] rounded-full translate-y-1/2 -translate-x-1/4 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="w-10 h-10 bg-white/15 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 hover:bg-white/25 transition">
              <ArrowRight className="w-5 h-5 text-white" />
            </Link>
            <div>
              <h1 className="text-xl font-black text-white">إدارة المصاريف</h1>
              <p className="text-xs text-purple-200">فواتير ومصروفات المشروع</p>
            </div>
          </div>
          
          <div className="flex gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-[300px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300" />
              <input 
                type="text" 
                placeholder="بحث بالمصروف أو التصنيف..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/10 border border-white/20 text-white placeholder-purple-300 rounded-xl py-2.5 pr-10 pl-4 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 backdrop-blur-md transition"
              />
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-rose-500 text-white rounded-xl px-5 py-2.5 flex items-center gap-2 text-sm font-bold shadow-sm shadow-rose-500/30 hover:bg-rose-600 transition flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة مصروف</span>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
        </div>
      ) : (
        <>
          <div className="mb-6 space-y-3">
            {/* Main total */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl shadow-sm border border-rose-100 dark:border-zinc-800 flex items-center gap-4">
              <div className="w-12 h-12 bg-rose-50 dark:bg-rose-900/20 rounded-2xl flex items-center justify-center text-rose-500">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-bold mb-1">إجمالي المصاريف المعروضة</p>
                <h2 className="text-2xl font-black text-rose-600">{totalExpenses.toLocaleString()} د.ع</h2>
              </div>
            </div>
            {/* paidBy breakdown */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-2xl p-4 flex items-center gap-3">
                <span className="text-2xl">👤</span>
                <div>
                  <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">صرف حيدر</p>
                  <p className="text-lg font-black text-blue-700 dark:text-blue-300">{totalHaider.toLocaleString()} <span className="text-[10px] font-normal">د.ع</span></p>
                </div>
              </div>
              <div className="bg-pink-50 dark:bg-pink-900/10 border border-pink-100 dark:border-pink-800/30 rounded-2xl p-4 flex items-center gap-3">
                <span className="text-2xl">🎂</span>
                <div>
                  <p className="text-[10px] text-pink-600 dark:text-pink-400 font-bold">صرف فلوس الكيك</p>
                  <p className="text-lg font-black text-pink-700 dark:text-pink-300">{totalCake.toLocaleString()} <span className="text-[10px] font-normal">د.ع</span></p>
                </div>
              </div>
            </div>
            {totalInventory > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 rounded-2xl px-4 py-3 flex items-center justify-between">
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400">📦 مصروفات المخزن (مدرجة ضمن الإجمالي)</span>
                <span className="font-black text-amber-700 dark:text-amber-400 text-sm">{totalInventory.toLocaleString()} د.ع</span>
              </div>
            )}
          </div>

          {filteredExpenses.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-10 text-center shadow-sm border border-gray-100 dark:border-zinc-800">
              <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Receipt className="w-10 h-10 text-rose-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">لا توجد مصاريف مسجلة</h2>
              <p className="text-gray-500 text-sm">أضف مصروفاتك كفواتير الكهرباء أو المواد لمتابعتها.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-gray-50 dark:bg-zinc-800/50 text-gray-500 border-b border-gray-100 dark:border-zinc-800">
                    <tr>
                      <th className="py-4 px-6 font-bold">المصروف</th>
                      <th className="py-4 px-6 font-bold">التصنيف</th>
                      <th className="py-4 px-6 font-bold">التاريخ</th>
                      <th className="py-4 px-6 font-bold">المبلغ</th>
                      <th className="py-4 px-6 font-bold">إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.map((expense) => (
                      <tr key={expense.id} className="border-b border-gray-50 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/20 transition group">
                        <td className="py-4 px-6">
                          <p className="font-bold text-gray-900 dark:text-gray-100">{expense.title}</p>
                          {expense.notes && <p className="text-xs text-gray-500 mt-1 max-w-[250px] truncate">{expense.notes}</p>}
                          {expense.isInventoryExpense && <span className="text-[9px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded font-bold">📦 مخزن</span>}
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1 bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded-md text-xs font-bold text-gray-600 dark:text-gray-300">
                              <Tag className="w-3 h-3" />
                              {expense.category}
                            </span>
                            {expense.paidBy && (
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full w-fit ${
                                expense.paidBy === 'haider'
                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                  : 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400'
                              }`}>
                                {expense.paidBy === 'haider' ? '👤 حيدر' : '🎂 فلوس الكيك'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-gray-500">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" /> {expense.date}
                          </div>
                        </td>
                        <td className="py-4 px-6 font-black text-rose-600">
                          {Number(expense.amount).toLocaleString()} د.ع
                        </td>
                        <td className="py-4 px-6">
                          <button 
                            onClick={() => handleDelete(expense.id)}
                            className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:bg-red-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-lg overflow-hidden animate-scale-in">
            <div className="p-6 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-rose-50 dark:bg-rose-900/10">
              <h3 className="font-bold text-xl text-rose-800 dark:text-rose-200 flex items-center gap-2">
                <Receipt className="w-5 h-5" /> إضافة مصروف جديد
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            
            <form onSubmit={handleAddExpense} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2">عنوان المصروف</label>
                <input required type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 focus:border-rose-500 focus:outline-none" placeholder="مثال: فاتورة كهرباء شهر مايو" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2">التصنيف</label>
                  <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 focus:border-rose-500 focus:outline-none">
                    <option value="كهرباء / ماء">كهرباء / ماء</option>
                    <option value="أدوات ومعدات">أدوات ومعدات (أثاث)</option>
                    <option value="مواد خام">مواد خام وتغليف</option>
                    <option value="إعلانات وتسويق">إعلانات وتسويق</option>
                    <option value="صيانة">صيانة</option>
                    <option value="أخرى">أخرى</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">تاريخ الصرف</label>
                  <input required type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 focus:border-rose-500 focus:outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2 text-rose-600">المبلغ (د.ع)</label>
                  <FormattedNumberInput required value={amount} onChange={val => setAmount(val)} className="w-full bg-white dark:bg-zinc-800 border-2 border-rose-200 dark:border-rose-800 rounded-xl px-4 py-3 focus:border-rose-500 focus:outline-none font-bold text-lg text-rose-600" placeholder="مثال: 50" />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">ملاحظات (اختياري)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 focus:border-rose-500 focus:outline-none min-h-[80px]" placeholder="أي تفاصيل أخرى..."></textarea>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">المصروف من فلوس (اختياري)</label>
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => setPaidBy('haider')}
                    className={`py-2.5 rounded-xl font-black text-xs border transition ${
                      paidBy === 'haider' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-gray-50 dark:bg-zinc-800 text-gray-500 border-gray-200 dark:border-zinc-700'
                    }`}>👤 حيدر</button>
                  <button type="button" onClick={() => setPaidBy('cake')}
                    className={`py-2.5 rounded-xl font-black text-xs border transition ${
                      paidBy === 'cake' ? 'bg-pink-600 text-white border-pink-600 shadow-sm' : 'bg-gray-50 dark:bg-zinc-800 text-gray-500 border-gray-200 dark:border-zinc-700'
                    }`}>🎂 الكيك</button>
                  <button type="button" onClick={() => setPaidBy('')}
                    className={`py-2.5 rounded-xl font-black text-xs border transition ${
                      paidBy === '' ? 'bg-gray-600 text-white border-gray-600 shadow-sm' : 'bg-gray-50 dark:bg-zinc-800 text-gray-500 border-gray-200 dark:border-zinc-700'
                    }`}>❔ عام</button>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={submitting}
                className="w-full bg-rose-500 text-white rounded-xl py-4 font-bold text-lg hover:bg-rose-600 transition shadow-lg shadow-rose-500/20 disabled:opacity-70 flex justify-center mt-4"
              >
                {submitting ? <Loader2 className="w-6 h-6 animate-spin" /> : "حفظ المصروف"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
