"use client";
import { customConfirm } from '@/lib/customConfirm';
import { toast } from "sonner";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Receipt, Plus, Trash2, Loader2, DollarSign, BarChart3, Wallet, TrendingUp, Calendar, AlertCircle, Edit } from "lucide-react";
import { collection, getDocs, addDoc, deleteDoc, doc, serverTimestamp, query, orderBy, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

const EXPENSE_CATEGORIES = [
  "المواد الأولية (كيك وكريمة)",
  "أدوات التغليف والزينة",
  "الكهرباء والإنترنت",
  "الرواتب والأجور",
  "الإعلانات والتسويق",
  "أخرى"
];

export default function FinancesAdmin() {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('finances_expenses');
      if (saved) return JSON.parse(saved);
    }
    return [];
  });
  const [stats, setStats] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('finances_stats');
      if (saved) return JSON.parse(saved);
    }
    return { 
      totalRevenue: 0, 
      totalExpenses: 0, 
      netProfit: 0,
      totalSalaryDebt: 0,
      cakeMaterialsExpense: 0,
      breakdown: { social: 0, storeSupplies: 0, appSupplies: 0, appAcademy: 0, appCakes: 0 }
    };
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [revenueData, setRevenueData] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('finances_revenue');
      if (saved) return JSON.parse(saved);
    }
    return {
      totalRevenue: 0,
      totalProfit: 0,
      breakdown: { social: 0, storeSupplies: 0, appSupplies: 0, appAcademy: 0, appCakes: 0 }
    };
  });

  useEffect(() => {
    localStorage.setItem('finances_expenses', JSON.stringify(expenses));
  }, [expenses]);
  
  useEffect(() => {
    localStorage.setItem('finances_revenue', JSON.stringify(revenueData));
  }, [revenueData]);
  
  useEffect(() => {
    localStorage.setItem('finances_stats', JSON.stringify(stats));
  }, [stats]);

  // Form State
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [expenseSource, setExpenseSource] = useState<'cake' | 'salary' | 'split'>('cake');
  const [splitDebtAmount, setSplitDebtAmount] = useState("");
  
  const [settleDebtModalOpen, setSettleDebtModalOpen] = useState(false);
  const [settleAmount, setSettleAmount] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    // 1. Fetch revenue data once (orders rarely change from this page)
    const fetchRevenue = async () => {
      setLoading(true);
      try {
        const [ordersSnap, extSnap, storeSnap] = await Promise.all([
          getDocs(collection(db, "orders")),
          getDocs(collection(db, "external_orders")),
          getDocs(collection(db, "store_sales")),
        ]);

        let totalRevenue = 0;
        let totalProfit = 0;
        let breakdown = { social: 0, storeSupplies: 0, appSupplies: 0, appAcademy: 0, appCakes: 0 };

        ordersSnap.docs.forEach(d => {
          const o = d.data();
          if (["delivered", "completed"].includes(o.status)) {
            const amt = Number(o.toPayNow) || Number(o.total) || 0;
            totalRevenue += amt;
            totalProfit += (amt * 0.3);
            if (o.items && Array.isArray(o.items)) {
              let hasAcademy = o.items.some((i: any) => i.type === "course" || i.id?.includes("course"));
              let hasSupplies = o.items.some((i: any) => i.type === "supply" || i.id?.includes("supply"));
              if (hasAcademy) breakdown.appAcademy += amt;
              else if (hasSupplies) breakdown.appSupplies += amt;
              else breakdown.appCakes += amt;
            } else {
              breakdown.appCakes += amt;
            }
          }
        });

        extSnap.docs.forEach(d => {
          const o = d.data();
          if (!["delivered", "completed"].includes(o.status)) return;
          const amt = Number(o.price) || 0;
          totalRevenue += amt;
          totalProfit += Number(o.profit) || 0;
          breakdown.social += amt;
        });

        storeSnap.docs.forEach(d => {
          const o = d.data();
          if (["rejected", "cancelled"].includes(o.status)) return;
          const amt = Number(o.price) || 0;
          totalRevenue += amt;
          totalProfit += Number(o.profit) || 0;
          breakdown.storeSupplies += amt;
        });

        setRevenueData({ totalRevenue, totalProfit, breakdown });
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    fetchRevenue();

    // 2. Real-time sync for expenses — يتحدث تلقائياً من أي صفحة
    const q = query(collection(db, "expenses"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const exps = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setExpenses(exps);
    }, (err) => console.error("Finances expenses snapshot:", err));

    return () => unsub();
  }, [isAdmin]);

  // Recalculate stats whenever expenses or revenue data changes
  useEffect(() => {
    const totalExpenses = expenses.filter(e => !e.isDebt).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const totalSalaryDebt = expenses.filter(e => e.isDebt).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const cakeMaterialsExpense = expenses.filter(e => {
      const cat = e.category || "";
      const desc = e.description || e.title || "";
      return cat === "مشتريات مخزنية" || cat === "مواد الكيك" || cat === "مواد كيك" || cat === "المواد الأولية (كيك وكريمة)" || 
             desc.includes("المخزن") || desc.includes("مادة") || desc.includes("مواد");
    }).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const netProfit = revenueData.totalRevenue - totalExpenses - totalSalaryDebt; // Profit based on Revenue - Expenses - Debt
    
    setStats({
      totalRevenue: revenueData.totalRevenue,
      totalExpenses,
      netProfit,
      totalSalaryDebt,
      cakeMaterialsExpense,
      breakdown: revenueData.breakdown,
    });
  }, [expenses, revenueData]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description) return;
    setSubmitting(true);
    try {
      if (editingExpense) {
        if (expenseSource === 'split') {
          const debtAmount = Number(splitDebtAmount) || 0;
          const paidAmount = Number(amount) - debtAmount;
          
          await deleteDoc(doc(db, "expenses", editingExpense.id));
          
          if (debtAmount > 0) {
            await addDoc(collection(db, "expenses"), {
              amount: debtAmount,
              category,
              description: `${description} (دين من الراتب)`,
              month,
              createdAt: editingExpense.createdAt || serverTimestamp(),
              isDebt: true
            });
          }
          if (paidAmount > 0) {
            await addDoc(collection(db, "expenses"), {
              amount: paidAmount,
              category,
              description: `${description} (مدفوع من أموال الكيك)`,
              month,
              createdAt: editingExpense.createdAt || serverTimestamp(),
              isDebt: false
            });
          }
        } else {
          await updateDoc(doc(db, "expenses", editingExpense.id), {
            amount: Number(amount),
            category,
            description,
            month,
            isDebt: expenseSource === 'salary'
          });
        }
        toast.success("تم تعديل المصروف بنجاح");
      } else {
        if (expenseSource === 'split') {
        const debtAmount = Number(splitDebtAmount) || 0;
        const paidAmount = Number(amount) - debtAmount;
        
        if (debtAmount > 0) {
          await addDoc(collection(db, "expenses"), {
            amount: debtAmount,
            category,
            description: `${description} (دين من الراتب)`,
            month,
            createdAt: serverTimestamp(),
            isDebt: true
          });
        }
        if (paidAmount > 0) {
          await addDoc(collection(db, "expenses"), {
            amount: paidAmount,
            category,
            description: `${description} (مدفوع من أموال الكيك)`,
            month,
            createdAt: serverTimestamp(),
            isDebt: false
          });
        }
      } else {
        await addDoc(collection(db, "expenses"), {
          amount: Number(amount),
          category,
          description,
          month,
          createdAt: serverTimestamp(),
          isDebt: expenseSource === 'salary'
        });
      }
        toast.success("تمت إضافة المصروف بنجاح");
      }
      setAmount("");
      setDescription("");
      setIsModalOpen(false);
      setEditingExpense(null);
      setExpenseSource('cake');
      setSplitDebtAmount("");
    } catch (e) {
      toast.error(editingExpense ? "فشل التعديل" : "فشل الإضافة");
    }
    setSubmitting(false);
  };

  const openEditModal = (exp: any) => {
    setEditingExpense(exp);
    setAmount(exp.amount.toString());
    setCategory(exp.category || EXPENSE_CATEGORIES[0]);
    setDescription(exp.description || exp.title || "");
    setMonth(exp.month || new Date().getMonth() + 1);
    setExpenseSource(exp.isDebt ? 'salary' : 'cake');
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setEditingExpense(null);
    setAmount("");
    setDescription("");
    setExpenseSource('cake');
    setSplitDebtAmount("");
    setCategory(EXPENSE_CATEGORIES[0]);
    setMonth(new Date().getMonth() + 1);
    setIsModalOpen(true);
  };

  const handleDeleteExpense = async (id: string) => {
    if (!(await customConfirm("هل أنت متأكد من حذف هذا المصروف؟"))) return;
    try {
      await deleteDoc(doc(db, "expenses", id));
      // onSnapshot handles the update automatically
    } catch (e) {
      console.error(e);
    }
  };

  const submitSettleDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    const sAmount = Number(settleAmount);
    if (!sAmount || sAmount <= 0) return;
    if (sAmount > stats.totalSalaryDebt) {
      toast.error("المبلغ المدخل أكبر من الدين الكلي!");
      return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db, "expenses"), {
        amount: -sAmount,
        category: "تسديد دين",
        description: `تسديد جزء من الدين المستحق (تحويل)`,
        month: new Date().getMonth() + 1,
        createdAt: serverTimestamp(),
        isDebt: true
      });

      await addDoc(collection(db, "expenses"), {
        amount: sAmount,
        category: "تسديد دين",
        description: `تسديد جزء من الدين المستحق`,
        month: new Date().getMonth() + 1,
        createdAt: serverTimestamp(),
        isDebt: false
      });
      
      setSettleAmount("");
      setSettleDebtModalOpen(false);
      toast.success("تم تسديد جزء من الدين بنجاح وتحويله للمصاريف");
    } catch (e) {
      toast.error("حدث خطأ أثناء التسديد");
    }
    setSubmitting(false);
  };

  if (!isAdmin) return <div className="p-8 text-center font-bold text-red-500">غير مصرح بالدخول</div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0D0A1A] pb-24">
      {/* Header */}
      <div className="bg-gradient-to-l from-purple-900 to-indigo-900 pt-16 pb-8 px-5 rounded-b-[40px] shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        
        <div className="relative z-10 flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 hover:bg-white/20 transition">
              <ArrowRight className="w-5 h-5 text-white" />
            </Link>
            <div>
              <h1 className="text-xl font-black text-white mb-1">المالية والمصروفات</h1>
              <p className="text-xs text-purple-200 font-bold">تحليل الأرباح وإدارة النفقات</p>
            </div>
          </div>
          <button onClick={openAddModal} className="bg-white text-purple-900 rounded-xl px-4 py-2 flex items-center gap-2 text-sm font-black shadow-sm hover:bg-gray-100 transition active:scale-95">
            <Plus className="w-4 h-4" /> إضافة
          </button>
        </div>

        {/* Financial Stats */}
        <div className="grid grid-cols-2 gap-3 mb-3 relative z-10">
          <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4">
            <p className="text-xs font-bold text-purple-200 mb-1 flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> إجمالي الإيرادات</p>
            <p className="text-xl font-black text-white">{stats.totalRevenue.toLocaleString()} <span className="text-[10px]">د.ع</span></p>
          </div>
          <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4">
            <p className="text-xs font-bold text-purple-200 mb-1 flex items-center gap-1"><Receipt className="w-3.5 h-3.5" /> إجمالي المصروفات (من أموال الكيك)</p>
            <p className="text-xl font-black text-red-300">{stats.totalExpenses.toLocaleString()} <span className="text-[10px]">د.ع</span></p>
          </div>
        </div>
        
        <div className="bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30 rounded-2xl p-4 relative z-10 flex justify-between items-center">
          <div>
            <p className="text-xs font-bold text-emerald-200 mb-1 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> صافي الربح التقديري (بعد المصاريف)</p>
            <p className="text-2xl font-black text-white">{stats.netProfit.toLocaleString()} <span className="text-[10px]">د.ع</span></p>
          </div>
          <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-emerald-400" />
          </div>
        </div>

        {/* Salary Debt Breakdown */}
        {/* Salary Debt Breakdown */}
        <div className="bg-orange-500/20 border border-orange-400/30 rounded-2xl px-4 py-3 mt-3 relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👤</span>
            <div>
              <p className="text-xs text-orange-200 font-bold mb-1">دين مستحق (اموال الراتب)</p>
              <p className="text-lg font-black text-white">{stats.totalSalaryDebt.toLocaleString()} <span className="text-[10px]">د.ع</span></p>
            </div>
          </div>
          <button onClick={() => setSettleDebtModalOpen(true)} disabled={submitting || stats.totalSalaryDebt <= 0} className="bg-orange-600 disabled:opacity-50 hover:bg-orange-700 text-white font-black text-xs px-4 py-2 rounded-xl transition shadow-md">
            تسديد جزء من الدين
          </button>
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-4 relative z-10">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-3 text-center hover:bg-white/10 transition">
             <p className="text-[9px] text-purple-200 mb-1">الكل سوشيال</p>
             <p className="text-xs font-black text-white">{stats.breakdown.social.toLocaleString()} <span className="text-[8px] font-normal">د.ع</span></p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-3 text-center hover:bg-white/10 transition">
             <p className="text-[9px] text-purple-200 mb-1">مواد الكيك</p>
             <p className="text-xs font-black text-white">{(stats.breakdown.storeSupplies || 0).toLocaleString()} <span className="text-[8px] font-normal">د.ع</span></p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-3 text-center hover:bg-white/10 transition">
             <p className="text-[9px] text-purple-200 mb-1">الأكاديمية</p>
             <p className="text-xs font-black text-white">{stats.breakdown.appAcademy.toLocaleString()} <span className="text-[8px] font-normal">د.ع</span></p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-3 text-center hover:bg-white/10 transition md:col-span-2">
             <p className="text-[9px] text-purple-200 mb-1">طلبات التطبيق</p>
             <p className="text-xs font-black text-white">{stats.breakdown.appCakes.toLocaleString()} <span className="text-[8px] font-normal">د.ع</span></p>
          </div>
        </div>
      </div>

      <div className="px-5 mt-6 relative z-10">
        <h2 className="text-sm font-black text-gray-800 dark:text-white mb-3 flex items-center gap-2">
          <Receipt className="w-4 h-4 text-purple-500" /> سجل المصروفات الأخير
        </h2>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>
        ) : expenses.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-10 text-center shadow-sm border border-gray-100 dark:border-zinc-800">
            <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-bold text-sm">لم يتم تسجيل أي مصروفات بعد.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pb-4">
            {expenses.map(exp => (
              <div key={exp.id} className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-gray-100 dark:border-zinc-800 shadow-sm flex flex-col relative">
                <div className="flex justify-between items-start mb-4">
                  <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${exp.isDebt ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-purple-50 text-purple-600 dark:bg-purple-900/20'}`}>
                    {exp.category} {exp.isDebt ? '(دين)' : ''}
                  </span>
                  <div className="flex gap-2">
                    <button onClick={() => openEditModal(exp)} className="text-[10px] bg-blue-50 text-blue-500 w-6 h-6 rounded-full flex items-center justify-center hover:bg-blue-100 transition">
                      <Edit className="w-3 h-3" />
                    </button>
                    <button onClick={() => handleDeleteExpense(exp.id)} className="text-[10px] bg-red-50 text-red-500 w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-100 transition">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                
                <h3 className="font-black text-lg text-gray-900 dark:text-white mb-2 leading-tight">
                  {exp.description}
                </h3>
                
                <div className="mt-auto pt-4 border-t border-gray-50 dark:border-zinc-800">
                  <p className="text-xs text-gray-400 font-bold mb-1">المبلغ</p>
                  <span className={`font-black text-2xl ${exp.isDebt ? 'text-orange-500' : 'text-red-500'}`}>
                    {Number(exp.amount).toLocaleString()} <span className="text-sm">د.ع</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-scale-in flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-100 dark:border-zinc-800 bg-purple-50 dark:bg-purple-900/10 flex justify-between items-center shrink-0">
              <h3 className="font-black text-purple-900 dark:text-purple-100 flex items-center gap-2 text-sm">
                <Plus className="w-5 h-5" /> {editingExpense ? 'تعديل المصروف' : 'إضافة مصروف جديد'}
              </h3>
              <button onClick={() => { setIsModalOpen(false); setEditingExpense(null); }} className="text-gray-400 hover:text-gray-600 w-8 h-8 bg-white/50 rounded-full flex items-center justify-center">✕</button>
            </div>
            <form onSubmit={handleAddExpense} className="p-4 space-y-3 overflow-y-auto hide-scrollbar">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">المبلغ (د.ع)</label>
                <input required type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-purple-500 focus:outline-none"
                  placeholder="مثال: 50000" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">التصنيف</label>
                <select value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-purple-500 focus:outline-none">
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">الوصف</label>
                <input required type="text" value={description} onChange={e => setDescription(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-purple-500 focus:outline-none"
                  placeholder="فاتورة كهرباء، شراء كريمة..." />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">شهر المصروف</label>
                <select value={month} onChange={e => setMonth(Number(e.target.value))}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-purple-500 focus:outline-none">
                  {Array.from({length: 12}).map((_, i) => (
                    <option key={i+1} value={i+1}>شهر {i+1}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">مصدر الدفع</label>
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => setExpenseSource('cake')}
                    className={`py-2 rounded-xl font-black text-[10px] border transition ${
                      expenseSource === 'cake' ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-gray-50 dark:bg-zinc-800 text-gray-500 border-gray-200 dark:border-zinc-700'
                    }`}>🎂 أموال الكيك</button>
                  <button type="button" onClick={() => setExpenseSource('salary')}
                    className={`py-2 rounded-xl font-black text-[10px] border transition ${
                      expenseSource === 'salary' ? 'bg-orange-600 text-white border-orange-600 shadow-sm' : 'bg-gray-50 dark:bg-zinc-800 text-gray-500 border-gray-200 dark:border-zinc-700'
                    }`}>👤 دين من الراتب</button>
                  <button type="button" onClick={() => setExpenseSource('split')}
                    className={`py-2 rounded-xl font-black text-[10px] border transition ${
                      expenseSource === 'split' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-gray-50 dark:bg-zinc-800 text-gray-500 border-gray-200 dark:border-zinc-700'
                    }`}>✂️ مقسم</button>
                </div>
                {expenseSource === 'split' && (
                  <div className="mt-3 animate-fade-in">
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">المبلغ الذي من الراتب (دين)</label>
                    <input type="number" step="any" value={splitDebtAmount} onChange={e => setSplitDebtAmount(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm focus:border-purple-500 focus:outline-none"
                      placeholder="أدخل مبلغ الدين" />
                  </div>
                )}
              </div>
              <button disabled={submitting} type="submit"
                className="w-full bg-purple-600 text-white rounded-xl py-3 font-black flex items-center justify-center gap-2 hover:bg-purple-700 transition disabled:opacity-50 mt-4 shrink-0">
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (editingExpense ? "حفظ التعديلات" : "حفظ المصروف")}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Settle Debt Modal */}
      {settleDebtModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-scale-in">
            <div className="p-5 border-b border-gray-100 dark:border-zinc-800 bg-orange-50 dark:bg-orange-900/10 flex justify-between items-center">
              <h3 className="font-black text-orange-900 dark:text-orange-100 flex items-center gap-2">
                تسديد جزء من الدين
              </h3>
              <button onClick={() => setSettleDebtModalOpen(false)} className="text-gray-400 hover:text-gray-600 w-8 h-8 bg-white/50 rounded-full flex items-center justify-center">✕</button>
            </div>
            <form onSubmit={submitSettleDebt} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">المبلغ المراد تسديده (د.ع)</label>
                <input required type="number" min="500" max={stats.totalSalaryDebt} value={settleAmount} onChange={e => setSettleAmount(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 font-bold focus:border-orange-500 focus:outline-none"
                  placeholder="مثال: 50000" />
                <p className="text-xs text-gray-500 mt-2">الدين الكلي: {stats.totalSalaryDebt.toLocaleString()} د.ع</p>
              </div>
              <button disabled={submitting} type="submit"
                className="w-full bg-orange-600 text-white rounded-xl py-3.5 font-black flex items-center justify-center gap-2 hover:bg-orange-700 transition disabled:opacity-50 mt-2">
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "تسديد وتحويل للمصاريف"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
