import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Camera, Download, Trash2, Search, Eye, AlertCircle, 
  CheckCircle2, XCircle, Clock, Smartphone, HardDrive, 
  Wifi, HelpCircle, FileJson, RefreshCw, Flag, User, ExternalLink
} from 'lucide-react';
import { CbtSnapshotService } from '@/services/cbtSnapshotService';
import type { CbtSessionSnapshot } from '@/services/cbtSnapshotService';
import { toast } from 'sonner';

export const CbtSessionSnapshotViewer: React.FC = () => {
  const [snapshots, setSnapshots] = useState<CbtSessionSnapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<CbtSessionSnapshot | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const loadSnapshots = async () => {
    setLoading(true);
    try {
      const data = await CbtSnapshotService.fetchAllSnapshots();
      setSnapshots(data);
      if (data.length > 0 && !selectedSnapshot) {
        setSelectedSnapshot(data[0]);
      }
    } catch (e) {
      console.error('Error loading snapshots:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSnapshots();
  }, []);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this CBT session snapshot?')) {
      CbtSnapshotService.deleteSnapshot(id);
      setSnapshots(prev => prev.filter(s => s.id !== id));
      if (selectedSnapshot?.id === id) {
        setSelectedSnapshot(null);
      }
      toast.success('Snapshot deleted');
    }
  };

  const handleExport = (snap: CbtSessionSnapshot, e: React.MouseEvent) => {
    e.stopPropagation();
    CbtSnapshotService.exportAsJSON(snap);
    toast.success('Downloaded snapshot JSON file');
  };

  const filteredSnapshots = snapshots.filter(s => {
    const matchesSearch = 
      s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.sessionTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.subjectName && s.subjectName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesMode = filterMode === 'all' || s.examMode.toLowerCase() === filterMode.toLowerCase();
    return matchesSearch && matchesMode;
  });

  return (
    <Card className="border border-border/80 bg-card shadow-md text-card-foreground overflow-hidden">
      <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-500">
                <Camera className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg font-bold font-display flex items-center gap-2">
                  CBT Session Snapshot Inspector
                  <Badge variant="outline" className="bg-sky-500/10 text-sky-500 border-sky-500/30 text-[10px]">
                    {snapshots.length} Snapshots
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Inspect exact state, questions, answers, and telemetry captured during live CBT sessions
                </CardDescription>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadSnapshots}
              disabled={loading}
              className="h-8 text-xs gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
          </div>
        </div>

        {/* Filter / Search Bar */}
        <div className="flex flex-col sm:flex-row gap-2 pt-3">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search snapshots by ID, user email, or subject..."
              className="pl-8 h-8 text-xs bg-muted/40"
            />
          </div>
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {['all', 'mock', 'subject', 'topic', 'speed'].map(mode => (
              <Button
                key={mode}
                size="sm"
                variant={filterMode === mode ? 'default' : 'outline'}
                onClick={() => setFilterMode(mode)}
                className="h-8 text-xs capitalize px-2.5 shrink-0"
              >
                {mode}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5">
        {snapshots.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-xl bg-muted/20 space-y-3">
            <Camera className="w-10 h-10 text-muted-foreground/50 mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">No Session Snapshots Yet</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Admins and testers can click the floating <strong>"📸 Take Snapshot"</strong> button in any CBT Exam or Practice session to capture 100% of the active state for reproduction.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Snapshots List (4 cols on desktop, 12 on mobile) */}
            <div className="lg:col-span-5 space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
              {filteredSnapshots.map((snap) => {
                const isSelected = selectedSnapshot?.id === snap.id;
                const answersCount = Object.keys(snap.answers || {}).length;

                return (
                  <div
                    key={snap.id}
                    onClick={() => setSelectedSnapshot(snap)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer text-left space-y-2 ${
                      isSelected
                        ? 'bg-primary/5 border-primary shadow-sm'
                        : 'bg-muted/30 border-border hover:bg-muted/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-xs text-foreground">
                            {snap.id}
                          </span>
                          <Badge variant="outline" className="text-[9px] uppercase px-1.5 py-0">
                            {snap.examMode}
                          </Badge>
                        </div>
                        <p className="text-xs font-semibold text-foreground mt-0.5 truncate max-w-[200px]">
                          {snap.sessionTitle}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => handleExport(snap, e)}
                          title="Export JSON"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => handleDelete(snap.id, e)}
                          title="Delete Snapshot"
                          className="h-7 w-7 text-red-500 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" /> {snap.user.email}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {new Date(snap.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="font-mono text-[10px] text-primary">
                        {answersCount}/{snap.totalQuestions} Answered
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Snapshot Inspector View (7 cols on desktop) */}
            <div className="lg:col-span-7 border border-border rounded-xl bg-muted/20 p-4 space-y-4 max-h-[580px] overflow-y-auto">
              {selectedSnapshot ? (
                <div className="space-y-4">
                  {/* Header & Meta */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/60">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-primary">
                          {selectedSnapshot.id}
                        </span>
                        <Badge variant="outline" className="text-xs font-bold uppercase">
                          {selectedSnapshot.examMode}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Captured {new Date(selectedSnapshot.createdAt).toLocaleString()}
                      </p>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => handleExport(selectedSnapshot, e)}
                      className="h-8 text-xs gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" /> Export Diagnostic JSON
                    </Button>
                  </div>

                  {/* Telemetry Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="p-2.5 rounded-lg bg-card border border-border text-center">
                      <div className="text-[10px] text-muted-foreground uppercase font-bold">Progress</div>
                      <div className="text-sm font-bold font-mono text-foreground mt-0.5">
                        {Object.keys(selectedSnapshot.answers || {}).length} / {selectedSnapshot.totalQuestions} Q
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-card border border-border text-center">
                      <div className="text-[10px] text-muted-foreground uppercase font-bold">Time Spent</div>
                      <div className="text-sm font-bold font-mono text-foreground mt-0.5">
                        {Math.floor(selectedSnapshot.timeSpentSeconds / 60)}m {selectedSnapshot.timeSpentSeconds % 60}s
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-card border border-border text-center">
                      <div className="text-[10px] text-muted-foreground uppercase font-bold">Memory Heap</div>
                      <div className="text-sm font-bold font-mono text-sky-500 mt-0.5">
                        {selectedSnapshot.deviceTelemetry.memoryHeapMB || 50} MB
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-card border border-border text-center">
                      <div className="text-[10px] text-muted-foreground uppercase font-bold">Ping Latency</div>
                      <div className="text-sm font-bold font-mono text-emerald-500 mt-0.5">
                        {selectedSnapshot.deviceTelemetry.networkLatencyMs || 45} ms
                      </div>
                    </div>
                  </div>

                  {/* Device Info */}
                  <div className="p-3 rounded-lg bg-card border border-border/70 text-xs space-y-1.5">
                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-primary" /> Candidate Device Environment
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-muted-foreground">
                      <div>Screen: <span className="font-mono text-foreground">{selectedSnapshot.deviceTelemetry.screenWidth}x{selectedSnapshot.deviceTelemetry.screenHeight}</span></div>
                      <div>Touch Device: <span className="font-mono text-foreground">{selectedSnapshot.deviceTelemetry.isTouchDevice ? 'Yes' : 'No'}</span></div>
                      <div>User: <span className="font-mono text-foreground">{selectedSnapshot.user.name} ({selectedSnapshot.user.email})</span></div>
                      <div>Active Q Index: <span className="font-mono text-foreground">#{selectedSnapshot.currentQuestionIndex + 1}</span></div>
                    </div>
                  </div>

                  {/* Questions & Candidate Answers Inspection */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between text-xs font-bold text-foreground">
                      <span>Questions & Candidate Responses ({selectedSnapshot.questions.length})</span>
                      <span className="text-muted-foreground font-normal text-[11px]">
                        {selectedSnapshot.flaggedIndices.length} Flagged
                      </span>
                    </div>

                    <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                      {selectedSnapshot.questions.map((q, qIndex) => {
                        const candidateAnswer = selectedSnapshot.answers[q.id] || selectedSnapshot.answers[qIndex.toString()];
                        const isFlagged = selectedSnapshot.flaggedIndices.includes(qIndex);
                        const isCorrect = candidateAnswer && q.correctOption && candidateAnswer.toLowerCase() === q.correctOption.toLowerCase();

                        return (
                          <div key={q.id || qIndex} className="p-3 rounded-lg bg-card border border-border/80 text-xs space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-bold font-mono text-primary">
                                  Q{qIndex + 1}.
                                </span>
                                <Badge variant="outline" className="text-[9px]">
                                  {q.subject}
                                </Badge>
                                {isFlagged && (
                                  <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-[9px]">
                                    <Flag className="w-2.5 h-2.5 mr-0.5" /> Flagged
                                  </Badge>
                                )}
                              </div>

                              <div>
                                {candidateAnswer ? (
                                  <Badge className={`text-[10px] ${isCorrect ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30' : 'bg-red-500/20 text-red-500 border-red-500/30'}`}>
                                    Answered: {candidateAnswer.toUpperCase()}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-muted-foreground text-[10px]">
                                    Unanswered
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <p className="text-foreground text-xs leading-relaxed">
                              {q.questionText}
                            </p>

                            {/* Options List */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] pt-1">
                              {Object.entries(q.options || {}).map(([optKey, optVal]) => {
                                const isCandidatePick = candidateAnswer?.toLowerCase() === optKey.toLowerCase();
                                const isCorrectPick = q.correctOption?.toLowerCase() === optKey.toLowerCase();

                                return (
                                  <div
                                    key={optKey}
                                    className={`p-1.5 rounded border flex items-center gap-1.5 ${
                                      isCandidatePick && isCorrectPick
                                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-semibold'
                                        : isCandidatePick
                                        ? 'bg-red-500/10 border-red-500/40 text-red-700 dark:text-red-300 font-semibold'
                                        : isCorrectPick
                                        ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                                        : 'border-border/50 text-muted-foreground'
                                    }`}
                                  >
                                    <span className="font-bold uppercase font-mono">{optKey}:</span>
                                    <span className="truncate">{String(optVal || '')}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="text-center py-16 text-muted-foreground text-xs">
                  Select a snapshot on the left to inspect full session details.
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
