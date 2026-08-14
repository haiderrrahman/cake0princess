const fs = require('fs');
let content = fs.readFileSync('src/app/admin/finances/page.tsx', 'utf-8');

// Change netProfit calculation
content = content.replace(
  "const netProfit = revenueData.totalProfit - totalExpenses;",
  "const netProfit = revenueData.totalRevenue - totalExpenses;"
);

// We need to merge totalExpenses and inventory values
const oldExpensesReduce = `const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const paidByHaider = expenses.reduce((s, e) => {
      if (e.paidBy === 'haider' || !e.paidBy) return s + (Number(e.amount) || 0);
      if (e.paidBy === 'split') return s + (Number(e.paidByHaider) || 0);
      return s;
    }, 0);
    const paidByCake = expenses.reduce((s, e) => {
      if (e.paidBy === 'cake') return s + (Number(e.amount) || 0);
      if (e.paidBy === 'split') return s + (Number(e.paidByCake) || 0);
      return s;
    }, 0);

    const netProfit = revenueData.totalRevenue - totalExpenses;
    
    setStats({
      totalRevenue: revenueData.totalRevenue,
      totalExpenses,
      netProfit,
      paidByHaider,
      paidByCake,
      invHaider,
      invCake,
      invTotal,
      breakdown: revenueData.breakdown,
    });`;

const newExpensesReduce = `let manualTotal = 0;
    let manualHaider = 0;
    let manualCake = 0;

    expenses.forEach(e => {
      if (e.isInventoryExpense) return; // Skip double counting inventory purchases
      const amt = Number(e.amount) || 0;
      manualTotal += amt;
      
      if (e.paidBy === 'haider' || !e.paidBy) {
        manualHaider += amt;
      } else if (e.paidBy === 'cake') {
        manualCake += amt;
      } else if (e.paidBy === 'split') {
        manualHaider += Number(e.paidByHaider) || 0;
        manualCake += Number(e.paidByCake) || 0;
      }
    });

    const totalExpenses = invTotal + manualTotal;
    const paidByHaider = invHaider + manualHaider;
    const paidByCake = invCake + manualCake;

    const netProfit = revenueData.totalRevenue - totalExpenses;
    
    setStats({
      totalRevenue: revenueData.totalRevenue,
      totalExpenses,
      netProfit,
      paidByHaider,
      paidByCake,
      invHaider,
      invCake,
      invTotal,
      breakdown: revenueData.breakdown,
    });`;

content = content.replace(oldExpensesReduce, newExpensesReduce);

// Remove the "Progress Bar" (indicator)
const progressBar = `{/* Progress Bar */}
          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden flex">
            <div className="h-full bg-blue-400" style={{ width: \`\${(stats.paidByHaider / (stats.totalExpenses || 1)) * 100}%\` }} />
            <div className="h-full bg-pink-400" style={{ width: \`\${(stats.paidByCake / (stats.totalExpenses || 1)) * 100}%\` }} />
          </div>`;

content = content.replace(progressBar, "");

// Remove the separate "Inventory Value" section entirely since it's now combined.
const invSection = `{/* Current Inventory Value */}
        <div className="mb-6 relative z-10">
          <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-1.5"><Package className="w-4 h-4" /> قيمة المخزن الحالية (الأصول)</h2>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-400 font-bold mb-1">من الكيك 🎂</p>
              <p className="text-sm font-black text-white">{stats.invCake.toLocaleString()} <span className="text-[8px]">د.ع</span></p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-400 font-bold mb-1 flex items-center justify-center gap-1"><User className="w-3 h-3"/> من الراتب</p>
              <p className="text-sm font-black text-white">{stats.invHaider.toLocaleString()} <span className="text-[8px]">د.ع</span></p>
            </div>
            <div className="bg-white/10 border border-white/20 rounded-xl p-3 text-center">
              <p className="text-[10px] text-purple-200 font-bold mb-1">القيمة الكلية</p>
              <p className="text-sm font-black text-white">{stats.invTotal.toLocaleString()} <span className="text-[8px]">د.ع</span></p>
            </div>
          </div>
        </div>`;

content = content.replace(invSection, "");

fs.writeFileSync('src/app/admin/finances/page.tsx', content);
