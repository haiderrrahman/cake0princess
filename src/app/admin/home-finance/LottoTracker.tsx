"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  X, Sparkles, Trophy, Calendar, Ticket, Plus, CheckCircle2,
  AlertCircle, Copy, Check, BarChart2, Flame, Snowflake, RotateCcw,
  Clock, Hash, DollarSign, ExternalLink, Search, Volume2, VolumeX,
  PartyPopper, Trash2, Camera, Loader2, Lock, Unlock, Sliders, CheckCheck
} from "lucide-react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { scanLottoWithGemini } from "@/lib/scanLottoClient";
import {
  LottoGameType, LottoDraw, LottoTicket, SavedPrediction, PredictionAnalysis,
  GAME_DETAILS, INITIAL_SUPER_KEY_DRAWS, INITIAL_IRAQ_LOTTO_DRAWS,
  getNextDrawDate, calculateLottoStats, predictNextNumbers, analyzeCombination, checkTicketMatch
} from "./lottoTypes";

const getTodayStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// ══════════════════════════════════════════════════════
// THEATRICAL AUDIO & SPEECH SYNTHESIS ENGINE
// ══════════════════════════════════════════════════════
function playTheatricalFanfare() {
  try {
    if (typeof window === "undefined") return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    // Celebratory Trumpet Fanfare: G4 -> C5 -> E5 -> G5 -> C6
    const fanfareNotes = [
      { f: 392.00, t: 0.00, d: 0.12, type: "sawtooth" },
      { f: 523.25, t: 0.12, d: 0.14, type: "sawtooth" },
      { f: 659.25, t: 0.26, d: 0.14, type: "sawtooth" },
      { f: 783.99, t: 0.40, d: 0.20, type: "sawtooth" },
      { f: 1046.50, t: 0.60, d: 0.65, type: "sawtooth" },
    ];

    fanfareNotes.forEach(({ f, t, d, type }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type as OscillatorType;
      osc.frequency.setValueAtTime(f, ctx.currentTime + t);

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(2200, ctx.currentTime + t);

      gain.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + d);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + d + 0.05);
    });

    // Glittering high bell arpeggios
    const bells = [1318.51, 1567.98, 2093.00, 2637.02];
    bells.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f, ctx.currentTime + 0.62 + i * 0.08);

      gain.gain.setValueAtTime(0.0001, ctx.currentTime + 0.62 + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.62 + i * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.62 + i * 0.08 + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + 0.62 + i * 0.08);
      osc.stop(ctx.currentTime + 0.62 + i * 0.08 + 0.5);
    });
  } catch (err) {
    console.warn("Fanfare Web Audio error:", err);
  }
}

function speakTheatricalAnnouncement(text: string) {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ar-SA";
    utterance.rate = 1.05;
    utterance.pitch = 1.1;
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn("Speech synthesis error:", err);
  }
}

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
  const [tickets, setTickets] = useState<LottoTicket[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const c = localStorage.getItem("cache_lotto_tickets");
        if (c) return JSON.parse(c);
      } catch (e) {}
    }
    return [];
  });
  const [loading, setLoading] = useState(false);

  // Archive search filter
  const [archiveSearchQuery, setArchiveSearchQuery] = useState("");

  // Prediction state & persistence ("ثابت على الرقم اله اختار")
  const [predictionStrategy, setPredictionStrategy] = useState<"balanced" | "hot" | "cold" | "ai_hybrid">("balanced");
  const [suggestedNumbers, setSuggestedNumbers] = useState<number[]>([]);
  const [suggestedLucky, setSuggestedLucky] = useState<number | undefined>();
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [predictionAnalysis, setPredictionAnalysis] = useState<PredictionAnalysis | null>(null);
  const [showCustomPicker, setShowCustomPicker] = useState<boolean>(false);
  const [savedPredictions, setSavedPredictions] = useState<Record<string, SavedPrediction>>(() => {
    if (typeof window !== "undefined") {
      try {
        const c = localStorage.getItem("cache_lotto_predictions");
        if (c) return JSON.parse(c);
      } catch (e) {}
    }
    return {};
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Theatrical Celebration state
  const [theatricalTicket, setTheatricalTicket] = useState<LottoTicket | null>(null);
  const [theatricalCopied, setTheatricalCopied] = useState(false);

  // New ticket modal state - Prices: Super Key = 2,350 IQD (محدث) | Iraq Lotto = 1,500 IQD
  const [showAddTicketModal, setShowAddTicketModal] = useState(false);
  const [newTicketNumbers, setNewTicketNumbers] = useState<number[]>([]);
  const [newTicketLucky, setNewTicketLucky] = useState<number | undefined>();
  const [newTicketCost, setNewTicketCost] = useState<number>(GAME_DETAILS["super_key"].ticketPrice);
  const [newTicketDate, setNewTicketDate] = useState<string>("");
  const [newTicketDrawNum, setNewTicketDrawNum] = useState<string>("");

  // Keep price and number constraints strictly updated when game changes
  useEffect(() => {
    setNewTicketCost(GAME_DETAILS[selectedGame].ticketPrice);
    setNewTicketNumbers(prev => prev.filter(n => n <= GAME_DETAILS[selectedGame].maxNumber));
    if (selectedGame !== "super_key") {
      setNewTicketLucky(undefined);
    }
  }, [selectedGame]);

  // Record winning draw modal
  const [showRecordDrawModal, setShowRecordDrawModal] = useState(false);
  const [drawNumInput, setDrawNumInput] = useState<number>(24);
  const [drawDateInput, setDrawDateInput] = useState<string>(new Date().toISOString().split("T")[0]);
  const [drawNumbersInput, setDrawNumbersInput] = useState<number[]>([]);
  const [drawLuckyInput, setDrawLuckyInput] = useState<number | undefined>();

  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState("");
  const ticketFileInputRef = useRef<HTMLInputElement>(null);
  const drawFileInputRef = useRef<HTMLInputElement>(null);

  const handleScanFile = async (e: React.ChangeEvent<HTMLInputElement>, target: "ticket" | "draw") => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanning(true);
    setScanStatus("جاري معالجة وقراءة الصورة...");

    try {
      const reader = new FileReader();
      const base64DataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const result = await scanLottoWithGemini(base64DataUrl, target, setScanStatus);

      if (target === "ticket") {
        if (result.purchasedTickets && result.purchasedTickets.length > 0) {
          const t = result.purchasedTickets[0];
          setNewTicketNumbers(t.numbers);
          if (t.luckyNumber !== undefined && selectedGame === "super_key") {
            setNewTicketLucky(t.luckyNumber);
          }
          if (t.cost) setNewTicketCost(t.cost);
          if (result.drawNumber) setNewTicketDrawNum(String(result.drawNumber));
          if (result.drawDate) setNewTicketDate(result.drawDate);
          toast.success(`تم قراءة بطاقة اللوتو المشتراة بنجاح: ${t.numbers.join(" - ")} 🎫`);
        } else {
          toast.error("لم نتمكن من العثور على 6 أرقام واضحة في البطاقة. يرجى التأكد من وضوح الصورة.");
        }
      } else {
        if (result.winningNumbers && result.winningNumbers.length === 6) {
          setDrawNumbersInput(result.winningNumbers);
          if (result.luckyNumber !== undefined && selectedGame === "super_key") {
            setDrawLuckyInput(result.luckyNumber);
          }
          if (result.drawNumber) setDrawNumInput(result.drawNumber);
          if (result.drawDate) setDrawDateInput(result.drawDate);
          toast.success(`تم قراءة الأرقام الفائزة بنجاح: ${result.winningNumbers.join(" - ")} 🏆`);
        } else {
          toast.error("لم نتمكن من تحديد 6 أرقام فائزة في الصورة.");
        }
      }
    } catch (err: any) {
      console.error("Scan error:", err);
      toast.error(err.message || "حدث خطأ أثناء مسح الصورة بالذكاء الاصطناعي");
    } finally {
      setIsScanning(false);
      setScanStatus("");
      if (e.target) e.target.value = "";
    }
  };

  // 1. Subscribe to Firestore & Sync without overwriting
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
            superKeyDraws: JSON.parse(JSON.stringify(mergedSuperKey))
          }, { merge: true }).catch(e => console.error("SuperKey sync error:", e));
        }

        // 2. Iraq Lotto sync & auto-upgrade
        if (data.iraqLottoDraws && data.iraqLottoDraws.length >= INITIAL_IRAQ_LOTTO_DRAWS.length) {
          setIraqLottoDraws(data.iraqLottoDraws);
        } else {
          const existingDrawNumbers = new Set((data.iraqLottoDraws || []).map((d: LottoDraw) => d.drawNumber));
          const missingDraws = INITIAL_IRAQ_LOTTO_DRAWS.filter(d => !existingDrawNumbers.has(d.drawNumber));
          const mergedIraqLotto = [...(data.iraqLottoDraws || []), ...missingDraws].sort((a, b) => b.drawNumber - a.drawNumber);
          setIraqLottoDraws(mergedIraqLotto);
          setDoc(doc(db, "home_finance", "lotto_hub"), {
            iraqLottoDraws: JSON.parse(JSON.stringify(mergedIraqLotto))
          }, { merge: true }).catch(e => console.error("IraqLotto sync error:", e));
        }

        // 3. Saved Predictions sync
        if (data.savedPredictions) {
          setSavedPredictions(data.savedPredictions);
          try {
            localStorage.setItem("cache_lotto_predictions", JSON.stringify(data.savedPredictions));
          } catch (e) {}
        }

        // 4. Tickets sync & auto-evaluation
        if (data.tickets && Array.isArray(data.tickets)) {
          setTickets(data.tickets);
          try {
            localStorage.setItem("cache_lotto_tickets", JSON.stringify(data.tickets));
          } catch (e) {}
        }
      } else {
        // Initialize document with complete sets
        setDoc(doc(db, "home_finance", "lotto_hub"), {
          superKeyDraws: JSON.parse(JSON.stringify(INITIAL_SUPER_KEY_DRAWS)),
          iraqLottoDraws: JSON.parse(JSON.stringify(INITIAL_IRAQ_LOTTO_DRAWS)),
          tickets: [],
          savedPredictions: {}
        }).catch(e => console.error("Init lotto_hub error:", e));
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

  // Synchronize or load prediction for current game WITHOUT randomizing on refresh
  useEffect(() => {
    const saved = savedPredictions[selectedGame];
    if (saved && saved.numbers && saved.numbers.length === 6) {
      setSuggestedNumbers(saved.numbers);
      setSuggestedLucky(saved.luckyNumber);
      setIsLocked(!!saved.isLocked);
      if (saved.strategy && saved.strategy !== "custom") setPredictionStrategy(saved.strategy as any);
      setPredictionAnalysis(saved.analysis || null);
    } else {
      // Generate initial prediction once if none ever existed
      const pred = predictNextNumbers(currentDraws, selectedGame, predictionStrategy);
      setSuggestedNumbers(pred.numbers);
      setSuggestedLucky(pred.luckyNumber);
      setPredictionAnalysis(pred.analysis);
      setIsLocked(false);
      
      const newSaved: SavedPrediction = {
        game: selectedGame,
        numbers: pred.numbers,
        luckyNumber: pred.luckyNumber,
        isLocked: false,
        strategy: predictionStrategy,
        confidenceScore: pred.analysis.confidenceScore,
        analysis: pred.analysis,
        updatedAt: new Date().toISOString()
      };
      const updatedAll = { ...savedPredictions, [selectedGame]: newSaved };
      setSavedPredictions(updatedAll);
      try {
        localStorage.setItem("cache_lotto_predictions", JSON.stringify(updatedAll));
      } catch (e) {}
      setDoc(doc(db, "home_finance", "lotto_hub"), {
        savedPredictions: updatedAll
      }, { merge: true }).catch(e => console.error("Save prediction error:", e));
    }
  }, [selectedGame]);

  // Explicit prediction generator (only when user clicks generate or switches strategy)
  const handleGeneratePrediction = (forcedStrategy?: "balanced" | "hot" | "cold" | "ai_hybrid") => {
    setIsGenerating(true);
    const strat = forcedStrategy || predictionStrategy;
    setTimeout(() => {
      // If user has locked numbers, pass them to be preserved!
      const lockedPool = isLocked ? suggestedNumbers : [];
      const lockedLuckyPool = isLocked ? suggestedLucky : undefined;
      const pred = predictNextNumbers(currentDraws, selectedGame, strat, lockedPool, lockedLuckyPool);
      setSuggestedNumbers(pred.numbers);
      setSuggestedLucky(pred.luckyNumber);
      setPredictionAnalysis(pred.analysis);
      setIsGenerating(false);

      const newSaved: SavedPrediction = {
        game: selectedGame,
        numbers: pred.numbers,
        luckyNumber: pred.luckyNumber,
        isLocked,
        strategy: strat,
        confidenceScore: pred.analysis.confidenceScore,
        analysis: pred.analysis,
        updatedAt: new Date().toISOString()
      };
      const updatedAll = { ...savedPredictions, [selectedGame]: newSaved };
      setSavedPredictions(updatedAll);
      try {
        localStorage.setItem("cache_lotto_predictions", JSON.stringify(updatedAll));
      } catch (e) {}
      setDoc(doc(db, "home_finance", "lotto_hub"), {
        savedPredictions: updatedAll
      }, { merge: true }).catch(e => console.error("Save prediction error:", e));
      toast.success("تم تحديث التنبؤ الإحصائي وحفظه بنجاح 🎯");
    }, 200);
  };

  // Toggle lock on user chosen numbers ("ثابت على الرقم اله اختار")
  const handleToggleLock = () => {
    const nextLocked = !isLocked;
    setIsLocked(nextLocked);
    const currentAnalysis = predictionAnalysis || analyzeCombination(suggestedNumbers, selectedGame, stats);
    const newSaved: SavedPrediction = {
      game: selectedGame,
      numbers: suggestedNumbers,
      luckyNumber: suggestedLucky,
      isLocked: nextLocked,
      strategy: predictionStrategy,
      confidenceScore: currentAnalysis.confidenceScore,
      analysis: currentAnalysis,
      updatedAt: new Date().toISOString()
    };
    const updatedAll = { ...savedPredictions, [selectedGame]: newSaved };
    setSavedPredictions(updatedAll);
    try {
      localStorage.setItem("cache_lotto_predictions", JSON.stringify(updatedAll));
    } catch (e) {}
    setDoc(doc(db, "home_finance", "lotto_hub"), {
      savedPredictions: updatedAll
    }, { merge: true }).catch(e => console.error("Save prediction error:", e));

    if (nextLocked) {
      toast.success("تم تثبيت وقفل أرقامك بنجاح! ستبقى ثابتة ولن تتغير بأي رفرش 🔒");
    } else {
      toast.info("تم فك قفل الأرقام 🔓");
    }
  };

  // Custom number toggle in interactive matrix
  const handleToggleCustomNumber = (num: number) => {
    let nextNums: number[];
    if (suggestedNumbers.includes(num)) {
      nextNums = suggestedNumbers.filter(n => n !== num);
    } else {
      if (suggestedNumbers.length >= 6) {
        toast.warning("تم اختيار 6 أرقام بالفعل. اضغط على رقم لإلغائه أولاً.");
        return;
      }
      nextNums = [...suggestedNumbers, num].sort((a, b) => a - b);
    }
    setSuggestedNumbers(nextNums);

    if (nextNums.length === 6) {
      const ana = analyzeCombination(nextNums, selectedGame, stats, "أرقام مختارة ومثبتة");
      setPredictionAnalysis(ana);
      const newSaved: SavedPrediction = {
        game: selectedGame,
        numbers: nextNums,
        luckyNumber: suggestedLucky,
        isLocked: true,
        strategy: "custom",
        confidenceScore: ana.confidenceScore,
        analysis: ana,
        updatedAt: new Date().toISOString()
      };
      setIsLocked(true);
      const updatedAll = { ...savedPredictions, [selectedGame]: newSaved };
      setSavedPredictions(updatedAll);
      try {
        localStorage.setItem("cache_lotto_predictions", JSON.stringify(updatedAll));
      } catch (e) {}
      setDoc(doc(db, "home_finance", "lotto_hub"), {
        savedPredictions: updatedAll
      }, { merge: true }).catch(e => console.error("Save custom prediction error:", e));
      toast.success("تم تثبيت وحفظ توليفة الـ 6 أرقام الخاصة بك بنجاح 🔒🎯");
    }
  };

  // Custom lucky number selection
  const handleSelectCustomLucky = (luckyNum: number) => {
    setSuggestedLucky(luckyNum);
    if (suggestedNumbers.length === 6) {
      const ana = analyzeCombination(suggestedNumbers, selectedGame, stats, "أرقام مختارة ومثبتة");
      const newSaved: SavedPrediction = {
        game: selectedGame,
        numbers: suggestedNumbers,
        luckyNumber: luckyNum,
        isLocked: true,
        strategy: "custom",
        confidenceScore: ana.confidenceScore,
        analysis: ana,
        updatedAt: new Date().toISOString()
      };
      const updatedAll = { ...savedPredictions, [selectedGame]: newSaved };
      setSavedPredictions(updatedAll);
      try {
        localStorage.setItem("cache_lotto_predictions", JSON.stringify(updatedAll));
      } catch (e) {}
      setDoc(doc(db, "home_finance", "lotto_hub"), {
        savedPredictions: updatedAll
      }, { merge: true }).catch(e => console.error("Save custom lucky error:", e));
      toast.success(`تم اختيار وتثبيت رقم الحظ (${luckyNum}) 🌟`);
    }
  };

  // Audit and auto-match all tickets with registered draws
  const handleAuditAllTickets = async () => {
    setLoading(true);
    let updatedCount = 0;
    const reAuditedTickets = tickets.map(tkt => {
      const gameDraws = tkt.game === "super_key" ? superKeyDraws : iraqLottoDraws;
      
      // Match by drawNumber if present, or by exact date, or by closest date within 3 days
      let matchingDraw = gameDraws.find(d => tkt.drawNumber && d.drawNumber === tkt.drawNumber);
      if (!matchingDraw) {
        matchingDraw = gameDraws.find(d => d.date === tkt.drawDate);
      }
      if (!matchingDraw && tkt.drawDate) {
        const tTime = new Date(tkt.drawDate).getTime();
        matchingDraw = gameDraws.find(d => {
          const dTime = new Date(d.date).getTime();
          return Math.abs(tTime - dTime) <= 3 * 24 * 60 * 60 * 1000;
        });
      }

      if (matchingDraw) {
        const matchRes = checkTicketMatch(tkt, matchingDraw);
        updatedCount++;
        return {
          ...tkt,
          status: "matched" as const,
          drawNumber: matchingDraw.drawNumber,
          matchCount: matchRes.matchCount,
          luckyMatched: matchRes.luckyMatched,
          matchedNumbers: matchRes.matchedNumbers,
          prizeTier: matchRes.prizeTier
        };
      }
      return tkt;
    });

    setTickets(reAuditedTickets);
    try {
      localStorage.setItem("cache_lotto_tickets", JSON.stringify(reAuditedTickets));
      await setDoc(doc(db, "home_finance", "lotto_hub"), {
        tickets: JSON.parse(JSON.stringify(reAuditedTickets))
      }, { merge: true });
      toast.success(`تم تدقيق وفحص ${reAuditedTickets.length} بطاقة بنجاح مع السحوبات الرسمية! 🏆`);
    } catch (e) {
      console.error("Audit tickets save error:", e);
      toast.error("حدث خطأ أثناء حفظ تدقيق البطاقات");
    } finally {
      setLoading(false);
    }
  };

  // Open ticket modal with prefilled data and exact official price
  const handleOpenAddTicket = (prefillNumbers?: number[], prefillLucky?: number) => {
    const validNumbers = (prefillNumbers || []).filter(n => n <= GAME_DETAILS[selectedGame].maxNumber);
    setNewTicketNumbers(validNumbers);
    setNewTicketLucky(selectedGame === "super_key" ? prefillLucky : undefined);
    setNewTicketDate(nextDrawDate);
    setNewTicketCost(GAME_DETAILS[selectedGame].ticketPrice);
    setNewTicketDrawNum("");
    setShowAddTicketModal(true);
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
      toast.error(`يرجى اختيار 6 أرقام كاملة للبطاقة (تم اختيار ${newTicketNumbers.length} من 6)`);
      return;
    }
    if (selectedGame === "super_key" && newTicketLucky === undefined) {
      toast.error("يرجى اختيار رقم الحظ الإضافي لسوبر كي (من 1 إلى 42)");
      return;
    }

    const officialPrice = GAME_DETAILS[selectedGame].ticketPrice;
    const finalCost = Number(newTicketCost) > 0 ? Number(newTicketCost) : officialPrice;
    const targetDate = newTicketDate || nextDrawDate;

    const newTicket: LottoTicket = {
      id: "tkt-" + Date.now(),
      game: selectedGame,
      ticketName: `بطاقة ${GAME_DETAILS[selectedGame].shortTitle}`,
      numbers: [...newTicketNumbers].sort((a, b) => a - b),
      drawDate: targetDate,
      cost: finalCost,
      status: "pending",
      createdAt: new Date().toISOString()
    };

    if (selectedGame === "super_key" && newTicketLucky !== undefined) {
      newTicket.luckyNumber = newTicketLucky;
    }

    if (newTicketDrawNum && Number(newTicketDrawNum) > 0) {
      newTicket.drawNumber = Number(newTicketDrawNum);
    }

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
    try {
      localStorage.setItem("cache_lotto_tickets", JSON.stringify(updatedTickets));
    } catch (e) {}

    // Close modal & reset fields IMMEDIATELY so the interface is never stuck
    setShowAddTicketModal(false);
    setNewTicketNumbers([]);
    setNewTicketLucky(undefined);
    setNewTicketDate("");
    setNewTicketDrawNum("");

    // Save to Firestore with full undefined sanitization and timeout
    try {
      const sanitizedTickets = JSON.parse(JSON.stringify(updatedTickets));
      const syncPromise = setDoc(doc(db, "home_finance", "lotto_hub"), {
        tickets: sanitizedTickets
      }, { merge: true });

      await Promise.race([
        syncPromise,
        new Promise(resolve => setTimeout(resolve, 2500))
      ]);
      toast.success("تم حفظ وتوثيق البطاقة بنجاح! 🎫");
    } catch (err: any) {
      console.error("Error saving ticket to Firebase:", err);
      toast.success("تم حفظ البطاقة محلياً بنجاح 🎫");
    }

    // Add linked expense in finance if handler provided
    if (onAddExpenseLinked && finalCost > 0) {
      try {
        const luckyText = newTicket.luckyNumber !== undefined ? " + " + newTicket.luckyNumber : "";
        const desc = `شراء بطاقة ${GAME_DETAILS[selectedGame].shortTitle} (${newTicket.numbers.join("-")}${luckyText})`;
        onAddExpenseLinked(finalCost, desc, getTodayStr());
      } catch (e) {
        console.error("Failed to add linked expense:", e);
      }
    }

    // 🎭 Trigger Theatrical Celebration & Voice Announcement!
    setTheatricalTicket(newTicket);
    playTheatricalFanfare();
    const gameTitleArabic = selectedGame === "super_key" ? "لوتو العراق سوبر كي 42" : "لوتو العراق الخيري 29";
    const luckySpeech = newTicket.luckyNumber !== undefined ? `، ورقم الحظ الإضافي ${newTicket.luckyNumber}` : "";
    speakTheatricalAnnouncement(`تم تسجيل وتوثيق بطاقة ${gameTitleArabic} بنجاح. الأرقام المحجوزة هي: ${newTicket.numbers.join("، ")}${luckySpeech}. موعد السحب القادم هو ${newTicket.drawDate}. مع تمنياتنا لك بالفوز بالجائزة الكبرى!`);
  };

  // Delete ticket
  const handleDeleteTicket = async (ticketId: string) => {
    const updatedTickets = tickets.filter(t => t.id !== ticketId);
    setTickets(updatedTickets);
    try {
      localStorage.setItem("cache_lotto_tickets", JSON.stringify(updatedTickets));
    } catch (e) {}
    try {
      const sanitized = JSON.parse(JSON.stringify(updatedTickets));
      await setDoc(doc(db, "home_finance", "lotto_hub"), {
        tickets: sanitized
      }, { merge: true });
      toast.success("تم حذف البطاقة بنجاح");
    } catch (err) {
      console.error("Error deleting ticket:", err);
    }
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
      createdAt: new Date().toISOString()
    };
    if (selectedGame === "super_key" && drawLuckyInput !== undefined) {
      newDraw.luckyNumber = Number(drawLuckyInput);
    }

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

    setShowRecordDrawModal(false);
    setDrawNumbersInput([]);
    setDrawLuckyInput(undefined);

    try {
      const sanitizedPayload = JSON.parse(JSON.stringify({
        superKeyDraws: selectedGame === "super_key" ? updatedDraws : superKeyDraws,
        iraqLottoDraws: selectedGame === "iraq_lotto" ? updatedDraws : iraqLottoDraws,
        tickets: updatedTickets
      }));

      const syncPromise = setDoc(doc(db, "home_finance", "lotto_hub"), sanitizedPayload, { merge: true });
      await Promise.race([
        syncPromise,
        new Promise(resolve => setTimeout(resolve, 2500))
      ]);

      if (totalWins > 0) {
        toast.success(`🎉 مبروك! لديك ${totalWins} بطاقة رابحة في هذا السحب!`, { duration: 6000 });
      } else {
        toast.success("تم حفظ نتيجة السحب ومطابقة البطاقات بنجاح ✅");
      }
    } catch (err) {
      console.error("Error saving winning draw:", err);
      toast.success("تم حفظ نتيجة السحب ومطابقة البطاقات محلياً ✅");
    }
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
              <div className="relative rounded-3xl p-5 overflow-hidden bg-gradient-to-br from-indigo-950 via-purple-900 to-zinc-900 text-white shadow-xl border border-white/10">
                <div className="absolute top-0 right-0 w-64 h-64 bg-pink-500/20 blur-3xl rounded-full pointer-events-none" />
                <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full text-xs font-bold text-amber-300 border border-white/10">
                        <Clock className="w-3.5 h-3.5" />
                        <span>السحبة القادمة: {GAME_DETAILS[selectedGame].drawDaysArabic}</span>
                      </span>
                      {isLocked ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 px-2.5 py-0.5 rounded-full text-[11px] font-black animate-pulse">
                          <Lock className="w-3 h-3" />
                          <span>أرقام مثبتة ومحفوظة (ثابتة في كل رفرش)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-purple-500/20 border border-purple-400/30 text-purple-200 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                          <Sparkles className="w-3 h-3" />
                          <span>تنبؤ ذكي إحصائي</span>
                        </span>
                      )}
                    </div>

                    <h2 className="text-xl sm:text-2xl font-black">
                      {isLocked ? "أرقامك المختارة والمثبتة" : "التنبؤ الإحصائي المقترح"} لسحبة {nextDrawDate}
                    </h2>
                    <p className="text-xs text-purple-200 mt-1 max-w-md">
                      تنبؤ علمي قائم على تردد الظهور والانحراف المعياري، مع موازنة الفردي والزوجي والدلتا، والحفاظ على اختيارك.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleToggleLock}
                      className={`px-3.5 py-2.5 rounded-2xl font-black text-xs flex items-center gap-1.5 transition shadow-md active:scale-95 ${
                        isLocked
                          ? "bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/20"
                          : "bg-white/15 text-white hover:bg-white/25 border border-white/20"
                      }`}
                      title={isLocked ? "فك قفل الأرقام لتوليد جديد" : "تثبيت هذه الأرقام حتى لا تتغير أبداً"}
                    >
                      {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                      <span>{isLocked ? "الأرقام مقفلة ومثبتة 🔒" : "تثبيت الأرقام الحالية 🔓"}</span>
                    </button>

                    <button
                      onClick={() => setShowCustomPicker(prev => !prev)}
                      className={`px-3.5 py-2.5 rounded-2xl font-black text-xs flex items-center gap-1.5 transition shadow-md active:scale-95 ${
                        showCustomPicker
                          ? "bg-amber-400 text-amber-950 font-black"
                          : "bg-white/10 text-white hover:bg-white/20 border border-white/10"
                      }`}
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>{showCustomPicker ? "إغلاق لوحة الاختيار" : "🎯 تخصيص أرقامي يدوياً"}</span>
                    </button>

                    <button
                      onClick={() => handleGeneratePrediction()}
                      disabled={isGenerating}
                      className="bg-gradient-to-r from-amber-400 to-rose-500 hover:from-amber-300 hover:to-rose-400 text-gray-950 font-black px-4 py-2.5 rounded-2xl shadow-lg shadow-amber-500/20 active:scale-95 transition flex items-center gap-2 text-xs sm:text-sm disabled:opacity-50"
                    >
                      <RotateCcw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                      <span>{isLocked && suggestedNumbers.length < 6 ? "إكمال الأرقام المتبقية" : "توليد تنبؤ جديد"}</span>
                    </button>
                  </div>
                </div>

                {/* Strategy Selector */}
                <div className="mt-5 pt-4 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    onClick={() => {
                      setPredictionStrategy("balanced");
                      handleGeneratePrediction("balanced");
                    }}
                    className={`p-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      predictionStrategy === "balanced"
                        ? "bg-white text-purple-950 shadow-md font-black"
                        : "bg-white/10 text-white/80 hover:bg-white/20"
                    }`}
                  >
                    <span>🎯</span> المتوازن الذهبي
                  </button>

                  <button
                    onClick={() => {
                      setPredictionStrategy("hot");
                      handleGeneratePrediction("hot");
                    }}
                    className={`p-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      predictionStrategy === "hot"
                        ? "bg-amber-400 text-amber-950 shadow-md font-black"
                        : "bg-white/10 text-white/80 hover:bg-white/20"
                    }`}
                  >
                    <span>🔥</span> زخم الأرقام الساخنة
                  </button>

                  <button
                    onClick={() => {
                      setPredictionStrategy("cold");
                      handleGeneratePrediction("cold");
                    }}
                    className={`p-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      predictionStrategy === "cold"
                        ? "bg-cyan-400 text-cyan-950 shadow-md font-black"
                        : "bg-white/10 text-white/80 hover:bg-white/20"
                    }`}
                  >
                    <span>❄️</span> ارتداد المتأخرة
                  </button>

                  <button
                    onClick={() => {
                      setPredictionStrategy("ai_hybrid");
                      handleGeneratePrediction("ai_hybrid");
                    }}
                    className={`p-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      predictionStrategy === "ai_hybrid"
                        ? "bg-pink-400 text-pink-950 shadow-md font-black"
                        : "bg-white/10 text-white/80 hover:bg-white/20"
                    }`}
                  >
                    <span>🧠</span> الذكاء التوليدي الهجين
                  </button>
                </div>
              </div>

              {/* Interactive Number Matrix / Custom Picker ("الرقم اله اختار") */}
              {showCustomPicker && (
                <div className="p-5 bg-purple-500/5 dark:bg-white/[0.02] rounded-3xl border border-purple-200 dark:border-purple-500/20 shadow-sm animate-in fade-in duration-200">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                      <h4 className="font-black text-sm text-gray-900 dark:text-white flex items-center gap-2">
                        <span>🎯 اختر أرقامك الـ 6 بنفسك وثبّتها</span>
                        <span className="text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full font-black">
                          {suggestedNumbers.length} من 6 مختارة
                        </span>
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        انقر على أي رقم لإضافته أو حذفه. الأرقام التي تختارها تُحفظ تلقائياً وتثبت ولا تتغير عند الرفرش!
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSuggestedNumbers([]);
                          setIsLocked(false);
                        }}
                        className="text-xs text-rose-500 font-bold hover:underline px-2 py-1"
                      >
                        تفريغ الاختيار
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCustomPicker(false)}
                        className="px-3 py-1.5 bg-purple-600 text-white rounded-xl text-xs font-black shadow-sm hover:bg-purple-700 transition"
                      >
                        تم الاختيار ✓
                      </button>
                    </div>
                  </div>

                  {/* Main 6 Numbers Grid */}
                  <div className="grid grid-cols-7 sm:grid-cols-11 md:grid-cols-14 gap-1.5 sm:gap-2">
                    {Array.from({ length: GAME_DETAILS[selectedGame].maxNumber }, (_, i) => i + 1).map((num) => {
                      const isSelected = suggestedNumbers.includes(num);
                      const isHot = stats.hotNumbers.slice(0, 6).includes(num);
                      const isCold = stats.coldNumbers.slice(0, 6).includes(num);
                      return (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleToggleCustomNumber(num)}
                          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center transition-all relative ${
                            isSelected
                              ? "bg-gradient-to-tr from-purple-600 to-rose-600 text-white shadow-md shadow-purple-500/30 scale-105 ring-2 ring-purple-400"
                              : isHot
                              ? "bg-amber-100/80 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/50 hover:bg-amber-200"
                              : isCold
                              ? "bg-cyan-100/80 dark:bg-cyan-950/30 text-cyan-900 dark:text-cyan-200 border border-cyan-300 dark:border-cyan-700/50 hover:bg-cyan-200"
                              : "bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-700"
                          }`}
                        >
                          <span>{num}</span>
                          {isHot && !isSelected && (
                            <span className="absolute -top-1 -right-1 text-[8px]">🔥</span>
                          )}
                          {isCold && !isSelected && (
                            <span className="absolute -top-1 -right-1 text-[8px]">❄️</span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Lucky Number Matrix for Super Key */}
                  {selectedGame === "super_key" && (
                    <div className="mt-5 pt-4 border-t border-purple-100 dark:border-white/10">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                          <span>⭐ اختر رقم الحظ الإضافي (سوبر كي من 1 إلى 42):</span>
                          {suggestedLucky !== undefined && (
                            <span className="font-black text-amber-500 bg-amber-100 dark:bg-amber-950 px-2 py-0.5 rounded-full">
                              المختار: {suggestedLucky}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="grid grid-cols-7 sm:grid-cols-11 md:grid-cols-14 gap-1.5">
                        {Array.from({ length: 42 }, (_, i) => i + 1).map((luckyNum) => {
                          const isSelectedLucky = suggestedLucky === luckyNum;
                          return (
                            <button
                              key={`lucky-${luckyNum}`}
                              type="button"
                              onClick={() => handleSelectCustomLucky(luckyNum)}
                              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl font-black text-xs flex items-center justify-center transition ${
                                isSelectedLucky
                                  ? "bg-gradient-to-tr from-amber-500 to-yellow-400 text-amber-950 shadow-md ring-2 ring-amber-300 font-black scale-105"
                                  : "bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/40 hover:bg-amber-100"
                              }`}
                            >
                              {luckyNum}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 3D Visual Lottery Balls Showcase */}
              <div className="bg-gradient-to-b from-gray-50 to-white dark:from-zinc-900/60 dark:to-zinc-950 p-6 rounded-3xl border border-gray-100 dark:border-white/10 shadow-inner flex flex-col items-center justify-center">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                    الأرقام المعتمدة للشبكة (6 كرات {selectedGame === "super_key" ? "+ رقم الحظ" : ""})
                  </span>
                  {isLocked && (
                    <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-black border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" />
                      <span>مثبتة</span>
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 my-2">
                  {suggestedNumbers.map((num, idx) => (
                    <div
                      key={idx}
                      onClick={() => setShowCustomPicker(true)}
                      className="relative group transition-all duration-300 transform hover:-translate-y-2 cursor-pointer"
                      title="انقر لتعديل هذا الرقم"
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
                      <div
                        onClick={() => setShowCustomPicker(true)}
                        className="relative group transition-all duration-300 transform hover:-translate-y-2 cursor-pointer"
                        title="انقر لتعديل رقم الحظ"
                      >
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
                    onClick={handleToggleLock}
                    className={`px-4 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 transition border ${
                      isLocked
                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300"
                        : "bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-800 dark:text-white border-transparent"
                    }`}
                  >
                    {isLocked ? <Lock className="w-4 h-4 text-emerald-500" /> : <Unlock className="w-4 h-4 text-gray-400" />}
                    <span>{isLocked ? "الأرقام مثبتة (اضغط للفك)" : "تثبيت الأرقام الحالية"}</span>
                  </button>

                  <button
                    onClick={handleCopyNumbers}
                    className="px-4 py-2.5 rounded-2xl bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-800 dark:text-white font-bold text-xs flex items-center gap-2 transition"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? "تم النسخ!" : "نسخ الأرقام"}</span>
                  </button>

                  <button
                    onClick={() => handleOpenAddTicket(suggestedNumbers, suggestedLucky)}
                    className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-purple-500/20 transition active:scale-95"
                  >
                    <Ticket className="w-4 h-4" />
                    <span>تسجيل هذه الأرقام كبطاقة مشتراة ({GAME_DETAILS[selectedGame].ticketPrice.toLocaleString("en-US")} د.ع) 🎫</span>
                  </button>
                </div>
              </div>

              {/* Scientific & Statistical Confidence Breakdown Card */}
              {predictionAnalysis && (
                <div className="p-5 rounded-3xl bg-gradient-to-br from-indigo-950/30 via-purple-950/20 to-zinc-900/40 border border-purple-500/30 dark:border-purple-500/20 shadow-md space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-black">
                        🧠
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-gray-900 dark:text-white flex items-center gap-2">
                          <span>التدقيق والتحليل الإحصائي للتوليفة</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-black">
                            قوة التنبؤ: {predictionAnalysis.confidenceScore}% 🌟
                          </span>
                        </h4>
                        <p className="text-xs text-gray-400">
                          النموذج المعتمد: {predictionAnalysis.strategyLabel}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black px-2.5 py-1 rounded-xl bg-purple-500/20 text-purple-300">
                        {predictionAnalysis.deltaScore}
                      </span>
                    </div>
                  </div>

                  {/* Metric Chips */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                    <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
                      <span className="text-[10px] text-gray-400 block font-bold">مجموع الأرقام الإحصائي</span>
                      <div className="text-sm font-black text-amber-400 mt-0.5 flex items-center gap-1.5">
                        <span>{predictionAnalysis.sum}</span>
                        <span className="text-[10px] text-gray-400">({predictionAnalysis.sumQuality})</span>
                      </div>
                      <span className="text-[9px] text-gray-500 block mt-0.5">النطاق المثالي: {predictionAnalysis.expectedSumRange[0]}-{predictionAnalysis.expectedSumRange[1]}</span>
                    </div>

                    <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
                      <span className="text-[10px] text-gray-400 block font-bold">التوازن الزوجي / الفردي</span>
                      <div className="text-sm font-black text-cyan-400 mt-0.5">
                        {predictionAnalysis.parityBalance}
                      </div>
                      <span className="text-[9px] text-gray-500 block mt-0.5">أفضل توزيع احتمالي</span>
                    </div>

                    <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
                      <span className="text-[10px] text-gray-400 block font-bold">التوزيع المنخفض / المرتفع</span>
                      <div className="text-sm font-black text-rose-400 mt-0.5">
                        {predictionAnalysis.highLowBalance}
                      </div>
                      <span className="text-[9px] text-gray-500 block mt-0.5">مقسم عند منتصف الشبكة</span>
                    </div>

                    <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
                      <span className="text-[10px] text-gray-400 block font-bold">توليفة الساخن والمتأخر</span>
                      <div className="text-sm font-black text-emerald-400 mt-0.5">
                        {predictionAnalysis.hotCount} ساخنة + {predictionAnalysis.dueCount} متأخرة
                      </div>
                      <span className="text-[9px] text-gray-500 block mt-0.5">+ {predictionAnalysis.mediumCount} متوسطة مستقرة</span>
                    </div>
                  </div>
                </div>
              )}

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

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleAuditAllTickets}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition active:scale-95 flex items-center gap-1.5"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>تدقيق ومطابقة كافة البطاقات</span>
                    </button>

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
                      onClick={() => handleOpenAddTicket()}
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
                  <button
                    onClick={handleAuditAllTickets}
                    className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 px-3 py-1.5 rounded-xl border border-emerald-500/20 transition flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>فحص وتدقيق كل البطاقات الآن</span>
                  </button>
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
                      onClick={() => handleOpenAddTicket()}
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
                          (tkt.matchCount || 0) >= 3 || ((tkt.matchCount || 0) >= 1 && tkt.luckyMatched)
                            ? "bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-transparent border-amber-500/50 shadow-md ring-1 ring-amber-500/30"
                            : (tkt.matchCount || 0) > 0
                            ? "bg-white dark:bg-zinc-900 border-blue-300/80 dark:border-blue-900/60 shadow-sm"
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
                                (tkt.matchCount || 0) >= 3 || ((tkt.matchCount || 0) >= 1 && tkt.luckyMatched)
                                  ? "bg-gradient-to-r from-emerald-100 to-amber-100 dark:from-emerald-950 dark:to-amber-950 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 shadow-sm"
                                  : (tkt.matchCount || 0) > 0 || tkt.luckyMatched
                                  ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300"
                                  : "bg-gray-100 dark:bg-zinc-800 text-gray-500"
                              }`}>
                                {tkt.prizeTier}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteTicket(tkt.id)}
                              className="p-1 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                              title="حذف البطاقة"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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

              {/* AI Camera Scan Action */}
              <div className="mb-3">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={ticketFileInputRef}
                  onChange={e => handleScanFile(e, "ticket")}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isScanning}
                  onClick={() => ticketFileInputRef.current?.click()}
                  className="w-full py-2.5 px-3 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 hover:opacity-95 active:scale-98 transition disabled:opacity-50"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{scanStatus || "جاري مسح البطاقة..."}</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" />
                      <span>تصوير البطاقة المشتراة بالذكاء الاصطناعي 📸</span>
                    </>
                  )}
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
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-gray-500 block">سعر البطاقة (د.ع)</label>
                      <button
                        type="button"
                        onClick={() => setNewTicketCost(GAME_DETAILS[selectedGame].ticketPrice)}
                        className="text-[10px] font-black text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 px-1.5 py-0.5 rounded transition"
                        title="انقر لتطبيق السعر الرسمي"
                      >
                        الرسمي: {GAME_DETAILS[selectedGame].ticketPrice.toLocaleString()} د.ع
                      </button>
                    </div>
                    <input
                      type="number"
                      value={newTicketCost}
                      onChange={e => setNewTicketCost(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-bold"
                      placeholder={GAME_DETAILS[selectedGame].ticketPrice.toString()}
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

              {/* AI Camera Scan Action for Winning Numbers */}
              <div className="mb-3">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={drawFileInputRef}
                  onChange={e => handleScanFile(e, "draw")}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isScanning}
                  onClick={() => drawFileInputRef.current?.click()}
                  className="w-full py-2.5 px-3 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 hover:opacity-95 active:scale-98 transition disabled:opacity-50"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{scanStatus || "جاري مسح شاشة السحب..."}</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" />
                      <span>تصوير شاشة السحب / الأرقام الفائزة بالذكاء الاصطناعي 📸</span>
                    </>
                  )}
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

        {/* ══════════════════════════════════════════
            MODAL 3: THEATRICAL TICKET CELEBRATION (إشعار مسرحي رسمي)
        ══════════════════════════════════════════ */}
        {theatricalTicket && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
            {/* Spotlight and ambient celebratory glows */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-gradient-to-tr from-amber-500/20 via-purple-600/30 to-rose-500/20 rounded-full blur-3xl animate-pulse" />
              {/* Confetti & stars simulation */}
              <div className="absolute top-10 left-10 text-3xl animate-bounce">✨</div>
              <div className="absolute top-16 right-12 text-4xl animate-bounce delay-150">👑</div>
              <div className="absolute bottom-16 left-14 text-3xl animate-bounce delay-300">🌟</div>
              <div className="absolute bottom-12 right-16 text-4xl animate-bounce delay-75">🎉</div>
            </div>

            <div className="relative bg-gradient-to-b from-[#1F1733] via-[#161226] to-[#0E0B18] text-white rounded-3xl p-6 sm:p-7 max-w-lg w-full border-2 border-amber-400/40 shadow-[0_0_60px_rgba(245,158,11,0.3)] text-center max-h-[92vh] overflow-y-auto">
              {/* Close corner button */}
              <button
                onClick={() => setTheatricalTicket(null)}
                className="absolute top-4 left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Theater Ribbon & Trophy */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 text-white font-black text-xs shadow-lg shadow-amber-500/30 mb-3 animate-pulse">
                <span>🎭</span>
                <span>إشعار مسرحي رسمي: تم حجز وتوثيق البطاقة!</span>
                <span>🎟️</span>
              </div>

              <h3 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-100 mb-1">
                مبارك! تم تسجيل بطاقتك بنجاح
              </h3>
              <p className="text-xs text-amber-200/80 font-bold mb-5">
                تم قيد مبلغ الشراء تلقائياً في سجل المصاريف وربط البطاقة بالسحب القادم
              </p>

              {/* Authentic Iraqi Luxury Ticket Slip */}
              <div className="relative p-5 rounded-2xl bg-[#28203E]/90 border border-amber-400/30 shadow-inner text-right space-y-4 overflow-hidden mb-5">
                {/* Perforation circles */}
                <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#161226]" />
                <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#161226]" />

                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">👑</span>
                    <div>
                      <span className="font-black text-sm text-white block">
                        {GAME_DETAILS[theatricalTicket.game].title}
                      </span>
                      <span className="text-[11px] font-bold text-amber-400 block">
                        {GAME_DETAILS[theatricalTicket.game].drawDaysArabic}
                      </span>
                    </div>
                  </div>
                  <div className="text-left">
                    <span className="text-[10px] text-gray-400 font-mono block">#{theatricalTicket.id.slice(-8)}</span>
                    <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-black text-[10px] border border-emerald-500/30">
                      معتمدة ومسجلة ✓
                    </span>
                  </div>
                </div>

                {/* 6 Lucky Spheres */}
                <div>
                  <div className="text-[11px] font-black text-gray-300 mb-2 flex items-center justify-between">
                    <span>الأرقام المحجوزة للبطاقة:</span>
                    <span className="text-[10px] text-amber-400">6 أرقام {theatricalTicket.luckyNumber !== undefined ? "+ رقم الحظ" : ""}</span>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2 py-2">
                    {theatricalTicket.numbers.map((num) => (
                      <div
                        key={num}
                        className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 text-stone-950 font-black text-sm sm:text-base flex items-center justify-center shadow-[0_4px_12px_rgba(245,158,11,0.4)] border border-amber-200"
                      >
                        {num}
                      </div>
                    ))}

                    {theatricalTicket.luckyNumber !== undefined && (
                      <>
                        <span className="text-amber-400 text-lg font-black px-1">+</span>
                        <div
                          className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-b from-rose-400 via-rose-600 to-purple-800 text-white font-black text-sm sm:text-base flex items-center justify-center shadow-[0_4px_12px_rgba(225,29,72,0.4)] border-2 border-white ring-2 ring-rose-400"
                          title="رقم الحظ الإضافي"
                        >
                          {theatricalTicket.luckyNumber}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Draw Date & Price Badges */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-center">
                    <span className="text-[10px] text-gray-400 font-bold block mb-0.5">موعد السحب</span>
                    <span className="text-xs font-black text-amber-300 block">{theatricalTicket.drawDate}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-center">
                    <span className="text-[10px] text-gray-400 font-bold block mb-0.5">المبلغ المقيد بالمصاريف</span>
                    <span className="text-xs font-black text-emerald-400 block">{theatricalTicket.cost.toLocaleString()} د.ع</span>
                  </div>
                </div>
              </div>

              {/* Interactive buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    const text = theatricalTicket.luckyNumber !== undefined
                      ? `بطاقة ${GAME_DETAILS[theatricalTicket.game].title} - الأرقام: ${theatricalTicket.numbers.join(" - ")} | رقم الحظ: ${theatricalTicket.luckyNumber} | موعد السحب: ${theatricalTicket.drawDate} | السعر: ${theatricalTicket.cost.toLocaleString()} د.ع`
                      : `بطاقة ${GAME_DETAILS[theatricalTicket.game].title} - الأرقام: ${theatricalTicket.numbers.join(" - ")} | موعد السحب: ${theatricalTicket.drawDate} | السعر: ${theatricalTicket.cost.toLocaleString()} د.ع`;
                    navigator.clipboard.writeText(text);
                    setTheatricalCopied(true);
                    toast.success("تم نسخ تفاصيل البطاقة بنجاح!");
                    setTimeout(() => setTheatricalCopied(false), 2000);
                  }}
                  className="w-full sm:flex-1 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-95 border border-white/15"
                >
                  {theatricalCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-amber-300" />}
                  <span>{theatricalCopied ? "تم النسخ!" : "نسخ بيانات البطاقة 📋"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playTheatricalFanfare();
                    const luckyStr = theatricalTicket.luckyNumber !== undefined ? `مع رقم الحظ ${theatricalTicket.luckyNumber}` : "";
                    speakTheatricalAnnouncement(`تم تسجيل بطاقة ${GAME_DETAILS[theatricalTicket.game].title} بنجاح. الأرقام: ${theatricalTicket.numbers.join("، ")} ${luckyStr}. موعد السحب: ${theatricalTicket.drawDate}. فالكم الفوز بالجائزة الكبرى!`);
                  }}
                  className="w-full sm:w-auto px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 transition border border-white/15"
                  title="إعادة سماع الإشعار الصوتي"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>إعادة النداء 🔊</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTheatricalTicket(null)}
                  className="w-full sm:flex-1 py-3 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-stone-950 font-black text-xs shadow-lg shadow-amber-500/25 hover:from-amber-300 hover:to-yellow-400 transition active:scale-95"
                >
                  تم، فالنا الفوز إن شاء الله! ✨
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
