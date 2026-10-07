import { db } from "./firebase";
import { doc, setDoc } from "firebase/firestore";

export interface FinancesStats {
  todaySales: number;
  weekSales: number;
  monthSales: number;
  totalRevenue: number;
  netProfit: number;
  totalExpenses: number;
  totalSalaryDebt: number;
  cakeMaterialsExpense: number;
  breakdown: {
    social: number;
    appCakes: number;
    appAcademy: number;
    storeSupplies: number;
    appSupplies?: number;
  };
}

export const DEFAULT_FINANCES_STATS: FinancesStats = {
  todaySales: 0,
  weekSales: 0,
  monthSales: 0,
  totalRevenue: 0,
  netProfit: 0,
  totalExpenses: 0,
  totalSalaryDebt: 0,
  cakeMaterialsExpense: 0,
  breakdown: {
    social: 0,
    appCakes: 0,
    appAcademy: 0,
    storeSupplies: 0,
    appSupplies: 0,
  },
};

/**
 * Single Canonical Calculation Function
 * Matches finances/page.tsx (الجرد المالي) 100% accurately.
 */
export function calculateFinancesStats(
  orders: any[] = [],
  externalOrders: any[] = [],
  storeSales: any[] = [],
  expenses: any[] = []
): FinancesStats {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let todaySales = 0;
  let weekSales = 0;
  let monthSales = 0;
  let totalRevenue = 0;

  let social = 0;
  let appCakes = 0;
  let appAcademy = 0;
  let storeSupplies = 0;
  let appSupplies = 0;

  // 1. External Orders (Social: WhatsApp, Instagram)
  externalOrders.forEach((o) => {
    const isDelivered = o.status === "delivered" || o.status === "completed";
    if (!isDelivered) return;

    const price = Number(o.price || 0);
    let amt = price;
    if (o.paidAmount !== undefined && !o.isDebtSettled) {
      const paid = Number(o.paidAmount);
      if (paid < price) {
        amt = paid;
      }
    }

    totalRevenue += amt;
    social += amt;

    const rawDate = o.deliveryDate
      ? new Date(o.deliveryDate)
      : o.createdAt?.toDate
      ? o.createdAt.toDate()
      : new Date(o.createdAt || 0);
    const d = new Date(rawDate);
    d.setHours(0, 0, 0, 0);

    if (d.getTime() === today.getTime()) todaySales += amt;
    if (d >= weekAgo) weekSales += amt;
    if (rawDate >= thirtyDaysAgo) monthSales += amt;
  });

  // 2. App Orders (متجر كيك الأميرة)
  orders.forEach((o) => {
    const isDelivered = o.status === "delivered" || o.status === "completed";
    if (!isDelivered) return;

    let amt = Number(o.total || o.toPayNow || 0);
    if (o.isDebt && o.debtAmount > 0) {
      if (o.customerOwesUs === false) {
        // We owe customer, received full amount
      } else {
        // Customer owes us, received partial amount
        amt = amt - Number(o.debtAmount);
      }
    }

    totalRevenue += amt;

    if (o.items && Array.isArray(o.items)) {
      const hasAcademy = o.items.some(
        (i: any) => i.type === "course" || i.id?.includes("course")
      );
      const hasSupplies = o.items.some(
        (i: any) =>
          i.type === "supply" ||
          i.isSupply ||
          i.category === "supplies" ||
          i.id?.includes("supply")
      );
      if (hasAcademy) appAcademy += amt;
      else if (hasSupplies) appSupplies += amt;
      else appCakes += amt;
    } else {
      appCakes += amt;
    }

    const rawDate = o.deliveryDate
      ? new Date(o.deliveryDate)
      : o.createdAt?.toDate
      ? o.createdAt.toDate()
      : new Date(o.createdAt || 0);
    const d = new Date(rawDate);
    d.setHours(0, 0, 0, 0);

    if (d.getTime() === today.getTime()) todaySales += amt;
    if (d >= weekAgo) weekSales += amt;
    if (rawDate >= thirtyDaysAgo) monthSales += amt;
  });

  // 3. Store Sales (المستلزمات والمبيعات المباشرة)
  storeSales.forEach((o) => {
    if (["rejected", "cancelled"].includes(o.status)) return;
    // Skip debt settlements to avoid double counting revenue
    if (
      o.category === "تسديد ديون" ||
      (o.itemName && o.itemName.includes("تسديد دين"))
    )
      return;

    const amt = Number(o.price || 0);
    totalRevenue += amt;
    storeSupplies += amt;

    const rawDate = o.createdAt?.toDate
      ? o.createdAt.toDate()
      : new Date(o.createdAt || o.date || 0);
    const d = new Date(rawDate);
    d.setHours(0, 0, 0, 0);

    if (d.getTime() === today.getTime()) todaySales += amt;
    if (d >= weekAgo) weekSales += amt;
    if (rawDate >= thirtyDaysAgo) monthSales += amt;
  });

  // 4. Expenses & Salary Debt (مصروفات الكيك ودين الراتب الشخصي)
  // Non-debt expenses = actual expenses paid from cake funds
  const totalExpenses = expenses
    .filter((e) => !e.isDebt)
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);

  // Salary debt = money Haider/Eman paid for cake from personal salary (or negative when settled)
  const totalSalaryDebt = expenses
    .filter((e) => e.isDebt)
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const cakeMaterialsExpense = expenses
    .filter((e) => {
      const cat = e.category || "";
      const desc = e.description || e.title || "";
      return (
        cat === "مشتريات مخزنية" ||
        cat === "مواد الكيك" ||
        cat === "مواد كيك" ||
        cat === "المواد الأولية (كيك وكريمة)" ||
        desc.includes("المخزن") ||
        desc.includes("مادة") ||
        desc.includes("مواد")
      );
    })
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);

  // Net Profit formula identical to finances/page.tsx:
  // Revenue - Cake Expenses - Salary Debt
  const netProfit = totalRevenue - totalExpenses - totalSalaryDebt;

  return {
    todaySales,
    weekSales,
    monthSales,
    totalRevenue,
    netProfit,
    totalExpenses,
    totalSalaryDebt,
    cakeMaterialsExpense,
    breakdown: {
      social,
      appCakes,
      appAcademy,
      storeSupplies,
      appSupplies,
    },
  };
}

/**
 * Save synchronized stats to localStorage
 */
export function persistFinancesStats(stats: FinancesStats) {
  if (typeof window !== "undefined") {
    try {
      const sanitized: FinancesStats = {
        todaySales: Number(stats?.todaySales) || 0,
        weekSales: Number(stats?.weekSales) || 0,
        monthSales: Number(stats?.monthSales) || 0,
        totalRevenue: Number(stats?.totalRevenue) || 0,
        netProfit: Number(stats?.netProfit) || 0,
        totalExpenses: Number(stats?.totalExpenses) || 0,
        totalSalaryDebt: Number(stats?.totalSalaryDebt) || 0,
        cakeMaterialsExpense: Number(stats?.cakeMaterialsExpense) || 0,
        breakdown: {
          social: Number(stats?.breakdown?.social) || 0,
          appCakes: Number(stats?.breakdown?.appCakes) || 0,
          appAcademy: Number(stats?.breakdown?.appAcademy) || 0,
          storeSupplies: Number(stats?.breakdown?.storeSupplies) || 0,
          appSupplies: Number(stats?.breakdown?.appSupplies) || 0,
        },
      };
      localStorage.setItem("finances_stats", JSON.stringify(sanitized));
      localStorage.setItem(
        "admin_dashboard_stats_v2",
        JSON.stringify({ _timestamp: Date.now(), data: sanitized })
      );
      localStorage.setItem(
        "admin_quick_dashboard_v2",
        JSON.stringify({ _timestamp: Date.now(), data: sanitized })
      );
    } catch (e) {
      console.warn("Error caching finances_stats:", e);
    }
  }
}

/**
 * Load initial stats from localStorage for instant 0-second render
 * Always guarantees every property is a valid number to prevent runtime crashes.
 */
export function getCachedFinancesStats(): FinancesStats {
  if (typeof window === "undefined") return DEFAULT_FINANCES_STATS;
  try {
    const raw = localStorage.getItem("finances_stats");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return {
          todaySales: Number(parsed.todaySales) || 0,
          weekSales: Number(parsed.weekSales) || 0,
          monthSales: Number(parsed.monthSales ?? parsed.monthRevenue) || 0,
          totalRevenue: Number(parsed.totalRevenue) || 0,
          netProfit: Number(parsed.netProfit) || 0,
          totalExpenses: Number(parsed.totalExpenses) || 0,
          totalSalaryDebt: Number(parsed.totalSalaryDebt) || 0,
          cakeMaterialsExpense: Number(parsed.cakeMaterialsExpense) || 0,
          breakdown: {
            social: Number(parsed.breakdown?.social) || 0,
            appCakes: Number(parsed.breakdown?.appCakes) || 0,
            appAcademy: Number(parsed.breakdown?.appAcademy) || 0,
            storeSupplies: Number(parsed.breakdown?.storeSupplies) || 0,
            appSupplies: Number(parsed.breakdown?.appSupplies) || 0,
          },
        };
      }
    }
  } catch {}
  return DEFAULT_FINANCES_STATS;
}
