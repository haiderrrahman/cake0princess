"use client";
import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X, Home, Receipt, Users, ShoppingCart, ReceiptText,
  CreditCard, TrendingUp, Banknote, Calendar, Tag,
  Check, Loader2, Sparkles, Zap, Plus, ArrowRight,
  Camera, Image as ImageIcon, ListPlus, Trash2, ScanLine, Shield
} from "lucide-react";
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import FormattedNumberInput from "@/components/FormattedNumberInput";
import { toast } from "sonner";
import { customConfirm } from "@/lib/customConfirm";
import { scanReceiptWithGemini } from "@/lib/scanReceiptClient";
import { cleanForFirestore, uploadImageResiliently } from "@/lib/hfImageStore";
import {
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_MAP,
  detectProductCategory,
  OUTING_PLACES_SUGGESTIONS,
  sortItemsByCategoryPriority,
  saveLearnedCategory
} from "@/app/admin/home-finance/productCategories";

interface ExpenseItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  category?: string;
  place?: string;
  hasWarranty?: boolean;
  warrantyPeriod?: string;
  warrantyExpiryDate?: string;
  warrantyCardImage?: string;
  warrantyNotes?: string;
}

const compressImageFast = (file: File, maxDim = 1200, quality = 0.8): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim; }
          else { width = Math.round((width * maxDim) / height); height = maxDim; }
        }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

const fmt = (n: number) => (n || 0).toLocaleString("en-US");

interface HomeQuickEntryProps {
  onClose: () => void;
  onSuccess: () => void;
  initialTab?: "expense" | "family" | "need" | "bill" | "installment" | "income" | "debt";
}

interface TabItem {
  id: "expense" | "family" | "need" | "bill" | "installment" | "income" | "debt";
  label: string;
  icon: any;
  desc: string;
  badge: string;
  activeColor: string;
  iconColor: string;
}

const HOME_TABS: TabItem[] = [
  {
    id: "expense",
    label: "المصروفات",
    icon: Receipt,
    desc: "تسجيل فوري لمصروف منزلي، مسواك، أو شراء",
    badge: "افتراضي",
    activeColor: "border-rose-500 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/15 shadow-sm shadow-rose-500/20",
    iconColor: "text-rose-500 dark:text-rose-400",
  },
  {
    id: "family",
    label: "واجبات عائلة",
    icon: Users,
    desc: "تسجيل واجب أو طلب لأحد أفراد الأسرة",
    badge: "عائلة",
    activeColor: "border-purple-500 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/15 shadow-sm shadow-purple-500/20",
    iconColor: "text-purple-500 dark:text-purple-400",
  },
  {
    id: "need",
    label: "احتياج ونواقص",
    icon: ShoppingCart,
    desc: "إضافة مادة ناقصة لقائمة المسواك والنواقص",
    badge: "مسواك",
    activeColor: "border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/15 shadow-sm shadow-amber-500/20",
    iconColor: "text-amber-500 dark:text-amber-400",
  },
  {
    id: "bill",
    label: "فاتورة",
    icon: ReceiptText,
    desc: "تسجيل فاتورة ثابتة (مولدة، إنترنت، كهرباء...)",
    badge: "دورية",
    activeColor: "border-yellow-500 text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-500/15 shadow-sm shadow-yellow-500/20",
    iconColor: "text-yellow-500 dark:text-yellow-400",
  },
  {
    id: "installment",
    label: "قسط / سلفة",
    icon: CreditCard,
    desc: "تسجيل قسط شهري أو سلفة جديدة",
    badge: "التزام",
    activeColor: "border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/15 shadow-sm shadow-indigo-500/20",
    iconColor: "text-indigo-500 dark:text-indigo-400",
  },
  {
    id: "income",
    label: "دخل / وارد",
    icon: TrendingUp,
    desc: "إضافة راتب أو وارد مالي إضافي للميزانية",
    badge: "وارد",
    activeColor: "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 shadow-sm shadow-emerald-500/20",
    iconColor: "text-emerald-500 dark:text-emerald-400",
  },
  {
    id: "debt",
    label: "دين",
    icon: Banknote,
    desc: "توثيق دين لك عند شخص أو عليك",
    badge: "ديون",
    activeColor: "border-cyan-500 text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/15 shadow-sm shadow-cyan-500/20",
    iconColor: "text-cyan-500 dark:text-cyan-400",
  },
];

const EXPENSE_CATEGORIES = [
  "سوبر ماركت", "الفواكه والخضار", "المخبوزات والمعجنات", "لحوم ودواجن وأسماك",
  "الألبان والأجبان", "أساسيات ومؤونة الطبخ", "المعلبات والبقوليات", "الإفطار والمربيات",
  "مجمدات ومثلجات", "مطاعم وكافيهات", "السيارة والنقل", "فواتير وخدمات منزلية",
  "صيانة وترميم المنزل", "ملابس وأحذية", "صيدلية وعلاج", "العناية بالطفل",
  "العناية الشخصية", "منظفات ومعقمات", "اللوازم والأواني المنزلية", "سفريات وورقيات",
  "أثاث ومفروشات", "أجهزة كهربائية ومنزلية", "إلكترونيات وكمبيوتر", "هواتف واكسسوارات",
  "القرطاسية واللوازم المدرسية", "تعليم ودورات وكتب", "هدايا ومناسبات", "عطور وإكسسوارات وساعات",
  "كارتات وشحن", "السكائر والمعسل", "تبرعات وصدقات", "حيوانات أليفة وبيطرة",
  "طلعات وجولات", "ألعاب ويانصيب", "أقساط وسلف", "سفر ورحلات", "أخرى ومتفرقات"
];

const FAMILY_MEMBERS = ["العائلة", "حيدر", "إيمان", "رقية", "قنوت", "إيڤا"];

async function appendToHomeDoc(collectionKey: string, newItem: any) {
  const docRef = doc(db, "home_finance", collectionKey);
  const snap = await getDoc(docRef);
  let list: any[] = [];
  if (snap.exists() && Array.isArray(snap.data()?.data)) {
    list = snap.data().data;
  }
  const updated = [newItem, ...list];
  const cleanData = cleanForFirestore(updated);
  await setDoc(docRef, { data: cleanData, updatedAt: new Date() }, { merge: true });
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`cached_hf_${collectionKey}`, JSON.stringify(cleanData));
    } catch (e) {}
  }
  return updated;
}

export default function HomeQuickEntry({ onClose, onSuccess, initialTab = "expense" }: HomeQuickEntryProps) {
  const [tab, setTab] = useState<TabItem["id"]>(initialTab);
  const [submitting, setSubmitting] = useState(false);

  // 1. Expense state
  const [expName, setExpName] = useState("");
  const [expCategory, setExpCategory] = useState("سوبر ماركت");
  const [expAmount, setExpAmount] = useState("");
  const [expDate, setExpDate] = useState(new Date().toISOString().split("T")[0]);
  const [expNotes, setExpNotes] = useState("");

  // Expense AI & Items details state
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([]);
  const [attachedReceiptImages, setAttachedReceiptImages] = useState<string[]>([]);
  const [isScanningReceipt, setIsScanningReceipt] = useState(false);
  const [scanStatusText, setScanStatusText] = useState("");
  const [showQuickPasteModal, setShowQuickPasteModal] = useState(false);
  const [quickPasteText, setQuickPasteText] = useState("");
  const [uniqueNames, setUniqueNames] = useState<string[]>([]);
  const [uniqueProductNames, setUniqueProductNames] = useState<string[]>([]);
  const [uniquePlaces, setUniquePlaces] = useState<string[]>(() => OUTING_PLACES_SUGGESTIONS);
  const [showExpSuggestions, setShowExpSuggestions] = useState(false);
  const [focusedProductIdx, setFocusedProductIdx] = useState<number | null>(null);
  const [focusedPlaceIdx, setFocusedPlaceIdx] = useState<number | null>(null);

  const receiptCameraInputRef = useRef<HTMLInputElement>(null);
  const receiptGalleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        let list: any[] = [];
        if (typeof window !== "undefined") {
          try {
            const cached = localStorage.getItem("cached_hf_expenses");
            if (cached) list = JSON.parse(cached);
          } catch (e) {}
        }
        if (!list.length) {
          const snap = await getDoc(doc(db, "home_finance", "expenses"));
          if (snap.exists() && Array.isArray(snap.data()?.data)) {
            list = snap.data().data;
          }
        }
        if (list.length > 0) {
          const namesSet = new Set<string>();
          const productsSet = new Set<string>();
          const placesMap = new Map<string, number>();

          list.forEach((e: any) => {
            if (e.name && typeof e.name === "string" && e.name.trim()) {
              namesSet.add(e.name.trim());
            }
            if (e.place && typeof e.place === "string" && e.place.trim()) {
              const p = e.place.trim();
              placesMap.set(p, (placesMap.get(p) || 0) + 3);
            }
            if (e.storeName && typeof e.storeName === "string" && e.storeName.trim()) {
              const s = e.storeName.trim();
              placesMap.set(s, (placesMap.get(s) || 0) + 3);
            }
            if (Array.isArray(e.items)) {
              e.items.forEach((it: any) => {
                if (it.name && typeof it.name === "string" && it.name.trim()) {
                  productsSet.add(it.name.trim());
                }
                if (it.place && typeof it.place === "string" && it.place.trim()) {
                  const ip = it.place.trim();
                  placesMap.set(ip, (placesMap.get(ip) || 0) + 2);
                }
              });
            }
          });

          OUTING_PLACES_SUGGESTIONS.forEach(op => {
            if (!placesMap.has(op)) placesMap.set(op, 1);
          });

          const sortedPlaces = Array.from(placesMap.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([pl]) => pl);

          setUniqueNames(Array.from(namesSet).slice(0, 30));
          setUniqueProductNames(Array.from(productsSet).slice(0, 50));
          setUniquePlaces(sortedPlaces);
        }
      } catch (err) {
        console.warn("Could not load expense suggestions:", err);
      }
    };
    fetchSuggestions();
  }, []);

  // 2. Family need state
  const [familyMember, setFamilyMember] = useState("العائلة");
  const [familyType, setFamilyType] = useState<"duty" | "need">("duty");
  const [familyTitle, setFamilyTitle] = useState("");
  const [familyCategory, setFamilyCategory] = useState("منزل");
  const [familyPriority, setFamilyPriority] = useState("مهم");
  const [familyEstPrice, setFamilyEstPrice] = useState("");
  const [familyNotes, setFamilyNotes] = useState("");

  // 3. Need state
  const [needName, setNeedName] = useState("");
  const [needQty, setNeedQty] = useState("1");
  const [needUnit, setNeedUnit] = useState("قطعة");
  const [needEstPrice, setNeedEstPrice] = useState("");
  const [needCategory, setNeedCategory] = useState("أغذية ومسواك");
  const [needNotes, setNeedNotes] = useState("");

  // 4. Bill state
  const [billName, setBillName] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billDueDay, setBillDueDay] = useState("1");
  const [billPaymentType, setBillPaymentType] = useState<"مسبق" | "لاحق">("مسبق");

  // 5. Installment state
  const [instName, setInstName] = useState("");
  const [instType, setInstType] = useState<"قسط" | "سلفة">("قسط");
  const [instTotalAmount, setInstTotalAmount] = useState("");
  const [instMonthly, setInstMonthly] = useState("");
  const [instMonths, setInstMonths] = useState("");
  const [instStartDate, setInstStartDate] = useState(new Date().toISOString().split("T")[0]);

  // 6. Income state
  const [incName, setIncName] = useState("");
  const [incType, setIncType] = useState<"راتب" | "إضافي" | "أخرى">("راتب");
  const [incAmount, setIncAmount] = useState("");
  const [incDate, setIncDate] = useState(new Date().toISOString().split("T")[0]);

  // 7. Debt state
  const [debtPerson, setDebtPerson] = useState("");
  const [debtType, setDebtType] = useState<"دين لي" | "دين علي">("دين لي");
  const [debtAmount, setDebtAmount] = useState("");
  const [debtDate, setDebtDate] = useState(new Date().toISOString().split("T")[0]);
  const [debtNotes, setDebtNotes] = useState("");

  const activeTabInfo = HOME_TABS.find(t => t.id === tab) || HOME_TABS[0];

  // AI Receipt Scanner Handler
  const handleScanReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    try {
      setIsScanningReceipt(true);
      setScanStatusText(files.length > 1 ? `جاري قراءة واستخراج البيانات من ${files.length} صور بالذكاء الاصطناعي 🧠...` : "جاري قراءة واستخراج بيانات الفاتورة بالذكاء الاصطناعي 🧠...");

      const dataUrls = await Promise.all(files.map(f => compressImageFast(f, 1200, 0.8)));
      // Note: We DO NOT attach scanned images per user request:
      // "والصورة مال فاتورة الي اضيفها ما اريد ترفقها يعني بس ياخذ بياناتها وميرفقها"
      const data = await scanReceiptWithGemini(dataUrls, (status) => setScanStatusText(status));

      if (!expName.trim() || expName === "غير محدد") {
        if (data.storeName && data.storeName !== "غير محدد" && data.storeName !== "فاتورة مشتريات" && data.storeName !== "سوبر ماركت") {
          setExpName(data.storeName);
        } else {
          setExpName("تعاون ماركت");
        }
      }

      if (data.category && (!expCategory || expCategory === "سوبر ماركت")) {
        setExpCategory(data.category);
      }

      const todayStr = new Date().toISOString().split("T")[0];
      const currentYear = new Date().getFullYear().toString();
      let extractedDate = data.date;

      if (extractedDate) {
        const parts = extractedDate.split("-");
        if (parts.length === 3) {
          if (parts[0] !== currentYear) {
            extractedDate = `${currentYear}-${parts[1]}-${parts[2]}`;
          }
        }
        if (extractedDate > todayStr) {
          extractedDate = todayStr;
        }
      } else {
        extractedDate = todayStr;
      }

      setExpDate(extractedDate);

      if (Array.isArray(data.items) && data.items.length > 0) {
        const formattedItems = data.items.map((it: any, idx: number) => ({
          id: it.id || `item-${Date.now()}-${idx}-${Math.random().toString(36).substring(7)}`,
          name: it.name || "",
          quantity: Number(it.quantity) || 1,
          price: Number(it.price) || 0,
          category: it.category || detectProductCategory(it.name || ""),
          place: it.place || (data.storeName && data.storeName !== "غير محدد" ? data.storeName : "سوبر ماركت")
        }));

        const existingValid = expenseItems.filter(it => (it.name || "").trim() !== "" || (Number(it.price) || 0) > 0);
        if (existingValid.length > 0) {
          const combined = [...existingValid, ...formattedItems];
          setExpenseItems(combined);
          const sum = combined.reduce((acc, curr) => acc + (curr.price || 0), 0);
          setExpAmount(sum.toString());
          toast.success(`تم دمج وإضافة ${formattedItems.length} مواد جديدة مع القائمة السابقة! ⚡✨`);
        } else {
          setExpenseItems(formattedItems);
          const sum = formattedItems.reduce((acc, curr) => acc + (curr.price || 0), 0);
          setExpAmount(sum.toString());
          toast.success(`تم استخراج ${formattedItems.length} مادة وتعبئة بيانات الفاتورة بنجاح! ⚡✨`);
        }
      }
    } catch (err: any) {
      console.error("Receipt scan failed:", err);
      toast.error(err.message || "حدث خطأ أثناء مسح الفاتورة");
    } finally {
      setIsScanningReceipt(false);
      setScanStatusText("");
      if (e.target) e.target.value = "";
    }
  };

  // Quick Paste text parser
  const handleQuickPasteSubmit = () => {
    if (!quickPasteText.trim()) return;

    const lines = quickPasteText.split("\n").map(l => l.trim()).filter(Boolean);
    const newItems: ExpenseItem[] = [];

    for (const line of lines) {
      const cleanedLine = line.replace(/^[\d]+\.\s*/, "").replace(/^[-•*]\s*/, "").trim();
      const match = cleanedLine.match(/^(.*?)(?:[\s,:=-]+)(\d+(?:[.,]\d+)?)(?:[\s,:=-]+(\d+(?:[.,]\d+)?))?$/);
      if (match) {
        let name = match[1].trim();
        let num1 = parseFloat(match[2].replace(/,/g, ""));
        let num2 = match[3] ? parseFloat(match[3].replace(/,/g, "")) : null;

        let quantity = 1;
        let price = 0;

        if (num2 !== null) {
          if (num1 > 100 && num2 <= 100) {
            price = num1;
            quantity = num2;
          } else {
            quantity = num1 || 1;
            price = num2;
          }
        } else {
          price = num1;
        }

        if (name && price > 0) {
          newItems.push({
            id: `item-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            name,
            quantity,
            price
          });
          continue;
        }
      }

      const parts = cleanedLine.split(/\s+/);
      if (parts.length >= 2) {
        const lastPart = parts[parts.length - 1].replace(/[^\d.]/g, "");
        const price = parseFloat(lastPart) || 0;
        const name = parts.slice(0, parts.length - 1).join(" ");
        if (name && price > 0) {
          newItems.push({
            id: `item-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            name,
            quantity: 1,
            price,
            category: detectProductCategory(name),
            place: expName.trim() || (expCategory === "طلعات وجولات" ? "سوق" : "سوبر ماركت")
          });
        }
      }
    }

    if (newItems.length > 0) {
      const updated = [...expenseItems, ...newItems];
      setExpenseItems(updated);
      const sum = updated.reduce((acc, curr) => acc + (curr.price || 0), 0);
      setExpAmount(sum.toString());
      toast.success(`تمت إضافة ${newItems.length} مواد بنجاح!`);
      setShowQuickPasteModal(false);
      setQuickPasteText("");
    } else {
      toast.error("لم يتم التعرف على أي مواد. تأكد من إدخال اسم المادة والسعر في كل سطر.");
    }
  };

  // Submit Handlers
  const handleSaveExpense = async () => {
    const validItems = expenseItems.filter(i => (i.name || "").trim() !== "");
    const totalAmount = validItems.length > 0
      ? validItems.reduce((acc, curr) => acc + (Number(curr.price) || 0), 0)
      : Number(expAmount.replace(/,/g, ''));

    if (totalAmount <= 0 && validItems.length === 0 && !expName.trim()) {
      toast.error("يرجى إدخال اسم ومبلغ المصروف أو تفاصيل المواد");
      return;
    }
    setSubmitting(true);
    try {
      let finalReceiptImages = [...attachedReceiptImages];
      if (finalReceiptImages.some(img => img.startsWith("data:image"))) {
        try {
          finalReceiptImages = await Promise.all(
            finalReceiptImages.map((img, idx) => 
              uploadImageResiliently("receipts", `quick_rec_${Date.now()}_${idx}`, img)
            )
          );
        } catch (uploadErr) {
          console.warn("Receipt upload issue, using safe fallback:", uploadErr);
        }
      }

      const derivedCategory = validItems.find(i => i.category && i.category.trim() !== "")?.category
        || expCategory
        || "سوبر ماركت";

      const finalName = expName.trim() || validItems[0]?.place || validItems[0]?.name || (derivedCategory === "سوبر ماركت" ? "تعاون ماركت" : (derivedCategory || "مصروف عام"));
      const cleanedItems: ExpenseItem[] = validItems.map((vit, idx) => ({
        id: vit.id || `item-${Date.now()}-${idx}`,
        name: vit.name.trim(),
        quantity: Number(vit.quantity) || 1,
        price: Number(vit.price) || 0,
        category: vit.category || derivedCategory,
        place: vit.place || finalName
      }));

      const newExp: any = {
        id: Date.now().toString(),
        name: finalName,
        category: derivedCategory,
        amount: totalAmount,
        date: expDate || new Date().toISOString().split("T")[0],
        notes: expNotes.trim(),
        createdAt: new Date().toISOString(),
        imageUrl: finalReceiptImages[0] || "",
        receiptImages: finalReceiptImages
      };
      if (cleanedItems.length > 0) {
        newExp.items = cleanedItems;
      }
      await appendToHomeDoc("expenses", newExp);
      toast.success("تم تسجيل المصروف وحفظه بنجاح 💸");
      setAttachedReceiptImages([]);
      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("فشل تسجيل المصروف");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveFamily = async () => {
    if (!familyTitle.trim()) {
      toast.error("يرجى كتابة عنوان الواجب أو الطلب");
      return;
    }
    setSubmitting(true);
    try {
      const newFamilyItem = {
        id: Date.now().toString() + Math.random().toString().slice(2, 6),
        member: familyMember,
        title: familyTitle.trim(),
        type: familyType,
        category: familyCategory,
        quantity: 1,
        estimatedPrice: familyEstPrice ? Number(familyEstPrice.replace(/,/g, '')) : 0,
        priority: familyPriority,
        notes: familyNotes.trim(),
        status: "pending",
        createdAt: new Date().toISOString()
      };
      await appendToHomeDoc("familyNeeds", newFamilyItem);

      addDoc(collection(db, "notifications"), {
        userId: "admin",
        title: `${familyType === "duty" ? "واجب جديد" : "طلب جديد"} لـ ${familyMember}`,
        message: familyTitle.trim(),
        type: familyType,
        imageUrl: "",
        read: false,
        link: "/admin/home-finance?tab=family",
        createdAt: serverTimestamp()
      }).catch(() => {});

      toast.success(familyType === "duty" ? "تم إضافة الواجب بنجاح 🎯" : "تم إضافة الطلب بنجاح 🛍️");
      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("فشل حفظ إدخال العائلة");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveNeed = async () => {
    if (!needName.trim()) {
      toast.error("يرجى إدخال اسم المادة أو الاحتياج");
      return;
    }
    setSubmitting(true);
    try {
      const newNeed = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
        name: needName.trim(),
        quantity: Number(needQty) || 1,
        unit: needUnit,
        estimatedPrice: needEstPrice ? Number(needEstPrice.replace(/,/g, '')) : 0,
        category: needCategory,
        notes: needNotes.trim(),
        sourceType: "manual",
        isBought: false,
        createdAt: new Date().toISOString()
      };
      await appendToHomeDoc("needs", newNeed);
      toast.success("تمت إضافة الاحتياج إلى قائمة النواقص 🛒");
      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("فشل حفظ الاحتياج");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveBill = async () => {
    const rawAmt = Number(billAmount.replace(/,/g, ''));
    if (!billName.trim() || !rawAmt) {
      toast.error("يرجى إدخال اسم الفاتورة والمبلغ");
      return;
    }
    setSubmitting(true);
    try {
      const newBill = {
        id: Date.now().toString(),
        name: billName.trim(),
        amount: rawAmt,
        dueDay: Number(billDueDay) || 1,
        paymentType: billPaymentType,
        paidDates: [],
        createdAt: new Date().toISOString()
      };
      await appendToHomeDoc("bills", newBill);
      toast.success("تم إضافة الفاتورة بنجاح 🧾");
      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("فشل حفظ الفاتورة");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveInstallment = async () => {
    const total = Number(instTotalAmount.replace(/,/g, ''));
    const monthly = Number(instMonthly.replace(/,/g, ''));
    if (!instName.trim() || !total || !monthly) {
      toast.error("يرجى إدخال اسم القسط والمبلغ الكلي والقسط الشهري");
      return;
    }
    setSubmitting(true);
    try {
      const newInst = {
        id: Date.now().toString(),
        name: instName.trim(),
        type: instType,
        totalAmount: total,
        monthlyInstallment: monthly,
        remainingAmount: total,
        startDate: instStartDate || new Date().toISOString().split("T")[0],
        totalMonths: Number(instMonths) || Math.ceil(total / (monthly || 1)),
        initialPaidMonths: 0,
        downPayment: 0,
        payments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await appendToHomeDoc("installments", newInst);
      toast.success("تم إضافة القسط / السلفة بنجاح 💳");
      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("فشل حفظ القسط");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveIncome = async () => {
    const rawAmt = Number(incAmount.replace(/,/g, ''));
    if (!incName.trim() || !rawAmt) {
      toast.error("يرجى إدخال مصدر الدخل والمبلغ");
      return;
    }
    setSubmitting(true);
    try {
      const newInc = {
        id: Date.now().toString(),
        name: incName.trim(),
        type: incType,
        amount: rawAmt,
        date: incDate || new Date().toISOString().split("T")[0],
        createdAt: new Date().toISOString()
      };
      await appendToHomeDoc("incomes", newInc);
      toast.success("تم تسجيل الدخل بنجاح 💵");
      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("فشل تسجيل الدخل");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDebt = async () => {
    const rawAmt = Number(debtAmount.replace(/,/g, ''));
    if (!debtPerson.trim() || !rawAmt) {
      toast.error("يرجى إدخال اسم الشخص والمبلغ");
      return;
    }
    setSubmitting(true);
    try {
      const newDebt = {
        id: Date.now().toString(),
        person: debtPerson.trim(),
        type: debtType,
        amount: rawAmt,
        date: debtDate || new Date().toISOString().split("T")[0],
        notes: debtNotes.trim(),
        isPaid: false,
        createdAt: new Date().toISOString()
      };
      await appendToHomeDoc("debts", newDebt);
      toast.success("تم إضافة سجل الدين بنجاح ⚖️");
      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("فشل حفظ الدين");
    } finally {
      setSubmitting(false);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />

      {/* Modal Dialog */}
      <div className="bg-white dark:bg-[#0D0A1A] border border-gray-200 dark:border-white/15 w-full max-w-xl rounded-t-[36px] sm:rounded-[36px] shadow-2xl relative z-10 flex flex-col max-h-[92vh] text-gray-900 dark:text-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 dark:border-white/10 bg-gradient-to-r from-rose-50/80 via-pink-50/50 to-purple-50/80 dark:from-rose-950/80 dark:via-[#1c0c24]/90 dark:to-purple-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-600 p-[1.5px] shadow-lg shadow-pink-500/20">
              <div className="w-full h-full bg-white dark:bg-[#120516] rounded-[14px] flex items-center justify-center">
                <Home className="w-5 h-5 text-rose-500 dark:text-pink-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white tracking-tight">إضافة سريعة لإدارة المنزل</h2>
                <span className="text-[10px] font-bold bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 px-2 py-0.5 rounded-full">
                  🏡 VIP
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 font-bold mt-0.5">
                {activeTabInfo.desc}
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose} 
            className="w-9 h-9 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white rounded-full flex items-center justify-center transition active:scale-90 border border-gray-200 dark:border-white/10"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Horizontal Scrollable Tabs */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-white/10 bg-gray-50/90 dark:bg-[#0d0718]/90 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 min-w-max pb-1">
            {HOME_TABS.map((t) => {
              const isActive = tab === t.id;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`px-3 py-2 rounded-2xl border text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap active:scale-95 ${
                    isActive
                      ? t.activeColor
                      : "border-gray-200/80 dark:border-white/10 bg-white dark:bg-white/5 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300"
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? t.iconColor : "text-gray-400 dark:text-slate-500"}`} />
                  <span>{t.label}</span>
                  {t.badge && (
                    <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive ? "bg-white/40 dark:bg-white/20" : "bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-slate-400"
                    }`}>
                      {t.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: المصروفات (Default) */}
          {tab === "expense" && (
            <div className="space-y-4 animate-in fade-in duration-200 relative">
              {/* Hidden file inputs for AI Scanning */}
              <input
                type="file"
                ref={receiptCameraInputRef}
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleScanReceipt}
              />
              <input
                type="file"
                ref={receiptGalleryInputRef}
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleScanReceipt}
              />

              {/* Smart Action Buttons (AI Scan & Quick Paste) */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => receiptCameraInputRef.current?.click()}
                  className="flex items-center justify-center gap-1.5 p-2.5 rounded-2xl font-black text-xs bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-sm hover:opacity-95 active:scale-[0.98] transition cursor-pointer"
                  title="تصوير الفاتورة مباشرة بالكاميرا"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>مسح كاميرا 📸</span>
                </button>

                <button
                  type="button"
                  onClick={() => receiptGalleryInputRef.current?.click()}
                  className="flex items-center justify-center gap-1.5 p-2.5 rounded-2xl font-black text-xs bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-sm hover:opacity-95 active:scale-[0.98] transition cursor-pointer"
                  title="رفع وقراءة صورة الفاتورة من الاستوديو"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>من الاستوديو 🖼️</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowQuickPasteModal(true)}
                  className="flex items-center justify-center gap-1.5 p-2.5 rounded-2xl font-black text-xs bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 transition active:scale-[0.98] cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>لصق سريعة ⚡</span>
                </button>
              </div>

              {/* Attached Receipt Images Preview */}
              {attachedReceiptImages.length > 0 && (
                <div className="p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      صور الفاتورة المرفقة ({attachedReceiptImages.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setAttachedReceiptImages([])}
                      className="text-[11px] font-bold text-rose-500 hover:text-rose-700 hover:underline"
                    >
                      حذف الصور
                    </button>
                  </div>
                  <div className="flex gap-2.5 overflow-x-auto pb-1 custom-scrollbar">
                    {attachedReceiptImages.map((img, i) => (
                      <div key={i} className="relative group shrink-0 w-16 h-16 rounded-xl overflow-hidden border border-indigo-200 dark:border-indigo-800 bg-black/5">
                        <img src={img} alt={`فاتورة ${i + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setAttachedReceiptImages(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute top-1 right-1 w-5 h-5 bg-rose-600 text-white rounded-full flex items-center justify-center text-xs opacity-90 hover:opacity-100 shadow cursor-pointer"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => receiptGalleryInputRef.current?.click()}
                      className="shrink-0 w-16 h-16 rounded-xl border-2 border-dashed border-indigo-300 dark:border-indigo-700 flex flex-col items-center justify-center text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100/50 dark:hover:bg-indigo-900/30 transition text-[10px] font-bold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 mb-0.5" />
                      إضافة
                    </button>
                  </div>
                </div>
              )}

              {/* Store / Description with Suggestions */}
              <div className="relative">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">اسم أو وجه المصروف</label>
                <div className="relative">
                  <Receipt className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="text" 
                    value={expName} 
                    onChange={e => {
                      setExpName(e.target.value);
                      setShowExpSuggestions(e.target.value.length >= 1);
                    }}
                    onFocus={() => setShowExpSuggestions(expName.length >= 1)}
                    onBlur={() => setTimeout(() => setShowExpSuggestions(false), 200)}
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 pr-10 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none"
                    placeholder="مثال: مسواك تعاون ماركت، خضار وفواكه..."
                  />
                </div>
                {showExpSuggestions && uniqueNames.filter(n => n.includes(expName)).length > 0 && (
                  <div className="absolute z-30 w-full mt-1 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-xl max-h-40 overflow-y-auto">
                    {uniqueNames.filter(n => n.includes(expName)).slice(0, 6).map((suggestedName, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => { setExpName(suggestedName); setShowExpSuggestions(false); }} 
                        className="px-4 py-2 hover:bg-rose-50 dark:hover:bg-zinc-700 cursor-pointer text-xs font-bold text-gray-800 dark:text-gray-200"
                      >
                        {suggestedName}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">المبلغ (د.ع) *</label>
                    {expenseItems.length > 0 && (
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded">
                        محسوب آلياً
                      </span>
                    )}
                  </div>
                  {expenseItems.length > 0 ? (
                    <input 
                      type="text"
                      readOnly
                      value={fmt(expenseItems.reduce((acc, curr) => acc + (curr.price || 0), 0))}
                      className="w-full bg-indigo-50/50 dark:bg-zinc-800/80 border border-indigo-200 dark:border-indigo-800/40 rounded-xl px-4 py-3 text-sm text-rose-600 dark:text-rose-400 font-black outline-none text-left cursor-not-allowed"
                    />
                  ) : (
                    <FormattedNumberInput
                      value={expAmount} 
                      onChange={setExpAmount} 
                      placeholder="المبلغ د.ع"
                      className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none text-left font-black"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">التاريخ</label>
                  <div className="relative">
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input 
                      type="date" 
                      value={expDate} 
                      onChange={e => setExpDate(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 pr-10 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none text-left"
                    />
                  </div>
                </div>
              </div>

              {/* ─── Ultra-Fast Keyboard-Navigable Items Section ─── */}
              <div className="pt-2 border-t border-gray-100 dark:border-zinc-800 space-y-2.5">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                      <ListPlus className="w-4 h-4 text-indigo-500" />
                      <span>تفاصيل قائمة المنتجات</span>
                    </label>
                    {expenseItems.length > 0 && (
                      <span className="text-[11px] font-black bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-500/30">
                        {expenseItems.length} مواد | {fmt(expenseItems.reduce((acc, curr) => acc + (curr.price || 0), 0))} د.ع
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {expenseItems.length > 0 && (
                      <button 
                        type="button" 
                        onClick={() => {
                          if (confirm("هل تريد مسح جميع المواد من القائمة؟")) {
                            setExpenseItems([]);
                            setExpAmount("");
                          }
                        }}
                        className="text-xs text-red-500 hover:text-red-700 font-bold px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition"
                      >
                        مسح الكل
                      </button>
                    )}
                    {expenseItems.length > 1 && (
                      <button 
                        type="button" 
                        onClick={() => {
                          const sorted = sortItemsByCategoryPriority(expenseItems);
                          setExpenseItems(sorted);
                          toast.success("تم ترتيب المواد حسب أولوية الأقسام (المخضر والفواكه أولاً...) 🥗✨");
                        }}
                        className="text-xs flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-black bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1.5 rounded-xl hover:bg-emerald-100 transition active:scale-95 border border-emerald-200/60 dark:border-emerald-500/30"
                        title="ترتيب المواد حسب الأولوية الغذائية والمنزلية (المخضر والفواكه بالبداية)"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        <span>🥗 أولوية</span>
                      </button>
                    )}
                    <button 
                      type="button" 
                      onClick={() => {
                        const newId = `item-${Date.now()}-${Math.random().toString(36).substring(7)}`;
                        const updated = [...expenseItems, { 
                          id: newId, 
                          name: "", 
                          quantity: 1, 
                          price: 0,
                          category: "",
                          place: expName.trim() || (expCategory === "طلعات وجولات" ? "سوق" : "سوبر ماركت")
                        }];
                        setExpenseItems(updated);
                        setTimeout(() => {
                          const input = document.getElementById(`quick-exp-item-name-${updated.length - 1}`);
                          if (input) input.focus();
                        }, 50);
                      }} 
                      className="text-xs flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-black bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition active:scale-95 border border-indigo-200/60 dark:border-indigo-500/30"
                    >
                      <Plus className="w-3.5 h-3.5" /> إضافة مادة (Enter)
                    </button>
                  </div>
                </div>

                {expenseItems.length > 0 ? (
                  <div className="bg-gray-50 dark:bg-zinc-900 rounded-2xl p-2 sm:p-3 border border-gray-100 dark:border-zinc-800">
                    <div className="hidden sm:grid sm:grid-cols-12 gap-2 px-2 pb-2 text-[11px] font-black text-gray-500 border-b border-gray-200 dark:border-zinc-800 text-right">
                      <div className="col-span-1 text-center">#</div>
                      <div className="col-span-4">اسم المادة / المنتج</div>
                      <div className="col-span-3">القسم / الفئة 🏷️</div>
                      <div className="col-span-2">المكان / المحل 📍</div>
                      <div className="col-span-1 text-center">الكمية</div>
                      <div className="col-span-1 text-left">السعر</div>
                    </div>

                    <div className="space-y-2 mt-2 max-h-[260px] overflow-y-auto pr-1 custom-scrollbar">
                      {expenseItems.map((item, idx) => (
                        <div 
                          key={item.id} 
                          className="flex flex-col sm:grid sm:grid-cols-12 gap-2 items-center bg-white dark:bg-zinc-950 p-2 sm:p-2 rounded-xl border border-gray-200/80 dark:border-zinc-800 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-600 transition"
                        >
                          {/* Row Index */}
                          <div className="hidden sm:flex sm:col-span-1 items-center justify-center font-black text-xs text-gray-400">
                            {idx + 1}
                          </div>

                          {/* Product Name with Suggestions */}
                          <div className="w-full sm:col-span-4 relative">
                            <input 
                              id={`quick-exp-item-name-${idx}`}
                              type="text" 
                              placeholder="اسم المنتج (طماطة، روبة..)" 
                              value={item.name} 
                              autoComplete="off"
                              onFocus={() => setFocusedProductIdx(idx)}
                              onBlur={() => setTimeout(() => setFocusedProductIdx(null), 200)}
                              onChange={e => {
                                const val = e.target.value;
                                const newItems = [...expenseItems];
                                newItems[idx].name = val;
                                const pred = detectProductCategory(val);
                                if (pred) {
                                  newItems[idx].category = pred;
                                }
                                setExpenseItems(newItems);
                              }} 
                              className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700/80 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500/40 font-bold transition" 
                            />
                            {focusedProductIdx === idx && (item.name || "").length >= 1 && uniqueProductNames.filter(n => n.includes(item.name || "")).length > 0 && (
                              <div className="absolute z-30 w-full mt-1 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-xl max-h-32 overflow-y-auto">
                                {uniqueProductNames.filter(n => n.includes(item.name || "")).slice(0, 5).map((suggestedName, sIdx) => (
                                  <div 
                                    key={sIdx} 
                                    onClick={() => { 
                                      const newItems = [...expenseItems];
                                      newItems[idx].name = suggestedName;
                                      const pred = detectProductCategory(suggestedName);
                                      if (pred) newItems[idx].category = pred;
                                      setExpenseItems(newItems);
                                      setFocusedProductIdx(null);
                                    }} 
                                    className="px-3 py-1.5 hover:bg-indigo-50 dark:hover:bg-zinc-700 cursor-pointer text-xs font-bold text-gray-800 dark:text-gray-200"
                                  >
                                    {suggestedName}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Category Selector (Comprehensive Departments) */}
                          <div className="w-full sm:col-span-3">
                            <select
                              value={item.category || ""}
                              onChange={e => {
                                const newCat = e.target.value;
                                const newItems = [...expenseItems];
                                newItems[idx].category = newCat;
                                setExpenseItems(newItems);
                                if (newItems[idx].name && newCat) {
                                  saveLearnedCategory(newItems[idx].name, newCat);
                                }
                              }}
                              className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700/80 rounded-lg px-2 py-1.5 text-[11px] font-bold outline-none focus:ring-2 focus:ring-indigo-500/40 text-gray-800 dark:text-gray-200 cursor-pointer"
                            >
                              <option value="">اختر القسم (تنبؤ ذكي 🧠)</option>
                              {PRODUCT_CATEGORIES.map(cat => (
                                <option key={cat.id} value={cat.name}>
                                  {cat.icon} {cat.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Place / Shop Selector (Only suggests when user writes >= 1 character) */}
                          <div className="w-full sm:col-span-2 relative">
                            <input
                              type="text"
                              placeholder="المحل (سوق، كراج، مطعم..)"
                              value={item.place || ""}
                              autoComplete="new-password"
                              data-lpignore="true"
                              data-form-type="other"
                              autoCorrect="off"
                              spellCheck={false}
                              onFocus={() => {
                                if ((item.place || "").trim().length >= 1) {
                                  setFocusedPlaceIdx(idx);
                                } else {
                                  setFocusedPlaceIdx(null);
                                }
                              }}
                              onBlur={() => setTimeout(() => setFocusedPlaceIdx(null), 250)}
                              onChange={e => {
                                const val = e.target.value;
                                const newItems = [...expenseItems];
                                newItems[idx].place = val;
                                setExpenseItems(newItems);
                                if (val.trim().length >= 1) {
                                  setFocusedPlaceIdx(idx);
                                } else {
                                  setFocusedPlaceIdx(null);
                                }
                              }}
                              className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700/80 rounded-lg px-2 py-1.5 text-[11px] font-bold outline-none focus:ring-2 focus:ring-indigo-500/40 text-gray-800 dark:text-gray-200"
                            />
                            {focusedPlaceIdx === idx && (item.place || "").trim().length >= 1 && (() => {
                              const q = (item.place || "").toLowerCase().trim();
                              const matched = uniquePlaces.filter(p => p.toLowerCase().includes(q)).slice(0, 8);
                              if (matched.length === 0) return null;
                              return (
                                <div className="absolute z-30 w-full min-w-[160px] mt-1 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-xl max-h-40 overflow-y-auto">
                                  {matched.map((p, pIdx) => (
                                    <div
                                      key={pIdx}
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        const newItems = [...expenseItems];
                                        newItems[idx].place = p;
                                        setExpenseItems(newItems);
                                        setFocusedPlaceIdx(null);
                                      }}
                                      className="px-2.5 py-1.5 hover:bg-indigo-50 dark:hover:bg-zinc-700 cursor-pointer text-xs font-bold text-gray-800 dark:text-gray-200"
                                    >
                                      📍 {p}
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>

                          {/* Quantity & Price */}
                          <div className="w-full flex sm:contents gap-2">
                            <div className="w-20 sm:w-auto sm:col-span-1">
                              <input 
                                type="number" 
                                placeholder="الكمية" 
                                min="0.1" 
                                step="any" 
                                value={item.quantity || ''} 
                                onChange={e => {
                                  const newItems = [...expenseItems];
                                  newItems[idx].quantity = Number(e.target.value);
                                  setExpenseItems(newItems);
                                }} 
                                className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700/80 rounded-lg px-1.5 py-1.5 text-xs text-center outline-none focus:ring-2 focus:ring-indigo-500/40 font-bold transition" 
                              />
                            </div>

                            <div className="flex-1 sm:col-span-1 flex items-center gap-1">
                              <input 
                                id={`quick-exp-item-price-${idx}`}
                                type="number" 
                                placeholder="السعر" 
                                value={item.price || ''} 
                                onKeyDown={e => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    if (idx === expenseItems.length - 1) {
                                      const newId = `item-${Date.now()}-${Math.random().toString(36).substring(7)}`;
                                      const updated = [...expenseItems, { 
                                        id: newId, 
                                        name: "", 
                                        quantity: 1, 
                                        price: 0,
                                        category: "",
                                        place: expName.trim() || "سوبر ماركت"
                                      }];
                                      setExpenseItems(updated);
                                      setTimeout(() => {
                                        const nextInput = document.getElementById(`quick-exp-item-name-${updated.length - 1}`);
                                        if (nextInput) nextInput.focus();
                                      }, 50);
                                    } else {
                                      const nextInput = document.getElementById(`quick-exp-item-name-${idx + 1}`);
                                      if (nextInput) nextInput.focus();
                                    }
                                  }
                                }}
                                onChange={e => {
                                  const newItems = [...expenseItems];
                                  newItems[idx].price = Number(e.target.value);
                                  setExpenseItems(newItems);
                                  const sum = newItems.reduce((acc, curr) => acc + (curr.price || 0), 0);
                                  setExpAmount(sum.toString());
                                }} 
                                className="w-full min-w-0 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700/80 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500/40 font-black text-rose-600 dark:text-rose-400 text-left transition" 
                              />

                              <button 
                                type="button" 
                                onClick={async () => {
                                  if (await customConfirm("هل تريد حذف هذه المادة من القائمة؟", { confirmText: "نعم", cancelText: "لا" })) {
                                    const updated = expenseItems.filter(x => x.id !== item.id);
                                    setExpenseItems(updated);
                                    if (updated.length > 0) {
                                      setExpAmount(updated.reduce((acc, curr) => acc + (curr.price || 0), 0).toString());
                                    }
                                  }
                                }} 
                                className="text-red-500 hover:text-red-600 p-1 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 rounded-lg transition shrink-0 cursor-pointer"
                                title="حذف هذه المادة"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-gray-200 dark:border-zinc-800 flex justify-between items-center text-xs px-1">
                      <span className="text-gray-500 font-bold text-[10px]">💡 اضغط Enter في حقل السعر لإضافة سطر جديد</span>
                      <span className="font-black text-gray-800 dark:text-white">المجموع: {fmt(expenseItems.reduce((acc, curr) => acc + (curr.price || 0), 0))} د.ع</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50/70 dark:bg-zinc-900/40 border border-dashed border-gray-200 dark:border-zinc-800 rounded-2xl p-4 text-center">
                    <p className="text-xs font-bold text-gray-400 mb-2">لم تقم بإضافة مواد تفصيلية للمصروف بعد (اختياري)</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => receiptCameraInputRef.current?.click()}
                        className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline px-2 py-1 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg"
                      >
                        📸 مسح فاتورة
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowQuickPasteModal(true)}
                        className="text-xs text-amber-600 dark:text-amber-400 font-bold hover:underline px-2 py-1 bg-amber-50 dark:bg-amber-500/10 rounded-lg"
                      >
                        ⚡ لصق قائمة نصية
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const newId = `item-${Date.now()}-${Math.random().toString(36).substring(7)}`;
                          setExpenseItems([{ id: newId, name: "", quantity: 1, price: 0 }]);
                        }}
                        className="text-xs text-gray-600 dark:text-gray-300 font-bold hover:underline px-2 py-1 bg-gray-100 dark:bg-zinc-800 rounded-lg"
                      >
                        ✍️ كتابة يدوية
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">ملاحظات (اختياري)</label>
                <textarea 
                  value={expNotes} 
                  onChange={e => setExpNotes(e.target.value)} 
                  rows={2}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none resize-none"
                  placeholder="أي تفاصيل تخص المصروف..."
                />
              </div>

              <button
                type="button"
                onClick={handleSaveExpense} 
                disabled={submitting}
                className="w-full bg-gradient-to-r from-rose-500 via-pink-600 to-purple-600 hover:from-rose-600 hover:to-purple-700 text-white py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 mt-2 shadow-lg shadow-pink-500/25 active:scale-95 transition cursor-pointer"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>تسجيل المصروف</span><Check className="w-4 h-4" /></>}
              </button>
            </div>
          )}

          {/* TAB 2: واجبات عائلة */}
          {tab === "family" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">فرد العائلة</label>
                  <select 
                    value={familyMember} 
                    onChange={e => setFamilyMember(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                  >
                    {FAMILY_MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">نوع الإدخال</label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-gray-100 dark:bg-zinc-800 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setFamilyType("duty")}
                      className={`py-1.5 text-xs font-black rounded-lg transition ${
                        familyType === "duty" ? "bg-purple-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                      }`}
                    >
                      🎯 واجب
                    </button>
                    <button
                      type="button"
                      onClick={() => setFamilyType("need")}
                      className={`py-1.5 text-xs font-black rounded-lg transition ${
                        familyType === "need" ? "bg-purple-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                      }`}
                    >
                      🛍️ طلب
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">عنوان الواجب أو الطلب *</label>
                <input 
                  type="text" 
                  value={familyTitle} 
                  onChange={e => setFamilyTitle(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                  placeholder="مثال: شراء ملابس شتوية، موعد دكتور، تجديد اشتراك..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">الأولوية</label>
                  <select 
                    value={familyPriority} 
                    onChange={e => setFamilyPriority(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                  >
                    <option value="عادي">عادي</option>
                    <option value="مهم">مهم</option>
                    <option value="عاجل">عاجل 🚨</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">السعر التقديري (اختياري)</label>
                  <FormattedNumberInput
                    value={familyEstPrice} 
                    onChange={setFamilyEstPrice} 
                    placeholder="السعر د.ع"
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none text-left"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">ملاحظات إضافية</label>
                <textarea 
                  value={familyNotes} 
                  onChange={e => setFamilyNotes(e.target.value)} 
                  rows={2}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                  placeholder="ملاحظات أو مواصفات خاصة..."
                />
              </div>

              <button
                type="button"
                onClick={handleSaveFamily} 
                disabled={submitting}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 mt-2 shadow-lg shadow-purple-500/25 active:scale-95 transition"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>حفظ في قائمة العائلة</span><Check className="w-4 h-4" /></>}
              </button>
            </div>
          )}

          {/* TAB 3: احتياج ونواقص */}
          {tab === "need" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">اسم المادة أو الاحتياج *</label>
                <input 
                  type="text" 
                  value={needName} 
                  onChange={e => setNeedName(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                  placeholder="مثال: حليب، مسحوق غسيل، معجون أسنان، صابون..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">الكمية</label>
                  <input 
                    type="number" 
                    value={needQty} 
                    onChange={e => setNeedQty(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">الوحدة</label>
                  <select 
                    value={needUnit} 
                    onChange={e => setNeedUnit(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                  >
                    <option value="قطعة">قطعة</option>
                    <option value="كيلو">كيلو</option>
                    <option value="علبة">علبة</option>
                    <option value="كيس">كيس</option>
                    <option value="لتر">لتر</option>
                    <option value="باكيت">باكيت</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">التصنيف</label>
                  <select 
                    value={needCategory} 
                    onChange={e => setNeedCategory(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                  >
                    <option value="أغذية ومسواك">أغذية ومسواك</option>
                    <option value="منظفات ومنزل">منظفات ومنزل</option>
                    <option value="صيدلية وأدوية">صيدلية وأدوية</option>
                    <option value="أطفال">أطفال</option>
                    <option value="أخرى">أخرى</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">السعر التقديري (اختياري)</label>
                  <FormattedNumberInput
                    value={needEstPrice} 
                    onChange={setNeedEstPrice} 
                    placeholder="السعر د.ع"
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none text-left"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">ملاحظات</label>
                <input 
                  type="text" 
                  value={needNotes} 
                  onChange={e => setNeedNotes(e.target.value)} 
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                  placeholder="ماركة مفضلة، حجم معين..."
                />
              </div>

              <button
                type="button"
                onClick={handleSaveNeed} 
                disabled={submitting}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 mt-2 shadow-lg shadow-orange-500/25 active:scale-95 transition"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>إضافة إلى النواقص</span><Check className="w-4 h-4" /></>}
              </button>
            </div>
          )}

          {/* TAB 4: فاتورة */}
          {tab === "bill" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">اسم الفاتورة *</label>
                <input 
                  type="text" 
                  value={billName} 
                  onChange={e => setBillName(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-yellow-500 outline-none"
                  placeholder="مثال: مولدة الشارع، إنترنت فايبر، صيانة مجمع..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">المبلغ الشهري (د.ع) *</label>
                  <FormattedNumberInput
                    value={billAmount} 
                    onChange={setBillAmount} 
                    placeholder="المبلغ د.ع"
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-yellow-500 outline-none text-left font-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">يوم الاستحقاق في الشهر</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="31"
                    value={billDueDay} 
                    onChange={e => setBillDueDay(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-yellow-500 outline-none"
                    placeholder="يوم 1، 15..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">نوع الدفع</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBillPaymentType("مسبق")}
                    className={`py-2 text-xs font-black rounded-xl border transition ${
                      billPaymentType === "مسبق"
                        ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                        : "border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    دفع مسبق (بداية الشهر)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillPaymentType("لاحق")}
                    className={`py-2 text-xs font-black rounded-xl border transition ${
                      billPaymentType === "لاحق"
                        ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                        : "border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    دفع لاحق (نهاية الشهر)
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveBill} 
                disabled={submitting}
                className="w-full bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 mt-2 shadow-lg shadow-yellow-500/25 active:scale-95 transition"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>تسجيل الفاتورة</span><Check className="w-4 h-4" /></>}
              </button>
            </div>
          )}

          {/* TAB 5: قسط / سلفة */}
          {tab === "installment" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">الاسم *</label>
                  <input 
                    type="text" 
                    value={instName} 
                    onChange={e => setInstName(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="مثال: سلفة العمل، قسط سيارة..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">النوع</label>
                  <select 
                    value={instType} 
                    onChange={e => setInstType(e.target.value as any)}
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="قسط">قسط</option>
                    <option value="سلفة">سلفة</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">المبلغ الكلي (د.ع) *</label>
                  <FormattedNumberInput
                    value={instTotalAmount} 
                    onChange={setInstTotalAmount} 
                    placeholder="المبلغ الإجمالي"
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none text-left font-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">القسط الشهري (د.ع) *</label>
                  <FormattedNumberInput
                    value={instMonthly} 
                    onChange={setInstMonthly} 
                    placeholder="الدفعة الشهرية"
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none text-left font-black"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">عدد الأشهر الكلي</label>
                  <input 
                    type="number" 
                    value={instMonths} 
                    onChange={e => setInstMonths(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="مثال: 10 أو 12"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">تاريخ البدء</label>
                  <input 
                    type="date" 
                    value={instStartDate} 
                    onChange={e => setInstStartDate(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none text-left"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveInstallment} 
                disabled={submitting}
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 mt-2 shadow-lg shadow-indigo-500/25 active:scale-95 transition"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>حفظ القسط / السلفة</span><Check className="w-4 h-4" /></>}
              </button>
            </div>
          )}

          {/* TAB 6: دخل / وارد */}
          {tab === "income" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">مصدر الدخل أو الوصف *</label>
                <input 
                  type="text" 
                  value={incName} 
                  onChange={e => setIncName(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="مثال: الراتب الأساسي، وارد كيك، عمل حر..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">المبلغ (د.ع) *</label>
                  <FormattedNumberInput
                    value={incAmount} 
                    onChange={setIncAmount} 
                    placeholder="المبلغ د.ع"
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none text-left font-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">النوع</label>
                  <select 
                    value={incType} 
                    onChange={e => setIncType(e.target.value as any)}
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="راتب">راتب أساسي</option>
                    <option value="إضافي">وارد إضافي</option>
                    <option value="أخرى">أخرى</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">تاريخ الاستلام</label>
                <input 
                  type="date" 
                  value={incDate} 
                  onChange={e => setIncDate(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none text-left"
                />
              </div>

              <button
                type="button"
                onClick={handleSaveIncome} 
                disabled={submitting}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 mt-2 shadow-lg shadow-emerald-500/25 active:scale-95 transition"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>تسجيل الدخل</span><Check className="w-4 h-4" /></>}
              </button>
            </div>
          )}

          {/* TAB 7: دين */}
          {tab === "debt" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">اسم الشخص / الجهة *</label>
                <input 
                  type="text" 
                  value={debtPerson} 
                  onChange={e => setDebtPerson(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                  placeholder="اسم الشخص أو المحل..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">نوع الدين</label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-gray-100 dark:bg-zinc-800 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setDebtType("دين لي")}
                      className={`py-1.5 text-xs font-black rounded-lg transition ${
                        debtType === "دين لي" ? "bg-cyan-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                      }`}
                    >
                      📈 دين لي
                    </button>
                    <button
                      type="button"
                      onClick={() => setDebtType("دين علي")}
                      className={`py-1.5 text-xs font-black rounded-lg transition ${
                        debtType === "دين علي" ? "bg-rose-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                      }`}
                    >
                      📉 دين علي
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">المبلغ (د.ع) *</label>
                  <FormattedNumberInput
                    value={debtAmount} 
                    onChange={setDebtAmount} 
                    placeholder="المبلغ د.ع"
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 outline-none text-left font-black"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">التاريخ</label>
                <input 
                  type="date" 
                  value={debtDate} 
                  onChange={e => setDebtDate(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 outline-none text-left"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">ملاحظات</label>
                <textarea 
                  value={debtNotes} 
                  onChange={e => setDebtNotes(e.target.value)} 
                  rows={2}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 outline-none resize-none"
                  placeholder="سبب الدين، موعد التسديد المتوقع..."
                />
              </div>

              <button
                type="button"
                onClick={handleSaveDebt} 
                disabled={submitting}
                className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 mt-2 shadow-lg shadow-cyan-500/25 active:scale-95 transition"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>تسجيل الدين</span><Check className="w-4 h-4" /></>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
