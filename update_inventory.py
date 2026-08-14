import re

with open("src/app/admin/inventory/page.tsx", "r") as f:
    content = f.read()

# 1. Add EditInventoryModal import
if "import EditInventoryModal" not in content:
    content = content.replace(
        "import Image from \"next/image\";",
        "import Image from \"next/image\";\nimport EditInventoryModal from \"@/components/EditInventoryModal\";"
    )

# 2. Add showEditInventory state
if "showEditInventory" not in content:
    content = content.replace(
        "const [isModalOpen, setIsModalOpen] = useState(false);",
        "const [isModalOpen, setIsModalOpen] = useState(false);\n  const [showEditInventory, setShowEditInventory] = useState<any>(null);"
    )

# 3. Add EditInventoryModal render inside the main div or at the end
if "<EditInventoryModal" not in content:
    content = content.replace(
        "{isModalOpen && (",
        "{showEditInventory && (\n        <EditInventoryModal\n          isOpen={true}\n          onClose={() => setShowEditInventory(null)}\n          item={showEditInventory}\n          onEditSuccess={() => { fetchItems(); }}\n        />\n      )}\n\n      {/* Add Modal */}\n      {isModalOpen && ("
    )

# 4. Update the Autocomplete logic in Add Modal
old_auto = "items.filter(i => i.name.includes(name)).map(i => ("
new_auto = "Array.from(new Set(items.map(i => i.name))).filter(n => n.includes(name)).map(n => ("
content = content.replace(old_auto, new_auto)
content = content.replace("setName(i.name);", "setName(n);")
content = content.replace("{i.name}", "{n}")
content = content.replace("key={i.id}", "key={n}")

# 5. Define the new Card component UI string
card_ui_template = """<div key={item.id} className="bg-white dark:bg-zinc-900 rounded-[24px] p-4 border border-gray-100 dark:border-zinc-800 shadow-sm flex items-stretch gap-4 relative">
                              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-50 dark:bg-zinc-800 flex-shrink-0 relative border border-gray-100 dark:border-zinc-700 flex items-center justify-center">
                                {item.imageUrl ? (
                                  <Image src={item.imageUrl} alt={item.name} fill className="object-cover" />
                                ) : (
                                  <div className="text-3xl">
                                    {item.category === "كريمات" ? "🧁" : item.category === "حشوات" ? "🍫" : item.category === "طحين وسكر" ? "🌾" : item.category === "ألوان وإضافات" ? "🎨" : item.category === "تغليف وزينة" ? "🎀" : item.category === "أدوات" ? "🔧" : "📦"}
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex-1 flex flex-col justify-between">
                                <div>
                                  <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-2">
                                      <h3 className="text-sm font-black text-gray-900 dark:text-white">{item.name}</h3>
                                      <button onClick={() => setShowEditInventory(item)} className="text-gray-400 hover:text-blue-500 transition">
                                         <Edit3 className="w-4 h-4" />
                                      </button>
                                    </div>
                                    <button onClick={() => handleDelete(item.id)} className="text-gray-300 hover:text-red-500 transition">
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${CAT_COLORS[item.category] || "bg-gray-100 text-gray-600"}`}>
                                      {item.category}
                                    </span>
                                    <span className="bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 text-[10px] font-bold px-2 py-0.5 rounded-md border border-orange-100 dark:border-orange-800/30">
                                      تنبيه عند: {item.minAlert}
                                    </span>
                                  </div>
                                </div>
                                
                                <div className="flex items-end justify-between mt-3">
                                  <div>
                                    <p className="text-[10px] text-gray-500 font-bold mb-0.5">المتوفر</p>
                                    <p className="text-lg font-black text-emerald-600">{item.quantity} <span className="text-[10px]">{item.unit}</span></p>
                                  </div>
                                  
                                  {/* Stepper */}
                                  <div className="flex items-center gap-3 bg-gray-50 dark:bg-zinc-800/50 rounded-full px-1.5 py-1 border border-gray-100 dark:border-zinc-700">
                                    <button onClick={() => updateInventoryQuantity(item.id, Number(item.quantity), -1)} className="w-6 h-6 rounded-full text-red-500 font-black text-lg flex items-center justify-center hover:bg-white dark:hover:bg-zinc-700 shadow-sm transition leading-none pb-0.5">-</button>
                                    <span className="font-black text-sm text-gray-900 dark:text-white w-4 text-center">{item.quantity}</span>
                                    <button onClick={() => updateInventoryQuantity(item.id, Number(item.quantity), 1)} className="w-6 h-6 rounded-full text-emerald-500 font-black text-lg flex items-center justify-center hover:bg-white dark:hover:bg-zinc-700 shadow-sm transition leading-none pb-0.5">+</button>
                                  </div>
                                </div>
                              </div>
                            </div>"""


# 6. Replace the old "Needed" card block
needed_pattern = re.compile(r'<div key=\{item\.id\} className="bg-orange-50/50.*?</div>\s*</div>\s*</div>', re.DOTALL)
content = needed_pattern.sub(card_ui_template.replace('\\', '\\\\'), content, count=1)

# 7. Replace the old "Available" card block
available_pattern = re.compile(r'<div key=\{item\.id\} className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-gray-100.*?</div>\s*</div>\s*</div>', re.DOTALL)
content = available_pattern.sub(card_ui_template.replace('\\', '\\\\'), content, count=1)


with open("src/app/admin/inventory/page.tsx", "w") as f:
    f.write(content)
