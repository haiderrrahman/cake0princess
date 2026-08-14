const fs = require('fs');
const file = 'src/app/admin/home-finance/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. handleAddFamilyNeed update
const oldHandleAdd = `    const title = fd.get("title") as string;\n    const category = fd.get("category") as string;\n    const qty = parseInt(fd.get("quantity") as string) || 1;\n    const member = fd.get("member") as string || activeFamilyMember;\n\n    if (!title.trim()) return;`;
const newHandleAdd = `    const title = fd.get("title") as string;\n    const category = fd.get("category") as string;\n    const qty = parseInt(fd.get("quantity") as string) || 1;\n    const estimatedPrice = parseFloat(fd.get("estimatedPrice") as string) || 0;\n    const priority = fd.get("priority") as string || "متوسط";\n    const notes = fd.get("notes") as string || "";\n    const member = fd.get("member") as string || activeFamilyMember;\n\n    if (!title.trim()) return;`;
content = content.replace(oldHandleAdd, newHandleAdd);

const oldEditMap = `        ...n,\n        title,\n        category,\n        quantity: qty,\n        member\n      } : n);`;
const newEditMap = `        ...n,\n        title,\n        category,\n        quantity: qty,\n        estimatedPrice,\n        priority,\n        notes,\n        member\n      } : n);`;
content = content.replace(oldEditMap, newEditMap);

const oldNewItem = `        category: category,\n        quantity: qty,\n        status: "pending",\n        createdAt: new Date().toISOString()\n      };`;
const newNewItem = `        category: category,\n        quantity: qty,\n        estimatedPrice: estimatedPrice,\n        priority: priority,\n        notes: notes,\n        status: "pending",\n        createdAt: new Date().toISOString()\n      };`;
content = content.replace(oldNewItem, newNewItem);

// 2. Family Need Card
const oldCard = `<p className="font-bold text-sm text-gray-800 dark:text-gray-200">{need.title}</p>\n                            <p className="text-[10px] text-gray-400">الكمية: {need.quantity || 1} • {need.category}</p>`;
const newCard = `<p className="font-bold text-sm text-gray-800 dark:text-gray-200">{need.title}</p>\n                            <p className="text-[10px] text-gray-400">الكمية: {need.quantity || 1} • {need.category} {need.priority ? \`• \${need.priority}\` : ''} {need.estimatedPrice ? \`• \${fmt(need.estimatedPrice)} د.ع\` : ''}</p>\n                            {need.notes && <p className="text-[10px] text-gray-500 mt-0.5 truncate max-w-[150px]">{need.notes}</p>}`;
// Need to replace this twice, for pending needs and available needs
content = content.replace(oldCard, newCard);
content = content.replace(oldCard, newCard);

// 3. Family Need Modal Form
const oldFormQuantity = `              <div>\n                <label className="block text-xs font-bold text-gray-500 mb-1.5">العدد / الكمية</label>\n                <input name="quantity" type="number" required defaultValue={editFamilyNeed?.quantity || 1} min="1"\n                  className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition" />\n              </div>`;
const newFormQuantity = `              <div className="grid grid-cols-2 gap-3">\n                <div>\n                  <label className="block text-xs font-bold text-gray-500 mb-1.5">العدد / الكمية</label>\n                  <input name="quantity" type="number" required defaultValue={editFamilyNeed?.quantity || 1} min="1"\n                    className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition" />\n                </div>\n                <div>\n                  <label className="block text-xs font-bold text-gray-500 mb-1.5">السعر التقريبي (اختياري)</label>\n                  <input name="estimatedPrice" type="number" defaultValue={editFamilyNeed?.estimatedPrice || ""}\n                    className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition" />\n                </div>\n              </div>\n              <div className="grid grid-cols-2 gap-3">\n                <div>\n                  <label className="block text-xs font-bold text-gray-500 mb-1.5">الأولوية</label>\n                  <select name="priority" defaultValue={editFamilyNeed?.priority || "متوسط"}\n                    className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition appearance-none cursor-pointer">\n                    <option value="عالي">عالي (مهم جداً)</option>\n                    <option value="متوسط">متوسط</option>\n                    <option value="منخفض">منخفض (لاحقاً)</option>\n                  </select>\n                </div>\n                <div>\n                  <label className="block text-xs font-bold text-gray-500 mb-1.5">ملاحظات (اختياري)</label>\n                  <input name="notes" type="text" defaultValue={editFamilyNeed?.notes || ""}\n                    className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition" placeholder="مثلاً مقاس، نوع محدد..." />\n                </div>\n              </div>`;
content = content.replace(oldFormQuantity, newFormQuantity);

fs.writeFileSync(file, content);
console.log('Stage 3 done.');
