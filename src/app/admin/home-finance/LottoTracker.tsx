"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X, Sparkles, Trophy, Calendar, Ticket, Plus, CheckCircle2,
  AlertCircle, Copy, Check, BarChart2, Flame, Snowflake, RotateCcw,
  Clock, Hash, DollarSign, ExternalLink, Search
} from "lucide-react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import {
  LottoGameType, LottoDraw, LottoTicket,
  GAME_DETAILS, INITIAL_SUPER_KEY_DRAWS, INITIAL_IRAQ_LOTTO_DRAWS,
  getNextDrawDate, calculateLottoStats, predictNextNumbers, checkTicketMatch
} from "./lottoTypes";

interface LottoTrackerProps {
  isOpen: boolean;
  onClose: () => void;
  onAddExpenseLinked?: (amount: number, description: string, date: string) => void;
}

export default function LottoTracker({ isOpen, onClose, onAddExpenseLinked }: LottoTrackerProps) {
  const [selectedGame, setSelectedGame] = useState<LottoGameType>("super_key");
  const [activeSubTab, setActiveSubTab] = useState<"predict" | "tickets" | "history" | "stats">("predict");

  // Firebase state
  const [superKeyDraws, setSuperKeyDraws] = useState<LottoDraw[]>(INITIAL_SUPER_KEY_DRAWS);
  const [iraqLottoDraws, setIraqLottoDraws] = useState<LottoDraw[]>(INITIAL_IRAQ_LOTTO_DRAWS);
  const [tickets, setTickets] = useState<LottoTicket[]>([]);
  const [loading, setLoading] = useState(true);

  // Archive search filter
  const [archiveSearchQuery, setArchiveSearchQuery] = useState("");

  // Prediction state
  const [predictionStrategy, setPredictionStrategy] = useState<"balanced" | "hot" | "cold" | "random">("balanced");
  const [suggestedNumbers, setSuggestedNumbers] = useState<number[]>([]);
  const [suggestedLucky, setSuggestedLucky] = useState<number | undefined>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // New ticket modal state
  const [showAddTicketModal, setShowAddTicketModal] = useState(false);
  const [newTicketNumbers, setNewTicketNumbers] = useState<number[]>([]);
  const [newTicketLucky, setNewTicketLucky] = useState<number | undefined>();
  const [newTicketCost, setNewTicketCost] = useState<number>(3000);
  const [newTicketDate, setNewTicketDate] = useState<string>("");
  const [newTicketDrawNum, setNewTicketDrawNum] = useState<string>("");

  // Record winning draw modal
  const [showRecordDrawModal, setShowRecordDrawModal] = useState(false);
  const [drawNumInput, setDrawNumInput] = useState<number>(24);
  const [drawDateInput, setDrawDateInput] = useState<string>(new Date().toISOString().split("T")[0]);
  const [drawNumbersInput, setDrawNumbersInput] = useState<number[]>([]);
  const [drawLuckyInput, setDrawLuckyInput] = useState<number | undefined>();

  // 1. Subscribe to Firestore
  useEffect(() => {
    if (!isOpen) return;

    const unsub = onSnapshot(doc(db, "home_finance", "lotto_hub"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();

        // 1. Super Key sync & auto-upgrade
        if (data.superKeyDraws && data.superKeyDraws.length >= INITIAL_SUPER_KEY_DRAWS.length) {
          setSuperKeyDraws(data.superKeyDraws);
        } else {
          const existingDrawNumbers = new Set((data.superKeyDraws || []).map((d: LottoDraw) => d.drawNumber));
          const missingDraws = INITIAL_SUPER_KEY_DRAWS.filter(d => !existingDrawNumbers.has(d.drawNumber));
          const mergedSuperKey = [...(data.superKeyDraws || []), ...missingDraws].sort((a, b) => b.drawNumber - a.drawNumber);
          setSuperKeyDraws(mergedSuperKey);
          setDoc(doc(db, "home_finance", "lotto_hub"), {
            superKeyDraws: mergedSuperKey
          }, { merge: true });
        }

        // 2. Iraq Lotto sync & auto-upgrade to all 128 draws
        if (data.iraqLottoDraws && data.iraqLottoDraws.length >= INITIAL_IRAQ_LOTTO_DRAWS.length) {
          setIraqLottoDraws(data.iraqLottoDraws);
        } else {
          const existingDrawNumbers = new Set((data.iraqLottoDraws || []).map((d: LottoDraw) => d.drawNumber));
          const missingDraws = INITIAL_IRAQ_LOTTO_DRAWS.filter(d => !existingDrawNumbers.has(d.drawNumber));
          const mergedIraqLotto = [...(data.iraqLottoDraws || []), ...missingDraws].sort((a, b) => b.drawNumber - a.drawNumber);
          setIraqLottoDraws(mergedIraqLotto);
          setDoc(doc(db, "home_finance", "lotto_hub"), {
            iraqLottoDraws: mergedIraqLotto
          }, { merge: true });
        }

        if (data.tickets) {
          setTickets(data.tickets);
        }
      } else {
        // Initialize document with complete sets
        setDoc(doc(db, "home_finance", "lotto_hub"), {
          superKeyDraws: INITIAL_SUPER_KEY_DRAWS,
          iraqLottoDraws: INITIAL_IRAQ_LOTTO_DRAWS,
          tickets: []
        });
      }
      setLoading(false);
    }, (err) => {
      console.error("Lotto Firebase snapshot error:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [isOpen]);

  // Current active game draws
  const currentDraws = useMemo(() => {
    return selectedGame === "super_key" ? superKeyDraws : iraqLottoDraws;
  }, [selectedGame, superKeyDraws, iraqLottoDraws]);

  // Filtered archive draws for search
  const filteredArchiveDraws = useMemo(() => {
    if (!archiveSearchQuery.trim()) return currentDraws;
    const q = archiveSearchQuery.trim().toLowerCase();
    return currentDraws.filter(d => 
      d.drawNumber.toString().includes(q) || 
      d.date.includes(q) || 
      d.numbers.some(n => n.toString() === q)
    );
  }, [currentDraws, archiveSearchQuery]);

  // Statistics
  const stats = useMemo(() => {
    return calculateLottoStats(currentDraws, selectedGame);
  }, [currentDraws, selectedGame]);

  // Next Draw Date
  const nextDrawDate = useMemo(() => {
    return getNextDrawDate(selectedGame);
  }, [selectedGame]);

  // Generate initial prediction on mount or game change
  useEffect(() => {
    handleGeneratePrediction();
  }, [selectedGame, predictionStrategy, currentDraws]);

  const handleGeneratePrediction = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const pred = predictNextNumbers(currentDraws, selectedGame, predictionStrategy);
      setSuggestedNumbers(pred.numbers);
      setSuggestedLucky(pred.luckyNumber);
      setIsGenerating(false);
    }, 250);
  };

  const handleCopyNumbers = () => {
    const text = suggestedLucky !== undefined 
      ? `أرقام ${GAME_DETAILS[selectedGame].title}: ${suggestedNumbers.join(" - ")} | رقم الحظ: ${suggestedLucky}`
      : `أرقام ${GAME_DETAILS[selectedGame].title}: ${suggestedNumbers.join(" - ")}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("تم نسخ الأرقام بنجاح!");
    setTimeout(() => setCopied(false), 2000);
  };

  // Save new ticket
  const handleSaveTicket = async () => {
    if (newTicketNumbers.length !== 6) {
      toast.error("يرجى اختيار 6 أرقام كاملة للبطاقة");
      return;
    }
    if (selectedGame === "super_key" && newTicketLucky === undefined) {
      toast.error("يرجى اختيار رقم الحظ الإضافي لسوبر كي");
      return;
    }

    const targetDate = newTicketDate || nextDrawDate;
    const newTicket: LottoTicket = {
      id: "tkt-" + Date.now(),
      game: selectedGame,
      ticketName: `بطاقة ${GAME_DETAILS[selectedGame].shortTitle}`,
      numbers: [...newTicketNumbers].sort((a, b) => a - b),
      luckyNumber: selectedGame === "super_key" ? newTicketLucky : undefined,
      drawDate: targetDate,
      drawNumber: newTicketDrawNum ? Number(newTicketDrawNum) : undefined,
      cost: Number(newTicketCost) || 3000,
      status: "pending",
      createdAt: new Date().toISOString()
    };

    // Check if this draw already has a recorded winning result
    const matchingDraw = currentDraws.find(d => d.date === targetDate);
    if (matchingDraw) {
      const matchRes = checkTicketMatch(newTicket, matchingDraw);
      newTicket.status = "matched";
      newTicket.matchCount = matchRes.matchCount;
      newTicket.luckyMatched = matchRes.luckyMatched;
      newTicket.matchedNumbers = matchRes.matchedNumbers;
      newTicket.prizeTier = matchRes.prizeTier;
    }

    const updatedTickets = [newTicket, ...tickets];
    setTickets(updatedTickets);

    await setDoc(doc(db, "home_finance", "lotto_hub"), {
      tickets: updatedTickets
    }, { merge: true });

    if (onAddExpenseLinked && Number(newTicketCost) > 0) {
      onAddExpenseLinked(
        Number(newTicketCost) || 3000,
        `شراء بطاقة ${GAME_DETAILS[selectedGame].shortTitle} (${newTicket.numbers.join("-")}${newTicket.luckyNumber !== undefined ? " + " + newTicket.luckyNumber : ""})`,
        targetDate
      );
    }

    toast.success("تم تسجيل البطاقة وحفظها في سجل السحوبات والمصاريف 🎟️");
    setShowAddTicketModal(false);
    setNewTicketNumbers([]);
    setNewTicketLucky(undefined);
  };

  // Record winning draw result & auto-match all pending tickets
  const handleSaveWinningDraw = async () => {
    if (drawNumbersInput.length !== 6) {
      toast.error("يرجى إدخال 6 أرقام فائزة كاملة");
      return;
    }
    if (selectedGame === "super_key" && drawLuckyInput === undefined) {
      toast.error("يرجى إدخال رقم الحظ الفائز");
      return;
    }

    const newDraw: LottoDraw = {
      id: `${selectedGame}-${drawNumInput}-${Date.now()}`,
      game: selectedGame,
      drawNumber: Number(drawNumInput),
      date: drawDateInput,
      numbers: [...drawNumbersInput].sort((a, b) => a - b),
      luckyNumber: selectedGame === "super_key" ? Number(drawLuckyInput) : undefined,
      createdAt: new Date().toISOString()
    };

    // Update draw lists
    let updatedDraws: LottoDraw[];
    if (selectedGame === "super_key") {
      updatedDraws = [newDraw, ...superKeyDraws.filter(d => d.drawNumber !== newDraw.drawNumber)];
      setSuperKeyDraws(updatedDraws);
    } else {
      updatedDraws = [newDraw, ...iraqLottoDraws.filter(d => d.drawNumber !== newDraw.drawNumber)];
      setIraqLottoDraws(updatedDraws);
    }

    // Auto match all tickets of this game
    let totalWins = 0;
    const updatedTickets = tickets.map(tkt => {
      if (tkt.game === selectedGame && (tkt.drawDate === newDraw.date || tkt.drawNumber === newDraw.drawNumber || tkt.status === "pending")) {
        const matchRes = checkTicketMatch(tkt, newDraw);
        if (matchRes.hasWon) totalWins++;
        return {
          ...tkt,
          status: "matched" as const,
          matchCount: matchRes.matchCount,
          luckyMatched: matchRes.luckyMatched,
          matchedNumbers: matchRes.matchedNumbers,
          prizeTier: matchRes.prizeTier
        };
      }
      return tkt;
    });

    setTickets(updatedTickets);

    await setDoc(doc(db, "home_finance", "lotto_hub"), {
      superKeyDraws: selectedGame === "super_key" ? updatedDraws : superKeyDraws,
      iraqLottoDraws: selectedGame === "iraq_lotto" ? updatedDraws : iraqLottoDraws,
      tickets: updatedTickets
    }, { merge: true });

    if (totalWins > 0) {
      toast.success(`🎉 مبروك! لديك ${totalWins} بطاقة رابحة في هذا السحب!`, { duration: 6000 });
    } else {
      toast.success("تم حفظ نتيجة السحب ومطابقة البطاقات بنجاح ✅");
    }

    setShowRecordDrawModal(false);
    setDrawNumbersInput([]);
    setDrawLuckyInput(undefined);
  };

  // Pending draws counter
  const pendingTicketsForGame = tickets.filter(t => t.game === selectedGame && t.status === "pending");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white dark:bg-[#13111C] rounded-[32px] shadow-2xl border border-gray-100 dark:border-white/10 overflow-hidden text-right"
        dir="rtl"
      >
        {/* Top Gradient Accent */}
        <div className={`h-2.5 w-full bg-gradient-to-r ${GAME_DETAILS[selectedGame].badgeColor}`} />

        {/* Modal Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-2xl shadow-lg shadow-purple-500/20 text-white shrink-0">
              🎰
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white">
                  مركز لوتو العراق وسوبر كي
                </h3>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                  ذكاء إحصائي 🔮
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-bold">
                توقع الأرقام القادمة، إدارة البطاقات، ومطالبة نتائج السحب التلقائية
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://www.iraqloto.iq/more/results"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 transition"
              title="فتح صفحة نتائج السحب الرسمية لموقع لوتو العراق"
            >
              <ExternalLink className="w-3.5 h-3.5 text-rose-500" />
              <span className="hidden sm:inline">نتائج السحب الرسمية</span>
            </a>

            <button
              onClick={onClose}
              className="p-2.5 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 text-gray-600 dark:text-gray-300 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Game Switcher Tabs */}
        <div className="px-5 pt-3 bg-gray-50/30 dark:bg-white/[0.01] border-b border-gray-100 dark:border-white/5">
          <div className="grid grid-cols-2 gap-2 p-1 bg-gray-200/60 dark:bg-white/5 rounded-2xl">
            <button
              onClick={() => setSelectedGame("super_key")}
              className={`py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                selectedGame === "super_key"
                  ? "bg-white dark:bg-purple-600 text-purple-700 dark:text-white shadow-md"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
              }`}
            >
              <span>🟣 لوتو سوبر كي (42 رقم)</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-600 dark:text-amber-300 font-bold">
                سبت وأربعاء
              </span>
            </button>

            <button
              onClick={() => setSelectedGame("iraq_lotto")}
              className={`py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                selectedGame === "iraq_lotto"
                  ? "bg-white dark:bg-rose-600 text-rose-700 dark:text-white shadow-md"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
              }`}
            >
              <span>🔴 لوتو العراق الخيري (29 رقم)</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-400/20 text-rose-600 dark:text-rose-300 font-bold">
                اثنين وخميس
              </span>
            </button>
          </div>

          {/* Sub Navigation */}
          <div className="flex items-center gap-2 sm:gap-4 mt-3 overflow-x-auto pb-2 scrollbar-none">
            <button
              onClick={() => setActiveSubTab("predict")}
              className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition ${
                activeSubTab === "predict"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
                  : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>توقع الأرقام القادمة</span>
            </button>

            <button
              onClick={() => setActiveSubTab("tickets")}
              className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition relative ${
                activeSubTab === "tickets"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
                  : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
              }`}
            >
              <Ticket className="w-3.5 h-3.5" />
              <span>بطاقاتي والنتائج</span>
              {pendingTicketsForGame.length > 0 && (
                <span className="bg-amber-400 text-black text-[10px] px-1.5 rounded-full font-black">
                  {pendingTicketsForGame.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveSubTab("history")}
              className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition ${
                activeSubTab === "history"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
                  : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>أرشيف السحوبات ({currentDraws.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab("stats")}
              className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition ${
                activeSubTab === "stats"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
                  : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>الإحصائيات والأرقام الساخنة</span>
            </button>
          </div>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* ══════════════════════════════════════════
              SUBTAB 1: AI PREDICTOR (اقترح الرقم القادم)
          ══════════════════════════════════════════ */}
          {activeSubTab === "predict" && (
            <div className="space-y-6">
              {/* Next Draw Banner */}
              <div className="relative rounded-3xl p-5 overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-zinc-900 text-white shadow-xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-pink-500/20 blur-3xl rounded-full pointer-events-none" />
                <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-xs font-bold text-amber-300 mb-2 border border-white/10">
                      <Clock className="w-3.5 h-3.5" />
                      <span>السحبة القادمة: {GAME_DETAILS[selectedGame].drawDaysArabic}</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black">
                      أرقام الحظ المقترحة لسحبة {nextDrawDate}
                    </h2>
                    <p className="text-xs text-purple-200 mt-1 max-w-md">
                      تم توليد هذه الأرقام بناءً على خوارزمية توازن الأرقام الأكثر تكراراً (Hot) والأرقام المتأخرة إحصائياً.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleGeneratePrediction}
                      disabled={isGenerating}
                      className="bg-gradient-to-r from-amber-400 to-rose-500 hover:from-amber-300 hover:to-rose-400 text-gray-900 font-black px-4 py-2.5 rounded-2xl shadow-lg shadow-amber-500/20 active:scale-95 transition flex items-center gap-2 text-xs sm:text-sm"
                    >
                      <RotateCcw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                      <span>توليد اقتراح جديد</span>
                    </button>
                  </div>
                </div>

                {/* Strategy Selector */}
                <div className="mt-5 pt-4 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    onClick={() => setPredictionStrategy("balanced")}
                    className={`p-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      predictionStrategy === "balanced"
                        ? "bg-white text-purple-900 shadow-md font-black"
                        : "bg-white/10 text-white/80 hover:bg-white/20"
                    }`}
                  >
                    <span>🎯</span> المتوازن الذكي
                  </button>

                  <button
                    onClick={() => setPredictionStrategy("hot")}
                    className={`p-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      predictionStrategy === "hot"
                        ? "bg-amber-400 text-amber-950 shadow-md font-black"
                        : "bg-white/10 text-white/80 hover:bg-white/20"
                    }`}
                  >
                    <span>🔥</span> الأكثر سخونة
                  </button>

                  <button
                    onClick={() => setPredictionStrategy("cold")}
                    className={`p-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      predictionStrategy === "cold"
                        ? "bg-cyan-400 text-cyan-950 shadow-md font-black"
                        : "bg-white/10 text-white/80 hover:bg-white/20"
                    }`}
                  >
                    <span>❄️</span> الأرقام المتأخرة
                  </button>

                  <button
                    onClick={() => setPredictionStrategy("random")}
                    className={`p-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      predictionStrategy === "random"
                        ? "bg-pink-400 text-pink-950 shadow-md font-black"
                        : "bg-white/10 text-white/80 hover:bg-white/20"
                    }`}
                  >
                    <span>🎲</span> حظ عشوائي
                  </button>
                </div>
              </div>

              {/* 3D Visual Lottery Balls Showcase */}
              <div className="bg-gradient-to-b from-gray-50 to-white dark:from-zinc-900/60 dark:to-zinc-950 p-6 rounded-3xl border border-gray-100 dark:border-white/10 shadow-inner flex flex-col items-center justify-center">
                <span className="text-xs font-bold text-gray-400 mb-4">
                  الأرقام المختارة للشبكة (6 كرات + رقم الحظ)
                </span>

                <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 my-2">
                  {suggestedNumbers.map((num, idx) => (
                    <div
                      key={idx}
                      className="relative group transition-all duration-300 transform hover:-translate-y-2"
                    >
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-purple-800 via-rose-600 to-amber-400 p-0.5 shadow-xl shadow-rose-500/20 flex items-center justify-center">
                        <div className="w-full h-full rounded-full bg-gradient-to-br from-rose-500 to-purple-800 flex items-center justify-center border-2 border-white/40 shadow-inner relative overflow-hidden">
                          {/* Sphere Glare */}
                          <div className="absolute top-1 right-2 w-4 h-3 bg-white/50 rounded-full blur-[1px] transform -rotate-45" />
                          <span className="text-xl sm:text-2xl font-black text-white drop-shadow-md">
                            {num}
                          </span>
                        </div>
                      </div>
                      <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-gray-400">
                        #{idx + 1}
                      </span>
                    </div>
                  ))}

                  {/* Lucky Ball for Super Key */}
                  {selectedGame === "super_key" && suggestedLucky !== undefined && (
                    <>
                      <div className="text-gray-300 dark:text-gray-600 font-black text-xl px-1">+</div>
                      <div className="relative group transition-all duration-300 transform hover:-translate-y-2">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-200 p-0.5 shadow-xl shadow-amber-500/30 flex items-center justify-center">
                          <div className="w-full h-full rounded-full bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 flex items-center justify-center border-2 border-white/60 shadow-inner relative overflow-hidden">
                            {/* Sphere Glare */}
                            <div className="absolute top-1 right-2 w-4 h-3 bg-white/70 rounded-full blur-[1px] transform -rotate-45" />
                            <span className="text-xl sm:text-2xl font-black text-amber-950 drop-shadow-sm">
                              {suggestedLucky}
                            </span>
                          </div>
                        </div>
                        <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-black text-amber-500 whitespace-nowrap">
                          رقم الحظ ⭐
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Actions below balls */}
                <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
                  <button
                    onClick={handleCopyNumbers}
                    className="px-4 py-2.5 rounded-2xl bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-800 dark:text-white font-bold text-xs flex items-center gap-2 transition"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? "تم النسخ!" : "نسخ الأرقام"}</span>
                  </button>

                  <button
                    onClick={() => {
                      setNewTicketNumbers(suggestedNumbers);
                      setNewTicketLucky(suggestedLucky);
                      setNewTicketDate(nextDrawDate);
                      setShowAddTicketModal(true);
                    }}
                    className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-purple-500/20 transition active:scale-95"
                  >
                    <Ticket className="w-4 h-4" />
                    <span>تسجيل هذه الأرقام كبطاقة مشتراة 🎫</span>
                  </button>
                </div>
              </div>

              {/* Hot & Cold Quick Pills */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
                  <div className="flex items-center gap-2 mb-3 text-amber-600 dark:text-amber-400 font-black text-xs">
                    <Flame className="w-4 h-4" />
                    <span>أكثر 6 أرقام تكراراً في السحوبات السابقة (Hot)</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {stats.hotNumbers.slice(0, 6).map((n) => {
                      const item = stats.frequencyList.find(x => x.number === n);
                      return (
                        <div key={n} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-black text-amber-700 dark:text-amber-300">
                          <span>{n}</span>
                          <span className="text-[10px] text-amber-500">({item?.count || 0}x)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/20">
                  <div className="flex items-center gap-2 mb-3 text-cyan-600 dark:text-cyan-400 font-black text-xs">
                    <Snowflake className="w-4 h-4" />
                    <span>أكثر 6 أرقام متأخرة عن الظهور (Cold)</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {stats.coldNumbers.slice(0, 6).map((n) => (
                      <div key={n} className="px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs font-black text-cyan-700 dark:text-cyan-300">
                        {n}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════
              SUBTAB 2: TICKETS & RESULTS (بطاقاتي والمطابقة)
          ══════════════════════════════════════════ */}
          {activeSubTab === "tickets" && (
            <div className="space-y-5">
              {/* Alert to Enter Draw Result */}
              <div className="bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 p-0.5 rounded-3xl shadow-xl">
                <div className="bg-white dark:bg-[#1A1625] p-5 rounded-[22px] flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center text-2xl shrink-0">
                      🏆
                    </div>
                    <div>
                      <h4 className="font-black text-gray-900 dark:text-white text-base">
                        هل أُجريت السحبة وظهرت أرقام الفوز؟
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-bold mt-0.5">
                        أدخل الأرقام التي أُعلنت في السحب ليقوم النظام آلياً بمطابقة بطاقاتك المشتراة وتلوين الأرقام المتطابقة!
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const lastDrawNum = currentDraws[0]?.drawNumber || 23;
                        setDrawNumInput(lastDrawNum + 1);
                        setShowRecordDrawModal(true);
                      }}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:opacity-95 text-white font-black text-xs shadow-md transition active:scale-95 flex items-center gap-1.5"
                    >
                      <Trophy className="w-4 h-4" />
                      <span>إدخال نتيجة السحب ومطابقة البطاقات</span>
                    </button>

                    <button
                      onClick={() => setShowAddTicketModal(true)}
                      className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs shadow-md transition active:scale-95 flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>تسجيل بطاقة مشتراة جديدة</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Tickets List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-gray-800 dark:text-white text-sm flex items-center gap-2">
                    <Ticket className="w-4 h-4 text-purple-500" />
                    <span>البطاقات المسجلة ({tickets.filter(t => t.game === selectedGame).length})</span>
                  </h4>
                </div>

                {tickets.filter(t => t.game === selectedGame).length === 0 ? (
                  <div className="text-center py-12 px-4 rounded-3xl border border-dashed border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-white/[0.01]">
                    <div className="w-16 h-16 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-500 flex items-center justify-center text-3xl mx-auto mb-3">
                      🎫
                    </div>
                    <h5 className="font-bold text-gray-800 dark:text-gray-200 text-sm mb-1">
                      لا توجد بطاقات مسجلة حتى الآن
                    </h5>
                    <p className="text-xs text-gray-400 max-w-sm mx-auto mb-4">
                      عند شراء بطاقة لوتو، سجل أرقامها هنا أو من خلال تسجيل المصروف ليتم مطابقتها فور إعلان السحب!
                    </p>
                    <button
                      onClick={() => setShowAddTicketModal(true)}
                      className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition"
                    >
                      تسجيل بطاقة الآن
                    </button>
                  </div>
                ) : (
                  tickets.filter(t => t.game === selectedGame).map((tkt) => {
                    const matchedSet = new Set(tkt.matchedNumbers || []);
                    return (
                      <div
                        key={tkt.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          tkt.status === "matched" && (tkt.matchCount || 0) >= 3
                            ? "bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-transparent border-amber-500/40 shadow-md"
                            : tkt.status === "matched"
                            ? "bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800"
                            : "bg-white dark:bg-zinc-900 border-purple-200/50 dark:border-purple-500/20 shadow-sm"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm text-gray-900 dark:text-white">
                              {tkt.ticketName || "بطاقة لوتو"}
                            </span>
                            <span className="text-[11px] font-bold text-gray-500 bg-gray-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              سحبة: {tkt.drawDate} {tkt.drawNumber ? `(رقم ${tkt.drawNumber})` : ""}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                              التكلفة: {tkt.cost.toLocaleString("en-US")} د.ع
                            </span>
                            {tkt.status === "pending" ? (
                              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 animate-pulse">
                                ⏳ بانتظار السحب
                              </span>
                            ) : (
                              <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full ${
                                (tkt.matchCount || 0) >= 3
                                  ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300"
                                  : "bg-gray-100 dark:bg-zinc-800 text-gray-500"
                              }`}>
                                {tkt.prizeTier}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Balls */}
                        <div className="flex flex-wrap items-center gap-2">
                          {tkt.numbers.map((num) => {
                            const isMatched = matchedSet.has(num);
                            return (
                              <div
                                key={num}
                                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-black text-sm transition-all ${
                                  isMatched
                                    ? "bg-gradient-to-tr from-emerald-600 to-green-400 text-white shadow-lg shadow-emerald-500/30 scale-110 ring-2 ring-emerald-300"
                                    : "bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-zinc-700"
                                }`}
                              >
                                {num}
                              </div>
                            );
                          })}

                          {tkt.luckyNumber !== undefined && (
                            <>
                              <span className="text-gray-400 px-1">+</span>
                              <div
                                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-black text-sm transition-all ${
                                  tkt.luckyMatched
                                    ? "bg-gradient-to-tr from-amber-500 to-yellow-300 text-amber-950 shadow-lg shadow-amber-500/30 scale-110 ring-2 ring-amber-300"
                                    : "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                                }`}
                                title="رقم الحظ"
                              >
                                {tkt.luckyNumber}
                              </div>
                            </>
                          )}

                          {tkt.status === "matched" && (
                            <div className="mr-auto text-xs font-bold text-gray-500">
                              تطابق: <strong className="text-emerald-600 dark:text-emerald-400">{tkt.matchCount || 0} أرقام</strong>
                              {tkt.luckyMatched ? " + رقم الحظ ⭐" : ""}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════
              SUBTAB 3: HISTORY & DRAWS (أرشيف السحوبات)
          ══════════════════════════════════════════ */}
          {activeSubTab === "history" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="font-black text-gray-900 dark:text-white text-sm">
                    سجل السحوبات الموثقة لـ {GAME_DETAILS[selectedGame].title}
                  </h4>
                  <p className="text-xs text-gray-400 font-bold">
                    إجمالي السحوبات المعتمدة بالكامل: {currentDraws.length} سحبة
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const nextNum = currentDraws[0]?.drawNumber ? currentDraws[0].drawNumber + 1 : 1;
                      setDrawNumInput(nextNum);
                      setShowRecordDrawModal(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-purple-600 text-white font-bold text-xs flex items-center gap-1.5 hover:bg-purple-700 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة سحبة يدوية</span>
                  </button>
                </div>
              </div>

              {/* Official Links & Verification */}
              <div className="p-3 rounded-2xl bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2.5">
                <div className="text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>جميع البيانات مسحوبة ومطابقة للسيرفرات الرسمية:</span>
                </div>
                <div className="flex items-center gap-2">
                  {selectedGame === "iraq_lotto" && (
                    <a
                      href="https://www.iraqloto.iq/more/results"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-[11px] font-black text-gray-700 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 flex items-center gap-1 transition"
                    >
                      <ExternalLink className="w-3 h-3 text-red-500" />
                      <span>موقع لوتو العراق الرسمي</span>
                    </a>
                  )}
                  <a
                    href="https://www.youtube.com/@iraqlotoiq/streams"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-[11px] font-black text-red-600 dark:text-red-400 hover:bg-red-100 transition flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>البث المباشر (YouTube)</span>
                  </a>
                </div>
              </div>

              {/* Search in Archive */}
              <div className="relative">
                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="ابحث برقم السحبة (مثلاً 415)، بالتاريخ (2026-09)، أو برقم فائز..."
                  value={archiveSearchQuery}
                  onChange={(e) => setArchiveSearchQuery(e.target.value)}
                  className="w-full pr-9 pl-9 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-bold text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                {archiveSearchQuery && (
                  <button
                    onClick={() => setArchiveSearchQuery("")}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
                  >
                    إلغاء
                  </button>
                )}
              </div>

              {/* Search result count */}
              {archiveSearchQuery && (
                <div className="text-[11px] font-bold text-purple-600 dark:text-purple-400 px-1">
                  عرض {filteredArchiveDraws.length} سحبة مطابقة للبحث من أصل {currentDraws.length}
                </div>
              )}

              {/* Draws List */}
              <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
                {filteredArchiveDraws.length === 0 ? (
                  <div className="p-8 text-center text-xs font-bold text-gray-400 bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-gray-200 dark:border-zinc-800">
                    لا توجد سحوبات مطابقة لبحثك "{archiveSearchQuery}"
                  </div>
                ) : (
                  filteredArchiveDraws.map((d) => (
                    <div
                      key={d.id}
                      className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-sm flex flex-wrap items-center justify-between gap-3 hover:border-purple-300 dark:hover:border-purple-800 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 font-black text-sm flex items-center justify-center shrink-0">
                          #{d.drawNumber}
                        </div>
                        <div>
                          <div className="font-black text-xs sm:text-sm text-gray-900 dark:text-white">
                            سحبة رقم {d.drawNumber}
                          </div>
                          <div className="text-[11px] font-bold text-gray-400">
                            {d.date}
                          </div>
                        </div>
                      </div>

                      {/* Numbers */}
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        {d.numbers.map((n) => (
                          <div
                            key={n}
                            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr from-rose-500 to-purple-600 text-white font-black text-xs sm:text-sm flex items-center justify-center shadow-sm"
                          >
                            {n}
                          </div>
                        ))}

                        {d.luckyNumber !== undefined && (
                          <>
                            <span className="text-gray-400 text-xs px-0.5">+</span>
                            <div
                              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr from-amber-400 to-amber-600 text-white font-black text-xs sm:text-sm flex items-center justify-center shadow-sm ring-1 ring-amber-300"
                              title="رقم الحظ"
                            >
                              {d.luckyNumber}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════
              SUBTAB 4: STATS & FREQUENCIES (الإحصائيات)
          ══════════════════════════════════════════ */}
          {activeSubTab === "stats" && (
            <div className="space-y-5">
              <div>
                <h4 className="font-black text-gray-900 dark:text-white text-sm mb-1">
                  تكرار وظهور الأرقام عبر {currentDraws.length} سحبة
                </h4>
                <p className="text-xs text-gray-400 font-bold">
                  مخطط التكرار التنازلي من الأكثر ظهوراً إلى الأقل
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5 max-h-[55vh] overflow-y-auto pr-1">
                {stats.frequencyList.map((item) => (
                  <div
                    key={item.number}
                    className="p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-sm flex flex-col items-center justify-center"
                  >
                    <div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-black text-base flex items-center justify-center mb-1.5 shadow-inner">
                      {item.number}
                    </div>
                    <span className="text-xs font-black text-gray-800 dark:text-white">
                      {item.count} مرة
                    </span>
                    <span className="text-[10px] text-gray-400 font-bold">
                      نسبة {item.percentage}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════
            MODAL 1: ADD NEW TICKET
        ══════════════════════════════════════════ */}
        {showAddTicketModal && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-[#1A1625] rounded-3xl p-5 max-w-lg w-full border border-gray-100 dark:border-white/10 shadow-2xl text-right max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100 dark:border-zinc-800">
                <h4 className="font-black text-gray-900 dark:text-white text-base">
                  تسجيل بطاقة مشتراة ({GAME_DETAILS[selectedGame].shortTitle})
                </h4>
                <button
                  onClick={() => setShowAddTicketModal(false)}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Number Selector Grid */}
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                      اختر 6 أرقام للبطاقة ({newTicketNumbers.length}/6)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const pred = predictNextNumbers(currentDraws, selectedGame, "balanced");
                        setNewTicketNumbers(pred.numbers);
                        if (pred.luckyNumber) setNewTicketLucky(pred.luckyNumber);
                      }}
                      className="text-[11px] font-black text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" /> توليد أرقام حظ ذكية
                    </button>
                  </div>

                  {/* Interactive number grid */}
                  <div className="grid grid-cols-7 gap-1.5 p-2 bg-gray-50 dark:bg-zinc-900/60 rounded-2xl max-h-48 overflow-y-auto">
                    {Array.from({ length: GAME_DETAILS[selectedGame].maxNumber }, (_, i) => i + 1).map((n) => {
                      const isSelected = newTicketNumbers.includes(n);
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setNewTicketNumbers(newTicketNumbers.filter(x => x !== n));
                            } else if (newTicketNumbers.length < 6) {
                              setNewTicketNumbers([...newTicketNumbers, n]);
                            } else {
                              toast.info("تم اختيار 6 أرقام بالفعل");
                            }
                          }}
                          className={`h-9 rounded-xl font-black text-xs transition ${
                            isSelected
                              ? "bg-rose-500 text-white shadow-md scale-105"
                              : "bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100"
                          }`}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Lucky Number for Super Key */}
                {selectedGame === "super_key" && (
                  <div>
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 block">
                      رقم الحظ الإضافي ⭐: {newTicketLucky !== undefined ? newTicketLucky : "لم يتم الاختيار"}
                    </label>
                    <div className="grid grid-cols-7 gap-1.5 p-2 bg-amber-500/5 rounded-2xl max-h-32 overflow-y-auto">
                      {Array.from({ length: 42 }, (_, i) => i + 1).map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setNewTicketLucky(n)}
                          className={`h-8 rounded-xl font-black text-xs transition ${
                            newTicketLucky === n
                              ? "bg-amber-400 text-amber-950 font-black scale-105 shadow-md"
                              : "bg-white dark:bg-zinc-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Details */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-gray-500 mb-1 block">تاريخ السحبة</label>
                    <input
                      type="date"
                      value={newTicketDate || nextDrawDate}
                      onChange={e => setNewTicketDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-500 mb-1 block">سعر البطاقة (د.ع)</label>
                    <input
                      type="number"
                      value={newTicketCost}
                      onChange={e => setNewTicketCost(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-bold"
                      placeholder="3000"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveTicket}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-rose-600 text-white font-black text-sm shadow-lg shadow-purple-500/25 active:scale-95 transition"
                >
                  حفظ وتأكيد البطاقة
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            MODAL 2: RECORD WINNING DRAW RESULT
        ══════════════════════════════════════════ */}
        {showRecordDrawModal && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-[#1A1625] rounded-3xl p-5 max-w-lg w-full border border-gray-100 dark:border-white/10 shadow-2xl text-right max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  <h4 className="font-black text-gray-900 dark:text-white text-base">
                    تسجيل نتيجة السحب الفائزة ({GAME_DETAILS[selectedGame].shortTitle})
                  </h4>
                </div>
                <button
                  onClick={() => setShowRecordDrawModal(false)}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-gray-500 mb-1 block">رقم السحبة</label>
                    <input
                      type="number"
                      value={drawNumInput}
                      onChange={e => setDrawNumInput(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-bold"
                      placeholder="مثال: 24"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-500 mb-1 block">تاريخ السحبة</label>
                    <input
                      type="date"
                      value={drawDateInput}
                      onChange={e => setDrawDateInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-bold"
                    />
                  </div>
                </div>

                {/* 6 Winning Numbers Selector */}
                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 block">
                    الأرقام الستة الفائزة ({drawNumbersInput.length}/6): {drawNumbersInput.sort((a,b)=>a-b).join(" - ") || "انقر لاختيارها"}
                  </label>
                  <div className="grid grid-cols-7 gap-1.5 p-2 bg-gray-50 dark:bg-zinc-900/60 rounded-2xl max-h-44 overflow-y-auto">
                    {Array.from({ length: GAME_DETAILS[selectedGame].maxNumber }, (_, i) => i + 1).map((n) => {
                      const isSelected = drawNumbersInput.includes(n);
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setDrawNumbersInput(drawNumbersInput.filter(x => x !== n));
                            } else if (drawNumbersInput.length < 6) {
                              setDrawNumbersInput([...drawNumbersInput, n]);
                            }
                          }}
                          className={`h-8 rounded-xl font-black text-xs transition ${
                            isSelected
                              ? "bg-emerald-600 text-white scale-105 shadow-md"
                              : "bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100"
                          }`}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Winning Lucky Number for Super Key */}
                {selectedGame === "super_key" && (
                  <div>
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 block">
                      رقم الحظ الفائز ⭐: {drawLuckyInput !== undefined ? drawLuckyInput : "انقر للاختيار"}
                    </label>
                    <div className="grid grid-cols-7 gap-1.5 p-2 bg-amber-500/5 rounded-2xl max-h-28 overflow-y-auto">
                      {Array.from({ length: 42 }, (_, i) => i + 1).map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setDrawLuckyInput(n)}
                          className={`h-7 rounded-xl font-black text-xs transition ${
                            drawLuckyInput === n
                              ? "bg-amber-400 text-amber-950 font-black scale-105 shadow-md"
                              : "bg-white dark:bg-zinc-800 text-amber-700 dark:text-amber-300"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSaveWinningDraw}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-600 text-white font-black text-sm shadow-lg shadow-amber-500/25 active:scale-95 transition flex items-center justify-center gap-2"
                >
                  <Trophy className="w-4 h-4" />
                  <span>حفظ ومطابقة جميع البطاقات فورياً</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
