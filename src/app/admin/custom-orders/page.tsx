"use client";
import { customConfirm } from '@/lib/customConfirm';
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ChevronLeft, Loader2, Image as ImageIcon, Trash2, CheckCircle, XCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

type CustomOrder = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  imageUrl: string;
  size: string;
  filling: string;
  dough: string;
  notes: string;
  status: "pending" | "accepted" | "rejected" | "completed";
  createdAt: string;
};

export default function AdminCustomOrders() {
  const [orders, setOrders] = useState<CustomOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "custom_orders"));
      const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomOrder));
      // Sort by date descending
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(items);
    } catch (error) {
      console.error("Error fetching custom orders:", error);
    }
    setLoading(false);
  };

  const updateStatus = async (id: string, newStatus: CustomOrder["status"]) => {
    try {
      await updateDoc(doc(db, "custom_orders", id), { status: newStatus });
      setOrders(orders.map(o => o.id === id ? { ...o, status: newStatus } : o));
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("حدث خطأ أثناء التحديث.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await customConfirm("هل أنت متأكد من حذف هذا الطلب نهائياً؟"))) return;
    try {
      await deleteDoc(doc(db, "custom_orders", id));
      setOrders(orders.filter(o => o.id !== id));
    } catch (error) {
      console.error("Error deleting order:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "accepted": return "bg-blue-100 text-blue-700 border-blue-200";
      case "completed": return "bg-green-100 text-green-700 border-green-200";
      case "rejected": return "bg-red-100 text-red-700 border-red-200";
      default: return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending": return "قيد المراجعة";
      case "accepted": return "تم القبول (جاري التنفيذ)";
      case "completed": return "مكتمل";
      case "rejected": return "مرفوض";
      default: return status;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 pb-24 animate-slide-up">
            {/* ═══════════════ HEADER ═══════════════ */}
      <div className="relative bg-gradient-to-br from-[#1a0533] via-[#2d1060] to-[#0f3460] pt-20 pb-6 px-5 overflow-hidden mb-6">
        <div className="absolute top-0 right-0 w-72 h-72 bg-purple-600/20 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/15 blur-[80px] rounded-full translate-y-1/2 -translate-x-1/4 pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="w-10 h-10 bg-white/15 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 hover:bg-white/25 transition">
              <ArrowRight className="w-5 h-5 text-white" />
            </Link>
            <div>
              <h1 className="text-xl font-black text-white">طلبات التصميم الخاص</h1>
              <p className="text-xs text-purple-200">إدارة طلبات الكيك المخصص من الزبائن</p>
            </div>
          </div>
          
          <Link href="/admin/custom-orders/grid-maker" className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl backdrop-blur-md border border-white/30 transition-all font-bold text-sm">
            <ImageIcon className="w-4 h-4" /> تعديل الصور
          </Link>
        </div>
      </div>

      <div className="px-5">

      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-pink-500" /></div>
      ) : (
        <div className="grid gap-6">
          {orders.map(order => (
            <div key={order.id} className="bg-white dark:bg-zinc-900 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-800 flex flex-col md:flex-row gap-6">
              
              {/* Image */}
              <div className="w-full md:w-48 h-48 bg-gray-100 dark:bg-zinc-800 rounded-2xl overflow-hidden relative flex-shrink-0 border border-gray-200 dark:border-zinc-700">
                {order.imageUrl ? (
                  <Image src={order.imageUrl} alt="Custom Design" fill className="object-cover hover:scale-110 transition-transform duration-500 cursor-pointer" onClick={() => window.open(order.imageUrl, "_blank")} />
                ) : (
                  <ImageIcon className="w-10 h-10 m-auto mt-16 text-gray-400" />
                )}
              </div>

              {/* Details */}
              <div className="flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="font-black text-lg text-gray-900 dark:text-white mb-1">طلب من: {order.userName}</h2>
                    <p className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleString("ar-IQ")}</p>
                    <p className="text-sm font-medium text-blue-500 mt-1">{order.userEmail}</p>
                  </div>
                  <span className={`px-3 py-1 text-[10px] font-bold rounded-full border ${getStatusColor(order.status)}`}>
                    {getStatusText(order.status)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm mb-4 bg-gray-50 dark:bg-zinc-800/50 p-4 rounded-2xl">
                  <div><span className="text-gray-500 block text-xs mb-0.5">الحجم والقياس:</span> <span className="font-bold">{order.size}</span></div>
                  <div><span className="text-gray-500 block text-xs mb-0.5">نكهة العجين:</span> <span className="font-bold">{order.dough}</span></div>
                  <div><span className="text-gray-500 block text-xs mb-0.5">الحشوة:</span> <span className="font-bold text-[#d4a853]">{order.filling}</span></div>
                </div>

                {order.notes && (
                  <div className="mb-4 text-sm bg-yellow-50 dark:bg-yellow-500/10 text-yellow-800 dark:text-yellow-500 p-4 rounded-2xl">
                    <span className="font-bold block mb-1">ملاحظات الزبون:</span>
                    {order.notes}
                  </div>
                )}

                <div className="mt-auto flex flex-wrap gap-2 pt-4 border-t border-gray-100 dark:border-zinc-800">
                  {order.status === "pending" && (
                    <>
                      <button onClick={() => updateStatus(order.id, "accepted")} className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold transition">
                        <CheckCircle className="w-4 h-4" /> قبول الطلب
                      </button>
                      <button onClick={() => updateStatus(order.id, "rejected")} className="flex items-center gap-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-xl text-xs font-bold transition">
                        <XCircle className="w-4 h-4" /> رفض
                      </button>
                    </>
                  )}
                  {order.status === "accepted" && (
                    <button onClick={() => updateStatus(order.id, "completed")} className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-bold transition">
                      <CheckCircle className="w-4 h-4" /> تعليم كمكتمل
                    </button>
                  )}
                  
                  <button onClick={() => handleDelete(order.id)} className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-500 px-4 py-2 rounded-xl text-xs font-bold transition mr-auto">
                    <Trash2 className="w-4 h-4" /> حذف نهائي
                  </button>
                </div>

              </div>
            </div>
          ))}

          {orders.length === 0 && (
            <div className="text-center text-gray-500 py-20 bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800">
              لا توجد طلبات تصميم خاص حالياً.
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
