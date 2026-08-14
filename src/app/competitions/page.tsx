"use client";
import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ChevronLeft, Loader2, Star, Gift, Image as ImageIcon, Calendar } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

type Competition = {
  id: string;
  title: string;
  description: string;
  prize: string;
  endDate: string;
  imageUrl?: string;
  image?: string;
};

export default function CompetitionsPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCompetitions = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "competitions"));
        const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Competition));
        setCompetitions(items);
      } catch (error) {
        console.error("Error fetching competitions:", error);
      }
      setLoading(false);
    };
    fetchCompetitions();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 pb-24 animate-slide-up">
      <header className="bg-white dark:bg-zinc-900 px-5 py-4 pt-4 sticky top-0 z-40 border-b border-gray-100 dark:border-zinc-800 flex items-center gap-3">
        <Link href="/" className="p-2 bg-gray-50 dark:bg-zinc-800 rounded-full transition active:scale-95">
          <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </Link>
        <div>
          <h1 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
            المسابقات والجوائز <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
          </h1>
        </div>
      </header>

      <div className="p-5">
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">شارك في مسابقات كيك الأميرة واربح جوائز قيمة ودورات مجانية!</p>

        {loading ? (
          <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-pink-500" /></div>
        ) : (
          <div className="grid gap-6">
            {competitions.map(comp => (
              <div key={comp.id} className="bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden shadow-sm border border-gray-100 dark:border-zinc-800 group">
                <div className="w-full h-48 bg-gray-100 dark:bg-zinc-800 relative">
                  {(comp.image || comp.imageUrl) ? (
                    <Image src={(comp.image || comp.imageUrl) as string} alt={comp.title} fill className="object-cover group-hover:scale-105 transition duration-500" />
                  ) : (
                    <ImageIcon className="w-10 h-10 m-auto mt-20 text-gray-400" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-4 right-4 left-4">
                    <h3 className="font-black text-xl text-white mb-1 drop-shadow-md">{comp.title}</h3>
                    <div className="flex items-center gap-2 text-white/90 text-xs font-medium">
                      <Calendar className="w-3.5 h-3.5" /> تنتهي في: {new Date(comp.endDate).toLocaleDateString("ar-IQ", { year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                  </div>
                </div>
                
                <div className="p-5">
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                    {comp.description}
                  </p>
                  
                  <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 p-4 rounded-2xl flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 bg-white dark:bg-zinc-900 rounded-full flex items-center justify-center shadow-sm flex-shrink-0">
                      <Gift className="w-5 h-5 text-yellow-600 dark:text-yellow-500" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-yellow-600 dark:text-yellow-500 block mb-0.5">الجائزة الكبرى</span>
                      <span className="text-sm font-black text-gray-900 dark:text-white">{comp.prize}</span>
                    </div>
                  </div>

                  <button className="w-full bg-[#d4a853] hover:bg-[#c39742] text-white py-3.5 rounded-xl font-bold shadow-lg transition active:scale-[0.98]">
                    شارك الآن
                  </button>
                </div>
              </div>
            ))}
            
            {competitions.length === 0 && (
              <div className="text-center text-gray-500 py-16 bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800">
                <Gift className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="font-bold">لا توجد مسابقات حالياً</p>
                <p className="text-xs mt-1">تابعنا لمعرفة المسابقات القادمة!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
