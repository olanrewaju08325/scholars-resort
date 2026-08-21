import Papa from 'papaparse';
import jsPDF from 'jspdf';
import { toast } from 'sonner';
import { logAdminActivity } from '@/services/adminActivityService';

/**
 * Export questions array to CSV
 */
export const exportQuestionsToCSV = (questions: any[], filename = 'Question_Bank_Export.csv') => {
  if (!questions || questions.length === 0) {
    toast.error('No questions available to export.');
    return;
  }

  const exportData = questions.map((q, idx) => {
    let optionsArr: string[] = [];
    if (Array.isArray(q.options)) {
      optionsArr = q.options;
    } else if (typeof q.options === 'string') {
      try { optionsArr = JSON.parse(q.options); } catch { optionsArr = [q.options]; }
    }

    return {
      'S/N': idx + 1,
      'Question ID': q.id || '',
      'Subject': q.subjects?.name || q.subject_name || q.subject_id || 'General',
      'Question Text': q.question_text || '',
      'Option A': optionsArr[0] || '',
      'Option B': optionsArr[1] || '',
      'Option C': optionsArr[2] || '',
      'Option D': optionsArr[3] || '',
      'Correct Answer': q.correct_option || q.answer || 'A',
      'Explanation': q.explanation || '',
      'Status': q.is_active ? 'Published' : 'Draft',
      'Quality Score': q.quality_score || 'N/A',
      'Version': q.version_number || 1
    };
  });

  const csv = Papa.unparse(exportData);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  logAdminActivity('EXPORT_CSV', `Exported ${questions.length} questions to ${filename}`, 'export', { count: questions.length });
  toast.success(`Exported ${questions.length} questions to CSV!`);
};

/**
 * Export questions array to formatted PDF document
 */
export const exportQuestionsToPDF = (questions: any[], filename = 'Question_Bank_Export.pdf') => {
  if (!questions || questions.length === 0) {
    toast.error('No questions available to export.');
    return;
  }

  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Banner
  doc.setFillColor(30, 41, 59); // Dark slate background
  doc.rect(0, 0, pageWidth, 25, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('SCHOLARS RESORT - QUESTION BANK EXPORT', 14, 15);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString()} | Total Items: ${questions.length}`, pageWidth - 14, 15, { align: 'right' });

  let y = 35;

  questions.forEach((q, idx) => {
    // Check if we need a new page
    if (y > pageHeight - 40) {
      doc.addPage();
      y = 20;
    }

    const subjectName = q.subjects?.name || q.subject_name || 'General';
    const statusStr = q.is_active ? 'PUBLISHED' : 'DRAFT';

    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, pageWidth - 28, 7, 'F');

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`Q${idx + 1}. [${subjectName.toUpperCase()}] (${statusStr})`, 16, y + 5);

    y += 11;

    // Question Text
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const splitQuestion = doc.splitTextToSize(q.question_text || '', pageWidth - 32);
    doc.text(splitQuestion, 16, y);
    y += splitQuestion.length * 5 + 2;

    // Options
    let optionsArr: string[] = [];
    if (Array.isArray(q.options)) {
      optionsArr = q.options;
    } else if (typeof q.options === 'string') {
      try { optionsArr = JSON.parse(q.options); } catch { optionsArr = [q.options]; }
    }

    const letters = ['A', 'B', 'C', 'D'];
    optionsArr.forEach((opt, optIdx) => {
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }
      const isCorrect = (q.correct_option || q.answer || 'A').toUpperCase() === letters[optIdx];
      if (isCorrect) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(22, 163, 74); // Green
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
      }
      doc.text(`  (${letters[optIdx]}) ${opt}`, 18, y);
      y += 5;
    });

    if (q.explanation) {
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(8);
      const splitExp = doc.splitTextToSize(`Explanation: ${q.explanation}`, pageWidth - 36);
      doc.text(splitExp, 18, y + 2);
      y += splitExp.length * 4 + 4;
    }

    y += 4; // Spacing between questions
  });

  doc.save(filename);
  logAdminActivity('EXPORT_PDF', `Exported ${questions.length} questions to ${filename}`, 'export', { count: questions.length });
  toast.success(`Exported ${questions.length} questions to PDF!`);
};

/**
 * Export literature books & practice questions to CSV
 */
export const exportLiteratureToCSV = (books: any[], filename = 'JAMB_Literature_Bank_Export.csv') => {
  if (!books || books.length === 0) {
    toast.error('No literature data available to export.');
    return;
  }

  const rows: any[] = [];

  books.forEach(book => {
    if (book.chapters && book.chapters.length > 0) {
      book.chapters.forEach((ch: any) => {
        if (ch.sampleQuestions && ch.sampleQuestions.length > 0) {
          ch.sampleQuestions.forEach((q: any, qIdx: number) => {
            rows.push({
              'Novel Title': book.title,
              'Author': book.author,
              'Category': book.category || 'General',
              'Chapter ID': ch.id,
              'Chapter Title': ch.title,
              'Question #': qIdx + 1,
              'Question': q.question,
              'Option A': q.options?.[0] || '',
              'Option B': q.options?.[1] || '',
              'Option C': q.options?.[2] || '',
              'Option D': q.options?.[3] || '',
              'Correct Option': q.correct,
              'Explanation': q.explanation || ''
            });
          });
        } else {
          rows.push({
            'Novel Title': book.title,
            'Author': book.author,
            'Category': book.category || 'General',
            'Chapter ID': ch.id,
            'Chapter Title': ch.title,
            'Question #': 'N/A',
            'Question': 'No practice questions',
            'Option A': '', 'Option B': '', 'Option C': '', 'Option D': '',
            'Correct Option': '', 'Explanation': ''
          });
        }
      });
    } else {
      rows.push({
        'Novel Title': book.title,
        'Author': book.author,
        'Category': book.category || 'General',
        'Chapter ID': 'N/A',
        'Chapter Title': 'No chapters',
        'Question #': 'N/A',
        'Question': '',
        'Option A': '', 'Option B': '', 'Option C': '', 'Option D': '',
        'Correct Option': '', 'Explanation': ''
      });
    }
  });

  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  logAdminActivity('EXPORT_CSV', `Exported Literature Bank (${books.length} novels) to ${filename}`, 'export', { novels: books.length });
  toast.success(`Exported ${books.length} Literature Novels to CSV!`);
};

/**
 * Export literature books & practice questions to PDF
 */
export const exportLiteratureToPDF = (books: any[], filename = 'JAMB_Literature_Bank_Export.pdf') => {
  if (!books || books.length === 0) {
    toast.error('No literature data available to export.');
    return;
  }

  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 25, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('SCHOLARS RESORT - LITERATURE & NOVEL HUB', 14, 15);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - 14, 15, { align: 'right' });

  let y = 35;

  books.forEach((book, bIdx) => {
    if (y > pageHeight - 35) {
      doc.addPage();
      y = 20;
    }

    doc.setFillColor(238, 242, 255);
    doc.rect(14, y, pageWidth - 28, 10, 'F');

    doc.setTextColor(67, 56, 202);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`${bIdx + 1}. ${book.title.toUpperCase()} by ${book.author}`, 18, y + 7);

    y += 15;

    if (book.chapters && book.chapters.length > 0) {
      book.chapters.forEach((ch: any) => {
        if (y > pageHeight - 30) {
          doc.addPage();
          y = 20;
        }

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`  Chapter ${ch.id}: ${ch.title}`, 18, y);
        y += 6;

        if (ch.summary) {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(100, 116, 139);
          const splitSummary = doc.splitTextToSize(`Summary: ${ch.summary.slice(0, 300)}...`, pageWidth - 40);
          doc.text(splitSummary, 22, y);
          y += splitSummary.length * 4 + 3;
        }

        if (ch.sampleQuestions && ch.sampleQuestions.length > 0) {
          ch.sampleQuestions.forEach((q: any, qIdx: number) => {
            if (y > pageHeight - 25) {
              doc.addPage();
              y = 20;
            }

            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(15, 23, 42);
            doc.text(`    Q${qIdx + 1}: ${q.question}`, 22, y);
            y += 4.5;

            const letters = ['A', 'B', 'C', 'D'];
            (q.options || []).forEach((opt: string, optIdx: number) => {
              if (y > pageHeight - 15) {
                doc.addPage();
                y = 20;
              }
              const isCorrect = q.correct === letters[optIdx];
              doc.setFont('helvetica', isCorrect ? 'bold' : 'normal');
              doc.setTextColor(isCorrect ? 22 : 100, isCorrect ? 163 : 116, isCorrect ? 74 : 139);
              doc.text(`      (${letters[optIdx]}) ${opt}`, 26, y);
              y += 4;
            });

            y += 2;
          });
        }
        y += 4;
      });
    }

    y += 6;
  });

  doc.save(filename);
  logAdminActivity('EXPORT_PDF', `Exported Literature Bank (${books.length} novels) to ${filename}`, 'export', { novels: books.length });
  toast.success(`Exported Literature Bank to PDF!`);
};
