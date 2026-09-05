import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  Gift, Percent, Plus, Trash2, Copy, Search,
  Users, CheckCircle2, XCircle, Settings2, Save,
  GraduationCap, Award, RefreshCw, Sparkles, FileText, HeartHandshake
} from 'lucide-react';
import { useConfirm } from '@/hooks/useConfirm';
import { logAdminActivity } from '@/services/adminActivityService';

interface ScholarshipConfig {
  isActive: boolean;
  passThresholdPercent: number;
  monthlyQuota: number;
  programTitle: string;
  programDescription: string;
  eligibilityText: string;
}

interface ScholarshipApp {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  score?: number;
  passed?: boolean;
  stateOfOrigin?: string;
  targetCourse?: string;
  targetUni?: string;
  reason?: string;
  type: 'merit_test' | 'financial_aid';
  status: 'pending_review' | 'merit_passed' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at?: string;
}

export const ScholarshipTab = () => {
  const [codes, setCodes] = useState<any[]>([]);
  const [applications, setApplications] = useState<ScholarshipApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { confirmAction, ConfirmElement } = useConfirm();

  // Config State
  const [config, setConfig] = useState<ScholarshipConfig>({
    isActive: true,
    passThresholdPercent: 70,
    monthlyQuota: 50,
    programTitle: '100% Free Lifetime UTME Scholarship Program',
    programDescription: 'Empowering determined and indigent Nigerian secondary school leavers with 100% free access to premier JAMB UTME preparation materials.',
    eligibilityText: 'Candidates with high academic aptitude from financially challenged backgrounds, orphans, and students from underserved communities.'
  });
  const [savingConfig, setSavingConfig] = useState(false);

  // Discount Code Form State
  const [codeName, setCodeName] = useState('');
  const [discountType, setDiscountType] = useState('percentage');
  const [discountValue, setDiscountValue] = useState(100);
  const [maxUses, setMaxUses] = useState(50);

  // Direct Search / Grant
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundStudent, setFoundStudent] = useState<any>(null);

  const fetchScholarshipData = useCallback(async () => {
    setLoading(true);

    // 1. Fetch Config
    try {
      const { data: configRow } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'scholarship_program_config')
        .maybeSingle();

      if (configRow?.setting_value) {
        const parsed = typeof configRow.setting_value === 'string'
          ? JSON.parse(configRow.setting_value)
          : configRow.setting_value;
        setConfig({
          isActive: parsed.isActive !== false,
          passThresholdPercent: Number(parsed.passThresholdPercent) || 70,
          monthlyQuota: Number(parsed.monthlyQuota) || 50,
          programTitle: parsed.programTitle || '100% Free Lifetime UTME Scholarship Program',
          programDescription: parsed.programDescription || 'Empowering determined Nigerian candidates with 100% free lifetime access.',
          eligibilityText: parsed.eligibilityText || 'Candidates from indigent backgrounds and high academic performers.'
        });
      }
    } catch {}

    // 2. Fetch Applications
    try {
      const { data: appRow } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'scholarship_applications')
        .maybeSingle();

      if (appRow?.setting_value && Array.isArray(appRow.setting_value)) {
        setApplications(appRow.setting_value);
      }
    } catch {}

    // 3. Fetch Discount / Voucher Codes
    try {
      const { data, error } = await supabase
        .from('discount_codes')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setCodes(data);
      }
    } catch {}

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchScholarshipData();
  }, [fetchScholarshipData]);

  // Save Scholarship Configuration
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await supabase
        .from('admin_settings')
        .upsert({
          setting_key: 'scholarship_program_config',
          setting_value: config,
          updated_at: new Date().toISOString()
        });

      logAdminActivity('UPDATE_SCHOLARSHIP_CONFIG', `Updated pass mark to ${config.passThresholdPercent}% and quota to ${config.monthlyQuota}`, 'scholarships');
      toast.success('Scholarship rules and threshold saved live!');
    } catch (err: any) {
      toast.error(`Failed to save configuration: ${err.message}`);
    } finally {
      setSavingConfig(false);
    }
  };

  // Create Voucher / Discount Code
  const handleCreateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeName.trim()) return;

    try {
      const { error } = await supabase
        .from('discount_codes')
        .insert([{
          code: codeName.trim().toUpperCase(),
          discount_type: discountType,
          discount_value: discountValue,
          max_uses: maxUses,
          current_uses: 0
        }]);

      if (error) throw error;

      toast.success(`Scholarship Voucher "${codeName.toUpperCase()}" created successfully!`);
      setCodeName('');
      setIsFormOpen(false);
      fetchScholarshipData();
    } catch (err: any) {
      toast.error(`Failed to create voucher: ${err.message}`);
    }
  };

  const handleDeleteCode = async (id: string) => {
    confirmAction(
      "Delete Voucher Code",
      "Are you sure you want to deactivate and remove this scholarship voucher?",
      async () => {
        try {
          const { error } = await supabase.from('discount_codes').delete().eq('id', id);
          if (error) throw error;
          setCodes(codes.filter(c => c.id !== id));
          toast.success("Voucher deleted");
        } catch (err: any) {
          toast.error(`Failed to delete voucher: ${err.message}`);
        }
      }
    );
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Copied "${code}" to clipboard!`);
  };

  // Search Student for Direct Grant
  const searchStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setSearching(true);
    try {
      const { data: students, error } = await supabase
        .from('profiles')
        .select('*')
        .or(`email.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%`)
        .eq('role', 'student')
        .limit(1);

      if (error) throw error;

      if (!students || students.length === 0) {
        toast.error("No student found with that name or email.");
        setFoundStudent(null);
      } else {
        setFoundStudent(students[0]);
      }
    } catch (err: any) {
      toast.error(`Search failed: ${err.message}`);
    }
    setSearching(false);
  };

  // Direct Access Grant
  const grantScholarship = async () => {
    if (!foundStudent) return;
    
    confirmAction(
      "Grant 100% Free Lifetime Access",
      `Are you sure you want to grant 100% free lifetime access to ${foundStudent.full_name}? Their account will be activated immediately.`,
      async () => {
        try {
          await supabase.from('subscriptions').upsert({
            user_id: foundStudent.id,
            plan_id: 'lifetime',
            status: 'active',
            start_date: new Date().toISOString(),
            end_date: new Date(Date.now() + 3650 * 86400000).toISOString()
          });

          await supabase.from('profiles').update({ has_paid: true }).eq('id', foundStudent.id);
          
          logAdminActivity('GRANT_SCHOLARSHIP', `Granted lifetime scholarship to ${foundStudent.full_name} (${foundStudent.email})`, 'scholarships');
          toast.success(`🎉 Full Scholarship successfully granted to ${foundStudent.full_name}! Account is now active.`);
          setFoundStudent(null);
          setSearchTerm('');
        } catch (err: any) {
          toast.error(`Failed to grant access: ${err.message}`);
        }
      }
    );
  };

  // Approve or Reject Student Application in Queue
  const handleReviewApplication = async (appId: string, status: 'approved' | 'rejected') => {
    const app = applications.find(a => a.id === appId);
    if (!app) return;

    try {
      if (status === 'approved') {
        // Activate student subscription and profile
        if (app.userId) {
          await supabase.from('subscriptions').upsert({
            user_id: app.userId,
            plan_id: 'lifetime',
            status: 'active',
            start_date: new Date().toISOString(),
            end_date: new Date(Date.now() + 3650 * 86400000).toISOString()
          });

          await supabase.from('profiles').update({ has_paid: true }).eq('id', app.userId);
        }
      }

      const updatedApps = applications.map(a => {
        if (a.id === appId) {
          return {
            ...a,
            status,
            reviewed_at: new Date().toISOString()
          };
        }
        return a;
      });

      await supabase
        .from('admin_settings')
        .upsert({
          setting_key: 'scholarship_applications',
          setting_value: updatedApps,
          updated_at: new Date().toISOString()
        });

      setApplications(updatedApps);
      logAdminActivity('REVIEW_SCHOLARSHIP_APP', `Marked scholarship application for ${app.userName} as ${status.toUpperCase()}`, 'scholarships');
      toast.success(`Application marked as ${status === 'approved' ? 'Approved & Account Activated' : 'Rejected'}!`);
    } catch (err: any) {
      toast.error(`Action failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {ConfirmElement}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Gift className="w-6 h-6 text-primary shrink-0" /> Scholarships & Financial Aid Management
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm">
            Manage merit thresholds, review indigent student aid applications, generate 100% vouchers, and grant free access.
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchScholarshipData} 
          disabled={loading}
          className="text-xs font-semibold gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Data
        </Button>
      </div>

      {/* Scholarship Program Policy & Threshold Configuration */}
      <Card className="bg-slate-900 border-slate-800 text-slate-100">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" /> Scholarship Policy & Merit Pass Mark
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs">
            Configure automated pass thresholds for the 10-Question Merit Test and monthly scholarship quotas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">Merit Test Pass Mark (%)</Label>
                <Input
                  type="number"
                  min="50"
                  max="100"
                  value={config.passThresholdPercent}
                  onChange={e => setConfig(prev => ({ ...prev, passThresholdPercent: Number(e.target.value) }))}
                  className="bg-slate-950 border-slate-700 font-bold"
                  required
                />
                <p className="text-[11px] text-slate-500">Students scoring at or above this mark receive instant 100% scholarship.</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">Monthly Scholarship Quota</Label>
                <Input
                  type="number"
                  min="1"
                  value={config.monthlyQuota}
                  onChange={e => setConfig(prev => ({ ...prev, monthlyQuota: Number(e.target.value) }))}
                  className="bg-slate-950 border-slate-700 font-bold"
                  required
                />
                <p className="text-[11px] text-slate-500">Total free scholarships budgeted per calendar month.</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">Program Status</Label>
                <select
                  value={config.isActive ? 'active' : 'disabled'}
                  onChange={e => setConfig(prev => ({ ...prev, isActive: e.target.value === 'active' }))}
                  className="w-full text-xs h-10 rounded-md border border-slate-700 bg-slate-950 px-3 font-semibold text-slate-200"
                >
                  <option value="active">Active (Open for Applications)</option>
                  <option value="disabled">Temporarily Closed</option>
                </select>
                <p className="text-[11px] text-slate-500">Toggle student-facing scholarship application form.</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-300">Eligibility Guidelines Text</Label>
              <textarea
                rows={2}
                value={config.eligibilityText}
                onChange={e => setConfig(prev => ({ ...prev, eligibilityText: e.target.value }))}
                className="w-full text-xs rounded-md border border-slate-700 bg-slate-950 p-2.5 font-medium resize-none text-slate-200"
              />
            </div>

            <div className="flex justify-end pt-1">
              <Button type="submit" disabled={savingConfig} className="bg-primary hover:bg-primary/90 font-bold text-xs gap-1.5">
                <Save className="w-4 h-4" /> {savingConfig ? 'Saving...' : 'Save Policy Settings'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Student Scholarship Applications Queue */}
      <Card className="bg-slate-900 border-slate-800 text-slate-100">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <HeartHandshake className="w-5 h-5 text-purple-400" /> Student Scholarship Applications & Merit Submissions
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Review indigent aid requests and aptitude test results submitted by candidates.
              </CardDescription>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-400 font-bold">
              {applications.filter(a => a.status === 'pending_review' || a.status === 'merit_passed').length} In Queue
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {applications.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              No scholarship applications submitted yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="text-[11px] text-slate-400 uppercase bg-slate-950/60">
                  <tr>
                    <th className="px-3 py-2.5 rounded-tl-lg">Date</th>
                    <th className="px-3 py-2.5">Candidate</th>
                    <th className="px-3 py-2.5">Type & Score / Course</th>
                    <th className="px-3 py-2.5">Statement / Reason</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5 rounded-tr-lg text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {applications.map((app) => (
                    <tr key={app.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-3 py-3 whitespace-nowrap text-slate-400">
                        {new Date(app.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-bold text-slate-200">{app.userName}</div>
                        <div className="text-[10px] text-slate-400">{app.userEmail}</div>
                        {app.userPhone && <div className="text-[10px] text-emerald-400">{app.userPhone}</div>}
                      </td>
                      <td className="px-3 py-3">
                        {app.type === 'merit_test' ? (
                          <div>
                            <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-bold text-[10px]">
                              Merit Quiz: {app.score}%
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold text-[10px]">
                              Financial Aid
                            </span>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {app.targetCourse || 'Course'} • {app.targetUni || 'Uni'}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-slate-300 text-[11px] max-w-xs line-clamp-2">
                          {app.reason || (app.passed ? 'Passed Merit Aptitude Assessment' : 'Aptitude Assessment')}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          app.status === 'approved'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : app.status === 'rejected'
                            ? 'bg-red-500/20 text-red-400'
                            : app.status === 'merit_passed'
                            ? 'bg-purple-500/20 text-purple-400 font-bold'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {app.status === 'merit_passed' ? 'Merit Pass (Auto)' : app.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        {app.status !== 'approved' && app.status !== 'rejected' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              onClick={() => handleReviewApplication(app.id, 'approved')}
                              className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] h-7 px-2.5"
                            >
                              <GraduationCap className="w-3.5 h-3.5 mr-1" /> Grant 100% Free
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleReviewApplication(app.id, 'rejected')}
                              className="font-bold text-[11px] h-7 px-2"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-500">
                            Processed {app.reviewed_at ? new Date(app.reviewed_at).toLocaleDateString() : ''}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Direct Student Search & Access Grant */}
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="w-5 h-5 text-purple-400" /> Direct Student Lookup & Free Grant
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              Search by student email or name to immediately grant 100% free lifetime access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={searchStudent} className="flex gap-2 mb-4">
              <Input 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                placeholder="Search candidate by name or email..." 
                className="bg-slate-950 border-slate-800 text-xs"
              />
              <Button type="submit" disabled={searching} className="bg-slate-800 hover:bg-slate-700 text-xs font-bold">
                <Search className="w-4 h-4" />
              </Button>
            </form>

            {foundStudent && (
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg flex justify-between items-center">
                <div>
                  <div className="font-bold text-slate-200 text-xs">{foundStudent.full_name}</div>
                  <div className="text-[11px] text-slate-400">{foundStudent.email}</div>
                  <div className="text-[10px] text-emerald-400 mt-0.5 font-mono">
                    Status: {foundStudent.has_paid ? 'Already Paid / Lifetime' : 'Free / Unpaid'}
                  </div>
                </div>
                <Button onClick={grantScholarship} className="bg-purple-600 hover:bg-purple-500 font-bold text-xs">
                  <GraduationCap className="w-4 h-4 mr-1" /> Grant Full Access
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Voucher / Discount Code Generator */}
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Percent className="w-5 h-5 text-green-400" /> Scholarship & Discount Vouchers
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Create 100% free scholarship codes or promo discounts.
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setIsFormOpen(!isFormOpen)} className="bg-primary hover:bg-primary/90 text-xs font-bold">
              <Plus className="w-3.5 h-3.5 mr-1" /> New Voucher
            </Button>
          </CardHeader>
          <CardContent>
            {isFormOpen && (
              <form onSubmit={handleCreateCode} className="space-y-4 p-4 bg-slate-950 border border-slate-800 rounded-lg mb-6">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Voucher Code (e.g. SCHOLAR2026, INDIGENT100)</Label>
                  <Input 
                    value={codeName} 
                    onChange={(e) => setCodeName(e.target.value.toUpperCase())} 
                    className="bg-slate-900 border-slate-700 font-mono text-xs font-bold"
                    placeholder="SCHOLAR2026"
                    required
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Type</Label>
                    <select 
                      value={discountType} 
                      onChange={(e) => setDiscountType(e.target.value)} 
                      className="w-full h-9 bg-slate-900 border border-slate-700 rounded-md px-2 text-xs font-medium"
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="flat">Flat Amount (₦)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Value</Label>
                    <Input 
                      type="number"
                      value={discountValue} 
                      onChange={(e) => setDiscountValue(Number(e.target.value))} 
                      className="bg-slate-900 border-slate-700 text-xs font-bold"
                      min="1"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Max Uses</Label>
                    <Input 
                      type="number"
                      value={maxUses} 
                      onChange={(e) => setMaxUses(Number(e.target.value))} 
                      className="bg-slate-900 border-slate-700 text-xs font-bold"
                      min="1"
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setIsFormOpen(false)} className="text-slate-400 text-xs">Cancel</Button>
                  <Button type="submit" size="sm" className="bg-primary hover:bg-primary/90 font-bold text-xs">Create Voucher</Button>
                </div>
              </form>
            )}

            {/* Code List */}
            {loading ? (
              <div className="text-center py-4 text-slate-500 text-xs">Loading vouchers...</div>
            ) : codes.length === 0 ? (
              <div className="text-center py-6 text-slate-500 italic text-xs">No discount vouchers active.</div>
            ) : (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {codes.map(code => (
                  <div key={code.id} className="flex justify-between items-center p-2.5 bg-slate-950 border border-slate-800 rounded-lg">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-primary tracking-wider text-xs">{code.code}</span>
                        <button
                          type="button"
                          className="text-slate-400 hover:text-white p-0.5 rounded"
                          onClick={() => copyCode(code.code)}
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {code.discount_type === 'percentage' ? `${code.discount_value}% OFF` : `₦${code.discount_value} OFF`} 
                        <span className="mx-1.5">•</span> 
                        {code.current_uses || 0} / {code.max_uses} used
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-950 h-7 w-7 p-0" onClick={() => handleDeleteCode(code.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
