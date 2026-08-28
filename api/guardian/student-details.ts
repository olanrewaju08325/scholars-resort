import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyGuardian } from '../_auth';

const DEFAULT_SUPABASE_URL = 'https://syoodykedvqaoeplmamd.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5b29keWtlZHZxYW9lcGxtYW1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNjEyMTIsImV4cCI6MjEwMDkzNzIxMn0.GV7jgq04Qha6W1JENvc-ntVt9zSOLDx7vTaTxZlOTq4';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { guardianId: paramGuardianId, studentId } = req.body || {};

  if (!studentId) {
    return res.status(400).json({ success: false, error: 'studentId is required.' });
  }

  const auth = await verifyGuardian(req, studentId);
  if (!auth.authorized || !auth.user) {
    return res.status(auth.status).json({ success: false, error: auth.error });
  }

  const guardianId = paramGuardianId || auth.user.id;

  try {
    // 1. Security Check: verify guardian is actively linked to this student
    let isLinked = false;
    try {
      const { data: rel } = await supabase
        .from('guardian_student_relationships')
        .select('id')
        .eq('guardian_id', guardianId)
        .eq('student_id', studentId)
        .eq('status', 'active')
        .maybeSingle();
      if (rel) isLinked = true;
    } catch (_) {}

    if (!isLinked) {
      try {
        const { data: link } = await supabase
          .from('guardian_links')
          .select('id')
          .eq('guardian_id', guardianId)
          .eq('student_id', studentId)
          .eq('status', 'active')
          .maybeSingle();
        if (link) isLinked = true;
      } catch (_) {}
    }

    if (!isLinked) {
      return res.status(403).json({ success: false, error: 'Unauthorized: Student is not linked to this guardian account.' });
    }

    // 2. Fetch Student Profile
    const { data: studentProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', studentId)
      .maybeSingle();

    if (!studentProfile) {
      return res.status(404).json({ success: false, error: 'Student record not found.' });
    }

    // 3. Fetch Real Exam Sessions
    const { data: sessions } = await supabase
      .from('exam_sessions')
      .select('*')
      .eq('user_id', studentId)
      .order('created_at', { ascending: false });

    // 4. Fetch Real Payments
    const { data: payments } = await supabase
      .from('manual_payments')
      .select('*')
      .eq('user_id', studentId)
      .order('created_at', { ascending: false });

    // 5. Fetch Real Answers
    const { data: answerData } = await supabase
      .from('session_answers')
      .select('question_id, is_correct, created_at, time_spent_seconds')
      .eq('user_id', studentId)
      .order('created_at', { ascending: false })
      .limit(300);

    // 6. Subject Accuracy & Weak Areas
    const subjectScores: Record<string, { correct: number; total: number }> = {};
    if (answerData && answerData.length > 0) {
      const qIds = Array.from(new Set(answerData.map((a: any) => a.question_id).filter(Boolean)));
      if (qIds.length > 0) {
        const { data: qList } = await supabase
          .from('questions')
          .select('id, subject_id')
          .in('id', qIds.slice(0, 100));

        const subIds = Array.from(new Set((qList || []).map((q: any) => q.subject_id).filter(Boolean)));
        let subMap: Record<string, string> = {};
        if (subIds.length > 0) {
          const { data: subs } = await supabase.from('subjects').select('id, name').in('id', subIds);
          (subs || []).forEach((s: any) => { subMap[s.id] = s.name; });
        }

        const qSubjectMap: Record<string, string> = {};
        (qList || []).forEach((q: any) => {
          if (q.subject_id && subMap[q.subject_id]) {
            qSubjectMap[q.id] = subMap[q.subject_id];
          }
        });

        answerData.forEach((a: any) => {
          const subName = qSubjectMap[a.question_id] || 'General Studies';
          if (!subjectScores[subName]) subjectScores[subName] = { correct: 0, total: 0 };
          subjectScores[subName].total++;
          if (a.is_correct) subjectScores[subName].correct++;
        });
      }
    }

    if (Object.keys(subjectScores).length === 0 && sessions && sessions.length > 0) {
      sessions.forEach((s: any) => {
        const subName = s.subject_name || s.subject || 'UTME Mock Exam';
        if (!subjectScores[subName]) subjectScores[subName] = { correct: 0, total: 0 };
        const totalQ = s.total_questions || 50;
        const score = s.score || 0;
        subjectScores[subName].total += totalQ;
        subjectScores[subName].correct += Math.min(score, totalQ);
      });
    }

    const weakSubjects = Object.entries(subjectScores)
      .map(([name, s]) => ({ name, rate: s.total > 0 ? s.correct / s.total : 1 }))
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 3)
      .map(s => s.name);

    // 7. Global Rank
    let globalRank = 1;
    try {
      const { count: higherCount } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gt('xp', studentProfile.xp || 0);
      globalRank = (higherCount || 0) + 1;
    } catch (_) {}

    // 8. Exam History & Scores
    const submittedSessions = (sessions || []).filter((s: any) => s.status === 'submitted' || (s.score && s.score > 0));
    let avgScore = 0;
    const target = studentProfile.target_score || 320;
    let readiness = 0;
    let history: any[] = [];

    if (submittedSessions.length > 0) {
      const totalEquiv = submittedSessions.reduce((acc: number, curr: any) => {
        const raw = curr.score || 0;
        const totalQ = curr.total_questions || 50;
        return acc + Math.round((raw / totalQ) * 400);
      }, 0);
      avgScore = Math.round(totalEquiv / submittedSessions.length);
      readiness = Math.min(100, Math.max(15, Math.round((avgScore / target) * 85 + (submittedSessions.length * 3))));

      history = submittedSessions.slice(0, 6).map((s: any) => {
        const raw = s.score || 0;
        const totalQ = s.total_questions || 50;
        const mins = s.time_spent_seconds ? Math.floor(s.time_spent_seconds / 60) : null;
        const dateStr = s.submitted_at || s.created_at;
        return {
          date: dateStr ? new Date(dateStr).toLocaleDateString() : 'Recent',
          score: Math.round((raw / totalQ) * 400),
          percent: Math.round((raw / totalQ) * 100),
          time: mins ? `${mins} min` : 'N/A'
        };
      });
    }

    // 9. Focus Time in past 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let weeklyFocusSeconds = 0;
    (sessions || []).forEach((s: any) => {
      const sDate = new Date(s.created_at || s.submitted_at || 0);
      if (sDate >= sevenDaysAgo && s.time_spent_seconds) {
        weeklyFocusSeconds += Number(s.time_spent_seconds);
      }
    });
    (answerData || []).forEach((a: any) => {
      const aDate = new Date(a.created_at || 0);
      if (aDate >= sevenDaysAgo && a.time_spent_seconds) {
        weeklyFocusSeconds += Number(a.time_spent_seconds);
      }
    });
    const focusHours = Math.floor(weeklyFocusSeconds / 3600);
    const focusMins = Math.floor((weeklyFocusSeconds % 3600) / 60);
    const weeklyFocusFormatted = focusHours > 0 ? `${focusHours}h ${focusMins}m` : `${focusMins || (submittedSessions.length > 0 ? submittedSessions.length * 20 : 0)}m`;

    // 10. 14-Day Activity Heatmap
    const heatmapDays: { date: string; count: number; intensity: number }[] = [];
    const activityCountByDay: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      activityCountByDay[d.toISOString().split('T')[0]] = 0;
    }
    (sessions || []).forEach((s: any) => {
      const day = (s.created_at || '').split('T')[0];
      if (activityCountByDay[day] !== undefined) activityCountByDay[day] += 1;
    });
    (answerData || []).forEach((a: any) => {
      const day = (a.created_at || '').split('T')[0];
      if (activityCountByDay[day] !== undefined) activityCountByDay[day] += 1;
    });
    Object.entries(activityCountByDay).forEach(([date, count]) => {
      let intensity = 0;
      if (count >= 15) intensity = 3;
      else if (count >= 5) intensity = 2;
      else if (count > 0) intensity = 1;
      heatmapDays.push({ date, count, intensity });
    });

    const daysActiveInWeek = heatmapDays.slice(7).filter(d => d.count > 0).length;
    const attendanceRate = Math.min(100, Math.round((daysActiveInWeek / 7) * 100));

    const defaultSubjects = ['Use of English', 'Mathematics', 'Physics', 'Chemistry'];
    const subjectProgress = Object.keys(subjectScores).length > 0
      ? Object.entries(subjectScores).map(([sub, s]) => ({
          sub,
          progress: s.total > 0 ? Math.min(100, Math.round((s.correct / s.total) * 100)) : 0
        }))
      : defaultSubjects.map(sub => ({ sub, progress: 0 }));

    return res.status(200).json({
      success: true,
      data: {
        id: studentProfile.id,
        name: studentProfile.full_name || studentProfile.email || 'Student Ward',
        email: studentProfile.email || '',
        has_paid: !!studentProfile.has_paid,
        score: avgScore,
        weakSubjects: weakSubjects.length > 0 ? weakSubjects : ['No weak areas identified yet'],
        recentActivity: history.length > 0 ? `Mock Exam on ${history[0].date}` : (studentProfile.last_active ? `Active on ${new Date(studentProfile.last_active).toLocaleDateString()}` : 'No activity logged yet'),
        readiness,
        target,
        globalRank,
        weeklyFocusTime: weeklyFocusFormatted,
        attendanceRate: attendanceRate > 0 ? `${attendanceRate}%` : (studentProfile.streak_days ? `${Math.min(100, studentProfile.streak_days * 15)}%` : '0%'),
        heatmap: heatmapDays,
        payments: (payments || []).map((p: any) => ({
          date: new Date(p.created_at).toLocaleDateString(),
          amount: `₦${Number(p.amount || 0).toLocaleString()}`,
          ref: p.id ? p.id.substring(0, 8).toUpperCase() : 'REC-AUTOPAY',
          status: p.status || 'approved'
        })),
        syllabus: subjectProgress,
        history
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Internal server error.' });
  }
}
