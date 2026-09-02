const fs = require('fs');
const lines = fs.readFileSync('src/app/admin/home-finance/page.tsx', 'utf8').split('\n');
const familyIdx = lines.findIndex(l => l.includes('{/* ═══════════════ FAMILY NEEDS TAB ═══════════════ */}'));
for(let i=familyIdx; i<familyIdx+30; i++) console.log(`${i}: ${lines[i]}`);
