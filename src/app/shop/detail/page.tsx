"use client";
import { Suspense, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Star, ShoppingCart, Loader2, Check, Heart } from "lucide-react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCart } from "@/context/CartContext";
import { useFavorites } from "@/context/FavoritesContext";
import BottomNav from "@/components/layout/BottomNav";

const AVAILABLE_FILLINGS = ["شوكولاتة", "فراولة", "كراميل", "فانيلا", "مكسرات"];
const CAKE_SIZES = [
  { name: "صغير (15 سم)", extraPrice: 0 },
  { name: "وسط (20 سم)", extraPrice: 10000 },
  { name: "كبير (25 سم)", extraPrice: 20000 },
  { name: "دورين", extraPrice: 35000 }
];

function ProductDetailsContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") as string;
  const router = useRouter();
  const { addToCart } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  
  // New options
  const [selectedSize, setSelectedSize] = useState(CAKE_SIZES[0]);
  const [selectedFillings, setSelectedFillings] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const toggleFilling = (filling: string) => {
    setSelectedFillings(prev => 
      prev.includes(filling) ? prev.filter(f => f !== filling) : [...prev, filling]
    );
  };

  const handleAddToCart = () => {
    if (!product) return;
    const finalPrice = Number(product.price) + selectedSize.extraPrice;
    addToCart({
      id: product.id,
      name: product.name,
      price: finalPrice,
      quantity: quantity,
      image: product.image || "https://images.unsplash.com/photo-1565958011703-44f9829ba187",
      isCourse: false,
      size: selectedSize.name,
      fillings: selectedFillings.length > 0 ? selectedFillings : ["بدون حشوة إضافية"],
      notes: notes
    });
    router.push("/cart");
  };

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id || typeof id !== "string") return;
      try {
        const docRef = doc(db, "products", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProduct({ id: docSnap.id, ...docSnap.data() });
        }
      } catch (error) {
        console.error("Error fetching product:", error);
      }
      setLoading(false);
    };

    fetchProduct();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pink-50/50 dark:bg-zinc-950">
        <Loader2 className="w-10 h-10 animate-spin text-pink-500" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-pink-50/50 dark:bg-zinc-950 p-6 text-center">
        <h1 className="text-2xl font-bold mb-4">المنتج غير موجود</h1>
        <Link href="/shop" className="bg-pink-500 text-white px-6 py-2 rounded-xl hover:bg-pink-600 transition">العودة للمتجر</Link>
      </div>
    );
  }

  const currentPrice = Number(product.price) + selectedSize.extraPrice;

  return (
    <div className="flex flex-col min-h-screen pb-32 bg-pink-50/50 dark:bg-zinc-950">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-40 p-6 flex justify-between items-center">
        <Link href="/shop" className="w-10 h-10 bg-white/80 dark:bg-black/80 backdrop-blur-md rounded-full flex items-center justify-center text-gray-800 dark:text-gray-200 hover:bg-white transition shadow-sm border border-gray-100 dark:border-zinc-800">
          <ArrowRight className="w-5 h-5" />
        </Link>
        <div className="flex gap-2">
          <button 
            onClick={() => toggleFavorite({
              id: product?.id,
              name: product?.name,
              price: product?.price,
              image: product?.image,
              isCourse: false
            })}
            className="w-10 h-10 bg-white/80 dark:bg-black/80 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white transition shadow-sm border border-gray-100 dark:border-zinc-800 relative"
          >
            <Heart className={`w-5 h-5 ${isFavorite(product?.id) ? 'text-red-500 fill-red-500' : 'text-gray-800 dark:text-gray-200'}`} />
          </button>
        </div>
      </header>

      {/* Image Gallery */}
      <div className="relative w-full aspect-[4/5] bg-gray-200 dark:bg-zinc-800 shadow-md">
        {product.image && (
          <Image 
            src={product.image} 
            alt={product.name} 
            fill 
            className="object-cover"
            priority
          />
        )}
      </div>

      {/* Content */}
      <div className="px-6 py-6 bg-white dark:bg-zinc-950 rounded-t-3xl -mt-8 relative z-10 shadow-[0_-8px_30px_rgb(0,0,0,0.08)] border-t border-gray-100 dark:border-zinc-800 flex-1">
        <div className="flex justify-between items-start mb-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight pr-2">{product.name}</h1>
          <div className="bg-[#e8456b]/10 text-[#e8456b] px-3 py-1.5 rounded-xl text-lg font-black flex-shrink-0 border border-[#e8456b]/20">
            {currentPrice.toLocaleString()} د.ع
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6 pb-6 border-b border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-1 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-1 rounded-lg">
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            <span className="text-sm font-bold text-yellow-700 dark:text-yellow-500">{product.rating || "4.9"}</span>
          </div>
          <span className="text-sm text-[#e8456b] bg-[#e8456b]/10 px-2 py-1 rounded-lg font-medium">{product.category}</span>
        </div>

        {/* Sizes */}
        <div className="mb-6">
          <h3 className="font-bold mb-3 text-gray-800 dark:text-gray-200">اختر الحجم</h3>
          <div className="grid grid-cols-2 gap-3">
            {CAKE_SIZES.map((size) => (
              <button
                key={size.name}
                onClick={() => setSelectedSize(size)}
                className={`p-3 rounded-xl border text-sm font-medium transition-all flex flex-col items-center justify-center gap-1 ${
                  selectedSize.name === size.name 
                    ? 'border-[#e8456b] bg-[#e8456b]/10 text-[#e8456b] shadow-sm' 
                    : 'border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-gray-400 hover:border-[#e8456b]/30'
                }`}
              >
                <span>{size.name}</span>
                <span className="text-xs opacity-70">{size.extraPrice > 0 ? `+${size.extraPrice} د.ع` : 'السعر الأساسي'}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Fillings */}
        {!(product.category?.includes("طاوة") || product.category?.includes("شاي")) && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-gray-800 dark:text-gray-200">الحشوات (اختياري)</h3>
              <span className="text-xs text-gray-500">يمكنك اختيار أكثر من حشوة</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_FILLINGS.map((filling) => {
                const isSelected = selectedFillings.includes(filling);
                return (
                  <button
                    key={filling}
                    onClick={() => toggleFilling(filling)}
                    className={`px-4 py-2 rounded-full border text-sm font-medium transition-all flex items-center gap-1.5 ${
                      isSelected 
                        ? 'border-[#e8456b] bg-[#e8456b]/10 text-[#e8456b] shadow-sm' 
                        : 'border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-gray-400 hover:border-[#e8456b]/30'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                    {filling}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="mb-6">
          <h3 className="font-bold mb-3 text-gray-800 dark:text-gray-200">ملاحظات الطلب</h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="مثال: كتابة عبارة كل عام وأنت بخير علي، أو أي تفاصيل إضافية..."
            className="w-full p-4 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl text-sm outline-none focus:border-[#e8456b] focus:ring-2 focus:ring-[#e8456b]/30 transition resize-none h-24"
          />
        </div>

        <h3 className="font-bold mb-2 text-gray-800 dark:text-gray-200">الوصف</h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-6">
          {product.description || "كيكة طازجة ولذيذة محشوة بأجود المكونات. نصنعها بحب وعناية فائقة لتزين مناسباتكم وتضيف لمسة من السعادة على أوقاتكم الجميلة."}
        </p>

      </div>

      {/* Add to Cart Bar */}
      {/* Add To Cart Section */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-zinc-800 z-50 md:static md:bg-transparent md:border-0 md:p-0 md:mt-8 animate-slide-up" style={{ animationDelay: '0.4s' }}>
        <button 
          onClick={handleAddToCart}
          className="w-full btn-premium py-4 rounded-2xl flex items-center justify-center gap-2 text-lg shadow-lg active:scale-95 transition-transform"
        >
          <ShoppingCart className="w-5 h-5" />
          إضافة للسلة
        </button>
      </div>
      
      <BottomNav />
    </div>
  );
}

export default function ProductDetails() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#e8456b]" /></div>}>
      <ProductDetailsContent />
    </Suspense>
  );
}
