import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { User, Mail, Phone, CheckCircle2, ShieldCheck, Crown, BookOpen, BatteryCharging, BatteryLow, Download, FileJson, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Badges } from '@/components/Badges';
import { useBatterySaver } from '@/lib/batterySaver';
import { exportOfflineDataAsJson } from '@/lib/offlineExport';

export default function Profile() {
  const { profile, user } = useAuth();
  const { isBatterySaver, toggleBatterySaver } = useBatterySaver();
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [utmeSubjects, setUtmeSubjects] = useState<string[]>(profile?.utme_subjects || ['Use of English']);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExportBackup = async () => {
    setExporting(true);
    try {
      await exportOfflineDataAsJson(user?.id);
    } finally {
      setExporting(false);
    }
  };

  const handleSave = async () => {
    if (!fullName.trim() || !user || utmeSubjects.length !== 4) return;
    setLoading(true);
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          full_name: fullName.trim(),
          utme_subjects: utmeSubjects
        })
        .eq('id', user.id);

      if (error) throw error;
      
      toast.success('Profile updated successfully!');
      setIsEditing(false);
      // Note: We don't have a direct context refresher here, but it's enough for UX.
    } catch (e: any) {
      toast.error(e.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="p-4 md:p-10 w-full max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      
      <header className="mb-8">
        <h1 className="text-3xl font-display font-bold mb-2">My Profile</h1>
        <p className="text-muted-foreground">Manage your account details and subscription status.</p>
      </header>

      <div className="grid md:grid-cols-3 gap-8">
        
        {/* Main Details */}
        <div className="md:col-span-2 space-y-6">
          <Card className="bg-card shadow-sm border-border">
            <CardHeader>
              <CardTitle className="text-xl">Personal Information</CardTitle>
              <CardDescription>Update your basic account details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <User className="w-4 h-4" /> Full Name
                </label>
                {isEditing ? (
                  <Input 
                    value={fullName} 
                    onChange={(e) => setFullName(e.target.value)} 
                    placeholder="Enter your full name" 
                    className="bg-muted border-border"
                  />
                ) : (
                  <div className="p-3 bg-muted/50 rounded-lg border border-border text-foreground font-medium">
                    {profile.full_name || 'Not provided'}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Mail className="w-4 h-4" /> Email Address
                </label>
                <div className="p-3 bg-muted/30 rounded-lg border border-border text-foreground/70 flex items-center justify-between">
                  {user?.email}
                  <ShieldCheck className="w-4 h-4 text-green-500" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Email cannot be changed directly for security reasons.</p>
              </div>

              <div className="space-y-2 pt-4">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <BookOpen className="w-4 h-4" /> UTME Subjects (4 Required)
                </label>
                {isEditing ? (
                  <div className="space-y-2 bg-muted/20 p-4 rounded-lg border border-border">
                    <p className="text-xs text-muted-foreground mb-3">Select your 4 JAMB subjects. English is mandatory.</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                      {['Use of English', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Economics', 'Government', 'Literature', 'CRS', 'Geography', 'Accounting', 'Commerce'].map(sub => (
                        <label key={sub} className="flex items-center gap-2 text-sm">
                          <input 
                            type="checkbox" 
                            checked={utmeSubjects.includes(sub)}
                            disabled={sub === 'Use of English' || (!utmeSubjects.includes(sub) && utmeSubjects.length >= 4)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                if (utmeSubjects.length < 4) setUtmeSubjects([...utmeSubjects, sub]);
                              } else {
                                if (sub !== 'Use of English') setUtmeSubjects(utmeSubjects.filter(s => s !== sub));
                              }
                            }}
                            className="rounded border-border text-primary focus:ring-primary"
                          />
                          <span className={sub === 'Use of English' ? 'text-primary font-bold' : ''}>{sub}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-muted/50 rounded-lg border border-border text-foreground font-medium flex flex-wrap gap-2">
                    {profile.utme_subjects && profile.utme_subjects.length > 0 ? (
                      profile.utme_subjects.map((sub: string) => (
                        <span key={sub} className="bg-primary/10 text-primary px-2 py-1 rounded-md text-xs font-bold">{sub}</span>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-sm italic">Not set (Please edit profile)</span>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-4 flex justify-end gap-3">
                {isEditing ? (
                  <>
                    <Button variant="ghost" onClick={() => {
                      setFullName(profile.full_name || '');
                      setUtmeSubjects(profile.utme_subjects || ['Use of English']);
                      setIsEditing(false);
                    }} disabled={loading}>
                      Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={loading || !fullName.trim() || utmeSubjects.length !== 4}>
                      {loading ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => setIsEditing(true)}>
                    Edit Profile
                  </Button>
                )}
              </div>

            </CardContent>
          </Card>
        </div>

        {/* Sidebar Status */}
        <div className="space-y-6">
          <Card className={`border shadow-sm ${profile.has_paid ? 'border-primary/50 bg-primary/5' : 'border-border bg-card'}`}>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Crown className={`w-5 h-5 ${profile.has_paid ? 'text-primary' : 'text-muted-foreground'}`} /> 
                Subscription
              </CardTitle>
            </CardHeader>
            <CardContent>
              {profile.has_paid ? (
                <div className="space-y-3 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/20 text-primary mb-2">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-xl text-primary">Pro Active</h3>
                  <p className="text-sm text-muted-foreground">You have full lifetime access to all CBT exams, AI features, and syllabus materials.</p>
                </div>
              ) : (
                <div className="space-y-4 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted text-muted-foreground mb-2">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-xl">Free Tier</h3>
                  <p className="text-sm text-muted-foreground">Upgrade to Pro to unlock premium CBT mocks and unlimited AI tutor.</p>
                  <Button asChild className="w-full mt-2">
                    <a href="/pricing">Upgrade Now</a>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Battery Saver Setting Card */}
          <Card className="border border-border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <BatteryCharging className="w-4 h-4 text-amber-500" />
                  Battery Saver
                </span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${isBatterySaver ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-muted text-muted-foreground'}`}>
                  {isBatterySaver ? 'ENABLED' : 'OFF'}
                </span>
              </CardTitle>
              <CardDescription className="text-xs">
                Throttles UI animations and increases background sync intervals to save battery during long study marathons.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                id="toggle-battery-saver-btn"
                variant={isBatterySaver ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  const active = toggleBatterySaver();
                  if (active) {
                    toast.success('Battery Saver Mode Activated');
                  } else {
                    toast.info('Battery Saver Mode Deactivated');
                  }
                }}
                className={`w-full text-xs font-semibold ${isBatterySaver ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}`}
              >
                {isBatterySaver ? (
                  <>
                    <BatteryLow className="w-3.5 h-3.5 mr-1.5" />
                    Disable Battery Saver
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                    Enable Battery Saver
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Offline Data Backup / JSON Export Card */}
          <Card className="border border-border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileJson className="w-4 h-4 text-primary" />
                Offline Data Backup
              </CardTitle>
              <CardDescription className="text-xs">
                Export all your locally saved exam history, study progress, and queue as a JSON backup file.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                id="export-offline-json-btn"
                variant="outline"
                size="sm"
                onClick={handleExportBackup}
                disabled={exporting}
                className="w-full text-xs font-semibold hover:bg-primary/10 hover:text-primary hover:border-primary/40"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                {exporting ? 'Generating Backup...' : 'Export Offline Data (JSON)'}
              </Button>
            </CardContent>
          </Card>

          {/* Device Lock Status Card */}
          <Card className="border border-border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Device Security
              </CardTitle>
              <CardDescription className="text-xs">
                Single-device licensing protects your study record.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-muted/50 border border-border/80 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Active Device</span>
                  <span className="font-semibold text-emerald-500">Authorized</span>
                </div>
                <p className="font-mono text-[11px] text-muted-foreground truncate">
                  ID: {localStorage.getItem('scholars_resort_device_uuid') || profile.device_uuid || 'DEV-PRIMARY'}
                </p>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Your account is active on 1 authorized device. If you ever purchase a new phone or laptop, you can submit a reset request.
              </p>
            </CardContent>
          </Card>
        </div>

      </div>

      {/* Badges & Achievements Section */}
      <div className="pt-4">
        <Badges />
      </div>
    </div>
  );
}
