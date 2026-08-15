import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Database, Settings, ShieldAlert, History, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export const BackupsTab = () => {
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchBackups();
  }, []);

  const fetchBackups = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('admin_backups')
        .select('*, profiles(full_name)')
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
      toast.error('Failed to load backup history');
    } finally {
      setLoading(false);
    }
  };

  const handleManualBackup = async (type: 'questions' | 'settings' | 'users') => {
    try {
      setIsExporting(true);
      toast.info(`Preparing ${type} backup... This may take a moment.`);
      
      let dataToExport = [];
      
      if (type === 'questions') {
        const { data } = await supabase.from('questions').select('*');
        dataToExport = data || [];
      } else if (type === 'settings') {
        const { data } = await supabase.from('admin_settings').select('*');
        dataToExport = data || [];
      } else {
        const { data } = await supabase.from('profiles').select('*');
        dataToExport = data || [];
      }

      // Log backup to database if table exists
      try {
        await supabase.from('admin_backups').insert({
          backup_type: type,
          status: 'completed',
          record_count: dataToExport.length,
          file_size_kb: Math.round(JSON.stringify(dataToExport).length / 1024)
        });
        fetchBackups();
      } catch (err) {
        console.warn('Backup audit log insert skipped:', err);
      }

      const jsonStr = JSON.stringify(dataToExport, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `scholars_resort_backup_${type}_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`${type} backup completed successfully`);
    } catch (err) {
      console.error('Backup creation error:', err);
      toast.error(`Failed to create ${type} backup`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-display text-slate-100">Automated Backups</h2>
          <p className="text-slate-400 text-sm">Secure and manage your platform's critical data.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Database className="w-5 h-5 text-blue-400" />
              Question Bank
            </CardTitle>
            <CardDescription className="text-slate-400">All questions, answers, and explanations.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => handleManualBackup('questions')} 
              disabled={isExporting}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Export JSON
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="w-5 h-5 text-purple-400" />
              System Settings
            </CardTitle>
            <CardDescription className="text-slate-400">Platform configs and AI prompts.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => handleManualBackup('settings')} 
              disabled={isExporting}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Export JSON
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              Full Database Dump
            </CardTitle>
            <CardDescription className="text-slate-400">Requires Supabase Dashboard access.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline"
              className="w-full border-slate-700 text-slate-300"
              onClick={() => window.open('https://supabase.com/dashboard', '_blank')}
            >
              Open Supabase
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900 border-slate-800 text-slate-100 mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-green-400" />
            Backup History Log
          </CardTitle>
          <CardDescription className="text-slate-400">Recent manual and automated backups.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4 font-medium">Timestamp</th>
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium">Initiated By</th>
                  <th className="px-6 py-4 font-medium">Size</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {loading ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">Loading history...</td></tr>
                ) : backups.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center flex flex-col items-center justify-center text-slate-500">
                      <Clock className="w-8 h-8 mb-2 opacity-50" />
                      <p>No backup history found.</p>
                      <p className="text-xs mt-1">Manual exports will appear here after the migration runs.</p>
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
                      <td className="px-6 py-4 text-slate-300">
                        {log.profiles?.full_name || 'System/Automated'}
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
