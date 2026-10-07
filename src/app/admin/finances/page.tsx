"use client";
import { customConfirm } from '@/lib/customConfirm';
import { toast } from "sonner";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Receipt, Plus, Trash2, Loader2, DollarSign, BarChart3, Wallet, TrendingUp, Calendar, AlertCircle, Edit, Sparkles, Clock, Package, Store, ChevronLeft, X, Copy, Tag, Search, Check } from "lucide-react";
import { collection, getDocs, addDoc, deleteDoc, doc, serverTimestamp, query, orderBy, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import ScanCakeInvoiceModal from "@/components/ScanCakeInvoiceModal";

import { getCachedFinancesStats, persistFinancesStats } from "@/lib/financesSync";

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
  const [viewingReceiptExpense, setViewingReceiptExpense] = useState<any>(null);
  const [receiptItemFilter, setReceiptItemFilter] = useState("");
  const [expenses, setExpenses] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('finances_expenses');
      if (saved) return JSON.parse(saved);
    }
    return [];
  });
  const [stats, setStats] = useState<any>(() => {
    return getCachedFinancesStats();
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
      monthRevenue: 0,
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

  // Cake Materials scan state
  const [isScanCakeInvoiceOpen, setIsScanCakeInvoiceOpen] = useState(false);
  const [cakeInventoryItems, setCakeInventoryItems] = useState<any[]>([]);

  useEffect(() => {
    // Load cake inventory items for matching in AI scan modal
    getDocs(collection(db, "cake_inventory")).then((snap) => {
      setCakeInventoryItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }).catch(console.error);
  }, []);

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
        let monthRevenue = 0;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        let breakdown = { social: 0, storeSupplies: 0, appSupplies: 0, appAcademy: 0, appCakes: 0 };

        ordersSnap.docs.forEach(d => {
          const o = d.data();
          if (["delivered", "completed"].includes(o.status)) {
            let amt = Number(o.total || o.toPayNow) || 0;
            if (o.isDebt && o.debtAmount > 0) {
              if (o.customerOwesUs === false) {
                // We owe customer, received full amount
              } else {
                // Customer owes us, received partial amount
                amt = amt - Number(o.debtAmount);
              }
            }
            
            totalRevenue += amt;
            totalProfit += (amt * 0.3);
            
            const dDate = o.deliveryDate ? new Date(o.deliveryDate) : (o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || 0));
            if (dDate >= thirtyDaysAgo) {
              monthRevenue += amt;
            }

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
          const price = Number(o.price) || 0;
          
          let amt = price;
          if (o.paidAmount !== undefined && !o.isDebtSettled) {
            const paid = Number(o.paidAmount);
            if (paid < price) {
              amt = paid;
            }
          }
          
          totalRevenue += amt;
          totalProfit += Number(o.profit) || 0;
          breakdown.social += amt;

          const dDate = o.deliveryDate ? new Date(o.deliveryDate) : (o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || 0));
          if (dDate >= thirtyDaysAgo) {
            monthRevenue += amt;
          }
        });

        storeSnap.docs.forEach(d => {
          const o = d.data();
          if (["rejected", "cancelled"].includes(o.status)) return;
          if (o.category === "تسديد ديون" || (o.itemName && o.itemName.includes("تسديد دين"))) return; // Skip debt settlements to avoid double counting revenue
          const amt = Number(o.price) || 0;
          totalRevenue += amt;
          totalProfit += Number(o.profit) || 0;
          breakdown.storeSupplies += amt;

          const dDate = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || 0);
          if (dDate >= thirtyDaysAgo) {
            monthRevenue += amt;
          }
        });

        setRevenueData({ totalRevenue, totalProfit, monthRevenue, breakdown });
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
    
    const newStats = {
      totalRevenue: revenueData.totalRevenue,
      totalExpenses,
      netProfit,
      totalSalaryDebt,
      cakeMaterialsExpense,
      monthRevenue: revenueData.monthRevenue,
      monthSales: revenueData.monthRevenue || 0,
      breakdown: revenueData.breakdown,
      todaySales: 0,
      weekSales: 0,
    };

    setStats(newStats);
    persistFinancesStats(newStats);
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
        
        <div className="relative z-10 mb-6 space-y-3">
          {/* Top Row: Back Navigation, Title & Primary Action */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link href="/admin" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 hover:bg-white/20 transition shrink-0">
                <ArrowRight className="w-5 h-5 text-white" />
              </Link>
              <div>
                <h1 className="text-xl font-black text-white leading-tight">المالية والمصروفات</h1>
                <p className="text-xs text-purple-200 font-bold">تحليل الأرباح وإدارة النفقات</p>
              </div>
            </div>

            <button 
              onClick={openAddModal} 
              className="bg-white text-purple-900 rounded-xl px-3.5 py-2.5 flex items-center gap-1.5 text-xs font-black shadow-md hover:bg-purple-50 transition active:scale-95 shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>إضافة مصروف</span>
            </button>
          </div>

          {/* Second Row: Secondary Actions in a clean 2-column grid */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              onClick={() => setIsScanCakeInvoiceOpen(true)}
              className="bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 rounded-xl py-2.5 px-3 flex items-center justify-center gap-2 text-xs font-black shadow-sm active:scale-95 transition border border-amber-300/40"
            >
              <Sparkles className="w-4 h-4 text-amber-950 shrink-0" />
              <span className="truncate">📸 تصوير فاتورة كيك (AI)</span>
            </button>
            <Link
              href="/admin/hub?tab=inventory"
              className="bg-white/10 hover:bg-white/20 text-white rounded-xl py-2.5 px-3 flex items-center justify-center gap-2 text-xs font-black backdrop-blur-md border border-white/10 transition active:scale-95"
            >
              <Clock className="w-4 h-4 shrink-0 text-purple-200" />
              <span className="truncate">المخزن ودورة النفاد</span>
            </Link>
          </div>
        </div>

        {/* Financial Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3 relative z-10">
          <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4">
            <p className="text-xs font-bold text-purple-200 mb-1 flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> إجمالي الإيرادات</p>
            <p className="text-xl font-black text-white">{stats.totalRevenue.toLocaleString()} <span className="text-[10px]">د.ع</span></p>
          </div>
          <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4">
            <p className="text-xs font-bold text-purple-200 mb-1 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> المبيعات الشهرية</p>
            <p className="text-xl font-black text-white">{(stats.monthRevenue || 0).toLocaleString()} <span className="text-[10px]">د.ع</span></p>
          </div>
          <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 col-span-2 md:col-span-1">
            <p className="text-xs font-bold text-purple-200 mb-1 flex items-center gap-1"><Receipt className="w-3.5 h-3.5" /> المصروفات (من الكيك)</p>
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

      <div className="px-5 mt-6 relative z-10 space-y-4">
        <h2 className="text-sm font-black text-gray-800 dark:text-gray-200 pt-2 flex items-center gap-2">
          <Receipt className="w-4 h-4 text-purple-500" /> سجل المصروفات العام
        </h2>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>
        ) : expenses.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-10 text-center shadow-sm border border-gray-100 dark:border-zinc-800">
            <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-bold text-sm">لم يتم تسجيل أي مصروفات بعد.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pb-4">
            {expenses.map(exp => {
              const isInv = exp.isInventoryExpense || exp.category === "مشتريات مخزنية" || !!exp.invoiceId || (exp.items && exp.items.length > 0);
              const itemsCount = exp.items?.length || exp.itemCount || 0;

              return (
                <div key={exp.id} className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-gray-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition flex flex-col justify-between relative space-y-3.5">
                  {/* Top Bar - Clear, prominent status badges */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {isInv ? (
                        <span className="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-xl text-xs font-black border border-blue-100 dark:border-blue-800/40">
                          <Receipt className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span>فاتورة مشتريات</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2.5 py-1 rounded-xl text-xs font-black border border-purple-100 dark:border-purple-800/40">
                          <Tag className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                          <span>{exp.category}</span>
                        </span>
                      )}

                      {exp.isDebt ? (
                        <span className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-2.5 py-1 rounded-xl text-xs font-black border border-amber-200/60 dark:border-amber-800/40">
                          <span>💳 دين من الراتب</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-xl text-xs font-black border border-emerald-100 dark:border-emerald-800/40">
                          <span>🎂 أموال الكيك</span>
                        </span>
                      )}
                    </div>

                    <div className="flex gap-1 shrink-0">
                      <button 
                        type="button"
                        onClick={() => openEditModal(exp)} 
                        className="text-gray-400 hover:text-blue-600 w-7 h-7 rounded-lg bg-gray-50 dark:bg-zinc-800 flex items-center justify-center transition"
                        title="تعديل المصروف"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        type="button"
                        onClick={() => handleDeleteExpense(exp.id)} 
                        className="text-gray-400 hover:text-red-600 w-7 h-7 rounded-lg bg-gray-50 dark:bg-zinc-800 flex items-center justify-center transition"
                        title="حذف المصروف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Store Name & Invoice # Bar */}
                  {(exp.storeName || exp.invoiceNumber) && (
                    <div className="flex items-center justify-between bg-slate-50 dark:bg-zinc-800/70 p-2.5 rounded-2xl border border-slate-100 dark:border-zinc-800">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0">
                          <Store className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] text-gray-400 font-bold leading-none mb-0.5">المحل / المتجر</p>
                          <p className="font-black text-xs text-gray-900 dark:text-white truncate">{exp.storeName || "محل مستلزمات"}</p>
                        </div>
                      </div>
                      {exp.invoiceNumber && (
                        <span className="bg-white dark:bg-zinc-900 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold border border-slate-200 dark:border-zinc-700 shrink-0">
                          #{exp.invoiceNumber}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Title / Description */}
                  <h3 className="font-black text-sm sm:text-base text-gray-900 dark:text-white leading-snug">
                    {exp.title && exp.storeName ? exp.title : exp.description}
                  </h3>

                  {/* Receipt Details Button (Matching Home Finance) */}
                  {(itemsCount > 0 || (exp.items && exp.items.length > 0)) && (
                    <button
                      type="button"
                      onClick={() => { setViewingReceiptExpense(exp); setReceiptItemFilter(""); }}
                      className="w-full py-2 px-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-black flex items-center justify-between border border-indigo-100 dark:border-indigo-800/40 transition active:scale-[0.98]"
                    >
                      <span className="flex items-center gap-1.5">
                        <Receipt className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span>تفاصيل قائمة الفاتورة ({itemsCount} مواد)</span>
                      </span>
                      <ChevronLeft className="w-4 h-4 text-indigo-400 shrink-0" />
                    </button>
                  )}

                  {/* Amount & Date Footer */}
                  <div className="mt-auto pt-3 border-t border-gray-100 dark:border-zinc-800 flex justify-between items-end">
                    <div>
                      <p className="text-[11px] text-gray-400 font-bold mb-0.5">المبلغ المسجل</p>
                      <span className={`font-black text-xl sm:text-2xl ${exp.isDebt ? 'text-orange-500' : 'text-red-500'}`}>
                        {Number(exp.amount).toLocaleString()} <span className="text-xs font-normal">د.ع</span>
                      </span>
                    </div>
                    <div className="text-left text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-800/50 px-2.5 py-1.5 rounded-xl border border-gray-100 dark:border-zinc-800">
                      <p className="font-bold flex items-center gap-1 justify-end">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        {exp.createdAt?.toDate ? exp.createdAt.toDate().toLocaleDateString('en-GB') : (exp.date || '')}
                      </p>
                      <p dir="ltr" className="text-[10px] text-gray-400 mt-0.5">
                        {exp.createdAt?.toDate ? exp.createdAt.toDate().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
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
      {/* AI Cake Invoice Scanner Modal */}
      <ScanCakeInvoiceModal
        isOpen={isScanCakeInvoiceOpen}
        onClose={() => setIsScanCakeInvoiceOpen(false)}
        inventoryItems={cakeInventoryItems}
        onSuccess={() => {
          toast.success("تم مسح الفاتورة وتسجيل المصروف وتحديث المخزن بنجاح!");
        }}
      />

      {/* ─── Receipt Items Modal (matching Home Finance) ─── */}
      {viewingReceiptExpense && (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 w-full sm:max-w-2xl rounded-t-[32px] sm:rounded-[32px] px-5 sm:px-7 pt-5 pb-8 shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200 border border-gray-100 dark:border-zinc-800 max-h-[92svh] overflow-y-auto mb-[75px] sm:mb-0 custom-scrollbar">
            
            {/* Header */}
            <div className="flex justify-between items-start mb-4 pb-4 border-b border-gray-100 dark:border-zinc-800">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">🧾</span>
                  <h3 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white">
                    {viewingReceiptExpense.storeName ? `فاتورة: ${viewingReceiptExpense.storeName}` : (viewingReceiptExpense.title || viewingReceiptExpense.description)}
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400">
                  <span className="bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full">{viewingReceiptExpense.category || "مشتريات مخزنية"}</span>
                  {viewingReceiptExpense.invoiceNumber && (
                    <span className="bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full font-mono font-bold">#{viewingReceiptExpense.invoiceNumber}</span>
                  )}
                  <span>•</span>
                  <span>{viewingReceiptExpense.date || (viewingReceiptExpense.createdAt?.toDate ? viewingReceiptExpense.createdAt.toDate().toLocaleDateString('ar-IQ') : '')}</span>
                  <span>•</span>
                  <span className="text-rose-600 dark:text-rose-400 font-black">{Number(viewingReceiptExpense.amount).toLocaleString()} د.ع</span>
                  <span>•</span>
                  <span>{(viewingReceiptExpense.items || []).length || viewingReceiptExpense.itemCount || 0} مواد</span>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setViewingReceiptExpense(null)} 
                className="p-2 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-full transition"
              >
                <X className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* Search inside receipt */}
            <div className="relative mb-3">
              <input
                type="text"
                placeholder="ابحث في مواد الفاتورة (مثال: طحين، شوكولاتة...)"
                value={receiptItemFilter}
                onChange={e => setReceiptItemFilter(e.target.value)}
                className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl px-4 py-2.5 pr-10 text-xs font-bold outline-none focus:ring-2 focus:ring-purple-500/20 transition"
              />
              <Search className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              {receiptItemFilter && (
                <button type="button" onClick={() => setReceiptItemFilter("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Items Table */}
            <div className="bg-gray-50 dark:bg-zinc-900/60 rounded-2xl border border-gray-200/80 dark:border-zinc-800 overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-3 py-2.5 bg-gray-100/70 dark:bg-zinc-800/60 text-[11px] font-black text-gray-500 border-b border-gray-200 dark:border-zinc-800 text-right">
                <div className="col-span-1 text-center">#</div>
                <div className="col-span-5">اسم المادة</div>
                <div className="col-span-3 text-center">الكمية والوحدة</div>
                <div className="col-span-3 text-left">الإجمالي (د.ع)</div>
              </div>

              <div className="divide-y divide-gray-100 dark:divide-zinc-800/80 max-h-[350px] overflow-y-auto custom-scrollbar">
                {(() => {
                  const rawItems = viewingReceiptExpense.items || [];
                  const filtered = rawItems.filter((item: any) => 
                    !receiptItemFilter || (item.name || "").toLowerCase().includes(receiptItemFilter.toLowerCase())
                  );

                  if (filtered.length === 0) {
                    return (
                      <div className="text-center py-8 text-xs font-bold text-gray-400">
                        {receiptItemFilter ? "لا توجد مواد مطابقة للبحث" : (
                          viewingReceiptExpense.description ? (
                            <div className="p-4 text-right">
                              <p className="text-gray-500 text-xs mb-1 font-bold">تفاصيل المصروف المسجلة:</p>
                              <p className="text-gray-700 dark:text-gray-300 font-bold">{viewingReceiptExpense.description}</p>
                            </div>
                          ) : "لا توجد مواد مفصلة في هذه القائمة"
                        )}
                      </div>
                    );
                  }

                  return filtered.map((item: any, idx: number) => (
                    <div key={item.id || idx} className="grid grid-cols-12 gap-2 px-3 py-2.5 text-xs items-center hover:bg-white dark:hover:bg-zinc-800/50 transition">
                      <div className="col-span-1 text-center font-bold text-gray-400 text-[11px]">{idx + 1}</div>
                      <div className="col-span-5 font-bold text-gray-800 dark:text-gray-200 truncate">{item.name}</div>
                      <div className="col-span-3 text-center font-black text-gray-600 dark:text-gray-300 bg-gray-200/60 dark:bg-zinc-800 px-1 py-0.5 rounded-md text-[11px]">
                        {item.quantity} {item.unit || ""}
                      </div>
                      <div className="col-span-3 text-left font-black text-rose-600 dark:text-rose-400">
                        {Number(item.totalPrice || item.price || 0).toLocaleString()} <span className="text-[9px] font-bold text-gray-400">د.ع</span>
                      </div>
                    </div>
                  ));
                })()}
              </div>

              {/* Total Footer */}
              <div className="bg-gray-100/90 dark:bg-zinc-800 px-4 py-3 border-t border-gray-200 dark:border-zinc-700 flex justify-between items-center text-xs">
                <span className="font-bold text-gray-600 dark:text-gray-300">
                  إجمالي الفاتورة: {(viewingReceiptExpense.items || []).length || viewingReceiptExpense.itemCount || 0} مادة
                </span>
                <span className="font-black text-sm text-rose-600 dark:text-rose-400">
                  {Number(viewingReceiptExpense.amount).toLocaleString()} د.ع
                </span>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-wrap gap-2.5 mt-4">
              <button
                type="button"
                onClick={() => {
                  const rawItems = viewingReceiptExpense.items || [];
                  const lines = rawItems.map((it: any, i: number) => `${i + 1}. ${it.name} (${it.quantity} ${it.unit || ''}) - ${Number(it.totalPrice || it.price || 0).toLocaleString()} د.ع`);
                  const text = `🧾 فاتورة: ${viewingReceiptExpense.storeName || viewingReceiptExpense.title || viewingReceiptExpense.description}\n📅 التاريخ: ${viewingReceiptExpense.date || ''}\n💰 الإجمالي: ${Number(viewingReceiptExpense.amount).toLocaleString()} د.ع\n\nالمواد:\n${lines.join("\n")}`;
                  navigator.clipboard.writeText(text);
                  toast.success("تم نسخ قائمة الفاتورة إلى الحافظة 📋");
                }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-gray-200 font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Copy className="w-4 h-4" /> نسخ القائمة
              </button>

              <button
                type="button"
                onClick={() => {
                  const expToEdit = viewingReceiptExpense;
                  setViewingReceiptExpense(null);
                  openEditModal(expToEdit);
                }}
                className="flex-1 bg-purple-50 hover:bg-purple-100 dark:bg-purple-500/10 dark:hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30 font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Edit className="w-4 h-4" /> تعديل المصروف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
