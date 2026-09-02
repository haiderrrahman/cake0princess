const fs = require('fs');
let content = fs.readFileSync('src/app/admin/home-finance/page.tsx', 'utf8');

const compRegex = /\{\/\* Family Competition Feature \*\/\}\n\s*<div className="mb-8">\n\s*<FamilyCompetition \/>\n\s*<\/div>/s;
const compMatch = content.match(compRegex);

const headerRegex = /<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-l from-indigo-900\/40 via-purple-900\/20 to-transparent p-5 rounded-3xl border border-indigo-500\/20">\n\s*<div>\n\s*<h2 className="font-black text-gray-800 dark:text-white flex items-center gap-2 text-lg">\n\s*<Users className="w-6 h-6 text-indigo-500" \/>\n\s*إدارة طلبات وواجبات العائلة\n\s*<\/h2>\n\s*<p className="text-xs text-indigo-700\/60 dark:text-indigo-300\/80 font-bold mt-1">تصنيف شامل للمسؤوليات والاحتياجات لكل فرد من أفراد العائلة<\/p>\n\s*<\/div>\n\s*<\/div>/s;
const headerMatch = content.match(headerRegex);

if (compMatch && headerMatch) {
  // Remove comp
  content = content.replace(compMatch[0], '');
  
  // Insert it before header
  const headerMatchAgain = content.match(headerRegex);
  const beforeHeader = headerMatchAgain.index;
  
  content = content.slice(0, beforeHeader) + compMatch[0] + '\n\n            ' + content.slice(beforeHeader);
  console.log("Moved family comp!");
} else {
  console.log("Match failed!");
  console.log(bool(compMatch), bool(headerMatch));
}

fs.writeFileSync('src/app/admin/home-finance/page.tsx', content);

