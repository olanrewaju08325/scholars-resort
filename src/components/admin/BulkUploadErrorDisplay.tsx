import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, ShieldAlert, CheckCircle2, ChevronDown, ChevronRight, 
  Copy, Check, Download, Search, Filter, Database, FileWarning, 
  Lock, RefreshCw, Code2, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export type ErrorCategory = 
  | 'database_constraint' 
  | 'validation_issue' 
  | 'auth_permission' 
  | 'schema_mismatch' 
  | 'server_error';

export interface QuestionUploadErrorItem {
  id?: string;
  rowNumber?: number;
  questionSnippet: string;
  subjectName?: string;
  topicName?: string;
  examYear?: number | string;
  errorCategory: ErrorCategory;
  errorCode?: string;
  technicalMessage: string;
  humanReadableReason: string;
  suggestedFix: string;
  rawError?: any;
}

interface BulkUploadErrorDisplayProps {
  errors: QuestionUploadErrorItem[];
  suggestedSql?: string;
  onRetrySingle?: (errorItem: QuestionUploadErrorItem) => void;
  className?: string;
}

export const BulkUploadErrorDisplay: React.FC<BulkUploadErrorDisplayProps> = ({
  errors,
  suggestedSql,
  onRetrySingle,
  className = ''
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());
  const [copiedSql, setCopiedSql] = useState<boolean>(false);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);

  // Toggle accordion expansion for individual card
  const toggleRow = (id: string) => {
    setExpandedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedRowIds(new Set(errors.map((e, idx) => e.id || `err-${idx}`)));
  };

  const collapseAll = () => {
    setExpandedRowIds(new Set());
  };

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts = {
      all: errors.length,
      database_constraint: 0,
      validation_issue: 0,
      auth_permission: 0,
      schema_mismatch: 0,
      server_error: 0
    };
    errors.forEach(e => {
      if (counts[e.errorCategory] !== undefined) {
        counts[e.errorCategory]++;
      } else {
        counts.server_error++;
      }
    });
    return counts;
  }, [errors]);

  // Filtered errors
  const filteredErrors = useMemo(() => {
    return errors.filter(item => {
      const matchesCategory = selectedCategory === 'all' || item.errorCategory === selectedCategory;
      if (!matchesCategory) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.questionSnippet?.toLowerCase().includes(q) ||
        item.humanReadableReason?.toLowerCase().includes(q) ||
        item.subjectName?.toLowerCase().includes(q) ||
        item.errorCode?.toLowerCase().includes(q) ||
        item.technicalMessage?.toLowerCase().includes(q) ||
        (item.rowNumber && String(item.rowNumber).includes(q))
      );
    });
  }, [errors, selectedCategory, searchQuery]);

  const handleCopySql = (sql: string) => {
    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    toast.success('Database migration SQL copied to clipboard!');
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleCopyAllErrors = () => {
    const reportText = errors.map(e => (
      `[${e.errorCategory.toUpperCase()}] Row ${e.rowNumber || '?'}: ${e.subjectName || 'Unknown'} (${e.examYear || 'Year ?'})\n` +
      `Question: ${e.questionSnippet}\n` +
      `Reason: ${e.humanReadableReason}\n` +
      `Action: ${e.suggestedFix}\n` +
      `Technical: Code ${e.errorCode || 'N/A'} - ${e.technicalMessage}\n`
    )).join('\n---\n\n');

    navigator.clipboard.writeText(reportText);
    setCopiedAll(true);
    toast.success('Full error diagnostic report copied to clipboard!');
    setTimeout(() => setCopiedAll(false), 3000);
  };

  const handleDownloadCsvReport = () => {
    const headers = ['Row Number', 'Subject', 'Exam Year', 'Error Category', 'Error Code', 'Human Readable Reason', 'Suggested Fix', 'Technical Message', 'Question Snippet'];
    const rows = errors.map(e => [
      e.rowNumber ?? '',
      `"${(e.subjectName || '').replace(/"/g, '""')}"`,
      e.examYear ?? '',
      `"${e.errorCategory}"`,
      `"${e.errorCode || ''}"`,
      `"${(e.humanReadableReason || '').replace(/"/g, '""')}"`,
      `"${(e.suggestedFix || '').replace(/"/g, '""')}"`,
      `"${(e.technicalMessage || '').replace(/"/g, '""')}"`,
      `"${(e.questionSnippet || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `question_upload_errors_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Error report CSV downloaded successfully!');
  };

  const getCategoryBadge = (cat: ErrorCategory) => {
    switch (cat) {
      case 'database_constraint':
        return {
          label: 'Database Constraint',
          className: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
          icon: Database
        };
      case 'validation_issue':
        return {
          label: 'Validation Issue',
          className: 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
          icon: FileWarning
        };
      case 'auth_permission':
        return {
          label: 'Auth / Permission',
          className: 'bg-red-100 text-red-900 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
          icon: Lock
        };
      case 'schema_mismatch':
        return {
          label: 'Schema Syntax',
          className: 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
          icon: Code2
        };
      default:
        return {
          label: 'Server Error',
          className: 'bg-slate-100 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
          icon: AlertTriangle
        };
    }
  };

  if (errors.length === 0 && !suggestedSql) return null;

  return (
    <div className={`rounded-xl border border-red-200 bg-red-50/40 dark:border-red-900/60 dark:bg-red-950/20 p-5 space-y-4 shadow-sm ${className}`}>
      {/* Header with Title & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-red-200/80 dark:border-red-900/50">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-300 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-red-950 dark:text-red-200 flex items-center gap-2">
              Ingestion Exceptions & Validation Audit
              <Badge variant="destructive" className="text-xs px-2 py-0 font-mono">
                {errors.length} {errors.length === 1 ? 'Issue' : 'Issues'}
              </Badge>
            </h4>
            <p className="text-xs text-red-800/80 dark:text-red-300/80 mt-0.5">
              Identified database constraints, mandatory field violations, or permission issues preventing question persistence.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownloadCsvReport}
            className="h-8 text-xs bg-white dark:bg-slate-900 border-red-200 dark:border-red-800 text-slate-700 dark:text-slate-200 hover:bg-red-50 gap-1.5"
            title="Download CSV report of all failing rows"
          >
            <Download className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
            Download Error CSV
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyAllErrors}
            className="h-8 text-xs bg-white dark:bg-slate-900 border-red-200 dark:border-red-800 text-slate-700 dark:text-slate-200 hover:bg-red-50 gap-1.5"
          >
            {copiedAll ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                Copied Report
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy Diagnostic
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Suggested Migration SQL Callout Banner (if constraint error detected) */}
      {suggestedSql && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-lg p-3.5 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
              <div>
                <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  Database Constraint Fix Required in Supabase:
                </span>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                  PostgreSQL reports no unique constraint matching ON CONFLICT (subject_id, question_text, year). Run this SQL script in your Supabase SQL Editor to enable idempotent bulk upserting.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => handleCopySql(suggestedSql)}
              className="h-7 text-xs bg-amber-700 hover:bg-amber-800 text-white gap-1 shrink-0"
            >
              {copiedSql ? <Check className="w-3 h-3 text-emerald-200" /> : <Copy className="w-3 h-3" />}
              {copiedSql ? 'Copied SQL' : 'Copy Fix SQL'}
            </Button>
          </div>
          <pre className="bg-slate-900 text-amber-200 p-2.5 rounded text-[11px] font-mono overflow-x-auto whitespace-pre-wrap max-h-28 border border-slate-800">
            {suggestedSql}
          </pre>
        </div>
      )}

      {/* Category Pills & Filters */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${
            selectedCategory === 'all'
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
              : 'bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-white border border-slate-200 dark:border-slate-700'
          }`}
        >
          All Issues ({categoryCounts.all})
        </button>

        {categoryCounts.database_constraint > 0 && (
          <button
            type="button"
            onClick={() => setSelectedCategory('database_constraint')}
            className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 ${
              selectedCategory === 'database_constraint'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-100/70 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300 hover:bg-amber-100 border border-amber-300 dark:border-amber-800'
            }`}
          >
            <Database className="w-3 h-3" />
            Constraints ({categoryCounts.database_constraint})
          </button>
        )}

        {categoryCounts.validation_issue > 0 && (
          <button
            type="button"
            onClick={() => setSelectedCategory('validation_issue')}
            className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 ${
              selectedCategory === 'validation_issue'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-blue-100/70 text-blue-900 dark:bg-blue-950/50 dark:text-blue-300 hover:bg-blue-100 border border-blue-300 dark:border-blue-800'
            }`}
          >
            <FileWarning className="w-3 h-3" />
            Validation ({categoryCounts.validation_issue})
          </button>
        )}

        {categoryCounts.auth_permission > 0 && (
          <button
            type="button"
            onClick={() => setSelectedCategory('auth_permission')}
            className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 ${
              selectedCategory === 'auth_permission'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-red-100/70 text-red-900 dark:bg-red-950/50 dark:text-red-300 hover:bg-red-100 border border-red-300 dark:border-red-800'
            }`}
          >
            <Lock className="w-3 h-3" />
            Auth / RLS ({categoryCounts.auth_permission})
          </button>
        )}

        {categoryCounts.schema_mismatch > 0 && (
          <button
            type="button"
            onClick={() => setSelectedCategory('schema_mismatch')}
            className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 ${
              selectedCategory === 'schema_mismatch'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-purple-100/70 text-purple-900 dark:bg-purple-950/50 dark:text-purple-300 hover:bg-purple-100 border border-purple-300 dark:border-purple-800'
            }`}
          >
            <Code2 className="w-3 h-3" />
            Syntax ({categoryCounts.schema_mismatch})
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={expandAll}
            className="h-7 text-[11px] text-slate-600 dark:text-slate-300 hover:text-slate-900 px-2"
          >
            Expand All
          </Button>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={collapseAll}
            className="h-7 text-[11px] text-slate-600 dark:text-slate-300 hover:text-slate-900 px-2"
          >
            Collapse All
          </Button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
        <Input
          placeholder="Filter by question text, row number, subject, or error message..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="h-8 pl-8 text-xs bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus-visible:ring-red-400"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="text-[10px] absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 font-mono"
          >
            Clear
          </button>
        )}
      </div>

      {/* Error List */}
      <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
        {filteredErrors.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
            No issues match the current filter or search criteria.
          </div>
        ) : (
          filteredErrors.map((item, index) => {
            const rowId = item.id || `err-${index}`;
            const isExpanded = expandedRowIds.has(rowId);
            const badgeInfo = getCategoryBadge(item.errorCategory);
            const BadgeIcon = badgeInfo.icon;

            return (
              <div
                key={rowId}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 transition-all hover:border-slate-300 shadow-2xs space-y-2"
              >
                <div 
                  className="flex items-start justify-between gap-2 cursor-pointer select-none"
                  onClick={() => toggleRow(rowId)}
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {item.rowNumber ? (
                        <span className="text-[11px] font-bold font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                          Row #{item.rowNumber}
                        </span>
                      ) : null}

                      <Badge 
                        variant="outline" 
                        className={`text-[10px] font-medium py-0 px-1.5 gap-1 flex items-center ${badgeInfo.className}`}
                      >
                        <BadgeIcon className="w-3 h-3 shrink-0" />
                        {badgeInfo.label}
                      </Badge>

                      {item.subjectName && (
                        <span className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                          {item.subjectName}
                        </span>
                      )}

                      {item.examYear && (
                        <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          Year {item.examYear}
                        </span>
                      )}

                      {item.errorCode && (
                        <span className="text-[10px] font-mono text-slate-500 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          Code: {item.errorCode}
                        </span>
                      )}
                    </div>

                    <h5 className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 pt-0.5">
                      <span className="text-red-600 dark:text-red-400 font-bold">•</span>
                      {item.humanReadableReason}
                    </h5>
                  </div>

                  <button
                    type="button"
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 shrink-0"
                    aria-label="Toggle details"
                  >
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                </div>

                {/* Question Stem Preview */}
                {item.questionSnippet && (
                  <div className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-2 rounded border border-slate-200/80 dark:border-slate-800 italic font-serif leading-relaxed">
                    &ldquo;{item.questionSnippet}&rdquo;
                  </div>
                )}

                {/* Actionable Suggested Fix */}
                <div className="text-[11px] text-emerald-800 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/30 p-2 rounded border border-emerald-200/70 dark:border-emerald-800/50 flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Recommended Action:</strong> {item.suggestedFix}
                  </span>
                </div>

                {/* Expanded Technical Details */}
                {isExpanded && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                      <span>Server / Database Technical Response</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(item.technicalMessage);
                          toast.success('Technical error copied!');
                        }}
                        className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-normal normal-case"
                      >
                        <Copy className="w-3 h-3" /> Copy raw message
                      </button>
                    </div>

                    <pre className="bg-slate-900 text-slate-200 p-2.5 rounded text-[10px] font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed border border-slate-800">
                      {item.technicalMessage}
                    </pre>

                    {item.rawError && typeof item.rawError === 'object' && Object.keys(item.rawError).length > 0 && (
                      <details className="text-[10px] font-mono text-slate-600 dark:text-slate-400">
                        <summary className="cursor-pointer text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                          Inspect Raw Error Object
                        </summary>
                        <pre className="bg-slate-950 text-slate-300 p-2 rounded mt-1 overflow-x-auto text-[10px]">
                          {JSON.stringify(item.rawError, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
