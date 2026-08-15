import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Power, ShieldAlert, Key, Mail, RefreshCw, Save, Send, CheckCircle2, AlertCircle, Zap, ShieldCheck } from 'lucide-react';
import { testSMTPEmail } from '@/services/emailService';

export const SettingsTab = () => {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("We are currently undergoing scheduled maintenance.");
  
  const [cbtEnabled, setCbtEnabled] = useState(true);
  const [tournamentsEnabled, setTournamentsEnabled] = useState(true);
  const [jambDate, setJambDate] = useState("2026-04-15T08:00:00");

  // Landing Customization
  const [landingTitle, setLandingTitle] = useState('Scholars Resort CBT & E-Learning Platform');
  const [landingSubtitle, setLandingSubtitle] = useState('Master JAMB, WAEC, NECO & UTME Exams with AI Explanations and Realistic Exam Engine');
  const [heroImage1, setHeroImage1] = useState('https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1600');
  const [heroImage2, setHeroImage2] = useState('https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1600');
  const [heroImage3, setHeroImage3] = useState('https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=1600');
  const [paystackKey, setPaystackKey] = useState('');
  const [stripeKey, setStripeKey] = useState('');
  
  // SMTP Configuration
  const [smtpHost, setSmtpHost] = useState('smtp.mailgun.org');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('noreply@scholarsresort.com');
  const [testRecipient, setTestRecipient] = useState('');
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [smtpStatus, setSmtpStatus] = useState<{ ok?: boolean; latency?: number; msg?: string }>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('admin_settings').select('*');
    if (data && !error) {
      const mm = data.find(s => s.setting_key === 'maintenance_mode')?.setting_value;
      const ft = data.find(s => s.setting_key === 'feature_toggles')?.setting_value;
      const keys = data.find(s => s.setting_key === 'api_keys')?.setting_value;
      const globalConf = data.find(s => s.setting_key === 'global_config')?.setting_value;
      
      const landingConf = data.find(s => s.setting_key === 'landing_config')?.setting_value;
      if (landingConf) {
        if (landingConf.title) setLandingTitle(landingConf.title);
        if (landingConf.subtitle) setLandingSubtitle(landingConf.subtitle);
        if (landingConf.hero_images && landingConf.hero_images.length >= 3) {
          setHeroImage1(landingConf.hero_images[0]);
          setHeroImage2(landingConf.hero_images[1]);
          setHeroImage3(landingConf.hero_images[2]);
        }
      }

      if (mm) {
        setMaintenanceMode(mm.enabled);
        setMaintenanceMessage(mm.message || "We are currently undergoing scheduled maintenance.");
      }
      if (ft) {
        setCbtEnabled(ft.cbt_enabled !== false);
        setTournamentsEnabled(ft.tournaments_enabled !== false);
      }
      if (keys) {
        setPaystackKey(keys.paystack || '');
        setStripeKey(keys.stripe || '');
        setSmtpHost(keys.smtp_host || 'smtp.mailgun.org');
        setSmtpPort(keys.smtp_port || '587');
        setSmtpUser(keys.smtp_user || '');
        setSmtpPass(keys.smtp_pass || '');
        setSmtpFrom(keys.smtp_from || 'noreply@scholarsresort.com');
      }
    }
    setLoading(false);
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await supabase.from('admin_settings').upsert([
        { 
          setting_key: 'maintenance_mode', 
          setting_value: { enabled: maintenanceMode, message: maintenanceMessage } 
        },
        { 
          setting_key: 'feature_toggles', 
          setting_value: { cbt_enabled: cbtEnabled, tournaments_enabled: tournamentsEnabled } 
        },
        {
          setting_key: 'api_keys',
          setting_value: { 
            paystack: paystackKey, 
            stripe: stripeKey, 
            smtp_host: smtpHost, 
            smtp_port: smtpPort,
            smtp_user: smtpUser,
            smtp_pass: smtpPass,
            smtp_from: smtpFrom
          }
        },
        {
          setting_key: 'global_config',
          setting_value: { jamb_date: jambDate }
        },
        {
          setting_key: 'landing_config',
          setting_value: {
            title: landingTitle,
            subtitle: landingSubtitle,
            hero_images: [heroImage1, heroImage2, heroImage3]
          }
        }
      ], { onConflict: 'setting_key' });
      
      toast.success("All System Controls & SMTP Settings saved successfully!");
    } catch (e) {
      toast.error("Failed to save settings.");
    }
    setSaving(false);
  };

  const handleTestSMTP = async () => {
    if (!smtpHost || !smtpPort) {
      toast.error("Please provide SMTP Host and Port first.");
      return;
    }

    setTestingSmtp(true);
    setSmtpStatus({});
    
    try {
      const recipient = testRecipient.trim() || 'test-admin@scholarsresort.com';
      const result = await testSMTPEmail({
        host: smtpHost,
        port: smtpPort,
        user: smtpUser,
        pass: smtpPass,
        fromEmail: smtpFrom
      }, recipient);

      setSmtpStatus({
        ok: result.success,
        latency: result.latency,
        msg: result.message
      });

      if (result.success) {
        toast.success(`SMTP Dispatch Verified! (${result.latency}ms)`);
      } else {
        toast.error(`SMTP Verification Failed: ${result.message}`);
      }
    } catch (err: any) {
      setSmtpStatus({ ok: false, msg: err.message });
      toast.error(`SMTP Test Error: ${err.message}`);
    }
    setTestingSmtp(false);
  };

  if (loading) return <div className="p-8 flex justify-center items-center h-64"><RefreshCw className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><Power className="w-6 h-6 text-primary" /> System Controls & Integrations</h2>
          <p className="text-slate-400">Manage global access, feature toggles, SMTP mail routing, and gateways.</p>
        </div>
        <Button onClick={saveSettings} disabled={saving} className="bg-primary hover:bg-primary/90 shrink-0">
          {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save All Settings
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card className="bg-slate-900 border-slate-800 text-slate-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-400">
                <ShieldAlert className="w-5 h-5" /> Maintenance Mode & Platform Lock
              </CardTitle>
              <CardDescription className="text-slate-400">If enabled, students are redirected to the maintenance splash screen.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-lg">
                <div>
                  <p className="font-bold">Enable Maintenance Lockdown</p>
                  <p className="text-sm text-slate-400">Only Administrator accounts can access the platform.</p>
                </div>
                <button 
                  onClick={() => setMaintenanceMode(!maintenanceMode)}
                  className={`w-12 h-6 rounded-full p-1 transition-colors ${maintenanceMode ? 'bg-red-500' : 'bg-slate-700'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${maintenanceMode ? 'translate-x-6' : 'translate-x-0'}`}></div>
                </button>
              </div>
              
              {maintenanceMode && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Maintenance Notice Message</label>
                  <textarea 
                    value={maintenanceMessage}
                    onChange={(e) => setMaintenanceMessage(e.target.value)}
                    className="w-full h-24 bg-slate-950 border border-slate-800 rounded-md p-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                    placeholder="We are upgrading our servers for the upcoming JAMB mock exam..."
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 text-slate-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-400">
                <Power className="w-5 h-5" /> Landing Page Customization
              </CardTitle>
              <CardDescription className="text-slate-400">Control headline text, subtitle, and hero image transition URLs.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Main Landing Title</label>
                <Input 
                  value={landingTitle}
                  onChange={e => setLandingTitle(e.target.value)}
                  className="bg-slate-950 border-slate-800"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Hero Subtitle</label>
                <Input 
                  value={landingSubtitle}
                  onChange={e => setLandingSubtitle(e.target.value)}
                  className="bg-slate-950 border-slate-800"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Hero Image 1 (URL)</label>
                <Input 
                  value={heroImage1}
                  onChange={e => setHeroImage1(e.target.value)}
                  className="bg-slate-950 border-slate-800 font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Hero Image 2 (URL)</label>
                <Input 
                  value={heroImage2}
                  onChange={e => setHeroImage2(e.target.value)}
                  className="bg-slate-950 border-slate-800 font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Hero Image 3 (URL)</label>
                <Input 
                  value={heroImage3}
                  onChange={e => setHeroImage3(e.target.value)}
                  className="bg-slate-950 border-slate-800 font-mono text-xs"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 text-slate-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Power className="w-5 h-5 text-blue-400" /> Exam Countdown Config
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-slate-400 font-medium">JAMB Official Examination Date</label>
                <Input 
                  type="datetime-local" 
                  value={jambDate ? jambDate.slice(0, 16) : ''} 
                  onChange={e => setJambDate(new Date(e.target.value).toISOString())}
                  className="bg-slate-800 border-slate-700 text-white" 
                />
                <p className="text-xs text-slate-500">Controls the real-time exam countdown timer across student dashboards.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 text-slate-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-400">
                <Power className="w-5 h-5" /> Module Feature Flags
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-lg">
                <div>
                  <p className="font-bold">CBT Examination Center</p>
                  <p className="text-xs text-slate-400">Enable or pause full timed mock exams</p>
                </div>
                <button 
                  onClick={() => setCbtEnabled(!cbtEnabled)}
                  className={`w-12 h-6 rounded-full p-1 transition-colors ${cbtEnabled ? 'bg-green-500' : 'bg-slate-700'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${cbtEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-lg">
                <div>
                  <p className="font-bold">Tournaments & Battle Arena</p>
                  <p className="text-xs text-slate-400">Live 1v1 and multiplayer competitions</p>
                </div>
                <button 
                  onClick={() => setTournamentsEnabled(!tournamentsEnabled)}
                  className={`w-12 h-6 rounded-full p-1 transition-colors ${tournamentsEnabled ? 'bg-green-500' : 'bg-slate-700'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${tournamentsEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                </button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* SMTP Live Test Section */}
          <Card className="bg-slate-900 border-slate-800 text-slate-100">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center gap-2 text-amber-400">
                    <Mail className="w-5 h-5" /> SMTP Mail Server & Dispatch Verification
                  </CardTitle>
                  <CardDescription className="text-slate-400">Configure and test transactional email dispatch.</CardDescription>
                </div>
                {smtpStatus.ok !== undefined && (
                  <span className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded ${smtpStatus.ok ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {smtpStatus.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                    {smtpStatus.ok ? `Online (${smtpStatus.latency}ms)` : 'Failed'}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">SMTP Host</label>
                  <Input 
                    value={smtpHost} 
                    onChange={e => setSmtpHost(e.target.value)} 
                    placeholder="smtp.mailgun.org" 
                    className="bg-slate-950 border-slate-800" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">SMTP Port</label>
                  <Input 
                    value={smtpPort} 
                    onChange={e => setSmtpPort(e.target.value)} 
                    placeholder="587" 
                    className="bg-slate-950 border-slate-800" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">SMTP Username / API User</label>
                  <Input 
                    value={smtpUser} 
                    onChange={e => setSmtpUser(e.target.value)} 
                    placeholder="postmaster@domain.com" 
                    className="bg-slate-950 border-slate-800" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">SMTP Password / App Key</label>
                  <Input 
                    type="password"
                    value={smtpPass} 
                    onChange={e => setSmtpPass(e.target.value)} 
                    placeholder="Enter password or App Password" 
                    className="bg-slate-950 border-slate-800" 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Sender Email (From:)</label>
                <Input 
                  value={smtpFrom} 
                  onChange={e => setSmtpFrom(e.target.value)} 
                  placeholder="noreply@scholarsresort.com" 
                  className="bg-slate-950 border-slate-800" 
                />
              </div>

              {/* Direct SMTP Test Trigger */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                <label className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" /> Test Live Mail Delivery
                </label>
                <div className="flex gap-2">
                  <Input 
                    value={testRecipient}
                    onChange={e => setTestRecipient(e.target.value)}
                    placeholder="Enter email to receive test message..."
                    className="bg-slate-900 border-slate-800 text-xs"
                  />
                  <Button 
                    onClick={handleTestSMTP} 
                    disabled={testingSmtp} 
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold shrink-0"
                  >
                    {testingSmtp ? <RefreshCw className="w-4 h-4 animate-spin mr-1.5" /> : <Send className="w-4 h-4 mr-1.5" />}
                    {testingSmtp ? 'Sending Test...' : 'Test SMTP'}
                  </Button>
                </div>
                {smtpStatus.msg && (
                  <p className={`text-xs ${smtpStatus.ok ? 'text-green-400' : 'text-red-400'}`}>
                    {smtpStatus.msg}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 text-slate-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-400">
                <Key className="w-5 h-5" /> Payment Gateway Keys
              </CardTitle>
              <CardDescription className="text-slate-400">Configure API keys for Paystack (Nigeria NGN) and Stripe.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Paystack Public / Secret Key</label>
                <Input 
                  type="password"
                  value={paystackKey} 
                  onChange={e => setPaystackKey(e.target.value)} 
                  placeholder="pk_test_... or sk_test_..." 
                  className="bg-slate-950 border-slate-800" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Stripe Secret Key</label>
                <Input 
                  type="password"
                  value={stripeKey} 
                  onChange={e => setStripeKey(e.target.value)} 
                  placeholder="sk_test_..." 
                  className="bg-slate-950 border-slate-800" 
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
