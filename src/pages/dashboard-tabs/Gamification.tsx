import { useState, useEffect, useCallback } from 'react';
import { Trophy, Flame, Zap, Star, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const ICONS: Record<string, any> = {
  'Trophy': Trophy,
  'Flame': Flame,
  'Zap': Zap,
  'Star': Star,
};

export const Gamification = () => {
  const { profile } = useAuth();
  const [badges, setBadges] = useState<any[]>([]);
  const [userBadges, setUserBadges] = useState<any[]>([]);
  const [userXP, setUserXP] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchGamificationData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);

    try {
      // Fetch all available badges
      const { data: allBadges } = await supabase.from('badges').select('*').order('created_at', { ascending: true });
      if (allBadges) setBadges(allBadges);

      // Fetch badges earned by user
      const { data: earned } = await supabase.from('user_badges').select('badge_id, earned_at').eq('student_id', profile.id);
      if (earned) setUserBadges(earned);

      // Fetch user XP
      const { data: userData } = await supabase.from('profiles').select('xp').eq('id', profile.id).single();
      if (userData?.xp) setUserXP(userData.xp);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    fetchGamificationData();
  }, [profile, fetchGamificationData]);

  const hasBadge = (badgeId: string) => {
    return userBadges.some(ub => ub.badge_id === badgeId);
  };

  if (loading) {
    return <div className="animate-pulse flex space-x-4"><div className="flex-1 space-y-4 py-1"><div className="h-4 bg-muted rounded w-3/4"></div></div></div>;
  }

  return (
    <Card className="bg-card border-border shadow-sm relative overflow-hidden">
      {/* Glow effect */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
      
      <CardHeader>
        <CardTitle className="flex items-center justify-between font-display text-2xl">
          <div className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-primary" />
            Academic Journey
          </div>
          <span className="text-sm font-mono bg-primary/20 text-primary px-3 py-1 rounded-full">
            {userXP} XP
          </span>
        </CardTitle>
        <CardDescription className="text-muted-foreground">Level up by completing CBT exams and maintaining your streak.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Academic Level UI */}
        <div className="bg-background rounded-2xl p-5 mb-8 border border-border shadow-sm relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center justify-between mb-2 relative z-10">
            <span className="font-bold text-lg text-foreground">
              {userXP >= 5000 ? 'Master' : userXP >= 1000 ? 'Scholar' : 'Beginner'}
            </span>
            <span className="text-xs font-semibold text-muted-foreground">
              {userXP >= 5000 ? 'Max Level' : `Next: ${userXP >= 1000 ? 5000 : 1000} XP`}
            </span>
          </div>
          <div className="w-full h-3 bg-muted rounded-full overflow-hidden relative z-10">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-primary rounded-full transition-all duration-1000"
              style={{ width: `${userXP >= 5000 ? 100 : userXP >= 1000 ? ((userXP - 1000) / 4000) * 100 : (userXP / 1000) * 100}%` }}
            />
          </div>
        </div>

        <h3 className="font-bold mb-4 flex items-center gap-2 text-foreground">
          <Star className="w-4 h-4 text-yellow-500" /> Unlockable Achievements
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {badges.map((badge) => {
            const unlocked = hasBadge(badge.id);
            const Icon = ICONS[badge.icon] || Trophy;
            
            return (
              <div 
                key={badge.id}
                className={`relative group p-4 rounded-2xl border flex flex-col items-center text-center transition-all duration-300 ${
                  unlocked 
                    ? 'bg-card border-primary/30 shadow-premium hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]' 
                    : 'bg-muted/30 border-border opacity-75 grayscale hover:grayscale-0'
                }`}
              >
                {!unlocked && (
                  <div className="absolute top-3 right-3 text-muted-foreground">
                    <Lock className="w-4 h-4" />
                  </div>
                )}
                
                <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 transition-transform group-hover:scale-110 shadow-sm border ${
                  unlocked ? 'bg-primary/10 text-primary border-primary/30' : 'bg-muted text-muted-foreground border-border/50'
                }`}>
                  <Icon className={`w-7 h-7 ${unlocked && badge.icon === 'Flame' ? 'text-orange-500' : ''} ${unlocked && badge.icon === 'Trophy' ? 'text-yellow-500' : ''} ${unlocked && badge.icon === 'Zap' ? 'text-blue-500' : ''}`} />
                </div>
                
                <h4 className={`font-bold text-sm mb-1 ${unlocked ? 'text-foreground' : 'text-muted-foreground'}`}>{badge.name}</h4>
                <p className="text-[10px] text-muted-foreground line-clamp-2">{badge.description}</p>
                
                {unlocked && (
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/0 via-primary/10 to-primary/0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none animate-pulse"></div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
