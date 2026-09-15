import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export type ProblemType = 
  | 'missing_subject_year font-bold'
  | 'missing_subject_year'
  | 'question_error'
  | 'math_render_issue'
  | 'exam_interrupted'
  | 'missing_explanation'
  | 'audio_synthesis_fail'
  | 'general_student_struggle';

export interface StudentProblemReport {
  id?: string;
  type: ProblemType;
  title: string;
  description: string;
  subject_name?: string;
  year?: string | number;
  question_id?: string;
  user_email?: string;
  metadata?: Record<string, any>;
  created_at?: string;
}

/**
 * Report a student problem or content gap to admins across DB, support tickets & activity logs
 */
export const reportStudentProblem = async (report: StudentProblemReport): Promise<boolean> => {
  const user = (await supabase.auth.getUser()).data.user;
  const userEmail = report.user_email || user?.email || 'student@scholarsresort.com';
  const timestamp = new Date().toISOString();

  const formattedTicket = {
    subject: `[STUDENT ALERT] ${report.title}`,
    message: `${report.description}\n\nSubject: ${report.subject_name || 'N/A'} | Year: ${report.year || 'N/A'} | Question ID: ${report.question_id || 'N/A'}\nUser: ${userEmail}`,
    user_email: userEmail,
    status: 'open',
    priority: report.type === 'missing_subject_year' || report.type === 'exam_interrupted' ? 'high' : 'medium',
    category: report.type,
    created_at: timestamp
  };

  try {
    // 1. Insert into support_tickets table (monitored in real-time by AdminNotificationSystem)
    await supabase.from('support_tickets').insert([formattedTicket]);

    // 2. Insert into activity_logs as a system capacity / problem alert
    await supabase.from('activity_logs').insert([{
      activity_type: 'student_problem_alert',
      action: `STUDENT_ALERT: ${report.title}`,
      details: report.description,
      user_email: userEmail,
      metadata: {
        type: report.type,
        subject: report.subject_name,
        year: report.year,
        question_id: report.question_id,
        ...report.metadata
      },
      created_at: timestamp
    }]);

    // 3. Dispatch a local window event so admin screens update immediately if open
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('student_problem_logged', { detail: report }));
    }

    return true;
  } catch (err) {
    console.warn('Could not persist student problem report to Supabase:', err);
    return false;
  }
};

/**
 * Convenience helper to report a missing subject or year
 */
export const reportMissingSubjectYear = async (
  subjectName: string, 
  year?: string | number,
  userEmail?: string
) => {
  return reportStudentProblem({
    type: 'missing_subject_year',
    title: `Missing Content: ${subjectName}${year ? ` (${year})` : ''}`,
    description: `A student attempted to access past questions for ${subjectName}${year ? ` year ${year}` : ''}, but no active questions were found in the database.`,
    subject_name: subjectName,
    year: year,
    user_email: userEmail
  });
};
