import { toast } from "sonner";
import { useState } from "react";
import { X, Search, Package, Check, Loader2 } from "lucide-react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function InventoryDeductModal({ isOpen, onClose, inventoryItems, onDeductSuccess }: any) {
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [deductQty, setDeductQty] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const filtered = inventoryItems.filter((i: any) => i.name.toLowerCase().includes(search.toLowerCase()));

  const handleSave = async () => {
    if (!selectedItem || !deductQty || Number(deductQty) <= 0) return;
    setLoading(true);
    try {
      const newQty = Number(selectedItem.quantity) - Number(deductQty);
      const finalQty = newQty < 0 ? 0 : newQty;
      
      const updatePayload: any = {
        quantity: finalQty,
        lastUpdated: serverTimestamp()
      };
      
      const alertThreshold = selectedItem.minAlert ? Number(selectedItem.minAlert) : 1;
      if (finalQty <= alertThreshold && (!selectedItem.neededQuantity || selectedItem.neededQuantity === 0)) {
        updatePayload.neededQuantity = 1;
      }

      await updateDoc(doc(db, "cake_inventory", selectedItem.id), updatePayload);
      onDeductSuccess();
      setSelectedItem(null);
      setDeductQty("");
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("حدث خطأ أثناء الخصم");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4 text-center">
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
        
        <div className="relative bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl text-right flex flex-col max-h-[80vh]">
          <div className="p-5 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center">
            <h3 className="font-black text-xl flex items-center gap-2"><Package className="w-5 h-5 text-emerald-500" /> خصم من المخزن</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 flex-1 overflow-y-auto space-y-4">
            {!selectedItem ? (
              <>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" placeholder="ابحث عن المادة..." value={search} onChange={e => setSearch(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl py-2.5 pr-10 pl-3 text-sm focus:border-emerald-400 focus:outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {filtered.map((item: any) => (
                    <button key={item.id} onClick={() => setSelectedItem(item)}
                      className="text-right p-3 bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-xl hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition">
                      <p className="font-bold text-sm text-gray-900 dark:text-white truncate">{item.name}</p>
                      <p className="text-xs text-emerald-600 mt-1">{item.quantity} {item.unit} متاح</p>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30 rounded-2xl p-4 text-center">
                  <p className="text-sm font-bold text-gray-600 dark:text-gray-300 mb-1">المادة المحددة</p>
                  <p className="text-xl font-black text-emerald-700 dark:text-emerald-400">{selectedItem.name}</p>
                  <p className="text-xs text-gray-500 mt-2">الرصيد الحالي: <span className="font-bold text-gray-900 dark:text-white">{selectedItem.quantity} {selectedItem.unit}</span></p>
                </div>
                
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1.5 block">الكمية المستهلكة (التي سيتم خصمها)</label>
                  <div className="relative">
                    <input autoFocus type="number" value={deductQty} onChange={e => setDeductQty(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-800 border-2 border-emerald-200 dark:border-emerald-800 rounded-xl px-3 py-3 text-center font-black text-xl focus:border-emerald-500 focus:outline-none"
                      placeholder="0" />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">{selectedItem.unit}</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <button onClick={() => setSelectedItem(null)} className="flex-1 bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 font-bold py-3 rounded-xl hover:bg-gray-200 transition">
                    تغيير المادة
                  </button>
                  <button onClick={handleSave} disabled={loading || !deductQty || Number(deductQty) <= 0}
                    className="flex-1 bg-emerald-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-200 dark:shadow-none hover:bg-emerald-600 transition flex items-center justify-center gap-2 disabled:opacity-50">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} تأكيد الخصم
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
