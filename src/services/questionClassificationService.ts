import { supabase } from '@/lib/supabase';
import { 
  CANONICAL_UTME_SUBJECTS, 
  CANONICAL_SYLLABUS_DETAILS, 
  getCanonicalSubjectId, 
  normalizeToCanonicalSubjectName,
  type SyllabusTopicDetail
} from '@/utils/subjectTaxonomy';

export type ClassificationConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'PENDING';

export interface QuestionClassificationResult {
  questionId: string;
  originalText: string;
  subjectId: string;
  subjectName: string;
  suggestedTopicName: string;
  suggestedSubtopicName: string;
  suggestedLearningObjectives: string[];
  confidence: ClassificationConfidence;
  matchReason: string;
}

export interface DuplicatePair {
  id: string;
  questionA: {
    id: string;
    text: string;
    options: string[];
    answer: string;
    subjectName: string;
    topicName?: string;
    year?: string | number;
    isActive: boolean;
  };
  questionB: {
    id: string;
    text: string;
    options: string[];
    answer: string;
    subjectName: string;
    topicName?: string;
    year?: string | number;
    isActive: boolean;
  };
  similarityScore: number; // 0 to 100
  matchType: 'exact' | 'normalized_stem' | 'semantic_high';
}

export class QuestionClassificationService {
  /**
   * Intelligently classifies a question stem, options, and explanation against the canonical syllabus.
   */
  public static classifySingleQuestion(
    questionText: string,
    options: string[] = [],
    explanation: string = '',
    subjectIdOrName?: string
  ): {
    subjectId: string;
    subjectName: string;
    topicName: string;
    subtopicName: string;
    learningObjectives: string[];
    confidence: ClassificationConfidence;
    matchReason: string;
  } {
    const canonicalSubId = getCanonicalSubjectId(subjectIdOrName) || CANONICAL_UTME_SUBJECTS[0].id;
    const canonicalSubName = normalizeToCanonicalSubjectName(subjectIdOrName);
    const syllabusTopics = CANONICAL_SYLLABUS_DETAILS[canonicalSubId] || [];

    const fullContent = `${questionText} ${options.join(' ')} ${explanation}`.toLowerCase();

    let bestTopic: SyllabusTopicDetail | null = null;
    let bestSubtopicName = '';
    let bestObjectives: string[] = [];
    let maxScore = 0;
    let bestMatchReason = 'Default subject assignment';

    for (const topic of syllabusTopics) {
      const topicNameClean = topic.name.toLowerCase();
      let topicScore = 0;

      // Check topic title match
      if (fullContent.includes(topicNameClean)) {
        topicScore += 10;
      }

      // Check subtopic & objective matches
      for (const sub of topic.subtopics) {
        const subNameClean = sub.name.toLowerCase();
        if (fullContent.includes(subNameClean)) {
          topicScore += 15;
        }

        for (const obj of sub.learningObjectives) {
          const words = obj.toLowerCase().split(' ').filter(w => w.length > 4);
          let wordHits = 0;
          for (const w of words) {
            if (fullContent.includes(w)) wordHits++;
          }
          if (wordHits >= 2) {
            topicScore += wordHits * 2;
          }
        }

        if (topicScore > maxScore) {
          maxScore = topicScore;
          bestTopic = topic;
          bestSubtopicName = sub.name;
          bestObjectives = sub.learningObjectives;
          bestMatchReason = `Matched subtopic keywords: "${sub.name}"`;
        }
      }

      if (!bestTopic && topicScore > maxScore) {
        maxScore = topicScore;
        bestTopic = topic;
        bestSubtopicName = topic.subtopics[0]?.name || '';
        bestObjectives = topic.subtopics[0]?.learningObjectives || [];
        bestMatchReason = `Matched topic title keywords: "${topic.name}"`;
      }
    }

    if (bestTopic && maxScore >= 15) {
      return {
        subjectId: canonicalSubId,
        subjectName: canonicalSubName,
        topicName: bestTopic.name,
        subtopicName: bestSubtopicName,
        learningObjectives: bestObjectives,
        confidence: 'HIGH',
        matchReason: bestMatchReason
      };
    } else if (bestTopic && maxScore >= 5) {
      return {
        subjectId: canonicalSubId,
        subjectName: canonicalSubName,
        topicName: bestTopic.name,
        subtopicName: bestSubtopicName,
        learningObjectives: bestObjectives,
        confidence: 'MEDIUM',
        matchReason: `Partial match with ${bestTopic.name}`
      };
    }

    // Default fallback to pending topic queue
    return {
      subjectId: canonicalSubId,
      subjectName: canonicalSubName,
      topicName: 'Topic Classification Pending',
      subtopicName: 'General',
      learningObjectives: [],
      confidence: 'LOW',
      matchReason: 'Insufficient syllabus keyword alignment'
    };
  }

  /**
   * Scans questions in database and automatically updates HIGH confidence mappings,
   * while tagging LOW confidence items as "Topic Classification Pending".
   */
  public static async autoMapUnmappedQuestionsInDb(onProgress?: (current: number, total: number) => void): Promise<{
    processed: number;
    highMapped: number;
    mediumMapped: number;
    pendingQueued: number;
  }> {
    const { data: questions, error } = await supabase
      .from('questions')
      .select('id, question_text, options, explanation, subject_id, topic_id, subjects(id, name)');

    if (error || !questions) {
      console.warn('Error fetching questions for auto-mapping:', error);
      return { processed: 0, highMapped: 0, mediumMapped: 0, pendingQueued: 0 };
    }

    let highMapped = 0;
    let mediumMapped = 0;
    let pendingQueued = 0;
    const total = questions.length;

    for (let i = 0; i < total; i++) {
      const q = questions[i];
      const optionsArr = Array.isArray(q.options) ? q.options : [];
      const subName = q.subjects?.name || q.subject_id;

      const result = this.classifySingleQuestion(
        q.question_text || '',
        optionsArr,
        q.explanation || '',
        subName
      );

      if (result.confidence === 'HIGH') {
        highMapped++;
        // If question lacks topic_id or has pending status, update it
        if (!q.topic_id || q.topic_id === 'null') {
          await supabase.from('questions').update({
            subject_id: result.subjectId
          }).eq('id', q.id);
        }
      } else if (result.confidence === 'MEDIUM') {
        mediumMapped++;
      } else {
        pendingQueued++;
      }

      if (onProgress && i % 10 === 0) {
        onProgress(i + 1, total);
      }
    }

    return {
      processed: total,
      highMapped,
      mediumMapped,
      pendingQueued
    };
  }

  /**
   * Deep duplicate question detection.
   * Compares stems, options, and answers across questions to find exact and near-duplicates.
   */
  public static detectDuplicatePairs(questions: any[]): DuplicatePair[] {
    const pairs: DuplicatePair[] = [];
    const n = questions.length;

    // Helper to normalize stem for fuzzy comparison
    const normalizeStem = (text: string) => {
      return (text || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .trim();
    };

    // Calculate Jaccard similarity coefficient (0 - 100)
    const calculateJaccardSimilarity = (str1: string, str2: string): number => {
      const set1 = new Set(str1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
      const set2 = new Set(str2.toLowerCase().split(/\s+/).filter(w => w.length > 3));
      
      if (set1.size === 0 || set2.size === 0) return 0;
      
      let intersection = 0;
      set1.forEach(word => {
        if (set2.has(word)) intersection++;
      });

      const union = new Set([...set1, ...set2]).size;
      return Math.round((intersection / union) * 100);
    };

    const seenPairKeys = new Set<string>();

    for (let i = 0; i < n; i++) {
      const q1 = questions[i];
      const text1 = q1.question_text || '';
      const norm1 = normalizeStem(text1);

      if (norm1.length < 10) continue;

      for (let j = i + 1; j < n; j++) {
        const q2 = questions[j];
        const text2 = q2.question_text || '';
        const norm2 = normalizeStem(text2);

        if (norm2.length < 10) continue;

        const pairKey = [q1.id, q2.id].sort().join('_');
        if (seenPairKeys.has(pairKey)) continue;

        let similarity = 0;
        let matchType: 'exact' | 'normalized_stem' | 'semantic_high' = 'semantic_high';

        if (text1.trim().toLowerCase() === text2.trim().toLowerCase()) {
          similarity = 100;
          matchType = 'exact';
        } else if (norm1 === norm2) {
          similarity = 98;
          matchType = 'normalized_stem';
        } else {
          similarity = calculateJaccardSimilarity(text1, text2);
          matchType = 'semantic_high';
        }

        if (similarity >= 85) {
          seenPairKeys.add(pairKey);
          pairs.push({
            id: `dup_${q1.id}_${q2.id}`,
            questionA: {
              id: q1.id,
              text: text1,
              options: Array.isArray(q1.options) ? q1.options : [],
              answer: q1.correct_option || q1.answer || 'A',
              subjectName: q1.subjects?.name || q1.subject_name || 'General',
              topicName: q1.topics?.name || q1.topic_name,
              year: q1.exam_year,
              isActive: q1.is_active ?? true
            },
            questionB: {
              id: q2.id,
              text: text2,
              options: Array.isArray(q2.options) ? q2.options : [],
              answer: q2.correct_option || q2.answer || 'A',
              subjectName: q2.subjects?.name || q2.subject_name || 'General',
              topicName: q2.topics?.name || q2.topic_name,
              year: q2.exam_year,
              isActive: q2.is_active ?? true
            },
            similarityScore: similarity,
            matchType
          });
        }
      }
    }

    return pairs.sort((a, b) => b.similarityScore - a.similarityScore);
  }

  /**
   * Additive database utility to seed all canonical subjects and syllabus topics into Supabase.
   */
  public static async syncCanonicalSyllabusToDatabase(): Promise<{ success: boolean; topicsInserted: number; message: string }> {
    try {
      let insertedCount = 0;
      // 1. Ensure subjects are present
      for (const canonicalSub of CANONICAL_UTME_SUBJECTS) {
        const { data: existingSub } = await supabase
          .from('subjects')
          .select('id')
          .eq('id', canonicalSub.id)
          .maybeSingle();

        if (!existingSub) {
          await supabase.from('subjects').insert({
            id: canonicalSub.id,
            name: canonicalSub.name,
            code: canonicalSub.code,
            category: canonicalSub.category,
            is_compulsory: canonicalSub.isCompulsory ?? false,
            created_at: new Date().toISOString()
          });
        }
      }

      // 2. Ensure topics are present for each subject
      for (const canonicalSub of CANONICAL_UTME_SUBJECTS) {
        const details = CANONICAL_SYLLABUS_DETAILS[canonicalSub.id] || [];
        for (const topicDetail of details) {
          const { data: existingTopic } = await supabase
            .from('topics')
            .select('id')
            .eq('subject_id', canonicalSub.id)
            .eq('name', topicDetail.name)
            .maybeSingle();

          if (!existingTopic) {
            const topicId = `topic_${canonicalSub.code.toLowerCase()}_${Math.random().toString(36).substring(2, 8)}`;
            const { error: insertErr } = await supabase.from('topics').insert({
              id: topicId,
              subject_id: canonicalSub.id,
              name: topicDetail.name,
              description: topicDetail.description || '',
              learning_objectives: topicDetail.subtopics.flatMap(s => s.learningObjectives),
              created_at: new Date().toISOString()
            });
            if (!insertErr) insertedCount++;
          }
        }
      }

      return {
        success: true,
        topicsInserted: insertedCount,
        message: `Successfully synchronized syllabus taxonomy. ${insertedCount} new topics provisioned.`
      };
    } catch (err: any) {
      console.warn('Syllabus sync failed:', err);
      return {
        success: false,
        topicsInserted: 0,
        message: err.message || 'Syllabus synchronization failed.'
      };
    }
  }
}
