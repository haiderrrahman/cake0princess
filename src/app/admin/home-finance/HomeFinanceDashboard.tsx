"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import {
  ArrowRight, Plus, Minus, Check, Wallet, CreditCard, Receipt,
  TrendingDown, TrendingUp, AlertCircle, ShoppingCart, X, Trash2,
  Edit2, Car, Home, Shirt, Sofa, Wrench, Users, DollarSign,
  Calendar, ChevronDown, ChevronUp, Clock, BarChart3, PiggyBank,
  Banknote, Activity, Package, Zap, Heart, BookOpen, ChevronRight, ChevronLeft, ClipboardCopy, Plane,
  Map as MapIcon, MapPin, ArrowLeft, Calculator, Share2, Target, Flag, Circle, CheckCircle2,
  MessageCircle, Send, Bot, Sparkles, BrainCircuit, CheckCircle, PackageCheck,
  Camera, Upload, ScanLine, FileText, ListPlus, Copy, Search, RefreshCw, Loader2,
  Pill, Image as ImageIcon, Eye,
  Flame, Lightbulb, ShieldAlert, ShieldCheck, Compass, Info,
  Shield, ZoomIn, Download, Flower2
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { customConfirm } from "@/lib/customConfirm";
import { db, storage } from "@/lib/firebase";

const FamilyCompetition = dynamic(() => import("./FamilyCompetition"), { ssr: false });
const FamilyCompetitionOverview = dynamic(() => import("./FamilyCompetitionOverview"), { ssr: false });
const LottoTracker = dynamic(() => import("./LottoTracker"), { ssr: false });
const WomenCycleCare = dynamic(() => import("./WomenCycleCare"), { ssr: false });
const FamilySection = dynamic(() => import("./FamilySection"), { ssr: false });
import { FamilyHealthRecord } from "./familyTypes";
import { doc, getDoc, setDoc, onSnapshot, addDoc, collection, serverTimestamp, deleteDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { WORLD_COUNTRIES, IRAQ_GOVERNORATES } from "./countries";
import { uploadImageResiliently, compressToTinyThumbnail, cleanForFirestore } from "@/lib/hfImageStore";
import { scanReceiptWithGemini } from "@/lib/scanReceiptClient";
import { scanNeedItemWithGemini, cropItemFromImage, ScannedNeedItem } from "@/lib/scanNeedItemClient";
import {
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_MAP,
  detectProductCategory,
  OUTING_PLACES_SUGGESTIONS,
  ProductCategoryDef,
  sortItemsByCategoryPriority,
  getCategoryPriorityIndex,
  CATEGORY_PRIORITY_INDEX_MAP,
  saveLearnedCategory,
  WARRANTY_PERIOD_PRESETS,
  calculateWarrantyExpiryDate,
  getWarrantyStatus,
  classifyItemNature,
  ItemNatureClassification,
  normalizeArabicText,
  ProductPriority,
  detectProductPriority,
  getProductPriorityInfo,
  isCarExpenseMatch,
  detectFamilyMemberMatch,
  isCarFuelExpense,
  isCarMaintenanceExpense,
  isCarItem
} from "./productCategories";

// ══════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════

interface WalletState {
  bankBalance: number;
  cashBalance: number;
  updatedAt?: string;
  notes?: string;
}

interface Installment {
  id: string;
  name: string;
  type: "قسط" | "سلفة";
  totalAmount: number;
  monthlyInstallment: number;
  remainingAmount: number;
  startDate: string; // ISO date
  totalMonths?: number;
  initialPaidMonths?: number;
  downPayment?: number; // المقدمة
  payments: { date: string; amount: number; note?: string; expenseId?: string }[];
  createdAt: string;
  updatedAt: string;
}

interface Bill {
  id: string;
  name: string;
  category: string;
  amount: number;
  dueDay?: number; // day of month
  paid: boolean;
  paidDates: { date: string; amount: number; expenseId: string; cycleId?: string }[];
  paymentType?: "مسبق" | "لاحق";
  createdAt: string;
}

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
  priority?: ProductPriority;
}

interface Expense {
  id: string;
  name: string;
  category: string;
  amount: number;
  date: string;
  createdAt: string;
  items?: ExpenseItem[];
  imageUrl?: string;
  receiptUrl?: string;
  receiptImages?: string[];
  hasWarranty?: boolean;
  warrantiesCount?: number;
  warrantyCardImage?: string;
  targetMember?: string;
  isCar?: boolean;
}

interface Income {
  id: string;
  name: string;
  amount: number;
  date: string;
  type: "راتب" | "حافز" | "إضافي";
  createdAt: string;
}

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  neededQuantity?: number;
  threshold: number;
  unit: string;
  estimatedPrice?: number;
  category: string;
  notes?: string;
  imageUrl?: string;
  images?: string[];
  tripDestination?: string;
  createdAt: string;
  updatedAt?: string;
  _source?: "inventory" | "car" | "travel";
}

interface Need {
  id: string;
  name: string;
  estimatedPrice: number;
  isBought: boolean;
  createdAt: string;
  quantity?: number;
  unit?: string;
  category?: string;
  imageUrl?: string;
  images?: string[];
  notes?: string;
  dosageOrSpecs?: string;
  sourceType?: "manual" | "photo" | "inventory" | "car" | "travel" | "family";
}

interface Debt {
  id: string;
  person: string;
  amount: number;
  type: "دين لي" | "دين علي";
  date: string; // Start date
  monthlyInstallment?: number;
  totalMonths?: number;
  initialPaidMonths?: number;
  downPayment?: number;
  payments: { date: string; amount: number; type?: "دين لي" | "دين علي"; note?: string; expenseOrIncomeId?: string }[];
  associatedRecordId?: string;
  createdAt: string;
}

interface FamilyMemberNeed {
  id: string;
  member: string; // "حيدر" | "إيمان" | "رقية" | "قنوت" | "إيڤا"
  title: string;
  type?: "need" | "duty" | "expense"; // "need" = طلبات واحتياجات, "duty" = واجبات ومسؤوليات, "expense" = مصاريف ومشتريات
  category: string;
  quantity?: number;
  estimatedPrice?: number;
  priority?: string;
  notes?: string;
  status: "pending" | "available" | "completed";
  createdAt: string;
  expenseId?: string;
  expenseDate?: string;
}

interface TravelTrip {
  id: string;
  name: string;
  destination: string;
  members: string[];
  currency?: string;
  status: "active" | "completed";
  createdAt: string;
}

interface TravelExpense {
  id: string;
  tripId: string;
  description: string;
  amount: number;
  currency?: string;
  paidBy: string;
  splitBetween: string[];
  date: string;
  createdAt: string;
}

interface FuturePlan {
  id: string;
  title: string;
  targetAmount: number;
  savedAmount: number;
  savingVision?: string;
  targetDate: string;
  imageUrl?: string;
  steps: { id: string; text: string; isCompleted: boolean; date?: string }[];
  createdAt: string;
}


// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════

const fmt = (n: number) => n.toLocaleString("en-US");
const today = () => new Date().toISOString().split("T")[0];

const EXPENSE_CATEGORIES = [
  { label: "سوبر ماركت", icon: "🛒", color: "from-emerald-500 to-teal-500" },
  { label: "الفواكه والخضار", icon: "🍌", color: "from-emerald-500 to-green-600" },
  { label: "المخبوزات والمعجنات", icon: "🥐", color: "from-amber-500 to-orange-500" },
  { label: "لحوم ودواجن وأسماك", icon: "🥩", color: "from-rose-500 to-red-600" },
  { label: "الألبان والأجبان", icon: "🧀", color: "from-yellow-400 to-amber-500" },
  { label: "أساسيات ومؤونة الطبخ", icon: "🍳", color: "from-lime-500 to-emerald-600" },
  { label: "المعلبات والبقوليات", icon: "🥫", color: "from-red-500 to-rose-600" },
  { label: "الإفطار والمربيات", icon: "🥚", color: "from-orange-400 to-amber-500" },
  { label: "مجمدات ومثلجات", icon: "🍟", color: "from-sky-500 to-blue-500" },
  { label: "الصلصات والمقبلات", icon: "🍅", color: "from-rose-600 to-red-600" },
  { label: "التوابل والأعشاب", icon: "🧂", color: "from-yellow-600 to-amber-700" },
  { label: "المشروبات والعصائر", icon: "🥤", color: "from-blue-500 to-cyan-500" },
  { label: "المياه والشرب", icon: "💧", color: "from-cyan-400 to-blue-500" },
  { label: "الشاي، القهوة والسكر", icon: "☕", color: "from-amber-700 to-amber-900" },
  { label: "حلويات وشوكولاته", icon: "🍫", color: "from-pink-500 to-rose-500" },
  { label: "سناكات ومكسرات", icon: "🥔", color: "from-orange-500 to-amber-600" },
  { label: "جاهز للأكل وسندويشات", icon: "🥪", color: "from-teal-500 to-emerald-600" },
  { label: "مطاعم وكافيهات", icon: "🍽️", color: "from-amber-500 to-orange-600" },
  { label: "السيارة والنقل", icon: "🚗", color: "from-blue-600 to-cyan-600" },
  { label: "فواتير وخدمات منزلية", icon: "⚡", color: "from-yellow-500 to-amber-500" },
  { label: "صيانة وترميم المنزل", icon: "🔧", color: "from-stone-500 to-slate-600" },
  { label: "ملابس وأحذية", icon: "👔", color: "from-indigo-500 to-purple-600" },
  { label: "صيدلية وعلاج", icon: "💊", color: "from-emerald-600 to-teal-600" },
  { label: "العناية بالطفل", icon: "👶", color: "from-sky-400 to-blue-400" },
  { label: "العناية الشخصية", icon: "🧴", color: "from-purple-500 to-pink-500" },
  { label: "منظفات ومعقمات", icon: "🧼", color: "from-cyan-600 to-teal-600" },
  { label: "اللوازم والأواني المنزلية", icon: "🍳", color: "from-stone-600 to-zinc-700" },
  { label: "سفريات وورقيات", icon: "🧻", color: "from-blue-400 to-indigo-500" },
  { label: "أثاث ومفروشات", icon: "🛋️", color: "from-amber-600 to-yellow-600" },
  { label: "أجهزة كهربائية ومنزلية", icon: "🔌", color: "from-rose-500 to-orange-500" },
  { label: "إلكترونيات وكمبيوتر", icon: "💻", color: "from-slate-700 to-indigo-800" },
  { label: "هواتف واكسسوارات", icon: "📱", color: "from-violet-500 to-purple-600" },
  { label: "القرطاسية واللوازم المدرسية", icon: "✏️", color: "from-indigo-600 to-blue-600" },
  { label: "تعليم ودورات وكتب", icon: "📚", color: "from-emerald-700 to-teal-800" },
  { label: "هدايا ومناسبات", icon: "🎁", color: "from-pink-500 to-rose-400" },
  { label: "عطور وإكسسوارات وساعات", icon: "💍", color: "from-purple-600 to-indigo-600" },
  { label: "منتجات صحية ورياضية", icon: "🌾", color: "from-emerald-500 to-lime-600" },
  { label: "كارتات وشحن", icon: "💳", color: "from-purple-500 to-violet-600" },
  { label: "السكائر والمعسل", icon: "🚬", color: "from-zinc-600 to-stone-700" },
  { label: "حيوانات أليفة وبيطرة", icon: "🐾", color: "from-amber-600 to-orange-600" },
  { label: "تبرعات وصدقات", icon: "🤲", color: "from-teal-600 to-emerald-600" },
  { label: "طلعات وجولات", icon: "🎡", color: "from-emerald-500 via-teal-500 to-cyan-600" },
  { label: "ألعاب ويانصيب", icon: "🎲", color: "from-indigo-500 to-purple-500" },
  { label: "أقساط وسلف", icon: "💳", color: "from-indigo-600 to-blue-700" },
  { label: "سفر ورحلات", icon: "✈️", color: "from-sky-500 to-blue-600" },
  { label: "ديون الكيك", icon: "🎂", color: "from-pink-500 to-rose-600" },
  { label: "ديون", icon: "🤝", color: "from-pink-500 to-rose-600" },
  { label: "ديون وأقساط", icon: "🤝", color: "from-rose-500 to-pink-600" },
  { label: "العائلة", icon: "👨‍👩‍👧", color: "from-pink-500 to-rose-500" },
  { label: "العائلة ومصروف شخصي", icon: "👨‍👩‍👧", color: "from-pink-500 to-rose-500" },
  { label: "موجودات ونواقص", icon: "📦", color: "from-teal-500 to-emerald-600" },
  { label: "بنزين ووقود", icon: "⛽", color: "from-blue-600 to-cyan-600" },
  { label: "أخرى ومتفرقات", icon: "📦", color: "from-gray-500 to-slate-600" },
  // Backward compatibility aliases for existing data in database:
  { label: "سيارة", icon: "🚗", color: "from-blue-500 to-cyan-500" },
  { label: "مطاعم وكوفيهات", icon: "🍽️", color: "from-orange-500 to-amber-500" },
  { label: "مخضر وفواكه", icon: "🍎", color: "from-green-400 to-emerald-400" },
  { label: "لحوم ودجاج", icon: "🥩", color: "from-red-600 to-rose-700" },
  { label: "خبز وصمون", icon: "🥖", color: "from-amber-600 to-yellow-600" },
  { label: "اجبان والبان", icon: "🧀", color: "from-yellow-400 to-yellow-500" },
  { label: "صحة وطب", icon: "❤️", color: "from-red-500 to-pink-500" },
  { label: "ملابس", icon: "👕", color: "from-purple-500 to-violet-500" },
  { label: "تعليم", icon: "📚", color: "from-indigo-500 to-blue-500" },
  { label: "ترفيه", icon: "🎮", color: "from-pink-500 to-rose-500" },
  { label: "أثاث", icon: "🛋️", color: "from-amber-500 to-yellow-500" },
  { label: "ترميم", icon: "🔧", color: "from-gray-500 to-slate-500" },
  { label: "عائلة", icon: "👪", color: "from-sky-500 to-blue-500" },
  { label: "كهرباء", icon: "⚡", color: "from-yellow-400 to-yellow-600" },
  { label: "ماء", icon: "💧", color: "from-blue-400 to-blue-600" },
  { label: "إنترنت", icon: "🌐", color: "from-sky-400 to-sky-600" },
  { label: "إيجار", icon: "🏠", color: "from-emerald-400 to-emerald-600" },
  { label: "هاتف", icon: "📱", color: "from-gray-400 to-gray-600" },
  { label: "تنظيف", icon: "🧹", color: "from-teal-400 to-teal-600" },
  { label: "غاز", icon: "🔥", color: "from-orange-500 to-red-500" },
  { label: "عطور", icon: "🌸", color: "from-purple-400 to-pink-500" },
  { label: "ألعاب", icon: "🧸", color: "from-amber-400 to-yellow-500" },
  { label: "مفروشات", icon: "🛏️", color: "from-teal-400 to-emerald-500" },
  { label: "منزلية", icon: "🏡", color: "from-cyan-600 to-blue-600" },
  { label: "كهربائية", icon: "🔌", color: "from-amber-400 to-yellow-500" },
  { label: "انشائية", icon: "🏗️", color: "from-amber-700 to-stone-600" },
  { label: "مواد سفري", icon: "🥡", color: "from-orange-500 to-amber-600" },
  { label: "بنوك وصراف", icon: "🏦", color: "from-blue-600 to-sky-700" },
  { label: "تبرعات", icon: "🤲", color: "from-emerald-400 to-teal-500" },
  { label: "سفر", icon: "✈️", color: "from-sky-400 to-blue-500" }
];

const BILL_CATEGORIES = ["كهرباء", "ماء", "إنترنت", "إيجار", "هاتف", "تنظيف", "غاز"];

const HOME_INVENTORY_CATEGORIES = [
  "سوبر ماركت", "منظفات", "خضروات", "فواكه", "لحوم", "أدوات منزلية", "صيانة", "عطور", "ألعاب", "مفروشات",
  "أجهزة كهربائية", "أدوية ومستلزمات طبية", "ملابس", "مواد بناء بسيطة", "مستلزمات زراعة وحديقة", "مستلزمات مدرسية", "أدوات مطبخ", "مستلزمات أطفال", "أخرى"
];
const CAR_INVENTORY_CATEGORIES = [
  "صيانة", "وقود", "غسيل وتنظيف", "إكسسوارات", "أوراق وفحص", "أخرى"
];
const TRAVEL_INVENTORY_CATEGORIES = [
  "تذاكر", "فنادق", "أمتعة", "تأشيرات", "مستلزمات شخصية", "مأكولات ومشروبات", "أخرى"
];
const NEED_CATEGORIES = [
  "أدوية وصيدلية",
  "سوبر ماركت",
  "منظفات",
  "عناية شخصية",
  "مستلزمات منزلية",
  "أغذية ومسواك",
  "أدوات وصيانة",
  "أطفال ورضع",
  "سيارة",
  "سفر",
  "أخرى"
];
const HOME_INVENTORY_UNITS = ["كغم", "لتر", "قطعة", "كيس", "علبة", "بطل", "كيلو"];

const FAMILY_MEMBERS = ["حيدر", "إيمان", "رقية", "قنوت", "إيڤا"];


// ══════════════════════════════════════════════
// STORAGE
// ══════════════════════════════════════════════




const syncToFirebase = async (key: string, data: any) => {
  try {
    const cleanData = cleanForFirestore(data);
    await setDoc(doc(db, "home_finance", key), { data: cleanData });
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`cached_hf_${key}`, JSON.stringify(cleanData));
      } catch (e) {
        // Ignore quota limits
      }
    }
  } catch (error: any) {
    console.error(`Error saving ${key} to firebase:`, error);
    toast.error(`خطأ أثناء الحفظ في السحابة: ${error?.message || "يرجى التحقق من الاتصال"}`);
  }
};

const getExpenseOriginBadge = (exp: Expense) => {
  if ((exp as any).isFromCake) return null;
  const normName = normalizeArabicText(exp.name || "");
  const cat = exp.category || "";

  if (cat === "ألعاب ويانصيب" || normName.includes("لوتو") || normName.includes("يانصيب")) {
    return { label: "لوتو ويانصيب", icon: "🎰", bg: "bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/40" };
  }
  if (normName.startsWith("تسديد دين") || normName.startsWith("تسديد قسط دين") || cat === "ديون وأقساط" || cat === "ديون") {
    return { label: "تسديد دين", icon: "🤝", bg: "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/40" };
  }
  if (normName.startsWith("قسط:") || cat === "أقساط وسلف") {
    return { label: "قسط شهري", icon: "💳", bg: "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/40" };
  }
  if (normName.startsWith("فاتورة:") || cat === "فواتير ومستحقات" || cat === "فواتير وخدمات منزلية") {
    return { label: "فاتورة وخدمات", icon: "⚡", bg: "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/40" };
  }
  if (exp.id.startsWith("travel_") || normName.startsWith("سفره") || cat === "سفر ورحلات") {
    return { label: "سفرة ورحلة", icon: "✈️", bg: "bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800/40" };
  }
  if (cat === "طلعات وجولات" || normName.includes("طلعه") || normName.includes("كافيه") || normName.includes("مطعم") || normName.includes("جوله") || normName.includes("مشوار")) {
    return { label: "مشوار وطلعة", icon: "🎡", bg: "bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800/40" };
  }
  if (cat === "السيارة والنقل" || cat === "بنزين ووقود" || cat === "سيارة" || normName.includes("بنزين") || normName.includes("فيتر") || (normName.includes("سيار") && !normName.includes("قسط"))) {
    return { label: "سيارة ووقود", icon: "🚗", bg: "bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/40" };
  }
  if (cat === "العائلة ومصروف شخصي" || cat === "العائلة" || cat === "عائلة") {
    return { label: "عائلة ومصروف شخصي", icon: "👨‍👩‍👧", bg: "bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800/40" };
  }
  if (cat === "موجودات ونواقص" || normName.includes("نواقص") || normName.includes("موجودات")) {
    return { label: "موجودات ونواقص", icon: "📦", bg: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40" };
  }
  return null;
};

// ══════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════

const DetailsInput = ({ defaultValue, isRequired }: { defaultValue: string, isRequired: boolean }) => {
  const [tags, setTags] = useState<string[]>(defaultValue ? defaultValue.split(" - ").filter(Boolean) : []);
  const [val, setVal] = useState("");
  return (
    <div>
       <label className="block text-xs font-bold text-gray-500 mb-1.5">التفاصيل {isRequired ? "(إجباري)" : "(اختياري)"}</label>
       <div className="flex flex-wrap gap-2 mb-2">
         {tags.map((t, i) => (
           <span key={i} className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
             {t} <button type="button" onClick={() => setTags(tags.filter((_, j) => i !== j))} className="hover:text-red-500">&times;</button>
           </span>
         ))}
       </div>
       <input 
         type="text"
         value={val}
         onChange={e => setVal(e.target.value)}
         required={isRequired && tags.length === 0}
         onKeyDown={e => {
           if(e.key === 'Enter') {
             e.preventDefault();
             if(val.trim()) { setTags([...tags, val.trim()]); setVal(""); }
           }
         }}
         placeholder="اكتب التفصيل واضغط Enter..."
         className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition" 
       />
       <input type="hidden" name="notes" value={tags.length > 0 ? tags.join(" - ") + (val ? " - " + val : "") : val} />
       {isRequired && tags.length === 0 && !val && (
         <input type="text" className="opacity-0 absolute h-0 w-0 -z-10" required onChange={() => {}} />
       )}
    </div>
  )
}

function getCachedHf<T>(key: string, fallback: T): T {
  if (typeof window !== "undefined") {
    try {
      const c = localStorage.getItem(`cached_hf_${key}`);
      if (c) return JSON.parse(c);
    } catch (e) {}
  }
  return fallback;
}

export default function HomeFinanceDashboard() {
  const [activeTab, setActiveTab] = useState<"overview" | "expenses" | "income" | "installments" | "needs" | "bills" | "debts" | "inventory" | "car" | "travel" | "familyNeeds" | "futurePlans">("overview");

  // Data state - Synchronous 0ms cached hydration on render #0
  const [cakeSalaryDebt, setCakeSalaryDebt] = useState<number>(() => getCachedHf("cakeSalaryDebt", 0));
  const [cakeDebtExpenses, setCakeDebtExpenses] = useState<Expense[]>(() => getCachedHf("cakeDebtExpenses", []));
  const [cakeDebtIncomes, setCakeDebtIncomes] = useState<Income[]>(() => getCachedHf("cakeDebtIncomes", []));
  const [installments, setInstallments] = useState<Installment[]>(() => getCachedHf("installments", []));
  const [bills, setBills] = useState<Bill[]>(() => getCachedHf("bills", []));
  const [expenses, setExpenses] = useState<Expense[]>(() => getCachedHf("expenses", []));
  const [incomes, setIncomes] = useState<Income[]>(() => getCachedHf("incomes", []));
  const [inventory, setInventory] = useState<InventoryItem[]>(() => getCachedHf("inventory", []));
  const [carInventory, setCarInventory] = useState<InventoryItem[]>(() => getCachedHf("carInventory", []));
  const [travelInventory, setTravelInventory] = useState<InventoryItem[]>(() => getCachedHf("travelInventory", []));
  const [needs, setNeeds] = useState<Need[]>(() => getCachedHf("needs", []));
  const [debts, setDebts] = useState<Debt[]>(() => getCachedHf("debts", []));
  const [familyNeeds, setFamilyNeeds] = useState<FamilyMemberNeed[]>(() => getCachedHf("familyNeeds", []));
  const [familyHealth, setFamilyHealth] = useState<FamilyHealthRecord[]>(() => getCachedHf("familyHealth", []));
  const [travelTrips, setTravelTrips] = useState<TravelTrip[]>(() => getCachedHf("travelTrips", []));
  const [travelExpenses, setTravelExpenses] = useState<TravelExpense[]>(() => getCachedHf("travelExpenses", []));
  const [futurePlans, setFuturePlans] = useState<FuturePlan[]>(() => getCachedHf("futurePlans", []));
  const [showFuturePlanModal, setShowFuturePlanModal] = useState(false);
  const [editFuturePlan, setEditFuturePlan] = useState<FuturePlan | null>(null);
  const [futurePlanSteps, setFuturePlanSteps] = useState<{id: string; text: string; isCompleted: boolean; date?: string}[]>([]);
  
  const [activeFamilyMember, setActiveFamilyMember] = useState("إيمان");
  const [showWomenHealthSection, setShowWomenHealthSection] = useState(false);
  const [newFamilyNeedTitle, setNewFamilyNeedTitle] = useState("");
  const [newFamilyNeedCategory, setNewFamilyNeedCategory] = useState("عائلة");
  
  const [carSubTab, setCarSubTab] = useState<"expenses" | "inventory" | "shopping">("expenses");
  const [carSearch, setCarSearch] = useState("");
  const [carExpenseFilter, setCarExpenseFilter] = useState<"all" | "fuel" | "maintenance" | "other">("all");
  const [travelSubTab, setTravelSubTab] = useState<"inventory" | "trips">("inventory");
  const [showTripModal, setShowTripModal] = useState(false);
  const [editTrip, setEditTrip] = useState<TravelTrip | null>(null);
  const [tripModalDestination, setTripModalDestination] = useState<string>("");
  const [tripModalMembers, setTripModalMembers] = useState<string[]>([]);
  const [tripModalMemberInput, setTripModalMemberInput] = useState<string>("");
  const [selectedTrip, setSelectedTrip] = useState<TravelTrip | null>(null);
  const [showTripExpenseModal, setShowTripExpenseModal] = useState(false);
  const [showTravelShortcutModal, setShowTravelShortcutModal] = useState(false);
  const [showTripSelectorModal, setShowTripSelectorModal] = useState(false);

  // ─── Smart AI Sentinel & Debt Forecast state ───
  const [simulatedExtraSavings, setSimulatedExtraSavings] = useState<number>(50000);
  const [activeInsightView, setActiveInsightView] = useState<"debts" | "leaks" | "house">("debts");
  const [showSentinel, setShowSentinel] = useState(false);

  const [settings, setSettings] = useState<{ 
    manualCycleStarts?: string[],
    budgetLimits?: Record<string, number>
  }>(() => getCachedHf("settings", { 
    manualCycleStarts: [],
    budgetLimits: {
      "سوبر ماركت": 450000,
      "مطاعم وكوفيهات": 150000,
      "السيارة": 120000,
      "العائلة": 100000,
      "الفواتير": 130000,
    }
  }));
  const [showBudgetSettingsModal, setShowBudgetSettingsModal] = useState(false);


  const [mounted, setMounted] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);

  // Smart Modals
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message?: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
  } | null>(null);

  const [promptConfig, setPromptConfig] = useState<{
    isOpen: boolean;
    title: string;
    message?: string;
    defaultValue?: string;
    placeholder?: string;
    onConfirm: (val: string) => void;
  } | null>(null);
  const [promptInputValue, setPromptInputValue] = useState("");

  const showConfirm = (title: string, onConfirm: () => void, isDestructive = true, message?: string, confirmText?: string) => {
    setConfirmConfig({ isOpen: true, title, message, onConfirm, isDestructive, confirmText });
  };

  const showPrompt = (title: string, onConfirm: (val: string) => void, defaultValue = "", placeholder = "", message?: string) => {
    setPromptInputValue(defaultValue);
    setPromptConfig({ isOpen: true, title, message, defaultValue, placeholder, onConfirm });
  };
  // Modal states
  const [editInstallment, setEditInstallment] = useState<Installment | null>(null);
  const [showInstallmentModal, setShowInstallmentModal] = useState(false);
  const [showInstallmentHistory, setShowInstallmentHistory] = useState<string | null>(null);

  const [editBill, setEditBill] = useState<Bill | null>(null);
  const [showBillModal, setShowBillModal] = useState(false);
  const [showBillHistory, setShowBillHistory] = useState<string | null>(null);
  const [payBillData, setPayBillData] = useState<{bill: Bill, amount: string, months: number} | null>(null);

  const getNextCycleId = (baseCycleId: string, offsetMonths: number) => {
    const [y, m, d] = baseCycleId.split("-").map(Number);
    const date = new Date(y, m - 1 + offsetMonths, d);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const getNextUnpaidCycleIds = (bill: Bill, startCycleId: string, count: number) => {
    const ids: string[] = [];
    let offset = 0;
    while (ids.length < count) {
      const cycleId = getNextCycleId(startCycleId, offset);
      const isPaid = bill.paidDates.some(p => {
        if (p.cycleId) return p.cycleId === cycleId;
        const [y, m, d] = cycleId.split("-").map(Number);
        const start = new Date(y, m - 1, d);
        const end = new Date(y, m, d - 1);
        const pDate = new Date(p.date);
        return pDate >= start && pDate <= end;
      });
      if (!isPaid) {
        ids.push(cycleId);
      }
      offset++;
      if (offset > 120) break;
    }
    return ids;
  };
  const [showFamilyNeedModal, setShowFamilyNeedModal] = useState(false);
  const [editFamilyNeed, setEditFamilyNeed] = useState<FamilyMemberNeed | null>(null);
  const [familyNeedType, setFamilyNeedType] = useState<"need" | "duty">("need");

  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([]);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showLottoTrackerModal, setShowLottoTrackerModal] = useState(false);
  const [wallet, setWallet] = useState<WalletState>({ bankBalance: 410000, cashBalance: 50000 });
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletBankInput, setWalletBankInput] = useState<number>(410000);
  const [walletCashInput, setWalletCashInput] = useState<number>(50000);
  const [expCategoryInput, setExpCategoryInput] = useState<string>("");
  const [expDateInput, setExpDateInput] = useState<string>(today());
  const [isScanningReceipt, setIsScanningReceipt] = useState(false);
  const [scanStatusText, setScanStatusText] = useState("");
  const [showQuickPasteModal, setShowQuickPasteModal] = useState(false);
  const [quickPasteText, setQuickPasteText] = useState("");
  const [viewingReceiptExpense, setViewingReceiptExpense] = useState<Expense | null>(null);
  const [attachedReceiptImages, setAttachedReceiptImages] = useState<string[]>([]);
  const [isSavingExpense, setIsSavingExpense] = useState<boolean>(false);
  const [receiptItemFilter, setReceiptItemFilter] = useState("");
  const receiptCameraInputRef = useRef<HTMLInputElement | null>(null);
  const receiptGalleryInputRef = useRef<HTMLInputElement | null>(null);
  const warrantyCameraInputRef = useRef<HTMLInputElement | null>(null);
  const warrantyGalleryInputRef = useRef<HTMLInputElement | null>(null);

  // ─── Outing Places & Warranty States ───
  const [selectedOutingPlace, setSelectedOutingPlace] = useState<string>("كل المحطات");
  const [newPlaceInput, setNewPlaceInput] = useState<string>("");
  const [showAddPlaceInput, setShowAddPlaceInput] = useState<boolean>(false);
  const [activeWarrantyItemIdx, setActiveWarrantyItemIdx] = useState<number | null>(null);
  const [warrantyCardPreviewUrl, setWarrantyCardPreviewUrl] = useState<string | null>(null);
  const [showWarrantiesRegistryModal, setShowWarrantiesRegistryModal] = useState<boolean>(false);
  const [onlyWarrantyFilter, setOnlyWarrantyFilter] = useState<boolean>(false);
  const [viewReceiptGroupingMode, setViewReceiptGroupingMode] = useState<"order" | "priority" | "place">("order");

  const [showProductSearchModal, setShowProductSearchModal] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [productSearchStart, setProductSearchStart] = useState("");
  const [productSearchEnd, setProductSearchEnd] = useState("");
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string | null>(null);
  const [focusedProductIdx, setFocusedProductIdx] = useState<number | null>(null);
  const [focusedPlaceIdx, setFocusedPlaceIdx] = useState<number | null>(null);
  const [categorySearchQuery, setCategorySearchQuery] = useState<string>("");

  const [editIncome, setEditIncome] = useState<Income | null>(null);
  const [showIncomeModal, setShowIncomeModal] = useState(false);

  const [expandedPlans, setExpandedPlans] = useState<string[]>([]);
  const [expandedTrips, setExpandedTrips] = useState<string[]>([]);

  const [editInventory, setEditInventory] = useState<InventoryItem | null>(null);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [invStatusMode, setInvStatusMode] = useState<"available" | "shortage">("available");
  const [purchaseItem, setPurchaseItem] = useState<InventoryItem | null>(null);
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [editNeed, setEditNeed] = useState<any | null>(null);
  const [showNeedModal, setShowNeedModal] = useState(false);
  const [needFilterTab, setNeedFilterTab] = useState<"all" | "medicine" | "photo" | "inventory" | "family" | "car" | "travel">("all");
  const [needSearchQuery, setNeedSearchQuery] = useState("");
  const [isScanningNeed, setIsScanningNeed] = useState(false);
  const [scanNeedStatus, setScanNeedStatus] = useState("");
  const [needImageFile, setNeedImageFile] = useState<File | null>(null);
  const [needImages, setNeedImages] = useState<string[]>([]);
  const needImagePreview = needImages[0] || null;
  const setNeedImagePreview = (val: string | null) => setNeedImages(val ? [val] : []);
  const [previewImageUrl, setPreviewImageUrl] = useState<{ url: string; title: string; allUrls?: string[] } | null>(null);
  const needCameraInputRef = useRef<HTMLInputElement>(null);
  const needGalleryInputRef = useRef<HTMLInputElement>(null);
  const needModalCameraInputRef = useRef<HTMLInputElement>(null);
  const needModalGalleryInputRef = useRef<HTMLInputElement>(null);
  const [scannedReviewItems, setScannedReviewItems] = useState<ScannedNeedItem[] | null>(null);
  const [isSavingScannedBatch, setIsSavingScannedBatch] = useState(false);
  const [fulfillModal, setFulfillModal] = useState<{
    isOpen: boolean;
    title: string;
    category: string;
    member?: string;
    estimatedPrice: number;
    quantity: number;
    type: "family" | "shopping" | "need";
    item: any;
  } | null>(null);

  const [editDebt, setEditDebt] = useState<Debt | null>(null);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [isAdvancedDebt, setIsAdvancedDebt] = useState(false);
  const [showDebtHistory, setShowDebtHistory] = useState<string | null>(null);
  const [expNameInput, setExpNameInput] = useState("");
  const [showExpSuggestions, setShowExpSuggestions] = useState(false);

  // Auto-suggested shops and markets derived dynamically from previous expenses & items (sorted by usage frequency)
  const uniqueSuggestedPlaces = useMemo(() => {
    if (!mounted) return OUTING_PLACES_SUGGESTIONS;
    const counts = new Map<string, number>();

    const STORE_KEYWORDS = [
      "سوق", "ماركت", "هايبر", "محل", "مول", "دكان", "صيدلية", "مخضر", "قصاب", "كافيه",
      "مطعم", "معرض", "تجهيزات", "بقالة", "محطة", "سنتر", "شوب", "كراج", "فيتر", "غسيل",
      "ورشة", "بنشر", "بنزين", "بانزين", "باركنك", "باركنج", "موقف"
    ];

    expenses.forEach(exp => {
      const s = (exp as any).storeName?.trim();
      if (s) counts.set(s, (counts.get(s) || 0) + 4);

      const p = (exp as any).place?.trim();
      if (p) counts.set(p, (counts.get(p) || 0) + 4);

      const name = (exp.name || "").trim();
      if (name && (exp.category === "سوبر ماركت" || STORE_KEYWORDS.some(k => name.includes(k)))) {
        counts.set(name, (counts.get(name) || 0) + 3);
      }

      (exp.items || []).forEach(it => {
        const ip = it.place?.trim();
        if (ip) counts.set(ip, (counts.get(ip) || 0) + 2);
      });
    });

    const DEFAULT_IRAQI_PLACES = [
      "هايبر ماركت", "سوق الخضار", "سوق اللحوم والأسماك", "محطة بنزين", "كراج وميكانيك سيارات",
      "كراج غسيل سيارات", "فيترجي سيارات", "مطعم وكافيه", "حلويات ومعجنات", "صيدلية وعلاج",
      "تجهيزات منزلية", "سوبرماركت البركات", "تعاون ماركت", "ماركت غصون", "مطعم كباب"
    ];

    [...OUTING_PLACES_SUGGESTIONS, ...DEFAULT_IRAQI_PLACES].forEach(p => {
      if (!counts.has(p)) counts.set(p, 1);
    });

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([place]) => place)
      .filter(Boolean);
  }, [expenses, mounted]);

  // Auto-suggest states - only computed when a modal is active (saves thousands of regex/loops on mount)
  const isAnyEntryModalOpen = showExpenseModal || showNeedModal || showInventoryModal || showDebtModal || showProductSearchModal;

  const uniqueNames = useMemo(() => {
    if (!mounted || !isAnyEntryModalOpen || (!showExpSuggestions && !showProductSearchModal)) return [];
    return Array.from(new Set([
      ...inventory.map(i => i.name),
      ...carInventory.map(c => c.name),
      ...expenses.map(e => e.name),
      ...uniqueSuggestedPlaces,
      ...debts.map(d => d.person),
      ...installments.map(i => i.name),
      ...bills.map(b => b.name),
      ...needs.map(n => n.name),
      "طلعات وجولات", "جولة بغداد", "المتنبي والرشيد", "كورنيش وجادرية", "بنزين سيارة", "صيانة سيارة", "كراج تصليح", "مسواك خضار", "مطعم كباب"
    ])).filter(Boolean);
  }, [inventory, carInventory, expenses, uniqueSuggestedPlaces, debts, installments, bills, needs, mounted, isAnyEntryModalOpen, showExpSuggestions, showProductSearchModal]);

  const uniqueProductNames = useMemo(() => {
    if (!mounted || (!showExpenseModal && !showProductSearchModal && focusedProductIdx === null)) return [];
    const pool = new Set<string>();
    expenses.forEach(e => {
      (e.items || []).forEach(i => { if (i.name) pool.add(i.name.trim()); });
      if (e.name) pool.add(e.name.trim());
    });
    inventory.forEach(i => { if (i.name) pool.add(i.name.trim()); });
    carInventory.forEach(c => { if (c.name) pool.add(c.name.trim()); });
    needs.forEach(n => { if (n.name) pool.add(n.name.trim()); });
    PRODUCT_CATEGORIES.forEach(cat => {
      cat.keywords.forEach(kw => { if (kw && kw.length >= 2) pool.add(kw.trim()); });
    });
    return Array.from(pool).filter(Boolean);
  }, [expenses, inventory, carInventory, needs, mounted, showExpenseModal, showProductSearchModal, focusedProductIdx]);

  // Pre-normalized caches for instant mobile auto-complete (0 regex per keystroke)
  const normalizedUniqueNames = useMemo(() => {
    if (!uniqueNames.length) return [];
    return uniqueNames.map(name => ({
      raw: name,
      norm: normalizeArabicText(name),
      pred: detectProductCategory(name)
    }));
  }, [uniqueNames]);

  const normalizedUniquePlaces = useMemo(() => {
    return uniqueSuggestedPlaces.map(place => ({
      raw: place,
      norm: normalizeArabicText(place),
      pred: detectProductCategory(place)
    }));
  }, [uniqueSuggestedPlaces]);

  const normalizedProductPool = useMemo(() => {
    if (!uniqueProductNames.length) return [];
    return uniqueProductNames.map(name => {
      const pred = detectProductCategory(name);
      const nature = classifyItemNature(name, pred);
      return {
        raw: name,
        norm: normalizeArabicText(name),
        pred,
        nature
      };
    });
  }, [uniqueProductNames]);

  const [needNameInput, setNeedNameInput] = useState("");
  const [showNeedSuggestions, setShowNeedSuggestions] = useState(false);
  
  const [invNameInput, setInvNameInput] = useState("");
  const [showInvSuggestions, setShowInvSuggestions] = useState(false);

  const [expBeneficiary, setExpBeneficiary] = useState<string>("عام للبيت");

  const [debtNameInput, setDebtNameInput] = useState("");
  const [showDebtSuggestions, setShowDebtSuggestions] = useState(false);

  // Search states
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseStartDate, setExpenseStartDate] = useState("");
  const [expenseEndDate, setExpenseEndDate] = useState("");
  const [showAllDates, setShowAllDates] = useState(false);
  const [inventorySearch, setInventorySearch] = useState("");
  const [billFilter, setBillFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [installmentFilter, setInstallmentFilter] = useState<"active" | "all" | "completed">("active");
  const [showCompletedInstallments, setShowCompletedInstallments] = useState(false);
  const [debtFilter, setDebtFilter] = useState<"active" | "all" | "completed">("active");
  const [showCompletedDebts, setShowCompletedDebts] = useState(false);

  // Family and Waste Study States
  const [showWasteStudyModal, setShowWasteStudyModal] = useState(false);
  const [wastePeriodFilter, setWastePeriodFilter] = useState<"cycle" | "month" | "all">("cycle");
  const [wasteSavingsRatio, setWasteSavingsRatio] = useState<number>(30);
  const [wasteActiveTab, setWasteActiveTab] = useState<"overview" | "discretionary" | "essentials" | "receipts">("overview");
  const [wasteSearchQuery, setWasteSearchQuery] = useState("");
  const [wasteSubtypeFilter, setWasteSubtypeFilter] = useState<string | null>(null);
  const [familyFilter, setFamilyFilter] = useState<"all" | "needs" | "duties" | "expenses" | "completed">("all");
  const [familySearch, setFamilySearch] = useState("");
  const [showFamilyCompetition, setShowFamilyCompetition] = useState(false);
  const [showCompletedFamilyItems, setShowCompletedFamilyItems] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab") as any;
      if (tab) setActiveTab(tab);
    }
  }, []);

  useEffect(() => {
    if (showExpenseModal && !editExpense) {
      setExpNameInput("");
      setExpCategoryInput("");
      setExpDateInput(today());
      setExpenseItems([]);
      setAttachedReceiptImages([]);
      setExpBeneficiary("عام للبيت");
    } else if (showExpenseModal && editExpense) {
      setExpNameInput(editExpense.name || "");
      setExpCategoryInput(editExpense.category || "");
      setExpDateInput(editExpense.date || today());
      setExpenseItems(editExpense.items || []);
      setAttachedReceiptImages(
        editExpense.receiptImages && editExpense.receiptImages.length > 0
          ? editExpense.receiptImages
          : (editExpense.imageUrl ? [editExpense.imageUrl] : [])
      );
      setExpBeneficiary(
        editExpense.targetMember || 
        (editExpense.isCar || isCarExpenseMatch(editExpense.name, editExpense.category, editExpense.items) ? "السيارة" : detectFamilyMemberMatch(editExpense.name) || "عام للبيت")
      );
    }
  }, [showExpenseModal, editExpense]);

  useEffect(() => {
    if (showInventoryModal && !editInventory) setInvNameInput("");
  }, [showInventoryModal, editInventory]);

  useEffect(() => {
    if (showNeedModal && !editNeed) {
      setNeedNameInput("");
      setNeedImages([]);
    } else if (showNeedModal && editNeed) {
      const nImgs = editNeed.images && editNeed.images.length > 0
        ? editNeed.images
        : (editNeed.imageUrl ? [editNeed.imageUrl] : []);
      setNeedImages(nImgs);
    }
  }, [showNeedModal, editNeed]);

  useEffect(() => {
    if (showDebtModal && !editDebt) setDebtNameInput("");
  }, [showDebtModal, editDebt]);

  useEffect(() => {
    if (showFamilyNeedModal && !editFamilyNeed) setNewFamilyNeedTitle("");
  }, [showFamilyNeedModal, editFamilyNeed]);

  // ──────────────────────────────────────────
  // LOAD / SAVE / FIREBASE SYNC
  // ──────────────────────────────────────────
  useEffect(() => {
    const keys: ("installments" | "bills" | "expenses" | "incomes" | "inventory" | "carInventory" | "travelInventory" | "needs" | "debts" | "familyNeeds" | "familyHealth" | "travelTrips" | "travelExpenses" | "futurePlans" | "settings")[] = [
      "installments", "bills", "expenses", "incomes", "inventory", "carInventory", "travelInventory", "needs", "debts", "familyNeeds", "familyHealth", "travelTrips", "travelExpenses", "futurePlans", "settings"
    ];
    const setters: any = {
      installments: setInstallments,
      bills: setBills,
      expenses: setExpenses,
      incomes: setIncomes,
      inventory: setInventory,
      carInventory: setCarInventory,
      travelInventory: setTravelInventory,
      needs: setNeeds,
      debts: setDebts,
      familyNeeds: setFamilyNeeds,
      familyHealth: setFamilyHealth,
      travelTrips: setTravelTrips,
      travelExpenses: setTravelExpenses,
      futurePlans: setFuturePlans,
      settings: setSettings,
    };

    // Note: State is already synchronously hydrated from local cache on render #0 (via getCachedHf),
    // avoiding 14 sequential state setter dispatches on mount.

    const loadedKeys = new Set<string>();
    let cakeExpensesLoaded = false;

    const checkAllLoaded = () => {
      // Essential keys needed for financial balances and tab badges
      const essentialKeys = ["expenses", "incomes", "debts", "bills", "installments", "needs"];
      const essentialsReady = essentialKeys.every(k => loadedKeys.has(k));
      if (essentialsReady && cakeExpensesLoaded) {
        setDataLoading(false);
      }
    };

    // Safety timeout: max 1200ms
    const safetyTimeout = setTimeout(() => {
      setDataLoading(false);
    }, 1200);

    // Batch fetch all collections in parallel using Promise.all instead of 14 separate onSnapshot listeners
    Promise.all(keys.map(k => getDoc(doc(db, "home_finance", k))))
      .then((snaps) => {
        snaps.forEach((snap, idx) => {
          const k = keys[idx];
          if (snap.exists() && snap.data()?.data) {
            const val = snap.data().data;
            setters[k](val);
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem(`cached_hf_${k}`, JSON.stringify(val));
              } catch (e) {}
            }
          } else if (!snap.exists()) {
            setters[k]([]);
          }
          loadedKeys.add(k);
        });
        checkAllLoaded();
      })
      .catch((err) => {
        console.error("Home finance batch fetch error:", err);
        keys.forEach(k => loadedKeys.add(k));
        checkAllLoaded();
      });

    setMounted(true);

    const unsubExpenses = onSnapshot(collection(db, "expenses"), (snap) => {
      const exps = snap.docs.map(d => ({ ...d.data(), _id: d.id } as any));
      const debt = exps.filter(e => e.isDebt).reduce((s, e) => s + (Number(e.amount) || 0), 0);
      setCakeSalaryDebt(debt);
      
      const convertedCakeExps: Expense[] = exps.filter(e => e.isDebt && Number(e.amount) > 0).map(e => ({
        id: e._id || Date.now().toString(),
        name: e.description ? `مواد كيك: ${e.description}` : "دين مواد كيك من الراتب",
        rawCakeDescription: e.description || "",
        category: "ديون الكيك",
        amount: Number(e.amount) || 0,
        date: e.date || (e.createdAt?.toDate ? e.createdAt.toDate().toISOString() : new Date().toISOString()),
        createdAt: e.createdAt?.toDate ? e.createdAt.toDate().toISOString() : (e.date || new Date().toISOString()),
        isFromCake: true,
        originDocId: e._id,
        items: e.items || [],
        itemCount: e.itemCount || (e.items ? e.items.length : 0),
        invoiceId: e.invoiceId || "",
        invoiceNumber: e.invoiceNumber || "",
        storeName: e.storeName || "مشتريات الكيك (دين من الراتب)",
        receiptImages: e.receiptImages || (e.imageUrl ? [e.imageUrl] : []),
        imageUrl: e.imageUrl || ""
      } as any));
      setCakeDebtExpenses(convertedCakeExps);

      const convertedCakeIncs: Income[] = exps.filter(e => e.isDebt && Number(e.amount) < 0).map(e => ({
        id: e._id || Date.now().toString(),
        name: e.description || "تسديد دين اموال الكيك",
        type: "إضافي",
        amount: Math.abs(Number(e.amount)) || 0,
        date: e.createdAt?.toDate ? e.createdAt.toDate().toISOString() : new Date().toISOString(),
        createdAt: e.createdAt?.toDate ? e.createdAt.toDate().toISOString() : new Date().toISOString(),
        isFromCake: true
      } as any));
      setCakeSalaryDebt(debt);
      setCakeDebtExpenses(convertedCakeExps);
      setCakeDebtIncomes(convertedCakeIncs);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("cached_hf_cakeSalaryDebt", JSON.stringify(debt));
          localStorage.setItem("cached_hf_cakeDebtExpenses", JSON.stringify(convertedCakeExps));
          localStorage.setItem("cached_hf_cakeDebtIncomes", JSON.stringify(convertedCakeIncs));
        } catch (e) {}
      }
      cakeExpensesLoaded = true;
      checkAllLoaded();
    }, (error) => {
      console.error("Expenses snapshot error:", error);
      cakeExpensesLoaded = true;
      checkAllLoaded();
    });

    const unsubWallet = onSnapshot(doc(db, "home_finance", "wallets"), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        const b = typeof d.bankBalance === "number" ? d.bankBalance : 410000;
        const c = typeof d.cashBalance === "number" ? d.cashBalance : 50000;
        setWallet({ bankBalance: b, cashBalance: c, updatedAt: d.updatedAt, notes: d.notes });
        setWalletBankInput(b);
        setWalletCashInput(c);
      } else {
        setDoc(doc(db, "home_finance", "wallets"), {
          bankBalance: 410000,
          cashBalance: 50000,
          updatedAt: new Date().toISOString()
        }).catch(e => console.error("init wallet err", e));
      }
    });

    return () => {
      clearTimeout(safetyTimeout);
      unsubExpenses();
      unsubWallet();
    };
  }, []);

  // Daily notifications for pending family duties
  useEffect(() => {
    if (!mounted || familyNeeds.length === 0) return;
    
    // Using a timeout to let the UI settle before firing toasts
    const timer = setTimeout(() => {
      const today = new Date().toLocaleDateString("en-CA");
      const notifiedKey = `notified_duties_${today}`;
      const alreadyNotified = localStorage.getItem(notifiedKey);
      
      if (!alreadyNotified) {
        const pendingDuties = familyNeeds.filter(n => n.type === "duty" && n.status === "pending");
        if (pendingDuties.length > 0) {
          pendingDuties.forEach((duty, idx) => {
            setTimeout(() => {
              toast.custom((id) => (
                <div className={`${''} max-w-sm w-full bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl shadow-2xl rounded-3xl pointer-events-auto flex flex-col p-4 border border-gray-100/50 dark:border-zinc-800/50 relative overflow-hidden ring-1 ring-black/5`}>
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
                  <div className="flex items-start gap-3 relative z-10">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0">
                      <AlertCircle className="w-5 h-5 animate-pulse" />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex justify-between items-start">
                        <p className="text-sm font-black text-gray-900 dark:text-white">تذكير بالواجبات</p>
                        <button onClick={() => toast.dismiss(id)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition bg-gray-100/50 dark:bg-zinc-800/50 rounded-full p-1.5 -mt-1 -mr-1">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
                        لديك واجب بانتظار الإنجاز يا <span className="font-bold text-purple-600 dark:text-purple-400">{duty.member}</span>: {duty.title}
                      </p>
                    </div>
                  </div>
                </div>
              ), { 
                id: `duty-${duty.id}`,
                duration: 10000, // Stays for 10 seconds unless dismissed
                unstyled: true,
                style: { background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }
              });
            }, idx * 5000); // 5 seconds delay between each notification
          });
          localStorage.setItem(notifiedKey, "true");
        }
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [familyNeeds, mounted]);

  // ──────────────────────────────────────────
  const cycles = useMemo(() => {
    const arr: Cycle[] = [];
    const now = new Date();
    let currentCycleStartMonth = now.getMonth();
    let currentCycleStartYear = now.getFullYear();
    
    if (now.getDate() < 11) {
      currentCycleStartMonth -= 1;
      if (currentCycleStartMonth < 0) {
        currentCycleStartMonth = 11;
        currentCycleStartYear -= 1;
      }
    }

    const arMonths = ["كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران", "تموز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول"];
    
    const boundaries: Date[] = [];
    for (let i = -1; i <= 24; i++) {
      let month = currentCycleStartMonth - i;
      let year = currentCycleStartYear;
      while (month < 0) {
        month += 12;
        year -= 1;
      }
      while (month > 11) {
        month -= 12;
        year += 1;
      }
      boundaries.push(new Date(year, month, 11));
    }

    const uniqueManualDatesStr = Array.from(new Set(settings.manualCycleStarts || []));
    const manualDates = uniqueManualDatesStr.map(ds => new Date(ds));
    
    const validBoundaries = boundaries.filter(b => {
      return !manualDates.some(md => md.getFullYear() === b.getFullYear() && md.getMonth() === b.getMonth());
    });
    
    const allBoundaries = [...validBoundaries, ...manualDates].sort((a,b) => b.getTime() - a.getTime());

    for (let i = 1; i < allBoundaries.length && arr.length < 24; i++) {
      const endD = new Date(allBoundaries[i-1].getTime() - 1);
      const startD = allBoundaries[i];
      if (startD > now && endD > now) continue;
      arr.push({
        id: `${startD.getFullYear()}-${String(startD.getMonth() + 1).padStart(2, '0')}-${startD.getDate()}`,
        label: `دورة ${arMonths[startD.getMonth()]} ${startD.getFullYear()} (${startD.getDate()}/${startD.getMonth() + 1} - ${endD.getDate()}/${endD.getMonth() + 1})`,
        start: startD,
        end: endD
      });
    }

    return arr;
  }, [settings]);

  // ──────────────────────────────────────────
  // CYCLES (دورات مالية)
  // ──────────────────────────────────────────
  interface Cycle {
    id: string;
    label: string;
    start: Date;
    end: Date;
  }

  const [selectedCycleId, setSelectedCycleId] = useState<string>(cycles[0]?.id || "");
  const selectedCycle = cycles.find(c => c.id === selectedCycleId) || cycles[0];

  useEffect(() => {
    if (cycles.length > 0 && (!selectedCycleId || !cycles.find(c => c.id === selectedCycleId))) {
      setSelectedCycleId(cycles[0].id);
    }
  }, [cycles, selectedCycleId]);

  const isInCycle = (dateString: string) => {
    if (!dateString) return false;
    const dStr = dateString.split("T")[0];
    
    const startD = selectedCycle.start;
    const endD = selectedCycle.end;
    const startStr = `${startD.getFullYear()}-${String(startD.getMonth() + 1).padStart(2, '0')}-${String(startD.getDate()).padStart(2, '0')}`;
    const endStr = `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, '0')}-${String(endD.getDate()).padStart(2, '0')}`;
    
    return dStr >= startStr && dStr <= endStr;
  };

  const isExpenseInDateRange = (dateString: string) => {
    if (showAllDates) return true;
    if (!expenseStartDate && !expenseEndDate) return isInCycle(dateString);
    if (!dateString) return false;
    const dStr = dateString.split("T")[0];
    if (expenseStartDate && expenseEndDate) return dStr >= expenseStartDate && dStr <= expenseEndDate;
    if (expenseStartDate) return dStr >= expenseStartDate;
    if (expenseEndDate) return dStr <= expenseEndDate;
    return true;
  };

  // ──────────────────────────────────────────
  // DERIVED
  // ──────────────────────────────────────────

  const allIncomes = useMemo(() => [...incomes, ...cakeDebtIncomes], [incomes, cakeDebtIncomes]);

  const totalIncome = allIncomes
    .filter(i => isInCycle(i.date))
    .reduce((s, i) => s + i.amount, 0);

  const allExpenses = useMemo(() => [...expenses, ...cakeDebtExpenses], [expenses, cakeDebtExpenses]);

  const totalExpensesAmt = allExpenses
    .filter(e => isInCycle(e.date))
    .reduce((s, e) => s + e.amount, 0);

  const categorySpendingMap = useMemo(() => {
    const map: Record<string, number> = {};
    allExpenses.forEach(exp => {
      if (isInCycle(exp.date)) {
        map[exp.category] = (map[exp.category] || 0) + exp.amount;
      }
    });
    return map;
  }, [allExpenses, selectedCycleId]);

  const sortedProductCategories = useMemo(() => {
    return [...PRODUCT_CATEGORIES].sort((a, b) => {
      const spendA = categorySpendingMap[a.name] || 0;
      const spendB = categorySpendingMap[b.name] || 0;
      if (spendA !== spendB) return spendB - spendA;
      return (CATEGORY_PRIORITY_INDEX_MAP[a.name] ?? 999) - (CATEGORY_PRIORITY_INDEX_MAP[b.name] ?? 999);
    });
  }, [categorySpendingMap]);

  // Fast Car Expenses Cache: Strictly excludes outings, trips, and non-car items from mixed receipts
  const carExpenses = useMemo(() => {
    const list: (Expense & { isPartialCarReceipt?: boolean; originalTotalAmount?: number; originalItemCount?: number })[] = [];

    expenses.forEach(e => {
      const normCat = normalizeArabicText(e.category || "");
      const normN = normalizeArabicText(e.name || "");
      if (
        normCat.includes("طلعات") ||
        normCat.includes("سفر") ||
        normCat.includes("اقساط") ||
        normCat.includes("سلف") ||
        normCat.includes("مطاعم") ||
        normCat.includes("كافيه") ||
        normCat.includes("العاب") ||
        normN.includes("طلعه") ||
        normN.includes("جوله") ||
        normN.includes("مشوار") ||
        normN.includes("سفره") ||
        normN.startsWith("قسط") ||
        normN.includes("مطعم") ||
        normN.includes("كافيه")
      ) {
        return;
      }

      // 1. If expense has itemized rows, filter to ONLY car-specific items
      if (e.items && e.items.length > 0) {
        const carOnlyItems = e.items.filter(it => isCarItem(it, e));

        if (carOnlyItems.length > 0) {
          const isPartial = carOnlyItems.length < e.items.length || (
            normCat !== "السياره والنقل" &&
            normCat !== "السياره" &&
            normCat !== "سياره" &&
            normCat !== "صيانه ووقود" &&
            normCat !== "بنزين ووقود" &&
            !e.isCar
          );
          const carAmount = carOnlyItems.reduce((sum, it) => sum + (Number(it.price) || 0), 0);

          list.push({
            ...e,
            items: carOnlyItems,
            amount: (isPartial && carAmount > 0) ? carAmount : e.amount,
            isPartialCarReceipt: isPartial,
            originalTotalAmount: e.amount,
            originalItemCount: e.items.length,
          });
          return;
        }

        // If it had items but NONE were for the car, and it's not explicitly a car expense, skip it
        if (!e.isCar && normCat !== "السياره والنقل" && normCat !== "السياره" && normCat !== "سياره") {
          return;
        }
      }

      // 2. Direct car expense (fuel, mechanic, or single car item without itemized array)
      if (e.isCar || isCarExpenseMatch(e.name, e.category, e.items)) {
        list.push(e);
      }
    });

    return list;
  }, [expenses]);

  // Fast Memoized Insights Bar (0 recalculations during modal typing)
  const smartFinancialInsights = useMemo(() => {
    const cycleExps = allExpenses.filter(e => isInCycle(e.date));
    const cycleSpendTotal = cycleExps.reduce((s, e) => s + e.amount, 0);

    let cycleDiscSpend = 0;
    cycleExps.forEach(exp => {
      if (exp.items && exp.items.length > 0) {
        exp.items.forEach(it => {
          const nat = classifyItemNature(it.name, it.category || exp.category);
          if (nat.type === "discretionary") cycleDiscSpend += (it.price || 0);
        });
      } else {
        const nat = classifyItemNature(exp.name, exp.category);
        if (nat.type === "discretionary") cycleDiscSpend += (exp.amount || 0);
      }
    });

    const discRatio = cycleSpendTotal > 0 ? Math.round((cycleDiscSpend / cycleSpendTotal) * 100) : 0;

    const catTotals: Record<string, number> = {};
    cycleExps.forEach(e => {
      const c = e.category || "عام";
      catTotals[c] = (catTotals[c] || 0) + e.amount;
    });
    const topCatEntry = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];
    const topCatName = topCatEntry ? topCatEntry[0] : "لا يوجد";
    const topCatTotal = topCatEntry ? topCatEntry[1] : 0;
    const topCatIcon = EXPENSE_CATEGORIES.find(c => c.label === topCatName)?.icon || "📦";

    const cycleDays = Math.max(1, new Date().getDate());
    const dailyAvg = Math.round(cycleSpendTotal / cycleDays);

    return {
      cycleSpendTotal,
      dailyAvg,
      topCatName,
      topCatTotal,
      topCatIcon,
      cycleDiscSpend,
      discRatio
    };
  }, [allExpenses, selectedCycleId]);

  // Fast Memoized Category Filters & Totals (replaces 60,000 regex checks per render)
  const availableExpenseCategories = useMemo(() => {
    const expsInDateRange = allExpenses.filter(e => isExpenseInDateRange(e.date));
    return EXPENSE_CATEGORIES.map(cat => ({
      ...cat,
      catTotal: expsInDateRange.reduce((sum, exp) => {
        if (exp.items && exp.items.length > 0) {
          const itTotal = exp.items
            .filter(it => (it.category || detectProductCategory(it.name)) === cat.label)
            .reduce((s, it) => s + (it.price || 0), 0);
          if (itTotal > 0) return sum + itTotal;
          if (exp.category === cat.label && !exp.items.some(it => it.category)) {
            return sum + exp.amount;
          }
          return sum;
        }
        return exp.category === cat.label ? sum + exp.amount : sum;
      }, 0)
    })).filter(cat => cat.catTotal > 0 || expenseCategoryFilter === cat.label)
    .sort((a, b) => b.catTotal - a.catTotal);
  }, [allExpenses, showAllDates, expenseStartDate, expenseEndDate, selectedCycleId, expenseCategoryFilter]);

  // Fast Memoized Expenses List
  const filteredExpenses = useMemo(() => {
    const query = expenseSearch.trim();
    const normQuery = normalizeArabicText(query);
    const queryTokens = normQuery.split(/\s+/).filter(Boolean);

    return allExpenses.filter(exp => {
      const isDateValid = (expenseStartDate || expenseEndDate)
        ? isExpenseInDateRange(exp.date)
        : (showAllDates || queryTokens.length > 0 ? true : isInCycle(exp.date));

      if (!isDateValid) return false;

      // Filter by category only when not actively searching, so search can find items across all categories
      if (expenseCategoryFilter && queryTokens.length === 0) {
        const matchesMain = exp.category === expenseCategoryFilter;
        const matchesItems = exp.items && exp.items.some(it => (it.category || detectProductCategory(it.name)) === expenseCategoryFilter);
        if (!matchesMain && !matchesItems) return false;
      }

      if (onlyWarrantyFilter) {
        const hasW = exp.hasWarranty || (exp.warrantiesCount && exp.warrantiesCount > 0) || (exp.items && exp.items.some(it => it.hasWarranty));
        if (!hasW) return false;
      }

      if (queryTokens.length === 0) return true;

      // Build complete searchable corpus across store names, material names, categories, notes, prices, warranty
      const itemTexts: string[] = [];
      if (exp.items && Array.isArray(exp.items)) {
        for (const it of exp.items) {
          if (it.name) itemTexts.push(it.name);
          if (it.place) itemTexts.push(it.place);
          if (it.category) itemTexts.push(it.category);
          if (it.warrantyNotes) itemTexts.push(it.warrantyNotes);
          if (it.warrantyPeriod) itemTexts.push(it.warrantyPeriod);
          if (it.price != null) itemTexts.push(it.price.toString());
          if (it.quantity != null) itemTexts.push(it.quantity.toString());
        }
      }

      const expCorpus = [
        exp.name,
        exp.category,
        exp.amount?.toString(),
        exp.targetMember,
        exp.date,
        (exp as any).place,
        (exp as any).store,
        (exp as any).storeName,
        (exp as any).notes,
        (exp as any).description,
        (exp as any).details,
        (exp as any).invoiceNumber,
        ...itemTexts
      ].filter(Boolean).join(" ");

      const normCorpus = normalizeArabicText(expCorpus);

      return queryTokens.every(token => normCorpus.includes(token));
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [allExpenses, expenseSearch, expenseStartDate, expenseEndDate, showAllDates, selectedCycleId, expenseCategoryFilter, onlyWarrantyFilter]);

  const [displayedExpenseCount, setDisplayedExpenseCount] = useState(30);

  useEffect(() => {
    setDisplayedExpenseCount(30);
  }, [expenseCategoryFilter, expenseSearch, expenseStartDate, expenseEndDate, showAllDates]);

  const displayedExpenses = useMemo(() => {
    return filteredExpenses.slice(0, displayedExpenseCount);
  }, [filteredExpenses, displayedExpenseCount]);

  const filteredExpensesTotal = useMemo(() => {
    return filteredExpenses.reduce((s, e) => s + e.amount, 0);
  }, [filteredExpenses]);

  const totalBillsAmt = bills.reduce((s, b) => s + b.amount, 0);

  const totalInstallmentMonthly = installments.reduce((s, i) => s + i.monthlyInstallment, 0);

  const isBillPaidThisCycle = (bill: Bill) => {
    if (!bill.paidDates) return false;
    return bill.paidDates.some(p => {
      if (p.cycleId) return p.cycleId === selectedCycleId;
      return isInCycle(p.date);
    });
  };
  
  // عدد الأشهر المتأخرة للفاتورة: الأشهر التي حل موعدها منذ إنشاء الفاتورة ناقص عدد الدفعات المسجلة
  const getBillOverdueMonths = (bill: Bill) => {
    if (!bill.createdAt) return 0;
    const start = new Date(bill.createdAt);
    if (isNaN(start.getTime())) return 0;
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const now = new Date();
    let due = 0;
    const totalMonths = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    for (let k = 0; k <= totalMonths; k++) {
      const dueDate = new Date(start.getFullYear(), start.getMonth() + k, bill.dueDay || 1);
      if (dueDate >= startDay && dueDate <= now) due++;
    }
    return Math.max(0, due - (bill.paidDates?.length || 0));
  };

  const getInstallmentDelayMonths = (i: Installment) => {
    if (i.remainingAmount <= 0) return 0;
    if (!i.startDate) {
      return i.payments.some(p => isInCycle(p.date)) ? 0 : 1;
    }
    const start = new Date(i.startDate);
    const now = new Date();
    const monthsElapsed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    const requiredPayments = monthsElapsed + 1;
    const paidMonths = (i.initialPaidMonths || 0) + i.payments.length;
    return Math.max(0, requiredPayments - paidMonths);
  };

  const getInstallmentAdvanceMonths = (i: Installment) => {
    if (i.remainingAmount <= 0) return 0;
    if (!i.startDate) return 0;
    const start = new Date(i.startDate);
    const now = new Date();
    const monthsElapsed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    const requiredPayments = monthsElapsed + 1;
    const paidMonths = (i.initialPaidMonths || 0) + i.payments.length;
    return Math.max(0, paidMonths - requiredPayments);
  };

  const isInstallmentOwedThisCycle = (i: Installment) => getInstallmentDelayMonths(i) > 0;

  const unpaidBillsAmt = bills.filter(b => !isBillPaidThisCycle(b)).reduce((s, b) => s + b.amount, 0);
  const unpaidInstallmentsMonthly = installments.filter(i => isInstallmentOwedThisCycle(i)).reduce((s, i) => s + i.monthlyInstallment, 0);
  const unpaidObligations = unpaidBillsAmt + unpaidInstallmentsMonthly;

  // بناءً على طلبك السابق: يتم خصم القسط أو الفاتورة فقط عند دفعها (لتصبح ضمن المصاريف) لمنع الخصم المزدوج
  const balance = totalIncome - totalExpensesAmt;

  const shoppingList = [
    ...inventory.filter(i => (i.neededQuantity || 0) > 0).map(i => ({ ...i, _source: "inventory" as const })),
    ...carInventory.filter(i => (i.neededQuantity || 0) > 0).map(i => ({ ...i, _source: "car" as const })),
    ...travelInventory.filter(i => (i.neededQuantity || 0) > 0).map(i => ({ ...i, _source: "travel" as const }))
  ];

  interface UnifiedDeficit {
    id: string;
    key: string;
    sourceType: "need" | "inventory" | "family" | "car" | "travel";
    name: string;
    category: string;
    quantity: number;
    unit: string;
    estimatedPrice: number;
    imageUrl?: string;
    images?: string[];
    notes?: string;
    dosageOrSpecs?: string;
    member?: string;
    isMedicine: boolean;
    tripDestination?: string;
    originalItem: any;
  }

  const unifiedDeficits = useMemo<UnifiedDeficit[]>(() => {
    const list: UnifiedDeficit[] = [];

    // 1. Direct / Photo Needs (including medicines & custom items)
    needs.filter(n => !n.isBought).forEach(n => {
      const isMed = n.category === "أدوية وصيدلية" || n.name.includes("دواء") || n.name.includes("علاج") || !!n.dosageOrSpecs;
      list.push({
        id: n.id,
        key: `need-${n.id}`,
        sourceType: "need",
        name: n.name,
        category: n.category || (isMed ? "أدوية وصيدلية" : "أخرى"),
        quantity: n.quantity || 1,
        unit: n.unit || (isMed ? "علبة" : "قطعة"),
        estimatedPrice: n.estimatedPrice || 0,
        imageUrl: n.imageUrl,
        images: n.images && n.images.length > 0 ? n.images : (n.imageUrl ? [n.imageUrl] : []),
        notes: n.notes,
        dosageOrSpecs: n.dosageOrSpecs,
        isMedicine: isMed,
        originalItem: n,
      });
    });

    // 2. Home Inventory shortages
    inventory.filter(i => (i.neededQuantity || 0) > 0).forEach(i => {
      const isMed = i.category === "أدوية وصيدلية" || i.category?.includes("دواء") || i.name.includes("دواء") || i.name.includes("علاج");
      list.push({
        id: i.id,
        key: `inv-${i.id}`,
        sourceType: "inventory",
        name: i.name,
        category: i.category || "مستلزمات منزلية",
        quantity: i.neededQuantity || 1,
        unit: i.unit || "قطعة",
        estimatedPrice: i.estimatedPrice || 0,
        imageUrl: i.imageUrl,
        images: (i as any).images && (i as any).images.length > 0 ? (i as any).images : (i.imageUrl ? [i.imageUrl] : []),
        notes: i.notes,
        isMedicine: isMed,
        originalItem: i,
      });
    });

    // 3. Family Needs
    familyNeeds.filter(f => f.status === "pending" && f.type !== "duty").forEach(f => {
      const isMed = f.category === "أدوية وصيدلية" || f.category?.includes("دواء") || f.title.includes("دواء") || f.title.includes("علاج");
      list.push({
        id: f.id,
        key: `fam-${f.id}`,
        sourceType: "family",
        name: f.title,
        category: f.category || "عائلة",
        quantity: Number(f.quantity) || 1,
        unit: "قطعة",
        estimatedPrice: Number(f.estimatedPrice) || 0,
        member: f.member,
        notes: f.notes,
        isMedicine: isMed,
        originalItem: f,
      });
    });

    // 4. Car Inventory shortages
    carInventory.filter(c => (c.neededQuantity || 0) > 0).forEach(c => {
      list.push({
        id: c.id,
        key: `car-${c.id}`,
        sourceType: "car",
        name: c.name,
        category: c.category || "سيارة",
        quantity: c.neededQuantity || 1,
        unit: c.unit || "قطعة",
        estimatedPrice: c.estimatedPrice || 0,
        imageUrl: c.imageUrl,
        notes: c.notes,
        isMedicine: false,
        originalItem: c,
      });
    });

    // 5. Travel Inventory shortages
    travelInventory.filter(t => (t.neededQuantity || 0) > 0).forEach(t => {
      list.push({
        id: t.id,
        key: `travel-${t.id}`,
        sourceType: "travel",
        name: t.name,
        category: t.category || "سفر",
        quantity: t.neededQuantity || 1,
        unit: t.unit || "قطعة",
        estimatedPrice: t.estimatedPrice || 0,
        imageUrl: t.imageUrl,
        notes: t.notes,
        isMedicine: false,
        tripDestination: t.tripDestination,
        originalItem: t,
      });
    });

    return list;
  }, [needs, inventory, familyNeeds, carInventory, travelInventory]);

  const needsSummaryStats = useMemo(() => {
    const summary: { id: string; name: string; count: number; price: number; icon: string; colorClass: string }[] = [];
    
    // Medicines
    const medItems = unifiedDeficits.filter(i => i.isMedicine);
    if (medItems.length > 0) {
      summary.push({
        id: "medicine",
        name: "أدوية وصيدلية",
        count: medItems.reduce((s, i) => s + (i.quantity || 1), 0),
        price: medItems.reduce((s, i) => s + ((i.quantity || 1) * (i.estimatedPrice || 0)), 0),
        icon: "💊",
        colorClass: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800"
      });
    }

    // Home Inventory
    const homeItems = unifiedDeficits.filter(i => i.sourceType === "inventory" || (i.sourceType === "need" && !i.isMedicine));
    if (homeItems.length > 0) {
      summary.push({
        id: "home",
        name: "موجودات ومسواك البيت",
        count: homeItems.reduce((s, i) => s + (i.quantity || 1), 0),
        price: homeItems.reduce((s, i) => s + ((i.quantity || 1) * (i.estimatedPrice || 0)), 0),
        icon: "📦",
        colorClass: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800"
      });
    }

    // Family
    const famItems = unifiedDeficits.filter(i => i.sourceType === "family");
    if (famItems.length > 0) {
      summary.push({
        id: "family",
        name: "طلبات العائلة",
        count: famItems.reduce((s, i) => s + (i.quantity || 1), 0),
        price: famItems.reduce((s, i) => s + ((i.quantity || 1) * (i.estimatedPrice || 0)), 0),
        icon: "👨‍👩‍👧‍👦",
        colorClass: "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/30 dark:text-pink-300 dark:border-pink-800"
      });
    }

    // Car
    const carItems = unifiedDeficits.filter(i => i.sourceType === "car");
    if (carItems.length > 0) {
      summary.push({
        id: "car",
        name: "نواقص السيارة",
        count: carItems.reduce((s, i) => s + (i.quantity || 1), 0),
        price: carItems.reduce((s, i) => s + ((i.quantity || 1) * (i.estimatedPrice || 0)), 0),
        icon: "🚗",
        colorClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800"
      });
    }

    // Travel
    const travelItems = unifiedDeficits.filter(i => i.sourceType === "travel");
    if (travelItems.length > 0) {
      summary.push({
        id: "travel",
        name: "نواقص السفر",
        count: travelItems.reduce((s, i) => s + (i.quantity || 1), 0),
        price: travelItems.reduce((s, i) => s + ((i.quantity || 1) * (i.estimatedPrice || 0)), 0),
        icon: "✈️",
        colorClass: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-300 dark:border-teal-800"
      });
    }

    return summary;
  }, [unifiedDeficits]);

  const effectiveDebts = useMemo(() => {
    // إخفاء الدين القديم الذي كان يسجل يدوياً باسم "دين الكيك"
    const cleaned = debts.filter(d => 
      d.person !== "دين الكيك" && 
      d.person !== "دين الكيك (اموال الراتب)" &&
      d.person !== "دين الكيك (اموال الراتب - مطلوب للكيك)" &&
      d.person !== "دين الكيك (اموال الراتب - يطلبنا)"
    );
    if (cakeSalaryDebt > 0) {
      cleaned.push({
        id: "virtual-cake-debt",
        person: "دين الكيك (اموال الراتب)",
        amount: cakeSalaryDebt,
        type: "دين لي",
        date: today(),
        payments: [], // المدفوعات تتم إدارتها داخل مقر القيادة المركزية مباشرة (expenses)
        createdAt: today()
      });
    } else if (cakeSalaryDebt < 0) {
      cleaned.push({
        id: "virtual-cake-debt",
        person: "دين الكيك (اموال الراتب - يطلبنا)",
        amount: Math.abs(cakeSalaryDebt),
        type: "دين علي",
        date: today(),
        payments: [], // المدفوعات تتم إدارتها داخل مقر القيادة المركزية مباشرة (expenses)
        createdAt: today()
      });
    }
    return cleaned;
  }, [debts, cakeSalaryDebt]);

  const totalNeedsAmt = unifiedDeficits.reduce((s, i) => s + ((i.quantity || 1) * (i.estimatedPrice || 0)), 0);
  const totalDebtsForMe = effectiveDebts
    .filter(d => d.type === "دين لي")
    .reduce((s, d) => {
      const paidForMe = d.payments.filter(p => p.type === "دين لي" || (!p.type && d.type === "دين لي")).reduce((ps, p) => ps + p.amount, 0);
      const paidOnMe = d.payments.filter(p => p.type === "دين علي" || (!p.type && d.type === "دين علي")).reduce((ps, p) => ps + p.amount, 0);
      return s + Math.max(0, (d.amount - paidForMe) + paidOnMe);
    }, 0);

  const totalDebtsOnMe = effectiveDebts
    .filter(d => d.type === "دين علي")
    .reduce((s, d) => {
      const paidOnMe = d.payments.filter(p => p.type === "دين علي" || (!p.type && d.type === "دين علي")).reduce((ps, p) => ps + p.amount, 0);
      const paidForMe = d.payments.filter(p => p.type === "دين لي" || (!p.type && d.type === "دين لي")).reduce((ps, p) => ps + p.amount, 0);
      return s + Math.max(0, (d.amount - paidOnMe) + paidForMe);
    }, 0);

  // ──────────────────────────────────────────
  // FUTURE PLAN HANDLERS
  // ──────────────────────────────────────────
  const handleSaveFuturePlan = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = fd.get("title") as string;
    const targetAmount = Number(fd.get("targetAmount"));
    const savedAmount = Number(fd.get("savedAmount")) || 0;
    const savingVision = fd.get("savingVision") as string;
    const targetDate = fd.get("targetDate") as string;
    const imageUrl = fd.get("imageUrl") as string;

    let updatedList;
    if (editFuturePlan) {
      updatedList = futurePlans.map(p => p.id === editFuturePlan.id ? {
        ...p, title, targetAmount, savedAmount, savingVision, targetDate, imageUrl, steps: futurePlanSteps
      } : p);
    } else {
      updatedList = [...futurePlans, {
        id: Date.now().toString(),
        title, targetAmount, savedAmount, savingVision, targetDate, imageUrl, steps: futurePlanSteps,
        createdAt: new Date().toISOString()
      }];
    }
    
    setFuturePlans(updatedList);
    syncToFirebase("futurePlans", updatedList);
    setShowFuturePlanModal(false);
setEditFuturePlan(null);
    setFuturePlanSteps([]);
  };

  const handleDeleteFuturePlan = async (id: string) => {
    if (!(await customConfirm("هل أنت متأكد من الحذف؟"))) return;
    showConfirm("حذف الخطة", () => {
      const updatedList = futurePlans.filter(p => p.id !== id);
      setFuturePlans(updatedList);
      syncToFirebase("futurePlans", updatedList);
    }, true, "هل أنت متأكد من حذف هذه الخطة؟");
  };

  const toggleFuturePlanStep = (planId: string, stepId: string) => {
    const updatedList = futurePlans.map(plan => {
      if (plan.id === planId) {
        return {
          ...plan,
          steps: plan.steps.map(s => s.id === stepId ? { ...s, isCompleted: !s.isCompleted } : s)
        };
      }
      return plan;
    });
    setFuturePlans(updatedList);
    syncToFirebase("futurePlans", updatedList);
  };

  const handleReorderFuturePlanStep = (planId: string, stepIndex: number, direction: 'up' | 'down') => {
    const updatedList = futurePlans.map(plan => {
      if (plan.id === planId) {
        const newSteps = [...plan.steps];
        if (direction === 'up' && stepIndex > 0) {
          [newSteps[stepIndex - 1], newSteps[stepIndex]] = [newSteps[stepIndex], newSteps[stepIndex - 1]];
        } else if (direction === 'down' && stepIndex < newSteps.length - 1) {
          [newSteps[stepIndex + 1], newSteps[stepIndex]] = [newSteps[stepIndex], newSteps[stepIndex + 1]];
        }
        return { ...plan, steps: newSteps };
      }
      return plan;
    });
    setFuturePlans(updatedList);
    syncToFirebase("futurePlans", updatedList);
  };

  const handleEditFuturePlanStep = (planId: string, stepId: string, newText: string, newDate?: string) => {
    const updatedList = futurePlans.map(plan => {
      if (plan.id === planId) {
        return {
          ...plan,
          steps: plan.steps.map(s => s.id === stepId ? { ...s, text: newText, date: newDate } : s)
        };
      }
      return plan;
    });
    setFuturePlans(updatedList);
    syncToFirebase("futurePlans", updatedList);
  };

  // ──────────────────────────────────────────
  // INSTALLMENT HANDLERS
  // ──────────────────────────────────────────
  const handleSaveInstallment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const isEdit = !!editInstallment;
    
    const monthlyInstallment = Number(fd.get("monthly")) || 0;
    const totalAmount = Number(fd.get("total")) || 0;
    const totalMonths = Number(fd.get("totalMonths")) || undefined;
    const initialPaidMonths = Number(fd.get("initialPaidMonths")) || 0;
    const downPayment = Number(fd.get("downPayment")) || 0;

    const paymentsActualTotal = isEdit ? editInstallment!.payments.reduce((s, p) => s + p.amount, 0) : 0;
    const initialPaidAmount = initialPaidMonths * monthlyInstallment;
    let computedRemaining = Math.max(0, totalAmount - (paymentsActualTotal + initialPaidAmount + downPayment));
    let remainingAmount = computedRemaining;
    
    let startDate = fd.get("startDate") as string;
    
    const delayedMonthsStr = fd.get("delayedMonths") as string;
    if (delayedMonthsStr.trim() !== "") {
      const delayedMonths = Number(delayedMonthsStr);
      const paymentsCount = isEdit ? editInstallment!.payments.length : 0;
      const monthsElapsed = initialPaidMonths + paymentsCount + delayedMonths - 1;
      const d = new Date();
      d.setMonth(d.getMonth() - Math.max(0, monthsElapsed));
      startDate = d.toISOString().split("T")[0];
    } else if (!startDate) {
      startDate = today();
    }

    const item: Installment = {
      id: isEdit ? editInstallment!.id : Date.now().toString(),
      name: fd.get("name") as string,
      type: fd.get("type") as "قسط" | "سلفة",
      totalAmount,
      monthlyInstallment,
      remainingAmount,
      startDate,
      totalMonths,
      initialPaidMonths,
      downPayment,
      payments: isEdit ? editInstallment!.payments : [],
      createdAt: isEdit ? editInstallment!.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    if (isEdit) {
      const updated = installments.map(x => x.id === item.id ? item : x);
      setInstallments(updated);
      syncToFirebase("installments", updated);
      toast.success("تم تحديث القسط");
    } else {
      const updated = [item, ...installments];
      setInstallments(updated);
      syncToFirebase("installments", updated);
      toast.success("تم إضافة القسط");
    }
    setShowInstallmentModal(false);
    setEditInstallment(null);
};

  const handlePayInstallment = (inst: Installment) => {
    // احسب المتبقي الحقيقي ديناميكياً
    const paymentsActualTotal = inst.payments.reduce((s, p) => s + p.amount, 0);
    const initialPaidAmount = (inst.initialPaidMonths || 0) * inst.monthlyInstallment;
    const downPaymentAmount = inst.downPayment || 0;
    const computedRemaining = Math.max(0, inst.totalAmount - (paymentsActualTotal + initialPaidAmount + downPaymentAmount));
    
    if (computedRemaining <= 0) { toast("تم سداد هذا القسط بالكامل ✅"); return; }
    
    // Create an expense record for this payment
    const expenseId = Date.now().toString();
    const paymentAmount = Math.min(inst.monthlyInstallment, computedRemaining);
    const expense: Expense = {
      id: expenseId,
      name: `قسط: ${inst.name}`,
      category: "أقساط وسلف",
      amount: paymentAmount,
      date: today(),
      createdAt: new Date().toISOString(),
    };
    
    const updatedExpenses = [expense, ...expenses];
    setExpenses(updatedExpenses);
    syncToFirebase("expenses", updatedExpenses);

    // أضف الدفعة واحسب المتبقي بشكل صحيح
    const payment = { date: new Date().toISOString(), amount: paymentAmount, expenseId };
    const newPayments = [...inst.payments, payment];
    const newPaidTotal = newPayments.reduce((s, p) => s + p.amount, 0) + initialPaidAmount + downPaymentAmount;
    const newRemaining = Math.max(0, inst.totalAmount - newPaidTotal);
    
    const updated = installments.map(x => x.id === inst.id ? {
      ...x,
      remainingAmount: newRemaining,
      payments: newPayments,
      updatedAt: new Date().toISOString(),
    } : x);
    setInstallments(updated);
    syncToFirebase("installments", updated);
    
    toast.success(`تم دفع قسط ${inst.name} (المتبقي: ${fmt(newRemaining)} د.ع)`);
  };

  const handleUndoInstallmentPayment = (inst: Installment) => {
    if (inst.payments.length === 0) { toast.error("لا توجد دفعات للتراجع عنها"); return; }
    const lastPayment = inst.payments[inst.payments.length - 1];
    
    // Remove the associated expense
    if (lastPayment.expenseId) {
      const updatedExpenses = expenses.filter(e => e.id !== lastPayment.expenseId);
      setExpenses(updatedExpenses);
      syncToFirebase("expenses", updatedExpenses);
    }
    
    const updated = installments.map(x => x.id === inst.id ? {
      ...x,
      remainingAmount: x.remainingAmount + lastPayment.amount,
      payments: x.payments.slice(0, -1),
      updatedAt: new Date().toISOString(),
    } : x);
    setInstallments(updated);
    syncToFirebase("installments", updated);
    toast.success("تم التراجع عن آخر دفعة");
  };

  const handleDeleteInstallment = async (id: string) => {
    if (!(await customConfirm("هل أنت متأكد من الحذف؟"))) return;
    const updated = installments.filter(x => x.id !== id);
    setInstallments(updated);
    syncToFirebase("installments", updated);
  };

  // ──────────────────────────────────────────
  // BILL HANDLERS
  // ──────────────────────────────────────────
  const handleSaveBill = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const isEdit = !!editBill;
    const item: Bill = {
      id: isEdit ? editBill!.id : Date.now().toString(),
      name: fd.get("name") as string,
      category: fd.get("category") as string,
      amount: Number(fd.get("amount")),
      paid: isEdit ? editBill!.paid : false,
      paidDates: isEdit ? editBill!.paidDates : [],
      paymentType: (fd.get("paymentType") as "مسبق" | "لاحق") || "مسبق",
      createdAt: isEdit ? editBill!.createdAt : new Date().toISOString(),
    };
    if (Number(fd.get("dueDay"))) item.dueDay = Number(fd.get("dueDay"));
    if (isEdit) {
      const updated = bills.map(x => x.id === item.id ? item : x);
      setBills(updated);
      syncToFirebase("bills", updated);
      toast.success("تم تعديل الفاتورة");
    } else {
      const updated = [...bills, item];
      setBills(updated);
      syncToFirebase("bills", updated);
      toast.success("تم إضافة الفاتورة");
    }
    setShowBillModal(false);
    setEditBill(null);
};

  const handlePayBill = (bill: Bill) => {
    setPayBillData({ bill, amount: bill.amount.toString(), months: 1 });
  };

  const confirmPayBill = () => {
    if (!payBillData) return;
    const { bill, amount, months } = payBillData;
    
    const actualAmount = Number(amount);
    if (isNaN(actualAmount) || actualAmount <= 0) { toast.error("مبلغ غير صحيح"); return; }
    if (months < 1 || months > 24) { toast.error("عدد الأشهر غير صحيح"); return; }

    const expenseId = Date.now().toString();
    const expense: Expense = {
      id: expenseId, 
      name: `فاتورة: ${bill.name}${months > 1 ? ` (${months} أشهر)` : ""}`,
      category: bill.category, 
      amount: actualAmount,
      date: today(), 
      createdAt: new Date().toISOString(),
    };
    
    const updatedExpenses = [expense, ...expenses];
    setExpenses(updatedExpenses);
    syncToFirebase("expenses", updatedExpenses);

    const targetCycleIds = getNextUnpaidCycleIds(bill, selectedCycleId, months);
    const newPayments = targetCycleIds.map(cycleId => ({
      date: new Date().toISOString(),
      amount: actualAmount / months,
      expenseId,
      cycleId
    }));

    const updatedBills = bills.map(x => x.id === bill.id ? { 
      ...x, 
      paid: true, 
      paidDates: [...x.paidDates, ...newPayments] 
    } : x);
    setBills(updatedBills);
    syncToFirebase("bills", updatedBills);
    
    setPayBillData(null);
    toast.success(`تم سداد ${actualAmount.toLocaleString("ar-IQ")} د.ع عن فاتورة ${bill.name}`);
  };

  const handleUndoBillPayment = (bill: Bill) => {
    if (!bill.paid || bill.paidDates.length === 0) { toast.error("الفاتورة غير مدفوعة"); return; }
    const lastPayment = bill.paidDates[bill.paidDates.length - 1];
    
    if (lastPayment.expenseId) {
      const updatedExpenses = expenses.filter(e => e.id !== lastPayment.expenseId);
      setExpenses(updatedExpenses);
      syncToFirebase("expenses", updatedExpenses);
    }
    
    const updatedBills = bills.map(x => {
      if (x.id === bill.id) {
        const remainingPayments = x.paidDates.filter(p => p.expenseId !== lastPayment.expenseId);
        return { 
          ...x, 
          paid: remainingPayments.length > 0, 
          paidDates: remainingPayments 
        };
      }
      return x;
    });
    setBills(updatedBills);
    syncToFirebase("bills", updatedBills);
    toast.success("تم التراجع عن دفع الفاتورة");
  };

  const handleDeleteBill = async (id: string) => {
    if (!(await customConfirm("هل أنت متأكد من الحذف؟"))) return;
    const updated = bills.filter(x => x.id !== id);
    setBills(updated);
    syncToFirebase("bills", updated);
    toast.success("تم الحذف");
  };

  // ──────────────────────────────────────────
  // EXPENSE HANDLERS & SMART AI SCANNER
  // ──────────────────────────────────────────
  const handleScanReceipt = async (
    e: React.ChangeEvent<HTMLInputElement>,
    customPlace?: string,
    append: boolean = false
  ) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    try {
      setIsScanningReceipt(true);
      setScanStatusText(files.length > 1 ? `جاري قراءة واستخراج البيانات من ${files.length} صور بالذكاء الاصطناعي 🧠...` : "جاري قراءة واستخراج بيانات الفاتورة بالذكاء الاصطناعي 🧠...");

      // Compress images fast (<100ms each) for AI analysis
      const dataUrls = await Promise.all(files.map(f => compressImageFast(f, 1200, 0.8)));

      // Note: We DO NOT attach the scanned images per user request:
      // "والصورة مال فاتورة الي اضيفها ما اريد ترفقها يعني بس ياخذ بياناتها وميرفقها"
      // dataUrls are used only by Gemini for OCR/parsing, without storing in attachedReceiptImages

      // Pass images to Gemini for data extraction
      const data = await scanReceiptWithGemini(dataUrls, (status) => setScanStatusText(status));

      const determinedPlace = customPlace || (selectedOutingPlace !== "كل المحطات" ? selectedOutingPlace : data.storeName) || (expCategoryInput === "طلعات وجولات" ? "سوق" : "سوبر ماركت");

      if (!expNameInput.trim() || expNameInput === "غير محدد") {
        if (data.storeName && data.storeName !== "غير محدد" && data.storeName !== "فاتورة مشتريات" && data.storeName !== "سوبر ماركت") {
          setExpNameInput(data.storeName);
        } else {
          setExpNameInput(expCategoryInput === "طلعات وجولات" ? "طلعة بغداد" : "تعاون ماركت");
        }
      }

      if (data.category && expCategoryInput !== "طلعات وجولات" && (!expCategoryInput || expCategoryInput === "سوبر ماركت")) {
        setExpCategoryInput(data.category);
      }

      const todayStr = today();
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

      setExpDateInput(extractedDate);

      if (Array.isArray(data.items) && data.items.length > 0) {
        const itemsWithPlace = data.items.map((it, idx) => {
          const itemPlace = it.place || determinedPlace || data.storeName || "سوبر ماركت";
          const cat = it.category || detectProductCategory(it.name);
          return {
            id: it.id || `item-${Date.now()}-${idx}-${Math.random().toString(36).substring(7)}`,
            name: it.name || "",
            quantity: Number(it.quantity) || 1,
            price: Number(it.price) || 0,
            place: itemPlace,
            category: cat,
            priority: (it as any).priority || detectProductPriority(it.name || "", cat)
          };
        });

        // Filter out empty placeholder rows that might already exist
        const existingValidItems = expenseItems.filter(it => (it.name || "").trim() !== "" || (Number(it.price) || 0) > 0);

        if (existingValidItems.length > 0) {
          // Merge / Append with existing items
          const combined = [...existingValidItems, ...itemsWithPlace];
          setExpenseItems(combined);
          toast.success(`تم دمج وإضافة ${itemsWithPlace.length} مادة مع القائمة السابقة بنجاح! ⚡✨`, {
            duration: 4000
          });
        } else {
          setExpenseItems(itemsWithPlace);
          toast.success(`تم استخراج ${data.items.length} مادة وتعبئة بيانات الفاتورة بنجاح! ⚡✨`, {
            duration: 4000
          });
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

  const handleSaveWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: WalletState = {
        bankBalance: Number(walletBankInput) || 0,
        cashBalance: Number(walletCashInput) || 0,
        updatedAt: new Date().toISOString()
      };
      setWallet(payload);
      await setDoc(doc(db, "home_finance", "wallets"), payload, { merge: true });
      setShowWalletModal(false);
      toast.success("تم تحديث أرصدة المحفظة المصرفية والكاش بنجاح 💼");
    } catch (err) {
      console.error("Save wallet err:", err);
      toast.error("حدث خطأ أثناء حفظ المحفظة");
    }
  };

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
          const cat = detectProductCategory(name);
          newItems.push({
            id: `item-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            name,
            quantity,
            price,
            category: cat,
            place: expNameInput.trim() || (expCategoryInput === "طلعات وجولات" ? "سوق" : "سوبر ماركت"),
            priority: detectProductPriority(name, cat)
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
          const cat = detectProductCategory(name);
          newItems.push({
            id: `item-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            name,
            quantity: 1,
            price,
            category: cat,
            place: expNameInput.trim() || (expCategoryInput === "طلعات وجولات" ? "سوق" : "سوبر ماركت"),
            priority: detectProductPriority(name, cat)
          });
        }
      }
    }

    if (newItems.length > 0) {
      setExpenseItems(prev => [...prev, ...newItems]);
      toast.success(`تمت إضافة ${newItems.length} مواد بنجاح!`);
      setShowQuickPasteModal(false);
      setQuickPasteText("");
    } else {
      toast.error("لم يتم التعرف على أي مواد. تأكد من إدخال اسم المادة والسعر في كل سطر.");
    }
  };

  const handleSaveExpense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSavingExpense) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const isEdit = !!editExpense;
    
    const validItems = expenseItems.filter(i => (i.name || "").trim() !== "");
    const derivedCategory = validItems.find(i => i.category && i.category.trim() !== "")?.category
      || expCategoryInput
      || "سوبر ماركت";
    const category = derivedCategory;

    let name = (expNameInput || (fd.get("name") as string) || "").trim();
    if (!name || name === "غير محدد") {
      name = validItems[0]?.place || validItems[0]?.name || (category === "سوبر ماركت" ? "تعاون ماركت" : (category || "مصروف عام"));
    }
    const finalAmount = validItems.length > 0 
      ? validItems.reduce((acc, curr) => acc + (curr.price || 0), 0) 
      : Number(fd.get("amount") || 0);
    const date = expDateInput || (fd.get("date") as string) || today();

    if (finalAmount <= 0 && validItems.length === 0 && !name) {
      toast.error("يرجى إدخال اسم ومبلغ المصروف أو إضافة مواد للقائمة");
      return;
    }

    // 1. Lottery Check
    const isLottoRelated = name.includes("لوتو") || name.includes("عراق لوتو") || category === "ألعاب ويانصيب";

    const hasAnyWarranty = validItems.some(i => i.hasWarranty);
    const warrantiesCount = validItems.filter(i => i.hasWarranty).length;

    setIsSavingExpense(true);

    // Upload receipt images resiliently (Firebase Storage HTTPS URL or tiny thumbnail fallback)
    let finalReceiptImages = [...attachedReceiptImages];
    if (finalReceiptImages.some(img => img.startsWith("data:image"))) {
      toast("جاري حفظ وتخزين صور الفاتورة في السحابة... ⏳", { id: "uploading_receipt", duration: 8000 });
      try {
        finalReceiptImages = await Promise.all(
          finalReceiptImages.map((img, idx) => 
            uploadImageResiliently("receipts", `rec_${Date.now()}_${idx}`, img)
          )
        );
        toast.dismiss("uploading_receipt");
      } catch (uploadErr) {
        console.warn("Receipt upload issue, using safe fallback:", uploadErr);
        toast.dismiss("uploading_receipt");
      }
    }

    // Clean and validate items to guarantee zero undefined values for Firestore
    const cleanedItems: ExpenseItem[] = validItems.map((vit, idx) => ({
      id: vit.id || `item-${Date.now()}-${idx}`,
      name: (vit.name || "").trim(),
      quantity: Number(vit.quantity) || 1,
      price: Number(vit.price) || 0,
      category: vit.category || category,
      place: vit.place || name,
      hasWarranty: Boolean(vit.hasWarranty),
      warrantyPeriod: vit.warrantyPeriod || "",
      warrantyExpiryDate: vit.warrantyExpiryDate || "",
      warrantyCardImage: vit.warrantyCardImage || "",
      warrantyNotes: vit.warrantyNotes || "",
      priority: vit.priority || detectProductPriority(vit.name || "", vit.category || category)
    }));

    const normSaveCat = normalizeArabicText(category || "");
    const normSaveName = normalizeArabicText(name || "");
    const isOutingOrTrip = normSaveCat.includes("طلعات") || normSaveCat.includes("سفر") || normSaveCat.includes("اقساط") || normSaveCat.includes("سلف") ||
      normSaveCat.includes("مطاعم") || normSaveCat.includes("كافيه") || normSaveCat.includes("العاب") ||
      normSaveName.includes("طلعه") || normSaveName.includes("جوله") || normSaveName.includes("مشوار") ||
      normSaveName.includes("سفره") || normSaveName.startsWith("قسط") || normSaveName.includes("مطعم") || normSaveName.includes("كافيه");

    const isCarExpense = !isOutingOrTrip && (expBeneficiary === "السيارة" || isCarExpenseMatch(name, category, cleanedItems));
    const assignedMember = (expBeneficiary !== "عام للبيت" && expBeneficiary !== "السيارة") 
      ? expBeneficiary 
      : detectFamilyMemberMatch(name);

    const item: Expense = {
      id: isEdit ? editExpense!.id : Date.now().toString(),
      name,
      category,
      amount: finalAmount,
      date,
      createdAt: isEdit ? editExpense!.createdAt : new Date().toISOString(),
      hasWarranty: hasAnyWarranty || Boolean(isEdit && editExpense?.hasWarranty),
      warrantiesCount: warrantiesCount || (isEdit ? editExpense?.warrantiesCount : 0),
      imageUrl: finalReceiptImages[0] || (isEdit ? editExpense?.imageUrl : "") || "",
      receiptImages: finalReceiptImages.length > 0 ? finalReceiptImages : (isEdit ? (editExpense?.receiptImages || []) : []),
      isCar: isCarExpense,
      targetMember: assignedMember || undefined
    };
    if (cleanedItems.length > 0) {
      item.items = cleanedItems;
    }
    let updatedList = expenses;
    if (isEdit) {
      updatedList = expenses.map(x => x.id === item.id ? item : x);
      setExpenses(updatedList);
      await syncToFirebase("expenses", updatedList);
      toast.success("تم تعديل المصروف وحفظه بنجاح ✅");
    } else {
      updatedList = [item, ...expenses];
      setExpenses(updatedList);
      await syncToFirebase("expenses", updatedList);
      toast.success("تم تسجيل المصروف وحفظه بنجاح ✅");

      // 1. Automatic Car Sync: تسجيل المصروف للسيارة وإضافة قطع الغيار والمستلزمات للموجودات
      if (isCarExpense) {
        let updatedCar = [...carInventory];
        if (cleanedItems.length > 0) {
          cleanedItems.forEach(it => {
            const isItCar = isCarExpenseMatch(it.name, it.category || category);
            if (isItCar) {
              const existingIdx = updatedCar.findIndex(c => normalizeArabicText(c.name) === normalizeArabicText(it.name));
              if (existingIdx >= 0) {
                updatedCar[existingIdx] = {
                  ...updatedCar[existingIdx],
                  quantity: Number(updatedCar[existingIdx].quantity) + Number(it.quantity || 1),
                  estimatedPrice: it.price || updatedCar[existingIdx].estimatedPrice,
                  updatedAt: new Date().toISOString()
                };
              } else {
                updatedCar.push({
                  id: `car-item-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                  name: it.name,
                  quantity: Number(it.quantity || 1),
                  threshold: 1,
                  unit: "عدد",
                  category: it.category || "صيانة ووقود",
                  estimatedPrice: it.price,
                  createdAt: new Date().toISOString()
                });
              }
            }
          });
        }
        setCarInventory(updatedCar);
        syncToFirebase("carInventory", updatedCar);
        toast.success("تم ربط المصروف وإضافته تلقائياً إلى خانة وسجل السيارة 🚗✨");
      }

      // 2. Automatic Family Member Sync (رقية، قنوت، إيمان، إيڤا، حيدر)
      const detectedMembers = new Set<string>();
      let updatedFamilyNeeds = [...familyNeeds];

      if (cleanedItems.length > 0) {
        cleanedItems.forEach((it, idx) => {
          const mem = (expBeneficiary !== "عام للبيت" && expBeneficiary !== "السيارة") 
            ? expBeneficiary 
            : (detectFamilyMemberMatch(it.name) || detectFamilyMemberMatch(name));
          
          if (mem) {
            detectedMembers.add(mem);
            const existingNeedIdx = updatedFamilyNeeds.findIndex(n => 
              n.member === mem && 
              n.status === "pending" && 
              n.type !== "duty" &&
              normalizeArabicText(n.title).includes(normalizeArabicText(it.name))
            );

            if (existingNeedIdx >= 0) {
              updatedFamilyNeeds[existingNeedIdx] = {
                ...updatedFamilyNeeds[existingNeedIdx],
                status: "completed",
                estimatedPrice: it.price || updatedFamilyNeeds[existingNeedIdx].estimatedPrice,
                notes: `تم الشراء بتاريخ ${date}${it.place ? ` (${it.place})` : ""}`,
                expenseId: item.id,
                expenseDate: date
              };
            } else {
              updatedFamilyNeeds.unshift({
                id: `fam-exp-${Date.now()}-${idx}-${Math.random().toString(36).substring(7)}`,
                member: mem,
                title: it.name,
                type: "expense",
                category: it.category || category || "مصروف شخصي",
                quantity: Number(it.quantity) || 1,
                estimatedPrice: Number(it.price) || 0,
                priority: it.priority || "مهم",
                notes: `تم الشراء من المصاريف بتاريخ ${date}${it.place ? ` (${it.place})` : ""}`,
                status: "completed",
                createdAt: new Date().toISOString(),
                expenseId: item.id,
                expenseDate: date
              });
            }
          }
        });
      } else {
        const mem = (expBeneficiary !== "عام للبيت" && expBeneficiary !== "السيارة")
          ? expBeneficiary
          : detectFamilyMemberMatch(name);

        if (mem) {
          detectedMembers.add(mem);
          const existingNeedIdx = updatedFamilyNeeds.findIndex(n => 
            n.member === mem && 
            n.status === "pending" && 
            n.type !== "duty" &&
            normalizeArabicText(n.title).includes(normalizeArabicText(name))
          );

          if (existingNeedIdx >= 0) {
            updatedFamilyNeeds[existingNeedIdx] = {
              ...updatedFamilyNeeds[existingNeedIdx],
              status: "completed",
              estimatedPrice: finalAmount,
              notes: `تم الشراء بتاريخ ${date}`,
              expenseId: item.id,
              expenseDate: date
            };
          } else {
            updatedFamilyNeeds.unshift({
              id: `fam-exp-${Date.now()}-${Math.random().toString(36).substring(7)}`,
              member: mem,
              title: name,
              type: "expense",
              category: category || "مصروف شخصي",
              quantity: 1,
              estimatedPrice: finalAmount,
              priority: "مهم",
              notes: `تم الشراء من المصاريف بتاريخ ${date}`,
              status: "completed",
              createdAt: new Date().toISOString(),
              expenseId: item.id,
              expenseDate: date
            });
          }
        }
      }

      if (detectedMembers.size > 0) {
        setFamilyNeeds(updatedFamilyNeeds);
        await syncToFirebase("familyNeeds", updatedFamilyNeeds);
        toast.success(`تم حفظ نسخة من المشتريات لـ (${Array.from(detectedMembers).join("، ")}) في خانة العائلة 👧🏻✨`);
      }

      // Auto-switch to cycle containing the expense date if currently in another cycle
      const matchingCycle = cycles.find(c => {
        const startStr = `${c.start.getFullYear()}-${String(c.start.getMonth() + 1).padStart(2, '0')}-${String(c.start.getDate()).padStart(2, '0')}`;
        const endStr = `${c.end.getFullYear()}-${String(c.end.getMonth() + 1).padStart(2, '0')}-${String(c.end.getDate()).padStart(2, '0')}`;
        return date >= startStr && date <= endStr;
      });
      if (matchingCycle && matchingCycle.id !== selectedCycleId) {
        setSelectedCycleId(matchingCycle.id);
      } else if (!isInCycle(date) && !expenseStartDate && !expenseEndDate && !showAllDates) {
        // If not in current cycle, activate all periods so expense is visible immediately
        setShowAllDates(true);
        toast("تنبيه: تاريخ المصروف (" + date + ") خارج الدورة المعروضة، تم تفعيل عرض كل الفترات لتشاهده فوراً 👁️", {
          icon: "💡",
          duration: 6000
        });
      }
      
      // 2. Micro-Shopping Alert (New Expenses Only)
      if (category === "سوبر ماركت" && finalAmount < 25000) {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const recentSmallPurchases = updatedList.filter(e => 
          e.category === "سوبر ماركت" && 
          e.amount < 25000 && 
          new Date(e.date) >= oneWeekAgo
        );
        if (recentSmallPurchases.length >= 3) {
          toast("التسوق المتكرر بمبالغ صغيرة يزيد من الهدر المالي. يُنصح بدمج المشتريات في تسوقة أسبوعية واحدة.", {
            icon: "💡",
            style: { background: "#EFF6FF", color: "#1D4ED8", borderColor: "#BFDBFE" }
          });
        }
      }

      // 3. Progressive Alerts Check (New Expenses Only)
      const categoryBudget = settings.budgetLimits?.[category];
      if (categoryBudget) {
        const currentCycleExpenses = updatedList.filter(e => isInCycle(e.date) && e.category === category);
        const totalSpent = currentCycleExpenses.reduce((s, e) => s + e.amount, 0);
        const percent = totalSpent / categoryBudget;
        
        if (percent >= 1) {
          toast.error(`لقد تجاوزت الميزانية المحددة لـ ${category}! يجب التوقف عن الصرف في هذا البند.`, { duration: 8000 });
        } else if (percent >= 0.75) {
          toast(`تنبيه: اقتربت من استنفاد ميزانية ${category} لهذا الشهر. المتبقي: ${fmt(categoryBudget - totalSpent)}`, { 
            icon: "⚠️",
            style: { background: "#FEF3C7", color: "#92400E", borderColor: "#F59E0B" } 
          });
        }
      }

      // If it's lotto related, show notification offering lotto center
      if (isLottoRelated) {
        setTimeout(() => {
          toast("يمكنك توقع الأرقام القادمة ومتابعة نتيجة السحب في مركز اللوتو 🎰", {
            action: {
              label: "فتح المركز",
              onClick: () => setShowLottoTrackerModal(true)
            }
          });
        }, 600);
      }
    }
    
    try {
      form?.reset();
    } catch (err) {
      console.warn("Form reset safely caught:", err);
    }
    setExpNameInput("");
    setExpCategoryInput("سوبر ماركت");
    setExpDateInput(today());
    setExpenseItems([]);
    setAttachedReceiptImages([]);
    setIsSavingExpense(false);
    setShowExpenseModal(false);
    setEditExpense(null);
  };

  const handleDeleteExpense = async (id: string, originDocId?: string) => {
    if (!(await customConfirm("هل تريد حذف هذا المصروف نهائياً؟", { confirmText: "نعم", cancelText: "لا" }))) return;

    // Check if this expense is from cake material debt
    const isCakeDebt = originDocId || cakeDebtExpenses.some(c => c.id === id);
    if (isCakeDebt) {
      if (!(await customConfirm("هذا القيد مسجل في قسم الكيك كدين مستحق تم دفعه من راتبك الشخصي. هل أنت متأكد من حذفه نهائياً؟", { confirmText: "نعم", cancelText: "لا" }))) return;
      const docId = originDocId || id;
      try {
        await deleteDoc(doc(db, "expenses", docId));
        setCakeDebtExpenses(prev => prev.filter(x => x.id !== id && (x as any).originDocId !== docId));
        toast.success("تم حذف قيد دين فاتورة الكيك بنجاح 🗑️");
      } catch (err) {
        console.error("Error deleting cake debt expense:", err);
        toast.error("حدث خطأ أثناء حذف قيد دين الكيك");
      }
      return;
    }

    const updated = expenses.filter(x => x.id !== id);
    setExpenses(updated);
    syncToFirebase("expenses", updated);
    toast.success("تم حذف المصروف بنجاح 🗑️");
  };

  // ──────────────────────────────────────────
  // INCOME HANDLERS
  // ──────────────────────────────────────────
  const handleSaveIncome = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const isEdit = !!editIncome;
    const item: Income = {
      id: isEdit ? editIncome!.id : Date.now().toString(),
      name: fd.get("name") as string,
      type: fd.get("type") as Income["type"],
      amount: Number(fd.get("amount")),
      date: fd.get("date") as string,
      createdAt: isEdit ? editIncome!.createdAt : new Date().toISOString(),
    };
    if (isEdit) {
      const updated = incomes.map(x => x.id === item.id ? item : x);
      setIncomes(updated);
      syncToFirebase("incomes", updated);
      toast.success("تم تعديل الدخل");
    } else {
      const updated = [item, ...incomes];
      setIncomes(updated);
      syncToFirebase("incomes", updated);
      toast.success("تم تسجيل الدخل");
    }
    e.currentTarget.reset();
    setShowIncomeModal(false);
    setEditIncome(null);
};

  const handleDeleteIncome = async (id: string) => {
    if (!(await customConfirm("هل أنت متأكد من الحذف؟"))) return;
    const updated = incomes.filter(x => x.id !== id);
    setIncomes(updated);
    syncToFirebase("incomes", updated);
  };

  // ──────────────────────────────────────────
  // INVENTORY HANDLERS
  // ──────────────────────────────────────────
  const getActiveInventory = () => {
    if (activeTab === "car") return { data: carInventory, setter: setCarInventory, key: "carInventory" };
    if (activeTab === "travel") return { data: travelInventory, setter: setTravelInventory, key: "travelInventory" };
    return { data: inventory, setter: setInventory, key: "inventory" };
  };

  const handleDeleteInventoryItem = async (id: string) => {
    if (!(await customConfirm("هل أنت متأكد من الحذف؟"))) return;
    const { data: currentInv, setter: setCurrentInv, key: syncKey } = getActiveInventory();
    const updated = currentInv.filter(x => x.id !== id);
    setCurrentInv(updated);
    syncToFirebase(syncKey, updated);
  };
  const handleSaveInventory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isUploading) return;
    
    const fd = new FormData(e.currentTarget);
    const isEdit = !!editInventory;
    const invId = isEdit ? editInventory!.id : Date.now().toString();
    
    let uploadedUrl = editInventory?.imageUrl || "";
    
    if (imageFile) {
      setIsUploading(true);
      try {
        const imageCompression = (await import('browser-image-compression')).default;
        const compressed = await imageCompression(imageFile, { maxSizeMB: 0.2, maxWidthOrHeight: 800, useWebWorker: false });
        const storageRef = ref(storage, `home_finance/inventory/${invId}_${Date.now()}`);
        await uploadBytes(storageRef, compressed);
        uploadedUrl = await getDownloadURL(storageRef);
      } catch (err) {
        console.error("Image upload failed", err);
        toast.error("فشل رفع الصورة");
      } finally {
        setIsUploading(false);
      }
    }
    
    const isAvailable = invStatusMode === "available";
    const item: InventoryItem = {
      id: invId,
      name: fd.get("name") as string,
      quantity: isAvailable ? Number(fd.get("qty")) : 0,
      neededQuantity: isAvailable ? (editInventory?.neededQuantity || 0) : Number(fd.get("neededQty") || fd.get("qty")),
      threshold: Number(fd.get("threshold")) || 0,
      unit: fd.get("unit") as string,
      category: fd.get("category") as string,
      imageUrl: uploadedUrl,
      createdAt: isEdit ? editInventory!.createdAt : new Date().toISOString(),
    };
    
    if (Number(fd.get("price"))) item.estimatedPrice = Number(fd.get("price"));
    if (fd.get("notes")) item.notes = fd.get("notes") as string;
    if (fd.get("tripDestination")) item.tripDestination = fd.get("tripDestination") as string;
    
    const { data: currentInv, setter: setCurrentInv, key: syncKey } = getActiveInventory();
    
    if (isEdit) {
      const updated = currentInv.map(x => x.id === item.id ? item : x);
      setCurrentInv(updated);
      syncToFirebase(syncKey, updated);
      toast.success("تم التعديل");
    } else {
      const updated = [...currentInv, item];
      setCurrentInv(updated);
      syncToFirebase(syncKey, updated);
      toast.success("تم الإضافة");
    }
    e.currentTarget.reset();
    setInvNameInput("");
    setShowInventoryModal(false);
setEditInventory(null);
    setImageFile(null);
  };

  const handlePurchaseSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!purchaseItem) return;
    const fd = new FormData(e.currentTarget);
    const price = Number(fd.get("price"));
    const qty = Number(fd.get("qty"));
    if (!price || !qty) { toast.error("أدخل البيانات الصحيحة"); return; }
    
    const updatedInv = inventory.map(x => x.id === purchaseItem.id ? { ...x, quantity: x.quantity + qty } : x);
    setInventory(updatedInv);
    syncToFirebase("inventory", updatedInv);
    
    const newExpense = {
      id: Date.now().toString(), name: `شراء: ${purchaseItem.name}`,
      category: "سوبر ماركت", amount: price, date: today(), createdAt: new Date().toISOString(),
    };
    const updatedExpenses = [newExpense, ...expenses];
    setExpenses(updatedExpenses);
    syncToFirebase("expenses", updatedExpenses);
    
    toast.success(`تم تسجيل شراء ${purchaseItem.name}`);
    setPurchaseItem(null);
  };

  const updateQty = (id: string, delta: number) => {
    const { data: currentInv, setter: setCurrentInv, key: syncKey } = getActiveInventory();
    const item = currentInv.find(x => x.id === id);
    if (!item) return;
    const newQty = Math.max(0, item.quantity + delta);
    
    // Auto-add to needs if depleted
    if (newQty <= (item.threshold || 0) && item.quantity > (item.threshold || 0)) {
      const existingNeed = needs.find(n => n.name.trim().toLowerCase() === item.name.trim().toLowerCase() && !n.isBought);
      if (!existingNeed) {
        const newNeed: Need = {
          id: Date.now().toString(),
          name: item.name,
          estimatedPrice: item.estimatedPrice || 0,
          isBought: false,
          createdAt: new Date().toISOString(),
          quantity: 1,
          unit: item.unit,
          category: item.category
        };
        const updatedNeeds = [newNeed, ...needs];
        setNeeds(updatedNeeds);
        syncToFirebase("needs", updatedNeeds);
        toast.success(`تم إضافة ${item.name} للاحتياجات لنفاد الكمية`);
      }
    }

    const updated = currentInv.map(x => x.id === id ? { ...x, quantity: newQty } : x);
    setCurrentInv(updated);
    syncToFirebase(syncKey, updated);
  };

  // ──────────────────────────────────────────
  // NEEDS & UNIFIED DEFICITS HANDLERS (MULTI-ITEM DETECTION & AI CROPPING)
  // ──────────────────────────────────────────
  const compressImageFast = (file: File, maxDim = 900, quality = 0.75): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleScanNeedPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    setIsScanningNeed(true);
    setScanNeedStatus(files.length > 1 ? `جارٍ تجهيز وضغط ${files.length} صور 📸...` : "جارٍ تجهيز وضغط الصورة 📸...");

    try {
      const allCroppedItems: ScannedNeedItem[] = [];

      for (let fIdx = 0; fIdx < files.length; fIdx++) {
        const file = files[fIdx];
        setScanNeedStatus(files.length > 1 ? `جارٍ فحص صورة ${fIdx + 1} من ${files.length} بالذكاء الاصطناعي 🧠...` : "جارٍ فحص واكتشاف الأدوية والمنتجات بالذكاء الاصطناعي 🧠...");
        const base64Data = await compressImageFast(file, 900, 0.75);

        const detectedItems = await scanNeedItemWithGemini(base64Data, (status) => {
          setScanNeedStatus(files.length > 1 ? `[صورة ${fIdx + 1}/${files.length}] ${status}` : status);
        });

        setScanNeedStatus(files.length > 1 ? `جارٍ قص صور المواد في صورة ${fIdx + 1} (${detectedItems.length} مواد) ✂️📸...` : `جارٍ استخراج وتوليد صورة مقصوصة لكل مادة (${detectedItems.length} مواد) ✂️📸...`);
        const croppedItems: ScannedNeedItem[] = await Promise.all(
          detectedItems.map(async (item, idx) => {
            let cropUrl = base64Data;
            if (item.box_2d) {
              try {
                cropUrl = await cropItemFromImage(base64Data, item.box_2d);
              } catch (cropErr) {
                console.warn("Crop failed for item", item.name, cropErr);
              }
            }
            return {
              ...item,
              id: `scan_${Date.now()}_${fIdx}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
              croppedImageUrl: cropUrl,
              selected: true
            };
          })
        );

        allCroppedItems.push(...croppedItems);
      }

      setScannedReviewItems(allCroppedItems);
    } catch (err: any) {
      console.error("Scan need error:", err);
      toast.error("فشل قراءة الصورة، يرجى التأكد من وضوح علب الأدوية أو كتابة النقص يدوياً");
    } finally {
      setIsScanningNeed(false);
      setScanNeedStatus("");
      if (needCameraInputRef.current) needCameraInputRef.current.value = "";
      if (needGalleryInputRef.current) needGalleryInputRef.current.value = "";
    }
  };

  const handleConfirmScannedItems = async (itemsToAdd: ScannedNeedItem[]) => {
    if (!itemsToAdd || itemsToAdd.length === 0) {
      setScannedReviewItems(null);
      return;
    }

    setIsSavingScannedBatch(true);
    try {
      // 1. Immediately create needs with tiny thumbnails so Firestore document limit (1MB) is NEVER exceeded
      const newNeeds: Need[] = await Promise.all(
        itemsToAdd.map(async (item, idx) => {
          const needId = Date.now().toString() + "_" + idx + "_" + Math.random().toString(36).substring(2, 6);
          let cropUrl = item.croppedImageUrl || "";
          let tinyUrl = cropUrl;
          if (cropUrl && cropUrl.startsWith("data:image")) {
            tinyUrl = await compressToTinyThumbnail(cropUrl, 300, 0.7);
          }
          return {
            id: needId,
            name: item.name || "دواء/منتج غير محدد",
            category: item.category || "أدوية وصيدلية",
            quantity: item.quantity || 1,
            unit: item.unit || (item.category === "أدوية وصيدلية" ? "علبة" : "قطعة"),
            estimatedPrice: item.estimatedPrice || 0,
            notes: item.notes || "",
            dosageOrSpecs: item.dosageOrSpecs || "",
            imageUrl: tinyUrl,
            images: tinyUrl ? [tinyUrl] : [],
            sourceType: "photo",
            isBought: false,
            createdAt: new Date().toISOString()
          };
        })
      );

      const updated = [...newNeeds, ...needs];
      setNeeds(updated);
      syncToFirebase("needs", updated);

      // 2. Resilient background upload of high-res cropped images to Firebase Storage & local IndexedDB
      itemsToAdd.forEach(async (item, idx) => {
        const correspondingNeed = newNeeds[idx];
        const rawCrop = item.croppedImageUrl;
        if (correspondingNeed && rawCrop && rawCrop.startsWith("data:image")) {
          try {
            const uploadedUrl = await uploadImageResiliently("needs", correspondingNeed.id, rawCrop);
            setNeeds(prev => {
              const updatedWithUrl = prev.map(n => n.id === correspondingNeed.id ? {
                ...n,
                imageUrl: uploadedUrl,
                images: [uploadedUrl]
              } : n);
              syncToFirebase("needs", updatedWithUrl);
              return updatedWithUrl;
            });
          } catch (uploadErr) {
            console.warn("Background upload error for need", correspondingNeed.id, uploadErr);
          }
        }
      });

      setScannedReviewItems(null);
      toast.success(`تمت إضافة ${newNeeds.length} مواد بنجاح مع صورها إلى سجل النواقص 🛒!`, {
        description: newNeeds.map(n => n.name).slice(0, 3).join("، ") + (newNeeds.length > 3 ? "..." : "")
      });
    } catch (err) {
      console.error("Save scanned batch error:", err);
      toast.error("حدث خطأ أثناء حفظ المواد");
    } finally {
      setIsSavingScannedBatch(false);
    }
  };

    const handleSaveNeed = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isUploading) return;
    const fd = new FormData(e.currentTarget);
    const isEdit = !!editNeed;
    
    const needName = fd.get("name") as string;
    const neededQty = Number(fd.get("quantity")) || 1;
    const estPrice = Number(fd.get("price")) || 0;
    const unit = fd.get("unit") as string || "قطعة";
    const category = fd.get("category") as string || "سوبر ماركت";
    const dosageOrSpecs = (fd.get("dosageOrSpecs") as string) || "";
    const notes = (fd.get("notes") as string) || "";
    
    let currentNeedImages = [...needImages];
    if (currentNeedImages.length === 0 && editNeed?.images && editNeed.images.length > 0) {
      currentNeedImages = editNeed.images;
    } else if (currentNeedImages.length === 0 && editNeed?.imageUrl) {
      currentNeedImages = [editNeed.imageUrl];
    }

    // Convert any base64 to tiny thumbnails immediately to keep Firestore document well below 1MB
    const lightImages = await Promise.all(
      currentNeedImages.map(img => img.startsWith("data:image") ? compressToTinyThumbnail(img, 320, 0.7) : Promise.resolve(img))
    );
    let uploadedUrl = lightImages[0] || editNeed?.imageUrl || "";

    const source = editNeed?._source || editNeed?.sourceType || (activeTab === "car" ? "car" : activeTab === "travel" ? "travel" : activeTab === "inventory" ? "inventory" : "need");

    if (source === "car") {
      let updated = [...carInventory];
      if (isEdit) {
        updated = updated.map(x => x.id === editNeed!.id ? { ...x, name: needName, neededQuantity: neededQty, estimatedPrice: estPrice, unit, category, notes, imageUrl: uploadedUrl || x.imageUrl, images: lightImages.length > 0 ? lightImages : (x as any).images } : x);
        toast.success("تم التعديل");
      } else {
        const existing = updated.find(i => i.name.trim().toLowerCase() === needName.trim().toLowerCase());
        if (existing) {
          existing.neededQuantity = (existing.neededQuantity || 0) + neededQty;
          existing.estimatedPrice = estPrice;
          if (uploadedUrl) existing.imageUrl = uploadedUrl;
          toast.success("تم التحديث");
        } else {
          updated.push({ id: Date.now().toString(), name: needName, quantity: 0, neededQuantity: neededQty, threshold: 1, unit, estimatedPrice: estPrice, category, notes, imageUrl: uploadedUrl, images: lightImages, createdAt: new Date().toISOString() });
          toast.success("تم إضافة الاحتياج");
        }
      }
      setCarInventory(updated);
      syncToFirebase("carInventory", updated);
    } else if (source === "travel") {
      let updated = [...travelInventory];
      if (isEdit) {
        updated = updated.map(x => x.id === editNeed!.id ? { ...x, name: needName, neededQuantity: neededQty, estimatedPrice: estPrice, unit, category, notes, imageUrl: uploadedUrl || x.imageUrl, images: lightImages.length > 0 ? lightImages : (x as any).images } : x);
        toast.success("تم التعديل");
      } else {
        const existing = updated.find(i => i.name.trim().toLowerCase() === needName.trim().toLowerCase());
        if (existing) {
          existing.neededQuantity = (existing.neededQuantity || 0) + neededQty;
          existing.estimatedPrice = estPrice;
          if (uploadedUrl) existing.imageUrl = uploadedUrl;
          toast.success("تم التحديث");
        } else {
          updated.push({ id: Date.now().toString(), name: needName, quantity: 0, neededQuantity: neededQty, threshold: 1, unit, estimatedPrice: estPrice, category, notes, imageUrl: uploadedUrl, images: lightImages, createdAt: new Date().toISOString() });
          toast.success("تم إضافة الاحتياج");
        }
      }
      setTravelInventory(updated);
      syncToFirebase("travelInventory", updated);
    } else if (source === "inventory") {
      let updated = [...inventory];
      if (isEdit) {
        updated = updated.map(x => x.id === editNeed!.id ? { ...x, name: needName, neededQuantity: neededQty, estimatedPrice: estPrice, unit, category, notes, imageUrl: uploadedUrl || x.imageUrl, images: lightImages.length > 0 ? lightImages : (x as any).images } : x);
        toast.success("تم التعديل");
      } else {
        const existing = updated.find(i => i.name.trim().toLowerCase() === needName.trim().toLowerCase());
        if (existing) {
          existing.neededQuantity = (existing.neededQuantity || 0) + neededQty;
          existing.estimatedPrice = estPrice;
          if (uploadedUrl) existing.imageUrl = uploadedUrl;
          toast.success("تم التحديث في النواقص");
        } else {
          updated.push({ id: Date.now().toString(), name: needName, quantity: 0, neededQuantity: neededQty, threshold: 1, unit, estimatedPrice: estPrice, category, notes, imageUrl: uploadedUrl, images: lightImages, createdAt: new Date().toISOString() });
          toast.success("تم إضافة الاحتياج");
        }
      }
      setInventory(updated);
      syncToFirebase("inventory", updated);
    } else {
      // Direct Need
      let updated = [...needs];
      if (isEdit) {
        updated = updated.map(x => x.id === editNeed!.id ? {
          ...x,
          name: needName,
          quantity: neededQty,
          estimatedPrice: estPrice,
          unit,
          category,
          dosageOrSpecs,
          notes,
          imageUrl: uploadedUrl || x.imageUrl
        } : x);
        toast.success("تم التعديل");
      } else {
        const newNeed: Need = {
          id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
          name: needName,
          quantity: neededQty,
          estimatedPrice: estPrice,
          unit,
          category,
          dosageOrSpecs,
          notes,
          imageUrl: uploadedUrl,
          images: lightImages,
          sourceType: uploadedUrl ? "photo" : "manual",
          isBought: false,
          createdAt: new Date().toISOString()
        };
        updated = [newNeed, ...updated];
        toast.success("تم إضافة الاحتياج بنجاح");
      }
      setNeeds(updated);
      syncToFirebase("needs", updated);
    }
    
    // Background upload of full-res images to Firebase Storage & IndexedDB
    if (currentNeedImages.some(img => img.startsWith("data:image"))) {
      const targetId = isEdit ? editNeed!.id : needName;
      (async () => {
        try {
          const uploadedUrls = await Promise.all(
            currentNeedImages.map((img, idx) => uploadImageResiliently("needs", `${targetId}_${idx}`, img))
          );
          if (source === "need") {
            setNeeds(prev => {
              const updated = prev.map(n => n.id === targetId || (isEdit && n.id === editNeed!.id) ? { ...n, imageUrl: uploadedUrls[0], images: uploadedUrls } : n);
              syncToFirebase("needs", updated);
              return updated;
            });
          }
        } catch (err) {
          console.warn("Background need upload warning:", err);
        }
      })();
    }

    e.currentTarget.reset();
    setShowNeedModal(false);
    setEditNeed(null);
    setNeedNameInput("");
    setNeedImages([]);
    setNeedImageFile(null);
  };

  const handleDeleteUnifiedDeficit = async (item: UnifiedDeficit) => {
    if (!(await customConfirm(`هل أنت متأكد من حذف "${item.name}" من قائمة النواقص؟`))) return;
    
    if (item.sourceType === "need") {
      const updated = needs.filter(x => x.id !== item.originalItem.id);
      setNeeds(updated);
      syncToFirebase("needs", updated);
      toast.success("تم حذف النقص");
    } else if (item.sourceType === "inventory") {
      const updated = inventory.map(x => x.id === item.originalItem.id ? { ...x, neededQuantity: 0 } : x);
      setInventory(updated);
      syncToFirebase("inventory", updated);
      toast.success("تم إزالة الاحتياج من موجودات البيت");
    } else if (item.sourceType === "car") {
      const updated = carInventory.map(x => x.id === item.originalItem.id ? { ...x, neededQuantity: 0 } : x);
      setCarInventory(updated);
      syncToFirebase("carInventory", updated);
      toast.success("تم إزالة الاحتياج من نواقص السيارة");
    } else if (item.sourceType === "travel") {
      const updated = travelInventory.map(x => x.id === item.originalItem.id ? { ...x, neededQuantity: 0 } : x);
      setTravelInventory(updated);
      syncToFirebase("travelInventory", updated);
      toast.success("تم إزالة الاحتياج من نواقص السفر");
    } else if (item.sourceType === "family") {
      const updated = familyNeeds.filter(x => x.id !== item.originalItem.id);
      setFamilyNeeds(updated);
      syncToFirebase("familyNeeds", updated);
      toast.success("تم حذف طلب العائلة");
    }
  };

  const handleUpdateDeficitQty = (item: UnifiedDeficit, delta: number) => {
    if (item.sourceType === "need") {
      const updated = needs.map(x => {
        if (x.id === item.originalItem.id) {
          const newQty = Math.max(1, (x.quantity || 1) + delta);
          return { ...x, quantity: newQty };
        }
        return x;
      });
      setNeeds(updated);
      syncToFirebase("needs", updated);
    } else if (item.sourceType === "inventory") {
      const updated = inventory.map(x => {
        if (x.id === item.originalItem.id) {
          const newQty = Math.max(1, (x.neededQuantity || 1) + delta);
          return { ...x, neededQuantity: newQty };
        }
        return x;
      });
      setInventory(updated);
      syncToFirebase("inventory", updated);
    } else if (item.sourceType === "car") {
      const updated = carInventory.map(x => {
        if (x.id === item.originalItem.id) {
          const newQty = Math.max(1, (x.neededQuantity || 1) + delta);
          return { ...x, neededQuantity: newQty };
        }
        return x;
      });
      setCarInventory(updated);
      syncToFirebase("carInventory", updated);
    } else if (item.sourceType === "travel") {
      const updated = travelInventory.map(x => {
        if (x.id === item.originalItem.id) {
          const newQty = Math.max(1, (x.neededQuantity || 1) + delta);
          return { ...x, neededQuantity: newQty };
        }
        return x;
      });
      setTravelInventory(updated);
      syncToFirebase("travelInventory", updated);
    } else if (item.sourceType === "family") {
      const updated = familyNeeds.map(x => {
        if (x.id === item.originalItem.id) {
          const newQty = Math.max(1, (Number(x.quantity) || 1) + delta);
          return { ...x, quantity: newQty };
        }
        return x;
      });
      setFamilyNeeds(updated);
      syncToFirebase("familyNeeds", updated);
    }
  };

  const handleFulfillUnifiedDeficit = (item: UnifiedDeficit) => {
    if (item.sourceType === "need") {
      setFulfillModal({
        isOpen: true,
        title: item.name,
        category: item.category || "أخرى",
        estimatedPrice: (item.estimatedPrice || 0) * (item.quantity || 1),
        quantity: item.quantity || 1,
        type: "need",
        item: item.originalItem
      });
    } else if (item.sourceType === "family") {
      setFulfillModal({
        isOpen: true,
        title: item.name,
        category: item.category || "عائلة",
        estimatedPrice: (item.estimatedPrice || 0) * (item.quantity || 1),
        quantity: item.quantity || 1,
        member: item.member,
        type: "family",
        item: item.originalItem
      });
    } else {
      setFulfillModal({
        isOpen: true,
        title: item.name,
        category: item.category || "الاحتياجات المنزلية",
        estimatedPrice: (item.estimatedPrice || 0) * (item.quantity || 1),
        quantity: item.quantity || 1,
        type: "shopping",
        item: { ...item.originalItem, _source: item.sourceType }
      });
    }
  };

  const handleDeleteNeed = async (id: string) => {
    if (!(await customConfirm("هل أنت متأكد من الحذف؟"))) return;
    const updated = needs.filter(x => x.id !== id);
    setNeeds(updated);
    syncToFirebase("needs", updated);
  };

  const handleToggleNeedBought = (need: Need) => {
    if (!need.isBought) {
      setFulfillModal({
        isOpen: true,
        title: need.name,
        category: need.category || "أخرى",
        estimatedPrice: need.estimatedPrice || 0,
        quantity: need.quantity || 1,
        type: "need",
        item: need
      });
    } else {
      const updated = needs.map(x => x.id === need.id ? { ...x, isBought: false } : x);
      setNeeds(updated);
      syncToFirebase("needs", updated);
      toast.success("تم إعادة الاحتياج لقائمة النواقص");
    }
  };

  // ──────────────────────────────────────────
  // FAMILY NEEDS HANDLERS
  // ──────────────────────────────────────────
  const handleAddFamilyNeed = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = fd.get("title") as string;
    const category = (fd.get("category") as string) || "عائلة";
    const typeVal = (fd.get("type") as "need" | "duty") || familyNeedType || "need";
    const qty = parseInt(fd.get("quantity") as string) || 1;
    const estimatedPrice = parseFloat(fd.get("estimatedPrice") as string) || 0;
    const priority = (fd.get("priority") as string) || "متوسط";
    const notes = fd.get("notes") as string || "";
    const member = fd.get("member") as string || activeFamilyMember;

    if (!title.trim()) return;

    if (!editFamilyNeed && familyNeeds.some(n => n.member === member && n.title.trim().toLowerCase() === title.trim().toLowerCase() && n.type === typeVal)) {
      toast.error("هذا الطلب/الواجب موجود مسبقاً لهذا الفرد");
      return;
    }

    let updated = [...familyNeeds];
    if (editFamilyNeed) {
      updated = updated.map(n => n.id === editFamilyNeed.id ? {
        ...n,
        title,
        type: typeVal,
        category,
        quantity: qty,
        estimatedPrice,
        priority,
        notes,
        member
      } : n);
      toast.success("تم التعديل بنجاح");
    } else {
      const newItem: FamilyMemberNeed = {
        id: Date.now().toString() + Math.random().toString(),
        member: member,
        title: title,
        type: typeVal,
        category: category,
        quantity: qty,
        estimatedPrice: estimatedPrice,
        priority: priority,
        notes: notes,
        status: "pending",
        createdAt: new Date().toISOString()
      };
      updated = [newItem, ...familyNeeds];
      toast.success(typeVal === "duty" ? "تم إضافة الواجب بنجاح 🎯" : "تم إضافة الطلب بنجاح 🛍️");

      if (typeVal === "duty") {
        addDoc(collection(db, "notifications"), {
          userId: "admin",
          title: `واجب جديد لـ ${member}`,
          message: title,
          type: "duty",
          imageUrl: "",
          read: false,
          link: "/admin/home-finance?tab=family",
          createdAt: serverTimestamp()
        }).catch(err => console.error("Error adding notification:", err));
      } else {
        addDoc(collection(db, "notifications"), {
          userId: "admin",
          title: `طلب جديد لـ ${member}`,
          message: title,
          type: "need",
          imageUrl: "",
          read: false,
          link: "/admin/home-finance?tab=family",
          createdAt: serverTimestamp()
        }).catch(err => console.error("Error adding notification:", err));
      }
    }
    
    setFamilyNeeds(updated);
    syncToFirebase("familyNeeds", updated);
    setShowFamilyNeedModal(false);
    setEditFamilyNeed(null);
  };

  const handleToggleFamilyNeedStatus = (need: FamilyMemberNeed) => {
    if (need.type === "duty") {
      const newStatus = need.status === "pending" ? "available" : "pending";
      const updatedNeeds = familyNeeds.map(n => n.id === need.id ? { ...n, status: newStatus as any } : n);
      setFamilyNeeds(updatedNeeds);
      syncToFirebase("familyNeeds", updatedNeeds);
      toast.success(newStatus === "available" ? "تم إنجاز الواجب بنجاح 🎉" : "تم إعادة فتح الواجب 🔄");
      return;
    }
    if (need.status === "pending") {
      setFulfillModal({
        isOpen: true,
        title: need.title,
        category: need.category || "عائلة",
        member: need.member,
        estimatedPrice: need.estimatedPrice || 0,
        quantity: need.quantity || 1,
        type: "family",
        item: need
      });
    } else {
      const updatedNeeds = familyNeeds.map(n => n.id === need.id ? { ...n, status: "pending" as const } : n);
      setFamilyNeeds(updatedNeeds);
      syncToFirebase("familyNeeds", updatedNeeds);
      toast.success("تم تحويل الطلب إلى نواقص");
    }
  };

  const handleConfirmFulfill = (modal: any, price: number, recordExpense: boolean, purchasedQty: number) => {
    if (modal.type === "family") {
      const updatedNeeds = familyNeeds.map(n => n.id === modal.item.id ? { ...n, status: "available" as const } : n);
      setFamilyNeeds(updatedNeeds);
      syncToFirebase("familyNeeds", updatedNeeds);
    } else if (modal.type === "shopping") {
      const source = modal.item._source;
      if (source === "car") {
        const updated = carInventory.map(x => x.id === modal.item.id ? { ...x, quantity: Number(x.quantity) + purchasedQty, neededQuantity: Math.max(0, (x.neededQuantity || 0) - purchasedQty) } : x);
        setCarInventory(updated);
        syncToFirebase("carInventory", updated);
      } else if (source === "travel") {
        const updated = travelInventory.map(x => x.id === modal.item.id ? { ...x, quantity: Number(x.quantity) + purchasedQty, neededQuantity: Math.max(0, (x.neededQuantity || 0) - purchasedQty) } : x);
        setTravelInventory(updated);
        syncToFirebase("travelInventory", updated);
      } else {
        const updated = inventory.map(x => x.id === modal.item.id ? { ...x, quantity: Number(x.quantity) + purchasedQty, neededQuantity: Math.max(0, (x.neededQuantity || 0) - purchasedQty) } : x);
        setInventory(updated);
        syncToFirebase("inventory", updated);
      }
    } else if (modal.type === "need") {
      const isNowBought = true;
      const updated = needs.map(x => x.id === modal.item.id ? { ...x, isBought: isNowBought } : x);
      setNeeds(updated);
      syncToFirebase("needs", updated);
      
      const existingInv = inventory.find(i => i.name.trim().toLowerCase() === modal.item.name.trim().toLowerCase());
      if (existingInv) {
        const qtyToAdd = modal.quantity || 1;
        const updatedInv = inventory.map(i => i.id === existingInv.id ? { ...i, quantity: Number(i.quantity) + qtyToAdd } : i);
        setInventory(updatedInv);
        syncToFirebase("inventory", updatedInv);
      } else {
        const newInvItem = {
          id: Date.now().toString(),
          name: modal.item.name,
          quantity: modal.quantity || 1,
          threshold: 0,
          unit: modal.item.unit || "قطعة",
          estimatedPrice: price || modal.estimatedPrice || 0,
          category: modal.category || "أخرى",
          createdAt: new Date().toISOString()
        };
        const updatedInv = [newInvItem, ...inventory];
        setInventory(updatedInv);
        syncToFirebase("inventory", updatedInv);
      }
    }

    if (recordExpense && price > 0) {
      const derivedCategory = modal.category 
        || (modal.type === "family" ? "العائلة ومصروف شخصي" 
           : modal.item?._source === "car" ? "السيارة والنقل" 
           : modal.item?._source === "travel" ? "سفر ورحلات" 
           : "أساسيات ومؤونة الطبخ");

      const newExpense: Expense = {
        id: Date.now().toString() + Math.random().toString().slice(2, 6),
        name: modal.type === "family" ? `طلب عائلة (${modal.member}): ${modal.title}` : `شراء: ${modal.title}`,
        category: derivedCategory,
        amount: price,
        date: today(),
        createdAt: new Date().toISOString()
      };
      const updatedExpenses = [newExpense, ...expenses];
      setExpenses(updatedExpenses);
      syncToFirebase("expenses", updatedExpenses);
      toast.success("تم التوفير وتسجيل المبلغ كمصروف بنجاح!");
    } else {
      toast.success("تم التوفير بنجاح!");
    }

    setFulfillModal(null);
  };

  const handleDeleteFamilyNeed = async (id: string) => {
    if (!(await customConfirm("هل أنت متأكد من الحذف؟"))) return;
    showConfirm("تأكيد الحذف", () => {
      const updated = familyNeeds.filter(n => n.id !== id);
      setFamilyNeeds(updated);
      syncToFirebase("familyNeeds", updated);
      toast.success("تم الحذف");
    }, true, "هل أنت متأكد من الحذف؟");
  };

  // ──────────────────────────────────────────
  // DEBT HANDLERS
  // ──────────────────────────────────────────
  const handleSaveDebt = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const isEdit = !!editDebt;
    
    let amount = Number(fd.get("amount"));
    const downPayment = isAdvancedDebt ? Number(fd.get("downPayment")) : 0;
    const monthlyInstallment = Number(fd.get("monthly"));
    const totalMonths = isAdvancedDebt ? Number(fd.get("totalMonths")) : 0;
    const initialPaidMonths = isAdvancedDebt ? Number(fd.get("initialPaidMonths")) : 0;

    if (isAdvancedDebt) {
      amount = downPayment + (monthlyInstallment * totalMonths);
    }
    
    let initialPayments = isEdit ? editDebt!.payments : [];
    
    if (!isEdit && isAdvancedDebt) {
      if (downPayment > 0) {
        initialPayments.push({ date: today(), amount: downPayment, expenseOrIncomeId: "DOWNPAYMENT_" + Date.now() });
      }
      if (initialPaidMonths > 0) {
        initialPayments.push({ date: today(), amount: monthlyInstallment * initialPaidMonths, expenseOrIncomeId: "INITIALPAID_" + Date.now() });
      }
    }

    const recordId = isEdit && editDebt!.associatedRecordId ? editDebt!.associatedRecordId : Date.now().toString();

    const item: Debt = {
      id: isEdit ? editDebt!.id : Date.now().toString(),
      person: fd.get("person") as string,
      type: fd.get("type") as "دين لي" | "دين علي",
      amount: amount || 0,
      date: (fd.get("date") || fd.get("startDate")) as string,
      payments: initialPayments,
      createdAt: isEdit ? editDebt!.createdAt : new Date().toISOString(),
      associatedRecordId: recordId,
    };
    if (monthlyInstallment) item.monthlyInstallment = monthlyInstallment;
    if (totalMonths) item.totalMonths = totalMonths;
    if (initialPaidMonths) item.initialPaidMonths = initialPaidMonths;
    if (downPayment) item.downPayment = downPayment;
    if (isEdit) {
      const updated = debts.map(x => x.id === item.id ? item : x);
      setDebts(updated);
      syncToFirebase("debts", updated);
      toast.success("تم التعديل");

      if (editDebt?.associatedRecordId) {
        if (item.type === "دين علي") {
          const existingInc = incomes.find(i => i.id === editDebt.associatedRecordId);
          if (existingInc) {
            const updatedIncomes = incomes.map(inc => inc.id === editDebt.associatedRecordId ? { ...inc, amount: item.amount, name: `استلام سلفة/دين من: ${item.person}` } : inc);
            setIncomes(updatedIncomes);
            syncToFirebase("incomes", updatedIncomes);
          } else {
            const existingExp = expenses.find(e => e.id === editDebt.associatedRecordId);
            if (existingExp) {
               const updatedExps = expenses.filter(e => e.id !== editDebt.associatedRecordId);
               setExpenses(updatedExps);
               syncToFirebase("expenses", updatedExps);
               const newIncome: Income = { id: editDebt.associatedRecordId, name: `استلام سلفة/دين من: ${item.person}`, amount: item.amount, type: "إضافي", date: item.date, createdAt: new Date().toISOString() };
               const updatedIncomes = [newIncome, ...incomes];
               setIncomes(updatedIncomes);
               syncToFirebase("incomes", updatedIncomes);
            }
          }
        } else {
          const existingExp = expenses.find(e => e.id === editDebt.associatedRecordId);
          if (existingExp) {
            const updatedExps = expenses.map(exp => exp.id === editDebt.associatedRecordId ? { ...exp, amount: item.amount, name: `إعطاء سلفة/دين لـ: ${item.person}` } : exp);
            setExpenses(updatedExps);
            syncToFirebase("expenses", updatedExps);
          } else {
            const existingInc = incomes.find(i => i.id === editDebt.associatedRecordId);
            if (existingInc) {
               const updatedIncomes = incomes.filter(i => i.id !== editDebt.associatedRecordId);
               setIncomes(updatedIncomes);
               syncToFirebase("incomes", updatedIncomes);
               const newExp: Expense = { id: editDebt.associatedRecordId, name: `إعطاء سلفة/دين لـ: ${item.person}`, category: "ديون وأقساط", amount: item.amount, date: item.date, createdAt: new Date().toISOString() };
               const updatedExps = [newExp, ...expenses];
               setExpenses(updatedExps);
               syncToFirebase("expenses", updatedExps);
            }
          }
        }
      } else {
        // Old debt without associated record, upgrade it by creating the record now
        if (item.type === "دين علي") {
          const newIncome: Income = {
            id: recordId,
            name: `استلام سلفة/دين من: ${item.person}`,
            amount: item.amount,
            type: "إضافي",
            date: item.date,
            createdAt: new Date().toISOString(),
          };
          const updatedIncomes = [newIncome, ...incomes];
          setIncomes(updatedIncomes);
          syncToFirebase("incomes", updatedIncomes);
        } else {
          const newExp: Expense = {
            id: recordId,
            name: `إعطاء سلفة/دين لـ: ${item.person}`,
            category: "ديون وأقساط",
            amount: item.amount,
            date: item.date,
            createdAt: new Date().toISOString(),
          };
          const updatedExps = [newExp, ...expenses];
          setExpenses(updatedExps);
          syncToFirebase("expenses", updatedExps);
        }
      }
    } else {
      const updated = [item, ...debts];
      setDebts(updated);
      syncToFirebase("debts", updated);
      toast.success("تم إضافة الدين");

      // التأثير على الرصيد الصافي للديون الجديدة (سلفة نقداً)
      if (item.type === "دين علي") {
        // استلمت سلفة -> دخل
        const income: Income = {
          id: recordId,
          name: `استلام سلفة/دين من: ${item.person}`,
          amount: item.amount,
          type: "إضافي",
          date: item.date,
          createdAt: new Date().toISOString(),
        };
        const updatedIncomes = [income, ...incomes];
        setIncomes(updatedIncomes);
        syncToFirebase("incomes", updatedIncomes);
      } else {
        // أعطيت سلفة -> مصروف
        const expense: Expense = {
          id: recordId,
          name: `إعطاء سلفة/دين لـ: ${item.person}`,
          category: "ديون وأقساط",
          amount: item.amount,
          date: item.date,
          createdAt: new Date().toISOString(),
        };
        const updatedExpenses = [expense, ...expenses];
        setExpenses(updatedExpenses);
        syncToFirebase("expenses", updatedExpenses);
      }
    }
    e.currentTarget.reset();
    setDebtNameInput("");
    setShowDebtModal(false);
    setEditDebt(null);
};

  const handleDeleteDebt = async (id: string) => {
    if (!(await customConfirm("هل أنت متأكد من الحذف؟"))) return;
    const debtToDelete = debts.find(x => x.id === id);
    const updated = debts.filter(x => x.id !== id);
    setDebts(updated);
    syncToFirebase("debts", updated);

    if (debtToDelete?.associatedRecordId) {
      if (debtToDelete.type === "دين علي") {
        const updatedIncomes = incomes.filter(i => i.id !== debtToDelete.associatedRecordId);
        setIncomes(updatedIncomes);
        syncToFirebase("incomes", updatedIncomes);
      } else {
        const updatedExps = expenses.filter(e => e.id !== debtToDelete.associatedRecordId);
        setExpenses(updatedExps);
        syncToFirebase("expenses", updatedExps);
      }
    }
  };

  const handlePayDebt = (debt: Debt, forceDirection?: "دين علي" | "دين لي") => {
    const isDirectionChosen = !!forceDirection;
    const direction = forceDirection || debt.type;
    const isOwedToMe = direction === "دين لي";

    const paidOnMe = debt.payments
      .filter(p => p.type === "دين علي" || (!p.type && debt.type === "دين علي"))
      .reduce((s, p) => s + p.amount, 0);

    const paidForMe = debt.payments
      .filter(p => p.type === "دين لي" || (!p.type && debt.type === "دين لي"))
      .reduce((s, p) => s + p.amount, 0);

    const netRemaining = debt.type === "دين علي"
      ? (debt.amount - paidOnMe) + paidForMe
      : (debt.amount - paidForMe) + paidOnMe;
    
    if (debt.id === "virtual-cake-debt") {
      const isOwedByMe = debt.type === "دين علي";
      const remainingCake = Math.max(0, (debt.amount - paidOnMe) + paidForMe);
      const promptTitle = isOwedByMe 
        ? "تسديد وإرجاع دين الكيك (دفع من الراتب للكيك)"
        : "تسديد جزء من دين الكيك (قبض من أموال الكيك للراتب)";

      showPrompt(promptTitle, async (amountStr) => {
        const actualAmount = Number(amountStr);
        if (isNaN(actualAmount) || actualAmount <= 0) { toast.error("مبلغ غير صحيح"); return; }
        if (actualAmount > remainingCake) { toast.error("لا يمكن تسجيل مبلغ أكبر من المتبقي"); return; }

        try {
          if (isOwedByMe) {
            // دفع وإرجاع للكيك: يزيد دين الراتب نحو الصفر (لأنه سالب) ويدخل أموال لصندوق الكيك
            await addDoc(collection(db, "expenses"), {
              amount: actualAmount,
              category: "تسديد دين",
              description: `إرجاع وتسديد أموال للكيك (من إدارة المنزل)`,
              month: new Date().getMonth() + 1,
              createdAt: serverTimestamp(),
              isDebt: true
            });

            await addDoc(collection(db, "expenses"), {
              amount: -actualAmount,
              category: "تسديد دين",
              description: `استلام تسديد من الراتب لأموال الكيك (إدارة المنزل)`,
              month: new Date().getMonth() + 1,
              createdAt: serverTimestamp(),
              isDebt: false
            });
          } else {
            // Exactly like finances/page.tsx: سداد من الكيك للراتب
            await addDoc(collection(db, "expenses"), {
              amount: -actualAmount,
              category: "تسديد دين",
              description: `تسديد جزء من الدين المستحق (تحويل من إدارة المنزل)`,
              month: new Date().getMonth() + 1,
              createdAt: serverTimestamp(),
              isDebt: true
            });

            await addDoc(collection(db, "expenses"), {
              amount: actualAmount,
              category: "تسديد دين",
              description: `تسديد جزء من الدين المستحق (من إدارة المنزل)`,
              month: new Date().getMonth() + 1,
              createdAt: serverTimestamp(),
              isDebt: false
            });
          }

          toast.success(isOwedByMe ? "تم تسديد وإرجاع المبلغ للكيك بنجاح ✅" : "تم تسديد جزء من دين الكيك بنجاح ✅");
        } catch (e) {
          toast.error("حدث خطأ أثناء التسديد");
        }
      }, remainingCake > 0 ? remainingCake.toString() : "", "المبلغ المطلوب تسديده");
      return;
    }
    
    // إذا كان ديناً متقدماً (بنظام الأقساط)، وبدون تحديد جهة يدوية، يتم سداد القسط الشهري تلقائياً
    if (debt.monthlyInstallment && debt.totalMonths && !isDirectionChosen) {
      const remainingInstallment = Math.max(0, (debt.amount - paidOnMe) + paidForMe);
      const paymentAmount = Math.min(debt.monthlyInstallment, Math.max(remainingInstallment, 0));
      const recordId = Date.now().toString();
      
      if (isOwedToMe) {
        const income: Income = {
          id: recordId,
          name: `تسديد قسط دين من: ${debt.person}`,
          amount: paymentAmount,
          type: "إضافي",
          date: today(),
          createdAt: new Date().toISOString(),
        };
        const updatedIncomes = [income, ...incomes];
        setIncomes(updatedIncomes);
        syncToFirebase("incomes", updatedIncomes);
      } else {
        const expense: Expense = {
          id: recordId,
          name: `تسديد قسط دين لـ: ${debt.person}`,
          category: "ديون وأقساط",
          amount: paymentAmount,
          date: today(),
          createdAt: new Date().toISOString(),
        };
        const updatedExpenses = [expense, ...expenses];
        setExpenses(updatedExpenses);
        syncToFirebase("expenses", updatedExpenses);
      }
      
      const payment = { date: new Date().toISOString(), amount: paymentAmount, type: direction, expenseOrIncomeId: recordId };
      const updatedDebts = debts.map(x => x.id === debt.id ? {
        ...x,
        payments: [...x.payments, payment]
      } : x);
      setDebts(updatedDebts);
      syncToFirebase("debts", updatedDebts);
      toast.success(`تم سداد قسط ${debt.person} بنجاح`);
      return;
    }

    const isPayingOwedDebt = direction === "دين علي" && debt.type === "دين علي";
    const isCollectingDebt = direction === "دين لي" && debt.type === "دين لي";
    const isBorrowingMore = direction === "دين لي" && debt.type === "دين علي";

    const promptTitle = isPayingOwedDebt
      ? `تسديد دين عليّ (دفع لـ: ${debt.person})`
      : isCollectingDebt
      ? `قبض تسديد دين لي (استلام من: ${debt.person})`
      : isBorrowingMore
      ? `قبض / اقتراض إضافي من: ${debt.person} (زيادة ديني له)`
      : `دفع / إقراض إضافي لـ: ${debt.person} (زيادة ديني عليه)`;

    const promptMsg = isPayingOwedDebt
      ? `أدخل المبلغ الذي دفعته لـ ${debt.person} (المتبقي بذمتك له: ${fmt(netRemaining)} د.ع):`
      : isCollectingDebt
      ? `أدخل المبلغ الذي قبضته من ${debt.person} (المتبقي بذمته لك: ${fmt(netRemaining)} د.ع):`
      : isBorrowingMore
      ? `أدخل المبلغ الذي اقترضته إضافياً من ${debt.person} (يزيد ديني له):`
      : `أدخل المبلغ الذي أقرضته إضافياً لـ ${debt.person} (يزيد ديني عليه):`;

    let defaultVal = "";
    if (isPayingOwedDebt || isCollectingDebt) {
      if (netRemaining > 0) defaultVal = netRemaining.toString();
    }

    showPrompt(promptTitle, (amountStr) => {
      const actualAmount = Number(amountStr);
      if (isNaN(actualAmount) || actualAmount <= 0) { toast.error("مبلغ غير صحيح"); return; }

      const recordId = Date.now().toString();
      
      // إذا كان "دين لي" (استرجاع أموال أو سداد لي) -> يضاف للدخل
      if (isOwedToMe) {
        const income: Income = {
          id: recordId,
          name: `تسديد دين من: ${debt.person}`,
          amount: actualAmount,
          type: "إضافي",
          date: today(),
          createdAt: new Date().toISOString(),
        };
        const updatedIncomes = [income, ...incomes];
        setIncomes(updatedIncomes);
        syncToFirebase("incomes", updatedIncomes);
      } else {
        // إذا كان "دين عليّ" (دفعت أنا ديناً) -> يسجل كمصروف
        const expense: Expense = {
          id: recordId,
          name: `تسديد دين لـ: ${debt.person}`,
          category: "ديون وأقساط",
          amount: actualAmount,
          date: today(),
          createdAt: new Date().toISOString(),
        };
        const updatedExpenses = [expense, ...expenses];
        setExpenses(updatedExpenses);
        syncToFirebase("expenses", updatedExpenses);
      }
      
      const payment = { date: new Date().toISOString(), amount: actualAmount, type: direction, expenseOrIncomeId: recordId };
      const updatedDebts = debts.map(x => x.id === debt.id ? {
        ...x,
        payments: [...x.payments, payment]
      } : x);
      setDebts(updatedDebts);
      syncToFirebase("debts", updatedDebts);
      toast.success(isOwedToMe ? `تم تسجيل استلام دين من ${debt.person} (دخل بالميزانية)` : `تم تسجيل دفع دين لـ ${debt.person} (مصروف بالميزانية)`);
    }, defaultVal, "أدخل المبلغ...", promptMsg);
  };

  const handleSaveTrip = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = fd.get("name") as string;
    const destination = tripModalDestination;
    const currency = fd.get("currency") as string;
    
    if (!name || !destination || tripModalMembers.length === 0) {
      toast.error("يرجى تعبئة جميع الحقول وإضافة الأصدقاء");
      return;
    }

    const members = tripModalMembers;

    if (editTrip) {
      const updated = travelTrips.map(t => t.id === editTrip.id ? { ...t, name, destination, members, currency } : t);
      setTravelTrips(updated);
      syncToFirebase("travelTrips", updated);
      toast.success("تم التعديل بنجاح");
      if (selectedTrip?.id === editTrip.id) {
          setSelectedTrip(updated.find(t => t.id === editTrip.id) || null);
      }
    } else {
      const newTrip: TravelTrip = {
        id: Date.now().toString(),
        name,
        destination,
        members,
        currency,
        status: "active",
        createdAt: new Date().toISOString(),
      };
      const updated = [newTrip, ...travelTrips];
      setTravelTrips(updated);
      syncToFirebase("travelTrips", updated);
      toast.success("تم إنشاء الرحلة بنجاح");
    }
    setShowTripModal(false);
setEditTrip(null);
  };

  const handleDeleteTrip = async (id: string) => {
    if (!(await customConfirm("هل أنت متأكد من الحذف؟"))) return;
    showConfirm("حذف رحلة السفر", () => {
      const updatedTrips = travelTrips.filter(t => t.id !== id);
      setTravelTrips(updatedTrips);
      syncToFirebase("travelTrips", updatedTrips);
      
      // Delete related expenses
      const updatedExpenses = travelExpenses.filter(e => e.tripId !== id);
      setTravelExpenses(updatedExpenses);
      syncToFirebase("travelExpenses", updatedExpenses);
      toast.success("تم الحذف بنجاح");
    }, true, "هل أنت متأكد من حذف هذه الرحلة وكل مصاريفها؟");
    
    if (selectedTrip?.id === id) setSelectedTrip(null);
    toast.success("تم حذف الرحلة");
  };

  const handleSaveTripExpense = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedTrip) return;
    
    const fd = new FormData(e.currentTarget);
    const description = fd.get("description") as string;
    const amount = Number(fd.get("amount"));
    const currency = fd.get("currency") as string || selectedTrip.currency || "د.ع";
    const paidBy = fd.get("paidBy") as string;
    
    const splitBetween: string[] = [];
    selectedTrip.members.forEach(m => {
      if (fd.get(`split_${m}`) === "on") splitBetween.push(m);
    });

    if (!description || !amount || !paidBy || splitBetween.length === 0) {
      toast.error("الرجاء التحقق من المدخلات والمبلغ والمشاركين");
      return;
    }

    const expense: TravelExpense = {
      id: Date.now().toString(),
      tripId: selectedTrip.id,
      description,
      amount,
      currency,
      paidBy,
      splitBetween,
      date: today(),
      createdAt: new Date().toISOString(),
    };
    
    const updated = [expense, ...travelExpenses];
    setTravelExpenses(updated);
    syncToFirebase("travelExpenses", updated);

    // Sync to main expenses under "سفر ورحلات"
    if (currency === "د.ع" || !currency) {
      const linkedHomeExp: Expense = {
        id: `travel_${expense.id}`,
        name: `سفرة (${selectedTrip.name || selectedTrip.destination}): ${description}`,
        category: "سفر ورحلات",
        amount,
        date: today(),
        createdAt: new Date().toISOString(),
      };
      const updatedHomeExpenses = [linkedHomeExp, ...expenses];
      setExpenses(updatedHomeExpenses);
      syncToFirebase("expenses", updatedHomeExpenses);
    }

    toast.success("تم تسجيل المصروف ومزامنته في المصاريف");
    setShowTripExpenseModal(false);
  };

  const handleDeleteTripExpense = async (id: string) => {
    if (!(await customConfirm("هل أنت متأكد من الحذف؟"))) return;
    showConfirm("حذف مصروف الرحلة", () => {
      const updated = travelExpenses.filter(e => e.id !== id);
      setTravelExpenses(updated);
      syncToFirebase("travelExpenses", updated);

      const linkedId = `travel_${id}`;
      const updatedHome = expenses.filter(e => e.id !== linkedId);
      if (updatedHome.length !== expenses.length) {
        setExpenses(updatedHome);
        syncToFirebase("expenses", updatedHome);
      }

      toast.success("تم الحذف بنجاح");
    }, true, "تأكيد حذف المصروف؟");
  };

  const handleCloneTripExpense = (expense: TravelExpense) => {
    const clonedExpense = {
      ...expense,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };
    const updated = [clonedExpense, ...travelExpenses];
    setTravelExpenses(updated);
    syncToFirebase("travelExpenses", updated);
    toast.success("تم استنساخ المصروف بنجاح");
  };

  const handleUndoDebtPayment = (debt: Debt) => {
    if (debt.payments.length === 0) return;
    const lastPayment = debt.payments[debt.payments.length - 1];
    
    if (lastPayment.expenseOrIncomeId) {
      const pType = lastPayment.type || debt.type;
      if (pType === "دين لي") {
        const updatedIncomes = incomes.filter(e => e.id !== lastPayment.expenseOrIncomeId);
        setIncomes(updatedIncomes);
        syncToFirebase("incomes", updatedIncomes);
      } else {
        const updatedExpenses = expenses.filter(e => e.id !== lastPayment.expenseOrIncomeId);
        setExpenses(updatedExpenses);
        syncToFirebase("expenses", updatedExpenses);
      }
    }
    
    const updatedDebts = debts.map(x => x.id === debt.id ? { 
      ...x, 
      payments: x.payments.slice(0, -1) 
    } : x);
    setDebts(updatedDebts);
    syncToFirebase("debts", updatedDebts);
    toast.success("تم التراجع عن الدفعة");
  };

  // ══════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════

  // Compute badge counts for tabs
  const totalShortages = unifiedDeficits.length;
  const unpaidBillsCount = bills.filter(b => !isBillPaidThisCycle(b)).length;
  const delayedInstallmentsCount = installments.filter(i => isInstallmentOwedThisCycle(i)).length;
  const unsettledDebtsCount = effectiveDebts.filter(d => {
    const paidOnMe = d.payments.filter(p => p.type === "دين علي" || (!p.type && d.type === "دين علي")).reduce((s, p) => s + p.amount, 0);
    const paidForMe = d.payments.filter(p => p.type === "دين لي" || (!p.type && d.type === "دين لي")).reduce((s, p) => s + p.amount, 0);
    const net = d.type === "دين علي" ? (d.amount - paidOnMe) + paidForMe : (d.amount - paidForMe) + paidOnMe;
    return net > 0;
  }).length;

  // ──────────────────────────────────────────
  // SMART FINANCIAL SENTINEL & DEBT FORECASTING ENGINE
  // ──────────────────────────────────────────
  const smartFinancialIntelligence = useMemo(() => {
    // 1. All Debts On Me (cash debts)
    const myDebtsList = effectiveDebts
      .filter(d => d.type === "دين علي")
      .map(d => {
        const paidOnMe = d.payments.filter(p => p.type === "دين علي" || (!p.type && d.type === "دين علي")).reduce((ps, p) => ps + (Number(p.amount) || 0), 0);
        const paidForMe = d.payments.filter(p => p.type === "دين لي" || (!p.type && d.type === "دين لي")).reduce((ps, p) => ps + (Number(p.amount) || 0), 0);
        const remaining = Math.max(0, (Number(d.amount) || 0) - paidOnMe + paidForMe);
        return {
          id: d.id,
          name: d.person,
          total: Number(d.amount) || 0,
          paid: paidOnMe,
          remaining,
          type: "debt" as const,
        };
      })
      .filter(d => d.remaining > 0);

    // 2. Active Installments
    const myInstallmentsList = installments
      .filter(i => (Number(i.remainingAmount) || 0) > 0)
      .map(i => ({
        id: i.id,
        name: i.name,
        total: Number(i.totalAmount) || 0,
        paid: (Number(i.totalAmount) || 0) - (Number(i.remainingAmount) || 0),
        remaining: Number(i.remainingAmount) || 0,
        monthly: Number(i.monthlyInstallment) || 0,
        type: "installment" as const,
      }));

    const totalRemainingDebtsOnMe = myDebtsList.reduce((s, d) => s + d.remaining, 0);
    const totalRemainingInstallments = myInstallmentsList.reduce((s, i) => s + i.remaining, 0);
    const totalCombinedDebtBurden = totalRemainingDebtsOnMe + totalRemainingInstallments;

    // Snowball Target Debt (smallest remaining first for fastest psychological win & freed cashflow)
    const allDebtsCombined = [...myDebtsList, ...myInstallmentsList].sort((a, b) => a.remaining - b.remaining);
    const nextTargetToCrush = allDebtsCombined[0] || null;

    // Debt freedom projection calculations
    const monthlyInstallmentObligation = myInstallmentsList.reduce((s, i) => s + i.monthly, 0);
    const effectiveMonthlyDebtPaymentRate = Math.max(monthlyInstallmentObligation, 50000);
    const monthsToFreedomBase = totalCombinedDebtBurden > 0 
      ? Math.max(1, Math.ceil(totalCombinedDebtBurden / effectiveMonthlyDebtPaymentRate))
      : 0;

    const simulatedRate = effectiveMonthlyDebtPaymentRate + simulatedExtraSavings;
    const monthsToFreedomSimulated = totalCombinedDebtBurden > 0
      ? Math.max(1, Math.ceil(totalCombinedDebtBurden / simulatedRate))
      : 0;

    const monthsSaved = Math.max(0, monthsToFreedomBase - monthsToFreedomSimulated);

    const projectedFreedomDate = new Date();
    projectedFreedomDate.setMonth(projectedFreedomDate.getMonth() + monthsToFreedomBase);

    // 3. Cycle timeline & daily burn rate
    const now = new Date();
    const cycleStart = selectedCycle?.start ? new Date(selectedCycle.start) : new Date();
    const cycleEnd = selectedCycle?.end ? new Date(selectedCycle.end) : new Date(now.getFullYear(), now.getMonth() + 1, 10);
    
    const diffTime = Math.max(0, now.getTime() - cycleStart.getTime());
    const daysElapsed = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    const totalCycleDays = Math.max(1, Math.ceil(Math.max(1, cycleEnd.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24)));
    const daysRemaining = Math.max(1, totalCycleDays - daysElapsed);

    const dailyBurnRate = Math.round(totalExpensesAmt / daysElapsed);
    const safeDailySpendingLimit = Math.max(0, Math.round(Math.max(0, balance) / daysRemaining));
    const projectedTotalMonthlyExpenses = dailyBurnRate * totalCycleDays;
    const projectedDeficitOrSurplus = totalIncome - (projectedTotalMonthlyExpenses + totalBillsAmt + totalInstallmentMonthly);

    // 4. Spending Leaks & "الابتعاد عن شنو"
    const currentCycleExpenses = allExpenses.filter(e => isInCycle(e.date));
    const categoryTotals: Record<string, number> = {};
    let smallBuysAmount = 0;
    let smallBuysCount = 0;

    currentCycleExpenses.forEach(e => {
      const cat = e.category || "أخرى";
      categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(e.amount) || 0);
      if ((Number(e.amount) || 0) <= 10000 && (Number(e.amount) || 0) > 0) {
        smallBuysAmount += Number(e.amount);
        smallBuysCount += 1;
      }
    });

    const rankedCategories = Object.entries(categoryTotals)
      .map(([category, amount]) => ({
        category,
        amount,
        percent: totalExpensesAmt > 0 ? Math.round((amount / totalExpensesAmt) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const topDrainCategory = rankedCategories[0] || null;

    // 5. Household Pulse & Deficiency Radar
    const medicineShortages = unifiedDeficits.filter(d => d.isMedicine);
    const groceryShortages = unifiedDeficits.filter(d => d.sourceType === "inventory");
    const carShortages = unifiedDeficits.filter(d => d.sourceType === "car");
    const familyShortages = unifiedDeficits.filter(d => d.sourceType === "family");

    // 6. Composite Financial Health Score (0-100)
    let healthScore = 80;
    if (balance < 0) healthScore -= 30;
    else if (balance < 100000) healthScore -= 10;
    if (dailyBurnRate > safeDailySpendingLimit && safeDailySpendingLimit > 0) healthScore -= 15;
    if (unpaidBillsCount > 0) healthScore -= Math.min(20, unpaidBillsCount * 5);
    if (totalCombinedDebtBurden > 5000000) healthScore -= 15;
    else if (totalCombinedDebtBurden > 1000000) healthScore -= 5;
    if (medicineShortages.length > 0) healthScore -= 10;
    healthScore = Math.max(10, Math.min(100, healthScore));

    return {
      totalRemainingDebtsOnMe,
      totalRemainingInstallments,
      totalCombinedDebtBurden,
      nextTargetToCrush,
      effectiveMonthlyDebtPaymentRate,
      monthsToFreedomBase,
      monthsToFreedomSimulated,
      monthsSaved,
      projectedFreedomDate,
      daysElapsed,
      totalCycleDays,
      daysRemaining,
      dailyBurnRate,
      safeDailySpendingLimit,
      projectedDeficitOrSurplus,
      rankedCategories,
      topDrainCategory,
      smallBuysAmount,
      smallBuysCount,
      medicineShortages,
      groceryShortages,
      carShortages,
      familyShortages,
      healthScore,
    };
  }, [
    effectiveDebts,
    installments,
    simulatedExtraSavings,
    selectedCycle,
    totalExpensesAmt,
    balance,
    totalIncome,
    totalBillsAmt,
    totalInstallmentMonthly,
    allExpenses,
    isInCycle,
    unifiedDeficits,
    unpaidBillsCount,
  ]);

  const tabs = [
    { key: "overview",      label: "نظرة عامة",          emoji: "🏠", icon: BarChart3, badge: 0 },
    { key: "income",        label: "الدخل",               emoji: "💵", icon: PiggyBank, badge: 0, amount: balance, isBalance: true },
    { key: "expenses",      label: "المصاريف",            emoji: "💸", icon: Wallet, badge: 0, amount: totalExpensesAmt },
    { key: "needs",         label: "النواقص",             emoji: "🛒", icon: ShoppingCart, badge: totalShortages },
    { key: "inventory",     label: "موجودات البيت",       emoji: "📦", icon: Package, badge: inventory.length },
    { key: "bills",         label: "الفواتير",            emoji: "🧾", icon: Receipt, badge: unpaidBillsCount },
    { key: "installments",  label: "الأقساط والسلف",      emoji: "💳", icon: CreditCard, badge: delayedInstallmentsCount },
    { key: "debts",         label: "الديون",              emoji: "🏦", icon: Banknote, badge: unsettledDebtsCount },
    { key: "familyNeeds",   label: "العائلة",             emoji: "👨‍👩‍👧‍👦", icon: Users, badge: familyNeeds.filter(n => n.status === "pending" && n.type !== "duty").length },
    { key: "car",           label: "السيارة",             emoji: "🚗", icon: Car, badge: carInventory.length },
    { key: "travel",        label: "السفر",               emoji: "✈️", icon: Plane, badge: travelInventory.length },
    { key: "futurePlans",   label: "الخطط المستقبلية",   emoji: "🎯", icon: Target, badge: futurePlans.length },
  ] as any;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0D0A1A] pb-44 font-sans text-right" dir="rtl">

      {/* ═══════════════ SMART MODALS ═══════════════ */}
      {confirmConfig?.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmConfig(null)} />
          <div className="relative bg-white dark:bg-[#1A1525] rounded-3xl p-6 w-full max-w-sm border border-gray-100 dark:border-white/10 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-black text-gray-800 dark:text-white mb-2 flex items-center gap-2">
              <AlertCircle className={`w-6 h-6 ${confirmConfig.isDestructive ? 'text-red-500' : 'text-purple-500'}`} />
              {confirmConfig.title}
            </h3>
            {confirmConfig.message && <p className="text-sm text-gray-500 dark:text-gray-300 mb-6">{confirmConfig.message}</p>}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setConfirmConfig(null)}
                className="flex-1 py-3 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-white rounded-xl font-bold transition cursor-pointer"
              >
                {confirmConfig.cancelText || "لا"}
              </button>
              <button
                onClick={() => {
                  confirmConfig.onConfirm();
                  setConfirmConfig(null);
                }}
                className={`flex-1 py-3 text-white rounded-xl font-bold shadow-lg transition cursor-pointer ${
                  confirmConfig.isDestructive 
                    ? "bg-gradient-to-r from-red-600 to-rose-500 hover:opacity-90"
                    : "bg-gradient-to-r from-purple-600 to-indigo-500 hover:opacity-90"
                }`}
              >
                {confirmConfig.confirmText || "نعم"}
              </button>
            </div>
          </div>
        </div>
      )}

      {promptConfig?.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPromptConfig(null)} />
          <div className="relative bg-white dark:bg-[#1A1525] rounded-3xl p-6 w-full max-w-sm border border-gray-100 dark:border-white/10 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-black text-gray-800 dark:text-white mb-2">{promptConfig.title}</h3>
            {promptConfig.message && <p className="text-sm text-gray-500 dark:text-gray-300 mb-4">{promptConfig.message}</p>}
            <input
              type="text"
              autoFocus
              value={promptInputValue}
              onChange={(e) => setPromptInputValue(e.target.value)}
              placeholder={promptConfig.placeholder || "أدخل القيمة..."}
              className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-800 dark:text-white font-bold outline-none focus:border-purple-500 transition mb-6"
              onKeyDown={(e) => {
                if (e.key === "Enter" && promptInputValue.trim()) {
                  promptConfig.onConfirm(promptInputValue);
                  setPromptConfig(null);
                }
              }}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setPromptConfig(null)}
                className="flex-1 py-3 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-white rounded-xl font-bold transition"
              >
                إلغاء
              </button>
              <button
                onClick={() => {
                  if (!promptInputValue.trim()) return;
                  promptConfig.onConfirm(promptInputValue);
                  setPromptConfig(null);
                }}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90 text-white rounded-xl font-bold shadow-lg transition"
              >
                موافق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ MODERN LUXURY HEADER ═══════════════ */}
      <div className="relative bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 dark:from-black dark:via-[#130726] dark:to-[#080d1e] pt-14 pb-6 px-4 sm:px-6 overflow-hidden shadow-xl border-b border-white/10 transition-colors">
        {/* Glow Blobs */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/20 blur-[110px] rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-500/15 blur-[90px] rounded-full translate-y-1/2 -translate-x-1/4 pointer-events-none" />

        {/* Back + Brand Header */}
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-3.5">
            <Link 
              href="/admin" 
              prefetch={true}
              onClick={(e) => {
                if (typeof window !== 'undefined' && window.history.length > 1) {
                  e.preventDefault();
                  window.history.back();
                }
              }}
              className="w-10 h-10 bg-white/10 dark:bg-white/5 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20 hover:bg-white/20 transition shrink-0 active:scale-95 text-white shadow-sm"
              title="رجوع للوحة التحكم"
            >
              <ArrowRight className="w-5 h-5 text-white" />
            </Link>
            
            <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-lg border-2 border-white/80 shrink-0 bg-white/95 p-1 flex items-center justify-center ring-4 ring-white/10">
              <img src="/cp-logo.png" alt="كيك الأميرة" className="w-full h-full object-contain" />
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="bg-gradient-to-r from-pink-500/25 to-purple-500/25 text-pink-200 border border-pink-400/30 px-3 py-0.5 rounded-full text-[11px] font-black shadow-xs flex items-center gap-1.5 backdrop-blur-md">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>🏡 منزل حيدر وإيمان</span>
                </span>
                <span className="text-purple-300/80 text-[11px] font-bold">
                  {new Date().toLocaleDateString("ar-IQ", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                إدارة ميزانية ومصاريف المنزل
              </h1>
            </div>
          </div>

          {/* Quick Header Navigation Badges */}
          <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
            <button
              type="button"
              onClick={() => {
                setActiveTab("familyNeeds");
                setActiveFamilyMember("إيمان");
                setShowWomenHealthSection(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-pink-500/30 to-rose-500/30 border border-pink-400/40 hover:border-pink-300 text-pink-200 text-xs font-black backdrop-blur-md transition active:scale-95 flex items-center gap-1.5 shadow-sm cursor-pointer hover:bg-pink-500/40"
            >
              <Flower2 className="w-3.5 h-3.5 text-pink-400 animate-spin-slow" />
              <span>صحة العائلة 🌸</span>
            </button>

            <button
              type="button"
              onClick={() => setShowExpenseModal(true)}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white text-xs font-black shadow-md shadow-rose-500/30 active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>تسجيل مصروف 💸</span>
            </button>
          </div>
        </div>

        {/* Reminder Banner for 11th & 21st */}
        {(new Date().getDate() === 11 || new Date().getDate() === 21) && (
          <div className="relative z-10 bg-rose-600/90 backdrop-blur-md border border-rose-400/80 rounded-2xl p-3.5 text-center mt-3 shadow-lg shadow-rose-500/20 animate-pulse">
            <div className="flex justify-center items-center gap-2 mb-1">
              <AlertCircle className="w-5 h-5 text-white" />
              <span className="text-white font-black text-sm">تذكير تسديد الالتزامات 🗓️</span>
            </div>
            <p className="text-rose-100 font-bold text-xs">
              اليوم هو {new Date().getDate()} في الشهر. يرجى التأكد من تسديد الديون والأقساط المطلوبة لهذا الشهر.
            </p>
          </div>
        )}
      </div>

      {/* ═══════════════ TOP MAIN BALANCE & HEALTH SECTION (ABOVE OVERVIEW TABS) ═══════════════ */}
      <div className="px-3 sm:px-5 pt-4">
        {/* Main Balance Card with Health Score */}
        <div className="bg-gradient-to-br from-indigo-50/90 via-purple-50/80 to-pink-50/80 dark:from-indigo-500/20 dark:via-purple-500/20 dark:to-pink-500/20 backdrop-blur-xl rounded-[2rem] p-5 sm:p-6 border border-purple-200/60 dark:border-white/20 shadow-md dark:shadow-2xl relative overflow-hidden group mb-3">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <div className="p-2 bg-white dark:bg-white/10 rounded-xl shadow-sm backdrop-blur-md">
                  <Wallet className="w-5 h-5 text-purple-600 dark:text-purple-200" />
                </div>
                <span className="text-purple-900 dark:text-purple-100 text-sm font-black tracking-wide">الرصيد الصافي للشهر</span>
                
                {/* Financial Health Score Pill */}
                <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border ${
                  smartFinancialIntelligence.healthScore >= 80 
                    ? "bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-500/20 dark:border-emerald-400/50 dark:text-emerald-300"
                    : smartFinancialIntelligence.healthScore >= 50
                      ? "bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-500/20 dark:border-amber-400/50 dark:text-amber-300"
                      : "bg-rose-100 border-rose-300 text-rose-800 dark:bg-rose-500/20 dark:border-rose-400/50 dark:text-rose-300 animate-pulse"
                }`}>
                  نبض الميزانية: {smartFinancialIntelligence.healthScore}/100
                </span>
              </div>

              <div className={`text-4xl md:text-5xl font-black tracking-tight ${balance < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-300"}`}>
                {dataLoading ? (
                  <span className="opacity-40 animate-pulse text-2xl md:text-3xl">جاري الحساب...</span>
                ) : (
                  <>
                    {fmt(balance)} <span className="text-xl md:text-2xl font-bold text-slate-500 dark:text-white/50">د.ع</span>
                  </>
                )}
              </div>
            </div>
            
            <div className="flex flex-col gap-2 w-full md:w-auto">
              {dataLoading ? (
                <div className="flex items-center gap-2 bg-white/80 dark:bg-white/10 backdrop-blur-md rounded-2xl px-4 py-2.5 border border-slate-200 dark:border-white/20">
                  <span className="text-slate-600 dark:text-white/70 text-xs font-black animate-pulse">جاري فحص الميزانية والالتزامات...</span>
                </div>
              ) : balance < 0 ? (
                <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-500/20 backdrop-blur-md rounded-2xl px-4 py-2.5 border border-rose-200 dark:border-rose-500/40">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span className="text-rose-800 dark:text-rose-200 text-xs font-black">تجاوزت الميزانية المحددة لهذا الشهر!</span>
                </div>
              ) : balance >= unpaidObligations ? (
                <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/20 backdrop-blur-md rounded-2xl px-4 py-2.5 border border-emerald-200 dark:border-emerald-500/40">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="text-emerald-800 dark:text-emerald-200 text-xs font-black">الرصيد يغطي جميع الالتزامات بنجاح</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-500/20 backdrop-blur-md rounded-2xl px-4 py-2.5 border border-amber-200 dark:border-amber-500/40">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-300 shrink-0" />
                  <span className="text-amber-800 dark:text-amber-200 text-xs font-black">الرصيد لا يكفي لكل الالتزامات المعلقة</span>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* ═══════════════ TABS AS APP ICONS ═══════════════ */}
      <div className="pt-4 px-2 sm:px-4">
        <div className="grid grid-cols-4 md:grid-cols-6 gap-x-2 gap-y-5 justify-items-center pb-2">
          {tabs.map((t: any) => {
            const isActive = activeTab === t.key;
            const hasBadge = (t.badge || 0) > 0;
            
            const getTabColors = (key: string) => {
              switch(key) {
                case "overview":      return { grad: "from-blue-600 via-indigo-600 to-violet-700",   shadow: "shadow-indigo-500/35",   ring: "ring-indigo-400",   bg: "bg-indigo-500/10 dark:bg-indigo-500/20",   text: "text-indigo-600 dark:text-indigo-400" };
                case "income":        return { grad: "from-emerald-500 via-green-500 to-teal-600", shadow: "shadow-emerald-500/35",ring: "ring-emerald-400",bg: "bg-emerald-500/10 dark:bg-emerald-500/20",text: "text-emerald-600 dark:text-emerald-400" };
                case "expenses":      return { grad: "from-rose-500 via-pink-600 to-red-600",       shadow: "shadow-rose-500/35",   ring: "ring-rose-400",   bg: "bg-rose-500/10 dark:bg-rose-500/20",   text: "text-rose-600 dark:text-rose-400" };
                case "needs":         return { grad: "from-amber-500 via-orange-500 to-rose-600",   shadow: "shadow-amber-500/35", ring: "ring-amber-400", bg: "bg-amber-500/10 dark:bg-amber-500/20", text: "text-amber-600 dark:text-amber-400" };
                case "inventory":     return { grad: "from-teal-500 via-cyan-600 to-blue-600",   shadow: "shadow-teal-500/35",   ring: "ring-teal-400",   bg: "bg-teal-500/10 dark:bg-teal-500/20",   text: "text-teal-600 dark:text-teal-400" };
                case "bills":         return { grad: "from-amber-400 via-yellow-500 to-orange-500",  shadow: "shadow-yellow-500/35",  ring: "ring-yellow-400",  bg: "bg-amber-500/10 dark:bg-amber-500/20",  text: "text-amber-600 dark:text-amber-400" };
                case "installments":  return { grad: "from-purple-600 via-indigo-600 to-violet-700",  shadow: "shadow-purple-500/35", ring: "ring-purple-400", bg: "bg-purple-500/10 dark:bg-purple-500/20", text: "text-purple-600 dark:text-purple-400" };
                case "debts":         return { grad: "from-fuchsia-600 via-purple-600 to-pink-600", shadow: "shadow-fuchsia-500/35", ring: "ring-fuchsia-400", bg: "bg-fuchsia-500/10 dark:bg-fuchsia-500/20", text: "text-fuchsia-600 dark:text-fuchsia-400" };
                case "familyNeeds":   return { grad: "from-pink-500 via-rose-500 to-purple-600",      shadow: "shadow-pink-500/35",   ring: "ring-pink-400",   bg: "bg-pink-500/10 dark:bg-pink-500/20",   text: "text-pink-600 dark:text-pink-400" };
                case "car":           return { grad: "from-slate-700 via-gray-800 to-zinc-950",      shadow: "shadow-slate-500/35",  ring: "ring-slate-400",  bg: "bg-slate-500/10 dark:bg-slate-500/20",  text: "text-slate-600 dark:text-slate-400" };
                case "travel":        return { grad: "from-sky-500 via-blue-500 to-indigo-600",        shadow: "shadow-sky-500/35",    ring: "ring-sky-400",    bg: "bg-sky-500/10 dark:bg-sky-500/20",    text: "text-sky-600 dark:text-sky-400" };
                case "futurePlans":   return { grad: "from-violet-600 via-purple-700 to-indigo-800",   shadow: "shadow-violet-500/35", ring: "ring-violet-400", bg: "bg-violet-500/10 dark:bg-violet-500/20", text: "text-violet-600 dark:text-violet-400" };
                default:             return { grad: "from-gray-500 to-gray-600",       shadow: "shadow-gray-500/35",   ring: "ring-gray-400",   bg: "bg-gray-500/10",                        text: "text-gray-600" };
              }
            };

            const colors = getTabColors(t.key);
            const TabIcon = t.icon;

            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className="relative flex flex-col items-center gap-1.5 group outline-none w-full max-w-[82px] cursor-pointer"
              >
                {/* Icon Box */}
                <div className={`relative flex items-center justify-center w-[58px] h-[58px] sm:w-[64px] sm:h-[64px] rounded-[1.3rem] sm:rounded-[1.4rem] transition-all duration-300 ${
                  isActive 
                    ? `bg-gradient-to-br ${colors.grad} text-white scale-110 z-10 shadow-lg ${colors.shadow} ring-2 ring-offset-2 ring-offset-[#f3f4f6] dark:ring-offset-[#09090b] ${colors.ring}` 
                    : `${colors.bg} border border-white/40 dark:border-zinc-800/80 ${colors.text} shadow-xs group-hover:scale-105 group-hover:shadow-md`
                }`}>
                  {/* Hero Lucide Icon or Emoji */}
                  {TabIcon ? (
                    <TabIcon className={`w-6 h-6 sm:w-6.5 sm:h-6.5 transition-all duration-300 ${
                      isActive ? 'stroke-[2.4] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)] scale-105' : 'stroke-[2.1]'
                    }`} />
                  ) : (
                    <span className="text-2xl select-none">{t.emoji}</span>
                  )}

                  {/* Micro Emoji Badge */}
                  <span className={`absolute -bottom-1 -left-1 text-[11px] select-none filter transition-transform duration-300 ${
                    isActive ? 'scale-110' : 'opacity-85'
                  }`}>
                    {t.emoji}
                  </span>
                  
                  {/* Badge */}
                  {!dataLoading && ( (t.badge || 0) > 0 || (t.amount !== undefined && (t.isBalance || t.amount > 0)) ) && (
                    <span className={`absolute -top-2 -right-2 min-w-[22px] h-[22px] rounded-full text-[9px] sm:text-[10px] font-black flex items-center justify-center px-1.5 shadow-sm border-[1.5px] transition-all duration-300 ${
                      isActive 
                        ? "bg-white text-gray-900 border-transparent dark:bg-zinc-900 dark:text-white dark:border-zinc-700" 
                        : t.isBalance
                          ? (t.amount >= 0 ? "bg-emerald-600 text-white border-white dark:border-zinc-900" : "bg-black text-white border-white dark:border-zinc-900")
                          : "bg-rose-500 text-white border-white dark:border-zinc-900"
                    }`}>
                      {t.amount !== undefined 
                        ? (Math.abs(t.amount) >= 1000000 ? (t.amount / 1000000).toFixed(1) + 'M' : Math.abs(t.amount) >= 1000 ? (t.amount / 1000).toFixed(0) + 'K' : t.amount)
                        : (t.badge! > 99 ? '99+' : t.badge)}
                    </span>
                  )}
                </div>

                {/* Text Label */}
                <span className={`text-[10px] sm:text-[11px] transition-all duration-300 max-w-[70px] text-center leading-tight flex flex-col items-center gap-0.5 ${
                  isActive 
                    ? `font-black ${colors.text} translate-y-0.5` 
                    : "font-bold text-gray-500 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200"
                }`}>
                  <span>{t.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 mt-4 space-y-4">
        
        {/* STATS BANNER (المتوفر والنواقص في كل صفحة) */}
        {(() => {
          if (activeTab === "overview" || activeTab === "futurePlans" || activeTab === "familyNeeds") return null;

          let availCard = { title: "المتوفر", count: 0, countLabel: "عنصر/قطعة", value: 0, color: "emerald", icon: "✨" };
          let shortCard = { title: "النواقص", count: 0, countLabel: "ناقص/معلق", value: 0, color: "orange", icon: "⚠️" };

          if (activeTab === "inventory") {
            const availQty = inventory.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
            const availVal = inventory.reduce((s, i) => s + ((Number(i.quantity) || 0) * (Number(i.estimatedPrice) || 0)), 0);
            const shortQty = inventory.reduce((s, i) => s + (Number(i.neededQuantity) || 0), 0);
            const shortVal = inventory.filter(i => (i.neededQuantity || 0) > 0).reduce((s, i) => s + ((Number(i.neededQuantity) || 1) * (Number(i.estimatedPrice) || 0)), 0);
            availCard = { title: "المتوفر في موجودات البيت", count: availQty, countLabel: "قطعة", value: availVal, color: "emerald", icon: "📦" };
            shortCard = { title: "نواقص البيت", count: shortQty, countLabel: "قطعة ناقصة", value: shortVal, color: "orange", icon: "⚠️" };
          } else if (activeTab === "car") {
            const availQty = carInventory.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
            const availVal = carInventory.reduce((s, i) => s + ((Number(i.quantity) || 0) * (Number(i.estimatedPrice) || 0)), 0);
            const shortQty = carInventory.reduce((s, i) => s + (Number(i.neededQuantity) || 0), 0);
            const shortVal = carInventory.filter(i => (i.neededQuantity || 0) > 0).reduce((s, i) => s + ((Number(i.neededQuantity) || 1) * (Number(i.estimatedPrice) || 0)), 0);
            availCard = { title: "جاهز للسيارة", count: availQty, countLabel: "عنصر", value: availVal, color: "emerald", icon: "🚗" };
            shortCard = { title: "نواقص السيارة", count: shortQty, countLabel: "ناقص", value: shortVal, color: "orange", icon: "🔧" };
          } else if (activeTab === "travel") {
            const availQty = travelInventory.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
            const availVal = travelInventory.reduce((s, i) => s + ((Number(i.quantity) || 0) * (Number(i.estimatedPrice) || 0)), 0);
            const shortQty = travelInventory.reduce((s, i) => s + (Number(i.neededQuantity) || 0), 0);
            const shortVal = travelInventory.filter(i => (i.neededQuantity || 0) > 0).reduce((s, i) => s + ((Number(i.neededQuantity) || 1) * (Number(i.estimatedPrice) || 0)), 0);
            availCard = { title: "جاهز للسفر", count: availQty, countLabel: "مستلزم", value: availVal, color: "emerald", icon: "✈️" };
            shortCard = { title: "نواقص السفر", count: shortQty, countLabel: "ناقص", value: shortVal, color: "orange", icon: "🎒" };

          } else if (activeTab === "needs") {
            const totalAvailQty = inventory.reduce((s, i) => s + (Number(i.quantity) || 0), 0) + carInventory.reduce((s, i) => s + (Number(i.quantity) || 0), 0) + travelInventory.reduce((s, i) => s + (Number(i.quantity) || 0), 0) + familyNeeds.filter(n => n.status === "available").length;
            const totalShortQty = unifiedDeficits.reduce((s, i) => s + (Number(i.quantity) || 1), 0);
            const totalAvailVal = inventory.reduce((s, i) => s + ((Number(i.quantity) || 0) * (Number(i.estimatedPrice) || 0)), 0) + carInventory.reduce((s, i) => s + ((Number(i.quantity) || 0) * (Number(i.estimatedPrice) || 0)), 0) + travelInventory.reduce((s, i) => s + ((Number(i.quantity) || 0) * (Number(i.estimatedPrice) || 0)), 0);
            availCard = { title: "إجمالي المتوفر (منزل وعائلة)", count: totalAvailQty, countLabel: "عنصر متوفر", value: totalAvailVal, color: "emerald", icon: "📦" };
            shortCard = { title: "إجمالي النواقص والاحتياجات", count: totalShortQty, countLabel: "طلب/عنصر ناقص", value: totalNeedsAmt, color: "orange", icon: "🚨" };
          } else if (activeTab === "debts") {
            const myDebtsCount = effectiveDebts.filter(d => d.type === "دين لي").length;
            const onMeDebtsCount = effectiveDebts.filter(d => d.type === "دين علي").length;
            availCard = { title: "ديون لي (عند الناس)", count: myDebtsCount, countLabel: "دين", value: totalDebtsForMe, color: "emerald", icon: "📈" };
            shortCard = { title: "ديون علي (مطلوبة مني)", count: onMeDebtsCount, countLabel: "دين", value: totalDebtsOnMe, color: "orange", icon: "📉" };
          } else if (activeTab === "expenses") {
            const currentExps = allExpenses.filter(e => isInCycle(e.date));
            const totalExpVal = currentExps.reduce((s, e) => s + e.amount, 0);
            availCard = { title: "المتبقي من الميزانية", count: balance >= 0 ? 1 : 0, countLabel: balance >= 0 ? "فائض" : "عجز", value: balance, color: balance >= 0 ? "emerald" : "orange", icon: "💰" };
            shortCard = { title: "مصاريف الدورة الحالية", count: currentExps.length, countLabel: "مصروف", value: totalExpVal, color: "orange", icon: "💸" };
          } else if (activeTab === "income") {
            const currentIncomes = incomes.filter(i => isInCycle(i.date));
            const totalIncVal = currentIncomes.reduce((s, i) => s + i.amount, 0);
            availCard = { title: "دخل الدورة الحالية", count: currentIncomes.length, countLabel: "مصدر دخل", value: totalIncVal, color: "emerald", icon: "💵" };
            shortCard = { title: "الميزانية المتاحة للصرف", count: 1, countLabel: "رصيد", value: balance, color: "emerald", icon: "🏦" };
          } else if (activeTab === "installments") {
            const activeInst = installments.filter(i => i.remainingAmount > 0);
            const totalRemaining = activeInst.reduce((s, i) => s + i.remainingAmount, 0);
            const monthlyTotal = activeInst.reduce((s, i) => s + i.monthlyInstallment, 0);
            availCard = { title: "الأقساط النشطة", count: activeInst.length, countLabel: "قسط نشط", value: totalRemaining, color: "orange", icon: "💳" };
            shortCard = { title: "إجمالي القسط الشهري", count: activeInst.length, countLabel: "شهرياً", value: monthlyTotal, color: "orange", icon: "📅" };
          } else if (activeTab === "bills") {
            const unpaidCount = bills.filter(b => !isBillPaidThisCycle(b)).length;
            availCard = { title: "الفواتير المدفوعة هذا الشهر", count: bills.length - unpaidCount, countLabel: "فاتورة", value: bills.filter(b => isBillPaidThisCycle(b)).reduce((s, b) => s + b.amount, 0), color: "emerald", icon: "✅" };
            shortCard = { title: "الفواتير المتبقية للدفع", count: unpaidCount, countLabel: "غير مدفوع", value: unpaidBillsAmt, color: "orange", icon: "🧾" };
          } else {
            return null;
          }

          return (
            <div className="grid grid-cols-2 gap-3">
              {/* Card 1: المتوفر / الإيجابي */}
              <div className="bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40 dark:from-emerald-950/80 dark:via-zinc-900 dark:to-zinc-900 border border-emerald-200 dark:border-emerald-500/30 rounded-3xl p-3 sm:p-4 text-slate-900 dark:text-white shadow-sm dark:shadow-lg relative overflow-hidden flex flex-col justify-between transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-black text-emerald-800 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-300/60 dark:border-emerald-500/30 flex items-center gap-1.5">
                    <span>{availCard.icon}</span>
                    <span>{availCard.title}</span>
                  </span>
                  <div className="text-left">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">{dataLoading ? <span className="opacity-40 animate-pulse text-lg">...</span> : availCard.count}</span>
                    <span className="text-[10px] text-slate-500 dark:text-gray-400 block font-bold">{availCard.countLabel}</span>
                  </div>
                </div>
                {availCard.value !== 0 ? (
                  <div className="mt-3 pt-2 border-t border-emerald-200/60 dark:border-emerald-500/10 flex justify-between items-baseline">
                    <span className="text-[11px] font-bold text-slate-600 dark:text-gray-400">القيمة التقديرية / الرصيد:</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">{dataLoading ? <span className="opacity-40 animate-pulse text-sm">...</span> : fmt(availCard.value)}</span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">د.ع</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 pt-2 border-t border-emerald-200/60 dark:border-emerald-500/10 flex justify-between items-baseline">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-gray-500">الحالة:</span>
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">محدث أولاً بأول</span>
                  </div>
                )}
              </div>

              {/* Card 2: النواقص / المطلوب */}
              <div className="bg-gradient-to-br from-rose-50 via-white to-red-50/40 dark:from-red-950/80 dark:via-zinc-900 dark:to-zinc-900 border border-red-200 dark:border-red-500/30 rounded-3xl p-3 sm:p-4 text-slate-900 dark:text-white shadow-sm dark:shadow-lg relative overflow-hidden flex flex-col justify-between transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-black text-rose-800 dark:text-red-400 bg-rose-100/80 dark:bg-red-500/10 px-3 py-1 rounded-full border border-rose-300/60 dark:border-red-500/30 flex items-center gap-1.5">
                    <span>{shortCard.icon}</span>
                    <span>{shortCard.title}</span>
                  </span>
                  <div className="text-left">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">{dataLoading ? <span className="opacity-40 animate-pulse text-lg">...</span> : shortCard.count}</span>
                    <span className="text-[10px] text-slate-500 dark:text-gray-400 block font-bold">{shortCard.countLabel}</span>
                  </div>
                </div>
                {shortCard.value !== 0 ? (
                  <div className="mt-3 pt-2 border-t border-red-200/60 dark:border-red-500/10 flex justify-between items-baseline">
                    <span className="text-[11px] font-bold text-slate-600 dark:text-gray-400">التكلفة / المطلوب:</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-black text-rose-700 dark:text-red-300">{dataLoading ? <span className="opacity-40 animate-pulse text-sm">...</span> : fmt(shortCard.value)}</span>
                      <span className="text-[10px] text-rose-600 dark:text-red-400 font-bold">د.ع</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 pt-2 border-t border-red-200/60 dark:border-red-500/10 flex justify-between items-baseline">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-gray-500">الحالة:</span>
                    <span className="text-xs font-bold text-emerald-700 dark:text-green-400">لا توجد نواقص معلقة 🎉</span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ═══════════════ OVERVIEW TAB: SMART FINANCIAL COMMAND CENTER ═══════════════ */}
        {activeTab === "overview" && (
          <div className="flex flex-col gap-5 animate-in fade-in duration-300">

            {/* Financial Cycle & Health Hero Section */}
            <div className="order-1 relative bg-gradient-to-br from-white via-indigo-50/40 to-purple-50/50 dark:from-[#120324] dark:via-[#240b4a] dark:to-[#0a2540] rounded-[2.2rem] p-5 sm:p-6 shadow-xl dark:shadow-2xl border border-slate-200/80 dark:border-white/10 overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/10 dark:bg-purple-500/15 rounded-full blur-[100px] pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-500/10 dark:bg-cyan-500/15 rounded-full blur-[100px] pointer-events-none" />
              {/* Cycle Selector Bar */}
              <div className="relative z-10 mb-3.5 bg-white/90 dark:bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-purple-100 dark:border-white/20 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-start">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-300" />
                    <h3 className="font-black text-slate-800 dark:text-white text-xs sm:text-sm">الدورة المالية:</h3>
                  </div>
                  <select
                    value={selectedCycleId}
                    onChange={(e) => setSelectedCycleId(e.target.value)}
                    className="bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/20 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-purple-500 py-1.5 px-3 outline-none"
                  >
                    {cycles.map(c => (
                      <option key={c.id} value={c.id} className="text-black">{c.label}</option>
                    ))}
                  </select>
                </div>
                
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm("هل أنت متأكد من إنهاء الدورة المالية الحالية يدوياً وبدء دورة جديدة؟ هذا سيؤدي إلى نقل الميزانية المتبقية إلى الدورة الجديدة.")) return;
                    
                    const todayStr = today();
                    const currentManualStarts = settings?.manualCycleStarts || [];
                    if (currentManualStarts.includes(todayStr)) {
                      toast.error("لقد قمت بإنهاء الدورة مسبقاً اليوم!");
                      return;
                    }
                    const newCycleStarts = [...currentManualStarts, todayStr];
                    setSettings({ ...settings, manualCycleStarts: newCycleStarts });
                    syncToFirebase("settings", { ...settings, manualCycleStarts: newCycleStarts });
                    
                    const d = new Date(todayStr);
                    const newId = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getDate()}`;
                    setTimeout(() => setSelectedCycleId(newId), 50);
                  }}
                  className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-3.5 py-1.5 text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>إنهاء الدورة يدوياً</span>
                </button>
              </div>

              {/* Helper Alert if user is on new cycle */}
              {(expenses.length > 0 || incomes.length > 0) && totalExpensesAmt === 0 && totalIncome === 0 && selectedCycleId === cycles[0]?.id && (
                <div className="relative z-10 bg-indigo-50 dark:bg-indigo-500/20 backdrop-blur-md border border-indigo-200 dark:border-indigo-400/50 rounded-2xl p-4 text-center mb-3.5 shadow-sm dark:shadow-lg animate-pulse">
                  <div className="flex justify-center items-center gap-2 mb-1">
                    <span className="text-indigo-950 dark:text-indigo-100 font-black text-sm">مرحباً! لقد بدأت دورة مالية جديدة فارغة 🗓️</span>
                  </div>
                  <p className="text-indigo-800/80 dark:text-indigo-200/80 font-bold text-xs mt-1">
                    أنت الآن في دورة شهرية جديدة. لرؤية مصاريفك وإدخالاتك السابقة، قم بتغيير الدورة المالية من القائمة المنسدلة في الأعلى (اختر الدورة السابقة).
                  </p>
                </div>
              )}

              {/* 4 KPI Top Cards */}
              <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 mb-4">
                <div className="bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 backdrop-blur-md rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-white/10 transition-colors flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-emerald-700 dark:text-emerald-200 text-xs font-bold">الدخل الكلي</span>
                    <div className="p-1.5 bg-emerald-100 dark:bg-emerald-500/20 rounded-lg"><TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /></div>
                  </div>
                  <div className="text-base sm:text-xl font-black text-slate-900 dark:text-white">{dataLoading ? <span className="opacity-40 animate-pulse text-sm">...</span> : fmt(totalIncome)} <span className="text-[10px] text-slate-500 dark:text-gray-400">د.ع</span></div>
                </div>

                <div className="bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 backdrop-blur-md rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-white/10 transition-colors flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-rose-700 dark:text-rose-200 text-xs font-bold">المصاريف الكلية</span>
                    <div className="p-1.5 bg-rose-100 dark:bg-rose-500/20 rounded-lg"><TrendingDown className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" /></div>
                  </div>
                  <div className="text-base sm:text-xl font-black text-slate-900 dark:text-white">{dataLoading ? <span className="opacity-40 animate-pulse text-sm">...</span> : fmt(totalExpensesAmt)} <span className="text-[10px] text-slate-500 dark:text-gray-400">د.ع</span></div>
                </div>

                <div className="bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 backdrop-blur-md rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-white/10 transition-colors flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-indigo-700 dark:text-indigo-200 text-xs font-bold">الأقساط الشهرية</span>
                    <div className="p-1.5 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg"><CreditCard className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /></div>
                  </div>
                  <div className="text-base sm:text-xl font-black text-slate-900 dark:text-white">{dataLoading ? <span className="opacity-40 animate-pulse text-sm">...</span> : fmt(totalInstallmentMonthly)} <span className="text-[10px] text-slate-500 dark:text-gray-400">د.ع</span></div>
                </div>

                <div className="bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 backdrop-blur-md rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-white/10 transition-colors flex flex-col justify-between shadow-sm">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-amber-700 dark:text-amber-200 text-xs font-bold">الفواتير الثابتة</span>
                    <div className="p-1.5 bg-amber-100 dark:bg-amber-500/20 rounded-lg"><Receipt className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /></div>
                  </div>
                  <div className="text-base sm:text-xl font-black text-slate-900 dark:text-white">{dataLoading ? <span className="opacity-40 animate-pulse text-sm">...</span> : fmt(totalBillsAmt)} <span className="text-[10px] text-slate-500 dark:text-gray-400">د.ع</span></div>
                </div>
              </div>
            </div>
            {/* TOTAL REMAINING DEBTS: installments/loans + cash debts */}
            <div className="order-4 bg-white dark:bg-zinc-900 rounded-[2rem] p-5 border border-slate-200/80 dark:border-white/10 shadow-lg space-y-3">
              <h3 className="text-slate-900 dark:text-white font-black flex items-center gap-2 text-sm md:text-base border-b border-slate-100 dark:border-white/10 pb-3">
                <Banknote className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                المتبقي من الديون والالتزامات
              </h3>
              <button type="button" onClick={() => setActiveTab("installments")} className="w-full flex justify-between items-center bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition p-3.5 rounded-2xl border border-slate-200/60 dark:border-white/5 active:scale-[0.99]">
                <span className="text-slate-600 dark:text-gray-300 text-xs font-bold flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-100 dark:bg-indigo-500/10 rounded-lg"><CreditCard className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /></div>
                  متبقي الأقساط والسلف
                </span>
                <span className="text-slate-900 dark:text-white font-black text-sm">{fmt(smartFinancialIntelligence.totalRemainingInstallments)} <span className="text-[10px] text-slate-400">د.ع</span></span>
              </button>
              <button type="button" onClick={() => setActiveTab("debts")} className="w-full flex justify-between items-center bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition p-3.5 rounded-2xl border border-slate-200/60 dark:border-white/5 active:scale-[0.99]">
                <span className="text-slate-600 dark:text-gray-300 text-xs font-bold flex items-center gap-2">
                  <div className="p-1.5 bg-rose-100 dark:bg-rose-500/10 rounded-lg"><Banknote className="w-4 h-4 text-rose-600 dark:text-rose-400" /></div>
                  متبقي الديون عليك
                </span>
                <span className="text-slate-900 dark:text-white font-black text-sm">{fmt(smartFinancialIntelligence.totalRemainingDebtsOnMe)} <span className="text-[10px] text-slate-400">د.ع</span></span>
              </button>
              <div className="flex justify-between items-center bg-rose-50 dark:bg-rose-500/10 rounded-2xl px-4 py-3.5 border border-rose-200/70 dark:border-rose-500/20">
                <span className="text-rose-800 dark:text-rose-200 font-black text-sm flex items-center gap-2">
                  <Target className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                  المطلوب الكلي:
                </span>
                <span className="text-xl font-black text-rose-600 dark:text-white">
                  {fmt(smartFinancialIntelligence.totalRemainingInstallments + smartFinancialIntelligence.totalRemainingDebtsOnMe)} <span className="text-xs text-rose-500 dark:text-rose-300">د.ع</span>
                </span>
              </div>
            </div>

            {/* Family Competition Overview */}
            <div className="order-5">
              <FamilyCompetitionOverview onClick={() => setActiveTab("familyNeeds")} />
            </div>

            {/* Urgent Alerts Banner */}
            {(unpaidBillsCount > 0 || delayedInstallmentsCount > 0 || totalShortages > 0) && (
              <div className="order-2 bg-gradient-to-br from-rose-500 to-orange-500 rounded-3xl p-5 shadow-[0_8px_30px_rgb(244,63,94,0.3)] space-y-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />
                <div className="flex items-center gap-2 mb-2 relative z-10">
                  <AlertCircle className="w-6 h-6 text-white animate-pulse" />
                  <span className="text-white font-black text-lg drop-shadow-md">تنبيهات عاجلة</span>
                </div>
                {unpaidBillsCount > 0 && (
                  <button onClick={() => setActiveTab("bills")} className="relative z-10 w-full flex items-center justify-between bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 rounded-xl px-4 py-3 text-white text-sm font-bold transition shadow-sm">
                    <span className="flex items-center gap-2"><Receipt className="w-4 h-4"/> {unpaidBillsCount} فاتورة غير مدفوعة ({fmt(unpaidBillsAmt)} د.ع)</span>
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
                {delayedInstallmentsCount > 0 && (
                  <button onClick={() => setActiveTab("installments")} className="relative z-10 w-full flex items-center justify-between bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 rounded-xl px-4 py-3 text-white text-sm font-bold transition shadow-sm">
                    <span className="flex items-center gap-2"><CreditCard className="w-4 h-4"/> {delayedInstallmentsCount} أقساط مطلوبة الدفع</span>
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
                {totalShortages > 0 && (
                  <button onClick={() => setShowNeedModal(true)} className="relative z-10 w-full flex items-center justify-between bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 rounded-xl px-4 py-3 text-white text-sm font-bold transition shadow-sm">
                    <span className="flex items-center gap-2"><ShoppingCart className="w-4 h-4"/> {totalShortages} نواقص واحتياجات معلقة</span>
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ INCOME TAB ═══════════════ */}
        {activeTab === "income" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-black text-gray-800 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                سجل الدخل
              </h2>
              <button onClick={() => setShowIncomeModal(true)}
                className="bg-emerald-500 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 shadow-lg shadow-emerald-500/25 active:scale-95 transition">
                <Plus className="w-3.5 h-3.5" /> إضافة
              </button>
            </div>

            {incomes.filter(i => isInCycle(i.date)).length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 text-center border border-gray-100 dark:border-zinc-800">
                <span className="text-5xl block mb-3">💵</span>
                <p className="text-gray-400 font-bold text-sm">لا يوجد دخل مسجل</p>
                <button onClick={() => setShowIncomeModal(true)}
                  className="mt-3 text-emerald-500 text-xs font-black hover:underline">+ أضف دخلك الأول</button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {[...incomes.filter(i => isInCycle(i.date))].sort((a, b) => b.date.localeCompare(a.date)).map(inc => {
                  const incTypeEmoji = inc.type === "راتب" ? "💼" : inc.type === "حافز" ? "🏆" : "💡";
                  return (
                    <div key={inc.id} className="bg-gradient-to-br from-emerald-500/10 to-green-500/5 dark:from-emerald-900/30 dark:to-green-900/10 rounded-2xl p-4 border border-emerald-200 dark:border-emerald-800/40 shadow-sm flex flex-col gap-2 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-green-500 opacity-60 rounded-t-2xl" />
                      {/* Top Row: emoji + actions */}
                      <div className="flex items-start justify-between">
                        <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                          {incTypeEmoji}
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => { setEditIncome(inc); setShowIncomeModal(true); }} className="p-1.5 bg-white/70 dark:bg-zinc-800/70 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition">
                            <Edit2 className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                          </button>
                          <button onClick={() => handleDeleteIncome(inc.id)} className="p-1.5 bg-white/70 dark:bg-zinc-800/70 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition">
                            <Trash2 className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                          </button>
                        </div>
                      </div>
                      {/* Name */}
                      <div className="font-black text-gray-800 dark:text-gray-100 text-sm leading-tight line-clamp-2">{inc.name}</div>
                      {/* Amount */}
                      <div className="font-black text-emerald-600 dark:text-emerald-400 text-base">+{fmt(inc.amount)} <span className="text-[10px] font-bold text-emerald-500/70">د.ع</span></div>
                      {/* Footer */}
                      <div className="flex items-center gap-1.5 flex-wrap mt-auto">
                        <span className="text-[9px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold">{inc.type}</span>
                        <span className="text-[9px] text-gray-400">{new Date(inc.date).toLocaleDateString("ar-IQ")}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ EXPENSES TAB ═══════════════ */}
        {activeTab === "expenses" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-black text-gray-800 dark:text-white flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-rose-500" />
                سجل المصاريف
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                <button 
                  onClick={() => setShowWasteStudyModal(true)}
                  className="bg-gradient-to-r from-rose-500 via-amber-500 to-orange-500 text-white text-xs font-black px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-amber-500/20 hover:opacity-95 active:scale-95 transition"
                  title="دراسة وتحليل التبذير والتسالي داخل القوائم ومحاكي التوفير"
                >
                  <BrainCircuit className="w-3.5 h-3.5 text-amber-200" />
                  <span>دراسة التبذير والترشيد 🧠</span>
                </button>
                <button 
                  onClick={() => setShowLottoTrackerModal(true)}
                  className="bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 text-white text-xs font-black px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-purple-500/20 hover:opacity-95 active:scale-95 transition"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>مركز اللوتو</span>
                </button>
                <button onClick={() => setShowProductSearchModal(true)}
                  className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 active:scale-95 transition">
                  <Activity className="w-3.5 h-3.5" /> البحث عن منتج
                </button>
                <button 
                  onClick={() => {
                    setEditExpense(null);
                    setExpNameInput("");
                    setExpCategoryInput("");
                    setExpDateInput(today());
                    setExpenseItems([]);
                    setAttachedReceiptImages([]);
                    setExpBeneficiary("عام للبيت");
                    setShowExpenseModal(true);
                  }}
                  className="bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 shadow-lg shadow-rose-500/25 active:scale-95 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> إضافة
                </button>
              </div>
            </div>

            {/* Smart Financial Insights Bar (Pre-calculated in useMemo for 60FPS mobile speed) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-2xl bg-gradient-to-r from-rose-500/5 via-amber-500/5 to-indigo-500/5 border border-rose-100 dark:border-zinc-800">
              <div className="bg-white/80 dark:bg-zinc-900/80 p-2.5 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-2xs">
                <span className="text-[10px] font-bold text-gray-400 block">إجمالي صرف الدورة</span>
                <span className="text-sm sm:text-base font-black text-gray-900 dark:text-white">
                  {fmt(smartFinancialInsights.cycleSpendTotal)} <span className="text-[9px] text-gray-400">د.ع</span>
                </span>
              </div>

              <div className="bg-white/80 dark:bg-zinc-900/80 p-2.5 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-2xs">
                <span className="text-[10px] font-bold text-gray-400 block">معدل الصرف اليومي</span>
                <span className="text-sm sm:text-base font-black text-rose-600 dark:text-rose-400">
                  {fmt(smartFinancialInsights.dailyAvg)} <span className="text-[9px] text-gray-400">د.ع / يوم</span>
                </span>
              </div>

              <div className="bg-white/80 dark:bg-zinc-900/80 p-2.5 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-2xs">
                <span className="text-[10px] font-bold text-gray-400 block">أعلى قسم صرفاً</span>
                <span className="text-xs sm:text-sm font-black text-indigo-600 dark:text-indigo-400 truncate block">
                  {smartFinancialInsights.topCatIcon} {smartFinancialInsights.topCatName} ({fmt(smartFinancialInsights.topCatTotal)} د.ع)
                </span>
              </div>

              <div 
                onClick={() => setShowWasteStudyModal(true)}
                className="bg-white/80 dark:bg-zinc-900/80 p-2.5 rounded-xl border border-amber-200/70 dark:border-amber-900/40 shadow-2xs cursor-pointer hover:border-amber-400 transition"
              >
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center justify-between">
                  <span>تسالي وتبذير 🍭</span>
                  <span className="text-[9px] font-black underline">تفاصيل ↗</span>
                </span>
                <span className="text-sm sm:text-base font-black text-amber-600 dark:text-amber-400">
                  {fmt(smartFinancialInsights.cycleDiscSpend)} <span className="text-[9px] text-gray-400">د.ع ({smartFinancialInsights.discRatio}%)</span>
                </span>
              </div>
            </div>

            {/* Budget Limits Progress Cards */}
            {settings.budgetLimits && Object.entries(settings.budgetLimits).length > 0 && (
              <div className="relative z-10 bg-white dark:bg-zinc-900 rounded-[1.5rem] p-4 border border-gray-100 dark:border-zinc-800 shadow-sm mb-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-purple-500" />
                    <h4 className="text-gray-800 dark:text-white font-black text-sm">حالة الميزانية الحالية (سقوف الصرف)</h4>
                  </div>
                  <button 
                    onClick={() => setShowBudgetSettingsModal(true)} 
                    className="text-xs bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1 border border-gray-200 dark:border-zinc-700"
                  >
                    <Edit2 className="w-3 h-3" /> إعداد
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(settings.budgetLimits).map(([catName, limit]) => {
                    const spent = allExpenses.filter(e => isInCycle(e.date) && e.category === catName).reduce((s, e) => s + e.amount, 0);
                    const percent = limit > 0 ? (spent / limit) * 100 : 0;
                    const clampedPercent = Math.min(percent, 100);
                    let colorClass = "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]";
                    if (percent >= 100) colorClass = "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]";
                    else if (percent >= 75) colorClass = "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]";

                    return (
                      <div key={catName} className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-3 border border-gray-100 dark:border-zinc-700/50">
                        <div className="flex justify-between text-xs mb-2">
                          <span className="font-bold text-gray-700 dark:text-gray-300">{catName}</span>
                          <span className="font-bold text-gray-500 dark:text-gray-400">
                            <span className={percent >= 100 ? 'text-rose-500 font-black' : 'text-gray-900 dark:text-white'}>{fmt(spent)}</span> / {fmt(limit)}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${colorClass} transition-all duration-1000`} 
                            style={{ width: `${clampedPercent}%` }} 
                          />
                        </div>
                        <div className="flex justify-between items-center mt-1.5">
                          <span className="text-[10px] font-black text-gray-500">{percent >= 100 ? 'تجاوز السقف!' : percent >= 75 ? 'تحذير' : 'آمن'}</span>
                          <span className="text-[10px] text-gray-500 font-bold" dir="ltr">{percent.toFixed(1)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}


            {/* Search Bar & Date Filter */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="ابحث بالمحل، اسم المادة، المصروف، أو القسم..."
                  value={expenseSearch}
                  onChange={e => setExpenseSearch(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl px-4 py-2.5 pr-10 text-sm font-bold text-gray-800 dark:text-white outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20 transition"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                {expenseSearch && (
                  <button onClick={() => setExpenseSearch('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowAllDates(!showAllDates);
                    if (!showAllDates) {
                      setExpenseStartDate('');
                      setExpenseEndDate('');
                    }
                  }}
                  className={`px-3 py-2 rounded-2xl text-xs font-black transition flex items-center gap-1.5 shrink-0 border shadow-sm ${
                    showAllDates 
                      ? "bg-rose-500 text-white border-rose-500 shadow-rose-500/20" 
                      : "bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-zinc-700 hover:border-rose-400"
                  }`}
                  title={showAllDates ? "العودة للدورة الحالية فقط" : "عرض جميع المصاريف عبر كل التواريخ"}
                >
                  {showAllDates ? "📅 كل الفترات" : "🔄 الدورة الحالية"}
                </button>
                <div className="relative shrink-0">
                  <input
                    type="date"
                    value={expenseStartDate}
                    onChange={e => {
                      setExpenseStartDate(e.target.value);
                      if (e.target.value) setShowAllDates(false);
                    }}
                    className="w-[135px] bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl px-2.5 py-2 text-xs font-bold text-gray-800 dark:text-white outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20 transition"
                    title="من تاريخ"
                  />
                  {expenseStartDate && (
                    <button onClick={() => setExpenseStartDate('')} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-white dark:bg-zinc-900 px-1">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <span className="text-gray-500 font-bold shrink-0 text-xs">-</span>
                <div className="relative shrink-0">
                  <input
                    type="date"
                    value={expenseEndDate}
                    onChange={e => {
                      setExpenseEndDate(e.target.value);
                      if (e.target.value) setShowAllDates(false);
                    }}
                    className="w-[135px] bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl px-2.5 py-2 text-xs font-bold text-gray-800 dark:text-white outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20 transition"
                    title="إلى تاريخ"
                  />
                  {expenseEndDate && (
                    <button onClick={() => setExpenseEndDate('')} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-white dark:bg-zinc-900 px-1">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Category quick filters (ALL VISIBLE ON SCREEN) */}
            <div className="flex flex-wrap gap-2 justify-center pb-1">
              {/* Warranty Filter & Registry Buttons */}
              <button
                type="button"
                onClick={() => setOnlyWarrantyFilter(!onlyWarrantyFilter)}
                className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-full text-[11px] font-black transition ${
                  onlyWarrantyFilter
                    ? "bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20 scale-105"
                    : "bg-white dark:bg-zinc-800 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                }`}
                title="تصفية المشتريات التي تحتوي على كفالات وضمانات أجهزة"
              >
                <Shield className="w-3.5 h-3.5 fill-amber-500/20" />
                <span>مشتريات بضمان 🛡️</span>
              </button>

              <button
                type="button"
                onClick={() => setShowWarrantiesRegistryModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 border rounded-full text-[11px] font-black transition bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-600/40 hover:bg-amber-100"
                title="فتح سجل وضمانات الأجهزة والمشتريات"
              >
                <Shield className="w-3.5 h-3.5 text-amber-600" />
                <span>سجل الضمانات والأجهزة</span>
              </button>

              <button
                onClick={() => setExpenseCategoryFilter(null)}
                className={`flex items-center gap-1 px-3.5 py-2 border rounded-full text-[11px] font-bold transition ${
                  !expenseCategoryFilter
                    ? "bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/20 scale-105"
                    : "bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-zinc-700 hover:border-purple-400"
                }`}>
                الكل
              </button>
              {(() => {
                const catsToRender = showAllCategories ? availableExpenseCategories : availableExpenseCategories.slice(0, 4);

                return (
                  <>
                    {catsToRender.map(cat => {
                      const isActive = expenseCategoryFilter === cat.label;
                      return (
                        <button key={cat.label}
                          onClick={() => setExpenseCategoryFilter(isActive ? null : cat.label)}
                          className={`flex items-center gap-1 px-3.5 py-2 border rounded-full text-[11px] font-bold transition ${
                            isActive 
                              ? "bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/20 scale-105"
                              : "bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-zinc-700 hover:border-purple-400 hover:text-purple-600 dark:hover:text-purple-400"
                          }`}>
                          <span>{cat.icon}</span> 
                          <span>{cat.label}</span>
                          {cat.catTotal > 0 && (
                            <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-black ${isActive ? "bg-white/20 text-white" : "bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300"}`}>
                              {fmt(cat.catTotal)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {!showAllCategories && availableExpenseCategories.length > 4 && (
                      <button
                        onClick={() => setShowAllCategories(true)}
                        className="flex items-center gap-1 px-3.5 py-2 border rounded-full text-[11px] font-bold transition bg-gray-50 dark:bg-zinc-900 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-800"
                      >
                        المزيد...
                      </button>
                    )}
                    {showAllCategories && availableExpenseCategories.length > 4 && (
                      <button
                        onClick={() => { setShowAllCategories(false); setExpenseCategoryFilter(null); }}
                        className="flex items-center gap-1 px-3.5 py-2 border rounded-full text-[11px] font-bold transition bg-gray-50 dark:bg-zinc-900 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-800"
                      >
                        عرض أقل
                      </button>
                    )}
                  </>
                );
              })()}
            </div>

            {(() => {
              const isAnyFilterActive = expenseCategoryFilter || expenseSearch || expenseStartDate || expenseEndDate || showAllDates;

              return (
                <>
                  {/* Summary if filtered */}
                  {isAnyFilterActive && (
                    <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/40 rounded-2xl px-4 py-3 flex justify-between items-center mb-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-rose-700 dark:text-rose-400 text-xs font-bold">
                          إجمالي {expenseCategoryFilter ? expenseCategoryFilter : expenseSearch ? `البحث: ${expenseSearch}` : showAllDates ? 'كل الفترات' : 'الفترة المحددة'}:
                        </span>
                        <span className="text-rose-600 dark:text-rose-400 font-black">
                          {fmt(filteredExpensesTotal)} د.ع
                        </span>
                      </div>
                      <button 
                        onClick={() => {
                          const lines = filteredExpenses.map((e, i) => `${i+1}. ${e.name} | ${e.category} | ${fmt(e.amount)} د.ع | ${new Date(e.date).toLocaleDateString("ar-IQ")}`);
                          const text = `📊 تقرير المصاريف المفلترة\nإجمالي: ${fmt(filteredExpensesTotal)} د.ع\nالعدد: ${filteredExpenses.length} مصروف\n\n${lines.join('\n')}`;
                          navigator.clipboard.writeText(text);
                          toast.success("تم نسخ البيانات للذكاء الاصطناعي 🤖");
                        }}
                        className="bg-white dark:bg-zinc-800 text-rose-600 dark:text-rose-400 text-xs font-bold px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-800/50 flex items-center gap-1.5 hover:bg-rose-100 dark:hover:bg-zinc-700 transition shadow-sm"
                        title="نسخ المصاريف"
                      >
                        <Bot className="w-4 h-4" /> نسخ البيانات
                      </button>
                    </div>
                  )}

                  {filteredExpenses.length === 0 ? (
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 text-center border border-gray-100 dark:border-zinc-800">
                      <span className="text-5xl block mb-3">💸</span>
                      <p className="text-gray-400 font-bold text-sm mb-3">
                        {expenseSearch 
                          ? `لا نتائج عن "${expenseSearch}"` 
                          : (expenseStartDate || expenseEndDate) 
                            ? `لا توجد مصاريف في الفترة المحددة` 
                            : expenseCategoryFilter 
                              ? `لا توجد مصاريف في قسم ${expenseCategoryFilter}` 
                              : 'لا توجد مصاريف في هذه الدورة'}
                      </p>
                      {!showAllDates && !expenseStartDate && !expenseEndDate && (
                        <button
                          type="button"
                          onClick={() => setShowAllDates(true)}
                          className="px-4 py-2 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-300 font-bold text-xs rounded-xl border border-rose-200 dark:border-rose-800/40 hover:bg-rose-100 transition"
                        >
                          📅 عرض كل المصاريف السابقة واللاحقة (كل الفترات)
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                  {displayedExpenses.map(exp => {
                    const isCakeDebt = Boolean((exp as any).isFromCake);
                    const cat = isCakeDebt
                      ? { label: "ديون الكيك", icon: "🎂", color: "from-pink-500 to-rose-600" }
                      : (EXPENSE_CATEGORIES.find(c => c.label === exp.category) || { label: exp.category, icon: "📦", color: "from-gray-400 to-gray-500" });
                    return (
                      <div key={exp.id} className={`bg-white dark:bg-zinc-900 rounded-2xl p-3 border shadow-sm flex flex-col gap-2 relative overflow-hidden transition ${
                        isCakeDebt 
                          ? "border-pink-200 dark:border-pink-900/40 bg-gradient-to-b from-pink-50/30 to-white dark:from-pink-950/10 dark:to-zinc-900" 
                          : "border-gray-100 dark:border-zinc-800"
                      }`}>
                        <div className={`absolute top-0 right-0 left-0 h-1 bg-gradient-to-r ${cat?.color || 'from-gray-400 to-gray-500'} opacity-80 rounded-t-2xl`} />
                        {/* Top Row: icon + actions */}
                        <div className="flex items-start justify-between mt-0.5">
                          <div className={`w-10 h-10 bg-gradient-to-br ${cat?.color || 'from-gray-400 to-gray-500'} rounded-xl flex items-center justify-center text-lg flex-shrink-0 shadow-sm text-white`}>
                            {cat?.icon || '📦'}
                          </div>
                          <div className="flex gap-1">
                            {!isCakeDebt ? (
                              <>
                                <button onClick={() => { setEditExpense(exp); setShowExpenseModal(true); }} className="p-1 bg-gray-100 dark:bg-zinc-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition">
                                  <Edit2 className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                                </button>
                                <button onClick={() => handleDeleteExpense(exp.id)} className="p-1 bg-gray-100 dark:bg-zinc-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition">
                                  <Trash2 className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleDeleteExpense(exp.id, (exp as any).originDocId || exp.id)}
                                className="p-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/60 transition"
                                title="حذف دين فاتورة الكيك المستحق"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Cake debt origin badge */}
                        {isCakeDebt && (
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 font-black px-2 py-0.5 rounded-full border border-pink-200 dark:border-pink-800/40 flex items-center gap-1">
                              <span>🎂 دين على الكيك (من الراتب)</span>
                            </span>
                          </div>
                        )}

                        {/* Smart Origin Badge */}
                        {(() => {
                          const origin = getExpenseOriginBadge(exp);
                          if (!origin) return null;
                          return (
                            <div className="flex items-center gap-1">
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border flex items-center gap-1 ${origin.bg}`}>
                                <span>{origin.icon}</span>
                                <span>{origin.label}</span>
                              </span>
                            </div>
                          );
                        })()}

                        {/* Name */}
                        <div className="font-black text-gray-800 dark:text-gray-100 text-xs leading-tight line-clamp-2">{exp.name}</div>

                        {isCakeDebt && (
                          <p className="text-[10px] text-pink-600/90 dark:text-pink-400/90 font-bold leading-tight">
                            مواد كيك تم دفعها من راتبك ومستحقة الاسترداد
                          </p>
                        )}

                        {/* Amount */}
                        <div className="font-black text-rose-600 dark:text-rose-400 text-sm">-{fmt(exp.amount)} <span className="text-[10px] font-bold text-rose-400/70">د.ع</span></div>
                        {/* Footer */}
                        <div className="flex items-center gap-1 flex-wrap mt-auto">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold truncate max-w-[90px] ${
                            isCakeDebt
                              ? "bg-pink-100 dark:bg-pink-950/50 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800/40"
                              : "bg-gray-100 dark:bg-zinc-800 text-gray-500"
                          }`}>{isCakeDebt ? "ديون الكيك" : exp.category}</span>
                          <span className="text-[9px] text-gray-400">{exp.createdAt ? new Date(exp.createdAt).toLocaleDateString("ar-IQ") : new Date(exp.date).toLocaleDateString("ar-IQ")}</span>
                          {(exp.hasWarranty || (exp.warrantiesCount && exp.warrantiesCount > 0) || (exp.items && exp.items.some(it => it.hasWarranty))) && (
                            <span className="text-[9px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 px-1.5 py-0.5 rounded-full font-black flex items-center gap-0.5">
                              <Shield className="w-2.5 h-2.5 text-amber-600 fill-amber-500/20" />
                              <span>ضمان {exp.warrantiesCount ? `(${exp.warrantiesCount})` : ''}</span>
                            </span>
                          )}
                        </div>

                        {/* Items badge / view receipt button */}
                        {((exp.items && exp.items.length > 0) || (exp.receiptImages && exp.receiptImages.length > 0) || exp.imageUrl) && (() => {
                          const discCount = (exp.items || []).filter(it => classifyItemNature(it.name, it.category).type === "discretionary").length;
                          return (
                            <button
                              type="button"
                              onClick={() => { setViewingReceiptExpense(exp); setReceiptItemFilter(""); }}
                              className="w-full mt-1.5 py-1 px-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-xl text-[10px] font-black flex items-center justify-between border border-indigo-100 dark:border-indigo-800/40 transition active:scale-[0.98]"
                            >
                              <span className="flex items-center gap-1.5 truncate">
                                <Receipt className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                <span className="truncate">
                                  {exp.items && exp.items.length > 0 ? `قائمة المواد (${exp.items.length})` : "عرض الفاتورة"}
                                  {((exp.receiptImages && exp.receiptImages.length > 0) || exp.imageUrl) ? " 📸" : ""}
                                </span>
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                {discCount > 0 && (
                                  <span className="text-[9px] bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded-full font-black border border-rose-200 dark:border-rose-800/50" title={`تحتوي ${discCount} مواد تسالي/كماليات`}>
                                    🍭 {discCount}
                                  </span>
                                )}
                                <ChevronLeft className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              </div>
                            </button>
                          );
                        })()}


                      </div>
                    );
                  })}
                </div>

                {/* Progressive load more for ultra-fast mobile rendering */}
                {filteredExpenses.length > displayedExpenseCount && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 p-3.5 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 text-center shadow-xs">
                    <span className="text-xs font-bold text-gray-500">
                      يتم عرض <strong className="text-gray-900 dark:text-white font-black">{displayedExpenseCount}</strong> من أصل <strong className="text-purple-600 dark:text-purple-400 font-black">{filteredExpenses.length}</strong> مصروف
                    </span>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => setDisplayedExpenseCount(prev => prev + 30)}
                        className="flex-1 sm:flex-none px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition active:scale-95 shadow-sm"
                      >
                        عرض المزيد (+30) ⬇️
                      </button>
                      <button
                        type="button"
                        onClick={() => setDisplayedExpenseCount(filteredExpenses.length)}
                        className="px-3.5 py-2 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold transition active:scale-95"
                      >
                        عرض الكل
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        );
      })()}
          </div>
        )}

        {/* ═══════════════ INSTALLMENTS TAB ═══════════════ */}
        {activeTab === "installments" && (() => {
          // Helper to calculate exact stats for an installment
          const getInstStats = (inst: Installment) => {
            const paymentsActualTotal = inst.payments.reduce((s, p) => s + p.amount, 0);
            const initialPaidAmount = (inst.initialPaidMonths || 0) * inst.monthlyInstallment;
            const downPaymentAmount = inst.downPayment || 0;
            const totalPaidAmount = paymentsActualTotal + initialPaidAmount + downPaymentAmount;
            const computedRemaining = Math.max(0, inst.totalAmount - totalPaidAmount);
            const progress = inst.totalAmount > 0 ? Math.min(100, (totalPaidAmount / inst.totalAmount) * 100) : 0;
            const paidMonths = (inst.initialPaidMonths || 0) + inst.payments.length;
            const monthsLeft = inst.totalMonths 
              ? Math.max(0, inst.totalMonths - paidMonths)
              : (inst.monthlyInstallment > 0 ? Math.ceil(computedRemaining / inst.monthlyInstallment) : 0);
            const delayMonths = getInstallmentDelayMonths(inst);
            const isCompleted = computedRemaining <= 0;
            return {
              paymentsActualTotal,
              initialPaidAmount,
              downPaymentAmount,
              totalPaidAmount,
              computedRemaining,
              progress,
              paidMonths,
              monthsLeft,
              delayMonths,
              isCompleted
            };
          };

          const activeInstallments = installments.filter(inst => getInstStats(inst).computedRemaining > 0);
          const completedInstallments = installments.filter(inst => getInstStats(inst).computedRemaining <= 0);

          const renderSingleInstallment = (inst: Installment, idx: number, isCompleted: boolean) => {
            const stats = getInstStats(inst);
            const gradients = [
              "from-indigo-600 to-violet-700",
              "from-blue-600 to-cyan-700",
              "from-purple-600 to-pink-700",
              "from-teal-600 to-emerald-700",
            ];
            const grad = gradients[idx % gradients.length];
            const isHistory = showInstallmentHistory === inst.id;

            if (isCompleted) {
              return (
                <div key={inst.id} className="bg-slate-100/90 dark:bg-zinc-900/90 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-5 text-slate-800 dark:text-zinc-200 shadow-sm opacity-50 hover:opacity-100 grayscale-[0.6] hover:grayscale-0 relative overflow-hidden transition-all duration-300">
                  <div className="relative z-10 flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 inline-block">
                          {inst.type === "قسط" ? "💳 قسط" : "💰 سلفة"}
                        </span>
                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/50 inline-block">
                          ✅ تم السداد بالكامل / منتهي
                        </span>
                      </div>
                      <h3 className="font-black text-lg line-through text-slate-500 dark:text-zinc-400">{inst.name}</h3>
                      {inst.startDate && (
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-zinc-800/70 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-600 dark:text-zinc-400">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>بداية: {new Date(inst.startDate).toLocaleDateString("ar-IQ", { year: 'numeric', month: 'numeric', day: 'numeric' })}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => { setEditInstallment(inst); setShowInstallmentModal(true); }} className="p-2 bg-slate-200 dark:bg-zinc-800 rounded-xl hover:bg-slate-300 dark:hover:bg-zinc-700 transition">
                        <Edit2 className="w-3.5 h-3.5 text-slate-600 dark:text-zinc-400" />
                      </button>
                      <button onClick={() => handleDeleteInstallment(inst.id)} className="p-2 bg-slate-200 dark:bg-zinc-800 rounded-xl hover:bg-red-500/20 text-red-500 transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="relative z-10 grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-slate-200/60 dark:bg-zinc-800/60 rounded-2xl p-2.5 text-center">
                      <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-bold mb-0.5">القسط الشهري</div>
                      <div className="font-black text-sm">{fmt(inst.monthlyInstallment)}</div>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300/50 dark:border-emerald-800/40 rounded-2xl p-2.5 text-center">
                      <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold mb-0.5">المسدد الكلي</div>
                      <div className="font-black text-sm text-emerald-700 dark:text-emerald-300">{fmt(inst.totalAmount)}</div>
                    </div>
                    <div className="bg-slate-200/60 dark:bg-zinc-800/60 rounded-2xl p-2.5 text-center">
                      <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-bold mb-0.5">المتبقي</div>
                      <div className="font-black text-sm text-emerald-600 dark:text-emerald-400">0 د.ع (خالص)</div>
                    </div>
                    <div className="bg-slate-200/60 dark:bg-zinc-800/60 rounded-2xl p-2.5 text-center">
                      <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-bold mb-0.5">الحالة</div>
                      <div className="font-black text-sm text-emerald-600 dark:text-emerald-400">مكتمل 100%</div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="relative z-10 flex gap-2">
                    {inst.payments.length > 0 && (
                      <button onClick={() => handleUndoInstallmentPayment(inst)} className="px-3 py-1.5 bg-slate-200 dark:bg-zinc-800 rounded-xl text-xs font-bold hover:bg-slate-300 dark:hover:bg-zinc-700 transition">
                        تراجع عن آخر دفعة
                      </button>
                    )}
                    <button onClick={() => setShowInstallmentHistory(isHistory ? null : inst.id)} className="px-3 py-1.5 bg-slate-200 dark:bg-zinc-800 rounded-xl text-xs font-bold hover:bg-slate-300 dark:hover:bg-zinc-700 transition flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>سجل الدفعات ({inst.payments.length})</span>
                    </button>
                  </div>

                  {isHistory && inst.payments.length > 0 && (
                    <div className="relative z-10 mt-3 border-t border-slate-200 dark:border-zinc-800 pt-3 space-y-1 max-h-40 overflow-y-auto">
                      <p className="text-[10px] text-slate-500 font-bold mb-2">سجل الدفعات ({inst.payments.length} دفعة)</p>
                      {[...inst.payments].reverse().map((pay, pi) => (
                        <div key={pi} className="flex justify-between text-[11px] bg-slate-200/60 dark:bg-zinc-800/60 rounded-xl px-3 py-1.5">
                          <span className="font-bold">{fmt(pay.amount)} د.ع</span>
                          <span className="text-slate-400">{new Date(pay.date).toLocaleDateString("ar-IQ")}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div key={inst.id} className={`bg-gradient-to-br ${grad} rounded-3xl p-5 text-white shadow-xl relative overflow-hidden`}>
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />

                {/* Header */}
                <div className="relative z-10 flex items-start justify-between mb-4">
                  <div>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${inst.type === "قسط" ? "bg-white/20" : "bg-amber-400/30"} mb-1 inline-block`}>
                      {inst.type === "قسط" ? "💳 قسط" : "💰 سلفة"}
                    </span>
                    <h3 className="font-black text-lg">{inst.name}</h3>
                    {inst.startDate && (
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <div className="flex items-center gap-1 bg-white/15 backdrop-blur-sm rounded-lg px-2 py-1">
                          <Calendar className="w-3 h-3 text-white/70" />
                          <span className="text-white/80 text-[10px] font-bold">
                            بداية: {new Date(inst.startDate).toLocaleDateString("ar-IQ", { year: 'numeric', month: 'numeric', day: 'numeric' })}
                          </span>
                        </div>
                        {inst.totalMonths && (() => {
                          const endDate = new Date(inst.startDate);
                          endDate.setMonth(endDate.getMonth() + (inst.totalMonths));
                          return (
                            <div className="flex items-center gap-1 bg-white/15 backdrop-blur-sm rounded-lg px-2 py-1">
                              <Flag className="w-3 h-3 text-white/70" />
                              <span className="text-white/80 text-[10px] font-bold">
                                نهاية: {endDate.toLocaleDateString("ar-IQ", { year: 'numeric', month: 'numeric', day: 'numeric' })}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => { 
                       setEditInstallment(inst); 
                       setShowInstallmentModal(true); 
                    }}
                      className="p-2 bg-white/15 rounded-xl hover:bg-white/25 transition backdrop-blur-sm">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDeleteInstallment(inst.id)}
                      className="p-2 bg-white/15 rounded-xl hover:bg-red-500/50 transition backdrop-blur-sm">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Stats Grid - 2x2 */}
                <div className="relative z-10 grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-white/10 rounded-2xl p-2.5 text-center backdrop-blur-sm">
                    <div className="text-[10px] text-white/60 font-bold mb-0.5">القسط الشهري</div>
                    <div className="font-black text-sm">{fmt(inst.monthlyInstallment)}</div>
                  </div>
                  <div className="bg-emerald-500/25 border border-emerald-400/30 rounded-2xl p-2.5 text-center backdrop-blur-sm">
                    <div className="text-[10px] text-emerald-200 font-bold mb-0.5">المدفوع</div>
                    <div className="font-black text-sm text-emerald-200">{fmt(stats.totalPaidAmount)}</div>
                  </div>
                  <div className="bg-red-500/20 border border-red-400/25 rounded-2xl p-2.5 text-center backdrop-blur-sm">
                    <div className="text-[10px] text-red-200 font-bold mb-0.5">المتبقي</div>
                    <div className="font-black text-sm text-red-200">{fmt(stats.computedRemaining)}</div>
                  </div>
                  <div className="bg-white/10 rounded-2xl p-2.5 text-center backdrop-blur-sm">
                    <div className="text-[10px] text-white/60 font-bold mb-0.5">باقي أشهر</div>
                    <div className="font-black text-sm">{stats.monthsLeft}</div>
                  </div>
                </div>
                {inst.downPayment ? (
                  <div className="relative z-10 bg-white/10 rounded-2xl p-2 text-center mb-3 backdrop-blur-sm">
                    <span className="text-[10px] text-white/60 font-bold">المقدمة: </span>
                    <span className="font-black text-sm">{fmt(inst.downPayment)} د.ع</span>
                  </div>
                ) : null}

                {/* Delay Alert */}
                {stats.delayMonths > 0 && (
                  <div className="relative z-10 bg-red-500/30 border border-red-400/40 rounded-2xl p-2.5 mb-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-300 animate-pulse flex-shrink-0" />
                    <span className="text-red-200 text-xs font-black">حالة تلكؤ: {stats.delayMonths} شهر غير مدفوع!</span>
                  </div>
                )}
                
                {/* Advance Alert */}
                {(() => {
                  const advanceMonths = getInstallmentAdvanceMonths(inst);
                  if (advanceMonths > 0) {
                    return (
                      <div className="relative z-10 bg-emerald-500/30 border border-emerald-400/40 rounded-2xl p-2.5 mb-3 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-300 flex-shrink-0" />
                        <span className="text-emerald-200 text-xs font-black">حالة متقدمة: دفعة مقدمة لـ {advanceMonths} شهر!</span>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Progress */}
                <div className="relative z-10 mb-4">
                  <div className="flex justify-between text-[10px] text-white/70 font-bold mb-1.5">
                    <span>التقدم: {stats.progress.toFixed(1)}%</span>
                    <span>الإجمالي: {fmt(inst.totalAmount)} د.ع</span>
                  </div>
                  <div className="h-2.5 bg-black/25 rounded-full overflow-hidden">
                    <div className="h-full bg-white rounded-full transition-all" style={{ width: `${Math.min(100, stats.progress)}%` }} />
                  </div>
                  {inst.totalMonths && (
                    <div className="text-[10px] text-white/50 mt-1">{stats.paidMonths} أشهر مدفوعة من {inst.totalMonths}</div>
                  )}
                </div>

                {/* Actions */}
                <div className="relative z-10 flex gap-2">
                  {stats.computedRemaining > 0 && (
                    <button onClick={() => handlePayInstallment(inst)}
                      className="flex-1 bg-white text-gray-900 font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 hover:bg-white/90 active:scale-95 transition shadow-sm">
                      <Check className="w-3.5 h-3.5" /> دفع القسط
                    </button>
                  )}
                  {inst.payments.length > 0 && (
                    <button onClick={() => handleUndoInstallmentPayment(inst)}
                      className="px-3 bg-white/15 rounded-xl text-xs font-bold hover:bg-white/25 active:scale-95 transition">
                      تراجع
                    </button>
                  )}
                  <button onClick={() => setShowInstallmentHistory(isHistory ? null : inst.id)}
                    className="px-3 bg-white/15 rounded-xl text-xs font-bold hover:bg-white/25 active:scale-95 transition flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {inst.payments.length}
                  </button>
                </div>

                {isHistory && inst.payments.length > 0 && (
                  <div className="relative z-10 mt-3 border-t border-white/15 pt-3 space-y-1 max-h-40 overflow-y-auto">
                    <p className="text-[10px] text-white/60 font-bold mb-2">سجل الدفعات ({inst.payments.length} دفعة)</p>
                    {[...inst.payments].reverse().map((pay, pi) => (
                      <div key={pi} className="flex justify-between text-[11px] bg-white/10 rounded-xl px-3 py-1.5">
                        <span className="text-white/80 font-bold">{fmt(pay.amount)} د.ع</span>
                        <span className="text-white/50">{new Date(pay.date).toLocaleString("ar-IQ", { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    ))}
                  </div>
                )}
                {isHistory && inst.payments.length === 0 && (
                  <div className="relative z-10 mt-3 border-t border-white/15 pt-3 text-center text-[11px] text-white/50">لا توجد دفعات مسجلة</div>
                )}
              </div>
            );
          };

          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-black text-gray-800 dark:text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-indigo-500" />
                  الأقساط والسلف
                </h2>
                <button onClick={() => setShowInstallmentModal(true)}
                  className="bg-indigo-500 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 shadow-lg shadow-indigo-500/25 active:scale-95 transition">
                  <Plus className="w-3.5 h-3.5" /> إضافة
                </button>
              </div>

              {/* Filter Tabs */}
              {installments.length > 0 && (
                <div className="flex bg-gray-100 dark:bg-zinc-900 p-1 rounded-2xl gap-1">
                  <button
                    type="button"
                    onClick={() => setInstallmentFilter("active")}
                    className={`flex-1 py-1.5 text-xs font-black rounded-xl transition ${
                      installmentFilter === "active"
                        ? "bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                        : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                    }`}
                  >
                    النشطة المستمرة ({activeInstallments.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setInstallmentFilter("completed")}
                    className={`flex-1 py-1.5 text-xs font-black rounded-xl transition ${
                      installmentFilter === "completed"
                        ? "bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-sm"
                        : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                    }`}
                  >
                    المنتهية / المسددة ({completedInstallments.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setInstallmentFilter("all")}
                    className={`flex-1 py-1.5 text-xs font-black rounded-xl transition ${
                      installmentFilter === "all"
                        ? "bg-white dark:bg-zinc-800 text-gray-800 dark:text-white shadow-sm"
                        : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                    }`}
                  >
                    الكل ({installments.length})
                  </button>
                </div>
              )}

              {installments.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 text-center border border-gray-100 dark:border-zinc-800">
                  <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-400 font-bold text-sm">لا توجد أقساط أو سلف مسجلة</p>
                </div>
              ) : installmentFilter === "completed" ? (
                completedInstallments.length === 0 ? (
                  <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 text-center border border-gray-100 dark:border-zinc-800">
                    <p className="text-gray-400 font-bold text-sm">لا توجد أقساط أو سلف منتهية حتى الآن</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {completedInstallments.map((inst, idx) => renderSingleInstallment(inst, idx, true))}
                  </div>
                )
              ) : installmentFilter === "all" ? (
                <div className="space-y-4">
                  {activeInstallments.map((inst, idx) => renderSingleInstallment(inst, idx, false))}
                  {completedInstallments.length > 0 && (
                    <div className="pt-4 border-t border-gray-200 dark:border-zinc-800 space-y-3">
                      <div className="text-xs font-black text-gray-400 flex items-center gap-1.5 px-1">
                        <span>✅</span>
                        <span>الأقساط والسلف المنتهية بالكامل ({completedInstallments.length}):</span>
                      </div>
                      {completedInstallments.map((inst, idx) => renderSingleInstallment(inst, idx, true))}
                    </div>
                  )}
                </div>
              ) : (
                /* Default "active" view */
                <div className="space-y-4">
                  {activeInstallments.length === 0 ? (
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-3xl p-8 text-center">
                      <span className="text-4xl block mb-2">🎉</span>
                      <h4 className="font-black text-emerald-800 dark:text-emerald-300 text-base">لا توجد أي أقساط أو سلف مستمرة!</h4>
                      <p className="text-xs font-bold text-emerald-600/80 dark:text-emerald-400 mt-1">جميع الأقساط والسلف مسددة بالكامل بنجاح</p>
                    </div>
                  ) : (
                    activeInstallments.map((inst, idx) => renderSingleInstallment(inst, idx, false))
                  )}

                  {/* Finished / Completed Section at Bottom with faded look */}
                  {completedInstallments.length > 0 && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setShowCompletedInstallments(prev => !prev)}
                        className="w-full py-2.5 px-4 rounded-2xl bg-gray-100/80 dark:bg-zinc-900/80 hover:bg-gray-200/80 dark:hover:bg-zinc-800/80 text-xs font-black text-gray-500 dark:text-gray-400 flex items-center justify-between transition border border-gray-200/60 dark:border-zinc-800/60 active:scale-[0.99]"
                      >
                        <span className="flex items-center gap-1.5">
                          <span>✅</span>
                          <span>الأقساط والسلف المنتهية بالكامل</span>
                          <span className="text-[10px] bg-gray-200 dark:bg-zinc-800 px-2 py-0.5 rounded-full font-bold">({completedInstallments.length})</span>
                        </span>
                        <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                          {showCompletedInstallments ? "إخفاء ▲" : "عرض بالأسفل (ظل خافت) ▼"}
                        </span>
                      </button>
                      {showCompletedInstallments && (
                        <div className="space-y-3 mt-3">
                          {completedInstallments.map((inst, idx) => renderSingleInstallment(inst, idx, true))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* ═══════════════ NEEDS TAB ═══════════════ */}
        {activeTab === "needs" && (
          <div className="space-y-3 pt-4 sm:pt-2">
            {/* Header with AI Camera & Add */}
            <div className="bg-gradient-to-r from-red-600 via-rose-600 to-pink-600 rounded-3xl p-4 sm:p-5 text-white shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none transform -translate-y-1/2 translate-x-1/4" />
              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="p-1.5 bg-white/20 backdrop-blur-md rounded-xl shadow-inner">
                      <ShoppingCart className="w-5 h-5 text-white" />
                    </span>
                    <h2 className="font-black text-lg md:text-xl text-white">سجل النواقص والاحتياجات</h2>
                    <span className="px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-xs font-black text-white">
                      {unifiedDeficits.length} مادة
                    </span>
                  </div>
                  <p className="text-[11px] md:text-xs text-white/90">
                    تزامن تلقائي لكل النواقص (البيت، العائلة، السيارة، والسفر) + فحص صور الأدوية والمنتجات 🧠📸
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Hidden inputs: Camera vs Gallery */}
                  <input
                    ref={needCameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleScanNeedPhoto}
                    className="hidden"
                  />
                  <input
                    ref={needGalleryInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleScanNeedPhoto}
                    className="hidden"
                  />

                  {/* Camera Button */}
                  <button
                    type="button"
                    onClick={() => needCameraInputRef.current?.click()}
                    disabled={isScanningNeed}
                    className="flex-1 sm:flex-initial bg-white text-rose-600 hover:bg-rose-50 text-xs font-black px-3.5 py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow active:scale-95 transition cursor-pointer"
                    title="التقاط صورة مباشرة بالكاميرا"
                  >
                    {isScanningNeed ? (
                      <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                    ) : (
                      <Camera className="w-4 h-4 text-rose-600" />
                    )}
                    <span>تصوير كاميرا 📸</span>
                  </button>

                  {/* Gallery / Studio Button */}
                  <button
                    type="button"
                    onClick={() => needGalleryInputRef.current?.click()}
                    disabled={isScanningNeed}
                    className="flex-1 sm:flex-initial bg-white/95 text-purple-700 hover:bg-white text-xs font-black px-3.5 py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow active:scale-95 transition cursor-pointer"
                    title="اختيار صورة من استوديو الصور أو المعرض"
                  >
                    <ImageIcon className="w-4 h-4 text-purple-600" />
                    <span>من الاستوديو 🖼️</span>
                  </button>

                  {/* Manual Add Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setEditNeed(null);
                      setNeedImageFile(null);
                      setNeedImagePreview(null);
                      setNeedNameInput("");
                      setShowNeedModal(true);
                    }}
                    className="bg-black/25 hover:bg-black/35 text-white border border-white/20 text-xs font-black px-3.5 py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow active:scale-95 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة يدوي</span>
                  </button>
                </div>
              </div>
            </div>

            {/* AI Scanning Status Banner */}
            {isScanningNeed && (
              <div className="bg-gradient-to-r from-purple-700 via-indigo-600 to-purple-600 text-white rounded-2xl p-3 shadow-lg flex items-center gap-2.5 animate-pulse border border-purple-400/30">
                <Loader2 className="w-5 h-5 animate-spin flex-shrink-0 text-white" />
                <div className="flex-1">
                  <div className="font-black text-xs">جارٍ فحص وتحليل الصورة بالذكاء الاصطناعي...</div>
                  <div className="text-[10px] text-purple-200 mt-0.5">{scanNeedStatus || "يتم استخراج اسم الدواء أو المنتج والجرعة..."}</div>
                </div>
              </div>
            )}

            {/* Needs Summary Stats (Clean, No Overlap, Well-Organized Cards) */}
            {needsSummaryStats.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {needsSummaryStats.map((stat, idx) => {
                  const isLastOdd = needsSummaryStats.length % 2 !== 0 && idx === needsSummaryStats.length - 1;
                  return (
                    <div
                      key={stat.id}
                      onClick={() => setNeedFilterTab(stat.id === "home" ? "inventory" : stat.id as any)}
                      className={`p-2.5 rounded-2xl border shadow-xs transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${stat.colorClass} flex flex-col justify-between ${
                        isLastOdd ? "col-span-2 sm:col-span-1" : ""
                      }`}
                    >
                      {/* Line 1: Icon + Name + Count Badge */}
                      <div className="flex items-center justify-between gap-1.5 mb-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-base flex-shrink-0">{stat.icon}</span>
                          <span className="font-black text-xs truncate">{stat.name}</span>
                        </div>
                        <span className="px-2 py-0.5 bg-white/70 dark:bg-black/40 rounded-lg text-xs font-black shadow-2xs flex-shrink-0">
                          {stat.count} مادة
                        </span>
                      </div>

                      {/* Line 2: Estimated Cost (clearly labeled & separated) */}
                      <div className="flex items-center justify-between gap-1 text-[11px] font-black border-t border-black/5 dark:border-white/5 pt-1.5 mt-auto">
                        <span className="text-gray-500 dark:text-gray-400 text-[10px] font-bold">الكلفة:</span>
                        <span className={`font-black ${stat.price > 0 ? "text-rose-600 dark:text-rose-400" : "text-gray-400"}`}>
                          {stat.price > 0 ? `${fmt(stat.price)} د.ع` : "غير مسعر"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Filter Tabs & Search Bar */}
            <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-2.5 shadow-sm space-y-2.5">
              <div className="flex flex-wrap items-center gap-1.5" dir="rtl">
                {[
                  { id: "all", label: "الكل", icon: "🛒", count: unifiedDeficits.length },
                  { id: "medicine", label: "أدوية وصيدلية", icon: "💊", count: unifiedDeficits.filter(i => i.isMedicine).length },
                  { id: "photo", label: "مصورة / أدوية", icon: "📸", count: unifiedDeficits.filter(i => i.sourceType === "need" || !!i.imageUrl).length },
                  { id: "inventory", label: "البيت", icon: "📦", count: unifiedDeficits.filter(i => i.sourceType === "inventory").length },
                  { id: "family", label: "العائلة", icon: "👨‍👩‍👧‍👦", count: unifiedDeficits.filter(i => i.sourceType === "family").length },
                  { id: "car", label: "السيارة", icon: "🚗", count: unifiedDeficits.filter(i => i.sourceType === "car").length },
                  { id: "travel", label: "السفر", icon: "✈️", count: unifiedDeficits.filter(i => i.sourceType === "travel").length },
                ].map((tab) => {
                  const isActive = needFilterTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setNeedFilterTab(tab.id as any)}
                      className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 active:scale-95 cursor-pointer ${
                        isActive
                          ? "bg-red-500 text-white shadow-sm"
                          : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700"
                      }`}
                    >
                      <span>{tab.icon}</span>
                      <span>{tab.label}</span>
                      <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${isActive ? "bg-white/30 text-white" : "bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-gray-300"}`}>
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="ابحث عن دواء، مسواك، منتج، أو فرد من العائلة..."
                  value={needSearchQuery}
                  onChange={(e) => setNeedSearchQuery(e.target.value)}
                  className="w-full pr-9 pl-8 py-2 bg-gray-50 dark:bg-zinc-800 border-none rounded-xl text-xs font-bold text-gray-800 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-red-500/30 outline-none transition"
                />
                {needSearchQuery && (
                  <button
                    onClick={() => setNeedSearchQuery("")}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Compact Square Cards Grid (2 columns on mobile, 3-4 on larger screens) */}
            {(() => {
              const filtered = unifiedDeficits.filter((item) => {
                if (needFilterTab === "medicine" && !item.isMedicine) return false;
                if (needFilterTab === "photo" && !(item.sourceType === "need" || !!item.imageUrl)) return false;
                if (needFilterTab === "inventory" && item.sourceType !== "inventory") return false;
                if (needFilterTab === "family" && item.sourceType !== "family") return false;
                if (needFilterTab === "car" && item.sourceType !== "car") return false;
                if (needFilterTab === "travel" && item.sourceType !== "travel") return false;

                if (needSearchQuery.trim()) {
                  const q = needSearchQuery.trim().toLowerCase();
                  const inName = item.name.toLowerCase().includes(q);
                  const inCat = item.category.toLowerCase().includes(q);
                  const inNotes = (item.notes || "").toLowerCase().includes(q);
                  const inSpecs = (item.dosageOrSpecs || "").toLowerCase().includes(q);
                  const inMember = (item.member || "").toLowerCase().includes(q);
                  if (!inName && !inCat && !inNotes && !inSpecs && !inMember) return false;
                }

                return true;
              });

              if (filtered.length === 0) {
                return (
                  <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 text-center border border-gray-100 dark:border-zinc-800 shadow-sm space-y-2.5">
                    <span className="text-5xl block mb-1">🎉</span>
                    <h3 className="font-black text-gray-800 dark:text-white text-sm">
                      {needSearchQuery ? "لا توجد نتائج تطابق بحثك" : "لا توجد نواقص في هذا القسم"}
                    </h3>
                    <p className="text-[11px] text-gray-400 max-w-xs mx-auto">
                      كل احتياجات البيت ومستلزمات العائلة والسيارة متوفرة حالياً.
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => needCameraInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-xl text-xs font-black hover:bg-red-100 transition cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>تصوير كاميرا 📸</span>
                      </button>
                      <button
                        onClick={() => needGalleryInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-xl text-xs font-black hover:bg-purple-100 transition cursor-pointer"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>من الاستوديو 🖼️</span>
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                  {filtered.map((item) => {
                    const estTotal = (item.quantity || 1) * (item.estimatedPrice || 0);

                    const sourceBadge =
                      item.isMedicine || item.category === "أدوية وصيدلية"
                        ? { text: "💊 صيدلية", style: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800" }
                        : item.sourceType === "family"
                        ? { text: `👤 ${item.member || "عائلة"}`, style: "bg-pink-100 text-pink-700 dark:bg-pink-950/50 dark:text-pink-300 border-pink-200 dark:border-pink-800" }
                        : item.sourceType === "car"
                        ? { text: "🚗 سيارة", style: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800" }
                        : item.sourceType === "travel"
                        ? { text: "✈️ سفر", style: "bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300 border-teal-200 dark:border-teal-800" }
                        : item.imageUrl
                        ? { text: "📸 مصور", style: "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200 dark:border-purple-800" }
                        : { text: "📦 البيت", style: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800" };

                    return (
                      <div
                        key={item.key}
                        className="bg-white dark:bg-zinc-900 rounded-2xl p-2.5 border border-gray-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between relative group overflow-hidden"
                      >
                        {/* Top decorative gradient line */}
                        <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 opacity-60" />

                        {/* Top Meta Bar */}
                        <div className="flex items-center justify-between gap-1 mb-1.5 pt-0.5">
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border whitespace-nowrap ${sourceBadge.style}`}>
                            {sourceBadge.text}
                          </span>

                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            {item.sourceType === "need" && (
                              <button
                                onClick={() => {
                                  setEditNeed(item.originalItem);
                                  setNeedNameInput(item.name);
                                  setNeedImagePreview(item.imageUrl || null);
                                  setShowNeedModal(true);
                                }}
                                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded transition cursor-pointer"
                                title="تعديل"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteUnifiedDeficit(item)}
                              className="p-1 text-gray-400 hover:text-red-500 rounded transition cursor-pointer"
                              title="حذف من النواقص"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Card Center: Square Thumbnail or Icon + Product Name */}
                        <div className="flex flex-col items-center text-center gap-1 my-1">
                          {item.imageUrl ? (
                            <div
                              onClick={() => {
                                const allImgs = item.images && item.images.length > 0 ? item.images : [item.imageUrl!];
                                setPreviewImageUrl({ url: item.imageUrl!, title: item.name, allUrls: allImgs });
                              }}
                              className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 cursor-pointer group/img relative shadow-xs"
                            >
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-110"
                              />
                              {item.images && item.images.length > 1 && (
                                <span className="absolute bottom-1 right-1 bg-black/75 backdrop-blur-xs text-white text-[8px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shadow-sm">
                                  <Camera className="w-2.5 h-2.5 text-rose-400" />
                                  {item.images.length}
                                </span>
                              )}
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center text-white">
                                <Eye className="w-3.5 h-3.5" />
                              </div>
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-zinc-800/80 border border-gray-100 dark:border-zinc-700/60 flex items-center justify-center text-2xl shadow-2xs">
                              {item.isMedicine ? "💊" : item.sourceType === "car" ? "🚗" : item.sourceType === "travel" ? "✈️" : item.sourceType === "family" ? "👤" : "📦"}
                            </div>
                          )}

                          <h4 className="font-black text-xs text-gray-900 dark:text-white line-clamp-2 leading-tight px-0.5 min-h-[28px] flex items-center justify-center">
                            {item.name}
                          </h4>

                          {item.dosageOrSpecs ? (
                            <div className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 text-purple-700 dark:text-purple-300 rounded text-[9px] font-black max-w-[130px] truncate">
                              <Sparkles className="w-2 h-2 flex-shrink-0" />
                              <span className="truncate">{item.dosageOrSpecs}</span>
                            </div>
                          ) : (
                            <span className="text-[9px] text-gray-400 font-bold truncate max-w-[120px]">
                              {item.category}
                            </span>
                          )}
                        </div>

                        {/* Quantity & Estimated Price */}
                        <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl px-2 py-1 mb-2 flex items-center justify-between text-[10px] border border-gray-100 dark:border-zinc-800">
                          <span className="font-bold text-gray-700 dark:text-gray-300">
                            {item.quantity} {item.unit}
                          </span>
                          <span className="font-black text-rose-600 dark:text-rose-400">
                            {estTotal > 0 ? `${fmt(estTotal)} د.ع` : "غير مسعر"}
                          </span>
                        </div>

                        {/* Card Footer: Quantity Adjuster + Fulfill Button */}
                        <div className="flex items-center gap-1.5">
                          {/* +/- Counter */}
                          <div className="flex items-center bg-gray-100 dark:bg-zinc-800 rounded-lg p-0.5 border border-gray-200 dark:border-zinc-700">
                            <button
                              onClick={() => handleUpdateDeficitQty(item, 1)}
                              className="w-5 h-5 rounded bg-white dark:bg-zinc-700 text-gray-700 dark:text-white font-bold flex items-center justify-center hover:bg-emerald-500 hover:text-white transition text-xs cursor-pointer"
                            >
                              +
                            </button>
                            <span className="w-5 text-center font-black text-[11px] text-gray-800 dark:text-gray-200">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => handleUpdateDeficitQty(item, -1)}
                              className="w-5 h-5 rounded bg-white dark:bg-zinc-700 text-gray-700 dark:text-white font-bold flex items-center justify-center hover:bg-red-500 hover:text-white transition text-xs cursor-pointer"
                            >
                              -
                            </button>
                          </div>

                          {/* Fulfill / Buy button */}
                          <button
                            onClick={() => handleFulfillUnifiedDeficit(item)}
                            className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-[10px] font-black py-1.5 px-2 rounded-lg shadow-xs active:scale-95 transition flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3 h-3" />
                            <span>تم الشراء</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* ═══════════════ BILLS TAB ═══════════════ */}
        {activeTab === "bills" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-black text-gray-800 dark:text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-500" />
                الفواتير الثابتة
              </h2>
              <button onClick={() => setShowBillModal(true)}
                className="bg-amber-500 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 shadow-lg shadow-amber-500/25 active:scale-95 transition">
                <Plus className="w-3.5 h-3.5" /> إضافة
              </button>
            </div>

            {/* Bills Progress + Filter */}
            {bills.length > 0 && (
              <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
                {(() => {
                  const lateBills = bills.filter(b => getBillOverdueMonths(b) > 0);
                  if (lateBills.length === 0) return null;
                  const lateTotal = lateBills.reduce((s, b) => s + getBillOverdueMonths(b) * b.amount, 0);
                  return (
                    <div className="flex items-center justify-between bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl px-3 py-2">
                      <span className="text-xs font-black text-red-700 dark:text-red-300">⚠️ متأخر: {lateBills.length} فاتورة</span>
                      <span className="text-sm font-black text-red-600 dark:text-red-400">{fmt(lateTotal)} <span className="text-[10px]">د.ع</span></span>
                    </div>
                  );
                })()}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500">المدفوعة هذه الدورة</span>
                  <span className="text-xs font-black text-gray-800 dark:text-white">{bills.filter(b => isBillPaidThisCycle(b)).length}/{bills.length}</span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-l from-amber-500 to-green-500 rounded-full transition-all"
                    style={{ width: `${bills.length > 0 ? (bills.filter(b => isBillPaidThisCycle(b)).length / bills.length) * 100 : 0}%` }}
                  />
                </div>
                <div className="flex gap-2">
                  {(['all', 'unpaid', 'paid'] as const).map(f => (
                    <button key={f} onClick={() => setBillFilter(f)}
                      className={`flex-1 py-1.5 rounded-xl text-[11px] font-black transition ${
                        billFilter === f ? 'bg-amber-500 text-white shadow' : 'bg-gray-100 dark:bg-zinc-800 text-gray-500'
                      }`}>
                      {f === 'all' ? 'الكل' : f === 'unpaid' ? 'غير مدفوعة' : 'مدفوعة'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {bills.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 text-center border border-gray-100 dark:border-zinc-800">
                <span className="text-5xl block mb-3">🧾</span>
                <p className="text-gray-400 font-bold text-sm">لا توجد فواتير مسجلة</p>
                <button onClick={() => setShowBillModal(true)} className="mt-3 text-amber-500 text-xs font-black hover:underline">+ أضف أول فاتورة</button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {bills
                  .filter(b => billFilter === 'all' ? true : billFilter === 'paid' ? isBillPaidThisCycle(b) : !isBillPaidThisCycle(b))
                  .sort((a, b) => {
                    // ترتيب الفواتير بحيث تكون "الدفع اللاحق" بعد "الدفع المسبق"
                    const typeA = a.paymentType === "لاحق" ? 1 : 0;
                    const typeB = b.paymentType === "لاحق" ? 1 : 0;
                    return typeA - typeB;
                  })
                  .map((bill, idx) => {
                  const daysUntilDue = bill.dueDay ? (() => {
                    const now = new Date();
                    const dueDate = new Date(now.getFullYear(), now.getMonth(), bill.dueDay!);
                    if (isBillPaidThisCycle(bill)) {
                      if (dueDate < now) dueDate.setMonth(dueDate.getMonth() + 1);
                    }
                    return Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  })() : null;
                  const isOverdue = daysUntilDue !== null && daysUntilDue < 0 && !isBillPaidThisCycle(bill);

                  const billEmojis = ["💡", "💧", "📺", "📱", "🌐", "🔥", "🏠", "🚗", "📡"];
                  const billColors = [
                    { bg: "bg-blue-500", light: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-200 dark:border-blue-800/50", grad: "from-blue-400 to-indigo-500" },
                    { bg: "bg-purple-500", light: "bg-purple-50 dark:bg-purple-900/20", border: "border-purple-200 dark:border-purple-800/50", grad: "from-purple-400 to-fuchsia-500" },
                    { bg: "bg-emerald-500", light: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200 dark:border-emerald-800/50", grad: "from-emerald-400 to-teal-500" },
                    { bg: "bg-amber-500", light: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-200 dark:border-amber-800/50", grad: "from-amber-400 to-orange-500" },
                    { bg: "bg-rose-500", light: "bg-rose-50 dark:bg-rose-900/20", border: "border-rose-200 dark:border-rose-800/50", grad: "from-rose-400 to-red-500" },
                  ];
                  const c = billColors[idx % billColors.length];
                  const billEmoji = billEmojis[idx % billEmojis.length];
                  const paidThisCycle = isBillPaidThisCycle(bill);
                  const overdueMonths = getBillOverdueMonths(bill);
                  const isBillHistory = showBillHistory === bill.id;
                  const paidDates = bill.paidDates || [];
                  return (
                    <div key={bill.id} className="flex flex-col gap-2">
                      <div className={`rounded-2xl p-3 border ${isOverdue ? 'border-red-400/60 bg-red-50 dark:bg-red-900/20' : paidThisCycle ? 'border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-900/10' : c.border + ' ' + c.light} flex flex-col gap-2 relative overflow-hidden`}>
                        <div className={`absolute top-0 right-0 left-0 h-1 bg-gradient-to-r ${isOverdue ? 'from-red-400 to-red-600' : paidThisCycle ? 'from-emerald-400 to-green-500' : c.grad} opacity-70 rounded-t-2xl`} />
                        {/* Header: emoji + actions */}
                        <div className="flex items-start justify-between mt-0.5">
                          <div className={`w-10 h-10 ${isOverdue ? 'bg-red-500' : paidThisCycle ? 'bg-emerald-500' : c.bg} rounded-xl flex items-center justify-center text-xl text-white flex-shrink-0 shadow-sm`}>
                            {paidThisCycle ? '✅' : billEmoji}
                          </div>
                          <div className="flex gap-0.5">
                            <button onClick={() => setShowBillHistory(isBillHistory ? null : bill.id)} className="p-1 bg-white/70 dark:bg-zinc-800/70 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700 transition text-gray-500">
                              <Clock className="w-3 h-3" />
                            </button>
                            <button onClick={() => { setEditBill(bill); setShowBillModal(true); }} className="p-1 bg-white/70 dark:bg-zinc-800/70 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition">
                              <Edit2 className="w-3 h-3 text-gray-500" />
                            </button>
                            <button onClick={() => handleDeleteBill(bill.id)} className="p-1 bg-white/70 dark:bg-zinc-800/70 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition">
                              <Trash2 className="w-3 h-3 text-gray-500" />
                            </button>
                          </div>
                        </div>
                        {/* Name */}
                        <div className="font-black text-gray-800 dark:text-gray-100 text-xs leading-tight line-clamp-2">{bill.name}</div>
                        {/* Amount */}
                        <div className="font-black text-sm text-gray-800 dark:text-gray-200">{fmt(bill.amount)} <span className="text-[10px] font-bold text-gray-400">د.ع</span></div>
                        {/* Status / Due */}
                        <div className="flex flex-wrap items-center gap-1">
                          {bill.paymentType === "لاحق" && (
                            <span className="text-[9px] bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-1.5 py-0.5 rounded-full font-bold">
                              دفع لاحق
                            </span>
                          )}
                          {paidThisCycle ? (
                            <span className="text-[9px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                              <Check className="w-2 h-2" /> مدفوعة
                            </span>
                          ) : isOverdue ? (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 animate-pulse">⚠️ تأخر</span>
                          ) : daysUntilDue !== null ? (
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${daysUntilDue <= 3 ? 'bg-red-100 text-red-600 animate-pulse' : daysUntilDue <= 7 ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 dark:bg-zinc-800 text-gray-500'}`}>
                              {daysUntilDue === 0 ? 'اليوم!' : `${daysUntilDue}ي`}
                            </span>
                          ) : null}
                          {paidDates.length > 0 && <span className="text-[9px] text-gray-400">{new Date(paidDates[paidDates.length - 1].date).toLocaleDateString("ar-IQ")}</span>}
                        </div>
                        {overdueMonths > 0 && (
                          <div className="rounded-xl bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800/50 px-2 py-1.5 text-center">
                            <div className="text-[10px] font-black text-red-700 dark:text-red-300">متلكئ {overdueMonths} {overdueMonths === 1 ? 'شهر' : overdueMonths === 2 ? 'شهرين' : overdueMonths <= 10 ? 'أشهر' : 'شهر'}</div>
                            <div className="text-[11px] font-black text-red-600 dark:text-red-400">المتأخر: {fmt(overdueMonths * bill.amount)} د.ع</div>
                          </div>
                        )}
                        {/* Pay/Undo button */}
                        {!paidThisCycle ? (
                          <button onClick={() => handlePayBill(bill)}
                            className={`w-full bg-gradient-to-r ${c.grad} text-white text-[10px] font-black py-1.5 rounded-xl active:scale-95 transition shadow-sm mt-auto`}>
                            دفع الآن
                          </button>
                        ) : (
                          <div className="flex gap-2 mt-auto w-full">
                            <button onClick={() => handleUndoBillPayment(bill)}
                              className="flex-1 bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 text-[10px] font-bold py-1.5 rounded-xl active:scale-95 transition">
                              تراجع
                            </button>
                            <button onClick={() => handlePayBill(bill)}
                              className={`flex-1 bg-gradient-to-r ${c.grad} text-white text-[10px] font-black py-1.5 rounded-xl active:scale-95 transition shadow-sm`}>
                              دفع مسبق
                            </button>
                          </div>
                        )}
                      </div>
                      
                      {isBillHistory && paidDates.length > 0 && (
                        <div className={`rounded-2xl p-3 border ${c.border} bg-white dark:bg-zinc-900 shadow-sm max-h-40 overflow-y-auto`}>
                          <p className="text-[10px] text-gray-500 font-bold mb-2">سجل الدفعات ({paidDates.length})</p>
                          {[...paidDates].reverse().map((pay, pi) => (
                            <div key={pi} className="flex justify-between text-[11px] bg-gray-50 dark:bg-zinc-800 rounded-xl px-3 py-1.5 mb-1 last:mb-0">
                              <span className="text-gray-800 dark:text-gray-200 font-bold">{fmt(pay.amount)} د.ع</span>
                              <span className="text-gray-500">{new Date(pay.date).toLocaleDateString("ar-IQ")}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {isBillHistory && paidDates.length === 0 && (
                        <div className={`rounded-2xl p-3 border ${c.border} bg-white dark:bg-zinc-900 shadow-sm text-center text-[11px] text-gray-500`}>
                          لا توجد دفعات مسجلة
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ DEBTS TAB ═══════════════ */}
        {activeTab === "debts" && (() => {
          const getDebtStats = (debt: Debt) => {
            const isVirtualCake = debt.id === "virtual-cake-debt";
            
            const paidOnMe = debt.payments
              .filter(p => p.type === "دين علي" || (!p.type && debt.type === "دين علي"))
              .reduce((s, p) => s + p.amount, 0);

            const paidForMe = debt.payments
              .filter(p => p.type === "دين لي" || (!p.type && debt.type === "دين لي"))
              .reduce((s, p) => s + p.amount, 0);

            const net = debt.type === "دين علي"
              ? (debt.amount - paidOnMe) + paidForMe
              : (debt.amount - paidForMe) + paidOnMe;

            const isPaid = net <= 0;
            const isOwedToMe = debt.type === "دين لي";
            const c = isOwedToMe 
              ? { bg: "bg-emerald-500", text: "text-emerald-500", border: "border-emerald-200 dark:border-emerald-800/50", lightBg: "bg-emerald-50 dark:bg-emerald-900/20" }
              : { bg: "bg-rose-500", text: "text-rose-500", border: "border-rose-200 dark:border-rose-800/50", lightBg: "bg-rose-50 dark:bg-rose-900/20" };

            return { isVirtualCake, paidOnMe, paidForMe, net, isPaid, isOwedToMe, c };
          };

          const activeDebts = [...effectiveDebts]
            .filter(d => !getDebtStats(d).isPaid)
            .sort((a, b) => b.date.localeCompare(a.date));

          const completedDebts = [...effectiveDebts]
            .filter(d => getDebtStats(d).isPaid)
            .sort((a, b) => b.date.localeCompare(a.date));

          const renderSingleDebt = (debt: Debt, isCompleted: boolean) => {
            const { isVirtualCake, paidOnMe, paidForMe, net, isPaid, isOwedToMe, c } = getDebtStats(debt);

            if (isCompleted) {
              return (
                <div 
                  key={debt.id} 
                  className="bg-slate-100/90 dark:bg-zinc-900/90 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-3 sm:p-4 text-slate-800 dark:text-zinc-200 shadow-sm opacity-50 hover:opacity-100 grayscale-[0.6] hover:grayscale-0 relative overflow-hidden transition-all duration-300 min-h-[260px] flex flex-col justify-between"
                >
                  <div>
                    {/* Header */}
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                          {debt.type === "دين لي" ? "دين لي (أطلب)" : "دين عليّ (مطلوب)"}
                        </span>
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/50">
                          ✅ خالص ومسدد
                        </span>
                      </div>
                      <span className="text-[9px] text-gray-400 font-bold">{new Date(debt.date).toLocaleDateString("ar-IQ")}</span>
                    </div>

                    {/* Person & Initial Amount */}
                    <div className="mb-2">
                      <h3 className="font-black line-through text-slate-500 dark:text-zinc-400 text-sm sm:text-base truncate" title={debt.person}>{debt.person}</h3>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[9px] text-gray-400 font-bold">المبلغ الأساسي:</span>
                        <span className="font-black text-xs text-gray-500 dark:text-zinc-400 line-through">{fmt(debt.amount)} <span className="text-[8px] text-gray-400">د.ع</span></span>
                      </div>
                    </div>

                    {/* Center Box: Settled Status */}
                    <div className="bg-white/80 dark:bg-zinc-800/60 rounded-2xl p-2.5 mb-2.5 border border-slate-200 dark:border-zinc-700/60 text-center">
                      <span className="text-[9px] font-bold text-gray-400 block mb-0.5">حالة الحساب النهائية:</span>
                      <div className="font-black text-xs text-emerald-600 dark:text-emerald-400">
                        {net === 0 ? "خالص تماماً (0 د.ع) ✅" : net < 0 ? (
                          debt.type === "دين علي" ? `فائض لصالحك: ${fmt(Math.abs(net))} د.ع 🟢` : `فائض لصالحه: ${fmt(Math.abs(net))} د.ع 🔴`
                        ) : "مسدد ✅"}
                      </div>
                      <div className="text-[9px] text-gray-400 font-bold mt-1">
                        إجمالي {debt.type === "دين علي" ? "المسدد" : "المقبوض"}: {fmt(debt.type === "دين علي" ? paidOnMe : paidForMe)} د.ع
                      </div>
                    </div>
                  </div>

                  {/* Actions & History */}
                  <div>
                    <div className="flex items-center justify-between pt-1.5 border-t border-gray-200 dark:border-zinc-800 text-[9px]">
                      <div className="flex items-center gap-1">
                        {!isVirtualCake && (
                          <>
                            <button onClick={() => { setEditDebt(debt); setShowDebtModal(true); }} className="p-1 bg-white dark:bg-zinc-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition text-gray-500" title="تعديل">
                              <Edit2 className="w-2.5 h-2.5" />
                            </button>
                            <button onClick={() => handleDeleteDebt(debt.id)} className="p-1 bg-white dark:bg-zinc-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition text-gray-500" title="حذف">
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </>
                        )}
                        {debt.payments.length > 0 && (
                          <button onClick={() => setShowDebtHistory(showDebtHistory === debt.id ? null : debt.id)} className="px-1.5 py-0.5 bg-white dark:bg-zinc-800 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition text-gray-600 dark:text-gray-300 font-bold text-[9px]">
                            {showDebtHistory === debt.id ? "إخفاء" : `سجل (${debt.payments.length})`}
                          </button>
                        )}
                      </div>

                      {debt.payments.length > 0 && !isVirtualCake && (
                        <button onClick={() => handleUndoDebtPayment(debt)}
                          className="bg-white hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-600 dark:text-gray-300 text-[9px] font-bold px-1.5 py-0.5 rounded-lg active:scale-95 transition"
                          title="تراجع عن آخر دفعة">
                          تراجع ↩️
                        </button>
                      )}
                    </div>

                    {showDebtHistory === debt.id && debt.payments.length > 0 && (
                      <div className="mt-2 rounded-xl p-2 bg-white dark:bg-zinc-800/80 max-h-32 overflow-y-auto space-y-1 border border-slate-200 dark:border-zinc-800">
                        <div className="text-[9px] font-bold text-gray-500 mb-0.5 px-0.5">سجل التسديدات ({debt.payments.length}):</div>
                        {[...debt.payments].reverse().map((pay, pi) => {
                          const isPayForMe = pay.type ? pay.type === "دين لي" : debt.type === "دين لي";
                          return (
                            <div key={pi} className="flex justify-between items-center text-[9px] bg-slate-50 dark:bg-zinc-900 rounded-lg px-2 py-1 border border-gray-100 dark:border-zinc-800 shadow-xs">
                              <div className="flex items-center gap-1 font-bold">
                                <span className={`px-1 py-0.2 rounded text-[7px] font-black ${isPayForMe ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400'}`}>
                                  {isPayForMe ? 'قبض' : 'دفع'}
                                </span>
                                <span className="text-gray-800 dark:text-gray-200">{fmt(pay.amount)} د.ع</span>
                              </div>
                              <span className="text-gray-400 text-[8px]">{new Date(pay.date).toLocaleDateString("ar-IQ")}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div key={debt.id} className={`bg-white dark:bg-zinc-900 rounded-3xl p-3 sm:p-4 border ${c.border} shadow-sm overflow-hidden relative flex flex-col justify-between transition-all min-h-[260px]`}>
                <div>
                  {/* Header */}
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg ${c.lightBg} ${c.text}`}>
                        {debt.type === "دين لي" ? "دين لي (أطلب)" : "دين عليّ (مطلوب)"}
                      </span>
                    </div>
                    <span className="text-[9px] text-gray-400 font-bold">{new Date(debt.date).toLocaleDateString("ar-IQ")}</span>
                  </div>

                  {/* Person & Initial Amount */}
                  <div className="mb-2">
                    <h3 className="font-black text-gray-900 dark:text-white text-sm sm:text-base truncate" title={debt.person}>{debt.person}</h3>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[9px] text-gray-400 font-bold">المبلغ الأساسي:</span>
                      <span className="font-black text-xs text-gray-700 dark:text-gray-200">{fmt(debt.amount)} <span className="text-[8px] text-gray-400">د.ع</span></span>
                    </div>
                  </div>

                  {/* Center Box: Financial Balance */}
                  {!!debt.monthlyInstallment && !!debt.totalMonths ? (
                    <div className="grid grid-cols-2 gap-1.5 mb-2.5">
                      <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-1.5 text-center">
                        <div className="text-[8px] text-gray-500 font-bold">القسط</div>
                        <div className="font-black text-gray-700 dark:text-gray-300 text-[10px] sm:text-xs">{fmt(debt.monthlyInstallment)}</div>
                      </div>
                      <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-xl p-1.5 text-center">
                        <div className="text-[8px] text-emerald-600 dark:text-emerald-500 font-bold">المسدد</div>
                        <div className="font-black text-emerald-600 dark:text-emerald-500 text-[10px] sm:text-xs">{fmt(debt.type === "دين علي" ? paidOnMe : paidForMe)}</div>
                      </div>
                      <div className="bg-rose-50 dark:bg-rose-900/10 rounded-xl p-1.5 text-center col-span-2">
                        <div className="text-[8px] text-rose-600 dark:text-rose-500 font-bold">المتبقي الصافي</div>
                        <div className="font-black text-rose-600 dark:text-rose-500 text-xs sm:text-sm">{fmt(Math.max(0, net))} د.ع</div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50/80 dark:bg-zinc-800/50 rounded-2xl p-2 mb-2.5 border border-gray-100 dark:border-zinc-800/80">
                      <div className="flex justify-between items-center text-[9px] pb-1.5 mb-1.5 border-b border-gray-200/50 dark:border-zinc-700/50">
                        <span className="text-gray-500 dark:text-gray-400 font-bold">
                          {debt.type === "دين علي" ? "المسدد الإجمالي:" : "المقبوض الإجمالي:"}
                        </span>
                        <span className="font-black text-emerald-600 dark:text-emerald-400 text-[10px]">
                          {fmt(debt.type === "دين علي" ? paidOnMe : paidForMe)} د.ع
                        </span>
                      </div>
                      
                      {/* Net Balance Status */}
                      <div className="text-center pt-0.5">
                        <span className="text-[8px] font-bold text-gray-400 block mb-0.5">صافي الحساب:</span>
                        <div className="font-black text-xs leading-tight">
                          {net > 0 ? (
                            debt.type === "دين علي" ? (
                              <span className="text-rose-600 dark:text-rose-400">بذمتك له: {fmt(net)} د.ع</span>
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400">بذمته لك: {fmt(net)} د.ع</span>
                            )
                          ) : net === 0 ? (
                            <span className="text-emerald-500 dark:text-emerald-400 text-[11px]">خالص تماماً (0 د.ع) ✅</span>
                          ) : (
                            debt.type === "دين علي" ? (
                              <span className="text-emerald-600 dark:text-emerald-400 text-[11px]">تطلبه بالصافي: {fmt(Math.abs(net))} 🟢</span>
                            ) : (
                              <span className="text-rose-600 dark:text-rose-400 text-[11px]">يطلبك بالصافي: {fmt(Math.abs(net))} 🔴</span>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Dual Settlement Buttons */}
                <div>
                  {isVirtualCake ? (
                    !isPaid && (
                      <button onClick={() => handlePayDebt(debt)}
                        className={`w-full ${debt.type === "دين علي" ? "bg-rose-500 hover:bg-rose-600" : "bg-emerald-500 hover:bg-emerald-600"} text-white text-[11px] font-black py-2 rounded-xl active:scale-95 transition shadow-sm flex items-center justify-center gap-1`}>
                        <Check className="w-3.5 h-3.5" /> {debt.type === "دين علي" ? "تسديد وإرجاع دين الكيك (دفع للكيك)" : "تسديد دين الكيك (قبض للراتب)"}
                      </button>
                    )
                  ) : (
                    <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-gray-100 dark:border-zinc-800">
                      <button 
                        type="button"
                        onClick={() => handlePayDebt(debt, "دين علي")}
                        className="w-full bg-rose-500 hover:bg-rose-600 active:scale-95 text-white text-[10px] font-black py-1.5 px-1 rounded-xl transition shadow-xs flex items-center justify-center gap-1"
                        title="تسديد دين عليّ (دفع نقود من جيبي - يُسجل كمصروف)"
                      >
                        <span>دفع (عليّ)</span>
                      </button>

                      <button 
                        type="button"
                        onClick={() => handlePayDebt(debt, "دين لي")}
                        className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-[10px] font-black py-1.5 px-1 rounded-xl transition shadow-xs flex items-center justify-center gap-1"
                        title="تسديد دين لي (استلام نقود في جيبي - يُسجل كدخل)"
                      >
                        <span>قبض (لي)</span>
                      </button>
                    </div>
                  )}

                  {/* Bottom Actions Bar */}
                  <div className="flex items-center justify-between pt-1.5 mt-1.5 border-t border-gray-100 dark:border-zinc-800 text-[9px]">
                    <div className="flex items-center gap-1">
                      {!isVirtualCake && (
                        <>
                          <button onClick={() => { setEditDebt(debt); setShowDebtModal(true); }} className="p-1 bg-gray-100 dark:bg-zinc-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition text-gray-500" title="تعديل">
                            <Edit2 className="w-2.5 h-2.5" />
                          </button>
                          <button onClick={() => handleDeleteDebt(debt.id)} className="p-1 bg-gray-100 dark:bg-zinc-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition text-gray-500" title="حذف">
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </>
                      )}
                      {debt.payments.length > 0 && (
                        <button onClick={() => setShowDebtHistory(showDebtHistory === debt.id ? null : debt.id)} className="px-1.5 py-0.5 bg-gray-100 dark:bg-zinc-800 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition text-gray-600 dark:text-gray-300 font-bold text-[9px]">
                          {showDebtHistory === debt.id ? "إخفاء" : `سجل (${debt.payments.length})`}
                        </button>
                      )}
                    </div>

                    {debt.payments.length > 0 && !isVirtualCake && (
                      <button onClick={() => handleUndoDebtPayment(debt)}
                        className="bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-600 dark:text-gray-300 text-[9px] font-bold px-1.5 py-0.5 rounded-lg active:scale-95 transition"
                        title="تراجع عن آخر دفعة">
                        تراجع ↩️
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Payment History Expandable List */}
                {showDebtHistory === debt.id && debt.payments.length > 0 && (
                  <div className="mt-2 rounded-xl p-2 bg-gray-50 dark:bg-zinc-800/80 max-h-32 overflow-y-auto space-y-1 border border-gray-100 dark:border-zinc-800">
                    <div className="text-[9px] font-bold text-gray-500 mb-0.5 px-0.5">سجل التسديدات ({debt.payments.length}):</div>
                    {[...debt.payments].reverse().map((pay, pi) => {
                      const isPayForMe = pay.type ? pay.type === "دين لي" : debt.type === "دين لي";
                      return (
                        <div key={pi} className="flex justify-between items-center text-[9px] bg-white dark:bg-zinc-900 rounded-lg px-2 py-1 border border-gray-100 dark:border-zinc-800 shadow-xs">
                          <div className="flex items-center gap-1 font-bold">
                            <span className={`px-1 py-0.2 rounded text-[7px] font-black ${isPayForMe ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400'}`}>
                              {isPayForMe ? 'قبض' : 'دفع'}
                            </span>
                            <span className="text-gray-800 dark:text-gray-200">{fmt(pay.amount)} د.ع</span>
                          </div>
                          <span className="text-gray-400 text-[8px]">{new Date(pay.date).toLocaleDateString("ar-IQ")}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          };

          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-black text-gray-800 dark:text-white flex items-center gap-2">
                  <Banknote className="w-5 h-5 text-indigo-500" />
                  الديون والفائض
                </h2>
                <button onClick={() => setShowDebtModal(true)}
                  className="bg-indigo-500 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 shadow-lg shadow-indigo-500/25 active:scale-95 transition">
                  <Plus className="w-3.5 h-3.5" /> إضافة
                </button>
              </div>

              {/* Filter Tabs */}
              {effectiveDebts.length > 0 && (
                <div className="flex bg-gray-100 dark:bg-zinc-900 p-1 rounded-2xl gap-1">
                  <button
                    type="button"
                    onClick={() => setDebtFilter("active")}
                    className={`flex-1 py-1.5 text-xs font-black rounded-xl transition ${
                      debtFilter === "active"
                        ? "bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                        : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                    }`}
                  >
                    الديون المستمرة ({activeDebts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDebtFilter("completed")}
                    className={`flex-1 py-1.5 text-xs font-black rounded-xl transition ${
                      debtFilter === "completed"
                        ? "bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-sm"
                        : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                    }`}
                  >
                    الخالصة والمسددة ({completedDebts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDebtFilter("all")}
                    className={`flex-1 py-1.5 text-xs font-black rounded-xl transition ${
                      debtFilter === "all"
                        ? "bg-white dark:bg-zinc-800 text-gray-800 dark:text-white shadow-sm"
                        : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                    }`}
                  >
                    الكل ({effectiveDebts.length})
                  </button>
                </div>
              )}

              {effectiveDebts.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 text-center border border-gray-100 dark:border-zinc-800">
                  <Banknote className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-400 font-bold text-sm">لا توجد ديون أو فائض مسجل</p>
                </div>
              ) : debtFilter === "completed" ? (
                completedDebts.length === 0 ? (
                  <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 text-center border border-gray-100 dark:border-zinc-800">
                    <p className="text-gray-400 font-bold text-sm">لا توجد ديون خالصة حتى الآن</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {completedDebts.map(debt => renderSingleDebt(debt, true))}
                  </div>
                )
              ) : debtFilter === "all" ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {activeDebts.map(debt => renderSingleDebt(debt, false))}
                  </div>
                  {completedDebts.length > 0 && (
                    <div className="pt-4 border-t border-gray-200 dark:border-zinc-800 space-y-3">
                      <div className="text-xs font-black text-gray-400 flex items-center gap-1.5 px-1">
                        <span>✅</span>
                        <span>الديون الخالصة والمسددة بالكامل ({completedDebts.length}):</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {completedDebts.map(debt => renderSingleDebt(debt, true))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Default "active" view */
                <div className="space-y-4">
                  {activeDebts.length === 0 ? (
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-3xl p-8 text-center">
                      <span className="text-4xl block mb-2">🎉</span>
                      <h4 className="font-black text-emerald-800 dark:text-emerald-300 text-base">لا توجد أي ديون مستمرة!</h4>
                      <p className="text-xs font-bold text-emerald-600/80 dark:text-emerald-400 mt-1">جميع الديون والفائض خالصة ومسددة بالكامل</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {activeDebts.map(debt => renderSingleDebt(debt, false))}
                    </div>
                  )}

                  {/* Finished / Settled Debts Section at Bottom with faded look */}
                  {completedDebts.length > 0 && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setShowCompletedDebts(prev => !prev)}
                        className="w-full py-2.5 px-4 rounded-2xl bg-gray-100/80 dark:bg-zinc-900/80 hover:bg-gray-200/80 dark:hover:bg-zinc-800/80 text-xs font-black text-gray-500 dark:text-gray-400 flex items-center justify-between transition border border-gray-200/60 dark:border-zinc-800/60 active:scale-[0.99]"
                      >
                        <span className="flex items-center gap-1.5">
                          <span>✅</span>
                          <span>الديون الخالصة والمسددة</span>
                          <span className="text-[10px] bg-gray-200 dark:bg-zinc-800 px-2 py-0.5 rounded-full font-bold">({completedDebts.length})</span>
                        </span>
                        <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                          {showCompletedDebts ? "إخفاء ▲" : "عرض بالأسفل (ظل خافت) ▼"}
                        </span>
                      </button>

                      {showCompletedDebts && (
                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-3">
                          {completedDebts.map(debt => renderSingleDebt(debt, true))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* ═══════════════ CAR MANAGEMENT & EXPENSES TAB ═══════════════ */}
        {activeTab === "car" && (() => {
          // 1. Car Expenses (uses pre-memoized carExpenses)
          const searchedExpenses = carExpenses.filter(e => {
            if (!carSearch.trim()) return true;
            const q = normalizeArabicText(carSearch);
            return normalizeArabicText(e.name).includes(q) ||
                   normalizeArabicText(e.category).includes(q) ||
                   (e.items && e.items.some(it => normalizeArabicText(it.name).includes(q) || normalizeArabicText(it.place || "").includes(q)));
          });

          // Filter by category within car
          const filteredCarExpenses = searchedExpenses.filter(e => {
            if (carExpenseFilter === "fuel") return isCarFuelExpense(e);
            if (carExpenseFilter === "maintenance") return isCarMaintenanceExpense(e);
            if (carExpenseFilter === "other") return !isCarFuelExpense(e) && !isCarMaintenanceExpense(e);
            return true;
          });

          // Metrics
          const totalCarSpend = carExpenses.reduce((s, e) => s + (e.amount || 0), 0);
          const totalCarFuel = carExpenses.filter(e => isCarFuelExpense(e)).reduce((s, e) => s + (e.amount || 0), 0);
          const totalCarMaint = carExpenses.filter(e => isCarMaintenanceExpense(e)).reduce((s, e) => s + (e.amount || 0), 0);

          // 2. Car Inventory & Supplies
          const currentInv = carInventory;
          const currentShoppingList = currentInv.filter(i => (i.neededQuantity || 0) > 0);
          const searchedInv = currentInv.filter(item => {
            if (!carSearch.trim()) return true;
            const q = normalizeArabicText(carSearch);
            return normalizeArabicText(item.name).includes(q) || normalizeArabicText(item.category).includes(q);
          });
          const totalItems = currentInv.length;
          const okItems = currentInv.filter(i => i.quantity > i.threshold).length;
          const completionPct = totalItems > 0 ? (okItems / totalItems) * 100 : 100;

          return (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Header & Quick Action */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 text-white flex items-center justify-center text-xl shadow-md shadow-blue-500/20">
                    🚗
                  </div>
                  <div>
                    <h2 className="font-black text-gray-800 dark:text-white text-base sm:text-lg flex items-center gap-2">
                      <span>السيارة والمصاريف والصيانة</span>
                    </h2>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 font-bold">
                      سجل البنزين والصيانة، قطع الغيار، ومستلزمات السيارة
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setExpCategoryInput("السيارة والنقل");
                      setExpBeneficiary("السيارة");
                      setExpNameInput("بنزين / صيانة السيارة");
                      setShowExpenseModal(true);
                    }}
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white text-xs font-black px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-blue-500/20 active:scale-95 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة مصروف سيارة 🚗</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowInventoryModal(true)}
                    className="bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 hover:border-blue-400 text-gray-700 dark:text-gray-200 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 active:scale-95 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-blue-500" />
                    <span>مادة للموجودات 📦</span>
                  </button>
                </div>
              </div>

              {/* Top Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-transparent border border-blue-200/70 dark:border-blue-800/40 rounded-2xl p-3">
                  <div className="flex items-center justify-between text-xs font-bold text-blue-700 dark:text-blue-300 mb-1">
                    <span>إجمالي المصاريف</span>
                    <span>🚗</span>
                  </div>
                  <div className="text-base sm:text-lg font-black text-gray-900 dark:text-white">
                    {fmt(totalCarSpend)} <span className="text-[10px] text-gray-400">د.ع</span>
                  </div>
                  <div className="text-[10px] text-gray-400 font-bold mt-0.5">
                    {carExpenses.length} عملية مسجلة
                  </div>
                </div>

                <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-200/70 dark:border-amber-800/40 rounded-2xl p-3">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-700 dark:text-amber-300 mb-1">
                    <span>وقود وبنزين</span>
                    <span>⛽</span>
                  </div>
                  <div className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400">
                    {fmt(totalCarFuel)} <span className="text-[10px] text-gray-400">د.ع</span>
                  </div>
                  <div className="text-[10px] text-gray-400 font-bold mt-0.5">
                    {carExpenses.filter(e => isCarFuelExpense(e)).length} تفويلة
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-transparent border border-purple-200/70 dark:border-purple-800/40 rounded-2xl p-3">
                  <div className="flex items-center justify-between text-xs font-bold text-purple-700 dark:text-purple-300 mb-1">
                    <span>صيانة وفيتر</span>
                    <span>🔧</span>
                  </div>
                  <div className="text-base sm:text-lg font-black text-purple-600 dark:text-purple-400">
                    {fmt(totalCarMaint)} <span className="text-[10px] text-gray-400">د.ع</span>
                  </div>
                  <div className="text-[10px] text-gray-400 font-bold mt-0.5">
                    {carExpenses.filter(e => isCarMaintenanceExpense(e)).length} تصليح وصيانة
                  </div>
                </div>

                <div className="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-200/70 dark:border-emerald-800/40 rounded-2xl p-3">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-300 mb-1">
                    <span>موجودات السيارة</span>
                    <span>📦</span>
                  </div>
                  <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
                    {totalItems} <span className="text-[10px] text-gray-400">مادة</span>
                  </div>
                  <div className="text-[10px] text-gray-400 font-bold mt-0.5">
                    {currentShoppingList.length > 0 ? (
                      <span className="text-orange-500 font-black">⚠️ {currentShoppingList.length} نواقص</span>
                    ) : (
                      "جاهزة ومكتملة ✅"
                    )}
                  </div>
                </div>
              </div>

              {/* Sub-tab Navigation */}
              <div className="bg-gray-100/90 dark:bg-zinc-800/80 p-1.5 rounded-2xl flex items-center shadow-inner gap-1">
                <button
                  type="button"
                  onClick={() => setCarSubTab("expenses")}
                  className={`flex-1 py-2 text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    carSubTab === "expenses"
                      ? "bg-white shadow-sm dark:bg-zinc-700 text-blue-600 dark:text-blue-400"
                      : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                  }`}
                >
                  <span>🚗 سجل المصاريف والمشتريات</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold">
                    {carExpenses.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setCarSubTab("inventory")}
                  className={`flex-1 py-2 text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    carSubTab === "inventory"
                      ? "bg-white shadow-sm dark:bg-zinc-700 text-blue-600 dark:text-blue-400"
                      : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                  }`}
                >
                  <span>📦 مستلزمات وموجودات السيارة</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold">
                    {totalItems}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setCarSubTab("shopping")}
                  className={`flex-1 py-2 text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    carSubTab === "shopping"
                      ? "bg-white shadow-sm dark:bg-zinc-700 text-blue-600 dark:text-blue-400"
                      : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                  }`}
                >
                  <span>🛒 نواقص واحتياجات</span>
                  {currentShoppingList.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 font-bold">
                      {currentShoppingList.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Instant Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  placeholder={carSubTab === "expenses" ? "ابحث في مصاريف وصيانة وبنزين السيارة..." : "ابحث في مستلزمات وقطع غيار السيارة..."}
                  value={carSearch}
                  onChange={e => setCarSearch(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl px-4 py-2.5 pr-10 text-xs sm:text-sm font-bold text-gray-800 dark:text-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                {carSearch && (
                  <button onClick={() => setCarSearch('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">
                    ✕
                  </button>
                )}
              </div>

              {/* ─── TAB 1: CAR EXPENSES LOG ─── */}
              {carSubTab === "expenses" && (
                <div className="space-y-3">
                  {/* Category filter pills for car expenses */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs custom-scrollbar">
                    <span className="text-[10px] font-bold text-gray-400 shrink-0">التصنيف:</span>
                    {[
                      { id: "all", label: `الكل (${searchedExpenses.length})` },
                      { id: "fuel", label: `⛽ بنزين ووقود (${searchedExpenses.filter(e => isCarFuelExpense(e)).length})` },
                      { id: "maintenance", label: `🔧 صيانة وفيتر (${searchedExpenses.filter(e => isCarMaintenanceExpense(e)).length})` },
                      { id: "other", label: `🚗 غسيل وكراج وأخرى (${searchedExpenses.filter(e => !isCarFuelExpense(e) && !isCarMaintenanceExpense(e)).length})` }
                    ].map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setCarExpenseFilter(f.id as any)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition active:scale-95 shrink-0 ${
                          carExpenseFilter === f.id
                            ? "bg-blue-600 text-white shadow-xs font-black"
                            : "bg-white dark:bg-zinc-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-zinc-800 hover:border-blue-300"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {filteredCarExpenses.length === 0 ? (
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 text-center border border-gray-100 dark:border-zinc-800">
                      <span className="text-3xl block mb-2">🚗</span>
                      <p className="text-gray-500 dark:text-gray-400 font-bold text-sm">
                        لا توجد مصاريف أو وصولات مسجلة للسيارة
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        أي مصروف تضيفه وتكتب فيه &quot;سيارة&quot; أو &quot;بنزين&quot; أو فئته سيارة سيظهر هنا تلقائياً
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {filteredCarExpenses.map(exp => {
                        const isFuel = isCarFuelExpense(exp);
                        const isMaint = isCarMaintenanceExpense(exp);
                        const expIcon = isFuel ? "⛽" : isMaint ? "🔧" : "🚗";

                        return (
                          <div
                            key={exp.id}
                            className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-800/60 rounded-2xl p-3.5 shadow-xs transition"
                          >
                            <div className="flex items-start justify-between gap-3">
                              {/* Right details */}
                              <div className="flex items-start gap-3 min-w-0 flex-1">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                                  isFuel ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300" :
                                  isMaint ? "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300" :
                                  "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                                }`}>
                                  {expIcon}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="font-black text-sm text-gray-900 dark:text-white leading-tight">
                                      {exp.name}
                                    </h4>
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/50">
                                      {isFuel ? "وقود وبنزين" : isMaint ? "صيانة وتصليح" : exp.category}
                                    </span>
                                    {(exp as any).isPartialCarReceipt && (
                                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/50" title={`إجمالي الفاتورة الكاملة: ${fmt((exp as any).originalTotalAmount || 0)} د.ع`}>
                                        مستلزمات سيارة فقط
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400 font-bold flex-wrap">
                                    <span>📅 {exp.date}</span>
                                    {exp.items && exp.items.length > 0 && (
                                      <span className="text-gray-500 font-bold">
                                        📦 {exp.items.length} {(exp as any).isPartialCarReceipt ? `مواد خاصة بالسيارة (من أصل ${(exp as any).originalItemCount})` : "مواد"}
                                      </span>
                                    )}
                                  </div>

                                  {/* Itemized sub-rows */}
                                  {exp.items && exp.items.length > 0 && (
                                    <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-zinc-800/80 flex flex-wrap gap-1.5">
                                      {exp.items.map((it, idx) => {
                                        const pInfo = it.priority ? getProductPriorityInfo(it.priority) : null;
                                        return (
                                          <div
                                            key={idx}
                                            className="text-[11px] font-bold bg-blue-50/60 dark:bg-blue-950/30 px-2.5 py-1 rounded-lg border border-blue-200/60 dark:border-blue-800/40 flex items-center gap-1.5 text-blue-900 dark:text-blue-200 shadow-2xs"
                                          >
                                            <span>🚗</span>
                                            <span>{it.name}</span>
                                            {it.quantity && it.quantity > 1 && (
                                              <span className="text-blue-500 dark:text-blue-400 text-[10px]">×{it.quantity}</span>
                                            )}
                                            {it.price > 0 && (
                                              <span className="text-rose-600 dark:text-rose-400 font-black mr-1">{fmt(it.price)} د.ع</span>
                                            )}
                                            {pInfo && (
                                              <span className={`text-[9px] px-1 py-0.2 rounded ${pInfo.bgClass} ${pInfo.colorClass}`}>
                                                {pInfo.badge}
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Left price & actions */}
                              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                <div className="text-sm sm:text-base font-black text-rose-600 dark:text-rose-400">
                                  {fmt(exp.amount)} <span className="text-[10px] text-gray-400">د.ع</span>
                                </div>

                                <div className="flex items-center gap-1">
                                  {(exp.imageUrl || (exp.receiptImages && exp.receiptImages.length > 0)) && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const orig = expenses.find(x => x.id === exp.id) || exp;
                                        setViewingReceiptExpense(orig);
                                        setReceiptItemFilter("");
                                      }}
                                      className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition"
                                      title="عرض الوصل والصور"
                                    >
                                      <Receipt className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const orig = expenses.find(x => x.id === exp.id) || exp;
                                      setEditExpense(orig);
                                      setShowExpenseModal(true);
                                    }}
                                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition"
                                    title="تعديل"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteExpense(exp.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition"
                                    title="حذف"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ─── TAB 2: CAR INVENTORY / SUPPLIES ─── */}
              {carSubTab === "inventory" && (
                <div className="space-y-3">
                  {/* Completion bar */}
                  {totalItems > 0 && (
                    <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-500">اكتمال موجودات السيارة</span>
                        <span className="text-xs font-black text-gray-700 dark:text-gray-300">{okItems}/{totalItems} سليم ومتوفر</span>
                      </div>
                      <div className="h-2.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${completionPct >= 80 ? 'bg-gradient-to-l from-emerald-500 to-teal-500' : completionPct >= 50 ? 'bg-gradient-to-l from-amber-500 to-orange-400' : 'bg-gradient-to-l from-red-500 to-rose-500'}`}
                          style={{ width: `${completionPct}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-gray-400 text-center mt-1 font-bold">{completionPct.toFixed(0)}% مكتمل</div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    {searchedInv.map(item => {
                      const low = item.quantity <= item.threshold;
                      const stockPct = Math.min(100, Math.round((Number(item.quantity) / Math.max(1, (Number(item.threshold) || 1) * 2)) * 100));
                      return (
                        <div key={item.id} className={`rounded-2xl p-3 border ${low ? "border-orange-200 dark:border-orange-800/50 bg-orange-50/50 dark:bg-orange-900/10" : "border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900"} shadow-sm flex flex-col gap-2 relative overflow-hidden`}>
                          <div className={`absolute top-0 right-0 left-0 h-1 ${low ? 'bg-gradient-to-r from-orange-400 to-red-500' : 'bg-gradient-to-r from-blue-400 to-cyan-500'} opacity-60 rounded-t-2xl`} />
                          
                          <div className="flex items-start justify-between mt-0.5">
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden ${low ? "bg-orange-100 dark:bg-orange-900/30" : "bg-blue-100 dark:bg-blue-900/30"}`}>
                              {item.imageUrl ? (
                                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-xl">🔧</span>
                              )}
                            </div>
                            <div className="flex gap-0.5">
                              <button onClick={() => { setEditInventory(item); setShowInventoryModal(true); }} className="p-1 bg-white/70 dark:bg-zinc-800/70 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition">
                                <Edit2 className="w-3 h-3 text-gray-500" />
                              </button>
                              <button onClick={() => handleDeleteInventoryItem(item.id)} className="p-1 bg-white/70 dark:bg-zinc-800/70 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition">
                                <Trash2 className="w-3 h-3 text-gray-500" />
                              </button>
                            </div>
                          </div>

                          <div>
                            <div className="font-black text-gray-800 dark:text-gray-100 text-xs line-clamp-1">{item.name}</div>
                            <div className="text-[10px] text-gray-500 font-bold mt-0.5">السعر: {item.estimatedPrice ? fmt(item.estimatedPrice) : '0'} د.ع</div>
                            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                              {low && <span className="text-[8px] bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 px-1 py-0.5 rounded-full font-black animate-pulse">⚠️ نقص</span>}
                              <span className="text-[9px] text-gray-400">{item.category}</span>
                            </div>
                          </div>

                          <div className="h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${stockPct > 60 ? 'bg-blue-500' : stockPct > 30 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${stockPct}%` }} />
                          </div>

                          <div className="flex items-center justify-between mt-auto">
                            <div className="flex items-center gap-1 bg-gray-100 dark:bg-zinc-800 rounded-xl p-0.5 w-full justify-between">
                              <button onClick={() => updateQty(item.id, -1)} className="w-6 h-6 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-lg flex items-center justify-center hover:bg-red-200 transition">
                                <Minus className="w-2.5 h-2.5" />
                              </button>
                              <span className="font-black text-xs text-gray-800 dark:text-gray-200 text-center">{item.quantity}<span className="text-[9px] text-gray-400 font-normal ml-1">{item.unit}</span></span>
                              <button onClick={() => updateQty(item.id, 1)} className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg flex items-center justify-center hover:bg-blue-200 transition">
                                <Plus className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ─── TAB 3: CAR SHOPPING & NEEDS ─── */}
              {carSubTab === "shopping" && (
                <div className="space-y-3">
                  {currentShoppingList.length === 0 ? (
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 text-center border border-gray-100 dark:border-zinc-800">
                      <span className="text-3xl block mb-2">🎉</span>
                      <p className="text-gray-500 dark:text-gray-400 font-bold text-sm">
                        لا توجد نواقص مطلوبة للسيارة حالياً، كل الاحتياجات متوفرة!
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {currentShoppingList.map(item => {
                        const estimatedTotal = (item.neededQuantity || 1) * (item.estimatedPrice || 0);
                        return (
                          <div key={item.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-orange-200 dark:border-orange-800/40 shadow-sm p-3 flex flex-col justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/60 flex items-center justify-center text-xl flex-shrink-0">
                                🔧
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-black text-xs text-gray-900 dark:text-white truncate">{item.name}</div>
                                <div className="text-[10px] text-orange-600 dark:text-orange-400 font-bold mt-0.5">
                                  نقص: {item.neededQuantity} {item.unit}
                                </div>
                              </div>
                            </div>

                            {estimatedTotal > 0 && (
                              <div className="text-[11px] font-black text-gray-700 dark:text-gray-300">
                                التكلفة التقديرية: {fmt(estimatedTotal)} د.ع
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setFulfillModal({
                                  isOpen: true,
                                  title: item.name,
                                  category: "السيارة والنقل",
                                  estimatedPrice: estimatedTotal,
                                  quantity: item.neededQuantity || 1,
                                  type: "shopping",
                                  item: { ...item, _source: "car" }
                                });
                              }}
                              className="w-full py-1.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-xs active:scale-95 transition"
                            >
                              شراء وتوفير 🛒
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* ═══════════════ INVENTORY TABS ═══════════════ */}
        {["inventory", "travel"].includes(activeTab) && (() => {
          const { data: currentInv } = getActiveInventory();
          const currentShoppingList = currentInv.filter(i => (i.neededQuantity || 0) > 0);
          const filteredInv = currentInv.filter(item =>
            !inventorySearch || item.name.includes(inventorySearch) || item.category.includes(inventorySearch)
          );
          const totalItems = currentInv.length;
          const okItems = currentInv.filter(i => i.quantity > i.threshold).length;
          const completionPct = totalItems > 0 ? (okItems / totalItems) * 100 : 100;
          
          let title = "موجودات البيت";
          let TabIcon = Package;
          if (activeTab === "travel") { title = "السفر"; TabIcon = Plane; }

          return (
            <div className="space-y-3">
              {activeTab === "travel" && (
                <div className="bg-gray-100/80 dark:bg-zinc-800/80 p-1.5 rounded-2xl flex items-center mb-2 shadow-inner">
                  <button onClick={() => setTravelSubTab('inventory')} className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${travelSubTab === 'inventory' ? 'bg-white shadow-sm dark:bg-zinc-700 text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}>🎒 مستلزمات السفر</button>
                  <button onClick={() => setTravelSubTab('trips')} className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${travelSubTab === 'trips' ? 'bg-white shadow-sm dark:bg-zinc-700 text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}>🌍 الرحلات والمصاريف</button>
                </div>
              )}

              {(activeTab !== "travel" || travelSubTab === "inventory") && (
                <>
                  <div className="flex items-center justify-between">
                    <h2 className="font-black text-gray-800 dark:text-white flex items-center gap-2">
                      <TabIcon className="w-5 h-5 text-teal-500" />
                      {title}
                    </h2>
                    <button onClick={() => setShowInventoryModal(true)}
                      className="bg-teal-500 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 shadow-lg shadow-teal-500/25 active:scale-95 transition">
                      <Plus className="w-3.5 h-3.5" /> إضافة
                    </button>
                  </div>

              {/* Inventory Completion Progress */}
              {totalItems > 0 && (
                <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-500">اكتمال الموجودات</span>
                    <span className="text-xs font-black text-gray-700 dark:text-gray-300">{okItems}/{totalItems} عنصر سليم</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${completionPct >= 80 ? 'bg-gradient-to-l from-emerald-500 to-teal-500' : completionPct >= 50 ? 'bg-gradient-to-l from-amber-500 to-orange-400' : 'bg-gradient-to-l from-red-500 to-rose-500'}`}
                      style={{ width: `${completionPct}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-gray-400 text-center mt-1 font-bold">{completionPct.toFixed(0)}% مكتمل</div>
                </div>
              )}

              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="ابحث في موجودات البيت..."
                  value={inventorySearch}
                  onChange={e => setInventorySearch(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl px-4 py-2.5 pr-10 text-sm font-bold text-gray-800 dark:text-white outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                {inventorySearch && (
                  <button onClick={() => setInventorySearch('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {currentShoppingList.length > 0 && (
                <div className="bg-orange-50 dark:bg-orange-900/15 border border-orange-200 dark:border-orange-800/40 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-4 h-4 text-orange-500 animate-pulse" />
                    <span className="text-orange-700 dark:text-orange-400 font-black text-sm">تحتاج شراء ({currentShoppingList.length} مواد)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {currentShoppingList.map(item => {
                      const estimatedTotal = (item.neededQuantity || 1) * (item.estimatedPrice || 0);
                      return (
                      <div key={item.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-orange-100 dark:border-orange-800/30 shadow-sm overflow-hidden flex flex-col relative aspect-square">
                        <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-orange-400 to-red-500 opacity-60 rounded-t-2xl" />
                        
                        <div className="flex flex-col gap-1.5 flex-1 items-center text-center justify-center pt-2">
                          <div className="w-10 h-10 bg-orange-100 dark:bg-orange-800/30 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden relative">
                            {(item.imageUrl || (item as any).tempImageUrl) ? (
                              <img src={item.imageUrl || (item as any).tempImageUrl} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xl">{item.category === "كريمات" ? "🧁" : item.category === "حشوات" ? "🍫" : item.category === "طحين وسكر" ? "🌾" : item.category === "ألوان وإضافات" ? "🎨" : item.category === "تغليف وزينة" ? "🎀" : item.category === "أدوات" ? "🔧" : activeTab === "car" ? "🔧" : activeTab === "travel" ? "🧳" : "📦"}</span>
                            )}
                          </div>
                          
                          <div className="flex gap-1 absolute top-2 left-2">
                             <button onClick={() => { setEditInventory(item); setShowInventoryModal(true); }} className="p-1 bg-gray-100 dark:bg-zinc-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition">
                               <Edit2 className="w-3 h-3 text-gray-500" />
                             </button>
                          </div>

                          <div className="min-w-0 flex flex-col gap-0.5">
                            <div className="font-black text-xs text-gray-800 dark:text-gray-100 line-clamp-2 leading-tight px-1">{item.name}</div>
                          </div>
                        </div>

                        <div className="text-[9px] text-gray-500 flex flex-col gap-0.5 text-center mt-1">
                          <span>متوفر: {item.quantity} {item.unit} | تحتاج: {item.neededQuantity}</span>
                          {estimatedTotal > 0 && <span className="text-orange-600 dark:text-orange-400 font-black">{fmt(estimatedTotal)} د.ع</span>}
                        </div>

                        <div className="p-2 mt-auto">
                          <button onClick={() => {
                              setFulfillModal({
                                isOpen: true,
                                title: item.name,
                                category: item.category || (activeTab === "car" ? "السيارة" : activeTab === "travel" ? "السفر" : "موجودات البيت"),
                                estimatedPrice: estimatedTotal,
                                quantity: item.neededQuantity || 1,
                                type: "shopping",
                                item: { ...item, _source: activeTab === "car" ? "car" : activeTab === "travel" ? "travel" : "inventory" }
                              });
                            }}
                            className="w-full bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-black px-3 py-1.5 rounded-xl active:scale-95 transition flex items-center justify-center gap-1">
                            شراء
                          </button>
                        </div>
                      </div>
                    )})}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {(filteredInv.length > 0 ? filteredInv : currentInv).map(item => {
                  const low = item.quantity <= item.threshold;
                  const stockPct = Math.min(100, Math.round((Number(item.quantity) / Math.max(1, (Number(item.threshold) || 1) * 2)) * 100));
                  return (
                    <div key={item.id} className={`rounded-2xl p-3 border ${low ? "border-orange-200 dark:border-orange-800/50 bg-orange-50/50 dark:bg-orange-900/10" : "border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900"} shadow-sm flex flex-col gap-2 relative overflow-hidden`}>
                      <div className={`absolute top-0 right-0 left-0 h-1 ${low ? 'bg-gradient-to-r from-orange-400 to-red-500' : 'bg-gradient-to-r from-teal-400 to-emerald-500'} opacity-60 rounded-t-2xl`} />
                      {/* Image + Actions */}
                      <div className="flex items-start justify-between mt-0.5">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden ${low ? "bg-orange-100 dark:bg-orange-900/30" : "bg-teal-100 dark:bg-teal-900/30"}`}>
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xl">{activeTab === "car" ? "🔧" : activeTab === "travel" ? "🧳" : "📦"}</span>
                          )}
                        </div>
                        <div className="flex gap-0.5">
                          <button onClick={() => { setEditInventory(item); setShowInventoryModal(true); }} className="p-1 bg-white/70 dark:bg-zinc-800/70 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition">
                            <Edit2 className="w-3 h-3 text-gray-500" />
                          </button>
                          <button onClick={() => handleDeleteInventoryItem(item.id)} className="p-1 bg-white/70 dark:bg-zinc-800/70 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition">
                            <Trash2 className="w-3 h-3 text-gray-500" />
                          </button>
                        </div>
                      </div>
                      {/* Name + Low badge */}
                      <div>
                        <div className="font-black text-gray-800 dark:text-gray-100 text-xs line-clamp-1">{item.name}</div>
                        <div className="text-[10px] text-gray-500 font-bold mt-0.5">السعر: {item.estimatedPrice ? fmt(item.estimatedPrice) : '0'} د.ع</div>
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          {low && <span className="text-[8px] bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 px-1 py-0.5 rounded-full font-black animate-pulse">⚠️ نقص</span>}
                          <span className="text-[9px] text-gray-400">{item.category}</span>
                        </div>
                      </div>
                      {/* Stock progress */}
                      <div className="h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${stockPct > 60 ? 'bg-teal-500' : stockPct > 30 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${stockPct}%` }} />
                      </div>
                      {/* Qty stepper */}
                      <div className="flex items-center justify-between mt-auto">
                        <div className="flex items-center gap-1 bg-gray-100 dark:bg-zinc-800 rounded-xl p-0.5 w-full justify-between">
                          <button onClick={() => updateQty(item.id, -1)} className="w-6 h-6 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-lg flex items-center justify-center hover:bg-red-200 transition">
                            <Minus className="w-2.5 h-2.5" />
                          </button>
                          <span className="font-black text-xs text-gray-800 dark:text-gray-200 text-center">{item.quantity}<span className="text-[9px] text-gray-400 font-normal ml-1">{item.unit}</span></span>
                          <button onClick={() => updateQty(item.id, 1)} className="w-6 h-6 bg-teal-100 dark:bg-teal-900/30 text-teal-600 rounded-lg flex items-center justify-center hover:bg-teal-200 transition">
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              </>
            )}

            {activeTab === "travel" && travelSubTab === "trips" && (
              <div className="space-y-4">
                {/* Header & Add Button */}
                {!selectedTrip ? (
                  <>
                    <div className="flex items-center justify-between">
                      <h3 className="font-black text-gray-800 dark:text-white flex items-center gap-2">
                        <MapIcon className="w-5 h-5 text-blue-500" />
                        رحلات السفر
                      </h3>
                      <button onClick={() => { 
                        setEditTrip(null); 
                        setTripModalDestination("");
                        setTripModalMembers([]);
                        setTripModalMemberInput("");
                        setShowTripModal(true); 
                      }}
                        className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 shadow-lg shadow-blue-500/25 active:scale-95 transition">
                        <Plus className="w-3.5 h-3.5" /> رحلة جديدة
                      </button>
                    </div>

                    {/* Trips List */}
                    {travelTrips.length === 0 ? (
                      <div className="text-center py-10 bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-gray-200 dark:border-zinc-800">
                        <Plane className="w-12 h-12 mx-auto text-gray-300 dark:text-zinc-700 mb-3" />
                        <p className="text-gray-500 font-bold text-sm">لا توجد رحلات مضافة بعد.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {travelTrips.map(trip => (
                          <div key={trip.id} onClick={() => setSelectedTrip(trip)} className="cursor-pointer bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-zinc-800 hover:border-blue-500/50 hover:shadow-md transition group aspect-square flex flex-col justify-center relative overflow-hidden">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-black text-gray-800 dark:text-white text-[15px] sm:text-lg flex items-center gap-1.5 group-hover:text-blue-500 transition line-clamp-1">
                                <MapPin className="w-4 h-4 text-red-500 flex-shrink-0" /> {trip.destination}
                              </h4>
                            </div>
                            <p className="text-[11px] sm:text-xs font-bold text-gray-500 dark:text-gray-400 mb-3 ml-1 line-clamp-1">
                              {trip.name}
                            </p>
                            <div className="flex items-center gap-1 flex-wrap mt-auto">
                              {trip.members.slice(0, 3).map(m => (
                                <span key={m} className="bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 text-[9px] font-bold px-2 py-1 rounded-md">
                                  {m}
                                </span>
                              ))}
                              {trip.members.length > 3 && (
                                <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[9px] font-bold px-1.5 py-1 rounded-md">
                                  +{trip.members.length - 3}
                                </span>
                              )}
                            </div>
                            <div className="absolute top-3 left-3">
                              <span className="text-[9px] font-bold text-gray-400 bg-gray-50 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md">{trip.createdAt.split('T')[0]}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 overflow-hidden shadow-sm">
                    {(() => {
                      // Calculations
                      const tripExps = travelExpenses.filter(e => e.tripId === selectedTrip.id);
                      const currencies = Array.from(new Set(tripExps.map(e => e.currency || selectedTrip.currency || "د.ع")));
                      if (currencies.length === 0) currencies.push(selectedTrip.currency || "د.ع");

                      const statsByCurrency: Record<string, { totalSpent: number, balances: Record<string, number>, memberStats: Record<string, {paid: number, consumed: number}> }> = {};
                      
                      currencies.forEach(c => {
                        statsByCurrency[c] = { totalSpent: 0, balances: {}, memberStats: {} };
                        selectedTrip.members.forEach(m => {
                          statsByCurrency[c].balances[m] = 0;
                          statsByCurrency[c].memberStats[m] = { paid: 0, consumed: 0 };
                        });
                      });
                      
                      tripExps.forEach(exp => {
                        const c = exp.currency || selectedTrip.currency || "د.ع";
                        statsByCurrency[c].totalSpent += exp.amount;
                        if (statsByCurrency[c].balances[exp.paidBy] !== undefined) {
                          statsByCurrency[c].balances[exp.paidBy] += exp.amount;
                          statsByCurrency[c].memberStats[exp.paidBy].paid += exp.amount;
                        }
                        const splitAmount = exp.amount / exp.splitBetween.length;
                        exp.splitBetween.forEach(m => {
                          if (statsByCurrency[c].balances[m] !== undefined) {
                            statsByCurrency[c].balances[m] -= splitAmount;
                            statsByCurrency[c].memberStats[m].consumed += splitAmount;
                          }
                        });
                      });

                      const settlementsByCurrency: Record<string, { from: string, to: string, amount: number }[]> = {};
                      
                      currencies.forEach(c => {
                        const balances = statsByCurrency[c].balances;
                        const debtors = Object.keys(balances).filter(m => balances[m] < -0.01).map(m => ({ name: m, amount: -balances[m] }));
                        const creditors = Object.keys(balances).filter(m => balances[m] > 0.01).map(m => ({ name: m, amount: balances[m] }));
                        const settlements: { from: string, to: string, amount: number }[] = [];
                        
                        let i = 0, j = 0;
                        while (i < debtors.length && j < creditors.length) {
                          const debtor = debtors[i];
                          const creditor = creditors[j];
                          const amount = Math.min(debtor.amount, creditor.amount);
                          settlements.push({ from: debtor.name, to: creditor.name, amount });
                          debtor.amount -= amount;
                          creditor.amount -= amount;
                          if (debtor.amount < 0.01) i++;
                          if (creditor.amount < 0.01) j++;
                        }
                        settlementsByCurrency[c] = settlements;
                      });

                      return (
                        <>
                          <div className="bg-gradient-to-l from-blue-900/10 via-sky-900/5 to-transparent p-4 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-start">
                            <div>
                              <button onClick={() => setSelectedTrip(null)} className="text-gray-500 hover:text-gray-900 dark:hover:text-white text-xs font-bold flex items-center gap-1 mb-2 transition">
                                <ArrowRight className="w-3.5 h-3.5" /> عودة للرحلات
                              </button>
                              <h3 className="font-black text-lg text-gray-800 dark:text-white flex items-center gap-2">
                                {selectedTrip.name} <span className="text-xs font-normal text-gray-400">({selectedTrip.destination})</span>
                              </h3>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => {
                                let msg = `*ملخص حسابات رحلة ${selectedTrip.destination} (${selectedTrip.name})*\n`;
                                currencies.forEach(c => {
                                  msg += `\n[ بعملة ${c} ]\n`;
                                  msg += `إجمالي المصاريف: ${fmt(statsByCurrency[c].totalSpent)}\n`;
                                  const settlements = settlementsByCurrency[c];
                                  if (settlements.length > 0) {
                                    msg += `التسويات:\n`;
                                    settlements.forEach(s => {
                                      msg += `- ${s.from} يدفع لـ ${s.to} مبلغ ${fmt(Math.round(s.amount))}\n`;
                                    });
                                  } else {
                                    msg += `لا توجد ديون بهذه العملة.\n`;
                                  }
                                });
                                navigator.clipboard.writeText(msg);
                                toast.success("تم نسخ الملخص بنجاح!");
                              }} className="p-2 text-gray-400 hover:text-green-500 bg-gray-100 dark:bg-zinc-800 rounded-xl transition"><Share2 className="w-4 h-4" /></button>
                              <button onClick={() => { 
                                setEditTrip(selectedTrip); 
                                setTripModalDestination(selectedTrip.destination);
                                setTripModalMembers(selectedTrip.members);
                                setTripModalMemberInput("");
                                setShowTripModal(true); 
                              }} className="p-2 text-gray-400 hover:text-blue-500 bg-gray-100 dark:bg-zinc-800 rounded-xl transition"><Edit2 className="w-4 h-4" /></button>
                              <button onClick={() => handleDeleteTrip(selectedTrip.id)} className="p-2 text-gray-400 hover:text-red-500 bg-gray-100 dark:bg-zinc-800 rounded-xl transition"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </div>

                          <div className="p-4 space-y-5">
                            {/* Stats */}
                            <div className="flex gap-3">
                              <div className="flex-1 bg-gray-50 dark:bg-zinc-800/50 rounded-2xl p-3 text-center border border-gray-100 dark:border-zinc-800 flex flex-col justify-center items-center">
                                <div className="text-[10px] font-bold text-gray-500 mb-1">إجمالي مصاريف الرحلة</div>
                                {currencies.map(c => (
                                  <div key={c} className="text-lg font-black text-gray-800 dark:text-white">
                                    {fmt(statsByCurrency[c].totalSpent)} <span className="text-[10px] text-gray-400">{c}</span>
                                  </div>
                                ))}
                              </div>
                              <button onClick={() => setShowTripExpenseModal(true)} className="flex-1 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-3 text-white flex flex-col justify-center items-center shadow-lg shadow-blue-500/30 active:scale-95 transition">
                                <Plus className="w-5 h-5 mb-1 drop-shadow" />
                                <span className="text-xs font-black">إضافة مصروف</span>
                              </button>
                            </div>

                            {/* Members Breakdown */}
                            <div className="bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl p-4 border border-blue-100 dark:border-blue-900/30">
                              <h4 className="font-black text-blue-800 dark:text-blue-400 text-xs mb-3 flex items-center gap-1.5">
                                <Users className="w-4 h-4" /> تفاصيل حسابات الأشخاص
                              </h4>
                              <div className="space-y-3">
                                {selectedTrip.members.map(m => (
                                  <div key={m} className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-zinc-800 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl -translate-y-1/2 -translate-x-1/2 pointer-events-none" />
                                    <div className="font-black text-base text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs shadow-inner">
                                        {m.charAt(0)}
                                      </div>
                                      {m}
                                    </div>
                                    {currencies.map(c => {
                                      const stat = statsByCurrency[c].memberStats[m];
                                      if (stat.paid === 0 && stat.consumed === 0) return null;
                                      const bal = statsByCurrency[c].balances[m];
                                      const isPos = bal >= 0;
                                      return (
                                        <div key={c} className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-3 mb-2 last:mb-0 border border-gray-100 dark:border-zinc-800">
                                          <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs font-bold text-gray-500">صافي الحساب ({c})</span>
                                            <span className={`text-lg font-black ${isPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                              {isPos ? '+' : ''}{fmt(bal)} <span className="text-[10px] opacity-70">{c}</span>
                                            </span>
                                          </div>
                                          <div className="flex gap-2">
                                            <div className="flex-1 bg-white dark:bg-zinc-800 rounded-lg p-2 text-center border border-gray-100 dark:border-zinc-700/50">
                                              <span className="block text-[9px] text-gray-400 mb-0.5">دفع للرحلة</span>
                                              <span className="block text-xs font-black text-gray-700 dark:text-gray-200">{fmt(stat.paid)}</span>
                                            </div>
                                            <div className="flex-1 bg-white dark:bg-zinc-800 rounded-lg p-2 text-center border border-gray-100 dark:border-zinc-700/50">
                                              <span className="block text-[9px] text-gray-400 mb-0.5">مصاريفه الفعلية</span>
                                              <span className="block text-xs font-black text-gray-700 dark:text-gray-200">{fmt(stat.consumed)}</span>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Settlements */}
                            {currencies.map(c => {
                              const settlements = settlementsByCurrency[c];
                              if (settlements.length === 0) return null;
                              return (
                                <div key={`settlement-${c}`} className="bg-orange-50 dark:bg-orange-950/20 rounded-2xl p-4 border border-orange-200 dark:border-orange-900/30">
                                  <h4 className="font-black text-orange-800 dark:text-orange-400 text-xs mb-3 flex items-center gap-1.5">
                                    <Calculator className="w-4 h-4" /> تسوية الحسابات ({c})
                                  </h4>
                                  <div className="space-y-2">
                                    {settlements.map((s, idx) => (
                                      <div key={idx} className="flex items-center justify-between bg-white dark:bg-zinc-900/50 rounded-xl p-2.5 px-3 border border-orange-100 dark:border-orange-900/20 shadow-sm">
                                        <div className="flex items-center gap-2">
                                          <span className="font-bold text-sm text-gray-800 dark:text-gray-200">{s.from}</span>
                                          <ArrowLeft className="w-3 h-3 text-orange-400" />
                                          <span className="font-bold text-sm text-gray-800 dark:text-gray-200">{s.to}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <div className="font-black text-orange-600 dark:text-orange-400">{fmt(Math.round(s.amount))} {c}</div>
                                          <a href={`https://wa.me/?text=${encodeURIComponent(`مرحباً ${s.from}، يرجى تسديد مبلغ ${fmt(Math.round(s.amount))} ${c} إلى ${s.to} (تصفية حسابات رحلة ${selectedTrip.name}). شكراً!`)}`} target="_blank" rel="noreferrer" className="bg-green-500 hover:bg-green-600 text-white p-1.5 rounded-full shadow-sm transition" title="مراسلة عبر واتساب">
                                            <MessageCircle className="w-3.5 h-3.5" />
                                          </a>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}

                            {/* Expenses List */}
                            <div>
                              <h4 className="font-black text-gray-800 dark:text-white text-xs mb-3">سجل المصاريف ({tripExps.length})</h4>
                              {tripExps.length === 0 ? (
                                <p className="text-xs text-gray-400 text-center py-4 bg-gray-50 dark:bg-zinc-800/30 rounded-xl">لا توجد مصاريف مسجلة</p>
                              ) : (
                                <div className="space-y-2">
                                  {tripExps.map(exp => (
                                    <div key={exp.id} className="flex justify-between items-center bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-gray-100 dark:border-zinc-800">
                                      <div>
                                        <h5 className="font-bold text-sm text-gray-800 dark:text-gray-200 mb-0.5">{exp.description}</h5>
                                        <p className="text-[10px] text-gray-500">
                                          دفعها <span className="font-black text-gray-700 dark:text-gray-300">{exp.paidBy}</span> وتقسمت على ({exp.splitBetween.length})
                                        </p>
                                      </div>
                                      <div className="text-left flex flex-col items-end">
                                        <div className="font-black text-gray-900 dark:text-white">{fmt(exp.amount)} <span className="text-[10px] text-gray-500 font-normal">{exp.currency || selectedTrip.currency || "د.ع"}</span></div>
                                        <div className="flex gap-3 mt-1 justify-end w-full">
                                          <button onClick={() => handleCloneTripExpense(exp)} className="text-[10px] text-blue-500 hover:text-blue-600 font-bold">نسخ</button>
                                          <button onClick={() => handleDeleteTripExpense(exp.id)} className="text-[10px] text-red-400 hover:text-red-500 font-bold">حذف</button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
            </div>
          );
        })()}
        {/* ═══════════════ FAMILY NEEDS TAB ═══════════════ */}
        {activeTab === "familyNeeds" && (
          <FamilySection
            familyNeeds={familyNeeds}
            setFamilyNeeds={setFamilyNeeds}
            expenses={expenses}
            familyHealth={familyHealth}
            setFamilyHealth={setFamilyHealth}
            syncToFirebase={syncToFirebase}
            fmt={fmt}
          />
        )}

        {/* ═══════════════ FUTURE PLANS TAB ═══════════════ */}
        {activeTab === "futurePlans" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-black text-gray-800 dark:text-white flex items-center gap-2">
                <Target className="w-5 h-5 text-violet-500" />
                الخطط المستقبلية
              </h2>
              <button onClick={() => {
                setShowFuturePlanModal(true);
              }}
                className="bg-violet-500 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 shadow-lg shadow-violet-500/25 active:scale-95 transition">
                <Plus className="w-3.5 h-3.5" /> خطة جديدة
              </button>
            </div>

            {futurePlans.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 text-center border border-gray-100 dark:border-zinc-800 shadow-sm">
                <div className="w-16 h-16 bg-violet-100 dark:bg-violet-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Target className="w-8 h-8 text-violet-500" />
                </div>
                <h3 className="text-gray-800 dark:text-white font-black mb-2">لا توجد خطط مستقبلية</h3>
                <p className="text-gray-400 text-xs font-bold leading-relaxed mb-4">
                  ابدأ بالتخطيط لمستقبلك! أضف خططاً مثل شراء سيارة، ديكور المطبخ، أو السفر، وتابع تقدمك خطوة بخطوة.
                </p>
                <button onClick={() => setShowFuturePlanModal(true)} className="text-violet-500 text-xs font-black bg-violet-50 dark:bg-violet-500/10 px-4 py-2 rounded-xl">
                  + ابدأ خطتك الأولى
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {futurePlans.map(plan => {
                  const progressPct = plan.targetAmount > 0 ? Math.min(100, (plan.savedAmount / plan.targetAmount) * 100) : 0;
                  const completedSteps = plan.steps.filter(s => s.isCompleted).length;
                  const totalSteps = plan.steps.length;
                  
                  return (
                    <div key={plan.id} className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-gray-100 dark:border-zinc-800 shadow-sm relative overflow-hidden">
                      {/* Decorative Background Blob */}
                      <div className="absolute -top-10 -right-10 w-32 h-32 bg-violet-500/5 rounded-full blur-2xl pointer-events-none" />
                      
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex gap-3">
                          {(plan.imageUrl || plan.title.includes('الكيك')) && (
                            <div className="w-16 h-16 rounded-xl overflow-hidden shadow-sm flex-shrink-0">
                              <img src={plan.imageUrl || '/cake_room_hq.png'} alt={plan.title} className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div>
                            <h3 className="font-black text-gray-800 dark:text-white text-lg">{plan.title}</h3>
                            <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-bold text-gray-500 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> الهدف: {plan.targetDate}
                            </span>
                          </div>
                        </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => {
                            setEditFuturePlan(plan);
                            setFuturePlanSteps(plan.steps);
                            setShowFuturePlanModal(true);
                          }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition p-1">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeleteFuturePlan(plan.id)} className="text-gray-400 hover:text-rose-500 transition p-1">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Details Toggle Button */}
                      <button onClick={() => setExpandedPlans(prev => prev.includes(plan.id) ? prev.filter(id => id !== plan.id) : [...prev, plan.id])}
                        className="w-full mt-2 py-2 flex items-center justify-center gap-1 text-xs font-bold text-gray-500 bg-gray-50 hover:bg-gray-100 dark:bg-zinc-800/50 dark:hover:bg-zinc-800 rounded-xl transition">
                        {expandedPlans.includes(plan.id) ? (
                          <>إخفاء التفاصيل <ChevronUp className="w-4 h-4" /></>
                        ) : (
                          <>عرض التفاصيل <ChevronDown className="w-4 h-4" /></>
                        )}
                      </button>

                      <div className={`transition-all duration-300 overflow-hidden ${expandedPlans.includes(plan.id) ? "max-h-[1000px] opacity-100 mt-4" : "max-h-0 opacity-0 mt-0"}`}>
                        {/* Saving Vision */}
                        {plan.savingVision && (
                          <div className="mb-4 bg-violet-50 dark:bg-violet-900/10 border border-violet-100 dark:border-violet-900/30 rounded-xl p-3">
                            <h4 className="text-[10px] font-black text-violet-600 dark:text-violet-400 mb-1 flex items-center gap-1"><Target className="w-3 h-3"/> خطة التجميع:</h4>
                            <p className="text-xs text-gray-600 dark:text-gray-300 font-bold leading-relaxed whitespace-pre-wrap">{plan.savingVision}</p>
                          </div>
                        )}

                        {/* Financial Progress */}
                        <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-2xl p-4 border border-gray-100 dark:border-zinc-800 mb-4">
                          <div className="flex justify-between items-end mb-2">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold text-gray-400">المبلغ المستهدف</span>
                              <span className="font-black text-gray-800 dark:text-white">{fmt(plan.targetAmount)} <span className="text-[10px] text-gray-500">د.ع</span></span>
                            </div>
                            <div className="flex flex-col text-left">
                              <span className="text-[10px] font-bold text-violet-500">تم جمع</span>
                              <span className="font-black text-violet-600 dark:text-violet-400">{fmt(plan.savedAmount)} <span className="text-[10px] text-violet-400">د.ع</span></span>
                            </div>
                          </div>
                          
                          <div className="h-2.5 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden mb-1.5">
                            <div 
                              className="h-full bg-gradient-to-l from-violet-500 to-fuchsia-500 rounded-full transition-all duration-1000"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                          
                          <div className="flex justify-between items-center text-[10px] font-bold">
                            <span className="text-gray-500">النسبة: {progressPct.toFixed(1)}%</span>
                            <span className="text-rose-500">متبقي: {fmt(Math.max(0, plan.targetAmount - plan.savedAmount))} د.ع</span>
                          </div>
                        </div>

                        {/* Steps / Requirements */}
                        {totalSteps > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                الخطوات والمتطلبات
                              </span>
                              <span className="text-[10px] font-bold text-gray-400">{completedSteps}/{totalSteps} منجزة</span>
                            </div>
                            <div className="space-y-2">
                              {plan.steps.map((step, index) => (
                                <div key={step.id} className="flex items-center justify-between bg-gray-50 dark:bg-zinc-800/30 p-2 rounded-xl border border-gray-100 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-800/50 transition">
                                  <div onClick={() => toggleFuturePlanStep(plan.id, step.id)} className="flex items-start gap-2 flex-1 cursor-pointer">
                                    <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${step.isCompleted ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 dark:border-zinc-600'}`}>
                                      {step.isCompleted && <Check className="w-2.5 h-2.5 text-white" />}
                                    </div>
                                    <div className="flex flex-col">
                                      <span className={`text-xs font-bold ${step.isCompleted ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-200'}`}>
                                        {step.text}
                                      </span>
                                      {step.date && (
                                        <span className="text-[10px] font-bold text-violet-500 mt-0.5 flex items-center gap-1">
                                          <Calendar className="w-3 h-3" /> {step.date}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 rounded-lg p-1 border border-gray-100 dark:border-zinc-700">
                                    <button onClick={(e) => { e.stopPropagation(); handleReorderFuturePlanStep(plan.id, index, 'up'); }} disabled={index === 0} className="p-1.5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md disabled:opacity-30 transition">
                                      <ChevronUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); handleReorderFuturePlanStep(plan.id, index, 'down'); }} disabled={index === plan.steps.length - 1} className="p-1.5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md disabled:opacity-30 transition">
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={(e) => { 
                                      e.stopPropagation(); 
                                      const newText = window.prompt("تعديل اسم الخطوة:", step.text);
                                      if (newText && newText.trim() !== "") {
                                        const newDate = window.prompt("تعديل التاريخ (اختياري - YYYY-MM-DD):", step.date || "");
                                        handleEditFuturePlanStep(plan.id, step.id, newText, newDate || undefined);
                                      }
                                    }} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition">
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════════ */}

      {/* — Modal Backdrop Helper — */}
      {[showInstallmentModal || !!editInstallment,
        showBillModal || !!editBill || !!payBillData,
        showExpenseModal || !!editExpense,
        showProductSearchModal,
        showIncomeModal || !!editIncome,
        showInventoryModal || !!editInventory,
        !!purchaseItem,
        showFamilyNeedModal,
      ].some(Boolean) && <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm" />}

      {/* ─── Installment Modal ─── */}
      {(showInstallmentModal || !!editInstallment) && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center">
          <div className="bg-white dark:bg-zinc-950 w-full sm:max-w-sm rounded-t-[32px] sm:rounded-[32px] px-5 pt-5 pb-8 shadow-2xl animate-in slide-in-from-bottom-10 duration-200 border border-gray-100 dark:border-zinc-800 max-h-[calc(100svh-80px)] overflow-y-auto mb-[80px] sm:mb-0">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-black text-gray-900 dark:text-white">{editInstallment ? "تعديل" : "إضافة قسط / سلفة"}</h3>
              <button onClick={() => { setShowInstallmentModal(false); setEditInstallment(null);
}} className="p-2 bg-gray-100 dark:bg-zinc-800 rounded-full">
                <X className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSaveInstallment} className="space-y-3">
              <div>
                <label className="label-sm">نوع</label>
                <select name="type" defaultValue={editInstallment?.type || "قسط"} className="input-field">
                  <option value="قسط">قسط</option>
                  <option value="سلفة">سلفة</option>
                </select>
              </div>
              <div>
                <label className="label-sm">الاسم</label>
                <input autoComplete="off" name="name" defaultValue={editInstallment?.name} required placeholder="مثال: قسط الشقة" className="input-field" />
              </div>

              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-sm">المبلغ الكلي</label>
                    <input autoComplete="off" name="total" type="number" defaultValue={editInstallment?.totalAmount} required placeholder="0" className="input-field" />
                  </div>
                  <div>
                    <label className="label-sm">المبلغ المتبقي</label>
                    <input autoComplete="off" name="remaining" type="number" defaultValue={editInstallment?.remainingAmount} placeholder="= الكلي" className="input-field" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-sm">المقدمة (الدفعة الأولى)</label>
                    <input autoComplete="off" name="downPayment" type="number" defaultValue={editInstallment?.downPayment} placeholder="0" className="input-field" />
                  </div>
                  <div>
                    <label className="label-sm">القسط الشهري</label>
                    <input autoComplete="off" name="monthly" type="number" defaultValue={editInstallment?.monthlyInstallment} required placeholder="0" className="input-field" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-sm">الأشهر الكلية</label>
                    <input autoComplete="off" name="totalMonths" type="number" defaultValue={editInstallment?.totalMonths} placeholder="0" className="input-field" />
                  </div>
                  <div>
                    <label className="label-sm">أشهر مدفوعة مسبقاً</label>
                    <input autoComplete="off" name="initialPaidMonths" type="number" defaultValue={editInstallment?.initialPaidMonths} placeholder="0" className="input-field" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-sm">أشهر متلكئة</label>
                    <input autoComplete="off" name="delayedMonths" type="number" defaultValue={editInstallment ? Math.max(0, (() => {
                      if (!editInstallment.startDate) return 0;
                      const start = new Date(editInstallment.startDate);
                      const now = new Date();
                      const monthsElapsed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
                      const requiredPayments = monthsElapsed + 1;
                      const paidMonths = (editInstallment.initialPaidMonths || 0) + editInstallment.payments.length;
                      return requiredPayments - paidMonths;
                    })()) : ""} placeholder="0" className="input-field" />
                  </div>
                  <div>
                    <label className="label-sm">تاريخ البداية</label>
                    <input autoComplete="off" name="startDate" type="date" defaultValue={editInstallment?.startDate || today()} className="input-field" />
                  </div>
                </div>
              </div>
              <button type="submit" className="w-full bg-gradient-to-l from-indigo-600 to-violet-600 text-white font-black py-3.5 rounded-xl shadow-lg mt-2 active:scale-[0.98] transition">
                حفظ
              </button>
            </form>
          </div>
        </div>
      )}
      {/* ─── Pay Bill Modal ─── */}
      {!!payBillData && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center">
          <div className="bg-white dark:bg-zinc-950 w-full sm:max-w-sm rounded-t-[32px] sm:rounded-[32px] px-5 pt-5 pb-8 shadow-2xl animate-in slide-in-from-bottom-10 duration-200 border border-gray-100 dark:border-zinc-800 mb-[80px] sm:mb-0">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                <Receipt className="w-6 h-6 text-emerald-500" />
                تسديد الفاتورة
              </h3>
              <button onClick={() => setPayBillData(null)} className="p-2 bg-gray-100 dark:bg-zinc-900 rounded-full text-gray-500 hover:text-gray-800 dark:hover:text-white transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-sm font-bold text-gray-600 dark:text-gray-300 mb-4 text-center">
              أدخل المبلغ الفعلي الذي سددته لفاتورة ({payBillData.bill.name}):
            </p>
            
            <form onSubmit={e => { e.preventDefault(); confirmPayBill(); }} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">عدد الأشهر المراد تسديدها</label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min="1"
                    max="24"
                    value={payBillData.months}
                    onChange={e => {
                      const m = Number(e.target.value) || 1;
                      setPayBillData({ ...payBillData, months: m, amount: (payBillData.bill.amount * m).toString() });
                    }}
                    className="w-full bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded-2xl px-4 py-3.5 text-gray-800 dark:text-white font-bold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition"
                    placeholder="عدد الأشهر"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">المبلغ الكلي المدفوع</label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    value={payBillData.amount}
                    onChange={e => setPayBillData({ ...payBillData, amount: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded-2xl px-4 py-3.5 pr-10 text-gray-800 dark:text-white font-bold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition"
                    placeholder="المبلغ"
                    dir="ltr"
                  />
                  <DollarSign className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
              </div>

              <button type="submit" className="w-full bg-gradient-to-l from-emerald-500 to-emerald-600 text-white font-black py-3.5 rounded-xl shadow-lg mt-2 active:scale-[0.98] transition">
                تأكيد الدفع
              </button>
            </form>
          </div>
        </div>
      )}
      {/* ─── Bill Modal ─── */}
      {(showBillModal || !!editBill) && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center">
          <div className="bg-white dark:bg-zinc-950 w-full sm:max-w-sm rounded-t-[32px] sm:rounded-[32px] px-5 pt-5 pb-8 shadow-2xl animate-in slide-in-from-bottom-10 duration-200 border border-gray-100 dark:border-zinc-800 max-h-[calc(100svh-80px)] overflow-y-auto mb-[80px] sm:mb-0">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-black text-gray-900 dark:text-white">{editBill ? "تعديل الفاتورة" : "إضافة فاتورة"}</h3>
              <button onClick={() => { setShowBillModal(false); setEditBill(null);
}} className="p-2 bg-gray-100 dark:bg-zinc-800 rounded-full">
                <X className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSaveBill} className="space-y-3">
              <div>
                <label className="label-sm">اسم الفاتورة</label>
                <input autoComplete="off" name="name" defaultValue={editBill?.name} required placeholder="مثال: فاتورة الكهرباء" className="input-field" />
              </div>
              <div>
                <label className="label-sm">الفئة</label>
                <select name="category" defaultValue={editBill?.category || "غاز"} className="input-field">
                  {BILL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-sm">المبلغ (د.ع)</label>
                  <input autoComplete="off" name="amount" type="number" defaultValue={editBill?.amount} required placeholder="0" className="input-field" />
                </div>
                <div>
                  <label className="label-sm">يوم الاستحقاق</label>
                  <input autoComplete="off" name="dueDay" type="number" defaultValue={editBill?.dueDay} placeholder="1-31" min={1} max={31} className="input-field" />
                </div>
              </div>
              <div>
                <label className="label-sm">نوع الدفع</label>
                <select name="paymentType" defaultValue={editBill?.paymentType || "مسبق"} className="input-field">
                  <option value="مسبق">دفع مسبق (يستحق في نفس الشهر)</option>
                  <option value="لاحق">دفع لاحق (يستحق في الشهر التالي)</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-gradient-to-l from-amber-500 to-yellow-500 text-white font-black py-3.5 rounded-xl shadow-lg mt-2 active:scale-[0.98] transition">
                حفظ
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── Product Search Modal ─── */}
      {showProductSearchModal && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center">
          <div className="bg-white dark:bg-zinc-950 w-full sm:max-w-md rounded-t-[32px] sm:rounded-[32px] px-5 pt-5 pb-8 shadow-2xl animate-in slide-in-from-bottom-10 duration-200 border border-gray-100 dark:border-zinc-800 max-h-[calc(100svh-80px)] overflow-y-auto mb-[80px] sm:mb-0">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-500" /> بحث تفصيلي للمنتجات
              </h3>
              <button onClick={() => setShowProductSearchModal(false)} className="p-2 bg-gray-100 dark:bg-zinc-800 rounded-full">
                <X className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label-sm">اسم المنتج</label>
                <input type="text" value={productSearchQuery} onChange={e => setProductSearchQuery(e.target.value)} placeholder="مثال: حليب، بيض، دجاج..." className="input-field mb-2" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-sm">من تاريخ (اختياري)</label>
                  <input type="date" value={productSearchStart} onChange={e => setProductSearchStart(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="label-sm">إلى تاريخ (اختياري)</label>
                  <input type="date" value={productSearchEnd} onChange={e => setProductSearchEnd(e.target.value)} className="input-field" />
                </div>
              </div>

              {(() => {
                const results = allExpenses.flatMap(e => 
                  (e.items || [])
                    .filter(i => productSearchQuery && i.name.toLowerCase().includes(productSearchQuery.toLowerCase()))
                    .filter(() => {
                       const d = e.date.split('T')[0];
                       if (productSearchStart && d < productSearchStart) return false;
                       if (productSearchEnd && d > productSearchEnd) return false;
                       return true;
                    })
                    .map(i => ({ ...i, expName: e.name, expDate: e.date.split('T')[0] }))
                ).sort((a, b) => new Date(b.expDate).getTime() - new Date(a.expDate).getTime());

                const totalQty = results.reduce((acc, curr) => acc + curr.quantity, 0);
                const totalPrice = results.reduce((acc, curr) => acc + curr.price, 0);

                if (!productSearchQuery) return <div className="text-center text-xs text-gray-500 py-4 font-bold">يرجى كتابة اسم المنتج للبحث</div>;
                if (results.length === 0) return <div className="text-center text-xs text-gray-500 py-4 font-bold">لا توجد نتائج مطابقة</div>;

                return (
                  <div className="mt-4">
                    <div className="bg-indigo-50 dark:bg-indigo-500/10 rounded-xl p-3 mb-3 border border-indigo-100 dark:border-indigo-500/20">
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-bold text-indigo-700 dark:text-indigo-400">إجمالي الكمية المشتراة:</span>
                        <span className="font-black text-indigo-900 dark:text-indigo-200">{totalQty}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm mt-1">
                        <span className="font-bold text-indigo-700 dark:text-indigo-400">إجمالي المبلغ:</span>
                        <span className="font-black text-indigo-900 dark:text-indigo-200">{fmt(totalPrice)} د.ع</span>
                      </div>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {results.map((r, i) => (
                        <div key={i} className="bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-gray-100 dark:border-zinc-800 flex justify-between items-center">
                          <div>
                            <div className="font-bold text-sm text-gray-800 dark:text-gray-200">{r.name}</div>
                            <div className="text-xs text-gray-500 font-medium mt-1">
                              <Calendar className="w-3 h-3 inline-block ml-1" /> {r.expDate}
                              <span className="mx-2">|</span>
                              <ShoppingCart className="w-3 h-3 inline-block ml-1" /> القائمة: {r.expName}
                            </div>
                          </div>
                          <div className="text-left">
                            <div className="font-black text-sm text-rose-500">{fmt(r.price)} د.ع</div>
                            <div className="text-xs text-gray-700 dark:text-gray-300 font-bold bg-gray-200 dark:bg-zinc-700 px-2 py-1 rounded-lg inline-block mt-2">العدد: {r.quantity}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ─── Hidden File Inputs for Receipt Scanner & Attachment ─── */}
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
      <input
        type="file"
        ref={warrantyCameraInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file && activeWarrantyItemIdx !== null) {
            const url = await compressImageFast(file, 1200, 0.85);
            const newItems = [...expenseItems];
            newItems[activeWarrantyItemIdx].warrantyCardImage = url;
            newItems[activeWarrantyItemIdx].hasWarranty = true;
            setExpenseItems(newItems);
            toast.success("تم إرفاق صورة بطاقة الضمان بنجاح 📸🛡️");
          }
          if (e.target) e.target.value = "";
        }}
      />
      <input
        type="file"
        ref={warrantyGalleryInputRef}
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file && activeWarrantyItemIdx !== null) {
            const url = await compressImageFast(file, 1200, 0.85);
            const newItems = [...expenseItems];
            newItems[activeWarrantyItemIdx].warrantyCardImage = url;
            newItems[activeWarrantyItemIdx].hasWarranty = true;
            setExpenseItems(newItems);
            toast.success("تم إرفاق صورة بطاقة الضمان بنجاح 🖼️🛡️");
          }
          if (e.target) e.target.value = "";
        }}
      />


      {/* ─── Expense Modal (Modernized & Super Fast) ─── */}
      {(showExpenseModal || !!editExpense) && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowExpenseModal(false);
              setEditExpense(null);
            }
          }}
          className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white dark:bg-zinc-950 w-full sm:max-w-2xl rounded-t-[32px] sm:rounded-[32px] px-5 sm:px-7 pt-5 pb-8 shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200 border border-gray-100 dark:border-zinc-800 max-h-[92svh] overflow-y-auto mb-[75px] sm:mb-0 relative custom-scrollbar">
            
            {/* AI Scanning Overlay */}
            {isScanningReceipt && (
              <div className="absolute inset-0 z-50 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md rounded-[32px] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
                <div className="relative mb-5">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-rose-500 to-indigo-600 animate-spin flex items-center justify-center p-1">
                    <div className="w-full h-full bg-white dark:bg-zinc-950 rounded-full flex items-center justify-center">
                      <ScanLine className="w-8 h-8 text-rose-500 animate-pulse" />
                    </div>
                  </div>
                  <Sparkles className="w-6 h-6 text-amber-400 absolute -top-1 -right-1 animate-bounce" />
                </div>
                <h4 className="text-lg font-black text-gray-900 dark:text-white mb-2">
                  جاري معالجة الفاتورة بالذكاء الاصطناعي ✨
                </h4>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 max-w-sm animate-pulse">
                  {scanStatusText || "جاري استخراج أسماء المواد، الكميات، والأسعار الإجمالية بدقة..."}
                </p>
                <div className="mt-5 flex items-center gap-2 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-100 dark:border-indigo-500/20">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> يرجى الانتظار بضع ثوانٍ...
                </div>
              </div>
            )}

            {/* Header */}
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white shadow-md shadow-rose-500/20">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white">
                    {editExpense ? "تعديل المصروف" : "تسجيل مصروف جديد"}
                  </h3>
                  <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400">
                    يمكنك كتابة المصروف يدوياً أو مسح فاتورته بالذكاء الاصطناعي
                  </p>
                </div>
              </div>
              <button 
                onClick={() => { setShowExpenseModal(false); setEditExpense(null); }} 
                className="p-2 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-full transition"
              >
                <X className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* Smart Action Buttons (AI Scan & Quick Paste) */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <button
                type="button"
                onClick={() => receiptCameraInputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 p-2.5 rounded-2xl font-black text-xs bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm hover:opacity-95 active:scale-[0.98] transition cursor-pointer"
                title="تصوير الفاتورة مباشرة بالكاميرا"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>مسح كاميرا 📸</span>
              </button>

              <button
                type="button"
                onClick={() => receiptGalleryInputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 p-2.5 rounded-2xl font-black text-xs bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm hover:opacity-95 active:scale-[0.98] transition cursor-pointer"
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
              <div className="mb-3.5 p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
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
                    <div key={i} className="relative group shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-indigo-200 dark:border-indigo-800 bg-black/5">
                      <img src={img} alt={`فاتورة ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setAttachedReceiptImages(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-1 right-1 w-5 h-5 bg-rose-600 text-white rounded-full flex items-center justify-center text-xs opacity-90 hover:opacity-100 shadow cursor-pointer"
                        title="حذف هذه الصورة"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => receiptGalleryInputRef.current?.click()}
                    className="shrink-0 w-20 h-20 rounded-xl border-2 border-dashed border-indigo-300 dark:border-indigo-700 flex flex-col items-center justify-center text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100/50 dark:hover:bg-indigo-900/30 transition text-[11px] font-bold cursor-pointer"
                  >
                    <Plus className="w-4 h-4 mb-0.5" />
                    إضافة
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSaveExpense} className="space-y-3.5">
              {/* Main Fields */}
              <div className="relative w-full">
                <div className="flex items-center justify-between mb-1">
                  <label className="label-sm mb-0">اسم الطلعة أو المصروف</label>
                </div>
                <input 
                  name="name" 
                  type="text" 
                  autoComplete="off" 
                  value={expNameInput}
                  onChange={e => {
                    const val = e.target.value;
                    setExpNameInput(val);
                    setShowExpSuggestions(val.trim().length >= 1);
                    const pred = detectProductCategory(val);
                    if (pred) {
                      setExpCategoryInput(pred);
                    }
                    if (isCarExpenseMatch(val, pred)) {
                      setExpBeneficiary("السيارة");
                    } else {
                      const mem = detectFamilyMemberMatch(val);
                      if (mem) setExpBeneficiary(mem);
                    }
                  }}
                  onFocus={() => {
                    if (expNameInput.trim().length >= 1) {
                      setShowExpSuggestions(true);
                    }
                  }}
                  onBlur={() => setTimeout(() => setShowExpSuggestions(false), 250)}
                  className="input-field" 
                  placeholder="مثال: طلعة عائلية، مجمع التحرير، هايبرماركت، مطعم، كراج، صيانة..." 
                />
                
                {showExpSuggestions && expNameInput.trim().length >= 1 && (() => {
                  const normQ = normalizeArabicText(expNameInput.trim());
                  const matchedNames = normalizedUniqueNames.filter(n => n.norm.includes(normQ));
                  const matchedPlaces = normalizedUniquePlaces.filter(p => p.norm.includes(normQ) && !matchedNames.some(m => m.raw === p.raw));
                  const combined = [
                    ...matchedNames.map(m => ({ suggestedName: m.raw, pred: m.pred })),
                    ...matchedPlaces.map(p => ({ suggestedName: p.raw, pred: p.pred }))
                  ].slice(0, 10);

                  if (combined.length === 0) {
                    return (
                      <div className="absolute z-20 w-full mt-1 bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-xl shadow-xl p-3 text-center text-xs text-gray-400 font-bold">
                        لا توجد اقتراحات مطابقة لـ &quot;{expNameInput}&quot;
                      </div>
                    );
                  }

                  return (
                    <div className="absolute z-20 w-full mt-1 bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                      {combined.map(({ suggestedName, pred }, idx) => {
                        const isCar = suggestedName.includes("كراج") || suggestedName.includes("فيتر") || suggestedName.includes("بنزين") || suggestedName.includes("سيارة");
                        const isFood = suggestedName.includes("مطعم") || suggestedName.includes("كافيه") || suggestedName.includes("كباب");
                        const isOuting = suggestedName.includes("جولة") || suggestedName.includes("طلعة") || suggestedName.includes("زوراء");
                        const icon = isCar ? "🚗" : isFood ? "🍽️" : isOuting ? "🎡" : "🛒";

                        return (
                          <div 
                            key={idx} 
                            onMouseDown={(e) => { 
                              e.preventDefault();
                              setExpNameInput(suggestedName); 
                              setShowExpSuggestions(false); 
                              if (pred) setExpCategoryInput(pred);
                              if (isCarExpenseMatch(suggestedName, pred)) {
                                setExpBeneficiary("السيارة");
                              } else {
                                const mem = detectFamilyMemberMatch(suggestedName);
                                if (mem) setExpBeneficiary(mem);
                              }
                            }} 
                            className="px-4 py-2 hover:bg-rose-50 dark:hover:bg-zinc-700 cursor-pointer text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center justify-between"
                          >
                            <span className="flex items-center gap-1.5">
                              <span>{icon}</span>
                              <span>{suggestedName}</span>
                            </span>
                            {pred && (
                              <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                                {pred}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {(expCategoryInput === "ألعاب ويانصيب" || expNameInput.includes("لوتو")) && (
                <div className="p-3 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-amber-500/10 border border-purple-200 dark:border-purple-500/30 rounded-2xl flex items-center justify-between gap-2 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">🎰</span>
                    <div>
                      <span className="font-black text-xs text-purple-700 dark:text-purple-300 block">
                        مركز لوتو سوبر كي ولوتو العراق
                      </span>
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-bold block">
                        توقع الأرقام القادمة، إدارة البطاقات، ومطابقة نتائج السحب
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowExpenseModal(false);
                      setShowLottoTrackerModal(true);
                    }}
                    className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl text-xs hover:shadow-md transition active:scale-95 shrink-0"
                  >
                    فتح المركز ↗
                  </button>
                </div>
              )}

              {expCategoryInput === "طلعات وجولات" && (
                <div className="p-3.5 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 border border-teal-200 dark:border-teal-500/30 rounded-2xl space-y-3 animate-in fade-in duration-200 text-right" dir="rtl">
                  {/* Destination Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🎡</span>
                      <div>
                        <span className="font-black text-xs text-teal-800 dark:text-teal-300 block">
                          طلعات وجولات (بغداد والمحافظات) - محطات وفواتير متعددة
                        </span>
                        <span className="text-[10px] text-teal-600/80 dark:text-teal-400 font-bold block">
                          يمكنك زيارة عدة أماكن (هايبر، سوق، منزلية...) وإرفاق فاتورة خاصة لكل مكان مع تصنيف مواده
                        </span>
                      </div>
                    </div>

                    {/* Quick Scan for active place */}
                    <button
                      type="button"
                      onClick={() => receiptCameraInputRef.current?.click()}
                      className="px-2.5 py-1 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-xl text-[11px] font-black shadow-xs hover:opacity-95 active:scale-95 flex items-center gap-1.5"
                      title="مسح فاتورة وإضافتها لمحطة التسوق المحددة"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>مسح فاتورة محطة 📸</span>
                    </button>
                  </div>
                  
                  {/* Destination shortcuts */}
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400">الوجهة:</span>
                    {[
                      "جولة بغداد", "المتنبي والرشيد", "كورنيش وجادرية", "المنصور والكرادة", 
                      "متنزه الزوراء", "كربلاء المقدسة", "النجف الأشرف", "بابل والآثار", 
                      "السليمانية", "أربيل", "شط العرب والبصرة"
                    ].map((loc) => (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => {
                          if (!expNameInput || expNameInput === "غير محدد") {
                            setExpNameInput(loc);
                          } else if (!expNameInput.includes(loc)) {
                            setExpNameInput(prev => `${prev} - ${loc}`);
                          }
                        }}
                        className="px-2 py-0.5 rounded-lg bg-white dark:bg-zinc-800 border border-teal-200 dark:border-teal-700/50 text-teal-800 dark:text-teal-200 text-[11px] font-bold hover:bg-teal-50 dark:hover:bg-zinc-700 transition active:scale-95"
                      >
                        + {loc}
                      </button>
                    ))}
                  </div>

                  {/* Outing Places / Stops Selector & Multiple Invoices */}
                  <div className="pt-2 border-t border-teal-100 dark:border-zinc-800/80 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                      <span className="font-black text-teal-900 dark:text-teal-200 flex items-center gap-1">
                        <span>📍</span>
                        <span>محطات وأماكن التسوق داخل هذه الطلعة:</span>
                      </span>
                      {selectedOutingPlace !== "كل المحطات" && (
                        <button
                          type="button"
                          onClick={() => setSelectedOutingPlace("كل المحطات")}
                          className="text-[10px] text-teal-600 dark:text-teal-400 font-bold hover:underline"
                        >
                          عرض جميع المحطات ↩
                        </button>
                      )}
                    </div>

                    {/* Visited Places Pills with subtotals */}
                    {(() => {
                      const visitedPlaces = Array.from(new Set(expenseItems.map(it => (it.place || "").trim()).filter(Boolean)));
                      return (
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {/* All Places Tab */}
                          <button
                            type="button"
                            onClick={() => setSelectedOutingPlace("كل المحطات")}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-black transition flex items-center gap-1 ${
                              selectedOutingPlace === "كل المحطات"
                                ? "bg-teal-700 text-white shadow-xs"
                                : "bg-white dark:bg-zinc-800 text-teal-900 dark:text-teal-200 border border-teal-200 dark:border-zinc-700 hover:bg-teal-50"
                            }`}
                          >
                            <span>📍 كل المحطات</span>
                            <span className="text-[10px] opacity-80">({expenseItems.length})</span>
                          </button>

                          {/* Existing Visited Places */}
                          {visitedPlaces.map(p => {
                            const pItems = expenseItems.filter(it => (it.place || "").trim() === p);
                            const pTotal = pItems.reduce((acc, curr) => acc + (curr.price || 0), 0);
                            const isSelected = selectedOutingPlace === p;

                            return (
                              <button
                                key={p}
                                type="button"
                                onClick={() => setSelectedOutingPlace(p)}
                                className={`px-2.5 py-1 rounded-xl text-[11px] font-black transition flex items-center gap-1.5 ${
                                  isSelected
                                    ? "bg-teal-600 text-white shadow-sm ring-2 ring-teal-400/50"
                                    : "bg-white dark:bg-zinc-800 text-gray-800 dark:text-gray-200 border border-teal-200 dark:border-zinc-700 hover:bg-teal-50"
                                }`}
                              >
                                <span>🛒 {p}</span>
                                <span className="text-[10px] opacity-80">({pItems.length})</span>
                                <span className={`text-[10px] font-black ${isSelected ? "text-amber-200" : "text-rose-600 dark:text-rose-400"}`}>
                                  {fmt(pTotal)} د.ع
                                </span>
                              </button>
                            );
                          })}

                          {/* Custom New Place Button / Input (No presets shown when empty; suggestions only when typing >= 1 char) */}
                          {showAddPlaceInput ? (
                            <div className="relative flex items-center gap-1 bg-white dark:bg-zinc-800 border border-teal-300 rounded-xl px-1.5 py-0.5">
                              <input
                                type="text"
                                autoComplete="new-password"
                                data-lpignore="true"
                                data-form-type="other"
                                placeholder="اسم المكان / المحل..."
                                value={newPlaceInput}
                                onChange={e => setNewPlaceInput(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === "Enter" && newPlaceInput.trim()) {
                                    e.preventDefault();
                                    const pName = newPlaceInput.trim();
                                    setSelectedOutingPlace(pName);
                                    setExpenseItems(prev => [...prev, {
                                      id: `item-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                                      name: "",
                                      quantity: 1,
                                      price: 0,
                                      category: "",
                                      place: pName
                                    }]);
                                    setNewPlaceInput("");
                                    setShowAddPlaceInput(false);
                                  }
                                }}
                                className="w-28 text-[11px] font-bold outline-none bg-transparent"
                                autoFocus
                              />
                              {newPlaceInput.trim().length >= 1 && (() => {
                                const q = normalizeArabicText(newPlaceInput.trim());
                                const matched = uniqueSuggestedPlaces.filter(pl => normalizeArabicText(pl).includes(q)).slice(0, 6);
                                if (matched.length === 0) return null;
                                return (
                                  <div className="absolute top-full mt-1 right-0 z-30 w-44 bg-white dark:bg-zinc-800 border border-teal-200 dark:border-zinc-700 rounded-xl shadow-xl overflow-hidden text-right">
                                    {matched.map((pl, plIdx) => (
                                      <button
                                        key={plIdx}
                                        type="button"
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          setSelectedOutingPlace(pl);
                                          setExpenseItems(prev => [...prev, {
                                            id: `item-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                                            name: "",
                                            quantity: 1,
                                            price: 0,
                                            category: "",
                                            place: pl
                                          }]);
                                          setNewPlaceInput("");
                                          setShowAddPlaceInput(false);
                                        }}
                                        className="w-full text-right px-3 py-1.5 hover:bg-teal-50 dark:hover:bg-zinc-700 text-[11px] font-bold text-gray-800 dark:text-gray-200 border-b border-gray-100 dark:border-zinc-700/50 last:border-0"
                                      >
                                        📍 {pl}
                                      </button>
                                    ))}
                                  </div>
                                );
                              })()}
                              <button
                                type="button"
                                onClick={() => {
                                  if (newPlaceInput.trim()) {
                                    const pName = newPlaceInput.trim();
                                    setSelectedOutingPlace(pName);
                                    setExpenseItems(prev => [...prev, {
                                      id: `item-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                                      name: "",
                                      quantity: 1,
                                      price: 0,
                                      category: "",
                                      place: pName
                                    }]);
                                    setNewPlaceInput("");
                                  }
                                  setShowAddPlaceInput(false);
                                }}
                                className="text-teal-600 font-black text-xs px-1"
                              >
                                ✓
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setShowAddPlaceInput(true)}
                              className="px-2 py-0.5 rounded-lg bg-white dark:bg-zinc-800 border border-teal-300 text-teal-700 dark:text-teal-300 text-[10px] font-black hover:bg-teal-50 transition"
                            >
                              + مكان آخر
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Activity shortcuts */}
                  <div className="flex flex-wrap gap-1.5 items-center pt-1 border-t border-teal-100 dark:border-zinc-800">
                    <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400">نوع الصرف:</span>
                    {[
                      "مطعم وكافيه", "بنزين وكروة تكسي", "تذاكر وألعاب", "عصائر ومرطبات", "مسواك وتسوق جولة"
                    ].map((act) => (
                      <button
                        key={act}
                        type="button"
                        onClick={() => {
                          const actPlace = act.includes("بنزين") ? "محطة بنزين" : act.includes("مطعم") ? "مطعم وكافيه" : act.includes("مسواك") ? "سوق الخضار" : (selectedOutingPlace !== "كل المحطات" ? selectedOutingPlace : "أخرى");
                          setExpenseItems(prev => [...prev, { 
                            id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, 
                            name: act, 
                            price: 0, 
                            quantity: 1, 
                            isChecked: true,
                            category: detectProductCategory(act),
                            place: actPlace
                          }]);
                          if (!expNameInput) {
                            setExpNameInput(`جولة - ${act}`);
                          }
                        }}
                        className="px-2 py-0.5 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 text-[10px] font-bold hover:bg-teal-100 transition active:scale-95"
                      >
                        + {act}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="label-sm mb-0">المبلغ الإجمالي (د.ع)</label>
                    {expenseItems.length > 0 && (
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded">
                        محسوب آلياً
                      </span>
                    )}
                  </div>
                  <input 
                    autoComplete="off" 
                    name="amount" 
                    type="number" 
                    defaultValue={expenseItems.length === 0 ? editExpense?.amount : undefined} 
                    value={expenseItems.length > 0 ? expenseItems.reduce((acc, curr) => acc + (curr.price || 0), 0) : undefined} 
                    readOnly={expenseItems.length > 0} 
                    placeholder="0" 
                    className={`input-field font-black text-rose-600 dark:text-rose-400 ${expenseItems.length > 0 ? 'bg-indigo-50/50 dark:bg-zinc-800/80 cursor-not-allowed border-indigo-200 dark:border-indigo-800/40' : ''}`} 
                  />
                </div>
                <div>
                  <label className="label-sm">التاريخ</label>
                  <input 
                    autoComplete="off" 
                    name="date" 
                    type="date" 
                    value={expDateInput} 
                    onChange={e => setExpDateInput(e.target.value)}
                    required 
                    className="input-field font-bold" 
                  />
                </div>
              </div>

              {/* ─── Ultra-Fast Keyboard-Navigable Items Section ─── */}
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-zinc-800">
                <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <label className="label-sm mb-0 flex items-center gap-1.5">
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
                        onClick={async () => {
                          if (await customConfirm("هل تريد مسح جميع المواد من القائمة؟")) {
                            setExpenseItems([]);
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
                          toast.success("تم ترتيب المواد حسب أولوية الأقسام (المخضر والفواكه أولاً ثم اللحوم والألبان...) 🥗✨");
                        }}
                        className="text-xs flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-black bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1.5 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition active:scale-95 border border-emerald-200/60 dark:border-emerald-500/30"
                        title="ترتيب المواد حسب الأولوية الغذائية والمنزلية (المخضر والفواكه بالبداية)"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        <span>🥗 ترتيب حسب الأولوية</span>
                      </button>
                    )}
                    <button 
                      type="button" 
                      onClick={() => receiptCameraInputRef.current?.click()}
                      className="text-xs flex items-center gap-1 text-purple-700 dark:text-purple-300 font-black bg-purple-50 dark:bg-purple-900/30 px-2.5 py-1.5 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/50 transition active:scale-95 border border-purple-200/60 dark:border-purple-800/40 cursor-pointer"
                      title="مسح وصل إضافي بالكاميرا ودمجه تلقائياً مع القائمة الحالية دون إرفاق الصورة"
                    >
                      <Camera className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                      <span>+ وصل كاميرا 📸</span>
                    </button>
                    <button 
                      type="button" 
                      onClick={() => receiptGalleryInputRef.current?.click()}
                      className="text-xs flex items-center gap-1 text-pink-700 dark:text-pink-300 font-black bg-pink-50 dark:bg-pink-900/30 px-2.5 py-1.5 rounded-xl hover:bg-pink-100 dark:hover:bg-pink-900/50 transition active:scale-95 border border-pink-200/60 dark:border-pink-800/40 cursor-pointer"
                      title="مسح وصل إضافي من الاستوديو ودمجه تلقائياً مع القائمة الحالية دون إرفاق الصورة"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400" />
                      <span>+ وصل استوديو 🖼️</span>
                    </button>
                    <button 
                      type="button" 
                      onClick={() => {
                        const newId = `item-${Date.now()}-${Math.random().toString(36).substring(7)}`;
                        const defaultPlace = selectedOutingPlace || (expCategoryInput === "طلعات وجولات" ? "سوق" : expNameInput.trim() || "");
                        const updated: ExpenseItem[] = [...expenseItems, { 
                          id: newId, 
                          name: "", 
                          quantity: 1, 
                          price: 0,
                          category: "",
                          place: defaultPlace,
                          priority: "مهم"
                        }];
                        setExpenseItems(updated);
                        setTimeout(() => {
                          const input = document.getElementById(`exp-item-name-${updated.length - 1}`);
                          if (input) input.focus();
                        }, 50);
                      }} 
                      className="text-xs flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-black bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition active:scale-95 border border-indigo-200/60 dark:border-indigo-500/30"
                    >
                      <Plus className="w-3.5 h-3.5" /> إضافة مادة (Enter)
                    </button>
                  </div>
                </div>

                {/* Table Header */}
                {expenseItems.length > 0 ? (
                  <div className="bg-gray-50 dark:bg-zinc-900 rounded-2xl p-2 sm:p-3 border border-gray-100 dark:border-zinc-800">
                    <div className="hidden sm:grid sm:grid-cols-12 gap-2 px-2 pb-2 text-[11px] font-black text-gray-500 border-b border-gray-200 dark:border-zinc-800 text-right">
                      <div className="col-span-1 text-center">#</div>
                      <div className="col-span-4">اسم المادة / المنتج</div>
                      <div className="col-span-3">القسم / الفئة 🏷️</div>
                      <div className="col-span-2">المكان / المحطة 📍</div>
                      <div className="col-span-1 text-center">الكمية</div>
                      <div className="col-span-1 text-left">السعر 🛡️</div>
                    </div>

                    <div className="space-y-2 mt-2 max-h-[340px] overflow-y-auto pr-1 custom-scrollbar">
                      {expenseItems.map((item, idx) => (
                        <div 
                          key={item.id} 
                          className="flex flex-col sm:grid sm:grid-cols-12 gap-2 items-center bg-white dark:bg-zinc-950 p-2 sm:p-2.5 rounded-xl border border-gray-200/80 dark:border-zinc-800 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-600 transition"
                        >
                          {/* Row Index */}
                          <div className="hidden sm:flex sm:col-span-1 items-center justify-center font-black text-xs text-gray-400">
                            {idx + 1}
                          </div>

                          {/* Product Name with Suggestions */}
                          <div className="w-full sm:col-span-4 relative">
                            <input 
                              id={`exp-item-name-${idx}`}
                              type="text" 
                              placeholder="اسم المنتج (طماطة، روبة، كباب...)" 
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
                                  if (idx === 0 && (!expNameInput.trim() || expCategoryInput === "سوبر ماركت")) {
                                    setExpCategoryInput(pred);
                                  }
                                }
                                newItems[idx].priority = detectProductPriority(val, newItems[idx].category || pred);
                                setExpenseItems(newItems);
                              }} 
                              className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700/80 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500/40 font-bold transition" 
                            />
                            {focusedProductIdx === idx && (item.name || "").length >= 1 && (() => {
                              const pQuery = normalizeArabicText(item.name || "");
                              const matched = normalizedProductPool.filter(n => n.norm.includes(pQuery)).slice(0, 6);
                              if (matched.length === 0) return null;
                              return (
                                <div className="absolute z-30 w-full mt-1 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-xl max-h-44 overflow-y-auto">
                                  {matched.map((prod, sIdx) => {
                                    const suggestedName = prod.raw;
                                    const pred = prod.pred;
                                    const nature = prod.nature;
                                    return (
                                      <div 
                                        key={sIdx} 
                                        onMouseDown={(e) => { 
                                          e.preventDefault();
                                          const newItems = [...expenseItems];
                                          newItems[idx].name = suggestedName;
                                          if (pred) {
                                            newItems[idx].category = pred;
                                            if (idx === 0 && (!expNameInput.trim() || expCategoryInput === "سوبر ماركت")) {
                                              setExpCategoryInput(pred);
                                            }
                                          }
                                          newItems[idx].priority = detectProductPriority(suggestedName, pred);
                                          setExpenseItems(newItems);
                                          setFocusedProductIdx(null);
                                        }} 
                                        className="px-3 py-1.5 hover:bg-indigo-50 dark:hover:bg-zinc-700 cursor-pointer text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center justify-between"
                                      >
                                        <div className="flex items-center gap-1.5">
                                          <span>{nature.type === "essential" ? "🥦" : nature.type === "discretionary" ? "🍭" : "📦"}</span>
                                          <span>{suggestedName}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          {nature.badge && (
                                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-black ${nature.colorClass} ${nature.lightBg}`}>
                                              {nature.badge}
                                            </span>
                                          )}
                                          {pred && (
                                            <span className="text-[9px] text-gray-400 bg-gray-100 dark:bg-zinc-800 px-1 py-0.2 rounded">
                                              {pred}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>

                          {/* Category Selector (Comprehensive Departments Sorted by Spend) */}
                          <div className="w-full sm:col-span-3">
                            <select
                              value={item.category || ""}
                              onChange={e => {
                                const newCat = e.target.value;
                                const newItems = [...expenseItems];
                                newItems[idx].category = newCat;
                                if (!newItems[idx].priority) {
                                  newItems[idx].priority = detectProductPriority(newItems[idx].name, newCat);
                                }
                                setExpenseItems(newItems);
                                if (newItems[idx].name && newCat) {
                                  saveLearnedCategory(newItems[idx].name, newCat);
                                }
                              }}
                              className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700/80 rounded-lg px-2 py-1.5 text-[11px] sm:text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/40 text-gray-800 dark:text-gray-200 cursor-pointer"
                            >
                              <option value="">اختر القسم (تنبؤ ذكي 🧠)</option>
                              {sortedProductCategories.map(cat => {
                                const spent = categorySpendingMap[cat.name] || 0;
                                return (
                                  <option key={cat.id} value={cat.name}>
                                    {cat.icon} {cat.name} {spent > 0 ? `(${fmt(spent)} د.ع)` : ""}
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          {/* Place / Shop Selector (Suggestions of past stores entered - only when typing >= 1 character) */}
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
                                if (val.trim().length >= 1) {
                                  setFocusedPlaceIdx(idx);
                                } else {
                                  setFocusedPlaceIdx(null);
                                }
                                const pred = detectProductCategory(val);
                                if (pred && !newItems[idx].category) {
                                  newItems[idx].category = pred;
                                }
                                setExpenseItems(newItems);
                              }}
                              className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700/80 rounded-lg px-2 py-1.5 text-[11px] sm:text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/40 text-gray-800 dark:text-gray-200"
                            />

                            {focusedPlaceIdx === idx && (item.place || "").trim().length >= 1 && (() => {
                              const pQuery = normalizeArabicText(item.place || "").trim();
                              const matching = normalizedUniquePlaces.filter(p => p.norm.includes(pQuery)).slice(0, 10);

                              if (matching.length === 0) return null;

                              return (
                                <div className="absolute z-30 w-full min-w-[190px] mt-1 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                  <div className="px-2.5 py-1 text-[9px] font-black text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-700/60 flex items-center justify-between">
                                    <span>🔍 نتائج المحلات السابقة المطابقة:</span>
                                  </div>
                                  {matching.map((pObj, sIdx) => {
                                    const pName = pObj.raw;
                                    const isCar = pName.includes("كراج") || pName.includes("فيتر") || pName.includes("بنزين");
                                    const isFood = pName.includes("مطعم") || pName.includes("كافيه") || pName.includes("مشويات");
                                    const isMarket = pName.includes("ماركت") || pName.includes("سوق");
                                    const icon = isCar ? "🚗" : isFood ? "🍽️" : isMarket ? "🛒" : "📍";
                                    return (
                                      <div
                                        key={sIdx}
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          const newItems = [...expenseItems];
                                          newItems[idx].place = pName;
                                          const pred = pObj.pred || detectProductCategory(pName);
                                          if (pred && !newItems[idx].category) {
                                            newItems[idx].category = pred;
                                          }
                                          setExpenseItems(newItems);
                                          setFocusedPlaceIdx(null);
                                        }}
                                        className="px-2.5 py-1.5 hover:bg-indigo-50 dark:hover:bg-zinc-700 cursor-pointer text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center justify-between"
                                      >
                                        <span className="truncate">{icon} {pName}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>

                          {/* Quantity & Price Row */}
                          <div className="w-full flex sm:contents gap-2">
                            {/* Quantity */}
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

                            {/* Price & Actions (Warranty + Delete) */}
                            <div className="flex-1 sm:col-span-1 flex items-center gap-1.5">
                              <input 
                                id={`exp-item-price-${idx}`}
                                type="number" 
                                placeholder="السعر" 
                                value={item.price || ''} 
                                onKeyDown={e => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    if (idx === expenseItems.length - 1) {
                                      const newId = `item-${Date.now()}-${Math.random().toString(36).substring(7)}`;
                                      const defaultPlace = selectedOutingPlace || (expCategoryInput === "طلعات وجولات" ? "سوق" : expNameInput.trim() || "");
                                      const updated: ExpenseItem[] = [...expenseItems, { 
                                        id: newId, 
                                        name: "", 
                                        quantity: 1, 
                                        price: 0, 
                                        category: "",
                                        place: defaultPlace,
                                        priority: "مهم"
                                      }];
                                      setExpenseItems(updated);
                                      setTimeout(() => {
                                        const nextInput = document.getElementById(`exp-item-name-${updated.length - 1}`);
                                        if (nextInput) nextInput.focus();
                                      }, 50);
                                    } else {
                                      const nextInput = document.getElementById(`exp-item-name-${idx + 1}`);
                                      if (nextInput) nextInput.focus();
                                    }
                                  }
                                }}
                                onChange={e => {
                                  const newItems = [...expenseItems];
                                  newItems[idx].price = Number(e.target.value);
                                  setExpenseItems(newItems);
                                }} 
                                className="w-full min-w-0 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700/80 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500/40 font-black text-rose-600 dark:text-rose-400 text-left transition" 
                              />

                              {/* Warranty Button */}
                              <button
                                type="button"
                                onClick={() => setActiveWarrantyItemIdx(idx)}
                                className={`p-1.5 rounded-lg border transition shrink-0 relative flex items-center justify-center ${
                                  item.hasWarranty
                                    ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-600 shadow-xs"
                                    : "bg-gray-100 dark:bg-zinc-800 text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 border-gray-200 dark:border-zinc-700"
                                }`}
                                title={item.hasWarranty ? `ضمان ${item.warrantyPeriod || 'مفعل'} - انقر لتعديل بطاقة الضمان` : 'إضافة بطاقة وفترة ضمان لهذا المنتج'}
                              >
                                <Shield className={`w-3.5 h-3.5 ${item.hasWarranty ? "fill-amber-500/30 text-amber-600 dark:text-amber-400" : ""}`} />
                                {item.hasWarranty && item.warrantyCardImage && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 absolute -top-0.5 -right-0.5 ring-1 ring-white"></span>
                                )}
                              </button>

                              <button 
                                type="button" 
                                onClick={async () => {
                                  if (await customConfirm("هل تريد حذف هذه المادة من القائمة؟", { confirmText: "نعم", cancelText: "لا" })) {
                                    setExpenseItems(expenseItems.filter(x => x.id !== item.id));
                                  }
                                }} 
                                className="text-red-500 hover:text-red-600 p-1.5 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 rounded-lg transition shrink-0 cursor-pointer"
                                title="حذف هذه المادة"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Item Priority Classification: تنبؤ ذكي تلقائي */}
                          <div className="w-full sm:col-span-12 flex items-center justify-between gap-1.5 pt-1.5 mt-0.5 border-t border-gray-100 dark:border-zinc-800/60">
                            <div className="flex items-center gap-2 text-[11px]">
                              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                <span>🧠 تصنيف المادة (تنبؤ ذكي تلقائي):</span>
                              </span>
                              {(() => {
                                const currentPriority = detectProductPriority(item.name, item.category);
                                const pInfo = getProductPriorityInfo(currentPriority);
                                return (
                                  <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border shadow-2xs flex items-center gap-1 ${pInfo.bgClass} ${pInfo.colorClass} ${pInfo.borderClass}`}>
                                    {pInfo.badge}
                                  </span>
                                );
                              })()}
                            </div>
                            <span className="text-[9px] text-gray-400">يُحدد تلقائياً بالذكاء الاصطناعي</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-gray-200 dark:border-zinc-800 flex justify-between items-center text-xs px-1">
                      <span className="text-gray-500 font-bold">💡 اضغط على زر Enter في حقل السعر لإضافة السطر التالي بسرعة</span>
                      <span className="font-black text-gray-800 dark:text-white">المجموع: {fmt(expenseItems.reduce((acc, curr) => acc + (curr.price || 0), 0))} د.ع</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50/70 dark:bg-zinc-900/40 border border-dashed border-gray-200 dark:border-zinc-800 rounded-2xl p-5 text-center">
                    <p className="text-xs font-bold text-gray-400 mb-2">لم تقم بإضافة مواد تفصيلية للمصروف بعد (اختياري)</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => receiptCameraInputRef.current?.click()}
                        className="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-xl border border-indigo-200/50 hover:bg-indigo-100 transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" /> كاميرا
                      </button>
                      <button
                        type="button"
                        onClick={() => receiptGalleryInputRef.current?.click()}
                        className="text-xs font-black text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 px-3 py-1.5 rounded-xl border border-purple-200/50 hover:bg-purple-100 transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <ImageIcon className="w-3.5 h-3.5" /> استوديو
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowQuickPasteModal(true)}
                        className="text-xs font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-200/50 hover:bg-amber-100 transition flex items-center gap-1.5"
                      >
                        <Zap className="w-3.5 h-3.5" /> الصق نص القائمة
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpenseItems([{ 
                          id: `item-${Date.now()}`, 
                          name: "", 
                          quantity: 1, 
                          price: 0,
                          category: "",
                          place: expNameInput.trim() || (expCategoryInput === "طلعات وجولات" ? "سوق" : "سوبر ماركت"),
                          priority: "مهم"
                        }])}
                        className="text-xs font-black text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-zinc-800 px-3 py-1.5 rounded-xl hover:bg-gray-200 transition flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" /> أضف يدوياً
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button 
                type="submit" 
                disabled={isSavingExpense}
                className="w-full bg-gradient-to-l from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 disabled:opacity-60 text-white font-black py-3.5 rounded-2xl shadow-lg shadow-rose-500/25 mt-3 active:scale-[0.98] transition flex items-center justify-center gap-2 text-base cursor-pointer"
              >
                {isSavingExpense ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>جاري حفظ المصروف في السحابة...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    <span>{editExpense ? "تحديث وحفظ المصروف" : "حفظ المصروف"}</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── Smart Bulk Paste Modal ─── */}
      {showQuickPasteModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 rounded-[32px] p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-zinc-800 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-500">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-gray-900 dark:text-white text-base">لصق قائمة سريعة</h4>
                  <p className="text-[11px] text-gray-500 font-bold">تحويل قائمة نصوص تلقائياً إلى بنود في الفاتورة</p>
                </div>
              </div>
              <button onClick={() => setShowQuickPasteModal(false)} className="p-2 bg-gray-100 dark:bg-zinc-800 rounded-full">
                <X className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 leading-relaxed">
              الصق النص من الواتساب أو الملاحظات، مثل:
              <br />
              <span className="font-mono text-[11px] text-amber-600 dark:text-amber-400 block mt-1 bg-amber-50/50 dark:bg-zinc-900 p-2 rounded-xl border border-amber-100 dark:border-zinc-800">
                خبز تورتيلا 1 1250<br />
                سفن اب موهيتو 500<br />
                معجون طماطم 2 2500
              </span>
            </p>

            <textarea
              rows={6}
              value={quickPasteText}
              onChange={e => setQuickPasteText(e.target.value)}
              placeholder="الصق أسطر المشتريات هنا..."
              className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-3 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500/30 transition resize-none custom-scrollbar"
            />

            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={handleQuickPasteSubmit}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-black py-2.5 rounded-xl transition shadow-md shadow-amber-500/20 text-xs flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> إضافة إلى الفاتورة
              </button>
              <button
                type="button"
                onClick={() => setShowQuickPasteModal(false)}
                className="px-4 py-2.5 bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 font-bold rounded-xl text-xs hover:bg-gray-200 transition"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Item Warranty Modal ─── */}
      {activeWarrantyItemIdx !== null && expenseItems[activeWarrantyItemIdx] && (() => {
        const item = expenseItems[activeWarrantyItemIdx];
        const updateActiveItem = (patch: Partial<ExpenseItem>) => {
          const updated = [...expenseItems];
          updated[activeWarrantyItemIdx] = { ...updated[activeWarrantyItemIdx], ...patch };
          setExpenseItems(updated);
        };

        return (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-950 w-full max-w-md rounded-[32px] p-6 shadow-2xl border border-gray-100 dark:border-zinc-800 animate-in zoom-in-95 duration-200 text-right">
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Shield className="w-5 h-5 fill-amber-500/20" />
                  </div>
                  <div>
                    <h4 className="font-black text-gray-900 dark:text-white text-base">
                      كفالة وضمان المنتج
                    </h4>
                    <p className="text-[11px] text-gray-500 font-bold truncate max-w-[220px]">
                      {item.name ? `المادة: ${item.name}` : "تفاصيل بطاقة الضمان"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveWarrantyItemIdx(null)}
                  className="p-2 bg-gray-100 dark:bg-zinc-800 rounded-full hover:bg-gray-200 transition"
                >
                  <X className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Active Switch */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-black text-amber-950 dark:text-amber-200">تفعيل الضمان لهذا المنتج</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={item.hasWarranty || false}
                    onChange={e => {
                      const enabled = e.target.checked;
                      const defaultPeriod = item.warrantyPeriod || "سنة واحدة";
                      const expiry = enabled ? calculateWarrantyExpiryDate(defaultPeriod, expDateInput) : undefined;
                      updateActiveItem({
                        hasWarranty: enabled,
                        warrantyPeriod: enabled ? defaultPeriod : item.warrantyPeriod,
                        warrantyExpiryDate: expiry
                      });
                    }}
                    className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
                  />
                </div>

                {item.hasWarranty && (
                  <>
                    {/* Period Presets */}
                    <div>
                      <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 block">
                        مدة / فترة الضمان:
                      </label>
                      <div className="grid grid-cols-3 gap-1.5 mb-2">
                        {WARRANTY_PERIOD_PRESETS.map(preset => {
                          const isSel = item.warrantyPeriod === preset;
                          return (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => {
                                const expiry = calculateWarrantyExpiryDate(preset, expDateInput);
                                updateActiveItem({
                                  warrantyPeriod: preset,
                                  warrantyExpiryDate: expiry
                                });
                              }}
                              className={`py-2 px-2 rounded-xl text-xs font-black transition border ${
                                isSel
                                  ? "bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-500/20 scale-[1.02]"
                                  : "bg-gray-50 dark:bg-zinc-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-zinc-800 hover:border-amber-400"
                              }`}
                            >
                              {preset}
                            </button>
                          );
                        })}
                      </div>

                      {/* Custom input or expiry date view */}
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 mb-0.5 block">فترة مخصصة:</label>
                          <input
                            type="text"
                            placeholder="مثال: سنتين ونصف"
                            value={item.warrantyPeriod || ""}
                            onChange={e => {
                              const p = e.target.value;
                              const expiry = calculateWarrantyExpiryDate(p, expDateInput);
                              updateActiveItem({
                                warrantyPeriod: p,
                                warrantyExpiryDate: expiry
                              });
                            }}
                            className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500/30"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 mb-0.5 block">تاريخ انتهاء الضمان:</label>
                          <input
                            type="date"
                            value={item.warrantyExpiryDate || ""}
                            onChange={e => updateActiveItem({ warrantyExpiryDate: e.target.value })}
                            className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-2.5 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500/30"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Warranty Card Photo */}
                    <div>
                      <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 block">
                        صورة بطاقة / وصل الضمان:
                      </label>
                      {item.warrantyCardImage ? (
                        <div className="relative rounded-2xl overflow-hidden border border-amber-200 dark:border-amber-800/40 bg-zinc-900 group">
                          <img
                            src={item.warrantyCardImage}
                            alt="بطاقة الضمان"
                            className="w-full h-44 object-cover cursor-pointer group-hover:scale-105 transition duration-300"
                            onClick={() => setWarrantyCardPreviewUrl(item.warrantyCardImage || null)}
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => setWarrantyCardPreviewUrl(item.warrantyCardImage || null)}
                              className="p-2 bg-white/90 text-gray-900 rounded-xl font-bold text-xs flex items-center gap-1 shadow-md hover:bg-white"
                            >
                              <ZoomIn className="w-4 h-4" /> معاينة كاملة
                            </button>
                            <button
                              type="button"
                              onClick={() => updateActiveItem({ warrantyCardImage: undefined })}
                              className="p-2 bg-rose-600 text-white rounded-xl font-bold text-xs flex items-center gap-1 shadow-md hover:bg-rose-700"
                            >
                              <Trash2 className="w-4 h-4" /> حذف
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => warrantyCameraInputRef.current?.click()}
                            className="flex-1 py-3 px-3 bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-dashed border-amber-300 dark:border-amber-600 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 transition active:scale-95"
                          >
                            <Camera className="w-4 h-4" /> التقاط بكاميرا الضمان
                          </button>
                          <button
                            type="button"
                            onClick={() => warrantyGalleryInputRef.current?.click()}
                            className="flex-1 py-3 px-3 bg-gray-50 hover:bg-gray-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-300 border border-dashed border-gray-300 dark:border-zinc-700 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 transition active:scale-95"
                          >
                            <ImageIcon className="w-4 h-4" /> اختيار من الاستوديو
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Warranty Notes */}
                    <div>
                      <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 block">
                        ملاحظات أو شروط الضمان (اختياري):
                      </label>
                      <input
                        type="text"
                        placeholder="مثال: الضمان يشمل استبدال القطع فقط، هاتف الصيانة: 077..."
                        value={item.warrantyNotes || ""}
                        onChange={e => updateActiveItem({ warrantyNotes: e.target.value })}
                        className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500/30"
                      />
                    </div>
                  </>
                )}

                <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setActiveWarrantyItemIdx(null)}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-black py-2.5 rounded-xl transition shadow-md shadow-amber-500/20 text-xs flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" /> حفظ وإغلاق
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── Fullscreen Warranty Card Image Lightbox ─── */}
      {warrantyCardPreviewUrl && (
        <div 
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setWarrantyCardPreviewUrl(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] flex flex-col items-center" onClick={e => e.stopPropagation()}>
            <div className="absolute -top-12 left-0 right-0 flex justify-between items-center text-white">
              <span className="text-sm font-black flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-amber-400" /> معاينة بطاقة الضمان
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={warrantyCardPreviewUrl}
                  download="warranty-card.jpg"
                  className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition flex items-center gap-1 text-xs font-bold"
                  title="تحميل الصورة"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setWarrantyCardPreviewUrl(null)}
                  className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <img
              src={warrantyCardPreviewUrl}
              alt="معاينة بطاقة الضمان كاملة"
              className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl border border-white/10"
            />
          </div>
        </div>
      )}

      {/* ─── Central Warranties Registry Dashboard Modal ─── */}
      {showWarrantiesRegistryModal && (() => {
        const allWarrantiedItems: Array<{
          expenseId: string;
          expenseName: string;
          expenseDate: string;
          item: ExpenseItem;
        }> = [];

        allExpenses.forEach(exp => {
          (exp.items || []).forEach(it => {
            if (it.hasWarranty) {
              allWarrantiedItems.push({
                expenseId: exp.id,
                expenseName: exp.name,
                expenseDate: exp.date,
                item: it
              });
            }
          });
        });

        return (
          <div className="fixed inset-0 z-[125] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-950 w-full sm:max-w-3xl rounded-t-[32px] sm:rounded-[32px] px-5 sm:px-7 pt-5 pb-8 shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200 border border-gray-100 dark:border-zinc-800 max-h-[90svh] overflow-y-auto mb-[75px] sm:mb-0 custom-scrollbar text-right">
              {/* Header */}
              <div className="flex justify-between items-start mb-4 pb-4 border-b border-gray-100 dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Shield className="w-6 h-6 fill-amber-500/20" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                      <span>سجل كفالات وضمانات الأجهزة</span>
                      <span className="text-xs bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-black">
                        {allWarrantiedItems.length} أجهزة
                      </span>
                    </h3>
                    <p className="text-xs font-bold text-gray-500">
                      متابعة بطاقات وتواريخ انتهاء الضمان للمشتريات والأجهزة الكهربائية
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWarrantiesRegistryModal(false)}
                  className="p-2 bg-gray-100 dark:bg-zinc-800 rounded-full hover:bg-gray-200 transition"
                >
                  <X className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
              </div>

              {/* Items List */}
              {allWarrantiedItems.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 rounded-3xl bg-amber-50 dark:bg-amber-950/30 text-amber-500 flex items-center justify-center mx-auto mb-3">
                    <Shield className="w-8 h-8" />
                  </div>
                  <h4 className="font-black text-sm text-gray-800 dark:text-gray-200 mb-1">
                    لا توجد أجهزة أو مواد مسجلة بضمان بعد
                  </h4>
                  <p className="text-xs font-bold text-gray-400 max-w-sm mx-auto">
                    عند تسجيل أي مصروف يحتوي على أجهزة أو مشتريات مكفولة، اضغط على زر 🛡️ ضمان بجانب المادة لحفظ بطاقة الضمان وفترة الصلاحية!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {allWarrantiedItems.map(({ expenseId, expenseName, expenseDate, item }, wIdx) => {
                    const status = getWarrantyStatus(item.warrantyExpiryDate);

                    return (
                      <div
                        key={`${expenseId}-${item.id || wIdx}`}
                        className="p-3.5 rounded-2xl bg-gray-50/80 dark:bg-zinc-900/60 border border-gray-200/80 dark:border-zinc-800 flex flex-col justify-between space-y-3 hover:border-amber-400/60 transition shadow-xs"
                      >
                        <div>
                          <div className="flex justify-between items-start gap-2 mb-1.5">
                            <h4 className="font-black text-sm text-gray-900 dark:text-white line-clamp-1">
                              {item.name || "مادة بدون اسم"}
                            </h4>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 border ${status.badgeClass}`}>
                              {status.label}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500 font-bold mb-2">
                            <span>🧾 {expenseName}</span>
                            <span>•</span>
                            <span>📅 شراء: {new Date(expenseDate).toLocaleDateString("ar-IQ")}</span>
                            {item.place && (
                              <>
                                <span>•</span>
                                <span>📍 {item.place}</span>
                              </>
                            )}
                          </div>

                          {/* Warranty Duration & Expiry */}
                          <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-950 border border-gray-100 dark:border-zinc-800 text-xs space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-500 font-bold">مدة الضمان:</span>
                              <span className="font-black text-amber-600 dark:text-amber-400">{item.warrantyPeriod || "غير محدد"}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-500 font-bold">تاريخ الانتهاء:</span>
                              <span className="font-black text-gray-800 dark:text-gray-200">
                                {item.warrantyExpiryDate ? new Date(item.warrantyExpiryDate).toLocaleDateString("ar-IQ") : "غير محدد"}
                              </span>
                            </div>
                            {status.daysRemaining !== null && !status.isExpired && (
                              <div className="flex justify-between items-center pt-1 border-t border-gray-100 dark:border-zinc-800/60 text-[11px]">
                                <span className="text-gray-400 font-bold">المتبقي:</span>
                                <span className="font-black text-emerald-600 dark:text-emerald-400">
                                  {status.daysRemaining} يوم
                                </span>
                              </div>
                            )}
                            {item.warrantyNotes && (
                              <div className="pt-1 text-[11px] text-gray-500 font-bold">
                                💡 {item.warrantyNotes}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Card Image Thumbnail + Actions */}
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-200/60 dark:border-zinc-800">
                          {item.warrantyCardImage ? (
                            <button
                              type="button"
                              onClick={() => setWarrantyCardPreviewUrl(item.warrantyCardImage || null)}
                              className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 hover:underline"
                            >
                              <img
                                src={item.warrantyCardImage}
                                alt="بطاقة الضمان"
                                className="w-7 h-7 rounded-lg object-cover border border-amber-300"
                              />
                              <span>عرض بطاقة الضمان</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-gray-400 font-bold">لا توجد صورة للبطاقة</span>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              const foundExp = allExpenses.find(e => e.id === expenseId);
                              if (foundExp) {
                                setShowWarrantiesRegistryModal(false);
                                setViewingReceiptExpense(foundExp);
                              }
                            }}
                            className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold border border-indigo-200 dark:border-indigo-800/40 hover:bg-indigo-100 transition"
                          >
                            عرض الفاتورة 🧾
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ─── Viewing Full Receipt Details Modal ─── */}
      {viewingReceiptExpense && (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 w-full sm:max-w-2xl rounded-t-[32px] sm:rounded-[32px] px-5 sm:px-7 pt-5 pb-8 shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200 border border-gray-100 dark:border-zinc-800 max-h-[92svh] overflow-y-auto mb-[75px] sm:mb-0 custom-scrollbar">
            
            {/* Header */}
            <div className="flex justify-between items-start mb-4 pb-4 border-b border-gray-100 dark:border-zinc-800">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">🧾</span>
                  <h3 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white">
                    {viewingReceiptExpense.name}
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400">
                  <span className="bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">{viewingReceiptExpense.category}</span>
                  <span>•</span>
                  <span>{new Date(viewingReceiptExpense.date).toLocaleDateString("ar-IQ")}</span>
                  <span>•</span>
                  <span className="text-rose-600 dark:text-rose-400 font-black">{fmt(viewingReceiptExpense.amount)} د.ع</span>
                  <span>•</span>
                  <span>{(viewingReceiptExpense.items || []).length} مواد</span>
                </div>
              </div>
              <button 
                onClick={() => setViewingReceiptExpense(null)} 
                className="p-2 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-full transition"
              >
                <X className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* Invoice Photos Preview Gallery */}
            {(() => {
              const images = (viewingReceiptExpense.receiptImages && viewingReceiptExpense.receiptImages.length > 0)
                ? viewingReceiptExpense.receiptImages
                : (viewingReceiptExpense.imageUrl ? [viewingReceiptExpense.imageUrl] : []);
              if (images.length === 0) return null;
              return (
                <div className="mb-4 p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-zinc-900 border border-indigo-100 dark:border-zinc-800">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-black text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-indigo-600" />
                      <span>صور الفاتورة المرفقة ({images.length})</span>
                    </h4>
                    <span className="text-[10px] text-gray-500 font-bold">اضغط للاستعراض والتكبير</span>
                  </div>
                  <div className="flex gap-2.5 overflow-x-auto pb-1 custom-scrollbar">
                    {images.map((img, i) => (
                      <a
                        key={i}
                        href={img}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative shrink-0 w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden border border-indigo-200 dark:border-zinc-700 bg-black/5 hover:scale-102 transition shadow-xs cursor-pointer"
                      >
                        <img src={img} alt={`فاتورة ${i + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[11px] font-bold transition">
                          🔍 تكبير
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Grouping Mode Switcher */}
            <div className="flex flex-wrap gap-1.5 items-center mb-3">
              <span className="text-[11px] font-black text-gray-500 dark:text-gray-400 ml-1">عرض المواد:</span>
              <button
                type="button"
                onClick={() => setViewReceiptGroupingMode("order")}
                className={`px-2.5 py-1 rounded-xl text-xs font-black transition ${
                  viewReceiptGroupingMode === "order"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
                }`}
              >
                الترتيب الأصلي
              </button>
              <button
                type="button"
                onClick={() => setViewReceiptGroupingMode("priority")}
                className={`px-2.5 py-1 rounded-xl text-xs font-black transition flex items-center gap-1 ${
                  viewReceiptGroupingMode === "priority"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100"
                }`}
              >
                <span>🥗 حسب أولوية الأقسام</span>
              </button>
              <button
                type="button"
                onClick={() => setViewReceiptGroupingMode("place")}
                className={`px-2.5 py-1 rounded-xl text-xs font-black transition flex items-center gap-1 ${
                  viewReceiptGroupingMode === "place"
                    ? "bg-teal-600 text-white shadow-xs"
                    : "bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 hover:bg-teal-100"
                }`}
              >
                <span>📍 حسب محطات الطلعة</span>
              </button>
            </div>

            {/* Warrantied Items Showcase in Receipt */}
            {(() => {
              const warrantiedItems = (viewingReceiptExpense.items || []).filter(it => it.hasWarranty);
              if (warrantiedItems.length === 0) return null;

              return (
                <div className="mb-3.5 p-3 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800/50">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-black text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-amber-600 fill-amber-500/20" />
                      <span>الأجهزة والمواد المكفولة في هذه الفاتورة ({warrantiedItems.length})</span>
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {warrantiedItems.map((wItem, wIdx) => {
                      const status = getWarrantyStatus(wItem.warrantyExpiryDate);
                      return (
                        <div key={wIdx} className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-amber-200/60 dark:border-zinc-800 flex items-center justify-between gap-2 shadow-xs">
                          <div className="min-w-0 flex-1">
                            <div className="font-black text-xs text-gray-900 dark:text-white truncate">{wItem.name}</div>
                            <div className="text-[10px] font-bold text-gray-500 flex items-center gap-1 mt-0.5">
                              <span>ضمان: {wItem.warrantyPeriod || "سنة"}</span>
                              <span>•</span>
                              <span className={`px-1.5 py-0.2 rounded font-black border ${status.badgeClass}`}>{status.label}</span>
                            </div>
                          </div>
                          {wItem.warrantyCardImage && (
                            <button
                              type="button"
                              onClick={() => setWarrantyCardPreviewUrl(wItem.warrantyCardImage || null)}
                              className="shrink-0 p-0.5 rounded-lg border border-amber-300 hover:scale-105 transition"
                              title="معاينة بطاقة الضمان"
                            >
                              <img src={wItem.warrantyCardImage} alt="كارت الضمان" className="w-9 h-9 object-cover rounded-md" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Search inside receipt */}
            <div className="relative mb-3">
              <input
                type="text"
                placeholder="ابحث في مواد الفاتورة (مثال: جبن، قهوة...)"
                value={receiptItemFilter}
                onChange={e => setReceiptItemFilter(e.target.value)}
                className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl px-4 py-2.5 pr-10 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 transition"
              />
              <Search className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              {receiptItemFilter && (
                <button onClick={() => setReceiptItemFilter("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Items Table */}
            <div className="bg-gray-50 dark:bg-zinc-900/60 rounded-2xl border border-gray-200/80 dark:border-zinc-800 overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-3 py-2.5 bg-gray-100/70 dark:bg-zinc-800/60 text-[11px] font-black text-gray-500 border-b border-gray-200 dark:border-zinc-800 text-right">
                <div className="col-span-1 text-center">#</div>
                <div className="col-span-4">اسم المادة والقسم</div>
                <div className="col-span-3">المكان / المحل 📍</div>
                <div className="col-span-2 text-center">الكمية</div>
                <div className="col-span-2 text-left">الإجمالي (د.ع)</div>
              </div>

              <div className="divide-y divide-gray-100 dark:divide-zinc-800/80 max-h-[350px] overflow-y-auto custom-scrollbar">
                {(() => {
                  const normItemFilter = normalizeArabicText(receiptItemFilter.trim());
                  const itemTokens = normItemFilter.split(/\s+/).filter(Boolean);
                  const filtered = (viewingReceiptExpense.items || []).filter(item => {
                    if (itemTokens.length === 0) return true;
                    const corpus = normalizeArabicText([
                      item.name,
                      item.category,
                      item.place,
                      item.warrantyNotes,
                      item.price?.toString(),
                      item.quantity?.toString()
                    ].filter(Boolean).join(" "));
                    return itemTokens.every(tok => corpus.includes(tok));
                  });

                  // Apply view grouping mode
                  let itemsToRender = [...filtered];
                  if (viewReceiptGroupingMode === "priority") {
                    itemsToRender = sortItemsByCategoryPriority(itemsToRender);
                  } else if (viewReceiptGroupingMode === "place") {
                    itemsToRender.sort((a, b) => (a.place || "").localeCompare(b.place || ""));
                  }

                  if (itemsToRender.length === 0) {
                    return (
                      <div className="text-center py-8 text-xs font-bold text-gray-400">
                        {receiptItemFilter ? "لا توجد مواد مطابقة للبحث" : "لا توجد مواد في هذه القائمة"}
                      </div>
                    );
                  }

                  return itemsToRender.map((item, idx) => {
                    const resolvedCat = item.category || detectProductCategory(item.name);
                    const catDef = resolvedCat ? PRODUCT_CATEGORY_MAP[resolvedCat] : null;
                    const nature = classifyItemNature(item.name, resolvedCat);

                    return (
                      <div key={item.id || idx} className={`grid grid-cols-12 gap-2 px-3 py-2.5 text-xs items-center transition ${nature.type === "discretionary" ? "hover:bg-rose-50/50 dark:hover:bg-rose-950/20" : "hover:bg-white dark:hover:bg-zinc-800/50"}`}>
                        <div className="col-span-1 text-center font-bold text-gray-400 text-[11px]">{idx + 1}</div>
                        
                        <div className="col-span-4 min-w-0 font-bold text-gray-800 dark:text-gray-200">
                          <div className="truncate font-black">{item.name}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1">
                            {resolvedCat && (
                              <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md font-bold border ${catDef ? `${catDef.bgLight} ${catDef.bgDark} ${catDef.color}` : 'bg-gray-100 text-gray-600'}`}>
                                <span>{catDef?.icon || "🏷️"}</span>
                                <span>{resolvedCat}</span>
                              </span>
                            )}
                            {(() => {
                              const itPriority = item.priority || detectProductPriority(item.name, resolvedCat);
                              const pInfo = getProductPriorityInfo(itPriority);
                              return (
                                <span className={`inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-md font-black border ${pInfo.bgClass} ${pInfo.colorClass} ${pInfo.borderClass}`}>
                                  {pInfo.badge}
                                </span>
                              );
                            })()}
                          </div>
                        </div>

                        <div className="col-span-3 min-w-0 overflow-hidden text-gray-600 dark:text-gray-300">
                          {item.place ? (
                            <span className="flex items-center gap-0.5 max-w-full min-w-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50">
                              <span className="shrink-0">📍</span>
                              <span className="truncate min-w-0">{item.place}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400">-</span>
                          )}
                        </div>

                        <div className="col-span-2 justify-self-center text-center font-black text-gray-600 dark:text-gray-300 bg-gray-200/60 dark:bg-zinc-800 px-2 py-0.5 rounded-md text-[11px] whitespace-nowrap">
                          {item.quantity}
                        </div>

                        <div className="col-span-2 text-left whitespace-nowrap font-black text-rose-600 dark:text-rose-400">
                          {fmt(item.price)} <span className="text-[9px] font-bold text-gray-400">د.ع</span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Total Footer */}
              <div className="bg-gray-100/90 dark:bg-zinc-800 px-4 py-3 border-t border-gray-200 dark:border-zinc-700 flex justify-between items-center text-xs">
                <span className="font-bold text-gray-600 dark:text-gray-300">
                  إجمالي الفاتورة: {(viewingReceiptExpense.items || []).length} مادة
                </span>
                <span className="font-black text-sm text-rose-600 dark:text-rose-400">
                  {fmt(viewingReceiptExpense.amount)} د.ع
                </span>
              </div>
            </div>

            {/* Department & Outing Places Breakdown Summary */}
            {(() => {
              const items = viewingReceiptExpense.items || [];
              if (items.length === 0) return null;

              // Group by category
              const catTotals: Record<string, { count: number; total: number; icon: string }> = {};
              // Group by place
              const placeTotals: Record<string, { count: number; total: number }> = {};

              items.forEach(it => {
                const cat = it.category || detectProductCategory(it.name) || "أخرى";
                const catDef = PRODUCT_CATEGORY_MAP[cat];
                const price = Number(it.price) || 0;
                
                if (!catTotals[cat]) {
                  catTotals[cat] = { count: 0, total: 0, icon: catDef?.icon || "🏷️" };
                }
                catTotals[cat].count += 1;
                catTotals[cat].total += price;

                if (it.place && it.place.trim()) {
                  const pl = it.place.trim();
                  if (!placeTotals[pl]) {
                    placeTotals[pl] = { count: 0, total: 0 };
                  }
                  placeTotals[pl].count += 1;
                  placeTotals[pl].total += price;
                }
              });

              const sortedCats = Object.entries(catTotals).sort((a, b) => b[1].total - a[1].total);
              const sortedPlaces = Object.entries(placeTotals).sort((a, b) => b[1].total - a[1].total);

              return (
                <div className="mt-3.5 p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 space-y-3">
                  <div>
                    <h4 className="text-xs font-black text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5 mb-2">
                      <span>📊</span>
                      <span>تحليل مشتريات الفاتورة حسب الأقسام (مرتبة حسب الأهمية)</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {sortedCats.map(([cName, data]) => (
                        <div key={cName} className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-indigo-100 dark:border-zinc-800 flex items-center justify-between text-xs shadow-xs">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-sm">{data.icon}</span>
                            <span className="font-bold text-gray-800 dark:text-gray-200 truncate">{cName}</span>
                            <span className="text-[10px] text-gray-400 font-bold">({data.count})</span>
                          </div>
                          <span className="font-black text-rose-600 dark:text-rose-400 text-xs shrink-0">{fmt(data.total)} د.ع</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {sortedPlaces.length > 0 && (
                    <div className="pt-2.5 border-t border-indigo-100 dark:border-indigo-900/30">
                      <h5 className="text-[11px] font-black text-indigo-900 dark:text-indigo-300 flex items-center gap-1 mb-1.5">
                        <span>📍</span>
                        <span>توزيع الصرف حسب المحطات والأماكن في الطلعة:</span>
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {sortedPlaces.map(([plName, data]) => (
                          <div key={plName} className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-zinc-800 text-[11px] font-black text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5 shadow-xs">
                            <span>📍 {plName}</span>
                            <span className="text-gray-400 text-[10px]">({data.count} مواد):</span>
                            <span className="text-rose-600 dark:text-rose-400 font-black">{fmt(data.total)} د.ع</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Actions Bar */}
            <div className="flex flex-wrap gap-2.5 mt-4">
              <button
                type="button"
                onClick={() => {
                  const lines = (viewingReceiptExpense.items || []).map((it, i) => `${i + 1}. ${it.name} (عدد: ${it.quantity}) - ${fmt(it.price)} د.ع`);
                  const text = `🧾 فاتورة: ${viewingReceiptExpense.name}\n📅 التاريخ: ${viewingReceiptExpense.date}\n💰 الإجمالي: ${fmt(viewingReceiptExpense.amount)} د.ع\n\nالمواد:\n${lines.join("\n")}`;
                  navigator.clipboard.writeText(text);
                  toast.success("تم نسخ قائمة الفاتورة إلى الحافظة 📋");
                }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-gray-200 font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Copy className="w-4 h-4" /> نسخ القائمة
              </button>

              <button
                type="button"
                onClick={() => {
                  const expToEdit = viewingReceiptExpense;
                  setViewingReceiptExpense(null);
                  setEditExpense(expToEdit);
                  setShowExpenseModal(true);
                }}
                className="flex-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Edit2 className="w-4 h-4" /> تعديل في تسجيل المصروف
              </button>
            </div>
          </div>
        </div>
      )}



      {/* ─── Income Modal ─── */}
      {(showIncomeModal || !!editIncome) && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center">
          <div className="bg-white dark:bg-zinc-950 w-full sm:max-w-sm rounded-t-[32px] sm:rounded-[32px] px-5 pt-5 pb-8 shadow-2xl animate-in slide-in-from-bottom-10 duration-200 border border-gray-100 dark:border-zinc-800 max-h-[calc(100svh-80px)] overflow-y-auto mb-[80px] sm:mb-0">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-black text-gray-900 dark:text-white">{editIncome ? "تعديل الدخل" : "تسجيل دخل"}</h3>
              <button onClick={() => { setShowIncomeModal(false); setEditIncome(null);
}} className="p-2 bg-gray-100 dark:bg-zinc-800 rounded-full">
                <X className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSaveIncome} className="space-y-3">
              <div>
                <label className="label-sm">المصدر</label>
                <input autoComplete="off" name="name" defaultValue={editIncome?.name} required placeholder="مثال: راتب شهر يوليو" className="input-field" />
              </div>
              <div>
                <label className="label-sm">النوع</label>
                <select name="type" defaultValue={editIncome?.type || "راتب"} className="input-field">
                  <option value="راتب">راتب</option>
                  <option value="حافز">حافز</option>
                  <option value="إضافي">دخل إضافي</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-sm">المبلغ (د.ع)</label>
                  <input autoComplete="off" name="amount" type="number" defaultValue={editIncome?.amount} required placeholder="0" className="input-field" />
                </div>
                <div>
                  <label className="label-sm">التاريخ</label>
                  <input autoComplete="off" name="date" type="date" defaultValue={editIncome?.date || today()} required className="input-field" />
                </div>
              </div>
              <button type="submit" className="w-full bg-gradient-to-l from-emerald-500 to-teal-600 text-white font-black py-3.5 rounded-xl shadow-lg mt-2 active:scale-[0.98] transition">
                حفظ
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── Travel Shortcut Modal ─── */}
      {showTravelShortcutModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#120F24] rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-300 border border-gray-100 dark:border-zinc-800">
            <h3 className="text-lg font-black text-center mb-4 text-gray-800 dark:text-white">خيارات السفر</h3>
            <div className="space-y-3">
              <button onClick={() => {
                setShowTravelShortcutModal(false);
                setShowTripModal(true);
              }} className="w-full bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold p-4 rounded-xl flex items-center gap-3 hover:scale-[0.98] transition border border-sky-100 dark:border-sky-500/30">
                <Plane className="w-5 h-5" /> إضافة رحلة جديدة
              </button>
              
              <button onClick={() => {
                setShowTravelShortcutModal(false);
                if (travelTrips.length === 1) {
                  setSelectedTrip(travelTrips[0]);
                  setShowTripExpenseModal(true);
                } else if (travelTrips.length > 1) {
                  setShowTripSelectorModal(true);
                } else {
                  toast.error("لا توجد رحلات مضافة بعد!");
                }
              }} className="w-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold p-4 rounded-xl flex items-center gap-3 hover:scale-[0.98] transition border border-indigo-100 dark:border-indigo-500/30">
                <Wallet className="w-5 h-5" /> إضافة مصروف لرحلة
              </button>
            </div>
            <button onClick={() => setShowTravelShortcutModal(false)} className="w-full mt-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 font-bold p-2 transition">إلغاء</button>
          </div>
        </div>
      )}

      {/* ─── Trip Selector Modal ─── */}
      {showTripSelectorModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#120F24] rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-300 border border-gray-100 dark:border-zinc-800">
            <h3 className="text-lg font-black text-center mb-4 text-gray-800 dark:text-white">اختر الرحلة</h3>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {travelTrips.map(trip => (
                <button key={trip.id} onClick={() => {
                  setSelectedTrip(trip);
                  setShowTripSelectorModal(false);
                  setShowTripExpenseModal(true);
                }} className="w-full text-right bg-gray-50 dark:bg-zinc-800/50 p-4 rounded-xl font-bold text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition border border-gray-100 dark:border-zinc-800 flex items-center justify-between">
                  <span>{trip.name} ({trip.destination})</span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
              ))}
            </div>
            <button onClick={() => setShowTripSelectorModal(false)} className="w-full mt-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 font-bold p-2 transition">إلغاء</button>
          </div>
        </div>
      )}

      {/* ─── Inventory Modal ─── */}
      {(showInventoryModal || !!editInventory) && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center">
          <div className="bg-white dark:bg-zinc-950 w-full sm:max-w-sm rounded-t-[32px] sm:rounded-[32px] px-5 pt-5 pb-8 shadow-2xl animate-in slide-in-from-bottom-10 duration-200 border border-gray-100 dark:border-zinc-800 max-h-[calc(100svh-80px)] overflow-y-auto mb-[80px] sm:mb-0">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-black text-gray-900 dark:text-white">{editInventory ? "تعديل المادة" : "إضافة مادة"}</h3>
              <button onClick={() => { setShowInventoryModal(false);
setEditInventory(null); }} className="p-2 bg-gray-100 dark:bg-zinc-800 rounded-full">
                <X className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            
            {!editInventory && (
              <div className="flex p-1 bg-gray-100 dark:bg-zinc-800 rounded-2xl mb-4">
                <button
                  type="button"
                  onClick={() => setInvStatusMode("available")}
                  className={`flex-1 py-2 text-sm font-bold rounded-xl transition ${invStatusMode === "available" ? "bg-white dark:bg-zinc-700 shadow text-gray-900 dark:text-white" : "text-gray-500"}`}
                >
                  مادة متوفرة
                </button>
                <button
                  type="button"
                  onClick={() => setInvStatusMode("shortage")}
                  className={`flex-1 py-2 text-sm font-bold rounded-xl transition ${invStatusMode === "shortage" ? "bg-white dark:bg-zinc-700 shadow text-red-500" : "text-gray-500"}`}
                >
                  نقص (احتياج)
                </button>
              </div>
            )}

            <form onSubmit={handleSaveInventory} className="space-y-3">
              
              <div>
                <label className="label-sm">صورة المادة (اختياري)</label>
                <div className="flex items-center gap-3">
                  {editInventory?.imageUrl && !imageFile && (
                    <img src={editInventory.imageUrl} alt="" className="w-12 h-12 rounded-xl object-cover border border-gray-100 dark:border-zinc-800" />
                  )}
                  {imageFile && (
                    <img src={URL.createObjectURL(imageFile)} alt="" className="w-12 h-12 rounded-xl object-cover border border-gray-100 dark:border-zinc-800" />
                  )}
                  <input type="file" accept="image/*" onChange={e => {
                    if (e.target.files && e.target.files[0]) setImageFile(e.target.files[0]);
                  }} className="text-xs w-full file:mr-0 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 dark:file:bg-orange-900/30 dark:file:text-orange-400 dark:text-gray-400 cursor-pointer" />
                </div>
              </div>

              <div className="relative">
                <label className="label-sm">اسم المادة</label>
                <input name="name" type="text" required autoComplete="off" 
                  value={invNameInput || editInventory?.name || ""}
                  onChange={e => {
                    setInvNameInput(e.target.value);
                    setShowInvSuggestions(e.target.value.length >= 1);
                  }}
                  onFocus={() => setShowInvSuggestions(invNameInput.length >= 1)}
                  onBlur={() => setTimeout(() => setShowInvSuggestions(false), 200)}
                  className="input-field" placeholder="أدخل اسم المادة..." />
                
                {showInvSuggestions && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                    {uniqueNames.filter(n => n.includes(invNameInput)).map((suggestedName, idx) => (
                      <div key={idx} onClick={() => { setInvNameInput(suggestedName); setShowInvSuggestions(false); }} className="px-4 py-2 hover:bg-orange-50 dark:hover:bg-zinc-700 cursor-pointer text-sm font-bold text-gray-800 dark:text-gray-200">
                        {suggestedName}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="label-sm">الفئة</label>
                <select name="category" defaultValue={editInventory?.category || (activeTab === "car" ? "صيانة" : activeTab === "travel" ? "أمتعة" : "سوبر ماركت")} className="input-field">
                  {(activeTab === "car" ? CAR_INVENTORY_CATEGORIES : activeTab === "travel" ? TRAVEL_INVENTORY_CATEGORIES : HOME_INVENTORY_CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-sm">{invStatusMode === "available" ? "الكمية الحالية" : "الكمية المطلوبة (النقص)"}</label>
                  <input autoComplete="off" name={invStatusMode === "available" ? "qty" : "neededQty"} type="number" step="0.1" defaultValue={editInventory?.quantity ?? 1} min={0} required className="input-field" />
                </div>
                <div>
                  <label className="label-sm">الوحدة</label>
                  <select name="unit" defaultValue={editInventory?.unit || "قطعة"} className="input-field">
                    {HOME_INVENTORY_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-sm">السعر التقديري (اختياري)</label>
                  <input autoComplete="off" name="price" type="number" defaultValue={editInventory?.estimatedPrice} placeholder="0" className="input-field" />
                </div>
                {activeTab === "travel" ? (
                  <div>
                    <label className="label-sm">وجهة السفر (الرحلة)</label>
                    <input autoComplete="off" name="tripDestination" type="text" defaultValue={editInventory?.tripDestination || ""} placeholder="مثال: جورجيا" className="input-field" />
                    {/* Hide threshold for travel since it doesn't trigger normal alerts */}
                    <input type="hidden" name="threshold" value="0" />
                  </div>
                ) : (
                  <div>
                    <label className="label-sm">تنبيه نقص عند</label>
                    <input autoComplete="off" name="threshold" type="number" defaultValue={editInventory?.threshold ?? 0} min={0} required className="input-field" />
                  </div>
                )}
              </div>
              
              {invStatusMode === "shortage" && (
                <div>
                  <DetailsInput defaultValue={editInventory?.notes || ""} isRequired={true} />
                </div>
              )}
              <button type="submit" disabled={isUploading} className="w-full bg-gradient-to-l from-teal-500 to-emerald-600 text-white font-black py-3.5 rounded-xl shadow-lg mt-2 active:scale-[0.98] transition disabled:opacity-50">
                {isUploading ? "جاري الرفع..." : "حفظ"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── Purchase Modal ─── */}
      {!!purchaseItem && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center">
          <div className="bg-white dark:bg-zinc-950 w-full sm:max-w-sm rounded-t-[32px] sm:rounded-[32px] px-5 pt-5 pb-8 shadow-2xl animate-in slide-in-from-bottom-10 duration-200 border border-gray-100 dark:border-zinc-800 max-h-[calc(100svh-80px)] overflow-y-auto mb-[80px] sm:mb-0">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-black text-gray-900 dark:text-white">شراء: {purchaseItem.name}</h3>
              <button onClick={() => setPurchaseItem(null)} className="p-2 bg-gray-100 dark:bg-zinc-800 rounded-full">
                <X className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            <form onSubmit={handlePurchaseSubmit} className="space-y-3">
              <div>
                <label className="label-sm">الكمية ({purchaseItem.unit})</label>
                <input autoComplete="off" name="qty" type="number" defaultValue={1} min={1} required className="input-field" />
              </div>
              <div>
                <label className="label-sm">السعر الكلي المدفوع (د.ع)</label>
                <input autoComplete="off" name="price" type="number" defaultValue={purchaseItem.estimatedPrice} required className="input-field" autoFocus />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPurchaseItem(null)} className="flex-1 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 font-bold py-3 rounded-xl transition">إلغاء</button>
                <button type="submit" className="flex-1 bg-gradient-to-l from-orange-500 to-amber-500 text-white font-black py-3 rounded-xl shadow-lg active:scale-[0.98] transition">تأكيد الشراء</button>
              </div>
            </form>
          </div>
        </div>
      )}
        {/* ─── SCANNED MEDICINES & PRODUCTS REVIEW MODAL ─── */}
        {scannedReviewItems && (
          <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 w-full sm:max-w-2xl rounded-t-[32px] sm:rounded-[32px] shadow-2xl border border-gray-100 dark:border-zinc-800 flex flex-col max-h-[92vh] sm:max-h-[85vh] overflow-hidden">
              {/* Header Banner */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-purple-700 via-indigo-600 to-rose-600 text-white relative overflow-hidden flex-shrink-0">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none transform -translate-y-1/2 translate-x-1/4" />
                <div className="relative z-10 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-xl shadow-inner flex-shrink-0">
                      ✂️
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-base sm:text-lg text-white">
                          قائمة الأدوية والمنتجات المكتشفة
                        </h3>
                        <span className="px-2 py-0.5 rounded-full bg-white/25 backdrop-blur-md text-[11px] font-black text-white">
                          {scannedReviewItems.length} مواد
                        </span>
                      </div>
                      <p className="text-[11px] sm:text-xs text-white/90 mt-0.5">
                        تم استخراج كل دواء وقص صورته الخاصة بالذكاء الاصطناعي 🧠📸
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setScannedReviewItems(null)}
                    className="p-1.5 bg-black/20 hover:bg-black/40 rounded-full text-white/80 hover:text-white transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Sub-bar: Select All / Deselect All */}
                <div className="mt-3 pt-2.5 border-t border-white/15 flex items-center justify-between text-xs font-black">
                  <button
                    type="button"
                    onClick={() => {
                      const allSelected = scannedReviewItems.every(i => i.selected);
                      setScannedReviewItems(scannedReviewItems.map(i => ({ ...i, selected: !allSelected })));
                    }}
                    className="px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-white text-[11px] transition flex items-center gap-1 cursor-pointer"
                  >
                    <span>{scannedReviewItems.every(i => i.selected) ? "إلغاء تحديد الكل" : "تحديد الكل"}</span>
                  </button>

                  <span className="text-[11px] text-white/90">
                    المحدد للإضافة: {scannedReviewItems.filter(i => i.selected).length} من {scannedReviewItems.length}
                  </span>
                </div>
              </div>

              {/* List of Detected Items */}
              <div className="p-3 sm:p-4 overflow-y-auto space-y-2.5 flex-1 divide-y divide-gray-100 dark:divide-zinc-800/80">
                {scannedReviewItems.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className={`pt-2.5 first:pt-0 flex items-start gap-2.5 sm:gap-3.5 transition-all ${
                      !item.selected ? "opacity-40 grayscale-[50%]" : ""
                    }`}
                  >
                    {/* Selection Checkbox */}
                    <input
                      type="checkbox"
                      checked={item.selected !== false}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setScannedReviewItems(prev => prev ? prev.map((it, i) => i === idx ? { ...it, selected: checked } : it) : null);
                      }}
                      className="w-4 h-4 rounded mt-3 accent-purple-600 cursor-pointer flex-shrink-0"
                    />

                    {/* Cropped Image Thumbnail */}
                    <div
                      onClick={() => {
                        if (item.croppedImageUrl) {
                          setPreviewImageUrl({ url: item.croppedImageUrl, title: item.name });
                        }
                      }}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-gray-100 dark:bg-zinc-800 border-2 border-purple-500/30 flex-shrink-0 cursor-pointer relative group/thumb shadow-sm"
                    >
                      {item.croppedImageUrl ? (
                        <img
                          src={item.croppedImageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover/thumb:scale-110"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">
                          💊
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/thumb:opacity-100 transition flex items-center justify-center text-white">
                        <Eye className="w-4 h-4" />
                      </div>
                    </div>

                    {/* Item Fields */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      {/* Name Input */}
                      <div>
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setScannedReviewItems(prev => prev ? prev.map((it, i) => i === idx ? { ...it, name: val } : it) : null);
                          }}
                          placeholder="اسم الدواء أو المنتج"
                          className="w-full font-black text-xs sm:text-sm text-gray-900 dark:text-white bg-transparent border-b border-gray-200 dark:border-zinc-700 focus:border-purple-500 outline-none pb-0.5"
                        />
                      </div>

                      {/* Dosage / Specs Input */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold flex-shrink-0">✨ الجرعة/المواصفة:</span>
                        <input
                          type="text"
                          value={item.dosageOrSpecs || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setScannedReviewItems(prev => prev ? prev.map((it, i) => i === idx ? { ...it, dosageOrSpecs: val } : it) : null);
                          }}
                          placeholder="مثال: 500 ملغم"
                          className="flex-1 text-[11px] font-bold text-gray-700 dark:text-gray-300 bg-purple-50/60 dark:bg-purple-950/30 px-2 py-0.5 rounded-md border border-purple-200 dark:border-purple-800/50 outline-none"
                        />
                      </div>

                      {/* Category, Quantity & Stepper */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                        <div className="flex items-center gap-1">
                          <select
                            value={item.category}
                            onChange={(e) => {
                              const val = e.target.value;
                              setScannedReviewItems(prev => prev ? prev.map((it, i) => i === idx ? { ...it, category: val } : it) : null);
                            }}
                            className="text-[10px] font-black bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-lg border-none outline-none cursor-pointer"
                          >
                            <option value="أدوية وصيدلية">💊 أدوية وصيدلية</option>
                            <option value="سوبر ماركت">🛒 سوبر ماركت</option>
                            <option value="منظفات">🧼 منظفات</option>
                            <option value="عناية شخصية">🧴 عناية شخصية</option>
                            <option value="مستلزمات منزلية">📦 مستلزمات منزلية</option>
                            <option value="أغذية ومسواك">🍎 أغذية ومسواك</option>
                            <option value="سيارة">🚗 سيارة</option>
                            <option value="أخرى">📌 أخرى</option>
                          </select>
                        </div>

                        {/* Quantity Stepper */}
                        <div className="flex items-center bg-gray-100 dark:bg-zinc-800 rounded-lg p-0.5 border border-gray-200 dark:border-zinc-700">
                          <button
                            type="button"
                            onClick={() => {
                              setScannedReviewItems(prev => prev ? prev.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, (it.quantity || 1) - 1) } : it) : null);
                            }}
                            className="w-5 h-5 rounded bg-white dark:bg-zinc-700 text-gray-700 dark:text-white font-bold flex items-center justify-center hover:bg-red-500 hover:text-white transition text-xs cursor-pointer"
                          >
                            -
                          </button>
                          <span className="w-6 text-center font-black text-[11px] text-gray-800 dark:text-gray-200">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setScannedReviewItems(prev => prev ? prev.map((it, i) => i === idx ? { ...it, quantity: (it.quantity || 1) + 1 } : it) : null);
                            }}
                            className="w-5 h-5 rounded bg-white dark:bg-zinc-700 text-gray-700 dark:text-white font-bold flex items-center justify-center hover:bg-emerald-500 hover:text-white transition text-xs cursor-pointer"
                          >
                            +
                          </button>
                          <span className="text-[10px] text-gray-500 px-1 font-bold">
                            {item.unit || "علبة"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Remove item button */}
                    <button
                      type="button"
                      onClick={() => {
                        setScannedReviewItems(prev => prev ? prev.filter((_, i) => i !== idx) : null);
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg transition cursor-pointer flex-shrink-0 mt-1"
                      title="حذف هذه المادة"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Modal Footer */}
              <div className="p-3 sm:p-4 bg-gray-50 dark:bg-zinc-800/60 border-t border-gray-100 dark:border-zinc-800 flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  disabled={isSavingScannedBatch || scannedReviewItems.filter(i => i.selected).length === 0}
                  onClick={() => handleConfirmScannedItems(scannedReviewItems.filter(i => i.selected))}
                  className="flex-1 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm py-3 px-4 rounded-xl shadow-lg active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSavingScannedBatch ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  <span>
                    إضافة المواد المحددة إلى النواقص ({scannedReviewItems.filter(i => i.selected).length})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setScannedReviewItems(null)}
                  className="px-4 py-3 bg-gray-200 dark:bg-zinc-700 hover:bg-gray-300 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {/* NEEDS MODAL */}
        {showNeedModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-zinc-800">
              <div className="p-5 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-gray-50/50 dark:bg-zinc-800/50">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🛒</span>
                  <h3 className="font-black text-gray-800 dark:text-white text-lg">
                    {editNeed ? "تعديل الاحتياج" : "إضافة احتياج / دواء جديد"}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setShowNeedModal(false);
                    setEditNeed(null);
                    setNeedImageFile(null);
                    setNeedImagePreview(null);
                    setNeedNameInput("");
                  }}
                  className="p-2 bg-white dark:bg-zinc-800 rounded-full text-gray-400 hover:text-gray-600 transition shadow-sm cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveNeed} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
                {/* Photo attachment zone (Multi-Image Supported) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-gray-500">
                      صور الدواء أو المنتج (اختياري - {needImages.length} صور)
                    </label>
                    {needImages.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setNeedImages([])}
                        className="text-[10px] text-red-500 hover:text-red-700 font-bold cursor-pointer"
                      >
                        إزالة الكل ✕
                      </button>
                    )}
                  </div>
                  <input
                    ref={needModalCameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const url = await compressImageFast(file, 900, 0.75);
                        setNeedImages(prev => [...prev, url]);
                      } catch (err) {
                        toast.error("فشل معالجة الصورة");
                      } finally {
                        if (e.target) e.target.value = "";
                      }
                    }}
                    className="hidden"
                  />
                  <input
                    ref={needModalGalleryInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={async (e) => {
                      const files = e.target.files ? Array.from(e.target.files) : [];
                      if (files.length === 0) return;
                      try {
                        const urls = await Promise.all(files.map(f => compressImageFast(f, 900, 0.75)));
                        setNeedImages(prev => [...prev, ...urls]);
                      } catch (err) {
                        toast.error("فشل معالجة الصور");
                      } finally {
                        if (e.target) e.target.value = "";
                      }
                    }}
                    className="hidden"
                  />

                  {needImages.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
                        {needImages.map((imgUrl, idx) => (
                          <div key={idx} className="relative group/thumb flex-shrink-0">
                            <div
                              onClick={() => setPreviewImageUrl({ url: imgUrl, title: `صورة ${idx + 1}: ${needNameInput || "المنتج"}`, allUrls: needImages })}
                              className="w-16 h-16 rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-700 cursor-pointer shadow-xs relative bg-white dark:bg-zinc-800"
                            >
                              <img src={imgUrl} alt={`Product ${idx + 1}`} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/thumb:opacity-100 transition flex items-center justify-center text-white">
                                <Eye className="w-3.5 h-3.5" />
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setNeedImages(prev => prev.filter((_, i) => i !== idx))}
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] shadow cursor-pointer hover:bg-red-600 transition"
                              title="حذف هذه الصورة"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isScanningNeed}
                          onClick={async () => {
                            if (needImages.length === 0) return;
                            setIsScanningNeed(true);
                            setScanNeedStatus("جارٍ فحص صور الدواء/المنتج بالذكاء الاصطناعي...");
                            try {
                              const res = await scanNeedItemWithGemini(needImages[0], (msg) => setScanNeedStatus(msg));
                              const firstItem = Array.isArray(res) ? res[0] : res;
                              if (firstItem?.name) setNeedNameInput(firstItem.name);
                              toast.success(`تم استخراج: ${firstItem?.name || "البيانات"}`, {
                                description: firstItem?.dosageOrSpecs ? `الجرعة/المواصفة: ${firstItem.dosageOrSpecs}` : undefined
                              });
                            } catch (e: any) {
                              toast.error("تعذر استخراج البيانات من الصورة");
                            } finally {
                              setIsScanningNeed(false);
                              setScanNeedStatus("");
                            }
                          }}
                          className="flex-1 py-2 px-3 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 rounded-xl text-xs font-black border border-purple-200 dark:border-purple-800/40 flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                          {isScanningNeed ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          <span>استخراج الاسم والبيانات بالذكاء الاصطناعي</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => needModalCameraInputRef.current?.click()}
                          className="p-2 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-xl text-gray-700 dark:text-gray-300 transition cursor-pointer"
                          title="تصوير أخرى بالكاميرا"
                        >
                          <Camera className="w-4 h-4 text-rose-500" />
                        </button>
                        <button
                          type="button"
                          onClick={() => needModalGalleryInputRef.current?.click()}
                          className="p-2 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-xl text-gray-700 dark:text-gray-300 transition cursor-pointer"
                          title="إضافة من الاستوديو"
                        >
                          <ImageIcon className="w-4 h-4 text-purple-500" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => needModalCameraInputRef.current?.click()}
                        className="flex-1 py-2.5 px-3 bg-gray-50 dark:bg-zinc-800/80 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-2xl border border-dashed border-gray-300 dark:border-zinc-700 flex items-center justify-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-300 transition cursor-pointer"
                      >
                        <Camera className="w-4 h-4 text-rose-500" />
                        <span>تصوير كاميرا 📸</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => needModalGalleryInputRef.current?.click()}
                        className="flex-1 py-2.5 px-3 bg-gray-50 dark:bg-zinc-800/80 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-2xl border border-dashed border-gray-300 dark:border-zinc-700 flex items-center justify-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-300 transition cursor-pointer"
                      >
                        <ImageIcon className="w-4 h-4 text-purple-500" />
                        <span>من الاستوديو (متعدد) 🖼️</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Name */}
                <div className="relative">
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">
                    اسم المنتج أو الدواء <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="name"
                    type="text"
                    required
                    autoComplete="off"
                    value={needNameInput || editNeed?.name || ""}
                    onChange={(e) => {
                      setNeedNameInput(e.target.value);
                      setShowNeedSuggestions(e.target.value.length >= 1);
                    }}
                    onFocus={() => setShowNeedSuggestions(needNameInput.length >= 1)}
                    onBlur={() => setTimeout(() => setShowNeedSuggestions(false), 200)}
                    placeholder="مثال: بنادول إكسترا 500 ملغ، حليب، تايد..."
                    className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-red-500/50 outline-none transition"
                  />

                  {showNeedSuggestions && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                      {Array.from(new Set([...inventory.map((i) => i.name), ...needs.map((n) => n.name)]))
                        .filter((n) => n.includes(needNameInput))
                        .map((suggestedName, idx) => (
                          <div
                            key={idx}
                            onClick={() => {
                              setNeedNameInput(suggestedName);
                              setShowNeedSuggestions(false);
                            }}
                            className="px-4 py-2 hover:bg-red-50 dark:hover:bg-zinc-700 cursor-pointer text-sm"
                          >
                            {suggestedName}
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Category & Dosage/Specs */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">التصنيف</label>
                    <select
                      name="category"
                      defaultValue={editNeed?.category || (activeTab === "car" ? "سيارة" : activeTab === "travel" ? "سفر" : "أدوية وصيدلية")}
                      className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-3 py-3 text-xs font-bold focus:ring-2 focus:ring-red-500/50 outline-none"
                    >
                      {NEED_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">العيار / المواصفة</label>
                    <input
                      name="dosageOrSpecs"
                      type="text"
                      defaultValue={editNeed?.dosageOrSpecs || ""}
                      placeholder="مثال: 500mg، 24 قرص"
                      className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-3 py-3 text-xs font-bold focus:ring-2 focus:ring-red-500/50 outline-none"
                    />
                  </div>
                </div>

                {/* Quantity & Unit */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">الكمية</label>
                    <input
                      name="quantity"
                      type="number"
                      step="0.1"
                      required
                      defaultValue={editNeed?.quantity || editNeed?.neededQuantity || 1}
                      className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-red-500/50 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">الوحدة</label>
                    <select
                      name="unit"
                      defaultValue={editNeed?.unit || "علبة"}
                      className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-3 py-3 text-xs font-bold focus:ring-2 focus:ring-red-500/50 outline-none"
                    >
                      {["علبة", "شريط", "قطعة", "بطل", "كيس", "كغم", "لتر", "كيلو"].map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Price & Notes */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">السعر التقديري (د.ع)</label>
                    <input
                      name="price"
                      type="number"
                      defaultValue={editNeed?.estimatedPrice || ""}
                      placeholder="0"
                      className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-red-500/50 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">ملاحظات إضافية</label>
                    <input
                      name="notes"
                      type="text"
                      defaultValue={editNeed?.notes || ""}
                      placeholder="دواعي الاستخدام أو ملاحظة"
                      className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-3 py-3 text-xs font-bold focus:ring-2 focus:ring-red-500/50 outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isUploading}
                  className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black py-3.5 rounded-2xl shadow-lg shadow-red-500/25 active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{isUploading ? "جارٍ حفظ ورفع الصورة..." : "حفظ النقص"}</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* IMAGE PREVIEW MODAL (Multi-Image Navigation Supported) */}
        {previewImageUrl && (
          <div
            className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setPreviewImageUrl(null)}
          >
            <div
              className="relative max-w-lg w-full bg-zinc-900 border border-white/10 rounded-3xl p-4 overflow-hidden shadow-2xl flex flex-col items-center gap-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between w-full px-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📸</span>
                  <h3 className="font-black text-white text-sm line-clamp-1">{previewImageUrl.title}</h3>
                </div>
                <button
                  onClick={() => setPreviewImageUrl(null)}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="relative w-full max-h-[68vh] rounded-2xl overflow-hidden bg-black/50 flex items-center justify-center">
                <img
                  src={previewImageUrl.url}
                  alt={previewImageUrl.title}
                  className="max-h-[66vh] w-auto max-w-full object-contain rounded-xl"
                />
              </div>

              {/* Multi-Photo Switcher Bar */}
              {previewImageUrl.allUrls && previewImageUrl.allUrls.length > 1 && (
                <div className="w-full flex items-center justify-center gap-2 overflow-x-auto py-1 px-2 custom-scrollbar">
                  {previewImageUrl.allUrls.map((u, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPreviewImageUrl({ ...previewImageUrl, url: u })}
                      className={`w-11 h-11 rounded-xl overflow-hidden border-2 transition flex-shrink-0 cursor-pointer ${u === previewImageUrl.url ? "border-purple-500 scale-105 shadow-md" : "border-white/20 opacity-60 hover:opacity-100"}`}
                    >
                      <img src={u} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              <div className="w-full flex justify-between items-center text-xs text-gray-400 px-2">
                <span>{previewImageUrl.allUrls && previewImageUrl.allUrls.length > 1 ? `${previewImageUrl.allUrls.length} صور مرفقة` : "صورة مرفقة"}</span>
                <button
                  onClick={() => window.open(previewImageUrl.url, "_blank")}
                  className="text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1 text-[11px] cursor-pointer"
                >
                  عرض بالحجم الكامل ↗
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DEBTS MODAL */}
        {showDebtModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-5 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-gray-50/50 dark:bg-zinc-800/50">
                <h3 className="font-black text-gray-800 dark:text-white text-lg">{editDebt ? "تعديل سجل" : "إضافة سجل"}</h3>
                <button onClick={() => { setShowDebtModal(false); setEditDebt(null);
}} className="p-2 bg-white dark:bg-zinc-800 rounded-full text-gray-400 hover:text-gray-600 transition shadow-sm">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleSaveDebt} className="p-5 space-y-4">
                <div className="relative">
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">اسم الشخص / الجهة</label>
                  <input name="person" type="text" required autoComplete="off" 
                    value={debtNameInput || editDebt?.person || ""}
                    onChange={e => {
                      setDebtNameInput(e.target.value);
                      setShowDebtSuggestions(e.target.value.length >= 1);
                    }}
                    onFocus={() => setShowDebtSuggestions(debtNameInput.length >= 1)}
                    onBlur={() => setTimeout(() => setShowDebtSuggestions(false), 200)}
                    className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition" />
                  
                  {showDebtSuggestions && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                      {uniqueNames.filter(n => n.includes(debtNameInput)).map((suggestedName, idx) => (
                        <div key={idx} onClick={() => { setDebtNameInput(suggestedName); setShowDebtSuggestions(false); }} className="px-4 py-2 hover:bg-orange-50 dark:hover:bg-zinc-700 cursor-pointer text-sm font-bold text-gray-800 dark:text-gray-200">
                          {suggestedName}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 pt-2 pb-1">
                  <button type="button" onClick={() => setIsAdvancedDebt(!isAdvancedDebt)} 
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isAdvancedDebt ? 'bg-indigo-500' : 'bg-gray-200 dark:bg-zinc-700'}`}>
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isAdvancedDebt ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
                  </button>
                  <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400">إدخال متقدم (خطة دفع / أقساط)</span>
                </div>

                {isAdvancedDebt ? (
                  <div className="space-y-3 animate-in fade-in duration-300">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5">المقدمة (دفعة أولى إن وجدت)</label>
                      <input autoComplete="off" name="downPayment" type="number" defaultValue={editDebt?.downPayment} placeholder="0" 
                        className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5">القسط الشهري</label>
                        <input autoComplete="off" name="monthly" type="number" defaultValue={editDebt?.monthlyInstallment} required placeholder="0" 
                          className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5">الأشهر الكلية</label>
                        <input autoComplete="off" name="totalMonths" type="number" defaultValue={editDebt?.totalMonths} required placeholder="12" 
                          className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5">أشهر مدفوعة مسبقاً</label>
                        <input autoComplete="off" name="initialPaidMonths" type="number" defaultValue={editDebt?.initialPaidMonths} placeholder="0" 
                          className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5">تاريخ البداية</label>
                        <input autoComplete="off" name="startDate" type="date" required defaultValue={editDebt?.date || today()}
                          className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 animate-in fade-in duration-300">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5">نوع الدين</label>
                        <select name="type" defaultValue={editDebt?.type || "دين علي"} className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition appearance-none cursor-pointer">
                          <option value="دين علي">دين عليّ (مطلوب)</option>
                          <option value="دين لي">دين لي (يطلب)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5">المبلغ الكلي</label>
                        <input name="amount" type="number" required autoComplete="off" defaultValue={editDebt?.amount}
                          className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5">التاريخ</label>
                      <input autoComplete="off" name="date" type="date" required defaultValue={editDebt?.date || today()}
                        className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition" />
                    </div>
                  </div>
                )}
                <button type="submit" className="w-full bg-indigo-500 text-white font-black py-3.5 rounded-2xl shadow-lg shadow-indigo-500/25 active:scale-[0.98] transition">
                  حفظ
                </button>
              </form>
            </div>
          </div>
        )}

      {/* ─── Family Need Modal ─── */}
      {showFamilyNeedModal && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center">
          <div className="bg-white dark:bg-zinc-950 w-full sm:max-w-sm rounded-t-[32px] sm:rounded-[32px] px-5 pt-5 pb-8 shadow-2xl animate-in slide-in-from-bottom-10 duration-200 border border-gray-100 dark:border-zinc-800 max-h-[calc(100svh-80px)] overflow-y-auto mb-[80px] sm:mb-0">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-black text-gray-900 dark:text-white">
                {editFamilyNeed ? `تعديل إدخال لـ ${editFamilyNeed.member}` : `إضافة جديد لـ ${activeFamilyMember}`}
              </h3>
              <button onClick={() => { setShowFamilyNeedModal(false); setEditFamilyNeed(null); }} className="p-2 bg-gray-100 dark:bg-zinc-800 rounded-full">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleAddFamilyNeed} className="flex flex-col gap-4">
              <div className="flex gap-2 p-1.5 bg-gray-100 dark:bg-zinc-900 rounded-2xl mb-1">
                <button
                  type="button"
                  onClick={() => setFamilyNeedType("need")}
                  className={`flex-1 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                    (editFamilyNeed ? editFamilyNeed.type !== "duty" : familyNeedType === "need")
                      ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md shadow-pink-500/20"
                      : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  <span>🛍️</span> طلب / احتياج
                </button>
                <button
                  type="button"
                  onClick={() => setFamilyNeedType("duty")}
                  className={`flex-1 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                    (editFamilyNeed ? editFamilyNeed.type === "duty" : familyNeedType === "duty")
                      ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/20"
                      : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  <span>🎯</span> واجب / مهمة
                </button>
              </div>
              <input type="hidden" name="type" value={editFamilyNeed ? (editFamilyNeed.type || "need") : familyNeedType} />

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">
                  {(editFamilyNeed ? editFamilyNeed.type === "duty" : familyNeedType === "duty") ? "عنوان المهمة / الواجب" : "ماذا تحتاج؟"}
                </label>
                <input name="title" autoFocus required autoComplete="off" placeholder={(editFamilyNeed ? editFamilyNeed.type === "duty" : familyNeedType === "duty") ? "مثلاً: دفع فاتورة الكهرباء، تنظيف..." : "اسم المنتج أو الغرض..."} defaultValue={editFamilyNeed?.title || ""}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className={(editFamilyNeed ? editFamilyNeed.type === "duty" : familyNeedType === "duty") ? "col-span-2" : ""}>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">الفرد</label>
                  <select name="member" defaultValue={editFamilyNeed?.member || activeFamilyMember} className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition appearance-none cursor-pointer">
                    {FAMILY_MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                {!(editFamilyNeed ? editFamilyNeed.type === "duty" : familyNeedType === "duty") && (
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">التصنيف</label>
                    <select name="category" defaultValue={editFamilyNeed?.category || "عائلة"} className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition appearance-none cursor-pointer">
                      {EXPENSE_CATEGORIES.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
                    </select>
                  </div>
                )}
              </div>
              {!(editFamilyNeed ? editFamilyNeed.type === "duty" : familyNeedType === "duty") && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">العدد / الكمية</label>
                    <input name="quantity" type="number" required defaultValue={editFamilyNeed?.quantity || 1} min="1"
                      className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">السعر التقريبي (اختياري)</label>
                    <input name="estimatedPrice" type="number" defaultValue={editFamilyNeed?.estimatedPrice || ""}
                      className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition" />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">الأولوية</label>
                  <select name="priority" defaultValue={editFamilyNeed?.priority || "متوسط"}
                    className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition appearance-none cursor-pointer">
                    <option value="عالي">عالي (مهم جداً)</option>
                    <option value="متوسط">متوسط</option>
                    <option value="منخفض">منخفض (لاحقاً)</option>
                  </select>
                </div>
                <div>
                  <DetailsInput defaultValue={editFamilyNeed?.notes || ""} isRequired={!(editFamilyNeed ? editFamilyNeed.type === "duty" : familyNeedType === "duty")} />
                </div>
              </div>
              <button type="submit" className="w-full mt-2 bg-indigo-500 text-white font-black py-3.5 rounded-2xl shadow-lg shadow-indigo-500/25 active:scale-[0.98] transition">
                {editFamilyNeed ? "حفظ التعديل" : "إضافة للقائمة"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* FULFILL MODAL (نافذة التوفير والشراء الاحترافية) */}
      {fulfillModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 dark:border-zinc-800 animate-in zoom-in-95 duration-200 max-h-[85svh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-4 text-white relative shrink-0">
              <button
                onClick={() => setFulfillModal(null)}
                className="absolute top-4 left-4 p-1.5 bg-black/20 hover:bg-black/30 text-white rounded-full transition"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-xl shadow-inner shrink-0">
                  ✨
                </div>
                <div>
                  <h3 className="font-black text-lg leading-tight">توفير / شراء: {fulfillModal.title}</h3>
                  <p className="text-emerald-100 text-[11px] mt-0.5 font-bold">
                    {fulfillModal.member ? `خاص بـ: ${fulfillModal.member}` : `التصنيف: ${fulfillModal.category}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const price = parseFloat(fd.get("price") as string) || 0;
              const purchasedQty = parseFloat(fd.get("purchasedQty") as string) || fulfillModal.quantity;
              const recordExpense = fd.get("recordExpense") === "on";
              handleConfirmFulfill(fulfillModal, price, recordExpense, purchasedQty);
            }} className="p-4 space-y-3.5 overflow-y-auto flex-1">
              <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 block">الكمية المطلوب توفيرها</span>
                  <span className="text-base font-black text-gray-800 dark:text-white">{fulfillModal.quantity}</span>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 block text-left">التكلفة المقدرة</span>
                  <span className="text-base font-black text-emerald-600 dark:text-emerald-400">{fmt(fulfillModal.estimatedPrice)} د.ع</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1.5">
                    الكمية المشتراة
                  </label>
                  <input
                    name="purchasedQty"
                    type="number"
                    defaultValue={fulfillModal.quantity}
                    min={1}
                    onFocus={(e) => e.target.select()}
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-lg font-black text-gray-800 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1.5">
                    التكلفة المدفوعة (د.ع)
                  </label>
                  <input
                    name="price"
                  type="number"
                  defaultValue={fulfillModal.estimatedPrice && fulfillModal.estimatedPrice > 0 ? fulfillModal.estimatedPrice : ""}
                  placeholder="أدخل السعر المدفوع..."
                  onFocus={(e) => e.target.select()}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-lg font-black text-gray-800 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition text-center"
                  autoFocus
                />
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-zinc-800/60 rounded-xl p-3 border border-gray-100 dark:border-zinc-700/60">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    name="recordExpense"
                    defaultChecked={true}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300 dark:border-zinc-600 dark:bg-zinc-700"
                  />
                  <div>
                    <span className="text-xs font-black text-gray-800 dark:text-white block">تسجيل المبلغ كمصروف في الميزانية</span>
                    <span className="text-[10px] font-bold text-gray-400">سيتم خصم المبلغ من الرصيد وإضافته لمصاريف الدورة</span>
                  </div>
                </label>
              </div>

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setFulfillModal(null)}
                  className="flex-1 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 font-black py-3 rounded-xl transition text-sm"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-[2] bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-black py-3 rounded-xl shadow-md shadow-emerald-500/20 active:scale-[0.98] transition flex items-center justify-center gap-1.5 text-sm"
                >
                  <Check className="w-4 h-4" />
                  <span>تأكيد التوفير والشراء</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Trip Modal ─── */}
      {showTripModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-gray-50/50 dark:bg-zinc-800/50">
              <h3 className="font-black text-gray-800 dark:text-white text-lg">{editTrip ? "تعديل الرحلة" : "إضافة رحلة جديدة"}</h3>
              <button onClick={() => setShowTripModal(false)} className="p-2 bg-white dark:bg-zinc-800 rounded-full text-gray-400 hover:text-gray-600 transition shadow-sm">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveTrip} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">اسم الرحلة</label>
                <input name="name" type="text" required autoComplete="off" defaultValue={editTrip?.name} placeholder="مثال: رحلة العيد"
                  className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">الوجهة</label>
                <select name="destination" required value={tripModalDestination} onChange={e => setTripModalDestination(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition cursor-pointer">
                  <option value="" disabled>اختر الوجهة...</option>
                  <optgroup label="محافظات العراق">
                    {IRAQ_GOVERNORATES.map(gov => <option key={gov} value={gov}>{gov}</option>)}
                  </optgroup>
                  <optgroup label="دول العالم">
                    {WORLD_COUNTRIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">أسماء الأصدقاء المشاركين (اكتب الاسم واضغط Enter)</label>
                <div className="w-full bg-gray-50 dark:bg-zinc-800 rounded-2xl px-3 py-2 min-h-[48px] border-none focus-within:ring-2 focus-within:ring-blue-500/50 transition flex flex-wrap gap-2 items-center">
                  {tripModalMembers.map((member, i) => (
                    <span key={i} className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5">
                      {member}
                      <button type="button" onClick={() => setTripModalMembers(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-blue-900 dark:hover:text-blue-100 bg-blue-200/50 dark:bg-blue-800/50 rounded-full p-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <input type="text" placeholder={tripModalMembers.length === 0 ? "مثال: محمد، علي (اضغط Enter)" : "أضف صديق آخر..."}
                    value={tripModalMemberInput}
                    onChange={e => setTripModalMemberInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = tripModalMemberInput.trim();
                        if (val && !tripModalMembers.includes(val)) {
                          setTripModalMembers(prev => [...prev, val]);
                          setTripModalMemberInput("");
                        }
                      }
                    }}
                    className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-gray-800 dark:text-white placeholder:text-gray-400 min-w-[140px] px-1 py-1"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">العملة</label>
                <select name="currency" defaultValue={editTrip?.currency || "د.ع"}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition cursor-pointer">
                  <option value="د.ع">دينار عراقي (د.ع)</option>
                  <option value="$">دولار أمريكي ($)</option>
                  {WORLD_COUNTRIES.find(c => c.name === tripModalDestination)?.currency && WORLD_COUNTRIES.find(c => c.name === tripModalDestination)?.currency !== "د.ع" && WORLD_COUNTRIES.find(c => c.name === tripModalDestination)?.currency !== "$" && (
                    <option value={WORLD_COUNTRIES.find(c => c.name === tripModalDestination)!.currency}>{WORLD_COUNTRIES.find(c => c.name === tripModalDestination)!.currency}</option>
                  )}
                </select>
              </div>
              <button type="submit" className="w-full bg-blue-500 text-white font-black py-3.5 rounded-2xl shadow-lg shadow-blue-500/25 active:scale-[0.98] transition">
                حفظ الرحلة
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── Trip Expense Modal ─── */}
      {showTripExpenseModal && selectedTrip && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-gray-50/50 dark:bg-zinc-800/50">
              <h3 className="font-black text-gray-800 dark:text-white text-lg">إضافة مصروف للرحلة</h3>
              <button onClick={() => setShowTripExpenseModal(false)} className="p-2 bg-white dark:bg-zinc-800 rounded-full text-gray-400 hover:text-gray-600 transition shadow-sm">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveTripExpense} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">وصف المصروف</label>
                <input name="description" type="text" required autoComplete="off" placeholder="تذاكر، مطعم، غاز..."
                  className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">المبلغ المدفوع</label>
                <div className="flex gap-2">
                  <input name="amount" type="number" required autoComplete="off" placeholder="0" min={0} step="any"
                    className="flex-1 bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition" />
                  <select name="currency" defaultValue={selectedTrip.currency || "د.ع"}
                    className="w-28 bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-3 py-3 text-xs font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition cursor-pointer">
                    <option value="د.ع">د.ع</option>
                    <option value="$">$</option>
                    {WORLD_COUNTRIES.find(c => c.name === selectedTrip.destination)?.currency && WORLD_COUNTRIES.find(c => c.name === selectedTrip.destination)?.currency !== "د.ع" && WORLD_COUNTRIES.find(c => c.name === selectedTrip.destination)?.currency !== "$" && (
                      <option value={WORLD_COUNTRIES.find(c => c.name === selectedTrip.destination)!.currency}>{WORLD_COUNTRIES.find(c => c.name === selectedTrip.destination)!.currency}</option>
                    )}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">من دفع هذا المبلغ؟</label>
                <select name="paidBy" required className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition cursor-pointer">
                  {selectedTrip.members.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2">تقسيم المصروف على (المستفيدين)</label>
                <div className="space-y-2 bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-2xl border border-gray-100 dark:border-zinc-800">
                  {selectedTrip.members.map(m => (
                    <label key={m} className="flex items-center gap-2 cursor-pointer p-1">
                      <input type="checkbox" name={`split_${m}`} defaultChecked className="w-4 h-4 text-indigo-500 rounded focus:ring-indigo-500" />
                      <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{m}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button type="submit" className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-black py-3.5 rounded-2xl shadow-lg shadow-indigo-500/25 active:scale-[0.98] transition mt-2">
                تسجيل المصروف
              </button>
            </form>
          </div>
        </div>
      )}
      {/* ═══════════════ FUTURE PLAN MODAL ═══════════════ */}
      {(showFuturePlanModal || !!editFuturePlan) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#120F24] w-full sm:w-[500px] sm:rounded-3xl rounded-t-3xl h-[85vh] sm:h-auto max-h-[90vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-4 duration-300">
            <div className="p-5 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md rounded-t-3xl">
              <h3 className="font-black text-gray-800 dark:text-white flex items-center gap-2">
                <Target className="w-5 h-5 text-violet-500" />
                {editFuturePlan ? 'تعديل الخطة' : 'إضافة خطة جديدة'}
              </h3>
              <button onClick={() => { setShowFuturePlanModal(false);
setEditFuturePlan(null); setFuturePlanSteps([]); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-100 dark:bg-zinc-800 rounded-full p-1.5 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 custom-scrollbar">
              <form onSubmit={handleSaveFuturePlan} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">عنوان الخطة</label>
                  <input name="title" required defaultValue={editFuturePlan?.title || ""} placeholder="مثال: شراء سيارة جديدة، ترتيب غرف الجهال" autoComplete="off"
                    className="w-full bg-gray-50 dark:bg-zinc-800/50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-violet-500/50 outline-none transition" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">المبلغ المستهدف</label>
                    <div className="relative">
                      <input name="targetAmount" type="number" required defaultValue={editFuturePlan?.targetAmount || ""} placeholder="0" min={0}
                        className="w-full bg-gray-50 dark:bg-zinc-800/50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-violet-500/50 outline-none transition pl-12" />
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">د.ع</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">المبلغ المتوفر حالياً</label>
                    <div className="relative">
                      <input name="savedAmount" type="number" defaultValue={editFuturePlan?.savedAmount || ""} placeholder="0" min={0}
                        className="w-full bg-gray-50 dark:bg-zinc-800/50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-violet-500/50 outline-none transition pl-12" />
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">د.ع</span>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">رؤية وخطة التجميع (اختياري)</label>
                  <textarea name="savingVision" defaultValue={editFuturePlan?.savingVision || ""} placeholder="كيف تخطط لتجميع هذا المبلغ؟ (مثال: استقطاع 50 ألف شهرياً من الراتب)" rows={2}
                    className="w-full bg-gray-50 dark:bg-zinc-800/50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-violet-500/50 outline-none transition custom-scrollbar" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">تاريخ الهدف / الإنجاز المتوقع</label>
                  <input name="targetDate" type="date" required defaultValue={editFuturePlan?.targetDate || ""} 
                    className="w-full bg-gray-50 dark:bg-zinc-800/50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-violet-500/50 outline-none transition" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">رابط صورة احترافية للهدف (اختياري)</label>
                  <input name="imageUrl" type="text" defaultValue={editFuturePlan?.imageUrl || ""} placeholder="https://..."
                    className="w-full bg-gray-50 dark:bg-zinc-800/50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-violet-500/50 outline-none transition text-left" dir="ltr" />
                </div>
                
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-gray-500">الخطوات أو المتطلبات</label>
                    <button type="button" onClick={() => {
                        setFuturePlanSteps([...futurePlanSteps, { id: Date.now().toString(), text: "", isCompleted: false }]);
                      }}
                      className="text-[10px] font-bold text-violet-500 bg-violet-50 dark:bg-violet-500/10 px-2 py-1 rounded-md">
                      + إضافة خطوة
                    </button>
                  </div>
                  {futurePlanSteps.length === 0 ? (
                    <div className="text-center py-4 bg-gray-50 dark:bg-zinc-800/30 rounded-2xl border border-gray-100 dark:border-zinc-800">
                      <p className="text-xs text-gray-400">لا توجد خطوات مضافة</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {futurePlanSteps.map((step, index) => (
                        <div key={step.id} className="flex flex-col gap-2 bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-gray-100 dark:border-zinc-800">
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              value={step.text}
                              onChange={(e) => setFuturePlanSteps(futurePlanSteps.map(s => s.id === step.id ? { ...s, text: e.target.value } : s))}
                              placeholder="اسم الخطوة..."
                              className="flex-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs font-bold focus:outline-none focus:border-violet-500"
                            />
                            <input 
                              type="date"
                              value={step.date || ""}
                              onChange={(e) => setFuturePlanSteps(futurePlanSteps.map(s => s.id === step.id ? { ...s, date: e.target.value } : s))}
                              className="w-8 sm:w-32 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg px-2 py-2 text-xs font-bold focus:outline-none focus:border-violet-500 text-transparent sm:text-current relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-datetime-edit]:hidden sm:[&::-webkit-datetime-edit]:block"
                            />
                            <button type="button" onClick={() => setFuturePlanSteps(futurePlanSteps.filter(s => s.id !== step.id))} className="text-rose-400 hover:text-rose-600 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg px-2 flex items-center justify-center">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="flex justify-between items-center px-1">
                            <span className="text-[10px] font-bold text-gray-400">الخطوة رقم {index + 1} {step.date ? `(بتاريخ ${step.date})` : ''}</span>
                            <div className="flex gap-1">
                              <button type="button" disabled={index === 0} onClick={() => {
                                const newSteps = [...futurePlanSteps];
                                [newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]];
                                setFuturePlanSteps(newSteps);
                              }} className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-zinc-700 disabled:opacity-30 transition">
                                <ChevronUp className="w-4 h-4 text-gray-500" />
                              </button>
                              <button type="button" disabled={index === futurePlanSteps.length - 1} onClick={() => {
                                const newSteps = [...futurePlanSteps];
                                [newSteps[index + 1], newSteps[index]] = [newSteps[index], newSteps[index + 1]];
                                setFuturePlanSteps(newSteps);
                              }} className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-zinc-700 disabled:opacity-30 transition">
                                <ChevronDown className="w-4 h-4 text-gray-500" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-4 pb-2">
                  <button type="submit" className="w-full bg-gradient-to-l from-violet-600 to-fuchsia-600 text-white font-black py-3.5 rounded-2xl shadow-lg shadow-violet-500/25 active:scale-[0.98] transition">
                    حفظ الخطة
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ BUDGET SETTINGS MODAL ═══════════════ */}
      {showBudgetSettingsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowBudgetSettingsModal(false)} />
          <div className="relative bg-white dark:bg-[#1A1525] rounded-[2rem] w-full max-w-md border border-gray-100 dark:border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 dark:border-white/10 flex items-center justify-between bg-gray-50/50 dark:bg-white/5">
              <h3 className="text-lg font-black text-gray-800 dark:text-white flex items-center gap-2">
                <Target className="w-5 h-5 text-purple-500" />
                سقوف الميزانية الشهرية
              </h3>
              <button onClick={() => setShowBudgetSettingsModal(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-full transition">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-5">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 font-bold">
                قم بتحديد سقف الصرف الشهري لكل قسم لتتلقى تنبيهات ذكية عند اقتراب استنفاد الميزانية.
              </p>
              
              <form onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const newLimits: Record<string, number> = {};
                ["سوبر ماركت", "مطاعم وكوفيهات", "السيارة", "العائلة"].forEach(cat => {
                  const val = Number(fd.get(cat));
                  if (val > 0) newLimits[cat] = val;
                });
                const newSettings = { ...settings, budgetLimits: newLimits };
                setSettings(newSettings);
                syncToFirebase("settings", newSettings);
                toast.success("تم تحديث سقوف الميزانية بنجاح");
                setShowBudgetSettingsModal(false);
              }} className="space-y-4">
                
                {["سوبر ماركت", "مطاعم وكوفيهات", "السيارة", "العائلة"].map(cat => (
                  <div key={cat} className="flex flex-col gap-1.5">
                    <label className="text-xs font-black text-gray-700 dark:text-gray-300">{cat} (د.ع)</label>
                    <input
                      type="number"
                      name={cat}
                      defaultValue={settings.budgetLimits?.[cat] || ""}
                      placeholder="مثال: 150000"
                      className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-800 dark:text-white outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition"
                    />
                  </div>
                ))}

                <div className="pt-4">
                  <button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black py-3 rounded-xl shadow-lg active:scale-95 transition">
                    حفظ التغييرات
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ SMART WASTE & SAVINGS STUDY MODAL ═══════════════ */}
      {showWasteStudyModal && (() => {
        const now = new Date();
        const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        const periodExpenses = expenses.filter(exp => {
          if (!exp.date) return false;
          if (wastePeriodFilter === "cycle") return isInCycle(exp.date);
          if (wastePeriodFilter === "month") return exp.date.startsWith(currentMonthPrefix);
          return true;
        });

        interface FlatItem {
          id: string;
          name: string;
          price: number;
          quantity: number;
          category: string;
          place: string;
          date: string;
          receiptId: string;
          receiptName: string;
          nature: ItemNatureClassification;
        }

        const flatItems: FlatItem[] = [];
        const receiptsWithDisc: { exp: Expense; discTotal: number; discItemsCount: number; discItemNames: string[] }[] = [];

        let totalSpend = 0;
        let discSpend = 0;
        let essSpend = 0;
        let neutralSpend = 0;

        periodExpenses.forEach(exp => {
          let expDiscTotal = 0;
          let expDiscCount = 0;
          const expDiscNames: string[] = [];

          if (exp.items && exp.items.length > 0) {
            exp.items.forEach((it, idx) => {
              const resCat = it.category || detectProductCategory(it.name) || exp.category || "عام";
              const nature = classifyItemNature(it.name, resCat);
              if (it.priority) {
                nature.priority = it.priority;
                if (it.priority === "تبذير" || it.priority === "مال داعي") {
                  nature.type = "discretionary";
                } else if (it.priority === "مهم") {
                  nature.type = "essential";
                }
              }
              const p = Math.max(0, it.price || 0);
              const q = Math.max(1, it.quantity || 1);

              totalSpend += p;
              if (nature.type === "discretionary") {
                discSpend += p;
                expDiscTotal += p;
                expDiscCount += 1;
                expDiscNames.push(it.name);
              } else if (nature.type === "essential") {
                essSpend += p;
              } else {
                neutralSpend += p;
              }

              flatItems.push({
                id: `${exp.id}-${idx}`,
                name: it.name,
                price: p,
                quantity: q,
                category: resCat,
                place: it.place || exp.name,
                date: exp.date,
                receiptId: exp.id,
                receiptName: exp.name,
                nature
              });
            });
          } else {
            const nature = classifyItemNature(exp.name, exp.category);
            const p = Math.max(0, exp.amount || 0);

            totalSpend += p;
            if (nature.type === "discretionary") {
              discSpend += p;
              expDiscTotal += p;
              expDiscCount += 1;
              expDiscNames.push(exp.name);
            } else if (nature.type === "essential") {
              essSpend += p;
            } else {
              neutralSpend += p;
            }

            flatItems.push({
              id: exp.id,
              name: exp.name,
              price: p,
              quantity: 1,
              category: exp.category,
              place: exp.name,
              date: exp.date,
              receiptId: exp.id,
              receiptName: exp.name,
              nature
            });
          }

          if (expDiscTotal > 0) {
            receiptsWithDisc.push({
              exp,
              discTotal: expDiscTotal,
              discItemsCount: expDiscCount,
              discItemNames: expDiscNames
            });
          }
        });

        receiptsWithDisc.sort((a, b) => b.discTotal - a.discTotal);

        // Grouping
        const discMap: { [name: string]: { name: string; totalAmount: number; count: number; totalQty: number; category: string; places: string[]; dates: string[]; nature: ItemNatureClassification } } = {};
        const essMap: { [name: string]: { name: string; totalAmount: number; count: number; totalQty: number; category: string; places: string[] } } = {};
        const placeMap: { [place: string]: { place: string; totalAmount: number; itemsCount: number; topItems: string[] } } = {};

        // Breakdown by Discretionary Subtype
        const discByType: Record<string, { key: string; title: string; icon: string; totalAmount: number; count: number; color: string; bg: string }> = {
          sweets_snacks: {
            key: "sweets_snacks",
            title: "حلويات ومكسرات وسناكات",
            icon: "🍫",
            totalAmount: 0,
            count: 0,
            color: "text-pink-600 dark:text-pink-400",
            bg: "bg-pink-500/10 border-pink-200 dark:border-pink-800/40"
          },
          fast_food: {
            key: "fast_food",
            title: "وجبات سريعة ومطاعم",
            icon: "🍔",
            totalAmount: 0,
            count: 0,
            color: "text-amber-600 dark:text-amber-400",
            bg: "bg-amber-500/10 border-amber-200 dark:border-amber-800/40"
          },
          soda_energy: {
            key: "soda_energy",
            title: "مشروبات غازية وطاقة",
            icon: "🥤",
            totalAmount: 0,
            count: 0,
            color: "text-red-600 dark:text-red-400",
            bg: "bg-red-500/10 border-red-200 dark:border-red-800/40"
          },
          smoking: {
            key: "smoking",
            title: "سجائر وتبغ ومعسل",
            icon: "🚬",
            totalAmount: 0,
            count: 0,
            color: "text-zinc-600 dark:text-zinc-400",
            bg: "bg-zinc-500/10 border-zinc-200 dark:border-zinc-700"
          },
          entertainment: {
            key: "entertainment",
            title: "ألعاب ويانصيب وترفيه",
            icon: "🎲",
            totalAmount: 0,
            count: 0,
            color: "text-purple-600 dark:text-purple-400",
            bg: "bg-purple-500/10 border-purple-200 dark:border-purple-800/40"
          },
          luxury: {
            key: "luxury",
            title: "كماليات ونزوات عابرة",
            icon: "🛍️",
            totalAmount: 0,
            count: 0,
            color: "text-orange-600 dark:text-orange-400",
            bg: "bg-orange-500/10 border-orange-200 dark:border-orange-800/40"
          }
        };

        flatItems.forEach(it => {
          const clean = it.name.trim();
          if (it.nature.type === "discretionary") {
            if (!discMap[clean]) {
              discMap[clean] = { name: clean, totalAmount: 0, count: 0, totalQty: 0, category: it.category, places: [], dates: [], nature: it.nature };
            }
            discMap[clean].totalAmount += it.price;
            discMap[clean].count += 1;
            discMap[clean].totalQty += it.quantity;
            if (it.place && !discMap[clean].places.includes(it.place)) discMap[clean].places.push(it.place);
            discMap[clean].dates.push(it.date);

            const p = it.place || "غير محدد";
            if (!placeMap[p]) placeMap[p] = { place: p, totalAmount: 0, itemsCount: 0, topItems: [] };
            placeMap[p].totalAmount += it.price;
            placeMap[p].itemsCount += 1;
            if (!placeMap[p].topItems.includes(clean) && placeMap[p].topItems.length < 3) {
              placeMap[p].topItems.push(clean);
            }

            // subType tallying
            const st = it.nature.subType || "sweets_snacks";
            if (discByType[st]) {
              discByType[st].totalAmount += it.price;
              discByType[st].count += 1;
            } else if (discByType.luxury) {
              discByType.luxury.totalAmount += it.price;
              discByType.luxury.count += 1;
            }
          } else if (it.nature.type === "essential") {
            if (!essMap[clean]) {
              essMap[clean] = { name: clean, totalAmount: 0, count: 0, totalQty: 0, category: it.category, places: [] };
            }
            essMap[clean].totalAmount += it.price;
            essMap[clean].count += 1;
            essMap[clean].totalQty += it.quantity;
            if (it.place && !essMap[clean].places.includes(it.place)) essMap[clean].places.push(it.place);
          }
        });

        const topDiscretionary = Object.values(discMap).sort((a, b) => b.totalAmount - a.totalAmount);
        const topEssentials = Object.values(essMap).sort((a, b) => b.totalAmount - a.totalAmount);
        const topPlaces = Object.values(placeMap).sort((a, b) => b.totalAmount - a.totalAmount);

        const discPercent = totalSpend > 0 ? Math.round((discSpend / totalSpend) * 100) : 0;
        const essPercent = totalSpend > 0 ? Math.round((essSpend / totalSpend) * 100) : 0;
        const neutralPercent = Math.max(0, 100 - discPercent - essPercent);

        const healthScore = Math.max(10, Math.min(100, Math.round(100 - (discPercent * 1.5))));
        let healthLevel: { label: string; color: string; badge: string; icon: string; advice: string };

        if (discPercent <= 15) {
          healthLevel = {
            label: "انضباط مالي استثنائي",
            color: "text-emerald-500",
            badge: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40",
            icon: "🌟",
            advice: "مصاريفك منضبطة جداً وتذهب للمتطلبات الأساسية للمنزل. نسبة التسالي والجاهز ضئيلة وصحية."
          };
        } else if (discPercent <= 28) {
          healthLevel = {
            label: "توازن مالي جيد",
            color: "text-blue-500",
            badge: "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-800/40",
            icon: "⚖️",
            advice: "صرفك على التسالي والكماليات في الحدود الطبيعية للترفيه المنزلي، مع فرصة لتوفير إضافي عند الحاجة."
          };
        } else if (discPercent <= 45) {
          healthLevel = {
            label: "تنبيه: تسريب مالي ملحوظ",
            color: "text-amber-500",
            badge: "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300 border-amber-200 dark:border-amber-800/40",
            icon: "⚠️",
            advice: "ما يقارب ثلث الميزانية يذهب للتسالي والوجبات السريعة. تقنينها قليلاً سيوفر مبالغ مجزية شهرياً."
          };
        } else {
          healthLevel = {
            label: "إنذار: تبذير مرتفع",
            color: "text-rose-500",
            badge: "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 border-rose-200 dark:border-rose-800/40",
            icon: "🚨",
            advice: "أكثر من نصف المصاريف يذهب للكماليات والتسالي والجاهز. يمكن إعادة توجيه هذه المبالغ لسداد الديون أو الادخار."
          };
        }

        const monthlySavings = Math.round(discSpend * (wasteSavingsRatio / 100));
        const yearlySavings = monthlySavings * 12;

        const handleCopyReport = () => {
          const report = `🧠 *تقرير دراسة المصروفات والترشيد الذكي* 📊\n` +
            `🗓️ النطاق: ${wastePeriodFilter === 'cycle' ? 'الدورة الحالية' : wastePeriodFilter === 'month' ? 'الشهر الحالي' : 'كافة السجلات'}\n` +
            `💰 إجمالي الصرف: ${fmt(totalSpend)} د.ع\n` +
            `🥦 الأساسيات والمؤونة: ${fmt(essSpend)} د.ع (${essPercent}%)\n` +
            `🍭 التبذير والتسالي: ${fmt(discSpend)} د.ع (${discPercent}%)\n` +
            `🌟 مؤشر الانضباط: ${healthScore} / 100 (${healthLevel.label})\n` +
            `💵 إمكانية التوفير بنسبة %${wasteSavingsRatio}: ${fmt(monthlySavings)} د.ع شهرياً (${fmt(yearlySavings)} د.ع سنوياً)\n\n` +
            `🔥 *أعلى 5 مواد تسالي استنزافاً:*\n` +
            topDiscretionary.slice(0, 5).map((it, i) => `${i + 1}. ${it.name}: ${fmt(it.totalAmount)} د.ع (تكررت ${it.count} مرات)`).join('\n');

          navigator.clipboard.writeText(report);
          toast.success("تم نسخ تقرير الترشيد المالي بنجاح! 📋");
        };

        const filteredTopDisc = topDiscretionary.filter(it => {
          const normQ = normalizeArabicText(wasteSearchQuery);
          const matchesSearch = !wasteSearchQuery ||
            normalizeArabicText(it.name).includes(normQ) ||
            normalizeArabicText(it.category || "").includes(normQ);
          const matchesSubtype = !wasteSubtypeFilter || it.nature?.subType === wasteSubtypeFilter;
          return matchesSearch && matchesSubtype;
        });

        const filteredTopEss = topEssentials.filter(it => {
          const normQ = normalizeArabicText(wasteSearchQuery);
          return !wasteSearchQuery ||
            normalizeArabicText(it.name).includes(normQ) ||
            normalizeArabicText(it.category || "").includes(normQ);
        });

        const filteredReceipts = receiptsWithDisc.filter(r => {
          const normQ = normalizeArabicText(wasteSearchQuery);
          return !wasteSearchQuery ||
            normalizeArabicText(r.exp.name).includes(normQ) ||
            r.discItemNames.some(n => normalizeArabicText(n).includes(normQ));
        });

        return (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
            <div className="relative w-full max-w-4xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-gray-100 dark:border-zinc-800 my-auto overflow-hidden flex flex-col max-h-[92vh]">
              
              {/* Header */}
              <div className="relative p-5 pb-4 border-b border-gray-100 dark:border-zinc-800 bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-indigo-500/10">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-500 via-amber-500 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/25 shrink-0">
                      <BrainCircuit className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                        دراسة المصروفات ورصد التبذير الذكي
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-rose-500 text-white shadow-sm">
                          ذكي 🧠
                        </span>
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        تحليل تفصيلي لمشتريات القوائم وفرز المواد الأساسية عن التسالي والكماليات لكشف التسريبات المالية
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowWasteStudyModal(false)}
                    className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-500 dark:text-gray-400 flex items-center justify-center transition active:scale-95 shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Period Selector Pills */}
                <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1 scrollbar-none">
                  <span className="text-[11px] font-bold text-gray-400 shrink-0">النطاق الزمني:</span>
                  <button
                    onClick={() => setWastePeriodFilter("cycle")}
                    className={`text-xs font-black px-3 py-1.5 rounded-xl transition shrink-0 ${
                      wastePeriodFilter === "cycle"
                        ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
                        : "bg-white/80 dark:bg-zinc-800/80 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700"
                    }`}
                  >
                    الدورة المالية الحالية 🔄
                  </button>
                  <button
                    onClick={() => setWastePeriodFilter("month")}
                    className={`text-xs font-black px-3 py-1.5 rounded-xl transition shrink-0 ${
                      wastePeriodFilter === "month"
                        ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
                        : "bg-white/80 dark:bg-zinc-800/80 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700"
                    }`}
                  >
                    الشهر الحالي 📅
                  </button>
                  <button
                    onClick={() => setWastePeriodFilter("all")}
                    className={`text-xs font-black px-3 py-1.5 rounded-xl transition shrink-0 ${
                      wastePeriodFilter === "all"
                        ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
                        : "bg-white/80 dark:bg-zinc-800/80 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700"
                    }`}
                  >
                    كافة السجلات 🌐
                  </button>
                </div>
              </div>

              {/* Navigation Tabs Ribbon */}
              <div className="px-5 pt-3 pb-2 border-b border-gray-100 dark:border-zinc-800/80 flex items-center gap-1.5 overflow-x-auto scrollbar-none bg-gray-50/50 dark:bg-zinc-900/50">
                <button
                  onClick={() => setWasteActiveTab("overview")}
                  className={`text-xs font-black px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shrink-0 ${
                    wasteActiveTab === "overview"
                      ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>نظرة عامة والترشيد 📊</span>
                </button>

                <button
                  onClick={() => setWasteActiveTab("discretionary")}
                  className={`text-xs font-black px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shrink-0 ${
                    wasteActiveTab === "discretionary"
                      ? "bg-rose-500 text-white shadow-md shadow-rose-500/25"
                      : "text-gray-600 dark:text-gray-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                  }`}
                >
                  <span>كشف التسالي والتبذير 🍭</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 font-bold">
                    {topDiscretionary.length}
                  </span>
                </button>

                <button
                  onClick={() => setWasteActiveTab("essentials")}
                  className={`text-xs font-black px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shrink-0 ${
                    wasteActiveTab === "essentials"
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/25"
                      : "text-gray-600 dark:text-gray-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                  }`}
                >
                  <span>المؤونة والأساسيات 🥦</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 font-bold">
                    {topEssentials.length}
                  </span>
                </button>

                <button
                  onClick={() => setWasteActiveTab("receipts")}
                  className={`text-xs font-black px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shrink-0 ${
                    wasteActiveTab === "receipts"
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                      : "text-gray-600 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>القوائم المتضمنة للتبذير</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 font-bold">
                    {receiptsWithDisc.length}
                  </span>
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">

                {/* ═══ TAB 1: OVERVIEW ═══ */}
                {wasteActiveTab === "overview" && (
                  <div className="space-y-4">
                    
                    {/* Health Assessment Glass Card */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-zinc-800/80 dark:via-zinc-900/60 dark:to-zinc-800/80 border border-gray-100 dark:border-zinc-800 shadow-sm">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-2xl shadow-inner shrink-0">
                            {healthLevel.icon}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-gray-400">تقييم النمط الاستهلاكي:</span>
                              <span className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${healthLevel.badge}`}>
                                {healthLevel.label}
                              </span>
                            </div>
                            <h4 className="text-sm sm:text-base font-black text-gray-800 dark:text-white mt-0.5">
                              {healthLevel.advice}
                            </h4>
                          </div>
                        </div>

                        <div className="text-left bg-white dark:bg-zinc-800 px-3 py-1.5 rounded-xl border border-gray-100 dark:border-zinc-700 shrink-0">
                          <span className="text-[10px] text-gray-400 font-bold block">مؤشر الانضباط</span>
                          <span className="text-base font-black text-purple-600 dark:text-purple-400">
                            {healthScore} <span className="text-[10px] text-gray-400">/ 100</span>
                          </span>
                        </div>
                      </div>

                      {/* Visual Ratio Split Bar */}
                      <div>
                        <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <span>🥦 الأساسيات:</span>
                            <span className="font-black">{essPercent}%</span>
                            <span className="text-[10px] text-gray-400">({fmt(essSpend)} د.ع)</span>
                          </span>
                          <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                            <span>🍭 التبذير والتسالي:</span>
                            <span className="font-black">{discPercent}%</span>
                            <span className="text-[10px] text-gray-400">({fmt(discSpend)} د.ع)</span>
                          </span>
                        </div>

                        <div className="w-full h-3.5 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden flex p-0.5 shadow-inner">
                          <div
                            style={{ width: `${essPercent}%` }}
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-l-full transition-all duration-500"
                            title={`الأساسيات: ${essPercent}%`}
                          />
                          <div
                            style={{ width: `${neutralPercent}%` }}
                            className="h-full bg-indigo-300 dark:bg-indigo-600 transition-all duration-500"
                            title={`مشتريات عامة: ${neutralPercent}%`}
                          />
                          <div
                            style={{ width: `${discPercent}%` }}
                            className="h-full bg-gradient-to-r from-amber-400 to-rose-500 rounded-r-full transition-all duration-500"
                            title={`التبذير والكماليات: ${discPercent}%`}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 mt-1">
                          <span>إجمالي الصرف المحلل: <strong className="text-gray-700 dark:text-gray-200">{fmt(totalSpend)} د.ع</strong></span>
                          <span>مفحوص في <strong className="text-gray-700 dark:text-gray-200">{periodExpenses.length}</strong> فاتورة تضم <strong className="text-gray-700 dark:text-gray-200">{flatItems.length}</strong> مادة</span>
                        </div>
                      </div>
                    </div>

                    {/* Interactive Savings Simulator */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-rose-500/10 to-orange-500/10 border border-amber-200/50 dark:border-amber-900/40">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                            💡
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-gray-900 dark:text-white">
                              محاكي التوفير والترشيد الذكي
                            </h4>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                              حدد نسبة تخفيض مصاريف التسالي والكماليات لتكتشف المبالغ التي ستنقذها شهرياً وسنوياً
                            </p>
                          </div>
                        </div>

                        {/* Quick Presets */}
                        <div className="flex items-center gap-1.5 self-end sm:self-auto">
                          {[15, 25, 35, 50].map(ratio => (
                            <button
                              key={ratio}
                              onClick={() => setWasteSavingsRatio(ratio)}
                              className={`text-xs font-black px-2.5 py-1 rounded-lg transition ${
                                wasteSavingsRatio === ratio
                                  ? "bg-amber-500 text-white shadow-sm"
                                  : "bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-zinc-700"
                              }`}
                            >
                              %{ratio}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Slider */}
                      <div className="space-y-1 mb-4">
                        <div className="flex items-center justify-between text-xs font-bold text-gray-600 dark:text-gray-300">
                          <span>نسبة الترشيد المستهدفة:</span>
                          <span className="font-black text-amber-600 dark:text-amber-400 text-sm">%{wasteSavingsRatio}</span>
                        </div>
                        <input
                          type="range"
                          min="5"
                          max="75"
                          step="5"
                          value={wasteSavingsRatio}
                          onChange={(e) => setWasteSavingsRatio(Number(e.target.value))}
                          className="w-full accent-amber-500 h-2 bg-gray-200 dark:bg-zinc-700 rounded-lg cursor-pointer"
                        />
                      </div>

                      {/* Savings Result Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-white/90 dark:bg-zinc-800/90 rounded-xl p-3.5 border border-amber-100 dark:border-zinc-700 shadow-sm flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-bold text-gray-400 block">توفير شهري مباشر</span>
                            <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
                              +{fmt(monthlySavings)} <span className="text-xs">د.ع</span>
                            </span>
                          </div>
                          <div className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-300 flex items-center justify-center font-bold text-base">
                            💵
                          </div>
                        </div>

                        <div className="bg-white/90 dark:bg-zinc-800/90 rounded-xl p-3.5 border border-amber-100 dark:border-zinc-700 shadow-sm flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-bold text-gray-400 block">توفير سنوي تراكمي</span>
                            <span className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400">
                              +{fmt(yearlySavings)} <span className="text-xs">د.ع</span>
                            </span>
                          </div>
                          <div className="w-9 h-9 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-300 flex items-center justify-center font-bold text-base">
                            💰
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 text-center sm:text-right">
                        <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-100/60 dark:bg-amber-950/60 px-3 py-1 rounded-full inline-block">
                          🎯 هذا التوفير كافي لتغطية سلفة شهرية كاملة أو شراء مؤونة غذائية منزلية لأشهر إضافية!
                        </span>
                      </div>
                    </div>

                    {/* Discretionary Subcategories Smart Cards */}
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-500/5 via-amber-500/5 to-purple-500/5 border border-rose-100 dark:border-zinc-800">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-base">🧠</span>
                          <h4 className="text-xs font-black text-gray-800 dark:text-white">
                            تصنيف مجالات التبذير والتسالي (بالأقسام الفرعية)
                          </h4>
                        </div>
                        <span className="text-[10px] text-gray-400 font-bold">
                          اضغط على أي قسم للتصفية
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {Object.values(discByType).map(cat => {
                          const catPercent = discSpend > 0 ? Math.round((cat.totalAmount / discSpend) * 100) : 0;
                          return (
                            <button
                              key={cat.key}
                              type="button"
                              onClick={() => {
                                setWasteSubtypeFilter(cat.key);
                                setWasteActiveTab("discretionary");
                              }}
                              className={`p-3 rounded-2xl border text-right transition flex flex-col justify-between hover:scale-[1.02] active:scale-95 shadow-2xs ${cat.bg}`}
                            >
                              <div className="flex items-start justify-between">
                                <span className="text-xl">{cat.icon}</span>
                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${cat.color} bg-white/70 dark:bg-zinc-900/70 border border-current/20`}>
                                  {catPercent}%
                                </span>
                              </div>
                              <div className="mt-2">
                                <span className="text-xs font-black text-gray-900 dark:text-gray-100 block truncate">
                                  {cat.title}
                                </span>
                                <div className="flex items-center justify-between mt-1">
                                  <span className={`text-xs font-black ${cat.color}`}>
                                    {fmt(cat.totalAmount)} <span className="text-[9px] text-gray-400">د.ع</span>
                                  </span>
                                  <span className="text-[10px] text-gray-400 font-bold">
                                    {cat.count} مواد
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Top 4 Waste Leaks Quick View */}
                    <div className="p-4 rounded-2xl bg-gray-50/80 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-800">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Flame className="w-4 h-4 text-rose-500" />
                          <h4 className="text-xs font-black text-gray-800 dark:text-white">
                            أعلى مواد استنزافاً بين التسالي والكماليات
                          </h4>
                        </div>
                        <button
                          onClick={() => setWasteActiveTab("discretionary")}
                          className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-0.5"
                        >
                          <span>عرض الكل ({topDiscretionary.length})</span>
                          <ChevronLeft className="w-3 h-3" />
                        </button>
                      </div>

                      {topDiscretionary.length === 0 ? (
                        <div className="text-center py-6 text-xs font-bold text-gray-400">
                          رائع! لم يتم رصد أي مشتريات تسالي أو كماليات في هذا النطاق الزمني 🌟
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {topDiscretionary.slice(0, 4).map((item, idx) => (
                            <div
                              key={item.name}
                              className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-sm flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="w-6 h-6 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 font-black text-xs flex items-center justify-center shrink-0">
                                  #{idx + 1}
                                </span>
                                <div className="min-w-0">
                                  <div className="font-black text-xs text-gray-800 dark:text-gray-100 truncate">
                                    {item.name}
                                  </div>
                                  <div className="text-[10px] text-gray-400 font-bold truncate">
                                    تكررت {item.count} مرات {item.places.length > 0 ? `• ${item.places[0]}` : ''}
                                  </div>
                                </div>
                              </div>
                              <div className="text-left shrink-0 font-black text-xs text-rose-600 dark:text-rose-400">
                                {fmt(item.totalAmount)} <span className="text-[9px] text-gray-400">د.ع</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Top Places of Discretionary Spend */}
                    {topPlaces.length > 0 && (
                      <div className="p-4 rounded-2xl bg-gray-50/80 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-800">
                        <div className="flex items-center gap-2 mb-3">
                          <MapPin className="w-4 h-4 text-purple-500" />
                          <h4 className="text-xs font-black text-gray-800 dark:text-white">
                            أكثر الأماكن والمتاجر التي صُرف فيها على الكماليات
                          </h4>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {topPlaces.slice(0, 5).map(place => (
                            <div
                              key={place.place}
                              className="px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-sm text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2"
                            >
                              <span>📍 {place.place}</span>
                              <span className="text-rose-600 dark:text-rose-400 font-black">
                                {fmt(place.totalAmount)} د.ع
                              </span>
                              <span className="text-[9px] text-gray-400 font-normal">
                                ({place.itemsCount} مواد)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                )}

                {/* ═══ TAB 2: DISCRETIONARY LEAKS ═══ */}
                {wasteActiveTab === "discretionary" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-gray-800 dark:text-white">
                          قائمة مواد التسالي والكماليات المرصودة ({filteredTopDisc.length})
                        </span>
                        <span className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full border border-rose-200">
                          إجمالي: {fmt(discSpend)} د.ع
                        </span>
                      </div>

                      <div className="relative w-full sm:w-64">
                        <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={wasteSearchQuery}
                          onChange={(e) => setWasteSearchQuery(e.target.value)}
                          placeholder="بحث في مواد التسالي..."
                          className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl pr-8 pl-3 py-1.5 text-xs text-gray-800 dark:text-white outline-none focus:border-rose-500"
                        />
                      </div>
                    </div>

                    {filteredTopDisc.length === 0 ? (
                      <div className="text-center py-12 text-xs font-bold text-gray-400">
                        {wasteSearchQuery ? "لا توجد مواد مطابقة للبحث" : "لا توجد مواد تسالي أو كماليات مسجلة في هذه الفترة"}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredTopDisc.map((item, idx) => (
                          <div
                            key={item.name}
                            className="p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 hover:border-rose-200 dark:hover:border-rose-900/50 shadow-sm transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="w-7 h-7 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 font-black text-xs flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-black text-sm text-gray-900 dark:text-white">
                                    {item.name}
                                  </span>
                                  <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40">
                                    تسالي / جاهز 🍭
                                  </span>
                                  {item.category && (
                                    <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.2 rounded-md">
                                      {item.category}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-gray-400 font-bold mt-0.5 flex items-center gap-2 flex-wrap">
                                  <span>تكررت الشراء: <strong className="text-gray-600 dark:text-gray-300">{item.count} مرات</strong></span>
                                  <span>الكمية الإجمالية: <strong className="text-gray-600 dark:text-gray-300">{item.totalQty}</strong></span>
                                  {item.places.length > 0 && (
                                    <span>المتاجر: <strong className="text-gray-600 dark:text-gray-300">{item.places.join("، ")}</strong></span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="self-end sm:self-auto text-left shrink-0">
                              <div className="font-black text-sm sm:text-base text-rose-600 dark:text-rose-400">
                                {fmt(item.totalAmount)} <span className="text-[10px] text-gray-400 font-bold">د.ع</span>
                              </div>
                              <span className="text-[10px] text-gray-400 block">
                                بمعدل {fmt(Math.round(item.totalAmount / (item.count || 1)))} د.ع للمرة
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ═══ TAB 3: ESSENTIALS ═══ */}
                {wasteActiveTab === "essentials" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-gray-800 dark:text-white">
                          قائمة المؤونة والمصاريف الأساسية ({filteredTopEss.length})
                        </span>
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200">
                          إجمالي: {fmt(essSpend)} د.ع
                        </span>
                      </div>

                      <div className="relative w-full sm:w-64">
                        <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={wasteSearchQuery}
                          onChange={(e) => setWasteSearchQuery(e.target.value)}
                          placeholder="بحث في المواد الأساسية..."
                          className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl pr-8 pl-3 py-1.5 text-xs text-gray-800 dark:text-white outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    {filteredTopEss.length === 0 ? (
                      <div className="text-center py-12 text-xs font-bold text-gray-400">
                        {wasteSearchQuery ? "لا توجد مواد مطابقة للبحث" : "لا توجد مواد أساسية مسجلة في هذه الفترة"}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredTopEss.map((item, idx) => (
                          <div
                            key={item.name}
                            className="p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 hover:border-emerald-200 dark:hover:border-emerald-900/50 shadow-sm transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 font-black text-xs flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-black text-sm text-gray-900 dark:text-white">
                                    {item.name}
                                  </span>
                                  <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                                    أساسي وتموين 🥦
                                  </span>
                                  {item.category && (
                                    <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.2 rounded-md">
                                      {item.category}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-gray-400 font-bold mt-0.5 flex items-center gap-2 flex-wrap">
                                  <span>تكررت الشراء: <strong className="text-gray-600 dark:text-gray-300">{item.count} مرات</strong></span>
                                  <span>الكمية: <strong className="text-gray-600 dark:text-gray-300">{item.totalQty}</strong></span>
                                </div>
                              </div>
                            </div>

                            <div className="self-end sm:self-auto text-left shrink-0 font-black text-sm sm:text-base text-emerald-600 dark:text-emerald-400">
                              {fmt(item.totalAmount)} <span className="text-[10px] text-gray-400 font-bold">د.ع</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ═══ TAB 4: RECEIPTS WITH DISCRETIONARY ═══ */}
                {wasteActiveTab === "receipts" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-gray-800 dark:text-white">
                          القوائم والفواتير التي تضم مواد تسالي وكماليات ({filteredReceipts.length})
                        </span>
                      </div>

                      <div className="relative w-full sm:w-64">
                        <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={wasteSearchQuery}
                          onChange={(e) => setWasteSearchQuery(e.target.value)}
                          placeholder="بحث باسم القائمة أو المادة..."
                          className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl pr-8 pl-3 py-1.5 text-xs text-gray-800 dark:text-white outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    {filteredReceipts.length === 0 ? (
                      <div className="text-center py-12 text-xs font-bold text-gray-400">
                        {wasteSearchQuery ? "لا توجد قوائم مطابقة للبحث" : "لا توجد قوائم متضمنة لمواد تسالي في هذه الفترة"}
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {filteredReceipts.map(({ exp, discTotal, discItemsCount, discItemNames }) => (
                          <div
                            key={exp.id}
                            className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 hover:border-indigo-200 dark:hover:border-indigo-900/50 shadow-sm transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-black text-sm text-gray-900 dark:text-white">
                                  {exp.name}
                                </span>
                                <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md font-bold">
                                  {new Date(exp.date).toLocaleDateString("ar-IQ")}
                                </span>
                                <span className="text-[10px] font-black text-rose-600 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 px-2 py-0.5 rounded-full">
                                  🍭 {discItemsCount} مواد تسالي ({fmt(discTotal)} د.ع)
                                </span>
                              </div>

                              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                                <span className="text-[11px] font-bold text-gray-400">المواد المرصودة:</span>
                                {discItemNames.map((n, idx) => (
                                  <span
                                    key={idx}
                                    className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-gray-50 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 border border-gray-200/60 dark:border-zinc-700/60"
                                  >
                                    {n}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                              <div className="text-left">
                                <span className="text-[10px] font-bold text-gray-400 block">إجمالي الفاتورة</span>
                                <span className="font-black text-sm text-gray-800 dark:text-white">
                                  {fmt(exp.amount)} د.ع
                                </span>
                              </div>

                              <button
                                onClick={() => {
                                  setViewingReceiptExpense(exp);
                                  setReceiptItemFilter("");
                                }}
                                className="px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-black flex items-center gap-1 border border-indigo-200/50 transition active:scale-95"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>معاينة المواد 🔍</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50 flex flex-wrap items-center justify-between gap-3">
                <button
                  onClick={handleCopyReport}
                  className="px-4 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-xs font-black flex items-center gap-1.5 border border-purple-200/60 dark:border-purple-800/40 transition active:scale-95"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>نسخ ملخص الترشيد لمشاركته مع العائلة 📋</span>
                </button>

                <button
                  onClick={() => setShowWasteStudyModal(false)}
                  className="px-5 py-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-black hover:opacity-90 transition active:scale-95 shadow-sm"
                >
                  تم والإغلاق
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {showLottoTrackerModal && (
        <LottoTracker
          isOpen={showLottoTrackerModal}
          onClose={() => setShowLottoTrackerModal(false)}
          onAddExpenseLinked={(amount, desc, date) => {
            const item: Expense = {
              id: Date.now().toString(),
              name: desc,
              category: "ألعاب ويانصيب",
              amount,
              date: date || today(),
              createdAt: new Date().toISOString()
            };
            const updated = [item, ...expenses];
            setExpenses(updated);
            syncToFirebase("expenses", updated);
            toast.success("تم تسجيل المصروف تلقائياً في سجل المصاريف!");
          }}
        />
      )}

    </div>
  );
}
