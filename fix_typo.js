const fs = require('fs');
const file = 'src/app/admin/home-finance/page.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace("  // ─────────  const cycles = useMemo(() => {", "  // ──────────────────────────────────────────\n  const cycles = useMemo(() => {");
fs.writeFileSync(file, content);
console.log("Fixed typo");
