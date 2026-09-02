import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Database, Settings, ShieldAlert, History, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export const BackupsTab = () => {
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const fetchBackups = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('admin_backups')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        if (error.code === '42P01') {
          // Table doesn't exist yet, wait for migration
          setBackups([]);
          return;
        }
        throw error;
      }
      setBackups(data || []);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load export history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  const handleManualBackup = async (type: 'questions' | 'settings' | 'users') => {
    try {
      setIsExporting(true);
      toast.info(`Preparing full ${type} export... This may take a few moments.`);
      
      let dataToExport: any[] = [];
      
      if (type === 'questions') {
        // Range-paginated fetch to ensure all 6,235+ questions are included
        let from = 0;
        const pageSize = 1000;
        while (true) {
          const { data: chunk, error } = await supabase
            .from('questions')
            .select('*')
            .range(from, from + pageSize - 1);
          
          if (error) throw error;
          if (!chunk || chunk.length === 0) break;
          dataToExport = dataToExport.concat(chunk);
          if (chunk.length < pageSize) break;
          from += pageSize;
        }
      } else if (type === 'settings') {
        const { data, error } = await supabase.from('admin_settings').select('*');
        if (error) throw error;
        dataToExport = data || [];
      } else {
        const { data, error } = await supabase.from('profiles').select('*');
        if (error) throw error;
        dataToExport = data || [];
      }

      // Log export to database if table exists
      try {
        await supabase.from('admin_backups').insert({
          backup_type: type,
          status: 'completed',
          record_count: dataToExport.length,
          file_size_kb: Math.round(JSON.stringify(dataToExport).length / 1024)
        });
        fetchBackups();
      } catch (err) {
        console.warn('Export audit log insert skipped:', err);
      }

      const jsonStr = JSON.stringify(dataToExport, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `scholars_resort_${type}_export_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`${type} export (${dataToExport.length} records) downloaded successfully.`);
    } catch (err) {
      console.error('Data export error:', err);
      toast.error(`Failed to export ${type} data`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-display text-slate-100">Data Exports & Database Recovery</h2>
          <p className="text-slate-400 text-sm">Download application JSON data exports or manage infrastructure database recovery snapshots.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Database className="w-5 h-5 text-blue-400" />
              Question Bank Export
            </CardTitle>
            <CardDescription className="text-slate-400">All 6,235+ active and draft questions with options & explanations.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => handleManualBackup('questions')} 
              disabled={isExporting}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              <Download className="w-4 h-4 mr-2" />
              {isExporting ? 'Exporting...' : 'Export Complete JSON'}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="w-5 h-5 text-purple-400" />
              System Configuration
            </CardTitle>
            <CardDescription className="text-slate-400">Academic rules, AI prompts, and platform settings.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => handleManualBackup('settings')} 
              disabled={isExporting}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Settings JSON
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              PostgreSQL Disaster Recovery
            </CardTitle>
            <CardDescription className="text-slate-400">Physical database snapshots and Point-in-Time Recovery (PITR).</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline"
              className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
              onClick={() => window.open('https://supabase.com/dashboard', '_blank')}
            >
              Open Supabase PITR Console
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900 border-slate-800 text-slate-100 mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-green-400" />
            Data Export History Log
          </CardTitle>
          <CardDescription className="text-slate-400">Audit trail of recent data export jobs and snapshot records.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4 font-medium">Timestamp</th>
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium">Records</th>
                  <th className="px-6 py-4 font-medium">Size</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {loading ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">Loading export logs...</td></tr>
                ) : backups.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center flex flex-col items-center justify-center text-slate-500">
                      <Clock className="w-8 h-8 mb-2 opacity-50" />
                      <p>No export history found yet.</p>
                      <p className="text-xs mt-1">Manual data exports will appear here upon completion.</p>
                    </td>
                  </tr>
                ) : (
                  backups.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-slate-400 font-mono text-xs">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-300 capitalize">
                        {log.backup_type}
                      </td>
                      <td className="px-6 py-4 text-slate-300 font-mono text-xs">
                        {log.record_count ? `${log.record_count} items` : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-400 font-mono text-xs">
                        {log.file_size_kb ? `${(log.file_size_kb / 1024).toFixed(2)} MB` : 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          log.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
