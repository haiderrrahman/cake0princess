"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, ShoppingBag, Loader2, CheckCircle, Clock, MapPin, Search } from "lucide-react";
import { collection, query, orderBy, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setOrders(data);
      } catch (error) {
        console.error("Error fetching orders:", error);
        
        try {
          const snapshot = await getDocs(collection(db, "orders"));
          const data: any[] = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
          data.sort((a, b) => new Date(b.createdAt?.toDate?.() || 0).getTime() - new Date(a.createdAt?.toDate?.() || 0).getTime());
          setOrders(data);
        } catch (e) {
          console.error("Fallback failed:", e);
        }
      }
      setLoading(false);
    };
    fetchOrders();
  }, []);

  const updateOrderStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "orders", id), { status: newStatus });
      setOrders(orders.map(o => o.id === id ? { ...o, status: newStatus } : o));
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.userName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      o.phone?.includes(searchQuery) ||
      o.id.includes(searchQuery);
    const matchesStatus = statusFilter === "all" || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 pb-24 animate-slide-up">
      {/* ═══════════════ LUXURY HEADER BANNER ═══════════════ */}
      <div className="bg-gradient-to-l from-pink-900 via-rose-900 to-purple-950 pt-16 pb-8 px-5 rounded-b-[40px] shadow-lg relative overflow-hidden mb-6 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 hover:bg-white/20 transition">
              <ArrowRight className="w-5 h-5 text-white" />
            </Link>
            <div>
              <h1 className="text-xl font-black text-white mb-1">الطلبات العامة (التطبيق)</h1>
              <p className="text-xs text-rose-200 font-bold">متابعة وإدارة طلبات المتجر والتوصيل</p>
            </div>
          </div>
          
          <div className="flex gap-3 w-full md:w-auto relative z-10">
            <div className="relative flex-1 md:w-[300px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
              <input 
                type="text" 
                placeholder="بحث بالاسم أو الرقم..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/10 border border-white/20 text-sm text-white placeholder-white/50 rounded-xl py-3 pr-10 pl-4 focus:outline-none focus:ring-2 focus:ring-rose-400 backdrop-blur-md transition"
              />
            </div>
          </div>
        </div>

        {/* Stats Header integrated into the luxury header */}
        {(() => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

          let todaySales = 0, weekSales = 0, monthSales = 0;

          orders.forEach(o => {
            if (["rejected", "cancelled"].includes(o.status)) return;
            const amt = Number(o.totalPrice) || 0;
            const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || 0);
            d.setHours(0,0,0,0);
            
            if (d.getTime() === today.getTime()) todaySales += amt;
            if (d >= weekAgo) weekSales += amt;
            if (d >= thirtyDaysAgo) monthSales += amt;
          });

          return (
            <div className="grid grid-cols-3 gap-2.5 mt-6 relative z-10">
              <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3 md:p-4 text-center flex flex-col justify-center">
                <p className="text-[10px] md:text-xs font-bold text-rose-200 mb-1">مبيعات اليوم</p>
                <p className="text-sm md:text-xl font-black text-white">{todaySales.toLocaleString()} <span className="text-[9px] md:text-[10px] font-normal">د.ع</span></p>
              </div>
              <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3 md:p-4 text-center flex flex-col justify-center">
                <p className="text-[10px] md:text-xs font-bold text-rose-200 mb-1">مبيعات الأسبوع</p>
                <p className="text-sm md:text-xl font-black text-white">{weekSales.toLocaleString()} <span className="text-[9px] md:text-[10px] font-normal">د.ع</span></p>
              </div>
              <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3 md:p-4 text-center flex flex-col justify-center">
                <p className="text-[10px] md:text-xs font-bold text-rose-200 mb-1">مبيعات الشهر</p>
                <p className="text-sm md:text-xl font-black text-white">{monthSales.toLocaleString()} <span className="text-[9px] md:text-[10px] font-normal">د.ع</span></p>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Visible Filter Grid (No Horizontal Scroll / Swipe) */}
      <div className="px-5 mb-6">
        <div className="flex flex-wrap gap-2 bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm">
          {[
            { key: "all", label: "الكل 📋" },
            { key: "pending", label: "⏳ بانتظار الدفع" },
            { key: "processing", label: "🔧 قيد التجهيز" },
            { key: "delivering", label: "🚗 قيد التوصيل" },
            { key: "completed", label: "✅ مكتمل" },
          ].map((f: any) => (
            <button key={f.key} onClick={() => setStatusFilter(f.key)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition active:scale-95 ${statusFilter === f.key ? "bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-md shadow-pink-500/20" : "bg-gray-50 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700"}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#e8456b]" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="px-5">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-10 text-center shadow-sm border border-gray-100 dark:border-zinc-800">
          <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShoppingBag className="w-10 h-10 text-blue-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">لا توجد طلبات</h2>
          <p className="text-gray-500 text-sm">لم يتم العثور على أي طلبات تطابق بحثك حالياً.</p>
        </div>
        </div>
      ) : (
        <div className="px-5">
          <div className="space-y-4">
            {filteredOrders.map(order => (
            <div key={order.id} className="bg-white dark:bg-zinc-900 rounded-[24px] p-4 sm:p-5 border border-gray-100 dark:border-zinc-800 shadow-sm flex flex-col lg:flex-row gap-5 relative group hover:shadow-md transition">
              
              {/* Order Info & Items */}
              <div className="flex-1">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 gap-2">
                  <div>
                    <h3 className="font-black text-gray-900 dark:text-white text-lg">{order.userName || "ضيف"}</h3>
                    <p className="text-xs font-bold text-gray-500 mt-0.5">{order.phone || "لا يوجد رقم"}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center w-fit gap-1.5 ${
                    order.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                    order.status === 'processing' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                    order.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                    order.status === 'delivering' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                    order.status === 'delivered' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                    order.status === 'pending_verification' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' :
                    'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-300'
                  }`}>
                    {order.status === 'completed' && <CheckCircle className="w-3.5 h-3.5" />}
                    {order.status === 'processing' && <Clock className="w-3.5 h-3.5" />}
                    {order.status === 'completed' ? 'مكتمل' : 
                     order.status === 'processing' ? 'قيد التجهيز' : 
                     order.status === 'rejected' ? 'تم الرفض' : 
                     order.status === 'delivering' ? 'قيد التوصيل' : 
                     order.status === 'delivered' ? 'تم التوصيل' : 
                     order.status === 'pending_verification' ? 'بانتظار تأكيد الدفع' : 'بانتظار الدفع'}
                  </span>
                </div>
                
                <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-2xl p-3 mb-4">
                  <div className="space-y-2">
                    {order.items?.map((item: any, i: number) => (
                      <div key={i} className="flex justify-between items-center text-sm">
                        <span className="text-gray-700 dark:text-gray-300 flex items-center gap-2 font-bold">
                          <span className="w-6 h-6 bg-white dark:bg-zinc-700 rounded-md flex items-center justify-center text-[10px] text-gray-500 shadow-sm">{item.quantity || 1}x</span>
                          <span className="truncate max-w-[150px] sm:max-w-[200px]">{item.name}</span>
                        </span>
                        <span className="text-gray-500 text-xs font-bold">{(item.price * (item.quantity || 1)).toLocaleString()} د.ع</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center text-sm mt-3 pt-3 border-t border-gray-200 dark:border-zinc-700">
                    <span className="text-gray-500 text-xs font-bold">الإجمالي الكلي:</span>
                    <span className="font-black text-[#e8456b] text-base">{Number(order.total).toLocaleString()} د.ع</span>
                  </div>
                </div>

                {order.paymentMethod === 'manual_transfer' && order.transferReceipt && (
                  <div className="px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div>
                      <span className="text-[10px] font-bold text-indigo-500 block mb-1">تأكيد تحويل زين كاش:</span>
                      <span className="text-sm font-black text-indigo-700 dark:text-indigo-300 select-all font-mono">{order.transferReceipt}</span>
                    </div>
                    {order.status === 'pending_verification' && (
                      <button 
                        onClick={() => updateOrderStatus(order.id, "processing")}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm active:scale-95 whitespace-nowrap"
                      >
                        تأكيد استلام الدفعة
                      </button>
                    )}
                  </div>
                )}

                {order.address && (
                  <div className="flex gap-2 items-start text-xs text-gray-600 dark:text-gray-400">
                    <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="leading-relaxed font-bold">{order.deliveryZone} - {order.address}</p>
                      {order.location && (
                        <a 
                          href={`https://www.google.com/maps/search/?api=1&query=${order.location.lat},${order.location.lng}`}
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black hover:bg-blue-100 transition"
                        >
                          <MapPin className="w-3 h-3" />
                          عرض على خرائط جوجل
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Admin Actions Sidebar */}
              <div className="lg:w-48 flex flex-col gap-2 shrink-0 border-t lg:border-t-0 lg:border-r border-gray-100 dark:border-zinc-800 pt-4 lg:pt-0 lg:pr-5">
                <p className="text-[10px] font-bold text-gray-400 mb-1 hidden lg:block">تغيير حالة الطلب</p>
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
                  <button 
                    onClick={() => updateOrderStatus(order.id, "processing")}
                    disabled={order.status === "processing"}
                    className={`py-2 rounded-xl text-xs font-bold transition ${order.status === "processing" ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-zinc-800 dark:text-gray-600' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}
                  >
                    قيد التجهيز
                  </button>
                  <button 
                    onClick={() => updateOrderStatus(order.id, "delivering")}
                    disabled={order.status === "delivering"}
                    className={`py-2 rounded-xl text-xs font-bold transition ${order.status === "delivering" ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-zinc-800 dark:text-gray-600' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                  >
                    قيد التوصيل
                  </button>
                  <button 
                    onClick={() => updateOrderStatus(order.id, "delivered")}
                    disabled={order.status === "delivered"}
                    className={`py-2 rounded-xl text-xs font-bold transition ${order.status === "delivered" ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-zinc-800 dark:text-gray-600' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'}`}
                  >
                    تم التوصيل
                  </button>
                  <button 
                    onClick={() => updateOrderStatus(order.id, "completed")}
                    disabled={order.status === "completed"}
                    className={`py-2 rounded-xl text-xs font-bold transition ${order.status === "completed" ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-zinc-800 dark:text-gray-600' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                  >
                    مكتمل
                  </button>
                  <button 
                    onClick={() => updateOrderStatus(order.id, "rejected")}
                    disabled={order.status === "rejected"}
                    className={`py-2 col-span-2 lg:col-span-1 rounded-xl text-xs font-bold transition mt-2 ${order.status === "rejected" ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-zinc-800 dark:text-gray-600' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                  >
                    إلغاء ورفض الطلب
                  </button>
                </div>
              </div>
            </div>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}
