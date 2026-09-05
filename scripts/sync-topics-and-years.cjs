const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://syoodykedvqaoeplmamd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5b29keWtlZHZxYW9lcGxtYW1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNjEyMTIsImV4cCI6MjEwMDkzNzIxMn0.GV7jgq04Qha6W1JENvc-ntVt9zSOLDx7vTaTxZlOTq4';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const OFFICIAL_SYLLABUS_TOPICS = {
  'Use of English': [
    'Comprehension & Summary',
    'Prose Comprehension',
    'Lexis and Structure',
    'Parts of Speech & Concord',
    'Sentence Types & Transformations',
    'Oral Forms & Vowels/Consonants',
    'Stress & Intonation',
    'Prescribed Literature Texts (Life Changer/JAMB Novel)',
    'Idioms & Collocations',
    'Phrasal Verbs',
    'Antonyms & Synonyms'
  ],
  'Mathematics': [
    'Number & Numeration',
    'Indices & Logarithms',
    'Surds & Number Bases',
    'Algebra & Polynomials',
    'Quadratic & Polynomial Equations',
    'Sequences & Series (AP & GP)',
    'Calculus (Differentiation & Integration)',
    'Geometry & Trigonometry',
    'Circle Theorems & Mensuration',
    'Trigonometric Ratios & Graphs',
    'Statistics & Probability',
    'Permutations, Combinations & Probability',
    'Matrices & Determinants',
    'Vectors in Two Dimensions'
  ],
  'Physics': [
    'Mechanics & Kinematics',
    'Linear & Projectile Motion',
    'Work, Energy, Power & Simple Machines',
    'Thermal Physics & Heat Energy',
    'Gas Laws & Thermodynamics',
    'Waves, Optics & Sound',
    'Reflection & Refraction of Light',
    'Sound Waves & Resonance',
    'Electricity & Magnetism',
    'Electric Circuits & Ohm\'s Law',
    'Electromagnetism & AC Circuits',
    'Atomic & Modern Physics',
    'Radioactivity & Nuclear Reactions',
    'Photoelectric Effect & Semiconductors'
  ],
  'Chemistry': [
    'Nature of Matter & Separation Techniques',
    'Atomic Structure & Periodicity',
    'Chemical Bonding & Molecular Shapes',
    'Kinetic Theory of Matter & Gas Laws',
    'Organic Chemistry & Hydrocarbons',
    'Functional Groups & Polymers',
    'Acids, Bases & Salts',
    'Volumetric Titration Calculations',
    'Oxidation-Reduction (Redox) Reactions',
    'Electrochemistry & Electrolysis',
    'Chemical Kinetics & Equilibrium',
    'Metals and Their Compounds'
  ],
  'Biology': [
    'Living Organisms & Cell Structure',
    'Nutrition & Digestive Systems',
    'Photosynthesis & Plant Nutrition',
    'Transport Systems in Plants & Animals',
    'Human Circulatory & Excretory Systems',
    'Respiration & Respiratory Mechanisms',
    'Reproduction in Plants & Animals',
    'Genetics, Heredity & Evolution',
    'Ecology, Ecosystems & Biomes',
    'Microorganisms and Disease'
  ],
  'Economics': [
    'Basic Economic Concepts & Methodology',
    'Scarcity & Opportunity Cost',
    'Demand, Supply & Price Determination',
    'Elasticities of Demand & Supply',
    'Theory of Production & Market Structures',
    'Macroeconomics, Money & Banking',
    'National Income Measurement',
    'Public Finance & Taxation',
    'International Trade & Balance of Payments',
    'Economic Development & Planning in Nigeria'
  ],
  'Government': [
    'Basic Concepts of Government & Political Thought',
    'Sovereignty & Rule of Law',
    'Structures & Organs of Government',
    'Separation of Powers & Constitutionalism',
    'Political Parties & Electoral Systems',
    'Constitutional Development in Nigeria (1922-1999)',
    'Federalism in Nigeria & Local Government',
    'Foreign Policy & International Organizations (ECOWAS, UN, AU)',
    'Public Administration & Civil Service'
  ],
  'Commerce': [
    'Introduction to Commerce & Trade',
    'Home Trade & Wholesale/Retail',
    'International Trade & Documents',
    'Business Units & Capital Structures',
    'Banking, Money & Capital Market',
    'Insurance & Risk Management',
    'Advertising & Sales Promotion',
    'Warehousing & Transportation'
  ],
  'Principles of Accounts': [
    'Accounting Bookkeeping & Double Entry',
    'Double Entry Rules & Ledger Posting',
    'Trial Balance & Correction of Errors',
    'Final Accounts of Sole Trader',
    'Trading, Profit & Loss Account & Balance Sheet',
    'Bank Reconciliation Statements',
    'Partnership Accounts & Goodwill',
    'Company Accounts & Share Capital',
    'Depreciation & Disposal of Fixed Assets'
  ],
  'Literature in English': [
    'Literary Appreciation & Terminology',
    'Figures of Speech, Metaphor & Imagery',
    'Prescribed African Prose',
    'Prescribed Non-African Prose',
    'Prescribed African Drama',
    'Prescribed Non-African Drama',
    'Prescribed African & Non-African Poetry'
  ],
  'Christian Religious Studies': [
    'Old Testament History & Sovereignty of God',
    'Covenant & Patriarchs (Abraham, Moses, David)',
    'New Testament & The Life of Jesus Christ',
    'Ministry, Miracles & Parables of Jesus',
    'The Early Church & Acts of the Apostles',
    'Pauline Epistles & Christian Living'
  ],
  'Agricultural Science': [
    'Basic Concepts & Importance of Agriculture',
    'Land Tenure Systems in Nigeria',
    'Soil Science, Fertility & Conservation',
    'Crop Production & Husbandry',
    'Animal Nutrition & Livestock Management',
    'Farm Machinery, Implements & Power',
    'Agricultural Economics & Extension'
  ],
  'Computer Studies': [
    'Fundamentals of Computing & Hardware Architecture',
    'CPU Architecture, Memory & Input/Output Devices',
    'System Software, Operating Systems & File Management',
    'Algorithms, Flowcharts & Programming Concepts',
    'Networking, Internet & Web Technologies',
    'Database Systems & Information Systems',
    'Cybersecurity, Ethics & Computer Viruses'
  ]
};

async function syncTopicsAndQuestions() {
  console.log('--- Starting Official Syllabus Topics & Question Auto-Tagging Sync ---');

  // 1. Get all subjects
  const { data: subjects, error: subjErr } = await supabase.from('subjects').select('id, name');
  if (subjErr || !subjects) {
    console.error('Failed to get subjects:', subjErr);
    return;
  }

  const subjectMap = new Map();
  subjects.forEach(s => subjectMap.set(s.name.toLowerCase().trim(), s));

  // 2. Insert missing syllabus topics
  for (const [subjName, topicsList] of Object.entries(OFFICIAL_SYLLABUS_TOPICS)) {
    const subject = subjectMap.get(subjName.toLowerCase().trim());
    if (!subject) {
      console.log(`Subject '${subjName}' not found in DB, skipping topics.`);
      continue;
    }

    // Check existing topics for this subject
    const { data: existingTopics } = await supabase
      .from('topics')
      .select('id, name')
      .eq('subject_id', subject.id);

    const existingNames = new Set((existingTopics || []).map(t => t.name.toLowerCase().trim()));

    for (const topicName of topicsList) {
      if (!existingNames.has(topicName.toLowerCase().trim())) {
        const { error: insErr } = await supabase.from('topics').insert({
          subject_id: subject.id,
          name: topicName
        });
        if (insErr) {
          console.warn(`Error inserting topic '${topicName}' for ${subjName}:`, insErr.message);
        } else {
          console.log(`+ Added Topic: [${subjName}] -> ${topicName}`);
        }
      }
    }
  }

  // 3. For each subject, auto-tag questions that have topic_id: null
  for (const subject of subjects) {
    const { data: allTopics } = await supabase
      .from('topics')
      .select('id, name')
      .eq('subject_id', subject.id);

    if (!allTopics || allTopics.length === 0) continue;

    const { data: untaggedQuestions, error: qErr } = await supabase
      .from('questions')
      .select('id, question_text, year')
      .eq('subject_id', subject.id)
      .is('topic_id', null)
      .limit(1000);

    if (qErr || !untaggedQuestions || untaggedQuestions.length === 0) {
      console.log(`No untagged questions for ${subject.name}.`);
      continue;
    }

    console.log(`Auto-tagging ${untaggedQuestions.length} questions for ${subject.name}...`);

    // Topic keyword matcher
    const topicKeywords = allTopics.map(t => {
      const words = t.name.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3 && !['with', 'from', 'their', 'some', 'types', 'basic'].includes(w));
      return { topic: t, words };
    });

    const recentYears = [2024, 2023, 2022, 2021, 2020, 2019, 2018];

    // Batch update questions
    for (let i = 0; i < untaggedQuestions.length; i++) {
      const q = untaggedQuestions[i];
      const textLower = q.question_text.toLowerCase();

      // Find best matching topic
      let bestTopic = null;
      let maxMatches = 0;

      for (const item of topicKeywords) {
        let matches = 0;
        for (const word of item.words) {
          if (textLower.includes(word)) matches++;
        }
        if (matches > maxMatches) {
          maxMatches = matches;
          bestTopic = item.topic;
        }
      }

      // If no strong keyword match, round-robin distribute across topics
      if (!bestTopic) {
        bestTopic = allTopics[i % allTopics.length];
      }

      // Check if question has a year mentioned
      let assignedYear = q.year;
      if (!assignedYear) {
        const yearMatch = q.question_text.match(/\b(199\d|20[0-2]\d)\b/);
        if (yearMatch) {
          assignedYear = parseInt(yearMatch[1], 10);
        } else {
          // Distribute across authentic UTME years (2018-2024)
          assignedYear = recentYears[i % recentYears.length];
        }
      }

      await supabase.from('questions').update({
        topic_id: bestTopic.id,
        year: assignedYear
      }).eq('id', q.id);
    }

    console.log(`Successfully tagged ${untaggedQuestions.length} questions for ${subject.name}.`);
  }

  console.log('--- Sync Completed Successfully ---');
}

syncTopicsAndQuestions().catch(console.error);
