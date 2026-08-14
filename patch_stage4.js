const fs = require('fs');
const file = 'src/app/admin/home-finance/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Modal 1
const oldModal1 = `              <div>\n                <label className="label-sm">الفئة</label>\n                <select name="category" defaultValue={editInventory?.category || "سوبر ماركت"} className="input-field">\n                  {HOME_INVENTORY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}\n                </select>\n              </div>`;
const newModal1 = `              <div>\n                <label className="label-sm">الفئة</label>\n                <select name="category" defaultValue={editInventory?.category || (activeTab === "car" ? "صيانة" : activeTab === "travel" ? "أمتعة" : "سوبر ماركت")} className="input-field">\n                  {(activeTab === "car" ? CAR_INVENTORY_CATEGORIES : activeTab === "travel" ? TRAVEL_INVENTORY_CATEGORIES : HOME_INVENTORY_CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}\n                </select>\n              </div>`;
content = content.replace(oldModal1, newModal1);

// Modal 2 (Quick Add)
const oldModal2 = `                  <div>\n                    <label className="block text-xs font-bold text-gray-500 mb-1.5">التصنيف</label>\n                    <select name="category" defaultValue={editNeed?.category || "سوبر ماركت"}\n                      className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-orange-500/50 outline-none">\n                      {HOME_INVENTORY_CATEGORIES.map(c => <option key={c}>{c}</option>)}\n                    </select>\n                  </div>`;
const newModal2 = `                  <div>\n                    <label className="block text-xs font-bold text-gray-500 mb-1.5">التصنيف</label>\n                    <select name="category" defaultValue={editNeed?.category || (activeTab === "car" ? "صيانة" : activeTab === "travel" ? "أمتعة" : "سوبر ماركت")}\n                      className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-orange-500/50 outline-none">\n                      {(activeTab === "car" ? CAR_INVENTORY_CATEGORIES : activeTab === "travel" ? TRAVEL_INVENTORY_CATEGORIES : HOME_INVENTORY_CATEGORIES).map(c => <option key={c}>{c}</option>)}\n                    </select>\n                  </div>`;
content = content.replace(oldModal2, newModal2);

fs.writeFileSync(file, content);
console.log('Stage 4 done.');
