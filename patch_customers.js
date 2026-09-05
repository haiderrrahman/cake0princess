const fs = require('fs');
const file = 'src/app/admin/customers/page.tsx';
let code = fs.readFileSync(file, 'utf8');

// Add handleToggleBlacklist
const toggleBlacklistFn = `
  const handleToggleBlacklist = async (customer: any) => {
    const newStatus = !customer.isBlacklisted;
    try {
      if (customer.source === "app") {
        await setDoc(doc(db, "users", customer.id), { isBlacklisted: newStatus }, { merge: true });
      } else {
        await setDoc(doc(db, "social_customers", customer.id), { isBlacklisted: newStatus }, { merge: true });
      }
      toast.success(newStatus ? "تمت إضافته للقائمة السوداء" : "تمت إزالته من القائمة السوداء");
      
      // Update local state
      const updatedMap = new Map(extCustomersMap);
      const cust = updatedMap.get(customer.id);
      if (cust) {
        cust.isBlacklisted = newStatus;
        updatedMap.set(customer.id, cust);
        setExtCustomersMap(updatedMap);
      }
      
      setCustomers(customers.map(c => c.id === customer.id ? { ...c, isBlacklisted: newStatus } : c));
    } catch (e) {
      toast.error("حدث خطأ أثناء التحديث");
    }
  };
`;
if (!code.includes('handleToggleBlacklist')) {
  code = code.replace(/const handleCloseProfileModal = \(\) => \{/, toggleBlacklistFn + '\n  const handleCloseProfileModal = () => {');
}

// Add ShieldAlert icon to imports
if (!code.includes('ShieldAlert')) {
  code = code.replace(/User,/, 'User, ShieldAlert,');
}

// Add the button in the UI
const actionButtons = `
                    <button
                      onClick={() => handleToggleBlacklist(customer)}
                      className={\`\${customer.isBlacklisted ? "bg-red-900/40 text-red-400 hover:bg-red-900/60" : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"} px-2 py-1.5 rounded-lg flex items-center justify-center transition-colors\`}
                      title={customer.isBlacklisted ? "إزالة من القائمة السوداء" : "إضافة للقائمة السوداء"}
                    >
                      <ShieldAlert className="w-4 h-4" />
                    </button>
`;
code = code.replace(/<button\s+onClick=\{\(\) => setSelectedCustomerForProfile\(customer\)\}/, actionButtons + '\n                    <button\n                      onClick={() => setSelectedCustomerForProfile(customer)}');

// Show warning label on the customer card if blacklisted
const blacklistedBadge = `
                        {customer.isBlacklisted && (
                          <span className="bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-lg border border-red-400">محظور</span>
                        )}
`;
code = code.replace(/\{customer\.role === 'admin' && \(/, blacklistedBadge + '\n                        {customer.role === \'admin\' && (');

// Dim the row if blacklisted
code = code.replace(/className="flex items-center justify-between p-4 bg-white\/5 border border-white\/5 rounded-2xl hover:bg-white\/10 transition-colors"/, 'className={`flex items-center justify-between p-4 border rounded-2xl transition-colors ${customer.isBlacklisted ? "bg-red-950/20 border-red-900/30 opacity-70 hover:bg-red-900/30" : "bg-white/5 border-white/5 hover:bg-white/10"}`}');

fs.writeFileSync(file, code);
