import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Power, ShieldAlert, Key, Mail, RefreshCw, Save } from 'lucide-react';
import { SMTPHealthCheck } from '@/components/admin/SMTPHealthCheck';

export const SettingsTab = () => {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("We are currently undergoing scheduled maintenance.");
  
  const [cbtEnabled, setCbtEnabled] = useState(true);
  const [tournamentsEnabled, setTournamentsEnabled] = useState(true);
  const [jambDate, setJambDate] = useState("2026-04-15T08:00:00");
  const [telegramSupportLink, setTelegramSupportLink] = useState('https://t.me/+6dtsZgQpwrNhZDM8');
  const [telegramAnnouncementLink, setTelegramAnnouncementLink] = useState('https://t.me/+9WU6HrQE6DJhYTRk');

  // Landing Customization
  const [landingTitle, setLandingTitle] = useState('Scholars Resort CBT & E-Learning Platform');
  const [landingSubtitle, setLandingSubtitle] = useState('Master JAMB, WAEC, NECO & UTME Exams with AI Explanations and Realistic Exam Engine');
  const [heroImage1, setHeroImage1] = useState('https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1600');
  const [heroImage2, setHeroImage2] = useState('https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1600');
  const [heroImage3, setHeroImage3] = useState('https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=1600');

  // Landing Feature Cards
  const [card1Title, setCard1Title] = useState("AI Personal Tutor");
  const [card1Desc, setCard1Desc] = useState("Stuck on a Physics equation or Chemistry reaction? Our AI tutor breaks down complex problems into step-by-step explanations instantly.");
  const [card2Title, setCard2Title] = useState("Exact CBT Replica");
  const [card2Desc, setCard2Desc] = useState("Our exam interface mimics the official JAMB UTME testing environment, including timer controls, question grid navigation, and key shortcuts.");
  const [card3Title, setCard3Title] = useState("Weakness Analytics");
  const [card3Desc, setCard3Desc] = useState("We measure your speed and accuracy per topic to recommend customized drills before exam day.");
  const [card4Title, setCard4Title] = useState("National Mocks & Battles");
  const [card4Desc, setCard4Desc] = useState("Compete against thousands of Nigerian students in weekly live tournaments and view your national percentile.");
  const [card5Title, setCard5Title] = useState("Guardian & Parent Portal");
  const [card5Desc, setCard5Desc] = useState("Parents receive transparent weekly email progress summaries and live dashboard tracking for peace of mind.");

  const [paystackKey, setPaystackKey] = useState('');
  const [stripeKey, setStripeKey] = useState('');
  
  // SMTP Configuration
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('admitwise2@gmail.com');
  const [smtpPass, setSmtpPass] = useState('fliwopndlqxipara');
  const [smtpFrom, setSmtpFrom] = useState('Scholars Resort <admitwise2@gmail.com>');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('admin_settings').select('*');
    if (data && !error) {
      const mm = data.find(s => s.setting_key === 'maintenance_mode')?.setting_value;
      const ft = data.find(s => s.setting_key === 'feature_toggles')?.setting_value;
      const keys = data.find(s => s.setting_key === 'api_keys')?.setting_value;
      const globalConf = data.find(s => s.setting_key === 'global_config')?.setting_value;
      if (globalConf) {
        if (globalConf.jamb_date) setJambDate(globalConf.jamb_date);
        if (globalConf.telegram_support_link) setTelegramSupportLink(globalConf.telegram_support_link);
        if (globalConf.telegram_announcement_link) setTelegramAnnouncementLink(globalConf.telegram_announcement_link);
      }
      
      const landingConf = data.find(s => s.setting_key === 'landing_config')?.setting_value;
      if (landingConf) {
        if (landingConf.title) setLandingTitle(landingConf.title);
        if (landingConf.subtitle) setLandingSubtitle(landingConf.subtitle);
        if (landingConf.hero_images && landingConf.hero_images.length >= 3) {
          setHeroImage1(landingConf.hero_images[0]);
          setHeroImage2(landingConf.hero_images[1]);
          setHeroImage3(landingConf.hero_images[2]);
        }
        if (landingConf.card1_title) setCard1Title(landingConf.card1_title);
        if (landingConf.card1_desc) setCard1Desc(landingConf.card1_desc);
        if (landingConf.card2_title) setCard2Title(landingConf.card2_title);
        if (landingConf.card2_desc) setCard2Desc(landingConf.card2_desc);
        if (landingConf.card3_title) setCard3Title(landingConf.card3_title);
        if (landingConf.card3_desc) setCard3Desc(landingConf.card3_desc);
        if (landingConf.card4_title) setCard4Title(landingConf.card4_title);
        if (landingConf.card4_desc) setCard4Desc(landingConf.card4_desc);
        if (landingConf.card5_title) setCard5Title(landingConf.card5_title);
        if (landingConf.card5_desc) setCard5Desc(landingConf.card5_desc);
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
        if (keys.smtp_host) setSmtpHost(keys.smtp_host);
        if (keys.smtp_port) setSmtpPort(keys.smtp_port);
        if (keys.smtp_user) setSmtpUser(keys.smtp_user);
        if (keys.smtp_pass) setSmtpPass(keys.smtp_pass);
        if (keys.smtp_from) setSmtpFrom(keys.smtp_from);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

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
          setting_value: { 
            jamb_date: jambDate,
            telegram_support_link: telegramSupportLink,
            telegram_announcement_link: telegramAnnouncementLink
          }
        },
        {
          setting_key: 'landing_config',
          setting_value: {
            title: landingTitle,
            subtitle: landingSubtitle,
            hero_images: [heroImage1, heroImage2, heroImage3],
            card1_title: card1Title,
            card1_desc: card1Desc,
            card2_title: card2Title,
            card2_desc: card2Desc,
            card3_title: card3Title,
            card3_desc: card3Desc,
            card4_title: card4Title,
            card4_desc: card4Desc,
            card5_title: card5Title,
            card5_desc: card5Desc
          }
        }
      ], { onConflict: 'setting_key' });
      
      toast.success("All System Controls & SMTP Settings saved successfully!");
    } catch (_e) {
      toast.error("Failed to save settings.");
    }
    setSaving(false);
  };

  const handleApplyGmailPreset = () => {
    setSmtpHost('smtp.gmail.com');
    setSmtpPort('587');
    if (!smtpUser) setSmtpUser('admitwise2@gmail.com');
    if (!smtpFrom) setSmtpFrom('Scholars Resort <admitwise2@gmail.com>');
    toast.info("Applied Google Gmail SMTP presets (smtp.gmail.com:587). Please ensure you enter your 16-character App Password.");
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

              <div className="pt-4 border-t border-slate-800 space-y-4">
                <h4 className="text-sm font-bold text-emerald-400">Landing Page Feature Cards Customization</h4>
                
                <div className="space-y-3 bg-slate-950/40 p-4 rounded-xl border border-slate-800">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Card 1 (Double Span)</span>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-medium">Card 1 Title</label>
                    <Input value={card1Title} onChange={e => setCard1Title(e.target.value)} className="bg-slate-950 border-slate-800 h-9 text-xs" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-medium">Card 1 Description</label>
                    <Input value={card1Desc} onChange={e => setCard1Desc(e.target.value)} className="bg-slate-950 border-slate-800 h-9 text-xs" />
                  </div>
                </div>

                <div className="space-y-3 bg-slate-950/40 p-4 rounded-xl border border-slate-800">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Card 2</span>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-medium">Card 2 Title</label>
                    <Input value={card2Title} onChange={e => setCard2Title(e.target.value)} className="bg-slate-950 border-slate-800 h-9 text-xs" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-medium">Card 2 Description</label>
                    <Input value={card2Desc} onChange={e => setCard2Desc(e.target.value)} className="bg-slate-950 border-slate-800 h-9 text-xs" />
                  </div>
                </div>

                <div className="space-y-3 bg-slate-950/40 p-4 rounded-xl border border-slate-800">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Card 3</span>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-medium">Card 3 Title</label>
                    <Input value={card3Title} onChange={e => setCard3Title(e.target.value)} className="bg-slate-950 border-slate-800 h-9 text-xs" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-medium">Card 3 Description</label>
                    <Input value={card3Desc} onChange={e => setCard3Desc(e.target.value)} className="bg-slate-950 border-slate-800 h-9 text-xs" />
                  </div>
                </div>

                <div className="space-y-3 bg-slate-950/40 p-4 rounded-xl border border-slate-800">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Card 4</span>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-medium">Card 4 Title</label>
                    <Input value={card4Title} onChange={e => setCard4Title(e.target.value)} className="bg-slate-950 border-slate-800 h-9 text-xs" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-medium">Card 4 Description</label>
                    <Input value={card4Desc} onChange={e => setCard4Desc(e.target.value)} className="bg-slate-950 border-slate-800 h-9 text-xs" />
                  </div>
                </div>

                <div className="space-y-3 bg-slate-950/40 p-4 rounded-xl border border-slate-800">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Card 5 (Double Span)</span>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-medium">Card 5 Title</label>
                    <Input value={card5Title} onChange={e => setCard5Title(e.target.value)} className="bg-slate-950 border-slate-800 h-9 text-xs" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-medium">Card 5 Description</label>
                    <Input value={card5Desc} onChange={e => setCard5Desc(e.target.value)} className="bg-slate-950 border-slate-800 h-9 text-xs" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 text-slate-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Power className="w-5 h-5 text-blue-400" /> Exam Countdown & Telegram Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-slate-400 font-medium">JAMB Official Examination Date</label>
                <Input 
                  type="datetime-local" 
                  value={jambDate ? jambDate.slice(0, 16) : ''} 
                  onChange={e => setJambDate(new Date(e.target.value).toISOString())}
                  className="bg-slate-850 border-slate-700 text-white" 
                />
                <p className="text-xs text-slate-500">Controls the real-time exam countdown timer across student dashboards.</p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800/60">
                <label className="text-sm text-slate-400 font-medium">Telegram Support System Invite Link</label>
                <Input 
                  type="url" 
                  value={telegramSupportLink} 
                  onChange={e => setTelegramSupportLink(e.target.value)}
                  placeholder="https://t.me/..."
                  className="bg-slate-850 border-slate-700 text-white font-mono text-xs" 
                />
                <p className="text-xs text-slate-500">Official support link where students and guardians request assistance.</p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800/60">
                <label className="text-sm text-slate-400 font-medium">Telegram Announcements Channel Link</label>
                <Input 
                  type="url" 
                  value={telegramAnnouncementLink} 
                  onChange={e => setTelegramAnnouncementLink(e.target.value)}
                  placeholder="https://t.me/..."
                  className="bg-slate-850 border-slate-700 text-white font-mono text-xs" 
                />
                <p className="text-xs text-slate-500">Official channel link for sharing updates, schedules, and materials.</p>
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
          {/* SMTP Live Diagnostic Section */}
          <SMTPHealthCheck 
            currentConfig={{
              host: smtpHost,
              port: smtpPort,
              user: smtpUser,
              pass: smtpPass,
              fromEmail: smtpFrom
            }}
            onApplyGmailPreset={handleApplyGmailPreset}
          />

          {/* SMTP Credentials & Server Settings */}
          <Card className="bg-slate-900 border-slate-800 text-slate-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-400">
                <Mail className="w-5 h-5" /> SMTP Server & Authentication Credentials
              </CardTitle>
              <CardDescription className="text-slate-400">Configure Gmail SMTP or custom transactional email host credentials.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">SMTP Host</label>
                  <Input 
                    value={smtpHost} 
                    onChange={e => setSmtpHost(e.target.value)} 
                    placeholder="smtp.gmail.com" 
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
                  <label className="text-sm font-medium">SMTP Email / Username</label>
                  <Input 
                    value={smtpUser} 
                    onChange={e => setSmtpUser(e.target.value)} 
                    placeholder="your-email@gmail.com" 
                    className="bg-slate-950 border-slate-800" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">SMTP Password / App Password</label>
                  <Input 
                    type="password"
                    value={smtpPass} 
                    onChange={e => setSmtpPass(e.target.value)} 
                    placeholder="16-character App Password" 
                    className="bg-slate-950 border-slate-800" 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Sender Name / Email (From:)</label>
                <Input 
                  value={smtpFrom} 
                  onChange={e => setSmtpFrom(e.target.value)} 
                  placeholder="Scholars Resort <your-email@gmail.com>" 
                  className="bg-slate-950 border-slate-800" 
                />
              </div>

              <div className="pt-2">
                <Button 
                  onClick={saveSettings} 
                  disabled={saving} 
                  className="w-full bg-amber-600 hover:bg-amber-700 font-bold text-white shadow"
                >
                  {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save SMTP Credentials
                </Button>
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
