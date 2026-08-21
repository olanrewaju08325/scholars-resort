import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Activity, Search, Filter, Trash2, Download, RefreshCw, 
  ShieldCheck, FileQuestion, BookOpen, Users, Terminal, Clock, User
} from 'lucide-react';
import { 
  fetchAllAdminActivities, 
  clearLocalActivities, 
  type AdminActivityItem 
} from '@/services/adminActivityService';
import Papa from 'papaparse';
import { toast } from 'sonner';

export const AdminActivityLog: React.FC = () => {
  const [activities, setActivities] = useState<AdminActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('all');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const logs = await fetchAllAdminActivities();
      setActivities(logs);
    } catch (e) {
      console.warn('Error loading admin activities:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();

    const handleLogged = () => {
      loadLogs();
    };

    window.addEventListener('admin_activity_logged', handleLogged);
    return () => window.removeEventListener('admin_activity_logged', handleLogged);
  }, [loadLogs]);

  const handleClear = () => {
    if (confirm('Are you sure you want to clear your local admin activity history?')) {
      clearLocalActivities();
      setActivities([]);
      toast.success('Local activity logs cleared.');
    }
  };

  const handleExportCSV = () => {
    if (activities.length === 0) {
      toast.error('No activity logs to export.');
      return;
    }

    const data = activities.map((item, idx) => ({
      'S/N': idx + 1,
      'Timestamp': new Date(item.timestamp).toLocaleString(),
      'Action': item.action,
      'Details': item.details,
      'Category/Entity': item.entity,
      'User Name': item.user_name || 'Admin',
      'User Email': item.user_email || 'admin@scholarsresort.com'
    }));

    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Admin_Activity_Log_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Exported activity log to CSV!');
  };

  const filteredActivities = activities.filter(act => {
    const matchEntity = entityFilter === 'all' || act.entity === entityFilter;
    const matchSearch = !search || 
      act.action.toLowerCase().includes(search.toLowerCase()) || 
      act.details.toLowerCase().includes(search.toLowerCase()) ||
      (act.user_email && act.user_email.toLowerCase().includes(search.toLowerCase()));
    return matchEntity && matchSearch;
  });

  const getEntityBadge = (entity: AdminActivityItem['entity']) => {
    switch(entity) {
      case 'question_bank':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-500 border border-purple-500/20 flex items-center gap-1"><FileQuestion className="w-3 h-3" /> Question Bank</span>;
      case 'literature':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 flex items-center gap-1"><BookOpen className="w-3 h-3" /> Literature</span>;
      case 'user':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center gap-1"><Users className="w-3 h-3" /> Users</span>;
      case 'export':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1"><Download className="w-3 h-3" /> Export</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground border border-border flex items-center gap-1"><Terminal className="w-3 h-3" /> System</span>;
    }
  };

  return (
    <Card className="bg-card text-card-foreground border-border min-w-0 w-full overflow-hidden shadow-sm">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border bg-muted/20">
        <div>
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary animate-pulse" />
            Admin Activity & Oversight Log
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Audited record of administrative actions, mass deletions, batch updates, and dataset exports.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={loadLogs} className="text-xs font-semibold gap-1.5 h-8">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="text-xs font-semibold gap-1.5 h-8">
            <Download className="w-3.5 h-3.5" /> Export Log
          </Button>
          <Button variant="ghost" size="sm" onClick={handleClear} className="text-xs font-semibold text-destructive hover:bg-destructive/10 h-8">
            <Trash2 className="w-3.5 h-3.5" /> Clear Local
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-muted/30 border border-border rounded-xl">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder="Search action, details, user..." 
              className="pl-9 h-9 text-xs bg-background"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
            <select 
              value={entityFilter} 
              onChange={e => setEntityFilter(e.target.value)}
              className="h-9 text-xs bg-background border border-border rounded-md px-2 text-foreground font-semibold shrink-0"
            >
              <option value="all">All Modules</option>
              <option value="question_bank">Question Bank</option>
              <option value="literature">Literature Bank</option>
              <option value="export">Exports</option>
              <option value="user">Users</option>
              <option value="system">System</option>
            </select>
          </div>
        </div>

        {/* Activity Stream */}
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {filteredActivities.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
              No recorded administrative activities found.
            </div>
          ) : (
            filteredActivities.map((act) => (
              <div 
                key={act.id} 
                className="p-3 bg-card border border-border hover:border-primary/40 rounded-xl transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 mt-0.5">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-foreground uppercase tracking-wider text-[11px]">
                        {act.action}
                      </span>
                      {getEntityBadge(act.entity)}
                    </div>
                    <p className="text-muted-foreground leading-relaxed break-words font-medium">
                      {act.details}
                    </p>
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border text-[11px] text-muted-foreground gap-1">
                  <span className="flex items-center gap-1 font-mono text-foreground font-semibold">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span className="flex items-center gap-1 opacity-80 truncate max-w-[150px]">
                    <User className="w-3 h-3" />
                    {act.user_email || 'Admin'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
