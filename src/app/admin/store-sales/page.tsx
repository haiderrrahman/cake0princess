"use client";
import { customConfirm } from '@/lib/customConfirm';
import { toast } from "sonner";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Search, Plus, Loader2, Trash2, Calendar, Store, Package, BarChart3 } from "lucide-react";
import { collection, getDocs, addDoc, deleteDoc, doc, serverTimestamp, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";

const STORE_TYPES = ["كيك - محل", "مواد - محل", "كيك - جملة"];

export default function StoreSalesAdmin() {
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [itemName, setItemName] = useState("");
  const [type, setType] = useState("كيك - محل");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const fetchSales = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "store_sales"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setSales(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching store sales:", error);
    }
    setLoading(false);
  };

  useEffect(() => { fetchSales(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName || !price || !cost) return;
    setSubmitting(true);
    try {
      const numPrice = Number(price) * Number(quantity);
      const numCost = Number(cost) * Number(quantity);
      await addDoc(collection(db, "store_sales"), {
        itemName, type, price: numPrice, cost: numCost, profit: numPrice - numCost,
        quantity: Number(quantity), date, createdAt: serverTimestamp(),
      });
      setItemName(""); setPrice(""); setCost(""); setQuantity("1");
      setIsModalOpen(false);
      fetchSales();
    } catch (error) {
      console.error(error);
      toast.error("حدث خطأ أثناء الحفظ");
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!(await customConfirm("حذف هذا السجل نهائياً؟"))) return;
    await deleteDoc(doc(db, "store_sales", id));
    setSales(sales.filter(s => s.id !== id));
  };

  const filtered = sales.filter(s =>
    s.itemName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.type?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalRevenue = filtered.reduce((s, o) => s + Number(o.price || 0), 0);
  const totalProfit = filtered.reduce((s, o) => s + Number(o.profit || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 p-6 animate-slide-up pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="w-10 h-10 bg-white dark:bg-zinc-900 rounded-full flex items-center justify-center shadow-sm hover:bg-blue-50 transition">
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">مبيعات المحل الفعلي</h1>
            <p className="text-sm text-gray-500">مبيعات الحضوري والجملة</p>
          </div>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-[280px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="بحث..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-full py-2.5 pr-9 pl-4 text-sm focus:outline-none focus:border-blue-400 shadow-sm transition" />
          </div>
          <button onClick={() => setIsModalOpen(true)} className="bg-blue-500 text-white rounded-full px-5 py-2.5 flex items-center gap-2 text-sm font-bold shadow-sm hover:bg-blue-600 transition flex-shrink-0">
            <Plus className="w-4 h-4" /> إضافة
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-800">
          <p className="text-xs font-bold text-gray-500 mb-2">إجمالي الإيرادات</p>
          <p className="text-2xl font-black text-blue-600">{totalRevenue.toLocaleString()} <span className="text-sm font-normal text-gray-400">د.ع</span></p>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-800">
          <p className="text-xs font-bold text-gray-500 mb-2">إجمالي الربح</p>
          <p className={`text-2xl font-black ${totalProfit >= 0 ? "text-emerald-600" : "text-red-500"}`}>{totalProfit.toLocaleString()} <span className="text-sm font-normal text-gray-400">د.ع</span></p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-10 text-center shadow-sm border border-gray-100 dark:border-zinc-800">
          <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Store className="w-10 h-10 text-blue-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">لا توجد مبيعات مسجلة</h2>
          <p className="text-gray-500 text-sm">سجّل مبيعات المحل وبيع الجملة هنا لمتابعة أرباحك الكلية.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-gray-50 dark:bg-zinc-800/50 text-gray-500 border-b border-gray-100 dark:border-zinc-800">
                <tr>
                  <th className="py-4 px-5 font-bold">المنتج</th>
                  <th className="py-4 px-5 font-bold">النوع</th>
                  <th className="py-4 px-5 font-bold">الكمية</th>
                  <th className="py-4 px-5 font-bold">التاريخ</th>
                  <th className="py-4 px-5 font-bold">السعر</th>
                  <th className="py-4 px-5 font-bold">التكلفة</th>
                  <th className="py-4 px-5 font-bold">الربح</th>
                  <th className="py-4 px-5 font-bold"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(sale => (
                  <tr key={sale.id} className="border-b border-gray-50 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/20 transition group">
                    <td className="py-4 px-5 font-bold text-gray-900 dark:text-gray-100">{sale.itemName}</td>
                    <td className="py-4 px-5">
                      <span className={`inline-flex px-2 py-1 rounded-lg text-xs font-bold ${
                        sale.type?.includes("كيك") ? "bg-pink-50 text-pink-600 dark:bg-pink-900/20"
                        : sale.type?.includes("مواد") ? "bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-900/20"
                        : "bg-blue-50 text-blue-600 dark:bg-blue-900/20"
                      }`}>{sale.type}</span>
                    </td>
                    <td className="py-4 px-5 text-gray-500 text-center font-bold">{sale.quantity || 1}</td>
                    <td className="py-4 px-5 text-gray-500">
                      <div className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> {sale.date}</div>
                    </td>
                    <td className="py-4 px-5 font-bold text-blue-600">{Number(sale.price).toLocaleString()} د.ع</td>
                    <td className="py-4 px-5 text-gray-500">{Number(sale.cost).toLocaleString()} د.ع</td>
                    <td className="py-4 px-5 font-black text-emerald-600">{Number(sale.profit).toLocaleString()} د.ع</td>
                    <td className="py-4 px-5">
                      <button onClick={() => handleDelete(sale.id)} className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:bg-red-100">
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

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-blue-50 dark:bg-blue-900/10">
              <h3 className="font-bold text-xl text-blue-800 dark:text-blue-200 flex items-center gap-2">
                <Store className="w-5 h-5" /> إضافة مبيعة محل
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleAdd} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2">اسم المنتج</label>
                  <input required type="text" value={itemName} onChange={e => setItemName(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 focus:border-blue-500 focus:outline-none"
                    placeholder="كيكة شوكولا..." />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">النوع</label>
                  <select value={type} onChange={e => setType(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 focus:border-blue-500 focus:outline-none">
                    {STORE_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">تاريخ البيع</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 focus:border-blue-500 focus:outline-none" />
              </div>

              <div className="grid grid-cols-3 gap-3 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-800/30">
                <div>
                  <label className="block text-xs font-bold text-blue-700 mb-1.5">الكمية</label>
                  <input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-800 border border-blue-200 dark:border-blue-800 rounded-xl px-3 py-2.5 focus:border-blue-500 focus:outline-none text-center font-bold" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-blue-700 mb-1.5">سعر الوحدة</label>
                  <input required type="number" value={price} onChange={e => setPrice(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-800 border border-blue-200 dark:border-blue-800 rounded-xl px-3 py-2.5 focus:border-blue-500 focus:outline-none font-bold"
                    placeholder="50000" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-blue-700 mb-1.5">تكلفة الوحدة</label>
                  <input required type="number" value={cost} onChange={e => setCost(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-800 border border-blue-200 dark:border-blue-800 rounded-xl px-3 py-2.5 focus:border-blue-500 focus:outline-none font-bold"
                    placeholder="18000" />
                </div>
                {price && cost && Number(quantity) > 0 && (
                  <div className="col-span-3 flex justify-between items-center pt-2 border-t border-blue-100 dark:border-blue-800/50">
                    <span className="text-xs font-bold text-blue-700">الربح الكلي (× {quantity})</span>
                    <span className="font-black text-blue-700 text-lg">
                      {((Number(price) - Number(cost)) * Number(quantity)).toLocaleString()} د.ع
                    </span>
                  </div>
                )}
              </div>

              <button type="submit" disabled={submitting}
                className="w-full bg-blue-500 text-white rounded-xl py-4 font-bold text-lg hover:bg-blue-600 transition shadow-lg disabled:opacity-70 flex justify-center mt-4">
                {submitting ? <Loader2 className="w-6 h-6 animate-spin" /> : "حفظ المبيعة"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
