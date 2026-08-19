const fs = require('fs');

const filePath = '/Users/haiderrahman/Work/antigravity/كيك-الاميرة/src/app/admin/home-finance/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add customConfirm import if missing
if (!content.includes('import { customConfirm }')) {
  content = content.replace(
    /import { Toaster, toast } from "react-hot-toast";/,
    'import { Toaster, toast } from "react-hot-toast";\nimport { customConfirm } from "@/lib/customConfirm";'
  );
}

// 2. Fix handleDelete functions to use customConfirm
const deleteFunctions = [
  'handleDeleteFuturePlan',
  'handleDeleteInstallment',
  'handleDeleteBill',
  'handleDeleteExpense',
  'handleDeleteIncome',
  'handleDeleteInventoryItem',
  'handleDeleteNeed',
  'handleDeleteFamilyNeed',
  'handleDeleteDebt',
  'handleDeleteTrip',
  'handleDeleteTripExpense'
];

deleteFunctions.forEach(fnName => {
  const regex = new RegExp(`(const ${fnName} = (?:async )?\\([^)]*\\) => {\\s*)`, 'g');
  content = content.replace(regex, `$1if (!(await customConfirm("هل أنت متأكد من الحذف؟"))) return;\n    `);
});

// Since the handlers are now using await, we need to make sure they are async
deleteFunctions.forEach(fnName => {
  const regex = new RegExp(`const ${fnName} = \\(([^)]*)\\) => {`);
  content = content.replace(regex, `const ${fnName} = async ($1) => {`);
});

// 3. Update handleSave functions to close after 2 seconds
const saveFunctions = [
  { name: 'handleSaveFuturePlan', modals: ['setShowFuturePlanModal', 'setEditPlan'] },
  { name: 'handleSaveInstallment', modals: ['setShowInstallmentModal', 'setEditInstallment'] },
  { name: 'handleSaveBill', modals: ['setShowBillModal', 'setEditBill'] },
  { name: 'handleSaveExpense', modals: ['setShowExpenseModal', 'setEditExpense'] },
  { name: 'handleSaveIncome', modals: ['setShowIncomeModal', 'setEditIncome'] },
  { name: 'handleSaveInventory', modals: ['setShowInventoryModal', 'setEditInventoryItem'] },
  { name: 'handleSaveNeed', modals: ['setShowNeedModal', 'setEditNeed'] },
  { name: 'handleSaveDebt', modals: ['setShowDebtModal', 'setEditDebt'] },
  { name: 'handleSaveTrip', modals: ['setShowTripModal'] },
  { name: 'handleSaveTripExpense', modals: ['setShowTripExpModal'] }
];

saveFunctions.forEach(fn => {
  const closeStatements = fn.modals.map(m => `${m}(false);`).join('\\s*');
  const closeStatementsNull = fn.modals.map(m => `${m}(null);`).join('\\s*');
  
  // Replace direct state setting with setTimeout
  const regexDirect = new RegExp(`(${fn.modals[0]}\\((?:false|null)\\);\\s*(?:${fn.modals[1]}\\((?:false|null)\\);\\s*)?)`, 'g');
  
  if (content.match(regexDirect)) {
    content = content.replace(regexDirect, `setTimeout(() => {\n      $1    }, 2000);\n`);
  }
});

fs.writeFileSync(filePath, content);
console.log("Modifications applied successfully.");
