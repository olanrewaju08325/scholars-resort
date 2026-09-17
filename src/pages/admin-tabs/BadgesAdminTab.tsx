import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { 
  Trophy, Plus, Trash2, Edit2, Save, RefreshCw, Award, CheckCircle, Star, 
  Flame, Coins, Shield, Sparkles, Sliders, Gift, HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { DeleteConfirmationDialog } from '@/components/DeleteConfirmationDialog';
import { logAdminActivity } from '@/services/adminActivityService';
import { authFetch } from '@/lib/apiAuth';

export const BadgesAdminTab = () => {
  const [activeSubTab, setActiveSubTab] = useState<'settings' | 'badges'>('settings');
  const [badges, setBadges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Gamification Settings State
  const [gamificationSettings, setGamificationSettings] = useState({
    dailyDrillXp: 50,
    dailyDrillCoins: 10,
    streakMultiplierXp: 10,
    streakFreezeCost: 200,
    tournamentPassCost: 300,
    mysteryBox3DayXp: 150,
    mysteryBox3DayCoins: 60,
    mysteryBox7DayXp: 350,
    mysteryBox7DayCoins: 150,
    mysteryBox14DayXp: 750,
    mysteryBox14DayCoins: 300,
    mysteryBox30DayXp: 1500,
    mysteryBox30DayCoins: 1000
  });

  // Badge Form State
  const [isEditing, setIsEditing] = useState(false);
  const [currentBadgeId, setCurrentBadgeId] = useState<string | null>(null);
  const [badgeKey, setBadgeKey] = useState('');
  const [badgeName, setBadgeName] = useState('');
  const [badgeDescription, setBadgeDescription] = useState('');
  const [xpThreshold, setXpThreshold] = useState(500);
  const [badgeIcon, setBadgeIcon] = useState('Trophy');
  const [badgeCategory, setBadgeCategory] = useState('Achievement');

  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; id: string | null; name: string }>({
    isOpen: false,
    id: null,
    name: ''
  });

  const fetchData = async () => {
    setLoading(true);

    // Fetch Gamification Config
    try {
      const { data: configData } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'gamification_engine_config')
        .maybeSingle();

      if (configData?.setting_value && typeof configData.setting_value === 'object') {
        setGamificationSettings(prev => ({ ...prev, ...configData.setting_value }));
      }
    } catch (_) {}

    // Fetch Badges
    try {
      const { data: settingData } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'gamification_badges_config')
        .maybeSingle();

      if (settingData?.setting_value && Array.isArray(settingData.setting_value) && settingData.setting_value.length > 0) {
        setBadges(settingData.setting_value);
        setLoading(false);
        return;
      }
    } catch (_) {}

    try {
      const { safeSupabaseQuery } = await import('@/lib/safeSupabase');
      const res = await safeSupabaseQuery<any[]>(
        supabase.from('badges').select('*'),
        { contextName: 'BadgesAdminTab', fallbackValue: [] }
      );
      if (res.data && res.data.length > 0) {
        setBadges(res.data);
        setLoading(false);
        return;
      }
    } catch (_) {}

    // Default seed badges
    const defaultBadges = [
      { id: 'b_1', badge_key: 'first_exam', name: 'First Step Scholar', description: 'Complete your very first CBT mock exam', xp_threshold: 100, icon: 'Award', category: 'Milestone' },
      { id: 'b_2', badge_key: 'streak_3', name: 'Consistent Streak', description: 'Maintain a 3-day active study streak', xp_threshold: 300, icon: 'Flame', category: 'Consistency' },
      { id: 'b_3', badge_key: 'score_300', name: 'JAMB 300+ Club', description: 'Score 300 or above in any official JAMB mock exam', xp_threshold: 1000, icon: 'Trophy', category: 'Excellence' },
      { id: 'b_4', badge_key: 'master_math', name: 'Math Wizard', description: 'Complete 50 mathematics practice questions accurately', xp_threshold: 750, icon: 'Zap', category: 'Mastery' }
    ];
    setBadges(defaultBadges);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await supabase.from('admin_settings').upsert({
        setting_key: 'gamification_engine_config',
        setting_value: gamificationSettings,
        updated_at: new Date().toISOString()
      }, { onConflict: 'setting_key' });

      localStorage.setItem('scholar_gamification_config', JSON.stringify(gamificationSettings));
      toast.success('Gamification Engine Settings saved successfully!');
      logAdminActivity('Update Gamification Settings', 'Adjusted study sequence multipliers and mystery box reward values');
    } catch (err: any) {
      toast.error(`Failed to save settings: ${err.message}`);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveBadge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!badgeName.trim() || !badgeKey.trim()) {
      toast.error('Badge key and name are required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        badge_key: badgeKey.trim().toLowerCase().replace(/\s+/g, '_'),
        name: badgeName.trim(),
        description: badgeDescription.trim(),
        xp_threshold: Number(xpThreshold) || 0,
        icon: badgeIcon,
        category: badgeCategory,
        updated_at: new Date().toISOString()
      };

      const updatedList = currentBadgeId 
        ? badges.map(b => b.id === currentBadgeId ? { ...b, ...payload } : b)
        : [...badges, { id: crypto.randomUUID(), ...payload, created_at: new Date().toISOString() }];

      // Save to Supabase admin_settings
      try {
        await authFetch('/api/settings/gamification_badges_config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: updatedList })
        });
        await supabase.from('admin_settings').upsert({
          setting_key: 'gamification_badges_config',
          setting_value: updatedList,
          updated_at: new Date().toISOString()
        }, { onConflict: 'setting_key' });
      } catch (err) {
        console.warn('Failed to sync badges to admin_settings:', err);
      }

      setBadges(updatedList);
      localStorage.setItem('scholar_custom_badges', JSON.stringify(updatedList));
      toast.success('Badge criteria saved successfully!');
      logAdminActivity('Update Badge Criteria', `Saved criteria for badge "${badgeName}"`);
      resetForm();
    } catch (err: any) {
      toast.error(`Failed to save badge: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setIsEditing(false);
    setCurrentBadgeId(null);
    setBadgeKey('');
    setBadgeName('');
    setBadgeDescription('');
    setXpThreshold(500);
    setBadgeIcon('Trophy');
    setBadgeCategory('Achievement');
  };

  const handleEdit = (badge: any) => {
    setIsEditing(true);
    setCurrentBadgeId(badge.id);
    setBadgeKey(badge.badge_key || '');
    setBadgeName(badge.name || '');
    setBadgeDescription(badge.description || '');
    setXpThreshold(badge.xp_threshold || 500);
    setBadgeIcon(badge.icon || 'Trophy');
    setBadgeCategory(badge.category || 'Achievement');
  };

  const confirmDelete = (id: string, name: string) => {
    setDeleteDialog({ isOpen: true, id, name });
  };

  const handleDelete = async () => {
    if (!deleteDialog.id) return;
    try {
      const updatedList = badges.filter(b => b.id !== deleteDialog.id);
      setBadges(updatedList);
      localStorage.setItem('scholar_custom_badges', JSON.stringify(updatedList));
      
      try {
        await authFetch('/api/settings/gamification_badges_config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: updatedList })
        });
        await supabase.from('admin_settings').upsert({
          setting_key: 'gamification_badges_config',
          setting_value: updatedList,
          updated_at: new Date().toISOString()
        }, { onConflict: 'setting_key' });
      } catch {}

      toast.success('Badge definition deleted successfully.');
      logAdminActivity('Delete Badge', `Deleted badge ID ${deleteDialog.id}`);
    } catch (err: any) {
      toast.error(`Error deleting badge: ${err.message}`);
    } finally {
      setDeleteDialog({ isOpen: false, id: null, name: '' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground font-display flex items-center gap-2">
            <Flame className="w-6 h-6 text-amber-500" />
            Gamification & Sequence Engine
          </h2>
          <p className="text-muted-foreground text-sm">
            Control study sequences, daily streak multipliers, Mystery Chest rewards, and achievement badges.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
          {activeSubTab === 'badges' && !isEditing && (
            <Button size="sm" onClick={() => { resetForm(); setIsEditing(true); }}>
              <Plus className="w-4 h-4 mr-2" /> Create Badge
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-3">
        <button
          onClick={() => setActiveSubTab('settings')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'settings'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sliders className="w-4 h-4" /> Sequence & Rewards Matrix
        </button>
        <button
          onClick={() => setActiveSubTab('badges')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'badges'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          <Trophy className="w-4 h-4" /> Achievement Badges Catalog ({badges.length})
        </button>
      </div>

      {/* TAB 1: GAMIFICATION SETTINGS */}
      {activeSubTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Daily Streak & Multipliers */}
            <Card className="border-border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-500" /> Daily Drill & Multipliers
                </CardTitle>
                <CardDescription className="text-xs">
                  Rewards granted when students complete their 5-question daily streak lock.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Base Daily Drill XP</label>
                  <Input
                    type="number"
                    value={gamificationSettings.dailyDrillXp}
                    onChange={e => setGamificationSettings(prev => ({ ...prev, dailyDrillXp: Number(e.target.value) }))}
                    className="h-9 text-xs"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">Standard XP awarded for completing the daily drill.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Base Daily Drill Coins</label>
                  <Input
                    type="number"
                    value={gamificationSettings.dailyDrillCoins}
                    onChange={e => setGamificationSettings(prev => ({ ...prev, dailyDrillCoins: Number(e.target.value) }))}
                    className="h-9 text-xs"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">Coins awarded to the student's wallet per completed day.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Streak Multiplier Bonus (XP per consecutive day)</label>
                  <Input
                    type="number"
                    value={gamificationSettings.streakMultiplierXp}
                    onChange={e => setGamificationSettings(prev => ({ ...prev, streakMultiplierXp: Number(e.target.value) }))}
                    className="h-9 text-xs"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">e.g. 10 means a 5-day streak earns +50 extra bonus XP.</p>
                </div>
              </CardContent>
            </Card>

            {/* Economy & Store Rates */}
            <Card className="border-border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-500" /> Scholar Coin Store Pricing
                </CardTitle>
                <CardDescription className="text-xs">
                  Set coin redemption costs for perks and tournament passes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Streak Freeze Shield Cost (Coins)</label>
                  <Input
                    type="number"
                    value={gamificationSettings.streakFreezeCost}
                    onChange={e => setGamificationSettings(prev => ({ ...prev, streakFreezeCost: Number(e.target.value) }))}
                    className="h-9 text-xs"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">Coins needed to buy 1 shield to protect a missed study day.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Free Tournament Pass Cost (Coins)</label>
                  <Input
                    type="number"
                    value={gamificationSettings.tournamentPassCost}
                    onChange={e => setGamificationSettings(prev => ({ ...prev, tournamentPassCost: Number(e.target.value) }))}
                    className="h-9 text-xs"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">Coins required to redeem a free ticket to paid arena tournaments.</p>
                </div>
              </CardContent>
            </Card>

            {/* Mystery Chests Rewards Matrix */}
            <Card className="border-border bg-card shadow-sm md:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <Gift className="w-4 h-4 text-emerald-500" /> Mystery Chest Milestone Rewards Matrix
                </CardTitle>
                <CardDescription className="text-xs">
                  Set the XP, Coins, and automatic item drops when students reach consecutive study milestones.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                
                {/* Day 3 */}
                <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">Day 3 Chest</span>
                    <span className="text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold px-2 py-0.5 rounded-full">Spark</span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="text-[11px] text-muted-foreground">XP Reward</label>
                      <Input
                        type="number"
                        value={gamificationSettings.mysteryBox3DayXp}
                        onChange={e => setGamificationSettings(prev => ({ ...prev, mysteryBox3DayXp: Number(e.target.value) }))}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground">Coins Reward</label>
                      <Input
                        type="number"
                        value={gamificationSettings.mysteryBox3DayCoins}
                        onChange={e => setGamificationSettings(prev => ({ ...prev, mysteryBox3DayCoins: Number(e.target.value) }))}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Day 7 */}
                <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">Day 7 Chest</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-full">+1 Tourney Pass 🎟️</span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="text-[11px] text-muted-foreground">XP Reward</label>
                      <Input
                        type="number"
                        value={gamificationSettings.mysteryBox7DayXp}
                        onChange={e => setGamificationSettings(prev => ({ ...prev, mysteryBox7DayXp: Number(e.target.value) }))}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground">Coins Reward</label>
                      <Input
                        type="number"
                        value={gamificationSettings.mysteryBox7DayCoins}
                        onChange={e => setGamificationSettings(prev => ({ ...prev, mysteryBox7DayCoins: Number(e.target.value) }))}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Day 14 */}
                <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">Day 14 Chest</span>
                    <span className="text-[10px] bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold px-2 py-0.5 rounded-full">+1 Streak Freeze 🛡️</span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="text-[11px] text-muted-foreground">XP Reward</label>
                      <Input
                        type="number"
                        value={gamificationSettings.mysteryBox14DayXp}
                        onChange={e => setGamificationSettings(prev => ({ ...prev, mysteryBox14DayXp: Number(e.target.value) }))}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground">Coins Reward</label>
                      <Input
                        type="number"
                        value={gamificationSettings.mysteryBox14DayCoins}
                        onChange={e => setGamificationSettings(prev => ({ ...prev, mysteryBox14DayCoins: Number(e.target.value) }))}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Day 30 */}
                <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">Day 30 Legend Chest</span>
                    <span className="text-[10px] bg-purple-500/20 text-purple-600 dark:text-purple-400 font-bold px-2 py-0.5 rounded-full">Scholarship Ticket 🎓</span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="text-[11px] text-muted-foreground">XP Reward</label>
                      <Input
                        type="number"
                        value={gamificationSettings.mysteryBox30DayXp}
                        onChange={e => setGamificationSettings(prev => ({ ...prev, mysteryBox30DayXp: Number(e.target.value) }))}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground">Coins Reward</label>
                      <Input
                        type="number"
                        value={gamificationSettings.mysteryBox30DayCoins}
                        onChange={e => setGamificationSettings(prev => ({ ...prev, mysteryBox30DayCoins: Number(e.target.value) }))}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>

              </CardContent>
            </Card>

          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={savingSettings} className="gap-2 font-bold px-6">
              <Save className="w-4 h-4" /> {savingSettings ? 'Saving...' : 'Save Gamification Matrix'}
            </Button>
          </div>
        </form>
      )}

      {/* TAB 2: BADGES CRUD */}
      {activeSubTab === 'badges' && (
        <div className="space-y-6">
          {isEditing && (
            <Card className="border-primary/50 shadow-md bg-card">
              <CardHeader>
                <CardTitle>{currentBadgeId ? 'Edit Badge Criteria' : 'Create New Gamification Badge'}</CardTitle>
                <CardDescription>Define badge requirements, category, and minimum XP or milestone criteria.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveBadge} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Badge Key Identifier</label>
                      <Input 
                        value={badgeKey} 
                        onChange={e => setBadgeKey(e.target.value)} 
                        placeholder="e.g. physics_master" 
                        required 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Badge Display Name</label>
                      <Input 
                        value={badgeName} 
                        onChange={e => setBadgeName(e.target.value)} 
                        placeholder="e.g. Physics Grandmaster" 
                        required 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Category</label>
                      <Input 
                        value={badgeCategory} 
                        onChange={e => setBadgeCategory(e.target.value)} 
                        placeholder="e.g. Mastery, Milestone" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Description & Requirements</label>
                      <Input 
                        value={badgeDescription} 
                        onChange={e => setBadgeDescription(e.target.value)} 
                        placeholder="Explain how students earn this badge..." 
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">XP Reward / Threshold Requirement</label>
                      <Input 
                        type="number"
                        value={xpThreshold} 
                        onChange={e => setXpThreshold(Number(e.target.value))} 
                        placeholder="e.g. 500" 
                        required
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                    <Button type="submit" disabled={saving}>
                      <Save className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : 'Save Badge Criteria'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Badges Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              <div className="col-span-full text-center py-12 text-muted-foreground">Loading gamification badges...</div>
            ) : badges.length === 0 ? (
              <div className="col-span-full text-center py-12 text-muted-foreground">No badges configured yet.</div>
            ) : (
              badges.map((badge) => (
                <Card key={badge.id || badge.badge_key} className="border border-border bg-card shadow-sm hover:border-primary/40 transition-all flex flex-col justify-between">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 font-bold">
                          <Trophy className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground text-base">{badge.name}</h3>
                          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-primary/10 text-primary">
                            {badge.category || 'Achievement'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">{badge.description}</p>

                    <div className="flex items-center justify-between pt-2 border-t border-border text-xs text-muted-foreground">
                      <span>Requirement: <strong className="text-foreground">{badge.xp_threshold} XP</strong></span>
                      <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">{badge.badge_key}</span>
                    </div>
                  </CardContent>

                  <div className="p-3 bg-muted/20 border-t border-border flex items-center justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(badge)}>
                      <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => confirmDelete(badge.id, badge.name)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      <DeleteConfirmationDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, id: null, name: '' })}
        onConfirm={handleDelete}
        title="Delete Badge Definition"
        description={`Are you sure you want to delete the badge "${deleteDialog.name}"?`}
        isDeleting={false}
      />
    </div>
  );
};

