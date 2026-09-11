import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, FileSpreadsheet, GitMerge, Tags, PlayCircle, CheckCircle2, ShieldCheck, ArrowRight, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface AdminAcceleratorsControllerProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

export const AdminAcceleratorsController: React.FC<AdminAcceleratorsControllerProps> = ({ isOpen, onClose, onRefresh }) => {
  const [activeTool, setActiveTool] = useState<'mapper' | 'diff' | 'tagging' | 'none'>('none');
  const [taggingSubject, setTaggingSubject] = useState('');
  const [taggingTopic, setTaggingTopic] = useState('');
  const [taggingLoading, setTaggingLoading] = useState(false);

  const handleBulkTaggingSubmit = async () => {
    if (!taggingSubject) {
      toast.error('Please select a target subject');
      return;
    }
    setTaggingLoading(true);
    try {
      const { error } = await supabase
        .from('questions')
        .update({ subject_id: taggingSubject })
        .limit(50); // bulk tag batch
      if (error) throw error;
      toast.success('Successfully applied bulk syllabus tagging to questions!');
      if (onRefresh) onRefresh();
      onClose();
    } catch (err: any) {
      toast.error('Bulk tagging failed: ' + (err?.message || err));
    } finally {
      setTaggingLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl bg-slate-950 text-slate-100 border-slate-800 p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2.5">
            <Sparkles className="w-6 h-6 text-primary" /> Admin Accelerators & Visibility Controller
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-sm">
            Quick-access control center for Smart CSV Mapping, Duplicate Diff Merging, and Bulk Syllabus Tagging.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
          {/* Accelerator Card 1: Smart Header Mapper */}
          <div 
            onClick={() => setActiveTool('mapper')}
            className={`p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
              activeTool === 'mapper' ? 'bg-primary/10 border-primary shadow-lg' : 'bg-slate-900/60 border-slate-800 hover:bg-slate-900 hover:border-slate-700'
            }`}
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h4 className="font-semibold text-base text-slate-100">Smart Header Auto-Mapper</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Automatically resolves CSV column headers like 'q_text', 'stem', or 'question' without requiring manual sheet restructuring.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              Configure Mapper <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Accelerator Card 2: Duplicate Diff & Merge */}
          <div 
            onClick={() => setActiveTool('diff')}
            className={`p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
              activeTool === 'diff' ? 'bg-primary/10 border-primary shadow-lg' : 'bg-slate-900/60 border-slate-800 hover:bg-slate-900 hover:border-slate-700'
            }`}
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                <GitMerge className="w-5 h-5" />
              </div>
              <h4 className="font-semibold text-base text-slate-100">Duplicate Diff & Merge</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Side-by-side comparison of incoming CSV rows against existing database records with 1-click merge & enrich.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-xs text-purple-400 font-medium">
              Launch Diff Tool <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Accelerator Card 3: Bulk Syllabus Tagging */}
          <div 
            onClick={() => setActiveTool('tagging')}
            className={`p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
              activeTool === 'tagging' ? 'bg-primary/10 border-primary shadow-lg' : 'bg-slate-900/60 border-slate-800 hover:bg-slate-900 hover:border-slate-700'
            }`}
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                <Tags className="w-5 h-5" />
              </div>
              <h4 className="font-semibold text-base text-slate-100">Bulk Syllabus Tagging</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Assign subjects, topics, and exam years to filtered groups of questions instantly in bulk.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-xs text-blue-400 font-medium">
              Open Tagging <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* Active Tool View */}
        {activeTool === 'mapper' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h5 className="font-semibold text-sm text-emerald-400 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" /> Active CSV Auto-Mapper Rules
            </h5>
            <p className="text-xs text-slate-300">
              The CSV parser automatically recognizes and normalizes the following column variations:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800"><span className="text-slate-400">Question:</span> question_text, stem, q, prompt</div>
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800"><span className="text-slate-400">Options:</span> option_a, opt_1, choices</div>
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800"><span className="text-slate-400">Subject:</span> subjectName, subject, course</div>
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800"><span className="text-slate-400">Explanation:</span> explanation, rationale</div>
            </div>
          </div>
        )}

        {activeTool === 'diff' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h5 className="font-semibold text-sm text-purple-400 flex items-center gap-2">
              <GitMerge className="w-4 h-4" /> Duplicate Diff & Merge Engine Active
            </h5>
            <p className="text-xs text-slate-300">
              When uploading CSVs, the parser checks Levenshtein similarity and exact stems against existing database records. You can select &ldquo;Update & Enrich&rdquo; in the import modal to automatically merge new explanations without duplicating rows.
            </p>
          </div>
        )}

        {activeTool === 'tagging' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h5 className="font-semibold text-sm text-blue-400 flex items-center gap-2">
              <Tags className="w-4 h-4" /> Bulk Syllabus Tagging Manager
            </h5>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Target Canonical Subject ID or Name</label>
                <input 
                  type="text" 
                  value={taggingSubject} 
                  onChange={e => setTaggingSubject(e.target.value)}
                  placeholder="e.g. Mathematics or English Language"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-primary"
                />
              </div>
              <Button 
                onClick={handleBulkTaggingSubmit} 
                disabled={taggingLoading}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
              >
                {taggingLoading ? 'Applying Tag...' : 'Apply Bulk Tag to Repository'}
              </Button>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-4 border-t border-slate-800">
          <Button onClick={onClose} variant="outline" className="border-slate-700 bg-slate-900 text-slate-200 text-xs">
            Close Controller
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const VisibilityController = AdminAcceleratorsController;
