import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Zap, WifiOff, RefreshCw, Quote, ShieldCheck, Battery, Gauge, BookOpen, ExternalLink } from 'lucide-react';
import { useDailyMotivation } from '@/hooks/useDailyMotivation';
import { OfflineAdvantagesModal } from './OfflineAdvantagesModal';

export const MotivationEngine = () => {
  const { motivation, loading, isOnline, generateNewMotivation } = useDailyMotivation();
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [showBenefitsAccordion, setShowBenefitsAccordion] = useState(false);

  return (
    <>
      <Card className="bg-card text-card-foreground border-border shadow-md overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-emerald-500 to-amber-500" />

        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                  Scholars Motivation & Mindset Engine
                  {isOnline ? (
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                      <Zap className="w-3 h-3 mr-1" /> Live AI
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
                      <WifiOff className="w-3 h-3 mr-1" /> Offline Active
                    </Badge>
                  )}
                </CardTitle>
              </div>
            </div>

            <Button
              size="sm"
              variant="ghost"
              onClick={generateNewMotivation}
              disabled={loading}
              className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary' : ''}`} />
              {loading ? 'Inspiring...' : 'New Quote'}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Quote Display Area */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border relative">
            <Quote className="w-8 h-8 text-primary/15 absolute top-3 left-3 pointer-events-none" />
            <div className="relative z-10 pl-6 space-y-2">
              <p className="text-sm font-medium italic text-foreground leading-relaxed">
                "{motivation.quote}"
              </p>
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
                <span className="font-semibold text-primary">— {motivation.author}</span>
                <Badge variant="secondary" className="text-[10px]">
                  {motivation.focus}
                </Badge>
              </div>
            </div>
          </div>

          {/* Offline CBT Benefits Toggle & Full Modal Launcher */}
          <div className="pt-1 space-y-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBenefitsAccordion(!showBenefitsAccordion)}
                className="flex-1 text-xs justify-between bg-background border-border hover:bg-muted/50"
              >
                <span className="flex items-center gap-2 text-foreground font-medium">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  Offline Advantages
                </span>
                <Badge variant="secondary" className="text-[10px] font-mono">
                  {showBenefitsAccordion ? 'Hide' : 'Quick View'}
                </Badge>
              </Button>

              <Button
                variant="default"
                size="sm"
                onClick={() => setShowOfflineModal(true)}
                className="text-xs gap-1.5 bg-primary text-primary-foreground font-medium shadow-sm shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Full Guide
              </Button>
            </div>

            {showBenefitsAccordion && (
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2.5 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <Battery className="w-3.5 h-3.5 text-amber-500" />
                    1. Save 40% Phone Battery
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Offline operation shuts antenna power during 2-hour exam sessions.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <WifiOff className="w-3.5 h-3.5 text-emerald-500" />
                    2. Zero Data Charges
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Answer thousands of UTME CBT questions without burning data bundles.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <Gauge className="w-3.5 h-3.5 text-blue-500" />
                    3. Millisecond Speed
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Instant question rendering with zero network latency or spinners.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <BookOpen className="w-3.5 h-3.5 text-purple-500" />
                    4. Auto Progress Sync
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Scores sync automatically to leaderboards as soon as internet returns.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Full Offline Advantages & User Guide Modal */}
      <OfflineAdvantagesModal
        open={showOfflineModal}
        onOpenChange={setShowOfflineModal}
      />
    </>
  );
};
