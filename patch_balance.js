const fs = require('fs');
const file = 'src/app/admin/home-finance/page.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /const balance = totalIncome - totalExpensesAmt;/,
  'const balance = totalIncome - totalExpensesAmt - totalDebtsOnMe + totalDebtsForMe;'
);

fs.writeFileSync(file, code);
