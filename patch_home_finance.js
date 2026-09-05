const fs = require('fs');
const file = 'src/app/admin/home-finance/page.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add state for totalSalaryDebt
if (!code.includes('const [cakeDebtAmount')) {
  code = code.replace(/const \[debts, setDebts\] = useState<Debt\[\]>\(\[\]\);/, `const [debts, setDebts] = useState<Debt[]>([]);\n  const [cakeDebtAmount, setCakeDebtAmount] = useState<number>(0);`);
}

// 2. Fetch expenses to compute totalSalaryDebt
const fetchExpenses = `
    const unsubExpenses = onSnapshot(collection(db, "expenses"), (snap) => {
      const expensesList = snap.docs.map(doc => doc.data() as any);
      const totalDebt = expensesList.filter((e: any) => e.isDebt).reduce((s, e: any) => s + (Number(e.amount) || 0), 0);
      setCakeDebtAmount(totalDebt);
    });
`;
code = code.replace(/const unsubscribers = keys\.map/, fetchExpenses + '\n    const unsubscribers = keys.map');

// 3. Clean up unsubExpenses
code = code.replace(/return \(\) => unsubscribers\.forEach\(u => u\(\)\);/, 'return () => { unsubscribers.forEach(u => u()); unsubExpenses(); };');

// 4. Inject cakeDebtAmount into debts array dynamically when rendering or computing balances!
// Instead of mutating state, I will override the "debts" array locally in the render logic or replace the existing one.
const injectCakeDebt = `
  // Sync Cake Debt
  const displayDebts = [...debts];
  const existingCakeDebtIdx = displayDebts.findIndex(d => d.person === "الكيك" || d.title?.includes("الكيك"));
  if (existingCakeDebtIdx !== -1) {
    const existing = displayDebts[existingCakeDebtIdx];
    const totalPayments = existing.payments ? existing.payments.reduce((s, p) => s + p.amount, 0) : 0;
    // Set the base amount such that (amount - payments) = cakeDebtAmount
    // Thus amount = cakeDebtAmount + payments
    displayDebts[existingCakeDebtIdx] = { ...existing, amount: cakeDebtAmount + totalPayments };
  } else if (cakeDebtAmount > 0) {
    displayDebts.push({
      id: "cake_debt_auto",
      person: "الكيك",
      title: "دين الكيك (مستورد تلقائياً)",
      amount: cakeDebtAmount,
      type: "دين لي",
      date: new Date().toISOString(),
      payments: [],
      createdAt: new Date().toISOString()
    } as any);
  }
`;
code = code.replace(/const isBillPaidThisCycle = \(b: Bill\) =>/, injectCakeDebt + '\n\n  const isBillPaidThisCycle = (b: Bill) =>');

// Replace all usages of 'debts' with 'displayDebts' in the render/calculation part!
// Actually, it's safer to just replace `debts.filter` with `displayDebts.filter` and `debts.map` with `displayDebts.map`
code = code.replace(/debts\.filter/g, 'displayDebts.filter');
code = code.replace(/debts\.map/g, 'displayDebts.map');
code = code.replace(/debts\.length/g, 'displayDebts.length');

fs.writeFileSync(file, code);
