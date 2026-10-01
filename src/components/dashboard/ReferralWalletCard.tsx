import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Gift, Copy, Check, Send, ArrowUpRight, Users, Sparkles, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

interface ReferralWalletCardProps {
  profile: any;
}

export const ReferralWalletCard = ({ profile }: ReferralWalletCardProps) => {
  const [copied, setCopied] = useState(false);

  const rawBalance = Number(profile?.referral_balance ?? profile?.wallet_balance ?? 0);
  const balance = Math.max(0, isNaN(rawBalance) ? 0 : rawBalance);

  const referralCode = profile?.referral_code || `SR-${(profile?.full_name || 'STUDENT').substring(0, 4).toUpperCase()}-${(profile?.id || '0000').substring(0, 4).toUpperCase()}`;
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://scholarsresort.com';
  const referralLink = `${origin}/signup?ref=${referralCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success('Referral link copied to clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(
      `👋 Hey! I am using Scholars Resort to prepare for JAMB UTME. It has CBT Mocks, Past Questions with full solutions, Literature drills, and AI tutors. Sign up with my link to score 300+: ${referralLink}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  return (
    <Card className="border-border bg-gradient-to-br from-card via-card to-primary/5 shadow-sm overflow-hidden relative">
      <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
      
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Left section: Balance & Program info */}
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <Gift className="w-3 h-3" /> Refer & Earn (₦500 / Friend)
              </span>
              {balance > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  <Sparkles className="w-2.5 h-2.5" /> Withdrawable
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold font-display text-foreground tracking-tight flex items-center gap-1.5">
                <Wallet className="w-6 h-6 text-emerald-500 shrink-0" />
                ₦{balance.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                Referral Wallet Balance
              </span>
            </div>

            <p className="text-xs text-muted-foreground max-w-md">
              Invite your classmates & UTME study buddies. Earn <strong className="text-emerald-600 dark:text-emerald-400 font-bold">₦500 cash</strong> instantly for every candidate who activates their account.
            </p>
          </div>

          {/* Right section: Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <Button asChild size="sm" className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs">
              <Link to="/referrals">
                <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
                Withdraw / Details
              </Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={shareWhatsApp}
              className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 font-bold text-xs gap-1"
            >
              <Send className="w-3 h-3" /> WhatsApp
            </Button>
          </div>
        </div>

        {/* Quick Link bar */}
        <div className="mt-4 pt-3 border-t border-border/60 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0 font-medium">
            <Users className="w-3.5 h-3.5 text-primary" />
            <span>Your Link:</span>
          </div>
          <div className="relative flex-1">
            <Input
              readOnly
              value={referralLink}
              className="h-8 text-xs font-mono bg-muted/40 border-border select-all pr-8"
            />
          </div>
          <Button
            size="sm"
            onClick={handleCopy}
            variant="secondary"
            className="h-8 text-xs font-bold shrink-0 gap-1"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy Link'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
