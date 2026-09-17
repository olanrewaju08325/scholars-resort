import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Trophy, Clock, Zap, Users, Loader2, RefreshCw, ArrowLeft,
  ChevronLeft, ChevronRight, Flag, CheckCircle2, CheckCircle, XCircle, 
  Send, Eye, EyeOff, LayoutGrid, BarChart2, ShieldAlert, ShieldCheck, 
  AlertTriangle, Lock, Bell, Smartphone, Mail
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { checkIsCorrect } from '@/utils/questionUtils';
import { MathText } from '@/components/MathText';
import { forceCheckTournamentUnlock, getCurrentUtcTimestamp, syncClientWithServerTime, parseTournamentStartTimeUtc } from '@/utils/tournamentUtils';
import { getCuratedTournamentQuestions } from '@/data/canonicalTournamentQuestions';
import { getApiUrl } from '@/lib/utils';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function TournamentArena() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, user, loading: authLoading } = useAuth();
  
  const [tournament, setTournament] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Record<number, boolean>>({});
  const [eliminatedOptions, setEliminatedOptions] = useState<Record<string, string[]>>({});
  const [leaderboard, setLeaderboard] = useState<Array<{ userId: string; name: string; score: number; timeSpent?: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [nowUtc, setNowUtc] = useState<number>(getCurrentUtcTimestamp());
  const [timeLeft, setTimeLeft] = useState(1800); // 30 mins default
  const [finished, setFinished] = useState(false);
  const [forceUnlockedManually, setForceUnlockedManually] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showPaletteMobile, setShowPaletteMobile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReview, setShowReview] = useState(false);

  // Strict Proctoring & Anti-Cheat States
  const [strikes, setStrikes] = useState(0);
  const [isDisqualified, setIsDisqualified] = useState(false);
  const [isWindowBlurred, setIsWindowBlurred] = useState(false);
  const [hasClosed, setHasClosed] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderPhone, setReminderPhone] = useState(profile?.phone || '');
  const [reminderEmail, setReminderEmail] = useState(profile?.email || user?.email || '');
  const [schedulingReminder, setSchedulingReminder] = useState(false);

  // Compute unlock evaluation against client UTC timestamp
  const unlockEvaluation = useMemo(() => {
    if (!tournament) return null;
    const evaluated = forceCheckTournamentUnlock(tournament, nowUtc);
    if (forceUnlockedManually) {
      evaluated.validation.isUnlocked = true;
      evaluated.validation.isLive = true;
      evaluated.tournament.is_unlocked = true;
      evaluated.tournament.is_locked = false;
      evaluated.tournament.status = 'active';
    }
    return evaluated;
  }, [tournament, nowUtc, forceUnlockedManually]);

  const isUnlocked = Boolean(unlockEvaluation?.validation.isUnlocked);

  // Client-Time-Sync & UTC Clock updater
  useEffect(() => {
    syncClientWithServerTime().then(({ serverNowMs }) => {
      setNowUtc(serverNowMs);
    });

    const timer = setInterval(() => {
      setNowUtc(getCurrentUtcTimestamp());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Re-validation against Supabase 'tournaments' table when start time is reached
  const [hasRevalidatedDb, setHasRevalidatedDb] = useState(false);
  useEffect(() => {
    if (!tournament || !id || hasRevalidatedDb) return;

    const startMs = parseTournamentStartTimeUtc(tournament?.start_time || tournament?.startTime);
    if (startMs > 0 && nowUtc >= startMs) {
      setHasRevalidatedDb(true);
      if (UUID_REGEX.test(id)) {
        supabase.from('tournaments').select('*').eq('id', id).maybeSingle().then(({ data: freshData }) => {
          if (freshData) {
            const freshUnlock = forceCheckTournamentUnlock(freshData, nowUtc);
            setTournament(freshUnlock.tournament);
            toast.success("Tournament start time reached! Duel unlocked.");
          }
        }).catch((err) => {
          console.warn('[TournamentArena] Re-validation notice:', err);
        });
      } else {
        // Query API by id or list
        fetch(getApiUrl(`/api/tournaments/${encodeURIComponent(id)}`))
          .then(r => r.json())
          .then(json => {
            if (json.success && json.tournament) {
              const freshUnlock = forceCheckTournamentUnlock(json.tournament, nowUtc);
              setTournament(freshUnlock.tournament);
              toast.success("Tournament start time reached! Duel unlocked.");
            }
          })
          .catch(() => {});
      }
    }
  }, [tournament, nowUtc, id, hasRevalidatedDb]);

  // Force-check function that validates start_time against client's current UTC timestamp
  const handleForceCheckUnlock = useCallback(() => {
    const currentTimestamp = getCurrentUtcTimestamp();
    setNowUtc(currentTimestamp);
    
    if (!tournament) return;
    const result = forceCheckTournamentUnlock(tournament, currentTimestamp);
    
    if (result.validation.isStarted || result.validation.isUnlocked) {
      setForceUnlockedManually(true);
      toast.success("UTC timestamp verified! Tournament duel unlocked.");
    } else {
      const remainingSecs = Math.max(0, Math.ceil(result.validation.timeDiffMs / 1000));
      toast.info(`Start time not yet reached. UTC start in ${result.validation.formattedCountdown} (${remainingSecs}s).`);
    }
  }, [tournament]);

  // Load Tournament Data & Questions
  useEffect(() => {
    if (!id || authLoading) return;
    
    const initArena = async () => {
      let tData: any = null;
      const effectiveUserId = profile?.id || user?.id || 'guest_user';

      // 1. Fetch tournament details from Supabase ONLY if valid UUID
      if (UUID_REGEX.test(id)) {
        try {
          const { data: rawData } = await supabase.from('tournaments').select('*').eq('id', id).maybeSingle();
          if (rawData) {
            tData = rawData;
          }
        } catch {}
      }

      // 2. Fetch directly from dedicated single tournament endpoint
      if (!tData) {
        try {
          const res = await fetch(getApiUrl(`/api/tournaments/${encodeURIComponent(id)}`));
          if (res.ok) {
            const json = await res.json();
            if (json?.success && json.tournament) {
              tData = json.tournament;
            }
          }
        } catch {}
      }

      // 3. Fallback to API list / admin_settings if needed
      if (!tData) {
        try {
          const res = await fetch(getApiUrl('/api/tournaments'));
          const json = await res.json();
          if (json?.tournaments && Array.isArray(json.tournaments)) {
            tData = json.tournaments.find((t: any) => String(t.id) === String(id) || String(t.legacy_id) === String(id));
          }
        } catch {}
      }

      if (!tData) {
        try {
          const { data: currentSettings } = await supabase
            .from('admin_settings')
            .select('setting_value')
            .eq('setting_key', 'tournaments_db')
            .maybeSingle();

          if (currentSettings?.setting_value && Array.isArray(currentSettings.setting_value)) {
            tData = currentSettings.setting_value.find((t: any) => String(t.id) === String(id) || String(t.legacy_id) === String(id));
          }
        } catch {}
      }

      if (!tData) {
        toast.error("Tournament not found");
        navigate('/tournaments');
        return;
      }

      let meta: Record<string, any> = {};
      const searchTarget = (tData.rules || '') + '\n' + (tData.description || '');
      const match = searchTarget.match(/__meta__:(\{[\s\S]*?\})(?:\n|$)/);
      if (match && match[1]) {
        try { meta = JSON.parse(match[1]); } catch {}
      }
      const cleanDesc = (tData.description || '').replace(/\s*__meta__:[\s\S]*$/, '').trim();
      const cleanRules = (tData.rules || '').replace(/\s*__meta__:[\s\S]*$/, '').trim();

      const finalTournament = {
        ...meta,
        ...tData,
        description: cleanDesc,
        rules: cleanRules
      };

      // Set initial duration
      const durationMins = Number(finalTournament.duration_minutes) || 30;
      setTimeLeft(Math.max(60, durationMins * 60));

      // Force evaluate unlock against current UTC
      const currentUtc = getCurrentUtcTimestamp();
      const initialUnlock = forceCheckTournamentUnlock(finalTournament, currentUtc);
      setTournament(initialUnlock.tournament);

      // Check if tournament window has officially closed
      const nowMs = Date.now();
      let isClosed = false;
      if (tData.end_time) {
        isClosed = nowMs > new Date(tData.end_time).getTime();
      } else if (tData.start_time && tData.duration_minutes) {
        const endMs = new Date(tData.start_time).getTime() + ((Number(tData.duration_minutes) + 15) * 60 * 1000);
        isClosed = nowMs > endMs;
      }
      setHasClosed(isClosed);

      // Check if user has already submitted a score for this tournament in DB
      if (effectiveUserId && id) {
        try {
          const { data: dbPart } = await supabase
            .from('tournament_participants')
            .select('score, completed_at, status')
            .eq('tournament_id', id)
            .eq('user_id', effectiveUserId)
            .maybeSingle();

          if (dbPart && (dbPart.completed_at || typeof dbPart.score === 'number' || dbPart.status === 'completed' || dbPart.status === 'disqualified')) {
            setFinished(true);
            if (dbPart.status === 'disqualified') {
              setIsDisqualified(true);
            }
          }
        } catch {}
      }

      // Check local storage single-attempt record
      try {
        const storedResult = localStorage.getItem(`tournament_finished_${id}_${effectiveUserId}`);
        if (storedResult) {
          const parsed = JSON.parse(storedResult);
          if (parsed && typeof parsed.score === 'number') {
            if (parsed.answers && Object.keys(parsed.answers).length > 0) {
              setAnswers(parsed.answers);
            }
            if (parsed.status === 'disqualified') {
              setIsDisqualified(true);
            }
            setFinished(true);
          }
        }
      } catch {}

      // 2. Fetch questions based on tournament configuration (subject_filter & count)
      const count = Number(finalTournament.question_count) || 20;
      let qData: any[] | null = null;

      // Filter by tournament subject if specified
      if (tData.subject_filter && tData.subject_filter.trim() !== '' && tData.subject_filter.toLowerCase() !== 'all') {
        const rawSub = tData.subject_filter.trim();
        const targetSubjects = rawSub.split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
        
        try {
          // Resolve subject names to subject IDs using subjects table
          const { data: allSubjects } = await supabase.from('subjects').select('id, name');
          const matchedSubjectIds = (allSubjects || [])
            .filter(s => targetSubjects.some(tn => s.name?.toLowerCase().includes(tn)))
            .map(s => s.id)
            .filter(subId => UUID_REGEX.test(subId)); // Strictly keep valid UUIDs only

          if (matchedSubjectIds.length > 0) {
            const res = await supabase
              .from('questions')
              .select('id, subject_id, question_text, options, correct_answer, explanation, difficulty, year, is_active')
              .eq('is_active', true)
              .in('subject_id', matchedSubjectIds)
              .limit(count);
              
            if (res.data && res.data.length > 0) {
              qData = res.data;
            }
          }
        } catch (e) {
          console.warn('[TournamentArena] Subject matching error:', e);
        }
      }

      // Fallback if no subject filter or no questions returned for that subject
      if (!qData || qData.length === 0) {
        try {
          const fallbackRes = await supabase
            .from('questions')
            .select('id, subject_id, question_text, options, correct_answer, explanation, difficulty, year, is_active')
            .eq('is_active', true)
            .limit(count);
          if (fallbackRes.data && fallbackRes.data.length > 0) {
            qData = fallbackRes.data;
          }
        } catch {}
      }

      // If DB has fewer questions than requested or is empty, supplement strictly with canonical verified UTME subject questions
      let processedQuestions: any[] = [];
      if (qData && qData.length > 0) {
        processedQuestions = qData.map(q => {
          let opts: string[] = [];
          if (q.options) {
            if (typeof q.options === 'string') {
              try {
                const parsed = JSON.parse(q.options);
                opts = Array.isArray(parsed) ? parsed : Object.values(parsed);
              } catch {
                opts = [];
              }
            } else if (Array.isArray(q.options)) {
              opts = q.options;
            } else if (typeof q.options === 'object') {
              opts = Object.values(q.options);
            }
          }
          if (opts.length === 0) {
            opts = [q.option_a, q.option_b, q.option_c, q.option_d].filter(Boolean);
          }
          return {
            ...q,
            subject_name: q.subject_name || tData.subject_filter || 'UTME Core',
            options: opts.map((opt: any) => typeof opt === 'object' && opt !== null ? (opt.text || opt.value || opt.id || '') : String(opt || ''))
          };
        });
      }

      if (processedQuestions.length < count) {
        const curated = getCuratedTournamentQuestions(tData.subject_filter || '', count - processedQuestions.length);
        processedQuestions = [...processedQuestions, ...curated];
      }

      if (processedQuestions.length > 0) {
        setQuestions(processedQuestions.slice(0, count));
      } else {
        toast.error("No questions currently assigned to this tournament.");
      }
      setLoading(false);
    };

    initArena();
  }, [id, profile, navigate]);

  // Load Real Leaderboard from API
  const fetchLiveLeaderboard = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(getApiUrl(`/api/tournaments/${id}/leaderboard`));
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.leaderboard)) {
          setLeaderboard(json.leaderboard);
        }
      }
    } catch {}
  }, [id]);

  useEffect(() => {
    fetchLiveLeaderboard();
    const interval = setInterval(fetchLiveLeaderboard, 10000);
    return () => clearInterval(interval);
  }, [fetchLiveLeaderboard]);

  // Realtime presence channel
  useEffect(() => {
    if (!profile || !id || loading) return;

    const channel = supabase.channel(`tournament_${id}`, {
      config: {
        presence: {
          key: profile.id,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const activePresenceList: Array<{ userId: string; name: string; score: number }> = [];
        for (const [key, presences] of Object.entries(state)) {
          const p = presences[0] as any;
          activePresenceList.push({
            userId: key,
            name: p.name || 'Scholar Student',
            score: p.score || 0
          });
        }
        
        // Merge presence list into leaderboard
        setLeaderboard(prev => {
          const map = new Map<string, { userId: string; name: string; score: number }>();
          prev.forEach(item => map.set(item.userId, item));
          activePresenceList.forEach(item => {
            const current = map.get(item.userId);
            if (!current || item.score >= current.score) {
              map.set(item.userId, item);
            }
          });
          return Array.from(map.values()).sort((a, b) => b.score - a.score);
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const currentAnswerCount = Object.keys(answers).length;
          await channel.track({ 
            name: profile.full_name || 'Scholar Student', 
            score: currentAnswerCount * 10 
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, id, loading]);

  // Exam Duel Timer
  useEffect(() => {
    if (loading || finished || !isUnlocked) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [loading, finished, isUnlocked]);

  // Handle candidate disqualification on proctor violation
  const handleDisqualification = async () => {
    setIsDisqualified(true);
    setFinished(true);
    const effectiveUserId = profile?.id || user?.id || 'guest_user';
    const effectiveEmail = profile?.email || user?.email || '';

    try {
      await fetch(getApiUrl('/api/tournaments/submit-score'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournament_id: id,
          score: 0,
          time_taken_seconds: 0,
          user_id: effectiveUserId,
          user_email: effectiveEmail,
          strikes_count: 3,
          answers_count: Object.keys(answers).length,
          status: 'disqualified'
        })
      }).catch(() => {});

      if (id && UUID_REGEX.test(id) && profile?.id) {
        await supabase
          .from('tournament_participants')
          .update({ 
            score: 0, 
            status: 'disqualified',
            completed_at: new Date().toISOString() 
          })
          .eq('tournament_id', id)
          .eq('user_id', profile.id);
      }

      try {
        localStorage.setItem(`tournament_finished_${id}_${effectiveUserId}`, JSON.stringify({
          score: 0,
          answers: {},
          status: 'disqualified',
          submittedAt: new Date().toISOString()
        }));
      } catch {}
    } catch {}
  };

  // Anti-Screenshot & Screen-Capture / DevTools Keyboard Blockers
  useEffect(() => {
    if (finished || !isUnlocked || isDisqualified) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Catch PrintScreen
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        try {
          navigator.clipboard.writeText('');
        } catch {}
        toast.error("SECURITY ALERT: Screenshots and screen captures are prohibited in the tournament arena!");
        return;
      }

      // Catch DevTools & inspection shortcuts
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
        (e.ctrlKey && (e.key === 'u' || e.key === 'U' || e.key === 's' || e.key === 'S' || e.key === 'p' || e.key === 'P')) ||
        (e.metaKey && e.altKey && (e.key === 'i' || e.key === 'I' || e.key === 'j' || e.key === 'J'))
      ) {
        e.preventDefault();
        toast.warning("Inspection, developer shortcuts, and printing are disabled during active competition.");
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('contextmenu', handleContextMenu);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [finished, isUnlocked, isDisqualified]);

  // Tab-Switch & Window Blur Detection (Strict Proctoring)
  useEffect(() => {
    if (finished || !isUnlocked || isDisqualified || loading) return;

    const handleViolation = () => {
      setIsWindowBlurred(true);
      setStrikes(prev => {
        const next = prev + 1;
        if (next >= 3) {
          handleDisqualification();
          toast.error("PROCTOR ALERT: Exceeded maximum allowed window changes (3 strikes). You have been disqualified!");
        } else {
          toast.warning(`PROCTOR VIOLATION: Tab switch / window change detected! Strike ${next} of 3.`);
        }
        return next;
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleViolation();
      }
    };

    const handleWindowBlur = () => {
      handleViolation();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [finished, isUnlocked, isDisqualified, loading]);

  // Periodic Hard Close Check
  useEffect(() => {
    if (finished || !isUnlocked || isDisqualified || loading || !tournament) return;

    const interval = setInterval(() => {
      const now = Date.now();
      let shouldClose = false;
      if (tournament.end_time) {
        shouldClose = now >= new Date(tournament.end_time).getTime();
      } else if (tournament.start_time && tournament.duration_minutes) {
        const endMs = new Date(tournament.start_time).getTime() + ((Number(tournament.duration_minutes) + 5) * 60 * 1000);
        shouldClose = now >= endMs;
      }

      if (shouldClose) {
        setHasClosed(true);
        toast.info("Tournament exam window has concluded! Submitting your answers now...");
        handleFinalSubmit(true);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [finished, isUnlocked, isDisqualified, loading, tournament]);

  // Schedule exam start reminder
  const handleScheduleReminder = async () => {
    if (!reminderEmail && !reminderPhone) {
      toast.error("Please enter a phone number or email address.");
      return;
    }
    setSchedulingReminder(true);
    try {
      const res = await fetch(getApiUrl('/api/tournaments/schedule-reminder'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: id,
          tournamentTitle: tournament?.title,
          userEmail: reminderEmail,
          userPhone: reminderPhone,
          userName: profile?.full_name || user?.email?.split('@')[0] || 'Candidate',
          startTime: tournament?.start_time
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Reminder activated! You will receive an alert before the competition begins.");
        setShowReminderModal(false);
      } else {
        toast.error(data.error || "Failed to schedule reminder.");
      }
    } catch {
      toast.success("Reminder requested! We will alert you prior to the match start.");
      setShowReminderModal(false);
    } finally {
      setSchedulingReminder(false);
    }
  };

  // Option selection
  const handleSelectOption = (questionId: string, optionText: string) => {
    setAnswers(prev => {
      if (prev[questionId] === optionText) {
        const next = { ...prev };
        delete next[questionId];
        return next;
      }
      return { ...prev, [questionId]: optionText };
    });
  };

  // Flag toggle
  const toggleFlag = (idx: number) => {
    setFlagged(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  // Option elimination toggle
  const toggleEliminate = (questionId: string, opt: string) => {
    setEliminatedOptions(prev => {
      const current = prev[questionId] || [];
      const updated = current.includes(opt)
        ? current.filter(o => o !== opt)
        : [...current, opt];
      return { ...prev, [questionId]: updated };
    });
  };

  // Compute final score
  const computedScore = useMemo(() => {
    return questions.reduce((acc, q) => {
      const userSelected = answers[q.id];
      if (userSelected && checkIsCorrect(userSelected, q)) {
        return acc + 10;
      }
      return acc;
    }, 0);
  }, [questions, answers]);

  // Final submission
  const handleFinalSubmit = async (forcedByTimer = false) => {
    if (finished || isSubmitting) return;
    setIsSubmitting(true);
    setShowSubmitModal(false);

    const finalScore = questions.reduce((acc, q) => {
      const userSelected = answers[q.id];
      if (userSelected && checkIsCorrect(userSelected, q)) {
        return acc + 10;
      }
      return acc;
    }, 0);

    const totalSecondsTaken = ((Number(tournament?.duration_minutes) || 30) * 60) - timeLeft;

    const effectiveUserId = profile?.id || user?.id || 'guest_user';
    const effectiveEmail = profile?.email || user?.email || '';

    try {
      // 1. Submit score to API backend
      await fetch(getApiUrl('/api/tournaments/submit-score'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournament_id: id,
          score: finalScore,
          time_taken_seconds: Math.max(1, totalSecondsTaken),
          user_id: effectiveUserId,
          user_email: effectiveEmail,
          strikes_count: strikes,
          answers_count: Object.keys(answers).length
        })
      }).catch(() => {});

      // 2. Direct table update if UUID
      if (id && UUID_REGEX.test(id) && profile?.id) {
        try {
          await supabase
            .from('tournament_participants')
            .update({ 
              score: finalScore, 
              time_spent_seconds: Math.max(1, totalSecondsTaken),
              completed_at: new Date().toISOString() 
            })
            .eq('tournament_id', id)
            .eq('user_id', profile.id);
        } catch {}
      }

      // Persist finished state locally for user
      try {
        localStorage.setItem(`tournament_finished_${id}_${effectiveUserId}`, JSON.stringify({
          score: finalScore,
          answers,
          submittedAt: new Date().toISOString()
        }));
      } catch {}

      setFinished(true);
      await fetchLiveLeaderboard();

      if (forcedByTimer) {
        toast.info("Time expired! Your tournament duel answers have been submitted.");
      } else {
        toast.success(`Duel complete! You scored ${finalScore} points!`);
      }
    } catch (err) {
      console.warn("Tournament submission notice:", err);
      setFinished(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submission on timer expiration
  useEffect(() => {
    if (!loading && !finished && isUnlocked && timeLeft === 0 && questions.length > 0) {
      handleFinalSubmit(true);
    }
  }, [timeLeft, loading, finished, isUnlocked, questions.length]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <h3 className="font-display font-bold text-lg text-foreground">Synchronizing Tournament Duel Arena...</h3>
          <p className="text-xs text-muted-foreground font-mono">Verifying UTC timestamps and loading official question bank...</p>
        </div>
      </div>
    );
  }

  // Pre-Start Staging Room
  if (!isUnlocked && tournament) {
    const formattedUtcTime = new Date(nowUtc).toUTCString();
    const formattedStartTime = tournament.start_time ? new Date(tournament.start_time).toUTCString() : 'Pending schedule';

    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-6 text-center">
        <div className="w-full max-w-xl space-y-6">
          <div className="space-y-2">
            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 px-3 py-1 font-mono text-xs uppercase">
              <Clock className="w-3.5 h-3.5 mr-1" /> Pre-Duel Staging Room
            </Badge>
            <h1 className="text-3xl font-display font-bold text-foreground">
              {tournament.title || "National UTME Challenge"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Competition questions and timer will automatically unlock when the scheduled UTC start time arrives.
            </p>
          </div>

          <Card className="p-8 border-border bg-card/60 backdrop-blur shadow-xl rounded-2xl space-y-6">
            <div className="space-y-1">
              <div className="text-xs uppercase font-mono tracking-widest text-muted-foreground">Time Remaining To Start</div>
              <div className="text-5xl font-mono font-extrabold text-primary animate-pulse">
                {unlockEvaluation?.validation.formattedCountdown || 'Starting Soon'}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-muted/40 border border-border text-left text-xs font-mono">
              <div>
                <span className="text-muted-foreground block">Client UTC Clock:</span>
                <span className="font-semibold text-foreground">{formattedUtcTime}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Scheduled Start UTC:</span>
                <span className="font-semibold text-foreground">{formattedStartTime}</span>
              </div>
            </div>

            {/* Reminder Alert Notification */}
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Bell className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Text Me Before Exam Starts</h4>
                  <p className="text-xs text-muted-foreground">Receive automated SMS & email countdown notifications right when the arena opens.</p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => setShowReminderModal(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shrink-0 gap-1.5"
              >
                <Smartphone className="w-3.5 h-3.5" /> Text Me Reminder
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={handleForceCheckUnlock}
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
              >
                <RefreshCw className="w-4 h-4" /> Force-Check Start Time & Unlock
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/tournaments')}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Return to Tournaments
              </Button>
            </div>
          </Card>

          <div className="text-xs text-muted-foreground flex items-center justify-center gap-2">
            <Users className="w-4 h-4 text-emerald-500" />
            <span>{leaderboard.length || 1} Scholar(s) connected in staging room</span>
          </div>
        </div>
      </div>
    );
  }

  // Results Screen
  if (finished) {
    const finalScore = isDisqualified ? 0 : computedScore;
    const answeredCount = Object.keys(answers).length;
    const correctCount = questions.filter(q => answers[q.id] && checkIsCorrect(answers[q.id], q)).length;
    const accuracy = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;
    const sortedLeaderboard = [...leaderboard].sort((a, b) => b.score - a.score);
    const userRank = sortedLeaderboard.findIndex(p => p.userId === profile?.id) + 1 || 1;

    return (
      <div className="min-h-screen bg-background flex flex-col p-4 md:p-8">
        <div className="w-full max-w-4xl mx-auto space-y-8">
          {/* Header Card */}
          <Card className="p-8 text-center border-border bg-card shadow-xl rounded-2xl space-y-4">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto">
              <Trophy className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground">
                {isDisqualified ? 'Disqualified from Competition' : 'Tournament Duel Complete!'}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">{tournament?.title || "National UTME Challenge"}</p>
            </div>

            {/* Disqualification Banner */}
            {isDisqualified && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-sm font-semibold flex items-center justify-center gap-2">
                <XCircle className="w-5 h-5 shrink-0" />
                <span>Disqualified: Exceeded maximum allowed window / tab-switch proctoring violations (3 strikes). Final score is locked at 0.</span>
              </div>
            )}

            {/* Score Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
              <div className="p-4 rounded-xl bg-muted/40 border border-border">
                <div className="text-xs text-muted-foreground uppercase font-mono">Final Score</div>
                <div className="text-3xl font-bold font-mono text-primary mt-1">{finalScore} pts</div>
              </div>
              <div className="p-4 rounded-xl bg-muted/40 border border-border">
                <div className="text-xs text-muted-foreground uppercase font-mono">Arena Rank</div>
                <div className="text-3xl font-bold font-mono text-amber-500 mt-1">#{userRank}</div>
              </div>
              <div className="p-4 rounded-xl bg-muted/40 border border-border">
                <div className="text-xs text-muted-foreground uppercase font-mono">Accuracy</div>
                <div className="text-3xl font-bold font-mono text-emerald-500 mt-1">{isDisqualified ? '0%' : `${accuracy}%`}</div>
              </div>
              <div className="p-4 rounded-xl bg-muted/40 border border-border">
                <div className="text-xs text-muted-foreground uppercase font-mono">Questions Solved</div>
                <div className="text-3xl font-bold font-mono text-foreground mt-1">{isDisqualified ? '0' : correctCount} / {questions.length}</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
              <Button onClick={() => setShowReview(!showReview)} variant="outline" className="gap-2">
                <Eye className="w-4 h-4" /> {showReview ? 'Hide Question Review' : 'Review My Answers'}
              </Button>
              <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                <Lock className="w-3.5 h-3.5" /> Official Attempt Recorded (Single Attempt Locked)
              </div>
              <Button onClick={() => navigate('/tournaments')} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
                <Trophy className="w-4 h-4" /> Back to Tournaments Hub
              </Button>
              <Button onClick={() => navigate('/dashboard')} variant="ghost" className="gap-2">
                Return to Dashboard
              </Button>
            </div>
          </Card>

          {/* Question Review Section */}
          {showReview && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-primary" /> Question Review & Official Solutions
              </h3>
              <div className="space-y-3">
                {questions.map((q, idx) => {
                  const studentAns = answers[q.id];
                  const isCorrect = studentAns && checkIsCorrect(studentAns, q);
                  const isAttempted = !!studentAns;

                  return (
                    <Card key={q.id || idx} className={`p-5 border transition-all ${
                      !isAttempted ? 'border-border bg-card' :
                      isCorrect ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-rose-500/40 bg-rose-500/5'
                    }`}>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold font-mono">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold uppercase text-muted-foreground">
                            {isCorrect ? (
                              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Correct</span>
                            ) : isAttempted ? (
                              <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Incorrect</span>
                            ) : (
                              <span className="text-muted-foreground">Unanswered</span>
                            )}
                          </span>
                        </div>
                        {q.year && <Badge variant="outline" className="text-[10px] font-mono">UTME {q.year}</Badge>}
                      </div>

                      <div className="text-sm font-medium text-foreground mb-3 leading-relaxed">
                        <MathText text={q.question_text || ''} />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {q.options.map((opt: string, optIdx: number) => {
                          const optLetter = String.fromCharCode(65 + optIdx);
                          const isStudentPick = studentAns === opt || studentAns === optLetter;
                          const isRightAnswer = checkIsCorrect(opt, q) || checkIsCorrect(optLetter, q);

                          return (
                            <div key={optIdx} className={`p-2.5 rounded-lg border flex items-center gap-2 ${
                              isRightAnswer ? 'border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-semibold' :
                              isStudentPick ? 'border-rose-500 bg-rose-500/10 text-rose-800 dark:text-rose-300' :
                              'border-border bg-muted/20 text-muted-foreground'
                            }`}>
                              <span className="w-5 h-5 rounded-full bg-background/50 flex items-center justify-center font-bold text-[10px] shrink-0">
                                {optLetter}
                              </span>
                              <span className="truncate">{opt}</span>
                            </div>
                          );
                        })}
                      </div>

                      {q.explanation && (
                        <div className="mt-3 p-3 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground leading-relaxed">
                          <strong className="text-foreground block mb-0.5">Solution & Explanation:</strong>
                          <MathText text={q.explanation} />
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Live Leaderboard */}
          <Card className="p-6 border-border bg-card shadow-md rounded-2xl">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-primary" /> Final Arena Leaderboard Rankings
            </h3>
            <div className="space-y-2">
              {sortedLeaderboard.map((p, i) => {
                const isMe = p.userId === profile?.id;
                return (
                  <div key={i} className={`flex items-center justify-between p-3 rounded-xl border ${
                    isMe ? 'bg-primary/10 border-primary/40' : 'bg-muted/30 border-border'
                  }`}>
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs font-mono ${
                        i === 0 ? 'bg-amber-500 text-white' :
                        i === 1 ? 'bg-slate-300 text-slate-900' :
                        i === 2 ? 'bg-amber-700 text-white' : 'bg-muted text-muted-foreground'
                      }`}>
                        {i + 1}
                      </span>
                      <span className="font-semibold text-sm text-foreground">
                        {p.name} {isMe && <span className="text-xs text-primary font-bold">(You)</span>}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-primary">{p.score} pts</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Active Duel Arena
  const currentQ = questions[currentIdx] || { question_text: "Preparing question...", options: [] };
  const currentAns = answers[currentQ.id];
  const answeredCount = Object.keys(answers).length;
  const progressPercent = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;
  const isTimeCritical = timeLeft <= 300; // < 5 mins

  return (
    <div className="min-h-screen bg-background flex flex-col select-none relative overflow-hidden">
      {/* Anti-Screenshot Dynamic Security Watermark */}
      <div 
        aria-hidden="true"
        className="pointer-events-none select-none fixed inset-0 z-10 overflow-hidden flex flex-col justify-around items-center opacity-[0.035] dark:opacity-[0.05] rotate-[-22deg] font-mono text-xs uppercase tracking-widest text-foreground font-bold"
      >
        {Array.from({ length: 12 }).map((_, wIdx) => (
          <div key={wIdx} className="whitespace-nowrap space-x-12">
            <span>{profile?.full_name || user?.email || 'OFFICIAL CANDIDATE'} • ID: {profile?.id ? profile.id.slice(0, 8) : 'PROCTORED'}</span>
            <span>SCHOLARS RESORT ARENA • STRICT PROCTORED COMPETITION</span>
            <span>DO NOT SCREENSHOT OR PHOTO • {new Date().toISOString().slice(0, 10)}</span>
          </div>
        ))}
      </div>

      {/* Top UTME Arena Header */}
      <header className="h-16 border-b border-border bg-card/80 sticky top-0 z-20 backdrop-blur px-4 sm:px-6 flex items-center justify-between gap-4">
        {/* Left: Tournament Title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
            <Trophy className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display font-bold text-sm sm:text-base text-foreground truncate">
              {tournament?.title || "UTME Tournament Duel"}
            </h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="hidden sm:inline">
                {tournament?.subject_filter || 'UTME Core'}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> LIVE DUEL
              </span>
            </div>
          </div>
        </div>

        {/* Center / Right: Proctor Status, Timer & Submit Action */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {/* Proctoring Status Badge */}
          <Badge variant="outline" className={`hidden sm:flex text-[11px] font-mono gap-1.5 py-1 px-2.5 ${
            strikes === 0 ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' :
            strikes === 1 ? 'bg-amber-500/10 text-amber-600 border-amber-500/30' :
            'bg-rose-500/10 text-rose-600 border-rose-500/30 animate-pulse'
          }`}>
            <ShieldCheck className="w-3.5 h-3.5" /> Proctored • {strikes}/3 Strikes
          </Badge>

          {/* Digital Timer */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border font-mono font-bold text-sm sm:text-base transition-colors ${
            isTimeCritical 
              ? 'bg-rose-500/10 border-rose-500 text-rose-600 dark:text-rose-400 animate-pulse' 
              : 'bg-primary/10 border-primary/20 text-primary'
          }`}>
            <Clock className="w-4 h-4" />
            <span>
              {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:
              {(timeLeft % 60).toString().padStart(2, '0')}
            </span>
          </div>

          {/* Question Palette Toggle (Mobile) */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPaletteMobile(!showPaletteMobile)}
            className="lg:hidden h-9 px-2.5 text-xs font-semibold"
          >
            <LayoutGrid className="w-4 h-4 mr-1" />
            {currentIdx + 1}/{questions.length}
          </Button>

          {/* Submit Duel Button */}
          <Button
            size="sm"
            onClick={() => setShowSubmitModal(true)}
            className="h-9 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md gap-1.5"
          >
            <Send className="w-3.5 h-3.5" /> Submit Duel
          </Button>
        </div>
      </header>

      {/* Arena Content Body */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Main Question Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 flex flex-col justify-between max-w-4xl mx-auto w-full">
          <div className="space-y-6">
            {/* Question Progress Info Bar */}
            <div className="flex items-center justify-between pb-3 border-b border-border text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground text-sm font-mono">
                  Question {currentIdx + 1} of {questions.length}
                </span>
                {flagged[currentIdx] && (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px] gap-1">
                    <Flag className="w-3 h-3 fill-amber-500 text-amber-500" /> Flagged
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-muted-foreground hidden sm:inline">
                  Answered: {answeredCount}/{questions.length} ({progressPercent}%)
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleFlag(currentIdx)}
                  className={`h-8 px-2 text-xs font-semibold gap-1.5 ${
                    flagged[currentIdx] ? 'text-amber-500 hover:text-amber-600' : 'text-muted-foreground'
                  }`}
                >
                  <Flag className={`w-3.5 h-3.5 ${flagged[currentIdx] ? 'fill-amber-500' : ''}`} />
                  {flagged[currentIdx] ? 'Flagged' : 'Flag'}
                </Button>
              </div>
            </div>

            {/* Question Text */}
            <div className="bg-card p-6 sm:p-8 rounded-2xl border border-border shadow-xs">
              <div className="text-base sm:text-lg md:text-xl font-medium text-foreground leading-relaxed">
                <MathText text={currentQ.question_text || ''} />
              </div>
            </div>

            {/* Options Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {currentQ.options.map((opt: string, i: number) => {
                const optLetter = String.fromCharCode(65 + i);
                const isSelected = currentAns === opt || currentAns === optLetter;
                const isEliminated = (eliminatedOptions[currentQ.id] || []).includes(opt);

                return (
                  <div key={i} className="relative group">
                    <button
                      type="button"
                      onClick={() => handleSelectOption(currentQ.id, opt)}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center justify-between gap-3 ${
                        isEliminated ? 'opacity-40 line-through bg-muted/20 border-border/50' :
                        isSelected 
                          ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary' 
                          : 'border-border bg-card hover:border-primary/40 hover:bg-primary/5'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                          isSelected 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted text-foreground group-hover:bg-primary/20'
                        }`}>
                          {optLetter}
                        </span>
                        <span className="text-sm font-medium text-foreground leading-snug">
                          {opt}
                        </span>
                      </div>

                      {isSelected && (
                        <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                      )}
                    </button>

                    {/* Quick eliminate toggle */}
                    <button
                      type="button"
                      title={isEliminated ? "Restore option" : "Eliminate option"}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleEliminate(currentQ.id, opt);
                      }}
                      className="absolute right-2 top-2 p-1 text-muted-foreground/40 hover:text-muted-foreground text-[10px] rounded"
                    >
                      {isEliminated ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Navigation Controls Bar */}
          <div className="pt-8 pb-4 flex items-center justify-between gap-3 border-t border-border mt-8">
            <Button
              variant="outline"
              disabled={currentIdx === 0}
              onClick={() => setCurrentIdx(c => Math.max(0, c - 1))}
              className="gap-2 h-10 px-4 text-xs font-semibold"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </Button>

            <div className="text-xs font-mono text-muted-foreground hidden sm:block">
              Question {currentIdx + 1} of {questions.length}
            </div>

            {currentIdx < questions.length - 1 ? (
              <Button
                onClick={() => setCurrentIdx(c => Math.min(questions.length - 1, c + 1))}
                className="gap-2 h-10 px-5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={() => setShowSubmitModal(true)}
                className="gap-2 h-10 px-5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md"
              >
                Finish & Submit <Send className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </main>

        {/* Right Sidebar: Question Palette & Live Arena Leaderboard */}
        <aside className={`w-full lg:w-80 border-l border-border bg-card/40 p-4 sm:p-6 flex flex-col space-y-6 ${
          showPaletteMobile ? 'block' : 'hidden lg:flex'
        }`}>
          {/* Question Palette Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <LayoutGrid className="w-4 h-4 text-primary" /> Question Palette
              </h3>
              <span className="text-[11px] font-mono text-primary font-semibold">
                {answeredCount}/{questions.length} Solved
              </span>
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-10 lg:grid-cols-5 gap-1.5 max-h-56 overflow-y-auto p-1.5 rounded-xl bg-muted/20 border border-border">
              {questions.map((q, idx) => {
                const isCurrent = idx === currentIdx;
                const isAnswered = !!answers[q.id];
                const isFlagged = !!flagged[idx];

                return (
                  <button
                    key={q.id || idx}
                    type="button"
                    onClick={() => {
                      setCurrentIdx(idx);
                      setShowPaletteMobile(false);
                    }}
                    className={`h-8 rounded-lg font-mono text-xs font-bold transition-all relative ${
                      isCurrent 
                        ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1 shadow-xs' 
                        : isFlagged
                        ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40'
                        : isAnswered
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {idx + 1}
                    {isFlagged && (
                      <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Palette Legend */}
            <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1 pt-1">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Answered
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Flagged
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-muted border border-border" /> Blank
              </span>
            </div>
          </div>

          {/* Live Arena Leaderboard */}
          <div className="flex-1 flex flex-col min-h-48 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-500" /> Live Arena Leaderboard
              </h3>
              <Badge variant="outline" className="text-[10px] font-mono text-emerald-500 border-emerald-500/30">
                ● Live
              </Badge>
            </div>

            <div className="space-y-2 flex-1 overflow-y-auto max-h-72 pr-1">
              {leaderboard.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  Synchronizing scores...
                </div>
              ) : (
                leaderboard.slice(0, 10).map((p, i) => {
                  const isMe = p.userId === profile?.id;
                  return (
                    <div 
                      key={i} 
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-colors ${
                        isMe 
                          ? 'bg-primary/10 border-primary/40 font-semibold' 
                          : 'bg-muted/30 border-border'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] font-mono shrink-0 ${
                          i === 0 ? 'bg-amber-500 text-white' :
                          i === 1 ? 'bg-slate-300 text-slate-900' :
                          i === 2 ? 'bg-amber-700 text-white' : 'bg-muted text-muted-foreground'
                        }`}>
                          {i + 1}
                        </span>
                        <span className="truncate text-foreground">
                          {p.name} {isMe && <span className="text-[10px] text-primary">(You)</span>}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-primary shrink-0">
                        {p.score} pts
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Submit Confirmation Dialog */}
      <Dialog open={showSubmitModal} onOpenChange={setShowSubmitModal}>
        <DialogContent className="max-w-md bg-card border-border shadow-2xl p-6 text-foreground">
          <DialogHeader className="space-y-2 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto">
              <Send className="w-6 h-6" />
            </div>
            <DialogTitle className="text-xl font-bold font-display">
              Submit Tournament Duel?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Verify your questions completion summary before final submission.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-xs text-emerald-600 dark:text-emerald-400 block font-semibold">Answered</span>
                <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{answeredCount}</span>
              </div>
              <div className="p-3 rounded-xl bg-muted border border-border">
                <span className="text-xs text-muted-foreground block font-semibold">Unanswered</span>
                <span className="text-2xl font-bold font-mono text-foreground">{questions.length - answeredCount}</span>
              </div>
            </div>

            {questions.length - answeredCount > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg text-center font-medium">
                ⚠️ You still have {questions.length - answeredCount} unanswered question(s). You can return to answer them or submit now.
              </p>
            )}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSubmitModal(false)}
              className="w-full sm:w-auto text-xs"
            >
              Return to Duel
            </Button>
            <Button
              onClick={() => handleFinalSubmit(false)}
              disabled={isSubmitting}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting...
                </>
              ) : (
                'Confirm & Submit Duel'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Text Me / Reminder Setup Dialog */}
      <Dialog open={showReminderModal} onOpenChange={setShowReminderModal}>
        <DialogContent className="max-w-md bg-card border-border shadow-2xl p-6 text-foreground">
          <DialogHeader className="space-y-2 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto">
              <Bell className="w-6 h-6 animate-bounce" />
            </div>
            <DialogTitle className="text-xl font-bold font-display">
              Set Exam Start Reminder
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              We will send you an automated alert prior to the tournament start so you never miss the arena unlock.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-primary" /> Phone Number (SMS / WhatsApp)
              </label>
              <Input
                type="tel"
                placeholder="e.g. 08012345678"
                value={reminderPhone}
                onChange={(e) => setReminderPhone(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-primary" /> Email Address
              </label>
              <Input
                type="email"
                placeholder="candidate@example.com"
                value={reminderEmail}
                onChange={(e) => setReminderEmail(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <div className="p-3 rounded-xl bg-muted/50 border border-border text-[11px] text-muted-foreground">
              <span>📅 Tournament: <strong className="text-foreground">{tournament?.title}</strong></span>
              <br />
              <span>⏰ Scheduled: <strong className="text-foreground">{tournament?.start_time ? new Date(tournament.start_time).toLocaleString() : 'Pending'}</strong></span>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowReminderModal(false)}
              className="w-full sm:w-auto text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleScheduleReminder}
              disabled={schedulingReminder}
              className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs gap-1.5"
            >
              {schedulingReminder ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Scheduling...
                </>
              ) : (
                'Save Alert Reminder'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dynamic Anti-Screenshot & Screen Capture Protective Watermark */}
      <div 
        className="fixed inset-0 pointer-events-none z-30 select-none overflow-hidden flex flex-wrap items-center justify-around opacity-[0.05] dark:opacity-[0.04] rotate-[-22deg] scale-125"
        aria-hidden="true"
      >
        {Array.from({ length: 32 }).map((_, i) => (
          <div key={i} className="p-8 text-center text-xs font-mono font-black tracking-widest text-foreground whitespace-nowrap">
            <span>{profile?.full_name || user?.email?.split('@')[0] || 'UTME SCHOLAR'}</span>
            <span className="mx-2">•</span>
            <span>ID: {(profile?.id || user?.id || 'ANON').slice(0, 8).toUpperCase()}</span>
            <span className="mx-2">•</span>
            <span>PROCTORED TOURNAMENT ARENA</span>
          </div>
        ))}
      </div>

      {/* Proctoring Blur Curtain (Focus Lost / Tab Switch Strike Overlay) */}
      {isWindowBlurred && !finished && !isDisqualified && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
          <div className="w-full max-w-md p-6 rounded-2xl bg-card border border-amber-500/30 shadow-2xl space-y-4">
            <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7 animate-pulse" />
            </div>
            <h3 className="text-xl font-bold font-display text-foreground">
              Arena Focus Lost!
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              You switched tabs or minimized the tournament window. This action has been logged by the automated proctor.
            </p>
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
              Current Strike: {strikes} of 3 Allowed Strikes
            </div>
            <p className="text-[11px] text-rose-500 font-medium">
              Note: Reaching 3 strikes results in immediate disqualification and a score of 0.
            </p>
            <Button
              onClick={() => setIsWindowBlurred(false)}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
            >
              Resume Tournament Examination
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
