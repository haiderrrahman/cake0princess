import { db } from "./firebase";
import { collection, getDocs, doc, setDoc, deleteDoc, addDoc, serverTimestamp } from "firebase/firestore";

export interface CakeIngredientItem {
  id: string;
  name: string;
  category?: string;
  
  // Package / Bulk Purchase Basis
  packageSize: number;       // e.g. 1000 for 1000g (1kg) or 30 for 30 eggs
  packageUnit: string;       // "غرام" | "كغم" | "مل" | "لتر" | "قطعة" | "علبة" | "كوب"
  packagePrice: number;      // e.g. 1500 IQD

  // Recipe Usage in this Cake
  usedQuantity: number;      // e.g. 250 (grams) or 4 (eggs)
  usedUnit: string;          // "غرام" | "كغم" | "مل" | "لتر" | "قطعة" | "كوب" | "ملعقة"

  // Exact Calculated Cost in IQD
  itemCost: number;

  inventoryItemId?: string;
  notes?: string;
}

export interface CakeOverheadExpenses {
  laborCost: number;           // تعب اليد والجهد
  utilitiesCost: number;       // كهرباء وغاز وفرن وماء
  flavoringAromaCost: number;  // ماء ورد ومستخلصات ومطيبات
  ediblePrintPhotoCost: number;// صور الكيكة والمطبوعات الغذائية وتوبر
  packagingBoardCost: number;  // بورد، كارتون، تغليف، شريط
  extraMiscellaneous: number;  // نثريات وهدر إضافي
}

export interface CakeCostBreakdown {
  cakeTitle?: string;
  cakeSize?: string;
  ingredients: CakeIngredientItem[];
  overhead: CakeOverheadExpenses;
  
  totalIngredientsCost: number;
  totalOverheadCost: number;
  totalCakeCost: number;
  
  suggestedSellingPrice?: number;
  netProfit?: number;
  profitMarginPercent?: number;

  templateId?: string;
  templateName?: string;
  updatedAt?: string;
}

/**
 * Standard Bakery Unit Conversions & Fractional Cost Calculator
 */
export function calculateItemCost(
  packageSize: number,
  packageUnit: string,
  packagePrice: number,
  usedQuantity: number,
  usedUnit: string
): number {
  const pSize = Number(packageSize) || 1;
  const pPrice = Number(packagePrice) || 0;
  const uQty = Number(usedQuantity) || 0;

  if (pSize <= 0 || pPrice <= 0 || uQty <= 0) return 0;

  // Normalize package size into standard base units (grams or milliliters or pieces)
  let normalizedPackSize = pSize;
  if (packageUnit === "كغم") normalizedPackSize = pSize * 1000;
  else if (packageUnit === "لتر") normalizedPackSize = pSize * 1000;

  // Normalize used quantity into standard base units
  let normalizedUsedQty = uQty;
  if (usedUnit === "كغم") normalizedUsedQty = uQty * 1000;
  else if (usedUnit === "لتر") normalizedUsedQty = uQty * 1000;
  else if (usedUnit === "كوب") {
    // 1 standard cup ≈ 200g (or 240ml)
    normalizedUsedQty = uQty * 200;
  } else if (usedUnit === "ملعقة" || usedUnit === "ملعقة كبيرة") {
    normalizedUsedQty = uQty * 15;
  } else if (usedUnit === "ملعقة صغيرة") {
    normalizedUsedQty = uQty * 5;
  }

  const fraction = normalizedUsedQty / normalizedPackSize;
  return Math.round(fraction * pPrice);
}

/**
 * Recalculate all totals in a breakdown
 */
export function recalculateBreakdown(
  ingredients: CakeIngredientItem[],
  overhead: CakeOverheadExpenses,
  sellingPrice: number = 0,
  cakeTitle: string = "",
  cakeSize: string = ""
): CakeCostBreakdown {
  const updatedIngredients = ingredients.map(item => ({
    ...item,
    itemCost: calculateItemCost(
      item.packageSize,
      item.packageUnit,
      item.packagePrice,
      item.usedQuantity,
      item.usedUnit
    )
  }));

  const totalIngredientsCost = updatedIngredients.reduce((s, i) => s + (i.itemCost || 0), 0);
  
  const totalOverheadCost = 
    (Number(overhead.laborCost) || 0) +
    (Number(overhead.utilitiesCost) || 0) +
    (Number(overhead.flavoringAromaCost) || 0) +
    (Number(overhead.ediblePrintPhotoCost) || 0) +
    (Number(overhead.packagingBoardCost) || 0) +
    (Number(overhead.extraMiscellaneous) || 0);

  const totalCakeCost = Math.round(totalIngredientsCost + totalOverheadCost);
  const price = Number(sellingPrice) || 0;
  const netProfit = price > 0 ? price - totalCakeCost : 0;
  const profitMarginPercent = price > 0 ? Math.round((netProfit / price) * 100) : 0;

  return {
    cakeTitle,
    cakeSize,
    ingredients: updatedIngredients,
    overhead,
    totalIngredientsCost,
    totalOverheadCost,
    totalCakeCost,
    suggestedSellingPrice: price,
    netProfit,
    profitMarginPercent,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Built-in Master Recipe Templates for Iraqi Confectionery
 */
export const BUILT_IN_CAKE_TEMPLATES: { id: string; name: string; description: string; breakdown: CakeCostBreakdown }[] = [
  {
    id: "classic-20-12items",
    name: "كيكة كلاسيكية قياس 20 (12 مادة أساسية)",
    description: "وصفة كيكة قياس 20 متكاملة تشمل الطحين والبيض والكريمة والحشوة وتعب اليد والتغليف",
    breakdown: recalculateBreakdown([
      { id: "ing-1", name: "طحين صفر فاخر", category: "طحين وسكر", packageSize: 1000, packageUnit: "غرام", packagePrice: 1500, usedQuantity: 250, usedUnit: "غرام", itemCost: 375 },
      { id: "ing-2", name: "سكر أبيض ناعم", category: "طحين وسكر", packageSize: 1000, packageUnit: "غرام", packagePrice: 1500, usedQuantity: 200, usedUnit: "غرام", itemCost: 300 },
      { id: "ing-3", name: "بيض طازج", category: "مستهلكات", packageSize: 30, packageUnit: "قطعة", packagePrice: 6000, usedQuantity: 4, usedUnit: "قطعة", itemCost: 800 },
      { id: "ing-4", name: "فانيلا ومحسن سبونج", category: "منكهات وعطور", packageSize: 200, packageUnit: "غرام", packagePrice: 3000, usedQuantity: 20, usedUnit: "غرام", itemCost: 300 },
      { id: "ing-5", name: "بيكنج باودر", category: "ألوان وإضافات", packageSize: 100, packageUnit: "غرام", packagePrice: 1500, usedQuantity: 15, usedUnit: "غرام", itemCost: 225 },
      { id: "ing-6", name: "زيت نباتي / زبدة", category: "مستهلكات", packageSize: 1000, packageUnit: "مل", packagePrice: 2500, usedQuantity: 100, usedUnit: "مل", itemCost: 250 },
      { id: "ing-7", name: "حليب سائل", category: "مستهلكات", packageSize: 1000, packageUnit: "مل", packagePrice: 1500, usedQuantity: 150, usedUnit: "مل", itemCost: 225 },
      { id: "ing-8", name: "كريمة خفق شانتيه", category: "كريمات", packageSize: 1000, packageUnit: "غرام", packagePrice: 6000, usedQuantity: 400, usedUnit: "غرام", itemCost: 2400 },
      { id: "ing-9", name: "حشوة كيك (لوتس / كيندر / نوتيلا)", category: "حشوات", packageSize: 1000, packageUnit: "غرام", packagePrice: 8000, usedQuantity: 150, usedUnit: "غرام", itemCost: 1200 },
      { id: "ing-10", name: "شوكولاتة وتزيين خارجي", category: "شوكولاتة وكاكاو", packageSize: 1000, packageUnit: "غرام", packagePrice: 7000, usedQuantity: 100, usedUnit: "غرام", itemCost: 700 },
      { id: "ing-11", name: "ألوان غذائية وتزيين", category: "ألوان وإضافات", packageSize: 50, packageUnit: "مل", packagePrice: 2000, usedQuantity: 5, usedUnit: "مل", itemCost: 200 },
      { id: "ing-12", name: "ماء ورد ومستخلص نكهة", category: "منكهات وعطور", packageSize: 250, packageUnit: "مل", packagePrice: 1000, usedQuantity: 25, usedUnit: "مل", itemCost: 100 }
    ], {
      laborCost: 5000,
      utilitiesCost: 2000,
      flavoringAromaCost: 500,
      ediblePrintPhotoCost: 0,
      packagingBoardCost: 2000,
      extraMiscellaneous: 500
    }, 25000, "كيكة كلاسيكية قياس 20", "قياس 20")
  },
  {
    id: "chocolate-photo-25",
    name: "كيكة شوكولاتة مع طباعة صورة قياس 25",
    description: "كيكة شوكولاتة كبيرة قياس 25 تشمل طباعة صورة سكر وتزيين فخم وتغليف فاخر",
    breakdown: recalculateBreakdown([
      { id: "ing-1", name: "طحين صفر فاخر", category: "طحين وسكر", packageSize: 1000, packageUnit: "غرام", packagePrice: 1500, usedQuantity: 400, usedUnit: "غرام", itemCost: 600 },
      { id: "ing-2", name: "سكر أبيض ناعم", category: "طحين وسكر", packageSize: 1000, packageUnit: "غرام", packagePrice: 1500, usedQuantity: 300, usedUnit: "غرام", itemCost: 450 },
      { id: "ing-3", name: "بيض طازج", category: "مستهلكات", packageSize: 30, packageUnit: "قطعة", packagePrice: 6000, usedQuantity: 6, usedUnit: "قطعة", itemCost: 1200 },
      { id: "ing-4", name: "بودرة كاكاو خام بلجيكي", category: "شوكولاتة وكاكاو", packageSize: 1000, packageUnit: "غرام", packagePrice: 9000, usedQuantity: 80, usedUnit: "غرام", itemCost: 720 },
      { id: "ing-5", name: "فانيلا ومحسن سبونج", category: "منكهات وعطور", packageSize: 200, packageUnit: "غرام", packagePrice: 3000, usedQuantity: 25, usedUnit: "غرام", itemCost: 375 },
      { id: "ing-6", name: "بيكنج باودر", category: "ألوان وإضافات", packageSize: 100, packageUnit: "غرام", packagePrice: 1500, usedQuantity: 20, usedUnit: "غرام", itemCost: 300 },
      { id: "ing-7", name: "زيت نباتي / زبدة", category: "مستهلكات", packageSize: 1000, packageUnit: "مل", packagePrice: 2500, usedQuantity: 150, usedUnit: "مل", itemCost: 375 },
      { id: "ing-8", name: "حليب سائل", category: "مستهلكات", packageSize: 1000, packageUnit: "مل", packagePrice: 1500, usedQuantity: 200, usedUnit: "مل", itemCost: 300 },
      { id: "ing-9", name: "كريمة شوكولاتة غاناش", category: "كريمات", packageSize: 1000, packageUnit: "غرام", packagePrice: 8000, usedQuantity: 600, usedUnit: "غرام", itemCost: 4800 },
      { id: "ing-10", name: "حشوة بندق وشوكولاتة مقرمشة", category: "حشوات", packageSize: 1000, packageUnit: "غرام", packagePrice: 10000, usedQuantity: 250, usedUnit: "غرام", itemCost: 2500 },
      { id: "ing-11", name: "لوح شوكولاتة وكرز تزيين", category: "شوكولاتة وكاكاو", packageSize: 1000, packageUnit: "غرام", packagePrice: 8000, usedQuantity: 150, usedUnit: "غرام", itemCost: 1200 },
      { id: "ing-12", name: "ماء ورد ومطيبات عطرية", category: "منكهات وعطور", packageSize: 250, packageUnit: "مل", packagePrice: 1000, usedQuantity: 30, usedUnit: "مل", itemCost: 120 }
    ], {
      laborCost: 8000,
      utilitiesCost: 3000,
      flavoringAromaCost: 500,
      ediblePrintPhotoCost: 3000, // صورة سكر
      packagingBoardCost: 3000,
      extraMiscellaneous: 1000
    }, 40000, "كيكة شوكولاتة مع صورة قياس 25", "قياس 25")
  },
  {
    id: "mini-lunchbox-cake",
    name: "ميني كيك / لانش بوكس كيك",
    description: "كيكة صغيرة لشخصين بتكلفة سريعة ومقادير اقتصادية",
    breakdown: recalculateBreakdown([
      { id: "ing-1", name: "طحين صفر", category: "طحين وسكر", packageSize: 1000, packageUnit: "غرام", packagePrice: 1500, usedQuantity: 100, usedUnit: "غرام", itemCost: 150 },
      { id: "ing-2", name: "سكر أبيض", category: "طحين وسكر", packageSize: 1000, packageUnit: "غرام", packagePrice: 1500, usedQuantity: 80, usedUnit: "غرام", itemCost: 120 },
      { id: "ing-3", name: "بيض طازج", category: "مستهلكات", packageSize: 30, packageUnit: "قطعة", packagePrice: 6000, usedQuantity: 2, usedUnit: "قطعة", itemCost: 400 },
      { id: "ing-4", name: "فانيلا ومحسن", category: "منكهات وعطور", packageSize: 200, packageUnit: "غرام", packagePrice: 3000, usedQuantity: 10, usedUnit: "غرام", itemCost: 150 },
      { id: "ing-5", name: "كريمة شانتيه", category: "كريمات", packageSize: 1000, packageUnit: "غرام", packagePrice: 6000, usedQuantity: 150, usedUnit: "غرام", itemCost: 900 },
      { id: "ing-6", name: "حشوة فراولة / لوتس", category: "حشوات", packageSize: 1000, packageUnit: "غرام", packagePrice: 8000, usedQuantity: 50, usedUnit: "غرام", itemCost: 400 },
      { id: "ing-7", name: "ألوان وتزيين ناعم", category: "ألوان وإضافات", packageSize: 50, packageUnit: "مل", packagePrice: 2000, usedQuantity: 3, usedUnit: "مل", itemCost: 120 }
    ], {
      laborCost: 3000,
      utilitiesCost: 1000,
      flavoringAromaCost: 200,
      ediblePrintPhotoCost: 0,
      packagingBoardCost: 1200, // علبة لانش بوكس
      extraMiscellaneous: 200
    }, 15000, "لانش بوكس ميني كيك", "ميني")
  }
];

/**
 * Fetch Custom Templates from Firestore
 */
export async function getSavedRecipeTemplates(): Promise<{ id: string; name: string; description?: string; breakdown: CakeCostBreakdown }[]> {
  try {
    const snap = await getDocs(collection(db, "cake_recipe_templates"));
    const customList = snap.docs.map(d => ({
      id: d.id,
      name: d.data().name || "قالب مخصص",
      description: d.data().description || "",
      breakdown: d.data().breakdown as CakeCostBreakdown
    }));
    return [...BUILT_IN_CAKE_TEMPLATES, ...customList];
  } catch (e) {
    console.warn("Failed to fetch custom recipe templates:", e);
    return BUILT_IN_CAKE_TEMPLATES;
  }
}

/**
 * Save Recipe Template to Firestore
 */
export async function saveRecipeTemplate(name: string, description: string, breakdown: CakeCostBreakdown): Promise<string> {
  const docRef = await addDoc(collection(db, "cake_recipe_templates"), {
    name,
    description,
    breakdown,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
}
