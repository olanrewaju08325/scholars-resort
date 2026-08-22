import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { getApiUrl } from '@/lib/utils';
import { toast } from 'sonner';
import { ShieldAlert, Shield, Search, UserX, UserCheck, Ban, AlertTriangle, RefreshCw } from 'lucide-react';
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
  const [banType, setBanType] = useState<'suspend' | 'ban'>('suspend');

  // Security Logs
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);

  useEffect(() => {
    fetchBannedUsers();
    fetchSecurityLogs();
  }, []);

  const fetchBannedUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or('status.eq.banned,status.eq.suspended,is_banned.eq.true,is_suspended.eq.true,role.eq.suspended')
        .order('updated_at', { ascending: false });

      if (!error && data) {
        setBannedUsers(data);
      }
    } catch {
      // fallback
    }
    setLoading(false);
  };

  const fetchSecurityLogs = async () => {
    try {
      const { data: rawLogs } = await supabase
        .from('activity_logs')
        .select('*')
        .in('action', ['failed_login', 'password_reset', 'account_locked', 'role_changed', 'USER_BANNED', 'USER_SUSPENDED', 'USER_ACTIVE'])
        .order('created_at', { ascending: false })
        .limit(20);
        
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
        .or(`email.ilike.%${searchTerm.trim()}%,full_name.ilike.%${searchTerm.trim()}%`)
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

  const executeStatusChange = async (status: 'suspended' | 'banned') => {
    if (!foundUser) return;
    if (foundUser.email?.toLowerCase().trim() === 'admitwise2@gmail.com') {
      toast.error("Cannot suspend or ban primary system administrator.");
      return;
    }
    
    confirmAction(
      `${status === 'banned' ? 'Ban' : 'Suspend'} User Account`,
      `Are you sure you want to ${status} ${foundUser.full_name || foundUser.email}? They will not be able to access the platform.`,
      async () => {
        try {
          await fetch(getApiUrl('/api/admin/users/status'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: foundUser.id,
              status,
              reason: banReason || 'Administrative action'
            })
          });

          await supabase.from('profiles').update({
            status,
            is_banned: status === 'banned',
            is_suspended: status === 'suspended',
            ban_reason: banReason || null
          }).eq('id', foundUser.id);
          
          toast.success(`User ${foundUser.full_name || foundUser.email} has been ${status}.`);
          setFoundUser(null);
          setSearchTerm('');
          fetchBannedUsers();
          fetchSecurityLogs();
        } catch (err: any) {
          toast.error(`Failed to update user status: ${err.message}`);
        }
      },
      { destructive: true }
    );
  };

  const restoreUser = async (userId: string, name: string) => {
    confirmAction(
      "Restore User Access",
      `Are you sure you want to restore full access for ${name}?`,
      async () => {
        try {
          await fetch(getApiUrl('/api/admin/users/status'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: userId,
              status: 'active',
              reason: 'Reactivated by administrator'
            })
          });

          await supabase.from('profiles').update({
            status: 'active',
            is_banned: false,
            is_suspended: false,
            ban_reason: null
          }).eq('id', userId);
          
          toast.success(`Access restored for ${name}.`);
          fetchBannedUsers();
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
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <ShieldAlert className="w-6 h-6 text-red-500" /> Security & Access Control
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm">Manage user suspensions, bans, and monitor platform security events.</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => { fetchBannedUsers(); fetchSecurityLogs(); }}
          className="border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs gap-1.5 font-semibold"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Suspend User Form */}
        <Card className="bg-slate-900 border-slate-800 text-slate-100 h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-white font-bold"><UserX className="w-5 h-5 text-red-400" /> Account Enforcement</CardTitle>
            <CardDescription className="text-slate-400 text-xs">Search for any account by email or name to apply a suspension or ban.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={searchUser} className="flex gap-2 mb-4">
              <Input 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                placeholder="Search user by name or email..." 
                className="bg-slate-950 border-slate-800 text-xs text-slate-200"
              />
              <Button type="submit" disabled={searching} className="bg-slate-800 hover:bg-slate-700 text-xs">
                <Search className="w-4 h-4 mr-1" /> {searching ? 'Searching...' : 'Find'}
              </Button>
            </form>

            {foundUser && (
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-white text-sm">{foundUser.full_name || 'Anonymous User'}</h4>
                    <p className="text-xs text-slate-400">{foundUser.email}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 uppercase">
                    Role: {foundUser.role}
                  </span>
                </div>

                <div className="pt-2">
                  <label className="text-xs text-slate-400 block mb-1 font-medium">Reason for Action:</label>
                  <Input 
                    placeholder="e.g. Repeated violation of terms, account misuse..." 
                    value={banReason} 
                    onChange={(e) => setBanReason(e.target.value)}
                    className="bg-slate-900 border-slate-700 text-xs text-slate-200 mb-3"
                  />
                  
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => executeStatusChange('suspended')} 
                      className="w-1/2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Suspend Account
                    </Button>
                    <Button 
                      onClick={() => executeStatusChange('banned')} 
                      className="w-1/2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
                    >
                      <Ban className="w-3.5 h-3.5 mr-1" /> Ban Account
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Suspended/Banned Accounts List */}
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-white font-bold"><Shield className="w-5 h-5 text-amber-400" /> Restricted Accounts ({bannedUsers.length})</CardTitle>
            <CardDescription className="text-slate-400 text-xs">Accounts currently suspended or permanently banned from platform access.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-slate-500 py-6 text-center">Loading restricted accounts...</p>
            ) : bannedUsers.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No accounts are currently banned or suspended.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                {bannedUsers.map((u) => (
                  <div key={u.id} className="flex justify-between items-center p-3 bg-slate-950 rounded-lg border border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-slate-200">{u.full_name || 'Anonymous User'}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                          u.status === 'banned' || u.is_banned ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                          {u.status === 'banned' || u.is_banned ? 'Banned' : 'Suspended'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{u.email}</p>
                      {u.ban_reason && (
                        <p className="text-[10px] text-slate-500 italic mt-0.5">Reason: {u.ban_reason}</p>
                      )}
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => restoreUser(u.id, u.full_name || u.email)}
                      className="border-emerald-800/60 text-emerald-400 hover:bg-emerald-950 text-xs font-semibold h-7"
                    >
                      <UserCheck className="w-3.5 h-3.5 mr-1" /> Restore Access
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Security Audit Trail */}
      <Card className="bg-slate-900 border-slate-800 text-slate-100">
        <CardHeader>
          <CardTitle className="text-base text-white font-bold">Security Audit Events</CardTitle>
          <CardDescription className="text-slate-400 text-xs">Recent security actions, lockouts, and administrative role modifications.</CardDescription>
        </CardHeader>
        <CardContent>
          {securityLogs.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">No security events recorded.</p>
          ) : (
            <div className="space-y-2">
              {securityLogs.map((log, idx) => (
                <div key={log.id || idx} className="flex justify-between items-center p-2.5 bg-slate-950/60 rounded border border-slate-800 text-xs">
                  <div>
                    <span className="font-mono text-[11px] font-semibold text-primary uppercase">{log.action}</span>
                    <span className="text-slate-400 ml-2">{log.details || 'Security action logged'}</span>
                  </div>
                  <span className="text-slate-500 text-[11px] whitespace-nowrap">
                    {new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
