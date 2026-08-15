import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface ExamResultPdfData {
  studentName: string;
  examTitle: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  timeSpentFormatted: string;
  date: string;
  subjectBreakdown?: Array<{ name: string; score: number; total: number }>;
}

/**
 * Generates and downloads a formal PDF exam result report
 */
export async function generateExamResultPdf(data: ExamResultPdfData, elementId?: string) {
  try {
    if (elementId) {
      const el = document.getElementById(elementId);
      if (el) {
        const canvas = await html2canvas(el, { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgWidth = 210;
        const pageHeight = 295;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }

        pdf.save(`${data.examTitle.replace(/\s+/g, '_')}_Result.pdf`);
        return;
      }
    }

    // Direct programmatic PDF generation
    const doc = new jsPDF();

    // Header styling
    doc.setFillColor(22, 163, 74); // Green header
    doc.rect(0, 0, 210, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('SCHOLARS RESORT CBT EXAM REPORT', 15, 22);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Official Result Certificate | Generated: ${data.date}`, 15, 32);

    // Student & Exam details
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Student Name: ${data.studentName}`, 15, 55);
    doc.text(`Exam Title: ${data.examTitle}`, 15, 65);

    // Score box
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(34, 197, 94);
    doc.roundedRect(15, 75, 180, 45, 3, 3, 'FD');

    doc.setFontSize(14);
    doc.setTextColor(22, 163, 74);
    doc.text(`OVERALL SCORE: ${data.score}%`, 25, 90);

    doc.setFontSize(11);
    doc.setTextColor(71, 85, 105);
    doc.text(`Correct Answers: ${data.correctAnswers} / ${data.totalQuestions}`, 25, 102);
    doc.text(`Accuracy Rate: ${data.accuracy}%`, 110, 102);
    doc.text(`Time Spent: ${data.timeSpentFormatted}`, 25, 112);

    // Breakdown
    let y = 135;
    if (data.subjectBreakdown && data.subjectBreakdown.length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text('Subject Score Breakdown', 15, y);
      y += 10;

      data.subjectBreakdown.forEach((subj) => {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`${subj.name}:`, 20, y);
        doc.setFont('helvetica', 'normal');
        doc.text(`${subj.score} / ${subj.total} (${Math.round((subj.score / subj.total) * 100)}%)`, 90, y);
        y += 8;
      });
    }

    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text('Scholars Resort CBT & UTME/WAEC Preparation Engine - https://scholars-resort.netlify.app/', 15, 280);

    doc.save(`${data.examTitle.replace(/\s+/g, '_')}_Result.pdf`);
  } catch (err) {
    console.error('PDF export error:', err);
  }
}
