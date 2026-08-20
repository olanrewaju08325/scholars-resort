import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { Users, Download, ShieldCheck, Search, Filter, ArrowUpDown, MoreVertical, Flag, ChevronLeft, ChevronRight, Flame, Smartphone, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/hooks/useConfirm';

export const StudentsTab = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { confirmAction, ConfirmElement } = useConfirm();

  // Filtering & Sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student');
      
    if (!error && data) {
      setStudents(data);
    }
    setLoading(false);
  };

  // Processed Data
  const processedStudents = useMemo(() => {
    let result = [...students];

    // Search
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(s => 
        (s.full_name && s.full_name.toLowerCase().includes(lowerSearch)) || 
        (s.email && s.email.toLowerCase().includes(lowerSearch))
      );
    }

    // Filter
    if (filterStatus === 'paid') {
      result = result.filter(s => s.has_paid);
    } else if (filterStatus === 'unpaid') {
      result = result.filter(s => !s.has_paid);
    } else if (filterStatus === 'active') {
      // Considered active if updated within last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      result = result.filter(s => new Date(s.updated_at) > sevenDaysAgo);
    }

    // Sort
    result.sort((a, b) => {
      let valA, valB;
      if (sortBy === 'created_at') {
        valA = new Date(a.created_at).getTime();
        valB = new Date(b.created_at).getTime();
      } else if (sortBy === 'full_name') {
        valA = a.full_name || '';
        valB = b.full_name || '';
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
  }, [students, searchTerm, filterStatus, sortBy, sortOrder]);

  // Pagination bounds
  const totalPages = Math.ceil(processedStudents.length / itemsPerPage);
  const paginatedStudents = processedStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
      setSelectedIds(new Set(paginatedStudents.map(s => s.id)));
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

  const handleGiftAccess = async (studentId: string, studentName: string) => {
    confirmAction(
      "Grant Premium Access",
      `Are you sure you want to grant lifetime premium access to ${studentName}?`,
      async () => {
        const expiresAt = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();
        await supabase.from('subscriptions').insert({
          user_id: studentId,
          plan_name: 'Lifetime Access (Gifted)',
          status: 'active',
          expires_at: expiresAt
        });

        const { error } = await supabase.from('profiles').update({ has_paid: true }).eq('id', studentId);
        
        if (!error) {
          toast.success(`${studentName} now has premium access!`);
          setStudents(prev => prev.map(s => s.id === studentId ? { ...s, has_paid: true } : s));
        } else {
          toast.error('Failed to grant access.');
        }
      }
    );
  };

  const handleBulkGiftAccess = async () => {
    if (selectedIds.size === 0) return;
    
    confirmAction(
      "Bulk Grant Premium Access",
      `Are you sure you want to grant lifetime premium access to ${selectedIds.size} students?`,
      async () => {
        try {
          const expiresAt = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();
          const inserts = Array.from(selectedIds).map(id => ({
            user_id: id,
            plan_name: 'Lifetime Access (Gifted)',
            status: 'active',
            expires_at: expiresAt
          }));
          
          await supabase.from('subscriptions').insert(inserts);
          await supabase.from('profiles').update({ has_paid: true }).in('id', Array.from(selectedIds));
          
          toast.success(`Successfully granted access to ${selectedIds.size} students!`);
          fetchStudents(); // Refresh data
          setSelectedIds(new Set());
        } catch (e: any) {
          toast.error(`Failed bulk action: ${e.message}`);
        }
      }
    );
  };

  const flagForReview = async (studentId: string, studentName: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: 'flagged_user',
        details: `Flagged student ${studentId} (${studentName}) for administrative review.`
      });
      toast.success(`${studentName} flagged for review.`);
    } catch (e: any) {
      toast.error('Failed to flag user.');
    }
  };

  const handleResetDevice = async (studentId: string, studentName: string) => {
    confirmAction(
      "Reset Device Lock",
      `Are you sure you want to reset the registered device for ${studentName}? This will allow them to authorize and bind a new device on their next login.`,
      async () => {
        try {
          const { error } = await supabase.from('profiles').update({ device_uuid: null }).eq('id', studentId);
          if (error) throw error;
          toast.success(`Device lock reset for ${studentName}. They can now link their new device.`);
          fetchStudents();
        } catch (err: any) {
          toast.error(`Failed to reset device: ${err.message}`);
        }
      }
    );
  };

  const exportToCSV = () => {
    if (processedStudents.length === 0) return;
    const headers = ['Name,Email,Status,Streak,Score (XP),Joined Date'];
    const rows = processedStudents.map(s => 
      `"${s.full_name}","${s.email}",${s.has_paid ? 'Verified' : 'Unpaid'},${s.streak_days || 0},${s.xp || 0},"${new Date(s.created_at).toLocaleDateString()}"`
    );
    const csvContent = "data:text/csv;charset=utf-8," + headers.concat(rows).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "scholars_resort_students.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {ConfirmElement}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-wrap">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2"><Users className="w-6 h-6 text-primary shrink-0" /> Student Management</h2>
          <p className="text-slate-400 text-xs sm:text-sm">View and manage the complete student directory.</p>
        </div>
        <div className="flex gap-2 flex-wrap shrink-0">
          {selectedIds.size > 0 && (
            <Button onClick={handleBulkGiftAccess} className="bg-purple-600 hover:bg-purple-700 text-xs sm:text-sm">
              Bulk Grant Access ({selectedIds.size})
            </Button>
          )}
          <Button onClick={exportToCSV} variant="outline" className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 gap-2 text-xs sm:text-sm">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>
      </div>

      <Card className="bg-slate-900 border-slate-800 text-slate-100">
        <CardHeader className="pb-4 border-b border-slate-800">
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input 
                  placeholder="Search name or email..." 
                  className="pl-9 bg-slate-950 border-slate-700 text-sm h-9"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                />
              </div>
              
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-700 rounded-md px-2 h-9">
                <Filter className="w-4 h-4 text-slate-500" />
                <select 
                  className="bg-transparent text-sm outline-none w-24 text-slate-300"
                  value={filterStatus}
                  onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                >
                  <option value="all">All</option>
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="active">Active (7d)</option>
                </select>
              </div>
            </div>
            
            <div className="text-sm text-slate-400">
              Showing {paginatedStudents.length} of {processedStudents.length} students
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-950/50 text-slate-400 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-700 bg-slate-900 text-primary focus:ring-primary"
                      checked={paginatedStudents.length > 0 && selectedIds.size === paginatedStudents.length}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="px-4 py-3 font-semibold cursor-pointer hover:text-white" onClick={() => toggleSort('full_name')}>
                    <div className="flex items-center gap-1">Student <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-4 py-3 font-semibold cursor-pointer hover:text-white" onClick={() => toggleSort('has_paid')}>
                    <div className="flex items-center gap-1">Status <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-4 py-3 font-semibold cursor-pointer hover:text-white" onClick={() => toggleSort('xp')}>
                    <div className="flex items-center gap-1">Score (XP) <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-4 py-3 font-semibold cursor-pointer hover:text-white" onClick={() => toggleSort('streak_days')}>
                    <div className="flex items-center gap-1">Streak <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-4 py-3 font-semibold cursor-pointer hover:text-white" onClick={() => toggleSort('created_at')}>
                    <div className="flex items-center gap-1">Joined <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading ? (
                   <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">Loading student directory...</td></tr>
                ) : paginatedStudents.length === 0 ? (
                   <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">No students match your criteria.</td></tr>
                ) : paginatedStudents.map(student => (
                  <tr key={student.id} className="hover:bg-slate-800/50 group">
                    <td className="px-4 py-3">
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-700 bg-slate-900 text-primary focus:ring-primary"
                        checked={selectedIds.has(student.id)}
                        onChange={() => handleSelectOne(student.id)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-200">{student.full_name || 'Anonymous'}</div>
                      <div className="text-xs text-slate-500">{student.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      {student.has_paid ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-green-500/20 text-green-400">Verified</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-500/20 text-red-400">Unpaid</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-primary font-bold">
                      {student.xp || 0}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-orange-400 font-bold">
                        <Flame className="w-4 h-4 text-orange-400" /> {student.streak_days || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                      {new Date(student.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-400 hover:text-blue-300 hover:bg-blue-950" onClick={() => handleResetDevice(student.id, student.full_name)} title="Reset Authorized Device Lock">
                          <Smartphone className="w-4 h-4" />
                        </Button>
                        {!student.has_paid && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-green-400 hover:text-green-300 hover:bg-green-950" onClick={() => handleGiftAccess(student.id, student.full_name)} title="Gift Premium Access">
                            <ShieldCheck className="w-4 h-4" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-yellow-500 hover:text-yellow-400 hover:bg-yellow-950" onClick={() => flagForReview(student.id, student.full_name)} title="Flag for Review">
                          <Flag className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-950/30">
              <div className="text-xs text-slate-500">
                Page {currentPage} of {totalPages}
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
    </div>
  );
};
