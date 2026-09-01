import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { 
  Power, ShieldAlert, Key, Mail, RefreshCw, Save, 
  Sparkles, CheckCircle2, XCircle, Eye, EyeOff, Zap, 
  Globe, MessageSquare, BookOpen, Users, Clock, Send
} from 'lucide-react';
import { SMTPHealthCheck } from '@/components/admin/SMTPHealthCheck';
import { 
  fetchAllSystemConfigs, 
  saveAllSystemConfigs, 
  testGroqKeyLive, 
  type GroqConfig, 
  type SmtpConfig, 
  type PlatformControls 
} from '@/services/systemConfigService';

export const SettingsTab = () => {
  // Platform & Feature Toggles
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("We are currently undergoing scheduled maintenance.");
  const [cbtEnabled, setCbtEnabled] = useState(true);
  const [tournamentsEnabled, setTournamentsEnabled] = useState(true);
  const [studyRoomsEnabled, setStudyRoomsEnabled] = useState(true);
  const [jambDate, setJambDate] = useState("2026-04-15T08:00:00");
  const [telegramSupportLink, setTelegramSupportLink] = useState('https://t.me/+6dtsZgQpwrNhZDM8');
  const [telegramAnnouncementLink, setTelegramAnnouncementLink] = useState('https://t.me/+9WU6HrQE6DJhYTRk');
  const [whatsappSupportNumber, setWhatsappSupportNumber] = useState('2348000000000');

  // GROQ AI Configuration
  const [groqKey, setGroqKey] = useState('');
  const [groqModel, setGroqModel] = useState('llama-3.3-70b-versatile');
  const [groqMonthlyLimit, setGroqMonthlyLimit] = useState(5000000);
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [testingGroq, setTestingGroq] = useState(false);
  const [groqTestResult, setGroqTestResult] = useState<{ success?: boolean; message?: string; latency?: number } | null>(null);

  // SMTP Configuration
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('admitwise2@gmail.com');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('Scholars Resort <admitwise2@gmail.com>');
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [showSmtpPass, setShowSmtpPass] = useState(false);

  // Payment Gateways
  const [paystackKey, setPaystackKey] = useState('');
  const [stripeKey, setStripeKey] = useState('');

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
  const [card5Title, setCard5Title] = useState("AI Smart Tutor & Adaptive Path");
  const [card5Desc, setCard5Desc] = useState("Get 24/7 step-by-step problem resolution, customized weak-topic drills, and AI study recommendations.");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      // 1. Fetch from unified systemConfigService (checks system_configs and admin_settings)
      const unified = await fetchAllSystemConfigs();
      
      // Populate GROQ settings
      if (unified.groq.apiKey) setGroqKey(unified.groq.apiKey);
      if (unified.groq.defaultModel) setGroqModel(unified.groq.defaultModel);
      if (unified.groq.monthlyTokenLimit) setGroqMonthlyLimit(unified.groq.monthlyTokenLimit);

      // Populate SMTP settings
      if (unified.smtp.host) setSmtpHost(unified.smtp.host);
      if (unified.smtp.port) setSmtpPort(String(unified.smtp.port));
      if (unified.smtp.user) setSmtpUser(unified.smtp.user);
      if (unified.smtp.pass) setSmtpPass(unified.smtp.pass);
      if (unified.smtp.from) setSmtpFrom(unified.smtp.from);
      if (unified.smtp.secure !== undefined) setSmtpSecure(unified.smtp.secure);

      // Populate Platform controls
      setMaintenanceMode(!!unified.platform.maintenanceMode);
      if (unified.platform.maintenanceMessage) setMaintenanceMessage(unified.platform.maintenanceMessage);
      setCbtEnabled(unified.platform.cbtEnabled !== false);
      setTournamentsEnabled(unified.platform.tournamentsEnabled !== false);
      setStudyRoomsEnabled(unified.platform.studyRoomsEnabled !== false);
      if (unified.platform.jambDate) setJambDate(unified.platform.jambDate);
      if (unified.platform.telegramSupportLink) setTelegramSupportLink(unified.platform.telegramSupportLink);
      if (unified.platform.telegramAnnouncementLink) setTelegramAnnouncementLink(unified.platform.telegramAnnouncementLink);
      if (unified.platform.whatsappSupportNumber) setWhatsappSupportNumber(unified.platform.whatsappSupportNumber);

      // 2. Fetch landing & payment settings from admin_settings
      const { data: adminRows } = await supabase.from('admin_settings').select('*');
      if (adminRows) {
        const landingConf = adminRows.find(s => s.setting_key === 'landing_config')?.setting_value;
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

        const keys = adminRows.find(s => s.setting_key === 'api_keys')?.setting_value;
        if (keys) {
          if (keys.paystack) setPaystackKey(keys.paystack);
          if (keys.stripe) setStripeKey(keys.stripe);
        }
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const groqPayload: GroqConfig = {
        apiKey: groqKey.trim(),
        defaultModel: groqModel,
        monthlyTokenLimit: Number(groqMonthlyLimit) || 5000000
      };

      const smtpPayload: SmtpConfig = {
        host: smtpHost.trim(),
        port: Number(smtpPort) || 587,
        user: smtpUser.trim(),
        pass: smtpPass.trim(),
        from: smtpFrom.trim() || `Scholars Resort <${smtpUser.trim()}>`,
        secure: smtpSecure
      };

      const platformPayload: PlatformControls = {
        maintenanceMode,
        maintenanceMessage,
        cbtEnabled,
        tournamentsEnabled,
        studyRoomsEnabled,
        jambDate,
        telegramSupportLink,
        telegramAnnouncementLink,
        whatsappSupportNumber
      };

      // 1. Save unified configurations via service
      const res = await saveAllSystemConfigs({
        groq: groqPayload,
        smtp: smtpPayload,
        platform: platformPayload
      });

      // 2. Save landing page configuration
      await supabase.from('admin_settings').upsert([
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
        },
        {
          setting_key: 'api_keys',
          setting_value: {
            paystack: paystackKey,
            stripe: stripeKey
          }
        }
      ], { onConflict: 'setting_key' });

      if (res.success) {
        toast.success("All System Configurations, GROQ API Key & SMTP Credentials saved successfully!");
      } else {
        toast.warning("Settings saved locally with database fallback notice.");
      }
    } catch (_e) {
      toast.error("Failed to save settings.");
    }
    setSaving(false);
  };

  const handleTestGroq = async () => {
    if (!groqKey || groqKey.trim().length < 10) {
      toast.error("Please enter a valid GROQ API Key (e.g. gsk_...) before testing.");
      return;
    }
    setTestingGroq(true);
    setGroqTestResult(null);
    try {
      const result = await testGroqKeyLive(groqKey.trim(), groqModel);
      setGroqTestResult(result);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (err: any) {
      setGroqTestResult({ success: false, message: err.message || 'GROQ test failed.' });
      toast.error(err.message || 'GROQ test failed.');
    } finally {
      setTestingGroq(false);
    }
  };

  const handleApplyPreset = (preset: 'gmail' | 'sendgrid' | 'ses' | 'mailgun') => {
    if (preset === 'gmail') {
      setSmtpHost('smtp.gmail.com');
      setSmtpPort('587');
      setSmtpSecure(false);
      if (!smtpUser) setSmtpUser('admitwise2@gmail.com');
      if (!smtpFrom) setSmtpFrom('Scholars Resort <admitwise2@gmail.com>');
      toast.info("Applied Gmail SMTP preset (smtp.gmail.com:587). Ensure you use a 16-character App Password.");
    } else if (preset === 'sendgrid') {
      setSmtpHost('smtp.sendgrid.net');
      setSmtpPort('587');
      setSmtpSecure(false);
      setSmtpUser('apikey');
      toast.info("Applied SendGrid preset. Use 'apikey' as username and your SendGrid API key as password.");
    } else if (preset === 'ses') {
      setSmtpHost('email-smtp.us-east-1.amazonaws.com');
      setSmtpPort('587');
      setSmtpSecure(false);
      toast.info("Applied Amazon SES preset. Enter your AWS IAM SMTP username and secret password.");
    } else if (preset === 'mailgun') {
      setSmtpHost('smtp.mailgun.org');
      setSmtpPort('587');
      setSmtpSecure(false);
      toast.info("Applied Mailgun preset. Enter your domain SMTP credentials.");
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex flex-col justify-center items-center h-64 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading system configurations from database...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 bg-card border border-border p-6 rounded-2xl shadow-sm">
        <div>
          <h2 className="text-2xl font-bold font-display flex items-center gap-2 text-foreground">
            <Power className="w-6 h-6 text-primary" /> System Controls & Integrations
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Centrally manage GROQ AI provider keys, SMTP mail server credentials, feature toggles, and security locks.
          </p>
        </div>
        <Button onClick={saveSettings} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 shadow-md">
          {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save All System Configs
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* LEFT COLUMN: GROQ AI & MODULE CONTROLS */}
        <div className="space-y-6">

          {/* GROQ AI Provider Configuration */}
          <Card className="border border-border shadow-sm">
            <CardHeader className="bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                  <Sparkles className="w-5 h-5" /> GROQ AI Engine Configuration
                </CardTitle>
                <span className="text-xs bg-purple-500/20 text-purple-700 dark:text-purple-300 font-mono px-2.5 py-1 rounded-full font-semibold">
                  system_configs
                </span>
              </div>
              <CardDescription>
                Configure your custom GROQ API key for instantaneous AI answer explanations, personal tutoring, and syllabus breakdowns.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-purple-500" /> Custom GROQ API Key
                  </label>
                  <button 
                    type="button" 
                    onClick={() => setShowGroqKey(!showGroqKey)}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    {showGroqKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {showGroqKey ? 'Hide Key' : 'Show Key'}
                  </button>
                </div>
                <Input 
                  type={showGroqKey ? 'text' : 'password'}
                  value={groqKey} 
                  onChange={e => setGroqKey(e.target.value)} 
                  placeholder="gsk_..." 
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Get your free API key at <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-primary hover:underline font-semibold">console.groq.com</a>.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Default AI Model</label>
                  <select 
                    value={groqModel}
                    onChange={e => setGroqModel(e.target.value)}
                    className="w-full h-10 px-3 rounded-md bg-background border border-input text-sm text-foreground focus:ring-2 focus:ring-primary outline-none"
                  >
                    <option value="llama-3.3-70b-versatile">Llama 3.3 70B Versatile (Recommended)</option>
                    <option value="llama-3.1-8b-instant">Llama 3.1 8B Instant (Ultra-fast)</option>
                    <option value="mixtral-8x7b-32768">Mixtral 8x7B (Long Context)</option>
                    <option value="gemma2-9b-it">Gemma 2 9B IT (Google DeepMind)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Monthly Token Quota</label>
                  <Input 
                    type="number"
                    value={groqMonthlyLimit}
                    onChange={e => setGroqMonthlyLimit(Number(e.target.value))}
                    className="text-sm"
                  />
                </div>
              </div>

              {/* Test GROQ Key Trigger */}
              <div className="pt-2">
                <Button 
                  type="button" 
                  onClick={handleTestGroq} 
                  disabled={testingGroq}
                  variant="outline"
                  className="w-full border-purple-500/30 hover:bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold"
                >
                  {testingGroq ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                  {testingGroq ? 'Running Connectivity Benchmark...' : 'Test GROQ API Key & Latency'}
                </Button>
              </div>

              {groqTestResult && (
                <div className={`p-3 rounded-lg text-xs flex items-start gap-2 ${groqTestResult.success ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300'}`}>
                  {groqTestResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                  <div>
                    <p className="font-semibold">{groqTestResult.message}</p>
                    {groqTestResult.latency && <p className="mt-0.5 opacity-80">Response latency: {groqTestResult.latency}ms</p>}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Module Feature Flags */}
          <Card className="border border-border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Power className="w-5 h-5" /> Module Feature Flags & Access
              </CardTitle>
              <CardDescription>Instantly toggle platform features across the student dashboard.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3.5 bg-muted/40 border border-border rounded-xl">
                <div>
                  <p className="font-bold text-sm text-foreground flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-primary" /> CBT Examination Center
                  </p>
                  <p className="text-xs text-muted-foreground">Full timed JAMB mock tests & past questions engine</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setCbtEnabled(!cbtEnabled)}
                  className={`w-11 h-6 rounded-full p-1 transition-colors ${cbtEnabled ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${cbtEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-muted/40 border border-border rounded-xl">
                <div>
                  <p className="font-bold text-sm text-foreground flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" /> Tournaments & Battle Arena
                  </p>
                  <p className="text-xs text-muted-foreground">Live 1v1 multiplayer and weekly national tournaments</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setTournamentsEnabled(!tournamentsEnabled)}
                  className={`w-11 h-6 rounded-full p-1 transition-colors ${tournamentsEnabled ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${tournamentsEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-muted/40 border border-border rounded-xl">
                <div>
                  <p className="font-bold text-sm text-foreground flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-500" /> Peer Study Rooms & Chat
                  </p>
                  <p className="text-xs text-muted-foreground">Real-time collaborative study groups and messaging</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setStudyRoomsEnabled(!studyRoomsEnabled)}
                  className={`w-11 h-6 rounded-full p-1 transition-colors ${studyRoomsEnabled ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${studyRoomsEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Maintenance Mode & Platform Lock */}
          <Card className="border border-red-500/20 shadow-sm">
            <CardHeader className="bg-red-500/5">
              <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <ShieldAlert className="w-5 h-5" /> Maintenance Mode & Lockdown
              </CardTitle>
              <CardDescription>If enabled, non-admin students are redirected to the maintenance notice.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="flex items-center justify-between p-3.5 bg-muted/40 border border-border rounded-xl">
                <div>
                  <p className="font-bold text-sm text-foreground">Enable Platform Lockdown</p>
                  <p className="text-xs text-muted-foreground">Only authorized administrator accounts can access the platform.</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setMaintenanceMode(!maintenanceMode)}
                  className={`w-11 h-6 rounded-full p-1 transition-colors ${maintenanceMode ? 'bg-red-500' : 'bg-muted-foreground/30'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${maintenanceMode ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
              
              {maintenanceMode && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Maintenance Notice Message</label>
                  <textarea 
                    value={maintenanceMessage}
                    onChange={(e) => setMaintenanceMessage(e.target.value)}
                    className="w-full h-20 bg-background border border-input rounded-md p-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                    placeholder="We are upgrading our servers for the upcoming JAMB mock exam..."
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Global Target JAMB Date & Social Links */}
          <Card className="border border-border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Clock className="w-5 h-5 text-primary" /> Target Exam Dates & Community Channels
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">JAMB UTME Target Date (Countdown Timer)</label>
                <Input 
                  type="datetime-local" 
                  value={jambDate.slice(0, 16)} 
                  onChange={e => setJambDate(e.target.value)} 
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-blue-500" /> Telegram Support Group
                </label>
                <Input 
                  value={telegramSupportLink} 
                  onChange={e => setTelegramSupportLink(e.target.value)}
                  placeholder="https://t.me/..."
                  className="font-mono text-xs" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-emerald-500" /> Telegram Official Channel
                </label>
                <Input 
                  value={telegramAnnouncementLink} 
                  onChange={e => setTelegramAnnouncementLink(e.target.value)}
                  placeholder="https://t.me/..."
                  className="font-mono text-xs" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <Send className="w-4 h-4 text-emerald-600" /> WhatsApp Support Number
                </label>
                <Input 
                  value={whatsappSupportNumber} 
                  onChange={e => setWhatsappSupportNumber(e.target.value)}
                  placeholder="2348000000000"
                  className="font-mono text-xs" 
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: SMTP CREDENTIALS, DIAGNOSTICS & LANDING */}
        <div className="space-y-6">

          {/* SMTP Credentials & Server Settings */}
          <Card className="border border-border shadow-sm">
            <CardHeader className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <Mail className="w-5 h-5" /> SMTP Mail Server Credentials
                </CardTitle>
                <span className="text-xs bg-amber-500/20 text-amber-700 dark:text-amber-300 font-mono px-2.5 py-1 rounded-full font-semibold">
                  system_configs
                </span>
              </div>
              <CardDescription>
                Configure the outgoing mail server for secure OTP verification codes, report cards, and tournament alerts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">

              {/* Quick Presets */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                  1-Click Mail Server Presets
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => handleApplyPreset('gmail')} className="text-xs">
                    Gmail SMTP
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => handleApplyPreset('sendgrid')} className="text-xs">
                    SendGrid
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => handleApplyPreset('ses')} className="text-xs">
                    Amazon SES
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => handleApplyPreset('mailgun')} className="text-xs">
                    Mailgun
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-sm font-semibold text-foreground">SMTP Host</label>
                  <Input 
                    value={smtpHost} 
                    onChange={e => setSmtpHost(e.target.value)} 
                    placeholder="smtp.gmail.com" 
                    className="font-mono text-sm" 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-foreground">SMTP Port</label>
                  <Input 
                    value={smtpPort} 
                    onChange={e => setSmtpPort(e.target.value)} 
                    placeholder="587" 
                    className="font-mono text-sm" 
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground">SMTP Username / Email</label>
                <Input 
                  value={smtpUser} 
                  onChange={e => setSmtpUser(e.target.value)} 
                  placeholder="admitwise2@gmail.com" 
                  className="font-mono text-sm" 
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-foreground">SMTP Password / App Password</label>
                  <button 
                    type="button" 
                    onClick={() => setShowSmtpPass(!showSmtpPass)}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    {showSmtpPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {showSmtpPass ? 'Hide' : 'Show'}
                  </button>
                </div>
                <Input 
                  type={showSmtpPass ? 'text' : 'password'}
                  value={smtpPass} 
                  onChange={e => setSmtpPass(e.target.value)} 
                  placeholder="16-character App Password" 
                  className="font-mono text-sm" 
                />
                <p className="text-xs text-muted-foreground">
                  For Gmail, generate an App Password at <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-primary hover:underline font-semibold">myaccount.google.com/apppasswords</a>.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground">Sender From Display Header</label>
                <Input 
                  value={smtpFrom} 
                  onChange={e => setSmtpFrom(e.target.value)} 
                  placeholder="Scholars Resort <admitwise2@gmail.com>" 
                  className="text-sm" 
                />
              </div>
            </CardContent>
          </Card>

          {/* SMTP Live Diagnostic Section */}
          <SMTPHealthCheck 
            currentConfig={{
              host: smtpHost,
              port: smtpPort,
              user: smtpUser,
              pass: smtpPass,
              fromEmail: smtpFrom
            }}
            onApplyGmailPreset={() => handleApplyPreset('gmail')}
          />

          {/* Landing Page Customization */}
          <Card className="border border-border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <Globe className="w-5 h-5" /> Landing Page Customization
              </CardTitle>
              <CardDescription>Control headlines, subtitles, and hero transition banners.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Main Landing Title</label>
                <Input 
                  value={landingTitle}
                  onChange={e => setLandingTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Hero Subtitle</label>
                <Input 
                  value={landingSubtitle}
                  onChange={e => setLandingSubtitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Hero Image 1 (URL)</label>
                <Input 
                  value={heroImage1}
                  onChange={e => setHeroImage1(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Hero Image 2 (URL)</label>
                <Input 
                  value={heroImage2}
                  onChange={e => setHeroImage2(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Hero Image 3 (URL)</label>
                <Input 
                  value={heroImage3}
                  onChange={e => setHeroImage3(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </CardContent>
          </Card>

          {/* Payment Gateways */}
          <Card className="border border-border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Key className="w-5 h-5 text-purple-500" /> Payment Gateway Keys
              </CardTitle>
              <CardDescription>Configure Paystack and Stripe keys for student subscription activations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Paystack Secret / Public Key</label>
                <Input 
                  type="password"
                  value={paystackKey} 
                  onChange={e => setPaystackKey(e.target.value)} 
                  placeholder="pk_test_... or sk_test_..." 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Stripe Secret Key</label>
                <Input 
                  type="password"
                  value={stripeKey} 
                  onChange={e => setStripeKey(e.target.value)} 
                  placeholder="sk_test_..." 
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
