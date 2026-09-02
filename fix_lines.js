const fs = require('fs');
const lines = fs.readFileSync('src/app/admin/home-finance/page.tsx', 'utf8').split('\n');

const before = lines.slice(0, 2294);
const quickActions = lines.slice(2294, 2318);
const alerts = lines.slice(2320, 2349);
const decor = lines.slice(2349, 2352);
const family = lines.slice(2352, 2357);
const fin = lines.slice(2357, 2563);
const after = lines.slice(2563);

const newLines = [
  ...before,
  ...quickActions,
  ...fin,
  ...family,
  ...alerts,
  ...decor,
  ...after
];

fs.writeFileSync('src/app/admin/home-finance/page.tsx', newLines.join('\n'));
console.log("Success");
