"use client";

import React, { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, 
  doc, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  runTransaction, 
  serverTimestamp,
  addDoc,
  onSnapshot,
  where,
  Timestamp,
  writeBatch
} from "firebase/firestore";
import { Trophy, Plus, Minus, History, Clock, Target, Medal, AlertCircle, ChevronDown, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { customConfirm } from "@/lib/customConfirm";
import { getAuth } from "firebase/auth";

// --- Types ---
export type ParticipantId = "ruqayya" | "qunoot" | "eva";

export const PARTICIPANTS: { id: ParticipantId; name: string; emoji: string; avatar: string }[] = [
  { id: "ruqayya", name: "رقية", emoji: "👧", avatar: "/avatars/ruqayya.jpg" },
  { id: "qunoot", name: "قنوت", emoji: "👧", avatar: "/avatars/qunoot.jpg" },
  { id: "eva", name: "إيفا", emoji: "👧", avatar: "/avatars/eva.jpg" }
];

export interface FamilyCompetitionRound {
  id?: string;
  roundNumber: number;
  targetPoints: number;
  participants: Record<ParticipantId, number>;
  status: "active" | "completed";
  winner: ParticipantId | null;
  resultType: "winner" | "tie" | "no_winner" | null;
  startsAt: Timestamp;
  endsAt: Timestamp;
  finalizedAt: Timestamp | null;
}

export interface FamilyCompetitionEntry {
  id?: string;
  roundId: string;
  participantId: ParticipantId;
  participantName: string;
  points: number;
  type: "add" | "deduct";
  reason: string;
  balanceAfter: number;
  createdAt: Timestamp;
  createdBy: string;
}

// --- Helper Functions ---
const getNextFriday9AM = () => {
  const now = new Date();
  const nextFriday = new Date(now);
  nextFriday.setDate(now.getDate() + ((5 - now.getDay() + 7) % 7 || 7));
  nextFriday.setHours(9, 0, 0, 0); // Local time approximation for UI
  return nextFriday;
};

// --- Component ---
export default function FamilyCompetition() {
  const [activeRound, setActiveRound] = useState<FamilyCompetitionRound | null>(null);
  const [roundsHistory, setRoundsHistory] = useState<FamilyCompetitionRound[]>([]);
  const [entries, setEntries] = useState<FamilyCompetitionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionType, setTransactionType] = useState<"add" | "deduct">("add");
  const [transactionParticipant, setTransactionParticipant] = useState<ParticipantId | null>(null);
  const [transactionPoints, setTransactionPoints] = useState<number>(0);
  const [transactionReason, setTransactionReason] = useState("");
  
  const [viewMode, setViewMode] = useState<"competition" | "history">("competition");
  const [selectedRoundHistory, setSelectedRoundHistory] = useState<string | null>(null);
  


  // Listen to active round
  useEffect(() => {
    const q = query(
      collection(db, "familyCompetitionRounds"),
      where("status", "==", "active"),
      limit(1)
    );
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (!snapshot.empty) {
        const roundData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as FamilyCompetitionRound;
        
        // Auto-finalize if past the end time (Friday 9 AM)
        if (roundData.endsAt && Date.now() > roundData.endsAt.toMillis()) {
          try {
            await finalizeRound(roundData.id!);
            
            // Check if next round already exists before creating to prevent race conditions
            const roundsRef = collection(db, "familyCompetitionRounds");
            const nextRoundQ = query(roundsRef, where("roundNumber", "==", roundData.roundNumber + 1), limit(1));
            const nextRoundSnap = await getDocs(nextRoundQ);
            
            if (nextRoundSnap.empty) {
              const nextFriday = getNextFriday9AM();
              await addDoc(roundsRef, {
                roundNumber: roundData.roundNumber + 1,
                targetPoints: 100,
                participants: { ruqayya: 0, qunoot: 0, eva: 0 },
                status: "active",
                winner: null,
                resultType: null,
                startsAt: serverTimestamp(),
                endsAt: Timestamp.fromDate(nextFriday),
                finalizedAt: null
              });
              toast.success("تم إنهاء الجولة السابقة وبدء جولة جديدة تلقائياً.");
            }
          } catch (e) {
            console.error("Auto finalize error", e);
          }
        } else {
          setActiveRound(roundData);
        }
      } else {
        setActiveRound(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Listen to entries of active round
  useEffect(() => {
    if (!activeRound?.id) return;
    const q = query(
      collection(db, "familyCompetitionEntries"),
      where("roundId", "==", activeRound.id)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FamilyCompetitionEntry));
      setEntries(data.sort((a, b) => (b.createdAt?.toMillis?.() || Date.now()) - (a.createdAt?.toMillis?.() || Date.now())));
    });
    return () => unsubscribe();
  }, [activeRound?.id]);

  // Load history rounds
  useEffect(() => {
    if (viewMode === "history") {
      const q = query(
        collection(db, "familyCompetitionRounds"),
        where("status", "==", "completed")
      );
      getDocs(q).then(snapshot => {
        const rounds = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FamilyCompetitionRound));
        setRoundsHistory(rounds.sort((a, b) => b.roundNumber - a.roundNumber));
      }).catch(err => {
        console.error("Error fetching rounds history:", err);
      });
    }
  }, [viewMode]);

  const handleStartNewRound = async () => {
    const confirmed = await customConfirm(`هل أنت متأكد من بدء جولة جديدة بـ 80 نقطة كحد أدنى للفوز (من 100)؟ جميع النقاط ستبدأ من 0.`);
    
    if (!confirmed) return;

    try {
      const roundsSnapshot = await getDocs(query(collection(db, "familyCompetitionRounds"), orderBy("roundNumber", "desc"), limit(1)));
      const lastRoundNumber = roundsSnapshot.empty ? 0 : roundsSnapshot.docs[0].data().roundNumber;

      const nextFriday = getNextFriday9AM();

      await addDoc(collection(db, "familyCompetitionRounds"), {
        roundNumber: lastRoundNumber + 1,
        targetPoints: 100,
        participants: { ruqayya: 0, qunoot: 0, eva: 0 },
        status: "active",
        winner: null,
        resultType: null,
        startsAt: serverTimestamp(),
        endsAt: Timestamp.fromDate(nextFriday),
        finalizedAt: null
      });

      toast.success("تم بدء جولة جديدة بنجاح!");
    } catch (error) {
      console.error(error);
      toast.error("حدث خطأ أثناء بدء الجولة");
    }
  };

  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRound?.id || !transactionParticipant || !transactionReason.trim() || transactionPoints === 0) return;

    try {
      await runTransaction(db, async (transaction) => {
        const roundRef = doc(db, "familyCompetitionRounds", activeRound.id!);
        const roundDoc = await transaction.get(roundRef);
        
        if (!roundDoc.exists() || roundDoc.data().status !== "active") {
          throw new Error("الجولة غير نشطة.");
        }

        const data = roundDoc.data() as FamilyCompetitionRound;
        const currentPoints = data.participants[transactionParticipant] || 0;
        const newPoints = transactionType === "add" ? currentPoints + transactionPoints : currentPoints - transactionPoints;

        // Update Round
        transaction.update(roundRef, {
          [`participants.${transactionParticipant}`]: newPoints
        });

        // Add Entry
        const auth = getAuth();
        const user = auth.currentUser;
        
        const entryRef = doc(collection(db, "familyCompetitionEntries"));
        transaction.set(entryRef, {
          roundId: activeRound.id,
          participantId: transactionParticipant,
          participantName: PARTICIPANTS.find(p => p.id === transactionParticipant)?.name || "",
          points: transactionPoints,
          type: transactionType,
          reason: transactionReason.trim(),
          balanceAfter: newPoints,
          createdAt: serverTimestamp(),
          createdBy: user?.displayName || user?.email || "Admin"
        });
      });

      toast.success("تم تسجيل العملية بنجاح!");
      setShowTransactionModal(false);
      setTransactionReason("");
      setTransactionPoints(0);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "حدث خطأ أثناء تسجيل العملية");
    }
  };

  const finalizeRound = async (roundId: string) => {
    try {
      await runTransaction(db, async (transaction) => {
        const roundRef = doc(db, "familyCompetitionRounds", roundId);
        const roundDoc = await transaction.get(roundRef);
        if (!roundDoc.exists() || roundDoc.data().status !== "active") return;

        const data = roundDoc.data() as FamilyCompetitionRound;
        const { participants, targetPoints } = data;
        
        // Logic to find winner
        let highestScore = -Infinity;
        let winners: ParticipantId[] = [];

        Object.entries(participants).forEach(([id, points]) => {
          if (points > highestScore) {
            highestScore = points;
            winners = [id as ParticipantId];
          } else if (points === highestScore) {
            winners.push(id as ParticipantId);
          }
        });

        let resultType = "no_winner";
        let finalWinner = null;

        if (highestScore >= 80) {
          if (winners.length === 1) {
            resultType = "winner";
            finalWinner = winners[0];
          } else {
            resultType = "tie";
          }
        }

        transaction.update(roundRef, {
          status: "completed",
          winner: finalWinner,
          resultType,
          finalizedAt: serverTimestamp()
        });
      });
      toast.success("تم إنهاء الجولة وتحديد النتيجة.");
    } catch (error) {
      console.error(error);
      toast.error("حدث خطأ أثناء إنهاء الجولة.");
    }
  };

  // Ranking calculation
  const rankedParticipants = useMemo(() => {
    if (!activeRound) return [];
    const entries = Object.entries(activeRound.participants).map(([id, points]) => ({
      id: id as ParticipantId,
      points,
      participant: PARTICIPANTS.find(p => p.id === id)!
    }));
    return entries.sort((a, b) => b.points - a.points);
  }, [activeRound]);

  if (loading) return <div className="text-center py-10">جاري تحميل المنافسة...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-gradient-to-r from-yellow-500/10 via-amber-500/10 to-orange-500/10 p-5 rounded-3xl border border-yellow-500/30">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-yellow-500/20 flex items-center justify-center shadow-inner">
            <Trophy className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-800 dark:text-white">منافسة العائلة</h2>
            {activeRound ? (
              <p className="text-sm font-bold text-yellow-700/80 dark:text-yellow-400/80">الجولة رقم {activeRound.roundNumber} - الفوز لمن يحصل على أعلى نتيجة (الحد الأدنى 80 نقطة)</p>
            ) : (
              <p className="text-sm font-bold text-gray-500">لا توجد جولة نشطة حالياً</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setViewMode("competition")} 
            className={`px-4 py-2 rounded-xl text-sm font-bold transition ${viewMode === "competition" ? "bg-yellow-500 text-white shadow-lg" : "bg-white/50 text-gray-600 hover:bg-white"}`}
          >
            المنافسة الحالية
          </button>
          <button 
            onClick={() => setViewMode("history")} 
            className={`px-4 py-2 rounded-xl text-sm font-bold transition ${viewMode === "history" ? "bg-yellow-500 text-white shadow-lg" : "bg-white/50 text-gray-600 hover:bg-white"}`}
          >
            سجل الجولات
          </button>
        </div>
      </div>

      {viewMode === "competition" && (
        <>
          {!activeRound ? (
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 border border-gray-100 dark:border-zinc-800 text-center">
              <Trophy className="w-16 h-16 text-gray-300 dark:text-zinc-700 mx-auto mb-4" />
              <h3 className="text-lg font-black text-gray-800 dark:text-white mb-2">ابدأ جولة جديدة</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">حدد شرط الفوز الأدنى لبدء منافسة أسبوعية جديدة بين البنات</p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <div className="px-4 py-3 rounded-2xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 font-bold text-gray-700 dark:text-gray-300">
                  شرط الفوز الأدنى: 8 نقاط
                </div>
                <button 
                  onClick={handleStartNewRound}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-yellow-500 to-amber-600 text-white font-black shadow-lg shadow-yellow-500/30 hover:scale-105 active:scale-95 transition"
                >
                  بدء الجولة الآن
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Ranking & Actions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {rankedParticipants.map((rp, index) => {
                  const isWinner = rp.points >= 8;
                  return (
                    <div key={rp.id} className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-gray-100 dark:border-zinc-800 shadow-sm relative overflow-hidden group hover:border-yellow-400/50 transition">
                      {isWinner && (
                        <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-yellow-400 to-amber-500"></div>
                      )}
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                        <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-yellow-100 dark:border-zinc-800 shadow-md">
                          <img src={rp.participant.avatar} alt={rp.participant.name} className="w-full h-full object-cover" />
                        </div>
                          <div>
                            <div className="font-black text-lg text-gray-800 dark:text-white flex items-center gap-2">
                              {rp.participant.name}
                              {index === 0 && rp.points > 0 && <Medal className="w-4 h-4 text-yellow-500" />}
                            </div>
                            <div className="text-xs font-bold text-gray-500">
                              {index === 0 ? "المركز الأول 🥇" : index === 1 ? "المركز الثاني 🥈" : "المركز الثالث 🥉"}
                            </div>
                          </div>
                        </div>
                        <div className={`text-4xl font-black ${rp.points < 0 ? 'text-red-500' : 'text-gray-800 dark:text-white'}`}>
                          {rp.points}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => { setTransactionParticipant(rp.id); setTransactionType("add"); setShowTransactionModal(true); }}
                          className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition active:scale-95"
                        >
                          <Plus className="w-4 h-4" /> إضافة
                        </button>
                        <button 
                          onClick={() => { setTransactionParticipant(rp.id); setTransactionType("deduct"); setShowTransactionModal(true); }}
                          className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 font-black hover:bg-red-100 dark:hover:bg-red-500/20 transition active:scale-95"
                        >
                          <Minus className="w-4 h-4" /> خصم
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Controls */}
              <div className="flex justify-end mt-4">
                <button 
                  onClick={async () => {
                    const ok = await customConfirm("هل أنت متأكد من إنهاء الجولة يدوياً وتحديد الفائز الآن؟");
                    if (ok) finalizeRound(activeRound.id!);
                  }}
                  className="text-xs text-red-500 hover:underline font-bold flex items-center gap-1"
                >
                  <AlertCircle className="w-3 h-3" />
                  إنهاء الجولة يدوياً
                </button>
              </div>

              {/* Transactions Log */}
              <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-gray-100 dark:border-zinc-800 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <History className="w-5 h-5 text-gray-400" />
                  <h3 className="font-black text-gray-800 dark:text-white">سجل العمليات الأخير</h3>
                </div>
                
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {entries.length === 0 ? (
                    <div className="text-center text-sm text-gray-500 py-4">لا توجد عمليات مسجلة بعد في هذه الجولة.</div>
                  ) : (
                    entries.map(entry => (
                      <div key={entry.id} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-800">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${entry.type === 'add' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                            {entry.type === 'add' ? '+' : '-'}{entry.points}
                          </div>
                          <div>
                            <p className="font-bold text-gray-800 dark:text-white text-sm">
                              {entry.participantName}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-300 font-normal mt-0.5">
                              {entry.reason}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {entry.createdAt?.toDate?.().toLocaleString('ar-IQ')} • بواسطة {entry.createdBy}
                            </p>
                          </div>
                        </div>
                        <div className="text-center px-3 border-r border-gray-200 dark:border-zinc-700">
                          <p className="text-[10px] text-gray-500">الرصيد</p>
                          <p className="font-black text-gray-800 dark:text-white">{entry.balanceAfter}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* History Mode */}
      {viewMode === "history" && (
        <div className="space-y-4">
          {roundsHistory.length === 0 ? (
            <div className="text-center py-10 text-gray-500">لا توجد جولات سابقة.</div>
          ) : (
            roundsHistory.map(round => (
              <div key={round.id} className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-gray-100 dark:border-zinc-800 shadow-sm">
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100 dark:border-zinc-800">
                  <div>
                    <h4 className="font-black text-lg flex items-center gap-2">
                      الجولة {round.roundNumber}
                      {round.resultType === 'winner' && <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs">الفائزة: {PARTICIPANTS.find(p=>p.id===round.winner)?.name} 🏆</span>}
                      {round.resultType === 'tie' && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">تعادل 🤝</span>}
                      {round.resultType === 'no_winner' && <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs">لا يوجد فائز</span>}
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">شرط الفوز الأدنى: {round.targetPoints} | {round.startsAt?.toDate?.().toLocaleDateString('ar-IQ')} - {round.finalizedAt?.toDate?.().toLocaleDateString('ar-IQ')}</p>
                  </div>
                  <div className="flex gap-4">
                    {Object.entries(round.participants).map(([id, pts]) => (
                      <div key={id} className="text-center">
                        <p className="text-xs text-gray-500">{PARTICIPANTS.find(p=>p.id===id)?.name}</p>
                        <p className={`font-black ${pts >= round.targetPoints ? 'text-emerald-600' : 'text-gray-800 dark:text-white'}`}>{pts}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Transaction Modal */}
      {showTransactionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-black mb-4 flex items-center gap-2">
              {transactionType === 'add' ? <Plus className="text-emerald-500"/> : <Minus className="text-red-500"/>}
              {transactionType === 'add' ? 'إضافة نقاط' : 'خصم نقاط'} لـ {PARTICIPANTS.find(p => p.id === transactionParticipant)?.name}
            </h3>
            
            <form onSubmit={handleTransaction}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">عدد النقاط</label>
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {[5, 10, 15, 20].map(pts => (
                      <button
                        key={pts}
                        type="button"
                        onClick={() => setTransactionPoints(pts)}
                        className={`py-2 rounded-xl font-black transition ${transactionPoints === pts ? (transactionType === 'add' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white') : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'}`}
                      >
                        {pts}
                      </button>
                    ))}
                  </div>
                  <input 
                    type="number"
                    min="1"
                    placeholder="رقم مخصص"
                    value={transactionPoints || ''}
                    onChange={(e) => setTransactionPoints(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-zinc-700 bg-transparent font-bold focus:ring-2 focus:ring-yellow-500 outline-none"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">السبب (إجباري)</label>
                  <textarea 
                    value={transactionReason}
                    onChange={(e) => setTransactionReason(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-zinc-700 bg-transparent font-bold focus:ring-2 focus:ring-yellow-500 outline-none resize-none"
                    rows={3}
                    placeholder={transactionType === 'add' ? 'مثال: رتبت غرفتها وساعدت في المنزل' : 'مثال: لم ترتب ألعابها'}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button 
                  type="submit"
                  disabled={!transactionPoints || !transactionReason.trim()}
                  className={`flex-1 py-3 rounded-2xl text-white font-black transition shadow-lg ${!transactionPoints || !transactionReason.trim() ? 'opacity-50 cursor-not-allowed' : (transactionType === 'add' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30' : 'bg-red-500 hover:bg-red-600 shadow-red-500/30')}`}
                >
                  حفظ العملية
                </button>
                <button 
                  type="button"
                  onClick={() => { setShowTransactionModal(false); setTransactionReason(""); setTransactionPoints(0); }}
                  className="px-6 py-3 rounded-2xl bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 font-bold hover:bg-gray-200 dark:hover:bg-zinc-700 transition"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
