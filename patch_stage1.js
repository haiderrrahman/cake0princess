const fs = require('fs');
const file = 'src/app/admin/home-finance/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. FamilyMemberNeed Interface
content = content.replace(
  `interface FamilyMemberNeed {\n  id: string;\n  member: string; // "حيدر" | "إيمان" | "رقية" | "قنوت" | "إيڤا"\n  title: string;\n  category: string;\n  quantity?: number;\n  status: "pending" | "available";\n  createdAt: string;\n}`,
  `interface FamilyMemberNeed {\n  id: string;\n  member: string; // "حيدر" | "إيمان" | "رقية" | "قنوت" | "إيڤا"\n  title: string;\n  category: string;\n  quantity?: number;\n  estimatedPrice?: number;\n  priority?: string;\n  notes?: string;\n  status: "pending" | "available";\n  createdAt: string;\n}`
);

// 2. Categories
content = content.replace(
  `const HOME_INVENTORY_CATEGORIES = [\n  "سوبر ماركت", "منظفات", "خضروات", "فواكه", "لحوم", "أدوات منزلية", "صيانة", "أخرى"\n];`,
  `const HOME_INVENTORY_CATEGORIES = [\n  "سوبر ماركت", "منظفات", "خضروات", "فواكه", "لحوم", "أدوات منزلية", "صيانة", "أخرى"\n];\nconst CAR_INVENTORY_CATEGORIES = [\n  "صيانة", "وقود", "غسيل وتنظيف", "إكسسوارات", "أوراق وفحص", "أخرى"\n];\nconst TRAVEL_INVENTORY_CATEGORIES = [\n  "تذاكر", "فنادق", "أمتعة", "تأشيرات", "مستلزمات شخصية", "مأكولات ومشروبات", "أخرى"\n];`
);

// 3. activeFamilyMember default to إيمان
content = content.replace(
  `const [activeFamilyMember, setActiveFamilyMember] = useState("رقية");`,
  `const [activeFamilyMember, setActiveFamilyMember] = useState("إيمان");`
);

// 4. settings state
content = content.replace(
  `  const [newFamilyNeedCategory, setNewFamilyNeedCategory] = useState("عائلة");\n\n  const [mounted, setMounted] = useState(false);`,
  `  const [newFamilyNeedCategory, setNewFamilyNeedCategory] = useState("عائلة");\n  const [settings, setSettings] = useState<{ manualCycleStarts?: string[] }>({ manualCycleStarts: [] });\n\n  const [mounted, setMounted] = useState(false);`
);

// 5. settings sync
content = content.replace(
  `const keys: ("installments" | "bills" | "expenses" | "incomes" | "inventory" | "carInventory" | "travelInventory" | "needs" | "debts" | "familyNeeds")[] = [\n      "installments", "bills", "expenses", "incomes", "inventory", "carInventory", "travelInventory", "needs", "debts", "familyNeeds"\n    ];\n    const setters: any = {\n      installments: setInstallments,\n      bills: setBills,\n      expenses: setExpenses,\n      incomes: setIncomes,\n      inventory: setInventory,\n      carInventory: setCarInventory,\n      travelInventory: setTravelInventory,\n      needs: setNeeds,\n      debts: setDebts,\n      familyNeeds: setFamilyNeeds,\n    };`,
  `const keys: ("installments" | "bills" | "expenses" | "incomes" | "inventory" | "carInventory" | "travelInventory" | "needs" | "debts" | "familyNeeds" | "settings")[] = [\n      "installments", "bills", "expenses", "incomes", "inventory", "carInventory", "travelInventory", "needs", "debts", "familyNeeds", "settings"\n    ];\n    const setters: any = {\n      installments: setInstallments,\n      bills: setBills,\n      expenses: setExpenses,\n      incomes: setIncomes,\n      inventory: setInventory,\n      carInventory: setCarInventory,\n      travelInventory: setTravelInventory,\n      needs: setNeeds,\n      debts: setDebts,\n      familyNeeds: setFamilyNeeds,\n      settings: setSettings,\n    };`
);

fs.writeFileSync(file, content);
console.log('Stage 1 done.');
