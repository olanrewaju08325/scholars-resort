import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  WifiOff,
  Battery,
  Zap,
  Download,
  BookOpen,
  CheckCircle2,
  HardDrive,
  Sparkles,
  Smartphone,
  ShieldCheck,
  RefreshCw,
  HelpCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface OfflineAdvantagesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const OfflineAdvantagesModal = ({ open, onOpenChange }: OfflineAdvantagesModalProps) => {
  const navigate = useNavigate();
  const [downloadingPack, setDownloadingPack] = useState(false);

  const handleDownloadStudyPacks = () => {
    setDownloadingPack(true);
    toast.info("Opening Scholars Offline Study Packs Library...");
    setTimeout(() => {
      setDownloadingPack(false);
      onOpenChange(false);
      navigate('/library');
    }, 600);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-card text-card-foreground border-border shadow-2xl p-6 rounded-2xl">
        <DialogHeader className="space-y-2 border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <WifiOff className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                Scholars Resort Offline Mode & Guide
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs">
                  Zero Data Required
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Learn how to study without internet, save mobile data, boost phone battery life, and prepare seamlessly anywhere.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="benefits" className="mt-4 space-y-4">
          <TabsList className="grid grid-cols-2 bg-muted p-1 rounded-xl">
            <TabsTrigger value="benefits" className="text-xs font-semibold rounded-lg data-[state=active]:bg-background data-[state=active]:shadow">
              <Zap className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
              4 Core Advantages
            </TabsTrigger>
            <TabsTrigger value="guide" className="text-xs font-semibold rounded-lg data-[state=active]:bg-background data-[state=active]:shadow">
              <HelpCircle className="w-3.5 h-3.5 mr-1.5 text-primary" />
              Non-Technical Guide
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: ADVANTAGES */}
          <TabsContent value="benefits" className="space-y-4 mt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <WifiOff className="w-4 h-4" />
                  </div>
                  1. 100% Free Data Study
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Once your subject packs are saved, you can answer thousands of UTME CBT questions without burning a single megabyte of mobile data.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Battery className="w-4 h-4" />
                  </div>
                  2. Maximum Battery Saving
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  By operating offline, your mobile antenna goes dormant, preserving up to 40% more battery during intensive 2-hour mock exam practice sessions.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <Zap className="w-4 h-4" />
                  </div>
                  3. Zero Distractions Focus
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  No popup notifications, chat alerts, or social media interruptions. Practice with 100% exam-level concentration.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <HardDrive className="w-4 h-4" />
                  </div>
                  4. Instant Speed & Local Storage
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Questions load instantaneously with zero network lag or buffer spinners. Score evaluations and explanations render in milliseconds.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="space-y-0.5 text-center sm:text-left">
                <h4 className="text-sm font-bold text-foreground flex items-center justify-center sm:justify-start gap-1.5">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Ready to Download Your Offline Subject Packs?
                </h4>
                <p className="text-xs text-muted-foreground">
                  Pre-load full subjects, novelty summaries, and formula flashcards in one click.
                </p>
              </div>
              <Button
                onClick={handleDownloadStudyPacks}
                disabled={downloadingPack}
                className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs px-4 py-2 gap-2 shadow-md shrink-0"
              >
                <Download className="w-4 h-4" />
                {downloadingPack ? 'Opening Library...' : 'Download Study Packs'}
              </Button>
            </div>
          </TabsContent>

          {/* TAB 2: NON-TECHNICAL USER GUIDE */}
          <TabsContent value="guide" className="space-y-4 mt-2">
            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                  1
                </div>
                <div className="space-y-1">
                  <h5 className="font-bold text-foreground text-sm">Download Subject Packs While Connected</h5>
                  <p className="text-muted-foreground leading-relaxed">
                    When you have Wi-Fi or internet data, visit the <span className="font-semibold text-foreground">Library</span> tab and tap <span className="font-semibold text-foreground">"Download Offline Pack"</span>. This saves all subject questions directly to your phone or laptop.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/40 border border-border flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                  2
                </div>
                <div className="space-y-1">
                  <h5 className="font-bold text-foreground text-sm">Turn Off Data or Switch to Airplane Mode</h5>
                  <p className="text-muted-foreground leading-relaxed">
                    Feel free to switch off your phone's cellular data or enable Airplane Mode. Open Scholars Resort anytime — the app will load smoothly without requiring any login check or internet connection.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/40 border border-border flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                  3
                </div>
                <div className="space-y-1">
                  <h5 className="font-bold text-foreground text-sm">Practice Full CBT Mocks & Topic Drills</h5>
                  <p className="text-muted-foreground leading-relaxed">
                    Launch any Practice Mode or Full CBT Mock Exam. Answer questions, use the on-screen CBT calculator, view immediate topic explanations, and submit your exam.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/40 border border-border flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                  4
                </div>
                <div className="space-y-1">
                  <h5 className="font-bold text-foreground text-sm">Automatic Background Syncing When Reconnected</h5>
                  <p className="text-muted-foreground leading-relaxed">
                    Your offline scores, streaks, and XP points are securely stored on your device. The moment you reconnect to the internet, your progress automatically syncs with the national leaderboard.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>100% Scholars Resort Offline Engine Guarantee: No lost scores, no data charges!</span>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="pt-2 border-t border-border mt-4 flex justify-between items-center">
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Smartphone className="w-3.5 h-3.5 text-primary" />
            Optimized for Mobile, Tablet & Desktop
          </p>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
