import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Users, Gift, Copy, Check, Share2, DollarSign,
  ArrowUpRight, Clock, CheckCircle2, AlertCircle,
  Smartphone, Building2, HelpCircle, Sparkles, Send
} from 'lucide-react';

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

export const Referrals = () => {
  const { user, profile } = useAuth();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  // Config State
  const [config, setConfig] = useState<ReferralConfig>({
    rewardPerPaid: 500,
    minWithdrawal: 2000,
    isActive: true,
    programTitle: 'UTME Student Referral & Ambassador Program',
    programDescription: 'Earn cash rewards for every UTME candidate or friend you invite to Scholars Resort.'
  });

  // User Stats & Referrals
  const [referralCode, setReferralCode] = useState('');
  const [referralsList, setReferralsList] = useState<any[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [submittingWithdrawal, setSubmittingWithdrawal] = useState(false);

  // Withdrawal Form State
  const [withdrawType, setWithdrawType] = useState<'bank' | 'airtime'>('bank');
  const [withdrawAmount, setWithdrawAmount] = useState<number>(2000);
  const [bankName, setBankName] = useState('Moniepoint MCB');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [airtimeNetwork, setAirtimeNetwork] = useState('MTN');
  const [airtimePhone, setAirtimePhone] = useState('');

  // Calculate user's referral link
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://scholarsresort.ng';
  const referralLink = `${origin}/signup?ref=${referralCode || 'STUDENT'}`;

  // Fetch Referral Config & History
  useEffect(() => {
    const loadReferralData = async () => {
      setLoading(true);

      // 1. Fetch live config from admin_settings
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
      } catch (err) {
        console.warn('Error fetching referral config:', err);
      }

      if (!user) {
        setLoading(false);
        return;
      }

      // 2. Generate or fetch user's referral code
      const generatedCode = profile?.referral_code || `SR-${(profile?.full_name || 'SCHOLAR').substring(0, 4).toUpperCase()}-${user.id.substring(0, 4).toUpperCase()}`;
      setReferralCode(generatedCode);

      // Ensure profile has referral code saved
      if (!profile?.referral_code) {
        try {
          await supabase.from('profiles').update({ referral_code: generatedCode }).eq('id', user.id);
        } catch {}
      }

      // 3. Fetch referrals attributed to this user
      let referredUsers: any[] = [];
      try {
        const { data: refRows } = await supabase
          .from('referrals')
          .select('id, created_at, converted, referred_id')
          .eq('referrer_id', user.id);

        if (refRows && refRows.length > 0) {
          // Fetch referred user profile details
          const referredIds = refRows.map(r => r.referred_id);
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, full_name, email, has_paid, created_at')
            .in('id', referredIds);

          const profileMap = new Map((profilesData || []).map(p => [p.id, p]));
          referredUsers = refRows.map(r => {
            const p = profileMap.get(r.referred_id);
            return {
              id: r.id,
              created_at: r.created_at,
              converted: r.converted || p?.has_paid || false,
              name: p?.full_name || 'UTME Student',
              email: p?.email ? `${p.email.substring(0, 3)}***@${p.email.split('@')[1] || 'email.com'}` : 'Anonymous'
            };
          });
        }
      } catch (err) {
        console.warn('Error fetching referrals list:', err);
      }

      // Fallback: check localStorage for offline / mock data
      if (referredUsers.length === 0) {
        try {
          const localRefs = localStorage.getItem(`scholar_refs_${user.id}`);
          if (localRefs) referredUsers = JSON.parse(localRefs);
        } catch {}
      }

      setReferralsList(referredUsers);

      // 4. Fetch user's payout requests
      try {
        const { data: payoutRow } = await supabase
          .from('admin_settings')
          .select('setting_value')
          .eq('setting_key', 'referral_payout_requests')
          .maybeSingle();

        if (payoutRow?.setting_value && Array.isArray(payoutRow.setting_value)) {
          const myRequests = payoutRow.setting_value.filter((req: PayoutRequest) => req.userId === user.id);
          setPayoutRequests(myRequests);
        } else {
          const localPayouts = localStorage.getItem(`scholar_payouts_${user.id}`);
          if (localPayouts) setPayoutRequests(JSON.parse(localPayouts));
        }
      } catch (err) {
        console.warn('Error fetching payout requests:', err);
      }

      setLoading(false);
    };

    loadReferralData();
  }, [user, profile]);

  // Derived financial computations
  const totalReferred = referralsList.length;
  const convertedCount = referralsList.filter(r => r.converted).length;
  const totalEarned = convertedCount * config.rewardPerPaid;
  
  const totalPaidOut = payoutRequests
    .filter(req => req.status === 'approved')
    .reduce((sum, req) => sum + (req.amount || 0), 0);
  
  const totalPending = payoutRequests
    .filter(req => req.status === 'pending')
    .reduce((sum, req) => sum + (req.amount || 0), 0);

  const availableBalance = Math.max(0, totalEarned - totalPaidOut - totalPending);

  // Copy Link Handler
  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success('Referral link copied to clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  // Social Share Handlers
  const shareWhatsApp = () => {
    const text = encodeURIComponent(`👋 Hey! I am using Scholars Resort to prepare for JAMB UTME. It has CBT Mocks, Past Questions with full solutions, Literature drills, and AI tutors. Sign up with my link to score 300+: ${referralLink}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const shareTelegram = () => {
    const text = encodeURIComponent(`Prepare for JAMB UTME on Scholars Resort! Score 300+ with CBT Mock Exams & Literature Drills.`);
    window.open(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${text}`, '_blank');
  };

  const shareTwitter = () => {
    const text = encodeURIComponent(`Ace your 2026 JAMB UTME with @ScholarsResort! High-yield CBT past questions, live leaderboards, and instant explanations. Sign up here: ${referralLink}`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
  };

  // Submit Withdrawal Request
  const handleSubmitWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please log in first.');
      return;
    }

    if (availableBalance < config.minWithdrawal) {
      toast.error(`Minimum withdrawal amount is ₦${config.minWithdrawal.toLocaleString()}. You have ₦${availableBalance.toLocaleString()} available.`);
      return;
    }

    if (withdrawAmount > availableBalance) {
      toast.error(`You cannot withdraw more than your available balance of ₦${availableBalance.toLocaleString()}.`);
      return;
    }

    if (withdrawAmount < config.minWithdrawal) {
      toast.error(`Minimum withdrawal is ₦${config.minWithdrawal.toLocaleString()}.`);
      return;
    }

    if (withdrawType === 'bank') {
      if (!accountNumber.trim() || accountNumber.trim().length < 10) {
        toast.error('Please provide a valid 10-digit Nigerian NUBAN account number.');
        return;
      }
      if (!accountName.trim()) {
        toast.error('Please enter the Account Name matching your bank account.');
        return;
      }
    } else {
      if (!airtimePhone.trim() || airtimePhone.trim().length < 11) {
        toast.error('Please enter a valid 11-digit Nigerian phone number for airtime top-up.');
        return;
      }
    }

    setSubmittingWithdrawal(true);

    const newRequest: PayoutRequest = {
      id: `PAYOUT-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      userId: user.id,
      userName: profile?.full_name || 'Student',
      userEmail: user.email || '',
      userPhone: profile?.phone || airtimePhone || '',
      amount: withdrawAmount,
      payoutType: withdrawType,
      bankName: withdrawType === 'bank' ? bankName : undefined,
      accountNumber: withdrawType === 'bank' ? accountNumber.trim() : undefined,
      accountName: withdrawType === 'bank' ? accountName.trim() : undefined,
      airtimeNetwork: withdrawType === 'airtime' ? airtimeNetwork : undefined,
      airtimePhone: withdrawType === 'airtime' ? airtimePhone.trim() : undefined,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    try {
      // 1. Fetch current requests from admin_settings
      const { data: existingRow } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'referral_payout_requests')
        .maybeSingle();

      const existingRequests: PayoutRequest[] = existingRow?.setting_value && Array.isArray(existingRow.setting_value)
        ? existingRow.setting_value
        : [];

      const updatedRequests = [newRequest, ...existingRequests];

      // 2. Save back to admin_settings
      await supabase
        .from('admin_settings')
        .upsert({
          setting_key: 'referral_payout_requests',
          setting_value: updatedRequests,
          updated_at: new Date().toISOString()
        });

      // Update local state and cache
      setPayoutRequests(prev => [newRequest, ...prev]);
      localStorage.setItem(`scholar_payouts_${user.id}`, JSON.stringify([newRequest, ...payoutRequests]));

      toast.success('🎉 Payout request submitted successfully! Admin will disburse your funds within 24-48 hours.');
      setIsWithdrawModalOpen(false);
    } catch (err: any) {
      toast.error(`Failed to submit request: ${err.message || 'Please try again.'}`);
    } finally {
      setSubmittingWithdrawal(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 border border-emerald-500/20 p-6 md:p-8 text-white shadow-xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider border border-emerald-500/30">
              <Gift className="w-3.5 h-3.5" /> Refer & Earn Real Cash
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white">
              {config.programTitle}
            </h1>
            <p className="text-sm md:text-base text-slate-300">
              Invite your friends and classmates preparing for JAMB UTME. Earn <strong className="text-emerald-400 font-bold">₦{config.rewardPerPaid.toLocaleString()} cash</strong> for every friend who activates full lifetime access.
            </p>
          </div>

          <div className="bg-slate-900/80 border border-emerald-500/30 rounded-xl p-4 text-center md:text-right shrink-0 w-full md:w-auto shadow-inner">
            <p className="text-xs font-semibold text-slate-400">Available Withdrawable Balance</p>
            <p className="text-2xl sm:text-3xl font-black text-emerald-400 mt-0.5">
              ₦{availableBalance.toLocaleString()}
            </p>
            <Button
              onClick={() => {
                setWithdrawAmount(availableBalance >= config.minWithdrawal ? availableBalance : config.minWithdrawal);
                setIsWithdrawModalOpen(true);
              }}
              disabled={availableBalance < config.minWithdrawal}
              className="mt-2.5 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md"
            >
              <ArrowUpRight className="w-4 h-4 mr-1" /> Withdraw Funds
            </Button>
            {availableBalance < config.minWithdrawal && (
              <p className="text-[10px] text-slate-400 mt-1">
                Min. withdrawal: ₦{config.minWithdrawal.toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Referral Link & Share Tools Card */}
      <Card className="border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Share2 className="w-5 h-5 text-primary" /> Your Unique Referral Link
          </CardTitle>
          <CardDescription>
            Share this link across WhatsApp groups, Facebook, Telegram, and TikTok. Anyone who registers with your link is linked to your rewards account forever.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <Input
                readOnly
                value={referralLink}
                className="font-mono text-xs sm:text-sm bg-muted/50 border-input pr-10 select-all"
              />
            </div>
            <Button
              onClick={handleCopy}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shrink-0 gap-1.5"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy Link'}
            </Button>
          </div>

          {/* 1-Click Social Shares */}
          <div className="pt-2 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-muted-foreground mr-1">1-Click Share:</span>
            <Button
              size="sm"
              onClick={shareWhatsApp}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold gap-1.5 h-8"
            >
              <Send className="w-3.5 h-3.5" /> Share on WhatsApp
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={shareTelegram}
              className="text-xs font-bold gap-1.5 h-8"
            >
              <Send className="w-3.5 h-3.5 text-sky-500" /> Telegram
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={shareTwitter}
              className="text-xs font-bold gap-1.5 h-8"
            >
              <Share2 className="w-3.5 h-3.5 text-slate-400" /> X (Twitter)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 4 Statistics Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Total Friends Invited</p>
          <p className="text-2xl font-black text-foreground mt-1 flex items-center gap-1.5">
            <Users className="w-5 h-5 text-blue-500" /> {totalReferred}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Signed up with your link</p>
        </Card>

        <Card className="border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Activated / Paid</p>
          <p className="text-2xl font-black text-emerald-500 mt-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-5 h-5" /> {convertedCount}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Earned ₦{config.rewardPerPaid}/friend</p>
        </Card>

        <Card className="border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Total Lifetime Earnings</p>
          <p className="text-2xl font-black text-foreground mt-1 flex items-center gap-1.5">
            <DollarSign className="w-5 h-5 text-amber-500" /> ₦{totalEarned.toLocaleString()}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Gross commission earned</p>
        </Card>

        <Card className="border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Total Paid Out to You</p>
          <p className="text-2xl font-black text-primary mt-1 flex items-center gap-1.5">
            <Building2 className="w-5 h-5" /> ₦{totalPaidOut.toLocaleString()}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{payoutRequests.filter(r => r.status === 'approved').length} Disbursed Payouts</p>
        </Card>
      </div>

      {/* How it Works 3-Step Guide */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-primary" /> How the Referral System Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">
                1
              </div>
              <h4 className="font-bold text-sm text-foreground">Share Your Link</h4>
              <p className="text-xs text-muted-foreground">
                Copy your personalized referral link or share directly to your school, church, or UTME study WhatsApp groups.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 font-bold flex items-center justify-center text-sm">
                2
              </div>
              <h4 className="font-bold text-sm text-foreground">Friend Activates Account</h4>
              <p className="text-xs text-muted-foreground">
                When your friend registers and activates full lifetime access (₦3,000), your commission of ₦{config.rewardPerPaid.toLocaleString()} is instantly credited.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
              <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-600 font-bold flex items-center justify-center text-sm">
                3
              </div>
              <h4 className="font-bold text-sm text-foreground">Direct Bank / Airtime Payout</h4>
              <p className="text-xs text-muted-foreground">
                Request a withdrawal anytime your balance reaches ₦{config.minWithdrawal.toLocaleString()}. Receive money straight to your Moniepoint, OPay, PalmPay, Kuda, or Bank!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2 Columns: Recent Referrals & Withdrawal History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Referrals List */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Your Referral History ({referralsList.length})
            </CardTitle>
            <CardDescription className="text-xs">
              List of candidates who registered via your referral link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {referralsList.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground space-y-2">
                <Users className="w-8 h-8 mx-auto opacity-40" />
                <p className="text-xs">You have not referred any students yet.</p>
                <p className="text-[11px] text-muted-foreground">Share your link to earn ₦{config.rewardPerPaid.toLocaleString()} per friend!</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                {referralsList.map((ref, idx) => (
                  <div key={ref.id || idx} className="p-3 rounded-lg border border-border bg-muted/10 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-foreground">{ref.name}</p>
                      <p className="text-[11px] text-muted-foreground">{ref.email} • {new Date(ref.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        ref.converted ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'
                      }`}>
                        {ref.converted ? `Paid (+₦${config.rewardPerPaid})` : 'Free / Pending'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Withdrawal Payout Requests */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> Payout & Withdrawal History
            </CardTitle>
            <CardDescription className="text-xs">
              Status of your cash disbursements and bank transfers.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {payoutRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground space-y-2">
                <Building2 className="w-8 h-8 mx-auto opacity-40" />
                <p className="text-xs">No withdrawal requests submitted yet.</p>
                <p className="text-[11px] text-muted-foreground">Earn at least ₦{config.minWithdrawal.toLocaleString()} to request your first bank transfer!</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                {payoutRequests.map((req) => (
                  <div key={req.id} className="p-3 rounded-lg border border-border bg-muted/10 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-foreground">₦{req.amount.toLocaleString()} ({req.payoutType === 'bank' ? req.bankName : `${req.airtimeNetwork} Airtime`})</p>
                      <p className="text-[11px] text-muted-foreground">
                        {req.payoutType === 'bank' ? `${req.accountNumber} - ${req.accountName}` : req.airtimePhone} • {new Date(req.created_at).toLocaleDateString()}
                      </p>
                      {req.adminNote && (
                        <p className="text-[10px] text-primary font-medium mt-0.5">Note: {req.adminNote}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        req.status === 'approved' 
                          ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                          : req.status === 'rejected'
                          ? 'bg-red-500/20 text-red-600 dark:text-red-400'
                          : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                      }`}>
                        {req.status === 'approved' ? 'Disbursed' : req.status === 'rejected' ? 'Rejected' : 'Processing'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payout Withdrawal Modal */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-500" /> Request Referral Cash Withdrawal
              </h3>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsWithdrawModalOpen(false)}>
                ✕
              </Button>
            </div>

            <form onSubmit={handleSubmitWithdrawal} className="space-y-4">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs space-y-1">
                <p className="font-bold text-emerald-600 dark:text-emerald-400">Available Balance: ₦{availableBalance.toLocaleString()}</p>
                <p className="text-muted-foreground">Minimum Withdrawal: ₦{config.minWithdrawal.toLocaleString()}</p>
              </div>

              {/* Amount */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Withdrawal Amount (₦) *</Label>
                <Input
                  type="number"
                  min={config.minWithdrawal}
                  max={availableBalance}
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(Number(e.target.value))}
                  className="font-bold text-sm"
                  required
                />
              </div>

              {/* Payout Method */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Payout Method</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setWithdrawType('bank')}
                    className={`p-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 ${
                      withdrawType === 'bank' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'
                    }`}
                  >
                    <Building2 className="w-4 h-4" /> Bank Transfer
                  </button>
                  <button
                    type="button"
                    onClick={() => setWithdrawType('airtime')}
                    className={`p-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 ${
                      withdrawType === 'airtime' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'
                    }`}
                  >
                    <Smartphone className="w-4 h-4" /> Airtime Top-Up
                  </button>
                </div>
              </div>

              {/* Bank Details */}
              {withdrawType === 'bank' ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">Bank Name *</Label>
                    <select
                      value={bankName}
                      onChange={e => setBankName(e.target.value)}
                      className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 font-medium"
                    >
                      <option value="Moniepoint MCB">Moniepoint Microfinance Bank</option>
                      <option value="OPay">OPay (Paycom)</option>
                      <option value="PalmPay">PalmPay</option>
                      <option value="Kuda Bank">Kuda Microfinance Bank</option>
                      <option value="GTBank">Guaranty Trust Bank (GTBank)</option>
                      <option value="Zenith Bank">Zenith Bank</option>
                      <option value="Access Bank">Access Bank</option>
                      <option value="United Bank for Africa (UBA)">United Bank for Africa (UBA)</option>
                      <option value="First Bank of Nigeria">First Bank of Nigeria</option>
                      <option value="Fidelity Bank">Fidelity Bank</option>
                      <option value="Stanbic IBTC">Stanbic IBTC</option>
                      <option value="Union Bank">Union Bank</option>
                      <option value="Wema Bank / ALAT">Wema Bank / ALAT</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold">10-Digit Account Number *</Label>
                      <Input
                        placeholder="0123456789"
                        value={accountNumber}
                        maxLength={10}
                        onChange={e => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                        className="text-xs font-mono font-bold"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-bold">Account Name *</Label>
                      <Input
                        placeholder="e.g. Adebayo Chukwuma"
                        value={accountName}
                        onChange={e => setAccountName(e.target.value)}
                        className="text-xs"
                        required
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">Mobile Network Provider *</Label>
                    <select
                      value={airtimeNetwork}
                      onChange={e => setAirtimeNetwork(e.target.value)}
                      className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 font-medium"
                    >
                      <option value="MTN">MTN Nigeria</option>
                      <option value="Airtel">Airtel Nigeria</option>
                      <option value="Glo">Glo (Globacom)</option>
                      <option value="9mobile">9mobile</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold">Recipient Phone Number *</Label>
                    <Input
                      placeholder="08012345678"
                      value={airtimePhone}
                      maxLength={11}
                      onChange={e => setAirtimePhone(e.target.value.replace(/\D/g, ''))}
                      className="text-xs font-mono"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsWithdrawModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={submittingWithdrawal} className="bg-emerald-600 hover:bg-emerald-500 font-bold text-white">
                  {submittingWithdrawal ? 'Submitting...' : 'Submit Withdrawal Request'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Referrals;
