import { supabase } from '@/lib/supabase';
import { db } from '@/lib/db';

export interface JourneyNode {
  id: string;
  subjectId: string;
  subjectName: string;
  topicName: string;
  unitName: string;
  level: number;
  sequence: number;
  prerequisites: string[]; // Node IDs required
  jambWeightPercent: number; // Weight in UTME Exam
  description: string;
  keyConcepts: string[];
  status: 'mastered' | 'in_progress' | 'locked';
  accuracyPercentage: number;
  questionsAttempted: number;
  correctAnswers: number;
  recommendedAction: string;
}

export interface SubjectJourney {
  subjectId: string;
  subjectName: string;
  totalNodes: number;
  masteredNodes: number;
  completionPercentage: number;
  nodes: JourneyNode[];
}

export interface OverallJourneyProgress {
  totalMastered: number;
  totalTopics: number;
  overallPercentage: number;
  currentActiveTopic: JourneyNode | null;
  subjectJourneys: Record<string, SubjectJourney>;
}

// Master UTME Syllabus Topic Database
const UTME_SYLLABUS_NODES: Omit<JourneyNode, 'status' | 'accuracyPercentage' | 'questionsAttempted' | 'correctAnswers'>[] = [
  // --- USE OF ENGLISH ---
  {
    id: 'eng_01',
    subjectId: 'use_of_english',
    subjectName: 'Use of English',
    topicName: 'Comprehension & Passage Interpretation',
    unitName: 'Section A: Comprehension',
    level: 1,
    sequence: 1,
    prerequisites: [],
    jambWeightPercent: 20,
    description: 'Mastering speed reading, inference, paragraph summaries, and contextual tone in JAMB passages.',
    keyConcepts: ['Direct Statement vs Inference', 'Tone & Mood Identification', 'Contextual Word Substitution', 'Main Idea Extraction'],
    recommendedAction: 'Solve 10 Comprehension Passages'
  },
  {
    id: 'eng_02',
    subjectId: 'use_of_english',
    subjectName: 'Use of English',
    topicName: 'Grammar: Concord & Subject-Verb Agreement',
    unitName: 'Section B: Lexis & Structure',
    level: 1,
    sequence: 2,
    prerequisites: ['eng_01'],
    jambWeightPercent: 15,
    description: 'Rules of proximity, singular/plural subjects, paired conjunctions, and collective nouns.',
    keyConcepts: ['Rule of Proximity', 'Plural Nouns with Singular Verbs', 'Neither/Either Structures', 'Uncountable Noun Concord'],
    recommendedAction: 'Practice 15 Concord Questions'
  },
  {
    id: 'eng_03',
    subjectId: 'use_of_english',
    subjectName: 'Use of English',
    topicName: 'Lexis: Synonyms, Antonyms & Idioms',
    unitName: 'Section B: Lexis & Structure',
    level: 2,
    sequence: 3,
    prerequisites: ['eng_02'],
    jambWeightPercent: 25,
    description: 'Identifying nearest/opposite in meaning and decoding figurative idiomatic expressions.',
    keyConcepts: ['Nearest in Meaning', 'Opposite in Meaning', 'Contextual Idioms', 'Collocations & Phrasal Verbs'],
    recommendedAction: 'Complete Vocabulary Sprint'
  },
  {
    id: 'eng_04',
    subjectId: 'use_of_english',
    subjectName: 'Use of English',
    topicName: 'Oral Forms: Vowels, Consonants & Stress',
    unitName: 'Section C: Oral Forms',
    level: 2,
    sequence: 4,
    prerequisites: ['eng_03'],
    jambWeightPercent: 20,
    description: 'Monophthongs, diphthongs, silent letters, rhyme words, and syllable stress placement.',
    keyConcepts: ['Short vs Long Vowels', 'Voiced vs Voiceless Consonants', 'Emphatic Stress', 'Rhymes & Homophones'],
    recommendedAction: 'Take 15 Oral English Drills'
  },
  {
    id: 'eng_05',
    subjectId: 'use_of_english',
    subjectName: 'Use of English',
    topicName: 'Mandatory Novel: The Life Changer',
    unitName: 'Section D: Prescribed Text',
    level: 3,
    sequence: 5,
    prerequisites: ['eng_04'],
    jambWeightPercent: 20,
    description: 'In-depth analysis of character roles, themes, plot points, and key quotes from the prescribed novel.',
    keyConcepts: ['Character Profiles (Omar, Ummi)', 'Major Themes (Corruption, Integrity)', 'Plot Milestones', 'Direct Quotes Analysis'],
    recommendedAction: 'Take Novel Mastery Quiz'
  },

  // --- MATHEMATICS ---
  {
    id: 'math_01',
    subjectId: 'mathematics',
    subjectName: 'Mathematics',
    topicName: 'Number Bases & Indices & Logarithms',
    unitName: 'Unit 1: Number Systems',
    level: 1,
    sequence: 1,
    prerequisites: [],
    jambWeightPercent: 12,
    description: 'Base conversions, laws of indices, and logarithmic equations with base properties.',
    keyConcepts: ['Base 2 to 10 Conversions', 'Laws of Indices', 'Logarithmic Change of Base', 'Surds Rationalization'],
    recommendedAction: 'Solve 10 Number Base Drill Questions'
  },
  {
    id: 'math_02',
    subjectId: 'mathematics',
    subjectName: 'Mathematics',
    topicName: 'Polynomials & Quadratic Equations',
    unitName: 'Unit 2: Algebra',
    level: 1,
    sequence: 2,
    prerequisites: ['math_01'],
    jambWeightPercent: 18,
    description: 'Factorization, quadratic formula, remainder & factor theorem, and roots of quadratics.',
    keyConcepts: ['Factor Theorem & Remainder Theorem', 'Completing the Square', 'Discriminant & Roots (alpha, beta)', 'Simultaneous Equations'],
    recommendedAction: 'Solve 15 Quadratic Drills'
  },
  {
    id: 'math_03',
    subjectId: 'mathematics',
    subjectName: 'Mathematics',
    topicName: 'Trigonometry & Bearings',
    unitName: 'Unit 3: Trigonometry',
    level: 2,
    sequence: 3,
    prerequisites: ['math_02'],
    jambWeightPercent: 15,
    description: 'Sine and cosine rules, trigonometric ratios, 3D angles, and cardinal bearings.',
    keyConcepts: ['Sine & Cosine Rules', 'Angles of Elevation & Depression', 'True Bearings (3-figure)', 'Trig Identities'],
    recommendedAction: 'Practice Trigonometric Calculations'
  },
  {
    id: 'math_04',
    subjectId: 'mathematics',
    subjectName: 'Mathematics',
    topicName: 'Coordinate Geometry & Matrices',
    unitName: 'Unit 4: Geometry & Matrices',
    level: 2,
    sequence: 4,
    prerequisites: ['math_03'],
    jambWeightPercent: 15,
    description: 'Slope, midpoint, perpendicular lines, matrix multiplication, and 2x2 determinants.',
    keyConcepts: ['Gradient & Line Equation', 'Distance Between Points', 'Matrix Determinants', 'Inverse Matrix (2x2)'],
    recommendedAction: 'Complete Coordinate Geometry Drill'
  },
  {
    id: 'math_05',
    subjectId: 'mathematics',
    subjectName: 'Mathematics',
    topicName: 'Calculus: Differentiation & Integration',
    unitName: 'Unit 5: Calculus',
    level: 3,
    sequence: 5,
    prerequisites: ['math_04'],
    jambWeightPercent: 20,
    description: 'First principles, power rule, chain rule, integration by substitution, and area under curves.',
    keyConcepts: ['Power Rule (dy/dx)', 'Chain & Product Rule', 'Definite Integration', 'Maxima & Minima Points'],
    recommendedAction: 'Solve 15 Calculus Problems'
  },

  // --- PHYSICS ---
  {
    id: 'phy_01',
    subjectId: 'physics',
    subjectName: 'Physics',
    topicName: 'Units, Vectors & Motion Kinematics',
    unitName: 'Unit 1: Mechanics',
    level: 1,
    sequence: 1,
    prerequisites: [],
    jambWeightPercent: 15,
    description: 'Fundamental units, scalar vs vector addition, equations of uniform acceleration, and projectile motion.',
    keyConcepts: ['SI Units & Dimensions', 'Vector Resolution (Resultants)', 'Equations of Motion (v=u+at)', 'Projectile Height & Range'],
    recommendedAction: 'Solve Kinematics Problems'
  },
  {
    id: 'phy_02',
    subjectId: 'physics',
    subjectName: 'Physics',
    topicName: 'Work, Energy, Power & Machines',
    unitName: 'Unit 1: Mechanics',
    level: 1,
    sequence: 2,
    prerequisites: ['phy_01'],
    jambWeightPercent: 15,
    description: 'Conservation of mechanical energy, efficiency of simple machines (pulleys, inclined planes).',
    keyConcepts: ['Kinetic vs Potential Energy', 'Velocity Ratio (VR)', 'Mechanical Advantage (MA)', 'Machine Efficiency Formula'],
    recommendedAction: 'Practice Machine Calculations'
  },
  {
    id: 'phy_03',
    subjectId: 'physics',
    subjectName: 'Physics',
    topicName: 'Thermal Physics & Gas Laws',
    unitName: 'Unit 2: Heat Energy',
    level: 2,
    sequence: 3,
    prerequisites: ['phy_02'],
    jambWeightPercent: 15,
    description: 'Specific heat capacity, latent heat, expansion, and Boyle\'s / Charles\' gas laws.',
    keyConcepts: ['Specific Heat Capacity (Q=mcΔT)', 'Latent Heat of Vaporization', 'Ideal Gas Equation (PV=nRT)', 'Thermal Expansion'],
    recommendedAction: 'Solve Thermal Physics Drills'
  },
  {
    id: 'phy_04',
    subjectId: 'physics',
    subjectName: 'Physics',
    topicName: 'Waves, Optics & Sound',
    unitName: 'Unit 3: Waves & Light',
    level: 2,
    sequence: 4,
    prerequisites: ['phy_03'],
    jambWeightPercent: 20,
    description: 'Wave characteristics, Snell\'s law of refraction, lens formula, and total internal reflection.',
    keyConcepts: ['Snell\'s Law (n=sin i/sin r)', 'Lens Formula (1/f = 1/u + 1/v)', 'Transverse vs Longitudinal Waves', 'Sound Resonance'],
    recommendedAction: 'Solve Optics Ray Diagrams & Formulas'
  },
  {
    id: 'phy_05',
    subjectId: 'physics',
    subjectName: 'Physics',
    topicName: 'Current Electricity & Magnetism',
    unitName: 'Unit 4: Electricity & Magnetism',
    level: 3,
    sequence: 5,
    prerequisites: ['phy_04'],
    jambWeightPercent: 20,
    description: 'Ohm\'s law, series/parallel resistor circuits, electric field intensity, and electromagnetic induction.',
    keyConcepts: ['Ohm\'s Law (V=IR)', 'Internal Resistance & EMF', 'Magnetic Field Force', 'Faraday\'s Law of Induction'],
    recommendedAction: 'Solve Circuit Diagram Problems'
  },

  // --- CHEMISTRY ---
  {
    id: 'chem_01',
    subjectId: 'chemistry',
    subjectName: 'Chemistry',
    topicName: 'Separation Techniques & Atomic Structure',
    unitName: 'Unit 1: Matter & Structure',
    level: 1,
    sequence: 1,
    prerequisites: [],
    jambWeightPercent: 12,
    description: 'Distillation, chromatography, electronic configurations, isotopes, and periodic table trends.',
    keyConcepts: ['Fractional Distillation', 'Paper Chromatography', 's,p,d,f Orbital Configuration', 'Electronegativity Trends'],
    recommendedAction: 'Practice Separation Drills'
  },
  {
    id: 'chem_02',
    subjectId: 'chemistry',
    subjectName: 'Chemistry',
    topicName: 'Stoichiometry & Chemical Gas Laws',
    unitName: 'Unit 2: Quantitative Chemistry',
    level: 1,
    sequence: 2,
    prerequisites: ['chem_01'],
    jambWeightPercent: 18,
    description: 'Mole calculations, empirical formula, molar gas volume, Graham\'s law of diffusion.',
    keyConcepts: ['Mole Ratio Calculations', 'Empirical vs Molecular Formula', 'Graham\'s Law (Rate of Diffusion)', 'Avogadro\'s Constant'],
    recommendedAction: 'Solve Stoichiometry Calculations'
  },
  {
    id: 'chem_03',
    subjectId: 'chemistry',
    subjectName: 'Chemistry',
    topicName: 'Acids, Bases, Salts & Redox',
    unitName: 'Unit 3: Solutions & Reactions',
    level: 2,
    sequence: 3,
    prerequisites: ['chem_02'],
    jambWeightPercent: 18,
    description: 'pH calculations, volumetric analysis, oxidation numbers, and balancing redox equations.',
    keyConcepts: ['pH Scale (-log[H+])', 'Acid-Base Titration Molarity', 'Oxidation Numbers Rules', 'Balancing Half-Reactions'],
    recommendedAction: 'Complete Titration & pH Quiz'
  },
  {
    id: 'chem_04',
    subjectId: 'chemistry',
    subjectName: 'Chemistry',
    topicName: 'Electrochemistry & Faraday\'s Laws',
    unitName: 'Unit 4: Physical Chemistry',
    level: 2,
    sequence: 4,
    prerequisites: ['chem_03'],
    jambWeightPercent: 18,
    description: 'Electrolytic cells, anodic/cathodic reactions, and Faraday\'s 1st & 2nd laws of electrolysis.',
    keyConcepts: ['Faraday\'s First Law (m = zIt)', 'Ecell Standard Electrode Potential', 'Electrolysis of Brine & CuSO4', 'Corrosion Prevention'],
    recommendedAction: 'Solve Electrolysis Numerical Drills'
  },
  {
    id: 'chem_05',
    subjectId: 'chemistry',
    subjectName: 'Chemistry',
    topicName: 'Organic Chemistry & Hydrocarbons',
    unitName: 'Unit 5: Organic Chemistry',
    level: 3,
    sequence: 5,
    prerequisites: ['chem_04'],
    jambWeightPercent: 22,
    description: 'IUPAC nomenclature, alkanes, alkenes, alkynes, alkanols, esterification, and polymer reactions.',
    keyConcepts: ['IUPAC Naming Rules', 'Structural Isomerism', 'Markovnikov\'s Addition Rule', 'Esterification & Saponification'],
    recommendedAction: 'Solve Organic Reactions Test'
  },

  // --- BIOLOGY ---
  {
    id: 'bio_01',
    subjectId: 'biology',
    subjectName: 'Biology',
    topicName: 'Cell Structure & Organization of Life',
    unitName: 'Unit 1: Cell Biology',
    level: 1,
    sequence: 1,
    prerequisites: [],
    jambWeightPercent: 15,
    description: 'Plant vs animal cell organelles, cell division (mitosis/meiosis), and levels of organization.',
    keyConcepts: ['Organelles (Mitochondria, Ribosome)', 'Mitosis vs Meiosis Stages', 'Tissue, Organ & System Levels', 'Diffusion & Osmosis'],
    recommendedAction: 'Solve Cell Structure Drills'
  },
  {
    id: 'bio_02',
    subjectId: 'biology',
    subjectName: 'Biology',
    topicName: 'Plant & Animal Nutrition & Enzymes',
    unitName: 'Unit 2: Physiology',
    level: 1,
    sequence: 2,
    prerequisites: ['bio_01'],
    jambWeightPercent: 18,
    description: 'Photosynthesis light/dark reactions, human digestive enzymes, and essential nutrient tests.',
    keyConcepts: ['Light vs Dark Photosynthesis', 'Digestive Enzymes (Pepsin, Amylase)', 'Food Tests (Biuret, Iodine)', 'Mineral Deficiency'],
    recommendedAction: 'Complete Nutrition Quiz'
  },
  {
    id: 'bio_03',
    subjectId: 'biology',
    subjectName: 'Biology',
    topicName: 'Transport Systems & Respiration',
    unitName: 'Unit 2: Physiology',
    level: 2,
    sequence: 3,
    prerequisites: ['bio_02'],
    jambWeightPercent: 18,
    description: 'Xylem/phloem transport, mammalian circulatory heart system, and aerobic vs anaerobic respiration.',
    keyConcepts: ['Xylem Transpiration Pull', 'Double Circulation (Heart Structure)', 'Aerobic (ATP) vs Lactic Respiration', 'Stomatal Action'],
    recommendedAction: 'Practice Physiology Questions'
  },
  {
    id: 'bio_04',
    subjectId: 'biology',
    subjectName: 'Biology',
    topicName: 'Ecology & Environmental Biology',
    unitName: 'Unit 3: Ecology',
    level: 2,
    sequence: 4,
    prerequisites: ['bio_03'],
    jambWeightPercent: 18,
    description: 'Biomes, food webs, ecological succession, nitrogen/carbon cycles, and pollution factors.',
    keyConcepts: ['Trophic Levels & Energy Pyramid', 'Nitrogen Cycle Bacteria', 'Biotic vs Abiotic Factors', 'Conservation Methods'],
    recommendedAction: 'Take Ecology Practice Test'
  },
  {
    id: 'bio_05',
    subjectId: 'biology',
    subjectName: 'Biology',
    topicName: 'Genetics, Heredity & Evolution',
    unitName: 'Unit 4: Genetics',
    level: 3,
    sequence: 5,
    prerequisites: ['bio_04'],
    jambWeightPercent: 22,
    description: 'Mendelian monohybrid crosses, Punnett squares, sex-linked traits, ABO blood groups, and Darwinian selection.',
    keyConcepts: ['Punnett Square Ratios (3:1, 1:2:1)', 'Sex-Linked Traits (Hemophilia)', 'Blood Group Inheritance', 'Lamarckism vs Darwinism'],
    recommendedAction: 'Solve Punnett Square Genetics Drills'
  }
];

export async function fetchEducationalJourneyProgress(userId?: string): Promise<OverallJourneyProgress> {
  // 1. Fetch real session stats if logged in
  const topicStats: Record<string, { total: number; correct: number }> = {};

  try {
    // Try Supabase session_answers or local IndexedDB
    if (userId) {
      const { data: answers } = await supabase
        .from('session_answers')
        .select('is_correct, question_id, questions(topic_id, topics(name))')
        .eq('user_id', userId)
        .limit(1000);

      if (answers && answers.length > 0) {
        answers.forEach((ans: any) => {
          const tName = ans.questions?.topics?.name || 'General';
          if (!topicStats[tName]) topicStats[tName] = { total: 0, correct: 0 };
          topicStats[tName].total += 1;
          if (ans.is_correct) topicStats[tName].correct += 1;
        });
      }
    }

    // Also blend IndexedDB local exams history
    const localExams = await db.pending_sessions.toArray();
    localExams.forEach((e: any) => {
      if (e.subject) {
        if (!topicStats[e.subject]) topicStats[e.subject] = { total: 0, correct: 0 };
        topicStats[e.subject].total += 10;
        topicStats[e.subject].correct += e.score || 0;
      }
    });
  } catch (err) {
    console.warn('[EducationalJourney] Error fetching user answer stats, using local defaults:', err);
  }

  // 2. Map syllabus nodes with real performance calculations
  const evaluatedNodes: JourneyNode[] = UTME_SYLLABUS_NODES.map((rawNode) => {
    // Find matching topic stats
    let total = 0;
    let correct = 0;

    Object.entries(topicStats).forEach(([key, val]) => {
      if (
        key.toLowerCase().includes(rawNode.topicName.toLowerCase()) ||
        rawNode.topicName.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(rawNode.subjectName.toLowerCase())
      ) {
        total += val.total;
        correct += val.correct;
      }
    });

    const acc = total > 0 ? Math.round((correct / total) * 100) : 0;

    let status: 'mastered' | 'in_progress' | 'locked' = 'locked';

    if (acc >= 75 && total >= 3) {
      status = 'mastered';
    } else if (total > 0 || rawNode.sequence === 1) {
      // First node in sequence or attempted nodes are unlocked in progress
      status = 'in_progress';
    } else {
      // Check if all prerequisites are mastered or in progress
      const prereqsMet = rawNode.prerequisites.every((prereqId) => {
        const found = UTME_SYLLABUS_NODES.find((n) => n.id === prereqId);
        if (!found) return true;
        // Check if prerequisite node had attempts
        return true; // Unlocks iteratively
      });
      status = prereqsMet && rawNode.sequence <= 2 ? 'in_progress' : 'locked';
    }

    return {
      ...rawNode,
      status,
      accuracyPercentage: acc,
      questionsAttempted: total,
      correctAnswers: correct
    };
  });

  // Ensure logical prerequisites: If previous sequence node in subject is mastered, unlock next
  const subjectGroups: Record<string, SubjectJourney> = {};

  ['use_of_english', 'mathematics', 'physics', 'chemistry', 'biology'].forEach((subId) => {
    const subNodes = evaluatedNodes.filter((n) => n.subjectId === subId).sort((a, b) => a.sequence - b.sequence);

    // Dynamic unlocking logic
    for (let i = 0; i < subNodes.length; i++) {
      if (i > 0) {
        const prev = subNodes[i - 1];
        if (prev.status === 'mastered') {
          if (subNodes[i].status === 'locked') {
            subNodes[i].status = 'in_progress';
          }
        }
      }
    }

    const totalNodes = subNodes.length;
    const masteredNodes = subNodes.filter((n) => n.status === 'mastered').length;
    const completionPercentage = Math.round((masteredNodes / totalNodes) * 100);

    const firstSub = subNodes[0];
    subjectGroups[subId] = {
      subjectId: subId,
      subjectName: firstSub ? firstSub.subjectName : subId,
      totalNodes,
      masteredNodes,
      completionPercentage,
      nodes: subNodes
    };
  });

  const totalMastered = evaluatedNodes.filter((n) => n.status === 'mastered').length;
  const totalTopics = evaluatedNodes.length;
  const overallPercentage = Math.round((totalMastered / totalTopics) * 100);

  const currentActiveTopic = evaluatedNodes.find((n) => n.status === 'in_progress') || evaluatedNodes[0];

  return {
    totalMastered,
    totalTopics,
    overallPercentage,
    currentActiveTopic,
    subjectJourneys: subjectGroups
  };
}
