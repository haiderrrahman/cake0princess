const fs = require('fs');
let content = fs.readFileSync('src/app/admin/finances/page.tsx', 'utf-8');

// Add state
content = content.replace(
  "const [amount, setAmount] = useState(\"\");",
  "const [isRepayModalOpen, setIsRepayModalOpen] = useState(false);\n  const [repayAmount, setRepayAmount] = useState(\"\");\n  const [amount, setAmount] = useState(\"\");"
);

// Add handler
const handler = `
  const handleRepay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repayAmount) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, "expenses"), {
        title: "تسديد دين الراتب",
        amount: 0,
        category: "تسويات",
        paidBy: "split",
        paidByHaider: -Number(repayAmount),
        paidByCake: Number(repayAmount),
        isInventoryExpense: false,
        createdAt: serverTimestamp()
      });
      toast.success("تم تسديد الدين بنجاح");
      setIsRepayModalOpen(false);
      setRepayAmount("");
    } catch (e) {
      toast.error("حدث خطأ أثناء التسديد");
    }
    setSubmitting(false);
  };
`;

content = content.replace(
  "const handleAddExpense = async (e: React.FormEvent) => {",
  handler + "\n  const handleAddExpense = async (e: React.FormEvent) => {"
);

// Add button
const uiOld = `<div className="grid grid-cols-2 gap-2 mt-3 relative z-10">
            <div className="bg-blue-500/20 border border-blue-400/30 rounded-2xl px-3 py-2.5 flex items-center gap-2">
              <span className="text-lg">👤</span>
              <div>
                <p className="text-[9px] text-blue-200 font-bold">مصروفات الراتب</p>
                <p className="text-sm font-black text-white">{stats.paidByHaider.toLocaleString()} <span className="text-[8px]">د.ع</span></p>
              </div>
            </div>`;

const uiNew = `<div className="grid grid-cols-2 gap-2 mt-3 relative z-10">
            <div className="bg-blue-500/20 border border-blue-400/30 rounded-2xl px-3 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">👤</span>
                <div>
                  <p className="text-[9px] text-blue-200 font-bold">مصروفات الراتب</p>
                  <p className="text-sm font-black text-white">{stats.paidByHaider.toLocaleString()} <span className="text-[8px]">د.ع</span></p>
                </div>
              </div>
              <button onClick={() => setIsRepayModalOpen(true)} className="bg-white/10 hover:bg-white/20 border border-white/20 text-[9px] text-white font-bold px-2 py-1.5 rounded-lg transition">
                تسديد
              </button>
            </div>`;

content = content.replace(uiOld, uiNew);

// Add Modal
const modal = `{/* Repay Debt Modal */}
      {isRepayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-gray-100 dark:border-zinc-800">
            <div className="p-5 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-gray-50 dark:bg-zinc-800/50">
              <h2 className="text-lg font-black text-gray-800 dark:text-white">تسديد دين للراتب</h2>
              <button onClick={() => setIsRepayModalOpen(false)} className="w-8 h-8 flex items-center justify-center bg-gray-200 dark:bg-zinc-700 text-gray-500 dark:text-gray-300 rounded-full hover:bg-gray-300 dark:hover:bg-zinc-600 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleRepay} className="p-5 space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-900/30 mb-4">
                <p className="text-xs text-blue-800 dark:text-blue-200 font-bold mb-1">إجمالي دين الراتب الحالي:</p>
                <p className="text-lg font-black text-blue-900 dark:text-white">{stats.paidByHaider.toLocaleString()} د.ع</p>
                <p className="text-[10px] text-blue-600 dark:text-blue-300 mt-2">هذا الإجراء سيقوم بتحويل المبلغ من أرباح الكيك لتسديد دين الراتب.</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">المبلغ المراد تسديده <span className="text-red-500">*</span></label>
                <input 
                  type="number" 
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white font-bold"
                  placeholder="مثال: 50000"
                  required
                />
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 font-bold flex justify-center items-center gap-2 transition disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "إتمام التسديد"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}`;

content = content.replace("export default function FinancesPage() {", "import { X } from 'lucide-react';\nexport default function FinancesPage() {");

content = content.replace(
  "{/* Expense Modal */}",
  modal + "\n\n      {/* Expense Modal */}"
);

fs.writeFileSync('src/app/admin/finances/page.tsx', content);
