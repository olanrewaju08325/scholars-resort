import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { CheckCircle, XCircle, CreditCard, Activity, Link as LinkIcon, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useConfirm } from '@/hooks/useConfirm';

export const PaymentsTab = () => {
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { confirmAction, ConfirmElement } = useConfirm();
  
  const [stats, setStats] = useState({ pendingAmount: 0, approvedAmount: 0 });

  const fetchPayments = async () => {
    setLoading(true);
    try {
      // Fetch pending
      const { data: rawPending } = await supabase
        .from('manual_payments')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      // Fetch history (recent approved/rejected)
      const { data: rawHistory } = await supabase
        .from('manual_payments')
        .select('*')
        .in('status', ['approved', 'rejected'])
        .order('created_at', { ascending: false })
        .limit(10);

      // Collect user IDs
      const userIds = Array.from(new Set([
        ...(rawPending || []).map(p => p.user_id),
        ...(rawHistory || []).map(p => p.user_id)
      ].filter(Boolean)));

      let profileMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);
        
        (profiles || []).forEach(p => {
          profileMap[p.id] = p;
        });
      }

      const pendingWithProfiles = (rawPending || []).map(p => ({
        ...p,
        profiles: profileMap[p.user_id] || { full_name: 'Unknown Student', email: 'N/A' }
      }));

      const historyWithProfiles = (rawHistory || []).map(p => ({
        ...p,
        profiles: profileMap[p.user_id] || { full_name: 'Unknown Student', email: 'N/A' }
      }));

      // Stats calculation
      const { data: allData } = await supabase.from('manual_payments').select('status, amount');
      let pAmount = 0, aAmount = 0;
      allData?.forEach(d => {
        if (d.status === 'pending') pAmount += Number(d.amount || 0);
        if (d.status === 'approved') aAmount += Number(d.amount || 0);
      });

      setPendingPayments(pendingWithProfiles);
      setHistory(historyWithProfiles);
      setStats({ pendingAmount: pAmount, approvedAmount: aAmount });
    } catch (err) {
      console.warn('Error fetching payments:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleVerify = async (paymentId: string, userId: string, amount: number, planType: string) => {
    try {
      const { error } = await supabase.from('manual_payments').update({ 
        status: 'approved',
        approved_at: new Date().toISOString()
      }).eq('id', paymentId);
        
      if (!error) {
        const expiresAt = (planType === 'lifetime' || amount >= 3000)
          ? new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString()
          : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

        await supabase.from('subscriptions').upsert({
          user_id: userId,
          plan: planType || 'premium',
          status: 'active',
          started_at: new Date().toISOString(),
          expires_at: expiresAt
        }, { onConflict: 'user_id' });
        
        await supabase.from('profiles').update({ has_paid: true }).eq('id', userId);
        
        // Get student email for notification
        const { data: studentProfile } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', userId)
          .maybeSingle();
        
        // Send approval email
        if (studentProfile?.email) {
          await supabase.functions.invoke('communication-center', {
            body: {
              to: studentProfile.email,
              templateName: 'payment_approved',
              payload: { name: studentProfile.full_name || 'Scholar' }
            }
          }).catch(err => console.warn('Email send failed:', err));
        }
        
        // Log it
        await supabase.from('activity_logs').insert({
          user_id: userId,
          action: 'payment_approved',
          metadata: { amount, plan_type: planType, payment_id: paymentId }
        });

        toast.success("Payment verified! Student account is now unlocked.");
        fetchPayments();
      } else {
        throw new Error("Error updating payment status.");
      }
    } catch (error) {
      toast.error("Error updating payment status.");
    }
  };

  const handleReject = async (paymentId: string, userId: string) => {
    confirmAction(
      "Reject Payment",
      "Reject this manual payment submission?",
      async () => {
        const { error } = await supabase.from('manual_payments').update({ status: 'rejected' }).eq('id', paymentId);
        if (!error) {
          toast.success("Payment rejected.");
          fetchPayments();

          // Get student email
          const { data: studentProfile } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('id', userId)
            .maybeSingle();

          if (studentProfile?.email) {
            await supabase.functions.invoke('communication-center', {
              body: {
                to: studentProfile.email,
                templateName: 'payment_rejected',
                payload: { name: studentProfile.full_name || 'Scholar' }
              }
            }).catch(err => console.warn('Email send failed:', err));
          }

          await supabase.from('activity_logs').insert({
            user_id: userId,
            action: 'payment_rejected',
            metadata: { payment_id: paymentId }
          });
        } else {
          toast.error("Failed to reject payment.");
        }
      },
      { destructive: true }
    );
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(val);
  };

  return (
    <div className="space-y-6">
      {ConfirmElement}
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-wrap">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2"><CreditCard className="w-6 h-6 text-primary shrink-0" /> Payment Operations & Manual Transfers</h2>
          <p className="text-slate-400 text-xs sm:text-sm">Manage manual transfers, bank receipts, and payment gateway logs.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* KPI Cards */}
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-2">
              <div className="p-2 bg-amber-500/20 rounded-lg"><Activity className="w-5 h-5 text-amber-500" /></div>
            </div>
            <h3 className="text-sm font-medium text-slate-400">Pending Approvals</h3>
            <div className="text-2xl font-bold text-white mt-1">{formatCurrency(stats.pendingAmount)}</div>
            <p className="text-xs text-slate-500 mt-2">{pendingPayments.length} transactions waiting</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-2">
              <div className="p-2 bg-green-500/20 rounded-lg"><CheckCircle className="w-5 h-5 text-green-500" /></div>
            </div>
            <h3 className="text-sm font-medium text-slate-400">Total Approved</h3>
            <div className="text-2xl font-bold text-white mt-1">{formatCurrency(stats.approvedAmount)}</div>
            <p className="text-xs text-slate-500 mt-2">Historically approved volume</p>
          </CardContent>
        </Card>

        {/* Webhooks config display */}
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><LinkIcon className="w-4 h-4 text-blue-400"/> Payment Webhooks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500">Paystack Endpoint URL</label>
                <div className="flex items-center gap-2 mt-1">
                  <input readOnly value="https://[YOUR-PROJECT].supabase.co/functions/v1/paystack-webhook" className="w-full bg-slate-950 text-slate-300 text-xs p-2 rounded border border-slate-800 font-mono" />
                </div>
              </div>
              <div className="text-xs text-slate-400 border-t border-slate-800 pt-2">
                Automatic payments bypass the manual queue. Configure your gateway to hit the webhook above.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Table */}
      <Card className="bg-slate-900 border-slate-800 text-slate-100">
        <CardHeader>
          <CardTitle>Manual Verification Queue</CardTitle>
          <CardDescription className="text-slate-400">Requires manual review of transfer receipts.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border border-slate-800 rounded-md overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-950/50 text-slate-400 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Ref/Receipt</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Loading queue...</td></tr>
                ) : pendingPayments.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Queue is empty. All caught up!</td></tr>
                ) : (
                  pendingPayments.map(payment => (
                    <tr key={payment.id} className="hover:bg-slate-800/50">
                      <td className="px-4 py-3 text-slate-400">{new Date(payment.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-200">{payment.profiles?.full_name}</div>
                        <div className="text-xs text-slate-500">{payment.profiles?.email}</div>
                      </td>
                      <td className="px-4 py-3 font-bold text-amber-400">{formatCurrency(payment.amount)}</td>
                      <td className="px-4 py-3 font-mono text-xs">{payment.reference || 'No Ref'}</td>
                      <td className="px-4 py-3 capitalize">{payment.plan_type || 'Unknown'}</td>
                      <td className="px-4 py-3 flex gap-2 justify-end">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="sm" variant="outline" onClick={() => handleReject(payment.id, payment.user_id)} className="h-8 text-red-400 border-red-900/30 hover:bg-red-950">
                              <XCircle className="w-4 h-4 mr-1"/> Reject
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Decline payment proof and issue email notification</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="sm" onClick={() => handleVerify(payment.id, payment.user_id, payment.amount, payment.plan_type)} className="h-8 bg-green-600 hover:bg-green-700">
                              <CheckCircle className="w-4 h-4 mr-1"/> Verify
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Verify payment receipt, activate subscription plan, and notify student</TooltipContent>
                        </Tooltip>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* History Table */}
      <Card className="bg-slate-900 border-slate-800 text-slate-100">
        <CardHeader>
          <CardTitle>Recent Processed Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border border-slate-800 rounded-md overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-950/50 text-slate-400 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading ? (
                   <tr><td colSpan={4} className="px-4 py-4 text-center text-slate-500">Loading...</td></tr>
                ) : history.length === 0 ? (
                   <tr><td colSpan={4} className="px-4 py-4 text-center text-slate-500">No history found.</td></tr>
                ) : history.map(item => (
                  <tr key={item.id} className="hover:bg-slate-800/50">
                    <td className="px-4 py-3 text-slate-400">{new Date(item.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-300">{item.profiles?.full_name}</div>
                      <div className="text-xs text-slate-500">{item.profiles?.email}</div>
                    </td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(item.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${item.status === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {item.status}
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
  );
};
