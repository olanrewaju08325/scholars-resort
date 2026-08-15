import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import db from '../lib/db';
import { useAuth } from '../context/AuthContext';

export const useSync = () => {
  const { user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Download subjects to Dexie if version differs
  const downloadSubject = async (subjectId: string) => {
    try {
      setIsSyncing(true);
      setSyncError(null);

      // Check current version in Supabase
      const { data: remoteSubject, error: subjectError } = await supabase
        .from('subjects')
        .select('id, name, version')
        .eq('id', subjectId)
        .maybeSingle();

      if (subjectError || !remoteSubject) throw new Error('Failed to fetch subject metadata');

      const localSubject = await db.subjects_cache.get(subjectId);

      // Delta sync: only download if local version is outdated or missing
      if (!localSubject || localSubject.version < remoteSubject.version) {
        // Fetch questions
        const { data: questions, error: questionsError } = await supabase
          .from('questions')
          .select('id, subject_id, question_text, options, correct_answer, explanation, topic_id, difficulty')
          .eq('subject_id', subjectId)
          .eq('is_active', true);

        if (questionsError) throw questionsError;

        // Fetch topics to map names
        const { data: topics, error: topicsError } = await supabase
          .from('topics')
          .select('id, name')
          .eq('subject_id', subjectId);
          
        if (topicsError) throw topicsError;

        const topicMap = new Map(topics?.map(t => [t.id, t.name]) || []);

        const questionsToCache = questions?.map(q => ({
          id: q.id,
          subject_id: q.subject_id,
          question_text: q.question_text,
          options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
          correct_answer: q.correct_answer,
          explanation: q.explanation || '',
          topic: topicMap.get(q.topic_id) || 'General',
          difficulty: q.difficulty || 'medium'
        })) || [];

        // Transaction to update both tables atomically
        await db.transaction('rw', db.subjects_cache, db.questions_cache, db.download_meta, async () => {
          // Clear old questions for this subject
          await db.questions_cache.where('subject_id').equals(subjectId).delete();
          
          if (questionsToCache.length > 0) {
            await db.questions_cache.bulkAdd(questionsToCache);
          }
          
          await db.subjects_cache.put({
            id: remoteSubject.id,
            name: remoteSubject.name,
            version: remoteSubject.version
          });

          await db.download_meta.put({
            subject_id: remoteSubject.id,
            size: questionsToCache.length,
            last_synced: new Date().toISOString()
          });
        });
      }
    } catch (err: any) {
      console.error("Download Error:", err);
      setSyncError(err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // Push pending sessions to Supabase
  const pushPendingSessions = async () => {
    if (!navigator.onLine || !user) return;
    
    try {
      setIsSyncing(true);
      
      const pendingSessions = await db.pending_sessions.filter(s => !s.synced).toArray();
      
      for (const session of pendingSessions) {
        // Insert session
        const { error: sessionError } = await supabase
          .from(session.mode === 'exam' ? 'exam_sessions' : 'practice_sessions')
          .insert({
            id: session.id,
            user_id: session.user_id,
            score: session.score,
            started_at: session.started_at,
            ...(session.mode === 'exam' 
                ? { submitted_at: session.submitted_at, status: 'submitted' } 
                : { completed_at: session.submitted_at })
          });

        if (sessionError) {
          console.error(`Failed to sync session ${session.id}`, sessionError);
          continue;
        }

        // Get corresponding answers
        const pendingAnswers = await db.pending_answers
          .where('session_id')
          .equals(session.id)
          .and(a => !a.synced)
          .toArray();

        if (pendingAnswers.length > 0) {
          const answersToInsert = pendingAnswers.map(a => ({
            id: a.id,
            user_id: user.id,
            [session.mode === 'exam' ? 'exam_session_id' : 'practice_session_id']: a.session_id,
            question_id: a.question_id,
            selected_answer: a.selected_answer,
            time_spent_seconds: a.time_spent_seconds,
            // Simple check: we don't have is_correct here easily without looking up question again,
            // but in real app we'd calculate this during the exam and store it in Dexie.
          }));

          const { error: answersError } = await supabase
            .from('session_answers')
            .insert(answersToInsert);

          if (!answersError) {
            // Mark as synced locally
            await db.pending_answers.bulkPut(
              pendingAnswers.map(a => ({ ...a, synced: true }))
            );
          }
        }
        
        // Mark session as synced locally
        await db.pending_sessions.put({ ...session, synced: true });
      }
    } catch (err: any) {
      console.error("Sync push error:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Automatically attempt to sync when coming online
  useEffect(() => {
    const handleOnline = () => {
      pushPendingSessions();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [user]);

  return {
    downloadSubject,
    pushPendingSessions,
    isSyncing,
    syncError
  };
};
