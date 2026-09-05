import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  Network, Users, Trophy, Percent, Link2, DollarSign,
  Settings2, CheckCircle2, XCircle, Clock, Save,
  Smartphone, Building2, ShieldCheck, RefreshCw
} from 'lucide-react';
import { logAdminActivity } from '@/services/adminActivityService';

interface ReferralConfig {
  rewardPerPaid: number;
  minWithdrawal: number;
  isActive: boolean;
  programTitle: string;
  programDescription: string;
}

interface PayoutRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  amount: number;
  payoutType: 'bank' | 'airtime';
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  airtimeNetwork?: string;
  airtimePhone?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  processed_at?: string;
  adminNote?: string;
}

export const ReferralTab = () => {
  const [referrals, setReferrals] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);

  // Config State
  const [config, setConfig] = useState<ReferralConfig>({
    rewardPerPaid: 500,
    minWithdrawal: 2000,
    isActive: true,
    programTitle: 'UTME Student Referral & Ambassador Program',
    programDescription: 'Earn cash rewards for every UTME candidate or friend you invite to Scholars Resort.'
  });

  // Payout Requests
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
  const [processingPayoutId, setProcessingPayoutId] = useState<string | null>(null);
  const [adminNoteInput, setAdminNoteInput] = useState<{ [key: string]: string }>({});

  // Stats
  const [totalReferrals, setTotalReferrals] = useState(0);
  const [conversionRate, setConversionRate] = useState(0);
  const [totalConverted, setTotalConverted] = useState(0);

  const fetchReferralData = useCallback(async () => {
    setLoading(true);

    // 1. Fetch Config
    try {
      const { data: configRow } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'referral_program_config')
        .maybeSingle();

      if (configRow?.setting_value) {
        const parsed = typeof configRow.setting_value === 'string'
          ? JSON.parse(configRow.setting_value)
          : configRow.setting_value;
        setConfig({
          rewardPerPaid: Number(parsed.rewardPerPaid) || 500,
          minWithdrawal: Number(parsed.minWithdrawal) || 2000,
          isActive: parsed.isActive !== false,
          programTitle: parsed.programTitle || 'UTME Student Referral & Ambassador Program',
          programDescription: parsed.programDescription || 'Earn cash rewards for every UTME candidate you invite.'
        });
      }
    } catch {}

    // 2. Fetch Payout Requests
    try {
      const { data: payoutRow } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'referral_payout_requests')
        .maybeSingle();

      if (payoutRow?.setting_value && Array.isArray(payoutRow.setting_value)) {
        setPayoutRequests(payoutRow.setting_value);
      }
    } catch {}

    // 3. Fetch Referrals table
    try {
      const { data, error } = await supabase
        .from('referrals')
        .select(`
          id, 
          converted, 
          created_at,
          referrer:profiles!referrer_id(id, full_name, email),
          referred:profiles!referred_id(id, full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setReferrals(data);
        calculateStats(data);
        buildLeaderboard(data);
      }
    } catch {}

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchReferralData();
  }, [fetchReferralData]);

  const calculateStats = (data: any[]) => {
    setTotalReferrals(data.length);
    const converted = data.filter(r => r.converted).length;
    setTotalConverted(converted);
    setConversionRate(data.length > 0 ? (converted / data.length) * 100 : 0);
  };

  const buildLeaderboard = (data: any[]) => {
    const counts: Record<string, { name: string, count: number, converted: number }> = {};
    
    data.forEach(r => {
      const rid = r.referrer?.id;
      if (!rid) return;
      
      if (!counts[rid]) {
        counts[rid] = { name: r.referrer.full_name || 'Unknown', count: 0, converted: 0 };
      }
      counts[rid].count += 1;
      if (r.converted) counts[rid].converted += 1;
    });

    const sorted = Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 10);
    setLeaderboard(sorted);
  };

  // Save Referral Configuration
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await supabase
        .from('admin_settings')
        .upsert({
          setting_key: 'referral_program_config',
          setting_value: config,
          updated_at: new Date().toISOString()
        });

      logAdminActivity('UPDATE_REFERRAL_CONFIG', `Updated reward to ₦${config.rewardPerPaid}/friend and min withdrawal to ₦${config.minWithdrawal}`, 'finance');
      toast.success('Referral Program settings saved and updated live for all students!');
    } catch (err: any) {
      toast.error(`Failed to save settings: ${err.message}`);
    } finally {
      setSavingConfig(false);
    }
  };

  // Process Payout Request (Approve or Reject)
  const handleUpdatePayoutStatus = async (payoutId: string, status: 'approved' | 'rejected') => {
    setProcessingPayoutId(payoutId);
    try {
      const note = adminNoteInput[payoutId] || (status === 'approved' ? 'Disbursed via direct transfer' : 'Rejected by admin');
      const updatedRequests = payoutRequests.map(req => {
        if (req.id === payoutId) {
          return {
            ...req,
            status,
            processed_at: new Date().toISOString(),
            adminNote: note
          };
        }
        return req;
      });

      await supabase
        .from('admin_settings')
        .upsert({
          setting_key: 'referral_payout_requests',
          setting_value: updatedRequests,
          updated_at: new Date().toISOString()
        });

      setPayoutRequests(updatedRequests);
      logAdminActivity('PROCESS_REFERRAL_PAYOUT', `Marked payout ${payoutId} as ${status.toUpperCase()}`, 'finance');
      toast.success(`Payout request marked as ${status === 'approved' ? 'Approved & Disbursed' : 'Rejected'}!`);
    } catch (err: any) {
      toast.error(`Failed to update payout: ${err.message}`);
    } finally {
      setProcessingPayoutId(null);
    }
  };

  // Derived financial computations for admin
  const totalPendingPayoutAmount = payoutRequests
    .filter(req => req.status === 'pending')
    .reduce((sum, req) => sum + (req.amount || 0), 0);

  const totalDisbursedPayoutAmount = payoutRequests
    .filter(req => req.status === 'approved')
    .reduce((sum, req) => sum + (req.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Network className="w-6 h-6 text-primary shrink-0" /> Referral & Ambassador Program Management
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm">
            Configure commission rewards, review student bank payout requests, and monitor top student referrers.
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchReferralData} 
          disabled={loading}
          className="text-xs font-semibold gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Data
        </Button>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800 text-slate-100 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">Total Referrals</p>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-1">{totalReferrals}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{totalConverted} Paid ({conversionRate.toFixed(1)}%)</p>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-slate-100 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">Reward / Paid Student</p>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-1">₦{config.rewardPerPaid.toLocaleString()}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Configured student reward</p>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-slate-100 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">Pending Payout Queue</p>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-400 mt-1">₦{totalPendingPayoutAmount.toLocaleString()}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {payoutRequests.filter(r => r.status === 'pending').length} Student Requests
          </p>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-slate-100 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">Total Disbursed</p>
            <ShieldCheck className="w-4 h-4 text-primary" />
          </div>
          <p className="text-2xl font-bold text-primary mt-1">₦{totalDisbursedPayoutAmount.toLocaleString()}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {payoutRequests.filter(r => r.status === 'approved').length} Paid Out
          </p>
        </Card>
      </div>

      {/* Referral Program Configuration Form */}
      <Card className="bg-slate-900 border-slate-800 text-slate-100">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" /> Referral Program Rules & Reward Settings
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs">
            Changes made here instantly reflect on the student's Referral Hub and payout eligibility checks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">Commission Amount per Paid Friend (₦)</Label>
                <Input
                  type="number"
                  min="0"
                  step="50"
                  value={config.rewardPerPaid}
                  onChange={e => setConfig(prev => ({ ...prev, rewardPerPaid: Number(e.target.value) }))}
                  className="bg-slate-950 border-slate-700 font-bold"
                  required
                />
                <p className="text-[11px] text-slate-500">Default is ₦500 per friend who activates lifetime access.</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">Minimum Withdrawal Threshold (₦)</Label>
                <Input
                  type="number"
                  min="500"
                  step="100"
                  value={config.minWithdrawal}
                  onChange={e => setConfig(prev => ({ ...prev, minWithdrawal: Number(e.target.value) }))}
                  className="bg-slate-950 border-slate-700 font-bold"
                  required
                />
                <p className="text-[11px] text-slate-500">Student must reach this balance before requesting a payout.</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">Referral Program Status</Label>
                <select
                  value={config.isActive ? 'active' : 'disabled'}
                  onChange={e => setConfig(prev => ({ ...prev, isActive: e.target.value === 'active' }))}
                  className="w-full text-xs h-10 rounded-md border border-slate-700 bg-slate-950 px-3 font-semibold text-slate-200"
                >
                  <option value="active">Active & Open to All Students</option>
                  <option value="disabled">Paused / Disabled</option>
                </select>
                <p className="text-[11px] text-slate-500">Toggle whether students can earn and view referral links.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">Program Display Headline</Label>
                <Input
                  value={config.programTitle}
                  onChange={e => setConfig(prev => ({ ...prev, programTitle: e.target.value }))}
                  className="bg-slate-950 border-slate-700 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-300">Program Subtitle / Student Instructions</Label>
                <Input
                  value={config.programDescription}
                  onChange={e => setConfig(prev => ({ ...prev, programDescription: e.target.value }))}
                  className="bg-slate-950 border-slate-700 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={savingConfig} className="bg-primary hover:bg-primary/90 font-bold text-xs gap-1.5">
                <Save className="w-4 h-4" /> {savingConfig ? 'Saving Settings...' : 'Save & Publish Referral Rules'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Student Withdrawal Requests Manager */}
      <Card className="bg-slate-900 border-slate-800 text-slate-100">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" /> Student Payout & Bank Withdrawal Requests
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Review pending cash/airtime payout requests submitted by students who earned referral rewards.
              </CardDescription>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 font-bold">
              {payoutRequests.filter(r => r.status === 'pending').length} Pending Requests
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {payoutRequests.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              No student withdrawal requests logged yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="text-[11px] text-slate-400 uppercase bg-slate-950/60">
                  <tr>
                    <th className="px-3 py-3 rounded-tl-lg">Date</th>
                    <th className="px-3 py-3">Student Details</th>
                    <th className="px-3 py-3">Payout Method & Account</th>
                    <th className="px-3 py-3">Amount</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3 rounded-tr-lg text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {payoutRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-3 py-3 whitespace-nowrap text-slate-400">
                        {new Date(req.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-bold text-slate-200">{req.userName}</div>
                        <div className="text-[10px] text-slate-400">{req.userEmail}</div>
                        {req.userPhone && <div className="text-[10px] text-emerald-400">{req.userPhone}</div>}
                      </td>
                      <td className="px-3 py-3">
                        {req.payoutType === 'bank' ? (
                          <div className="space-y-0.5">
                            <div className="font-bold text-slate-200 flex items-center gap-1">
                              <Building2 className="w-3.5 h-3.5 text-blue-400" /> {req.bankName}
                            </div>
                            <div className="font-mono text-slate-300 font-bold">{req.accountNumber}</div>
                            <div className="text-[10px] text-slate-400">{req.accountName}</div>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <div className="font-bold text-slate-200 flex items-center gap-1">
                              <Smartphone className="w-3.5 h-3.5 text-emerald-400" /> {req.airtimeNetwork} Airtime
                            </div>
                            <div className="font-mono text-slate-300 font-bold">{req.airtimePhone}</div>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-black text-sm text-emerald-400">
                          ₦{req.amount.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          req.status === 'approved' 
                            ? 'bg-emerald-500/20 text-emerald-400' 
                            : req.status === 'rejected'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-amber-500/20 text-amber-400 animate-pulse'
                        }`}>
                          {req.status}
                        </span>
                        {req.adminNote && (
                          <p className="text-[10px] text-slate-400 mt-1 max-w-xs">{req.adminNote}</p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {req.status === 'pending' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              onClick={() => handleUpdatePayoutStatus(req.id, 'approved')}
                              disabled={processingPayoutId === req.id}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] h-7 px-2.5"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Mark Paid
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleUpdatePayoutStatus(req.id, 'rejected')}
                              disabled={processingPayoutId === req.id}
                              className="font-bold text-[11px] h-7 px-2"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-500">
                            Processed {req.processed_at ? new Date(req.processed_at).toLocaleDateString() : ''}
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

      {/* Top Referrers and Recent Referrals Network */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Top Referrers */}
        <Card className="md:col-span-1 bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-500 text-base">
              <Trophy className="w-5 h-5" /> Top Student Ambassadors
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leaderboard.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs">No referrals logged yet.</div>
            ) : (
              <div className="space-y-3">
                {leaderboard.map((lb, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-lg">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-yellow-500 text-black' : idx === 1 ? 'bg-slate-300 text-black' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-800 text-slate-400'}`}>
                        {idx + 1}
                      </div>
                      <span className="font-semibold text-xs text-slate-200 line-clamp-1">{lb.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-100">{lb.count} Invited</div>
                      <div className="text-[10px] text-emerald-400 font-bold">{lb.converted} Paid (₦{(lb.converted * config.rewardPerPaid).toLocaleString()})</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detailed Referral Network List */}
        <Card className="md:col-span-2 bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader>
            <CardTitle className="text-base font-bold">Recent Student Referrals</CardTitle>
            <CardDescription className="text-slate-400 text-xs">Full history of student referrals and registration conversion status.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="text-[11px] text-slate-400 uppercase bg-slate-950/60">
                  <tr>
                    <th className="px-3 py-2.5 rounded-tl-lg">Date</th>
                    <th className="px-3 py-2.5">Referrer</th>
                    <th className="px-3 py-2.5"></th>
                    <th className="px-3 py-2.5">Referred Student</th>
                    <th className="px-3 py-2.5 rounded-tr-lg">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {loading ? (
                    <tr><td colSpan={5} className="text-center py-8 text-slate-500">Loading referral logs...</td></tr>
                  ) : referrals.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-slate-500">No referral activity logged yet.</td></tr>
                  ) : referrals.slice(0, 15).map((ref) => (
                    <tr key={ref.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-400">{new Date(ref.created_at).toLocaleDateString()}</td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-slate-200">{ref.referrer?.full_name || 'Unknown'}</div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[120px]">{ref.referrer?.email}</div>
                      </td>
                      <td className="px-3 py-2.5 text-center text-slate-600"><Link2 className="w-3.5 h-3.5 mx-auto" /></td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-slate-200">{ref.referred?.full_name || 'Unknown'}</div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[120px]">{ref.referred?.email}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          ref.converted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {ref.converted ? `Paid (+₦${config.rewardPerPaid})` : 'Free / Pending'}
                        </span>
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
