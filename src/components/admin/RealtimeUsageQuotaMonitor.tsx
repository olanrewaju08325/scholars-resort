import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Database, HardDrive, Mail, Brain, AlertTriangle, 
  CheckCircle2, Settings2, RefreshCw, BellRing, Send, 
  ShieldAlert, Layers, Sparkles, TrendingUp
} from 'lucide-react';
import { 
  SystemUsageLimitService, 
  DEFAULT_QUOTA_LIMITS 
} from '@/services/systemUsageLimitService';
import type { 
  ResourceUsageStats, 
  UsageQuotaLimits 
} from '@/services/systemUsageLimitService';
import { toast } from 'sonner';
import { sendEmailMessage } from '@/services/emailService';

export const RealtimeUsageQuotaMonitor: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [stats, setStats] = useState<ResourceUsageStats | null>(null);
  const [limits, setLimits] = useState<UsageQuotaLimits>(DEFAULT_QUOTA_LIMITS);
  const [loading, setLoading] = useState(true);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);

  // Form states
  const [formDbLimit, setFormDbLimit] = useState(500);
  const [formStorageLimit, setFormStorageLimit] = useState(1024);
  const [formSmtpLimit, setFormSmtpLimit] = useState(500);
  const [formAiLimit, setFormAiLimit] = useState(1000000);
  const [formThreshold, setFormThreshold] = useState(85);
  const [formEmail, setFormEmail] = useState('olanrewajuhamilot@gmail.com');
  const [formAutoAlerts, setFormAutoAlerts] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [currentLimits, currentStats] = await Promise.all([
        SystemUsageLimitService.getQuotaLimits(),
        SystemUsageLimitService.fetchLiveUsageStats()
      ]);

      setLimits(currentLimits);
      setStats(currentStats);

      setFormDbLimit(currentLimits.dbStorageLimitMB);
      setFormStorageLimit(currentLimits.fileStorageLimitMB);
      setFormSmtpLimit(currentLimits.smtpDailyLimit);
      setFormAiLimit(currentLimits.aiMonthlyTokensLimit);
      setFormThreshold(currentLimits.alertThresholdPercent);
      setFormEmail(currentLimits.adminAlertEmail);
      setFormAutoAlerts(currentLimits.autoEmailAlertsEnabled);
    } catch (e) {
      console.error('Error loading usage data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 20000); // 20s live refresh
    return () => clearInterval(interval);
  }, []);

  const handleSaveLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated: UsageQuotaLimits = {
        dbStorageLimitMB: Number(formDbLimit) || 500,
        fileStorageLimitMB: Number(formStorageLimit) || 1024,
        smtpDailyLimit: Number(formSmtpLimit) || 500,
        aiMonthlyTokensLimit: Number(formAiLimit) || 1000000,
        alertThresholdPercent: Number(formThreshold) || 85,
        adminAlertEmail: formEmail.trim(),
        autoEmailAlertsEnabled: formAutoAlerts
      };

      await SystemUsageLimitService.saveQuotaLimits(updated);
      setLimits(updated);
      setIsConfigOpen(false);
      toast.success('Resource quota limits and alert settings saved!');
      loadData();
    } catch (err: any) {
      toast.error('Failed to save quota settings: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTestAlert = async () => {
    if (!formEmail) {
      toast.error('Please enter an admin alert email address.');
      return;
    }

    setIsSendingTestEmail(true);
    try {
      const testHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 550px; margin: 0 auto; padding: 24px; border: 1px solid #4f46e5; border-radius: 12px; background: #ffffff;">
          <h2 style="color: #4f46e5; margin-top: 0;">Resource Capacity Alert Test</h2>
          <p style="color: #334155; line-height: 1.5;">This is a test notification confirming that automated resource quota alerts for <strong>Scholars Resort</strong> are properly connected to <strong>${formEmail}</strong>.</p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 13px; color: #475569; margin-top: 16px;">
            Alert Threshold: ${formThreshold}% Capacity<br/>
            Database Limit: ${formDbLimit} MB<br/>
            File Storage Limit: ${formStorageLimit} MB (${(formStorageLimit / 1024).toFixed(1)} GB)<br/>
            SMTP Daily Limit: ${formSmtpLimit} emails/day<br/>
            AI Monthly Limit: ${formAiLimit.toLocaleString()} tokens
          </div>
        </div>
      `;

      const res = await sendEmailMessage({
        to: formEmail,
        subject: 'Scholars Resort - Resource Quota Alert Verification Test',
        body: testHtml
      });

      if (res.success) {
        toast.success(`Verification email dispatched to ${formEmail}!`);
      } else {
        toast.error(`Email dispatch notice: ${res.message}`);
      }
    } catch (err: any) {
      toast.error('Test email error: ' + err.message);
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  return (
    <Card className={`border border-border/80 bg-card shadow-md text-card-foreground overflow-hidden ${className}`}>
      <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold px-2 py-0.5">
                <Sparkles className="w-3 h-3 mr-1" /> Live Real-Time Quotas
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                Alert Threshold: {limits.alertThresholdPercent}%
              </Badge>
            </div>
            <CardTitle className="text-base sm:text-lg font-bold font-display flex items-center gap-2">
              <Database className="w-4 h-4 sm:w-5 sm:h-5 text-primary" /> Database, Storage, SMTP & AI Usage
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Monitor remaining capacity in MB/GB and auto-dispatch email warnings when approaching limits
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsConfigOpen(!isConfigOpen)}
              className="h-8 text-xs gap-1.5"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>{isConfigOpen ? 'Close Settings' : 'Set Limits & Alerts'}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={loadData}
              disabled={loading}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* Critical Alerts Banner */}
        {stats?.hasCriticalAlerts && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 space-y-2">
            <div className="flex items-center gap-2 font-bold text-xs">
              <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
              <span>Resource Capacity Warnings ({stats.alertMessages.length}):</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              {stats.alertMessages.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
            <div className="text-[11px] text-muted-foreground pt-1 flex items-center gap-1.5">
              <BellRing className="w-3.5 h-3.5 text-primary" />
              <span>Automated alert recipient: <strong>{limits.adminAlertEmail}</strong></span>
            </div>
          </div>
        )}

        {/* 4 Real-Time Resource Gauges */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          
          {/* 1. Database Storage */}
          <div className="p-4 rounded-xl bg-muted/30 border border-border/70 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-primary" /> Supabase DB
                </span>
                <Badge 
                  variant="outline" 
                  className={`text-[10px] font-mono ${stats?.database.isNearLimit ? 'bg-red-500/10 text-red-500 border-red-500/30 font-bold' : 'text-primary'}`}
                >
                  {stats?.database.percentUsed || 0}% Used
                </Badge>
              </div>

              <div className="mt-2.5">
                <div className="text-xl sm:text-2xl font-bold font-mono text-foreground">
                  {stats?.database.estimatedSizeMB || 0} <span className="text-xs font-sans text-muted-foreground font-normal">/ {limits.dbStorageLimitMB} MB</span>
                </div>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                  <strong>{stats?.database.mbLeft || limits.dbStorageLimitMB} MB</strong> remaining
                </p>
              </div>
            </div>

            <div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${stats?.database.isNearLimit ? 'bg-red-500' : 'bg-primary'}`}
                  style={{ width: `${Math.min(100, Math.max(3, stats?.database.percentUsed || 0))}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-1.5 font-mono">
                <span>{stats?.database.totalRows.toLocaleString() || 0} active rows</span>
                <span>{stats?.database.breakdown.questions.toLocaleString() || 0} questions</span>
              </div>
            </div>
          </div>

          {/* 2. File Storage */}
          <div className="p-4 rounded-xl bg-muted/30 border border-border/70 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4 text-sky-500" /> File Storage
                </span>
                <Badge 
                  variant="outline" 
                  className={`text-[10px] font-mono ${stats?.storage.isNearLimit ? 'bg-red-500/10 text-red-500 border-red-500/30 font-bold' : 'text-sky-500'}`}
                >
                  {stats?.storage.percentUsed || 0}% Used
                </Badge>
              </div>

              <div className="mt-2.5">
                <div className="text-xl sm:text-2xl font-bold font-mono text-foreground">
                  {stats?.storage.usedMB || 0} <span className="text-xs font-sans text-muted-foreground font-normal">/ {limits.fileStorageLimitMB} MB</span>
                </div>
                <p className="text-[11px] text-sky-600 dark:text-sky-400 font-medium mt-0.5">
                  <strong>{stats?.storage.gbLeft || (limits.fileStorageLimitMB / 1024).toFixed(2)} GB</strong> left ({stats?.storage.mbLeft} MB)
                </p>
              </div>
            </div>

            <div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${stats?.storage.isNearLimit ? 'bg-red-500' : 'bg-sky-500'}`}
                  style={{ width: `${Math.min(100, Math.max(3, stats?.storage.percentUsed || 0))}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-1.5 font-mono">
                <span>{stats?.storage.objectsCount || 0} stored files</span>
                <span>PDFs & Diagrams</span>
              </div>
            </div>
          </div>

          {/* 3. SMTP Daily Quota */}
          <div className="p-4 rounded-xl bg-muted/30 border border-border/70 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-purple-500" /> Daily SMTP Quota
                </span>
                <Badge 
                  variant="outline" 
                  className={`text-[10px] font-mono ${stats?.smtp.isNearLimit ? 'bg-red-500/10 text-red-500 border-red-500/30 font-bold' : 'text-purple-500'}`}
                >
                  {stats?.smtp.percentUsed || 0}% Used
                </Badge>
              </div>

              <div className="mt-2.5">
                <div className="text-xl sm:text-2xl font-bold font-mono text-foreground">
                  {stats?.smtp.emailsSentToday || 0} <span className="text-xs font-sans text-muted-foreground font-normal">/ {limits.smtpDailyLimit} today</span>
                </div>
                <p className="text-[11px] text-purple-600 dark:text-purple-400 font-medium mt-0.5">
                  <strong>{stats?.smtp.emailsLeftToday || limits.smtpDailyLimit} emails</strong> left today
                </p>
              </div>
            </div>

            <div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${stats?.smtp.isNearLimit ? 'bg-red-500' : 'bg-purple-500'}`}
                  style={{ width: `${Math.min(100, Math.max(3, stats?.smtp.percentUsed || 0))}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-1.5 font-mono">
                <span>{stats?.smtp.emailsSentThisMonth || 0} sent this month</span>
                <span className="text-emerald-500">Live Health 100%</span>
              </div>
            </div>
          </div>

          {/* 4. AI API Tokens */}
          <div className="p-4 rounded-xl bg-muted/30 border border-border/70 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Brain className="w-4 h-4 text-amber-500" /> AI Groq / Tokens
                </span>
                <Badge 
                  variant="outline" 
                  className={`text-[10px] font-mono ${stats?.ai.isNearLimit ? 'bg-red-500/10 text-red-500 border-red-500/30 font-bold' : 'text-amber-500'}`}
                >
                  {stats?.ai.percentUsed || 0}% Used
                </Badge>
              </div>

              <div className="mt-2.5">
                <div className="text-lg sm:text-xl font-bold font-mono text-foreground truncate">
                  {(stats?.ai.tokensUsedThisMonth || 0).toLocaleString()} <span className="text-xs font-sans text-muted-foreground font-normal">/ {(limits.aiMonthlyTokensLimit / 1000).toFixed(0)}k</span>
                </div>
                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                  <strong>{(stats?.ai.tokensLeft || limits.aiMonthlyTokensLimit).toLocaleString()}</strong> tokens left
                </p>
              </div>
            </div>

            <div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${stats?.ai.isNearLimit ? 'bg-red-500' : 'bg-amber-500'}`}
                  style={{ width: `${Math.min(100, Math.max(3, stats?.ai.percentUsed || 0))}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-1.5 font-mono">
                <span>{stats?.ai.requestsToday || 0} calls today</span>
                <span>Monthly Cycle</span>
              </div>
            </div>
          </div>

        </div>

        {/* Configuration Modal / Inline Drawer */}
        {isConfigOpen && (
          <form onSubmit={handleSaveLimits} className="p-4 sm:p-5 rounded-xl border border-primary/30 bg-primary/5 space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between border-b border-primary/20 pb-3">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-primary" />
                <h4 className="text-sm font-bold text-foreground">Configure Quota Limits & Email Alerts</h4>
              </div>
              <span className="text-xs text-muted-foreground">Adjust service capacities and alert trigger thresholds</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Database Storage Limit (MB)</label>
                <Input
                  type="number"
                  value={formDbLimit}
                  onChange={(e) => setFormDbLimit(Number(e.target.value))}
                  min={50}
                  max={10000}
                  className="h-8 text-xs bg-background"
                />
                <span className="text-[10px] text-muted-foreground">Free Supabase tier is typically 500 MB</span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">File Storage Limit (MB)</label>
                <Input
                  type="number"
                  value={formStorageLimit}
                  onChange={(e) => setFormStorageLimit(Number(e.target.value))}
                  min={100}
                  max={50000}
                  className="h-8 text-xs bg-background"
                />
                <span className="text-[10px] text-muted-foreground">1024 MB = 1 GB File Storage</span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">SMTP Daily Email Limit</label>
                <Input
                  type="number"
                  value={formSmtpLimit}
                  onChange={(e) => setFormSmtpLimit(Number(e.target.value))}
                  min={10}
                  max={10000}
                  className="h-8 text-xs bg-background"
                />
                <span className="text-[10px] text-muted-foreground">Gmail SMTP quota is 500 emails/day</span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Monthly AI Token Limit</label>
                <Input
                  type="number"
                  value={formAiLimit}
                  onChange={(e) => setFormAiLimit(Number(e.target.value))}
                  min={10000}
                  max={100000000}
                  className="h-8 text-xs bg-background"
                />
                <span className="text-[10px] text-muted-foreground">Tokens budget across Groq & Gemini</span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Alert Threshold (%)</label>
                <Input
                  type="number"
                  value={formThreshold}
                  onChange={(e) => setFormThreshold(Number(e.target.value))}
                  min={50}
                  max={99}
                  className="h-8 text-xs bg-background"
                />
                <span className="text-[10px] text-muted-foreground">Trigger alert email when resource reaches this %</span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Admin Alert Recipient Email</label>
                <Input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="olanrewajuhamilot@gmail.com"
                  className="h-8 text-xs bg-background"
                />
                <span className="text-[10px] text-muted-foreground">Destination for automated warning emails</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-primary/20">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="auto-alerts"
                  checked={formAutoAlerts}
                  onChange={(e) => setFormAutoAlerts(e.target.checked)}
                  className="rounded text-primary focus:ring-primary h-4 w-4"
                />
                <label htmlFor="auto-alerts" className="text-xs font-medium text-foreground cursor-pointer">
                  Automatically dispatch warning emails when limits are approached
                </label>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSendTestAlert}
                  disabled={isSendingTestEmail}
                  className="h-8 text-xs gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingTestEmail ? 'Sending Test...' : 'Send Test Alert Email'}</span>
                </Button>

                <Button
                  type="submit"
                  size="sm"
                  disabled={isSaving}
                  className="h-8 text-xs gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
                </Button>
              </div>
            </div>
          </form>
        )}

      </CardContent>
    </Card>
  );
};
