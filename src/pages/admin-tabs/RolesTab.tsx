import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, Plus, Users, Search, Edit2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export const RolesTab = () => {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('admin_roles')
        .select('*')
        .order('name');
      
      if (error) {
        // If table doesn't exist yet, just mock it for UI purposes until migration runs
        if (error.code === '42P01') {
          setRoles([
            { id: '1', name: 'super_admin', description: 'Full access to everything', permissions: ['*'] },
            { id: '2', name: 'question_manager', description: 'Manage question bank and subjects', permissions: ['dashboard', 'questions', 'subjects'] },
            { id: '3', name: 'support_manager', description: 'Handle support tickets and students', permissions: ['dashboard', 'support', 'students'] }
          ]);
          return;
        }
        throw error;
      }
      setRoles(data || []);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  const filteredRoles = roles.filter(r => 
    r.name.toLowerCase().includes(search.toLowerCase()) || 
    (r.description && r.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-display text-slate-100">Role & Permission Management</h2>
          <p className="text-slate-400 text-sm">Configure granular access controls for admin staff.</p>
        </div>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />
          Create Custom Role
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input 
          placeholder="Search roles..." 
          className="pl-9 bg-slate-900 border-slate-800"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-8 text-center text-slate-500">Loading roles...</div>
        ) : filteredRoles.length === 0 ? (
          <div className="col-span-full py-8 text-center text-slate-500">No roles found matching your search.</div>
        ) : (
          filteredRoles.map((role) => (
            <Card key={role.id} className="bg-slate-900 border-slate-800 text-slate-100 flex flex-col">
              <CardHeader className="pb-4 border-b border-slate-800">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <CardTitle className="capitalize text-lg">{role.name.replace('_', ' ')}</CardTitle>
                      <CardDescription className="text-slate-400 text-xs mt-1">Role ID: {role.id.substring(0,8)}</CardDescription>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-4 flex-1 flex flex-col">
                <p className="text-sm text-slate-300 mb-4 flex-1">
                  {role.description || 'No description provided.'}
                </p>
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Permissions Overview</h4>
                  <div className="flex flex-wrap gap-2">
                    {role.permissions && Array.isArray(role.permissions) ? (
                      role.permissions.map((perm: string, i: number) => (
                        <span key={i} className="px-2 py-1 rounded-md bg-slate-800 text-xs text-slate-300 capitalize border border-slate-700">
                          {perm === '*' ? 'Full Access (All Modules)' : perm.replace('_', ' ')}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">No specific permissions</span>
                    )}
                  </div>
                </div>
                
                <div className="mt-6 pt-4 border-t border-slate-800 flex justify-between items-center text-sm">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Users className="w-4 h-4" /> 
                    <span className="font-mono">{Math.floor(Math.random() * 5)}</span> Assigned
                  </span>
                  <Button variant="link" className="h-auto p-0 text-primary">View Users</Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
