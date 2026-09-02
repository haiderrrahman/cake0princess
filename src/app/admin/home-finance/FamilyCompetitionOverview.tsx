"use client";

import React, { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, limit, onSnapshot } from "firebase/firestore";
import { Trophy, Medal, Clock } from "lucide-react";
import { FamilyCompetitionRound, PARTICIPANTS, ParticipantId } from "./FamilyCompetition";

export default function FamilyCompetitionOverview({ onClick }: { onClick: () => void }) {
  const [activeRound, setActiveRound] = useState<FamilyCompetitionRound | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "familyCompetitionRounds"),
      where("status", "==", "active"),
      limit(1)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setActiveRound({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as FamilyCompetitionRound);
      } else {
        setActiveRound(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const rankedParticipants = useMemo(() => {
    if (!activeRound) return [];
    const entries = Object.entries(activeRound.participants).map(([id, points]) => ({
      id: id as ParticipantId,
      points,
      participant: PARTICIPANTS.find(p => p.id === id)!
    }));
    return entries.sort((a, b) => b.points - a.points);
  }, [activeRound]);

  const getTimeRemaining = () => {
    if (!activeRound?.endsAt) return null;
    const now = new Date();
    const end = activeRound.endsAt.toDate();
    const diff = end.getTime() - now.getTime();
    if (diff <= 0) return "حان وقت الحسم";
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    return `${days} يوم و ${hours} ساعة`;
  };

  if (loading) return null;

  return (
    <div 
      onClick={onClick}
      className="bg-gradient-to-br from-yellow-500/10 via-amber-500/5 to-orange-500/10 rounded-3xl p-5 border border-yellow-500/30 shadow-sm cursor-pointer hover:border-yellow-500/60 hover:shadow-lg transition group relative overflow-hidden h-full flex flex-col"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-yellow-500/20 transition"></div>
      
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center shadow-inner group-hover:scale-110 transition">
            <Trophy className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div>
            <h3 className="font-black text-gray-800 dark:text-white">منافسة العائلة</h3>
            {activeRound && (
              <p className="text-[10px] font-bold text-yellow-700/80 dark:text-yellow-400/80">هدف الفوز: {activeRound.targetPoints} نقاط</p>
            )}
          </div>
        </div>
        {activeRound && (
          <div className="bg-white/50 dark:bg-zinc-900/50 px-2 py-1 rounded-lg text-[10px] font-bold text-gray-500 flex items-center gap-1 border border-gray-200/50 dark:border-zinc-700/50">
            <Clock className="w-3 h-3" />
            {getTimeRemaining()}
          </div>
        )}
      </div>

      <div className="flex-1 relative z-10 space-y-2">
        {!activeRound ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 py-4">
            <Trophy className="w-8 h-8 text-gray-300 dark:text-zinc-700 mb-2" />
            <p className="text-xs font-bold">لا توجد جولة نشطة</p>
          </div>
        ) : (
          rankedParticipants.map((rp, i) => (
            <div key={rp.id} className={`flex items-center justify-between p-2 rounded-xl border ${i === 0 ? 'bg-white dark:bg-zinc-800 border-yellow-200 dark:border-yellow-500/30' : 'bg-white/50 dark:bg-zinc-800/50 border-transparent'}`}>
              <div className="flex items-center gap-2">
                <span className="text-sm w-4 text-center">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                </span>
                <span className="font-bold text-sm text-gray-800 dark:text-gray-200">{rp.participant.name}</span>
              </div>
              <span className={`font-black ${rp.points < 0 ? 'text-red-500' : 'text-gray-800 dark:text-white'}`}>{rp.points}</span>
            </div>
          ))
        )}
      </div>
      <div className="mt-4 pt-3 border-t border-yellow-500/20 text-center relative z-10">
        <span className="text-xs font-bold text-yellow-600 dark:text-yellow-400 group-hover:underline">إدارة المنافسة ←</span>
      </div>
    </div>
  );
}
