"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface GlobalDataContextType {
  products: any[];
  categories: string[];
  courses: any[];
  supplies: any[];
  suppliesCategories: string[];
  externalOrders: any[];
  loading: boolean;
  refreshAll: () => Promise<void>;
  updateExternalOrdersLocally: (orders: any[]) => void;
}

const GlobalDataContext = createContext<GlobalDataContextType | undefined>(undefined);

const safeGetLocal = (key: string, fallback: any) => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed?.data || parsed || fallback;
  } catch {
    return fallback;
  }
};

const safeSetLocal = (key: string, data: any) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify({ _ts: Date.now(), data }));
  } catch (e) {
    console.warn("Storage quota exceeded or error for key:", key, e);
  }
};

export function GlobalDataProvider({ children }: { children: React.ReactNode }) {
  // Synchronous cache hydration for 0ms page transitions
  const [products, setProducts] = useState<any[]>(() => safeGetLocal("cp_cache_products", []));
  const [categories, setCategories] = useState<string[]>(() => safeGetLocal("cp_cache_categories", ["الكل"]));
  const [courses, setCourses] = useState<any[]>(() => safeGetLocal("cp_cache_courses", []));
  const [supplies, setSupplies] = useState<any[]>(() => safeGetLocal("cp_cache_supplies", []));
  const [suppliesCategories, setSuppliesCategories] = useState<string[]>(() => safeGetLocal("cp_cache_supplies_categories", ["الكل"]));
  const [externalOrders, setExternalOrders] = useState<any[]>(() => safeGetLocal("cache_external_orders_v2", []));
  const [loading, setLoading] = useState<boolean>(() => {
    // Only true if we have zero cached items
    const hasCached = safeGetLocal("cp_cache_products", []).length > 0;
    return !hasCached;
  });

  const refreshAll = useCallback(async () => {
    try {
      const [
        prodSnap,
        catsSnap,
        coursesSnap,
        suppliesSnap,
        suppliesCatsSnap,
        extOrdersSnap
      ] = await Promise.allSettled([
        getDocs(collection(db, "products")),
        getDocs(collection(db, "categories")),
        getDocs(collection(db, "courses")),
        getDocs(collection(db, "supplies")),
        getDocs(collection(db, "supplies_categories")),
        getDocs(collection(db, "external_orders")),
      ]);

      if (prodSnap.status === "fulfilled" && !prodSnap.value.empty) {
        const pList = prodSnap.value.docs.map(d => ({ id: d.id, ...d.data() }));
        setProducts(pList);
        safeSetLocal("cp_cache_products", pList);
      }

      if (catsSnap.status === "fulfilled" && !catsSnap.value.empty) {
        const cList = ["الكل", ...catsSnap.value.docs.map(d => d.data().name).filter(Boolean)];
        setCategories(cList);
        safeSetLocal("cp_cache_categories", cList);
      }

      if (coursesSnap.status === "fulfilled" && !coursesSnap.value.empty) {
        const crsList = coursesSnap.value.docs.map(d => ({ id: d.id, ...d.data() }));
        setCourses(crsList);
        safeSetLocal("cp_cache_courses", crsList);
      }

      if (suppliesSnap.status === "fulfilled" && !suppliesSnap.value.empty) {
        const sList = suppliesSnap.value.docs.map(d => ({ id: d.id, ...d.data() }));
        setSupplies(sList);
        safeSetLocal("cp_cache_supplies", sList);
      }

      if (suppliesCatsSnap.status === "fulfilled" && !suppliesCatsSnap.value.empty) {
        const scList = ["الكل", ...suppliesCatsSnap.value.docs.map(d => d.data().name).filter(Boolean)];
        setSuppliesCategories(scList);
        safeSetLocal("cp_cache_supplies_categories", scList);
      }

      if (extOrdersSnap.status === "fulfilled" && !extOrdersSnap.value.empty) {
        const extList = extOrdersSnap.value.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
        // Sort in memory by date descending — NEVER using Firestore orderBy to prevent missing doc bugs
        extList.sort((a, b) => {
          const tA = new Date(a.createdAt?.toDate?.() || a.createdAt || 0).getTime();
          const tB = new Date(b.createdAt?.toDate?.() || b.createdAt || 0).getTime();
          return tB - tA;
        });
        setExternalOrders(extList);
        safeSetLocal("cache_external_orders_v2", extList);
        safeSetLocal("cache_external_orders_all", extList);
      }
    } catch (e) {
      console.error("GlobalDataContext refreshAll error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateExternalOrdersLocally = useCallback((orders: any[]) => {
    setExternalOrders(orders);
    safeSetLocal("cache_external_orders_v2", orders);
    safeSetLocal("cache_external_orders_all", orders);
  }, []);

  useEffect(() => {
    // Eagerly prefetch everything once on app startup in background idle
    refreshAll();
  }, [refreshAll]);

  return (
    <GlobalDataContext.Provider
      value={{
        products,
        categories,
        courses,
        supplies,
        suppliesCategories,
        externalOrders,
        loading,
        refreshAll,
        updateExternalOrdersLocally,
      }}
    >
      {children}
    </GlobalDataContext.Provider>
  );
}

export function useGlobalData() {
  const ctx = useContext(GlobalDataContext);
  if (!ctx) {
    throw new Error("useGlobalData must be used within a GlobalDataProvider");
  }
  return ctx;
}
