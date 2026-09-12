/**
 * Authoritative Practice Mode Question Counter & State-Tracking Utility
 * Eliminates all hardcoded mock counters, providing live real-time progress calculations.
 */

export interface PracticeCounterState {
  totalActiveQuestions: number;
  currentIndex: number;
  currentQuestionNumber: number;
  answeredCount: number;
  unansweredCount: number;
  correctCount: number;
  incorrectCount: number;
  progressPercentage: number;
  accuracyPercentage: number;
  isCompleted: boolean;
  canGoNext: boolean;
  canGoPrev: boolean;
  displaySummary: string;
}

export class PracticeSessionCounter {
  /**
   * Evaluates active session state and derives precise real-time counter metrics.
   */
  public static calculate(
    questions: any[],
    currentIndex: number,
    answersMap: Record<string, string>,
    correctAnswersMap: Record<string, boolean>
  ): PracticeCounterState {
    const validQuestions = Array.isArray(questions) ? questions.filter(Boolean) : [];
    const totalActiveQuestions = validQuestions.length;
    
    // Clamp current index within valid bounds
    const safeIndex = totalActiveQuestions > 0 
      ? Math.max(0, Math.min(currentIndex, totalActiveQuestions - 1))
      : 0;

    // Tally answered questions among the active question list
    let answeredCount = 0;
    let correctCount = 0;
    let incorrectCount = 0;

    validQuestions.forEach(q => {
      const qId = q.id;
      if (qId && answersMap[qId]) {
        answeredCount++;
        if (correctAnswersMap[qId] === true) {
          correctCount++;
        } else if (correctAnswersMap[qId] === false) {
          incorrectCount++;
        }
      }
    });

    const unansweredCount = Math.max(0, totalActiveQuestions - answeredCount);
    const progressPercentage = totalActiveQuestions > 0
      ? Math.min(100, Math.round((answeredCount / totalActiveQuestions) * 100))
      : 0;

    const accuracyPercentage = answeredCount > 0
      ? Math.round((correctCount / answeredCount) * 100)
      : 0;

    const isCompleted = totalActiveQuestions > 0 && answeredCount >= totalActiveQuestions;
    const canGoNext = safeIndex < totalActiveQuestions - 1;
    const canGoPrev = safeIndex > 0;

    const currentQuestionNumber = totalActiveQuestions > 0 ? safeIndex + 1 : 0;
    const displaySummary = `Question ${currentQuestionNumber} of ${totalActiveQuestions} • ${answeredCount}/${totalActiveQuestions} Answered (${progressPercentage}%)`;

    return {
      totalActiveQuestions,
      currentIndex: safeIndex,
      currentQuestionNumber,
      answeredCount,
      unansweredCount,
      correctCount,
      incorrectCount,
      progressPercentage,
      accuracyPercentage,
      isCompleted,
      canGoNext,
      canGoPrev,
      displaySummary
    };
  }
}
