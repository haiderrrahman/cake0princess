const fs = require('fs');
let content = fs.readFileSync('src/app/admin/home-finance/page.tsx', 'utf8');

const finRegex = /\{\/\* Financial Cycle moved from Header \*\/\}.*?PREMIUM BUDGET BREAKDOWN SECTION\n\s*══════════════════════════════════════════ \*\/\}\n\s*<\/div>/s;
const finMatch = content.match(finRegex);

if (finMatch) {
  content = content.replace(finMatch[0], '');
  
  // Find where to insert it: right above {/* Quick Actions Grid */}
  // But wait, the user wanted it right after Quick Actions Grid? No, user wanted it at the top.
  // Wait, let's just insert Fin at the top of the space-y-4 div.
  const insertIndex = content.indexOf('{/* Quick Actions Grid */}');
  
  content = content.slice(0, insertIndex) + finMatch[0] + '\n\n            ' + content.slice(insertIndex);
  
  console.log("Moved fin block!");
} else {
  console.log("fin match failed");
}

const compRegex = /\{\/\* Family Competition Overview \*\/\}\n\s*<div className="mb-4">\n\s*<FamilyCompetitionOverview onClick=\{.*?\} \/>\n\s*<\/div>/s;
const compMatch = content.match(compRegex);

if (compMatch) {
  content = content.replace(compMatch[0], '');
  // Insert it after Fin Block. The Fin block is now at the top.
  // We can insert it after Fin block finishes.
  const finInsertedRegex = /\{\/\* Financial Cycle moved from Header \*\/\}.*?PREMIUM BUDGET BREAKDOWN SECTION\n\s*══════════════════════════════════════════ \*\/\}\n\s*<\/div>/s;
  const finInsertedMatch = content.match(finInsertedRegex);
  if (finInsertedMatch) {
    const afterFin = finInsertedMatch.index + finInsertedMatch[0].length;
    content = content.slice(0, afterFin) + '\n\n            ' + compMatch[0] + content.slice(afterFin);
    console.log("Moved comp block!");
  }
}

// Now Alerts Banner. It should be after Family Competition.
const alertRegex = /\{\/\* Alerts Banner \*\/\}\n\s*\{\(unpaidBillsCount.*?\}\)\}/s;
const alertMatch = content.match(alertRegex);
if (alertMatch) {
  content = content.replace(alertMatch[0], '');
  
  // Insert it after Family Competition.
  const compInsertedRegex = /\{\/\* Family Competition Overview \*\/\}\n\s*<div className="mb-4">\n\s*<FamilyCompetitionOverview onClick=\{.*?\} \/>\n\s*<\/div>/s;
  const compInsertedMatch = content.match(compInsertedRegex);
  if (compInsertedMatch) {
    const afterComp = compInsertedMatch.index + compInsertedMatch[0].length;
    content = content.slice(0, afterComp) + '\n\n            ' + alertMatch[0] + content.slice(afterComp);
    console.log("Moved alerts block!");
  }
}

fs.writeFileSync('src/app/admin/home-finance/page.tsx', content);

