const fs = require('fs');
const lines = fs.readFileSync('src/app/admin/home-finance/page.tsx', 'utf8').split('\n');

const before = lines.slice(0, 4035);
const header = lines.slice(4035, 4044);
const comp = lines.slice(4044, 4049);
const after = lines.slice(4049);

const newLines = [
  ...before,
  ...comp,
  ...header,
  ...after
];

fs.writeFileSync('src/app/admin/home-finance/page.tsx', newLines.join('\n'));
console.log("Success");
