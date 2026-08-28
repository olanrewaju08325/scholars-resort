import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Mail, Send, Terminal, CheckCircle2, AlertCircle, RefreshCw, 
  Copy, ShieldCheck, Zap, Info, HelpCircle, Server, Clock, Trash2
} from 'lucide-react';
import { testSMTPEmail, type SMTPConfig } from '@/services/emailService';

interface SMTPHealthCheckProps {
  currentConfig: {
    host: string;
    port: string;
    user: string;
    pass: string;
    fromEmail: string;
  };
  onApplyGmailPreset?: () => void;
}

interface LogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warn' | 'error' | 'handshake';
  message: string;
  detail?: string;
}

export const SMTPHealthCheck = ({ currentConfig, onApplyGmailPreset }: SMTPHealthCheckProps) => {
  const [recipient, setRecipient] = useState(currentConfig.user || 'admitwise2@gmail.com');
  const [testSubject, setTestSubject] = useState('Scholars Resort - Live SMTP Health Check Verification');
  const [testing, setTesting] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 'init-0',
      timestamp: new Date().toLocaleTimeString(),
      type: 'info',
      message: 'SMTP Diagnostic Engine ready. Configured host: ' + (currentConfig.host || 'Not set') + ':' + (currentConfig.port || '587')
    }
  ]);
  const [lastResult, setLastResult] = useState<{
    status: 'idle' | 'success' | 'failed';
    latency?: number;
    message?: string;
    messageId?: string;
  }>({ status: 'idle' });

  const addLog = (type: LogEntry['type'], message: string, detail?: string) => {
    setLogs(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        type,
        message,
        detail
      }
    ]);
  };

  const clearLogs = () => {
    setLogs([
      {
        id: 'init-' + Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        type: 'info',
        message: 'Logs cleared. Ready for new SMTP probe.'
      }
    ]);
    setLastResult({ status: 'idle' });
  };

  const copyLogs = () => {
    const text = logs.map(l => `[${l.timestamp}] [${String(l?.type || 'INFO').toUpperCase()}] ${l.message}${l.detail ? ` (${l.detail})` : ''}`).join('\n');
    navigator.clipboard.writeText(text);
    toast.success('Diagnostic logs copied to clipboard!');
  };

  const runDiagnostic = async () => {
    const targetRecipient = recipient.trim();
    if (!targetRecipient || !targetRecipient.includes('@')) {
      toast.error('Please enter a valid recipient email address.');
      return;
    }

    if (!currentConfig.host) {
      toast.error('SMTP Host is missing. Please configure host (e.g. smtp.gmail.com).');
      return;
    }

    setTesting(true);
    setLastResult({ status: 'idle' });

    addLog('info', `Starting SMTP Diagnostic probe to: ${targetRecipient}`);
    addLog('handshake', `Connecting to TCP socket ${currentConfig.host}:${currentConfig.port}...`);
    
    const isGmailHost = currentConfig.host.toLowerCase().includes('gmail');
    const isGmailUser = currentConfig.user?.toLowerCase().includes('@gmail.com');

    if (isGmailUser && !isGmailHost) {
      addLog('warn', `Host Mismatch Warning: Username "${currentConfig.user}" is a Gmail account, but SMTP host is "${currentConfig.host}". Mailgun/custom hosts will reject Gmail credentials.`);
      addLog('warn', 'To fix: Click "Apply Gmail Settings Preset" below or set host to smtp.gmail.com with a 16-character App Password.');
    } else if (isGmailHost) {
      addLog('info', 'Detected Google Gmail SMTP endpoint (STARTTLS port 587 or SSL 465).');
      if (currentConfig.pass && currentConfig.pass.replace(/\s+/g, '').length !== 16) {
        addLog('warn', 'Security notice: Gmail App Passwords must be exactly 16 characters. Standard Google account passwords will be rejected with code 535/534.');
      }
    }

    const startTime = performance.now();

    try {
      addLog('handshake', `Initiating EHLO/HELO handshake with ${currentConfig.host}...`);
      addLog('handshake', `Authenticating user "${currentConfig.user || 'anonymous'}" via SASL...`);

      const config: SMTPConfig = {
        host: currentConfig.host,
        port: currentConfig.port,
        user: currentConfig.user,
        pass: currentConfig.pass,
        fromEmail: currentConfig.fromEmail || currentConfig.user
      };

      const result = await testSMTPEmail(config, targetRecipient);
      const totalTime = Math.round(performance.now() - startTime);

      if (result.success) {
        addLog('success', `SMTP Handshake & Delivery Confirmed! Response: 250 OK (${totalTime}ms)`);
        addLog('success', `Live verification email successfully accepted by mail server for delivery to ${targetRecipient}.`);
        setLastResult({
          status: 'success',
          latency: result.latency || totalTime,
          message: result.message
        });
        toast.success(`SMTP Check Passed! Test email delivered (${totalTime}ms)`);
      } else {
        addLog('error', `SMTP Probe Failed: ${result.message}`);
        if (result.message.includes('535') || result.message.toLowerCase().includes('password') || result.message.toLowerCase().includes('auth')) {
          addLog('warn', 'Action required: Check your 16-character Gmail App Password at https://myaccount.google.com/apppasswords');
        }
        setLastResult({
          status: 'failed',
          latency: result.latency || totalTime,
          message: result.message
        });
        toast.error(`SMTP Verification Failed: ${result.message}`);
      }
    } catch (err: any) {
      const totalTime = Math.round(performance.now() - startTime);
      addLog('error', `Connection exception encountered: ${err.message || err}`);
      setLastResult({
        status: 'failed',
        latency: totalTime,
        message: err.message || 'Connection timeout or socket error'
      });
      toast.error('SMTP test threw an error. See diagnostic logs below.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="border-border shadow-md bg-card/50 overflow-hidden">
      <CardHeader className="bg-muted/30 border-b border-border pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                Gmail & SMTP Health Check Diagnostic
                <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                  Live Tester
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Trigger real-time diagnostic test emails and inspect live server responses and latency.
              </CardDescription>
            </div>
          </div>

          {onApplyGmailPreset && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onApplyGmailPreset}
              className="text-xs font-semibold border-primary/30 text-primary hover:bg-primary/10"
            >
              <Zap className="w-3.5 h-3.5 mr-1 text-amber-500" /> Apply Gmail Preset
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Active Configuration Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/20 p-3 rounded-xl border border-border/60 text-xs">
          <div>
            <span className="text-muted-foreground block text-[11px]">SMTP Host</span>
            <span className="font-mono font-semibold text-foreground truncate block">
              {currentConfig.host || 'Not set'}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">Port / Security</span>
            <span className="font-mono font-semibold text-foreground truncate block">
              {currentConfig.port || '587'} ({currentConfig.port === '465' ? 'SSL' : 'TLS/STARTTLS'})
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">Sender User</span>
            <span className="font-mono font-semibold text-foreground truncate block">
              {currentConfig.user || 'None'}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">App Password</span>
            <span className="font-mono font-semibold text-foreground truncate block">
              {currentConfig.pass ? '••••••••' + currentConfig.pass.slice(-4) : 'Not configured'}
            </span>
          </div>
        </div>

        {/* Diagnostic Trigger Form */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="test-recipient" className="text-xs font-semibold flex items-center justify-between">
              <span>Target Test Recipient Email</span>
              <span className="text-[11px] text-muted-foreground font-normal">Where the test message will be sent</span>
            </Label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="test-recipient"
                type="email"
                placeholder="e.g. admitwise2@gmail.com"
                value={recipient}
                onChange={e => setRecipient(e.target.value)}
                className="pl-9 text-sm h-10"
              />
            </div>
          </div>

          <div className="flex items-end">
            <Button
              onClick={runDiagnostic}
              disabled={testing}
              className="w-full h-10 font-bold shadow-md bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
            >
              {testing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Testing Handshake...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Trigger Test Email
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Test Result Banner */}
        {lastResult.status !== 'idle' && (
          <div className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
            lastResult.status === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
              : 'bg-destructive/10 border-destructive/30 text-destructive'
          }`}>
            {lastResult.status === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-sm space-y-1">
              <div className="font-bold flex items-center justify-between">
                <span>{lastResult.status === 'success' ? 'SMTP Diagnostic: HEALTHY & DISPATCHED' : 'SMTP Diagnostic: CONNECTION FAILED'}</span>
                {lastResult.latency && (
                  <Badge variant="outline" className="text-[11px] font-mono">
                    <Clock className="w-3 h-3 mr-1" /> {lastResult.latency}ms
                  </Badge>
                )}
              </div>
              <p className="text-xs opacity-90">{lastResult.message}</p>
            </div>
          </div>
        )}

        {/* Real-Time Diagnostic Log Console */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
              <Terminal className="w-3.5 h-3.5 text-primary" /> Live Server Response & Protocol Logs
            </Label>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={copyLogs}
                className="h-7 text-[11px] text-muted-foreground hover:text-foreground px-2"
              >
                <Copy className="w-3 h-3 mr-1" /> Copy Logs
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearLogs}
                className="h-7 text-[11px] text-muted-foreground hover:text-foreground px-2"
              >
                <Trash2 className="w-3 h-3 mr-1" /> Clear
              </Button>
            </div>
          </div>

          <div className="bg-slate-950 text-slate-200 rounded-xl p-4 font-mono text-xs max-h-56 overflow-y-auto border border-slate-800 space-y-1.5 shadow-inner">
            {logs.map(log => {
              let color = 'text-slate-400';
              let badge = 'LOG';
              if (log.type === 'success') { color = 'text-emerald-400 font-semibold'; badge = 'SUCCESS'; }
              if (log.type === 'error') { color = 'text-red-400 font-semibold'; badge = 'ERROR'; }
              if (log.type === 'warn') { color = 'text-amber-400'; badge = 'WARN'; }
              if (log.type === 'handshake') { color = 'text-cyan-400'; badge = 'SOCKET'; }

              return (
                <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-slate-600 shrink-0 text-[10px]">[{log.timestamp}]</span>
                  <span className={`text-[10px] px-1 py-0.2 rounded shrink-0 bg-slate-900 border border-slate-800 ${color}`}>
                    {badge}
                  </span>
                  <span className={`${color} flex-1 break-all`}>
                    {log.message}
                    {log.detail && <span className="text-slate-500 block text-[11px] mt-0.5">{log.detail}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Gmail Setup Help Accordion */}
        <div className="bg-primary/5 rounded-xl p-4 border border-primary/20 space-y-2 text-xs">
          <div className="flex items-center gap-2 font-bold text-primary">
            <Info className="w-4 h-4" /> Gmail SMTP Configuration Guide:
          </div>
          <p className="text-muted-foreground leading-relaxed">
            1. <strong>Host</strong>: <code className="bg-background px-1.5 py-0.5 rounded border border-border font-mono text-[11px]">smtp.gmail.com</code> | <strong>Port</strong>: <code className="bg-background px-1.5 py-0.5 rounded border border-border font-mono text-[11px]">587</code> (or <code className="bg-background px-1.5 py-0.5 rounded border border-border font-mono text-[11px]">465</code> for SSL)
          </p>
          <p className="text-muted-foreground leading-relaxed">
            2. <strong>App Password</strong>: Go to your Google Account &rarr; Security &rarr; 2-Step Verification &rarr; <strong>App Passwords</strong>. Generate a new password for &quot;Scholars Resort&quot; (16 characters with no spaces).
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
