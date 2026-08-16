"use client";
import { useState, useEffect, useMemo } from "react";
import {
  ArrowRight, Plus, Minus, Check, Wallet, CreditCard, Receipt,
  TrendingDown, TrendingUp, AlertCircle, ShoppingCart, X, Trash2,
  Edit2, Car, Home, Shirt, Sofa, Wrench, Users, DollarSign,
  Calendar, ChevronDown, ChevronUp, Clock, BarChart3, PiggyBank,
  Banknote, Activity, Package, Zap, Heart, BookOpen, ChevronRight, ClipboardCopy, Plane,
  Map as MapIcon, MapPin, ArrowLeft, Calculator, Share2, Target, Flag, Circle, CheckCircle2,
  MessageCircle, Send, Bot, Sparkles, BrainCircuit, CheckCircle, PackageCheck
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { db, storage } from "@/lib/firebase";
import { doc, getDoc, setDoc, onSnapshot, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { WORLD_COUNTRIES, IRAQ_GOVERNORATES } from "./countries";

// ══════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════

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
  paidDates: { date: string; amount: number; expenseId: string }[];
  createdAt: string;
}

interface Expense {
  id: string;
  name: string;
  category: string;
  amount: number;
  date: string;
  createdAt: string;
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
  tripDestination?: string;
  createdAt: string;
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
  payments: { date: string; amount: number; expenseOrIncomeId?: string }[];
  createdAt: string;
}

interface FamilyMemberNeed {
  id: string;
  member: string; // "حيدر" | "إيمان" | "رقية" | "قنوت" | "إيڤا"
  title: string;
  type?: "need" | "duty"; // "need" = طلبات واحتياجات, "duty" = واجبات ومسؤوليات
  category: string;
  quantity?: number;
  estimatedPrice?: number;
  priority?: string;
  notes?: string;
  status: "pending" | "available" | "completed";
  createdAt: string;
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
  { label: "مطاعم وكوفيهات", icon: "🍽️", color: "from-orange-500 to-amber-500" },
  { label: "مخضر وفواكه", icon: "🍎", color: "from-green-400 to-emerald-400" },
  { label: "حاسوب", icon: "💻", color: "from-blue-600 to-indigo-600" },
  { label: "سفر", icon: "✈️", color: "from-sky-400 to-blue-500" },
  { label: "سوبر ماركت", icon: "🛒", color: "from-green-500 to-emerald-500" },
  { label: "سيارة", icon: "🚗", color: "from-blue-500 to-cyan-500" },
  { label: "صحة وطب", icon: "❤️", color: "from-red-500 to-pink-500" },
  { label: "ملابس", icon: "👕", color: "from-purple-500 to-violet-500" },
  { label: "تعليم", icon: "📚", color: "from-indigo-500 to-blue-500" },
  { label: "احتياجات مدرسية", icon: "🎒", color: "from-yellow-500 to-orange-500" },
  { label: "ترفيه", icon: "🎮", color: "from-pink-500 to-rose-500" },
  { label: "أثاث", icon: "🛋️", color: "from-amber-500 to-yellow-500" },
  { label: "ترميم", icon: "🔧", color: "from-gray-500 to-slate-500" },
  { label: "عائلة", icon: "👪", color: "from-sky-500 to-blue-500" },
  { label: "أقساط وسلف", icon: "💳", color: "from-indigo-500 to-purple-500" },
  { label: "كهرباء", icon: "⚡", color: "from-yellow-400 to-yellow-600" },
  { label: "ماء", icon: "💧", color: "from-blue-400 to-blue-600" },
  { label: "إنترنت", icon: "🌐", color: "from-sky-400 to-sky-600" },
  { label: "إيجار", icon: "🏠", color: "from-emerald-400 to-emerald-600" },
  { label: "هاتف", icon: "📱", color: "from-gray-400 to-gray-600" },
  { label: "تنظيف", icon: "🧹", color: "from-teal-400 to-teal-600" },
  { label: "عناية بالبشرة والجسم", icon: "✨", color: "from-pink-400 to-rose-400" },
  { label: "مكياج", icon: "💄", color: "from-fuchsia-400 to-pink-500" },
  { label: "تبرعات", icon: "🤲", color: "from-emerald-400 to-teal-500" },
  { label: "غاز", icon: "🔥", color: "from-orange-500 to-red-500" },
  { label: "إكسسوارات", icon: "💍", color: "from-amber-400 to-rose-400" },
  { label: "عطور", icon: "🌸", color: "from-purple-400 to-pink-500" },
  { label: "ألعاب", icon: "🧸", color: "from-amber-400 to-yellow-500" },
  { label: "مفروشات", icon: "🛏️", color: "from-teal-400 to-emerald-500" },
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
const HOME_INVENTORY_UNITS = ["كغم", "لتر", "قطعة", "كيس", "علبة", "بطل", "كيلو"];

const FAMILY_MEMBERS = ["حيدر", "إيمان", "رقية", "قنوت", "إيڤا"];


// ══════════════════════════════════════════════
// STORAGE
// ══════════════════════════════════════════════



  const syncToFirebase = async (key: string, data: any) => {
    try {
      const syncPromise = setDoc(doc(db, "home_finance", key), { data });
      
      await Promise.race([
        syncPromise,
        new Promise(resolve => setTimeout(resolve, 1500))
      ]);
      
      if (!navigator.onLine) {
        toast.success("تم الحفظ محلياً (قيد المزامنة)");
      }
    } catch (error) {
      console.error(`Error saving ${key} to firebase:`, error);
    }
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

export default function HomeFinanceDashboard() {
  const [activeTab, setActiveTab] = useState<"overview" | "expenses" | "income" | "installments" | "needs" | "bills" | "debts" | "inventory" | "car" | "travel" | "familyNeeds" | "futurePlans">("overview");

  // Data state
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [carInventory, setCarInventory] = useState<InventoryItem[]>([]);
  const [travelInventory, setTravelInventory] = useState<InventoryItem[]>([]);
  const [needs, setNeeds] = useState<Need[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [familyNeeds, setFamilyNeeds] = useState<FamilyMemberNeed[]>([]);
  const [travelTrips, setTravelTrips] = useState<TravelTrip[]>([]);
  const [travelExpenses, setTravelExpenses] = useState<TravelExpense[]>([]);
  const [futurePlans, setFuturePlans] = useState<FuturePlan[]>([]);
  const [showFuturePlanModal, setShowFuturePlanModal] = useState(false);
  const [editFuturePlan, setEditFuturePlan] = useState<FuturePlan | null>(null);
  const [futurePlanSteps, setFuturePlanSteps] = useState<{id: string; text: string; isCompleted: boolean; date?: string}[]>([]);
  
  const [activeFamilyMember, setActiveFamilyMember] = useState("إيمان");
  const [newFamilyNeedTitle, setNewFamilyNeedTitle] = useState("");
  const [newFamilyNeedCategory, setNewFamilyNeedCategory] = useState("عائلة");
  
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

  const [settings, setSettings] = useState<{ manualCycleStarts?: string[] }>({ manualCycleStarts: [] });
  const [showAIChat, setShowAIChat] = useState(false);
  const [aiChatInput, setAiChatInput] = useState("");
  const [aiChatMessages, setAiChatMessages] = useState<{sender: 'user' | 'ai', text: string}[]>([
    { sender: 'ai', text: 'مرحباً! أنا مساعدك المالي الذكي. يمكنك سؤالي عن مصاريفك، تقييم خططك، أو استشارتي في إدارة أموالك.' }
  ]);

  const [mounted, setMounted] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

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
  const [payBillData, setPayBillData] = useState<{bill: Bill, amount: string} | null>(null);
  const [showFamilyNeedModal, setShowFamilyNeedModal] = useState(false);
  const [editFamilyNeed, setEditFamilyNeed] = useState<FamilyMemberNeed | null>(null);
  const [familyNeedType, setFamilyNeedType] = useState<"need" | "duty">("need");

  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string | null>(null);

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

  const [editNeed, setEditNeed] = useState<InventoryItem | null>(null);
  const [showNeedModal, setShowNeedModal] = useState(false);
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

  // Auto-suggest states
  const uniqueNames = useMemo(() => {
    if (!mounted) return [];
    return Array.from(new Set([
      ...inventory.map(i => i.name),
      ...expenses.map(e => e.name),
      ...debts.map(d => d.person),
      ...installments.map(i => i.name),
      ...bills.map(b => b.name)
    ])).filter(Boolean);
  }, [inventory, expenses, debts, installments, bills, mounted]);

  const [needNameInput, setNeedNameInput] = useState("");
  const [showNeedSuggestions, setShowNeedSuggestions] = useState(false);
  
  const [invNameInput, setInvNameInput] = useState("");
  const [showInvSuggestions, setShowInvSuggestions] = useState(false);

  const [expNameInput, setExpNameInput] = useState("");
  const [showExpSuggestions, setShowExpSuggestions] = useState(false);

  const [debtNameInput, setDebtNameInput] = useState("");
  const [showDebtSuggestions, setShowDebtSuggestions] = useState(false);

  // Search states
  const [expenseSearch, setExpenseSearch] = useState("");
  const [inventorySearch, setInventorySearch] = useState("");
  const [billFilter, setBillFilter] = useState<"all" | "paid" | "unpaid">("all");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab") as any;
      if (tab) setActiveTab(tab);
    }
  }, []);

  useEffect(() => {
    if (showExpenseModal && !editExpense) setExpNameInput("");
  }, [showExpenseModal, editExpense]);

  useEffect(() => {
    if (showInventoryModal && !editInventory) setInvNameInput("");
  }, [showInventoryModal, editInventory]);

  useEffect(() => {
    if (showNeedModal && !editNeed) setNeedNameInput("");
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
    const keys: ("installments" | "bills" | "expenses" | "incomes" | "inventory" | "carInventory" | "travelInventory" | "needs" | "debts" | "familyNeeds" | "travelTrips" | "travelExpenses" | "futurePlans" | "settings")[] = [
      "installments", "bills", "expenses", "incomes", "inventory", "carInventory", "travelInventory", "needs", "debts", "familyNeeds", "travelTrips", "travelExpenses", "futurePlans", "settings"
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
      travelTrips: setTravelTrips,
      travelExpenses: setTravelExpenses,
      futurePlans: setFuturePlans,
      settings: setSettings,
    };

    let loadedCount = 0;
    
    const unsubscribers = keys.map(k => {
      return onSnapshot(doc(db, "home_finance", k), (snap) => {
        if (snap.exists() && snap.data().data) {
          setters[k](snap.data().data);
        } else {
          setters[k]([]);
        }
        loadedCount++;
        if (loadedCount >= keys.length) {
          setDataLoading(false);
        }
      }, (error) => {
        console.error(`Snapshot error for ${k}:`, error);
        loadedCount++;
        if (loadedCount >= keys.length) {
          setDataLoading(false);
        }
      });
    });

    setMounted(true);

    return () => {
      unsubscribers.forEach(unsub => unsub());
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
              toast.custom((t) => (
                <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl shadow-2xl rounded-3xl pointer-events-auto flex flex-col p-4 border border-gray-100/50 dark:border-zinc-800/50 relative overflow-hidden ring-1 ring-black/5`}>
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
                  <div className="flex items-start gap-3 relative z-10">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0">
                      <AlertCircle className="w-5 h-5 animate-pulse" />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex justify-between items-start">
                        <p className="text-sm font-black text-gray-900 dark:text-white">تذكير بالواجبات</p>
                        <button onClick={() => toast.dismiss(t.id)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition bg-gray-100/50 dark:bg-zinc-800/50 rounded-full p-1.5 -mt-1 -mr-1">
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
                duration: 10000 // Stays for 10 seconds unless dismissed
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
    
    if (now.getDate() < 12) {
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
      boundaries.push(new Date(year, month, 12));
    }

    const manualDates = (settings.manualCycleStarts || []).map(ds => new Date(ds));
    
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

  const [selectedCycleId, setSelectedCycleId] = useState<string>(cycles[0].id);
  const selectedCycle = cycles.find(c => c.id === selectedCycleId) || cycles[0];

  const isInCycle = (dateString: string) => {
    if (!dateString) return false;
    const dStr = dateString.split("T")[0];
    
    const startD = selectedCycle.start;
    const endD = selectedCycle.end;
    const startStr = `${startD.getFullYear()}-${String(startD.getMonth() + 1).padStart(2, '0')}-${String(startD.getDate()).padStart(2, '0')}`;
    const endStr = `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, '0')}-${String(endD.getDate()).padStart(2, '0')}`;
    
    return dStr >= startStr && dStr <= endStr;
  };

  // ──────────────────────────────────────────
  // DERIVED
  // ──────────────────────────────────────────

  const totalIncome = incomes
    .filter(i => isInCycle(i.date))
    .reduce((s, i) => s + i.amount, 0);

  const totalExpensesAmt = expenses
    .filter(e => isInCycle(e.date))
    .reduce((s, e) => s + e.amount, 0);

  const totalBillsAmt = bills.reduce((s, b) => s + b.amount, 0);

  const totalInstallmentMonthly = installments.reduce((s, i) => s + i.monthlyInstallment, 0);

  const isBillPaidThisCycle = (bill: Bill) => bill.paidDates && bill.paidDates.some(p => isInCycle(p.date));
  
  const isInstallmentOwedThisCycle = (i: Installment) => {
    if (i.remainingAmount <= 0) return false;
    if (i.payments.some(p => isInCycle(p.date))) return false;
    if (!i.startDate) return true;
    const start = new Date(i.startDate);
    const now = new Date();
    const monthsElapsed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    const requiredPayments = monthsElapsed + 1;
    const paidMonths = (i.initialPaidMonths || 0) + i.payments.length;
    return paidMonths < requiredPayments;
  };

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

  const needsSummaryStats = useMemo(() => {
    const summary: { id: string; name: string; count: number; price: number; icon: string; colorClass: string }[] = [];
    
    // Home Inventory only
    const homeItems = shoppingList;
    if (homeItems.length > 0) {
      const totalQty = homeItems.reduce((s, i) => s + (i.neededQuantity || 1), 0);
      const totalPrice = homeItems.reduce((s, i) => s + ((i.neededQuantity || 1) * (i.estimatedPrice || 0)), 0);
      summary.push({ id: "home", name: "موجودات البيت", count: totalQty, price: totalPrice, icon: "📦", colorClass: "bg-blue-100/50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800" });
    }

    // Car and Travel shortages are handled inside their respective tabs now!

    return summary;
  }, [shoppingList, familyNeeds]);

  const totalNeedsAmt = needs.filter(n => !n.isBought).reduce((s, n) => s + (n.estimatedPrice || 0), 0) + shoppingList.reduce((s, i) => s + (i.estimatedPrice || 0), 0);
  const totalDebtsForMe = debts.filter(d => d.type === "دين لي").reduce((s, d) => s + (d.amount - d.payments.reduce((ps, p) => ps + p.amount, 0)), 0);
  const totalDebtsOnMe = debts.filter(d => d.type === "دين علي").reduce((s, d) => s + (d.amount - d.payments.reduce((ps, p) => ps + p.amount, 0)), 0);

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

  const handleDeleteFuturePlan = (id: string) => {
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
    
    let remainingAmount = Number(fd.get("remaining"));
    if (isNaN(remainingAmount) || (fd.get("remaining") as string).trim() === "") {
        remainingAmount = totalAmount; // Default to total if empty
    }

    const totalMonths = Number(fd.get("totalMonths")) || undefined;
    const initialPaidMonths = Number(fd.get("initialPaidMonths")) || 0;
    const downPayment = Number(fd.get("downPayment")) || 0;
    
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

  const handleDeleteInstallment = (id: string) => {
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
    setPayBillData({ bill, amount: bill.amount.toString() });
  };

  const confirmPayBill = () => {
    if (!payBillData) return;
    const { bill, amount } = payBillData;
    
    const actualAmount = Number(amount);
    if (isNaN(actualAmount) || actualAmount <= 0) { toast.error("مبلغ غير صحيح"); return; }

    const expenseId = Date.now().toString();
    const expense: Expense = {
      id: expenseId, 
      name: `فاتورة: ${bill.name}`,
      category: bill.category, 
      amount: actualAmount,
      date: today(), 
      createdAt: new Date().toISOString(),
    };
    
    const updatedExpenses = [expense, ...expenses];
    setExpenses(updatedExpenses);
    syncToFirebase("expenses", updatedExpenses);

    const updatedBills = bills.map(x => x.id === bill.id ? { 
      ...x, 
      paid: true, 
      paidDates: [...x.paidDates, { date: new Date().toISOString(), amount: actualAmount, expenseId }] 
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
    
    const updatedBills = bills.map(x => x.id === bill.id ? { 
      ...x, 
      paid: false, 
      paidDates: x.paidDates.slice(0, -1) 
    } : x);
    setBills(updatedBills);
    syncToFirebase("bills", updatedBills);
    toast.success("تم التراجع عن دفع الفاتورة");
  };

  const handleDeleteBill = (id: string) => {
    const updated = bills.filter(x => x.id !== id);
    setBills(updated);
    syncToFirebase("bills", updated);
    toast.success("تم الحذف");
  };

  // ──────────────────────────────────────────
  // EXPENSE HANDLERS
  // ──────────────────────────────────────────
  const handleSaveExpense = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const isEdit = !!editExpense;
    const item: Expense = {
      id: isEdit ? editExpense!.id : Date.now().toString(),
      name: fd.get("name") as string,
      category: fd.get("category") as string,
      amount: Number(fd.get("amount")),
      date: fd.get("date") as string,
      createdAt: isEdit ? editExpense!.createdAt : new Date().toISOString(),
    };
    if (isEdit) {
      const updated = expenses.map(x => x.id === item.id ? item : x);
      setExpenses(updated);
      syncToFirebase("expenses", updated);
      toast.success("تم تعديل المصروف");
    } else {
      const updated = [item, ...expenses];
      setExpenses(updated);
      syncToFirebase("expenses", updated);
      toast.success("تم تسجيل المصروف");
    }
    e.currentTarget.reset();
    setExpNameInput("");
    setShowExpenseModal(false);
    setEditExpense(null);
  };

  const handleDeleteExpense = (id: string) => {
    const updated = expenses.filter(x => x.id !== id);
    setExpenses(updated);
    syncToFirebase("expenses", updated);
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

  const handleDeleteIncome = (id: string) => {
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

  const handleDeleteInventoryItem = (id: string) => {
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
  // NEEDS HANDLERS
  // ──────────────────────────────────────────
  const handleSaveNeed = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const isEdit = !!editNeed;
    
    const needName = fd.get("name") as string;
    const neededQty = Number(fd.get("quantity")) || 1;
    const estPrice = Number(fd.get("price")) || 0;
    const unit = fd.get("unit") as string || "قطعة";
    const category = fd.get("category") as string || "سوبر ماركت";
    const notes = fd.get("notes") as string || "";
    
    const source = editNeed?._source || (activeTab === "car" ? "car" : activeTab === "travel" ? "travel" : "inventory");

    if (source === "car") {
      let updated = [...carInventory];
      if (isEdit) {
        updated = updated.map(x => x.id === editNeed!.id ? { ...x, name: needName, neededQuantity: neededQty, estimatedPrice: estPrice, unit, category, notes } : x);
        toast.success("تم التعديل");
      } else {
        const existing = updated.find(i => i.name.trim().toLowerCase() === needName.trim().toLowerCase());
        if (existing) {
          existing.neededQuantity = (existing.neededQuantity || 0) + neededQty;
          existing.estimatedPrice = estPrice;
          if (notes) existing.notes = notes;
          toast.success("تم التحديث");
        } else {
          updated.push({ id: Date.now().toString(), name: needName, quantity: 0, neededQuantity: neededQty, threshold: 1, unit, estimatedPrice: estPrice, category, notes, createdAt: new Date().toISOString() });
          toast.success("تم إضافة الاحتياج");
        }
      }
      setCarInventory(updated);
      syncToFirebase("carInventory", updated);
    } else if (source === "travel") {
      let updated = [...travelInventory];
      if (isEdit) {
        updated = updated.map(x => x.id === editNeed!.id ? { ...x, name: needName, neededQuantity: neededQty, estimatedPrice: estPrice, unit, category, notes } : x);
        toast.success("تم التعديل");
      } else {
        const existing = updated.find(i => i.name.trim().toLowerCase() === needName.trim().toLowerCase());
        if (existing) {
          existing.neededQuantity = (existing.neededQuantity || 0) + neededQty;
          existing.estimatedPrice = estPrice;
          if (notes) existing.notes = notes;
          toast.success("تم التحديث");
        } else {
          updated.push({ id: Date.now().toString(), name: needName, quantity: 0, neededQuantity: neededQty, threshold: 1, unit, estimatedPrice: estPrice, category, notes, createdAt: new Date().toISOString() });
          toast.success("تم إضافة الاحتياج");
        }
      }
      setTravelInventory(updated);
      syncToFirebase("travelInventory", updated);
    } else {
      let updated = [...inventory];
      if (isEdit) {
        updated = updated.map(x => x.id === editNeed!.id ? { ...x, name: needName, neededQuantity: neededQty, estimatedPrice: estPrice, unit, category, notes } : x);
        toast.success("تم التعديل");
      } else {
        const existing = updated.find(i => i.name.trim().toLowerCase() === needName.trim().toLowerCase());
        if (existing) {
          existing.neededQuantity = (existing.neededQuantity || 0) + neededQty;
          existing.estimatedPrice = estPrice;
          if (notes) existing.notes = notes;
          toast.success("تم التحديث في النواقص");
        } else {
          updated.push({ id: Date.now().toString(), name: needName, quantity: 0, neededQuantity: neededQty, threshold: 1, unit, estimatedPrice: estPrice, category, notes, createdAt: new Date().toISOString() });
          toast.success("تم إضافة الاحتياج");
        }
      }
      setInventory(updated);
      syncToFirebase("inventory", updated);
    }
    
    e.currentTarget.reset();
    setShowNeedModal(false);
    setEditNeed(null);
    setNeedNameInput("");
  };

  const handleDeleteNeed = (id: string) => {
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
      const newExpense: Expense = {
        id: Date.now().toString() + Math.random().toString().slice(2, 6),
        name: modal.type === "family" ? `طلب ${modal.member}: ${modal.title}` : `شراء: ${modal.title}`,
        category: modal.category || "أخرى",
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

  const handleDeleteFamilyNeed = (id: string) => {
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

    const item: Debt = {
      id: isEdit ? editDebt!.id : Date.now().toString(),
      person: fd.get("person") as string,
      type: fd.get("type") as "دين لي" | "دين علي",
      amount: amount || 0,
      date: (fd.get("date") || fd.get("startDate")) as string,
      payments: initialPayments,
      createdAt: isEdit ? editDebt!.createdAt : new Date().toISOString(),
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
    } else {
      const updated = [item, ...debts];
      setDebts(updated);
      syncToFirebase("debts", updated);
      toast.success("تم إضافة الدين");
    }
    e.currentTarget.reset();
    setDebtNameInput("");
    setShowDebtModal(false);
    setEditDebt(null);
  };

  const handleDeleteDebt = (id: string) => {
    const updated = debts.filter(x => x.id !== id);
    setDebts(updated);
    syncToFirebase("debts", updated);
  };

  const handlePayDebt = (debt: Debt) => {
    const paymentsTotal = debt.payments.reduce((s, p) => s + p.amount, 0);
    const remaining = debt.amount - paymentsTotal;
    
    if (remaining <= 0) { toast.success("هذا الدين مسدد بالكامل"); return; }
    
    // إذا كان ديناً متقدماً (بنظام الأقساط)، يتم سداد القسط الشهري تلقائياً
    if (debt.monthlyInstallment && debt.totalMonths) {
      const paymentAmount = Math.min(debt.monthlyInstallment, remaining);
      const isOwedToMe = debt.type === "دين لي";
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
          category: "أخرى",
          amount: paymentAmount,
          date: today(),
          createdAt: new Date().toISOString(),
        };
        const updatedExpenses = [expense, ...expenses];
        setExpenses(updatedExpenses);
        syncToFirebase("expenses", updatedExpenses);
      }
      
      const payment = { date: new Date().toISOString(), amount: paymentAmount, expenseOrIncomeId: recordId };
      const updatedDebts = debts.map(x => x.id === debt.id ? {
        ...x,
        payments: [...x.payments, payment]
      } : x);
      setDebts(updatedDebts);
      syncToFirebase("debts", updatedDebts);
      toast.success(`تم سداد قسط ${debt.person} بنجاح`);
      return;
    }

    showPrompt("تسديد الدين", (amountStr) => {
      const actualAmount = Number(amountStr);
      if (isNaN(actualAmount) || actualAmount <= 0) { toast.error("مبلغ غير صحيح"); return; }
      if (actualAmount > remaining) { toast.error("لا يمكن تسجيل مبلغ أكبر من المتبقي"); return; }

      const isOwedToMe = debt.type === "دين لي";
      const recordId = Date.now().toString();
      
      // إذا كان "دين لي" (استرجاع أموال) -> يضاف للدخل
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
          category: "أخرى",
          amount: actualAmount,
          date: today(),
          createdAt: new Date().toISOString(),
        };
        const updatedExpenses = [expense, ...expenses];
        setExpenses(updatedExpenses);
        syncToFirebase("expenses", updatedExpenses);
      }
      
      const payment = { date: new Date().toISOString(), amount: actualAmount, expenseOrIncomeId: recordId };
      const updatedDebts = debts.map(x => x.id === debt.id ? {
        ...x,
        payments: [...x.payments, payment]
      } : x);
      setDebts(updatedDebts);
      syncToFirebase("debts", updatedDebts);
      toast.success("تم تسجيل الدفعة بنجاح");
    }, remaining.toString(), "أدخل المبلغ...", `أدخل المبلغ المسدد (المتبقي: ${remaining.toLocaleString("ar-IQ")}):`);
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

  const handleDeleteTrip = (id: string) => {
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
    toast.success("تم تسجيل المصروف");
    setShowTripExpenseModal(false);
  };

  const handleDeleteTripExpense = (id: string) => {
    showConfirm("حذف مصروف الرحلة", () => {
      const updated = travelExpenses.filter(e => e.id !== id);
      setTravelExpenses(updated);
      syncToFirebase("travelExpenses", updated);
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
      if (debt.type === "دين لي") {
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
  const totalShortages = shoppingList.length + familyNeeds.filter(n => n.status === "pending" && n.type !== "duty").length;
  const unpaidBillsCount = bills.filter(b => !isBillPaidThisCycle(b)).length;
  const delayedInstallmentsCount = installments.filter(i => isInstallmentOwedThisCycle(i)).length;
  const unsettledDebtsCount = debts.filter(d => { const total = d.payments.reduce((s, p) => s + p.amount, 0); return d.amount - total > 0; }).length;

  const tabs = [
    { key: "overview",      label: "نظرة عامة",          emoji: "🏠", icon: BarChart3, badge: 0 },
    { key: "income",        label: "الدخل",               emoji: "💵", icon: PiggyBank, badge: 0, amount: totalIncome },
    { key: "expenses",      label: "المصاريف",            emoji: "💸", icon: Wallet, badge: 0, amount: totalExpensesAmt },
    { key: "needs",         label: "النواقص",             emoji: "🛒", icon: ShoppingCart, badge: totalShortages },
    { key: "inventory",     label: "موجودات البيت",       emoji: "📦", icon: Package, badge: inventory.filter(i => (i.neededQuantity||0) > 0).length },
    { key: "bills",         label: "الفواتير",            emoji: "🧾", icon: Receipt, badge: unpaidBillsCount },
    { key: "installments",  label: "الأقساط والسلف",      emoji: "💳", icon: CreditCard, badge: delayedInstallmentsCount },
    { key: "debts",         label: "الديون",              emoji: "🏦", icon: Banknote, badge: unsettledDebtsCount },
    { key: "familyNeeds",   label: "العائلة",             emoji: "👨‍👩‍👧‍👦", icon: Users, badge: familyNeeds.filter(n => n.status === "pending" && n.type !== "duty").length },
    { key: "car",           label: "السيارة",             emoji: "🚗", icon: Car, badge: carInventory.filter(i => (i.neededQuantity||0) > 0).length },
    { key: "travel",        label: "السفر",               emoji: "✈️", icon: Plane, badge: travelInventory.filter(i => (i.neededQuantity||0) > 0).length },
    { key: "futurePlans",   label: "الخطط المستقبلية",   emoji: "🎯", icon: Target, badge: futurePlans.length },
  ] as any;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0D0A1A] pb-28 font-sans text-right" dir="rtl">

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
                className="flex-1 py-3 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-white rounded-xl font-bold transition"
              >
                {confirmConfig.cancelText || "إلغاء"}
              </button>
              <button
                onClick={() => {
                  confirmConfig.onConfirm();
                  setConfirmConfig(null);
                }}
                className={`flex-1 py-3 text-white rounded-xl font-bold shadow-lg transition ${
                  confirmConfig.isDestructive 
                    ? "bg-gradient-to-r from-red-600 to-rose-500 hover:opacity-90"
                    : "bg-gradient-to-r from-purple-600 to-indigo-500 hover:opacity-90"
                }`}
              >
                {confirmConfig.confirmText || "تأكيد"}
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

      {/* ═══════════════ HEADER ═══════════════ */}
      <div className="relative bg-gradient-to-br from-[#1a0533] via-[#2d1060] to-[#0f3460] pt-14 pb-6 px-5 overflow-hidden">
        {/* Blobs */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-purple-600/20 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/15 blur-[80px] rounded-full translate-y-1/2 -translate-x-1/4 pointer-events-none" />

        {/* Back + Title */}
        <div className="relative z-10 flex items-center gap-3 mb-5">
          <Link href="/admin" className="w-10 h-10 bg-white/15 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 hover:bg-white/25 transition">
            <ArrowRight className="w-5 h-5 text-white" />
          </Link>
          <div className="flex-1">
            <div className="flex flex-col gap-1.5">
              <span className="bg-white/20 text-white border border-white/30 px-3 py-1 rounded-full text-[11px] font-bold shadow-sm flex items-center justify-center gap-1.5 backdrop-blur-md w-max">
                <Home className="w-3.5 h-3.5" /> منزل حيدر وإيمان
              </span>
              <h1 className="text-2xl font-black text-white">إدارة ميزانية ومصاريف المنزل</h1>
            </div>
            <p className="text-purple-300 text-xs mt-0.5">
              {new Date().toLocaleDateString("ar-IQ", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
        </div>

        {/* Reminder Banner for 12th & 22nd */}
        {(new Date().getDate() === 12 || new Date().getDate() === 22) && (
          <div className="relative z-10 bg-red-600/90 backdrop-blur-md border border-red-400 rounded-2xl p-4 text-center mb-5 shadow-lg shadow-red-500/20">
            <div className="flex justify-center items-center gap-2 mb-1">
              <AlertCircle className="w-6 h-6 text-white animate-pulse" />
              <span className="text-white font-black text-lg">تذكير هام!</span>
            </div>
            <p className="text-red-100 font-bold text-sm">
              اليوم هو {new Date().getDate()} في الشهر. يرجى التأكد من تسديد الديون والأقساط المطلوبة لهذا الشهر.
            </p>
          </div>
        )}

        {/* Cycle Selector & Report Button */}
      </div>

      {/* ═══════════════ TABS AS APP ICONS ═══════════════ */}
      <div className="pt-4 px-2 sm:px-4">
        <div className="grid grid-cols-4 md:grid-cols-6 gap-x-2 gap-y-5 justify-items-center pb-2">
          {tabs.map((t: any) => {
            const isActive = activeTab === t.key;
            const hasBadge = (t.badge || 0) > 0;
            
            const getTabColors = (key: string) => {
              switch(key) {
                case "overview":      return { grad: "from-blue-500 to-indigo-600",   shadow: "shadow-blue-500/40",   ring: "ring-blue-500",   bg: "bg-blue-500/10 dark:bg-blue-500/20",   text: "text-blue-600 dark:text-blue-400" };
                case "income":        return { grad: "from-emerald-400 to-green-600", shadow: "shadow-emerald-500/40",ring: "ring-emerald-500",bg: "bg-emerald-500/10 dark:bg-emerald-500/20",text: "text-emerald-600 dark:text-emerald-400" };
                case "expenses":      return { grad: "from-rose-500 to-red-600",       shadow: "shadow-rose-500/40",   ring: "ring-rose-500",   bg: "bg-rose-500/10 dark:bg-rose-500/20",   text: "text-rose-600 dark:text-rose-400" };
                case "needs":         return { grad: "from-orange-500 to-amber-600",   shadow: "shadow-orange-500/40", ring: "ring-orange-500", bg: "bg-orange-500/10 dark:bg-orange-500/20", text: "text-orange-600 dark:text-orange-400" };
                case "inventory":     return { grad: "from-teal-500 to-emerald-600",   shadow: "shadow-teal-500/40",   ring: "ring-teal-500",   bg: "bg-teal-500/10 dark:bg-teal-500/20",   text: "text-teal-600 dark:text-teal-400" };
                case "bills":         return { grad: "from-amber-500 to-yellow-600",   shadow: "shadow-amber-500/40",  ring: "ring-amber-500",  bg: "bg-amber-500/10 dark:bg-amber-500/20",  text: "text-amber-600 dark:text-amber-400" };
                case "installments":  return { grad: "from-indigo-500 to-violet-600",  shadow: "shadow-indigo-500/40", ring: "ring-indigo-500", bg: "bg-indigo-500/10 dark:bg-indigo-500/20", text: "text-indigo-600 dark:text-indigo-400" };
                case "debts":         return { grad: "from-purple-500 to-fuchsia-600", shadow: "shadow-purple-500/40", ring: "ring-purple-500", bg: "bg-purple-500/10 dark:bg-purple-500/20", text: "text-purple-600 dark:text-purple-400" };
                case "familyNeeds":   return { grad: "from-pink-500 to-rose-500",      shadow: "shadow-pink-500/40",   ring: "ring-pink-500",   bg: "bg-pink-500/10 dark:bg-pink-500/20",   text: "text-pink-600 dark:text-pink-400" };
                case "car":           return { grad: "from-slate-600 to-gray-700",      shadow: "shadow-slate-500/40",  ring: "ring-slate-500",  bg: "bg-slate-500/10 dark:bg-slate-500/20",  text: "text-slate-600 dark:text-slate-400" };
                case "travel":        return { grad: "from-sky-500 to-blue-600",        shadow: "shadow-sky-500/40",    ring: "ring-sky-500",    bg: "bg-sky-500/10 dark:bg-sky-500/20",    text: "text-sky-600 dark:text-sky-400" };
                case "futurePlans":   return { grad: "from-violet-500 to-purple-700",   shadow: "shadow-violet-500/40", ring: "ring-violet-500", bg: "bg-violet-500/10 dark:bg-violet-500/20", text: "text-violet-600 dark:text-violet-400" };
                default:             return { grad: "from-gray-500 to-gray-600",       shadow: "shadow-gray-500/40",   ring: "ring-gray-500",   bg: "bg-gray-500/10",                        text: "text-gray-600" };
              }
            };

            const colors = getTabColors(t.key);

            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className="relative flex flex-col items-center gap-1.5 group outline-none w-full max-w-[80px]"
              >
                {/* Icon Box */}
                <div className={`relative flex items-center justify-center w-[58px] h-[58px] sm:w-[64px] sm:h-[64px] rounded-[1.3rem] sm:rounded-[1.4rem] transition-all duration-300 ${
                  isActive 
                    ? `bg-gradient-to-br ${colors.grad} text-white scale-110 z-10 shadow-lg ${colors.shadow} ring-2 ring-offset-2 ring-offset-[#f3f4f6] dark:ring-offset-[#09090b] ${colors.ring}` 
                    : `${colors.bg} border border-white/30 dark:border-zinc-800/60 ${colors.text} shadow-sm group-hover:scale-105 group-hover:shadow-md`
                }`}>
                  {/* Emoji Icon */}
                  <span className={`text-[22px] sm:text-[26px] transition-all duration-300 select-none ${
                    isActive ? 'drop-shadow-[0_1px_3px_rgba(0,0,0,0.3)] scale-110' : ''
                  }`} style={{ lineHeight: 1 }}>
                    {'emoji' in t ? (t as any).emoji : '📊'}
                  </span>
                  
                  {/* Badge */}
                  {( (t.badge || 0) > 0 || (t.amount !== undefined && t.amount > 0) ) && (
                    <span className={`absolute -top-2 -right-2 min-w-[22px] h-[22px] rounded-full text-[9px] sm:text-[10px] font-black flex items-center justify-center px-1.5 shadow-sm border-[1.5px] transition-all duration-300 ${
                      isActive 
                        ? "bg-white text-gray-900 border-transparent dark:bg-zinc-900 dark:text-white dark:border-zinc-700" 
                        : "bg-red-500 text-white border-white dark:border-zinc-900"
                    }`}>
                      {t.amount !== undefined 
                        ? (t.amount >= 1000000 ? (t.amount / 1000000).toFixed(1) + 'M' : t.amount >= 1000 ? (t.amount / 1000).toFixed(0) + 'K' : t.amount)
                        : (t.badge! > 99 ? '99+' : t.badge)}
                    </span>
                  )}
                </div>

                {/* Text Label */}
                <span className={`text-[10px] sm:text-[11px] transition-all duration-300 max-w-[68px] text-center leading-tight flex flex-col items-center gap-0.5 ${
                  isActive 
                    ? `font-black ${colors.text} translate-y-0.5` 
                    : "font-bold text-gray-500 dark:text-gray-400"
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
          if (activeTab === "overview" || activeTab === "futurePlans") return null;

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
          } else if (activeTab === "familyNeeds") {
            const memberAvailable = familyNeeds.filter(n => n.member === activeFamilyMember && n.status === "available");
            const memberPending = familyNeeds.filter(n => n.member === activeFamilyMember && n.status === "pending");
            const availVal = memberAvailable.reduce((s, n) => s + (Number(n.estimatedPrice) || 0), 0);
            const shortVal = memberPending.reduce((s, n) => s + (Number(n.estimatedPrice) || 0), 0);
            availCard = { title: `متوفر لـ (${activeFamilyMember})`, count: memberAvailable.length, countLabel: "طلب متوفر", value: availVal, color: "emerald", icon: "✨" };
            shortCard = { title: `نواقص لـ (${activeFamilyMember})`, count: memberPending.length, countLabel: "طلب معلق", value: shortVal, color: "orange", icon: "🛍️" };
          } else if (activeTab === "needs") {
            const totalAvailQty = inventory.reduce((s, i) => s + (Number(i.quantity) || 0), 0) + carInventory.reduce((s, i) => s + (Number(i.quantity) || 0), 0) + travelInventory.reduce((s, i) => s + (Number(i.quantity) || 0), 0) + familyNeeds.filter(n => n.status === "available").length;
            const totalShortQty = shoppingList.reduce((s, i) => s + (Number(i.neededQuantity) || 1), 0) + familyNeeds.filter(n => n.status === "pending").length;
            availCard = { title: "إجمالي المتوفر (منزل وعائلة)", count: totalAvailQty, countLabel: "عنصر متوفر", value: 0, color: "emerald", icon: "📦" };
            shortCard = { title: "إجمالي النواقص والاحتياجات", count: totalShortQty, countLabel: "طلب/عنصر ناقص", value: totalNeedsAmt, color: "orange", icon: "🚨" };
          } else if (activeTab === "debts") {
            const myDebtsCount = debts.filter(d => d.type === "دين لي").length;
            const onMeDebtsCount = debts.filter(d => d.type === "دين علي").length;
            availCard = { title: "ديون لي (عند الناس)", count: myDebtsCount, countLabel: "دين", value: totalDebtsForMe, color: "emerald", icon: "📈" };
            shortCard = { title: "ديون علي (مطلوبة مني)", count: onMeDebtsCount, countLabel: "دين", value: totalDebtsOnMe, color: "orange", icon: "📉" };
          } else if (activeTab === "expenses") {
            const currentExps = expenses.filter(e => isInCycle(e.date));
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
              <div className="bg-gradient-to-br from-emerald-950/80 via-zinc-900 to-zinc-900 dark:from-emerald-950/50 dark:to-zinc-900/90 border border-emerald-500/30 rounded-3xl p-3 sm:p-4 text-white shadow-lg relative overflow-hidden flex flex-col justify-between">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1.5">
                    <span>{availCard.icon}</span>
                    <span>{availCard.title}</span>
                  </span>
                  <div className="text-left">
                    <span className="text-2xl font-black text-white">{availCard.count}</span>
                    <span className="text-[10px] text-gray-400 block font-bold">{availCard.countLabel}</span>
                  </div>
                </div>
                {availCard.value !== 0 ? (
                  <div className="mt-3 pt-2 border-t border-emerald-500/10 flex justify-between items-baseline">
                    <span className="text-[11px] font-bold text-gray-400">القيمة التقديرية / الرصيد:</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-black text-emerald-300">{fmt(availCard.value)}</span>
                      <span className="text-[10px] text-emerald-400 font-bold">د.ع</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 pt-2 border-t border-emerald-500/10 flex justify-between items-baseline">
                    <span className="text-[11px] font-bold text-gray-500">الحالة:</span>
                    <span className="text-xs font-bold text-emerald-400">محدث أولاً بأول</span>
                  </div>
                )}
              </div>

              {/* Card 2: النواقص / المطلوب */}
              <div className="bg-gradient-to-br from-red-950/80 via-zinc-900 to-zinc-900 dark:from-red-950/50 dark:to-zinc-900/90 border border-red-500/30 rounded-3xl p-3 sm:p-4 text-white shadow-lg relative overflow-hidden flex flex-col justify-between">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-black text-red-400 bg-red-500/10 dark:bg-red-500/20 px-3 py-1 rounded-full border border-red-500/30 flex items-center gap-1.5">
                    <span>{shortCard.icon}</span>
                    <span>{shortCard.title}</span>
                  </span>
                  <div className="text-left">
                    <span className="text-2xl font-black text-white">{shortCard.count}</span>
                    <span className="text-[10px] text-gray-400 block font-bold">{shortCard.countLabel}</span>
                  </div>
                </div>
                {shortCard.value !== 0 ? (
                  <div className="mt-3 pt-2 border-t border-red-500/10 flex justify-between items-baseline">
                    <span className="text-[11px] font-bold text-gray-400">التكلفة / المطلوب:</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-black text-red-300">{fmt(shortCard.value)}</span>
                      <span className="text-[10px] text-red-400 font-bold">د.ع</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 pt-2 border-t border-red-500/10 flex justify-between items-baseline">
                    <span className="text-[11px] font-bold text-gray-500">الحالة:</span>
                    <span className="text-xs font-bold text-green-400">لا توجد نواقص معلقة 🎉</span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}


        {/* ═══════════════ OVERVIEW TAB ═══════════════ */}
        {activeTab === "overview" && (
          <div className="space-y-4">

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "مصروف", icon: TrendingDown, color: "from-rose-500 to-pink-500", action: () => setShowExpenseModal(true) },
                { label: "واجبات عائلة", icon: Users, color: "from-purple-500 to-indigo-500", action: () => setShowFamilyNeedModal(true) },
                { label: "احتياج ونواقص", icon: ShoppingCart, color: "from-orange-500 to-amber-500", action: () => setShowNeedModal(true) },
                { label: "قسط / سلفة", icon: CreditCard, color: "from-indigo-500 to-violet-500", action: () => setShowInstallmentModal(true) },
                { label: "فاتورة", icon: Receipt, color: "from-amber-500 to-yellow-500", action: () => setShowBillModal(true) },
                { label: "إضافة دخل", icon: TrendingUp, color: "from-emerald-500 to-teal-500", action: () => setShowIncomeModal(true) },
                { label: "دين", icon: Banknote, color: "from-cyan-500 to-blue-500", action: () => setShowDebtModal(true) },
                { label: "خطة مستقبلية", icon: Target, color: "from-fuchsia-500 to-pink-500", action: () => setShowFuturePlanModal(true) },
                { label: "رحلة ومصاريف", icon: Plane, color: "from-sky-500 to-blue-500", action: () => setShowTravelShortcutModal(true) },
              ].map(q => {
                const Icon = q.icon;
                return (
                  <button key={q.label} onClick={q.action}
                    className={`bg-gradient-to-br ${q.color} rounded-2xl p-3 text-white shadow-lg active:scale-95 transition flex flex-col items-center gap-1.5`}>
                    <Icon className="w-5 h-5" />
                    <span className="text-[10px] font-black text-center">{q.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Alerts Banner */}
            {(unpaidBillsCount > 0 || delayedInstallmentsCount > 0 || totalShortages > 0) && (
              <div className="bg-gradient-to-br from-rose-500 to-orange-500 rounded-3xl p-5 shadow-[0_8px_30px_rgb(244,63,94,0.3)] space-y-3 relative overflow-hidden">
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

            <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/15 blur-[60px] rounded-full pointer-events-none" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/20 blur-[80px] rounded-full pointer-events-none" />
            {/* Financial Cycle moved from Header */}
          <div className="relative bg-gradient-to-br from-[#1a0533] via-[#2d1060] to-[#0f3460] rounded-[2rem] p-5 shadow-2xl overflow-hidden mt-6 mb-4">
            <div className="relative z-10 mb-4 bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/20 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-start">
            <h3 className="font-bold text-white text-sm">الدورة المالية:</h3>
            <select
              value={selectedCycleId}
              onChange={(e) => setSelectedCycleId(e.target.value)}
              className="bg-black/30 border border-white/20 rounded-xl text-xs font-bold text-white focus:ring-2 focus:ring-purple-500 p-2 outline-none"
            >
              {cycles.map(c => (
                <option key={c.id} value={c.id} className="text-black">{c.label}</option>
              ))}
            </select>
          </div>
          
          <button
            onClick={() => {
              if (!confirm("هل أنت متأكد من إنهاء الدورة المالية الحالية يدوياً وبدء دورة جديدة؟ هذا سيؤدي إلى نقل الميزانية المتبقية إلى الدورة الجديدة.")) return;
              
              const newCycleStarts = [...(settings?.manualCycleStarts || []), today()];
              setSettings({ ...settings, manualCycleStarts: newCycleStarts });
              syncToFirebase("settings", { ...settings, manualCycleStarts: newCycleStarts });
            }}
            className="w-full md:w-auto bg-blue-600/50 hover:bg-blue-600 border border-blue-400/50 text-white rounded-xl px-4 py-2 text-xs font-bold transition flex items-center justify-center gap-2"
          >
            إنهاء الدورة يدوياً
          </button>
        </div>
        
        {/* Helper Alert if user is confused about missing data on new cycle */}
        {(expenses.length > 0 || incomes.length > 0) && totalExpensesAmt === 0 && totalIncome === 0 && selectedCycleId === cycles[0]?.id && (
          <div className="relative z-10 bg-indigo-500/20 backdrop-blur-md border border-indigo-400/50 rounded-2xl p-4 text-center mb-5 shadow-lg shadow-indigo-500/20 animate-pulse">
            <div className="flex justify-center items-center gap-2 mb-1">
              <span className="text-indigo-100 font-black text-sm">مرحباً! لقد بدأت دورة مالية جديدة فارغة 🗓️</span>
            </div>
            <p className="text-indigo-200/80 font-bold text-xs mt-1">
              أنت الآن في دورة شهرية جديدة. لرؤية مصاريفك وإدخالاتك السابقة، قم بتغيير الدورة المالية من القائمة المنسدلة في الأعلى (اختر الدورة السابقة).
            </p>
          </div>
        )}

        {/* Professional Summary Cards */}

        {/* Professional Summary Cards */}
        <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-3">
          
          {/* Main Balance Card (Spans Full Width) */}
          <div className="col-span-2 md:col-span-4 bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 backdrop-blur-xl rounded-[2rem] p-6 border border-white/20 shadow-2xl relative overflow-hidden group">
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-purple-500/30 rounded-full blur-3xl pointer-events-none group-hover:bg-purple-500/40 transition-colors duration-700" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-500/30 rounded-full blur-3xl pointer-events-none group-hover:bg-indigo-500/40 transition-colors duration-700" />
            
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md">
                    <Wallet className="w-5 h-5 text-purple-200" />
                  </div>
                  <span className="text-purple-100 text-sm font-black tracking-wide">الرصيد الصافي للشهر</span>
                </div>
                <div className={`text-4xl md:text-5xl font-black tracking-tight ${balance < 0 ? "text-rose-400 drop-shadow-[0_0_15px_rgba(251,113,133,0.3)]" : "text-emerald-300 drop-shadow-[0_0_15px_rgba(110,231,183,0.3)]"}`}>
                  {fmt(balance)} <span className="text-xl md:text-2xl font-bold text-white/50">د.ع</span>
                </div>
              </div>
              
              <div className="flex flex-col gap-2 w-full md:w-auto">
                {balance < 0 && (
                  <div className="flex items-center gap-2 bg-rose-500/20 backdrop-blur-md rounded-2xl px-4 py-3 border border-rose-500/30 shadow-inner">
                    <AlertCircle className="w-5 h-5 text-rose-400" />
                    <span className="text-rose-200 text-xs font-black">تجاوزت الميزانية المحددة!</span>
                  </div>
                )}
                {balance >= 0 && balance < unpaidObligations && (
                  <div className="flex items-center gap-2 bg-amber-500/20 backdrop-blur-md rounded-2xl px-4 py-3 border border-amber-500/30 shadow-inner">
                    <AlertCircle className="w-5 h-5 text-amber-400" />
                    <span className="text-amber-200 text-xs font-black">تحذير: الرصيد لا يكفي لتسديد الالتزامات ({fmt(unpaidObligations)} د.ع)</span>
                  </div>
                )}
                {balance >= unpaidObligations && (
                  <div className="flex items-center gap-2 bg-emerald-500/20 backdrop-blur-md rounded-2xl px-4 py-3 border border-emerald-500/30 shadow-inner">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span className="text-emerald-200 text-xs font-black">الرصيد يغطي جميع الالتزامات بنجاح</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="bg-white/5 hover:bg-white/10 backdrop-blur-md rounded-3xl p-4 border border-white/10 transition-colors duration-300 flex flex-col justify-between group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-colors duration-500" />
            <div className="flex items-center justify-between mb-3 relative z-10">
              <span className="text-emerald-200 text-[10px] md:text-xs font-bold">الدخل الكلي</span>
              <div className="p-1.5 bg-emerald-500/20 rounded-lg"><TrendingUp className="w-3.5 h-3.5 text-emerald-400" /></div>
            </div>
            <div className="text-lg md:text-xl font-black text-white relative z-10">{fmt(totalIncome)}</div>
          </div>

          <div className="bg-white/5 hover:bg-white/10 backdrop-blur-md rounded-3xl p-4 border border-white/10 transition-colors duration-300 flex flex-col justify-between group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/10 rounded-full blur-2xl group-hover:bg-rose-500/20 transition-colors duration-500" />
            <div className="flex items-center justify-between mb-3 relative z-10">
              <span className="text-rose-200 text-[10px] md:text-xs font-bold">المصاريف الكلية</span>
              <div className="p-1.5 bg-rose-500/20 rounded-lg"><TrendingDown className="w-3.5 h-3.5 text-rose-400" /></div>
            </div>
            <div className="text-lg md:text-xl font-black text-white relative z-10">{fmt(totalExpensesAmt)}</div>
          </div>

          <div className="bg-white/5 hover:bg-white/10 backdrop-blur-md rounded-3xl p-4 border border-white/10 transition-colors duration-300 flex flex-col justify-between group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-colors duration-500" />
            <div className="flex items-center justify-between mb-3 relative z-10">
              <span className="text-indigo-200 text-[10px] md:text-xs font-bold">الأقساط الشهرية</span>
              <div className="p-1.5 bg-indigo-500/20 rounded-lg"><CreditCard className="w-3.5 h-3.5 text-indigo-400" /></div>
            </div>
            <div className="text-lg md:text-xl font-black text-white relative z-10">{fmt(totalInstallmentMonthly)}</div>
          </div>

          <div className="bg-white/5 hover:bg-white/10 backdrop-blur-md rounded-3xl p-4 border border-white/10 transition-colors duration-300 flex flex-col justify-between group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-colors duration-500" />
            <div className="flex items-center justify-between mb-3 relative z-10">
              <span className="text-amber-200 text-[10px] md:text-xs font-bold">الفواتير الثابتة</span>
              <div className="p-1.5 bg-amber-500/20 rounded-lg"><Receipt className="w-3.5 h-3.5 text-amber-400" /></div>
            </div>
            <div className="text-lg md:text-xl font-black text-white relative z-10">{fmt(totalBillsAmt)}</div>
          </div>

          {/* Complex Mini-Cards */}
          <div className="col-span-2 md:col-span-2 bg-gradient-to-br from-cyan-900/40 to-blue-900/40 backdrop-blur-md rounded-3xl p-4 border border-cyan-500/20 flex flex-col justify-center shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                <span className="text-cyan-200 text-xs font-bold">لك (فائض / ديون خارجية)</span>
              </div>
              <span className="text-base font-black text-white">{fmt(totalDebtsForMe)} <span className="text-[10px] text-cyan-300/50">د.ع</span></span>
            </div>
            <div className="w-full h-px bg-cyan-400/10 my-3"></div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-rose-400 rounded-full" />
                <span className="text-rose-200 text-xs font-bold">عليك (ديون غير مسددة)</span>
              </div>
              <span className="text-base font-black text-white">{fmt(totalDebtsOnMe)} <span className="text-[10px] text-rose-300/50">د.ع</span></span>
            </div>
          </div>

          <div className="col-span-2 md:col-span-2 bg-gradient-to-br from-orange-900/40 to-red-900/40 backdrop-blur-md rounded-3xl p-4 border border-orange-500/20 flex flex-col justify-center shadow-lg">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-orange-400" />
                <span className="text-orange-200 text-xs font-bold">الاحتياجات والنواقص (تقديري)</span>
              </div>
              <span className="text-base font-black text-white">{fmt(totalNeedsAmt)} <span className="text-[10px] text-orange-300/50">د.ع</span></span>
            </div>
            {shoppingList.length > 0 && (
              <div className="mt-2 text-[10px] text-orange-300/80 font-bold bg-black/20 rounded-xl p-2 flex items-center justify-between border border-white/5">
                <span>{shoppingList.length} مواد مفقودة من موجودات البيت</span>
                <button onClick={() => setActiveTab("needs")} className="bg-orange-500/20 hover:bg-orange-500/40 px-2 py-1 rounded-lg transition text-white">الذهاب للمخزن</button>
              </div>
            )}
          </div>

          {/* UPCOMING OBLIGATIONS SUMMARY */}
          <div className="col-span-2 md:col-span-4 mt-2 bg-gradient-to-br from-gray-900/80 to-black backdrop-blur-xl rounded-[2rem] p-5 border border-white/10 shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 mix-blend-overlay pointer-events-none" />
            <h3 className="text-white font-black mb-4 flex items-center gap-2 text-sm md:text-base border-b border-white/10 pb-3">
              <AlertCircle className="w-5 h-5 text-purple-400" />
              سجل الالتزامات والمصاريف (ديون، فواتير، أقساط، ومصاريف)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex justify-between items-center bg-white/5 hover:bg-white/10 transition-colors p-3.5 rounded-2xl border border-white/5 shadow-sm group">
                <span className="text-gray-400 group-hover:text-amber-200 transition-colors text-xs font-bold flex items-center gap-2">
                  <div className="p-1.5 bg-amber-500/10 rounded-lg"><Receipt className="w-4 h-4 text-amber-400"/></div> فواتير غير مسددة
                </span>
                <span className="text-white font-black text-sm">{fmt(unpaidBillsAmt)} <span className="text-[10px] text-gray-500">د.ع</span></span>
              </div>
              <div className="flex justify-between items-center bg-white/5 hover:bg-white/10 transition-colors p-3.5 rounded-2xl border border-white/5 shadow-sm group">
                <span className="text-gray-400 group-hover:text-indigo-200 transition-colors text-xs font-bold flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-500/10 rounded-lg"><CreditCard className="w-4 h-4 text-indigo-400"/></div> أقساط مطلوبة الدفع
                </span>
                <span className="text-white font-black text-sm">{fmt(unpaidInstallmentsMonthly)} <span className="text-[10px] text-gray-500">د.ع</span></span>
              </div>
              <div className="flex justify-between items-center bg-white/5 hover:bg-white/10 transition-colors p-3.5 rounded-2xl border border-white/5 shadow-sm group">
                <span className="text-gray-400 group-hover:text-rose-200 transition-colors text-xs font-bold flex items-center gap-2">
                  <div className="p-1.5 bg-rose-500/10 rounded-lg"><Banknote className="w-4 h-4 text-rose-400"/></div> ديون عليك (غير مسددة)
                </span>
                <span className="text-white font-black text-sm">{fmt(totalDebtsOnMe)} <span className="text-[10px] text-gray-500">د.ع</span></span>
              </div>
              <div className="flex justify-between items-center bg-white/5 hover:bg-white/10 transition-colors p-3.5 rounded-2xl border border-white/5 shadow-sm group">
                <span className="text-gray-400 group-hover:text-emerald-200 transition-colors text-xs font-bold flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-500/10 rounded-lg"><ShoppingCart className="w-4 h-4 text-emerald-400"/></div> مصاريف هذا الشهر
                </span>
                <span className="text-white font-black text-sm">{fmt(totalExpensesAmt)} <span className="text-[10px] text-gray-500">د.ع</span></span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center bg-rose-500/10 -mx-5 -mb-5 px-5 py-4">
              <span className="text-rose-200 font-black text-sm flex items-center gap-2">
                <Target className="w-5 h-5 text-rose-400" />
                المجموع الكلي المطلوب:
              </span>
              <span className="text-xl md:text-2xl font-black text-white drop-shadow-md">{fmt(unpaidBillsAmt + unpaidInstallmentsMonthly + totalDebtsOnMe + totalExpensesAmt)} <span className="text-xs text-rose-300">د.ع</span></span>
            </div>
          </div>
        </div>
          </div>
            {/* ══════════════════════════════════════════
                PREMIUM BUDGET BREAKDOWN SECTION
            ══════════════════════════════════════════ */}
            {(() => {
              const homeExpenses = totalExpensesAmt;
              const debtRepayment = debts.filter(d => d.type === "دين علي")
                .reduce((s, d) => s + d.payments.filter(p => isInCycle(p.date)).reduce((ps, p) => ps + p.amount, 0), 0);
              const monthlyInstTotal = installments.filter(i => i.remainingAmount > 0).reduce((s, i) => s + i.monthlyInstallment, 0);
              const billsTotal = totalBillsAmt;
              const totalOutgoing = homeExpenses + debtRepayment + monthlyInstTotal + billsTotal;
              const remaining = totalIncome - totalOutgoing;
              const spendPct = totalIncome > 0 ? Math.min(100, (homeExpenses / totalIncome) * 100) : 0;
              const debtPct = totalIncome > 0 ? Math.min(100, (debtRepayment / totalIncome) * 100) : 0;
              const instPct = totalIncome > 0 ? Math.min(100, (monthlyInstTotal / totalIncome) * 100) : 0;
              const billsPct = totalIncome > 0 ? Math.min(100, (billsTotal / totalIncome) * 100) : 0;

              const sections = [
                {
                  key: "expenses",
                  label: "مصاريف المنزل",
                  sublabel: "مشتريات، طعام، بنزين وغيرها",
                  emoji: "🏠",
                  value: homeExpenses,
                  pct: spendPct,
                  barColor: "from-rose-500 to-pink-500",
                  bgColor: "from-rose-950/60 to-zinc-900",
                  borderColor: "border-rose-500/20",
                  textColor: "text-rose-400",
                  action: () => setActiveTab("expenses"),
                },
                {
                  key: "debts",
                  label: "سداد الديون",
                  sublabel: "المدفوع فعلاً هذه الدورة",
                  emoji: "🤝",
                  value: debtRepayment,
                  pct: debtPct,
                  barColor: "from-cyan-500 to-blue-500",
                  bgColor: "from-cyan-950/60 to-zinc-900",
                  borderColor: "border-cyan-500/20",
                  textColor: "text-cyan-400",
                  action: () => setActiveTab("debts"),
                },
                {
                  key: "installments",
                  label: "الأقساط والسلف",
                  sublabel: "إجمالي الأقساط الشهرية",
                  emoji: "💳",
                  value: monthlyInstTotal,
                  pct: instPct,
                  barColor: "from-violet-500 to-indigo-500",
                  bgColor: "from-violet-950/60 to-zinc-900",
                  borderColor: "border-violet-500/20",
                  textColor: "text-violet-400",
                  action: () => setActiveTab("installments"),
                },
                {
                  key: "bills",
                  label: "الفواتير الثابتة",
                  sublabel: `${bills.filter(b => !isBillPaidThisCycle(b)).length} فاتورة غير مدفوعة`,
                  emoji: "🧾",
                  value: billsTotal,
                  pct: billsPct,
                  barColor: "from-amber-500 to-yellow-500",
                  bgColor: "from-amber-950/60 to-zinc-900",
                  borderColor: "border-amber-500/20",
                  textColor: "text-amber-400",
                  action: () => setActiveTab("bills"),
                },
              ];

              return (
                <div className="space-y-3">
                  {/* Section Header */}
                  <div className="flex items-center justify-between">
                    <h2 className="font-black text-gray-800 dark:text-white flex items-center gap-2 text-sm">
                      <span className="text-lg">📊</span>
                      توزيع الميزانية الشهرية
                    </h2>
                    <span className="text-xs font-bold text-gray-400 bg-gray-100 dark:bg-zinc-800 px-3 py-1 rounded-full">
                      دخل: {fmt(totalIncome)} د.ع
                    </span>
                  </div>

                  {/* Budget Category Cards */}
                  {sections.map((sec) => (
                    <button
                      key={sec.key}
                      onClick={sec.action}
                      className={`w-full bg-gradient-to-br ${sec.bgColor} border ${sec.borderColor} rounded-3xl p-4 text-right shadow-lg relative overflow-hidden active:scale-[0.98] transition-all duration-200 group`}
                    >
                      {/* Glow */}
                      <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${sec.barColor} opacity-10 rounded-full blur-2xl pointer-events-none -mr-8 -mt-8 group-hover:opacity-20 transition-opacity duration-500`} />

                      <div className="relative z-10">
                        {/* Top Row */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{sec.emoji}</span>
                            <div>
                              <div className="font-black text-white text-sm">{sec.label}</div>
                              <div className={`text-[10px] font-bold ${sec.textColor}`}>{sec.sublabel}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-black text-white">{fmt(sec.value)}</div>
                            <div className={`text-[10px] font-bold ${sec.textColor}`}>د.ع</div>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="h-2 bg-black/30 rounded-full overflow-hidden">
                          <div
                            className={`h-full bg-gradient-to-l ${sec.barColor} rounded-full transition-all duration-700`}
                            style={{ width: `${sec.pct}%` }}
                          />
                        </div>
                        <div className={`text-[10px] font-bold ${sec.textColor} mt-1 text-left`}>
                          {sec.pct.toFixed(1)}% من الدخل
                        </div>
                      </div>
                    </button>
                  ))}

                  {/* Grand Total Summary Card */}
                  <div className={`rounded-3xl p-5 border shadow-2xl relative overflow-hidden ${
                    remaining >= 0
                      ? "bg-gradient-to-br from-emerald-900/80 to-zinc-900 border-emerald-500/30"
                      : "bg-gradient-to-br from-rose-900/80 to-zinc-900 border-rose-500/30"
                  }`}>
                    {/* Decorative BG */}
                    <div className={`absolute inset-0 opacity-5 pointer-events-none`}
                      style={{
                        backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px)",
                        backgroundSize: "24px 24px"
                      }} />

                    <div className="relative z-10">
                      {/* Totals */}
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-black/20 rounded-2xl p-3 border border-white/5">
                          <div className="text-[10px] font-bold text-gray-400 mb-1">إجمالي الصادر</div>
                          <div className="text-lg font-black text-white">{fmt(totalOutgoing)}</div>
                          <div className="text-[10px] text-gray-500 font-bold">د.ع / الشهر</div>
                        </div>
                        <div className={`rounded-2xl p-3 border ${
                          remaining >= 0
                            ? "bg-emerald-500/10 border-emerald-500/20"
                            : "bg-rose-500/10 border-rose-500/20"
                        }`}>
                          <div className="text-[10px] font-bold text-gray-400 mb-1">{remaining >= 0 ? "المتبقي" : "العجز"}</div>
                          <div className={`text-lg font-black ${remaining >= 0 ? "text-emerald-300" : "text-rose-400"}`}>
                            {fmt(Math.abs(remaining))}
                          </div>
                          <div className={`text-[10px] font-bold ${remaining >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                            {remaining >= 0 ? "فائض 🎉" : "عجز ⚠️"}
                          </div>
                        </div>
                      </div>

                      {/* Combined progress bar showing all spending */}
                      {totalIncome > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-gray-400">توزيع الدخل الكلي</span>
                            <span className="text-xs font-black text-white">{fmt(totalIncome)} د.ع</span>
                          </div>
                          <div className="h-4 bg-black/40 rounded-full overflow-hidden flex">
                            {spendPct > 0 && (
                              <div className="h-full bg-gradient-to-r from-rose-600 to-pink-500 transition-all duration-700" style={{ width: `${spendPct}%` }} title="مصاريف" />
                            )}
                            {debtPct > 0 && (
                              <div className="h-full bg-gradient-to-r from-cyan-600 to-blue-500 transition-all duration-700" style={{ width: `${debtPct}%` }} title="ديون" />
                            )}
                            {instPct > 0 && (
                              <div className="h-full bg-gradient-to-r from-violet-600 to-indigo-500 transition-all duration-700" style={{ width: `${instPct}%` }} title="أقساط" />
                            )}
                            {billsPct > 0 && (
                              <div className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-700" style={{ width: `${billsPct}%` }} title="فواتير" />
                            )}
                          </div>
                          {/* Legend */}
                          <div className="flex flex-wrap gap-2 mt-2">
                            {[
                              { label: "مصاريف", color: "bg-rose-500", pct: spendPct },
                              { label: "ديون", color: "bg-cyan-500", pct: debtPct },
                              { label: "أقساط", color: "bg-violet-500", pct: instPct },
                              { label: "فواتير", color: "bg-amber-500", pct: billsPct },
                            ].filter(l => l.pct > 0).map(l => (
                              <div key={l.label} className="flex items-center gap-1">
                                <div className={`w-2 h-2 rounded-full ${l.color}`} />
                                <span className="text-[10px] font-bold text-gray-400">{l.label} {l.pct.toFixed(0)}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ══════════════════════════════════════════
                COMPREHENSIVE FINANCIAL STUDY (دراسة الوضع المالي)
            ══════════════════════════════════════════ */}
            {(() => {
              // 1. Total Installments remaining
              const totalInstallmentsOwed = installments.reduce((sum, i) => sum + (Number(i.remainingAmount) || 0), 0);
              
              // 2. Total Debts owed
              const totalDebtsOwed = debts.filter(d => d.type === "دين علي").reduce((sum, d) => {
                const totalPaid = d.payments?.reduce((ps, p) => ps + p.amount, 0) || 0;
                return sum + Math.max(0, d.amount - totalPaid);
              }, 0);

              // 3. Total Shortages
              const familyNeedsCost = familyNeeds.filter(n => n.status === "pending" && n.type !== "duty").reduce((sum, n) => sum + (Number(n.estimatedPrice) || 0), 0);
              const carNeedsCost = carInventory.filter(i => (i.neededQuantity || 0) > 0).reduce((sum, i) => sum + ((Number(i.neededQuantity) || 1) * (Number(i.estimatedPrice) || 0)), 0);
              const travelNeedsCost = travelInventory.filter(i => (i.neededQuantity || 0) > 0).reduce((sum, i) => sum + ((Number(i.neededQuantity) || 1) * (Number(i.estimatedPrice) || 0)), 0);
              const homeNeedsCost = inventory.filter(i => (i.neededQuantity || 0) > 0).reduce((sum, i) => sum + ((Number(i.neededQuantity) || 1) * (Number(i.estimatedPrice) || 0)), 0);
              
              // 4. Future Plans
              const futurePlansCost = futurePlans.filter(p => p.savedAmount < p.targetAmount).reduce((sum, p) => sum + (Number(p.targetAmount) - Number(p.savedAmount)), 0);

              const totalNeedsCost = familyNeedsCost + carNeedsCost + travelNeedsCost + homeNeedsCost + futurePlansCost;
              const grandTotalNeeded = totalInstallmentsOwed + totalDebtsOwed + totalNeedsCost;

              // Current budget metrics
              const homeExpenses = totalExpensesAmt;
              const debtRepayment = debts.filter(d => d.type === "دين علي").reduce((s, d) => s + (d.payments?.filter(p => isInCycle(p.date)).reduce((ps, p) => ps + p.amount, 0) || 0), 0);
              const monthlyInstTotal = installments.filter(i => i.remainingAmount > 0).reduce((s, i) => s + i.monthlyInstallment, 0);
              const totalOutgoing = homeExpenses + debtRepayment + monthlyInstTotal + totalBillsAmt;
              const monthlySavings = Math.max(0, totalIncome - totalOutgoing);
              
              const monthsToPayOff = monthlySavings > 0 ? Math.ceil(grandTotalNeeded / monthlySavings) : 0;
              const yearsToPayOff = (monthsToPayOff / 12).toFixed(1);

              return (
                <div className="bg-gradient-to-b from-[#1a1333] to-[#0d0a1a] rounded-3xl p-5 border border-purple-500/20 shadow-2xl relative overflow-hidden mt-6 mb-6">
                  {/* Decorative */}
                  <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
                  
                  <div className="relative z-10">
                    <h2 className="font-black text-white text-lg mb-4 flex items-center gap-2">
                      <Target className="w-5 h-5 text-purple-400" />
                      الدراسة المالية الشاملة
                    </h2>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                      <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                        <div className="text-[10px] text-gray-400 font-bold mb-1">الديون والسلف المتبقية</div>
                        <div className="text-sm font-black text-rose-400">{fmt(totalDebtsOwed)}</div>
                      </div>
                      <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                        <div className="text-[10px] text-gray-400 font-bold mb-1">الأقساط المتبقية</div>
                        <div className="text-sm font-black text-orange-400">{fmt(totalInstallmentsOwed)}</div>
                      </div>
                      <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                        <div className="text-[10px] text-gray-400 font-bold mb-1">إجمالي تكلفة النواقص</div>
                        <div className="text-sm font-black text-amber-400">{fmt(totalNeedsCost)}</div>
                      </div>
                      <div className="bg-purple-500/20 rounded-2xl p-3 border border-purple-500/30">
                        <div className="text-[10px] text-purple-200 font-bold mb-1">الاحتياج الكلي</div>
                        <div className="text-lg font-black text-white drop-shadow-md">{fmt(grandTotalNeeded)}</div>
                      </div>
                    </div>

                    <div className="bg-black/40 rounded-2xl p-4 border border-white/5">
                      <h3 className="text-sm font-black text-white mb-2 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        خطة السداد والتسوية
                      </h3>
                      <p className="text-xs text-gray-300 leading-relaxed font-medium">
                        بناءً على الفائض المالي الحالي في هذه الدورة والذي يبلغ <strong className="text-emerald-400">{fmt(monthlySavings)} د.ع</strong>، 
                        {monthlySavings > 0 ? (
                          <>
                            ستحتاج تقريباً إلى <strong className="text-white">{monthsToPayOff} شهر</strong> (حوالي {yearsToPayOff} سنة) 
                            لتسديد كافة الديون والأقساط وتوفير جميع النواقص والخطط المستقبلية بالكامل.
                          </>
                        ) : (
                          <span className="text-rose-400">
                            لا يوجد فائض في ميزانية هذه الدورة لتسديد الديون المتراكمة أو شراء النواقص. يجب تقليل المصاريف لزيادة الفائض.
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}


            {/* Spending Progress vs Income */}
            {totalIncome > 0 && (
              <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-gray-100 dark:border-zinc-800 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-black text-gray-800 dark:text-white text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4 text-purple-500" />
                    استهلاك الميزانية
                  </h2>
                  <span className="text-xs font-bold text-gray-500">{totalIncome > 0 ? ((totalExpensesAmt / totalIncome) * 100).toFixed(1) : 0}%</span>
                </div>
                <div className="h-3 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${totalExpensesAmt / totalIncome > 0.9 ? 'bg-gradient-to-l from-red-500 to-rose-600' : totalExpensesAmt / totalIncome > 0.7 ? 'bg-gradient-to-l from-amber-500 to-orange-500' : 'bg-gradient-to-l from-emerald-500 to-teal-500'}`}
                    style={{ width: `${Math.min(100, (totalExpensesAmt / totalIncome) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-gray-400 font-bold">
                  <span>صُرف: {fmt(totalExpensesAmt)} د.ع</span>
                  <span>متبقي: {fmt(Math.max(0, totalIncome - totalExpensesAmt))} د.ع</span>
                </div>
              </div>
            )}

            {/* Expense Breakdown by Category */}
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-gray-100 dark:border-zinc-800 shadow-sm">
              <h2 className="font-black text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-500" />
                توزيع المصاريف هذا الشهر
              </h2>
              {expenses.filter(e => isInCycle(e.date)).length === 0 ? (
                <div className="text-center py-8">
                  <TrendingDown className="w-10 h-10 text-gray-200 dark:text-zinc-700 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm font-bold">لا توجد مصاريف مسجلة في هذه الدورة</p>
                  <button onClick={() => setShowExpenseModal(true)} className="mt-3 text-rose-500 text-xs font-black hover:underline">+ سجّل أول مصروف</button>
                </div>
              ) : (
                <div className="space-y-3">
                  {EXPENSE_CATEGORIES.map(cat => {
                    const catExpenses = expenses.filter(e => isInCycle(e.date) && e.category === cat.label);
                    const total = catExpenses.reduce((s, e) => s + e.amount, 0);
                    if (total === 0) return null;
                    const pct = totalExpensesAmt > 0 ? (total / totalExpensesAmt) * 100 : 0;
                    return (
                      <div key={cat.label}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                            <span>{cat.icon}</span>{cat.label}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-400 font-bold">{pct.toFixed(1)}%</span>
                            <span className="text-xs font-black text-gray-800 dark:text-gray-200">{fmt(total)} د.ع</span>
                          </div>
                        </div>
                        <div className="h-2.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div className={`h-full bg-gradient-to-l ${cat.color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>


            {/* ═══════════════ FUTURE PLANS ═══════════════ */}
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-gray-100 dark:border-zinc-800 shadow-sm">
              <h2 className="font-black text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-purple-500" />
                الخطط المستقبلية
              </h2>
              {futurePlans.length === 0 ? (
                <div className="text-center py-8">
                  <span className="text-4xl block mb-2">🚀</span>
                  <p className="text-gray-400 text-sm font-bold">لا توجد خطط حالياً</p>
                  <button onClick={() => setShowFuturePlanModal(true)} className="text-purple-500 text-xs font-black mt-2">+ ابدأ خطتك الأولى</button>
                </div>
              ) : (
                <div className="space-y-4">
                  {futurePlans.map(plan => (
                    <div key={plan.id} className="bg-gray-50 dark:bg-black/20 rounded-2xl p-4 border border-gray-100 dark:border-zinc-800">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-black text-gray-800 dark:text-white flex items-center gap-2">
                          <span className="text-xl">✨</span> {plan.title}
                        </h3>
                        <div className="flex gap-1">
                          <button onClick={() => { setEditFuturePlan(plan); setShowFuturePlanModal(true); }} className="p-1.5 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-lg"><Edit2 className="w-3 h-3 text-gray-500"/></button>
                          <button onClick={() => handleDeleteFuturePlan(plan.id)} className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg"><Trash2 className="w-3 h-3 text-red-500"/></button>
                        </div>
                      </div>
                      <div className="flex justify-between text-xs font-bold text-gray-500 mb-2">
                        <span>الهدف: {fmt(plan.targetAmount)}</span>
                        <span>{plan.savedAmount >= plan.targetAmount ? "✅ مكتمل" : `المتبقي: ${fmt(Math.max(0, plan.targetAmount - plan.savedAmount))}`}</span>
                      </div>
                      <div className="h-3 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden mb-3">
                         <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" style={{ width: `${Math.min(100, (plan.savedAmount/plan.targetAmount)*100)}%` }} />
                      </div>
                      <div className="space-y-2">
                        {plan.steps.map((step, idx) => (
                           <div key={step.id} className="flex items-center gap-2 bg-white dark:bg-zinc-800 p-2 rounded-xl text-xs font-bold border dark:border-zinc-700">
                              <input type="checkbox" checked={step.isCompleted} onChange={() => toggleFuturePlanStep(plan.id, step.id)} className="accent-purple-500" />
                              <span className={step.isCompleted ? "line-through text-gray-400" : "text-gray-700 dark:text-gray-200"}>
                                {idx + 1}. {step.text}
                              </span>
                           </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ═══════════════ SMART REPORT ═══════════════ */}
            {(() => {
              const currentExps = expenses.filter(e => isInCycle(e.date));
              const currentIncomes = incomes.filter(i => isInCycle(i.date));
              const totalExp = currentExps.reduce((s, e) => s + e.amount, 0);
              const totalInc = currentIncomes.reduce((s, i) => s + i.amount, 0);
              const cycleBalance = totalInc - totalExp;
              const savingsPct = totalInc > 0 ? Math.max(0, (cycleBalance / totalInc) * 100) : 0;
              const spendingPct = totalInc > 0 ? Math.min(100, (totalExp / totalInc) * 100) : 0;

              const expByCategory = currentExps.reduce((acc, curr) => {
                acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
                return acc;
              }, {} as Record<string, number>);
              const top5cats = Object.entries(expByCategory).sort((a,b) => b[1]-a[1]).slice(0,5);

              const fixedIncomeBase = 2600000;
              const hasVariableIncome = totalInc > fixedIncomeBase;
              const totalUnpaidBills = bills.filter(b => !isBillPaidThisCycle(b)).reduce((s,b)=>s+b.amount, 0);
              const totalMonthlyInst = installments.filter(i => i.remainingAmount > 0).reduce((s,i)=>s+i.monthlyInstallment, 0);
              const fixedObligations = totalUnpaidBills + totalMonthlyInst;
              
              const remainingAfterObligations = totalInc - fixedObligations;
              const safeDebtRepayment = remainingAfterObligations > 0 ? (remainingAfterObligations * 0.4) : 0;
              
              const debtBurdenRatio = totalInc > 0 ? (fixedObligations / totalInc) * 100 : 0;

              return (
                <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-zinc-800">
                  <h2 className="font-black text-gray-800 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-500" />
                    رؤى وتنبؤات مالية ذكية
                  </h2>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-3xl p-4 text-emerald-900 dark:text-emerald-100 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none -mr-10 -mt-10" />
                      <div className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 mb-1">إجمالي الدخل</div>
                      <div className="text-xl font-black">{fmt(totalInc)}</div>
                      <div className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 mt-1">د.ع</div>
                    </div>
                    <div className="bg-gradient-to-br from-rose-500/10 to-pink-500/10 border border-rose-500/20 rounded-3xl p-4 text-rose-900 dark:text-rose-100 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-xl pointer-events-none -mr-10 -mt-10" />
                      <div className="text-[10px] font-black text-rose-600 dark:text-rose-400 mb-1">إجمالي المصاريف</div>
                      <div className="text-xl font-black">{fmt(totalExp)}</div>
                      <div className="text-[10px] text-rose-600/70 dark:text-rose-400/70 mt-1">د.ع</div>
                    </div>
                  </div>

                  {/* Advanced Debt & Forecast Section */}
                  <div className="bg-gradient-to-br from-violet-900 via-indigo-900 to-zinc-900 p-5 rounded-3xl border border-violet-500/30 text-white shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <BrainCircuit className="w-6 h-6 text-violet-400 animate-pulse" />
                        <h3 className="font-black text-violet-100">تحليل وتقسيم الالتزامات</h3>
                      </div>
                      <div className="text-[10px] bg-white/10 px-2 py-1 rounded-lg border border-white/10">
                        {debtBurdenRatio > 50 ? 'ضغط مالي عالي ⚠️' : 'وضع مالي آمن ✅'}
                      </div>
                    </div>

                    <div className="space-y-4 text-xs">
                      <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-violet-300 font-bold">الدخل الثابت</span>
                          <span className="font-black text-white">{fmt(fixedIncomeBase)} د.ع</span>
                        </div>
                        {hasVariableIncome && (
                          <div className="flex justify-between items-center">
                            <span className="text-emerald-300 font-bold">دخل إضافي (أعمال أخرى)</span>
                            <span className="font-black text-emerald-400">+{fmt(totalInc - fixedIncomeBase)} د.ع</span>
                          </div>
                        )}
                      </div>

                      <div className="bg-black/20 rounded-2xl p-3 border border-black/20 space-y-2">
                        <div className="flex justify-between items-center text-gray-300">
                          <span>إجمالي الأقساط الشهرية</span>
                          <span className="font-black text-white">{fmt(totalMonthlyInst)} د.ع</span>
                        </div>
                        <div className="flex justify-between items-center text-gray-300">
                          <span>الفواتير المستحقة</span>
                          <span className="font-black text-white">{fmt(totalUnpaidBills)} د.ع</span>
                        </div>
                        <div className="w-full h-px bg-white/10 my-1" />
                        <div className="flex justify-between items-center font-bold">
                          <span className="text-rose-300">إجمالي الالتزامات الأساسية</span>
                          <span className="text-rose-400 font-black">{fmt(fixedObligations)} د.ع</span>
                        </div>
                      </div>

                      <div className="bg-violet-500/10 rounded-2xl p-3 border border-violet-500/20 leading-relaxed font-bold">
                        <p className="text-violet-100 mb-2">
                          <span className="text-lg ml-1">💡</span>
                          <strong>خطة تسديد الديون الكبيرة:</strong>
                        </p>
                        {remainingAfterObligations <= 0 ? (
                          <p className="text-rose-300">
                            التزاماتك الحالية تغطي كامل دخلك. لا تقم بتسديد أي ديون إضافية حالياً لتجنب العجز، وركز على زيادة الدخل الإضافي أو تقليل المصاريف الجانبية.
                          </p>
                        ) : (
                          <ul className="space-y-2 text-violet-200">
                            <li>• يتبقى لديك بعد الالتزامات: <strong>{fmt(remainingAfterObligations)} د.ع</strong> للمصاريف الشخصية والديون.</li>
                            <li>• ننصح بتخصيص مبلغ <strong>{fmt(safeDebtRepayment)} د.ع</strong> كحد أقصى (40% من المتبقي) لتسديد الديون المتراكمة هذا الشهر.</li>
                            <li>• المتبقي <strong>{fmt(remainingAfterObligations - safeDebtRepayment)} د.ع</strong> اجعله لمصاريف المنزل (أكل، شرب، بنزين).</li>
                            {hasVariableIncome && <li>• استخدم الدخل الإضافي ({fmt(totalInc - fixedIncomeBase)} د.ع) لسداد أجزاء أكبر من الديون إذا سمحت الظروف لتقليل العبء.</li>}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Normal Alert Tips */}
                  <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl p-5 shadow-sm space-y-3">
                    <ul className="space-y-3">
                      {cycleBalance < 0 ? (
                        <li className="flex items-start gap-2 bg-red-50 dark:bg-red-900/10 p-3 rounded-2xl border border-red-100 dark:border-red-900/30">
                          <span className="text-xl mt-0.5">🚨</span>
                          <span className="text-xs font-bold text-red-700 dark:text-red-400 leading-relaxed">
                            أنت تتجاوز ميزانيتك الحالية بـ {fmt(Math.abs(cycleBalance))} د.ع. ننصح بإيقاف المصاريف غير الضرورية.
                          </span>
                        </li>
                      ) : spendingPct > 80 ? (
                        <li className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/10 p-3 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                          <span className="text-xl mt-0.5">⚠️</span>
                          <span className="text-xs font-bold text-amber-700 dark:text-amber-400 leading-relaxed">
                            لقد استهلكت {spendingPct.toFixed(1)}% من دخلك. تبقى لك {fmt(cycleBalance)} د.ع.
                          </span>
                        </li>
                      ) : (
                        <li className="flex items-start gap-2 bg-emerald-50 dark:bg-emerald-900/10 p-3 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                          <span className="text-xl mt-0.5">🏆</span>
                          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 leading-relaxed">
                            معدل صرفك ممتاز وميزانيتك مستقرة هذا الشهر.
                          </span>
                        </li>
                      )}
                      
                      {top5cats[0] && totalInc > 0 && (top5cats[0][1] / totalInc) > 0.3 && (
                        <li className="flex items-start gap-2 bg-orange-50 dark:bg-orange-900/10 p-3 rounded-2xl border border-orange-100 dark:border-orange-900/30">
                          <span className="text-xl mt-0.5">📊</span>
                          <span className="text-xs font-bold text-orange-700 dark:text-orange-400 leading-relaxed">
                            لاحظنا أن <strong>{top5cats[0][0]}</strong> تستهلك أكثر من 30% من ميزانيتك. يُنصح بمراجعة هذه الفئة وإيجاد بدائل أوفر.
                          </span>
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* Future Savings Vision */}
                  <div className="bg-gradient-to-br from-indigo-900 via-purple-900 to-zinc-900 p-5 rounded-3xl text-white shadow-2xl border border-purple-500/20">
                    <h3 className="font-black text-purple-200 mb-3 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-yellow-400" />الرؤية المستقبلية للتجميع</h3>
                    
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-indigo-200">الهدف الشهري للتوفير (20%)</span>
                        <span className="text-xs font-black bg-indigo-800/50 px-2 py-1 rounded-lg">{savingsPct.toFixed(1)}% محقق</span>
                      </div>
                      <div className="h-2.5 bg-black/30 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ${savingsPct >= 20 ? 'bg-gradient-to-l from-emerald-400 to-teal-400' : 'bg-gradient-to-l from-yellow-400 to-orange-400'}`}
                          style={{ width: `${Math.min(100, (savingsPct/20)*100)}%` }}
                        />
                      </div>
                    </div>
                    
                    <p className="text-xs leading-relaxed text-indigo-100 mb-3 font-bold bg-white/5 p-3 rounded-2xl border border-white/10">
                      بناءً على وتيرتك الحالية، إذا حافظت على توفير <strong>{fmt(Math.max(0, cycleBalance))}</strong> د.ع شهرياً، ستحقق أهداف خططك المستقبلية بشكل أسرع. 
                      هذا الفائض يمكن أن يُموّل طوارئ المنزل، أو يُسرّع تحقيق هدف السفر القادم.
                    </p>
                    
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="bg-black/20 rounded-2xl p-3 border border-white/5 flex flex-col items-center text-center">
                        <div className="text-[10px] text-indigo-300 mb-1">توقع التوفير لـ 3 أشهر</div>
                        <div className="text-sm font-black text-white">{fmt(Math.max(0, cycleBalance * 3))} د.ع</div>
                      </div>
                      <div className="bg-black/20 rounded-2xl p-3 border border-white/5 flex flex-col items-center text-center">
                        <div className="text-[10px] text-indigo-300 mb-1">توقع التوفير لسنة</div>
                        <div className="text-sm font-black text-emerald-400">{fmt(Math.max(0, cycleBalance * 12))} د.ع</div>
                      </div>
                    </div>
                  </div>

                  {/* Export Report Button */}
                  <button
                    onClick={() => {
                      let report = `📊 تقرير الدورة المالية: ${cycles.find(c => c.id === selectedCycleId)?.label || ""}\n\n`;
                      report += `💰 ملخص الرصيد:\n`;
                      report += `الدخل: ${fmt(totalIncome)} د.ع\n`;
                      report += `المصاريف: ${fmt(totalExpensesAmt)} د.ع\n`;
                      report += `الرصيد الحالي: ${fmt(balance)} د.ع\n\n`;
                      
                      const paidInsts = installments.filter(i => i.remainingAmount <= 0 || !isInstallmentOwedThisCycle(i));
                      const unpaidInsts = installments.filter(i => i.remainingAmount > 0 && isInstallmentOwedThisCycle(i));
                      report += `📅 الأقساط والسلف:\n`;
                      report += `✅ المسددة (${paidInsts.length}):\n` + paidInsts.map(i => `- ${i.name} (${fmt(i.monthlyInstallment)})`).join("\n") + "\n";
                      report += `❌ غير المسددة (${unpaidInsts.length}):\n` + unpaidInsts.map(i => `- ${i.name} (${fmt(i.monthlyInstallment)})`).join("\n") + "\n\n";

                      const paidBs = bills.filter(b => isBillPaidThisCycle(b));
                      const unpaidBs = bills.filter(b => !isBillPaidThisCycle(b));
                      report += `🧾 الفواتير:\n`;
                      report += `✅ المسددة (${paidBs.length}):\n` + paidBs.map(b => `- ${b.name} (${fmt(b.amount)})`).join("\n") + "\n";
                      report += `❌ غير المسددة (${unpaidBs.length}):\n` + unpaidBs.map(b => `- ${b.name} (${fmt(b.amount)})`).join("\n") + "\n\n";

                      report += `🤝 الديون:\n`;
                      report += `لك (فائض): ${fmt(totalDebtsForMe)} د.ع\n`;
                      report += `عليك (دين): ${fmt(totalDebtsOnMe)} د.ع\n\n`;
                      
                      report += `📈 حالة الدورة:\n`;
                      report += balance >= 0 ? `فائض بقيمة: ${fmt(balance)} د.ع\n` : `عجز بقيمة: ${fmt(Math.abs(balance))} د.ع\n`;

                      report += `📊 نسبة التوفير: ${savingsPct.toFixed(1)}%\n\n`;
                      report += `📊 أعلى الفئات صرفاً:\n` + top5cats.map(([n,v]) => `- ${n}: ${fmt(v)} د.ع`).join('\n') + '\n\n';

                      navigator.clipboard.writeText(report);
                      toast.success("تم نسخ التقرير الشامل! يمكنك إرساله للذكاء الاصطناعي للاطلاع عليه.");
                    }}
                    className="w-full bg-gradient-to-l from-purple-600 to-indigo-600 text-white font-black py-3.5 mt-4 rounded-2xl shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition"
                  >
                    <ClipboardCopy className="w-5 h-5" />
                    تصدير ونسخ تقرير الدورة الشامل
                  </button>
                </div>
              );
            })()}
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
            <div className="flex items-center justify-between">
              <h2 className="font-black text-gray-800 dark:text-white flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-rose-500" />
                سجل المصاريف
              </h2>
              <button onClick={() => setShowExpenseModal(true)}
                className="bg-rose-500 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 shadow-lg shadow-rose-500/25 active:scale-95 transition">
                <Plus className="w-3.5 h-3.5" /> إضافة
              </button>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <input
                type="text"
                placeholder="ابحث في المصاريف..."
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

            {/* Category quick filters (ALL VISIBLE ON SCREEN) */}
            <div className="flex flex-wrap gap-2 justify-center pb-1">
              <button
                onClick={() => setExpenseCategoryFilter(null)}
                className={`flex items-center gap-1 px-3.5 py-2 border rounded-full text-[11px] font-bold transition ${
                  !expenseCategoryFilter
                    ? "bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/20 scale-105"
                    : "bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-zinc-700 hover:border-purple-400"
                }`}>
                الكل
              </button>
              {(showAllCategories ? EXPENSE_CATEGORIES : EXPENSE_CATEGORIES.slice(0, 4)).map(cat => {
                const isActive = expenseCategoryFilter === cat.label;
                const catTotal = expenses.filter(e => isInCycle(e.date) && e.category === cat.label).reduce((s,e)=>s+e.amount,0);
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
                    {catTotal > 0 && (
                      <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-black ${isActive ? "bg-white/20 text-white" : "bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300"}`}>
                        {fmt(catTotal)}
                      </span>
                    )}
                  </button>
                );
              })}
              {!showAllCategories && EXPENSE_CATEGORIES.length > 4 && (
                <button
                  onClick={() => setShowAllCategories(true)}
                  className="flex items-center gap-1 px-3.5 py-2 border rounded-full text-[11px] font-bold transition bg-gray-50 dark:bg-zinc-900 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-800"
                >
                  المزيد...
                </button>
              )}
              {showAllCategories && EXPENSE_CATEGORIES.length > 4 && (
                <button
                  onClick={() => { setShowAllCategories(false); setExpenseCategoryFilter(null); }}
                  className="flex items-center gap-1 px-3.5 py-2 border rounded-full text-[11px] font-bold transition bg-gray-50 dark:bg-zinc-900 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-800"
                >
                  عرض أقل
                </button>
              )}
            </div>

            {/* Summary if filtered */}
            {expenseCategoryFilter && (
              <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/40 rounded-2xl px-4 py-3 flex justify-between items-center">
                <span className="text-rose-700 dark:text-rose-400 text-xs font-bold">إجمالي {expenseCategoryFilter}:</span>
                <span className="text-rose-600 dark:text-rose-400 font-black">
                  {fmt(expenses.filter(e => isInCycle(e.date) && e.category === expenseCategoryFilter).reduce((s,e)=>s+e.amount,0))} د.ع
                </span>
              </div>
            )}

            {(() => {
              const filtered = expenses.filter(exp =>
                isInCycle(exp.date) &&
                (!expenseCategoryFilter || exp.category === expenseCategoryFilter) &&
                (!expenseSearch || exp.name.includes(expenseSearch) || exp.category.includes(expenseSearch))
              ).sort((a, b) => b.date.localeCompare(a.date));

              if (filtered.length === 0) return (
                <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 text-center border border-gray-100 dark:border-zinc-800">
                  <span className="text-5xl block mb-3">💸</span>
                  <p className="text-gray-400 font-bold text-sm">{expenseSearch ? `لا نتائج عن "${expenseSearch}"` : expenseCategoryFilter ? `لا توجد مصاريف في قسم ${expenseCategoryFilter}` : 'لا توجد مصاريف في هذه الدورة'}</p>
                </div>
              );

              return (
                <div className="grid grid-cols-2 gap-3">
                  {filtered.map(exp => {
                    const cat = EXPENSE_CATEGORIES.find(c => c.label === exp.category);
                    return (
                      <div key={exp.id} className="bg-white dark:bg-zinc-900 rounded-2xl p-3 border border-gray-100 dark:border-zinc-800 shadow-sm flex flex-col gap-2 relative overflow-hidden">
                        <div className={`absolute top-0 right-0 left-0 h-1 bg-gradient-to-r ${cat?.color || 'from-gray-400 to-gray-500'} opacity-70 rounded-t-2xl`} />
                        {/* Top Row: icon + actions */}
                        <div className="flex items-start justify-between mt-0.5">
                          <div className={`w-10 h-10 bg-gradient-to-br ${cat?.color || 'from-gray-400 to-gray-500'} rounded-xl flex items-center justify-center text-lg flex-shrink-0 shadow-sm`}>
                            {cat?.icon || '📦'}
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => { setEditExpense(exp); setShowExpenseModal(true); }} className="p-1 bg-gray-100 dark:bg-zinc-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition">
                              <Edit2 className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                            </button>
                            <button onClick={() => handleDeleteExpense(exp.id)} className="p-1 bg-gray-100 dark:bg-zinc-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition">
                              <Trash2 className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                            </button>
                          </div>
                        </div>
                        {/* Name */}
                        <div className="font-black text-gray-800 dark:text-gray-100 text-xs leading-tight line-clamp-2">{exp.name}</div>
                        {/* Amount */}
                        <div className="font-black text-rose-600 dark:text-rose-400 text-sm">-{fmt(exp.amount)} <span className="text-[10px] font-bold text-rose-400/70">د.ع</span></div>
                        {/* Footer */}
                        <div className="flex items-center gap-1 flex-wrap mt-auto">
                          <span className="text-[9px] bg-gray-100 dark:bg-zinc-800 text-gray-500 px-1.5 py-0.5 rounded-full font-bold truncate max-w-[80px]">{exp.category}</span>
                          <span className="text-[9px] text-gray-400">{exp.createdAt ? new Date(exp.createdAt).toLocaleDateString("ar-IQ") : new Date(exp.date).toLocaleDateString("ar-IQ")}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* ═══════════════ INSTALLMENTS TAB ═══════════════ */}
        {activeTab === "installments" && (
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

            {installments.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 text-center border border-gray-100 dark:border-zinc-800">
                <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400 font-bold text-sm">لا توجد أقساط أو سلف مسجلة</p>
              </div>
            ) : (
              installments.map((inst, idx) => {
                // ── حساب المبالغ الفعلية بدقة ──
                // المبلغ المدفوع فعلياً من الدفعات المسجلة + المقدمة + الأشهر المدفوعة مسبقاً
                const paymentsActualTotal = inst.payments.reduce((s, p) => s + p.amount, 0);
                const initialPaidAmount = (inst.initialPaidMonths || 0) * inst.monthlyInstallment;
                const downPaymentAmount = inst.downPayment || 0;
                const totalPaidAmount = paymentsActualTotal + initialPaidAmount + downPaymentAmount;
                
                // المتبقي الفعلي = الكلي - كل ما دُفع
                const computedRemaining = Math.max(0, inst.totalAmount - totalPaidAmount);
                
                // التقدم
                const progress = inst.totalAmount > 0 ? Math.min(100, (totalPaidAmount / inst.totalAmount) * 100) : 0;
                
                // الأشهر المدفوعة والمتبقية
                const paidMonths = (inst.initialPaidMonths || 0) + inst.payments.length;
                const monthsLeft = inst.totalMonths 
                  ? Math.max(0, inst.totalMonths - paidMonths)
                  : (inst.monthlyInstallment > 0 ? Math.ceil(computedRemaining / inst.monthlyInstallment) : 0);
                const delayMonths = isInstallmentOwedThisCycle(inst) ? 1 : 0;
                const gradients = [
                  "from-indigo-600 to-violet-700",
                  "from-blue-600 to-cyan-700",
                  "from-purple-600 to-pink-700",
                  "from-teal-600 to-emerald-700",
                ];
                const grad = gradients[idx % gradients.length];
                const isHistory = showInstallmentHistory === inst.id;

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
                        {/* Date Range: Start → End */}
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
                        <div className="font-black text-sm text-emerald-200">{fmt(totalPaidAmount)}</div>
                      </div>
                      <div className="bg-red-500/20 border border-red-400/25 rounded-2xl p-2.5 text-center backdrop-blur-sm">
                        <div className="text-[10px] text-red-200 font-bold mb-0.5">المتبقي</div>
                        <div className="font-black text-sm text-red-200">{fmt(computedRemaining)}</div>
                      </div>
                      <div className="bg-white/10 rounded-2xl p-2.5 text-center backdrop-blur-sm">
                        <div className="text-[10px] text-white/60 font-bold mb-0.5">باقي أشهر</div>
                        <div className="font-black text-sm">{monthsLeft}</div>
                      </div>
                    </div>
                    {inst.downPayment ? (
                      <div className="relative z-10 bg-white/10 rounded-2xl p-2 text-center mb-3 backdrop-blur-sm">
                        <span className="text-[10px] text-white/60 font-bold">المقدمة: </span>
                        <span className="font-black text-sm">{fmt(inst.downPayment)} د.ع</span>
                      </div>
                    ) : null}

                    {/* Delay Alert */}
                    {delayMonths > 0 && (
                      <div className="relative z-10 bg-red-500/30 border border-red-400/40 rounded-2xl p-2.5 mb-3 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-300 animate-pulse flex-shrink-0" />
                        <span className="text-red-200 text-xs font-black">حالة تلكؤ: {delayMonths} شهر غير مدفوع!</span>
                      </div>
                    )}

                    {/* Progress */}
                    <div className="relative z-10 mb-4">
                      <div className="flex justify-between text-[10px] text-white/70 font-bold mb-1.5">
                        <span>التقدم: {progress.toFixed(1)}%</span>
                        <span>الإجمالي: {fmt(inst.totalAmount)} د.ع</span>
                      </div>
                      <div className="h-2.5 bg-black/25 rounded-full overflow-hidden">
                        <div className="h-full bg-white rounded-full transition-all" style={{ width: `${Math.min(100, progress)}%` }} />
                      </div>
                      {inst.totalMonths && (
                        <div className="text-[10px] text-white/50 mt-1">{paidMonths} أشهر مدفوعة من {inst.totalMonths}</div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="relative z-10 flex gap-2">
                      {computedRemaining > 0 && (
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
              })
            )}
          </div>
        )}

        {/* ═══════════════ NEEDS TAB ═══════════════ */}
        {activeTab === "needs" && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-black text-gray-800 dark:text-white flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-red-500" />
                  النواقص والاحتياجات
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">سجل يضم جميع النواقص لمتطلبات البيت، السيارة، والعائلة</p>
              </div>
              <button onClick={() => setShowNeedModal(true)}
                className="bg-red-500 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center justify-center gap-1 shadow-lg shadow-red-500/25 active:scale-95 transition">
                <Plus className="w-3.5 h-3.5" /> إضافة
              </button>
            </div>
            
            {/* Needs Summary */}
            {needsSummaryStats.length > 0 && (
              <div className="flex flex-wrap justify-center gap-3 pb-2 pt-1">
                {needsSummaryStats.map(stat => (
                  <div key={stat.id} className={`flex flex-col justify-center px-4 py-2.5 rounded-2xl border shadow-sm ${stat.colorClass} min-w-[140px] flex-1`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-base">{stat.icon}</span>
                      <span className="font-black text-xs">{stat.name}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-[10px] font-bold opacity-90">
                      <span>العدد: {stat.count}</span>
                      {stat.price > 0 && <span>{fmt(stat.price)} د.ع</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            
            {(shoppingList.length === 0 && familyNeeds.filter(n => n.status === "pending").length === 0) ? (
              <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 text-center border border-gray-100 dark:border-zinc-800">
                <span className="text-5xl block mb-3">🛒</span>
                <p className="text-gray-400 font-bold text-sm">لا توجد احتياجات مسجلة</p>
              </div>
            ) : (
              <div className="space-y-2">
                {["inventory", "car", "travel"].map(source => {
                  const items = shoppingList.filter(i => i._source === source);
                  if (items.length === 0) return null;
                  const titles = { inventory: "نواقص البيت", car: "نواقص السيارة", travel: "نواقص السفر" };
                  const icons = { inventory: <Package className="w-3.5 h-3.5" />, car: <span className="text-sm">🚗</span>, travel: <span className="text-sm">✈️</span> };
                  return (
                    <div key={source}>
                      <div className="text-xs font-black text-orange-600 dark:text-orange-400 mb-2 flex items-center gap-2 mt-4 first:mt-0">
                        {icons[source as keyof typeof icons]} {titles[source as keyof typeof titles]} ({items.length})
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        {items.map(item => {
                          const neededQty = item.neededQuantity || 1;
                          const estimatedTotal = neededQty * (item.estimatedPrice || 0);
                          return (
                            <div key={`inv-${item.id}`} className="bg-orange-50 dark:bg-orange-900/15 rounded-2xl p-2.5 border border-orange-200 dark:border-orange-800/40 shadow-sm flex flex-col relative overflow-hidden aspect-square group">
                              <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-orange-400 to-red-500 opacity-60 rounded-t-2xl" />
                              
                              <button onClick={() => { setEditNeed(item); setShowNeedModal(true); }} className="absolute top-2 left-2 p-1.5 bg-white/80 dark:bg-zinc-800/80 hover:bg-orange-100 dark:hover:bg-orange-900/50 rounded-lg text-gray-500 opacity-0 group-hover:opacity-100 transition shadow-sm z-10">
                                <Edit2 className="w-3 h-3" />
                              </button>

                              <span className="absolute top-2 right-2 text-[8px] font-black px-1.5 py-0.5 rounded bg-white/80 dark:bg-zinc-800/80 text-orange-600 shadow-sm z-10">{item.category}</span>

                              {/* Image/Icon + Item Name */}
                              <div className="flex flex-col gap-1.5 flex-1 items-center text-center justify-center pt-3">
                                <div className="w-10 h-10 bg-orange-100 dark:bg-orange-800/30 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                                  {item.imageUrl ? (
                                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-xl">📦</span>
                                  )}
                                </div>
                                <div className="min-w-0 flex flex-col gap-0.5">
                                  <div className="font-black text-xs text-gray-800 dark:text-gray-100 line-clamp-2 leading-tight">{item.name}</div>
                                  {item.tripDestination && (
                                    <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[8px] px-1.5 py-0.5 rounded font-black border border-blue-200 dark:border-blue-800/50 inline-block w-fit mx-auto">رحلة {item.tripDestination}</span>
                                  )}
                                </div>
                              </div>
                                {/* Stats */}
                                <div className="text-[9px] text-gray-500 flex flex-col gap-0.5 text-center mt-1">
                                  <span>متوفر: {item.quantity} {item.unit} | تحتاج: {neededQty}</span>
                                  {estimatedTotal > 0 && <span className="text-orange-600 dark:text-orange-400 font-black">{fmt(estimatedTotal)} د.ع</span>}
                                  {item.notes && <span className="text-gray-400 mt-1 line-clamp-2" title={item.notes}>{item.notes}</span>}
                                </div>
                                {/* Actions */}
                              <div className="flex flex-col items-stretch gap-1 mt-auto pt-2">
                                <div className="flex gap-1">
                                  <div className="flex items-center justify-between w-full bg-white dark:bg-zinc-800/50 rounded-full px-1 border border-orange-100 dark:border-orange-800/30">
                                    <button onClick={async () => {
                                      const src = item._source;
                                      if (src === "car") { const updated = carInventory.map(x => x.id === item.id ? { ...x, neededQuantity: neededQty + 1 } : x); setCarInventory(updated); syncToFirebase("carInventory", updated);
                                      } else if (src === "travel") { const updated = travelInventory.map(x => x.id === item.id ? { ...x, neededQuantity: neededQty + 1 } : x); setTravelInventory(updated); syncToFirebase("travelInventory", updated);
                                      } else { const updated = inventory.map(x => x.id === item.id ? { ...x, neededQuantity: neededQty + 1 } : x); setInventory(updated); syncToFirebase("inventory", updated); }
                                    }} className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 font-bold text-sm flex items-center justify-center hover:bg-red-200 transition">+</button>
                                    <span className="text-[10px] font-black text-gray-700 dark:text-gray-300 w-4 text-center">{neededQty}</span>
                                    <button onClick={async () => {
                                      const src = item._source;
                                      if (src === "car") { const updated = carInventory.map(x => x.id === item.id ? { ...x, neededQuantity: Math.max(0, neededQty - 1) } : x); setCarInventory(updated); syncToFirebase("carInventory", updated);
                                      } else if (src === "travel") { const updated = travelInventory.map(x => x.id === item.id ? { ...x, neededQuantity: Math.max(0, neededQty - 1) } : x); setTravelInventory(updated); syncToFirebase("travelInventory", updated);
                                      } else { const updated = inventory.map(x => x.id === item.id ? { ...x, neededQuantity: Math.max(0, neededQty - 1) } : x); setInventory(updated); syncToFirebase("inventory", updated); }
                                    }} className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 font-bold text-sm flex items-center justify-center hover:bg-red-200 transition">-</button>
                                  </div>
                                  <button onClick={() => {
                                    setFulfillModal({
                                      isOpen: true,
                                      title: item.name,
                                      category: item.category || "الاحتياجات المنزلية",
                                      estimatedPrice: estimatedTotal,
                                      quantity: neededQty,
                                      type: "shopping",
                                      item: item
                                    });
                                  }} className="flex-1 bg-orange-500 text-white text-[10px] font-black px-2 py-1 rounded-xl active:scale-95 transition flex items-center justify-center gap-0.5">
                                    <Check className="w-3 h-3" /> تم
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {familyNeeds.filter(n => n.status === "pending" && n.type !== "duty").length > 0 && (
                  <>
                    <div className="font-black text-pink-600 dark:text-pink-400 text-xs mb-2 flex items-center gap-2">
                      <Users className="w-3.5 h-3.5" /> طلبات العائلة (نواقص)
                    </div>
                    {/* Family Members Summary Badges */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {["حيدر", "إيمان", "رقية", "قنوت", "إيڤا"].map(member => {
                        const memberNeeds = familyNeeds.filter(n => n.status === "pending" && n.type !== "duty" && (n.member === member || (member === "إيڤا" && n.member === "ايفا") || (member === "إيمان" && n.member === "ايمان")));
                        if (memberNeeds.length === 0) return null;
                        const totalQty = memberNeeds.reduce((sum, n) => sum + (Number(n.quantity) || 1), 0);
                        const totalPrice = memberNeeds.reduce((sum, n) => sum + ((Number(n.estimatedPrice) || 0) * (Number(n.quantity) || 1)), 0);
                        const memberColor = member === "إيڤا" ? "bg-red-100 text-red-600 border-red-200" : member === "إيمان" ? "bg-green-100 text-green-600 border-green-200" : member === "رقية" ? "bg-purple-100 text-purple-600 border-purple-200" : member === "قنوت" ? "bg-amber-100 text-amber-600 border-amber-200" : "bg-blue-100 text-blue-600 border-blue-200";
                        return (
                          <div key={member} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-black shadow-sm ${memberColor}`}>
                            <span>{member} ({totalQty})</span>
                            {totalPrice > 0 && <span className="bg-white/50 px-1.5 py-0.5 rounded-md text-[10px]">{fmt(totalPrice)} د.ع</span>}
                          </div>
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {familyNeeds.filter(n => n.status === "pending" && n.type !== "duty").map(need => {
                        const memberColor = need.member.includes("إيڤا") || need.member.includes("إيفا") || need.member.includes("ايفا") ? "text-red-500" : need.member.includes("إيمان") || need.member.includes("ايمان") ? "text-green-500" : need.member.includes("رقية") ? "text-purple-500" : need.member.includes("قنوت") ? "text-amber-500" : need.member.includes("حيدر") ? "text-blue-500" : "text-indigo-500";
                        const memberBg = need.member.includes("إيڤا") || need.member.includes("ايفا") ? "bg-red-100 dark:bg-red-900/30" : need.member.includes("إيمان") || need.member.includes("ايمان") ? "bg-green-100 dark:bg-green-900/30" : need.member.includes("رقية") ? "bg-purple-100 dark:bg-purple-900/30" : need.member.includes("قنوت") ? "bg-amber-100 dark:bg-amber-900/30" : "bg-blue-100 dark:bg-blue-900/30";
                        return (
                          <div key={`fam-${need.id}`} className="bg-pink-50 dark:bg-pink-900/15 rounded-2xl p-3 border border-pink-200 dark:border-pink-800/40 shadow-sm flex flex-col gap-2 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-pink-400 to-rose-500 opacity-60 rounded-t-2xl" />
                            
                            <button onClick={() => { setEditFamilyNeed(need); setFamilyNeedType(need.type || "need"); setShowFamilyNeedModal(true); }} className="absolute top-2 left-2 p-1.5 bg-white/80 dark:bg-zinc-800/80 hover:bg-pink-100 dark:hover:bg-pink-900/50 rounded-lg text-gray-500 opacity-0 group-hover:opacity-100 transition shadow-sm z-10">
                              <Edit2 className="w-3 h-3" />
                            </button>

                            <span className="absolute top-2 right-2 text-[8px] font-black px-1.5 py-0.5 rounded bg-white/80 dark:bg-zinc-800/80 text-pink-600 shadow-sm z-10">{need.category || "عائلة"}</span>

                            {/* Member badge + name */}
                            <div className="flex items-start gap-2 pt-3">
                              <div className={`w-8 h-8 ${memberBg} rounded-xl flex items-center justify-center text-sm flex-shrink-0`}>
                                👤
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-black text-xs text-gray-800 dark:text-gray-100 line-clamp-2">{need.title}</div>
                                <span className={`text-[9px] font-black ${memberColor}`}>{need.member} - {need.quantity} قطعة</span>
                              </div>
                            </div>
                            {/* Price */}
                            {need.estimatedPrice && Number(need.estimatedPrice) > 0 ? (
                              <div className="font-black text-emerald-600 dark:text-emerald-400 text-xs">{fmt(Number(need.estimatedPrice))} <span className="text-[9px] font-bold opacity-70">د.ع</span></div>
                            ) : null}
                            {need.notes && (
                              <div className="text-[9px] text-gray-500 line-clamp-2 mt-1">{need.notes}</div>
                            )}
                            {/* Action */}
                            <button onClick={() => handleToggleFamilyNeedStatus(need)} className="w-full bg-pink-500 text-white text-[9px] font-black py-1.5 rounded-xl active:scale-95 transition flex items-center justify-center gap-0.5 mt-auto">
                              <Check className="w-2.5 h-2.5" /> توفير
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

              </div>
            )}
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
                        {/* Pay/Undo button */}
                        {!paidThisCycle ? (
                          <button onClick={() => handlePayBill(bill)}
                            className={`w-full bg-gradient-to-r ${c.grad} text-white text-[10px] font-black py-1.5 rounded-xl active:scale-95 transition shadow-sm mt-auto`}>
                            دفع الآن
                          </button>
                        ) : (
                          <button onClick={() => handleUndoBillPayment(bill)}
                            className="w-full bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 text-[10px] font-bold py-1.5 rounded-xl active:scale-95 transition mt-auto">
                            تراجع
                          </button>
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
        {activeTab === "debts" && (
          <div className="space-y-3">
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
            
            {debts.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 text-center border border-gray-100 dark:border-zinc-800">
                <Banknote className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400 font-bold text-sm">لا توجد ديون أو فائض مسجل</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {[...debts].sort((a, b) => b.date.localeCompare(a.date)).map(debt => {
                  const paymentsTotal = debt.payments.reduce((s, p) => s + p.amount, 0);
                  const remaining = debt.amount - paymentsTotal;
                  const isPaid = remaining <= 0;
                  const isOwedToMe = debt.type === "دين لي";
                  const c = isOwedToMe 
                    ? { bg: "bg-emerald-500", text: "text-emerald-500", border: "border-emerald-200 dark:border-emerald-800/50", lightBg: "bg-emerald-50 dark:bg-emerald-900/20" }
                    : { bg: "bg-rose-500", text: "text-rose-500", border: "border-rose-200 dark:border-rose-800/50", lightBg: "bg-rose-50 dark:bg-rose-900/20" };
                  
                  return (
                    <div key={debt.id} className={`bg-white dark:bg-zinc-900 rounded-2xl p-2.5 border ${isPaid ? "border-gray-100 opacity-60" : c.border} shadow-sm overflow-hidden relative flex flex-col justify-between`}>
                      <div>
                        <div className="flex justify-between items-start mb-1.5">
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${c.lightBg} ${c.text}`}>
                            {debt.type}
                          </span>
                          <span className="text-[9px] text-gray-400">{new Date(debt.date).toLocaleDateString("ar-IQ")}</span>
                        </div>
                        <h3 className="font-black text-gray-800 dark:text-white text-sm mb-1 truncate">{debt.person}</h3>
                        <div className="font-black text-base text-gray-800 dark:text-white mb-2">{fmt(debt.amount)} <span className="text-[9px] text-gray-400">د.ع</span></div>
                      </div>
                      
                      {/* Stats Grid */}
                      {!!debt.monthlyInstallment && !!debt.totalMonths ? (
                        <div className="grid grid-cols-2 gap-1.5 mb-2">
                          <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-2 text-center">
                            <div className="text-[9px] text-gray-500 font-bold mb-0.5">القسط الشهري</div>
                            <div className="font-black text-gray-700 dark:text-gray-300 text-[11px]">{fmt(debt.monthlyInstallment)}</div>
                          </div>
                          <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-xl p-2 text-center">
                            <div className="text-[9px] text-emerald-600 dark:text-emerald-500 font-bold mb-0.5">المسدد</div>
                            <div className="font-black text-emerald-600 dark:text-emerald-500 text-[11px]">{fmt(paymentsTotal)}</div>
                          </div>
                          <div className="bg-rose-50 dark:bg-rose-900/10 rounded-xl p-2 text-center">
                            <div className="text-[9px] text-rose-600 dark:text-rose-500 font-bold mb-0.5">المتبقي</div>
                            <div className="font-black text-rose-600 dark:text-rose-500 text-[11px]">{fmt(remaining)}</div>
                          </div>
                          <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-2 text-center">
                            <div className="text-[9px] text-gray-500 font-bold mb-0.5">باقي أشهر</div>
                            <div className="font-black text-gray-700 dark:text-gray-300 text-[11px]">{Math.ceil(remaining / debt.monthlyInstallment)}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center bg-gray-50 dark:bg-zinc-800/50 p-2 rounded-xl mb-2">
                          <div className="text-right">
                            <div className="text-[9px] text-gray-500 font-bold mb-0.5">المسدد</div>
                            <div className="font-black text-gray-700 dark:text-gray-300 text-xs">{fmt(paymentsTotal)}</div>
                          </div>
                          <div className="text-left">
                            <div className="text-[9px] text-gray-500 font-bold mb-0.5">المتبقي</div>
                            <div className={`font-black text-xs ${isPaid ? 'text-gray-400' : c.text}`}>{fmt(remaining)}</div>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-zinc-800">
                        <div className="flex gap-1">
                          <button onClick={() => { setEditDebt(debt); setShowDebtModal(true); }} className="p-1.5 bg-gray-100 dark:bg-zinc-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition">
                            <Edit2 className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                          </button>
                          <button onClick={() => handleDeleteDebt(debt.id)} className="p-1.5 bg-gray-100 dark:bg-zinc-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition">
                            <Trash2 className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                          </button>
                          {debt.payments.length > 0 && (
                            <button onClick={() => setShowDebtHistory(showDebtHistory === debt.id ? null : debt.id)} className="p-1.5 bg-gray-100 dark:bg-zinc-800 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition text-gray-500 dark:text-gray-400 text-[10px] font-bold">
                              سجل
                            </button>
                          )}
                        </div>
                        
                        <div className="flex gap-2">
                          {debt.payments.length > 0 && (
                            <button onClick={() => handleUndoDebtPayment(debt)}
                                className="bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 text-[10px] font-bold px-3 py-1.5 rounded-lg active:scale-95 transition">
                                تراجع
                            </button>
                          )}
                          {!isPaid && (
                            <button onClick={() => handlePayDebt(debt)}
                              className={`${c.bg} text-white text-[10px] font-black px-4 py-1.5 rounded-lg active:scale-95 transition shadow-sm`}>
                              {debt.monthlyInstallment ? "دفع القسط" : "تسديد"}
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {showDebtHistory === debt.id && debt.payments.length > 0 && (
                        <div className="mt-2 rounded-xl p-2 bg-gray-50 dark:bg-zinc-800/80 max-h-24 overflow-y-auto">
                          {[...debt.payments].reverse().map((pay, pi) => (
                            <div key={pi} className="flex justify-between text-[9px] bg-white dark:bg-zinc-900 rounded-lg px-2 py-1 mb-1 last:mb-0">
                              <span className="text-gray-800 dark:text-gray-200 font-bold">{fmt(pay.amount)}</span>
                              <span className="text-gray-500">{new Date(pay.date).toLocaleDateString("ar-IQ")}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ INVENTORY TABS ═══════════════ */}
        {["inventory", "car", "travel"].includes(activeTab) && (() => {
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
          if (activeTab === "car") { title = "السيارة"; TabIcon = Car; }
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
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-l from-indigo-900/40 via-purple-900/20 to-transparent p-5 rounded-3xl border border-indigo-500/20">
              <div>
                <h2 className="font-black text-gray-800 dark:text-white flex items-center gap-2 text-lg">
                  <Users className="w-6 h-6 text-indigo-500" />
                  إدارة طلبات وواجبات العائلة
                </h2>
                <p className="text-xs text-indigo-700/60 dark:text-indigo-300/80 font-bold mt-1">تصنيف شامل للمسؤوليات والاحتياجات لكل فرد من أفراد العائلة</p>
              </div>
            </div>
            
            {/* Member Tabs - Wrapped exactly like the user's mockup */}
            <div className="flex flex-wrap justify-center pb-4 pt-2 gap-3 px-2">
              {FAMILY_MEMBERS.map(member => {
                const memberPendingDuties = familyNeeds.filter(n => n.member === member && n.type === "duty" && n.status === "pending").length;
                const memberPendingNeeds = familyNeeds.filter(n => n.member === member && (!n.type || n.type === "need") && n.status === "pending").length;
                const memberAvailableNeeds = familyNeeds.filter(n => n.member === member && (!n.type || n.type === "need") && n.status === "available").length;

                return (
                  <button 
                    key={member}
                    onClick={() => setActiveFamilyMember(member)}
                    className={`flex-shrink-0 snap-center px-6 py-3 rounded-full font-black text-sm transition-all flex flex-col items-center gap-1.5 shadow-sm ${
                      activeFamilyMember === member 
                      ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30 scale-105" 
                      : "bg-white dark:bg-zinc-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-zinc-800 hover:border-indigo-400/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {member}
                      <span className={`w-2 h-2 rounded-full ${activeFamilyMember === member ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" : "bg-indigo-400"}`}></span>
                    </div>
                    {(memberPendingDuties > 0 || memberPendingNeeds > 0 || memberAvailableNeeds > 0) && (
                      <div className="flex gap-1.5 text-[10px] mt-0.5">
                        {memberPendingNeeds > 0 && <span className={`px-2 py-0.5 rounded-full ${activeFamilyMember === member ? "bg-white/20 text-white" : "bg-pink-100 dark:bg-pink-500/20 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-500/30"}`}>{memberPendingNeeds} 🛍️</span>}
                        {memberPendingDuties > 0 && <span className={`px-2 py-0.5 rounded-full ${activeFamilyMember === member ? "bg-white/20 text-white" : "bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-500/30"}`}>{memberPendingDuties} 🎯</span>}
                        {memberAvailableNeeds > 0 && <span className={`px-2 py-0.5 rounded-full ${activeFamilyMember === member ? "bg-white/20 text-white" : "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30"}`}>{memberAvailableNeeds} ✅</span>}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Action Buttons for Active Member */}
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => { setFamilyNeedType("duty"); setEditFamilyNeed(null); setShowFamilyNeedModal(true); }}
                className="w-full aspect-square bg-gradient-to-br from-violet-600/10 to-indigo-600/10 hover:from-violet-600/20 hover:to-indigo-600/20 text-violet-600 dark:text-violet-300 rounded-3xl border border-violet-500/30 flex flex-col items-center justify-center gap-3 font-black active:scale-95 transition shadow-sm group p-2 text-center"
              >
                <div className="w-12 h-12 rounded-2xl bg-violet-500/20 flex items-center justify-center group-hover:scale-110 transition shadow-inner">
                  <span className="text-2xl">🎯</span>
                </div>
                <span className="text-xs sm:text-sm">إضافة واجب</span>
              </button>

              <button 
                onClick={() => { setFamilyNeedType("need"); setEditFamilyNeed(null); setShowFamilyNeedModal(true); }}
                className="w-full aspect-square bg-gradient-to-br from-pink-600/10 to-rose-600/10 hover:from-pink-600/20 hover:to-rose-600/20 text-pink-600 dark:text-pink-300 rounded-3xl border border-pink-500/30 flex flex-col items-center justify-center gap-3 font-black active:scale-95 transition shadow-sm group p-2 text-center"
              >
                <div className="w-12 h-12 rounded-2xl bg-pink-500/20 flex items-center justify-center group-hover:scale-110 transition shadow-inner">
                  <span className="text-2xl">🛍️</span>
                </div>
                <span className="text-xs sm:text-sm">إضافة احتياج</span>
              </button>
            </div>

            {/* Lists in 2 Columns */}
            {(() => {
              const memberNeeds = familyNeeds.filter(n => n.member === activeFamilyMember);
              const duties = memberNeeds.filter(n => n.type === "duty");
              const requests = memberNeeds.filter(n => n.type !== "duty");
              
              const pendingDuties = duties.filter(n => n.status === "pending");
              const completedDuties = duties.filter(n => n.status === "available" || n.status === "completed");

              const pendingRequests = requests.filter(n => n.status === "pending");
              const availableRequests = requests.filter(n => n.status === "available" || n.status === "completed");

              return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* 🎯 العمود الأول: الواجبات والمهام */}
                  <div className="bg-gradient-to-b from-violet-50/50 to-white dark:from-violet-950/20 dark:to-zinc-900 rounded-[32px] p-5 border-2 border-violet-500/20 shadow-xl shadow-violet-500/5 space-y-5">
                    <div className="flex items-center justify-between border-b border-violet-500/10 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🎯</span>
                        <div>
                          <h3 className="font-black text-gray-900 dark:text-white text-base">واجبات ومسؤوليات {activeFamilyMember}</h3>
                          <p className="text-[11px] text-violet-600 dark:text-violet-400 font-bold">مهام منزلية ومسؤوليات مطلوبة</p>
                        </div>
                      </div>
                      <span className="bg-violet-500/10 text-violet-600 dark:text-violet-300 font-black text-xs px-3 py-1 rounded-full border border-violet-500/20">
                        {pendingDuties.length} معلق
                      </span>
                    </div>

                    {/* قائمة المهام المعلقة */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 text-violet-500" /> المهام المطلوب إنجازها ({pendingDuties.length})
                      </h4>
                      {pendingDuties.length === 0 ? (
                        <p className="text-center py-6 text-xs text-gray-400 font-bold bg-white/50 dark:bg-zinc-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-zinc-800">لا توجد واجبات معلقة على {activeFamilyMember} حالياً 👏</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {pendingDuties.map(need => (
                            <div key={need.id} className="bg-white dark:bg-zinc-800/90 rounded-2xl p-3 shadow-sm border border-violet-500/20 hover:border-violet-500/40 transition flex flex-col gap-2 relative overflow-hidden">
                              <div className="absolute top-0 right-0 left-0 h-0.5 bg-gradient-to-r from-violet-500 to-indigo-500 rounded-t-2xl" />
                              <div className="flex items-start justify-between">
                                <span className="bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 font-bold text-[9px] px-1.5 py-0.5 rounded-lg">{need.priority || "متوسط"}</span>
                                <div className="flex gap-0.5">
                                  <button onClick={() => { setEditFamilyNeed(need); setFamilyNeedType("duty"); setShowFamilyNeedModal(true); }} className="p-1 text-gray-400 hover:text-blue-500 transition rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20">
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button onClick={() => handleDeleteFamilyNeed(need.id)} className="p-1 text-gray-400 hover:text-red-500 transition rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                              <p className="font-black text-xs text-gray-800 dark:text-white line-clamp-2">{need.title}</p>
                              {need.notes && <p className="text-[9px] text-gray-500 line-clamp-2">{need.notes}</p>}
                              <button onClick={() => handleToggleFamilyNeedStatus(need)} className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[9px] font-black py-1.5 rounded-xl active:scale-95 transition flex items-center justify-center gap-0.5 mt-auto">
                                <Check className="w-2.5 h-2.5" /> إنجاز
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* قائمة المهام المنجزة */}
                    {completedDuties.length > 0 && (
                      <div className="space-y-2 pt-3 border-t border-violet-500/10">
                        <h4 className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> مهام تم إنجازها سابقاً ({completedDuties.length})
                        </h4>
                        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                          {completedDuties.map(need => (
                            <div key={need.id} className="flex flex-col items-center justify-center text-center bg-white/60 dark:bg-zinc-800/50 rounded-2xl p-3 shadow-sm border border-emerald-500/20 opacity-75 hover:opacity-100 transition aspect-square gap-1 relative">
                              <div className="flex-1 flex flex-col justify-center items-center">
                                <CheckCircle className="w-5 h-5 text-emerald-500 mb-1" />
                                <p className="font-bold text-[11px] text-gray-700 dark:text-gray-300 line-through decoration-emerald-500 leading-tight line-clamp-2">{need.title}</p>
                                {need.notes && <p className="text-[9px] text-gray-400 mt-1 line-clamp-2">{need.notes}</p>}
                              </div>
                              <div className="flex items-center gap-1 mt-auto pt-1 w-full border-t border-emerald-500/10">
                                <button onClick={() => handleDeleteFamilyNeed(need.id)} className="p-1 text-gray-400 hover:text-red-500 transition">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                                <button onClick={() => handleToggleFamilyNeedStatus(need)} className="flex-1 bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 text-[9px] font-black px-1.5 py-1 rounded-lg active:scale-95 transition">
                                  إعادة 🔄
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 🛍️ العمود الثاني: الطلبات والاحتياجات */}
                  <div className="bg-gradient-to-b from-pink-50/50 to-white dark:from-pink-950/20 dark:to-zinc-900 rounded-[32px] p-5 border-2 border-pink-500/20 shadow-xl shadow-pink-500/5 space-y-5">
                    <div className="flex items-center justify-between border-b border-pink-500/10 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🛍️</span>
                        <div>
                          <h3 className="font-black text-gray-900 dark:text-white text-base">طلبات واحتياجات {activeFamilyMember}</h3>
                          <p className="text-[11px] text-pink-600 dark:text-pink-400 font-bold">أغراض ومستلزمات شخصية مطلوبة</p>
                        </div>
                      </div>
                      <span className="bg-pink-500/10 text-pink-600 dark:text-pink-300 font-black text-xs px-3 py-1 rounded-full border border-pink-500/20">
                        {pendingRequests.length} مطلوب
                      </span>
                    </div>

                    {/* قائمة الطلبات المعلقة (نواقص) */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 text-orange-500" /> نواقص مطلوب توفيرها ({pendingRequests.length})
                      </h4>
                      {pendingRequests.length === 0 ? (
                        <p className="text-center py-6 text-xs text-gray-400 font-bold bg-white/50 dark:bg-zinc-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-zinc-800">لا توجد طلبات نواقص لـ {activeFamilyMember} حالياً 🎉</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {pendingRequests.map(need => (
                            <div key={need.id} className="bg-white dark:bg-zinc-800/90 rounded-2xl p-3 shadow-sm border border-orange-500/20 hover:border-orange-500/40 transition flex flex-col gap-2 relative overflow-hidden">
                              <div className="absolute top-0 right-0 left-0 h-0.5 bg-gradient-to-r from-orange-500 to-amber-500 rounded-t-2xl" />
                              <div className="flex items-start justify-end gap-0.5">
                                <button onClick={() => { setEditFamilyNeed(need); setFamilyNeedType("need"); setShowFamilyNeedModal(true); }} className="p-1 text-gray-400 hover:text-blue-500 transition rounded-lg">
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button onClick={() => handleDeleteFamilyNeed(need.id)} className="p-1 text-gray-400 hover:text-red-500 transition rounded-lg">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                              <p className="font-black text-xs text-gray-800 dark:text-white line-clamp-2">{need.title}</p>
                              {need.estimatedPrice && Number(need.estimatedPrice) > 0 ? (
                                <div className="font-black text-emerald-600 dark:text-emerald-400 text-xs">{fmt(need.estimatedPrice)} <span className="text-[9px] font-bold opacity-70">د.ع</span></div>
                              ) : null}
                              {need.notes && <p className="text-[9px] text-gray-500 line-clamp-1">{need.notes}</p>}
                              <button onClick={() => handleToggleFamilyNeedStatus(need)} className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[9px] font-black py-1.5 rounded-xl active:scale-95 transition flex items-center justify-center gap-0.5 mt-auto">
                                <Check className="w-2.5 h-2.5" /> توفير
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* قائمة الطلبات المتوفرة */}
                    {availableRequests.length > 0 && (
                      <div className="space-y-2 pt-3 border-t border-pink-500/10">
                        <h4 className="text-xs font-black text-teal-600 dark:text-teal-400 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> طلبات تم توفيرها ({availableRequests.length})
                        </h4>
                        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                          {availableRequests.map(need => (
                            <div key={need.id} className="flex flex-col items-center justify-center text-center bg-white/60 dark:bg-zinc-800/50 rounded-2xl p-3 shadow-sm border border-teal-500/20 opacity-75 hover:opacity-100 transition aspect-square gap-1 relative">
                              <div className="flex-1 flex flex-col justify-center items-center">
                                <PackageCheck className="w-5 h-5 text-teal-500 mb-1" />
                                <p className="font-bold text-[11px] text-gray-700 dark:text-gray-300 line-through decoration-teal-400 leading-tight line-clamp-2">{need.title}</p>
                                {need.estimatedPrice && Number(need.estimatedPrice) > 0 ? (
                                  <span className="text-[9px] font-bold text-teal-600 line-through mt-0.5">{fmt(need.estimatedPrice)} د.ع</span>
                                ) : null}
                                {need.notes && <p className="text-[9px] text-gray-400 mt-1 line-clamp-1">{need.notes}</p>}
                              </div>
                              <div className="flex items-center gap-1 mt-auto pt-1 w-full border-t border-teal-500/10">
                                <button onClick={() => handleDeleteFamilyNeed(need.id)} className="p-1 text-gray-400 hover:text-red-500 transition">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                                <button onClick={() => handleToggleFamilyNeedStatus(need)} className="flex-1 bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 text-[9px] font-black px-1.5 py-1 rounded-lg active:scale-95 transition">
                                  نواقص 🔄
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
            })()}
          </div>
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
              <button onClick={() => { setShowInstallmentModal(false); setEditInstallment(null); }} className="p-2 bg-gray-100 dark:bg-zinc-800 rounded-full">
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
              <button onClick={() => { setShowBillModal(false); setEditBill(null); }} className="p-2 bg-gray-100 dark:bg-zinc-800 rounded-full">
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
              <button type="submit" className="w-full bg-gradient-to-l from-amber-500 to-yellow-500 text-white font-black py-3.5 rounded-xl shadow-lg mt-2 active:scale-[0.98] transition">
                حفظ
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── Expense Modal ─── */}
      {(showExpenseModal || !!editExpense) && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center">
          <div className="bg-white dark:bg-zinc-950 w-full sm:max-w-sm rounded-t-[32px] sm:rounded-[32px] px-5 pt-5 pb-8 shadow-2xl animate-in slide-in-from-bottom-10 duration-200 border border-gray-100 dark:border-zinc-800 max-h-[calc(100svh-80px)] overflow-y-auto mb-[80px] sm:mb-0">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-black text-gray-900 dark:text-white">{editExpense ? "تعديل المصروف" : "تسجيل مصروف"}</h3>
              <button onClick={() => { setShowExpenseModal(false); setEditExpense(null); }} className="p-2 bg-gray-100 dark:bg-zinc-800 rounded-full">
                <X className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSaveExpense} className="space-y-3">
              <div className="relative">
                <label className="label-sm">وصف المصروف</label>
                <input name="name" type="text" required autoComplete="off" 
                  value={expNameInput || editExpense?.name || ""}
                  onChange={e => {
                    setExpNameInput(e.target.value);
                    setShowExpSuggestions(e.target.value.length >= 1);
                  }}
                  onFocus={() => setShowExpSuggestions(expNameInput.length >= 1)}
                  onBlur={() => setTimeout(() => setShowExpSuggestions(false), 200)}
                  className="input-field" placeholder="مثال: بنزين السيارة" />
                
                {showExpSuggestions && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                    {uniqueNames.filter(n => n.includes(expNameInput)).map((suggestedName, idx) => (
                      <div key={idx} onClick={() => { setExpNameInput(suggestedName); setShowExpSuggestions(false); }} className="px-4 py-2 hover:bg-orange-50 dark:hover:bg-zinc-700 cursor-pointer text-sm font-bold text-gray-800 dark:text-gray-200">
                        {suggestedName}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="label-sm">الفئة</label>
                <select name="category" defaultValue={editExpense?.category || "سوبر ماركت"} className="input-field">
                  {EXPENSE_CATEGORIES.map(c => <option key={c.label} value={c.label}>{c.icon} {c.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-sm">المبلغ (د.ع)</label>
                  <input autoComplete="off" name="amount" type="number" defaultValue={editExpense?.amount} required placeholder="0" className="input-field" />
                </div>
                <div>
                  <label className="label-sm">التاريخ</label>
                  <input autoComplete="off" name="date" type="date" defaultValue={editExpense?.date || today()} required className="input-field" />
                </div>
              </div>
              <button type="submit" className="w-full bg-gradient-to-l from-rose-500 to-pink-600 text-white font-black py-3.5 rounded-xl shadow-lg mt-2 active:scale-[0.98] transition">
                حفظ
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── Income Modal ─── */}
      {(showIncomeModal || !!editIncome) && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center">
          <div className="bg-white dark:bg-zinc-950 w-full sm:max-w-sm rounded-t-[32px] sm:rounded-[32px] px-5 pt-5 pb-8 shadow-2xl animate-in slide-in-from-bottom-10 duration-200 border border-gray-100 dark:border-zinc-800 max-h-[calc(100svh-80px)] overflow-y-auto mb-[80px] sm:mb-0">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-black text-gray-900 dark:text-white">{editIncome ? "تعديل الدخل" : "تسجيل دخل"}</h3>
              <button onClick={() => { setShowIncomeModal(false); setEditIncome(null); }} className="p-2 bg-gray-100 dark:bg-zinc-800 rounded-full">
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
              <button onClick={() => { setShowInventoryModal(false); setEditInventory(null); }} className="p-2 bg-gray-100 dark:bg-zinc-800 rounded-full">
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
        {/* NEEDS MODAL */}
        {showNeedModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-5 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-gray-50/50 dark:bg-zinc-800/50">
                <h3 className="font-black text-gray-800 dark:text-white text-lg">{editNeed ? "تعديل احتياج" : "إضافة احتياج"}</h3>
                <button onClick={() => { setShowNeedModal(false); setEditNeed(null); }} className="p-2 bg-white dark:bg-zinc-800 rounded-full text-gray-400 hover:text-gray-600 transition shadow-sm">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleSaveNeed} className="p-5 space-y-4">
                <div className="relative">
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">الاحتياج</label>
                  <input name="name" type="text" required autoComplete="off" 
                    value={needNameInput || editNeed?.name || ""}
                    onChange={e => {
                      setNeedNameInput(e.target.value);
                      setShowNeedSuggestions(e.target.value.length >= 1);
                    }}
                    onFocus={() => setShowNeedSuggestions(needNameInput.length >= 1)}
                    onBlur={() => setTimeout(() => setShowNeedSuggestions(false), 200)}
                    className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-800 dark:text-white focus:ring-2 focus:ring-orange-500/50 outline-none transition" />
                  
                  {showNeedSuggestions && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                      {Array.from(new Set([...inventory.map(i=>i.name), ...needs.map(n=>n.name)])).filter(n => n.includes(needNameInput)).map((suggestedName, idx) => (
                        <div key={idx} onClick={() => { setNeedNameInput(suggestedName); setShowNeedSuggestions(false); }} className="px-4 py-2 hover:bg-orange-50 dark:hover:bg-zinc-700 cursor-pointer text-sm">
                          {suggestedName}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">التصنيف</label>
                    <select name="category" defaultValue={editNeed?.category || (activeTab === "car" ? "صيانة" : activeTab === "travel" ? "أمتعة" : "سوبر ماركت")}
                      className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-orange-500/50 outline-none">
                      {(activeTab === "car" ? CAR_INVENTORY_CATEGORIES : activeTab === "travel" ? TRAVEL_INVENTORY_CATEGORIES : HOME_INVENTORY_CATEGORIES).map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">الكمية</label>
                    <input name="quantity" type="number" step="0.1" required defaultValue={editNeed?.neededQuantity || 1}
                      className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-orange-500/50 outline-none" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">الوحدة</label>
                    <select name="unit" defaultValue={editNeed?.unit || "قطعة"}
                      className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-orange-500/50 outline-none">
                      {HOME_INVENTORY_UNITS.map(u => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">السعر التقديري</label>
                    <input name="price" type="number" defaultValue={editNeed?.estimatedPrice}
                      className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-orange-500/50 outline-none" />
                  </div>
                </div>

                <DetailsInput defaultValue={editNeed?.notes || ""} isRequired={false} />

                <button type="submit" className="w-full bg-orange-500 text-white font-black py-3.5 rounded-2xl shadow-lg shadow-orange-500/25 active:scale-[0.98] transition">
                  حفظ
                </button>
              </form>
            </div>
          </div>
        )}

        {/* DEBTS MODAL */}
        {showDebtModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-5 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-gray-50/50 dark:bg-zinc-800/50">
                <h3 className="font-black text-gray-800 dark:text-white text-lg">{editDebt ? "تعديل سجل" : "إضافة سجل"}</h3>
                <button onClick={() => { setShowDebtModal(false); setEditDebt(null); }} className="p-2 bg-white dark:bg-zinc-800 rounded-full text-gray-400 hover:text-gray-600 transition shadow-sm">
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
              <button onClick={() => { setShowFuturePlanModal(false); setEditFuturePlan(null); setFuturePlanSteps([]); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-100 dark:bg-zinc-800 rounded-full p-1.5 transition">
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
      {/* ═══════════════ AI CHAT FAB & WINDOW ═══════════════ */}
      <button 
        onClick={() => setShowAIChat(!showAIChat)}
        className="fixed bottom-6 left-6 z-50 bg-gradient-to-tr from-purple-600 to-indigo-600 text-white p-4 rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center group"
      >
        {showAIChat ? <X className="w-6 h-6" /> : <Bot className="w-6 h-6 group-hover:animate-bounce" />}
      </button>

      {showAIChat && (
        <div className="fixed bottom-24 left-6 z-50 w-[350px] max-w-[calc(100vw-48px)] bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-zinc-800 flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 duration-300">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-sm">المساعد الذكي</h3>
                <p className="text-[10px] text-white/80 font-bold">متصل الآن • تجريبي</p>
              </div>
            </div>
          </div>
          
          <div className="h-[350px] overflow-y-auto p-4 bg-gray-50 dark:bg-zinc-900/50 flex flex-col gap-3 custom-scrollbar">
            {aiChatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm font-bold ${
                  msg.sender === 'user' 
                  ? 'bg-indigo-500 text-white rounded-br-sm' 
                  : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 border border-gray-100 dark:border-zinc-700 rounded-bl-sm shadow-sm'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
          
          <div className="p-3 bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-zinc-800">
            <form onSubmit={e => {
              e.preventDefault();
              if (!aiChatInput.trim()) return;
              setAiChatMessages([...aiChatMessages, { sender: 'user', text: aiChatInput }]);
              setAiChatInput("");
              setTimeout(() => {
                setAiChatMessages(prev => [...prev, { sender: 'ai', text: 'أنا هنا لمساعدتك! لاحظ أنني حالياً بنسخة تجريبية مبدئية، سيتم تفعيل قدراتي الكاملة قريباً.' }]);
              }, 1000);
            }} className="flex items-center gap-2 bg-gray-50 dark:bg-zinc-800 p-1.5 rounded-full">
              <input 
                type="text" 
                value={aiChatInput} 
                onChange={e => setAiChatInput(e.target.value)} 
                placeholder="اكتب رسالتك هنا..." 
                className="flex-1 bg-transparent border-none text-sm font-bold px-3 py-2 text-gray-800 dark:text-gray-200 focus:outline-none"
              />
              <button type="submit" disabled={!aiChatInput.trim()} className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white p-2 rounded-full transition shrink-0">
                <Send className="w-4 h-4 rtl:-scale-x-100" />
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
