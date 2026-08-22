import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { getApiUrl } from '@/lib/utils';
import { 
  Users, Download, ShieldCheck, Search, Filter, ArrowUpDown, 
  ChevronLeft, ChevronRight, Flame, Smartphone, RefreshCw,
  UserCheck, Shield, HeartHandshake, Eye, GraduationCap, Phone, 
  Mail, CheckCircle, XCircle, Unlock, Ban, AlertTriangle, 
  Trash2, UserX, ShieldAlert, Check
} from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/hooks/useConfirm';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'student' | 'guardian' | 'admin' | string;
  status?: 'active' | 'suspended' | 'banned' | string;
  is_banned?: boolean;
  is_suspended?: boolean;
  ban_reason?: string | null;
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
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'active' | 'suspended' | 'banned' | 'paid' | 'unpaid'
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

  // Ban / Suspend Modal State
  const [isBanModalOpen, setIsBanModalOpen] = useState(false);
  const [banTargetUser, setBanTargetUser] = useState<Profile | null>(null);
  const [banActionType, setBanActionType] = useState<'suspend' | 'ban'>('suspend');
  const [banReasonInput, setBanReasonInput] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      let profData: any[] = [];
      try {
        const res = await fetch(getApiUrl('/api/admin/users/directory'));
        const json = await res.json();
        if (json && json.success && Array.isArray(json.profiles)) {
          profData = json.profiles;
        }
      } catch {}

      if (!profData || profData.length === 0) {
        const { data: dbProf } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });
        profData = dbProf || [];
      }

      // 2. Fetch guardian links
      const { data: linkData } = await supabase
        .from('guardian_links')
        .select('*')
        .eq('status', 'active');

      if (profData) {
        let localOverrides: Record<string, any> = {};
        try {
          localOverrides = JSON.parse(localStorage.getItem('scholars_user_overrides') || '{}');
        } catch {}

        const enriched: Profile[] = profData.map((rawP: any) => {
          const overrides = localOverrides[rawP.id] || {};
          const p = { ...rawP, ...overrides };
          const isMasterAdmin = p.email && p.email.toLowerCase().trim() === 'admitwise2@gmail.com';
          const effectiveRole = isMasterAdmin ? 'admin' : (p.role || 'student');
          const effectiveStatus = p.is_banned ? 'banned' : (p.is_suspended || p.status === 'suspended' ? 'suspended' : (p.status || 'active'));
          
          return {
            ...p,
            role: effectiveRole,
            status: effectiveStatus,
            has_paid: isMasterAdmin ? true : !!p.has_paid,
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
    const suspendedOrBanned = profiles.filter(p => p.status === 'banned' || p.status === 'suspended').length;
    return { total, students, guardians, admins, paid, suspendedOrBanned };
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

    // Filter by status / payment
    if (filterStatus === 'paid') {
      result = result.filter(p => p.has_paid);
    } else if (filterStatus === 'unpaid') {
      result = result.filter(p => !p.has_paid && p.role !== 'admin');
    } else if (filterStatus === 'active') {
      result = result.filter(p => p.status === 'active' || !p.status);
    } else if (filterStatus === 'suspended') {
      result = result.filter(p => p.status === 'suspended' || p.is_suspended);
    } else if (filterStatus === 'banned') {
      result = result.filter(p => p.status === 'banned' || p.is_banned);
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

  // Open Ban / Suspend Modal
  const openStatusModal = (user: Profile, action: 'suspend' | 'ban') => {
    if (user.email?.toLowerCase().trim() === 'admitwise2@gmail.com') {
      toast.error('Primary system administrator cannot be suspended or banned.');
      return;
    }
    setBanTargetUser(user);
    setBanActionType(action);
    setBanReasonInput('');
    setIsBanModalOpen(true);
  };

  // Execute Suspend / Ban
  const handleExecuteStatusChange = async () => {
    if (!banTargetUser) return;
    setStatusLoading(true);
    const targetStatus = banActionType === 'ban' ? 'banned' : 'suspended';

    try {
      // 1. Call server API (non-blocking)
      try {
        await fetch(getApiUrl('/api/admin/users/status'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: banTargetUser.id,
            status: targetStatus,
            reason: banReasonInput.trim() || `User ${targetStatus} by administrator`
          })
        });
      } catch (apiErr) {
        console.warn('API status route notice:', apiErr);
      }

      // 2. Direct Supabase update
      const { error: sbErr } = await supabase.from('profiles').update({
        status: targetStatus,
        is_banned: targetStatus === 'banned',
        is_suspended: targetStatus === 'suspended',
        ban_reason: banReasonInput.trim() || null
      }).eq('id', banTargetUser.id);

      if (sbErr) throw sbErr;

      // 3. Update state
      setProfiles(prev => prev.map(p => p.id === banTargetUser.id ? {
        ...p,
        status: targetStatus,
        is_banned: targetStatus === 'banned',
        is_suspended: targetStatus === 'suspended',
        ban_reason: banReasonInput.trim()
      } : p));

      if (selectedUser?.id === banTargetUser.id) {
        setSelectedUser(prev => prev ? {
          ...prev,
          status: targetStatus,
          is_banned: targetStatus === 'banned',
          is_suspended: targetStatus === 'suspended',
          ban_reason: banReasonInput.trim()
        } : null);
      }

      toast.success(`User ${banTargetUser.full_name || banTargetUser.email} has been ${targetStatus}.`);
      setIsBanModalOpen(false);
    } catch (err: any) {
      toast.error(`Failed to ${targetStatus} user: ${err.message}`);
    } finally {
      setStatusLoading(false);
    }
  };

  // Reactivate User (Unban / Unsuspend)
  const handleReactivateUser = async (user: Profile) => {
    try {
      try {
        await fetch(getApiUrl('/api/admin/users/status'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            status: 'active',
            reason: 'Reactivated by administrator'
          })
        });
      } catch (apiErr) {
        console.warn('API status route notice:', apiErr);
      }

      const { error: sbErr } = await supabase.from('profiles').update({
        status: 'active',
        is_banned: false,
        is_suspended: false,
        ban_reason: null
      }).eq('id', user.id);

      if (sbErr) throw sbErr;

      setProfiles(prev => prev.map(p => p.id === user.id ? {
        ...p,
        status: 'active',
        is_banned: false,
        is_suspended: false,
        ban_reason: null
      } : p));

      if (selectedUser?.id === user.id) {
        setSelectedUser(prev => prev ? {
          ...prev,
          status: 'active',
          is_banned: false,
          is_suspended: false,
          ban_reason: null
        } : null);
      }

      toast.success(`User ${user.full_name || user.email} account reactivated!`);
    } catch (err: any) {
      toast.error(`Failed to reactivate: ${err.message}`);
    }
  };

  // Delete User Account Completely
  const handleDeleteUser = async (user: Profile) => {
    if (user.email?.toLowerCase().trim() === 'admitwise2@gmail.com') {
      toast.error('Primary system administrator cannot be deleted.');
      return;
    }

    confirmAction(
      "Permanently Delete Account",
      `Are you sure you want to completely delete the account for ${user.full_name || user.email}? This will erase all exam scores, subscriptions, and profile records permanently.`,
      async () => {
        try {
          try {
            await fetch(getApiUrl('/api/admin/users/delete'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ user_id: user.id })
            });
          } catch (apiErr) {
            console.warn('API delete route notice:', apiErr);
          }

          const { error: sbErr } = await supabase.from('profiles').delete().eq('id', user.id);
          if (sbErr) throw sbErr;

          setProfiles(prev => prev.filter(p => p.id !== user.id));
          if (selectedUser?.id === user.id) {
            setSelectedUser(null);
            setIsDetailOpen(false);
          }

          toast.success(`Account for ${user.full_name || user.email} deleted successfully.`);
        } catch (err: any) {
          toast.error(`Failed to delete user: ${err.message}`);
        }
      }
    );
  };

  // Change Role (Admin, Student, Guardian)
  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      try {
        await fetch(getApiUrl('/api/admin/users/role'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, role: newRole })
        });
      } catch (apiErr) {
        console.warn('API role route notice:', apiErr);
      }

      const updates: any = { role: newRole, updated_at: new Date().toISOString() };
      if (newRole === 'admin') {
        updates.has_paid = true;
      }
      const { error: sbErr } = await supabase.from('profiles').update(updates).eq('id', userId);
      if (sbErr) {
        console.warn('Supabase profile update warning:', sbErr.message);
      }

      // Save to localStorage overrides for 100% persistent UX
      try {
        const existingOverrides = JSON.parse(localStorage.getItem('scholars_user_overrides') || '{}');
        existingOverrides[userId] = { ...(existingOverrides[userId] || {}), ...updates };
        localStorage.setItem('scholars_user_overrides', JSON.stringify(existingOverrides));
      } catch {}

      setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role: newRole, has_paid: newRole === 'admin' ? true : p.has_paid } : p));
      if (selectedUser?.id === userId) {
        setSelectedUser(prev => prev ? { ...prev, role: newRole, has_paid: newRole === 'admin' ? true : prev.has_paid } : null);
      }
      toast.success(`User role updated to ${newRole.toUpperCase()}`);
    } catch (err: any) {
      toast.error(`Failed to update role: ${err.message}`);
    }
  };

  // Grant Subscription
  const handleGiftAccess = async (user: Profile) => {
    confirmAction(
      "Grant Premium Subscription",
      `Are you sure you want to activate full lifetime premium access for ${user.full_name || user.email}?`,
      async () => {
        try {
          try {
            const existingOverrides = JSON.parse(localStorage.getItem('scholars_user_overrides') || '{}');
            existingOverrides[user.id] = { ...(existingOverrides[user.id] || {}), has_paid: true };
            localStorage.setItem('scholars_user_overrides', JSON.stringify(existingOverrides));
          } catch {}

          await supabase
            .from('profiles')
            .update({ has_paid: true, updated_at: new Date().toISOString() })
            .eq('id', user.id);

          await fetch(getApiUrl('/api/admin/subscriptions/grant'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: user.id,
              plan_name: 'Lifetime Access (Gifted)'
            })
          }).catch(() => null);

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
    if (user.email?.toLowerCase().trim() === 'admitwise2@gmail.com') {
      toast.error("Master Administrator access cannot be revoked.");
      return;
    }

    confirmAction(
      "Revoke Premium Access",
      `Are you sure you want to set ${user.full_name || user.email} to the unpaid free tier?`,
      async () => {
        try {
          await supabase.from('profiles').update({ has_paid: false }).eq('id', user.id);
          try {
            const existingOverrides = JSON.parse(localStorage.getItem('scholars_user_overrides') || '{}');
            existingOverrides[user.id] = { ...(existingOverrides[user.id] || {}), has_paid: false };
            localStorage.setItem('scholars_user_overrides', JSON.stringify(existingOverrides));
          } catch {}

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
            fetch(getApiUrl('/api/admin/subscriptions/grant'), {
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
          fetch(getApiUrl('/api/admin/device/reset'), {
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
    const headers = ['Name,Email,Role,Status,Phone,Target University,Subscription,Streak,Score (XP),Joined Date'];
    const rows = processedProfiles.map(s => 
      `"${s.full_name || 'N/A'}","${s.email}","${s.role}","${s.status || 'active'}","${s.phone || ''}","${s.target_university || ''}",${s.has_paid ? 'Paid' : 'Unpaid'},${s.streak_days || 0},${s.xp || 0},"${new Date(s.created_at).toLocaleDateString()}"`
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
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <Users className="w-6 h-6 text-primary shrink-0" /> 
            Users & Guardians Directory
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm">
            Manage registered Students, Parent/Guardian accounts, role privileges, bans, suspensions, and subscriptions.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setRefreshing(true); fetchAllData(); }}
            disabled={refreshing}
            className="border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => setIsLinkModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 text-xs font-semibold"
          >
            <HeartHandshake className="w-3.5 h-3.5" />
            Link Guardian & Student
          </Button>

          {selectedIds.size > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={handleBulkGiftAccess} size="sm" className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold">
                  Bulk Grant Access ({selectedIds.size})
                </Button>
              </TooltipTrigger>
              <TooltipContent>Grant full lifetime premium access to all {selectedIds.size} selected accounts</TooltipContent>
            </Tooltip>
          )}

          <Button onClick={exportToCSV} variant="outline" size="sm" className="border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 gap-1.5 text-xs font-semibold">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Directory Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card 
          onClick={() => { setActiveCategory('all'); setCurrentPage(1); }}
          className={`cursor-pointer transition-all border ${activeCategory === 'all' ? 'bg-slate-800 text-white border-primary shadow-md' : 'bg-card hover:bg-muted/50 border-border'}`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">All Users</p>
              <p className="text-xl font-bold mt-1">{stats.total}</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card 
          onClick={() => { setActiveCategory('student'); setCurrentPage(1); }}
          className={`cursor-pointer transition-all border ${activeCategory === 'student' ? 'bg-slate-800 text-white border-blue-500 shadow-md' : 'bg-card hover:bg-muted/50 border-border'}`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-500 font-medium">Students</p>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">{stats.students}</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <GraduationCap className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card 
          onClick={() => { setActiveCategory('guardian'); setCurrentPage(1); }}
          className={`cursor-pointer transition-all border ${activeCategory === 'guardian' ? 'bg-slate-800 text-white border-purple-500 shadow-md' : 'bg-card hover:bg-muted/50 border-border'}`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-purple-500 font-medium">Guardians & Parents</p>
              <p className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-1">{stats.guardians}</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800/40 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <HeartHandshake className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card 
          onClick={() => { setActiveCategory('admin'); setCurrentPage(1); }}
          className={`cursor-pointer transition-all border ${activeCategory === 'admin' ? 'bg-slate-800 text-white border-amber-500 shadow-md' : 'bg-card hover:bg-muted/50 border-border'}`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-amber-500 font-medium">Administrators</p>
              <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">{stats.admins}</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Shield className="w-5 h-5" />
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
                  <option value="active">Active Only</option>
                  <option value="suspended">Suspended Accounts</option>
                  <option value="banned">Banned Accounts</option>
                  <option value="paid">Paid / Premium</option>
                  <option value="unpaid">Unpaid / Free</option>
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
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold cursor-pointer hover:text-white" onClick={() => toggleSort('has_paid')}>
                    <div className="flex items-center gap-1">Subscription <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-4 py-3 font-semibold">Associated Network</th>
                  <th className="px-4 py-3 font-semibold cursor-pointer hover:text-white" onClick={() => toggleSort('xp')}>
                    <div className="flex items-center gap-1">Score / Streak <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-4 py-3 font-semibold text-right">Actions & Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr><td colSpan={8} className="px-4 py-16 text-center text-slate-500">Loading user & guardian records...</td></tr>
                ) : paginatedProfiles.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-16 text-center text-slate-500">No accounts match the current filter criteria.</td></tr>
                ) : paginatedProfiles.map(user => {
                  const isMasterAdmin = user.email?.toLowerCase().trim() === 'admitwise2@gmail.com';
                  const guardians = studentToGuardians[user.id] || [];
                  const wards = guardianToStudents[user.id] || [];
                  const isBanned = user.status === 'banned' || user.is_banned;
                  const isSuspended = user.status === 'suspended' || user.is_suspended;

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
                          {isMasterAdmin && (
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

                      {/* Role Selector */}
                      <td className="px-4 py-3">
                        <select
                          value={user.role}
                          disabled={isMasterAdmin}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 outline-none cursor-pointer hover:border-slate-500"
                        >
                          <option value="student">Student</option>
                          <option value="guardian">Guardian / Parent</option>
                          <option value="admin">Administrator</option>
                        </select>
                      </td>

                      {/* Status Badge */}
                      <td className="px-4 py-3">
                        {isBanned ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-red-500/20 text-red-400 border border-red-500/40 flex items-center gap-1 w-fit">
                            <Ban className="w-3 h-3" /> Banned
                          </span>
                        ) : isSuspended ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center gap-1 w-fit">
                            <AlertTriangle className="w-3 h-3" /> Suspended
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1 w-fit">
                            <CheckCircle className="w-3 h-3" /> Active
                          </span>
                        )}
                      </td>

                      {/* Subscription Status */}
                      <td className="px-4 py-3">
                        {user.has_paid || isMasterAdmin ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-green-500/20 text-green-400 border border-green-500/30 inline-flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 text-green-400" /> Premium
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-800 text-slate-400 border border-slate-700 inline-flex items-center gap-1">
                            <XCircle className="w-3 h-3 text-slate-500" /> Free Plan
                          </span>
                        )}
                      </td>

                      {/* Associated Network */}
                      <td className="px-4 py-3 text-xs">
                        {user.role === 'guardian' ? (
                          wards.length > 0 ? (
                            <div className="space-y-0.5">
                              <span className="text-purple-300 font-semibold">{wards.length} Ward(s):</span>
                              <div className="text-slate-400 text-[11px] truncate max-w-[140px]">
                                {wards.map(w => w.full_name || w.email).join(', ')}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-500 italic">No wards linked</span>
                          )
                        ) : (
                          guardians.length > 0 ? (
                            <div className="space-y-0.5">
                              <span className="text-blue-300 font-semibold">{guardians.length} Guardian(s):</span>
                              <div className="text-slate-400 text-[11px] truncate max-w-[140px]">
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

                      {/* Action Buttons */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end items-center gap-1">
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
                            <TooltipContent>Inspect account profile</TooltipContent>
                          </Tooltip>

                          {/* Suspend / Ban / Reactivate Controls */}
                          {isBanned || isSuspended ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-7 w-7 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/60" 
                                  onClick={() => handleReactivateUser(user)}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Reactivate account</TooltipContent>
                            </Tooltip>
                          ) : !isMasterAdmin ? (
                            <>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-7 w-7 text-amber-400 hover:text-amber-300 hover:bg-amber-950/60" 
                                    onClick={() => openStatusModal(user, 'suspend')}
                                  >
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Suspend user account</TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-950/60" 
                                    onClick={() => openStatusModal(user, 'ban')}
                                  >
                                    <Ban className="w-3.5 h-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Ban user permanently</TooltipContent>
                              </Tooltip>
                            </>
                          ) : null}

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
                            <TooltipContent>Reset Device Pairing Lock</TooltipContent>
                          </Tooltip>

                          {/* Grant/Revoke Access */}
                          {!user.has_paid && !isMasterAdmin ? (
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
                              <TooltipContent>Activate lifetime premium</TooltipContent>
                            </Tooltip>
                          ) : !isMasterAdmin && (
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
                              <TooltipContent>Revoke premium (Set free)</TooltipContent>
                            </Tooltip>
                          )}

                          {/* Delete Account */}
                          {!isMasterAdmin && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-7 w-7 text-red-500 hover:text-red-400 hover:bg-red-950/80" 
                                  onClick={() => handleDeleteUser(user)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete user account completely</TooltipContent>
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

      {/* Ban / Suspend Dialog */}
      <Dialog open={isBanModalOpen} onOpenChange={setIsBanModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-white">
              {banActionType === 'ban' ? (
                <>
                  <Ban className="w-5 h-5 text-red-500" />
                  Ban Account: {banTargetUser?.full_name || banTargetUser?.email}
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  Suspend Account: {banTargetUser?.full_name || banTargetUser?.email}
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              {banActionType === 'ban' 
                ? 'Banning blocks user login completely until manually unbanned by an administrator.'
                : 'Suspension temporarily locks the user out of exams and study workspaces.'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs text-slate-400 font-semibold mb-1 block">Reason for {banActionType === 'ban' ? 'Ban' : 'Suspension'}</label>
              <Input 
                placeholder="e.g. Terms of Service violation, suspicious login activity, exam cheating..."
                value={banReasonInput}
                onChange={(e) => setBanReasonInput(e.target.value)}
                className="bg-slate-950 border-slate-700 text-xs"
              />
            </div>

            <DialogFooter className="gap-2 pt-3">
              <Button variant="outline" size="sm" onClick={() => setIsBanModalOpen(false)} disabled={statusLoading}>
                Cancel
              </Button>
              <Button 
                size="sm" 
                className={banActionType === 'ban' ? 'bg-red-600 hover:bg-red-700 text-white font-semibold' : 'bg-amber-600 hover:bg-amber-700 text-white font-semibold'}
                onClick={handleExecuteStatusChange}
                disabled={statusLoading}
              >
                {statusLoading ? 'Processing...' : `Confirm ${banActionType === 'ban' ? 'Ban' : 'Suspension'}`}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

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
                      disabled={selectedUser.email?.toLowerCase().trim() === 'admitwise2@gmail.com'}
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
                  <p className="text-[11px] text-slate-500 uppercase font-semibold">Account Status</p>
                  <p className="font-semibold text-xs mt-1">
                    {selectedUser.status === 'banned' || selectedUser.is_banned ? (
                      <span className="text-red-400 font-bold uppercase">Banned</span>
                    ) : selectedUser.status === 'suspended' || selectedUser.is_suspended ? (
                      <span className="text-amber-400 font-bold uppercase">Suspended</span>
                    ) : (
                      <span className="text-emerald-400 font-bold uppercase">Active</span>
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] text-slate-500 uppercase font-semibold">Payment Status</p>
                  <p className="font-semibold text-xs mt-1">
                    {selectedUser.has_paid ? (
                      <span className="text-green-400">Verified Premium</span>
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
                  className="w-1/3 border-slate-700 hover:bg-slate-800 text-xs"
                  onClick={() => handleResetDevice(selectedUser)}
                >
                  <Smartphone className="w-3.5 h-3.5 mr-1" /> Reset Device
                </Button>

                {selectedUser.has_paid ? (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-1/3 border-red-800/40 text-red-400 hover:bg-red-950 text-xs"
                    onClick={() => handleRevokeAccess(selectedUser)}
                  >
                    Revoke Access
                  </Button>
                ) : (
                  <Button 
                    size="sm" 
                    className="w-1/3 bg-green-600 hover:bg-green-700 text-white text-xs"
                    onClick={() => handleGiftAccess(selectedUser)}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Grant Premium
                  </Button>
                )}

                {selectedUser.email?.toLowerCase().trim() !== 'admitwise2@gmail.com' && (
                  <Button 
                    variant="destructive"
                    size="sm" 
                    className="w-1/3 text-xs font-semibold"
                    onClick={() => handleDeleteUser(selectedUser)}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete User
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
