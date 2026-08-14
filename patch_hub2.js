const fs = require('fs');
let content = fs.readFileSync('src/app/admin/hub/page.tsx', 'utf-8');

// The state: const [purchaseSource, setPurchaseSource] = useState<Record<string, 'haider' | 'cake'>>({});
content = content.replace(
  "const [purchaseSource, setPurchaseSource] = useState<Record<string, 'haider' | 'cake'>>({});",
  "const [purchaseSource, setPurchaseSource] = useState<Record<string, 'haider' | 'cake' | 'split'>>({});\n  const [splitAmounts, setSplitAmounts] = useState<Record<string, {haider: string, cake: string}>>({});"
);

// We need to change the buttons in the widget.
const buttonsOld = `<div className="grid grid-cols-2 gap-1 mb-2">
                                  <button
                                    onClick={() => setPurchaseSource(prev => ({ ...prev, [i.id]: 'haider' }))}
                                    className={\`text-[9px] font-black py-1.5 rounded-xl transition border flex items-center justify-center gap-1 \${
                                      source === 'haider'
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                        : 'bg-white dark:bg-zinc-800 text-gray-500 border-gray-200 dark:border-zinc-700'
                                    }\`}
                                  >👤 راتب</button>
                                  <button
                                    onClick={() => setPurchaseSource(prev => ({ ...prev, [i.id]: 'cake' }))}
                                    className={\`text-[9px] font-black py-1.5 rounded-xl transition border flex items-center justify-center gap-1 \${
                                      source === 'cake'
                                        ? 'bg-pink-600 text-white border-pink-600 shadow-sm'
                                        : 'bg-white dark:bg-zinc-800 text-gray-500 border-gray-200 dark:border-zinc-700'
                                    }\`}
                                  >🎂 كيك</button>
                                </div>`;

const buttonsNew = `<div className="grid grid-cols-3 gap-1 mb-2">
                                  <button onClick={() => setPurchaseSource(prev => ({ ...prev, [i.id]: 'haider' }))} className={\`text-[9px] font-black py-1.5 rounded-xl transition border flex items-center justify-center gap-1 \${source === 'haider' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white dark:bg-zinc-800 text-gray-500 border-gray-200 dark:border-zinc-700'}\`}>👤 راتب</button>
                                  <button onClick={() => setPurchaseSource(prev => ({ ...prev, [i.id]: 'cake' }))} className={\`text-[9px] font-black py-1.5 rounded-xl transition border flex items-center justify-center gap-1 \${source === 'cake' ? 'bg-pink-600 text-white border-pink-600 shadow-sm' : 'bg-white dark:bg-zinc-800 text-gray-500 border-gray-200 dark:border-zinc-700'}\`}>🎂 كيك</button>
                                  <button onClick={() => setPurchaseSource(prev => ({ ...prev, [i.id]: 'split' }))} className={\`text-[9px] font-black py-1.5 rounded-xl transition border flex items-center justify-center gap-1 \${source === 'split' ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-white dark:bg-zinc-800 text-gray-500 border-gray-200 dark:border-zinc-700'}\`}>✂️ مقسم</button>
                                </div>
                                
                                {source === 'split' && (
                                  <div className="flex gap-1 mb-2">
                                    <input type="number" placeholder="راتب" className="w-1/2 text-[10px] font-bold p-1.5 rounded border dark:bg-zinc-800 dark:border-zinc-700" value={splitAmounts[i.id]?.haider || ''} onChange={e => setSplitAmounts(p => ({...p, [i.id]: {...(p[i.id]||{cake:''}), haider: e.target.value}}))} />
                                    <input type="number" placeholder="كيك" className="w-1/2 text-[10px] font-bold p-1.5 rounded border dark:bg-zinc-800 dark:border-zinc-700" value={splitAmounts[i.id]?.cake || ''} onChange={e => setSplitAmounts(p => ({...p, [i.id]: {...(p[i.id]||{haider:''}), cake: e.target.value}}))} />
                                  </div>
                                )}`;

content = content.replace(buttonsOld, buttonsNew);

// Update purchase logic
const purchaseLogicOld = `const paidBy = purchaseSource[i.id] || 'haider';
                                  try {
                                    await updateDoc(doc(db, "cake_inventory", i.id), {
                                      quantity: increment(neededQty),
                                      neededQuantity: 0,
                                      lastUpdated: serverTimestamp()
                                    });
                                    if (cost > 0) {
                                      await addDoc(collection(db, "expenses"), {
                                        title: \`شراء للمخزن: \${i.name}\`,
                                        amount: cost,
                                        category: "مواد الكيك",
                                        paidBy,
                                        createdAt: serverTimestamp(),
                                        isInventoryExpense: true
                                      });
                                    }
                                    setPurchaseSource(prev => { const n = { ...prev }; delete n[i.id]; return n; });
                                    fetchAll();`;

const purchaseLogicNew = `const paidBy = purchaseSource[i.id] || 'haider';
                                  if (paidBy === 'split') {
                                    const sh = Number(splitAmounts[i.id]?.haider) || 0;
                                    const sc = Number(splitAmounts[i.id]?.cake) || 0;
                                    if (sh + sc !== cost) {
                                      toast.error("مجموع الدفع المقسم يجب أن يساوي التكلفة!");
                                      return;
                                    }
                                  }

                                  try {
                                    await updateDoc(doc(db, "cake_inventory", i.id), {
                                      quantity: increment(neededQty),
                                      neededQuantity: 0,
                                      lastUpdated: serverTimestamp()
                                    });
                                    if (cost > 0) {
                                      const expData: any = {
                                        title: \`شراء للمخزن: \${i.name}\`,
                                        amount: cost,
                                        category: "مواد الكيك",
                                        paidBy,
                                        createdAt: serverTimestamp(),
                                        isInventoryExpense: true
                                      };
                                      if (paidBy === 'split') {
                                        expData.paidByHaider = Number(splitAmounts[i.id]?.haider) || 0;
                                        expData.paidByCake = Number(splitAmounts[i.id]?.cake) || 0;
                                      }
                                      await addDoc(collection(db, "expenses"), expData);
                                    }
                                    setPurchaseSource(prev => { const n = { ...prev }; delete n[i.id]; return n; });
                                    setSplitAmounts(prev => { const n = { ...prev }; delete n[i.id]; return n; });
                                    fetchAll();`;

content = content.replace(purchaseLogicOld, purchaseLogicNew);

fs.writeFileSync('src/app/admin/hub/page.tsx', content);
