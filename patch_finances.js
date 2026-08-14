const fs = require('fs');
let content = fs.readFileSync('src/app/admin/finances/page.tsx', 'utf-8');

// Fix paidByHaider default
content = content.replace(
  "if (e.paidBy === 'haider') return s + (Number(e.amount) || 0);",
  "if (e.paidBy === 'haider' || !e.paidBy) return s + (Number(e.amount) || 0);"
);

// Add validation to handleAddExpense
content = content.replace(
  "pCake = Number(splitCake) || 0;\n      }",
  "pCake = Number(splitCake) || 0;\n        if (pHaider + pCake !== amt) {\n          toast.error(\"مجموع الدفع المقسم يجب أن يساوي المبلغ الكلي!\");\n          setSubmitting(false);\n          return;\n        }\n      }"
);

fs.writeFileSync('src/app/admin/finances/page.tsx', content);
