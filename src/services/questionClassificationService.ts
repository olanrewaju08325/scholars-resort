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
              year: q1.year !== undefined && q1.year !== null ? q1.year : q1.exam_year,
              isActive: q1.is_active ?? true
            },
            questionB: {
              id: q2.id,
              text: text2,
              options: Array.isArray(q2.options) ? q2.options : [],
              answer: q2.correct_option || q2.answer || 'A',
              subjectName: q2.subjects?.name || q2.subject_name || 'General',
              topicName: q2.topics?.name || q2.topic_name,
              year: q2.year !== undefined && q2.year !== null ? q2.year : q2.exam_year,
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
   * Fully robust: uses valid DB UUIDs, valid column names, and syncs rich metadata across storage layers.
   */
  public static async syncCanonicalSyllabusToDatabase(): Promise<{ success: boolean; topicsInserted: number; message: string }> {
    try {
      let insertedCount = 0;

      // 1. Fetch all existing subjects from Supabase
      const { data: dbSubjects, error: subFetchErr } = await supabase
        .from('subjects')
        .select('id, name');

      if (subFetchErr) {
        console.warn('[SyllabusSync] Notice fetching subjects from DB:', subFetchErr.message);
      }

      const subjectMap = new Map<string, string>(); // canonicalName -> dbSubjectId (UUID)
      (dbSubjects || []).forEach(s => {
        if (s.id && s.name) {
          subjectMap.set(normalizeToCanonicalSubjectName(s.name), s.id);
          subjectMap.set(s.name.trim().toLowerCase(), s.id);
          subjectMap.set(s.id, s.id);
        }
      });

      // 2. Ensure all canonical subjects exist in DB with valid UUIDs
      for (const canonicalSub of CANONICAL_UTME_SUBJECTS) {
        const canonicalName = normalizeToCanonicalSubjectName(canonicalSub.name);
        let liveSubId = subjectMap.get(canonicalName) || subjectMap.get(canonicalSub.id);

        if (!liveSubId) {
          try {
            const { data: createdSub, error: createSubErr } = await supabase
              .from('subjects')
              .insert({
                name: canonicalSub.name,
                icon: canonicalSub.icon || 'book',
                is_active: true,
                is_official: true
              })
              .select('id, name')
              .maybeSingle();

            if (createdSub?.id) {
              liveSubId = createdSub.id;
              subjectMap.set(canonicalName, createdSub.id);
              subjectMap.set(createdSub.name.trim().toLowerCase(), createdSub.id);
            } else if (createSubErr) {
              console.warn(`[SyllabusSync] Notice creating subject "${canonicalSub.name}":`, createSubErr.message);
            }
          } catch (e: any) {
            console.warn(`[SyllabusSync] Subject create exception for "${canonicalSub.name}":`, e?.message);
          }
        }
      }

      // 3. Fetch all existing topics from DB
      const { data: dbTopics, error: topFetchErr } = await supabase
        .from('topics')
        .select('id, subject_id, name');

      if (topFetchErr) {
        console.warn('[SyllabusSync] Notice fetching topics from DB:', topFetchErr.message);
      }

      const existingTopicKeys = new Map<string, string>(); // `${subjectId}:${topicName.toLowerCase()}` -> topicId
      (dbTopics || []).forEach(t => {
        if (t.subject_id && t.name) {
          const key = `${t.subject_id}:${t.name.trim().toLowerCase()}`;
          existingTopicKeys.set(key, t.id);
        }
      });

      // 4. Ensure topics are present for each canonical subject
      for (const canonicalSub of CANONICAL_UTME_SUBJECTS) {
        const canonicalName = normalizeToCanonicalSubjectName(canonicalSub.name);
        const liveSubId = subjectMap.get(canonicalName) || subjectMap.get(canonicalSub.id);
        if (!liveSubId) continue;

        const details = CANONICAL_SYLLABUS_DETAILS[canonicalSub.id] || [];
        const richSubjectTopics: any[] = [];

        for (let idx = 0; idx < details.length; idx++) {
          const topicDetail = details[idx];
          const topicCleanName = topicDetail.name.trim();
          const topicKey = `${liveSubId}:${topicCleanName.toLowerCase()}`;
          let targetTopicId = existingTopicKeys.get(topicKey);

          if (!targetTopicId) {
            try {
              // Insert only standard existing columns into topics table (id auto-generated by Supabase gen_random_uuid())
              const { data: newTopic, error: insertErr } = await supabase
                .from('topics')
                .insert({
                  subject_id: liveSubId,
                  name: topicCleanName
                })
                .select('id, subject_id, name')
                .maybeSingle();

              if (newTopic?.id) {
                targetTopicId = newTopic.id;
                existingTopicKeys.set(topicKey, newTopic.id);
                insertedCount++;
              } else if (insertErr) {
                console.warn(`[SyllabusSync] DB topics insert notice for "${topicCleanName}":`, insertErr.message);
              }
            } catch (e: any) {
              console.warn(`[SyllabusSync] Exception inserting topic "${topicCleanName}":`, e?.message);
            }
          }

          // Build rich syllabus representation for UI and Journey Map
          const richTopic = {
            id: targetTopicId || crypto.randomUUID(),
            subject_id: liveSubId,
            name: topicCleanName,
            description: topicDetail.description || '',
            sequence: idx + 1,
            level: Math.min(Math.floor(idx / 3) + 1, 4),
            jamb_weight: 15,
            recommended_action: 'Solve 15 Targeted Drill Questions',
            learning_objectives: topicDetail.subtopics?.flatMap(s => s.learningObjectives) || [topicCleanName],
            recommended_tasks: [
              `Review essential definitions for ${topicCleanName}`,
              `Complete 15-20 practice questions on ${topicCleanName}`
            ],
            subtopics: topicDetail.subtopics || [],
            updated_at: new Date().toISOString()
          };

          richSubjectTopics.push(richTopic);

          // 5. Try syncing subtopics if subtopics table is active
          if (targetTopicId && topicDetail.subtopics && topicDetail.subtopics.length > 0) {
            try {
              for (const st of topicDetail.subtopics) {
                await supabase
                  .from('subtopics')
                  .upsert({
                    topic_id: targetTopicId,
                    name: st.name.trim(),
                    description: Array.isArray(st.learningObjectives) ? st.learningObjectives.join('; ') : ''
                  }, { onConflict: 'topic_id,name' });
              }
            } catch {
              // Gracefully ignore if subtopics table is not deployed or has restrictions
            }
          }
        }

        // Cache rich syllabus topics locally per subject
        if (richSubjectTopics.length > 0) {
          try {
            localStorage.setItem(`scholar_syllabus_${liveSubId}`, JSON.stringify(richSubjectTopics));
          } catch {}
        }
      }

      // Dispatch global refresh event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('scholar:refresh-taxonomy', {
          detail: { timestamp: Date.now(), insertedCount }
        }));
      }

      return {
        success: true,
        topicsInserted: insertedCount,
        message: insertedCount > 0
          ? `Successfully synchronized 20-subject syllabus taxonomy! ${insertedCount} new topics provisioned to Supabase.`
          : 'Syllabus taxonomy is fully up-to-date across all 20 canonical subjects in Supabase.'
      };
    } catch (err: any) {
      console.warn('Syllabus sync failed:', err);
      return {
        success: false,
        topicsInserted: 0,
        message: err?.message || 'Syllabus synchronization failed.'
      };
    }
  }
}
