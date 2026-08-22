import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { ShieldAlert, Shield, ShieldOff, Search, UserX, UserCheck } from 'lucide-react';
import { useConfirm } from '@/hooks/useConfirm';

export const SecurityTab = () => {
  const [bannedUsers, setBannedUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { confirmAction, ConfirmElement } = useConfirm();

  // Ban Form
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<any>(null);
  const [banReason, setBanReason] = useState('');

  // Security Logs
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);

  useEffect(() => {
    fetchBannedUsers();
    fetchSecurityLogs();
  }, []);

  const fetchBannedUsers = async () => {
    setLoading(true);
    // Since we don't have a direct 'banned' boolean on profiles in current schema,
    // we'll assume a profile role of 'banned' or we'll use a tag in metadata.
    // For this implementation, we will query profiles with role = 'suspended'.
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'suspended')
      .order('updated_at', { ascending: false });

    if (!error && data) {
      setBannedUsers(data);
    }
    setLoading(false);
  };

  const fetchSecurityLogs = async () => {
    try {
      // Fetch failed login attempts from activity logs if any, or high-risk actions
      const { data: rawLogs } = await supabase
        .from('activity_logs')
        .select('*')
        .in('action', ['failed_login', 'password_reset', 'account_locked', 'role_changed'])
        .order('created_at', { ascending: false })
        .limit(15);
        
      if (rawLogs && rawLogs.length > 0) {
        const userIds = Array.from(new Set(rawLogs.map(l => l.user_id).filter(Boolean)));
        let profileMap: Record<string, any> = {};
        if (userIds.length > 0) {
          const { data: profiles } = await supabase.from('profiles').select('id, full_name, email').in('id', userIds);
          profiles?.forEach(p => { profileMap[p.id] = p; });
        }
        const formatted = rawLogs.map(l => ({
          ...l,
          profiles: profileMap[l.user_id] || { full_name: 'System User', email: '' }
        }));
        setSecurityLogs(formatted);
      } else {
        setSecurityLogs([]);
      }
    } catch {
      setSecurityLogs([]);
    }
  };

  const searchUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setSearching(true);
    try {
      const { data: users, error } = await supabase
        .from('profiles')
        .select('*')
        .or(`email.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%`)
        .limit(1);

      if (error) throw error;

      if (!users || users.length === 0) {
        toast.error("User not found");
        setFoundUser(null);
      } else {
        setFoundUser(users[0]);
        setBanReason('');
      }
    } catch (err: any) {
      toast.error(`Search failed: ${err.message}`);
    }
    setSearching(false);
  };

  const suspendUser = async () => {
    if (!foundUser) return;
    if (foundUser.role === 'admin') {
      toast.error("Cannot suspend an admin account from here.");
      return;
    }
    
    confirmAction(
      "Suspend User",
      `Are you sure you want to suspend ${foundUser.full_name}? They will not be able to access the platform.`,
      async () => {
        try {
          const { error } = await supabase.from('profiles').update({
            role: 'suspended'
          }).eq('id', foundUser.id);
          
          if (error) throw error;
          
          toast.success(`User ${foundUser.full_name} has been suspended.`);
          setFoundUser(null);
          setSearchTerm('');
          fetchBannedUsers();
          
          // Log it
          const { data: { user } } = await supabase.auth.getUser();
          await supabase.from('activity_logs').insert({
            user_id: user?.id,
            action: 'role_changed',
            details: `Suspended user ${foundUser.id} - Reason: ${banReason || 'None provided'}`
          });
          fetchSecurityLogs();
          
        } catch (err: any) {
          toast.error(`Failed to suspend user: ${err.message}`);
        }
      },
      { destructive: true }
    );
  };

  const restoreUser = async (userId: string, name: string) => {
    confirmAction(
      "Restore User Access",
      `Are you sure you want to restore access for ${name}?`,
      async () => {
        try {
          const { error } = await supabase.from('profiles').update({
            role: 'student' // default back to student
          }).eq('id', userId);
          
          if (error) throw error;
          
          toast.success(`Access restored for ${name}.`);
          fetchBannedUsers();
          
          // Log it
          const { data: { user } } = await supabase.auth.getUser();
          await supabase.from('activity_logs').insert({
            user_id: user?.id,
            action: 'role_changed',
            details: `Restored access for user ${userId}`
          });
          fetchSecurityLogs();
          
        } catch (err: any) {
          toast.error(`Failed to restore user: ${err.message}`);
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      {ConfirmElement}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-red-500" /> Security & Access Control
          </h2>
          <p className="text-slate-400">Manage account suspensions and monitor platform security events.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Suspend User Form */}
        <Card className="bg-slate-900 border-slate-800 text-slate-100 h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserX className="w-5 h-5 text-red-400" /> Suspend Account</CardTitle>
            <CardDescription className="text-slate-400">Find a user to revoke their platform access completely.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={searchUser} className="flex gap-2 mb-4">
              <Input 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                placeholder="Search by name or email..." 
                className="bg-slate-950 border-slate-800"
              />
              <Button type="submit" disabled={searching} className="bg-slate-800 hover:bg-slate-700">
                <Search className="w-4 h-4" />
              </Button>
            </form>

            {foundUser && foundUser.role !== 'suspended' && (
              <div className="p-4 bg-red-950/20 border border-red-900/50 rounded-lg space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-bold text-red-100">{foundUser.full_name}</div>
                    <div className="text-xs text-red-300">{foundUser.email}</div>
                  </div>
                  <span className="px-2 py-1 bg-slate-800 text-slate-300 text-xs rounded uppercase font-bold">
                    {foundUser.role}
                  </span>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-red-300">Reason for suspension (optional)</label>
                  <Input 
                    value={banReason} 
                    onChange={(e) => setBanReason(e.target.value)} 
                    placeholder="e.g. Terms of service violation" 
                    className="bg-slate-950 border-red-900/30 text-sm"
                  />
                </div>
                <Button onClick={suspendUser} className="w-full bg-red-600 hover:bg-red-700 text-white">
                  Confirm Suspension
                </Button>
              </div>
            )}
            
            {foundUser && foundUser.role === 'suspended' && (
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg text-center text-slate-400">
                This user is already suspended.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Suspended Users List */}
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldOff className="w-5 h-5 text-orange-400" /> Suspended Users</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-4 text-slate-500">Loading...</div>
            ) : bannedUsers.length === 0 ? (
              <div className="text-center py-6 text-slate-500 italic">No users are currently suspended.</div>
            ) : (
              <div className="space-y-3">
                {bannedUsers.map(user => (
                  <div key={user.id} className="flex justify-between items-center p-3 bg-slate-950 border border-slate-800 rounded-lg">
                    <div>
                      <div className="font-bold text-slate-300">{user.full_name}</div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                      <div className="text-[10px] text-slate-600 mt-1">Suspended: {new Date(user.updated_at).toLocaleDateString()}</div>
                    </div>
                    <Button variant="outline" size="sm" className="text-green-400 border-green-900/30 hover:bg-green-950 hover:text-green-300" onClick={() => restoreUser(user.id, user.full_name)}>
                      <UserCheck className="w-4 h-4 mr-1" /> Restore
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security Logs */}
        <Card className="md:col-span-2 bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5 text-blue-400" /> Security Event Logs</CardTitle>
            <CardDescription className="text-slate-400">Recent high-risk actions across the platform.</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-300">
                <thead className="text-xs text-slate-400 uppercase bg-slate-950/50">
                  <tr>
                    <th className="px-4 py-3 rounded-tl-lg">Timestamp</th>
                    <th className="px-4 py-3">Event Type</th>
                    <th className="px-4 py-3">User Involved</th>
                    <th className="px-4 py-3 rounded-tr-lg">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {securityLogs.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-8 text-slate-500">No recent security events.</td></tr>
                  ) : securityLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-xs">{new Date(log.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          log.action === 'failed_login' ? 'bg-red-500/20 text-red-400' :
                          log.action === 'role_changed' ? 'bg-orange-500/20 text-orange-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {log.action.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-300">{log.profiles?.full_name || 'System / Unknown'}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {log.details || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
