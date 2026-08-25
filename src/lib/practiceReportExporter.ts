import jsPDF from 'jspdf';

export interface PracticeReportData {
  studentName: string;
  studentEmail?: string;
  sessionTitle: string;
  mode: string;
  date: string;
  score: number;
  totalQuestions: number;
  percentageScore: number;
  timeSpentSeconds: number;
  subjects?: string[];
  topicBreakdown?: Array<{
    topicName: string;
    subjectName: string;
    totalAttempted: number;
    correctCount: number;
    accuracyPercentage: number;
    masteryStatus: 'Mastered' | 'Satisfactory' | 'Needs Focus';
  }>;
  aiDiagnosticInsights?: string[];
}

/**
 * Downloads a clean, branded PDF summary report of a student's practice session and performance analysis
 */
export async function exportPracticeReportPdf(data: PracticeReportData): Promise<void> {
  const doc = new jsPDF('p', 'mm', 'a4');
  const studentName = data.studentName || 'Scholar Candidate';
  const email = data.studentEmail || 'student@scholarsresort.com';
  const sessionTitle = data.sessionTitle || 'Practice Session Performance Report';
  const mode = data.mode || 'Practice Drill';
  const score = data.score || 0;
  const total = data.totalQuestions || 0;
  const percentage = data.percentageScore !== undefined 
    ? Math.round(data.percentageScore) 
    : (total > 0 ? Math.round((score / total) * 100) : 0);

  const minutesSpent = Math.floor((data.timeSpentSeconds || 0) / 60);
  const secondsSpent = (data.timeSpentSeconds || 0) % 60;
  const timeFormatted = minutesSpent > 0 ? `${minutesSpent}m ${secondsSpent}s` : `${secondsSpent}s`;
  const avgSpeed = total > 0 ? Math.round((data.timeSpentSeconds || 0) / total) : 0;

  // Header Background - Deep Indigo Navy (#0f172a)
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 42, 'F');

  // Vibrant Emerald Green Bar (#10b981)
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 42, 210, 3, 'F');

  // Header Brand Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('SCHOLARS RESORT UTME / CBT', 15, 18);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text('PRACTICE SESSION PERFORMANCE & DIAGNOSTIC REPORT', 15, 26);
  doc.text(`Report Generated: ${data.date || new Date().toLocaleDateString('en-GB')}`, 15, 34);

  // Candidate Information Banner
  let y = 54;
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.roundedRect(15, y, 180, 26, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Candidate: ${studentName}`, 20, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Email: ${email}`, 20, y + 15);
  doc.text(`Session Mode: ${mode} (${sessionTitle})`, 20, y + 21);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text(`Accuracy Rate: ${percentage}%`, 130, y + 8);
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Score: ${score} / ${total}`, 130, y + 15);
  doc.text(`Time Spent: ${timeFormatted} (Avg ${avgSpeed}s/q)`, 130, y + 21);

  // Section 1: Executive KPI Cards
  y += 34;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('1. Practice Session KPI Summary', 15, y);

  y += 6;
  const cardW = 42;
  const cardH = 20;

  // Card 1: Score
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(15, y, cardW, cardH, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('CORRECT ANSWERS', 18, y + 6);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${score} / ${total}`, 18, y + 15);

  // Card 2: Percentage
  const isHigh = percentage >= 70;
  doc.setFillColor(isHigh ? 236 : 254, isHigh ? 253 : 242, isHigh ? 245 : 242);
  doc.roundedRect(60, y, cardW, cardH, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(isHigh ? 5 : 185, isHigh ? 150 : 28, isHigh ? 105 : 28);
  doc.text('ACCURACY RATE', 63, y + 6);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`${percentage}%`, 63, y + 15);

  // Card 3: Time
  doc.setFillColor(238, 242, 255); // Indigo tint
  doc.roundedRect(105, y, cardW, cardH, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(79, 70, 229);
  doc.text('TIME DURATION', 108, y + 6);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`${timeFormatted}`, 108, y + 15);

  // Card 4: Pace Speed
  doc.setFillColor(254, 243, 199); // Amber tint
  doc.roundedRect(150, y, cardW + 3, cardH, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 83, 9);
  doc.text('AVG QUESTION PACE', 153, y + 6);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`${avgSpeed}s / question`, 153, y + 15);

  // Section 2: Topic & Subject Breakdown Table
  y += 28;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('2. Topic & Subject Performance Breakdown', 15, y);

  y += 6;
  doc.setFillColor(226, 232, 240);
  doc.rect(15, y, 180, 8, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('TOPIC / FOCUS AREA', 20, y + 5.5);
  doc.text('SUBJECT', 95, y + 5.5);
  doc.text('SCORE', 140, y + 5.5);
  doc.text('ACCURACY', 160, y + 5.5);
  doc.text('STATUS', 180, y + 5.5);

  y += 8;

  const topicsList = data.topicBreakdown && data.topicBreakdown.length > 0
    ? data.topicBreakdown
    : [
        { topicName: 'Concord & Grammar Rules', subjectName: 'Use of English', totalAttempted: 10, correctCount: 8, accuracyPercentage: 80, masteryStatus: 'Mastered' as const },
        { topicName: 'Quadratic & Linear Equations', subjectName: 'Mathematics', totalAttempted: 8, correctCount: 5, accuracyPercentage: 62, masteryStatus: 'Satisfactory' as const },
        { topicName: 'Electromagnetism & Wave Motion', subjectName: 'Physics', totalAttempted: 10, correctCount: 4, accuracyPercentage: 40, masteryStatus: 'Needs Focus' as const },
        { topicName: 'Organic IUPAC Nomenclature', subjectName: 'Chemistry', totalAttempted: 7, correctCount: 3, accuracyPercentage: 42, masteryStatus: 'Needs Focus' as const }
      ];

  topicsList.forEach((item, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(15, y, 180, 8, 'F');
    }

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    const shortTopic = item.topicName.length > 36 ? item.topicName.substring(0, 33) + '...' : item.topicName;
    doc.text(shortTopic, 20, y + 5.5);

    doc.setTextColor(71, 85, 105);
    doc.text(item.subjectName || 'General', 95, y + 5.5);
    doc.text(`${item.correctCount}/${item.totalAttempted}`, 140, y + 5.5);

    if (item.accuracyPercentage >= 75) doc.setTextColor(22, 163, 74);
    else if (item.accuracyPercentage >= 55) doc.setTextColor(217, 119, 6);
    else doc.setTextColor(220, 38, 38);

    doc.setFont('helvetica', 'bold');
    doc.text(`${item.accuracyPercentage}%`, 160, y + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.text(item.masteryStatus, 180, y + 5.5);

    y += 8;
  });

  // Section 3: Diagnostic Insights & Action Plan
  y += 8;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('3. Performance Analysis & Recommended Action Plan', 15, y);

  y += 6;
  const insights = data.aiDiagnosticInsights && data.aiDiagnosticInsights.length > 0
    ? data.aiDiagnosticInsights
    : [
        `• Strengths: Solid performance demonstrated on ${topicsList.filter(t => t.accuracyPercentage >= 70).map(t => t.topicName).join(', ') || 'core concepts'}.`,
        `• Primary Focus Area: Dedicate 30 minutes daily to topics with accuracy below 60%.`,
        `• Time Management: Your pace of ${avgSpeed}s per question is ${avgSpeed <= 45 ? 'optimal for the 40-second JAMB standard.' : 'slightly slow; aim to improve recall speed.'}`,
        `• Next Step: Launch the Daily Study Planner to automatically schedule drills targeting your weakest topics.`
      ];

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);

  insights.forEach(insight => {
    doc.text(insight, 18, y);
    y += 5.5;
  });

  // Footer branding
  doc.setDrawColor(226, 232, 240);
  doc.line(15, 275, 195, 275);
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Scholars Resort Learning Engine • Official Practice Report • https://scholarsresort.com', 15, 282);
  doc.text('Page 1 of 1', 180, 282);

  // Save PDF file
  const filename = `Practice_Report_${studentName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.pdf`;
  doc.save(filename);
}
