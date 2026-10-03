import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  increment,
  getDocs,
  query,
  where,
  orderBy
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface CakeMaterialPurchase {
  id?: string;
  itemId?: string;
  itemName: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  purchaseDate: string; // YYYY-MM-DD
  hasInvoice: boolean;
  invoiceId?: string;
  invoiceNumber?: string;
  invoiceImageUrl?: string;
  storeName?: string;
  paymentSource: "none" | "cake" | "salary" | "split";
  splitDebtAmount?: number;
  notes?: string;
  createdAt?: any;
}

export interface CakeInvoiceRecord {
  id?: string;
  storeName: string;
  invoiceDate: string;
  invoiceNumber?: string;
  totalAmount: number;
  itemCount: number;
  items: Array<{
    name: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
    category: string;
    inventoryItemId?: string;
  }>;
  imageUrl?: string;
  paymentSource: "none" | "cake" | "salary" | "split";
  splitDebtAmount?: number;
  createdAt?: any;
}

export interface MaterialConsumptionMetrics {
  totalPurchasedQty: number;
  purchaseCount: number;
  firstPurchaseDate: string | null;
  lastPurchaseDate: string | null;
  daysSinceLastPurchase: number | null;
  averageCycleDays: number | null; // كل كم يوم يتم الشراء
  dailyConsumptionRate: number | null; // كمية الاستهلاك اليومي
  estimatedDaysRemaining: number | null; // كم يوم باقي حتى تنفد الكمية الحالية
  depletionStatus: "safe" | "warning" | "critical" | "unknown";
  depletionStatusText: string;
  depletionEstimatedDate: string | null; // YYYY-MM-DD
}

/**
 * Normalizes Arabic text for flexible matching
 */
export function normalizeArabicText(text: string): string {
  if (!text) return "";
  return text
    .trim()
    .toLowerCase()
    .replace(/[أإآا]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ي/g, "ى")
    .replace(/[\u064B-\u0652]/g, ""); // Remove Arabic diacritics
}

/**
 * Calculates consumption metrics & depletion forecast for an inventory item
 */
export function calculateItemConsumption(
  item: any,
  purchases: CakeMaterialPurchase[]
): MaterialConsumptionMetrics {
  const itemPurchases = purchases
    .filter((p) => {
      if (item.id && p.itemId === item.id) return true;
      return normalizeArabicText(p.itemName) === normalizeArabicText(item.name);
    })
    .sort((a, b) => (a.purchaseDate > b.purchaseDate ? 1 : -1));

  const count = itemPurchases.length;
  const currentStock = Number(item.quantity) || 0;
  const minAlert = Number(item.minAlert) || 1;

  if (count === 0) {
    const isCritical = currentStock <= minAlert || (item.neededQuantity && item.neededQuantity > 0);
    return {
      totalPurchasedQty: 0,
      purchaseCount: 0,
      firstPurchaseDate: null,
      lastPurchaseDate: null,
      daysSinceLastPurchase: null,
      averageCycleDays: null,
      dailyConsumptionRate: null,
      estimatedDaysRemaining: isCritical ? 0 : null,
      depletionStatus: isCritical ? "critical" : "unknown",
      depletionStatusText: isCritical ? "يحتاج شراء عاجل" : "لا توجد سجلات شراء سابقة",
      depletionEstimatedDate: null
    };
  }

  const firstDateStr = itemPurchases[0].purchaseDate;
  const lastDateStr = itemPurchases[count - 1].purchaseDate;
  const totalPurchasedQty = itemPurchases.reduce((acc, p) => acc + (Number(p.quantity) || 0), 0);

  const now = new Date();
  const lastDate = new Date(lastDateStr);
  const diffTime = Math.max(0, now.getTime() - lastDate.getTime());
  const daysSinceLastPurchase = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  let averageCycleDays: number | null = null;
  let dailyConsumptionRate: number | null = null;
  let estimatedDaysRemaining: number | null = null;
  let depletionEstimatedDate: string | null = null;

  if (count >= 2) {
    const firstDate = new Date(firstDateStr);
    const spanDays = Math.max(1, Math.round((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)));
    averageCycleDays = Math.max(1, Math.round(spanDays / (count - 1)));

    // Quantities consumed before the last batch = totalPurchasedQty - lastPurchaseQty
    const prevPurchasedQty = itemPurchases.slice(0, count - 1).reduce((s, p) => s + (Number(p.quantity) || 0), 0);
    dailyConsumptionRate = spanDays > 0 ? Number((prevPurchasedQty / spanDays).toFixed(2)) : null;

    if (dailyConsumptionRate && dailyConsumptionRate > 0) {
      estimatedDaysRemaining = Math.max(0, Math.round(currentStock / dailyConsumptionRate));
    } else if (averageCycleDays) {
      estimatedDaysRemaining = Math.max(0, averageCycleDays - daysSinceLastPurchase);
    }
  } else {
    // Only 1 purchase logged
    if (daysSinceLastPurchase > 0 && currentStock < totalPurchasedQty) {
      const consumedSoFar = totalPurchasedQty - currentStock;
      dailyConsumptionRate = Number((consumedSoFar / daysSinceLastPurchase).toFixed(2));
      if (dailyConsumptionRate > 0) {
        estimatedDaysRemaining = Math.max(0, Math.round(currentStock / dailyConsumptionRate));
      }
    }
  }

  // Calculate estimated date of depletion
  if (estimatedDaysRemaining !== null && estimatedDaysRemaining >= 0) {
    const estDate = new Date();
    estDate.setDate(estDate.getDate() + estimatedDaysRemaining);
    depletionEstimatedDate = estDate.toISOString().split("T")[0];
  }

  // Determine status
  let depletionStatus: "safe" | "warning" | "critical" | "unknown" = "safe";
  let depletionStatusText = "الكمية كافية";

  if (currentStock <= minAlert || (item.neededQuantity && item.neededQuantity > 0) || (estimatedDaysRemaining !== null && estimatedDaysRemaining <= 2)) {
    depletionStatus = "critical";
    depletionStatusText = currentStock <= 0 ? "نفدت المادة بالكامل" : "أوشكت على النفاد (شراء عاجل)";
  } else if ((estimatedDaysRemaining !== null && estimatedDaysRemaining <= 6) || currentStock <= minAlert * 1.5) {
    depletionStatus = "warning";
    depletionStatusText = `قارب على الانتهاء (~${estimatedDaysRemaining} يوم)`;
  } else if (estimatedDaysRemaining !== null) {
    depletionStatus = "safe";
    depletionStatusText = `تكفي لمدة ~${estimatedDaysRemaining} يوم`;
  }

  return {
    totalPurchasedQty,
    purchaseCount: count,
    firstPurchaseDate: firstDateStr,
    lastPurchaseDate: lastDateStr,
    daysSinceLastPurchase,
    averageCycleDays,
    dailyConsumptionRate,
    estimatedDaysRemaining,
    depletionStatus,
    depletionStatusText,
    depletionEstimatedDate
  };
}

/**
 * Records a single cake material purchase (with or without invoice)
 */
export async function recordSingleCakePurchase(data: {
  itemId?: string;
  itemName: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  purchaseDate: string;
  hasInvoice: boolean;
  invoiceNumber?: string;
  storeName?: string;
  invoiceImageUrl?: string;
  paymentSource: "none" | "cake" | "salary" | "split";
  splitDebtAmount?: number;
  notes?: string;
  createIfNotExist?: boolean;
}): Promise<string> {
  const {
    itemId,
    itemName,
    category,
    quantity,
    unit,
    unitPrice,
    totalPrice,
    purchaseDate,
    hasInvoice,
    invoiceNumber,
    storeName,
    invoiceImageUrl,
    paymentSource,
    splitDebtAmount = 0,
    notes = "",
    createIfNotExist = false
  } = data;

  let targetItemId = itemId;

  // 1. Update or create in cake_inventory
  if (targetItemId) {
    const invRef = doc(db, "cake_inventory", targetItemId);
    await updateDoc(invRef, {
      quantity: increment(quantity),
      price: unitPrice > 0 ? unitPrice : undefined,
      lastPurchasedAt: purchaseDate,
      lastPurchasedPrice: unitPrice,
      lastPurchasedQty: quantity,
      lastStoreName: storeName || "",
      lastUpdated: serverTimestamp()
    });
  } else if (createIfNotExist) {
    const newDoc = await addDoc(collection(db, "cake_inventory"), {
      name: itemName,
      category,
      quantity,
      unit,
      price: unitPrice,
      minAlert: 1,
      neededQuantity: 0,
      imageUrl: "",
      lastPurchasedAt: purchaseDate,
      lastPurchasedPrice: unitPrice,
      lastPurchasedQty: quantity,
      lastStoreName: storeName || "",
      createdAt: serverTimestamp(),
      lastUpdated: serverTimestamp()
    });
    targetItemId = newDoc.id;
  }

  // 2. Add record in cake_material_purchases
  const purchaseDoc = await addDoc(collection(db, "cake_material_purchases"), {
    itemId: targetItemId || "",
    itemName,
    category,
    quantity,
    unit,
    unitPrice,
    totalPrice,
    purchaseDate,
    hasInvoice,
    invoiceNumber: invoiceNumber || "",
    storeName: storeName || "",
    invoiceImageUrl: invoiceImageUrl || "",
    paymentSource,
    splitDebtAmount,
    notes,
    createdAt: serverTimestamp()
  });

  // 3. Sync to expenses if paymentSource is not 'none'
  if (totalPrice > 0 && paymentSource !== "none") {
    const pDate = new Date(purchaseDate);
    const month = !isNaN(pDate.getTime()) ? pDate.getMonth() + 1 : new Date().getMonth() + 1;
    const invoiceTag = hasInvoice ? "🧾 بفاتورة" : "🛒 بدون فاتورة";
    const storeTag = storeName ? ` من ${storeName}` : "";

    if (paymentSource === "split") {
      const debtAmt = Number(splitDebtAmount) || 0;
      const cakeAmt = Math.max(0, totalPrice - debtAmt);

      if (debtAmt > 0) {
        await addDoc(collection(db, "expenses"), {
          amount: debtAmt,
          category: "مشتريات مخزنية",
          description: `شراء مواد كيك (${invoiceTag}): ${quantity} ${unit} ${itemName}${storeTag} (دين من الراتب)`,
          month,
          purchaseId: purchaseDoc.id,
          createdAt: serverTimestamp(),
          isDebt: true
        });
      }
      if (cakeAmt > 0) {
        await addDoc(collection(db, "expenses"), {
          amount: cakeAmt,
          category: "مشتريات مخزنية",
          description: `شراء مواد كيك (${invoiceTag}): ${quantity} ${unit} ${itemName}${storeTag} (أموال الكيك)`,
          month,
          purchaseId: purchaseDoc.id,
          createdAt: serverTimestamp(),
          isDebt: false
        });
      }
    } else {
      await addDoc(collection(db, "expenses"), {
        amount: totalPrice,
        category: "مشتريات مخزنية",
        description: `شراء مواد كيك (${invoiceTag}): ${quantity} ${unit} ${itemName}${storeTag}`,
        month,
        purchaseId: purchaseDoc.id,
        createdAt: serverTimestamp(),
        isDebt: paymentSource === "salary"
      });
    }
  }

  return purchaseDoc.id;
}

/**
 * Records a full scanned or manual invoice batch containing multiple items
 */
export async function recordCakeInvoiceBatch(data: {
  storeName: string;
  invoiceDate: string;
  invoiceNumber?: string;
  totalAmount: number;
  items: Array<{
    name: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
    category: string;
    matchedInventoryId?: string;
    isNewItem?: boolean;
  }>;
  imageUrl?: string;
  paymentSource: "none" | "cake" | "salary" | "split";
  splitDebtAmount?: number;
}): Promise<string> {
  const {
    storeName,
    invoiceDate,
    invoiceNumber = "",
    totalAmount,
    items,
    imageUrl = "",
    paymentSource,
    splitDebtAmount = 0
  } = data;

  // 1. Create Invoice record in cake_invoices
  const invoiceRef = await addDoc(collection(db, "cake_invoices"), {
    storeName,
    invoiceDate,
    invoiceNumber,
    totalAmount,
    itemCount: items.length,
    imageUrl,
    paymentSource,
    splitDebtAmount,
    createdAt: serverTimestamp()
  });

  const invoiceId = invoiceRef.id;

  // 2. Process each item: update or add to cake_inventory and log purchase
  for (const item of items) {
    let itemId = item.matchedInventoryId;

    if (itemId) {
      // Update existing item
      const itemRef = doc(db, "cake_inventory", itemId);
      await updateDoc(itemRef, {
        quantity: increment(item.quantity),
        price: item.unitPrice > 0 ? item.unitPrice : undefined,
        lastPurchasedAt: invoiceDate,
        lastPurchasedPrice: item.unitPrice,
        lastPurchasedQty: item.quantity,
        lastStoreName: storeName,
        lastUpdated: serverTimestamp()
      });
    } else {
      // Create new inventory item
      const newInvDoc = await addDoc(collection(db, "cake_inventory"), {
        name: item.name,
        category: item.category || "أخرى",
        quantity: item.quantity,
        unit: item.unit || "كغم",
        price: item.unitPrice,
        minAlert: 1,
        neededQuantity: 0,
        imageUrl: "",
        lastPurchasedAt: invoiceDate,
        lastPurchasedPrice: item.unitPrice,
        lastPurchasedQty: item.quantity,
        lastStoreName: storeName,
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp()
      });
      itemId = newInvDoc.id;
    }

    // Add purchase record
    await addDoc(collection(db, "cake_material_purchases"), {
      itemId,
      itemName: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      purchaseDate: invoiceDate,
      hasInvoice: true,
      invoiceId,
      invoiceNumber,
      invoiceImageUrl: imageUrl,
      storeName,
      paymentSource,
      createdAt: serverTimestamp()
    });
  }

  // 3. Add collective expense in expenses
  if (totalAmount > 0 && paymentSource !== "none") {
    const pDate = new Date(invoiceDate);
    const month = !isNaN(pDate.getTime()) ? pDate.getMonth() + 1 : new Date().getMonth() + 1;
    const itemsSummary = items.map((i) => `${i.name} (${i.quantity} ${i.unit})`).slice(0, 3).join("، ") + (items.length > 3 ? "..." : "");

    if (paymentSource === "split") {
      const debtAmt = Number(splitDebtAmount) || 0;
      const cakeAmt = Math.max(0, totalAmount - debtAmt);

      if (debtAmt > 0) {
        await addDoc(collection(db, "expenses"), {
          amount: debtAmt,
          category: "مشتريات مخزنية",
          description: `فاتورة مواد كيك: ${storeName} [${items.length} مواد: ${itemsSummary}] (دين من الراتب)`,
          month,
          invoiceId,
          createdAt: serverTimestamp(),
          isDebt: true
        });
      }
      if (cakeAmt > 0) {
        await addDoc(collection(db, "expenses"), {
          amount: cakeAmt,
          category: "مشتريات مخزنية",
          description: `فاتورة مواد كيك: ${storeName} [${items.length} مواد: ${itemsSummary}] (أموال الكيك)`,
          month,
          invoiceId,
          createdAt: serverTimestamp(),
          isDebt: false
        });
      }
    } else {
      await addDoc(collection(db, "expenses"), {
        amount: totalAmount,
        category: "مشتريات مخزنية",
        description: `فاتورة مواد كيك: ${storeName} [${items.length} مواد: ${itemsSummary}]`,
        month,
        invoiceId,
        createdAt: serverTimestamp(),
        isDebt: paymentSource === "salary"
      });
    }
  }

  return invoiceId;
}
