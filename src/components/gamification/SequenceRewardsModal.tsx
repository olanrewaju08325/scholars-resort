import React, { useState, useEffect } from 'react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Flame, Coins, Zap, Trophy, ShieldCheck, Gift, CheckCircle2, Lock, 
  Sparkles, Shield, ArrowRight, RefreshCw, ShoppingBag, Star, PackageOpen
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { triggerConfetti } from '@/lib/celebration';
import { claimMysteryChest, type MysteryChestReward } from '@/lib/gamification';

interface SequenceRewardsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SequenceRewardsModal: React.FC<SequenceRewardsModalProps> = ({ open, onOpenChange }) => {
  const { profile, user, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'sequence' | 'store'>('sequence');
  const [redeemingItemId, setRedeemingItemId] = useState<string | null>(null);
  const [openingChestDay, setOpeningChestDay] = useState<number | null>(null);
  const [streakFreezes, setStreakFreezes] = useState<number>(0);
  const [tournamentPasses, setTournamentPasses] = useState<number>(0);
  const [openedChests, setOpenedChests] = useState<Record<number, boolean>>({});

  const streakDays = profile?.streak_days || 0;
  const scholarCoins = profile?.coins || 0;
  const userXp = profile?.xp || 0;

  useEffect(() => {
    if (user?.id) {
      const storedFreezes = localStorage.getItem(`scholar_streak_freezes_${user.id}`);
      setStreakFreezes(storedFreezes ? parseInt(storedFreezes, 10) : (profile?.streak_freezes || 1));

      const storedPasses = localStorage.getItem(`scholar_tournament_passes_${user.id}`);
      setTournamentPasses(storedPasses ? parseInt(storedPasses, 10) : 0);

      // Check opened chests
      const chestState: Record<number, boolean> = {};
      [3, 7, 14, 30].forEach(day => {
        chestState[day] = !!localStorage.getItem(`scholar_chest_claimed_${user.id}_day_${day}`);
      });
      setOpenedChests(chestState);
    }
  }, [user?.id, profile?.streak_freezes]);

  const sequenceMilestones = [
    { day: 1, title: 'Day 1: Kickoff', xp: 50, coins: 10, perk: 'Kickoff Scholar Badge', hasChest: false, isUnlocked: streakDays >= 1 },
    { day: 3, title: 'Day 3: Ignited Spark', xp: 150, coins: 60, perk: 'Mystery Chest: Speed Surge Booster', hasChest: true, isUnlocked: streakDays >= 3 },
    { day: 7, title: 'Day 7: Scholar Chest', xp: 350, coins: 150, perk: 'Mystery Chest: Free Tournament Pass 🎟️', hasChest: true, isUnlocked: streakDays >= 7 },
    { day: 14, title: 'Day 14: Habit Champion', xp: 750, coins: 300, perk: 'Mystery Chest: Streak Freeze Shield 🛡️', hasChest: true, isUnlocked: streakDays >= 14 },
    { day: 30, title: 'Day 30: Monthly Legend', xp: 1500, coins: 1000, perk: 'Mystery Chest: Scholarship Draw Ticket 🎓', hasChest: true, isUnlocked: streakDays >= 30 }
  ];

  const handleOpenChest = async (day: number) => {
    if (!user?.id) return;
    setOpeningChestDay(day);
    try {
      const res = await claimMysteryChest(user.id, day);
      if (res) {
        setOpenedChests(prev => ({ ...prev, [day]: true }));
        if (res.freezeGranted) {
          setStreakFreezes(prev => prev + 1);
        }
        if (res.passGranted) {
          setTournamentPasses(prev => prev + 1);
        }
        if (refreshProfile) refreshProfile();
        toast.success(`🎉 Day ${day} Mystery Chest Opened!`, {
          description: `Received +${res.xp} XP, +${res.coins} Coins & ${res.perkTitle}`,
          duration: 6000
        });
      }
    } catch {
      toast.error('Failed to open chest. Please try again.');
    } finally {
      setOpeningChestDay(null);
    }
  };

  const storeItems = [
    {
      id: 'tournament_pass',
      title: 'Free Tournament Entry Pass',
      description: 'Enter any paid cash/airtime tournament without paying real money.',
      cost: 300,
      icon: Trophy,
      iconColor: 'text-amber-500',
      tag: 'Most Popular'
    },
    {
      id: 'streak_freeze',
      title: 'Streak Freeze Shield',
      description: 'Protects your daily study sequence if you miss 1 day of practice.',
      cost: 200,
      icon: Shield,
      iconColor: 'text-blue-500',
      tag: 'Essential'
    },
    {
      id: 'ai_boost',
      title: 'AI Step-by-Step Solver Boost',
      description: '10 deep breakdown tokens for difficult calculations & derivations.',
      cost: 150,
      icon: Zap,
      iconColor: 'text-purple-500',
      tag: 'Study Aid'
    },
    {
      id: 'offline_pack',
      title: 'Complete Offline Subject Pack',
      description: 'Download full 10-year question banks directly to your phone.',
      cost: 500,
      icon: Sparkles,
      iconColor: 'text-emerald-500',
      tag: 'Offline'
    }
  ];

  const handleRedeem = async (item: typeof storeItems[0]) => {
    if (!user?.id) {
      toast.error('Please sign in to redeem rewards');
      return;
    }

    if (scholarCoins < item.cost) {
      toast.error(`Insufficient Scholar Coins! You need ${item.cost} coins (You have ${scholarCoins}). Practice daily to earn more!`);
      return;
    }

    setRedeemingItemId(item.id);
    try {
      const newCoins = scholarCoins - item.cost;
      
      // 1. Update in Supabase profiles
      await supabase.from('profiles').update({
        coins: newCoins,
        updated_at: new Date().toISOString()
      }).eq('id', user.id);

      // 2. Specific item actions
      if (item.id === 'streak_freeze') {
        const nextFreezes = streakFreezes + 1;
        setStreakFreezes(nextFreezes);
        localStorage.setItem(`scholar_streak_freezes_${user.id}`, nextFreezes.toString());
      } else if (item.id === 'tournament_pass') {
        const nextPasses = tournamentPasses + 1;
        setTournamentPasses(nextPasses);
        localStorage.setItem(`scholar_tournament_passes_${user.id}`, nextPasses.toString());
      }

      if (refreshProfile) refreshProfile();
      triggerConfetti();
      toast.success(`Successfully Redeemed: ${item.title}!`, {
        description: `Deducted ${item.cost} Coins. Remaining Balance: ${newCoins} Coins.`,
        duration: 5000
      });
    } catch (e) {
      toast.error('Redemption failed. Please try again.');
    } finally {
      setRedeemingItemId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl w-[95vw] sm:w-full p-0 overflow-hidden rounded-2xl border-border bg-card shadow-2xl">
        {/* Top Summary Banner */}
        <div className="bg-gradient-to-r from-amber-500/15 via-primary/15 to-orange-500/15 p-5 sm:p-6 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Flame className="w-4 h-4 fill-amber-500 text-amber-500" />
                  Study Sequence & Rewards Hub
                </span>
              </div>
              <DialogTitle className="text-xl font-bold font-display text-foreground">
                Your Learning Streak & Rewards
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Practice 5 questions daily to keep your sequence alive and open Mystery Reward Chests.
              </DialogDescription>
            </div>

            {/* Quick Stats Pill */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="px-3 py-1.5 rounded-xl bg-card border border-border/80 shadow-xs flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
                <div className="text-left">
                  <div className="text-xs font-extrabold text-foreground">{streakDays} Days</div>
                  <div className="text-[9px] text-muted-foreground uppercase font-semibold">Sequence</div>
                </div>
              </div>

              <div className="px-3 py-1.5 rounded-xl bg-card border border-border/80 shadow-xs flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-500" />
                <div className="text-left">
                  <div className="text-xs font-extrabold text-amber-600 dark:text-amber-400">{scholarCoins}</div>
                  <div className="text-[9px] text-muted-foreground uppercase font-semibold">Coins</div>
                </div>
              </div>

              {tournamentPasses > 0 && (
                <div className="px-3 py-1.5 rounded-xl bg-card border border-emerald-500/30 shadow-xs flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-emerald-500" />
                  <div className="text-left">
                    <div className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">{tournamentPasses}</div>
                    <div className="text-[9px] text-muted-foreground uppercase font-semibold">Arena Passes</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-2 mt-5 border-t border-border/60 pt-3">
            <button
              onClick={() => setActiveTab('sequence')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'sequence'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              Daily Sequence & Mystery Chests
            </button>
            <button
              onClick={() => setActiveTab('store')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'store'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              Scholar Coin Store
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-5 sm:p-6 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-4">
          {activeTab === 'sequence' ? (
            <div className="space-y-4">
              {/* Streak Protection Shield Card */}
              <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400 shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">Streak Freeze Shield</h4>
                    <p className="text-[11px] text-muted-foreground">
                      {streakFreezes > 0 
                        ? `You have ${streakFreezes} Shield(s) active. You are protected from 1 missed study day!`
                        : 'No active shields. Keep practicing or get one in the Coin Store to safeguard your streak.'}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveTab('store')}
                  className="text-xs font-bold h-8 border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 shrink-0"
                >
                  {streakFreezes > 0 ? 'Add More' : 'Get Shield'}
                </Button>
              </div>

              {/* Milestone Ladder */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Sequence Milestones & Mystery Chests</span>
                  <span className="text-[11px] font-normal text-muted-foreground">Tap unlocked chest to claim</span>
                </h4>

                {sequenceMilestones.map((m) => {
                  const isClaimed = openedChests[m.day];
                  const canOpen = m.hasChest && m.isUnlocked && !isClaimed;

                  return (
                    <div
                      key={m.day}
                      className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                        canOpen
                          ? 'bg-amber-500/15 border-amber-500/50 shadow-sm animate-pulse'
                          : m.isUnlocked
                          ? 'bg-amber-500/10 border-amber-500/30'
                          : 'bg-muted/30 border-border opacity-80'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                          m.isUnlocked 
                            ? 'bg-amber-500 text-slate-950 shadow-xs' 
                            : 'bg-muted text-muted-foreground border border-border'
                        }`}>
                          {m.isUnlocked ? <CheckCircle2 className="w-4 h-4" /> : m.day}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-foreground">{m.title}</span>
                            {canOpen && (
                              <span className="text-[10px] px-2 py-0.2 rounded-full font-bold bg-amber-500 text-slate-950 animate-bounce">
                                Ready to Open!
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Reward: <strong className="text-foreground">+{m.xp} XP</strong> • <strong className="text-amber-600 dark:text-amber-400">+{m.coins} Coins</strong> • {m.perk}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        {canOpen ? (
                          <Button
                            size="sm"
                            onClick={() => handleOpenChest(m.day)}
                            disabled={openingChestDay === m.day}
                            className="h-8 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 gap-1.5 shadow-xs"
                          >
                            {openingChestDay === m.day ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <PackageOpen className="w-3.5 h-3.5" />
                            )}
                            Open Chest
                          </Button>
                        ) : m.isUnlocked ? (
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" /> Claimed
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                            <Lock className="w-3.5 h-3.5" /> Day {m.day}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Redeem Rewards with Scholar Coins
                </h4>
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5" /> Your Balance: {scholarCoins} Coins
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {storeItems.map((item) => {
                  const ItemIcon = item.icon;
                  const canAfford = scholarCoins >= item.cost;
                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-2xl bg-muted/40 border border-border flex flex-col justify-between gap-3 relative group hover:border-primary/40 transition-all"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className={`p-2 rounded-xl bg-card border border-border/60 ${item.iconColor}`}>
                            <ItemIcon className="w-5 h-5" />
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                            {item.tag}
                          </span>
                        </div>

                        <div>
                          <h5 className="text-xs font-bold text-foreground">{item.title}</h5>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{item.description}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border/60">
                        <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1 font-mono">
                          <Coins className="w-3.5 h-3.5" /> {item.cost} Coins
                        </span>

                        <Button
                          size="sm"
                          disabled={!canAfford || redeemingItemId === item.id}
                          onClick={() => handleRedeem(item)}
                          className={`h-7 px-3 text-xs font-bold ${
                            canAfford 
                              ? 'bg-primary text-primary-foreground shadow-xs' 
                              : 'bg-muted text-muted-foreground cursor-not-allowed'
                          }`}
                        >
                          {redeemingItemId === item.id ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : canAfford ? (
                            'Redeem'
                          ) : (
                            'Need Coins'
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-muted/30 border-t border-border flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            Complete your daily 5-question drill on the Dashboard to earn +50 XP and +10 Coins today.
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs font-semibold"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
