"use client";
import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ChevronLeft, Loader2, Megaphone, Image as ImageIcon, ExternalLink } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

type Ad = {
  id: string;
  title: string;
  link: string;
  imageUrl: string;
  createdAt: string;
};

export default function AdsPage() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAds = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "ads"));
        const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ad));
        setAds(items);
      } catch (error) {
        console.error("Error fetching ads:", error);
      }
      setLoading(false);
    };
    fetchAds();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 pb-24 animate-slide-up">
      <header className="bg-white dark:bg-zinc-900 px-5 py-4 pt-4 sticky top-0 z-40 border-b border-gray-100 dark:border-zinc-800 flex items-center gap-3">
        <Link href="/" className="p-2 bg-gray-50 dark:bg-zinc-800 rounded-full transition active:scale-95">
          <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </Link>
        <div>
          <h1 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
            إعلانات <Megaphone className="w-4 h-4 text-indigo-500" />
          </h1>
        </div>
      </header>

      <div className="p-5">
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">اكتشف العروض والإعلانات المميزة لشركائنا، اضغط على الإعلان لمعرفة المزيد.</p>

        {loading ? (
          <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
        ) : (
          <div className="grid gap-6">
            {ads.map(ad => (
              <a key={ad.id} href={ad.link || "#"} target={ad.link ? "_blank" : "_self"} className="bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden shadow-sm border border-gray-100 dark:border-zinc-800 group block active:scale-[0.98] transition">
                <div className="w-full h-48 bg-gray-100 dark:bg-zinc-800 relative">
                  {ad.imageUrl ? (
                    <Image src={ad.imageUrl} alt={ad.title} fill className="object-cover group-hover:scale-105 transition duration-500" />
                  ) : (
                    <ImageIcon className="w-10 h-10 m-auto mt-20 text-gray-400" />
                  )}
                  <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm text-white px-3 py-1 rounded-full text-[10px] font-bold border border-white/20">
                    إعلان ممول
                  </div>
                </div>
                
                <div className="p-5 flex items-center justify-between">
                  <h3 className="font-black text-lg text-gray-900 dark:text-white line-clamp-1">{ad.title}</h3>
                  <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <ExternalLink className="w-5 h-5 text-indigo-500" />
                  </div>
                </div>
              </a>
            ))}
            
            {ads.length === 0 && (
              <div className="text-center text-gray-500 py-16 bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800">
                <Megaphone className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="font-bold">لا توجد إعلانات حالياً</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
