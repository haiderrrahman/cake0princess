"use client";
import { customConfirm } from '@/lib/customConfirm';
import { toast } from "sonner";
import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { compressImage } from "@/lib/imageUtils";
import {
  Plus, Trash2, Edit2, Image as ImageIcon, Loader2, ChevronLeft, X,
  UploadCloud, ArrowRight, Sparkles, ExternalLink, Copy, Check, Eye,
  Smartphone, Tag, Link2, Flame, Crown, Clock, Award, Layers, ShieldCheck
} from "lucide-react";
import Link from "next/link";

type Banner = {
  id: string;
  title: string;
  tag: string;
  link: string;
  image: string;
  createdAt?: string;
  isActive?: boolean;
};

// Preset Quick Tags
const QUICK_TAG_PRESETS = [
  { label: "👑 جديد كيك الأميرة", tag: "جديد كيك الأميرة", color: "from-pink-500 to-rose-600" },
  { label: "🔥 خصم خاص وحصري", tag: "خصم خاص وحصري", color: "from-amber-500 to-red-600" },
  { label: "⏳ لفترة محدودة", tag: "لفترة محدودة", color: "from-purple-500 to-indigo-600" },
  { label: "🎂 كيكات الأعراس", tag: "تشكيلة الأعراس", color: "from-emerald-500 to-teal-700" },
  { label: "🎓 دورة كيك جديدة", tag: "أكاديمية الكيك", color: "from-cyan-500 to-blue-700" },
  { label: "✨ الأكثر طلباً", tag: "الأكثر طلباً", color: "from-yellow-400 to-amber-600" },
];

// Preset Quick Links
const QUICK_LINK_PRESETS = [
  { name: "متجر الكيك العام", link: "/shop", icon: "🛒" },
  { name: "كيكات المناسبات", link: "/products", icon: "🎂" },
  { name: "دورات الأكاديمية", link: "/courses", icon: "🎓" },
  { name: "العروض والخصومات", link: "/offers", icon: "🏷️" },
  { name: "طلب كيكة خاصة", link: "/custom-orders", icon: "👑" },
  { name: "المسابقات والجوائز", link: "/competitions", icon: "🏆" },
];

export default function AdminBanners() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [tag, setTag] = useState("👑 جديد كيك الأميرة");
  const [link, setLink] = useState("/shop");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "banners"));
      const items = querySnapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Banner)
      );
      setBanners(items);
    } catch (error) {
      console.error("Error fetching banners:", error);
      toast.error("حدث خطأ أثناء تحميل البنرات");
    }
    setLoading(false);
  };

  const resetForm = () => {
    setTitle("");
    setTag("👑 جديد كيك الأميرة");
    setLink("/shop");
    setImageFile(null);
    setImagePreviewUrl("");
    setEditingBanner(null);
    setIsFormOpen(false);
  };

  const handleEditClick = (banner: Banner) => {
    setEditingBanner(banner);
    setTitle(banner.title || "");
    setTag(banner.tag || "👑 جديد كيك الأميرة");
    setLink(banner.link || "/shop");
    setImageFile(null);
    setImagePreviewUrl(banner.image || "");
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setImageFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setImagePreviewUrl(url);
    }
  };

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !tag.trim() || !link.trim()) {
      toast.error("يرجى ملء جميع الحقول الإلزامية");
      return;
    }
    if (!editingBanner && !imageFile) {
      toast.error("يرجى اختيار صورة للبنر");
      return;
    }

    setUploading(true);
    try {
      let imageUrl = editingBanner?.image || "";

      // 1. Upload compressed image to Firebase Storage
      if (imageFile) {
        toast.info("جاري ضغط ورفع صورة البنر بتقنية عالية...");
        const compressed = await compressImage(imageFile);
        const storageRef = ref(storage, `banners/${Date.now()}_${compressed.name}`);
        await uploadBytes(storageRef, compressed);
        imageUrl = await getDownloadURL(storageRef);
      }

      // 2. Save banner to Firestore
      if (editingBanner) {
        await updateDoc(doc(db, "banners", editingBanner.id), {
          title: title.trim(),
          tag: tag.trim(),
          link: link.trim(),
          ...(imageFile ? { image: imageUrl } : {}),
          updatedAt: new Date().toISOString(),
        });
        toast.success("✅ تم تحديث البنر بنجاح");
      } else {
        await addDoc(collection(db, "banners"), {
          title: title.trim(),
          tag: tag.trim(),
          link: link.trim(),
          image: imageUrl,
          isActive: true,
          createdAt: new Date().toISOString(),
        });
        toast.success("✅ تم إنشاء ونشر البنر بنجاح");
      }

      resetForm();
      fetchBanners();
    } catch (error: any) {
      console.error("Error saving banner:", error);
      toast.error("حدث خطأ أثناء حفظ البنر: " + (error.message || "خطأ غير معروف"));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, bannerTitle: string) => {
    const confirmed = await customConfirm(
      `هل أنتِ متأكدة من حذف بنر "${bannerTitle}" نهائياً من المتجر؟`
    );
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "banners", id));
      setBanners((prev) => prev.filter((p) => p.id !== id));
      toast.success("تم حذف البنر بنجاح");
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("حدث خطأ أثناء حذف البنر");
    }
  };

  const copyBannerLink = (bannerLink: string, id: string) => {
    navigator.clipboard.writeText(bannerLink);
    setCopiedId(id);
    toast.success("تم نسخ الرابط إلى الحافظة 📋");
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Preview Image URL
  const effectivePreviewImage = imagePreviewUrl || editingBanner?.image || "";

  return (
    <div className="min-h-screen bg-[#07050e] text-slate-100 pb-32 font-sans relative selection:bg-pink-500 selection:text-white">
      {/* Background Holographic Atmosphere */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 right-[-10%] w-[500px] h-[500px] bg-pink-600/15 rounded-full blur-[140px]" />
        <div className="absolute top-1/2 left-[-15%] w-[450px] h-[450px] bg-purple-600/15 rounded-full blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />
      </div>

      <div className="relative z-10">
        {/* ═══════════════ HEADER ═══════════════ */}
        <header className="pt-12 pb-6 px-4 sm:px-6 border-b border-white/10 bg-gradient-to-b from-[#130b24]/90 via-[#0d081b]/80 to-transparent backdrop-blur-xl">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link
                href="/admin"
                className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white transition active:scale-95 shrink-0"
              >
                <ArrowRight className="w-5 h-5" />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-1.5">
                    استوديو البنرات والحملات <span className="text-pink-400">🖼️</span>
                  </h1>
                  <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-pink-500/20 border border-pink-500/30 text-[10px] font-black text-pink-300">
                    Live Studio
                  </span>
                </div>
                <p className="text-xs text-purple-200/80 font-bold mt-0.5">
                  تصميم، جدولة، ومعاينة البنرات التفاعلية في الواجهة الرئيسية للمتجر
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (isFormOpen) resetForm();
                else {
                  resetForm();
                  setIsFormOpen(true);
                }
              }}
              className={`${
                isFormOpen
                  ? "bg-white/10 text-white border border-white/20 hover:bg-white/20"
                  : "bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white shadow-lg shadow-pink-500/30"
              } px-4 py-2.5 rounded-2xl flex items-center gap-2 text-xs sm:text-sm font-black transition active:scale-95`}
            >
              {isFormOpen ? (
                <>
                  <X className="w-4 h-4" /> إلغاء
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" /> إضافة بنر جديد
                </>
              )}
            </button>
          </div>
        </header>

        {/* ═══════════════ MAIN CONTENT ═══════════════ */}
        <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-8">
          {/* STATS OVERVIEW CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-4 backdrop-blur-md">
              <span className="text-[11px] text-purple-300 font-bold flex items-center gap-1.5 mb-1">
                <Layers className="w-3.5 h-3.5 text-purple-400" /> إجمالي البنرات
              </span>
              <p className="text-2xl font-black text-white">{banners.length}</p>
              <p className="text-[10px] text-slate-400 mt-1">حملات تسويقية نشطة</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-4 backdrop-blur-md">
              <span className="text-[11px] text-pink-300 font-bold flex items-center gap-1.5 mb-1">
                <Smartphone className="w-3.5 h-3.5 text-pink-400" /> موقع الظهور
              </span>
              <p className="text-base sm:text-lg font-black text-pink-300">أعلى المتجر</p>
              <p className="text-[10px] text-slate-400 mt-1">سلايدر الصفحة الرئيسية</p>
            </div>

            <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-purple-950/40 to-pink-950/30 border border-purple-500/30 rounded-3xl p-4 backdrop-blur-md">
              <span className="text-[11px] text-emerald-300 font-bold flex items-center gap-1.5 mb-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> التفاعل الفوري
              </span>
              <p className="text-base sm:text-lg font-black text-white">توجيه مباشر</p>
              <p className="text-[10px] text-slate-300 mt-1">ينقل الزبون بلمسة واحدة</p>
            </div>
          </div>

          {/* ═══════════════ INTERACTIVE STUDIO FORM & LIVE PREVIEW ═══════════════ */}
          {isFormOpen && (
            <div className="bg-gradient-to-br from-[#120b22] to-[#1a0f30] border border-pink-500/30 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-6 backdrop-blur-xl animate-fade-in">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h2 className="text-lg font-black text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-pink-400" />
                    {editingBanner ? "تعديل بنر الحملة" : "إنشاء وتصميم بنر جديد"}
                  </h2>
                  <p className="text-xs text-purple-300/80 font-bold mt-0.5">
                    املئي البيانات وشاهدي المعاينة الحية فوراً كما ستظهر للزبائن
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetForm}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* FORM FIELDS (7 COLS) */}
                <form onSubmit={handleSaveBanner} className="lg:col-span-7 space-y-4">
                  {/* Banner Title */}
                  <div>
                    <label className="text-xs font-bold text-slate-300 mb-1.5 block">
                      العنوان الرئيسي للبنر <span className="text-pink-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="مثال: تشكيلة كيكات ملكية بنكهة الحلم ✨"
                      className="w-full bg-white/5 border border-white/15 focus:border-pink-500 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none transition"
                    />
                  </div>

                  {/* Banner Tag & Tag Presets */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                        <Tag className="w-3.5 h-3.5 text-pink-400" />
                        الكلمة الدلالية (التاج) <span className="text-pink-400">*</span>
                      </label>
                      <span className="text-[10px] text-pink-400 font-bold">اختيار سريع</span>
                    </div>
                    <input
                      type="text"
                      required
                      value={tag}
                      onChange={(e) => setTag(e.target.value)}
                      placeholder="مثال: عرض خاص، جديد الأميرة..."
                      className="w-full bg-white/5 border border-white/15 focus:border-pink-500 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none transition mb-2"
                    />

                    {/* Quick Tag Chips */}
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_TAG_PRESETS.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setTag(p.tag)}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-xl border transition ${
                            tag === p.tag
                              ? "bg-pink-600 text-white border-pink-500 shadow-md"
                              : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Target Link & Link Presets */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                        <Link2 className="w-3.5 h-3.5 text-cyan-400" />
                        رابط التوجيه عند الضغط <span className="text-pink-400">*</span>
                      </label>
                      <span className="text-[10px] text-cyan-400 font-bold">الوجهة المستهدفة</span>
                    </div>
                    <input
                      type="text"
                      required
                      dir="ltr"
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      placeholder="/shop"
                      className="w-full bg-white/5 border border-white/15 focus:border-cyan-500 rounded-2xl px-4 py-3 text-sm font-mono font-bold text-cyan-300 focus:outline-none transition mb-2"
                    />

                    {/* Quick Link Chips */}
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_LINK_PRESETS.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setLink(p.link)}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-xl border flex items-center gap-1 transition ${
                            link === p.link
                              ? "bg-cyan-600 text-white border-cyan-500 shadow-md"
                              : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
                          }`}
                        >
                          <span>{p.icon}</span>
                          <span>{p.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Image Upload Professional Dropzone */}
                  <div>
                    <label className="text-xs font-bold text-slate-300 mb-1.5 block">
                      صورة البنر عالية الدقة (عريضة أفقياً 16:9) {!editingBanner && <span className="text-pink-400">*</span>}
                    </label>
                    <label className="w-full h-36 bg-white/5 hover:bg-white/10 border-2 border-dashed border-white/20 hover:border-pink-500 rounded-3xl flex flex-col items-center justify-center cursor-pointer transition-all relative overflow-hidden group">
                      {effectivePreviewImage ? (
                        <div className="relative w-full h-full">
                          <img
                            src={effectivePreviewImage}
                            alt="Banner Preview"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-xs text-white font-bold flex items-center gap-1.5 bg-pink-600 px-3 py-1.5 rounded-xl shadow-lg">
                              <Edit2 className="w-4 h-4" /> تغيير الصورة
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center p-4 text-center">
                          <div className="w-12 h-12 bg-pink-500/20 text-pink-400 rounded-2xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                            <UploadCloud className="w-6 h-6" />
                          </div>
                          <span className="text-xs font-bold text-white">اضغطي هنا أو اسحبي صورة البنر</span>
                          <span className="text-[10px] text-slate-400 mt-1">سيتم ضغط الصورة تلقائياً لسرعة تصفح فائقة</span>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={uploading}
                      className="w-full bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 disabled:opacity-50 text-white font-black py-3.5 rounded-2xl shadow-xl shadow-pink-500/30 flex items-center justify-center gap-2 text-sm transition active:scale-95"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>جاري الحفظ ورفع البنر...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-5 h-5" />
                          <span>{editingBanner ? "تحديث البنر في المتجر" : "نشر البنر الآن"}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* HOLOGRAPHIC LIVE APP PREVIEW (5 COLS) */}
                <div className="lg:col-span-5 bg-black/40 border border-white/10 rounded-3xl p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-pink-300">
                    <span className="flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-pink-400" />
                      معاينة حية فورية (App Mockup)
                    </span>
                    <span className="text-[10px] bg-pink-500/20 text-pink-300 px-2 py-0.5 rounded-full font-bold">
                      شاشة الزبون
                    </span>
                  </div>

                  {/* Simulated Mobile Card */}
                  <div className="w-full rounded-2xl overflow-hidden border border-white/15 bg-[#140c24] relative shadow-2xl aspect-[16/9] flex flex-col justify-end p-4 group">
                    {effectivePreviewImage ? (
                      <img
                        src={effectivePreviewImage}
                        alt="Preview"
                        className="absolute inset-0 w-full h-full object-cover brightness-90 group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-900 to-pink-900 flex items-center justify-center text-white/30 text-xs">
                        بانتظار اختيار الصورة...
                      </div>
                    )}

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                    {/* Banner Content Overlay */}
                    <div className="relative z-10 space-y-1.5">
                      <span className="inline-block bg-gradient-to-r from-pink-500 to-rose-600 text-white font-black text-[10px] px-2.5 py-0.5 rounded-full shadow-lg">
                        {tag || "جديد كيك الأميرة"}
                      </span>
                      <h3 className="font-black text-sm sm:text-base text-white tracking-tight drop-shadow-md leading-snug line-clamp-2">
                        {title || "العنوان الرئيسي سيظهر هنا بشكل بارز"}
                      </h3>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] bg-white/20 backdrop-blur-md text-white font-black px-3 py-1 rounded-xl flex items-center gap-1 shadow-sm">
                          <span>استكشف الآن</span>
                          <ChevronLeft className="w-3 h-3" />
                        </span>
                        <span className="text-[9px] font-mono text-cyan-300 bg-black/50 px-2 py-0.5 rounded-md" dir="ltr">
                          {link || "/shop"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 text-center font-bold">
                    هكذا سيظهر البنر للزبون عند تصفح تطبيق ومتجر كيك الأميرة 👑
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════ ACTIVE BANNERS GALLERY ═══════════════ */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-black text-slate-200 flex items-center gap-2">
                <Crown className="w-4 h-4 text-pink-400" />
                البنرات المعروضة حالياً ({banners.length})
              </h2>
              <span className="text-[11px] text-slate-400 font-bold">تحديث فوري عند التعديل</span>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center p-16 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
                <p className="text-xs text-slate-400 font-bold">جاري تحميل البنرات...</p>
              </div>
            ) : banners.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-3xl p-12 text-center space-y-3">
                <div className="w-14 h-14 bg-pink-500/10 text-pink-400 rounded-3xl flex items-center justify-center mx-auto">
                  <ImageIcon className="w-7 h-7" />
                </div>
                <h3 className="text-base font-black text-white">لا توجد بنرات منشورة بعد</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  أضيفي أول بنر ترويجي للواجهة الرئيسية لجذب الزبائن لعروض الكيك وورشات الأكاديمية!
                </p>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(true)}
                  className="bg-gradient-to-r from-pink-500 to-rose-600 text-white font-black px-4 py-2.5 rounded-2xl text-xs inline-flex items-center gap-1.5 shadow-lg shadow-pink-500/20"
                >
                  <Plus className="w-4 h-4" /> إنشاء بنر الآن
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {banners.map((banner) => (
                  <div
                    key={banner.id}
                    className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-pink-500/40 rounded-3xl p-4 transition-all duration-300 backdrop-blur-md flex flex-col justify-between space-y-4 group shadow-lg"
                  >
                    {/* Visual Banner Preview */}
                    <div className="relative w-full aspect-[16/8] rounded-2xl overflow-hidden bg-black/40 border border-white/10">
                      {banner.image ? (
                        <img
                          src={banner.image}
                          alt={banner.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">
                          <ImageIcon className="w-8 h-8 opacity-40" />
                        </div>
                      )}

                      {/* Top Badges */}
                      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                        <span className="bg-black/60 backdrop-blur-md text-pink-300 border border-pink-500/30 text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-sm">
                          {banner.tag || "إعلان"}
                        </span>
                        <span className="bg-emerald-500/80 backdrop-blur-md text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          معروض
                        </span>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="space-y-1">
                      <h3 className="font-black text-sm text-white line-clamp-1">{banner.title}</h3>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-400 font-bold">الوجهة:</span>
                        <span
                          className="font-mono text-cyan-300 bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded-lg text-[10px]"
                          dir="ltr"
                        >
                          {banner.link}
                        </span>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => copyBannerLink(banner.link, banner.id)}
                          className="text-[11px] bg-white/5 hover:bg-white/15 text-slate-300 px-2.5 py-1.5 rounded-xl border border-white/10 flex items-center gap-1 transition"
                          title="نسخ الرابط"
                        >
                          {copiedId === banner.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">تم النسخ</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>نسخ الرابط</span>
                            </>
                          )}
                        </button>

                        <Link
                          href={banner.link}
                          target="_blank"
                          className="text-[11px] bg-white/5 hover:bg-white/15 text-slate-300 px-2.5 py-1.5 rounded-xl border border-white/10 flex items-center gap-1 transition"
                          title="معاينة الصفحة"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>زيارة</span>
                        </Link>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleEditClick(banner)}
                          className="p-2 text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/30 border border-purple-500/20 rounded-xl transition"
                          title="تعديل البنر"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(banner.id, banner.title)}
                          className="p-2 text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-500/30 border border-rose-500/20 rounded-xl transition"
                          title="حذف البنر"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
