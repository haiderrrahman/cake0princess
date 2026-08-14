"use client";
import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ChevronLeft, Loader2, Percent, Sparkles, Image as ImageIcon } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

type Offer = {
  id: string;
  title: string;
  description: string;
  originalPrice: number;
  discountPrice: number;
  image: string;
};

export default function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOffers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "offers"));
        const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Offer));
        setOffers(items);
      } catch (error) {
        console.error("Error fetching offers:", error);
      }
      setLoading(false);
    };
    fetchOffers();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 pb-24 animate-slide-up">
      <header className="bg-white dark:bg-zinc-900 px-5 py-4 pt-4 sticky top-0 z-40 border-b border-gray-100 dark:border-zinc-800 flex items-center gap-3">
        <Link href="/" className="p-2 bg-gray-50 dark:bg-zinc-800 rounded-full transition active:scale-95">
          <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </Link>
        <div>
          <h1 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
            العروض الخاصة <Sparkles className="w-4 h-4 text-pink-500" />
          </h1>
        </div>
      </header>

      <div className="p-5">
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">تصفح أحدث العروض والخصومات على الكيك والدورات. العروض متوفرة لفترة محدودة!</p>

        {loading ? (
          <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-pink-500" /></div>
        ) : (
          <div className="grid gap-4">
            {offers.map(offer => {
              const discountPercent = Math.round(((offer.originalPrice - offer.discountPrice) / offer.originalPrice) * 100);
              
              return (
                <div key={offer.id} className="bg-white dark:bg-zinc-900 rounded-3xl p-4 shadow-sm border border-gray-100 dark:border-zinc-800 flex flex-col md:flex-row gap-4 active:scale-[0.98] transition">
                  <div className="w-full md:w-32 h-40 md:h-32 bg-gray-100 dark:bg-zinc-800 rounded-2xl overflow-hidden flex-shrink-0 relative">
                    {offer.image ? (
                      <Image src={offer.image} alt={offer.title} fill className="object-cover" />
                    ) : (
                      <ImageIcon className="w-8 h-8 m-auto mt-12 md:mt-8 text-gray-400" />
                    )}
                    {discountPercent > 0 && (
                      <div className="absolute top-0 right-0 bg-red-500 text-white text-[11px] font-bold px-3 py-1.5 rounded-bl-xl flex items-center gap-1 shadow-md">
                        <Percent className="w-3.5 h-3.5" /> {discountPercent} خصم
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 flex flex-col">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">{offer.title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed mb-4">{offer.description}</p>
                    
                    <div className="mt-auto flex items-end justify-between">
                      <div>
                        <div className="text-xs text-gray-400 line-through mb-0.5">{offer.originalPrice.toLocaleString()} د.ع</div>
                        <div className="text-lg font-black text-[#e8456b]">{offer.discountPrice.toLocaleString()} د.ع</div>
                      </div>
                      <Link href="/custom-design" className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-5 py-2.5 rounded-xl text-xs font-bold shadow-md hover:bg-gray-800 dark:hover:bg-gray-100 transition">
                        اطلب الآن
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {offers.length === 0 && (
              <div className="text-center text-gray-500 py-16 bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800">
                <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="font-bold">لا توجد عروض حالياً</p>
                <p className="text-xs mt-1">ترقبوا أقوى العروض قريباً!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
