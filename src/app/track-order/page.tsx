"use client";
import { toast } from "sonner";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Search, Package, CheckCircle, Clock, Truck, Loader2, ArrowRight, AlertCircle, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const STATUS_MAP: Record<string, { label: string, color: string, icon: any, step: number }> = {
  pending_payment: { label: "بانتظار الدفع", color: "text-gray-500", icon: Clock, step: 0 },
  pending_delivery: { label: "بانتظار الدفع عند الاستلام", color: "text-gray-500", icon: Clock, step: 0 },
  pending: { label: "قيد المراجعة", color: "text-gray-500", icon: Clock, step: 1 },
  processing: { label: "قيد التجهيز", color: "text-orange-500", icon: Package, step: 2 },
  delivering: { label: "جاري التوصيل", color: "text-blue-500", icon: Truck, step: 3 },
  delivered: { label: "تم التوصيل", color: "text-purple-500", icon: CheckCircle, step: 4 },
  completed: { label: "مكتمل", color: "text-emerald-500", icon: CheckCircle, step: 4 },
  rejected: { label: "مرفوض", color: "text-red-500", icon: AlertCircle, step: -1 },
  cancelled: { label: "ملغي", color: "text-red-500", icon: AlertCircle, step: -1 },
};

function TrackOrderContent() {
  const searchParams = useSearchParams();
  const initId = searchParams.get("id") || "";
  
  const [searchTerm, setSearchTerm] = useState(initId);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = searchTerm.trim();
    if (!term) return;

    setLoading(true);
    setSearched(true);
    setOrders([]);

    try {
      // 1. Try to search by Document ID first (exact match)
      const docRef = doc(db, "orders", term);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        setOrders([{ id: docSnap.id, ...docSnap.data() }]);
        setLoading(false);
        return;
      }

      // 2. If not ID, search by Phone Number
      const q = query(collection(db, "orders"), where("phone", "==", term));
      const querySnapshot = await getDocs(q);
      const results = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Sort by latest
      results.sort((a: any, b: any) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return dateB - dateA;
      });

      setOrders(results);
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء البحث");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 pb-24">
      {/* Header */}
      <header className="px-6 pt-5 pb-4 bg-white dark:bg-zinc-900 sticky top-0 z-40 border-b border-gray-100 dark:border-zinc-800 shadow-sm flex items-center gap-4">
        <Link href="/" className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition -ml-2 active:scale-95">
          <ArrowRight className="w-6 h-6" />
        </Link>
        <h1 className="text-xl font-black">تتبع الطلب</h1>
      </header>

      <div className="p-5 max-w-lg mx-auto mt-4 space-y-6">
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-zinc-800 text-center">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-blue-500" />
          </div>
          <h2 className="font-black text-lg mb-2">ابحث عن طلبك</h2>
          <p className="text-xs text-gray-500 mb-6">أدخل رقم الهاتف الذي طلبت به أو معرف الطلب لمعرفة حالة طلبك الحالي.</p>
          
          <form onSubmit={handleSearch} className="relative">
            <input 
              type="text" 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="07XXXXXXXXX أو معرف الطلب..."
              className="w-full bg-gray-50 dark:bg-zinc-800 border-2 border-gray-200 dark:border-zinc-700 rounded-2xl p-4 pr-4 pl-14 text-sm font-bold focus:border-blue-400 focus:outline-none transition-colors"
            />
            <button type="submit" disabled={loading || !searchTerm.trim()}
              className="absolute left-2 top-2 bottom-2 bg-blue-500 text-white rounded-xl px-4 flex items-center justify-center hover:bg-blue-600 disabled:opacity-50 transition">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </button>
          </form>
        </div>

        {searched && !loading && orders.length === 0 && (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 text-center border border-gray-100 dark:border-zinc-800 animate-slide-up">
            <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-bold text-gray-600 dark:text-gray-300">عذراً، لم نتمكن من العثور على أي طلب يطابق بحثك.</p>
            <p className="text-xs text-gray-400 mt-2">تأكد من إدخال رقم الهاتف بشكل صحيح.</p>
          </div>
        )}

        {orders.length > 0 && (
          <div className="space-y-4 animate-slide-up">
            <h3 className="font-black text-sm px-1">نتائج البحث ({orders.length})</h3>
            {orders.map((order, idx) => {
              const statusInfo = STATUS_MAP[order.status] || { label: order.status, color: "text-gray-500", icon: Clock, step: 0 };
              const StatusIcon = statusInfo.icon;
              const dateStr = order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long', day: 'numeric' }) : "";

              return (
                <div key={order.id} className="bg-white dark:bg-zinc-900 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-zinc-800">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold mb-1">معرف الطلب: #{order.id.slice(0, 8).toUpperCase()}</p>
                      <h4 className="font-black text-sm">{order.userName || "ضيف"}</h4>
                    </div>
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-gray-50 dark:bg-zinc-800 ${statusInfo.color}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      {statusInfo.label}
                    </div>
                  </div>

                  {/* Progress Bar for Active Orders */}
                  {statusInfo.step >= 0 && (
                    <div className="mb-5 mt-2">
                      <div className="flex justify-between mb-2">
                        {["مراجعة", "تجهيز", "توصيل", "مكتمل"].map((step, i) => (
                          <span key={i} className={`text-[9px] font-bold ${statusInfo.step >= i + 1 ? "text-gray-800 dark:text-gray-200" : "text-gray-400"}`}>
                            {step}
                          </span>
                        ))}
                      </div>
                      <div className="h-1.5 w-full bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden flex">
                        {[1, 2, 3, 4].map(step => (
                          <div key={step} className={`h-full flex-1 border-r border-white/50 dark:border-zinc-900 ${
                            statusInfo.step >= step ? "bg-emerald-500" : "bg-transparent"
                          }`} />
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-zinc-800">
                    <div className="text-xs text-gray-500 flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5" />
                      {order.items?.length || 0} عناصر
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400">الإجمالي</p>
                      <p className="font-black text-[#e8456b]">{Number(order.total || 0).toLocaleString()} <span className="text-[9px]">د.ع</span></p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TrackOrder() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#e8456b]" /></div>}>
      <TrackOrderContent />
    </Suspense>
  );
}
