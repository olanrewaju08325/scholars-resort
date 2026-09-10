import React from 'react';
import { CheckCircle2, XCircle, RefreshCw, AlertTriangle, Layers, FileSpreadsheet } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface ImportProgressTrackerProps {
  isUploading: boolean;
  totalCount: number;
  successCount: number;
  failedCount: number;
  currentBatchText?: string;
  errors?: string[];
}

export const ImportProgressTracker: React.FC<ImportProgressTrackerProps> = ({
  isUploading,
  totalCount,
  successCount,
  failedCount,
  currentBatchText = 'Processing rows...',
  errors = []
}) => {
  const processedCount = successCount + failedCount;
  const progressPercent = totalCount > 0 ? Math.min(100, Math.round((processedCount / totalCount) * 100)) : 0;

  return (
    <div className="space-y-4 bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {isUploading ? (
            <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
          ) : processedCount >= totalCount && totalCount > 0 ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          ) : (
            <FileSpreadsheet className="w-5 h-5 text-slate-600" />
          )}
          <span className="text-sm font-bold text-slate-800">
            {isUploading ? 'Batch Upsert in Progress...' : 'Ingestion Progress Tracker'}
          </span>
        </div>

        <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 text-xs px-2.5 py-0.5 font-mono">
          {progressPercent}% Complete ({processedCount} / {totalCount})
        </Badge>
      </div>

      <Progress value={progressPercent} className="h-2.5 bg-slate-200 [&>div]:bg-indigo-600" />

      {currentBatchText && (
        <p className="text-xs text-slate-600 font-mono truncate bg-white p-2 rounded border border-slate-200">
          {currentBatchText}
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
        <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <div className="text-xs text-emerald-700 font-semibold uppercase tracking-wider">Upserted / Saved</div>
            <div className="text-lg font-bold text-emerald-800">{successCount}</div>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 p-2.5 rounded-lg flex items-center gap-2.5">
          <XCircle className="w-5 h-5 text-red-600 shrink-0" />
          <div>
            <div className="text-xs text-red-700 font-semibold uppercase tracking-wider">Failed / Rejected</div>
            <div className="text-lg font-bold text-red-800">{failedCount}</div>
          </div>
        </div>

        <div className="bg-slate-100 border border-slate-300 p-2.5 rounded-lg flex items-center gap-2.5 col-span-2 sm:col-span-1">
          <Layers className="w-5 h-5 text-slate-600 shrink-0" />
          <div>
            <div className="text-xs text-slate-700 font-semibold uppercase tracking-wider">Total Queue</div>
            <div className="text-lg font-bold text-slate-800">{totalCount}</div>
          </div>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="mt-3 p-3 bg-red-50/70 border border-red-200 rounded-lg max-h-32 overflow-y-auto text-xs space-y-1">
          <div className="font-bold text-red-800 flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-600" /> Ingestion Error Log ({errors.length}):
          </div>
          {errors.slice(0, 10).map((err, idx) => (
            <div key={idx} className="text-red-700 font-mono text-[11px] leading-tight">
              • {err}
            </div>
          ))}
          {errors.length > 10 && (
            <div className="text-slate-500 italic text-[11px] pt-0.5">
              ...and {errors.length - 10} more errors.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
