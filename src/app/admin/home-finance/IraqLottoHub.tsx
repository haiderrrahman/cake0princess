"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Sparkles, Trophy, Calendar, Ticket, Plus, CheckCircle2, AlertCircle,
  Copy, Check, BarChart2, Flame, Snowflake, RotateCcw, Clock, ExternalLink,
  Search, Trash2, Camera, Loader2, Lock, Unlock, Sliders, RefreshCw,
  BrainCircuit, ShieldCheck, Zap, Layers, Award
} from "lucide-react";
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import {
  IraqLotoGameId,
  LotoDrawOfficial,
  LotoCurrentState,
  SportsRound,
  SportsPickChoice,
  ScratchCardLive,
  RecentWinnerItem,
  UserLotoTicket,
  SCRATCH_SPECS,
  LOTO_42_PRIZE_TIERS,
  LOTO_29_PRIZE_TIERS,
  BASELINE_SNAPSHOT,
  BASELINE_LOTO42_DRAWS,
  BASELINE_LOTO29_DRAWS,
  mergeDrawsDeduplicated,
  fetchLiveLotoIqSnapshot,
  resolveLogoUrl,
  evaluateUserTicket,
} from "@/lib/lotoIqService";
import {
  generateSmartLotoPortfolio,
  generateGeminiDeepLotoPrediction,
  predictSportsRoundQuant,
  generateGeminiSportsRoundPrediction,
  analyzeScratchCard,
  TicketPredictionResult,
  SportsRoundAnalysis,
} from "@/lib/lotoPredictionEngine";
import { scanIraqLotoImage } from "@/lib/scanLottoClient";

interface IraqLottoHubProps {
  onAddExpenseLinked?: (amount: number, description: string, date: string) => void;
}

const fmt = (n: number) => Math.round(n || 0).toLocaleString("en-US");

function formatCountdown(targetMs?: number | null, nowMs = Date.now()): string {
  if (!targetMs || targetMs <= nowMs) return "جاري السحب / بانتظار التحديث";
  const diffSec = Math.floor((targetMs - nowMs) / 1000);
  const days = Math.floor(diffSec / 86400);
  const hours = Math.floor((diffSec % 86400) / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;
  if (days > 0) return `${days} يوم و ${hours} س و ${mins} د`;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function getTodayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function IraqLottoHub({ onAddExpenseLinked }: IraqLottoHubProps) {
  // Active Game among the 5 official loto.iq games
  const [activeGame, setActiveGame] = useState<IraqLotoGameId>("loto42");
  const [numberSubView, setNumberSubView] = useState<
    "predict" | "tickets" | "history" | "stats"
  >("predict");
  const [sportsSubView, setSportsSubView] = useState<
    "active" | "finished" | "tickets"
  >("active");

  // Live loto.iq State
  const [loto42Current, setLoto42Current] = useState<LotoCurrentState | null>(
    BASELINE_SNAPSHOT.loto42Current
  );
  const [loto42Draws, setLoto42Draws] = useState<LotoDrawOfficial[]>(
    BASELINE_LOTO42_DRAWS
  );
  const [loto29Current, setLoto29Current] = useState<LotoCurrentState | null>(
    BASELINE_SNAPSHOT.loto29Current
  );
  const [loto29Draws, setLoto29Draws] = useState<LotoDrawOfficial[]>(
    BASELINE_LOTO29_DRAWS
  );
  const [sportsRounds, setSportsRounds] = useState<SportsRound[]>([]);
  const [scratchCards, setScratchCards] = useState<ScratchCardLive[]>(
    BASELINE_SNAPSHOT.scratchCards
  );
  const [recentWinners, setRecentWinners] = useState<RecentWinnerItem[]>([]);

  const [lastSyncedAt, setLastSyncedAt] = useState<number>(0);
  const [syncSource, setSyncSource] = useState<string>("جاري التحديث...");
  const [isSyncingLive, setIsSyncingLive] = useState<boolean>(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // User Saved Tickets & Locked Numbers (Synced with Firestore `home_finance/iraq_lotto_hub`)
  const [tickets, setTickets] = useState<UserLotoTicket[]>([]);
  const [lockedByGame, setLockedByGame] = useState<{
    loto42: { numbers: number[]; extra: number | null; locked: boolean };
    loto29: { numbers: number[]; extra: null; locked: boolean };
  }>({
    loto42: { numbers: [], extra: null, locked: false },
    loto29: { numbers: [], extra: null, locked: false },
  });

  // Portfolio Salt & Gemini Deep AI Results
  const [seedSalt, setSeedSalt] = useState<number>(0);
  const [aiLotoOverride, setAiLotoOverride] = useState<
    Record<string, { ticket: TicketPredictionResult; expertSummaryAr: string }>
  >({});
  const [isRunningGeminiLoto, setIsRunningGeminiLoto] = useState<boolean>(false);

  // Custom Picker & Add Ticket State
  const [showCustomPicker, setShowCustomPicker] = useState<boolean>(false);
  const [recordExpenseOnSave, setRecordExpenseOnSave] = useState<boolean>(true);
  const [archiveQuery, setArchiveQuery] = useState<string>("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Sports Loto State
  const [selectedRoundId, setSelectedRoundId] = useState<string>("");
  const [userSportsSlip, setUserSportsSlip] = useState<
    Record<string, Record<number, SportsPickChoice>>
  >({});
  const [aiSportsOverrides, setAiSportsOverrides] = useState<
    Record<string, SportsRoundAnalysis>
  >({});
  const [isRunningGeminiSports, setIsRunningGeminiSports] = useState<boolean>(false);

  // Scratch Manual / Scanner State
  const [isScanningImage, setIsScanningImage] = useState<boolean>(false);
  const [scanStatusMsg, setScanStatusMsg] = useState<string>("");
  const [lastScannedReport, setLastScannedReport] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const migratedLegacyRef = useRef<boolean>(false);

  // 1-second live countdown ticker
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Persist helper to Firestore `home_finance/iraq_lotto_hub`
  const persistHub = useCallback(async (patch: Record<string, any>) => {
    try {
      const clean = JSON.parse(JSON.stringify(patch));
      await setDoc(doc(db, "home_finance", "iraq_lotto_hub"), clean, { merge: true });
    } catch (err) {
      console.warn("iraq_lotto_hub sync warning:", err);
    }
  }, []);

  // Firestore Real-time Listener + Legacy Ticket Migration (`home_finance/lotto_hub`)
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "home_finance", "iraq_lotto_hub"),
      async (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.loto42Current) setLoto42Current(data.loto42Current);
          if (Array.isArray(data.loto42Draws) && data.loto42Draws.length > 0) {
            setLoto42Draws((prev) =>
              mergeDrawsDeduplicated(data.loto42Draws, prev, BASELINE_LOTO42_DRAWS)
            );
          }
          if (data.loto29Current) setLoto29Current(data.loto29Current);
          if (Array.isArray(data.loto29Draws) && data.loto29Draws.length > 0) {
            setLoto29Draws((prev) =>
              mergeDrawsDeduplicated(data.loto29Draws, prev, BASELINE_LOTO29_DRAWS)
            );
          }
          if (Array.isArray(data.sportsRounds) && data.sportsRounds.length > 0) {
            setSportsRounds(data.sportsRounds);
          }
          if (Array.isArray(data.scratchCards) && data.scratchCards.length > 0) {
            setScratchCards(data.scratchCards);
          }
          if (Array.isArray(data.recentWinners)) {
            setRecentWinners(data.recentWinners);
          }
          if (data.lastSyncedAt) setLastSyncedAt(Number(data.lastSyncedAt));
          if (Array.isArray(data.tickets)) setTickets(data.tickets);
          if (data.lockedByGame) setLockedByGame(data.lockedByGame);
        } else if (!migratedLegacyRef.current) {
          // Migrate user's existing tickets from legacy `lotto_hub` once so nothing is lost!
          migratedLegacyRef.current = true;
          try {
            const legacySnap = await getDoc(doc(db, "home_finance", "lotto_hub"));
            if (legacySnap.exists()) {
              const legacyData = legacySnap.data();
              if (Array.isArray(legacyData.tickets) && legacyData.tickets.length > 0) {
                const migrated: UserLotoTicket[] = legacyData.tickets.map((old: any) => ({
                  id: old.id || `mig-${Date.now()}-${Math.random()}`,
                  game: old.game === "super_key" ? "loto42" : "loto29",
                  title:
                    old.game === "super_key"
                      ? "بطاقة لوتو 42 (محفوظة سابقاً)"
                      : "بطاقة لوتو 29 (محفوظة سابقاً)",
                  createdAt: old.createdAt || new Date().toISOString(),
                  cost: Number(old.cost) || (old.game === "super_key" ? 2000 : 1500),
                  status: old.status === "matched" ? "lost" : "pending",
                  drawNumber: old.drawNumber ? Number(old.drawNumber) : undefined,
                  drawDate: old.drawDate,
                  numbers: Array.isArray(old.numbers) ? old.numbers : [],
                  extraNumber: old.luckyNumber ? Number(old.luckyNumber) : undefined,
                }));
                setTickets(migrated);
                await persistHub({ tickets: migrated });
              }
            }
          } catch {
            // Ignore legacy migration error
          }
        }
      },
      (err) => console.warn("iraq_lotto_hub snapshot error:", err)
    );
    return () => unsub();
  }, [persistHub]);

  // Live Fetch from https://loto.iq/ (on mount + every 90s + manual button)
  const triggerLiveSync = useCallback(
    async (silent = false) => {
      setIsSyncingLive(true);
      try {
        const live = await fetchLiveLotoIqSnapshot();
        if (!live) {
          if (!silent) {
            toast.error("تعذر التحديث اللحظي من loto.iq حالياً — يتم عرض آخر نسخة متزامنة.");
          }
          setSyncSource("نسخة سحابية محفوظة");
          return;
        }

        const merged42 = mergeDrawsDeduplicated(
          live.loto42Draws,
          loto42Draws,
          BASELINE_LOTO42_DRAWS
        );
        const merged29 = mergeDrawsDeduplicated(
          live.loto29Draws,
          loto29Draws,
          BASELINE_LOTO29_DRAWS
        );

        if (live.loto42Current) setLoto42Current(live.loto42Current);
        setLoto42Draws(merged42);

        if (live.loto29Current) setLoto29Current(live.loto29Current);
        setLoto29Draws(merged29);

        if (live.sportsRounds.length > 0) setSportsRounds(live.sportsRounds);
        if (live.scratchCards.length > 0) setScratchCards(live.scratchCards);
        if (live.recentWinners.length > 0) setRecentWinners(live.recentWinners);

        setLastSyncedAt(live.fetchedAt);
        setSyncSource("متصل مباشرة بـ loto.iq");

        // Re-evaluate saved tickets against newly arrived draws/rounds!
        setTickets((prevTickets) => {
          if (prevTickets.length === 0) return prevTickets;
          const evaluated = prevTickets.map((t) =>
            evaluateUserTicket(
              t,
              merged42,
              merged29,
              live.sportsRounds.length > 0 ? live.sportsRounds : sportsRounds
            )
          );
          return evaluated;
        });

        // Cache latest official draws (top 60) & rounds in Firestore for instant 0ms mobile load
        await persistHub({
          lastSyncedAt: live.fetchedAt,
          loto42Current: live.loto42Current,
          loto42Draws: merged42.slice(0, 60),
          loto29Current: live.loto29Current,
          loto29Draws: merged29.slice(0, 80),
          sportsRounds: live.sportsRounds,
          scratchCards: live.scratchCards,
          recentWinners: live.recentWinners.slice(0, 12),
        });

        if (!silent) {
          toast.success("تم تحديث جميع الألعاب الخمس والنتائج مباشرة من موقع لوتو العراق! ✅");
        }
      } finally {
        setIsSyncingLive(false);
      }
    },
    [loto42Draws, loto29Draws, sportsRounds, persistHub]
  );

  useEffect(() => {
    triggerLiveSync(true);
    const interval = setInterval(() => {
      triggerLiveSync(true);
    }, 90_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Select first open sports round automatically
  const openSportsRounds = useMemo(
    () => sportsRounds.filter((r) => r.status === "open"),
    [sportsRounds]
  );
  const finishedSportsRounds = useMemo(
    () => sportsRounds.filter((r) => r.status !== "open"),
    [sportsRounds]
  );

  useEffect(() => {
    const pool = sportsSubView === "finished" ? finishedSportsRounds : openSportsRounds;
    if (pool.length > 0 && !pool.some((r) => r.id === selectedRoundId)) {
      setSelectedRoundId(pool[0].id);
    } else if (pool.length === 0 && sportsRounds.length > 0 && !selectedRoundId) {
      setSelectedRoundId(sportsRounds[0].id);
    }
  }, [openSportsRounds, finishedSportsRounds, sportsRounds, sportsSubView, selectedRoundId]);

  const currentSportsRound = useMemo(
    () => sportsRounds.find((r) => r.id === selectedRoundId) || openSportsRounds[0] || sportsRounds[0] || null,
    [sportsRounds, openSportsRounds, selectedRoundId]
  );

  // Quantitative Predictions for Loto 42 & Loto 29
  const loto42Portfolio = useMemo(
    () =>
      generateSmartLotoPortfolio(
        loto42Draws,
        42,
        true,
        lockedByGame.loto42.numbers,
        lockedByGame.loto42.extra,
        seedSalt
      ),
    [loto42Draws, lockedByGame.loto42, seedSalt]
  );

  const loto29Portfolio = useMemo(
    () =>
      generateSmartLotoPortfolio(
        loto29Draws,
        29,
        false,
        lockedByGame.loto29.numbers,
        null,
        seedSalt
      ),
    [loto29Draws, lockedByGame.loto29, seedSalt]
  );

  // Quantitative Sports Round Analysis
  const currentSportsAnalysis = useMemo(() => {
    if (!currentSportsRound) return null;
    if (aiSportsOverrides[currentSportsRound.id]) {
      return aiSportsOverrides[currentSportsRound.id];
    }
    return predictSportsRoundQuant(currentSportsRound, sportsRounds);
  }, [currentSportsRound, sportsRounds, aiSportsOverrides]);

  // Initialize user's interactive 1/X/2 slip from AI/Quant recommended picks
  useEffect(() => {
    if (!currentSportsRound || !currentSportsAnalysis) return;
    setUserSportsSlip((prev) => {
      if (prev[currentSportsRound.id]) return prev;
      const initial: Record<number, SportsPickChoice> = {};
      currentSportsAnalysis.matches.forEach((m) => {
        initial[m.position] = m.recommendedPick;
      });
      return { ...prev, [currentSportsRound.id]: initial };
    });
  }, [currentSportsRound, currentSportsAnalysis]);

  // Scratch Card Actuarial Reports
  const sc500Report = useMemo(() => analyzeScratchCard("SC500", scratchCards), [scratchCards]);
  const sc1kReport = useMemo(() => analyzeScratchCard("SC1K", scratchCards), [scratchCards]);

  // Copy helper
  const copyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("تم نسخ التوليفة بنجاح 📋");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Run Deep Gemini AI Analysis for Loto 42 or Loto 29
  const handleRunGeminiLoto = async (gameKey: "loto42" | "loto29") => {
    setIsRunningGeminiLoto(true);
    try {
      const draws = gameKey === "loto42" ? loto42Draws : loto29Draws;
      const maxN = gameKey === "loto42" ? 42 : 29;
      const stats = gameKey === "loto42" ? loto42Portfolio.stats : loto29Portfolio.stats;
      const locked = lockedByGame[gameKey].numbers;
      const res = await generateGeminiDeepLotoPrediction(
        draws,
        maxN,
        gameKey === "loto42",
        stats,
        locked
      );
      if (res) {
        setAiLotoOverride((prev) => ({ ...prev, [gameKey]: res }));
        toast.success("اكتمل الاستنتاج العميق بالذكاء الخارق Gemini بنجاح! 🧠✨");
      } else {
        toast.error("تعذر الاتصال بـ Gemini حالياً — التوليفة الكمية الذهبية مفعّلة وجاهزة.");
      }
    } finally {
      setIsRunningGeminiLoto(false);
    }
  };

  // Run Deep Gemini AI Analysis for 10 Sports Matches
  const handleRunGeminiSports = async () => {
    if (!currentSportsRound || !currentSportsAnalysis) return;
    setIsRunningGeminiSports(true);
    try {
      const baseQuant = predictSportsRoundQuant(currentSportsRound, sportsRounds);
      const aiRes = await generateGeminiSportsRoundPrediction(
        currentSportsRound,
        baseQuant
      );
      if (aiRes) {
        setAiSportsOverrides((prev) => ({ ...prev, [currentSportsRound.id]: aiRes }));
        // Also update slip to AI picks
        const updatedSlip: Record<number, SportsPickChoice> = {};
        aiRes.matches.forEach((m) => {
          updatedSlip[m.position] = m.recommendedPick;
        });
        setUserSportsSlip((prev) => ({ ...prev, [currentSportsRound.id]: updatedSlip }));
        toast.success("تم تحليل المباريات الـ 10 تكتيكياً بالذكاء الاصطناعي وتحديث الاختيارات! ⚽🧠");
      } else {
        toast.error("تعذر استدعاء Gemini حالياً — تم اعتماد التحليل الكمي لقوة الأندية.");
      }
    } finally {
      setIsRunningGeminiSports(false);
    }
  };

  // Save a Number Ticket (Loto 42 / Loto 29)
  const handleSaveNumberTicket = async (
    gameKey: "loto42" | "loto29",
    nums: number[],
    extra: number | null
  ) => {
    if (nums.length !== 6) {
      toast.error("يجب أن تتكون البطاقة من 6 أرقام كاملة.");
      return;
    }
    const currentInfo = gameKey === "loto42" ? loto42Current?.selling : loto29Current?.selling;
    const price = currentInfo?.price || (gameKey === "loto42" ? 2000 : 1500);
    const nextDrawNum =
      currentInfo?.drawNumber ||
      ((gameKey === "loto42" ? loto42Draws[0]?.drawNumber : loto29Draws[0]?.drawNumber) || 0) + 1;
    const drawDate = currentInfo?.drawAt
      ? new Date(currentInfo.drawAt).toISOString().split("T")[0]
      : getTodayIso();

    const newTkt: UserLotoTicket = evaluateUserTicket(
      {
        id: `tkt-${Date.now()}`,
        game: gameKey,
        title: `${gameKey === "loto42" ? "بطاقة لوتو 42" : "بطاقة لوتو 29"} — سحب #${nextDrawNum}`,
        createdAt: new Date().toISOString(),
        cost: price,
        status: "pending",
        drawNumber: nextDrawNum,
        drawDate,
        numbers: [...nums].sort((a, b) => a - b),
        extraNumber: gameKey === "loto42" && extra ? extra : undefined,
      },
      loto42Draws,
      loto29Draws,
      sportsRounds
    );

    const updated = [newTkt, ...tickets];
    setTickets(updated);
    await persistHub({ tickets: updated });

    if (recordExpenseOnSave && onAddExpenseLinked) {
      const extraTxt = newTkt.extraNumber ? ` + إضافي ${newTkt.extraNumber}` : "";
      onAddExpenseLinked(
        price,
        `شراء ${newTkt.title} (${newTkt.numbers?.join("-")}${extraTxt})`,
        getTodayIso()
      );
    }
    toast.success(`تم حفظ ${newTkt.title} بنجاح! 🎫`);
  };

  // Save a Sports Loto 10-Match Slip
  const handleSaveSportsSlip = async () => {
    if (!currentSportsRound) return;
    const slip = userSportsSlip[currentSportsRound.id] || {};
    if (Object.keys(slip).length < currentSportsRound.matches.length) {
      toast.error("يرجى اختيار التوقع (1 أو X أو 2) لجميع المباريات الـ 10 أولاً.");
      return;
    }
    const price = currentSportsRound.price || 5000;
    const newTkt: UserLotoTicket = evaluateUserTicket(
      {
        id: `spt-${Date.now()}`,
        game: "sports",
        title: `قسيمة اللوتو الرياضي — ${currentSportsRound.nameAr}`,
        createdAt: new Date().toISOString(),
        cost: price,
        status: "pending",
        roundId: currentSportsRound.id,
        roundName: currentSportsRound.nameAr,
        sportsPicks: slip,
      },
      loto42Draws,
      loto29Draws,
      sportsRounds
    );

    const updated = [newTkt, ...tickets];
    setTickets(updated);
    await persistHub({ tickets: updated });

    if (recordExpenseOnSave && onAddExpenseLinked) {
      onAddExpenseLinked(
        price,
        `شراء قسيمة اللوتو الرياضي (${currentSportsRound.nameAr})`,
        getTodayIso()
      );
    }
    toast.success("تم حفظ قسيمة اللوتو الرياضي بنجاح! ⚽🎫");
  };

  // Delete Ticket
  const handleDeleteTicket = async (id: string) => {
    const updated = tickets.filter((t) => t.id !== id);
    setTickets(updated);
    await persistHub({ tickets: updated });
    toast.success("تم حذف البطاقة من السجل");
  };

  // Toggle Custom Locked Number
  const toggleLockedBall = async (gameKey: "loto42" | "loto29", num: number) => {
    const cur = lockedByGame[gameKey];
    let nextNums: number[];
    if (cur.numbers.includes(num)) {
      nextNums = cur.numbers.filter((x) => x !== num);
    } else {
      if (cur.numbers.length >= 6) {
        toast.warning("اخترت 6 أرقام بالفعل — انقر على رقم محدد لإلغائه أولاً.");
        return;
      }
      nextNums = [...cur.numbers, num].sort((a, b) => a - b);
    }
    const nextState = {
      ...lockedByGame,
      [gameKey]: { ...cur, numbers: nextNums, locked: nextNums.length > 0 },
    };
    setLockedByGame(nextState);
    await persistHub({ lockedByGame: nextState });
  };

  // Scan Image Handler (Tickets / Results / Scratch Cards across all 5 games!)
  const handleImageScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanningImage(true);
    setScanStatusMsg("جاري قراءة الصورة بالذكاء الاصطناعي...");
    setLastScannedReport(null);

    try {
      const base64DataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const scanned = await scanIraqLotoImage(
        base64DataUrl,
        activeGame,
        setScanStatusMsg
      );

      setActiveGame(scanned.game);

      if (scanned.game === "loto42" || scanned.game === "loto29") {
        if (scanned.numbers && scanned.numbers.length === 6) {
          await handleSaveNumberTicket(
            scanned.game,
            scanned.numbers,
            scanned.extraNumber || null
          );
          setLastScannedReport(
            scanned.summaryAr ||
              `تم استخراج وحفظ أرقام البطاقة: ${scanned.numbers.join(" - ")}${
                scanned.extraNumber ? ` (+${scanned.extraNumber})` : ""
              }`
          );
        } else {
          toast.error("لم يتم العثور على 6 أرقام واضحة في الصورة.");
        }
      } else if (scanned.game === "sports" && scanned.sportsPicks) {
        const price = scanned.cost || 5000;
        const newTkt: UserLotoTicket = {
          id: `spt-scan-${Date.now()}`,
          game: "sports",
          title: scanned.roundName || "قسيمة اللوتو الرياضي (ممسوحة بالكاميرا)",
          createdAt: new Date().toISOString(),
          cost: price,
          status: "pending",
          roundId: currentSportsRound?.id,
          roundName: scanned.roundName || currentSportsRound?.nameAr,
          sportsPicks: scanned.sportsPicks,
        };
        const updated = [newTkt, ...tickets];
        setTickets(updated);
        await persistHub({ tickets: updated });
        setLastScannedReport(scanned.summaryAr || "تم مسح وحفظ قسيمة اللوتو الرياضي بنجاح.");
        toast.success("تمت قراءة قسيمة اللوتو الرياضي وحفظها بنجاح! ⚽");
      } else if (scanned.game === "sc500" || scanned.game === "sc1k") {
        const spec = scanned.game === "sc500" ? SCRATCH_SPECS.SC500 : SCRATCH_SPECS.SC1K;
        const winAmt = scanned.detectedWinAmount || 0;
        const newTkt: UserLotoTicket = {
          id: `scr-${Date.now()}`,
          game: scanned.game,
          title: `بطاقة ${spec.nameAr} (فحص بالكاميرا)`,
          createdAt: new Date().toISOString(),
          cost: spec.price,
          status: winAmt > 0 ? "won" : "lost",
          prizeWon: winAmt,
          prizeLabel:
            winAmt > 0
              ? `مبروك! بطاقة رابحة بمبلغ ${fmt(winAmt)} د.ع 🎉`
              : "لا يوجد تطابق رابح في هذه البطاقة",
          scratchCells: scanned.scratchCells,
          scratchWinningNums: scanned.scratchWinningNums,
          scratchPlayerCells: scanned.scratchPlayerCells,
        };
        const updated = [newTkt, ...tickets];
        setTickets(updated);
        await persistHub({ tickets: updated });
        setLastScannedReport(
          `${newTkt.prizeLabel}${scanned.summaryAr ? ` — ${scanned.summaryAr}` : ""}`
        );
        if (recordExpenseOnSave && onAddExpenseLinked) {
          onAddExpenseLinked(spec.price, `شراء بطاقة ${spec.nameAr}`, getTodayIso());
        }
        toast.success(newTkt.prizeLabel);
      }
    } catch (err: any) {
      toast.error(err?.message || "تعذر قراءة الصورة حالياً");
    } finally {
      setIsScanningImage(false);
      setScanStatusMsg("");
      if (e.target) e.target.value = "";
    }
  };

  // Summary counters for user's tickets
  const ticketSummary = useMemo(() => {
    const totalSpent = tickets.reduce((s, t) => s + (Number(t.cost) || 0), 0);
    const totalWon = tickets.reduce((s, t) => s + (Number(t.prizeWon) || 0), 0);
    const pendingCount = tickets.filter((t) => t.status === "pending").length;
    const wonCount = tickets.filter((t) => t.status === "won").length;
    return { totalSpent, totalWon, pendingCount, wonCount };
  }, [tickets]);

  // 5 Game Cards Config (All visible at once in a responsive grid — zero horizontal slider!)
  const GAME_CARDS: {
    id: IraqLotoGameId;
    title: string;
    emoji: string;
    badge: string;
    jackpotText: string;
    priceText: string;
    accent: string;
  }[] = [
    {
      id: "sports",
      title: "اللوتو الرياضي",
      emoji: "⚽",
      badge: openSportsRounds.length > 0 ? `${openSportsRounds.length} جولات مفتوحة` : "10 مباريات",
      jackpotText: `${fmt(currentSportsRound?.jackpot || 5_000_000)} د.ع`,
      priceText: "5,000 د.ع",
      accent: "from-emerald-600 to-teal-600",
    },
    {
      id: "loto42",
      title: "لوتو 42",
      emoji: "🟣",
      badge: `سحب #${loto42Current?.selling?.drawNumber || (loto42Draws[0]?.drawNumber || 39) + 1}`,
      jackpotText: `${fmt(loto42Current?.selling?.jackpot || 101_666_930)} د.ع`,
      priceText: `${fmt(loto42Current?.selling?.price || 2000)} د.ع`,
      accent: "from-purple-600 to-indigo-600",
    },
    {
      id: "loto29",
      title: "لوتو 29",
      emoji: "🔴",
      badge: `سحب #${loto29Current?.selling?.drawNumber || (loto29Draws[0]?.drawNumber || 431) + 1}`,
      jackpotText: `${fmt(loto29Current?.selling?.jackpot || 116_885_315)} د.ع`,
      priceText: `${fmt(loto29Current?.selling?.price || 1500)} د.ع`,
      accent: "from-rose-600 to-pink-600",
    },
    {
      id: "sc500",
      title: "طابق 3",
      emoji: "🎫",
      badge: `متبقي كبرى: ${sc500Report.topRemaining}`,
      jackpotText: `${fmt(sc500Report.topPrize)} د.ع`,
      priceText: `${fmt(sc500Report.price)} د.ع`,
      accent: "from-amber-500 to-orange-600",
    },
    {
      id: "sc1k",
      title: "جيب الكاس جيبه",
      emoji: "🏆",
      badge: `متبقي كبرى: ${sc1kReport.topRemaining}`,
      jackpotText: `${fmt(sc1kReport.topPrize)} د.ع`,
      priceText: `${fmt(sc1kReport.price)} د.ع`,
      accent: "from-yellow-500 to-amber-600",
    },
  ];

  // Shared Number-Game Renderer (used for both Loto 42 and Loto 29!)
  const renderNumberGame = (gameKey: "loto42" | "loto29") => {
    const is42 = gameKey === "loto42";
    const maxN: 42 | 29 = is42 ? 42 : 29;
    const currentObj = is42 ? loto42Current?.selling : loto29Current?.selling;
    const draws = is42 ? loto42Draws : loto29Draws;
    const portfolioObj = is42 ? loto42Portfolio : loto29Portfolio;
    const aiData = aiLotoOverride[gameKey];
    const primaryPred = aiData ? aiData.ticket : portfolioObj.primary;
    const lockState = lockedByGame[gameKey];
    const latestDraw = draws[0];
    const gameTickets = tickets.filter((t) => t.game === gameKey);
    const prizeTiers = is42 ? LOTO_42_PRIZE_TIERS : LOTO_29_PRIZE_TIERS;

    const filteredDraws = !archiveQuery.trim()
      ? draws
      : draws.filter(
          (d) =>
            String(d.drawNumber).includes(archiveQuery.trim()) ||
            new Date(d.drawAt).toISOString().includes(archiveQuery.trim()) ||
            (d.winningNumbers || []).some((n) => String(n) === archiveQuery.trim())
        );

    return (
      <div className="space-y-4">
        {/* Live Draw & Jackpot Hero Card */}
        <div
          className={`rounded-3xl p-4 sm:p-5 text-white shadow-xl border border-white/10 bg-gradient-to-br ${
            is42
              ? "from-purple-950 via-indigo-950 to-slate-950"
              : "from-rose-950 via-pink-950 to-slate-950"
          }`}
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-white/15 text-amber-300 text-xs font-black border border-white/15">
                  {is42 ? "🟣 لوتو 42 الرسمي (6 من 42 + إضافي)" : "🔴 لوتو 29 الرسمي (6 من 29)"}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-black border border-emerald-400/30">
                  السحب القادم #{currentObj?.drawNumber || (latestDraw?.drawNumber || 0) + 1}
                </span>
                {currentObj?.ticketsSold !== undefined && (
                  <span className="px-2.5 py-1 rounded-full bg-white/10 text-white/90 text-[11px] font-bold">
                    التذاكر المباعة الآن: {fmt(currentObj.ticketsSold)}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-baseline gap-3 pt-1">
                <div>
                  <span className="text-[11px] text-white/70 font-bold block">
                    الجائزة الكبرى الحالية (مباشر من الموقع)
                  </span>
                  <span className="text-2xl sm:text-4xl font-black text-amber-300 tracking-tight">
                    {fmt(currentObj?.jackpot || (is42 ? 101_666_930 : 116_885_315))}{" "}
                    <span className="text-sm font-bold text-white/80">د.ع</span>
                  </span>
                </div>

                {is42 && currentObj?.miniJackpot && (
                  <div className="bg-white/10 rounded-2xl px-3.5 py-2 border border-white/10">
                    <span className="text-[10px] text-purple-200 font-bold block">
                      الجائزة الثانية (5 + الإضافي)
                    </span>
                    <span className="text-base sm:text-lg font-black text-white">
                      {fmt(currentObj.miniJackpot)} <span className="text-[10px]">د.ع</span>
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-2">
              <div className="bg-black/30 backdrop-blur-md rounded-2xl px-4 py-2.5 border border-white/15 text-center sm:text-right">
                <div className="text-[10px] text-amber-200 font-bold flex items-center gap-1.5 justify-center sm:justify-start">
                  <Clock className="w-3.5 h-3.5" />
                  <span>العد التنازلي لإغلاق البيع والسحب (8:50 م):</span>
                </div>
                <div className="text-lg font-black text-white font-mono mt-0.5" dir="ltr">
                  {formatCountdown(currentObj?.drawAt, nowMs)}
                </div>
              </div>

              <a
                href={is42 ? "https://loto.iq/play" : "https://loto.iq/29/play"}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-black flex items-center justify-center gap-1.5 border border-white/20 transition"
              >
                <ExternalLink className="w-3.5 h-3.5 text-amber-300" />
                <span>فتح صفحة {is42 ? "لوتو 42" : "لوتو 29"} في loto.iq</span>
              </a>
            </div>
          </div>

          {/* Latest Official Winning Result Strip */}
          {latestDraw && Array.isArray(latestDraw.winningNumbers) && (
            <div className="mt-4 pt-3.5 border-t border-white/15 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black text-emerald-300">
                  🏆 آخر نتيجة رسمية مسحوبة (#{latestDraw.drawNumber} —{" "}
                  {new Date(latestDraw.drawAt).toLocaleDateString("ar-IQ")}):
                </span>
                <div className="flex items-center gap-1.5 flex-wrap" dir="ltr">
                  {latestDraw.winningNumbers.map((n) => (
                    <span
                      key={n}
                      className="w-8 h-8 rounded-xl bg-white text-slate-900 font-black text-xs flex items-center justify-center shadow"
                    >
                      {n}
                    </span>
                  ))}
                  {is42 && latestDraw.extraNumber && (
                    <>
                      <span className="text-amber-300 font-black text-xs px-0.5">+</span>
                      <span
                        className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center shadow ring-2 ring-amber-200"
                        title="الرقم الإضافي"
                      >
                        {latestDraw.extraNumber}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <span className="text-[11px] text-white/75 font-bold">
                إجمالي السحوبات المحللة بالمحرك: {portfolioObj.stats.totalDraws} سحبة رسمية
              </span>
            </div>
          )}
        </div>

        {/* ALL-VISIBLE 4 Sub-Tabs Grid (No horizontal slider!) */}
        <div
          role="tablist"
          aria-label="أقسام لعبة الأرقام"
          className="grid grid-cols-2 sm:grid-cols-4 gap-2"
        >
          {[
            { id: "predict", label: "التنبؤ الذكي الفائق", icon: Sparkles, count: 3 },
            { id: "tickets", label: "بطاقاتي والنتائج", icon: Ticket, count: gameTickets.length },
            { id: "history", label: "أرشيف السحوبات", icon: Calendar, count: draws.length },
            { id: "stats", label: "الخريطة الحرارية والجوائز", icon: BarChart2, count: maxN },
          ].map((tab) => {
            const Icon = tab.icon;
            const selected = numberSubView === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setNumberSubView(tab.id as any)}
                className={`relative py-2.5 px-3 rounded-2xl text-xs font-black border-2 transition flex items-center justify-center gap-1.5 cursor-pointer aria-selected:after:content-[''] aria-selected:after:absolute aria-selected:after:inset-x-4 aria-selected:after:bottom-0 aria-selected:after:border-b-[3px] aria-selected:after:border-current ${
                  selected
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-md"
                    : "bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-gray-200 hover:border-indigo-400"
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    selected
                      ? "bg-white/25 text-white"
                      : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* SUBVIEW 1: SUPER PREDICTION ENGINE */}
        {numberSubView === "predict" && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-4 sm:p-6 border border-gray-200/80 dark:border-zinc-800 shadow-sm space-y-5">
              {/* Controls Header */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white">
                      🧠 محرك التنبؤ الهجين (7 عوامل رياضية + الذكاء الخارق)
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[11px] font-black">
                      دقة التطابق الهيكلي: {primaryPred.qualityScore}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-bold mt-0.5">
                    يحلل التردد الموزون زمنياً (EWMA)، فجوات الارتداد، نطاقات المراكز الستة، وتآزر الأزواج على {portfolioObj.stats.totalDraws} سحبة حقيقية.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRunGeminiLoto(gameKey)}
                    disabled={isRunningGeminiLoto}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-fuchsia-600 via-purple-600 to-indigo-600 hover:opacity-95 text-white text-xs font-black shadow-md flex items-center gap-1.5 transition active:scale-95 disabled:opacity-60 cursor-pointer"
                  >
                    {isRunningGeminiLoto ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <BrainCircuit className="w-3.5 h-3.5 text-amber-200" />
                    )}
                    <span>استنتاج عميق بالذكاء الخارق Gemini</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowCustomPicker((v) => !v)}
                    className={`px-3 py-2 rounded-xl text-xs font-black border transition flex items-center gap-1.5 cursor-pointer ${
                      showCustomPicker || lockState.numbers.length > 0
                        ? "bg-amber-500 text-white border-amber-500"
                        : "bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-zinc-700"
                    }`}
                  >
                    {lockState.numbers.length > 0 ? (
                      <Lock className="w-3.5 h-3.5" />
                    ) : (
                      <Sliders className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {lockState.numbers.length > 0
                        ? `مثبت (${lockState.numbers.length}/6)`
                        : "تثبيت أرقام مفضلة"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAiLotoOverride((prev) => {
                        const next = { ...prev };
                        delete next[gameKey];
                        return next;
                      });
                      setSeedSalt((s) => s + 1);
                      toast.success("تم توليد محفظة تنبؤات إحصائية جديدة 🎯");
                    }}
                    className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-gray-200 text-xs font-black flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>توليفة بديلة</span>
                  </button>
                </div>
              </div>

              {/* Custom Number Lock Matrix */}
              {showCustomPicker && (
                <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-black text-amber-900 dark:text-amber-200">
                      🔒 اختر من 1 إلى 6 أرقام لتثبيتها، وسيقوم المحرك ببناء أفضل الأرقام المكملة حولها علمياً:
                    </span>
                    {lockState.numbers.length > 0 && (
                      <button
                        type="button"
                        onClick={async () => {
                          const next = {
                            ...lockedByGame,
                            [gameKey]: { numbers: [], extra: null, locked: false },
                          };
                          setLockedByGame(next);
                          await persistHub({ lockedByGame: next });
                        }}
                        className="text-xs font-black text-rose-600 hover:underline"
                      >
                        إلغاء التثبيت بالكامل
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-7 sm:grid-cols-10 md:grid-cols-14 gap-1.5" dir="ltr">
                    {Array.from({ length: maxN }, (_, i) => i + 1).map((num) => {
                      const isLockedBall = lockState.numbers.includes(num);
                      const isHot = portfolioObj.stats.hotNumbers.includes(num);
                      const isDue = portfolioObj.stats.overdueNumbers.includes(num);
                      return (
                        <button
                          key={num}
                          type="button"
                          onClick={() => toggleLockedBall(gameKey, num)}
                          className={`h-9 rounded-xl font-black text-xs flex items-center justify-center relative border transition cursor-pointer ${
                            isLockedBall
                              ? "bg-amber-500 border-amber-600 text-white shadow scale-105"
                              : isHot
                              ? "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200"
                              : isDue
                              ? "bg-cyan-50 dark:bg-cyan-950/40 border-cyan-300 dark:border-cyan-800 text-cyan-800 dark:text-cyan-200"
                              : "bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-800 dark:text-gray-200"
                          }`}
                        >
                          {num}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Primary Golden / AI Prediction Display */}
              <div className="rounded-3xl p-5 bg-gradient-to-br from-indigo-50 via-purple-50/70 to-amber-50/50 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-zinc-900 border-2 border-indigo-200 dark:border-indigo-500/40 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-black text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-500" />
                    <span>{primaryPred.label}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        copyText(
                          "primary",
                          `${primaryPred.numbers.join(" - ")}${
                            primaryPred.extraNumber ? ` | الإضافي: ${primaryPred.extraNumber}` : ""
                          }`
                        )
                      }
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-xs font-black text-gray-700 dark:text-gray-200 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === "primary" ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>نسخ الأرقام</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleSaveNumberTicket(
                          gameKey,
                          primaryPred.numbers,
                          primaryPred.extraNumber
                        )
                      }
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1 shadow-sm cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>اعتماد وحفظ في بطاقاتي</span>
                    </button>
                  </div>
                </div>

                {/* The 6 Balls + Extra Ball */}
                <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3.5 py-2" dir="ltr">
                  {primaryPred.numbers.map((num) => {
                    const isHot = portfolioObj.stats.hotNumbers.includes(num);
                    const isDue = portfolioObj.stats.overdueNumbers.includes(num);
                    return (
                      <div key={num} className="flex flex-col items-center gap-1">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-rose-600 text-white font-black text-lg sm:text-xl flex items-center justify-center shadow-lg ring-2 ring-white dark:ring-zinc-800">
                          {num}
                        </div>
                        <span className="text-[9px] font-black text-gray-500 dark:text-gray-400">
                          {isHot ? "🔥 ساخن" : isDue ? "❄️ ارتداد" : "⚖️ محوري"}
                        </span>
                      </div>
                    );
                  })}

                  {is42 && primaryPred.extraNumber && (
                    <div className="flex flex-col items-center gap-1 pl-2 border-l border-indigo-200 dark:border-zinc-700">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 font-black text-lg sm:text-xl flex items-center justify-center shadow-lg ring-2 ring-amber-200">
                        {primaryPred.extraNumber}
                      </div>
                      <span className="text-[9px] font-black text-amber-600 dark:text-amber-400">
                        ⭐ الإضافي
                      </span>
                    </div>
                  )}
                </div>

                {aiData?.expertSummaryAr && (
                  <div className="p-3 rounded-2xl bg-purple-600/10 border border-purple-400/30 text-xs font-bold text-purple-950 dark:text-purple-200 leading-relaxed">
                    🧠 <strong>تقرير الذكاء الخارق Gemini:</strong> {aiData.expertSummaryAr}
                  </div>
                )}

                {/* 5 Quantitative Proof Pills */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                  <div className="bg-white/90 dark:bg-zinc-900/90 p-2.5 rounded-2xl border border-gray-200/70 dark:border-zinc-800">
                    <span className="text-[10px] text-gray-400 font-bold block">مجموع الأرقام</span>
                    <span className="text-xs font-black text-gray-900 dark:text-white">
                      {primaryPred.sum} (الذهبي {portfolioObj.stats.goldenSumRange[0]}–
                      {portfolioObj.stats.goldenSumRange[1]})
                    </span>
                  </div>
                  <div className="bg-white/90 dark:bg-zinc-900/90 p-2.5 rounded-2xl border border-gray-200/70 dark:border-zinc-800">
                    <span className="text-[10px] text-gray-400 font-bold block">الفردي / الزوجي</span>
                    <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                      {primaryPred.oddEven}
                    </span>
                  </div>
                  <div className="bg-white/90 dark:bg-zinc-900/90 p-2.5 rounded-2xl border border-gray-200/70 dark:border-zinc-800">
                    <span className="text-[10px] text-gray-400 font-bold block">التوزيع الموضعي</span>
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                      {primaryPred.positionalFitPct}% مطابق للمراكز
                    </span>
                  </div>
                  <div className="bg-white/90 dark:bg-zinc-900/90 p-2.5 rounded-2xl border border-gray-200/70 dark:border-zinc-800">
                    <span className="text-[10px] text-gray-400 font-bold block">تآزر الأزواج</span>
                    <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                      +{primaryPred.pairSynergy} رابط تاريخي
                    </span>
                  </div>
                  <div className="bg-white/90 dark:bg-zinc-900/90 p-2.5 rounded-2xl border border-gray-200/70 dark:border-zinc-800 col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-gray-400 font-bold block">اختبار الأثر الرجعي</span>
                    <span className="text-xs font-black text-rose-600 dark:text-rose-400">
                      {primaryPred.backtestHits3Plus} مرات 3+ أرقام
                    </span>
                  </div>
                </div>

                {/* Detailed Scientific Reasons */}
                <div className="space-y-1 pt-1">
                  {primaryPred.reasonsAr.map((r, idx) => (
                    <div
                      key={idx}
                      className="text-[11px] font-bold text-gray-700 dark:text-gray-300 flex items-start gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Secondary Complementary Coverage Portfolio (Tickets 2 & 3) */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-black text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-purple-500" />
                  <span>التوليفات الرديفة لتغطية طيف الأرقام (بدون تكرار مفرط مع التوليفة الأولى):</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {portfolioObj.portfolio.slice(1).map((alt, i) => (
                    <div
                      key={i}
                      className="rounded-2xl p-3.5 bg-gray-50 dark:bg-zinc-800/60 border border-gray-200/80 dark:border-zinc-700/80 flex flex-col gap-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-gray-800 dark:text-white">
                          {alt.label}
                        </span>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                          كفاءة {alt.qualityScore}%
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap" dir="ltr">
                        {alt.numbers.map((n) => (
                          <span
                            key={n}
                            className="w-8 h-8 rounded-xl bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-600 font-black text-xs text-gray-900 dark:text-white flex items-center justify-center"
                          >
                            {n}
                          </span>
                        ))}
                        {is42 && alt.extraNumber && (
                          <span className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center">
                            +{alt.extraNumber}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 font-bold">
                        <span>المجموع: {alt.sum} | {alt.oddEven}</span>
                        <button
                          type="button"
                          onClick={() =>
                            handleSaveNumberTicket(gameKey, alt.numbers, alt.extraNumber)
                          }
                          className="text-emerald-600 dark:text-emerald-400 font-black hover:underline cursor-pointer"
                        >
                          + حفظ ببطاقاتي
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUBVIEW 2: SAVED TICKETS FOR THIS GAME */}
        {numberSubView === "tickets" && renderTicketsPanel(gameKey)}

        {/* SUBVIEW 3: OFFICIAL DRAWS ARCHIVE */}
        {numberSubView === "history" && (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-4 sm:p-5 border border-gray-200/80 dark:border-zinc-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="font-black text-sm sm:text-base text-gray-900 dark:text-white">
                📅 أرشيف السحوبات الرسمية ({draws.length} سحبة موثقة)
              </h3>
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={archiveQuery}
                  onChange={(e) => setArchiveQuery(e.target.value)}
                  placeholder="ابحث برقم السحب أو رقم كرة..."
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl pr-8 pl-3 py-1.5 text-xs font-bold text-gray-800 dark:text-white outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[500px] overflow-y-auto pr-1">
              {filteredDraws.map((d) => (
                <div
                  key={d.id || d.drawNumber}
                  className="p-3 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200/70 dark:border-zinc-700/60 flex items-center justify-between gap-2"
                >
                  <div>
                    <span className="text-xs font-black text-gray-900 dark:text-white block">
                      سحب #{d.drawNumber}
                    </span>
                    <span className="text-[10px] text-gray-500 font-bold">
                      {new Date(d.drawAt).toLocaleDateString("ar-IQ")}
                    </span>
                  </div>
                  <div className="flex items-center gap-1" dir="ltr">
                    {(d.winningNumbers || []).map((n) => (
                      <span
                        key={n}
                        className="w-7 h-7 rounded-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-xs font-black text-gray-800 dark:text-white flex items-center justify-center"
                      >
                        {n}
                      </span>
                    ))}
                    {is42 && d.extraNumber && (
                      <span className="w-7 h-7 rounded-lg bg-amber-400 text-slate-950 text-xs font-black flex items-center justify-center">
                        +{d.extraNumber}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUBVIEW 4: HEATMAP STATS & PRIZE TIERS */}
        {numberSubView === "stats" && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-4 sm:p-5 border border-gray-200/80 dark:border-zinc-800 space-y-4">
              <h3 className="font-black text-sm sm:text-base text-gray-900 dark:text-white">
                🔥 الخريطة الحرارية ومؤشر القوة لكل رقم (1 إلى {maxN})
              </h3>
              <div className="grid grid-cols-4 sm:grid-cols-7 md:grid-cols-10 gap-2" dir="ltr">
                {portfolioObj.stats.metrics.map((m) => (
                  <div
                    key={m.number}
                    className={`p-2 rounded-2xl border text-center ${
                      m.tag === "hot"
                        ? "bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800"
                        : m.tag === "overdue"
                        ? "bg-cyan-50 dark:bg-cyan-950/30 border-cyan-300 dark:border-cyan-800"
                        : m.tag === "prime_zone"
                        ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800"
                        : "bg-gray-50 dark:bg-zinc-800/50 border-gray-200 dark:border-zinc-700"
                    }`}
                  >
                    <div className="text-sm font-black text-gray-900 dark:text-white">
                      {m.number}
                    </div>
                    <div className="text-[9px] font-bold text-gray-500 dark:text-gray-400">
                      ظهور: {m.count} ({m.frequencyPct}%)
                    </div>
                    <div className="text-[9px] font-black text-indigo-600 dark:text-indigo-400">
                      غاب: {m.drawsSinceLastSeen} سحب
                    </div>
                  </div>
                ))}
              </div>

              {/* Top Co-occurring Pairs */}
              <div className="pt-3 border-t border-gray-100 dark:border-zinc-800">
                <h4 className="text-xs font-black text-gray-700 dark:text-gray-300 mb-2">
                  🔗 أقوى الثنائيات المتلازمة في السحوبات الرسمية:
                </h4>
                <div className="flex flex-wrap gap-2">
                  {portfolioObj.stats.topPairs.map((p, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-xs font-black text-indigo-800 dark:text-indigo-200"
                    >
                      ({p.pair[0]} + {p.pair[1]}) ← {p.count} مرات
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Official Prize Table */}
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-4 sm:p-5 border border-gray-200/80 dark:border-zinc-800 space-y-2.5">
              <h3 className="font-black text-sm text-gray-900 dark:text-white">
                🏆 جدول فئات الجوائز الرسمية ({is42 ? "لوتو 42" : "لوتو 29"})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {prizeTiers.map((t, i) => {
                  const val =
                    t.dynamic === "jackpot"
                      ? currentObj?.jackpot || t.fixedAmount
                      : t.dynamic === "miniJackpot"
                      ? currentObj?.miniJackpot || t.fixedAmount
                      : t.fixedAmount;
                  return (
                    <div
                      key={i}
                      className="p-3 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200/60 dark:border-zinc-700 flex items-center justify-between"
                    >
                      <div>
                        <span className="text-xs font-black text-gray-900 dark:text-white block">
                          {t.match}
                        </span>
                        <span className="text-[10px] text-gray-500 font-bold">{t.label}</span>
                      </div>
                      <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                        {fmt(val)} د.ع
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Shared Tickets Panel (supports filtering by current game or viewing all)
  const renderTicketsPanel = (filterGame?: IraqLotoGameId) => {
    const list = filterGame ? tickets.filter((t) => t.game === filterGame) : tickets;
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-4 sm:p-5 border border-gray-200/80 dark:border-zinc-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-black text-sm sm:text-base text-gray-900 dark:text-white">
              🎫 سجل بطاقاتي الموثقة وفحص الفوز التلقائي ({list.length})
            </h3>
            <p className="text-xs text-gray-500 font-bold">
              إجمالي الشراء: {fmt(ticketSummary.totalSpent)} د.ع | إجمالي الجوائز المحققة:{" "}
              <span className="text-emerald-600 font-black">{fmt(ticketSummary.totalWon)} د.ع</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600 dark:text-gray-300 cursor-pointer bg-gray-50 dark:bg-zinc-800 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-zinc-700">
              <input
                type="checkbox"
                checked={recordExpenseOnSave}
                onChange={(e) => setRecordExpenseOnSave(e.target.checked)}
                className="rounded accent-rose-500"
              />
              <span>ربط الشراء بسجل المصاريف تلقائياً</span>
            </label>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isScanningImage}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              {isScanningImage ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Camera className="w-3.5 h-3.5" />
              )}
              <span>{isScanningImage ? scanStatusMsg : "مسح بطاقة بالكاميرا 📸"}</span>
            </button>
          </div>
        </div>

        {lastScannedReport && (
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-black text-emerald-800 dark:text-emerald-200">
            ✅ {lastScannedReport}
          </div>
        )}

        {list.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-gray-50 dark:bg-zinc-800/40 border border-dashed border-gray-200 dark:border-zinc-700">
            <p className="text-sm font-black text-gray-500 dark:text-gray-400">
              لا توجد بطاقات محفوظة في هذا القسم بعد — يمكنك اعتماد أي تنبؤ بضغطة زر أو مسح بطاقتك بالكاميرا.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {list.map((t) => (
              <div
                key={t.id}
                className={`p-3.5 rounded-2xl border flex flex-col gap-2 ${
                  t.status === "won"
                    ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700"
                    : t.status === "lost"
                    ? "bg-gray-50 dark:bg-zinc-800/40 border-gray-200 dark:border-zinc-800"
                    : "bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-black text-gray-900 dark:text-white block">
                      {t.title}
                    </span>
                    <span className="text-[10px] text-gray-500 font-bold">
                      التكلفة: {fmt(t.cost)} د.ع •{" "}
                      {new Date(t.createdAt).toLocaleDateString("ar-IQ")}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        t.status === "won"
                          ? "bg-emerald-500 text-white"
                          : t.status === "lost"
                          ? "bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-gray-300"
                          : "bg-amber-500 text-white"
                      }`}
                    >
                      {t.status === "won"
                        ? `رابحة (${fmt(t.prizeWon || 0)} د.ع)`
                        : t.status === "lost"
                        ? "تم الفحص"
                        : "بانتظار السحب"}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteTicket(t.id)}
                      className="p-1 text-gray-400 hover:text-rose-500 transition cursor-pointer"
                      title="حذف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {t.numbers && t.numbers.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap" dir="ltr">
                    {t.numbers.map((n) => {
                      const hit = t.matchedNumbers?.includes(n);
                      return (
                        <span
                          key={n}
                          className={`w-7 h-7 rounded-lg text-xs font-black flex items-center justify-center ${
                            hit
                              ? "bg-emerald-500 text-white ring-2 ring-emerald-300"
                              : "bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-gray-800 dark:text-white"
                          }`}
                        >
                          {n}
                        </span>
                      );
                    })}
                    {t.extraNumber && (
                      <span
                        className={`w-7 h-7 rounded-lg text-xs font-black flex items-center justify-center ${
                          t.extraMatched
                            ? "bg-amber-400 text-slate-950 ring-2 ring-amber-200"
                            : "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200"
                        }`}
                      >
                        +{t.extraNumber}
                      </span>
                    )}
                  </div>
                )}

                {t.sportsPicks && (
                  <div className="flex flex-wrap gap-1 text-[10px] font-black" dir="ltr">
                    {Object.entries(t.sportsPicks).map(([pos, pick]) => (
                      <span
                        key={pos}
                        className="px-2 py-0.5 rounded-md bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700"
                      >
                        M{pos}:{pick}
                      </span>
                    ))}
                  </div>
                )}

                {t.prizeLabel && (
                  <div className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                    {t.prizeLabel}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Scratch Card Renderer (طابق 3 SC500 & جيب الكاس جيبه SC1K)
  const renderScratchGame = (code: "SC500" | "SC1K") => {
    const spec = SCRATCH_SPECS[code];
    const report = code === "SC500" ? sc500Report : sc1kReport;
    const otherReport = code === "SC500" ? sc1kReport : sc500Report;
    const gameTickets = tickets.filter((t) => t.game === spec.gameId);

    return (
      <div className="space-y-4">
        {/* Hero Card */}
        <div className="rounded-3xl p-4 sm:p-5 bg-gradient-to-br from-amber-950 via-orange-950 to-slate-950 text-white border border-white/10 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-black border border-amber-300/30">
                  {code === "SC500" ? "🎫 طابق 3 (SC500)" : "🏆 جيب الكاس جيبه (SC1K)"}
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-black ${
                    report.verdictTone === "emerald"
                      ? "bg-emerald-500/25 text-emerald-200 border border-emerald-400/40"
                      : "bg-rose-500/30 text-rose-200 border border-rose-400/40"
                  }`}
                >
                  {report.verdictBadge}
                </span>
              </div>

              <div className="flex flex-wrap items-baseline gap-4 pt-1">
                <div>
                  <span className="text-[11px] text-amber-200/80 font-bold block">
                    الجائزة الكبرى الفورية
                  </span>
                  <span className="text-2xl sm:text-4xl font-black text-amber-300">
                    {fmt(report.topPrize)} <span className="text-sm">د.ع</span>
                  </span>
                </div>
                <div className="bg-white/10 rounded-2xl px-3.5 py-2 border border-white/10">
                  <span className="text-[10px] text-amber-200 font-bold block">سعر البطاقة</span>
                  <span className="text-base font-black text-white">{fmt(report.price)} د.ع</span>
                </div>
                <div className="bg-white/10 rounded-2xl px-3.5 py-2 border border-white/10">
                  <span className="text-[10px] text-amber-200 font-bold block">
                    الجوائز الكبرى المتبقية الآن
                  </span>
                  <span className="text-base font-black text-emerald-300">
                    {report.topRemaining} بطاقة
                  </span>
                </div>
              </div>
              <p className="text-xs text-amber-100/90 font-bold pt-1">{spec.mechanicsAr}</p>
            </div>

            <div className="flex flex-col gap-2 shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanningImage}
                className="px-4 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 shadow-lg cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>افحص بطاقة مكشوطة بالكاميرا 📸</span>
              </button>
              <a
                href={spec.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-2xl bg-white/15 hover:bg-white/25 text-white text-xs font-black flex items-center justify-center gap-1.5 border border-white/20 transition"
              >
                <ExternalLink className="w-3.5 h-3.5 text-amber-300" />
                <span>فتح {spec.nameAr} في loto.iq</span>
              </a>
            </div>
          </div>
        </div>

        {/* Actuarial Smart Decision & Comparison Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-4 sm:p-5 border border-gray-200/80 dark:border-zinc-800 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-black text-sm sm:text-base text-gray-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              <span>التحليل الاكتواري الذكي ومؤشر الجدوى الحقيقي</span>
            </h3>
            <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
              إجمالي مجموع جوائز الطبعة: {fmt(report.totalPrizePoolIqd)} د.ع
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
            <div className="p-3 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200/60 dark:border-zinc-700">
              <span className="text-[10px] text-gray-500 font-bold block">إجمالي البطاقات الرابحة</span>
              <span className="text-sm sm:text-base font-black text-gray-900 dark:text-white">
                {fmt(report.totalWinningCardsInRun)}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold block">
                بطاقات ربح صافٍ (&gt; السعر)
              </span>
              <span className="text-sm sm:text-base font-black text-emerald-700 dark:text-emerald-300">
                {fmt(report.netProfitCards)} ({report.profitAmongWinnersPct}%)
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800">
              <span className="text-[10px] text-indigo-700 dark:text-indigo-300 font-bold block">
                فئات 10,000 د.ع فأعلى
              </span>
              <span className="text-sm sm:text-base font-black text-indigo-700 dark:text-indigo-300">
                {fmt(report.midHighTierCards)} بطاقة
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <span className="text-[10px] text-amber-700 dark:text-amber-300 font-bold block">
                مضاعف الجائزة الكبرى
              </span>
              <span className="text-sm sm:text-base font-black text-amber-700 dark:text-amber-300">
                {fmt(report.maxMultiplier)}x ضعف
              </span>
            </div>
          </div>

          <div className="space-y-2 p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/25 border border-indigo-200/70 dark:border-indigo-800/40">
            <div className="text-xs font-black text-indigo-900 dark:text-indigo-200">
              🧠 خلاصة المستشار الذكي (مقارنة حية مع {otherReport.nameAr}):
            </div>
            {report.smartAdviceAr.map((adv, idx) => (
              <div
                key={idx}
                className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-start gap-1.5"
              >
                <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <span>{adv}</span>
              </div>
            ))}
          </div>

          {/* Complete Official Prize Distribution Table */}
          <div>
            <h4 className="text-xs font-black text-gray-800 dark:text-white mb-2">
              📊 التوزيع الرسمي الكامل لفئات الجوائز في الطبعة:
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {spec.tiers.map((tier, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200/70 dark:border-zinc-700 flex items-center justify-between"
                >
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                    {fmt(tier.amount)} د.ع
                  </span>
                  <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400">
                    × {fmt(idx === 0 ? report.topRemaining : tier.winnersCount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Saved/Scanned Scratch Cards */}
        {gameTickets.length > 0 && renderTicketsPanel(spec.gameId)}
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200" dir="rtl">
      {/* Hidden Camera / Image Input for AI Ticket & Scratch Scanner */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageScan}
      />

      {/* Top Live Sync Header */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-4 border border-gray-200/80 dark:border-zinc-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 via-rose-500 to-amber-500 text-white flex items-center justify-center text-2xl shadow-md">
            🎰
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white">
                لوتو العراق الرسمي المباشر
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-black flex items-center gap-1">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isSyncingLive ? "bg-amber-500 animate-ping" : "bg-emerald-500 animate-pulse"
                  }`}
                />
                <span>{syncSource}</span>
              </span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 font-bold">
              تحديث تلقائي أولاً بأول من loto.iq للألعاب الخمس + تنبؤ إحصائي وذكاء خارق
              {lastSyncedAt > 0 && (
                <span>
                  {" "}
                  • آخر مزامنة:{" "}
                  {new Date(lastSyncedAt).toLocaleTimeString("ar-IQ", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isScanningImage}
            className="px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-black flex items-center gap-1.5 hover:bg-indigo-100 transition cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>مسح بطاقة بالذكاء 📸</span>
          </button>

          <button
            type="button"
            onClick={() => triggerLiveSync(false)}
            disabled={isSyncingLive}
            className="px-3.5 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 text-xs font-black flex items-center gap-1.5 shadow-sm transition active:scale-95 disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingLive ? "animate-spin" : ""}`} />
            <span>{isSyncingLive ? "جاري الجلب الحي..." : "تحديث من الموقع الآن"}</span>
          </button>
        </div>
      </div>

      {/* ALL 5 GAMES VISIBLE GRID (NO SLIDER!) */}
      <div
        role="tablist"
        aria-label="ألعاب لوتو العراق الخمس"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5"
      >
        {GAME_CARDS.map((g) => {
          const isSelected = activeGame === g.id;
          return (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setActiveGame(g.id)}
              className={`relative text-right p-3 rounded-2xl border-2 transition-all flex flex-col justify-between gap-1.5 cursor-pointer active:scale-[0.98] aria-selected:after:content-[''] aria-selected:after:absolute aria-selected:after:inset-x-4 aria-selected:after:bottom-0 aria-selected:after:border-b-[3px] aria-selected:after:border-current ${
                isSelected
                  ? `bg-gradient-to-br ${g.accent} text-white border-transparent shadow-lg`
                  : "bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-gray-800 dark:text-gray-100 hover:border-purple-400"
              }`}
            >
              <div className="flex items-center justify-between gap-1 w-full">
                <span className="text-xl leading-none">{g.emoji}</span>
                <span
                  className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                    isSelected
                      ? "bg-white/20 text-white"
                      : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300"
                  }`}
                >
                  {g.badge}
                </span>
              </div>
              <div className="font-black text-xs sm:text-sm">{g.title}</div>
              <div className="flex items-baseline justify-between gap-1 w-full pt-1 border-t border-current/10">
                <span
                  className={`text-[11px] font-black ${
                    isSelected ? "text-amber-200" : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {g.jackpotText}
                </span>
                <span className={`text-[9px] font-bold ${isSelected ? "text-white/80" : "text-gray-400"}`}>
                  {g.priceText}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          GAME 1: SPORTS LOTO (اللوتو الرياضي — 10 مباريات 1 / X / 2)
      ═══════════════════════════════════════════════════════════════════ */}
      {activeGame === "sports" && (
        <div className="space-y-4">
          {/* Visible Sub-Tabs for Sports Loto */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "active", label: `الجولات المفتوحة (${openSportsRounds.length})` },
              { id: "finished", label: `نتائج الجولات السابقة (${finishedSportsRounds.length})` },
              {
                id: "tickets",
                label: `قسائمي الرياضية (${tickets.filter((t) => t.game === "sports").length})`,
              },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setSportsSubView(st.id as any)}
                className={`py-2.5 px-2 rounded-2xl text-xs font-black border-2 transition cursor-pointer ${
                  sportsSubView === st.id
                    ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                    : "bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-gray-200"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {sportsSubView === "tickets" ? (
            renderTicketsPanel("sports")
          ) : (
            <div className="space-y-4">
              {/* All Rounds Visible Grid Selector (No Slider!) */}
              {(sportsSubView === "active" ? openSportsRounds : finishedSportsRounds).length >
                0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {(sportsSubView === "active"
                    ? openSportsRounds
                    : finishedSportsRounds
                  ).map((r) => {
                    const on = currentSportsRound?.id === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSelectedRoundId(r.id)}
                        className={`p-3 rounded-2xl border-2 text-right transition cursor-pointer ${
                          on
                            ? "bg-emerald-950 text-white border-emerald-500 shadow-md"
                            : "bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-gray-800 dark:text-white hover:border-emerald-400"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black">{r.nameAr}</span>
                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                              r.status === "open"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-gray-500/20 text-gray-400"
                            }`}
                          >
                            {r.status === "open" ? "مفتوحة الآن" : "منتهية"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] mt-1.5 opacity-85 font-bold">
                          <span>الجائزة: {fmt(r.jackpot)} د.ع</span>
                          <span>
                            {r.status === "open"
                              ? `يغلق: ${formatCountdown(r.closesAt, nowMs)}`
                              : `جولة #${r.number}`}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {!currentSportsRound ? (
                <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 text-center border border-gray-200 dark:border-zinc-800">
                  <Loader2 className="w-7 h-7 animate-spin text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-black text-gray-700 dark:text-gray-200">
                    جاري سحب مباريات اللوتو الرياضي الحية من موقع loto.iq...
                  </p>
                </div>
              ) : (
                <div className="bg-white dark:bg-zinc-900 rounded-3xl p-4 sm:p-5 border border-gray-200/80 dark:border-zinc-800 space-y-4">
                  {/* Round Header & AI Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-zinc-800">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white">
                          ⚽ {currentSportsRound.nameAr}
                        </h3>
                        <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                          الجائزة الكبرى: {fmt(currentSportsRound.jackpot)} د.ع
                        </span>
                        <span className="text-xs font-bold text-gray-500">
                          سعر القسيمة: {fmt(currentSportsRound.price)} د.ع
                        </span>
                      </div>
                      {currentSportsAnalysis && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-bold mt-1">
                          ركائز مضمونة (Bankers): {currentSportsAnalysis.bankerCount} | مواجهات متكافئة:{" "}
                          {currentSportsAnalysis.tightCount} | التوزيع التاريخي للموقع: (1:{" "}
                          {currentSportsAnalysis.historicalHomeRate}% • X:{" "}
                          {currentSportsAnalysis.historicalDrawRate}% • 2:{" "}
                          {currentSportsAnalysis.historicalAwayRate}%)
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {currentSportsRound.status === "open" && (
                        <button
                          type="button"
                          onClick={handleRunGeminiSports}
                          disabled={isRunningGeminiSports}
                          className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-60"
                        >
                          {isRunningGeminiSports ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <BrainCircuit className="w-3.5 h-3.5 text-amber-200" />
                          )}
                          <span>تحليل تكتيكي عميق بالذكاء الخارق للمباريات الـ 10</span>
                        </button>
                      )}

                      <a
                        href={`https://loto.iq/sports/play?round=${currentSportsRound.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-gray-200 text-xs font-black flex items-center gap-1 cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-emerald-500" />
                        <span>فتح الجولة في loto.iq</span>
                      </a>
                    </div>
                  </div>

                  {currentSportsAnalysis?.aiSummaryAr && (
                    <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-950 dark:text-emerald-200">
                      🧠 <strong>التحليل التكتيكي الشامل للجولة:</strong>{" "}
                      {currentSportsAnalysis.aiSummaryAr}
                    </div>
                  )}

                  {/* 10 Matches Interactive Prediction List */}
                  <div className="space-y-2.5">
                    {currentSportsRound.matches.map((m, idx) => {
                      const pred = currentSportsAnalysis?.matches.find(
                        (p) => p.position === m.position
                      );
                      const selectedPick =
                        userSportsSlip[currentSportsRound.id]?.[m.position] ||
                        pred?.recommendedPick ||
                        "1";
                      const actualOutcome = Array.isArray(currentSportsRound.outcome)
                        ? currentSportsRound.outcome[idx]
                        : null;
                      const homeLogo = resolveLogoUrl(m.home.logoUrl);
                      const awayLogo = resolveLogoUrl(m.away.logoUrl);

                      return (
                        <div
                          key={m.position}
                          className="p-3.5 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200/80 dark:border-zinc-700/70 space-y-2.5"
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                            {/* Match Info & Teams */}
                            <div className="flex items-center gap-3 flex-1">
                              <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                                {m.position}
                              </span>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {homeLogo && (
                                    <img
                                      src={homeLogo}
                                      alt={m.home.nameAr}
                                      className="w-5 h-5 object-contain"
                                    />
                                  )}
                                  <span className="font-black text-xs sm:text-sm text-gray-900 dark:text-white">
                                    {m.home.nameAr}
                                  </span>
                                  <span className="text-[10px] font-black text-gray-400 px-1">
                                    ضد
                                  </span>
                                  {awayLogo && (
                                    <img
                                      src={awayLogo}
                                      alt={m.away.nameAr}
                                      className="w-5 h-5 object-contain"
                                    />
                                  )}
                                  <span className="font-black text-xs sm:text-sm text-gray-900 dark:text-white">
                                    {m.away.nameAr}
                                  </span>
                                </div>
                                <div className="text-[10px] text-gray-500 font-bold mt-0.5 flex flex-wrap items-center gap-2">
                                  <span>{m.competition?.nameAr}</span>
                                  <span>•</span>
                                  <span>
                                    {new Date(m.kickoffAt).toLocaleString("ar-IQ", {
                                      weekday: "short",
                                      month: "numeric",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                  {pred && (
                                    <span
                                      className={`px-2 py-0.2 rounded-full font-black ${
                                        pred.confidence === "banker"
                                          ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                                          : pred.confidence === "tight"
                                          ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                                          : "bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300"
                                      }`}
                                    >
                                      {pred.confidenceLabelAr}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* 1 / X / 2 Selector Buttons with Live Probabilities */}
                            <div className="grid grid-cols-3 gap-1.5 w-full lg:w-72 shrink-0">
                              {(
                                [
                                  {
                                    code: "1" as const,
                                    label: "1 (المضيف)",
                                    prob: pred?.probHome ?? 45,
                                  },
                                  {
                                    code: "X" as const,
                                    label: "X (تعادل)",
                                    prob: pred?.probDraw ?? 27,
                                  },
                                  {
                                    code: "2" as const,
                                    label: "2 (الضيف)",
                                    prob: pred?.probAway ?? 28,
                                  },
                                ] as const
                              ).map((opt) => {
                                const isPicked = selectedPick === opt.code;
                                const isAiRec = pred?.recommendedPick === opt.code;
                                const isActualWin = actualOutcome === opt.code;
                                return (
                                  <button
                                    key={opt.code}
                                    type="button"
                                    onClick={() =>
                                      setUserSportsSlip((prev) => ({
                                        ...prev,
                                        [currentSportsRound.id]: {
                                          ...(prev[currentSportsRound.id] || {}),
                                          [m.position]: opt.code,
                                        },
                                      }))
                                    }
                                    className={`py-2 px-2 rounded-xl border text-center transition cursor-pointer relative ${
                                      isActualWin
                                        ? "bg-emerald-500 border-emerald-600 text-white ring-2 ring-emerald-300"
                                        : isPicked
                                        ? "bg-indigo-600 border-indigo-600 text-white shadow"
                                        : "bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 text-gray-800 dark:text-gray-200"
                                    }`}
                                  >
                                    <div className="text-[11px] font-black">{opt.label}</div>
                                    <div
                                      className={`text-[10px] font-bold ${
                                        isPicked || isActualWin
                                          ? "text-amber-200"
                                          : "text-gray-400"
                                      }`}
                                    >
                                      {opt.prob}% {isAiRec ? "⭐" : ""}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {pred?.reasonAr && (
                            <div className="text-[11px] font-bold text-gray-600 dark:text-gray-300 pr-2 border-r-2 border-emerald-500">
                              💡 {pred.reasonAr}
                              {pred.hedgePick && (
                                <span className="text-amber-600 dark:text-amber-400 mr-2">
                                  (خيار التغطية الرديف في حال القسيمة الثانية: {pred.hedgePick})
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Save / Copy Sports Slip Footer */}
                  <div className="pt-3 border-t border-gray-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-1.5 text-[11px] font-bold text-gray-500">
                      {currentSportsRound.tiers?.map((t) => (
                        <span
                          key={t.correct}
                          className="px-2.5 py-1 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300"
                        >
                          {t.correct}/10 ← {fmt(t.amount)} د.ع
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const slip = userSportsSlip[currentSportsRound.id] || {};
                          const lines = currentSportsRound.matches.map(
                            (m) =>
                              `${m.position}. ${m.home.nameAr} × ${m.away.nameAr} 👈 [${
                                slip[m.position] || "1"
                              }]`
                          );
                          copyText(
                            "sports-slip",
                            `⚽ توقع اللوتو الرياضي (${currentSportsRound.nameAr}):\n${lines.join(
                              "\n"
                            )}`
                          );
                        }}
                        className="px-3.5 py-2 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-gray-200 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>نسخ القسيمة</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleSaveSportsSlip}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>حفظ القسيمة في بطاقاتي</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          GAME 2 & 3: LOTO 42 & LOTO 29
      ═══════════════════════════════════════════════════════════════════ */}
      {activeGame === "loto42" && renderNumberGame("loto42")}
      {activeGame === "loto29" && renderNumberGame("loto29")}

      {/* ═══════════════════════════════════════════════════════════════════
          GAME 4 & 5: SCRATCH CARDS (طابق 3 & جيب الكاس جيبه)
      ═══════════════════════════════════════════════════════════════════ */}
      {activeGame === "sc500" && renderScratchGame("SC500")}
      {activeGame === "sc1k" && renderScratchGame("SC1K")}

      {/* Recent Official Winners Strip from loto.iq */}
      {recentWinners.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-4 border border-gray-200/80 dark:border-zinc-800 space-y-2.5">
          <h4 className="text-xs font-black text-gray-800 dark:text-white flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span>آخر الفائزين الموثقين مباشرة من موقع لوتو العراق:</span>
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {recentWinners.slice(0, 8).map((w, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200/60 dark:border-zinc-700 text-xs"
              >
                <div className="font-black text-gray-900 dark:text-white">{w.name}</div>
                <div className="text-emerald-600 dark:text-emerald-400 font-black">
                  {fmt(w.prize)} د.ع
                </div>
                <div className="text-[10px] text-gray-400 font-bold">
                  سحب #{w.drawNumber} • {w.governorate}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
