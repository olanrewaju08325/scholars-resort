import React, { useState, useEffect } from 'react';
import { 
  Database, RefreshCw, CheckCircle2, AlertTriangle, Copy, Check, 
  ExternalLink, ShieldCheck, HardDrive, Terminal, Info, Play
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
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              Supabase Storage Diagnostics
              {data && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  data.allReady 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {data.allReady ? 'All Buckets Active' : 'Action Required'}
                </span>
              )}
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Probe and verify public storage bucket status for PDF study materials and e-books.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => runDiagnostics(true)}
            disabled={loading}
            variant="outline"
            size="sm"
            className="text-xs gap-1.5 border-slate-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
            Re-probe Buckets
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 text-xs font-medium">
        <button
          onClick={() => setActiveTab('buckets')}
          className={`py-2 px-4 border-b-2 transition-colors ${
            activeTab === 'buckets'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Bucket Status Indicators
        </button>
        <button
          onClick={() => setActiveTab('sql')}
          className={`py-2 px-4 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'sql'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
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
              const isProbeOk = info?.probeSuccess;

              return (
                <div
                  key={bName}
                  className={`p-4 rounded-xl border transition-all ${
                    isExists
                      ? 'bg-emerald-50/40 border-emerald-200'
                      : 'bg-amber-50/40 border-amber-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
                      <Database className="w-4 h-4 text-slate-500" />
                      {bName}
                    </span>
                    {isExists ? (
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Verified
                      </span>
                    ) : (
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Missing
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 mb-3">
                    {isExists
                      ? 'Bucket exists and accepts public reads/uploads.'
                      : info?.error || 'Bucket not detected in Supabase storage.'}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-200/60 pt-2 mt-2">
                    <span>Public Access: {isExists ? 'Enabled' : 'Restricted'}</span>
                    <span>Max Size: 50MB</span>
                  </div>
                </div>
              );
            })}
          </div>

          {!data?.allReady && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900 mb-1">
                  Storage Bucket Setup Notice
                </p>
                <p className="text-amber-800 leading-relaxed">
                  If direct uploads to one of these buckets fail due to missing bucket errors or RLS permissions, the system automatically falls back to the server-side proxy route. You can permanently resolve bucket permissions by executing the provided SQL script in your Supabase SQL Editor.
                </p>
                <button
                  onClick={() => setActiveTab('sql')}
                  className="mt-2 text-indigo-700 underline font-semibold flex items-center gap-1 hover:text-indigo-900"
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
          <div className="flex items-center justify-between bg-slate-800 text-slate-200 px-4 py-2.5 rounded-t-lg text-xs font-mono">
            <span className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              Supabase SQL Editor Script
            </span>
            <Button
              onClick={handleCopySql}
              size="sm"
              variant="ghost"
              className="text-xs text-slate-200 hover:text-white hover:bg-slate-700 h-7 px-2 gap-1"
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

          <pre className="bg-slate-900 text-emerald-400 p-4 rounded-b-lg font-mono text-xs overflow-x-auto max-h-64 leading-relaxed">
            {data?.sqlInstructions || `-- Run in Supabase SQL Editor:
INSERT INTO storage.buckets (id, name, public) VALUES ('study-materials', 'study-materials', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('materials', 'materials', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('library', 'library', true) ON CONFLICT DO NOTHING;`}
          </pre>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
            <h4 className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-indigo-600" />
              Step-by-Step Instructions:
            </h4>
            <ol className="list-decimal list-inside text-slate-600 space-y-1 pl-1">
              <li>Open your <strong>Supabase Project Dashboard</strong>.</li>
              <li>Navigate to <strong>SQL Editor</strong> in the left sidebar navigation.</li>
              <li>Click <strong>New Query</strong>, paste the copied script above, and click <strong>Run</strong>.</li>
              <li>Return here and click <strong>Re-probe Buckets</strong> to verify green status!</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
};
