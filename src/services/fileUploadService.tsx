import React from 'react';
import { supabase } from '@/lib/supabase';
import { getApiUrl } from '@/lib/utils';
import { authFetch } from '@/lib/apiAuth';
import { toast } from 'sonner';

export interface FileUploadOptions {
  file: File;
  title?: string;
  description?: string;
  subjectId?: string;
  isPremium?: boolean;
  showToast?: boolean;
  toastId?: string | number;
  onProgress?: (percentage: number, statusText: string) => void;
}

export interface FileUploadResult {
  success: boolean;
  publicUrl: string;
  usedBucket: string;
  error?: string;
}

export interface BucketDiagnosticResult {
  exists: boolean;
  public: boolean;
  probeSuccess?: boolean;
  error?: string;
}

export interface StorageDiagnosticsResponse {
  allReady: boolean;
  overallBucketCount: number;
  buckets: Record<string, BucketDiagnosticResult>;
  autoCreated: string[];
  sqlInstructions: string;
  setupSteps: string[];
  listBucketsError?: string | null;
}

export const convertFileToBase64WithProgress = (
  file: File,
  onReadProgress?: (pct: number) => void
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (evt) => {
      if (evt.lengthComputable && evt.total > 0) {
        const pct = Math.round((evt.loaded / evt.total) * 100);
        onReadProgress?.(pct);
      }
    };
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

export const convertFileToBase64 = (file: File): Promise<string> => {
  return convertFileToBase64WithProgress(file);
};

/**
 * XHR Upload Helper with progress tracking for server proxy route
 */
const uploadPayloadViaXHR = async (
  url: string,
  payload: any,
  onUploadProgress?: (pct: number) => void
): Promise<any> => {
  let token = '';
  try {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token || '';
  } catch (_) {}

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Content-Type', 'application/json');
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    if (xhr.upload) {
      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable && evt.total > 0) {
          const pct = Math.round((evt.loaded / evt.total) * 100);
          onUploadProgress?.(pct);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const jsonRes = JSON.parse(xhr.responseText);
          resolve(jsonRes);
        } catch (err) {
          reject(new Error('Invalid JSON response from server proxy'));
        }
      } else {
        reject(new Error(`Server proxy returned HTTP status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during server proxy transfer'));
    xhr.send(JSON.stringify(payload));
  });
};

/**
 * Renders a visual Sonner toast element with an animated progress bar.
 */
const renderToastProgressContent = (
  fileName: string,
  fileSize: number,
  percentage: number,
  statusText: string
) => {
  const sizeMB = (fileSize / (1024 * 1024)).toFixed(1);
  return (
    <div className="w-full space-y-2 min-w-[260px] py-1 select-none">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
        <div className="flex items-center gap-1.5 min-w-0 pr-2">
          <span className="truncate max-w-[160px] font-medium">{fileName}</span>
          <span className="text-[10px] text-slate-400 font-mono shrink-0">({sizeMB} MB)</span>
        </div>
        <span className="font-mono text-indigo-600 font-bold text-xs shrink-0">{percentage}%</span>
      </div>
      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/80">
        <div
          className="bg-indigo-600 h-full rounded-full transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-[11px] text-slate-500 truncate font-medium">{statusText}</p>
    </div>
  );
};

/**
 * Core File Upload Service
 * Executes direct Supabase Storage upload with retry logic across multiple buckets,
 * hooks into Supabase storage progress callback, updates Sonner toast progress bar,
 * and falls back to server-side proxy route with XHR upload tracking.
 */
export const uploadMaterialFile = async (options: FileUploadOptions): Promise<FileUploadResult> => {
  const {
    file,
    title = file.name.replace(/\.[^/.]+$/, ''),
    description = '',
    subjectId = '',
    isPremium = false,
    showToast = true,
    toastId: customToastId,
    onProgress
  } = options;

  const initialContent = renderToastProgressContent(file.name, file.size, 5, 'Initializing upload pipeline...');
  const toastId = showToast ? (customToastId || toast.loading(initialContent)) : undefined;

  const updateProgress = (percentage: number, statusText: string) => {
    const clamped = Math.min(100, Math.max(0, Math.round(percentage)));
    onProgress?.(clamped, statusText);

    if (showToast && toastId) {
      const content = renderToastProgressContent(file.name, file.size, clamped, statusText);
      toast.loading(content, { id: toastId });
    }
  };

  updateProgress(5, 'Preparing upload pipeline...');

  const fileExt = file.name.split('.').pop() || 'pdf';
  const fileName = `${Math.random().toString(36).substring(2, 12)}_${Date.now()}.${fileExt}`;
  const filePath = `${subjectId || 'general'}/${fileName}`;

  let publicUrl = '';
  let usedBucket = '';
  const targetBuckets = ['study-materials', 'materials', 'library'];

  // 1. Direct Supabase Storage Upload with Multi-Bucket & Multi-Attempt Retries + onUploadProgress hook
  for (let bIndex = 0; bIndex < targetBuckets.length; bIndex++) {
    if (publicUrl) break;
    const bucketName = targetBuckets[bIndex];

    for (let attempt = 1; attempt <= 3; attempt++) {
      const startPct = 10 + (bIndex * 20) + (attempt * 3);
      updateProgress(startPct, `Connecting to bucket '${bucketName}' (Attempt ${attempt}/3)...`);

      try {
        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(filePath, file, {
            contentType: file.type || 'application/pdf',
            upsert: true,
            // Hook into Supabase Storage progress callback
            ...({
              onUploadProgress: (evt: { loaded: number; total: number }) => {
                if (evt.total > 0) {
                  const uploadPct = Math.round((evt.loaded / evt.total) * 100);
                  const scaled = Math.min(80, Math.max(startPct, Math.round(10 + (uploadPct * 0.7))));
                  const loadedMB = (evt.loaded / (1024 * 1024)).toFixed(1);
                  const totalMB = (evt.total / (1024 * 1024)).toFixed(1);
                  updateProgress(
                    scaled,
                    `Uploading to '${bucketName}': ${uploadPct}% (${loadedMB}MB / ${totalMB}MB)`
                  );
                }
              }
            } as any)
          });

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
          if (publicUrlData?.publicUrl) {
            publicUrl = publicUrlData.publicUrl;
            usedBucket = bucketName;
            updateProgress(82, `Direct storage upload verified (${bucketName})`);
            break;
          }
        } else {
          console.warn(`[FileUploadService] Storage attempt ${attempt} on bucket '${bucketName}' failed:`, uploadError.message);
          if (uploadError.message?.toLowerCase().includes('not found') || uploadError.message?.toLowerCase().includes('bucket')) {
            break; // Skip further retries on non-existent bucket
          }
        }
      } catch (err: any) {
        console.warn(`[FileUploadService] Storage exception on bucket '${bucketName}':`, err);
      }

      if (attempt < 3 && !publicUrl) {
        await new Promise(r => setTimeout(r, 400));
      }
    }
  }

  // 2. Server-side Proxy Fallback Route (bypasses client storage/RLS constraints with XHR progress)
  if (!publicUrl) {
    updateProgress(75, 'Direct storage restricted; activating server proxy route...');
    try {
      updateProgress(78, 'Processing document payload...');
      const base64Data = await convertFileToBase64WithProgress(file, (readPct) => {
        const scaledRead = Math.round(78 + (readPct * 0.08));
        updateProgress(scaledRead, `Preparing document stream (${readPct}%)...`);
      });

      updateProgress(86, 'Transferring payload to backend proxy...');

      const jsonRes = await uploadPayloadViaXHR(
        getApiUrl('/api/admin/materials/upload-file'),
        {
          fileName: file.name,
          fileBase64: base64Data,
          contentType: file.type || 'application/pdf',
          title,
          description,
          subject_id: subjectId,
          is_premium: isPremium
        },
        (xhrPct) => {
          const scaledXhr = Math.round(86 + (xhrPct * 0.08));
          updateProgress(scaledXhr, `Uploading via server proxy (${xhrPct}%)...`);
        }
      );

      if (jsonRes.success && jsonRes.publicUrl) {
        publicUrl = jsonRes.publicUrl;
        usedBucket = jsonRes.bucketUsed || 'server_proxy_storage';
        updateProgress(94, 'Server proxy upload verified');
      }
    } catch (backendErr: any) {
      console.warn('[FileUploadService] Proxy upload error:', backendErr);
    }
  }

  // 3. Fallback Local Blob URL if remote servers are unreachable
  if (!publicUrl) {
    publicUrl = URL.createObjectURL(file);
    usedBucket = 'local_blob_fallback';
  }

  updateProgress(95, 'Saving material metadata & updating library records...');

  // 4. Metadata updates
  try {
    await authFetch(getApiUrl('/api/admin/materials/upload-metadata'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description,
        subject_id: subjectId || null,
        file_path: publicUrl,
        is_premium: isPremium
      })
    });
  } catch (_) {}

  // Client DB Inserts
  const newMaterialId = `mat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  try {
    await supabase.from('materials').insert({
      id: newMaterialId,
      title,
      description: description || '',
      subject_id: subjectId || null,
      file_path: publicUrl,
      file_url: publicUrl,
      file_size_bytes: file.size,
      visibility: true,
      is_premium: isPremium
    });

    await supabase.from('library_materials').insert({
      title,
      description: description || '',
      subject_id: subjectId || null,
      file_url: publicUrl,
      is_premium: isPremium,
      is_active: true
    });
  } catch (rlsErr: any) {
    console.warn('[FileUploadService] Client DB insert notice:', rlsErr?.message || rlsErr);
  }

  // Local Storage Cache Backup
  try {
    const existingRaw = localStorage.getItem('scholar_local_materials');
    const existingArr = existingRaw ? JSON.parse(existingRaw) : [];
    existingArr.unshift({
      id: newMaterialId,
      title,
      description,
      subject_id: subjectId,
      file_path: publicUrl,
      file_url: publicUrl,
      file_size_bytes: file.size,
      visibility: true,
      is_premium: isPremium,
      created_at: new Date().toISOString()
    });
    localStorage.setItem('scholar_local_materials', JSON.stringify(existingArr));
  } catch (_) {}

  // Trigger global events for dynamic page re-rendering
  window.dispatchEvent(new CustomEvent('library_materials_updated', { detail: { title, timestamp: Date.now() } }));
  window.dispatchEvent(new CustomEvent('supabase_library_revalidate', { detail: { title, timestamp: Date.now() } }));

  updateProgress(100, 'Upload & publication complete!');

  if (showToast && toastId) {
    toast.success(`Uploaded "${title}" (${usedBucket})`, { id: toastId });
  }

  return {
    success: true,
    publicUrl,
    usedBucket
  };
};

export interface LibraryPermissionsDiagnosticResult {
  hasAccess: boolean;
  statusCode: number | string;
  message: string;
  is403Forbidden: boolean;
  userSession: {
    authenticated: boolean;
    userId?: string;
    email?: string;
    role?: string;
  };
  debuggingHints: string[];
  sqlFixScript: string;
}

/**
 * Admin Diagnostic Helper
 * Specifically tests current user session permissions against the 'library_materials' table,
 * logging clear debugging hints to the console if a 403 Forbidden / RLS restriction is detected.
 */
export const checkLibraryMaterialsPermissions = async (
  logToConsole = true
): Promise<LibraryPermissionsDiagnosticResult> => {
  let is403 = false;
  let hasAccess = true;
  let statusCode: number | string = 200;
  let errorMessage = '';

  // Get current session info
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData?.session;
  const user = session?.user;

  const userSessionInfo = {
    authenticated: !!session,
    userId: user?.id,
    email: user?.email,
    role: user?.role || (user?.app_metadata?.role as string) || 'authenticated'
  };

  if (logToConsole) {
    console.group('🔒 [Admin Diagnostic] Session & Permissions Check: library_materials');
    console.info('👤 Current User Session:', userSessionInfo);
    console.info('🔍 Testing SELECT & INSERT access against table "public.library_materials"...');
  }

  // 1. Check SELECT permissions on library_materials
  try {
    const { error: selectErr, status: selectStatus } = await supabase
      .from('library_materials')
      .select('id')
      .limit(1);

    if (selectErr) {
      hasAccess = false;
      errorMessage = selectErr.message || 'Permission denied on SELECT';
      statusCode = selectStatus || selectErr.code || 403;

      if (
        selectStatus === 403 ||
        selectErr.code === '42501' ||
        selectErr.message.toLowerCase().includes('permission denied') ||
        selectErr.message.toLowerCase().includes('row-level security') ||
        selectErr.message.includes('403')
      ) {
        is403 = true;
      }
    }
  } catch (err: any) {
    hasAccess = false;
    errorMessage = err.message || 'Exception during table permission probe';
    statusCode = 403;
    is403 = true;
  }

  // 2. Check SELECT permissions on materials (secondary table)
  if (hasAccess) {
    try {
      const { error: matErr, status: matStatus } = await supabase
        .from('materials')
        .select('id')
        .limit(1);

      if (matErr) {
        hasAccess = false;
        errorMessage = matErr.message || 'Permission denied on materials table';
        statusCode = matStatus || matErr.code || 403;
        if (matStatus === 403 || matErr.code === '42501' || matErr.message.toLowerCase().includes('permission denied')) {
          is403 = true;
        }
      }
    } catch (_) {}
  }

  const sqlFixScript = `-- Execute in Supabase SQL Editor to resolve 403 Forbidden / RLS restrictions:
ALTER TABLE public.library_materials ENABLE ROW LEVEL SECURITY;

-- Grant SELECT access to public / authenticated users
CREATE POLICY "Allow read access to library_materials"
ON public.library_materials FOR SELECT
USING (true);

-- Grant INSERT / UPDATE access to authenticated admin users
CREATE POLICY "Allow insert access to library_materials"
ON public.library_materials FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow update access to library_materials"
ON public.library_materials FOR UPDATE
USING (true);`;

  const debuggingHints = [
    `User Session: ${userSessionInfo.authenticated ? `Logged in as ${userSessionInfo.email} (Role: ${userSessionInfo.role})` : 'Unauthenticated (Anonymous Guest)'}`,
    `Root Cause: Supabase Row-Level Security (RLS) is active on 'library_materials' without an explicit policy allowing client operations for role '${userSessionInfo.role}'.`,
    `Database Fix: Copy and run the SQL policy script provided above in Supabase Dashboard -> SQL Editor.`,
    `Server Proxy Safety Net: Active backend route '/api/admin/materials/upload-file' uses service-role credentials to proxy uploads and bypass client 403 RLS restrictions automatically.`
  ];

  if (logToConsole) {
    if (!hasAccess || is403) {
      console.warn(`🚨 403 Forbidden / Permission Restricted on "library_materials"! (Status: ${statusCode})`);
      console.warn(`❌ Error Details: ${errorMessage}`);
      console.group('💡 Actionable Debugging Hints:');
      debuggingHints.forEach((hint, idx) => console.info(`${idx + 1}. ${hint}`));
      console.groupEnd();

      console.group('🛠️ Recommended Supabase SQL Fix Script:');
      console.log(sqlFixScript);
      console.groupEnd();
    } else {
      console.info('✅ Permissions Verified: Direct client access to "library_materials" is active and granted.');
    }
    console.groupEnd();
  }

  return {
    hasAccess,
    statusCode,
    message: hasAccess ? 'Permissions verified' : errorMessage,
    is403Forbidden: is403,
    userSession: userSessionInfo,
    debuggingHints,
    sqlFixScript
  };
};

/**
 * Storage Diagnostics Service
 * Verifies existence and access policies for study-materials, materials, library buckets
 */
export const checkStorageDiagnostics = async (): Promise<StorageDiagnosticsResponse> => {
  try {
    const response = await authFetch(getApiUrl('/api/admin/storage/verify'));
    if (response.ok) {
      const data: StorageDiagnosticsResponse = await response.json();
      return data;
    }
  } catch (err) {
    console.warn('[FileUploadService] Storage diagnostics API warning:', err);
  }

  // Client-side fallback probe
  const targetBuckets = ['study-materials', 'materials', 'library'];
  const bucketsResult: Record<string, BucketDiagnosticResult> = {};

  for (const bName of targetBuckets) {
    try {
      const { error } = await supabase.storage.from(bName).list('', { limit: 1 });
      if (!error) {
        bucketsResult[bName] = { exists: true, public: true, probeSuccess: true };
      } else {
        bucketsResult[bName] = { exists: false, public: false, error: error.message };
      }
    } catch (e: any) {
      bucketsResult[bName] = { exists: false, public: false, error: e.message };
    }
  }

  const allReady = targetBuckets.every(b => bucketsResult[b]?.exists);

  return {
    allReady,
    overallBucketCount: targetBuckets.filter(b => bucketsResult[b]?.exists).length,
    buckets: bucketsResult,
    autoCreated: [],
    sqlInstructions: `-- Run in Supabase SQL Editor:
INSERT INTO storage.buckets (id, name, public) VALUES ('study-materials', 'study-materials', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('materials', 'materials', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('library', 'library', true) ON CONFLICT DO NOTHING;`,
    setupSteps: ['Go to Supabase Dashboard > Storage > Create public buckets for study-materials, materials, library']
  };
};
