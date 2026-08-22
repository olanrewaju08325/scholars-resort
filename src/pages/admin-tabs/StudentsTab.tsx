import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { getApiUrl } from '@/lib/utils';
import { 
  Users, Download, ShieldCheck, Search, Filter, ArrowUpDown, 
  Flag, ChevronLeft, ChevronRight, Flame, Smartphone, RefreshCw,
  UserCheck, Shield, HeartHandshake, Eye, Link as LinkIcon, 
  GraduationCap, Phone, Mail, Award, CheckCircle, XCircle, Unlock
} from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/hooks/useConfirm';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'student' | 'guardian' | 'admin' | string;
  has_paid: boolean;
  xp?: number;
  streak_days?: number;
  study_streak?: number;
  coins?: number;
  target_university?: string | null;
  target_course?: string | null;
  selected_subjects?: string[] | null;
  phone?: string | null;
  device_uuid?: string | null;
  created_at: string;
  updated_at: string;
}

interface GuardianLink {
  id: string;
  guardian_id: string;
  student_id: string;
  status: string;
  created_at: string;
}

export const StudentsTab = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [guardianLinks, setGuardianLinks] = useState<GuardianLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { confirmAction, ConfirmElement } = useConfirm();

  // Active Category: 'all' | 'student' | 'guardian' | 'admin'
  const [activeCategory, setActiveCategory] = useState<'all' | 'student' | 'guardian' | 'admin'>('all');

  // Filtering & Sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'paid' | 'unpaid' | 'active'
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Detail Modal State
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Link Guardian Modal State
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkGuardianId, setLinkGuardianId] = useState('');
  const [linkStudentId, setLinkStudentId] = useState('');
  const [linkingLoading, setLinkingLoading] = useState(false);

  const MASTER_ADMINS = ['admitwise2@gmail.com', 'olanrewajuhamilot@gmail.com'];

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // 1. Fetch all profiles
      const { data: profData, error: profError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profError) {
        console.warn('Profiles fetch warn:', profError);
      }

      // 2. Fetch guardian links
      const { data: linkData } = await supabase
        .from('guardian_links')
        .select('*')
        .eq('status', 'active');

      if (profData) {
        const enriched = profData.map((p: any) => {
          const isMaster = p.email && MASTER_ADMINS.includes(p.email.toLowerCase().trim());
          return {
            ...p,
            role: isMaster ? 'admin' : (p.role || 'student'),
            has_paid: isMaster ? true : !!p.has_paid,
            xp: p.xp || 0,
            streak_days: p.streak_days || p.study_streak || 0
          };
        });
        setProfiles(enriched);
      }

      if (linkData) {
        setGuardianLinks(linkData);
      }
    } catch (err) {
      console.error('Failed to load user directory:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Helper map for fast guardian/student lookup
  const { studentToGuardians, guardianToStudents } = useMemo(() => {
    const sMap: Record<string, Profile[]> = {};
    const gMap: Record<string, Profile[]> = {};

    const profileLookup = new Map<string, Profile>(profiles.map(p => [p.id, p]));

    guardianLinks.forEach(link => {
      const guardian = profileLookup.get(link.guardian_id);
      const student = profileLookup.get(link.student_id);

      if (guardian && student) {
        if (!sMap[student.id]) sMap[student.id] = [];
        sMap[student.id].push(guardian);

        if (!gMap[guardian.id]) gMap[guardian.id] = [];
        gMap[guardian.id].push(student);
      }
    });

    return { studentToGuardians: sMap, guardianToStudents: gMap };
  }, [profiles, guardianLinks]);

  // Metric counts
  const stats = useMemo(() => {
    const total = profiles.length;
    const students = profiles.filter(p => p.role === 'student').length;
    const guardians = profiles.filter(p => p.role === 'guardian').length;
    const admins = profiles.filter(p => p.role === 'admin').length;
    const paid = profiles.filter(p => p.has_paid).length;
    return { total, students, guardians, admins, paid };
  }, [profiles]);

  // Processed Data
  const processedProfiles = useMemo(() => {
    let result = [...profiles];

    // Filter by Category
    if (activeCategory !== 'all') {
      result = result.filter(p => p.role === activeCategory);
    }

    // Search
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase().trim();
      result = result.filter(p => 
        (p.full_name && p.full_name.toLowerCase().includes(lower)) || 
        (p.email && p.email.toLowerCase().includes(lower)) ||
        (p.phone && p.phone.includes(lower)) ||
        (p.target_university && p.target_university.toLowerCase().includes(lower))
      );
    }

    // Filter by payment / active status
    if (filterStatus === 'paid') {
      result = result.filter(p => p.has_paid);
    } else if (filterStatus === 'unpaid') {
      result = result.filter(p => !p.has_paid && p.role !== 'admin');
    } else if (filterStatus === 'active') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      result = result.filter(p => p.updated_at && new Date(p.updated_at) > sevenDaysAgo);
    }

    // Sort
    result.sort((a, b) => {
      let valA: any, valB: any;
      if (sortBy === 'created_at') {
        valA = new Date(a.created_at || 0).getTime();
        valB = new Date(b.created_at || 0).getTime();
      } else if (sortBy === 'full_name') {
        valA = (a.full_name || '').toLowerCase();
        valB = (b.full_name || '').toLowerCase();
      } else if (sortBy === 'xp') {
        valA = a.xp || 0;
        valB = b.xp || 0;
      } else if (sortBy === 'streak_days') {
        valA = a.streak_days || 0;
        valB = b.streak_days || 0;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [profiles, activeCategory, searchTerm, filterStatus, sortBy, sortOrder]);

  // Pagination bounds
  const totalPages = Math.max(1, Math.ceil(processedProfiles.length / itemsPerPage));
  const paginatedProfiles = processedProfiles.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const toggleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(paginatedProfiles.map(p => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  // Grant Subscription via Direct Supabase & Resilient Server API
  const handleGiftAccess = async (user: Profile) => {
    confirmAction(
      "Grant Premium Subscription",
      `Are you sure you want to activate full lifetime premium access for ${user.full_name || user.email}?`,
      async () => {
        try {
          // 1. Direct Supabase update (primary source of truth across all components)
          const { error: updateErr } = await supabase
            .from('profiles')
            .update({ has_paid: true, updated_at: new Date().toISOString() })
            .eq('id', user.id);

          if (updateErr) {
            console.warn('Direct profile update warning:', updateErr);
          }

          // 2. Background server sync (bypasses RLS for subscriptions table, fails gracefully if offline/external)
          try {
            fetch(getApiUrl('/api/admin/subscriptions/grant'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_id: user.id,
                plan_name: 'Lifetime Access (Gifted)'
              })
            }).catch(() => null);
          } catch {}

          // 3. Update React state immediately
          setProfiles(prev => prev.map(p => p.id === user.id ? { ...p, has_paid: true } : p));
          if (selectedUser?.id === user.id) {
            setSelectedUser(prev => prev ? { ...prev, has_paid: true } : null);
          }

          toast.success(`Premium access granted to ${user.full_name || user.email}!`);
        } catch (err: any) {
          toast.error(`Failed to grant access: ${err.message || 'Unknown error'}`);
        }
      }
    );
  };

  // Revoke Subscription
  const handleRevokeAccess = async (user: Profile) => {
    if (MASTER_ADMINS.includes(user.email.toLowerCase().trim())) {
      toast.error("Master Administrator access cannot be revoked.");
      return;
    }

    confirmAction(
      "Revoke Premium Access",
      `Are you sure you want to set ${user.full_name || user.email} to the unpaid free tier?`,
      async () => {
        try {
          await supabase.from('profiles').update({ has_paid: false }).eq('id', user.id);
          setProfiles(prev => prev.map(p => p.id === user.id ? { ...p, has_paid: false } : p));
          if (selectedUser?.id === user.id) {
            setSelectedUser(prev => prev ? { ...prev, has_paid: false } : null);
          }
          toast.success(`Access revoked for ${user.full_name || user.email}.`);
        } catch (err: any) {
          toast.error(`Failed to revoke access: ${err.message}`);
        }
      }
    );
  };

  // Bulk Grant Access
  const handleBulkGiftAccess = async () => {
    if (selectedIds.size === 0) return;

    confirmAction(
      "Bulk Grant Premium Access",
      `Are you sure you want to grant lifetime premium access to ${selectedIds.size} accounts?`,
      async () => {
        try {
          const ids = Array.from(selectedIds);
          for (const id of ids) {
            await fetch(getApiUrl('/api/admin/subscriptions/grant'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ user_id: id })
            }).catch(() => null);
          }

          await supabase.from('profiles').update({ has_paid: true }).in('id', ids);

          toast.success(`Granted premium access to ${ids.length} accounts!`);
          setProfiles(prev => prev.map(p => ids.includes(p.id) ? { ...p, has_paid: true } : p));
          setSelectedIds(new Set());
        } catch (e: any) {
          toast.error(`Failed bulk action: ${e.message}`);
        }
      }
    );
  };

  // Reset Hardware Device Lock
  const handleResetDevice = async (user: Profile) => {
    confirmAction(
      "Reset Device Hardware Lock",
      `Reset registered hardware device for ${user.full_name || user.email}? This will permit them to bind a new device on their next sign-in.`,
      async () => {
        try {
          await fetch(getApiUrl('/api/admin/device/reset'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user.id })
          }).catch(() => null);

          await supabase.from('profiles').update({ device_uuid: null }).eq('id', user.id);

          setProfiles(prev => prev.map(p => p.id === user.id ? { ...p, device_uuid: null } : p));
          if (selectedUser?.id === user.id) {
            setSelectedUser(prev => prev ? { ...prev, device_uuid: null } : null);
          }
          toast.success(`Device pairing reset for ${user.full_name || user.email}.`);
        } catch (err: any) {
          toast.error(`Failed to reset device: ${err.message}`);
        }
      }
    );
  };

  // Change Role
  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
      setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role: newRole } : p));
      if (selectedUser?.id === userId) {
        setSelectedUser(prev => prev ? { ...prev, role: newRole } : null);
      }
      toast.success(`User role updated to ${newRole.toUpperCase()}`);
    } catch (err: any) {
      toast.error(`Failed to update role: ${err.message}`);
    }
  };

  // Link Guardian to Student
  const handleCreateGuardianLink = async () => {
    if (!linkGuardianId || !linkStudentId) {
      toast.error('Please select both a Guardian and a Student.');
      return;
    }

    if (linkGuardianId === linkStudentId) {
      toast.error('A user cannot be linked as their own guardian.');
      return;
    }

    setLinkingLoading(true);
    try {
      const { data, error } = await supabase.from('guardian_links').insert({
        guardian_id: linkGuardianId,
        student_id: linkStudentId,
        status: 'active'
      }).select().single();

      if (error) throw error;

      toast.success('Guardian and Student linked successfully!');
      if (data) {
        setGuardianLinks(prev => [...prev, data]);
      }
      setIsLinkModalOpen(false);
      setLinkGuardianId('');
      setLinkStudentId('');
    } catch (err: any) {
      toast.error(`Failed to link accounts: ${err.message}`);
    } finally {
      setLinkingLoading(false);
    }
  };

  // Export CSV
  const exportToCSV = () => {
    if (processedProfiles.length === 0) return;
    const headers = ['Name,Email,Role,Phone,Target University,Status,Streak,Score (XP),Joined Date'];
    const rows = processedProfiles.map(s => 
      `"${s.full_name || 'N/A'}","${s.email}","${s.role}","${s.phone || ''}","${s.target_university || ''}",${s.has_paid ? 'Paid' : 'Unpaid'},${s.streak_days || 0},${s.xp || 0},"${new Date(s.created_at).toLocaleDateString()}"`
    );
    const csvContent = "data:text/csv;charset=utf-8," + headers.concat(rows).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `scholars_resort_${activeCategory}_directory.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {ConfirmElement}

      {/* Top Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-wrap">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-white">
            <Users className="w-6 h-6 text-primary shrink-0" /> 
            Users & Guardians Directory
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm">
            Manage registered Students, Parent/Guardian accounts, role privileges, and active subscriptions.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setRefreshing(true); fetchAllData(); }}
            disabled={refreshing}
            className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 gap-1.5 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => setIsLinkModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 text-xs"
          >
            <HeartHandshake className="w-3.5 h-3.5" />
            Link Guardian & Student
          </Button>

          {selectedIds.size > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={handleBulkGiftAccess} size="sm" className="bg-purple-600 hover:bg-purple-700 text-white text-xs">
                  Bulk Grant Access ({selectedIds.size})
                </Button>
              </TooltipTrigger>
              <TooltipContent>Grant full lifetime premium access to all {selectedIds.size} selected accounts</TooltipContent>
            </Tooltip>
          )}

          <Button onClick={exportToCSV} variant="outline" size="sm" className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* High-Level Directory Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card 
          onClick={() => { setActiveCategory('all'); setCurrentPage(1); }}
          className={`cursor-pointer transition-all border ${activeCategory === 'all' ? 'bg-slate-800 border-primary shadow-md' : 'bg-slate-900/80 border-slate-800 hover:bg-slate-850'}`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">All Users</p>
              <p className="text-xl font-bold text-white mt-1">{stats.total}</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card 
          onClick={() => { setActiveCategory('student'); setCurrentPage(1); }}
          className={`cursor-pointer transition-all border ${activeCategory === 'student' ? 'bg-slate-800 border-primary shadow-md' : 'bg-slate-900/80 border-slate-800 hover:bg-slate-850'}`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-400 font-medium">Students</p>
              <p className="text-xl font-bold text-blue-300 mt-1">{stats.students}</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-950/60 border border-blue-800/40 flex items-center justify-center text-blue-400">
              <GraduationCap className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card 
          onClick={() => { setActiveCategory('guardian'); setCurrentPage(1); }}
          className={`cursor-pointer transition-all border ${activeCategory === 'guardian' ? 'bg-slate-800 border-purple-500 shadow-md' : 'bg-slate-900/80 border-slate-800 hover:bg-slate-850'}`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-purple-400 font-medium">Guardians & Parents</p>
              <p className="text-xl font-bold text-purple-300 mt-1">{stats.guardians}</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-purple-950/60 border border-purple-800/40 flex items-center justify-center text-purple-400">
              <HeartHandshake className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card 
          onClick={() => { setFilterStatus('paid'); setCurrentPage(1); }}
          className={`cursor-pointer transition-all border ${filterStatus === 'paid' ? 'bg-slate-800 border-green-500 shadow-md' : 'bg-slate-900/80 border-slate-800 hover:bg-slate-850'}`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-green-400 font-medium">Premium Paid</p>
              <p className="text-xl font-bold text-green-300 mt-1">{stats.paid}</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-green-950/60 border border-green-800/40 flex items-center justify-center text-green-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-xl">
        <CardHeader className="pb-4 border-b border-slate-800">
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
            
            {/* Category Navigation Pills */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-xl overflow-x-auto">
              <button
                onClick={() => { setActiveCategory('all'); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeCategory === 'all' ? 'bg-primary text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                All Accounts ({stats.total})
              </button>
              <button
                onClick={() => { setActiveCategory('student'); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeCategory === 'student' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Students ({stats.students})
              </button>
              <button
                onClick={() => { setActiveCategory('guardian'); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeCategory === 'guardian' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Parents & Guardians ({stats.guardians})
              </button>
              <button
                onClick={() => { setActiveCategory('admin'); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeCategory === 'admin' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Administrators ({stats.admins})
              </button>
            </div>

            {/* Search & Status Filters */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input 
                  placeholder="Search name, email, phone..." 
                  className="pl-9 bg-slate-950 border-slate-700 text-xs sm:text-sm h-9 text-slate-200"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                />
              </div>
              
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-700 rounded-md px-2 h-9 shrink-0">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <select 
                  className="bg-transparent text-xs sm:text-sm outline-none text-slate-300"
                  value={filterStatus}
                  onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                >
                  <option value="all">All Status</option>
                  <option value="paid">Paid / Premium</option>
                  <option value="unpaid">Unpaid / Free</option>
                  <option value="active">Active Recently</option>
                </select>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-950/70 text-slate-400 uppercase text-[11px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-700 bg-slate-900 text-primary focus:ring-primary"
                      checked={paginatedProfiles.length > 0 && selectedIds.size === paginatedProfiles.length}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="px-4 py-3 font-semibold cursor-pointer hover:text-white" onClick={() => toggleSort('full_name')}>
                    <div className="flex items-center gap-1">User / Account <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold cursor-pointer hover:text-white" onClick={() => toggleSort('has_paid')}>
                    <div className="flex items-center gap-1">Subscription <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-4 py-3 font-semibold">Associated Network</th>
                  <th className="px-4 py-3 font-semibold cursor-pointer hover:text-white" onClick={() => toggleSort('xp')}>
                    <div className="flex items-center gap-1">Score / Streak <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-4 py-3 font-semibold cursor-pointer hover:text-white" onClick={() => toggleSort('created_at')}>
                    <div className="flex items-center gap-1">Registered <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr><td colSpan={8} className="px-4 py-16 text-center text-slate-500">Loading user & guardian records...</td></tr>
                ) : paginatedProfiles.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-16 text-center text-slate-500">No accounts match the current filter criteria.</td></tr>
                ) : paginatedProfiles.map(user => {
                  const isMaster = user.email && MASTER_ADMINS.includes(user.email.toLowerCase().trim());
                  const guardians = studentToGuardians[user.id] || [];
                  const wards = guardianToStudents[user.id] || [];

                  return (
                    <tr key={user.id} className="hover:bg-slate-800/40 transition-colors group">
                      <td className="px-4 py-3">
                        <input 
                          type="checkbox" 
                          className="rounded border-slate-700 bg-slate-900 text-primary focus:ring-primary"
                          checked={selectedIds.has(user.id)}
                          onChange={() => handleSelectOne(user.id)}
                        />
                      </td>

                      {/* User Info */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                          {user.full_name || 'Anonymous User'}
                          {isMaster && (
                            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[9px] px-1 py-0 font-mono">
                              MASTER
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 text-slate-500" />
                          {user.email}
                        </div>
                        {user.phone && (
                          <div className="text-[11px] text-slate-500 flex items-center gap-1">
                            <Phone className="w-2.5 h-2.5" /> {user.phone}
                          </div>
                        )}
                      </td>

                      {/* Role Badge */}
                      <td className="px-4 py-3">
                        {user.role === 'admin' || isMaster ? (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 w-fit">
                            <Shield className="w-3 h-3" /> Admin
                          </span>
                        ) : user.role === 'guardian' ? (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1 w-fit">
                            <HeartHandshake className="w-3 h-3" /> Guardian
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1 w-fit">
                            <GraduationCap className="w-3 h-3" /> Student
                          </span>
                        )}
                      </td>

                      {/* Subscription Status */}
                      <td className="px-4 py-3">
                        {user.has_paid || isMaster ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-green-500/20 text-green-400 border border-green-500/30 inline-flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 text-green-400" /> Verified Premium
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-500/20 text-red-400 border border-red-500/30 inline-flex items-center gap-1">
                            <XCircle className="w-3 h-3 text-red-400" /> Unpaid / Free
                          </span>
                        )}
                      </td>

                      {/* Associated Network (Guardians or Wards) */}
                      <td className="px-4 py-3 text-xs">
                        {user.role === 'guardian' ? (
                          wards.length > 0 ? (
                            <div className="space-y-0.5">
                              <span className="text-purple-300 font-semibold">{wards.length} Linked Ward(s):</span>
                              <div className="text-slate-400 text-[11px] truncate max-w-[160px]">
                                {wards.map(w => w.full_name || w.email).join(', ')}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-500 italic">No students linked</span>
                          )
                        ) : (
                          guardians.length > 0 ? (
                            <div className="space-y-0.5">
                              <span className="text-blue-300 font-semibold">{guardians.length} Guardian(s):</span>
                              <div className="text-slate-400 text-[11px] truncate max-w-[160px]">
                                {guardians.map(g => g.full_name || g.email).join(', ')}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-500">Self-monitored</span>
                          )
                        )}
                      </td>

                      {/* Score / Streak */}
                      <td className="px-4 py-3">
                        {user.role === 'student' ? (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-primary font-bold text-xs">{user.xp || 0} XP</span>
                            <span className="flex items-center gap-0.5 text-orange-400 font-bold text-xs">
                              <Flame className="w-3.5 h-3.5" /> {user.streak_days || 0}d
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-xs">—</span>
                        )}
                      </td>

                      {/* Registered Date */}
                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                      </td>

                      {/* Action Buttons */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          {/* View details */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-7 w-7 text-slate-400 hover:text-white hover:bg-slate-800" 
                                onClick={() => { setSelectedUser(user); setIsDetailOpen(true); }}
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View full profile metadata & linked network</TooltipContent>
                          </Tooltip>

                          {/* Reset device hardware binding */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-7 w-7 text-blue-400 hover:text-blue-300 hover:bg-blue-950" 
                                onClick={() => handleResetDevice(user)}
                              >
                                <Smartphone className="w-3.5 h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Reset Device Pairing Lock (Clear registered MAC/Hardware ID)</TooltipContent>
                          </Tooltip>

                          {/* Grant/Revoke Access */}
                          {!user.has_paid && !isMaster ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-7 w-7 text-green-400 hover:text-green-300 hover:bg-green-950" 
                                  onClick={() => handleGiftAccess(user)}
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Activate lifetime premium subscription</TooltipContent>
                            </Tooltip>
                          ) : !isMaster && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-950" 
                                  onClick={() => handleRevokeAccess(user)}
                                >
                                  <Unlock className="w-3.5 h-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Revoke premium status (Downgrade to free)</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-950/40">
              <div className="text-xs text-slate-500">
                Page {currentPage} of {totalPages} ({processedProfiles.length} total filtered accounts)
              </div>
              <div className="flex gap-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 w-8 p-0 border-slate-700 hover:bg-slate-800 text-slate-300"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 w-8 p-0 border-slate-700 hover:bg-slate-800 text-slate-300"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Detail & Inspection Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-white">
              <UserCheck className="w-5 h-5 text-primary" />
              Account Inspection: {selectedUser?.full_name || selectedUser?.email}
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Complete account credentials, hardware pairings, and academic targets.
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-4 pt-2 text-sm">
              <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div>
                  <p className="text-[11px] text-slate-500 uppercase font-semibold">Account Role</p>
                  <div className="flex items-center gap-2 mt-1">
                    <select
                      value={selectedUser.role}
                      onChange={(e) => handleRoleChange(selectedUser.id, e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 outline-none"
                    >
                      <option value="student">Student</option>
                      <option value="guardian">Guardian / Parent</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                </div>

                <div>
                  <p className="text-[11px] text-slate-500 uppercase font-semibold">Payment Status</p>
                  <p className="font-semibold text-xs mt-1">
                    {selectedUser.has_paid ? (
                      <span className="text-green-400">Verified Premium (Active)</span>
                    ) : (
                      <span className="text-red-400">Unpaid / Free Plan</span>
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] text-slate-500 uppercase font-semibold">Target University</p>
                  <p className="text-xs text-slate-200 mt-0.5">{selectedUser.target_university || 'Not set'}</p>
                </div>

                <div>
                  <p className="text-[11px] text-slate-500 uppercase font-semibold">Target Course</p>
                  <p className="text-xs text-slate-200 mt-0.5">{selectedUser.target_course || 'Not set'}</p>
                </div>

                <div>
                  <p className="text-[11px] text-slate-500 uppercase font-semibold">Device Hardware Pairing</p>
                  <p className="text-xs font-mono text-slate-300 mt-0.5 truncate">
                    {selectedUser.device_uuid ? selectedUser.device_uuid : 'No active device bound'}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] text-slate-500 uppercase font-semibold">Account UUID</p>
                  <p className="text-[11px] font-mono text-slate-400 mt-0.5 truncate">{selectedUser.id}</p>
                </div>
              </div>

              {/* Linked Network Details */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                <p className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <HeartHandshake className="w-4 h-4 text-purple-400" />
                  {selectedUser.role === 'guardian' ? 'Linked Wards & Students' : 'Linked Parents & Guardians'}
                </p>
                {selectedUser.role === 'guardian' ? (
                  (guardianToStudents[selectedUser.id] || []).length > 0 ? (
                    <div className="space-y-1">
                      {(guardianToStudents[selectedUser.id] || []).map(student => (
                        <div key={student.id} className="text-xs flex justify-between items-center bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800">
                          <div>
                            <span className="font-semibold text-slate-200">{student.full_name || 'Student'}</span>
                            <span className="text-slate-500 ml-1">({student.email})</span>
                          </div>
                          <span className="text-[10px] text-primary font-mono">{student.xp || 0} XP</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No students linked to this guardian yet.</p>
                  )
                ) : (
                  (studentToGuardians[selectedUser.id] || []).length > 0 ? (
                    <div className="space-y-1">
                      {(studentToGuardians[selectedUser.id] || []).map(g => (
                        <div key={g.id} className="text-xs flex justify-between items-center bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800">
                          <span className="font-semibold text-slate-200">{g.full_name || 'Guardian'}</span>
                          <span className="text-slate-400">{g.email}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No guardian linked to this student yet.</p>
                  )
                )}
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-1/2 border-slate-700 hover:bg-slate-800 text-xs"
                  onClick={() => handleResetDevice(selectedUser)}
                >
                  <Smartphone className="w-3.5 h-3.5 mr-1" /> Reset Device Lock
                </Button>

                {selectedUser.has_paid ? (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-1/2 border-red-800/40 text-red-400 hover:bg-red-950 text-xs"
                    onClick={() => handleRevokeAccess(selectedUser)}
                  >
                    Revoke Access
                  </Button>
                ) : (
                  <Button 
                    size="sm" 
                    className="w-1/2 bg-green-600 hover:bg-green-700 text-white text-xs"
                    onClick={() => handleGiftAccess(selectedUser)}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Grant Premium
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Link Guardian and Student Dialog */}
      <Dialog open={isLinkModalOpen} onOpenChange={setIsLinkModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-white">
              <HeartHandshake className="w-5 h-5 text-purple-400" />
              Link Guardian & Student
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Establish a direct parent-student link so the guardian can track mock test scores and weekly progress.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs text-slate-400 font-semibold mb-1 block">Select Guardian / Parent</label>
              <select
                value={linkGuardianId}
                onChange={(e) => setLinkGuardianId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 outline-none"
              >
                <option value="">-- Choose Guardian Account --</option>
                {profiles.filter(p => p.role === 'guardian').map(g => (
                  <option key={g.id} value={g.id}>
                    {g.full_name || 'Anonymous'} ({g.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 font-semibold mb-1 block">Select Student / Ward</label>
              <select
                value={linkStudentId}
                onChange={(e) => setLinkStudentId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 outline-none"
              >
                <option value="">-- Choose Student Account --</option>
                {profiles.filter(p => p.role === 'student').map(s => (
                  <option key={s.id} value={s.id}>
                    {s.full_name || 'Anonymous'} ({s.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 pt-3">
              <Button variant="outline" className="w-1/3 text-xs" onClick={() => setIsLinkModalOpen(false)}>
                Cancel
              </Button>
              <Button 
                className="w-2/3 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold"
                onClick={handleCreateGuardianLink}
                disabled={linkingLoading || !linkGuardianId || !linkStudentId}
              >
                {linkingLoading ? 'Linking Accounts...' : 'Establish Link'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
