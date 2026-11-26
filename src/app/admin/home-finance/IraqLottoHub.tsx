"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Sparkles, Trophy, Calendar, Ticket, Plus, CheckCircle2,
  Copy, Check, BarChart2, RotateCcw, Clock, ExternalLink,
  Search, Trash2, PenLine, Loader2, Lock, Sliders, RefreshCw,
  BrainCircuit, ShieldCheck, Zap, Layers, Award, BellRing, Flame,
  PartyPopper, Volume2, VolumeX, X, CheckCheck
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
  SportsOutcomeTier,
  ScratchCardLive,
  RecentWinnerItem,
  UserLotoTicket,
  UrgencyLevel,
  SCRATCH_SPECS,
  LOTO_42_PRIZE_TIERS,
  LOTO_29_PRIZE_TIERS,
  BASELINE_SNAPSHOT,
  BASELINE_LOTO42_DRAWS,
  BASELINE_LOTO29_DRAWS,
  BASELINE_SPORTS_ROUNDS,
  mergeDrawsDeduplicated,
  mergeSportsRoundsDeduplicated,
  fetchLiveLotoIqSnapshot,
  resolveLogoUrl,
  evaluateUserTicket,
  getMatchActualOutcome,
  computeImminentDrawAlerts,
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

function getNextOfficialDrawTimestamp(game: "loto42" | "loto29"): number {
  // Official Baghdad time (UTC+3): 20:50 = 17:50 UTC
  // Loto 42: Wednesday (3) & Saturday (6)
  // Loto 29: Monday (1) & Thursday (4)
  const targetDays = game === "loto42" ? [3, 6] : [1, 4];
  const now = new Date();
  for (let offset = 0; offset <= 7; offset++) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset, 17, 50, 0)
    );
    if (targetDays.includes(d.getUTCDay()) && d.getTime() > Date.now() + 60_000) {
      return d.getTime();
    }
  }
  return Date.now() + 3 * 86400 * 1000;
}

interface IraqLottoHubProps {
  onAddExpenseLinked?: (amount: number, description: string, date: string) => void;
}

const fmt = (n: number) => Math.round(n || 0).toLocaleString("en-US");

function formatCountdown(targetMs?: number | null, nowMs = Date.now()): string {
  if (!targetMs || targetMs <= nowMs) return "يتم السحب الآن — جاري التحديث";
  const diffSec = Math.floor((targetMs - nowMs) / 1000);
  const days = Math.floor(diffSec / 86400);
  const hours = Math.floor((diffSec % 86400) / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;
  if (days > 0) return `${days} يوم • ${hours} س • ${mins} د`;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function getTodayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// THEATRICAL WIN CELEBRATION AUDIO + ARABIC VOICE ANNOUNCER (إشعار مسرحي)
// ═══════════════════════════════════════════════════════════════════════════
function playTheatricalWinFanfare() {
  try {
    if (typeof window === "undefined") return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") ctx.resume();

    // Celebratory Fanfare Trumpet: G4 -> C5 -> E5 -> G5 -> C6
    const notes = [
      { f: 392.0, t: 0.0, d: 0.14 },
      { f: 523.25, t: 0.14, d: 0.14 },
      { f: 659.25, t: 0.28, d: 0.16 },
      { f: 783.99, t: 0.44, d: 0.22 },
      { f: 1046.5, t: 0.66, d: 0.7 },
    ];
    notes.forEach(({ f, t, d }) => {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(f, ctx.currentTime + t);
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(2200, ctx.currentTime + t);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + d);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + d + 0.05);
    });

    // Sparkling bells
    [1318.51, 1567.98, 2093.0, 2637.02].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      const start = ctx.currentTime + 0.68 + i * 0.09;
      osc.frequency.setValueAtTime(f, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.16, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.48);
    });
  } catch {
    // Ignore autoplay blocks
  }
}

function playImminentBell() {
  try {
    if (typeof window === "undefined") return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") ctx.resume();
    [880, 1174.66].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.14);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.1, ctx.currentTime + idx * 0.14 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.14 + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.14);
      osc.stop(ctx.currentTime + idx * 0.14 + 0.35);
    });
  } catch {
    // Ignore
  }
}

function speakArabicAnnouncement(text: string) {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ar-SA";
    utterance.rate = 1.02;
    utterance.pitch = 1.05;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Ignore
  }
}

const LIVE_POLL_SECONDS = 30;

export default function IraqLottoHub({ onAddExpenseLinked }: IraqLottoHubProps) {
  const [activeGame, setActiveGame] = useState<IraqLotoGameId>("loto29");
  const [numberSubView, setNumberSubView] = useState<
    "predict" | "tickets" | "history" | "stats"
  >("predict");
  const [sportsSubView, setSportsSubView] = useState<
    "active" | "finished" | "tickets"
  >("active");

  // Live loto.iq State — initialized with complete verified snapshot for 0ms instant display
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
  const [sportsRounds, setSportsRounds] = useState<SportsRound[]>(
    BASELINE_SPORTS_ROUNDS
  );
  const [scratchCards, setScratchCards] = useState<ScratchCardLive[]>(
    BASELINE_SNAPSHOT.scratchCards
  );
  const [recentWinners, setRecentWinners] = useState<RecentWinnerItem[]>(
    BASELINE_SNAPSHOT.recentWinners
  );

  const [lastSyncedAt, setLastSyncedAt] = useState<number>(BASELINE_SNAPSHOT.fetchedAt);
  const [syncSource, setSyncSource] = useState<string>("جاري الاتصال المباشر...");
  const [isSyncingLive, setIsSyncingLive] = useState<boolean>(false);
  const [nextPollSec, setNextPollSec] = useState<number>(LIVE_POLL_SECONDS);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // User Tickets, Locked Numbers, & Announced Wins
  const [tickets, setTickets] = useState<UserLotoTicket[]>([]);
  const [announcedWinIds, setAnnouncedWinIds] = useState<string[]>([]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [theatricalWinTicket, setTheatricalWinTicket] = useState<UserLotoTicket | null>(null);

  const [lockedByGame, setLockedByGame] = useState<{
    loto42: { numbers: number[]; extra: number | null; locked: boolean };
    loto29: { numbers: number[]; extra: null; locked: boolean };
  }>({
    loto42: { numbers: [], extra: null, locked: false },
    loto29: { numbers: [], extra: null, locked: false },
  });

  const [seedSalt, setSeedSalt] = useState<number>(0);
  const [aiLotoOverride, setAiLotoOverride] = useState<
    Record<string, { ticket: TicketPredictionResult; expertSummaryAr: string }>
  >({});
  const [isRunningGeminiLoto, setIsRunningGeminiLoto] = useState<boolean>(false);

  const [showCustomPicker, setShowCustomPicker] = useState<boolean>(false);
  const [recordExpenseOnSave, setRecordExpenseOnSave] = useState<boolean>(true);
  const [archiveQuery, setArchiveQuery] = useState<string>("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Manual ticket quick-entry state
  const [showManualTicketBox, setShowManualTicketBox] = useState<boolean>(false);
  const [manualNumbers, setManualNumbers] = useState<number[]>([]);
  const [manualExtra, setManualExtra] = useState<number | null>(null);
  const [manualDrawNum, setManualDrawNum] = useState<string>("");

  // Sports Loto State
  const [selectedRoundId, setSelectedRoundId] = useState<string>(
    BASELINE_SPORTS_ROUNDS[0]?.id || ""
  );
  const [userSportsSlip, setUserSportsSlip] = useState<
    Record<string, Record<number, SportsPickChoice>>
  >({});
  const [aiSportsOverrides, setAiSportsOverrides] = useState<
    Record<string, SportsRoundAnalysis>
  >({});
  const [isRunningGeminiSports, setIsRunningGeminiSports] = useState<boolean>(false);

  // Manual Official Draw Result Modal State (إدخال نتيجة السحب الرسمي يدوياً)
  const [showRecordDrawModal, setShowRecordDrawModal] = useState<boolean>(false);
  const [recordDrawGame, setRecordDrawGame] = useState<"loto42" | "loto29">("loto29");
  const [recordDrawNumber, setRecordDrawNumber] = useState<string>("");
  const [recordDrawNumbers, setRecordDrawNumbers] = useState<number[]>([]);
  const [recordDrawExtra, setRecordDrawExtra] = useState<number | null>(null);
  const [recordNextJackpot, setRecordNextJackpot] = useState<string>("");

  // Manual Scratch Card Result Entry State
  const [showScratchManualBox, setShowScratchManualBox] = useState<boolean>(false);
  const [scratchManualWinInput, setScratchManualWinInput] = useState<string>("0");

  const migratedLegacyRef = useRef<boolean>(false);
  const notifiedImminentRef = useRef<boolean>(false);
  const autoFocusedRef = useRef<boolean>(false);
  const announcedSetRef = useRef<Set<string>>(new Set());

  // Keep ref in sync with announcedWinIds
  useEffect(() => {
    announcedSetRef.current = new Set(announcedWinIds);
  }, [announcedWinIds]);

  // 1-second live countdown & next-sync ticker
  useEffect(() => {
    const t = setInterval(() => {
      setNowMs(Date.now());
      setNextPollSec((s) => (s > 1 ? s - 1 : LIVE_POLL_SECONDS));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const persistHub = useCallback(async (patch: Record<string, any>) => {
    try {
      const clean = JSON.parse(JSON.stringify(patch));
      await setDoc(doc(db, "home_finance", "iraq_lotto_hub"), clean, { merge: true });
    } catch (err) {
      console.warn("iraq_lotto_hub sync warning:", err);
    }
  }, []);

  // Trigger Theatrical Win Announcement (إشعار مسرحي كامل مع صوت وموسيقى ومقارنة الأرقام)
  const triggerTheatricalWin = useCallback(
    (winTicket: UserLotoTicket, forceReplay = false) => {
      if (!forceReplay && announcedSetRef.current.has(winTicket.id)) return;
      announcedSetRef.current.add(winTicket.id);
      const nextIds = Array.from(announcedSetRef.current);
      setAnnouncedWinIds(nextIds);
      persistHub({ announcedWinIds: nextIds });

      setTheatricalWinTicket(winTicket);
      if (soundEnabled) {
        playTheatricalWinFanfare();
        const prizeText = winTicket.prizeWon
          ? `بجائزة قدرها ${fmt(winTicket.prizeWon)} دينار عراقي`
          : "";
        speakArabicAnnouncement(
          `ألف مبروك الفوز! بطاقتك ${winTicket.title} حققت الفوز ${prizeText}. ${winTicket.prizeLabel || ""}`
        );
      }
    },
    [soundEnabled, persistHub]
  );

  // Firestore Real-time Listener
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "home_finance", "iraq_lotto_hub"),
      async (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.loto42Current?.selling) {
            setLoto42Current((prev) =>
              (data.loto42Current.selling.drawNumber || 0) >= (prev?.selling?.drawNumber || 0)
                ? data.loto42Current
                : prev
            );
          }
          if (Array.isArray(data.loto42Draws) && data.loto42Draws.length > 0) {
            setLoto42Draws((prev) =>
              mergeDrawsDeduplicated(data.loto42Draws, prev, BASELINE_LOTO42_DRAWS)
            );
          }
          if (data.loto29Current?.selling) {
            setLoto29Current((prev) =>
              (data.loto29Current.selling.drawNumber || 0) >= (prev?.selling?.drawNumber || 0)
                ? data.loto29Current
                : prev
            );
          }
          if (Array.isArray(data.loto29Draws) && data.loto29Draws.length > 0) {
            setLoto29Draws((prev) =>
              mergeDrawsDeduplicated(data.loto29Draws, prev, BASELINE_LOTO29_DRAWS)
            );
          }
          if (Array.isArray(data.sportsRounds) && data.sportsRounds.length > 0) {
            setSportsRounds((prev) =>
              mergeSportsRoundsDeduplicated(data.sportsRounds, prev, BASELINE_SPORTS_ROUNDS)
            );
          }
          if (Array.isArray(data.scratchCards) && data.scratchCards.length > 0) {
            setScratchCards(data.scratchCards);
          }
          if (Array.isArray(data.recentWinners) && data.recentWinners.length > 0) {
            setRecentWinners(data.recentWinners);
          }
          if (data.lastSyncedAt && Number(data.lastSyncedAt) > lastSyncedAt) {
            setLastSyncedAt(Number(data.lastSyncedAt));
          }
          if (Array.isArray(data.announcedWinIds)) {
            setAnnouncedWinIds(data.announcedWinIds);
          }
          if (Array.isArray(data.tickets)) setTickets(data.tickets);
          if (data.lockedByGame) setLockedByGame(data.lockedByGame);
        } else if (!migratedLegacyRef.current) {
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
            // Ignore
          }
        }
      },
      (err) => console.warn("iraq_lotto_hub snapshot error:", err)
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistHub]);

  // Audit & Match ALL Tickets against Official Draws + Trigger Theatrical Win Alert!
  const runTicketsAudit = useCallback(
    (
      curTickets: UserLotoTicket[],
      draws42: LotoDrawOfficial[],
      draws29: LotoDrawOfficial[],
      rounds: SportsRound[],
      announceToast = false
    ): UserLotoTicket[] => {
      let newlyWon: UserLotoTicket | null = null;
      let changed = false;

      const audited = curTickets.map((t) => {
        const next = evaluateUserTicket(t, draws42, draws29, rounds);
        if (
          next.status !== t.status ||
          next.prizeWon !== t.prizeWon ||
          next.prizeLabel !== t.prizeLabel
        ) {
          changed = true;
        }
        if (next.status === "won" && !announcedSetRef.current.has(next.id)) {
          newlyWon = next;
        }
        return next;
      });

      if (changed) {
        persistHub({ tickets: audited });
      }

      if (newlyWon) {
        triggerTheatricalWin(newlyWon, false);
      } else if (announceToast) {
        const wonCnt = audited.filter((t) => t.status === "won").length;
        if (wonCnt > 0) {
          toast.success(`تمت المطابقة! لديك ${wonCnt} بطاقة رابحة — اضغط "عرض الإعلان المسرحي 🎉" للاحتفال.`);
        } else {
          toast.info("تمت مطابقة جميع بطاقاتك مع آخر سحب رسمي محدث من loto.iq ✅");
        }
      }

      return audited;
    },
    [persistHub, triggerTheatricalWin]
  );

  // Moment-by-Moment Live Sync from https://loto.iq/ (every 30s + on tab focus + manual button!)
  const triggerLiveSync = useCallback(
    async (silent = false) => {
      setIsSyncingLive(true);
      setNextPollSec(LIVE_POLL_SECONDS);
      try {
        const live = await fetchLiveLotoIqSnapshot();
        if (!live) {
          setSyncSource("بيانات موثقة محفوظة");
          if (!silent) {
            toast.info("يتم عرض أحدث سحوبات وجولات موثقة من loto.iq.");
          }
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
        const mergedSports = mergeSportsRoundsDeduplicated(
          live.sportsRounds,
          sportsRounds,
          BASELINE_SPORTS_ROUNDS
        );

        if (live.loto42Current?.selling) setLoto42Current(live.loto42Current);
        setLoto42Draws(merged42);

        if (live.loto29Current?.selling) setLoto29Current(live.loto29Current);
        setLoto29Draws(merged29);

        setSportsRounds(mergedSports);
        if (live.scratchCards.length > 0) setScratchCards(live.scratchCards);
        if (live.recentWinners.length > 0) setRecentWinners(live.recentWinners);

        setLastSyncedAt(live.fetchedAt);
        setSyncSource("مباشر لحظة بلحظة من loto.iq");

        // Auto-match every saved ticket against newly arrived official results!
        setTickets((prevTickets) => {
          if (prevTickets.length === 0) return prevTickets;
          return runTicketsAudit(prevTickets, merged42, merged29, mergedSports, false);
        });

        await persistHub({
          lastSyncedAt: live.fetchedAt,
          loto42Current: live.loto42Current || loto42Current,
          loto42Draws: merged42.slice(0, 60),
          loto29Current: live.loto29Current || loto29Current,
          loto29Draws: merged29.slice(0, 80),
          sportsRounds: mergedSports,
          scratchCards: live.scratchCards.length > 0 ? live.scratchCards : scratchCards,
          recentWinners:
            live.recentWinners.length > 0
              ? live.recentWinners.slice(0, 15)
              : recentWinners,
        });

        if (!silent) {
          toast.success("تم التحديث اللحظي ومطابقة السحوبات مع بطاقاتك بنجاح! ✅");
        }
      } finally {
        setIsSyncingLive(false);
      }
    },
    [
      loto42Draws,
      loto29Draws,
      sportsRounds,
      loto42Current,
      loto29Current,
      scratchCards,
      recentWinners,
      persistHub,
      runTicketsAudit,
    ]
  );

  // Poll every 30s + sync immediately when user returns to the tab!
  useEffect(() => {
    triggerLiveSync(true);
    const interval = setInterval(() => {
      triggerLiveSync(true);
    }, LIVE_POLL_SECONDS * 1000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        triggerLiveSync(true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-evaluate tickets whenever draws/rounds or tickets change
  useEffect(() => {
    if (tickets.length === 0) return;
    const hasPending = tickets.some((t) => t.status === "pending");
    if (!hasPending) return;
    const evaluated = runTicketsAudit(tickets, loto42Draws, loto29Draws, sportsRounds, false);
    const changed = evaluated.some((ev, i) => ev.status !== tickets[i]?.status);
    if (changed) setTickets(evaluated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loto42Draws, loto29Draws, sportsRounds]);

  // Imminent Draws & Rounds Detector
  const allUpcomingAlerts = useMemo(
    () =>
      computeImminentDrawAlerts(loto42Current, loto29Current, sportsRounds, nowMs),
    [loto42Current, loto29Current, sportsRounds, nowMs]
  );

  const imminentAlerts = useMemo(
    () => allUpcomingAlerts.filter((a) => a.urgency === "critical" || a.urgency === "soon"),
    [allUpcomingAlerts]
  );

  const urgencyByGame = useMemo(() => {
    const map: Partial<
      Record<
        IraqLotoGameId,
        {
          urgency: UrgencyLevel;
          remainingMs: number;
          closesAtMs: number;
          roundId?: string;
          label: string;
        }
      >
    > = {};
    for (const a of allUpcomingAlerts) {
      if (!map[a.game] || a.remainingMs < map[a.game]!.remainingMs) {
        map[a.game] = {
          urgency: a.urgency,
          remainingMs: a.remainingMs,
          closesAtMs: a.closesAtMs,
          roundId: a.roundId,
          label: a.titleAr,
        };
      }
    }
    return map;
  }, [allUpcomingAlerts]);

  // Auto-select nearest upcoming game on open + alert user!
  useEffect(() => {
    if (allUpcomingAlerts.length === 0) return;
    const nearest = allUpcomingAlerts[0];

    if (!autoFocusedRef.current) {
      autoFocusedRef.current = true;
      setActiveGame(nearest.game);
      if (nearest.game === "sports" && nearest.roundId) {
        setSportsSubView("active");
        setSelectedRoundId(nearest.roundId);
      }
    }

    if (
      !notifiedImminentRef.current &&
      (nearest.urgency === "critical" || nearest.urgency === "soon")
    ) {
      notifiedImminentRef.current = true;
      if (soundEnabled) playImminentBell();
      toast.warning(
        `🔔 تنبيه سحب قريب: ${nearest.titleAr} يغلق خلال ${formatCountdown(
          nearest.closesAtMs
        )} — هاي استعملها الآن!`,
        {
          duration: 8000,
          action: {
            label: "استعملها الآن 🎯",
            onClick: () => {
              setActiveGame(nearest.game);
              if (nearest.game === "sports" && nearest.roundId) {
                setSportsSubView("active");
                setSelectedRoundId(nearest.roundId);
              } else {
                setNumberSubView("predict");
              }
            },
          },
        }
      );
    }
  }, [allUpcomingAlerts, soundEnabled]);

  const openSportsRounds = useMemo(
    () =>
      sportsRounds
        .filter((r) => r.status === "open")
        .sort((a, b) => a.closesAt - b.closesAt),
    [sportsRounds]
  );
  const finishedSportsRounds = useMemo(
    () =>
      sportsRounds
        .filter((r) => r.status !== "open")
        .sort((a, b) => b.closesAt - a.closesAt),
    [sportsRounds]
  );

  useEffect(() => {
    const pool = sportsSubView === "finished" ? finishedSportsRounds : openSportsRounds;
    if (pool.length > 0 && !pool.some((r) => r.id === selectedRoundId)) {
      setSelectedRoundId(pool[0].id);
    }
  }, [openSportsRounds, finishedSportsRounds, sportsSubView, selectedRoundId]);

  const currentSportsRound = useMemo(() => {
    const pool = sportsSubView === "finished" ? finishedSportsRounds : openSportsRounds;
    return pool.find((r) => r.id === selectedRoundId) || pool[0] || sportsRounds[0] || null;
  }, [sportsRounds, openSportsRounds, finishedSportsRounds, sportsSubView, selectedRoundId]);

  // Predictions
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

  const currentSportsAnalysis = useMemo(() => {
    if (!currentSportsRound) return null;
    if (aiSportsOverrides[currentSportsRound.id]) {
      return aiSportsOverrides[currentSportsRound.id];
    }
    return predictSportsRoundQuant(currentSportsRound, sportsRounds);
  }, [currentSportsRound, sportsRounds, aiSportsOverrides]);

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

  const sc500Report = useMemo(() => analyzeScratchCard("SC500", scratchCards), [scratchCards]);
  const sc1kReport = useMemo(() => analyzeScratchCard("SC1K", scratchCards), [scratchCards]);

  const copyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("تم نسخ الأرقام بنجاح 📋");
    setTimeout(() => setCopiedKey(null), 2000);
  };

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
        toast.success("تم استنتاج أفضل توليفة بالذكاء الخارق Gemini بنجاح! 🧠✨");
      } else {
        toast.error("تعذر الاتصال بـ Gemini حالياً — التوليفة الذهبية المحسوبة جاهزة.");
      }
    } finally {
      setIsRunningGeminiLoto(false);
    }
  };

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
        const updatedSlip: Record<number, SportsPickChoice> = {};
        aiRes.matches.forEach((m) => {
          updatedSlip[m.position] = m.recommendedPick;
        });
        setUserSportsSlip((prev) => ({ ...prev, [currentSportsRound.id]: updatedSlip }));
        toast.success("تم تحليل المباريات الـ 10 وتحديث الاختيارات بالذكاء الخارق! ⚽🧠");
      } else {
        toast.error("تعذر استدعاء Gemini حالياً — تم اعتماد التحليل الرياضي المباشر.");
      }
    } finally {
      setIsRunningGeminiSports(false);
    }
  };

  const handleSaveNumberTicket = async (
    gameKey: "loto42" | "loto29",
    nums: number[],
    extra: number | null,
    forcedDrawNumber?: number
  ) => {
    if (nums.length !== 6) {
      toast.error("يجب أن تتكون البطاقة من 6 أرقام كاملة.");
      return;
    }
    const currentInfo = gameKey === "loto42" ? loto42Current?.selling : loto29Current?.selling;
    const price = currentInfo?.price || (gameKey === "loto42" ? 2000 : 1500);
    const targetDrawNum =
      forcedDrawNumber ||
      currentInfo?.drawNumber ||
      ((gameKey === "loto42" ? loto42Draws[0]?.drawNumber : loto29Draws[0]?.drawNumber) || 0) + 1;
    const drawDate = currentInfo?.drawAt
      ? new Date(currentInfo.drawAt).toISOString().split("T")[0]
      : getTodayIso();

    const newTkt: UserLotoTicket = evaluateUserTicket(
      {
        id: `tkt-${Date.now()}`,
        game: gameKey,
        title: `${gameKey === "loto42" ? "بطاقة لوتو 42" : "بطاقة لوتو 29"} — سحب #${targetDrawNum}`,
        createdAt: new Date().toISOString(),
        cost: price,
        status: "pending",
        drawNumber: targetDrawNum,
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

    if (newTkt.status === "won") {
      triggerTheatricalWin(newTkt, true);
    } else {
      toast.success(`تم حفظ ${newTkt.title} وسيتم إشعارك مسرحياً فور ظهور النتيجة! 🎫`);
    }
  };

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

    if (newTkt.status === "won") {
      triggerTheatricalWin(newTkt, true);
    } else {
      toast.success("تم حفظ قسيمة اللوتو الرياضي وستتم مطابقتها تلقائياً مع النتائج! ⚽🎫");
    }
  };

  const handleDeleteTicket = async (id: string) => {
    const updated = tickets.filter((t) => t.id !== id);
    setTickets(updated);
    await persistHub({ tickets: updated });
    toast.success("تم حذف البطاقة من السجل");
  };

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

  const openRecordDrawModal = (game: "loto42" | "loto29") => {
    const curOpenNum =
      game === "loto42"
        ? loto42Current?.selling?.drawNumber || (loto42Draws[0]?.drawNumber || 39) + 1
        : loto29Current?.selling?.drawNumber || (loto29Draws[0]?.drawNumber || 432) + 1;
    setRecordDrawGame(game);
    setRecordDrawNumber(String(curOpenNum));
    setRecordDrawNumbers([]);
    setRecordDrawExtra(null);
    setRecordNextJackpot("");
    setShowRecordDrawModal(true);
  };

  const handleSaveOfficialDrawManual = async () => {
    const drawNum = Number(recordDrawNumber);
    if (!drawNum || drawNum <= 0) {
      toast.error("يرجى إدخال رقم السحب الصحيح.");
      return;
    }
    if (recordDrawNumbers.length !== 6) {
      toast.error("يرجى اختيار 6 أرقام فائزة بالضبط.");
      return;
    }
    if (recordDrawGame === "loto42" && !recordDrawExtra) {
      toast.error("يرجى اختيار الرقم الإضافي لسحب لوتو 42.");
      return;
    }

    const sortedNums = [...recordDrawNumbers].sort((a, b) => a - b);
    const is42 = recordDrawGame === "loto42";
    const gameCode: "42_PLUS_1" | "6_29" = is42 ? "42_PLUS_1" : "6_29";
    const defaultPrice = is42 ? 2000 : 1500;
    const prevSelling = is42 ? loto42Current?.selling : loto29Current?.selling;
    const defaultJackpot = is42 ? 101_696_960 : 117_153_024;

    const newOfficialDraw: LotoDrawOfficial = {
      id: `manual-${recordDrawGame}-${drawNum}-${Date.now()}`,
      gameCode,
      drawNumber: drawNum,
      status: "finalized",
      price: prevSelling?.price || defaultPrice,
      jackpot: prevSelling?.jackpot || defaultJackpot,
      miniJackpot: is42 ? (prevSelling?.miniJackpot ?? 16_839_884) : null,
      winningNumbers: sortedNums,
      extraNumber: is42 ? recordDrawExtra : null,
      drawAt: Date.now(),
    };

    const nextDrawTs = getNextOfficialDrawTimestamp(recordDrawGame);
    const parsedJackpot = Number(recordNextJackpot.replace(/[^\d]/g, ""));
    const nextSelling: LotoDrawOfficial = {
      id: `manual-selling-${recordDrawGame}-${drawNum + 1}`,
      gameCode,
      drawNumber: drawNum + 1,
      status: "selling",
      price: prevSelling?.price || defaultPrice,
      jackpot: parsedJackpot > 0 ? parsedJackpot : prevSelling?.jackpot || defaultJackpot,
      miniJackpot: is42 ? (prevSelling?.miniJackpot ?? 16_839_884) : null,
      winningNumbers: null,
      extraNumber: null,
      drawAt: nextDrawTs,
      salesCloseAt: nextDrawTs,
    };

    let next42Draws = loto42Draws;
    let next29Draws = loto29Draws;
    const patch: Record<string, any> = { lastSyncedAt: Date.now() };

    if (is42) {
      next42Draws = mergeDrawsDeduplicated([newOfficialDraw], loto42Draws, BASELINE_LOTO42_DRAWS);
      setLoto42Draws(next42Draws);
      patch.loto42Draws = next42Draws;

      if (drawNum >= (loto42Current?.selling?.drawNumber || 0)) {
        const nextCurrent: LotoCurrentState = {
          selling: nextSelling,
          awaiting: null,
        };
        setLoto42Current(nextCurrent);
        patch.loto42Current = nextCurrent;
      }
    } else {
      next29Draws = mergeDrawsDeduplicated([newOfficialDraw], loto29Draws, BASELINE_LOTO29_DRAWS);
      setLoto29Draws(next29Draws);
      patch.loto29Draws = next29Draws;

      if (drawNum >= (loto29Current?.selling?.drawNumber || 0)) {
        const nextCurrent: LotoCurrentState = {
          selling: nextSelling,
          awaiting: null,
        };
        setLoto29Current(nextCurrent);
        patch.loto29Current = nextCurrent;
      }
    }

    const auditedTickets = runTicketsAudit(tickets, next42Draws, next29Draws, sportsRounds, true);
    setTickets(auditedTickets);
    patch.tickets = auditedTickets;

    setLastSyncedAt(Date.now());
    setSyncSource("تحديث يدوي موثّق");
    await persistHub(patch);

    setShowRecordDrawModal(false);
    toast.success(
      `تم تسجيل نتيجة ${recordDrawGame === "loto42" ? "لوتو 42" : "لوتو 29"} سحب #${drawNum} ومطابقة بطاقاتك فوراً ✅`
    );
  };

  const handleSaveScratchManual = async (gameId: "sc500" | "sc1k") => {
    const spec = gameId === "sc500" ? SCRATCH_SPECS.SC500 : SCRATCH_SPECS.SC1K;
    const winAmt = Math.max(0, Number(scratchManualWinInput.replace(/[^\d]/g, "")) || 0);
    const newTkt: UserLotoTicket = {
      id: `scr-${Date.now()}`,
      game: gameId,
      title: `بطاقة ${spec.nameAr} (تسجيل يدوي)`,
      createdAt: new Date().toISOString(),
      cost: spec.price,
      status: winAmt > 0 ? "won" : "lost",
      prizeWon: winAmt,
      prizeLabel:
        winAmt > 0
          ? `مبروك! بطاقة رابحة بمبلغ ${fmt(winAmt)} د.ع 🎉`
          : "لم تربح هذه البطاقة",
    };
    const updated = [newTkt, ...tickets];
    setTickets(updated);
    await persistHub({ tickets: updated });

    if (recordExpenseOnSave && onAddExpenseLinked) {
      onAddExpenseLinked(spec.price, `شراء بطاقة ${spec.nameAr}`, getTodayIso());
    }

    setShowScratchManualBox(false);
    setScratchManualWinInput("0");

    if (winAmt > 0) {
      triggerTheatricalWin(newTkt, true);
    } else {
      toast.info(`تم تسجيل بطاقة ${spec.nameAr} في سجلك.`);
    }
  };

  const ticketSummary = useMemo(() => {
    const totalSpent = tickets.reduce((s, t) => s + (Number(t.cost) || 0), 0);
    const totalWon = tickets.reduce((s, t) => s + (Number(t.prizeWon) || 0), 0);
    const wonCount = tickets.filter((t) => t.status === "won").length;
    const pendingCount = tickets.filter((t) => t.status === "pending").length;
    return { totalSpent, totalWon, wonCount, pendingCount };
  }, [tickets]);

  // 5 Game Cards DYNAMICALLY SORTED BY NEAREST UPCOMING DRAW ("تظهر حسب القريبة السحب مالتها")!
  const SORTED_GAME_CARDS = useMemo(() => {
    const raw: {
      id: IraqLotoGameId;
      title: string;
      shortDesc: string;
      emoji: string;
      badge: string;
      jackpotText: string;
      priceText: string;
      selectedGradient: string;
      sortOrderMs: number;
    }[] = [
      {
        id: "loto29",
        title: "لوتو 29",
        shortDesc: "6 أرقام من 29 • سحب الاثنين والخميس",
        emoji: "🔴",
        badge: `سحب #${loto29Current?.selling?.drawNumber || 432}`,
        jackpotText: `${fmt(loto29Current?.selling?.jackpot || 116_955_342)} د.ع`,
        priceText: `${fmt(loto29Current?.selling?.price || 1500)} د.ع`,
        selectedGradient: "from-rose-600 to-pink-700",
        sortOrderMs: urgencyByGame.loto29?.remainingMs ?? Number.MAX_SAFE_INTEGER - 200,
      },
      {
        id: "loto42",
        title: "لوتو 42",
        shortDesc: "6 أرقام من 42 + إضافي • السبت والأربعاء",
        emoji: "🟣",
        badge: `سحب #${loto42Current?.selling?.drawNumber || 40}`,
        jackpotText: `${fmt(loto42Current?.selling?.jackpot || 101_696_960)} د.ع`,
        priceText: `${fmt(loto42Current?.selling?.price || 2000)} د.ع`,
        selectedGradient: "from-purple-600 to-indigo-700",
        sortOrderMs: urgencyByGame.loto42?.remainingMs ?? Number.MAX_SAFE_INTEGER - 150,
      },
      {
        id: "sports",
        title: "اللوتو الرياضي",
        shortDesc: "توقع 10 مباريات • فوز يبدأ من 7/10",
        emoji: "⚽",
        badge: `${openSportsRounds.length} جولات مفتوحة`,
        jackpotText: `${fmt(openSportsRounds[0]?.jackpot || 5_000_000)} د.ع`,
        priceText: "5,000 د.ع",
        selectedGradient: "from-emerald-600 to-teal-700",
        sortOrderMs: urgencyByGame.sports?.remainingMs ?? Number.MAX_SAFE_INTEGER - 100,
      },
      {
        id: "sc1k",
        title: "جيب الكاس جيبه",
        shortDesc: "كشط فوري • طابق الأرقام الرابحة",
        emoji: "🏆",
        badge: `متبقي كبرى: ${sc1kReport.topRemaining}`,
        jackpotText: `${fmt(sc1kReport.topPrize)} د.ع`,
        priceText: `${fmt(sc1kReport.price)} د.ع`,
        selectedGradient: "from-yellow-500 to-amber-600",
        sortOrderMs: Number.MAX_SAFE_INTEGER - 2,
      },
      {
        id: "sc500",
        title: "طابق 3",
        shortDesc: "كشط فوري • طابق 3 مبالغ متشابهة",
        emoji: "🎫",
        badge: `متبقي كبرى: ${sc500Report.topRemaining}`,
        jackpotText: `${fmt(sc500Report.topPrize)} د.ع`,
        priceText: `${fmt(sc500Report.price)} د.ع`,
        selectedGradient: "from-amber-500 to-orange-600",
        sortOrderMs: Number.MAX_SAFE_INTEGER - 1,
      },
    ];
    return raw.sort((a, b) => a.sortOrderMs - b.sortOrderMs);
  }, [loto29Current, loto42Current, openSportsRounds, sc1kReport, sc500Report, urgencyByGame]);

  // Shared Tickets & Draw-Matching Panel
  const renderTicketsPanel = (filterGame?: IraqLotoGameId) => {
    const list = filterGame ? tickets.filter((t) => t.game === filterGame) : tickets;
    const isNumberGame = filterGame === "loto42" || filterGame === "loto29";
    const maxN = filterGame === "loto29" ? 29 : 42;

    return (
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-4 sm:p-5 border border-gray-200/80 dark:border-zinc-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-black text-base text-gray-900 dark:text-white flex items-center gap-2">
              <Ticket className="w-5 h-5 text-indigo-500" />
              <span>بطاقاتي المشتراة ومطابقة الفوز التلقائية ({list.length})</span>
            </h3>
            <p className="text-xs text-gray-500 font-bold mt-0.5">
              إجمالي الشراء: <strong>{fmt(ticketSummary.totalSpent)} د.ع</strong> • إجمالي الجوائز:{" "}
              <strong className="text-emerald-600">{fmt(ticketSummary.totalWon)} د.ع</strong> ({ticketSummary.wonCount} رابحة)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const audited = runTicketsAudit(
                  tickets,
                  loto42Draws,
                  loto29Draws,
                  sportsRounds,
                  true
                );
                setTickets(audited);
              }}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <CheckCheck className="w-4 h-4" />
              <span>طابق كل بطاقاتي مع السحب الآن</span>
            </button>

            {isNumberGame && (
              <button
                type="button"
                onClick={() => {
                  setManualNumbers([]);
                  setManualExtra(null);
                  setManualDrawNum("");
                  setShowManualTicketBox((v) => !v);
                }}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>أضف بطاقة اشتريتها يدوياً</span>
              </button>
            )}

            {isNumberGame && (
              <button
                type="button"
                onClick={() => openRecordDrawModal(filterGame)}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <PenLine className="w-3.5 h-3.5" />
                <span>تسجيل نتيجة السحب الرسمي يدوياً</span>
              </button>
            )}
          </div>
        </div>

        {/* Manual Ticket Entry Box */}
        {isNumberGame && showManualTicketBox && (
          <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border-2 border-indigo-200 dark:border-indigo-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-black text-indigo-900 dark:text-indigo-200">
                ✍️ اختر الـ 6 أرقام الموجودة في بطاقتك ({manualNumbers.length} / 6):
              </span>
              <input
                type="number"
                value={manualDrawNum}
                onChange={(e) => setManualDrawNum(e.target.value)}
                placeholder="رقم السحب (اختياري، مثلاً 432)"
                className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-xl px-3 py-1.5 text-xs font-bold w-48"
              />
            </div>

            <div className="grid grid-cols-7 sm:grid-cols-11 gap-1.5" dir="ltr">
              {Array.from({ length: maxN }, (_, i) => i + 1).map((n) => {
                const picked = manualNumbers.includes(n);
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      if (picked) setManualNumbers((p) => p.filter((x) => x !== n));
                      else if (manualNumbers.length < 6)
                        setManualNumbers((p) => [...p, n].sort((a, b) => a - b));
                    }}
                    className={`h-9 rounded-xl font-black text-xs border cursor-pointer transition ${
                      picked
                        ? "bg-indigo-600 text-white border-indigo-700 shadow"
                        : "bg-white dark:bg-zinc-800 text-gray-800 dark:text-white border-gray-200 dark:border-zinc-700"
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>

            {filterGame === "loto42" && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] font-black text-indigo-800 dark:text-indigo-200">
                  الرقم الإضافي (اختياري):
                </span>
                <input
                  type="number"
                  min={1}
                  max={42}
                  value={manualExtra ?? ""}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setManualExtra(v >= 1 && v <= 42 ? v : null);
                  }}
                  placeholder="1 - 42"
                  className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-xl px-2.5 py-1 text-xs font-bold w-24"
                />
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-1">
              <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={recordExpenseOnSave}
                  onChange={(e) => setRecordExpenseOnSave(e.target.checked)}
                  className="rounded accent-rose-500"
                />
                <span>تسجيل سعر البطاقة تلقائياً في المصاريف</span>
              </label>

              <button
                type="button"
                disabled={manualNumbers.length !== 6}
                onClick={async () => {
                  await handleSaveNumberTicket(
                    filterGame,
                    manualNumbers,
                    manualExtra,
                    manualDrawNum ? Number(manualDrawNum) : undefined
                  );
                  setShowManualTicketBox(false);
                  setManualNumbers([]);
                  setManualExtra(null);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-black cursor-pointer"
              >
                حفظ ومطابقة فوراً ✅
              </button>
            </div>
          </div>
        )}

        {list.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-gray-50 dark:bg-zinc-800/40 border border-dashed border-gray-200 dark:border-zinc-700">
            <p className="text-sm font-black text-gray-600 dark:text-gray-300">
              لا توجد بطاقات مسجلة هنا بعد.
            </p>
            <p className="text-xs font-bold text-gray-400 mt-1">
              اضغط «اعتماد وحفظ في بطاقاتي» من التنبؤ الذكي أو أضف بطاقتك يدوياً ليطابقها النظام تلقائياً ويعلن الفوز بإشعار مسرحي!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {list.map((t) => {
              const matchedDraw =
                t.game === "loto42"
                  ? loto42Draws.find((d) => d.drawNumber === t.drawNumber)
                  : t.game === "loto29"
                  ? loto29Draws.find((d) => d.drawNumber === t.drawNumber)
                  : undefined;

              return (
                <div
                  key={t.id}
                  className={`p-4 rounded-2xl border-2 flex flex-col gap-2.5 ${
                    t.status === "won"
                      ? "bg-gradient-to-br from-emerald-50 to-amber-50/70 dark:from-emerald-950/40 dark:to-amber-950/20 border-emerald-400 shadow-md"
                      : t.status === "lost"
                      ? "bg-gray-50 dark:bg-zinc-800/40 border-gray-200 dark:border-zinc-800"
                      : "bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-sm font-black text-gray-900 dark:text-white block">
                        {t.title}
                      </span>
                      <span className="text-[11px] text-gray-500 font-bold">
                        السعر: {fmt(t.cost)} د.ع •{" "}
                        {new Date(t.createdAt).toLocaleDateString("ar-IQ")}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[11px] font-black px-2.5 py-0.5 rounded-full ${
                          t.status === "won"
                            ? "bg-emerald-600 text-white animate-pulse"
                            : t.status === "lost"
                            ? "bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-gray-300"
                            : "bg-amber-500 text-white"
                        }`}
                      >
                        {t.status === "won"
                          ? `🎉 فائزة (${fmt(t.prizeWon || 0)} د.ع)`
                          : t.status === "lost"
                          ? "تمت المطابقة"
                          : "⏳ بانتظار السحب"}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteTicket(t.id)}
                        className="p-1 text-gray-400 hover:text-rose-500 transition cursor-pointer"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* User Ticket Balls */}
                  {t.numbers && t.numbers.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-black text-gray-500 block">
                        أرقام بطاقتك (الأخضر = مطابق للسحب الرسمي):
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap" dir="ltr">
                        {t.numbers.map((n) => {
                          const hit = t.matchedNumbers?.includes(n);
                          return (
                            <span
                              key={n}
                              className={`w-8 h-8 rounded-xl text-xs font-black flex items-center justify-center ${
                                hit
                                  ? "bg-emerald-500 text-white ring-2 ring-emerald-300 shadow"
                                  : "bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 text-gray-800 dark:text-white"
                              }`}
                            >
                              {n}
                            </span>
                          );
                        })}
                        {t.extraNumber && (
                          <span
                            className={`w-8 h-8 rounded-xl text-xs font-black flex items-center justify-center ${
                              t.extraMatched
                                ? "bg-amber-400 text-slate-950 ring-2 ring-amber-200 shadow"
                                : "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200"
                            }`}
                          >
                            +{t.extraNumber}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Official Draw Numbers Comparison if finalized */}
                  {matchedDraw && Array.isArray(matchedDraw.winningNumbers) && (
                    <div className="pt-2 border-t border-gray-200/70 dark:border-zinc-700/70">
                      <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 block mb-1">
                        نتيجة السحب الرسمي #{matchedDraw.drawNumber}:
                      </span>
                      <div className="flex items-center gap-1 flex-wrap" dir="ltr">
                        {matchedDraw.winningNumbers.map((w) => (
                          <span
                            key={w}
                            className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-200 text-xs font-black flex items-center justify-center"
                          >
                            {w}
                          </span>
                        ))}
                        {matchedDraw.extraNumber && (
                          <span className="w-7 h-7 rounded-lg bg-amber-300 text-slate-950 text-xs font-black flex items-center justify-center">
                            +{matchedDraw.extraNumber}
                          </span>
                        )}
                      </div>
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
                    <div className="text-xs font-black text-gray-800 dark:text-gray-200">
                      {t.prizeLabel}
                    </div>
                  )}

                  {t.status === "won" && (
                    <button
                      type="button"
                      onClick={() => triggerTheatricalWin(t, true)}
                      className="w-full py-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow cursor-pointer"
                    >
                      <PartyPopper className="w-4 h-4" />
                      <span>عرض إعلان الفوز المسرحي 🎉</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Number Game Renderer (Loto 42 & Loto 29) — Clean, Clear Arabic Hierarchy
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
    const gameUrgency = urgencyByGame[gameKey];

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
        {/* Clear Summary Banner for Selected Game */}
        <div
          className={`rounded-3xl p-5 text-white shadow-xl border ${
            gameUrgency?.urgency === "critical"
              ? "bg-gradient-to-br from-amber-600 via-rose-700 to-purple-950 border-amber-300 ring-2 ring-amber-400/70"
              : is42
              ? "bg-gradient-to-br from-purple-950 via-indigo-950 to-slate-950 border-white/10"
              : "bg-gradient-to-br from-rose-950 via-pink-950 to-slate-950 border-white/10"
          }`}
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-white/15 text-amber-300 text-xs font-black">
                  {is42 ? "🟣 لوتو 42 (6 أرقام من 1–42)" : "🔴 لوتو 29 (6 أرقام من 1–29)"}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/25 text-emerald-200 text-xs font-black">
                  السحب القادم #{currentObj?.drawNumber || (latestDraw?.drawNumber || 0) + 1}
                </span>
                {gameUrgency && (gameUrgency.urgency === "critical" || gameUrgency.urgency === "soon") && (
                  <span className="px-3 py-1 rounded-full bg-amber-400 text-slate-950 text-xs font-black animate-pulse">
                    🔥 سحب قريب — استعمل هذه اللعبة الآن
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-baseline gap-4">
                <div>
                  <span className="text-xs text-white/75 font-bold block">الجائزة الكبرى الآن:</span>
                  <span className="text-3xl sm:text-4xl font-black text-amber-300">
                    {fmt(currentObj?.jackpot || (is42 ? 101_696_960 : 116_955_342))}{" "}
                    <span className="text-sm font-bold text-white/85">د.ع</span>
                  </span>
                </div>
                {is42 && currentObj?.miniJackpot && (
                  <div className="bg-white/10 rounded-2xl px-3.5 py-2">
                    <span className="text-[11px] text-purple-200 font-bold block">الجائزة الثانية (5 + الإضافي)</span>
                    <span className="text-base font-black text-white">{fmt(currentObj.miniJackpot)} د.ع</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-2">
              <div className="bg-black/35 backdrop-blur-md rounded-2xl px-4 py-2.5 border border-white/20 text-center sm:text-right">
                <div className="text-[11px] text-amber-200 font-bold flex items-center gap-1.5 justify-center sm:justify-start">
                  <Clock className="w-3.5 h-3.5" />
                  <span>الوقت المتبقي لإغلاق السحب:</span>
                </div>
                <div className="text-xl font-black text-white font-mono mt-0.5" dir="ltr">
                  {formatCountdown(currentObj?.salesCloseAt || currentObj?.drawAt, nowMs)}
                </div>
              </div>

              <button
                type="button"
                onClick={() => openRecordDrawModal(gameKey)}
                className="px-4 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 shadow-lg cursor-pointer transition"
              >
                <PenLine className="w-3.5 h-3.5" />
                <span>سجّل نتيجة سحب #{currentObj?.drawNumber || (latestDraw?.drawNumber || 0) + 1} يدوياً</span>
              </button>

              <a
                href={is42 ? "https://loto.iq/play" : "https://loto.iq/29/play"}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-black flex items-center justify-center gap-1.5 border border-white/25 transition"
              >
                <ExternalLink className="w-3.5 h-3.5 text-amber-300" />
                <span>الذهاب للشراء في موقع loto.iq</span>
              </a>
            </div>
          </div>

          {latestDraw && Array.isArray(latestDraw.winningNumbers) && (
            <div className="mt-4 pt-3.5 border-t border-white/15 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black text-emerald-300">
                  🏆 آخر سحب فائز (#{latestDraw.drawNumber} — {new Date(latestDraw.drawAt).toLocaleDateString("ar-IQ")}):
                </span>
                <div className="flex items-center gap-1.5 flex-wrap" dir="ltr">
                  {latestDraw.winningNumbers.map((n) => (
                    <span
                      key={n}
                      className="w-8 h-8 rounded-xl bg-white text-slate-900 font-black text-sm flex items-center justify-center shadow"
                    >
                      {n}
                    </span>
                  ))}
                  {is42 && latestDraw.extraNumber && (
                    <>
                      <span className="text-amber-300 font-black text-xs">+</span>
                      <span className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center shadow">
                        {latestDraw.extraNumber}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <span className="text-xs text-white/80 font-bold">
                مبني على تحليل {portfolioObj.stats.totalDraws} سحبة رسمية
              </span>
            </div>
          )}
        </div>

        {/* 4 Clear Sub-Tabs */}
        <div role="tablist" aria-label="أقسام لعبة الأرقام" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { id: "predict", label: "🎯 التنبؤ والأرقام المقترحة", count: 3 },
            { id: "tickets", label: "🎫 بطاقاتي ومطابقة الفوز", count: gameTickets.length },
            { id: "history", label: "📅 السحوبات السابقة", count: draws.length },
            { id: "stats", label: "📊 الإحصاء والجوائز", count: maxN },
          ].map((tab) => {
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

        {/* SUBVIEW 1: CLEAR PREDICTION */}
        {numberSubView === "predict" && (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-4 sm:p-6 border border-gray-200/80 dark:border-zinc-800 shadow-sm space-y-5">
            {/* Primary Recommended Ticket */}
            <div className="rounded-3xl p-5 bg-gradient-to-br from-indigo-50 via-purple-50/70 to-amber-50/60 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-zinc-900 border-2 border-indigo-300 dark:border-indigo-500/40 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-sm sm:text-base font-black text-indigo-950 dark:text-indigo-100 flex items-center gap-1.5">
                    <Award className="w-5 h-5 text-amber-500" />
                    <span>الأرقام الموصى بها للسحب القادم (دقة التوازن {primaryPred.qualityScore}%)</span>
                  </span>
                  <p className="text-xs text-gray-600 dark:text-gray-300 font-bold mt-0.5">
                    انسخ هذه الأرقام أو احفظها في «بطاقاتي» ليراقب النظام السحب ويعلن لك الفوز تلقائياً.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRunGeminiLoto(gameKey)}
                    disabled={isRunningGeminiLoto}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white text-xs font-black shadow flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    {isRunningGeminiLoto ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <BrainCircuit className="w-4 h-4 text-amber-200" />
                    )}
                    <span>استشارة الذكاء الخارق Gemini</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowCustomPicker((v) => !v)}
                    className={`px-3 py-2 rounded-xl text-xs font-black border flex items-center gap-1 cursor-pointer ${
                      showCustomPicker || lockState.numbers.length > 0
                        ? "bg-amber-500 text-white border-amber-500"
                        : "bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-zinc-700"
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>{lockState.numbers.length > 0 ? `مثبت (${lockState.numbers.length})` : "ثبّت أرقامك"}</span>
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
                      toast.success("تم توليد أرقام بديلة جديدة 🎯");
                    }}
                    className="px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-800 dark:text-gray-200 text-xs font-black flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>تغيير</span>
                  </button>
                </div>
              </div>

              {/* Big Clear Numbers */}
              <div className="flex flex-wrap items-center justify-center gap-3 py-3" dir="ltr">
                {primaryPred.numbers.map((num) => {
                  const isHot = portfolioObj.stats.hotNumbers.includes(num);
                  const isDue = portfolioObj.stats.overdueNumbers.includes(num);
                  return (
                    <div key={num} className="flex flex-col items-center gap-1">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-rose-600 text-white font-black text-2xl flex items-center justify-center shadow-lg ring-2 ring-white dark:ring-zinc-800">
                        {num}
                      </div>
                      <span className="text-[10px] font-black text-gray-600 dark:text-gray-300">
                        {isHot ? "🔥 متكرر" : isDue ? "⚡ متأخر" : "⚖️ متوازن"}
                      </span>
                    </div>
                  );
                })}
                {is42 && primaryPred.extraNumber && (
                  <div className="flex flex-col items-center gap-1 pl-3 border-l-2 border-indigo-200 dark:border-zinc-700">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 font-black text-2xl flex items-center justify-center shadow-lg ring-2 ring-amber-200">
                      {primaryPred.extraNumber}
                    </div>
                    <span className="text-[10px] font-black text-amber-600 dark:text-amber-400">
                      ⭐ الإضافي
                    </span>
                  </div>
                )}
              </div>

              {/* Primary Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    handleSaveNumberTicket(gameKey, primaryPred.numbers, primaryPred.extraNumber)
                  }
                  className="py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black flex items-center justify-center gap-2 shadow-md cursor-pointer active:scale-[0.99] transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>اعتمد هذه الأرقام واحفظها في بطاقاتي (للمطابقة والإعلان)</span>
                </button>

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
                  className="py-3 px-4 rounded-2xl bg-white dark:bg-zinc-800 border-2 border-indigo-200 dark:border-zinc-700 text-gray-900 dark:text-white text-sm font-black flex items-center justify-center gap-2 cursor-pointer"
                >
                  {copiedKey === "primary" ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  <span>نسخ الأرقام للشراء في الموقع</span>
                </button>
              </div>

              {aiData?.expertSummaryAr && (
                <div className="p-3.5 rounded-2xl bg-purple-600/10 border border-purple-400/30 text-xs font-bold text-purple-950 dark:text-purple-200 leading-relaxed">
                  🧠 <strong>رأي الذكاء الخارق Gemini:</strong> {aiData.expertSummaryAr}
                </div>
              )}

              {/* Simple Arabic Reasons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-center">
                <div className="bg-white/90 dark:bg-zinc-900/90 p-2.5 rounded-2xl border border-gray-200/70 dark:border-zinc-800">
                  <span className="text-[11px] text-gray-500 font-bold block">مجموع الأرقام</span>
                  <span className="text-xs font-black text-gray-900 dark:text-white">
                    {primaryPred.sum} (المثالي {portfolioObj.stats.goldenSumRange[0]}–
                    {portfolioObj.stats.goldenSumRange[1]})
                  </span>
                </div>
                <div className="bg-white/90 dark:bg-zinc-900/90 p-2.5 rounded-2xl border border-gray-200/70 dark:border-zinc-800">
                  <span className="text-[11px] text-gray-500 font-bold block">توازن الفردي والزوجي</span>
                  <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                    {primaryPred.oddEven}
                  </span>
                </div>
                <div className="bg-white/90 dark:bg-zinc-900/90 p-2.5 rounded-2xl border border-gray-200/70 dark:border-zinc-800">
                  <span className="text-[11px] text-gray-500 font-bold block">تطابق سابق (3+ أرقام)</span>
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                    حققت فوزاً {primaryPred.backtestHits3Plus} مرات بالتجربة الرجعية
                  </span>
                </div>
              </div>
            </div>

            {showCustomPicker && (
              <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-black text-amber-900 dark:text-amber-200">
                    🔒 اضغط على أي رقم لتثبيته في التوليفة (البرتقالي الذهبي = الأقوى حالياً):
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
                      إلغاء كل التثبيت
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-7 sm:grid-cols-10 md:grid-cols-14 gap-1.5" dir="ltr">
                  {Array.from({ length: maxN }, (_, i) => i + 1).map((num) => {
                    const isLockedBall = lockState.numbers.includes(num);
                    const isPrimeImminent = portfolioObj.stats.primeZoneNumbers.slice(0, 6).includes(num);
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => toggleLockedBall(gameKey, num)}
                        className={`h-9 rounded-xl font-black text-xs flex items-center justify-center border transition cursor-pointer ${
                          isLockedBall
                            ? "bg-indigo-600 border-indigo-700 text-white shadow scale-105"
                            : isPrimeImminent
                            ? "bg-amber-400 border-amber-500 text-slate-950 shadow-sm"
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

            {/* 2 Backup Options */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-black text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-purple-500" />
                <span>توليفتان إضافيتان (في حال أردت شراء أكثر من بطاقة لتوسيع فرص الفوز):</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {portfolioObj.portfolio.slice(1).map((alt, i) => (
                  <div
                    key={i}
                    className="rounded-2xl p-3.5 bg-gray-50 dark:bg-zinc-800/60 border border-gray-200/80 dark:border-zinc-700/80 flex flex-col gap-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-gray-800 dark:text-white">{alt.label}</span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                        توازن {alt.qualityScore}%
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
                    <div className="flex items-center justify-between text-[11px] font-bold text-gray-500">
                      <span>المجموع: {alt.sum}</span>
                      <button
                        type="button"
                        onClick={() => handleSaveNumberTicket(gameKey, alt.numbers, alt.extraNumber)}
                        className="text-emerald-600 dark:text-emerald-400 font-black hover:underline cursor-pointer"
                      >
                        + حفظ في بطاقاتي
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {numberSubView === "tickets" && renderTicketsPanel(gameKey)}

        {numberSubView === "history" && (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-4 sm:p-5 border border-gray-200/80 dark:border-zinc-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="font-black text-sm sm:text-base text-gray-900 dark:text-white">
                📅 أرشيف السحوبات الرسمية ({draws.length} سحبة)
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

        {numberSubView === "stats" && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-4 sm:p-5 border border-gray-200/80 dark:border-zinc-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-black text-sm sm:text-base text-gray-900 dark:text-white">
                  🔥 الأرقام الأقوى والأقرب للظهور (من 1 إلى {maxN})
                </h3>
                <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-amber-400 text-slate-950">
                  ⭐ البرتقالي الذهبي = الأقوى ترجيحاً للسحب القادم
                </span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-7 md:grid-cols-10 gap-2" dir="ltr">
                {portfolioObj.stats.metrics.map((m) => {
                  const isTopImminent = portfolioObj.stats.primeZoneNumbers.slice(0, 6).includes(m.number);
                  return (
                    <div
                      key={m.number}
                      className={`p-2 rounded-2xl border text-center ${
                        isTopImminent
                          ? "bg-gradient-to-br from-amber-300 to-orange-400 border-amber-500 text-slate-950 shadow-md ring-2 ring-amber-300"
                          : m.tag === "hot"
                          ? "bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800"
                          : m.tag === "overdue"
                          ? "bg-cyan-50 dark:bg-cyan-950/30 border-cyan-300 dark:border-cyan-800"
                          : "bg-gray-50 dark:bg-zinc-800/50 border-gray-200 dark:border-zinc-700"
                      }`}
                    >
                      <div className="text-sm font-black">
                        {m.number} {isTopImminent ? "⭐" : ""}
                      </div>
                      <div className="text-[9px] font-bold opacity-80">ظهور: {m.count}</div>
                      <div className="text-[9px] font-black">غاب: {m.drawsSinceLastSeen}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-4 sm:p-5 border border-gray-200/80 dark:border-zinc-800 space-y-2.5">
              <h3 className="font-black text-sm text-gray-900 dark:text-white">
                🏆 جدول الجوائز الرسمية ({is42 ? "لوتو 42" : "لوتو 29"})
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
                        <span className="text-xs font-black text-gray-900 dark:text-white block">{t.match}</span>
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

  // Scratch Game Renderer
  const renderScratchGame = (code: "SC500" | "SC1K") => {
    const spec = SCRATCH_SPECS[code];
    const report = code === "SC500" ? sc500Report : sc1kReport;
    const otherReport = code === "SC500" ? sc1kReport : sc500Report;
    const gameTickets = tickets.filter((t) => t.game === spec.gameId);

    return (
      <div className="space-y-4">
        <div className="rounded-3xl p-5 bg-gradient-to-br from-amber-950 via-orange-950 to-slate-950 text-white border border-white/10 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-black">
                  {code === "SC500" ? "🎫 طابق 3 (500 د.ع)" : "🏆 جيب الكاس جيبه (1,000 د.ع)"}
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-black ${
                    report.verdictTone === "emerald"
                      ? "bg-emerald-500/25 text-emerald-200"
                      : "bg-rose-500/30 text-rose-200"
                  }`}
                >
                  {report.verdictBadge}
                </span>
              </div>

              <div className="flex flex-wrap items-baseline gap-4">
                <div>
                  <span className="text-xs text-amber-200/80 font-bold block">الجائزة الكبرى الفورية</span>
                  <span className="text-3xl font-black text-amber-300">
                    {fmt(report.topPrize)} <span className="text-sm">د.ع</span>
                  </span>
                </div>
                <div className="bg-white/10 rounded-2xl px-3.5 py-2">
                  <span className="text-[11px] text-amber-200 font-bold block">المتبقي من الجائزة الكبرى</span>
                  <span className="text-base font-black text-emerald-300">{report.topRemaining} بطاقة</span>
                </div>
              </div>
              <p className="text-xs text-amber-100/90 font-bold">{spec.mechanicsAr}</p>
            </div>

            <div className="flex flex-col gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setScratchManualWinInput("0");
                  setShowScratchManualBox((v) => !v);
                }}
                className="px-4 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 shadow-lg cursor-pointer"
              >
                <PenLine className="w-4 h-4" />
                <span>تسجيل نتيجة بطاقة كشط يدوياً</span>
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

          {showScratchManualBox && (
            <div className="mt-4 p-4 rounded-2xl bg-black/35 border border-amber-300/40 space-y-3">
              <div className="text-xs font-black text-amber-200">
                ✍️ سجّل نتيجة بطاقة {spec.nameAr} التي كشطتها (0 في حال عدم الربح، أو مبلغ الجائزة بالدينار):
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {[0, 500, 1000, 2000, 5000, 10000, 25000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setScratchManualWinInput(String(preset))}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-black cursor-pointer transition ${
                      Number(scratchManualWinInput) === preset
                        ? "bg-amber-400 text-slate-950"
                        : "bg-white/15 text-white hover:bg-white/25"
                    }`}
                  >
                    {preset === 0 ? "0 (خسارة)" : `${fmt(preset)} د.ع`}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <input
                  type="number"
                  min={0}
                  value={scratchManualWinInput}
                  onChange={(e) => setScratchManualWinInput(e.target.value)}
                  placeholder="مبلغ الربح بالدينار العراقي"
                  className="bg-white/95 text-slate-950 rounded-xl px-3 py-2 text-xs font-black w-52"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowScratchManualBox(false)}
                    className="px-3 py-2 rounded-xl bg-white/15 text-white text-xs font-black cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveScratchManual(spec.gameId)}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black cursor-pointer"
                  >
                    حفظ النتيجة ✅
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-4 sm:p-5 border border-gray-200/80 dark:border-zinc-800 space-y-4">
          <h3 className="font-black text-sm sm:text-base text-gray-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            <span>تحليل فرص الفوز ومقارنة الجدوى مع {otherReport.nameAr}</span>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
            <div className="p-3 rounded-2xl bg-gray-50 dark:bg-zinc-800/60">
              <span className="text-[11px] text-gray-500 font-bold block">إجمالي البطاقات الرابحة</span>
              <span className="text-sm font-black text-gray-900 dark:text-white">{fmt(report.totalWinningCardsInRun)}</span>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30">
              <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-bold block">بطاقات ربح صافٍ</span>
              <span className="text-sm font-black text-emerald-700 dark:text-emerald-300">{fmt(report.netProfitCards)}</span>
            </div>
            <div className="p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30">
              <span className="text-[11px] text-indigo-700 dark:text-indigo-300 font-bold block">فئات 10,000 د.ع فأعلى</span>
              <span className="text-sm font-black text-indigo-700 dark:text-indigo-300">{fmt(report.midHighTierCards)}</span>
            </div>
            <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30">
              <span className="text-[11px] text-amber-700 dark:text-amber-300 font-bold block">مضاعف الجائزة الكبرى</span>
              <span className="text-sm font-black text-amber-700 dark:text-amber-300">{fmt(report.maxMultiplier)} ضعف</span>
            </div>
          </div>

          <div className="space-y-1.5 p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/25 border border-indigo-200/70 dark:border-indigo-800/40">
            {report.smartAdviceAr.map((adv, idx) => (
              <div key={idx} className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-start gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <span>{adv}</span>
              </div>
            ))}
          </div>
        </div>

        {gameTickets.length > 0 && renderTicketsPanel(spec.gameId)}
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200" dir="rtl">
      {/* ═══════════════════════════════════════════════════════════════════
          MANUAL OFFICIAL DRAW RESULT MODAL (تسجيل نتيجة السحب الرسمي يدوياً ✍️)
      ═══════════════════════════════════════════════════════════════════ */}
      {showRecordDrawModal && (
        <div className="fixed inset-0 z-[290] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto bg-white dark:bg-zinc-900 rounded-3xl p-5 border-2 border-indigo-400 dark:border-indigo-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                  <PenLine className="w-5 h-5 text-indigo-600" />
                  <span>تسجيل نتيجة السحب الرسمي يدوياً</span>
                </h3>
                <p className="text-xs font-bold text-gray-500 mt-0.5">
                  أدخل الأرقام الفائزة فور انتهاء السحب ليتم تحديث الأرشيف ومطابقة بطاقاتك وإعلان الفوز تلقائياً.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRecordDrawModal(false)}
                className="p-2 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Game Switcher */}
            <div className="grid grid-cols-2 gap-2">
              {(["loto29", "loto42"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => {
                    const nextNum =
                      g === "loto42"
                        ? loto42Current?.selling?.drawNumber || (loto42Draws[0]?.drawNumber || 39) + 1
                        : loto29Current?.selling?.drawNumber || (loto29Draws[0]?.drawNumber || 432) + 1;
                    setRecordDrawGame(g);
                    setRecordDrawNumber(String(nextNum));
                    setRecordDrawNumbers([]);
                    setRecordDrawExtra(null);
                  }}
                  className={`py-2.5 px-3 rounded-2xl text-xs font-black border-2 cursor-pointer transition ${
                    recordDrawGame === g
                      ? g === "loto42"
                        ? "bg-purple-600 text-white border-purple-700"
                        : "bg-rose-600 text-white border-rose-700"
                      : "bg-gray-50 dark:bg-zinc-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-zinc-700"
                  }`}
                >
                  {g === "loto42" ? "🟣 لوتو 42 (1–42 + إضافي)" : "🔴 لوتو 29 (1–29)"}
                </button>
              ))}
            </div>

            {/* Draw Number + Optional Next Jackpot */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-black text-gray-600 dark:text-gray-300 block mb-1">
                  رقم السحب المنتهي:
                </label>
                <input
                  type="number"
                  value={recordDrawNumber}
                  onChange={(e) => setRecordDrawNumber(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm font-black"
                />
              </div>
              <div>
                <label className="text-[11px] font-black text-gray-600 dark:text-gray-300 block mb-1">
                  الجائزة الكبرى للسحب القادم (اختياري):
                </label>
                <input
                  type="number"
                  value={recordNextJackpot}
                  onChange={(e) => setRecordNextJackpot(e.target.value)}
                  placeholder="مثلاً 117500000"
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm font-black"
                />
              </div>
            </div>

            {/* 6 Winning Numbers Grid */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-gray-800 dark:text-white">
                  اختر الـ 6 أرقام الفائزة ({recordDrawNumbers.length} / 6):
                </span>
                {recordDrawNumbers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setRecordDrawNumbers([])}
                    className="text-[11px] font-black text-rose-600 cursor-pointer"
                  >
                    مسح الأرقام
                  </button>
                )}
              </div>
              <div className="grid grid-cols-7 sm:grid-cols-10 gap-1.5" dir="ltr">
                {Array.from({ length: recordDrawGame === "loto42" ? 42 : 29 }, (_, i) => i + 1).map((n) => {
                  const picked = recordDrawNumbers.includes(n);
                  const isExtra = recordDrawExtra === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        if (picked) {
                          setRecordDrawNumbers((p) => p.filter((x) => x !== n));
                        } else if (recordDrawNumbers.length < 6) {
                          if (isExtra) setRecordDrawExtra(null);
                          setRecordDrawNumbers((p) => [...p, n].sort((a, b) => a - b));
                        }
                      }}
                      className={`h-9 rounded-xl font-black text-xs border cursor-pointer transition ${
                        picked
                          ? "bg-emerald-600 text-white border-emerald-700 shadow"
                          : "bg-gray-50 dark:bg-zinc-800 text-gray-800 dark:text-white border-gray-200 dark:border-zinc-700 hover:border-indigo-400"
                      }`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Extra Number for Loto 42 */}
            {recordDrawGame === "loto42" && (
              <div className="space-y-2 pt-1 border-t border-gray-100 dark:border-zinc-800">
                <span className="text-xs font-black text-purple-700 dark:text-purple-300 block">
                  اختر الرقم الإضافي (Extra) للوتو 42 {recordDrawExtra ? `— المختار: ${recordDrawExtra}` : ""}:
                </span>
                <div className="grid grid-cols-7 sm:grid-cols-11 gap-1.5" dir="ltr">
                  {Array.from({ length: 42 }, (_, i) => i + 1).map((n) => {
                    const usedInMain = recordDrawNumbers.includes(n);
                    const pickedExtra = recordDrawExtra === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        disabled={usedInMain}
                        onClick={() => setRecordDrawExtra(pickedExtra ? null : n)}
                        className={`h-8 rounded-lg font-black text-[11px] border cursor-pointer transition disabled:opacity-25 ${
                          pickedExtra
                            ? "bg-amber-400 text-slate-950 border-amber-500 shadow"
                            : "bg-gray-50 dark:bg-zinc-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-zinc-700"
                        }`}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRecordDrawModal(false)}
                className="px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-200 text-xs font-black cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={
                  recordDrawNumbers.length !== 6 ||
                  (recordDrawGame === "loto42" && !recordDrawExtra)
                }
                onClick={handleSaveOfficialDrawManual}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-black shadow cursor-pointer"
              >
                حفظ النتيجة ومطابقة بطاقاتي فوراً ✅
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          THEATRICAL WIN CELEBRATION MODAL (إشعار الفوز المسرحي 🎉👑)
      ═══════════════════════════════════════════════════════════════════ */}
      {theatricalWinTicket && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-[2.2rem] overflow-hidden bg-gradient-to-br from-amber-500 via-orange-600 to-purple-900 p-1 shadow-2xl">
            <div className="relative bg-slate-950 rounded-[2rem] p-6 text-center text-white space-y-4 overflow-hidden">
              <div className="absolute -top-20 -right-20 w-56 h-56 bg-amber-400/25 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 -left-20 w-56 h-56 bg-rose-500/25 rounded-full blur-3xl pointer-events-none" />

              <button
                type="button"
                onClick={() => setTheatricalWinTicket(null)}
                className="absolute top-4 left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-6xl animate-bounce">👑🎉</div>
              <div className="space-y-1">
                <span className="px-3.5 py-1 rounded-full bg-amber-400 text-slate-950 text-xs font-black">
                  إعلان فوز رسمي مطابق لسحب لوتو العراق!
                </span>
                <h3 className="text-2xl sm:text-3xl font-black text-amber-300 pt-1">
                  ألف مبروك! ربحت الجائزة!
                </h3>
                <p className="text-sm font-bold text-white/90">{theatricalWinTicket.title}</p>
              </div>

              <div className="py-4 px-5 rounded-3xl bg-gradient-to-r from-emerald-500/25 via-amber-500/25 to-rose-500/25 border-2 border-amber-400/60">
                <span className="text-xs font-bold text-amber-200 block">قيمة الجائزة المستحقة:</span>
                <div className="text-4xl font-black text-amber-300 mt-1">
                  {fmt(theatricalWinTicket.prizeWon || 0)} <span className="text-lg">د.ع</span>
                </div>
                <div className="text-xs font-black text-emerald-300 mt-1">
                  {theatricalWinTicket.prizeLabel}
                </div>
              </div>

              {theatricalWinTicket.numbers && theatricalWinTicket.numbers.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-white/70 block">الأرقام المتطابقة في بطاقتك:</span>
                  <div className="flex items-center justify-center gap-2 flex-wrap" dir="ltr">
                    {theatricalWinTicket.numbers.map((n) => {
                      const hit = theatricalWinTicket.matchedNumbers?.includes(n);
                      return (
                        <span
                          key={n}
                          className={`w-10 h-10 rounded-xl font-black text-base flex items-center justify-center ${
                            hit
                              ? "bg-emerald-500 text-white ring-2 ring-amber-300 scale-110 shadow-lg"
                              : "bg-white/10 text-white/60"
                          }`}
                        >
                          {n}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setTheatricalWinTicket(null)}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black text-sm shadow-xl cursor-pointer active:scale-95 transition"
              >
                الحمد لله! تم توثيق الفوز ✅
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clean Top Status & Moment-by-Moment Sync Bar */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-4 border border-gray-200/80 dark:border-zinc-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 via-rose-500 to-amber-500 text-white flex items-center justify-center text-2xl shadow-md">
            🎰
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white">
                لوتو العراق المباشر
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[11px] font-black flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isSyncingLive ? "bg-amber-500 animate-ping" : "bg-emerald-500 animate-pulse"
                  }`}
                />
                <span>{syncSource}</span>
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-bold mt-0.5">
              يتحدث لحظة بلحظة كل {LIVE_POLL_SECONDS} ثانية (التحديث القادم خلال{" "}
              <span className="font-mono text-indigo-600 dark:text-indigo-400">{nextPollSec}ث</span>)
              {lastSyncedAt > 0 && (
                <span>
                  {" "}
                  • آخر سحب:{" "}
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
            onClick={() => setSoundEnabled((s) => !s)}
            className="p-2 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-200 cursor-pointer"
            title={soundEnabled ? "إيقاف صوت الإشعارات المسرحية" : "تفعيل صوت الإشعارات المسرحية"}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-600" /> : <VolumeX className="w-4 h-4 text-gray-400" />}
          </button>

          <button
            type="button"
            onClick={() => openRecordDrawModal(activeGame === "loto42" ? "loto42" : "loto29")}
            className="px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-black flex items-center gap-1.5 cursor-pointer"
          >
            <PenLine className="w-3.5 h-3.5" />
            <span>تسجيل نتيجة سحب يدوياً</span>
          </button>

          <button
            type="button"
            onClick={() => triggerLiveSync(false)}
            disabled={isSyncingLive}
            className="px-3.5 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 dark:bg-white dark:text-gray-900 text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingLive ? "animate-spin" : ""}`} />
            <span>{isSyncingLive ? "جاري التحديث..." : "تحديث لحظي الآن"}</span>
          </button>
        </div>
      </div>

      {/* URGENT IMMINENT DRAW RADAR BANNER */}
      {imminentAlerts.length > 0 && (
        <div className="rounded-3xl p-4 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 text-white shadow-xl border-2 border-amber-300 space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <BellRing className="w-5 h-5 text-amber-100 animate-bounce shrink-0" />
              <span className="font-black text-sm">
                🚨 السحوبات الأقرب الآن — استعمل هذه الألعاب أولاً قبل الإغلاق!
              </span>
            </div>
            <span className="text-[11px] font-black bg-black/25 px-2.5 py-0.5 rounded-full">
              الأقرب فالأقرب
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {imminentAlerts.slice(0, 4).map((al, idx) => (
              <div
                key={al.id}
                className={`rounded-2xl p-3 flex items-center justify-between gap-2 backdrop-blur-md border ${
                  idx === 0
                    ? "bg-black/35 border-amber-200 ring-2 ring-white/40"
                    : "bg-white/15 border-white/25"
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs font-black text-white truncate">
                    #{idx + 1} {al.urgency === "critical" ? "🔥" : "⏰"} {al.titleAr}
                  </div>
                  <div className="text-[11px] font-black text-amber-200 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <span>يغلق خلال:</span>
                    <span dir="ltr" className="font-mono bg-black/30 px-1.5 rounded">
                      {formatCountdown(al.closesAtMs, nowMs)}
                    </span>
                    <span className="text-white/90">• {fmt(al.jackpot)} د.ع</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setActiveGame(al.game);
                    if (al.game === "sports" && al.roundId) {
                      setSportsSubView("active");
                      setSelectedRoundId(al.roundId);
                    } else {
                      setNumberSubView("predict");
                    }
                  }}
                  className="shrink-0 px-3 py-2 rounded-xl bg-white text-rose-700 hover:bg-amber-100 text-xs font-black shadow cursor-pointer"
                >
                  استعملها 🎯
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5 GAMES DYNAMICALLY SORTED BY NEAREST DRAW TIME ("تظهر حسب القريبة السحب مالتها") */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-black text-gray-600 dark:text-gray-300">
            اختر اللعبة (مرتّبة تلقائياً من الأقرب للسحب إلى الأبعد):
          </span>
          {ticketSummary.wonCount > 0 && (
            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
              🏆 لديك {ticketSummary.wonCount} بطاقة فائزة ({fmt(ticketSummary.totalWon)} د.ع)
            </span>
          )}
        </div>

        <div
          role="tablist"
          aria-label="ألعاب لوتو العراق الخمس مرتبة حسب الأقرب للسحب"
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5"
        >
          {SORTED_GAME_CARDS.map((g, idx) => {
            const isSelected = activeGame === g.id;
            const urg = urgencyByGame[g.id];
            const isCritical = urg?.urgency === "critical";
            const isSoon = urg?.urgency === "soon";
            const isClosestOverall = idx === 0 && (isCritical || isSoon);

            let cardClasses =
              "bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-gray-800 dark:text-gray-100 hover:border-purple-400";

            if (isSelected && (isCritical || isClosestOverall)) {
              cardClasses =
                "bg-gradient-to-br from-amber-500 via-orange-600 to-rose-600 text-white border-amber-200 ring-4 ring-amber-400/50 shadow-xl";
            } else if (isSelected) {
              cardClasses = `bg-gradient-to-br ${g.selectedGradient} text-white border-transparent shadow-lg`;
            } else if (isCritical || isClosestOverall) {
              cardClasses =
                "bg-gradient-to-br from-amber-100 via-orange-100 to-rose-100 dark:from-amber-950/90 dark:via-orange-950/80 dark:to-rose-950/80 border-amber-500 ring-2 ring-amber-400/70 text-slate-900 dark:text-white shadow-md";
            } else if (isSoon) {
              cardClasses =
                "bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50/80 dark:from-amber-950/55 dark:via-yellow-950/40 dark:to-zinc-900 border-amber-400 text-slate-900 dark:text-white shadow-sm";
            }

            return (
              <button
                key={g.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setActiveGame(g.id)}
                className={`relative text-right p-3.5 rounded-2xl border-2 transition-all flex flex-col justify-between gap-1.5 cursor-pointer active:scale-[0.98] aria-selected:after:content-[''] aria-selected:after:absolute aria-selected:after:inset-x-4 aria-selected:after:bottom-0 aria-selected:after:border-b-[3px] aria-selected:after:border-current ${cardClasses}`}
              >
                {(isCritical || isSoon) && (
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full w-fit flex items-center gap-1 ${
                      isCritical || isClosestOverall
                        ? "bg-rose-600 text-white animate-pulse"
                        : "bg-amber-400 text-slate-950"
                    }`}
                  >
                    <Flame className="w-3 h-3 shrink-0" />
                    <span>
                      {isClosestOverall ? "#1 الأقرب — استعملها!" : "قريبة السحب"}
                    </span>
                  </span>
                )}

                <div className="flex items-center justify-between gap-1 w-full">
                  <span className="text-xl leading-none">{g.emoji}</span>
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      isSelected
                        ? "bg-white/20 text-white"
                        : isCritical || isSoon
                        ? "bg-amber-500/20 text-amber-900 dark:text-amber-200"
                        : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300"
                    }`}
                  >
                    {g.badge}
                  </span>
                </div>

                <div>
                  <div className="font-black text-sm">{g.title}</div>
                  <div
                    className={`text-[10px] font-bold mt-0.5 ${
                      isSelected ? "text-white/85" : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {g.shortDesc}
                  </div>
                </div>

                {urg && (
                  <div
                    dir="ltr"
                    className={`text-[10px] font-mono font-black px-2 py-1 rounded-lg text-center ${
                      isSelected
                        ? "bg-black/25 text-amber-200"
                        : "bg-amber-500/15 text-rose-700 dark:text-amber-300"
                    }`}
                  >
                    ⏳ {formatCountdown(urg.closesAtMs, nowMs)}
                  </div>
                )}

                <div className="flex items-baseline justify-between gap-1 w-full pt-1 border-t border-current/10">
                  <span
                    className={`text-xs font-black ${
                      isSelected
                        ? "text-amber-200"
                        : isCritical
                        ? "text-rose-700 dark:text-amber-300"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {g.jackpotText}
                  </span>
                  <span
                    className={`text-[10px] font-bold ${
                      isSelected ? "text-white/80" : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {g.priceText}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* GAME 1: SPORTS LOTO */}
      {activeGame === "sports" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "active", label: `⚽ الجولات المفتوحة (${openSportsRounds.length})` },
              { id: "finished", label: `✅ النتائج السابقة (${finishedSportsRounds.length})` },
              {
                id: "tickets",
                label: `🎫 قسائمي (${tickets.filter((t) => t.game === "sports").length})`,
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {(sportsSubView === "active"
                  ? openSportsRounds
                  : finishedSportsRounds
                ).map((r, rIdx) => {
                  const on = currentSportsRound?.id === r.id;
                  const remHours = (r.closesAt - nowMs) / 3_600_000;
                  const isRoundImminent = r.status === "open" && remHours > 0 && remHours <= 30;
                  const isFirstOpen = sportsSubView === "active" && rIdx === 0;

                  let roundCls =
                    "bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-gray-800 dark:text-white hover:border-emerald-400";
                  if (on && (isRoundImminent || isFirstOpen)) {
                    roundCls =
                      "bg-gradient-to-br from-amber-600 via-orange-600 to-rose-700 text-white border-amber-300 ring-2 ring-amber-400 shadow-lg";
                  } else if (on) {
                    roundCls = "bg-emerald-950 text-white border-emerald-500 shadow-md";
                  } else if (isRoundImminent || isFirstOpen) {
                    roundCls =
                      "bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-950/80 dark:to-orange-950/70 border-amber-500 text-slate-900 dark:text-white";
                  }

                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedRoundId(r.id)}
                      className={`p-3.5 rounded-2xl border-2 text-right transition cursor-pointer ${roundCls}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black">{r.nameAr}</span>
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            isFirstOpen || isRoundImminent
                              ? "bg-rose-600 text-white animate-pulse"
                              : r.status === "open"
                              ? "bg-emerald-500/20 text-emerald-500"
                              : "bg-gray-500/20 text-gray-400"
                          }`}
                        >
                          {isFirstOpen
                            ? "🔥 الأقرب — استعملها!"
                            : isRoundImminent
                            ? "⏰ قريبة الإغلاق"
                            : r.status === "open"
                            ? "مفتوحة"
                            : "منتهية"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] mt-1.5 opacity-90 font-bold">
                        <span>الجائزة: {fmt(r.jackpot)} د.ع</span>
                        <span dir="ltr">
                          {r.status === "open"
                            ? `⏳ ${formatCountdown(r.closesAt, nowMs)}`
                            : `جولة #${r.number}`}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {currentSportsRound && (
                <div className="bg-white dark:bg-zinc-900 rounded-3xl p-4 sm:p-5 border border-gray-200/80 dark:border-zinc-800 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-zinc-800">
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white">
                        ⚽ {currentSportsRound.nameAr} — الجائزة {fmt(currentSportsRound.jackpot)} د.ع
                      </h3>
                      <p className="text-xs text-gray-500 font-bold mt-0.5">
                        الاختيار الملوّن بالأزرق هو توقعك المختار (والنجمة ⭐ هي توصية الذكاء). اضغط لتعديل أي مباراة.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {currentSportsRound.status === "open" && (
                        <button
                          type="button"
                          onClick={handleRunGeminiSports}
                          disabled={isRunningGeminiSports}
                          className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-black flex items-center gap-1.5 shadow cursor-pointer disabled:opacity-60"
                        >
                          {isRunningGeminiSports ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <BrainCircuit className="w-4 h-4 text-amber-200" />
                          )}
                          <span>تحليل المباريات الـ 10 بالذكاء الخارق</span>
                        </button>
                      )}
                      <a
                        href={`https://loto.iq/sports/play?round=${currentSportsRound.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-gray-200 text-xs font-black flex items-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-emerald-500" />
                        <span>فتح في loto.iq</span>
                      </a>
                    </div>
                  </div>

                  {currentSportsRound.status !== "open" &&
                    Array.isArray(currentSportsRound.outcome) && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-800">
                        {(currentSportsRound.outcome as SportsOutcomeTier[]).map((tierItem, i) => (
                          <div key={i} className="text-center">
                            <span className="text-[11px] font-bold text-gray-500 block">
                              تطابق {tierItem.correct}/10
                            </span>
                            <span className="text-xs font-black text-emerald-700 dark:text-emerald-300">
                              {tierItem.winners} فائز ({fmt(tierItem.perWinner)} د.ع)
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                  {currentSportsAnalysis?.aiSummaryAr && (
                    <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-950 dark:text-emerald-200">
                      🧠 <strong>ملخص الذكاء الخارق للجولة:</strong> {currentSportsAnalysis.aiSummaryAr}
                    </div>
                  )}

                  <div className="space-y-2.5">
                    {currentSportsRound.matches.map((m) => {
                      const pred = currentSportsAnalysis?.matches.find(
                        (p) => p.position === m.position
                      );
                      const selectedPick =
                        userSportsSlip[currentSportsRound.id]?.[m.position] ||
                        pred?.recommendedPick ||
                        "1";
                      const actualOutcome = getMatchActualOutcome(m);
                      const homeLogo = resolveLogoUrl(m.home.logoUrl);
                      const awayLogo = resolveLogoUrl(m.away.logoUrl);

                      return (
                        <div
                          key={m.position}
                          className="p-3.5 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200/80 dark:border-zinc-700/70 space-y-2"
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1">
                              <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                                {m.position}
                              </span>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {homeLogo && (
                                    <img src={homeLogo} alt={m.home.nameAr} className="w-5 h-5 object-contain" />
                                  )}
                                  <span className="font-black text-sm text-gray-900 dark:text-white">
                                    {m.home.nameAr}
                                  </span>
                                  {m.score && typeof m.score === "object" ? (
                                    <span dir="ltr" className="px-2 py-0.5 rounded-lg bg-emerald-600 text-white text-xs font-black">
                                      {m.score.home} - {m.score.away}
                                    </span>
                                  ) : (
                                    <span className="text-[11px] font-black text-gray-400">ضد</span>
                                  )}
                                  {awayLogo && (
                                    <img src={awayLogo} alt={m.away.nameAr} className="w-5 h-5 object-contain" />
                                  )}
                                  <span className="font-black text-sm text-gray-900 dark:text-white">
                                    {m.away.nameAr}
                                  </span>
                                </div>
                                <div className="text-[11px] text-gray-500 font-bold mt-0.5">
                                  {new Date(m.kickoffAt).toLocaleString("ar-IQ", {
                                    weekday: "short",
                                    month: "numeric",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                  {pred && currentSportsRound.status === "open" && (
                                    <span className="mr-2 text-indigo-600 dark:text-indigo-400 font-black">
                                      • {pred.confidence === "banker" ? "مباراة مضمونة 🔒" : pred.confidence === "tight" ? "مباراة متقاربة ⚖️" : "ترجيح جيد ⚡"}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-1.5 w-full lg:w-72 shrink-0">
                              {(
                                [
                                  { code: "1" as const, label: "1 المضيف", prob: pred?.probHome ?? 45 },
                                  { code: "X" as const, label: "X تعادل", prob: pred?.probDraw ?? 28 },
                                  { code: "2" as const, label: "2 الضيف", prob: pred?.probAway ?? 27 },
                                ] as const
                              ).map((opt) => {
                                const isPicked = selectedPick === opt.code;
                                const isAiRec = pred?.recommendedPick === opt.code;
                                const isActualWin = actualOutcome === opt.code;
                                return (
                                  <button
                                    key={opt.code}
                                    type="button"
                                    disabled={currentSportsRound.status !== "open"}
                                    onClick={() =>
                                      setUserSportsSlip((prev) => ({
                                        ...prev,
                                        [currentSportsRound.id]: {
                                          ...(prev[currentSportsRound.id] || {}),
                                          [m.position]: opt.code,
                                        },
                                      }))
                                    }
                                    className={`py-2 px-2 rounded-xl border text-center transition cursor-pointer ${
                                      isActualWin
                                        ? "bg-emerald-500 border-emerald-600 text-white ring-2 ring-emerald-300"
                                        : isPicked && currentSportsRound.status === "open"
                                        ? "bg-indigo-600 border-indigo-600 text-white shadow"
                                        : "bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 text-gray-800 dark:text-gray-200"
                                    }`}
                                  >
                                    <div className="text-xs font-black">{opt.label}</div>
                                    <div
                                      className={`text-[10px] font-bold ${
                                        isActualWin || (isPicked && currentSportsRound.status === "open")
                                          ? "text-amber-200"
                                          : "text-gray-400"
                                      }`}
                                    >
                                      {isActualWin ? "✅ النتيجة" : `${opt.prob}% ${isAiRec ? "⭐" : ""}`}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {pred?.reasonAr && currentSportsRound.status === "open" && (
                            <div className="text-[11px] font-bold text-gray-600 dark:text-gray-300 pr-2 border-r-2 border-emerald-500">
                              💡 {pred.reasonAr}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {currentSportsRound.status === "open" && (
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
                              `⚽ توقع اللوتو الرياضي (${currentSportsRound.nameAr}):\n${lines.join("\n")}`
                            );
                          }}
                          className="px-3.5 py-2.5 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-gray-200 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>نسخ القسيمة</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleSaveSportsSlip}
                          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>حفظ القسيمة لمطابقة الفوز</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeGame === "loto42" && renderNumberGame("loto42")}
      {activeGame === "loto29" && renderNumberGame("loto29")}
      {activeGame === "sc500" && renderScratchGame("SC500")}
      {activeGame === "sc1k" && renderScratchGame("SC1K")}

      {/* Recent Official Winners Strip */}
      {recentWinners.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-4 border border-gray-200/80 dark:border-zinc-800 space-y-2.5">
          <h4 className="text-xs font-black text-gray-800 dark:text-white flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span>آخر الفائزين الرسميين من موقع لوتو العراق:</span>
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                  سحب #{w.drawNumber} • {w.governorate || "العراق"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
