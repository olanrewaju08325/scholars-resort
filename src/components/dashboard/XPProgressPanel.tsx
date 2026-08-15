import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Zap, TrendingUp, Gift, Star, Clock } from 'lucide-react';

export const XPProgressPanel = () => {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.id) fetchTransactions();
  }, [profile?.id]);

  const fetchTransactions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('xp_transactions')
      .select('*')
      .eq('user_id', profile!.id)
      .order('created_at', { ascending: false })
      .limit(5);
    if (data) setTransactions(data);
    setLoading(false);
  };

  const xp = profile?.xp || 0;
  
  // XP levels
  const levels = [
    { name: 'Beginner', min: 0, max: 500, color: 'from-slate-400 to-slate-600' },
    { name: 'Scholar', min: 500, max: 2000, color: 'from-blue-400 to-blue-600' },
    { name: 'Expert', min: 2000, max: 5000, color: 'from-purple-400 to-purple-600' },
    { name: 'Elite', min: 5000, max: 10000, color: 'from-amber-400 to-orange-600' },
    { name: 'Champion', min: 10000, max: Infinity, color: 'from-yellow-400 to-yellow-600' },
  ];

  const currentLevel = levels.find(l => xp >= l.min && xp < l.max) || levels[0];
  const nextLevel = levels[levels.indexOf(currentLevel) + 1];
  
  const progressToNextLevel = nextLevel
    ? Math.min(100, ((xp - currentLevel.min) / (nextLevel.min - currentLevel.min)) * 100)
    : 100;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="w-5 h-5 text-yellow-500" /> XP & Level Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Level Badge */}
        <div className={`bg-gradient-to-br ${currentLevel.color} rounded-xl p-4 text-white text-center`}>
          <Star className="w-6 h-6 mx-auto mb-1" />
          <div className="font-black text-xl">{currentLevel.name}</div>
          <div className="text-sm opacity-80 font-mono">{xp.toLocaleString()} XP</div>
        </div>

        {/* Progress to next level */}
        {nextLevel && (
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span className="font-medium">{currentLevel.name}</span>
              <span className="font-medium">{nextLevel?.name} ({nextLevel?.min.toLocaleString()} XP)</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${currentLevel.color} transition-all duration-700`}
                style={{ width: `${progressToNextLevel}%` }}
              />
            </div>
            <div className="text-right text-xs text-muted-foreground mt-1">
              {Math.round(progressToNextLevel)}% to {nextLevel?.name}
            </div>
          </div>
        )}

        {/* Recent XP Transactions */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Recent Activity</h4>
          {loading ? (
            <div className="text-center text-muted-foreground text-sm py-2">Loading...</div>
          ) : transactions.length === 0 ? (
            <div className="text-sm text-muted-foreground italic">No XP earned yet. Take an exam!</div>
          ) : (
            <div className="space-y-2">
              {transactions.map(tx => (
                <div key={tx.id} className="flex justify-between items-center text-sm p-2 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Gift className="w-3 h-3 text-primary shrink-0" />
                    <span className="text-muted-foreground text-xs line-clamp-1">{tx.reason}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`font-bold text-xs ${tx.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount} XP
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
