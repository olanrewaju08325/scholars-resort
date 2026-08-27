import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { safeSupabaseQuery, supabase } from '@/lib/safeSupabase';
import { DataSanitizer } from '@/utils/dataSanitizer';
import { useAuth } from '@/context/AuthContext';
import { calculateLevel } from '@/lib/gamification';
import { 
  Zap, Award, ChevronRight, Gift, 
  GraduationCap, BookOpen, Swords, Brain, Trophy, Crown, Sparkles 
} from 'lucide-react';

const ICON_MAP: Record<string, any> = {
  GraduationCap, BookOpen, Swords, Brain, Trophy, Crown, Zap, Sparkles
};

export const XPProgressPanel = () => {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveXp, setLiveXp] = useState<number>(profile?.xp || 0);

  const fetchTransactions = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const res = await safeSupabaseQuery(
      supabase
        .from('xp_transactions')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(4),
      {
        contextName: 'XPProgressPanel.fetchTransactions',
        sanitizer: (data) => DataSanitizer.sanitizeArray(data, DataSanitizer.sanitizeXPTransaction),
        fallbackValue: []
      }
    );
    setTransactions(res.data);
    setLoading(false);
  }, [profile?.id]);


  useEffect(() => {
    if (profile?.xp !== undefined) {
      setLiveXp(profile.xp);
    }
  }, [profile?.xp]);

  useEffect(() => {
    // Listen for real-time XP changes
    const handleXpUpdate = (e: any) => {
      if (e.detail?.xp !== undefined) {
        setLiveXp(e.detail.xp);
        fetchTransactions();
      }
    };
    window.addEventListener('user_xp_updated', handleXpUpdate);
    return () => window.removeEventListener('user_xp_updated', handleXpUpdate);
  }, [fetchTransactions]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const levelInfo = calculateLevel(liveXp);
  const LevelIcon = ICON_MAP[levelInfo.icon] || GraduationCap;

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="w-5 h-5 text-yellow-500 fill-yellow-500/20" /> Level & XP Journey
          </CardTitle>
          <span className="text-xs font-mono font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full">
            Level {levelInfo.level}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Level Hero Card */}
        <div className={`bg-gradient-to-br ${levelInfo.color} rounded-2xl p-4 text-white shadow-md relative overflow-hidden`}>
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl shadow-inner">
                <LevelIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-xs text-white/80 font-medium uppercase tracking-wider">Rank Distinction</div>
                <div className="font-extrabold text-lg leading-tight">{levelInfo.title}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black font-mono">{liveXp.toLocaleString()}</div>
              <div className="text-[11px] text-white/80 uppercase font-semibold">Total XP</div>
            </div>
          </div>

          {/* Progress bar inside card */}
          <div className="mt-4 pt-3 border-t border-white/15 relative z-10">
            <div className="flex justify-between text-xs text-white/90 mb-1.5 font-medium">
              <span>Progress to {levelInfo.nextTier ? `Level ${levelInfo.nextTier.level}: ${levelInfo.nextTier.title}` : 'Grandmaster'}</span>
              <span>{levelInfo.progressPercentage}%</span>
            </div>
            <div className="w-full bg-black/30 backdrop-blur-sm rounded-full h-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-white transition-all duration-700 shadow-sm"
                style={{ width: `${levelInfo.progressPercentage}%` }}
              />
            </div>
            {levelInfo.nextTier && (
              <div className="text-right text-[11px] text-white/80 mt-1">
                {levelInfo.xpRequiredForNext.toLocaleString()} XP remaining
              </div>
            )}
          </div>
        </div>

        {/* Current Level Perks */}
        <div className="bg-muted/40 rounded-xl p-3 border border-border/60 text-xs">
          <div className="font-semibold text-foreground flex items-center gap-1.5 mb-1">
            <Award className="w-4 h-4 text-primary" /> Active Tier Perks:
          </div>
          <p className="text-muted-foreground leading-relaxed">{levelInfo.perks}</p>
        </div>

        {/* Recent XP Activity */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Recent XP Earned</h4>
            <Link to="/journey-map" className="text-xs text-primary font-semibold hover:underline flex items-center">
              View All Badges <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {loading ? (
            <div className="text-center text-muted-foreground text-xs py-2">Loading activity...</div>
          ) : transactions.length === 0 ? (
            <div className="text-xs text-muted-foreground italic bg-muted/20 p-2.5 rounded-lg text-center">
              Complete a CBT mock exam or maintain your daily streak to earn XP!
            </div>
          ) : (
            <div className="space-y-1.5">
              {transactions.map(tx => (
                <div key={tx.id} className="flex justify-between items-center text-xs p-2 bg-muted/30 hover:bg-muted/50 rounded-lg transition-colors">
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <Gift className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-muted-foreground truncate">{tx.reason}</span>
                  </div>
                  <span className={`font-bold font-mono shrink-0 ${tx.amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount} XP
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
