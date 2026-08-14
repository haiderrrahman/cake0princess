const fs = require('fs');
const path = '/Users/haiderrahman/Work/antigravity/كيك-الاميرة/src/app/admin/home-finance/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add dataLoading state
content = content.replace(
  'const [mounted, setMounted] = useState(false);',
  'const [mounted, setMounted] = useState(false);\n  const [dataLoading, setDataLoading] = useState(true);'
);

// 2. Modify onSnapshot to track loaded collections
const onSnapshotBlock = `    let loadedCount = 0;
    const unsubscribers = keys.map(k => {
      return onSnapshot(doc(db, "home_finance", k), (snap) => {
        if (snap.exists() && snap.data().data) {
          setters[k](snap.data().data);
        } else {
          setters[k]([]);
        }
        loadedCount++;
        if (loadedCount >= keys.length) {
          setDataLoading(false);
        }
      }, (error) => {
        console.error(\`Snapshot error for \${k}:\`, error);
        loadedCount++;
        if (loadedCount >= keys.length) {
          setDataLoading(false);
        }
      });
    });`;
    
content = content.replace(/    const unsubscribers = keys\.map\(k => \{[\s\S]*?    \}\);/m, onSnapshotBlock);

// 3. Add Loading Spinner early return
content = content.replace(
  'if (!mounted) return null;',
  'if (!mounted) return null;\n  if (dataLoading) return <div className="min-h-screen bg-gray-50 dark:bg-[#0D0A1A] flex flex-col items-center justify-center"><div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div><div className="mt-4 text-indigo-400 font-bold">جاري تحميل البيانات...</div></div>;'
);

// 4. Fix Badge rendering
content = content.replace(
  /bg-white text-gray-900 border-transparent dark:bg-zinc-900 dark:text-white dark:border-zinc-700"\n\s*: "bg-red-500 text-white border-white dark:border-zinc-900"/g,
  'bg-red-500 text-white border-white dark:border-zinc-900" // Always red\n                        : "bg-red-500 text-white border-white dark:border-zinc-900"'
);

// 5. Remove Amount text below labels
content = content.replace(
  /\{t\.amount !== undefined && \(\s*<span className="text-\[9px\] opacity-80 whitespace-nowrap hidden sm:block">\s*\{t\.amount >= 1000000 \? \(t\.amount \/ 1000000\)\.toFixed\(1\) \+ 'M' : t\.amount >= 1000 \? \(t\.amount \/ 1000\)\.toFixed\(0\) \+ 'K' : t\.amount\}\s*<\/span>\s*\)\}/g,
  '{/* Amount text removed as per request */}'
);

// 6. Add Financial Summary in Overview
const overviewStatsCode = `
                  <div className="bg-indigo-500/10 border border-indigo-400/20 rounded-2xl p-5 mt-4 backdrop-blur-sm">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-sm font-bold text-indigo-200">الاحتياجات المالية الكلية</h3>
                      <span className="text-xl font-black text-white drop-shadow-md">
                        {fmt(
                          totalDebtsOnMe + 
                          installments.reduce((s, i) => s + i.remainingAmount, 0) + 
                          familyNeeds.filter(n => n.status === "pending" && n.type !== "duty").reduce((s, n) => s + (n.estimatedCost || 0), 0) + 
                          carInventory.filter(n => (n.neededQuantity||0) > 0).reduce((s, n) => s + ((n.neededQuantity||0) * (n.estimatedPrice||0)), 0) + 
                          travelInventory.filter(n => (n.neededQuantity||0) > 0).reduce((s, n) => s + ((n.neededQuantity||0) * (n.estimatedPrice||0)), 0) + 
                          futurePlans.reduce((s, p) => s + (p.targetAmount - p.currentAmount), 0)
                        )} <span className="text-xs text-indigo-300">د.ع</span>
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                        <div className="text-gray-400 mb-1">الديون المتبقية</div>
                        <div className="font-bold text-white">{fmt(totalDebtsOnMe)} د.ع</div>
                      </div>
                      <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                        <div className="text-gray-400 mb-1">الأقساط والسلف المتبقية</div>
                        <div className="font-bold text-white">{fmt(installments.reduce((s, i) => s + i.remainingAmount, 0))} د.ع</div>
                      </div>
                      <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                        <div className="text-gray-400 mb-1">إجمالي النواقص (عائلة، سيارة، سفر)</div>
                        <div className="font-bold text-white">{fmt(
                          familyNeeds.filter(n => n.status === "pending" && n.type !== "duty").reduce((s, n) => s + (n.estimatedCost || 0), 0) + 
                          carInventory.filter(n => (n.neededQuantity||0) > 0).reduce((s, n) => s + ((n.neededQuantity||0) * (n.estimatedPrice||0)), 0) + 
                          travelInventory.filter(n => (n.neededQuantity||0) > 0).reduce((s, n) => s + ((n.neededQuantity||0) * (n.estimatedPrice||0)), 0)
                        )} د.ع</div>
                      </div>
                      <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                        <div className="text-gray-400 mb-1">الخطط المستقبلية (متبقي)</div>
                        <div className="font-bold text-white">{fmt(futurePlans.reduce((s, p) => s + (p.targetAmount - p.currentAmount), 0))} د.ع</div>
                      </div>
                    </div>
                    <p className="mt-4 text-xs leading-relaxed text-indigo-200/80 bg-indigo-500/10 p-3 rounded-lg border border-indigo-500/20">
                      <strong>خطة السداد والدراسة:</strong> لتغطية هذه الاحتياجات، ركز أولاً على الديون ذات الأولوية والأقساط التي تتراكم عليها غرامات، 
                      ثم قم بتخصيص جزء ثابت من "الرصيد الصافي" شهرياً للخطط المستقبلية والنواقص. تجنب شراء النواقص غير الضرورية حتى ينخفض إجمالي الديون والأقساط.
                    </p>
                  </div>
`;
content = content.replace(
  '{/* Smart Report */}',
  overviewStatsCode + '\n\n                {/* Smart Report */}'
);

fs.writeFileSync(path, content);
console.log("Done patching home-finance/page.tsx");
