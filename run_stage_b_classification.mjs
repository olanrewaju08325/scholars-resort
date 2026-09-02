import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runStageBClassification() {
  const { data: subjects } = await supabase.from('subjects').select('*');
  const { data: topics } = await supabase.from('topics').select('*, subjects(name)');

  const subjMap = new Map(subjects.map(s => [s.id, s]));
  const topicMap = new Map(topics.map(t => [t.id, t]));

  const topicsBySubject = new Map();
  topics.forEach(t => {
    if (!topicsBySubject.has(t.subject_id)) topicsBySubject.set(t.subject_id, []);
    topicsBySubject.get(t.subject_id).push(t);
  });

  let page = 0;
  let allQuestions = [];
  while (true) {
    const { data } = await supabase
      .from('questions')
      .select('id, question_text, options, subject_id, topic_id, subjects(name)')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    allQuestions = allQuestions.concat(data);
    if (data.length < 1000) break;
    page++;
  }

  const unmappedQuestions = allQuestions.filter(q => !q.topic_id);
  console.log(`Unmapped questions count: ${unmappedQuestions.length}`);

  const subjectStats = {};
  subjects.forEach(s => {
    subjectStats[s.name] = {
      subject_id: s.id,
      total_unmapped: 0,
      high: 0,
      medium: 0,
      low: 0,
      unclassifiable: 0
    };
  });

  const highProposals = [];

  unmappedQuestions.forEach(q => {
    const subjObj = subjMap.get(q.subject_id);
    const subjName = subjObj ? subjObj.name : 'Unknown';
    if (!subjectStats[subjName]) {
      subjectStats[subjName] = { subject_id: q.subject_id, total_unmapped: 0, high: 0, medium: 0, low: 0, unclassifiable: 0 };
    }
    subjectStats[subjName].total_unmapped++;

    const availTopics = topicsBySubject.get(q.subject_id) || [];

    if (availTopics.length === 0) {
      subjectStats[subjName].unclassifiable++;
      return;
    }

    const qText = q.question_text.toLowerCase();
    let optsText = '';
    if (Array.isArray(q.options)) {
      optsText = q.options.join(' ').toLowerCase();
    } else if (typeof q.options === 'string') {
      optsText = q.options.toLowerCase();
    }
    const fullText = `${qText} ${optsText}`;

    // Test each topic in the subject
    let bestMatch = null;
    let highestScore = 0;
    let matchConfidence = 'UNCLASSIFIABLE';
    let matchReason = '';

    availTopics.forEach(t => {
      const topicName = t.name.toLowerCase();
      // Remove generic connector words
      const keyPhrases = topicName.split(/[,&]/).map(p => p.trim());

      let isExactPhrase = false;
      keyPhrases.forEach(kp => {
        if (kp.length > 3 && fullText.includes(kp)) {
          isExactPhrase = true;
        }
      });

      // Specific topic keywords
      if (t.name === 'Algebra') {
        if (fullText.includes('quadratic') || fullText.includes('simultaneous') || fullText.includes('factorize') || fullText.includes('polynomial') || fullText.includes('equation')) {
          bestMatch = t;
          matchConfidence = 'HIGH';
          matchReason = 'Question explicitly contains algebraic equations/keywords (quadratic, polynomial, factorize).';
        }
      } else if (t.name === 'Calculus') {
        if (fullText.includes('differentiation') || fullText.includes('integration') || fullText.includes('dy/dx') || fullText.includes('derivative') || fullText.includes('integral')) {
          bestMatch = t;
          matchConfidence = 'HIGH';
          matchReason = 'Question explicitly contains calculus operators/keywords (dy/dx, differentiation, integral).';
        }
      } else if (t.name === 'Mechanics') {
        if (fullText.includes('velocity') || fullText.includes('acceleration') || fullText.includes('momentum') || fullText.includes('friction') || fullText.includes('projectile') || fullText.includes('newton')) {
          bestMatch = t;
          matchConfidence = 'HIGH';
          matchReason = 'Question explicitly tests mechanics concepts (velocity, acceleration, momentum, friction).';
        }
      } else if (t.name.includes('Organic Chemistry')) {
        if (fullText.includes('alkane') || fullText.includes('alkene') || fullText.includes('alkyne') || fullText.includes('benzene') || fullText.includes('alcohol') || fullText.includes('ester') || fullText.includes('isomerism')) {
          bestMatch = t;
          matchConfidence = 'HIGH';
          matchReason = 'Question explicitly tests organic chemistry functional groups/compounds.';
        }
      } else if (t.name.includes('Atomic Structure')) {
        if (fullText.includes('isotope') || fullText.includes('electron configuration') || fullText.includes('proton') || fullText.includes('neutron') || fullText.includes('atomic number') || fullText.includes('mass number')) {
          bestMatch = t;
          matchConfidence = 'HIGH';
          matchReason = 'Question explicitly tests atomic structure and subatomic particles.';
        }
      } else if (t.name.includes('Kinetic Theory') || t.name.includes('Gas Laws')) {
        if (fullText.includes('boyle') || fullText.includes('charles') || fullText.includes('ideal gas') || fullText.includes('pressure') || fullText.includes('temperature') || fullText.includes('volume of gas')) {
          bestMatch = t;
          matchConfidence = 'HIGH';
          matchReason = 'Question explicitly tests kinetic theory and gas laws.';
        }
      } else if (t.name.includes('Separation of Mixtures')) {
        if (fullText.includes('filtration') || fullText.includes('distillation') || fullText.includes('chromatography') || fullText.includes('crystallization') || fullText.includes('fractional')) {
          bestMatch = t;
          matchConfidence = 'HIGH';
          matchReason = 'Question explicitly tests separation techniques (distillation, chromatography, filtration).';
        }
      } else if (t.name.includes('Chemical Bonding')) {
        if (fullText.includes('covalent') || fullText.includes('ionic') || fullText.includes('electrovalent') || fullText.includes('dative') || fullText.includes('hydrogen bond') || fullText.includes('hybridization')) {
          bestMatch = t;
          matchConfidence = 'HIGH';
          matchReason = 'Question explicitly tests chemical bonding types.';
        }
      } else if (t.name === 'Oral Forms') {
        if (fullText.includes('rhyme') || fullText.includes('stress') || fullText.includes('vowel') || fullText.includes('consonant') || fullText.includes('phonetic') || fullText.includes('sound')) {
          bestMatch = t;
          matchConfidence = 'HIGH';
          matchReason = 'Question explicitly tests oral English, stress, or phonetics.';
        }
      } else if (t.name === 'Comprehension' || t.name === 'Comprehension & Idioms') {
        if (fullText.includes('passage') || fullText.includes('according to the passage') || fullText.includes('the writer')) {
          bestMatch = t;
          matchConfidence = 'HIGH';
          matchReason = 'Question references reading passage comprehension.';
        }
      }
    });

    if (bestMatch && matchConfidence === 'HIGH') {
      subjectStats[subjName].high++;
      highProposals.push({
        question_id: q.id,
        subject_id: q.subject_id,
        subject_name: subjName,
        topic_id: bestMatch.id,
        topic_name: bestMatch.name,
        confidence: 'HIGH',
        reason: matchReason
      });
    } else {
      // Check for medium/low
      let foundMedium = false;
      availTopics.forEach(t => {
        if (!foundMedium && fullText.includes(t.name.toLowerCase().split(' ')[0])) {
          foundMedium = true;
        }
      });
      if (foundMedium) {
        subjectStats[subjName].medium++;
      } else if (availTopics.length > 0) {
        subjectStats[subjName].low++;
      } else {
        subjectStats[subjName].unclassifiable++;
      }
    }
  });

  console.log("\nSTAGE B PROPOSAL BREAKDOWN BY SUBJECT:");
  console.table(subjectStats);

  console.log(`\nTotal HIGH Confidence Proposals: ${highProposals.length}`);

  fs.writeFileSync('stage_b_high_proposals.json', JSON.stringify(highProposals, null, 2));
}

runStageBClassification();
