import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Download, Filter, RefreshCcw, AlertTriangle, Bug, Copy, Trash2, Database, Terminal } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { errorTracker, type SystemErrorLog } from '@/lib/errorTracker';

export const LogsTab = () => {
  const [activeTab, setActiveTab] = useState<'audit' | 'errors'>('errors');
  
  // Audit Logs State
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');

  // Error Diagnostics State
  const [errorLogs, setErrorLogs] = useState<SystemErrorLog[]>([]);
  const [errorSearch, setErrorSearch] = useState('');
  const [errorFilter, setErrorFilter] = useState('all');

  useEffect(() => {
    // Subscribe to local ErrorTracker updates
    const unsubscribe = errorTracker.subscribe((updated) => {
      setErrorLogs([...updated]);
    });
    return unsubscribe;
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('audit_logs')
        .select('*, profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(100);

      if (filterType !== 'all') {
        query = query.eq('entity_type', filterType);
      }
      if (search) {
        query = query.ilike('action', `%${search}%`);
      }

      const { data, error } = await query;
      if (error && error.code !== 'PGRST116') {
        // Fallback to activity_logs if audit_logs fails
        const { data: actData } = await supabase.from('activity_logs').select('*, profiles(full_name)').order('created_at', { ascending: false }).limit(50);
        setLogs(actData || []);
      } else {
        setLogs(data || []);
      }
    } catch (e) {
      console.warn(e);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [filterType, search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const copyTrace = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Error trace copied to clipboard!');
  };

  const filteredErrors = errorLogs.filter(err => {
    const matchesFilter = errorFilter === 'all' || err.type === errorFilter;
    const matchesSearch = !errorSearch || 
      err.message.toLowerCase().includes(errorSearch.toLowerCase()) || 
      (err.stack && err.stack.toLowerCase().includes(errorSearch.toLowerCase())) ||
      (err.component && err.component.toLowerCase().includes(errorSearch.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-display text-slate-100 flex items-center gap-2">
            <Terminal className="w-6 h-6 text-primary" /> Centralized Diagnostics & Telemetry
          </h2>
          <p className="text-slate-400 text-sm">Real-time error tracking and audit activity logging.</p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant={activeTab === 'errors' ? 'default' : 'outline'} 
            onClick={() => setActiveTab('errors')}
            className="gap-2 text-xs"
          >
            <Bug className="w-4 h-4 text-red-400" /> Realtime Errors ({errorLogs.length})
          </Button>
          <Button 
            variant={activeTab === 'audit' ? 'default' : 'outline'} 
            onClick={() => setActiveTab('audit')}
            className="gap-2 text-xs"
          >
            <Database className="w-4 h-4 text-blue-400" /> Audit Activity Logs
          </Button>
        </div>
      </div>

      {activeTab === 'errors' ? (
        <div className="space-y-4">
          <Card className="bg-slate-900 border-slate-800 text-slate-100">
            <CardHeader className="py-4 border-b border-slate-800">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <CardTitle className="text-base flex items-center gap-2 text-red-400">
                    <AlertTriangle className="w-5 h-5 text-red-400" /> Secret Live Code & Database Error Console
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Catches runtime JavaScript errors, failed database queries, and AI exceptions automatically.
                  </CardDescription>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                  <Input 
                    placeholder="Search stack traces & messages..." 
                    value={errorSearch}
                    onChange={e => setErrorSearch(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs w-full md:w-64"
                  />
                  <select 
                    value={errorFilter} 
                    onChange={e => setErrorFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-md px-2"
                  >
                    <option value="all">All Error Types</option>
                    <option value="runtime_error">Runtime Error</option>
                    <option value="unhandled_rejection">Unhandled Promise</option>
                    <option value="database_error">Database Error</option>
                    <option value="ai_error">AI Error</option>
                  </select>
                  <Button variant="outline" size="icon" onClick={() => errorTracker.clearLogs()} title="Clear console errors">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {filteredErrors.length === 0 ? (
                <div className="py-12 text-center text-slate-500 font-mono text-sm border-2 border-dashed border-slate-800 rounded-xl">
                  <Bug className="w-10 h-10 mx-auto text-green-500 opacity-50 mb-3" />
                  <p className="text-slate-300 font-bold">No active errors detected.</p>
                  <p className="text-xs text-slate-500 mt-1">Platform code and database calls are executing cleanly.</p>
                </div>
              ) : (
                filteredErrors.map((err) => (
                  <div key={err.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2 font-mono text-xs">
                    <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded font-bold uppercase ${
                          err.type === 'database_error' ? 'bg-amber-500/20 text-amber-400' :
                          err.type === 'ai_error' ? 'bg-purple-500/20 text-purple-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {err.type.replace('_', ' ')}
                        </span>
                        {err.component && <span className="text-slate-400">[{err.component}]</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500">{new Date(err.timestamp).toLocaleTimeString()}</span>
                        <Button size="icon" variant="ghost" className="w-6 h-6" onClick={() => copyTrace(`${err.message}\n${err.stack || ''}`)}>
                          <Copy className="w-3.5 h-3.5 text-slate-400 hover:text-white" />
                        </Button>
                      </div>
                    </div>

                    <p className="text-red-400 font-bold leading-relaxed">{err.message}</p>

                    {err.stack && (
                      <pre className="p-2 bg-slate-900 rounded border border-slate-800 text-slate-400 overflow-x-auto text-[11px] leading-snug">
                        {err.stack}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader className="border-b border-slate-800 pb-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input 
                  placeholder="Search action logs..." 
                  className="pl-9 bg-slate-950 border-slate-800"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-500" />
                <select 
                  className="bg-slate-950 border border-slate-800 rounded-md text-sm p-2 text-slate-300"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <option value="all">All Entities</option>
                  <option value="auth">Auth</option>
                  <option value="exam">Exams</option>
                  <option value="payment">Payments</option>
                  <option value="support">Support</option>
                </select>
                <Button onClick={fetchLogs} variant="outline" size="icon" className="border-slate-800 text-slate-300">
                  <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4 font-medium">Timestamp</th>
                    <th className="px-6 py-4 font-medium">User</th>
                    <th className="px-6 py-4 font-medium">Action</th>
                    <th className="px-6 py-4 font-medium">Entity</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {loading ? (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">Loading logs...</td></tr>
                  ) : logs.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No logs found matching criteria.</td></tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-slate-400 font-mono text-xs">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                          {log.profiles?.full_name || 'System'}
                        </td>
                        <td className="px-6 py-4 text-slate-300">
                          {log.action}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 rounded bg-slate-800 text-xs text-slate-300 capitalize">
                            {log.entity_type || 'activity'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="flex items-center gap-1.5 text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                            <span className="capitalize text-slate-400">{log.status || 'Success'}</span>
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
      )}
    </div>
  );
};
