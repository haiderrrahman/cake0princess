const fs = require('fs');
const file = 'src/app/admin/external-orders/page.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add total pending calculation
const pendingCalc = `
          let pendingOrdersCount = 0;
          let pendingOrdersAmount = 0;

          orders.forEach(o => {
            const isDelivered = o.status === "delivered" || o.status === "completed";
            if (!isDelivered && o.status !== "rejected" && o.status !== "cancelled") {
              pendingOrdersCount++;
              pendingOrdersAmount += Number(o.price || 0);
            }
          });
`;

code = code.replace(/let todayOrdersCount = 0;/, pendingCalc + '\n          let todayOrdersCount = 0;');

// Inject the UI for pending orders
const pendingUI = `
              <div className="bg-amber-500/20 backdrop-blur-md border border-amber-500/30 rounded-2xl p-2 md:p-4 text-center flex flex-col justify-center">
                <p className="text-[9px] md:text-xs font-bold text-amber-200 mb-1">الطلبات المعلقة: {pendingOrdersCount} طلب</p>
                <p className="text-xs md:text-xl font-black text-white">{pendingOrdersAmount.toLocaleString()} <span className="text-[8px] md:text-[10px] font-normal">د.ع</span></p>
              </div>
`;

code = code.replace(/<div className="bg-emerald-500\/20 backdrop-blur-md border border-emerald-500\/30 rounded-2xl p-2 md:p-4 text-center flex flex-col justify-center">/, pendingUI + '\n              <div className="bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30 rounded-2xl p-2 md:p-4 text-center flex flex-col justify-center">');

// 2. Add Blacklist logic and fix image flashing
// Fix image flashing by removing loading="lazy" and ensuring caching is smooth
code = code.replace(/loading="lazy"/g, '');

// Wait, the Blacklist logic needs socialProfiles state in external-orders
if (!code.includes('const [socialProfiles')) {
  code = code.replace(/const \[loading, setLoading\] = useState/, `const [socialProfiles, setSocialProfiles] = useState<any[]>([]);\n  const [loading, setLoading] = useState`);
}

// Fetch socialProfiles
const fetchSocial = `
    const unsubSocial = onSnapshot(collection(db, "social_customers"), (snap) => {
      setSocialProfiles(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
`;
code = code.replace(/const unsubscribe = onSnapshot\(q, \(snap\) => \{/, fetchSocial + '\n    const unsubscribe = onSnapshot(q, (snap) => {');
code = code.replace(/return \(\) => unsubscribe\(\);/, 'return () => { unsubscribe(); unsubSocial(); };');

// Filter/Sort blacklisted
const sortingLogic = `
    const isBlacklisted = (order: any) => {
      const key = order.customerPhone || order.customerName || "مجهول";
      return socialProfiles.find(p => p.id === key)?.isBlacklisted;
    };

    filteredOrders.sort((a, b) => {
      const aBlack = isBlacklisted(a);
      const bBlack = isBlacklisted(b);
      if (aBlack && !bBlack) return 1;
      if (!aBlack && bBlack) return -1;

      const aDeliv = a.status === 'delivered' || a.status === 'completed' || a.status === 'cancelled' || a.status === 'rejected';
      const bDeliv = b.status === 'delivered' || b.status === 'completed' || b.status === 'cancelled' || b.status === 'rejected';
      if (aDeliv && !bDeliv) return 1;
      if (!aDeliv && bDeliv) return -1;
`;
code = code.replace(/filteredOrders\.sort\(\(a, b\) => \{[\s\S]*?const aDeliv = [^;]+;[\s\S]*?const bDeliv = [^;]+;[\s\S]*?if \(aDeliv && !bDeliv\) return 1;[\s\S]*?if \(!aDeliv && bDeliv\) return -1;/, sortingLogic);

// Add visual indicator for blacklisted
code = code.replace(/const isDelivered = order\.status === 'delivered' \|\| order\.status === 'completed';/, `const isDelivered = order.status === 'delivered' || order.status === 'completed';\n                    const blacklisted = isBlacklisted(order);`);

const cardClass = '`relative flex flex-col md:flex-row gap-4 p-4 rounded-3xl backdrop-blur-md border transition-all duration-300 shadow-lg group ${blacklisted ? "bg-black/60 border-red-900/50 opacity-80" : isDelivered ? "bg-emerald-950/20 border-emerald-900/30 opacity-70" : isDebt ? "bg-rose-950/20 border-rose-900/30 ring-1 ring-rose-500/20" : "bg-white/5 border-white/10 hover:bg-white/10"}`';
code = code.replace(/className=\{`relative flex flex-col md:flex-row gap-4 p-4 rounded-3xl backdrop-blur-md border transition-all duration-300 shadow-lg group \$\{isDelivered \? "bg-emerald-950[^`]+`\}/, `className=${cardClass}`);

// Add warning label
const warningLabel = `
                    {blacklisted && (
                      <div className="absolute top-2 left-2 bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-lg border border-red-400 z-20 flex items-center gap-1">
                        ⚠️ محظور
                      </div>
                    )}
`;
code = code.replace(/\{isDebt && \(/, warningLabel + '\n                    {isDebt && (');

fs.writeFileSync(file, code);
