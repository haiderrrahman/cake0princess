"use client";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight, Heart, ShoppingCart, Star } from "lucide-react";

import { useFavorites } from "@/context/FavoritesContext";

export default function FavoritesPage() {
  const { favorites, removeFavorite } = useFavorites();

  return (
    <div className="flex flex-col min-h-screen bg-transparent dark:bg-zinc-950 pb-24 animate-slide-up">
      {/* Header */}
      <header className="px-5 pt-4 pb-4 bg-white dark:bg-zinc-900 sticky top-0 z-40 border-b border-gray-100 dark:border-zinc-800 flex items-center gap-3">
        <Link href="/profile" className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition active:scale-95">
          <ChevronRight className="w-6 h-6" />
        </Link>
        <h1 className="text-xl font-black">المفضلة</h1>
      </header>

      <div className="px-5 mt-6">
        {favorites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-gray-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
              <Heart className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold mb-2">لا توجد عناصر مفضلة</h3>
            <p className="text-gray-500 text-sm mb-6">قم بإضافة المنتجات أو الدورات التي تعجبك إلى المفضلة</p>
            <Link href="/shop" className="bg-[#e8456b] text-white px-6 py-2.5 rounded-full font-bold shadow-lg shadow-[#e8456b]/20 text-sm">
              تصفح المتجر
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {favorites.map((item) => (
              <Link href={item.isCourse ? `/courses/detail?id=${item.id}` : `/shop/detail?id=${item.id}`} key={item.id} className="bg-white dark:bg-zinc-900 rounded-2xl p-2.5 border border-gray-100 dark:border-zinc-800 active:scale-[0.97] transition block group">
                <div className="relative w-full aspect-[4/5] rounded-xl overflow-hidden mb-2.5 bg-gray-50 dark:bg-zinc-800">
                  <Image src={item.image || "/images/placeholder.jpg"} alt={item.name} fill className="object-cover" />
                  <button 
                    onClick={(e) => { e.preventDefault(); removeFavorite(item.id); }}
                    className="absolute top-2 right-2 bg-white/90 dark:bg-black/80 backdrop-blur-sm p-1.5 rounded-full shadow-sm"
                  >
                    <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" />
                  </button>
                </div>
                <h4 className="font-bold text-xs mb-1.5 line-clamp-1">{item.name}</h4>
                <div className="flex justify-between items-center">
                  <span className="text-[#e8456b] font-black text-xs">{Number(item.price).toLocaleString()} <span className="text-[9px] text-gray-400">د.ع</span></span>
                  <div className="bg-[#e8456b]/10 p-1.5 rounded-lg group-active:scale-90 transition">
                    <ShoppingCart className="w-3.5 h-3.5 text-[#e8456b]" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
