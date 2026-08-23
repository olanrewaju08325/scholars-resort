/**
 * Offline Data Export Utility
 * 
 * Exports all local Dexie IndexedDB records (answers, exam snapshots, sync queue items)
 * and localStorage study metadata into a formatted JSON backup file.
 */

import { offlineDb } from './offlineDb';
import { toast } from 'sonner';

export interface OfflineExportData {
  appName: string;
  version: string;
  exportedAt: string;
  userId?: string;
  metadata: {
    totalOfflineAnswers: number;
    totalSnapshots: number;
    totalPendingSyncQueue: number;
    batterySaverMode: boolean;
    streakDays: number;
  };
  indexedDbData: {
    answers: any[];
    examSnapshots: any[];
    syncQueue: any[];
  };
  localStorageData: {
    studyStreak: any;
    dailyGoal: any;
    weaknessDrills: any;
    pinnedNotes: any;
  };
}

export async function exportOfflineDataAsJson(userId?: string): Promise<OfflineExportData | null> {
  try {
    toast.loading('Generating offline study & exam backup file...', { id: 'offline-export' });

    const [answers, snapshots, syncQueue] = await Promise.all([
      offlineDb.answers.toArray(),
      offlineDb.examSnapshots.toArray(),
      offlineDb.syncQueue.toArray()
    ]);

    // Gather local study storage
    let streak = null;
    let dailyGoal = null;
    let weaknessDrills = null;
    let pinnedNotes = null;

    try {
      streak = JSON.parse(localStorage.getItem('scholars_streak') || 'null');
      dailyGoal = JSON.parse(localStorage.getItem('scholars_daily_target') || 'null');
      weaknessDrills = JSON.parse(localStorage.getItem('scholars_weakness_data') || 'null');
      pinnedNotes = JSON.parse(localStorage.getItem('scholars_notes') || 'null');
    } catch {
      // Ignore parsing errors
    }

    const exportObject: OfflineExportData = {
      appName: "Scholars Resort JAMB UTME Prep",
      version: "3.2.0",
      exportedAt: new Date().toISOString(),
      userId: userId || 'local_user',
      metadata: {
        totalOfflineAnswers: answers.length,
        totalSnapshots: snapshots.length,
        totalPendingSyncQueue: syncQueue.length,
        batterySaverMode: localStorage.getItem('scholars_battery_saver_enabled') === 'true',
        streakDays: streak?.streak || 0
      },
      indexedDbData: {
        answers,
        examSnapshots: snapshots,
        syncQueue
      },
      localStorageData: {
        studyStreak: streak,
        dailyGoal,
        weaknessDrills,
        pinnedNotes
      }
    };

    // Trigger JSON File Download
    const jsonString = JSON.stringify(exportObject, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `scholars_resort_study_backup_${dateStr}.json`;

    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = fileName;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);

    toast.success(`Backup downloaded: ${fileName}`, {
      id: 'offline-export',
      icon: '📦',
      duration: 5000
    });

    return exportObject;
  } catch (error: any) {
    console.error('Failed to export offline study data:', error);
    toast.error('Failed to export offline data: ' + (error?.message || 'Unknown error'), { id: 'offline-export' });
    return null;
  }
}
