import React, { useState, useEffect } from 'react';
import { 
  Database, RefreshCw, CheckCircle2, AlertTriangle, Copy, Check, 
  HardDrive, Terminal, Info, ShieldCheck, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { checkStorageDiagnostics, type StorageDiagnosticsResponse } from '@/services/fileUploadService';

interface StorageDiagnosticsProps {
  onDiagnosticsUpdate?: (allReady: boolean) => void;
}

export const StorageDiagnostics: React.FC<StorageDiagnosticsProps> = ({ onDiagnosticsUpdate }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<StorageDiagnosticsResponse | null>(null);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'buckets' | 'sql'>('buckets');

  const runDiagnostics = async (showToast = true) => {
    setLoading(true);
    try {
      const res = await checkStorageDiagnostics();
      setData(res);
      onDiagnosticsUpdate?.(res.allReady);

      if (showToast) {
        if (res.allReady) {
          toast.success('All Supabase storage buckets verified and ready for file uploads!');
        } else {
          toast.warning('Storage bucket notice: Some buckets are missing or restricted. Check the SQL fix guide below.');
        }
      }
    } catch (err) {
      toast.error('Failed to run storage diagnostics probe.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runDiagnostics(false);
  }, []);

  const handleCopySql = () => {
    if (data?.sqlInstructions) {
      navigator.clipboard.writeText(data.sqlInstructions);
      setCopiedSql(true);
      toast.success('Supabase SQL setup script copied to clipboard!');
      setTimeout(() => setCopiedSql(false), 3000);
    }
  };

  const targetBuckets = ['study-materials', 'materials', 'library'];

  return (
    <div className="bg-card border border-border rounded-xl p-5 sm:p-6 shadow-sm space-y-6 text-card-foreground">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 text-primary rounded-xl shrink-0">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2 flex-wrap">
              Supabase Storage Diagnostics
              {data && (
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                  data.allReady 
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                }`}>
                  {data.allReady ? 'All Buckets Active' : 'Action Required'}
                </span>
              )}
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Probe and verify public storage bucket status and accessibility for PDF study materials and e-books.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={() => runDiagnostics(true)}
            disabled={loading}
            variant="outline"
            size="sm"
            className="text-xs gap-1.5 border-border font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
            Re-probe Buckets
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-border text-xs font-semibold">
        <button
          onClick={() => setActiveTab('buckets')}
          className={`py-2 px-4 border-b-2 transition-colors ${
            activeTab === 'buckets'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Bucket Status Indicators
        </button>
        <button
          onClick={() => setActiveTab('sql')}
          className={`py-2 px-4 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'sql'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          1-Click SQL Setup Script
        </button>
      </div>

      {/* Tab 1: Buckets Status */}
      {activeTab === 'buckets' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {targetBuckets.map((bName) => {
              const info = data?.buckets?.[bName];
              const isExists = info?.exists;

              return (
                <div
                  key={bName}
                  className={`p-4 rounded-xl border transition-all ${
                    isExists
                      ? 'bg-emerald-500/5 border-emerald-500/20'
                      : 'bg-amber-500/5 border-amber-500/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-foreground text-sm flex items-center gap-1.5">
                      <Database className="w-4 h-4 text-muted-foreground" />
                      {bName}
                    </span>
                    {isExists ? (
                      <span className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" />
                        Verified
                      </span>
                    ) : (
                      <span className="bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-500/30">
                        <AlertTriangle className="w-3 h-3" />
                        Missing
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                    {isExists
                      ? 'Bucket exists and accepts public reads/uploads.'
                      : info?.error || 'Bucket not detected in Supabase storage.'}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground/80 border-t border-border pt-2 mt-2 font-mono">
                    <span>Public Access: <strong className={isExists ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>{isExists ? 'Enabled' : 'Restricted'}</strong></span>
                    <span>Max Size: 50MB</span>
                  </div>
                </div>
              );
            })}
          </div>

          {!data?.allReady && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-200 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-900 dark:text-amber-100 mb-1">
                  Storage Bucket Setup Notice
                </p>
                <p className="leading-relaxed">
                  If direct uploads to one of these buckets fail due to missing bucket errors or RLS permissions, the system automatically falls back to the server-side proxy route. You can permanently resolve bucket permissions by executing the provided SQL script in your Supabase SQL Editor.
                </p>
                <button
                  onClick={() => setActiveTab('sql')}
                  className="mt-2 text-primary underline font-bold flex items-center gap-1 hover:text-primary/80"
                >
                  View 1-Click SQL Script & Instructions
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: SQL Script & Setup Instructions */}
      {activeTab === 'sql' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900 text-slate-200 px-4 py-2.5 rounded-t-xl text-xs font-mono border-b border-slate-800">
            <span className="flex items-center gap-2 font-bold">
              <Terminal className="w-4 h-4 text-emerald-400" />
              Supabase SQL Editor Script
            </span>
            <Button
              onClick={handleCopySql}
              size="sm"
              variant="ghost"
              className="text-xs text-slate-200 hover:text-white hover:bg-slate-800 h-7 px-2 gap-1"
            >
              {copiedSql ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy Script
                </>
              )}
            </Button>
          </div>

          <pre className="bg-slate-950 text-emerald-400 p-4 rounded-b-xl font-mono text-xs overflow-x-auto max-h-64 leading-relaxed border border-slate-800 selection:bg-emerald-900 selection:text-white">
            {data?.sqlInstructions || `-- Run in Supabase SQL Editor:
INSERT INTO storage.buckets (id, name, public) VALUES ('study-materials', 'study-materials', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('materials', 'materials', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('library', 'library', true) ON CONFLICT DO NOTHING;`}
          </pre>

          <div className="p-4 bg-muted/40 border border-border rounded-xl text-xs space-y-2">
            <h4 className="font-bold text-foreground flex items-center gap-1.5">
              <Info className="w-4 h-4 text-primary" />
              Step-by-Step Setup Guide:
            </h4>
            <ol className="list-decimal list-inside text-muted-foreground space-y-1.5 pl-1 leading-relaxed">
              <li>Open your <strong className="text-foreground">Supabase Project Dashboard</strong>.</li>
              <li>Navigate to <strong className="text-foreground">SQL Editor</strong> in the left sidebar navigation.</li>
              <li>Click <strong className="text-foreground">New Query</strong>, paste the copied script above, and click <strong className="text-foreground">Run</strong>.</li>
              <li>Return here and click <strong className="text-foreground">Re-probe Buckets</strong> to verify green status!</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
};

