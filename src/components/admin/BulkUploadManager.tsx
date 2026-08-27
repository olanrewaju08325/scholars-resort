import React, { useState, useRef } from 'react';
import { 
  Upload, FileText, CheckCircle2, AlertCircle, RefreshCw, X, Play, 
  Layers, FolderUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { uploadMaterialFile } from '@/services/fileUploadService';

export interface SubjectItem {
  id: string;
  name: string;
}

export interface BulkUploadItem {
  id: string;
  file: File;
  title: string;
  subjectId: string;
  isPremium: boolean;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  statusText?: string;
  error?: string;
  usedBucket?: string;
}

interface BulkUploadManagerProps {
  subjects: SubjectItem[];
  defaultSubjectId?: string;
  onUploadComplete?: () => void;
}

export const BulkUploadManager: React.FC<BulkUploadManagerProps> = ({
  subjects,
  defaultSubjectId = '',
  onUploadComplete
}) => {
  const [queue, setQueue] = useState<BulkUploadItem[]>([]);
  const [batchSubjectId, setBatchSubjectId] = useState<string>(defaultSubjectId || (subjects[0]?.id || ''));
  const [batchIsPremium, setBatchIsPremium] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize batchSubjectId if defaultSubjectId loads later
  React.useEffect(() => {
    if (defaultSubjectId && !batchSubjectId) {
      setBatchSubjectId(defaultSubjectId);
    } else if (subjects.length > 0 && !batchSubjectId) {
      setBatchSubjectId(subjects[0].id);
    }
  }, [defaultSubjectId, subjects, batchSubjectId]);

  const addFilesToQueue = (filesList: FileList | File[]) => {
    const filesArray = Array.from(filesList).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));

    if (filesArray.length === 0) {
      toast.error('Please select valid PDF documents.');
      return;
    }

    const targetSubject = batchSubjectId || (subjects[0]?.id || '');

    const newItems: BulkUploadItem[] = filesArray.map(file => {
      const cleanTitle = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());

      return {
        id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        file,
        title: cleanTitle,
        subjectId: targetSubject,
        isPremium: batchIsPremium,
        status: 'pending',
        progress: 0,
        statusText: 'Queued'
      };
    });

    setQueue(prev => [...prev, ...newItems]);
    toast.success(`Added ${newItems.length} document${newItems.length > 1 ? 's' : ''} to bulk upload queue.`);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToQueue(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToQueue(e.target.files);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeItem = (id: string) => {
    if (isProcessing) {
      toast.warning('Cannot remove files while queue processing is active.');
      return;
    }
    setQueue(prev => prev.filter(item => item.id !== id));
  };

  const updateItem = (id: string, updates: Partial<BulkUploadItem>) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const clearCompleted = () => {
    setQueue(prev => prev.filter(item => item.status !== 'success'));
    toast.info('Cleared completed uploads from queue.');
  };

  const processQueue = async () => {
    const pendingItems = queue.filter(item => item.status === 'pending' || item.status === 'error');

    if (pendingItems.length === 0) {
      toast.info('No pending or failed files in queue to process.');
      return;
    }

    setIsProcessing(true);
    let successCount = 0;
    let failCount = 0;

    toast.info(`Starting bulk processing of ${pendingItems.length} file(s)...`);

    for (const item of pendingItems) {
      updateItem(item.id, {
        status: 'uploading',
        progress: 5,
        statusText: 'Initializing pipeline...',
        error: undefined
      });

      try {
        const result = await uploadMaterialFile({
          file: item.file,
          title: item.title,
          subjectId: item.subjectId,
          isPremium: item.isPremium,
          showToast: false, // We render individual status in BulkUploadManager UI
          onProgress: (pct, statusText) => {
            updateItem(item.id, {
              progress: pct,
              statusText
            });
          }
        });

        if (result.success) {
          updateItem(item.id, {
            status: 'success',
            progress: 100,
            statusText: `Published (${result.usedBucket})`,
            usedBucket: result.usedBucket
          });
          successCount++;
        } else {
          updateItem(item.id, {
            status: 'error',
            progress: 0,
            statusText: 'Upload failed',
            error: result.error || 'Server or storage error'
          });
          failCount++;
        }
      } catch (err: any) {
        updateItem(item.id, {
          status: 'error',
          progress: 0,
          statusText: 'Exception occurred',
          error: err.message || 'Unknown processing error'
        });
        failCount++;
      }
    }

    setIsProcessing(false);

    if (successCount > 0) {
      toast.success(`Bulk upload complete! ${successCount} file(s) published successfully.`);
      onUploadComplete?.();
    }
    if (failCount > 0) {
      toast.error(`${failCount} file(s) failed during queue processing.`);
    }
  };

  const totalItems = queue.length;
  const completedItems = queue.filter(i => i.status === 'success').length;
  const errorItems = queue.filter(i => i.status === 'error').length;
  const overallPercentage = totalItems > 0 
    ? Math.round(queue.reduce((acc, curr) => acc + curr.progress, 0) / totalItems) 
    : 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <FolderUp className="w-5 h-5 text-indigo-600" />
            Bulk Upload Manager
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Drag & drop multiple PDF files to batch upload with automatic bucket retries & proxy fallback.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {completedItems > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearCompleted}
              disabled={isProcessing}
              className="text-xs text-slate-600"
            >
              Clear Completed ({completedItems})
            </Button>
          )}

          <Button
            onClick={processQueue}
            disabled={isProcessing || totalItems === 0 || completedItems === totalItems}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5 shadow-sm"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Processing Queue...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                Process Queue ({totalItems - completedItems})
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Default Controls for Queue Items */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
        <div>
          <label className="text-xs font-medium text-slate-700 block mb-1">
            Default Subject
          </label>
          <select
            value={batchSubjectId}
            onChange={(e) => setBatchSubjectId(e.target.value)}
            disabled={isProcessing}
            className="w-full text-xs bg-white border border-slate-200 rounded-md p-2 text-slate-800 focus:ring-1 focus:ring-indigo-500"
          >
            {subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end mb-1">
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={batchIsPremium}
              onChange={(e) => setBatchIsPremium(e.target.checked)}
              disabled={isProcessing}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
            <span>Mark uploaded files as <strong>Premium</strong></span>
          </label>
        </div>

        <div className="flex items-end justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="w-full sm:w-auto text-xs bg-white hover:bg-slate-50 border-slate-200"
          >
            <Upload className="w-3.5 h-3.5 mr-1 text-slate-600" />
            Select Files Manual
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      {/* Drag and Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50/50 scale-[0.99]'
            : 'border-slate-200 hover:border-indigo-300 bg-slate-50/40 hover:bg-slate-50'
        } ${isProcessing ? 'pointer-events-none opacity-60' : ''}`}
      >
        <div className="mx-auto w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mb-3 text-indigo-600">
          <Upload className="w-6 h-6" />
        </div>
        <p className="text-sm font-medium text-slate-700">
          Drop PDF study materials here or <span className="text-indigo-600 underline">click to browse</span>
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Supports multiple PDF files up to 50MB each
        </p>
      </div>

      {/* Queue Summary Bar */}
      {totalItems > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
            <span className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              Queue Progress: {completedItems} / {totalItems} Complete ({overallPercentage}%)
            </span>
            {errorItems > 0 && (
              <span className="text-amber-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errorItems} file(s) require retry
              </span>
            )}
          </div>

          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${overallPercentage}%` }}
            />
          </div>
        </div>
      )}

      {/* File List */}
      {queue.length > 0 && (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {queue.map((item) => (
            <div
              key={item.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-md shrink-0">
                  <FileText className="w-4 h-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <input
                    type="text"
                    value={item.title}
                    disabled={isProcessing || item.status === 'success'}
                    onChange={(e) => updateItem(item.id, { title: e.target.value })}
                    className="font-medium text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-white px-1 py-0.5 rounded w-full truncate"
                  />

                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                    <span>{(item.file.size / (1024 * 1024)).toFixed(2)} MB</span>
                    <span>•</span>
                    <select
                      value={item.subjectId}
                      disabled={isProcessing || item.status === 'success'}
                      onChange={(e) => updateItem(item.id, { subjectId: e.target.value })}
                      className="bg-transparent text-slate-600 font-medium hover:underline cursor-pointer border-none p-0 focus:ring-0"
                    >
                      {subjects.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    {item.isPremium && (
                      <span className="bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded text-[10px] font-semibold">
                        Premium
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Status & Actions */}
              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                <div className="w-28 text-right">
                  {item.status === 'pending' && (
                    <span className="text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded text-[10px] font-medium">
                      Pending
                    </span>
                  )}
                  {item.status === 'uploading' && (
                    <div className="space-y-1">
                      <span className="text-indigo-600 font-medium text-[10px] flex items-center justify-end gap-1">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        {item.progress}%
                      </span>
                      <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-600 h-1 rounded-full"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {item.status === 'success' && (
                    <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-medium flex items-center justify-end gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Success
                    </span>
                  )}
                  {item.status === 'error' && (
                    <span className="text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded text-[10px] font-medium flex items-center justify-end gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Failed
                    </span>
                  )}
                </div>

                {!isProcessing && item.status !== 'success' && (
                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                    title="Remove from queue"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
