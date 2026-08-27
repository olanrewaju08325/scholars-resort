import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertTriangle, Trash2, Edit2, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { MathText } from '@/components/MathText';

export const CorrectionQueueTab = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      // Check local storage first for simplicity in this demo environment
      const localReports = JSON.parse(localStorage.getItem('jamb_reported_errors') || '[]');
      
      // Also try supabase
      const { safeSupabaseQuery } = await import('@/lib/safeSupabase');
      const dbRes = await safeSupabaseQuery<any[]>(
        supabase.from('reported_errors').select('*'),
        { contextName: 'CorrectionQueueTab', fallbackValue: [] }
      );
      
      let allReports = [...localReports, ...(dbRes.data || [])];
      
      setReports(allReports);
    } catch (e) {
      console.warn("Failed to fetch reports:", e);
    } finally {
      setLoading(false);
    }
  };

  const markResolved = async (id: string, qId: string) => {
    try {
      const { error } = await supabase.from('reported_errors').update({ status: 'resolved' }).eq('id', id);
      
      // Filter out from local
      const localReports = JSON.parse(localStorage.getItem('jamb_reported_errors') || '[]');
      const newLocal = localReports.filter((r: any) => r.id !== id);
      localStorage.setItem('jamb_reported_errors', JSON.stringify(newLocal));
      
      setReports(prev => prev.filter(r => r.id !== id));
      toast.success("Issue marked as resolved.");
    } catch (e) {
      toast.error("Failed to update.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-500" /> Correction Queue
          </h2>
          <p className="text-slate-400 text-sm">Review questions flagged by students during exams for typos or errors.</p>
        </div>
        <Button onClick={fetchReports} variant="outline">
          Refresh Queue
        </Button>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Reported Questions ({reports.length})</CardTitle>
          <CardDescription>Questions that need admin attention</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8"><span className="animate-pulse">Loading...</span></div>
          ) : reports.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <p>No reported errors. The database is clean!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((report, idx) => (
                <div key={idx} className="p-4 border border-border rounded-xl bg-muted/20">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-mono text-slate-500">Question ID: {report.question_id}</span>
                    <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-1 rounded">
                      {report.reason || 'Reported Error'}
                    </span>
                  </div>
                  <p className="text-sm text-foreground mb-4 font-medium italic">
                    "{report.details || 'No details provided by student.'}"
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => markResolved(report.id, report.question_id)}>
                      <CheckCircle className="w-4 h-4 mr-2 text-emerald-500" /> Mark Resolved
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
