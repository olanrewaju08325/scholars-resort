import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Shield, Users, Search, RefreshCw, UserCheck, 
  UserX, ShieldAlert, GraduationCap, HeartHandshake, CheckCircle2, ArrowUpDown
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useConfirm } from '@/hooks/useConfirm';

export const RolesTab = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const { confirmAction, ConfirmElement } = useConfirm();

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, created_at, has_paid')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setUsers(data || []);
    } catch (e: any) {
      toast.error(`Failed to load users: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleChange = async (userId: string, userName: string, newRole: string) => {
    confirmAction(
      "Confirm Direct Role Update",
      `Are you sure you want to change the role of "${userName || userId}" to "${newRole.toUpperCase()}"?`,
      async () => {
        setUpdatingId(userId);
        try {
          const { error } = await supabase
            .from('profiles')
            .update({ role: newRole })
            .eq('id', userId);

          if (error) throw error;

          toast.success(`Role updated successfully to ${newRole.toUpperCase()}`);
          setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));

          // Log administrative activity
          const { data: authUser } = await supabase.auth.getUser();
          await supabase.from('activity_logs').insert({
            user_id: authUser?.user?.id,
            action: 'role_changed',
            details: `Changed role for ${userName} (${userId}) to ${newRole}`
          }).catch(() => null);

        } catch (err: any) {
          toast.error(`Failed to update role: ${err.message}`);
        } finally {
          setUpdatingId(null);
        }
      }
    );
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      (u.full_name && u.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const roleCounts = {
    admin: users.filter(u => u.role === 'admin').length,
    guardian: users.filter(u => u.role === 'guardian').length,
    student: users.filter(u => u.role === 'student').length,
    suspended: users.filter(u => u.role === 'suspended').length,
  };

  const roleConfigs = [
    {
      role: 'admin',
      title: 'Enterprise Admin',
      icon: Shield,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      description: 'Full un-restricted access to Command Center, System Configuration, AI Keys, & Database.',
      count: roleCounts.admin
    },
    {
      role: 'guardian',
      title: 'Parent / Guardian',
      icon: HeartHandshake,
      color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
      description: 'Access to Guardian Portal, linked student progress metrics, and performance reports.',
      count: roleCounts.guardian
    },
    {
      role: 'student',
      title: 'Scholar Student',
      icon: GraduationCap,
      color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
      description: 'Access to CBT Engine, AI Tutor Chat, Practice Sessions, Tournaments, & Weekly Challenges.',
      count: roleCounts.student
    },
    {
      role: 'suspended',
      title: 'Suspended Account',
      icon: ShieldAlert,
      color: 'text-red-400 bg-red-500/10 border-red-500/20',
      description: 'Access restricted across all platforms and services until reviewed by an admin.',
      count: roleCounts.suspended
    }
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      {ConfirmElement}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-display text-slate-100 flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" /> Simplified User Roles & Access Control
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Direct role-based authorization model without redundant multi-tier permission matrix overhead.
          </p>
        </div>
        <Button onClick={fetchUsers} variant="outline" size="sm" className="gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Accounts
        </Button>
      </div>

      {/* Role Architecture Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {roleConfigs.map((cfg) => {
          const Icon = cfg.icon;
          return (
            <Card key={cfg.role} className="bg-slate-900 border-slate-800 text-slate-100 flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-lg border ${cfg.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-2xl font-bold font-mono text-slate-200">{cfg.count}</span>
                </div>
                <CardTitle className="text-base mt-2">{cfg.title}</CardTitle>
                <CardDescription className="text-xs text-slate-400 line-clamp-2 mt-1">
                  {cfg.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-start text-xs text-slate-400 hover:text-white p-0 h-auto"
                  onClick={() => setRoleFilter(cfg.role)}
                >
                  Filter {cfg.title}s →
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Direct User Role Management Table */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" /> Direct User Role Assignments
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                View and update account authorization levels instantly.
              </CardDescription>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {/* Search */}
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <Input 
                  placeholder="Search user name or email..." 
                  className="pl-9 h-9 text-xs bg-slate-950 border-slate-800"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Role Filter */}
              <select 
                value={roleFilter} 
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-md text-xs font-mono px-3 h-9 text-slate-300"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin Only</option>
                <option value="guardian">Guardian Only</option>
                <option value="student">Student Only</option>
                <option value="suspended">Suspended Only</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-slate-500 text-xs font-mono">
              Fetching user authorization records...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs font-mono">
              No user accounts found matching your search.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="p-3">User</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Current Role</th>
                    <th className="p-3">Payment Status</th>
                    <th className="p-3">Registered</th>
                    <th className="p-3 text-right">Direct Authorization Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                  {filteredUsers.map((u) => {
                    const isCurrentAdmin = u.role === 'admin';
                    return (
                      <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 font-bold text-slate-200">
                          {u.full_name || 'Unnamed Scholar'}
                        </td>
                        <td className="p-3 text-slate-400">
                          {u.email}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            u.role === 'admin' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                            u.role === 'guardian' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' :
                            u.role === 'suspended' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                            'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                          }`}>
                            {u.role || 'student'}
                          </span>
                        </td>
                        <td className="p-3">
                          {u.has_paid ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Paid Member
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">Free Tier</span>
                          )}
                        </td>
                        <td className="p-3 text-slate-500">
                          {new Date(u.created_at || Date.now()).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-right">
                          <select
                            disabled={updatingId === u.id}
                            value={u.role || 'student'}
                            onChange={(e) => handleRoleChange(u.id, u.full_name || u.email, e.target.value)}
                            className="bg-slate-950 border border-slate-700 hover:border-slate-500 rounded px-2.5 py-1 text-xs font-mono text-slate-200 cursor-pointer transition-colors"
                          >
                            <option value="student">Set as Student</option>
                            <option value="guardian">Set as Guardian</option>
                            <option value="admin">Promote to Admin</option>
                            <option value="suspended">Suspend Account</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
};
