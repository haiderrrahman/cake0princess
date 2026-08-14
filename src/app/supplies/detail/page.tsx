"use client";
import { Suspense, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ShoppingCart, Loader2, Sparkles, Heart } from "lucide-react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCart } from "@/context/CartContext";
import { useFavorites } from "@/context/FavoritesContext";
import BottomNav from "@/components/layout/BottomNav";

// Fallback DEMO data if not in Firebase yet
const DEMO_SUPPLIES = [
  { id: "s-1", name: "طحين كيك فاخر", price: 4000, image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80", category: "مواد أساسية", description: "طحين كيك فاخر عالي الجودة لنتائج مثالية في الخبز.", stockQuantity: 10 },
  { id: "s-2", name: "كريمة زبدة جاهزة", price: 8000, image: "https://images.unsplash.com/photo-1550617931-e17a7b70dce2?w=400&q=80", category: "كريمات وحشوات", description: "كريمة زبدة جاهزة للاستخدام الفوري، متماسكة وسهلة التشكيل.", stockQuantity: 5 },
  { id: "s-3", name: "حشوة شوكولاتة بلجيكية", price: 12000, image: "https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=400&q=80", category: "كريمات وحشوات", description: "حشوة شوكولاتة بلجيكية أصلية تذوب بالفم وتضيف نكهة لا تقاوم.", stockQuantity: 20 },
  { id: "s-4", name: "شموع أعياد ميلاد", price: 3500, image: "https://images.unsplash.com/photo-1530103043960-ef38714abb15?w=400&q=80", category: "أعياد ميلاد", description: "شموع ملونة وجميلة لتزيين كيك أعياد الميلاد.", stockQuantity: 50 },
  { id: "s-5", name: "كارتون كيك شفاف", price: 2000, image: "https://images.unsplash.com/photo-1587241321921-91a834d6d191?w=400&q=80", category: "علب وتغليف", description: "علب كيك شفافة عالية الجودة لإظهار جمال الكيك وتغليفه بأمان.", stockQuantity: 100 },
  { id: "s-6", name: "أقماع تزيين الكريمة", price: 15000, image: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=400&q=80", category: "أدوات تزيين", description: "مجموعة أقماع تزيين ستانلس ستيل مع أكياس تزيين متينة.", stockQuantity: 8 },
  { id: "s-7", name: "ألوان طعام جل", price: 6000, image: "https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?w=400&q=80", category: "ألوان ونكهات", description: "ألوان طعام جل مركزة تمنح ألواناً زاهية ولا تؤثر على قوام الكريمة.", stockQuantity: 15 },
  { id: "s-8", name: "سبرنكلز ملون للتزيين", price: 4000, image: "https://images.unsplash.com/photo-1514517521153-1be72277b32f?w=400&q=80", category: "أدوات تزيين", description: "سبرنكلز ملون وزاهي لإضافة لمسة سحرية للكيك والكب كيك.", stockQuantity: 25 },
  { id: "s-9", name: "قواعد كيك خشبية", price: 5000, image: "https://images.unsplash.com/photo-1464349153735-7db50ed83c84?w=400&q=80", category: "قوالب", description: "قواعد كيك خشبية قوية ومطلية لتحمل أوزان الكيك بسهولة.", stockQuantity: 30 },
  { id: "s-10", name: "أدوات خفق متكاملة", price: 18000, image: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=400&q=80", category: "قوالب", description: "مجموعة أدوات خفق ومزج أساسية لكل محبي صناعة الكيك.", stockQuantity: 0 },
];

function SupplyDetailsContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") as string;
  const router = useRouter();
  const { addToCart } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [supply, setSupply] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);

  const handleAddToCart = () => {
    if (!supply) return;
    addToCart({
      id: supply.id,
      name: supply.name,
      price: supply.price,
      quantity: quantity,
      image: supply.image || "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=400&q=80",
      isCourse: false,
      isSupply: true,
    });
    router.push("/cart");
  };

  useEffect(() => {
    const fetchSupply = async () => {
      if (!id || typeof id !== "string") return;
      try {
        const docRef = doc(db, "supplies", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSupply({ id: docSnap.id, ...docSnap.data() });
        } else {
          // Check DEMO_SUPPLIES
          const demoItem = DEMO_SUPPLIES.find(s => s.id === id);
          if (demoItem) setSupply(demoItem);
        }
      } catch (error) {
        console.error("Error fetching supply:", error);
        const demoItem = DEMO_SUPPLIES.find(s => s.id === id);
        if (demoItem) setSupply(demoItem);
      }
      setLoading(false);
    };

    fetchSupply();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pink-50/50 dark:bg-zinc-950">
        <Loader2 className="w-10 h-10 animate-spin text-fuchsia-500" />
      </div>
    );
  }

  if (!supply) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-pink-50/50 dark:bg-zinc-950 p-6 text-center">
        <h1 className="text-2xl font-bold mb-4">المادة غير موجودة</h1>
        <Link href="/supplies" className="bg-fuchsia-500 text-white px-6 py-2 rounded-xl hover:bg-fuchsia-600 transition">العودة للمواد</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen pb-48 bg-gray-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-40 p-6 flex justify-between items-center">
        <Link href="/supplies" className="w-10 h-10 bg-white/80 dark:bg-black/80 backdrop-blur-md rounded-full flex items-center justify-center text-gray-800 dark:text-gray-200 hover:bg-white transition shadow-sm border border-gray-100 dark:border-zinc-800">
          <ArrowRight className="w-5 h-5" />
        </Link>
        <div className="flex gap-2">
          <button 
            onClick={() => toggleFavorite({
              id: supply?.id,
              name: supply?.name,
              price: supply?.price,
              image: supply?.image,
              isCourse: false
            })}
            className="w-10 h-10 bg-white/80 dark:bg-black/80 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white transition shadow-sm border border-gray-100 dark:border-zinc-800 relative"
          >
            <Heart className={`w-5 h-5 ${isFavorite(supply?.id) ? 'text-red-500 fill-red-500' : 'text-gray-800 dark:text-gray-200'}`} />
          </button>
        </div>
      </header>

      {/* Image Gallery */}
      <div className="relative w-full aspect-square bg-white dark:bg-zinc-800 shadow-sm">
        {supply.image && (
          <Image 
            src={supply.image} 
            alt={supply.name} 
            fill 
            className="object-cover"
            priority
          />
        )}
      </div>

      {/* Content */}
      <div className="px-6 py-6 bg-white dark:bg-zinc-950 rounded-t-3xl -mt-8 relative z-10 shadow-[0_-8px_30px_rgb(0,0,0,0.04)] border-t border-gray-100 dark:border-zinc-800 flex-1">
        <div className="flex justify-between items-start mb-2">
          <h1 className="text-2xl font-black text-gray-900 dark:text-white leading-tight pr-2">{supply.name}</h1>
          <div className="bg-fuchsia-500/10 text-fuchsia-500 px-3 py-1.5 rounded-xl text-lg font-black flex-shrink-0 border border-fuchsia-500/20">
            {Number(supply.price).toLocaleString()} د.ع
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-6 pb-6 border-b border-gray-100 dark:border-zinc-800">
          <span className="text-xs font-bold text-fuchsia-500 bg-fuchsia-500/10 px-2.5 py-1.5 rounded-lg border border-fuchsia-500/20">{supply.category}</span>
          {(supply.stockQuantity || 0) > 0 ? (
            <span className="text-xs font-bold text-green-500 bg-green-500/10 px-2.5 py-1.5 rounded-lg border border-green-500/20">
              متوفر ({supply.stockQuantity})
            </span>
          ) : (
            <span className="text-xs font-bold text-red-500 bg-red-500/10 px-2.5 py-1.5 rounded-lg border border-red-500/20">
              نفدت الكمية
            </span>
          )}
        </div>

        {/* Details / Description */}
        <div className="mb-6">
          <h3 className="font-black text-gray-900 dark:text-white mb-3 text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-fuchsia-500" /> تفاصيل المادة
          </h3>
          <div className="bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-4 text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
            {supply.description ? (
              supply.description.split('\n').map((line: string, i: number) => (
                <span key={i}>
                  {line}
                  <br />
                </span>
              ))
            ) : (
              <span className="opacity-70 italic">لا توجد تفاصيل إضافية مضافة لهذه المادة حالياً.</span>
            )}
          </div>
        </div>

        {/* Quantity */}
        <div className="mb-8">
          <h3 className="font-bold text-gray-900 dark:text-white mb-3 text-sm">الكمية</h3>
          <div className="flex items-center gap-4 bg-gray-50 dark:bg-zinc-900 w-fit rounded-2xl p-1 border border-gray-200 dark:border-zinc-800 shadow-sm">
            <button 
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-10 h-10 flex items-center justify-center text-gray-500 bg-white dark:bg-zinc-800 rounded-xl shadow-sm hover:text-[#FF3366] transition-colors"
            >-</button>
            <span className="w-8 text-center font-bold text-lg">{quantity}</span>
            <button 
              onClick={() => setQuantity(Math.min((supply.stockQuantity || 0), quantity + 1))}
              disabled={quantity >= (supply.stockQuantity || 0)}
              className={`w-10 h-10 flex items-center justify-center rounded-xl shadow-sm transition-colors ${quantity >= (supply.stockQuantity || 0) ? 'text-gray-300 dark:text-zinc-600 bg-gray-50 dark:bg-zinc-800 cursor-not-allowed' : 'text-gray-500 bg-white dark:bg-zinc-800 hover:text-[#FF3366]'}`}
            >+</button>
          </div>
        </div>

      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-[72px] left-0 right-0 p-5 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-t border-gray-100 dark:border-zinc-800 z-40">
        <button 
          onClick={handleAddToCart}
          disabled={!supply.stockQuantity || supply.stockQuantity < 1}
          className={`w-full py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 shadow-lg transition-all ${(!supply.stockQuantity || supply.stockQuantity < 1) ? 'bg-gray-300 dark:bg-zinc-800 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-[#FF3366] to-[#E040FB] text-white shadow-pink-500/25 active:scale-[0.98]'}`}
        >
          <ShoppingCart className="w-5 h-5" />
          {(!supply.stockQuantity || supply.stockQuantity < 1) ? 'نفدت الكمية' : `إضافة للسلة - ${(Number(supply.price) * quantity).toLocaleString()} د.ع`}
        </button>
      </div>
      
      <BottomNav />
    </div>
  );
}

export default function SupplyDetails() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#e8456b]" /></div>}>
      <SupplyDetailsContent />
    </Suspense>
  );
}
