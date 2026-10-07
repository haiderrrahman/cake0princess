"use client";
import { useState, useEffect } from "react";
import { 
  X, Plus, Trash2, Calculator, Sparkles, Check, Bookmark, 
  Layers, DollarSign, ChefHat, Flame, Image as ImageIcon, Box,
  ChevronDown, HelpCircle, Save, RefreshCw
} from "lucide-react";
import { 
  CakeCostBreakdown, CakeIngredientItem, CakeOverheadExpenses,
  calculateItemCost, recalculateBreakdown, BUILT_IN_CAKE_TEMPLATES,
  getSavedRecipeTemplates, saveRecipeTemplate 
} from "@/lib/cakeCostCalculator";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import FormattedNumberInput from "./FormattedNumberInput";

interface CakeCostBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialBreakdown?: CakeCostBreakdown | null;
  cakeName?: string;
  initialSellingPrice?: number;
  onApplyCost: (totalCost: number, breakdown: CakeCostBreakdown) => void;
}

export default function CakeCostBreakdownModal({
  isOpen,
  onClose,
  initialBreakdown,
  cakeName = "",
  initialSellingPrice = 0,
  onApplyCost
}: CakeCostBreakdownModalProps) {
  // Load initial recipe from breakdown prop, or from default 12-item template
  const defaultTemplate = BUILT_IN_CAKE_TEMPLATES[0].breakdown;

  const [ingredients, setIngredients] = useState<CakeIngredientItem[]>(() => {
    return initialBreakdown?.ingredients?.length 
      ? initialBreakdown.ingredients 
      : defaultTemplate.ingredients;
  });

  const [overhead, setOverhead] = useState<CakeOverheadExpenses>(() => {
    return initialBreakdown?.overhead || defaultTemplate.overhead;
  });

  const [cakeTitle, setCakeTitle] = useState(() => initialBreakdown?.cakeTitle || cakeName || "كيكة مخصصة");
  const [sellingPrice, setSellingPrice] = useState(() => initialSellingPrice || initialBreakdown?.suggestedSellingPrice || 25000);

  // Template states
  const [templates, setTemplates] = useState<{ id: string; name: string; description?: string; breakdown: CakeCostBreakdown }[]>(BUILT_IN_CAKE_TEMPLATES);
  const [selectedTemplateId, setSelectedTemplateId] = useState(BUILT_IN_CAKE_TEMPLATES[0].id);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");

  // Inventory items for autocomplete
  const [inventoryList, setInventoryList] = useState<any[]>([]);

  // Fetch templates & inventory
  useEffect(() => {
    if (!isOpen) return;

    getSavedRecipeTemplates().then(setTemplates).catch(console.warn);

    getDocs(collection(db, "cake_inventory")).then(snap => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setInventoryList(items);
    }).catch(console.warn);
  }, [isOpen]);

  // Synchronize state when modal is opened or props change
  useEffect(() => {
    if (isOpen) {
      if (initialBreakdown?.ingredients?.length) {
        setIngredients(initialBreakdown.ingredients);
        setOverhead(initialBreakdown.overhead || defaultTemplate.overhead);
        setCakeTitle(initialBreakdown.cakeTitle || cakeName || "كيكة مخصصة");
        setSellingPrice(initialBreakdown.suggestedSellingPrice || initialSellingPrice || 25000);
      } else {
        setIngredients(defaultTemplate.ingredients);
        setOverhead(defaultTemplate.overhead);
        setCakeTitle(cakeName || "كيكة مخصصة");
        if (initialSellingPrice) setSellingPrice(initialSellingPrice);
      }
    }
  }, [isOpen, initialBreakdown, cakeName, initialSellingPrice]);

  // Recalculate everything live
  const currentBreakdown = recalculateBreakdown(
    ingredients,
    overhead,
    sellingPrice,
    cakeTitle
  );

  // Apply a template
  const handleLoadTemplate = (templateId: string) => {
    const tmpl = templates.find(t => t.id === templateId);
    if (!tmpl) return;
    setIngredients(tmpl.breakdown.ingredients);
    setOverhead(tmpl.breakdown.overhead);
    if (tmpl.breakdown.suggestedSellingPrice) {
      setSellingPrice(tmpl.breakdown.suggestedSellingPrice);
    }
    toast.success(`تم تحميل وصفة: ${tmpl.name}`);
  };

  // Add new blank or inventory ingredient
  const handleAddIngredient = (invItem?: any) => {
    const newId = `ing-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    if (invItem) {
      const packSize = invItem.unit === "كغم" || invItem.unit === "لتر" ? 1000 : 1;
      const packUnit = invItem.unit === "كغم" ? "غرام" : invItem.unit === "لتر" ? "مل" : invItem.unit || "غرام";
      const packPrice = Number(invItem.price || invItem.cost || 0);

      const newItem: CakeIngredientItem = {
        id: newId,
        name: invItem.name || "مادة مخزنية",
        category: invItem.category || "أخرى",
        packageSize: packSize,
        packageUnit: packUnit,
        packagePrice: packPrice,
        usedQuantity: packSize === 1000 ? 100 : 1,
        usedUnit: packUnit,
        itemCost: calculateItemCost(packSize, packUnit, packPrice, packSize === 1000 ? 100 : 1, packUnit),
        inventoryItemId: invItem.id
      };
      setIngredients(prev => [...prev, newItem]);
    } else {
      const newItem: CakeIngredientItem = {
        id: newId,
        name: "",
        category: "أخرى",
        packageSize: 1000,
        packageUnit: "غرام",
        packagePrice: 1500,
        usedQuantity: 100,
        usedUnit: "غرام",
        itemCost: 150
      };
      setIngredients(prev => [...prev, newItem]);
    }
  };

  // Update ingredient field
  const handleUpdateIngredient = (id: string, field: keyof CakeIngredientItem, val: any) => {
    setIngredients(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: val };
      updated.itemCost = calculateItemCost(
        updated.packageSize,
        updated.packageUnit,
        updated.packagePrice,
        updated.usedQuantity,
        updated.usedUnit
      );
      return updated;
    }));
  };

  // Delete ingredient
  const handleDeleteIngredient = (id: string) => {
    setIngredients(prev => prev.filter(i => i.id !== id));
  };

  // Save as new custom template
  const handleSaveAsTemplate = async () => {
    if (!newTemplateName.trim()) {
      toast.error("يرجى إدخال اسم الوصفة");
      return;
    }
    try {
      await saveRecipeTemplate(newTemplateName, `وصفة مخصصة تتضمن ${ingredients.length} مادة`, currentBreakdown);
      const updatedList = await getSavedRecipeTemplates();
      setTemplates(updatedList);
      setShowSaveTemplateModal(false);
      setNewTemplateName("");
      toast.success("تم حفظ قالب الوصفة بنجاح 💾");
    } catch (e) {
      toast.error("حدث خطأ أثناء حفظ القالب");
    }
  };

  // Confirm and Apply to Order
  const handleConfirmAndApply = () => {
    onApplyCost(currentBreakdown.totalCakeCost, currentBreakdown);
    toast.success(`تم اعتماد تكلفة الكيكة: ${currentBreakdown.totalCakeCost.toLocaleString()} د.ع ✨`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* ═══════════ MODAL HEADER ═══════════ */}
        <div className="bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 p-4 sm:p-5 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
              <ChefHat className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black flex items-center gap-2">
                <span>حاسبة ومفصل تكلفة الكيكة</span>
                <span className="text-[10px] bg-white/25 px-2 py-0.5 rounded-full font-bold">12 مادة + تشغيل</span>
              </h2>
              <p className="text-[11px] text-pink-100 font-bold mt-0.5">
                تفكيك دقيق لتكلفة الكيكة من الصفر: مقادير، تعب يد، كهرباء، ماء ورد، صور وتغليف
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center transition active:scale-95 text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ═══════════ TOP TEMPLATE SELECTION BAR ═══════════ */}
        <div className="bg-pink-50/80 dark:bg-zinc-800/80 border-b border-pink-100 dark:border-zinc-800 p-3 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <Bookmark className="w-4 h-4 text-pink-600 dark:text-pink-400 flex-shrink-0" />
            <span className="text-xs font-black text-gray-700 dark:text-gray-300 whitespace-nowrap">الوصفات والقوالب:</span>
            <select
              value={selectedTemplateId}
              onChange={(e) => {
                setSelectedTemplateId(e.target.value);
                handleLoadTemplate(e.target.value);
              }}
              className="bg-white dark:bg-zinc-900 border border-pink-200 dark:border-zinc-700 text-gray-800 dark:text-gray-200 text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-pink-500 flex-1 max-w-xs shadow-xs"
            >
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSaveTemplateModal(true)}
              className="bg-white dark:bg-zinc-900 border border-pink-200 dark:border-zinc-700 hover:bg-pink-100/50 text-pink-700 dark:text-pink-300 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition active:scale-95 shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>حفظ كقالب جديد</span>
            </button>
          </div>
        </div>

        {/* ═══════════ SCROLLABLE CONTENT BODY ═══════════ */}
        <div className="p-3 sm:p-5 overflow-y-auto space-y-5 flex-1 text-right" dir="rtl">
          
          {/* 1. Cake Info Header */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 dark:bg-zinc-800/40 p-3.5 rounded-2xl border border-gray-100 dark:border-zinc-800">
            <div>
              <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">اسم الكيكة / الموديل</label>
              <input
                type="text"
                value={cakeTitle}
                onChange={e => setCakeTitle(e.target.value)}
                placeholder="مثال: كيكة شوكولاتة قياس 20"
                className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-pink-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">سعر البيع للزبون (للمقارنة والربح)</label>
              <FormattedNumberInput
                value={String(sellingPrice)}
                onChange={val => setSellingPrice(Number(val) || 0)}
                placeholder="سعر البيع بالدينار"
                className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-black text-pink-600 dark:text-pink-400 focus:ring-2 focus:ring-pink-500 outline-none"
              />
            </div>
          </div>

          {/* 2. SECTION: RAW INGREDIENTS LIST (المقادير والمواد الأولية) */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-pink-500" />
                <h3 className="text-sm font-black text-gray-900 dark:text-white">
                  المواد والمقادير الأولية للكيكة ({ingredients.length} مادة)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {/* Add from inventory dropdown */}
                {inventoryList.length > 0 && (
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        const itm = inventoryList.find(i => i.id === e.target.value);
                        if (itm) handleAddIngredient(itm);
                        e.target.value = "";
                      }
                    }}
                    defaultValue=""
                    className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="" disabled>+ إضافة من المخزن</option>
                    {inventoryList.map(i => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({Number(i.price || 0).toLocaleString()} د.ع / {i.unit || "كغم"})
                      </option>
                    ))}
                  </select>
                )}

                <button
                  type="button"
                  onClick={() => handleAddIngredient()}
                  className="bg-pink-600 hover:bg-pink-700 text-white rounded-xl px-3 py-1.5 text-xs font-black flex items-center gap-1 shadow-xs transition active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" /> إضافة مادة
                </button>
              </div>
            </div>

            {/* Ingredients Table */}
            <div className="border border-gray-100 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs bg-white dark:bg-zinc-900">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-gray-50 dark:bg-zinc-800/60 text-gray-500 dark:text-gray-400 font-black border-b border-gray-100 dark:border-zinc-800">
                    <tr>
                      <th className="p-2.5">المادة / المكون</th>
                      <th className="p-2.5">سعر العبوة / الكيلو</th>
                      <th className="p-2.5">حجم العبوة</th>
                      <th className="p-2.5">الكمية المستخدمة</th>
                      <th className="p-2.5 text-center">التكلفة المحسوبة</th>
                      <th className="p-2.5 text-center">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/60 font-bold">
                    {ingredients.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition">
                        {/* Name */}
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.name}
                            onChange={e => handleUpdateIngredient(item.id, "name", e.target.value)}
                            placeholder="اسم المادة"
                            className="w-full min-w-[130px] bg-transparent border-b border-transparent focus:border-pink-500 focus:bg-pink-50/20 rounded px-1.5 py-1 text-xs font-bold text-gray-900 dark:text-white outline-none"
                          />
                        </td>

                        {/* Package Price */}
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={item.packagePrice || ""}
                              onChange={e => handleUpdateIngredient(item.id, "packagePrice", Number(e.target.value) || 0)}
                              placeholder="1500"
                              className="w-20 bg-gray-50 dark:bg-zinc-800 rounded-lg px-2 py-1 text-xs font-bold text-gray-800 dark:text-gray-200 outline-none text-left"
                            />
                            <span className="text-[9px] text-gray-400">د.ع</span>
                          </div>
                        </td>

                        {/* Package Size & Unit */}
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={item.packageSize || ""}
                              onChange={e => handleUpdateIngredient(item.id, "packageSize", Number(e.target.value) || 1)}
                              placeholder="1000"
                              className="w-16 bg-gray-50 dark:bg-zinc-800 rounded-lg px-1.5 py-1 text-xs font-bold text-gray-800 dark:text-gray-200 outline-none text-center"
                            />
                            <select
                              value={item.packageUnit}
                              onChange={e => handleUpdateIngredient(item.id, "packageUnit", e.target.value)}
                              className="bg-gray-100 dark:bg-zinc-800 rounded-lg px-1 py-1 text-[11px] font-bold text-gray-700 dark:text-gray-300 outline-none"
                            >
                              <option value="غرام">غرام</option>
                              <option value="كغم">كغم</option>
                              <option value="مل">مل</option>
                              <option value="لتر">لتر</option>
                              <option value="قطعة">قطعة</option>
                            </select>
                          </div>
                        </td>

                        {/* Quantity Used in this Cake */}
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={item.usedQuantity || ""}
                              onChange={e => handleUpdateIngredient(item.id, "usedQuantity", Number(e.target.value) || 0)}
                              placeholder="250"
                              className="w-16 bg-pink-50 dark:bg-pink-950/30 border border-pink-200 dark:border-pink-900/50 rounded-lg px-1.5 py-1 text-xs font-black text-pink-700 dark:text-pink-300 outline-none text-center"
                            />
                            <select
                              value={item.usedUnit}
                              onChange={e => handleUpdateIngredient(item.id, "usedUnit", e.target.value)}
                              className="bg-gray-100 dark:bg-zinc-800 rounded-lg px-1 py-1 text-[11px] font-bold text-gray-700 dark:text-gray-300 outline-none"
                            >
                              <option value="غرام">غرام</option>
                              <option value="كوب">كوب (200غ)</option>
                              <option value="ملعقة">ملعقة (15غ)</option>
                              <option value="مل">مل</option>
                              <option value="قطعة">قطعة</option>
                            </select>
                          </div>
                        </td>

                        {/* Calculated Item Cost */}
                        <td className="p-2 text-center">
                          <span className="font-black text-xs text-gray-900 dark:text-white bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded-lg">
                            {(item.itemCost || 0).toLocaleString()} د.ع
                          </span>
                        </td>

                        {/* Delete */}
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteIngredient(item.id)}
                            className="p-1 text-gray-400 hover:text-red-500 rounded-lg transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Subtotal Ingredients */}
              <div className="bg-pink-50/60 dark:bg-zinc-800/40 p-3 border-t border-gray-100 dark:border-zinc-800 flex justify-between items-center text-xs font-black">
                <span className="text-gray-700 dark:text-gray-300">مجموع تكلفة المواد الأولية ({ingredients.length} مادة):</span>
                <span className="text-pink-600 dark:text-pink-400 text-sm">
                  {currentBreakdown.totalIngredientsCost.toLocaleString()} د.ع
                </span>
              </div>
            </div>
          </div>

          {/* 3. SECTION: OVERHEAD, LABOR & UTILITIES (تعب اليد والمصاريف التشغيلية والتجهيز) */}
          <div className="bg-gray-50/80 dark:bg-zinc-800/40 p-4 rounded-2xl border border-gray-200/80 dark:border-zinc-800 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <h3 className="text-sm font-black text-gray-900 dark:text-white">
                تعب اليد والمصاريف التشغيلية والتجهيز
              </h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {/* Labor */}
              <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-xs">
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                  <span>🧑‍🍳 تعب اليد والجهد</span>
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={overhead.laborCost || ""}
                    onChange={e => setOverhead(prev => ({ ...prev, laborCost: Number(e.target.value) || 0 }))}
                    placeholder="5000"
                    className="w-full bg-gray-50 dark:bg-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-black text-gray-900 dark:text-white outline-none text-left"
                  />
                  <span className="text-[10px] text-gray-400">د.ع</span>
                </div>
              </div>

              {/* Utilities (Electricity, Gas, Oven) */}
              <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-xs">
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-orange-500" />
                  <span>كهرباء، غاز، فرن وماء</span>
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={overhead.utilitiesCost || ""}
                    onChange={e => setOverhead(prev => ({ ...prev, utilitiesCost: Number(e.target.value) || 0 }))}
                    placeholder="2000"
                    className="w-full bg-gray-50 dark:bg-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-black text-gray-900 dark:text-white outline-none text-left"
                  />
                  <span className="text-[10px] text-gray-400">د.ع</span>
                </div>
              </div>

              {/* Flavorings & Rose Water */}
              <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-xs">
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                  <span>🌸 ماء ورد ومطيبات عطرية</span>
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={overhead.flavoringAromaCost || ""}
                    onChange={e => setOverhead(prev => ({ ...prev, flavoringAromaCost: Number(e.target.value) || 0 }))}
                    placeholder="500"
                    className="w-full bg-gray-50 dark:bg-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-black text-gray-900 dark:text-white outline-none text-left"
                  />
                  <span className="text-[10px] text-gray-400">د.ع</span>
                </div>
              </div>

              {/* Photo print & Wafer */}
              <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-xs">
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                  <ImageIcon className="w-3.5 h-3.5 text-purple-500" />
                  <span>صور الكيكة ومطبوعات وتوبر</span>
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={overhead.ediblePrintPhotoCost || ""}
                    onChange={e => setOverhead(prev => ({ ...prev, ediblePrintPhotoCost: Number(e.target.value) || 0 }))}
                    placeholder="0"
                    className="w-full bg-gray-50 dark:bg-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-black text-gray-900 dark:text-white outline-none text-left"
                  />
                  <span className="text-[10px] text-gray-400">د.ع</span>
                </div>
              </div>

              {/* Packaging, Box, Board */}
              <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-xs">
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                  <Box className="w-3.5 h-3.5 text-blue-500" />
                  <span>بورد، كارتون وتغليف وربطة</span>
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={overhead.packagingBoardCost || ""}
                    onChange={e => setOverhead(prev => ({ ...prev, packagingBoardCost: Number(e.target.value) || 0 }))}
                    placeholder="2000"
                    className="w-full bg-gray-50 dark:bg-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-black text-gray-900 dark:text-white outline-none text-left"
                  />
                  <span className="text-[10px] text-gray-400">د.ع</span>
                </div>
              </div>

              {/* Miscellaneous */}
              <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-xs">
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                  <span>✨ نثريات وهدر إضافي</span>
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={overhead.extraMiscellaneous || ""}
                    onChange={e => setOverhead(prev => ({ ...prev, extraMiscellaneous: Number(e.target.value) || 0 }))}
                    placeholder="500"
                    className="w-full bg-gray-50 dark:bg-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-black text-gray-900 dark:text-white outline-none text-left"
                  />
                  <span className="text-[10px] text-gray-400">د.ع</span>
                </div>
              </div>
            </div>

            {/* Subtotal Overhead */}
            <div className="flex justify-between items-center text-xs font-black pt-1 px-1">
              <span className="text-gray-600 dark:text-gray-400">مجموع المصاريف التشغيلية والتجهيز:</span>
              <span className="text-amber-600 dark:text-amber-400 text-sm">
                {currentBreakdown.totalOverheadCost.toLocaleString()} د.ع
              </span>
            </div>
          </div>

          {/* 4. FINAL GRAND TOTAL & PROFITABILITY DASHBOARD */}
          <div className="bg-gradient-to-l from-emerald-950 via-teal-900 to-slate-900 text-white p-4 sm:p-5 rounded-2xl border border-emerald-500/30 shadow-lg space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              
              {/* Materials */}
              <div className="bg-white/10 rounded-xl p-2.5 backdrop-blur-md">
                <span className="text-[10px] text-emerald-200 block font-bold mb-0.5">تكلفة المواد الأولية</span>
                <span className="text-sm sm:text-base font-black text-white">
                  {currentBreakdown.totalIngredientsCost.toLocaleString()} د.ع
                </span>
              </div>

              {/* Overhead */}
              <div className="bg-white/10 rounded-xl p-2.5 backdrop-blur-md">
                <span className="text-[10px] text-amber-200 block font-bold mb-0.5">تعب اليد والتشغيل</span>
                <span className="text-sm sm:text-base font-black text-white">
                  {currentBreakdown.totalOverheadCost.toLocaleString()} د.ع
                </span>
              </div>

              {/* Total Final Cake Cost */}
              <div className="bg-gradient-to-r from-rose-500/40 to-pink-500/40 rounded-xl p-2.5 border border-rose-400/50">
                <span className="text-[10px] text-rose-200 block font-black mb-0.5">التكلفة النهائية الكلية</span>
                <span className="text-base sm:text-lg font-black text-rose-300">
                  {currentBreakdown.totalCakeCost.toLocaleString()} د.ع
                </span>
              </div>

              {/* Net Profit */}
              <div className="bg-gradient-to-r from-emerald-500/40 to-teal-500/40 rounded-xl p-2.5 border border-emerald-400/50">
                <span className="text-[10px] text-emerald-200 block font-black mb-0.5">صافي الربح المتوقع</span>
                <span className="text-base sm:text-lg font-black text-emerald-300">
                  {(currentBreakdown.netProfit || 0).toLocaleString()} د.ع
                </span>
                <span className="text-[9px] text-emerald-200/90 font-bold block mt-0.5">
                  هامش الربح: {currentBreakdown.profitMarginPercent}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════ FOOTER BUTTONS ═══════════ */}
        <div className="bg-gray-50 dark:bg-zinc-800/80 p-3.5 sm:p-4 border-t border-gray-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 text-xs font-black">
            <span className="text-gray-500 dark:text-gray-400">التكلفة الناتجة:</span>
            <span className="text-base text-pink-600 dark:text-pink-400 font-black">
              {currentBreakdown.totalCakeCost.toLocaleString()} د.ع
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-xl transition"
            >
              إلغاء
            </button>

            <button
              type="button"
              onClick={handleConfirmAndApply}
              className="bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg shadow-pink-500/25 active:scale-95 transition"
            >
              <Check className="w-4 h-4" />
              <span>اعتماد التكلفة وتطبيقها على الطلب</span>
            </button>
          </div>
        </div>

      </div>

      {/* Save Template Prompt Modal */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 max-w-sm w-full border border-gray-100 dark:border-zinc-800 text-right space-y-3 shadow-xl">
            <h4 className="font-black text-sm text-gray-900 dark:text-white">حفظ هذه المقادير كقالب جاهز</h4>
            <p className="text-xs text-gray-500">ادخل اسم الوصفة لتتمكن من استخدامها بضغطة زر في أي طلب لاحقاً</p>
            <input
              type="text"
              value={newTemplateName}
              onChange={e => setNewTemplateName(e.target.value)}
              placeholder="مثال: كيكة لوتس قياس 20"
              className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-pink-500"
              autoFocus
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSaveTemplateModal(false)}
                className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-lg"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveAsTemplate}
                className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-1.5 text-xs font-black rounded-lg shadow-sm"
              >
                حفظ القالب
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
