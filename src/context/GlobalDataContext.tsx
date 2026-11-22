"use client";

import React, { createContext, useContext, useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface GlobalDataContextType {
  products: any[];
  categories: string[];
  courses: any[];
  supplies: any[];
  suppliesCategories: string[];
  loading: boolean;
  refreshAll: () => Promise<void>;
  activate: () => void;
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
  // البيانات ما تنحمّل إلا من تفتح صفحة تحتاجها (المتجر، الدورات، المستلزمات)
  // قبل: كل صفحة بالنظام (حتى الإدارة) كانت تقرا كاش كبير من localStorage وتنزّل كل المنتجات أول ما تفتح.
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>(["الكل"]);
  const [courses, setCourses] = useState<any[]>([]);
  const [supplies, setSupplies] = useState<any[]>([]);
  const [suppliesCategories, setSuppliesCategories] = useState<string[]>(["الكل"]);
  const [loading, setLoading] = useState<boolean>(true);
  const activated = useRef(false);

  const refreshAll = useCallback(async () => {
    try {
      const [
        prodSnap,
        catsSnap,
        coursesSnap,
        suppliesSnap,
        suppliesCatsSnap
      ] = await Promise.allSettled([
        getDocs(collection(db, "products")),
        getDocs(collection(db, "categories")),
        getDocs(collection(db, "courses")),
        getDocs(collection(db, "supplies")),
        getDocs(collection(db, "supplies_categories")),
        // ملاحظة: طلبات السوشيال لا تُحمَّل هنا. هذا المزوّد يعمل لكل زائر للمتجر،
        // وكان يجلب أسماء وهواتف وعناوين الزبائن لكل متصفح. الآن تُحمَّل داخل لوحة الإدارة فقط (lib/socialOrders).
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
    } catch (e) {
      console.error("GlobalDataContext refreshAll error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // تنظيف كاش قديم كان يخزّن طلبات السوشيال (بيانات زبائن + صور) في متصفح كل زائر
    try {
      localStorage.removeItem("cache_external_orders_v2");
      localStorage.removeItem("cache_external_orders_all");
    } catch {}
  }, []);

  // أول صفحة تستخدم البيانات تشغّل التحميل: الكاش فوراً، والتحديث من السيرفر بالخلفية
  const activate = useCallback(() => {
    if (activated.current) return;
    activated.current = true;
    const cachedProducts = safeGetLocal("cp_cache_products", []);
    setProducts(cachedProducts);
    setCategories(safeGetLocal("cp_cache_categories", ["الكل"]));
    setCourses(safeGetLocal("cp_cache_courses", []));
    setSupplies(safeGetLocal("cp_cache_supplies", []));
    setSuppliesCategories(safeGetLocal("cp_cache_supplies_categories", ["الكل"]));
    if (cachedProducts.length > 0) setLoading(false);
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
        loading,
        refreshAll,
        activate,
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
  const { activate } = ctx;
  useIsoLayoutEffect(() => { activate(); }, [activate]);
  return ctx;
}
