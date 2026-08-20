const fs = require('fs');
const filePath = '/Users/haiderrahman/Work/antigravity/كيك-الاميرة/src/app/admin/hub/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add Icons
content = content.replace(
  /MessageCircle, Send, Bot, Sparkles, BrainCircuit, CheckCircle/g,
  'MessageCircle, Send, Bot, Sparkles, BrainCircuit, CheckCircle, PackageCheck'
);

// 2. Update tabTitles
content = content.replace(
  /stats: \{ title: "التقارير", subtitle: "تحليلات وإحصائيات مفصلة" \}/,
  'audit: { title: "مطابقة وكشف", subtitle: "التدقيق المالي ومطابقة الحسابات والديون" }'
);

// 3. Update activeTab type
content = content.replace(
  /useState<"orders" \| "external" \| "supplies_orders" \| "courses" \| "inventory" \| "stats">\(defaultTab\)/,
  'useState<"orders" | "external" | "supplies_orders" | "courses" | "inventory" | "audit">(defaultTab === "stats" ? "audit" : defaultTab)'
);

// 4. Inject auditData useMemo before currentTabInfo
const auditDataBlock = `
  const auditData = useMemo(() => {
    const result = {
      social: { totalExpected: 0, totalReceived: 0, totalDebt: 0, totalWeOwe: 0, ordersCount: 0 },
      appCakes: { totalExpected: 0, totalReceived: 0, totalDebt: 0, totalWeOwe: 0, ordersCount: 0 },
      supplies: { totalExpected: 0, totalReceived: 0, totalDebt: 0, totalWeOwe: 0, ordersCount: 0 },
    };

    const processOrder = (order: any, category: "social" | "appCakes" | "supplies") => {
      if (order.status === 'rejected') return;
      
      result[category].ordersCount++;
      const total = Number(order.total) || 0;
      let paid = Number(order.toPayNow) || 0;
      const isDebt = order.isDebt === true;
      const debtAmount = Number(order.debtAmount) || 0;
      const customerOwesUs = order.customerOwesUs !== false; // Default true

      result[category].totalExpected += total;

      if (isDebt && debtAmount > 0) {
        if (customerOwesUs) {
          result[category].totalReceived += (total - debtAmount);
          result[category].totalDebt += debtAmount;
        } else {
          result[category].totalReceived += total;
          result[category].totalWeOwe += debtAmount;
        }
      } else {
        result[category].totalReceived += total;
      }
    };

    extOrders.forEach((o: any) => processOrder(o, 'social'));
    
    orders.forEach((o: any) => {
      const hasSupplies = o.items?.some((i: any) => i.isSupply || i.category === 'supplies' || i.id?.includes('supply'));
      const hasCourses = o.items?.some((i: any) => i.type === 'course');
      
      if (hasCourses && !hasSupplies && o.items?.length === 1) return; // Skip pure academy
      
      if (hasSupplies) {
        processOrder(o, 'supplies');
      } else {
        processOrder(o, 'appCakes');
      }
    });

    return result;
  }, [extOrders, orders]);

  const currentTabInfo = tabTitles[activeTab] || { title: "القسم", subtitle: "إدارة القسم" };`;

content = content.replace(
  /  const currentTabInfo = tabTitles\[activeTab\] \|\| \{ title: "القسم", subtitle: "إدارة القسم" \};/,
  auditDataBlock
);

// 5. Replace the old stats tab JSX with the new audit tab
const oldStatsRegex = /\{\/\* === STATS TAB === \*\/\}\s*\{activeTab === "stats" && \([\s\S]*?\}\s*<\/>/m;

const newAuditBlock = `{/* === AUDIT TAB === */}
            {activeTab === "audit" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-black text-gray-900 dark:text-white">مطابقة وكشف حسابات المركز</h2>
                  <p className="text-sm text-gray-500 mt-1">يتم عرض المبالغ المتوقعة مقابل المبالغ المستلمة فعلياً والديون والأمانات</p>
                </div>
                
                {[
                  { id: "social", label: "طلبات كيك السوشيال", data: auditData.social, icon: <MessageCircle className="w-6 h-6 text-emerald-400" />, colors: "from-emerald-900 via-teal-900 to-slate-950", border: "border-emerald-500/20", glow: "bg-emerald-500/20" },
                  { id: "appCakes", label: "طلبات كيك التطبيق", data: auditData.appCakes, icon: <Sparkles className="w-6 h-6 text-pink-400" />, colors: "from-pink-900 via-rose-900 to-purple-950", border: "border-pink-500/20", glow: "bg-pink-500/20" },
                  { id: "supplies", label: "طلبات مواد الكيك", data: auditData.supplies, icon: <PackageCheck className="w-6 h-6 text-amber-400" />, colors: "from-orange-900 via-amber-900 to-red-950", border: "border-amber-500/20", glow: "bg-amber-500/20" }
                ].map(section => (
                  <div key={section.id} className={\`relative bg-gradient-to-br \${section.colors} rounded-3xl p-6 overflow-hidden shadow-2xl border \${section.border}\`}>
                    <div className={\`absolute top-0 right-0 w-64 h-64 \${section.glow} blur-[80px] rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none\`} />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/40 blur-[60px] rounded-full translate-y-1/2 -translate-x-1/4 pointer-events-none" />
                    
                    <div className="relative z-10">
                      <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10">
                            {section.icon}
                          </div>
                          <div>
                            <h3 className="text-xl font-black text-white">{section.label}</h3>
                            <p className="text-sm text-gray-300">{section.data.ordersCount} طلب مكتمل أو قيد التنفيذ</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-4 border border-white/5">
                          <p className="text-xs text-gray-300 font-bold mb-1">المبلغ الإجمالي (المتوقع)</p>
                          <p className="text-lg font-black text-white">{section.data.totalExpected.toLocaleString()} <span className="text-[10px] font-normal text-gray-400">د.ع</span></p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
                          <p className="text-xs text-emerald-200 font-bold mb-1 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> المُستلم الفعلي</p>
                          <p className="text-lg font-black text-emerald-400">{section.data.totalReceived.toLocaleString()} <span className="text-[10px] font-normal opacity-70">د.ع</span></p>
                        </div>
                        <div className={\`bg-rose-950/40 backdrop-blur-sm rounded-2xl p-4 border \${section.data.totalDebt > 0 ? 'border-rose-500/50' : 'border-rose-900/30'}\`}>
                          <p className="text-xs text-rose-300 font-bold mb-1 flex items-center gap-1">🔴 ديون (نطلبهم)</p>
                          <p className="text-lg font-black text-rose-400">{section.data.totalDebt.toLocaleString()} <span className="text-[10px] font-normal opacity-70">د.ع</span></p>
                        </div>
                        <div className={\`bg-blue-950/40 backdrop-blur-sm rounded-2xl p-4 border \${section.data.totalWeOwe > 0 ? 'border-blue-500/50' : 'border-blue-900/30'}\`}>
                          <p className="text-xs text-blue-300 font-bold mb-1 flex items-center gap-1">🔵 أمانات (يطلبونا)</p>
                          <p className="text-lg font-black text-blue-400">{section.data.totalWeOwe.toLocaleString()} <span className="text-[10px] font-normal opacity-70">د.ع</span></p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>`;

content = content.replace(oldStatsRegex, newAuditBlock);

fs.writeFileSync(filePath, content);
console.log("Modifications applied successfully.");
