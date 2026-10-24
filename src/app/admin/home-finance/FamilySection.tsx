"use client";

import React, { useState, useMemo, useRef } from "react";
import {
  Users,
  Target,
  Heart,
  ShoppingCart,
  ShoppingBag,
  Trophy,
  Plus,
  Check,
  Trash2,
  Edit2,
  Camera,
  Image as ImageIcon,
  Sparkles,
  Loader2,
  Eye,
  X,
  Calendar,
  FileText,
  Stethoscope,
  Pill,
  Flower2,
  Search,
  ExternalLink,
  Star,
  Award,
  AlertTriangle,
  ZoomIn,
  Clock,
  Building2,
  Activity,
  CheckCircle2,
  RotateCw
} from "lucide-react";
import { toast } from "sonner";
import { customConfirm } from "@/lib/customConfirm";
import { uploadImageResiliently, getLocalImage } from "@/lib/hfImageStore";
import { scanHealthRecordWithGemini, ScannedHealthData } from "@/lib/scanHealthRecordClient";
import WomenCycleCare from "./WomenCycleCare";
import FamilyCompetition, { PARTICIPANTS, ParticipantId } from "./FamilyCompetition";
import { FamilyMemberNeed, FamilyHealthRecord, HealthMedicationItem } from "./familyTypes";

interface ExpenseItemSummary {
  id: string;
  name: string;
  quantity?: number;
  price?: number;
  category?: string;
  place?: string;
}

interface ExpenseSummary {
  id: string;
  name: string;
  amount: number;
  date: string;
  category?: string;
  place?: string;
  beneficiary?: string;
  items?: ExpenseItemSummary[];
  receiptImages?: string[];
}

interface FamilySectionProps {
  familyNeeds: FamilyMemberNeed[];
  setFamilyNeeds: React.Dispatch<React.SetStateAction<FamilyMemberNeed[]>>;
  expenses: any[];
  familyHealth: FamilyHealthRecord[];
  setFamilyHealth: React.Dispatch<React.SetStateAction<FamilyHealthRecord[]>>;
  syncToFirebase: (key: string, data: any) => Promise<void>;
  fmt: (n: number) => string;
}

const FAMILY_MEMBERS_LIST = [
  { name: "الكل", emoji: "👨‍👩‍👧‍👦", isAll: true },
  { name: "حيدر", emoji: "👨🏻" },
  { name: "إيمان", emoji: "👩🏻", hasCycle: true },
  { name: "رقية", emoji: "👧🏻", hasCycle: true, compId: "ruqayya" },
  { name: "قنوت", emoji: "👧🏻", compId: "qunoot" },
  { name: "إيڤا", emoji: "👶🏻", compId: "eva" },
  { name: "العائلة", emoji: "🏠" },
];

export default function FamilySection({
  familyNeeds,
  setFamilyNeeds,
  expenses,
  familyHealth,
  setFamilyHealth,
  syncToFirebase,
  fmt
}: FamilySectionProps) {
  // Selected Member & Sub-Tab
  const [activeMember, setActiveMember] = useState<string>("إيمان");
  const [activeSubTab, setActiveSubTab] = useState<"duties" | "health" | "purchases" | "needs" | "competitions">("duties");

  // Health-specific view: "records" vs "womenCycle" (for Iman & Ruqaya)
  const [healthSubView, setHealthSubView] = useState<"records" | "cycle">("records");

  // Filters & Searches
  const [searchQuery, setSearchQuery] = useState("");
  const [dutyFilter, setDutyFilter] = useState<"all" | "pending" | "completed">("all");
  const [needFilter, setNeedFilter] = useState<"all" | "pending" | "completed">("all");
  const [healthTypeFilter, setHealthTypeFilter] = useState<string>("all");

  // Competition inline toggle
  const [showFullCompetition, setShowFullCompetition] = useState(false);

  // Modals
  const [showDutyModal, setShowDutyModal] = useState(false);
  const [editDuty, setEditDuty] = useState<FamilyMemberNeed | null>(null);

  const [showNeedModal, setShowNeedModal] = useState(false);
  const [editNeed, setEditNeed] = useState<FamilyMemberNeed | null>(null);

  const [showHealthModal, setShowHealthModal] = useState(false);
  const [editHealth, setEditHealth] = useState<FamilyHealthRecord | null>(null);
  const [healthImagePreview, setHealthImagePreview] = useState<string | null>(null);
  const [isScanningHealth, setIsScanningHealth] = useState(false);
  const [scanHealthStatus, setScanHealthStatus] = useState("");

  // Lightbox for full-size inspection of Sonar or Prescription photo
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string; recordId?: string } | null>(null);
  const [lightboxFullRes, setLightboxFullRes] = useState<string | null>(null);

  // File input refs for Health scanner
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // ──────────────────────────────────────────
  // FILTERED DATA BY MEMBER
  // ──────────────────────────────────────────
  const isViewingAll = activeMember === "الكل";

  // Duties
  const memberDuties = useMemo(() => {
    return familyNeeds.filter(n => {
      if (n.type !== "duty") return false;
      if (!isViewingAll && n.member !== activeMember) return false;
      return true;
    });
  }, [familyNeeds, activeMember, isViewingAll]);

  // Needs (نواقص)
  const memberNeeds = useMemo(() => {
    return familyNeeds.filter(n => {
      if (n.type === "duty" || n.type === "expense") return false;
      if (!isViewingAll && n.member !== activeMember) return false;
      return true;
    });
  }, [familyNeeds, activeMember, isViewingAll]);

  // Purchases (مشتريات من المصاريف وقائمة العائلة)
  const memberPurchases = useMemo(() => {
    const list: {
      id: string;
      title: string;
      amount: number;
      date: string;
      place?: string;
      category?: string;
      member: string;
      items?: ExpenseItemSummary[];
    }[] = [];

    // From familyNeeds flagged as expense or completed need with price
    familyNeeds.forEach(n => {
      if (!isViewingAll && n.member !== activeMember) return;
      if (n.type === "expense" || (n.type !== "duty" && (n.status === "available" || n.status === "completed") && (n.estimatedPrice || 0) > 0)) {
        list.push({
          id: n.id,
          title: n.title,
          amount: Number(n.estimatedPrice) || 0,
          date: n.expenseDate || n.createdAt?.split("T")[0] || "",
          category: n.category,
          member: n.member,
        });
      }
    });

    // From main expenses that mention member or are tagged with member
    expenses.forEach((exp: any) => {
      const ben = exp.beneficiary || "";
      const expName = exp.name || "";
      const isForMember = isViewingAll || ben === activeMember || expName.includes(activeMember);
      if (isForMember && !list.some(l => l.id === exp.id)) {
        list.push({
          id: exp.id,
          title: exp.name || "مصروف شخصي",
          amount: Number(exp.amount) || 0,
          date: exp.date || "",
          place: exp.place || exp.storeName,
          category: exp.category,
          member: ben || activeMember,
          items: exp.items || []
        });
      }
    });

    // Sort by date descending
    return list.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [familyNeeds, expenses, activeMember, isViewingAll]);

  const totalPurchasesSpend = useMemo(() => {
    return memberPurchases.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [memberPurchases]);

  // Health Records
  const memberHealthRecords = useMemo(() => {
    return familyHealth.filter(h => {
      if (!isViewingAll && h.member !== activeMember) return false;
      return true;
    }).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [familyHealth, activeMember, isViewingAll]);

  // Quick stats per member
  const memberStats = useMemo(() => {
    const stats: Record<string, { duties: number; health: number; purchases: number; needs: number }> = {};
    FAMILY_MEMBERS_LIST.forEach(m => {
      const mName = m.name;
      const isAll = m.isAll;
      const dutiesCount = familyNeeds.filter(n => (isAll || n.member === mName) && n.type === "duty" && n.status === "pending").length;
      const needsCount = familyNeeds.filter(n => (isAll || n.member === mName) && n.type !== "duty" && n.type !== "expense" && n.status === "pending").length;
      const healthCount = familyHealth.filter(h => (isAll || h.member === mName)).length;
      const purchasesSum = familyNeeds
        .filter(n => (isAll || n.member === mName) && (n.type === "expense" || (n.status === "completed" && (n.estimatedPrice || 0) > 0)))
        .reduce((s, n) => s + (Number(n.estimatedPrice) || 0), 0);

      stats[mName] = {
        duties: dutiesCount,
        needs: needsCount,
        health: healthCount,
        purchases: purchasesSum
      };
    });
    return stats;
  }, [familyNeeds, familyHealth]);

  // ──────────────────────────────────────────
  // LIGHTBOX HANDLER
  // ──────────────────────────────────────────
  const handleOpenLightbox = async (imgUrl: string, title: string, recordId?: string) => {
    setLightboxImage({ url: imgUrl, title, recordId });
    setLightboxFullRes(null);
    if (recordId) {
      try {
        const cachedOriginal = await getLocalImage(`hf_${recordId}`);
        if (cachedOriginal) {
          setLightboxFullRes(cachedOriginal);
        }
      } catch (err) {
        // Fallback to url
      }
    }
  };

  // ──────────────────────────────────────────
  // HEALTH AI SCANNER
  // ──────────────────────────────────────────
  const handleHealthImageSelected = async (file: File) => {
    try {
      setIsScanningHealth(true);
      setScanHealthStatus("جاري تجهيز الصورة وضغطها للفحص...");

      // Convert to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setHealthImagePreview(base64);

      // Call Gemini Vision
      const parsed: ScannedHealthData = await scanHealthRecordWithGemini(base64, (status) => {
        setScanHealthStatus(status);
      });

      // Prepare new/edited record
      const newRec: FamilyHealthRecord = {
        id: editHealth?.id || `health-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        member: parsed.suggestedMember && ["حيدر", "إيمان", "رقية", "قنوت", "إيڤا"].includes(parsed.suggestedMember)
          ? parsed.suggestedMember
          : activeMember !== "الكل" ? activeMember : "إيمان",
        title: parsed.title || "سجل صحي جديد",
        type: parsed.type || "sonar",
        typeNameArabic: parsed.typeNameArabic || "سونار",
        date: parsed.date || new Date().toISOString().split("T")[0],
        doctorOrClinic: parsed.doctorOrClinic || "",
        diagnosisOrReason: parsed.diagnosisOrReason || "",
        findings: parsed.findings || "",
        instructions: parsed.instructions || "",
        cost: parsed.cost || undefined,
        medications: parsed.medications || [],
        imageUrl: base64,
        notes: parsed.notes || "",
        createdAt: new Date().toISOString()
      };

      setEditHealth(newRec);
      setShowHealthModal(true);
      toast.success("تم مسح السونار/العلاج وقراءة بنوده بالذكاء الاصطناعي بنجاح 🧠✨");
    } catch (err: any) {
      console.error("Health AI Scan error:", err);
      toast.error(err?.message || "فشل مسح المستند الطبي. يرجى إدخال البيانات يدوياً");
      // Still open modal so user can fill manually
      if (healthImagePreview) {
        setEditHealth({
          id: `health-${Date.now()}`,
          member: activeMember !== "الكل" ? activeMember : "إيمان",
          title: "سجل صحي مرفق بصورة",
          type: "sonar",
          date: new Date().toISOString().split("T")[0],
          imageUrl: healthImagePreview,
          createdAt: new Date().toISOString()
        });
        setShowHealthModal(true);
      }
    } finally {
      setIsScanningHealth(false);
      setScanHealthStatus("");
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  };

  // Save Health Record
  const handleSaveHealthRecord = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editHealth) return;

    try {
      let finalImageUrl = editHealth.imageUrl || "";

      // If it's a new base64 image, upload resiliently to Storage / IndexedDB
      if (finalImageUrl.startsWith("data:image")) {
        toast.info("جاري حفظ الصورة الطبية في السحابة بأعلى دقة ☁️...");
        finalImageUrl = await uploadImageResiliently("health", editHealth.id, finalImageUrl);
      }

      const recordToSave: FamilyHealthRecord = {
        ...editHealth,
        imageUrl: finalImageUrl,
        updatedAt: new Date().toISOString()
      };

      let updatedList: FamilyHealthRecord[];
      const exists = familyHealth.some(h => h.id === recordToSave.id);
      if (exists) {
        updatedList = familyHealth.map(h => h.id === recordToSave.id ? recordToSave : h);
      } else {
        updatedList = [recordToSave, ...familyHealth];
      }

      setFamilyHealth(updatedList);
      await syncToFirebase("familyHealth", updatedList);
      setShowHealthModal(false);
      setEditHealth(null);
      setHealthImagePreview(null);
      toast.success("تم حفظ السجل الطبي والصورة بنجاح 🏥✅");
    } catch (err: any) {
      console.error("Error saving health record:", err);
      toast.error("فشل حفظ السجل الصحي");
    }
  };

  // Delete Health Record (Prompts "هل تريد حذف هذا السجل الصحي؟ نعم / لا")
  const handleDeleteHealthRecord = async (id: string) => {
    if (!(await customConfirm("هل تريد حذف هذا السجل الطبي نهائياً؟", { confirmText: "نعم", cancelText: "لا" }))) {
      return;
    }
    const updated = familyHealth.filter(h => h.id !== id);
    setFamilyHealth(updated);
    await syncToFirebase("familyHealth", updated);
    toast.success("تم حذف السجل الصحي بنجاح 🗑️");
  };

  // ──────────────────────────────────────────
  // DUTY HANDLERS (واجبات)
  // ──────────────────────────────────────────
  const handleToggleDutyStatus = async (duty: FamilyMemberNeed) => {
    const nextStatus: "pending" | "completed" = duty.status === "completed" || duty.status === "available" ? "pending" : "completed";
    const updated = familyNeeds.map(n => n.id === duty.id ? { ...n, status: nextStatus } : n);
    setFamilyNeeds(updated);
    await syncToFirebase("familyNeeds", updated);
    if (nextStatus === "completed") {
      toast.success(`أحسنت! تم إنجاز الواجب لـ ${duty.member} ⭐🎯`);
    }
  };

  const handleSaveDuty = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = (fd.get("title") as string)?.trim();
    if (!title) return toast.error("يرجى كتابة عنوان الواجب");

    const member = (fd.get("member") as string) || (activeMember !== "الكل" ? activeMember : "رقية");
    const priority = (fd.get("priority") as string) || "مهم";
    const notes = (fd.get("notes") as string)?.trim() || "";

    if (editDuty) {
      const updated = familyNeeds.map(n => n.id === editDuty.id ? {
        ...n,
        title,
        member,
        priority,
        notes
      } : n);
      setFamilyNeeds(updated);
      await syncToFirebase("familyNeeds", updated);
      toast.success("تم تعديل الواجب بنجاح");
    } else {
      const newDuty: FamilyMemberNeed = {
        id: `duty-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        type: "duty",
        title,
        member,
        category: "واجبات",
        priority,
        notes,
        status: "pending",
        createdAt: new Date().toISOString()
      };
      const updated = [newDuty, ...familyNeeds];
      setFamilyNeeds(updated);
      await syncToFirebase("familyNeeds", updated);
      toast.success("تمت إضافة الواجب الجديد بنجاح 🎯");
    }

    setShowDutyModal(false);
    setEditDuty(null);
  };

  const handleDeleteDuty = async (id: string) => {
    if (!(await customConfirm("هل تريد حذف هذا الواجب؟", { confirmText: "نعم", cancelText: "لا" }))) {
      return;
    }
    const updated = familyNeeds.filter(n => n.id !== id);
    setFamilyNeeds(updated);
    await syncToFirebase("familyNeeds", updated);
    toast.success("تم حذف الواجب 🗑️");
  };

  // ──────────────────────────────────────────
  // NEED HANDLERS (نواقص واحتياجات)
  // ──────────────────────────────────────────
  const handleToggleNeedStatus = async (need: FamilyMemberNeed) => {
    const nextStatus: "pending" | "completed" = need.status === "completed" || need.status === "available" ? "pending" : "completed";
    const updated = familyNeeds.map(n => n.id === need.id ? { ...n, status: nextStatus } : n);
    setFamilyNeeds(updated);
    await syncToFirebase("familyNeeds", updated);
    toast.success(nextStatus === "completed" ? "تم تحديد الاحتياج كـ متوفر ومكتمل ✅" : "تمت إعادة الاحتياج لقائمة النواقص");
  };

  const handleSaveNeed = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = (fd.get("title") as string)?.trim();
    if (!title) return toast.error("يرجى كتابة اسم الاحتياج");

    const member = (fd.get("member") as string) || (activeMember !== "الكل" ? activeMember : "إيمان");
    const quantity = Number(fd.get("quantity")) || 1;
    const estimatedPrice = Number(fd.get("estimatedPrice")) || 0;
    const priority = (fd.get("priority") as string) || "متوسط";
    const notes = (fd.get("notes") as string)?.trim() || "";

    if (editNeed) {
      const updated = familyNeeds.map(n => n.id === editNeed.id ? {
        ...n,
        title,
        member,
        quantity,
        estimatedPrice,
        priority,
        notes
      } : n);
      setFamilyNeeds(updated);
      await syncToFirebase("familyNeeds", updated);
      toast.success("تم تعديل الاحتياج بنجاح");
    } else {
      const newNeed: FamilyMemberNeed = {
        id: `need-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        type: "need",
        title,
        member,
        category: "عائلة",
        quantity,
        estimatedPrice,
        priority,
        notes,
        status: "pending",
        createdAt: new Date().toISOString()
      };
      const updated = [newNeed, ...familyNeeds];
      setFamilyNeeds(updated);
      await syncToFirebase("familyNeeds", updated);
      toast.success("تمت إضافة الاحتياج إلى النواقص 🛍️");
    }

    setShowNeedModal(false);
    setEditNeed(null);
  };

  const handleDeleteNeed = async (id: string) => {
    if (!(await customConfirm("هل تريد حذف هذا الاحتياج من القائمة؟", { confirmText: "نعم", cancelText: "لا" }))) {
      return;
    }
    const updated = familyNeeds.filter(n => n.id !== id);
    setFamilyNeeds(updated);
    await syncToFirebase("familyNeeds", updated);
    toast.success("تم حذف الاحتياج 🗑️");
  };

  // Priority color map
  const priorityColors: Record<string, string> = {
    "عاجل": "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border-rose-300/50",
    "مهم": "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-300/50",
    "متوسط": "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border-blue-300/50",
    "عادي": "bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-gray-300 border-gray-300/50"
  };

  return (
    <div className="space-y-4">
      {/* Hidden file inputs for Camera & Gallery Health scanning */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleHealthImageSelected(file);
        }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleHealthImageSelected(file);
        }}
      />

      {/* ════════════════════════════════════════════════════════════════
          1. FAMILY MEMBERS RIBBON (شريط أفراد العائلة)
      ════════════════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 rounded-3xl p-3 shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-2 px-1">
          <div className="flex items-center gap-2">
            <span className="text-base">👨‍👩‍👧‍👦</span>
            <h3 className="font-black text-gray-900 dark:text-white text-sm">
              أفراد العائلة
            </h3>
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500">
              اختر الفرد لعرض واجباته، صحته، مشترياته، نواقصه، ومسابقاته
            </span>
          </div>

          {/* Quick AI Health Scan Shortcut */}
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white text-xs font-black shadow-xs active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
            title="تصوير سونار أو علاج وقراءته بالذكاء الاصطناعي"
          >
            <Camera className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">مسح سونار أو علاج 🧠📸</span>
            <span className="sm:hidden">مسح صحي 📸</span>
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 custom-scrollbar">
          {FAMILY_MEMBERS_LIST.map(m => {
            const isSelected = activeMember === m.name;
            const stats = memberStats[m.name] || { duties: 0, health: 0, purchases: 0, needs: 0 };
            const hasPending = stats.duties > 0 || stats.needs > 0;

            return (
              <button
                key={m.name}
                type="button"
                onClick={() => {
                  setActiveMember(m.name);
                  if (m.hasCycle && activeSubTab === "health") {
                    setHealthSubView("records");
                  }
                }}
                className={`flex-shrink-0 px-4 py-2.5 rounded-2xl font-black text-xs transition-all flex items-center gap-2.5 active:scale-95 cursor-pointer relative ${
                  isSelected
                    ? "bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-md shadow-indigo-500/25 scale-[1.02]"
                    : "bg-gray-50 dark:bg-zinc-800/70 text-gray-700 dark:text-gray-300 border border-gray-200/80 dark:border-zinc-700/80 hover:border-indigo-300"
                }`}
              >
                <span className="text-lg">{m.emoji}</span>
                <span className="text-xs sm:text-sm">{m.name}</span>
                {m.hasCycle && (
                  <span className="text-xs" title="مفعل لها ركن صحة ودورة المرأة">🌸</span>
                )}
                {hasPending && (
                  <span className={`w-2 h-2 rounded-full ${isSelected ? "bg-amber-300" : "bg-rose-500"}`} />
                )}
                {stats.health > 0 && (
                  <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full ${isSelected ? "bg-white/20 text-white" : "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300"}`} title="سجلات صحية وسونار">
                    {stats.health} 🩺
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          2. MEMBER PROFILE CARD & THE 5 SECTIONS NAVIGATION
      ════════════════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 rounded-3xl p-4 shadow-xs">
        {/* Header: Member identity + Quick counters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-2xl shadow-xs">
              {FAMILY_MEMBERS_LIST.find(m => m.name === activeMember)?.emoji || "👤"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-gray-900 dark:text-white">
                  {isViewingAll ? "جميع أفراد العائلة" : `ملف: ${activeMember}`}
                </h2>
                {["إيمان", "رقية"].includes(activeMember) && (
                  <span className="text-[10px] font-black bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300 px-2 py-0.5 rounded-full border border-pink-200 dark:border-pink-800/50">
                    ركن صحة ودورة المرأة 🌸
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 font-bold mt-0.5">
                إدارة متكاملة: الواجبات، السجلات الطبية والسونار، المشتريات، النواقص، والتحديات
              </p>
            </div>
          </div>

          {/* Member Metric Badges */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <div className="px-3 py-1.5 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 font-bold border border-violet-200/60 dark:border-violet-800/40 flex items-center gap-1.5">
              <span>🎯 الواجبات:</span>
              <span className="font-black">{memberDuties.filter(d => d.status === "pending").length} مطلوبة</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 font-bold border border-teal-200/60 dark:border-teal-800/40 flex items-center gap-1.5">
              <span>🏥 الصحة:</span>
              <span className="font-black">{memberHealthRecords.length} سجل طبي</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200/60 dark:border-emerald-800/40 flex items-center gap-1.5">
              <span>💳 المشتريات:</span>
              <span className="font-black">{fmt(totalPurchasesSpend)} د.ع</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 font-bold border border-pink-200/60 dark:border-pink-800/40 flex items-center gap-1.5">
              <span>🛍️ النواقص:</span>
              <span className="font-black">{memberNeeds.filter(n => n.status === "pending").length} طلب</span>
            </div>
          </div>
        </div>

        {/* ─── THE 5 SUB-TABS NAVIGATION ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-3">
          {/* 1. الواجبات */}
          <button
            type="button"
            onClick={() => setActiveSubTab("duties")}
            className={`py-3 px-3 rounded-2xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeSubTab === "duties"
                ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/25"
                : "bg-gray-50 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-violet-50 hover:text-violet-700 dark:hover:bg-violet-950/30"
            }`}
          >
            <Target className="w-4 h-4" />
            <span>الواجبات</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeSubTab === "duties" ? "bg-white/20 text-white" : "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"}`}>
              {memberDuties.filter(d => d.status === "pending").length}
            </span>
          </button>

          {/* 2. الصحة (NEW) */}
          <button
            type="button"
            onClick={() => setActiveSubTab("health")}
            className={`py-3 px-3 rounded-2xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeSubTab === "health"
                ? "bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md shadow-teal-500/25"
                : "bg-gray-50 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-teal-50 hover:text-teal-700 dark:hover:bg-teal-950/30"
            }`}
          >
            <Stethoscope className="w-4 h-4" />
            <span>الصحة والسونار</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeSubTab === "health" ? "bg-white/20 text-white" : "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300"}`}>
              {memberHealthRecords.length}
            </span>
          </button>

          {/* 3. المشتريات */}
          <button
            type="button"
            onClick={() => setActiveSubTab("purchases")}
            className={`py-3 px-3 rounded-2xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeSubTab === "purchases"
                ? "bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-md shadow-emerald-500/25"
                : "bg-gray-50 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/30"
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>المشتريات</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeSubTab === "purchases" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"}`}>
              {memberPurchases.length}
            </span>
          </button>

          {/* 4. النواقص */}
          <button
            type="button"
            onClick={() => setActiveSubTab("needs")}
            className={`py-3 px-3 rounded-2xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeSubTab === "needs"
                ? "bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-md shadow-pink-500/25"
                : "bg-gray-50 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-pink-50 hover:text-pink-700 dark:hover:bg-pink-950/30"
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>النواقص</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeSubTab === "needs" ? "bg-white/20 text-white" : "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300"}`}>
              {memberNeeds.filter(n => n.status === "pending").length}
            </span>
          </button>

          {/* 5. المسابقات */}
          <button
            type="button"
            onClick={() => setActiveSubTab("competitions")}
            className={`col-span-2 sm:col-span-1 py-3 px-3 rounded-2xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeSubTab === "competitions"
                ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/25"
                : "bg-gray-50 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/30"
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>المسابقات</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeSubTab === "competitions" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"}`}>
              ⭐
            </span>
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          3. TAB CONTENT WORKSPACES
      ════════════════════════════════════════════════════════════════ */}

      {/* ─────────────────────────────────────────────────────────────
          SECTION A: الواجبات (Duties)
      ───────────────────────────────────────────────────────────── */}
      {activeSubTab === "duties" && (() => {
        const filteredDuties = memberDuties.filter(d => {
          if (dutyFilter === "pending" && d.status !== "pending") return false;
          if (dutyFilter === "completed" && d.status === "pending") return false;
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            return (d.title || "").toLowerCase().includes(q) || (d.notes || "").toLowerCase().includes(q);
          }
          return true;
        });

        return (
          <div className="space-y-3">
            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 p-3 rounded-2xl">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setEditDuty(null);
                    setShowDutyModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-95 text-white text-xs font-black shadow-xs active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة واجب جديد 🎯</span>
                </button>

                {/* Filter Pills */}
                <div className="flex items-center bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setDutyFilter("all")}
                    className={`px-3 py-1 rounded-lg transition ${dutyFilter === "all" ? "bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-xs font-black" : "text-gray-500"}`}
                  >
                    الكل ({memberDuties.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDutyFilter("pending")}
                    className={`px-3 py-1 rounded-lg transition ${dutyFilter === "pending" ? "bg-white dark:bg-zinc-700 text-violet-600 dark:text-violet-400 shadow-xs font-black" : "text-gray-500"}`}
                  >
                    قيد الإنجاز ({memberDuties.filter(d => d.status === "pending").length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDutyFilter("completed")}
                    className={`px-3 py-1 rounded-lg transition ${dutyFilter === "completed" ? "bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-400 shadow-xs font-black" : "text-gray-500"}`}
                  >
                    المنجزة ({memberDuties.filter(d => d.status !== "pending").length})
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="relative min-w-[180px]">
                <Search className="w-3.5 h-3.5 absolute right-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="بحث في الواجبات..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-3 pr-8 py-1.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-violet-500/40"
                />
              </div>
            </div>

            {/* Duties List */}
            {filteredDuties.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 rounded-3xl p-8 text-center">
                <Target className="w-12 h-12 text-violet-400 mx-auto mb-2 opacity-50" />
                <p className="font-black text-gray-800 dark:text-gray-200 text-sm">لا توجد واجبات مسجلة حالياً</p>
                <p className="text-xs text-gray-400 mt-1">اضغط على زر &quot;إضافة واجب جديد&quot; لتسجيل المهام والواجبات المدرسية أو المنزلية</p>
              </div>
            ) : (
              <div className="grid gap-2">
                {filteredDuties.map(duty => {
                  const isDone = duty.status === "completed" || duty.status === "available";
                  return (
                    <div
                      key={duty.id}
                      className={`p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 ${
                        isDone
                          ? "bg-gray-50/70 dark:bg-zinc-900/40 border-gray-200/60 dark:border-zinc-800/60 opacity-60 hover:opacity-100"
                          : "bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800 hover:border-violet-300 shadow-xs"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => handleToggleDutyStatus(duty)}
                          className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center transition active:scale-90 cursor-pointer ${
                            isDone
                              ? "bg-emerald-500 text-white shadow-xs"
                              : "border-2 border-violet-400 text-transparent hover:text-white hover:bg-violet-500 hover:border-violet-500"
                          }`}
                          title={isDone ? "إعادة فتح الواجب" : "تحديد كـ منجز"}
                        >
                          <Check className={`w-4 h-4 ${isDone ? "stroke-[3]" : ""}`} />
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-black text-xs sm:text-sm ${isDone ? "line-through text-gray-400" : "text-gray-900 dark:text-white"}`}>
                              {duty.title}
                            </span>
                            {isViewingAll && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50">
                                {duty.member}
                              </span>
                            )}
                            {duty.priority && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${priorityColors[duty.priority] || priorityColors["متوسط"]}`}>
                                {duty.priority}
                              </span>
                            )}
                          </div>
                          {duty.notes && (
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                              📝 {duty.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditDuty(duty);
                            setShowDutyModal(true);
                          }}
                          className="p-1.5 text-gray-400 hover:text-violet-600 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                          title="تعديل"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDuty(duty.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ─────────────────────────────────────────────────────────────
          SECTION B: الصحة والسونار (Health & Medical Records)
      ───────────────────────────────────────────────────────────── */}
      {activeSubTab === "health" && (() => {
        const isWomenCycleEligible = ["إيمان", "رقية"].includes(activeMember);

        // Filter health records
        const filteredHealth = memberHealthRecords.filter(h => {
          if (healthTypeFilter !== "all" && h.type !== healthTypeFilter) return false;
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            return (
              (h.title || "").toLowerCase().includes(q) ||
              (h.doctorOrClinic || "").toLowerCase().includes(q) ||
              (h.diagnosisOrReason || "").toLowerCase().includes(q) ||
              (h.notes || "").toLowerCase().includes(q)
            );
          }
          return true;
        });

        return (
          <div className="space-y-3">
            {/* Sub-view switcher for Iman & Ruqaya (السجلات الطبية مقابل دورة المرأة) */}
            {isWomenCycleEligible && (
              <div className="flex items-center justify-between gap-2 p-1.5 bg-pink-50/60 dark:bg-pink-950/20 border border-pink-200/60 dark:border-pink-900/30 rounded-2xl">
                <div className="flex items-center gap-2">
                  <Flower2 className="w-4 h-4 text-pink-500" />
                  <span className="font-black text-xs text-pink-900 dark:text-pink-200">
                    رعاية صحة {activeMember}
                  </span>
                </div>
                <div className="flex items-center bg-white dark:bg-zinc-900 p-1 rounded-xl border border-pink-200/50 dark:border-pink-900/40 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setHealthSubView("records")}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                      healthSubView === "records"
                        ? "bg-teal-500 text-white font-black shadow-xs"
                        : "text-gray-600 dark:text-gray-300 hover:text-teal-600"
                    }`}
                  >
                    🩺 السجلات والسونار والعلاج ({memberHealthRecords.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHealthSubView("cycle")}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                      healthSubView === "cycle"
                        ? "bg-pink-500 text-white font-black shadow-xs"
                        : "text-gray-600 dark:text-gray-300 hover:text-pink-600"
                    }`}
                  >
                    🌸 ركن الدورة الشهرية
                  </button>
                </div>
              </div>
            )}

            {/* If Women Cycle Sub-view is selected for Iman or Ruqaya */}
            {isWomenCycleEligible && healthSubView === "cycle" ? (
              <div className="animate-in fade-in duration-300">
                <WomenCycleCare
                  currentMember={activeMember === "رقية" ? "رقية" : "إيمان"}
                  onMemberChange={m => setActiveMember(m)}
                />
              </div>
            ) : (
              <>
                {/* Health Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 p-3 rounded-2xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Camera AI Scan */}
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={isScanningHealth}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:opacity-95 text-white text-xs font-black shadow-xs active:scale-95 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isScanningHealth ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>جاري الفحص بالذكاء الاصطناعي...</span>
                        </>
                      ) : (
                        <>
                          <Camera className="w-4 h-4" />
                          <span>تصوير سونار أو علاج بالكاميرا 🧠📸</span>
                        </>
                      )}
                    </button>

                    {/* Gallery AI Upload */}
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      disabled={isScanningHealth}
                      className="px-3.5 py-2 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 text-xs font-black shadow-xs active:scale-95 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <ImageIcon className="w-4 h-4" />
                      <span>من الاستوديو 🖼️</span>
                    </button>

                    {/* Manual Entry */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditHealth({
                          id: `health-${Date.now()}`,
                          member: activeMember !== "الكل" ? activeMember : "إيمان",
                          title: "",
                          type: "sonar",
                          date: new Date().toISOString().split("T")[0],
                          createdAt: new Date().toISOString()
                        });
                        setHealthImagePreview(null);
                        setShowHealthModal(true);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 text-xs font-black transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إدخال يدوي</span>
                    </button>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1 flex-wrap text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setHealthTypeFilter("all")}
                      className={`px-2.5 py-1 rounded-lg transition ${healthTypeFilter === "all" ? "bg-teal-500 text-white font-black" : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300"}`}
                    >
                      الكل ({memberHealthRecords.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setHealthTypeFilter("sonar")}
                      className={`px-2.5 py-1 rounded-lg transition ${healthTypeFilter === "sonar" ? "bg-teal-500 text-white font-black" : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300"}`}
                    >
                      🩺 سونار ({memberHealthRecords.filter(h => h.type === "sonar").length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setHealthTypeFilter("medication")}
                      className={`px-2.5 py-1 rounded-lg transition ${healthTypeFilter === "medication" ? "bg-teal-500 text-white font-black" : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300"}`}
                    >
                      💊 علاج وأدوية ({memberHealthRecords.filter(h => h.type === "medication").length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setHealthTypeFilter("lab")}
                      className={`px-2.5 py-1 rounded-lg transition ${healthTypeFilter === "lab" ? "bg-teal-500 text-white font-black" : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300"}`}
                    >
                      🧪 تحاليل ({memberHealthRecords.filter(h => h.type === "lab").length})
                    </button>
                  </div>
                </div>

                {/* AI Scanning progress alert */}
                {isScanningHealth && (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-cyan-500/10 border border-teal-500/30 flex items-center gap-3 animate-pulse">
                    <Loader2 className="w-5 h-5 text-teal-600 animate-spin" />
                    <div>
                      <p className="font-black text-teal-900 dark:text-teal-200 text-xs sm:text-sm">
                        {scanHealthStatus || "جاري مسح السونار أو العلاج بالذكاء الاصطناعي 🧠..."}
                      </p>
                      <p className="text-[11px] text-teal-700/80 dark:text-teal-400 mt-0.5">
                        يتم استخراج اسم الطبيب، التشخيص، تفاصيل السونار، وجدول الأدوية بدقة وتجهيز الصورة للأرشفة
                      </p>
                    </div>
                  </div>
                )}

                {/* Health Records List */}
                {filteredHealth.length === 0 ? (
                  <div className="bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 rounded-3xl p-8 text-center">
                    <Stethoscope className="w-12 h-12 text-teal-400 mx-auto mb-2 opacity-50" />
                    <p className="font-black text-gray-800 dark:text-gray-200 text-sm">لا توجد سجلات صحية أو سونار بعد</p>
                    <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                      يمكنك تصوير تقرير السونار، أو راشيتة العلاج، أو علبة الدواء بالكاميرا، وسيقوم الذكاء الاصطناعي بقراءتها وتفريغها تلقائياً مع حفظ الصورة للرجوع إليها مستقبلاً.
                    </p>
                    <div className="flex justify-center gap-2 mt-4">
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Camera className="w-4 h-4" />
                        <span>تصوير سونار أو علاج الآن 📸</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {filteredHealth.map(record => {
                      const typeBadge = {
                        sonar: { label: "سونار", icon: "🩺", color: "bg-teal-100 text-teal-800 dark:bg-teal-950/70 dark:text-teal-300 border-teal-200" },
                        medication: { label: "علاج وأدوية", icon: "💊", color: "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-200" },
                        lab: { label: "تحليل مختبري", icon: "🧪", color: "bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border-purple-200" },
                        report: { label: "تقرير واستشارة", icon: "📋", color: "bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border-blue-200" },
                        other: { label: "سجل صحي", icon: "🏥", color: "bg-gray-100 text-gray-800 dark:bg-zinc-800 dark:text-gray-300 border-gray-200" }
                      }[record.type] || { label: "سجل صحي", icon: "🏥", color: "bg-gray-100 text-gray-800 border-gray-200" };

                      return (
                        <div
                          key={record.id}
                          className="bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 rounded-3xl p-4 shadow-xs hover:border-teal-300 transition-all"
                        >
                          <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                            {/* Left: Thumbnail if image attached */}
                            <div className="flex items-start gap-3 w-full sm:w-auto flex-1 min-w-0">
                              {record.imageUrl && (
                                <div
                                  onClick={() => handleOpenLightbox(record.imageUrl!, record.title, record.id)}
                                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 flex-shrink-0 cursor-pointer relative group shadow-xs"
                                  title="انقر لتكبير ومعاينة الصورة كاملة"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={record.imageUrl}
                                    alt={record.title}
                                    className="w-full h-full object-cover group-hover:scale-105 transition"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                                    <ZoomIn className="w-5 h-5" />
                                  </div>
                                </div>
                              )}

                              {/* Details */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${typeBadge.color} flex items-center gap-1`}>
                                    <span>{typeBadge.icon}</span>
                                    <span>{typeBadge.label}</span>
                                  </span>

                                  {isViewingAll && (
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50">
                                      {record.member}
                                    </span>
                                  )}

                                  <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    <span>{record.date}</span>
                                  </span>

                                  {record.cost && record.cost > 0 && (
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200">
                                      {fmt(Number(record.cost) || 0)} د.ع
                                    </span>
                                  )}
                                </div>

                                <h4 className="font-black text-gray-900 dark:text-white text-sm sm:text-base mt-1.5">
                                  {record.title}
                                </h4>

                                {record.doctorOrClinic && (
                                  <p className="text-xs font-bold text-gray-600 dark:text-gray-300 flex items-center gap-1.5 mt-1">
                                    <Building2 className="w-3.5 h-3.5 text-teal-600" />
                                    <span>{record.doctorOrClinic}</span>
                                  </p>
                                )}

                                {record.diagnosisOrReason && (
                                  <div className="mt-1.5 p-2 rounded-xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-800 text-xs">
                                    <span className="font-bold text-gray-500 dark:text-gray-400">التشخيص / السبب: </span>
                                    <span className="font-black text-gray-800 dark:text-gray-200">{record.diagnosisOrReason}</span>
                                  </div>
                                )}

                                {record.findings && (
                                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1.5 leading-relaxed">
                                    🔍 <span className="font-bold">نتائج الفحص:</span> {record.findings}
                                  </p>
                                )}

                                {/* Medications List if any */}
                                {record.medications && record.medications.length > 0 && (
                                  <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-zinc-800">
                                    <span className="text-[11px] font-black text-rose-700 dark:text-rose-400 flex items-center gap-1 mb-1.5">
                                      <Pill className="w-3 h-3" />
                                      <span>الأدوية الموصوفة ({record.medications.length}):</span>
                                    </span>
                                    <div className="grid gap-1.5">
                                      {record.medications.map((med, mIdx) => (
                                        <div
                                          key={mIdx}
                                          className="p-2 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-xs flex flex-wrap items-center justify-between gap-1.5"
                                        >
                                          <div className="flex items-center gap-1.5 font-black text-gray-900 dark:text-white">
                                            <span>💊 {med.name}</span>
                                          </div>
                                          <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                                            {med.dosage && (
                                              <span className="bg-white dark:bg-zinc-800 px-2 py-0.5 rounded-md font-bold text-gray-700 dark:text-gray-300">
                                                {med.dosage}
                                              </span>
                                            )}
                                            {med.duration && (
                                              <span>المدة: {med.duration}</span>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {record.instructions && (
                                  <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-2 bg-amber-50/60 dark:bg-amber-950/20 p-2 rounded-xl border border-amber-200/50 dark:border-amber-900/30">
                                    💡 <span className="font-bold">تعليمات:</span> {record.instructions}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex sm:flex-col items-center gap-1 self-end sm:self-start">
                              {record.imageUrl && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenLightbox(record.imageUrl!, record.title, record.id)}
                                  className="p-2 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40 rounded-xl transition cursor-pointer"
                                  title="معاينة وتكبير صورة السونار أو العلاج"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditHealth(record);
                                  setHealthImagePreview(record.imageUrl || null);
                                  setShowHealthModal(true);
                                }}
                                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition cursor-pointer"
                                title="تعديل"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteHealthRecord(record.id)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition cursor-pointer"
                                title="حذف"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()}

      {/* ─────────────────────────────────────────────────────────────
          SECTION C: المشتريات (Purchases)
      ───────────────────────────────────────────────────────────── */}
      {activeSubTab === "purchases" && (() => {
        const filteredPurchases = memberPurchases.filter(p => {
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            return (p.title || "").toLowerCase().includes(q) || (p.place || "").toLowerCase().includes(q);
          }
          return true;
        });

        return (
          <div className="space-y-3">
            {/* Header: Total spend summary */}
            <div className="bg-gradient-to-r from-emerald-500/10 via-green-500/5 to-teal-500/10 border border-emerald-500/20 p-4 rounded-3xl flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center text-xl shadow-xs">
                  💳
                </div>
                <div>
                  <h4 className="font-black text-gray-900 dark:text-white text-sm sm:text-base">
                    إجمالي مشتريات ومصاريف {isViewingAll ? "العائلة" : activeMember}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    مجموع ما تم شراؤه وتلبيته من مسواك وطلبات ومصاريف شخصية
                  </p>
                </div>
              </div>
              <div className="text-left">
                <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {fmt(totalPurchasesSpend)}
                </span>
                <span className="text-xs font-bold text-gray-400 mr-1">د.ع</span>
              </div>
            </div>

            {/* Purchases List */}
            {filteredPurchases.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 rounded-3xl p-8 text-center">
                <ShoppingCart className="w-12 h-12 text-emerald-400 mx-auto mb-2 opacity-50" />
                <p className="font-black text-gray-800 dark:text-gray-200 text-sm">لا توجد مشتريات مسجلة بعد</p>
                <p className="text-xs text-gray-400 mt-1">تظهر هنا تلقائياً المواد والمصاريف الشخصية المسجلة في النظام لهذا الفرد</p>
              </div>
            ) : (
              <div className="grid gap-2">
                {filteredPurchases.map(p => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-xs flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-xs sm:text-sm text-gray-900 dark:text-white">
                          {p.title}
                        </span>
                        {isViewingAll && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300">
                            {p.member}
                          </span>
                        )}
                        {p.place && (
                          <span className="text-[10px] font-bold text-gray-500 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                            🏪 {p.place}
                          </span>
                        )}
                        {p.date && (
                          <span className="text-[10px] text-gray-400">
                            📅 {p.date}
                          </span>
                        )}
                      </div>

                      {p.items && p.items.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {p.items.slice(0, 4).map((it, idx) => (
                            <span key={idx} className="text-[10px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-800/80 px-1.5 py-0.5 rounded">
                              {it.name} {it.price ? `(${fmt(Number(it.price) || 0)})` : ""}
                            </span>
                          ))}
                          {p.items.length > 4 && (
                            <span className="text-[10px] text-gray-400 font-bold">
                              +{p.items.length - 4} مواد أخرى
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="text-left flex-shrink-0">
                      <span className="font-black text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">
                        {fmt(p.amount)}
                      </span>
                      <span className="text-[10px] font-bold text-gray-400 mr-1">د.ع</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ─────────────────────────────────────────────────────────────
          SECTION D: النواقص (Needs / Shortages)
      ───────────────────────────────────────────────────────────── */}
      {activeSubTab === "needs" && (() => {
        const filteredNeeds = memberNeeds.filter(n => {
          if (needFilter === "pending" && n.status !== "pending") return false;
          if (needFilter === "completed" && n.status === "pending") return false;
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            return (n.title || "").toLowerCase().includes(q) || (n.notes || "").toLowerCase().includes(q);
          }
          return true;
        });

        return (
          <div className="space-y-3">
            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 p-3 rounded-2xl">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setEditNeed(null);
                    setShowNeedModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:opacity-95 text-white text-xs font-black shadow-xs active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة احتياج جديد 🛍️</span>
                </button>

                {/* Filter Pills */}
                <div className="flex items-center bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setNeedFilter("all")}
                    className={`px-3 py-1 rounded-lg transition ${needFilter === "all" ? "bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-xs font-black" : "text-gray-500"}`}
                  >
                    الكل ({memberNeeds.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setNeedFilter("pending")}
                    className={`px-3 py-1 rounded-lg transition ${needFilter === "pending" ? "bg-white dark:bg-zinc-700 text-pink-600 dark:text-pink-400 shadow-xs font-black" : "text-gray-500"}`}
                  >
                    مطلوبة ({memberNeeds.filter(n => n.status === "pending").length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setNeedFilter("completed")}
                    className={`px-3 py-1 rounded-lg transition ${needFilter === "completed" ? "bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-400 shadow-xs font-black" : "text-gray-500"}`}
                  >
                    تم توفيرها ({memberNeeds.filter(n => n.status !== "pending").length})
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="relative min-w-[180px]">
                <Search className="w-3.5 h-3.5 absolute right-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="بحث في النواقص..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-3 pr-8 py-1.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-pink-500/40"
                />
              </div>
            </div>

            {/* Needs List */}
            {filteredNeeds.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 rounded-3xl p-8 text-center">
                <ShoppingBag className="w-12 h-12 text-pink-400 mx-auto mb-2 opacity-50" />
                <p className="font-black text-gray-800 dark:text-gray-200 text-sm">لا توجد نواقص أو طلبات مسجلة</p>
                <p className="text-xs text-gray-400 mt-1">اضغط على زر &quot;إضافة احتياج جديد&quot; لتسجيل مستلزمات وطلبات هذا الفرد</p>
              </div>
            ) : (
              <div className="grid gap-2">
                {filteredNeeds.map(need => {
                  const isDone = need.status === "completed" || need.status === "available";
                  return (
                    <div
                      key={need.id}
                      className={`p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 ${
                        isDone
                          ? "bg-gray-50/70 dark:bg-zinc-900/40 border-gray-200/60 dark:border-zinc-800/60 opacity-60 hover:opacity-100"
                          : "bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800 hover:border-pink-300 shadow-xs"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => handleToggleNeedStatus(need)}
                          className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center transition active:scale-90 cursor-pointer ${
                            isDone
                              ? "bg-emerald-500 text-white shadow-xs"
                              : "border-2 border-pink-400 text-transparent hover:text-white hover:bg-pink-500 hover:border-pink-500"
                          }`}
                          title={isDone ? "إعادة فتح الطلب" : "تحديد كـ تم توفيره وشراؤه"}
                        >
                          <Check className={`w-4 h-4 ${isDone ? "stroke-[3]" : ""}`} />
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-black text-xs sm:text-sm ${isDone ? "line-through text-gray-400" : "text-gray-900 dark:text-white"}`}>
                              {need.title}
                            </span>
                            {need.quantity && need.quantity > 1 && (
                              <span className="text-[10px] font-black bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded-md">
                                ×{need.quantity}
                              </span>
                            )}
                            {isViewingAll && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50">
                                {need.member}
                              </span>
                            )}
                            {need.priority && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${priorityColors[need.priority] || priorityColors["متوسط"]}`}>
                                {need.priority}
                              </span>
                            )}
                          </div>
                          {need.notes && (
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                              📝 {need.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {need.estimatedPrice && Number(need.estimatedPrice) > 0 ? (
                          <span className="font-black text-xs px-2.5 py-1 rounded-xl bg-pink-50 dark:bg-pink-950/50 text-pink-700 dark:text-pink-300 border border-pink-200/50">
                            <span>{fmt(Number(need.estimatedPrice) || 0)}</span>
                            <span className="text-[9px] font-bold opacity-75 mr-1">د.ع</span>
                          </span>
                        ) : null}

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditNeed(need);
                              setShowNeedModal(true);
                            }}
                            className="p-1.5 text-gray-400 hover:text-pink-600 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                            title="تعديل"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteNeed(need.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                            title="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ─────────────────────────────────────────────────────────────
          SECTION E: المسابقات (Competitions)
      ───────────────────────────────────────────────────────────── */}
      {activeSubTab === "competitions" && (
        <div className="space-y-4">
          {/* Member Competition Banner */}
          <div className="bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-orange-500/10 border border-amber-500/20 p-4 rounded-3xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-600 flex items-center justify-center text-2xl shadow-xs">
                  🏆
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-gray-900 dark:text-white text-base">
                      منافسة العائلة الأسبوعية ⭐
                    </h3>
                    <span className="text-[10px] font-black bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2.5 py-0.5 rounded-full">
                      نقاط وواجبات ومطالعة
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    تحفيز المهام الدراسية، حفظ القرآن، والمطالعة لرقية وقنوت وإيڤا
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowFullCompetition(prev => !prev)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs shadow-sm active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>{showFullCompetition ? "إخفاء لوحة المنافسة ▲" : "عرض لوحة المنافسة التفاعلية 🏆 ▼"}</span>
              </button>
            </div>
          </div>

          {/* Full Interactive Competition Component */}
          {showFullCompetition ? (
            <div className="animate-in fade-in duration-300">
              <FamilyCompetition />
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 rounded-3xl p-6 text-center">
              <Trophy className="w-14 h-14 text-amber-500 mx-auto mb-2 opacity-80" />
              <h4 className="font-black text-gray-900 dark:text-white text-base">
                لوحة منافسة العائلة جاهزة
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
                انقر على زر &quot;عرض لوحة المنافسة التفاعلية&quot; أعلاه لتسجيل نقاط المطالعة، إضافة أو خصم النقاط، وبدء جولات التحدي الأسبوعية.
              </p>
              <button
                type="button"
                onClick={() => setShowFullCompetition(true)}
                className="mt-4 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs shadow-md shadow-amber-500/25 active:scale-95 transition inline-flex items-center gap-2 cursor-pointer"
              >
                <Trophy className="w-4 h-4" />
                <span>فتح لوحة المنافسة والترتيب 🏆</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          4. MODALS (DUTY, NEED, HEALTH, LIGHTBOX)
      ════════════════════════════════════════════════════════════════ */}

      {/* ─── DUTY MODAL ─── */}
      {showDutyModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative text-right">
            <button
              type="button"
              onClick={() => {
                setShowDutyModal(false);
                setEditDuty(null);
              }}
              className="absolute left-4 top-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-violet-600" />
              <span>{editDuty ? "تعديل الواجب" : "إضافة واجب جديد 🎯"}</span>
            </h3>

            <form onSubmit={handleSaveDuty} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  عنوان الواجب أو المهمة *
                </label>
                <input
                  name="title"
                  type="text"
                  required
                  defaultValue={editDuty?.title || ""}
                  placeholder="مثال: حل واجب الرياضيات ص 42، حفظ سورة الفجر..."
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-violet-500/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    فرد العائلة
                  </label>
                  <select
                    name="member"
                    defaultValue={editDuty?.member || (activeMember !== "الكل" ? activeMember : "رقية")}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-violet-500/40"
                  >
                    {FAMILY_MEMBERS_LIST.filter(m => !m.isAll).map(m => (
                      <option key={m.name} value={m.name}>
                        {m.emoji} {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    الأهمية
                  </label>
                  <select
                    name="priority"
                    defaultValue={editDuty?.priority || "مهم"}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-violet-500/40"
                  >
                    <option value="عاجل">عاجل 🔴</option>
                    <option value="مهم">مهم 🟡</option>
                    <option value="متوسط">متوسط 🔵</option>
                    <option value="عادي">عادي ⚪</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  ملاحظات أو تفاصيل إضافية
                </label>
                <textarea
                  name="notes"
                  rows={2}
                  defaultValue={editDuty?.notes || ""}
                  placeholder="أي تعليمات أو موعد تسليم..."
                  className="w-full px-3.5 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-violet-500/40"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-95 text-white font-black text-xs rounded-xl shadow-md shadow-violet-500/25 transition cursor-pointer"
                >
                  {editDuty ? "حفظ التعديلات" : "إضافة الواجب 🎯"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDutyModal(false);
                    setEditDuty(null);
                  }}
                  className="px-4 py-3 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl hover:bg-gray-200 transition cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── NEED MODAL ─── */}
      {showNeedModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative text-right">
            <button
              type="button"
              onClick={() => {
                setShowNeedModal(false);
                setEditNeed(null);
              }}
              className="absolute left-4 top-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-pink-600" />
              <span>{editNeed ? "تعديل الاحتياج" : "إضافة احتياج جديد 🛍️"}</span>
            </h3>

            <form onSubmit={handleSaveNeed} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  اسم الاحتياج أو الطلب *
                </label>
                <input
                  name="title"
                  type="text"
                  required
                  defaultValue={editNeed?.title || ""}
                  placeholder="مثال: حذاء رياضي، دفتر رسم، فيتامينات..."
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-pink-500/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    فرد العائلة
                  </label>
                  <select
                    name="member"
                    defaultValue={editNeed?.member || (activeMember !== "الكل" ? activeMember : "إيمان")}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-pink-500/40"
                  >
                    {FAMILY_MEMBERS_LIST.filter(m => !m.isAll).map(m => (
                      <option key={m.name} value={m.name}>
                        {m.emoji} {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    الأهمية
                  </label>
                  <select
                    name="priority"
                    defaultValue={editNeed?.priority || "متوسط"}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-pink-500/40"
                  >
                    <option value="عاجل">عاجل 🔴</option>
                    <option value="مهم">مهم 🟡</option>
                    <option value="متوسط">متوسط 🔵</option>
                    <option value="عادي">عادي ⚪</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    الكمية
                  </label>
                  <input
                    name="quantity"
                    type="number"
                    min="1"
                    defaultValue={editNeed?.quantity || 1}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-pink-500/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    السعر التقديري (د.ع)
                  </label>
                  <input
                    name="estimatedPrice"
                    type="number"
                    min="0"
                    defaultValue={editNeed?.estimatedPrice || ""}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-pink-500/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  ملاحظات أو مواصفات
                </label>
                <textarea
                  name="notes"
                  rows={2}
                  defaultValue={editNeed?.notes || ""}
                  placeholder="المقاس، اللون، أو المتجر المفضل..."
                  className="w-full px-3.5 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-pink-500/40"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-pink-600 to-rose-600 hover:opacity-95 text-white font-black text-xs rounded-xl shadow-md shadow-pink-500/25 transition cursor-pointer"
                >
                  {editNeed ? "حفظ التعديلات" : "إضافة إلى النواقص 🛍️"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNeedModal(false);
                    setEditNeed(null);
                  }}
                  className="px-4 py-3 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl hover:bg-gray-200 transition cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── HEALTH RECORD MODAL (ADD / EDIT) ─── */}
      {showHealthModal && editHealth && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-xl shadow-2xl relative text-right my-8 max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                setShowHealthModal(false);
                setEditHealth(null);
                setHealthImagePreview(null);
              }}
              className="absolute left-4 top-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-teal-600" />
              <span>تسجيل وتوثيق سجل صحي / سونار / علاج 🏥</span>
            </h3>

            <form onSubmit={handleSaveHealthRecord} className="space-y-4">
              {/* Attached Image Preview */}
              {(healthImagePreview || editHealth.imageUrl) && (
                <div className="relative rounded-2xl overflow-hidden bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 max-h-48 flex items-center justify-center group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={healthImagePreview || editHealth.imageUrl}
                    alt="صورة السونار أو العلاج المرفقة"
                    className="max-h-48 w-full object-contain"
                  />
                  <div className="absolute top-2 left-2 flex gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenLightbox(healthImagePreview || editHealth.imageUrl!, editHealth.title)}
                      className="p-1.5 bg-black/60 text-white rounded-lg hover:bg-black/80 transition"
                      title="تكبير ومعاينة"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHealthImagePreview(null);
                        setEditHealth({ ...editHealth, imageUrl: undefined });
                      }}
                      className="p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                      title="إزالة الصورة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Title & Type */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    عنوان الفحص أو السجل الطبي *
                  </label>
                  <input
                    type="text"
                    required
                    value={editHealth.title}
                    onChange={e => setEditHealth({ ...editHealth, title: e.target.value })}
                    placeholder="مثال: سونار بطن وحوض، راشيتة علاج التهاب، فحص دم..."
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-teal-500/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    نوع السجل
                  </label>
                  <select
                    value={editHealth.type}
                    onChange={e => setEditHealth({ ...editHealth, type: e.target.value as any })}
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-teal-500/40"
                  >
                    <option value="sonar">🩺 سونار</option>
                    <option value="medication">💊 علاج وأدوية</option>
                    <option value="lab">🧪 تحليل مختبري</option>
                    <option value="report">📋 تقرير واستشارة</option>
                    <option value="other">🏥 أخرى</option>
                  </select>
                </div>
              </div>

              {/* Member & Date & Cost */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    فرد العائلة *
                  </label>
                  <select
                    value={editHealth.member}
                    onChange={e => setEditHealth({ ...editHealth, member: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-teal-500/40"
                  >
                    {FAMILY_MEMBERS_LIST.filter(m => !m.isAll).map(m => (
                      <option key={m.name} value={m.name}>
                        {m.emoji} {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    تاريخ الفحص / الزيارة
                  </label>
                  <input
                    type="date"
                    value={editHealth.date}
                    onChange={e => setEditHealth({ ...editHealth, date: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-teal-500/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    التكلفة / الكشفية (د.ع)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editHealth.cost || ""}
                    onChange={e => setEditHealth({ ...editHealth, cost: Number(e.target.value) || undefined })}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-teal-500/40"
                  />
                </div>
              </div>

              {/* Doctor / Clinic & Diagnosis */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    اسم الطبيب أو العيادة أو المستشفى
                  </label>
                  <input
                    type="text"
                    value={editHealth.doctorOrClinic || ""}
                    onChange={e => setEditHealth({ ...editHealth, doctorOrClinic: e.target.value })}
                    placeholder="مثال: د. علي النداوي / مجمع النور الطبي"
                    className="w-full px-3.5 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-teal-500/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    التشخيص أو سبب المراجعة
                  </label>
                  <input
                    type="text"
                    value={editHealth.diagnosisOrReason || ""}
                    onChange={e => setEditHealth({ ...editHealth, diagnosisOrReason: e.target.value })}
                    placeholder="مثال: التهاب لوزتين حاد، متابعة حمل أسبوع 18..."
                    className="w-full px-3.5 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-teal-500/40"
                  />
                </div>
              </div>

              {/* Findings or Sonar Report */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  نتائج السونار / التقرير الطبي
                </label>
                <textarea
                  rows={2}
                  value={editHealth.findings || ""}
                  onChange={e => setEditHealth({ ...editHealth, findings: e.target.value })}
                  placeholder="ما سجله الطبيب في تقرير السونار أو الفحص..."
                  className="w-full px-3.5 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-teal-500/40"
                />
              </div>

              {/* Dynamic Medications List */}
              <div className="pt-2 border-t border-gray-100 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-black text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                    <Pill className="w-3.5 h-3.5" />
                    <span>قائمة الأدوية والعلاجات الموصوفة</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const current = editHealth.medications || [];
                      setEditHealth({
                        ...editHealth,
                        medications: [...current, { name: "", dosage: "", duration: "", notes: "" }]
                      });
                    }}
                    className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>إضافة دواء</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {(editHealth.medications || []).map((med, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 flex items-start gap-2">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
                        <input
                          type="text"
                          placeholder="اسم الدواء والعيار *"
                          value={med.name}
                          onChange={e => {
                            const updated = [...(editHealth.medications || [])];
                            updated[idx].name = e.target.value;
                            setEditHealth({ ...editHealth, medications: updated });
                          }}
                          className="px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg text-xs font-bold"
                        />
                        <input
                          type="text"
                          placeholder="الجرعة (مثال: حبة مرتين يومياً)"
                          value={med.dosage || ""}
                          onChange={e => {
                            const updated = [...(editHealth.medications || [])];
                            updated[idx].dosage = e.target.value;
                            setEditHealth({ ...editHealth, medications: updated });
                          }}
                          className="px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg text-xs font-bold"
                        />
                        <input
                          type="text"
                          placeholder="المدة (مثال: لمدة 5 أيام)"
                          value={med.duration || ""}
                          onChange={e => {
                            const updated = [...(editHealth.medications || [])];
                            updated[idx].duration = e.target.value;
                            setEditHealth({ ...editHealth, medications: updated });
                          }}
                          className="px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg text-xs font-bold"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          if (await customConfirm("هل تريد حذف هذا الدواء من القائمة؟")) {
                            const updated = (editHealth.medications || []).filter((_, i) => i !== idx);
                            setEditHealth({ ...editHealth, medications: updated });
                          }
                        }}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* General Instructions & Notes */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  تعليمات الاستخدام أو ملاحظات عامة
                </label>
                <textarea
                  rows={2}
                  value={editHealth.notes || ""}
                  onChange={e => setEditHealth({ ...editHealth, notes: e.target.value })}
                  placeholder="ملاحظات الطبيب، موعد المراجعة القادمة..."
                  className="w-full px-3.5 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-teal-500/40"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:opacity-95 text-white font-black text-xs rounded-xl shadow-md shadow-teal-500/25 transition cursor-pointer"
                >
                  حفظ السجل الطبي والصورة 🏥💾
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowHealthModal(false);
                    setEditHealth(null);
                    setHealthImagePreview(null);
                  }}
                  className="px-4 py-3 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl hover:bg-gray-200 transition cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── FULL-SCREEN HIGH-RESOLUTION LIGHTBOX ─── */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[95vh] w-full flex flex-col items-center justify-center"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between text-white pb-3 px-2">
              <span className="font-black text-sm sm:text-base flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-teal-400" />
                <span>{lightboxImage.title}</span>
              </span>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/25 text-white transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden max-h-[80vh] flex items-center justify-center bg-zinc-950 border border-white/10 shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxFullRes || lightboxImage.url}
                alt={lightboxImage.title}
                className="max-h-[80vh] max-w-full object-contain"
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-2 text-center">
              الصورة مؤرشفة بدقة كاملة للرجوع إليها مستقبلاً
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
