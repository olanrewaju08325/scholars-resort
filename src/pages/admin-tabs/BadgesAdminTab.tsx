import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { Trophy, Plus, Trash2, Edit2, Save, RefreshCw, Award, CheckCircle, Star } from 'lucide-react';
import { toast } from 'sonner';
import { DeleteConfirmationDialog } from '@/components/DeleteConfirmationDialog';
import { logAdminActivity } from '@/services/adminActivityService';

export const BadgesAdminTab = () => {
  const [badges, setBadges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form State
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

  useEffect(() => {
    fetchBadges();
  }, []);

  const fetchBadges = async () => {
    setLoading(true);
    try {
      // Try fetching from database table 'badges' or 'admin_settings'
      const { data, error } = await supabase.from('badges').select('*').order('xp_threshold', { ascending: true });
      if (error) throw error;
      if (data && data.length > 0) {
        setBadges(data);
        setLoading(false);
        return;
      }
    } catch (err) {
      console.warn('Badges table fetch notice:', err);
    }

    try {
      const { data: settingData } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'gamification_badges_config')
        .maybeSingle();

      if (settingData?.setting_value && Array.isArray(settingData.setting_value)) {
        setBadges(settingData.setting_value);
        setLoading(false);
        return;
      }
    } catch {}

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
        : [...badges, { id: `badge_${Math.random().toString(36).substring(2, 9)}`, ...payload, created_at: new Date().toISOString() }];

      // Save to Supabase admin_settings / badges table
      try {
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Gamification Badges Manager</h2>
          <p className="text-muted-foreground">Manage badge criteria, XP thresholds, and unlock requirements dynamically without hardcoded values.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchBadges}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh Badges
          </Button>
          {!isEditing && (
            <Button onClick={() => { resetForm(); setIsEditing(true); }}>
              <Plus className="w-4 h-4 mr-2" /> Create New Badge
            </Button>
          )}
        </div>
      </div>

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
