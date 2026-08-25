import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Database, ShieldCheck, AlertTriangle, XCircle, CheckCircle2, 
  RefreshCw, Wrench, FileCode, Check, AlertOctagon, Table
} from 'lucide-react';
import { SchemaMigrationService, type SchemaValidationReport as ReportType, type AutoMigrationResult } from '@/services/schemaMigrationService';
import { toast } from 'sonner';

export const SchemaValidationReport: React.FC = () => {
  const [report, setReport] = useState<ReportType | null>(null);
  const [loading, setLoading] = useState(true);
  const [repairing, setRepairing] = useState(false);
  const [migrationResult, setMigrationResult] = useState<AutoMigrationResult | null>(null);
  const [selectedTable, setSelectedTable] = useState<string>('all');

  const runInspection = async () => {
    setLoading(true);
    try {
      const data = await SchemaMigrationService.inspectDatabaseSchema();
      setReport(data);
    } catch (err: any) {
      toast.error(`Schema inspection failed: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRunAutoRepair = async () => {
    setRepairing(true);
    toast.info('Running automated database schema migration & integrity repair...');
    try {
      const res = await SchemaMigrationService.runAutoMigrationRepair();
      setMigrationResult(res);
      if (res.success) {
        toast.success(`Schema migration completed! Repaired ${res.repairedRecordsCount} records.`);
      } else {
        toast.warning(`Migration completed with ${res.errors.length} errors.`);
      }
      // Refresh report
      await runInspection();
    } catch (err: any) {
      toast.error(`Auto-migration failed: ${err.message || err}`);
    } finally {
      setRepairing(false);
    }
  };

  useEffect(() => {
    runInspection();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground">Inspecting database tables, foreign keys, and constraints...</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-8 text-center bg-card rounded-2xl border border-border space-y-3">
        <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
        <p className="text-sm text-muted-foreground">Could not generate schema validation report.</p>
        <Button onClick={runInspection} variant="outline" size="sm">Retry Inspection</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Action Bar */}
      <div className="p-5 rounded-2xl bg-card/70 border border-border/60 shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              Automated Database Schema Validation & Migration
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Audits table constraints, foreign key mappings, null constraints, and orphaned records across <code className="font-mono text-primary">questions</code>, <code className="font-mono text-primary">subjects</code>, <code className="font-mono text-primary">topics</code>, and <code className="font-mono text-primary">user_progress</code>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={runInspection}
              disabled={loading || repairing}
              className="gap-1.5 h-9 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Re-scan Tables
            </Button>

            <Button
              size="sm"
              onClick={handleRunAutoRepair}
              disabled={repairing}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-9 text-xs shadow-md"
            >
              {repairing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Running Auto-Migration...
                </>
              ) : (
                <>
                  <Wrench className="w-3.5 h-3.5" />
                  Execute Auto-Migration Script
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Global KPI Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-border/40">
          <div className="p-3 rounded-xl bg-background/80 border border-border/50">
            <span className="text-[11px] text-muted-foreground block">Schema Status</span>
            <div className="flex items-center gap-1.5 mt-1">
              {report.overallStatus === 'healthy' ? (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-xs">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  100% HEALTHY
                </Badge>
              ) : report.overallStatus === 'warning' ? (
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-xs">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {report.warningIssuesCount} WARNINGS
                </Badge>
              ) : (
                <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/40 text-xs">
                  <AlertOctagon className="w-3 h-3 mr-1" />
                  {report.criticalIssuesCount} CRITICAL
                </Badge>
              )}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-background/80 border border-border/50">
            <span className="text-[11px] text-muted-foreground block">Tables Audited</span>
            <span className="font-mono text-sm font-bold text-foreground mt-1 block">
              {report.totalTablesInspected} Tables
            </span>
          </div>

          <div className="p-3 rounded-xl bg-background/80 border border-border/50">
            <span className="text-[11px] text-muted-foreground block">Total Questions / Active</span>
            <span className="font-mono text-sm font-bold text-primary mt-1 block">
              {report.summary.questionsTotal.toLocaleString()} ({report.summary.questionsActive.toLocaleString()} active)
            </span>
          </div>

          <div className="p-3 rounded-xl bg-background/80 border border-border/50">
            <span className="text-[11px] text-muted-foreground block">Official Subjects</span>
            <span className="font-mono text-sm font-bold text-emerald-400 mt-1 block">
              {report.summary.subjectsTotal} Registered
            </span>
          </div>
        </div>
      </div>

      {/* Auto-Migration Results Banner (if ran) */}
      {migrationResult && (
        <Card className="border-emerald-500/40 bg-emerald-950/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-emerald-400 flex items-center gap-2">
              <Check className="w-4 h-4" />
              Auto-Migration Execution Log
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-xs space-y-1 font-mono text-emerald-200">
              {migrationResult.actionsApplied.map((act, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> {act}
                </div>
              ))}
              {migrationResult.errors.map((err, i) => (
                <div key={i} className="flex items-center gap-2 text-rose-400">
                  <span>✕</span> {err}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table-by-Table Schema Inspection */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Table className="w-4 h-4 text-primary" />
            Table Constraint & Integrity Breakdown
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(report.tables).map(([tblKey, tbl]) => {
            return (
              <Card key={tblKey} className="border-border/50 bg-card/60">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${
                        tbl.status === 'healthy' ? 'bg-emerald-500/10 text-emerald-400' :
                        tbl.status === 'warning' ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'
                      }`}>
                        <Database className="w-4 h-4" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-bold font-mono">public.{tbl.tableName}</CardTitle>
                        <CardDescription className="text-xs">{tbl.totalRecords.toLocaleString()} total rows</CardDescription>
                      </div>
                    </div>

                    <Badge className={
                      tbl.status === 'healthy' 
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]' 
                        : tbl.status === 'warning'
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]'
                          : 'bg-rose-500/20 text-rose-400 border-rose-500/30 text-[10px]'
                    }>
                      {tbl.status.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {tbl.issues.length === 0 ? (
                    <div className="p-3 rounded-lg bg-emerald-950/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>All foreign keys, null constraints, and JSON schemas passed validation.</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tbl.issues.map((iss, idx) => (
                        <div 
                          key={idx} 
                          className={`p-3 rounded-lg border text-xs space-y-1 ${
                            iss.severity === 'critical' ? 'bg-rose-950/15 border-rose-500/30 text-rose-200' :
                            iss.severity === 'warning' ? 'bg-amber-950/15 border-amber-500/30 text-amber-200' :
                            'bg-blue-950/15 border-blue-500/30 text-blue-200'
                          }`}
                        >
                          <div className="flex items-center justify-between font-bold">
                            <span className="capitalize">{iss.type.replace(/_/g, ' ')} ({iss.field})</span>
                            <Badge variant="outline" className="text-[10px] uppercase">
                              {iss.count} Rows
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground">{iss.description}</p>
                          {iss.sampleIds && iss.sampleIds.length > 0 && (
                            <div className="text-[10px] font-mono text-muted-foreground pt-1">
                              Sample IDs: {iss.sampleIds.slice(0, 3).join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};
