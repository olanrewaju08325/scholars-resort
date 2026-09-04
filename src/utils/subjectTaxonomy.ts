/**
 * Scholars Resort Canonical Academic Subject & Taxonomy Architecture
 * Single authoritative source of truth for all UTME/JAMB subjects, canonical UUIDs, and legacy alias normalization.
 */

export type SubjectCategory = 'compulsory' | 'sciences' | 'commercial' | 'arts';

export interface CanonicalSubject {
  id: string;
  name: string;
  code: string;
  category: SubjectCategory;
  icon: string;
  aliases: string[];
  isCompulsory?: boolean;
}

export interface CanonicalTopic {
  id?: string;
  subjectId: string;
  name: string;
  description?: string;
}

/**
 * Authoritative 20 Canonical UTME Subjects in Supabase
 * Preserves 100% of live primary key UUIDs from the production database.
 */
export const CANONICAL_UTME_SUBJECTS: CanonicalSubject[] = [
  {
    id: 'ae78089e-b2de-4cae-ab8d-a58002454fcf',
    name: 'Use of English',
    code: 'ENG',
    category: 'compulsory',
    icon: 'book-open',
    isCompulsory: true,
    aliases: [
      'use of english',
      'english',
      'english language',
      'eng',
      'use-of-english',
      'english language (utme)',
      'general english'
    ]
  },
  {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    name: 'Mathematics',
    code: 'MTH',
    category: 'sciences',
    icon: 'calculator',
    aliases: [
      'mathematics',
      'maths',
      'math',
      'general mathematics',
      'general maths'
    ]
  },
  {
    id: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c33',
    name: 'Physics',
    code: 'PHY',
    category: 'sciences',
    icon: 'atom',
    aliases: ['physics', 'phy']
  },
  {
    id: 'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380d44',
    name: 'Chemistry',
    code: 'CHM',
    category: 'sciences',
    icon: 'flask-conical',
    aliases: ['chemistry', 'chem']
  },
  {
    id: '877f58d8-3156-40a1-8548-6a8d0786f10c',
    name: 'Biology',
    code: 'BIO',
    category: 'sciences',
    icon: 'dna',
    aliases: ['biology', 'bio']
  },
  {
    id: '81e24521-02d3-4e8e-b632-2b5c91e377a8',
    name: 'Agricultural Science',
    code: 'AGR',
    category: 'sciences',
    icon: 'sprout',
    aliases: [
      'agricultural science',
      'agric',
      'agricultural-science',
      'agric science',
      'agriculture'
    ]
  },
  {
    id: '25a1dbb8-f612-4467-9395-fc7e5ac79622',
    name: 'Economics',
    code: 'ECN',
    category: 'commercial',
    icon: 'trending-up',
    aliases: ['economics', 'econ']
  },
  {
    id: '2878721f-f3a8-4783-8c98-d2d794cbb81e',
    name: 'Commerce',
    code: 'COM',
    category: 'commercial',
    icon: 'shopping-bag',
    aliases: ['commerce', 'comm']
  },
  {
    id: 'e6cd3303-859a-4a89-9bd9-54e0f794c141',
    name: 'Principles of Accounts',
    code: 'ACC',
    category: 'commercial',
    icon: 'receipt',
    aliases: [
      'principles of accounts',
      'accounting',
      'accounts',
      'financial accounting',
      'accountancy'
    ]
  },
  {
    id: 'dd508eab-063d-41da-a52c-2811866e354f',
    name: 'Government',
    code: 'GOV',
    category: 'arts',
    icon: 'landmark',
    aliases: ['government', 'govt']
  },
  {
    id: 'f8c5af4e-4f6a-4eac-9632-724397a96e6b',
    name: 'Literature in English',
    code: 'LIT',
    category: 'arts',
    icon: 'book-type',
    aliases: [
      'literature in english',
      'literature',
      'lit in eng',
      'lit-in-eng',
      'lit',
      'english literature'
    ]
  },
  {
    id: 'c613205e-2b39-481b-a850-0a2dc11ceab4',
    name: 'Christian Religious Studies',
    code: 'CRS',
    category: 'arts',
    icon: 'cross',
    aliases: [
      'christian religious studies',
      'crs',
      'crk',
      'christian religious knowledge',
      'crs / irs',
      'christian studies'
    ]
  },
  {
    id: 'd66e0d1a-e0f5-4f2f-8c86-2afb7b5c83e9',
    name: 'Islamic Religious Studies',
    code: 'IRS',
    category: 'arts',
    icon: 'moon',
    aliases: [
      'islamic religious studies',
      'irs',
      'irk',
      'islamic religious knowledge',
      'islamic studies'
    ]
  },
  {
    id: '6b59769b-f9dc-4752-86cb-9bb0baaae41f',
    name: 'Geography',
    code: 'GEO',
    category: 'arts',
    icon: 'globe',
    aliases: ['geography', 'geo']
  },
  {
    id: '27301c5d-9652-4a18-8d77-d104bf8a093a',
    name: 'Computer Studies',
    code: 'CMP',
    category: 'sciences',
    icon: 'laptop',
    aliases: [
      'computer studies',
      'computer science',
      'ict',
      'data processing',
      'computer'
    ]
  },
  {
    id: 'c5a5791b-dd92-40d0-8ce2-3265a158d7a9',
    name: 'History',
    code: 'HIS',
    category: 'arts',
    icon: 'history',
    aliases: ['history', 'hist']
  },
  {
    id: 'bb2dc95d-9be4-45b5-b7fd-0e95738684ea',
    name: 'Hausa',
    code: 'HAU',
    category: 'arts',
    icon: 'message-square',
    aliases: ['hausa']
  },
  {
    id: '3f4b1315-336a-4773-acfc-47c7f01e7a25',
    name: 'Igbo',
    code: 'IGB',
    category: 'arts',
    icon: 'message-square',
    aliases: ['igbo']
  },
  {
    id: '74a96d0c-86e0-491d-bd40-216d06ff54e6',
    name: 'Yoruba',
    code: 'YOR',
    category: 'arts',
    icon: 'message-square',
    aliases: ['yoruba']
  },
  {
    id: '8eca0b50-967a-41bc-83e9-55995af8f816',
    name: 'French',
    code: 'FRN',
    category: 'arts',
    icon: 'languages',
    aliases: ['french', 'fr']
  }
];

// Inverted lookup map for O(1) alias & UUID resolution
const ID_LOOKUP_MAP = new Map<string, CanonicalSubject>();
const NAME_LOOKUP_MAP = new Map<string, CanonicalSubject>();

CANONICAL_UTME_SUBJECTS.forEach((subject) => {
  ID_LOOKUP_MAP.set(subject.id.toLowerCase(), subject);
  NAME_LOOKUP_MAP.set(subject.name.toLowerCase().trim(), subject);
  subject.aliases.forEach((alias) => {
    NAME_LOOKUP_MAP.set(alias.toLowerCase().trim(), subject);
  });
});

/**
 * Normalizes any subject name, abbreviation, or legacy alias into the exact Canonical TitleCase Subject Name.
 * e.g., 'maths' -> 'Mathematics', 'eng' -> 'Use of English', 'crs' -> 'Christian Religious Studies'
 */
export function normalizeToCanonicalSubjectName(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') return 'Use of English';
  const clean = input.trim().toLowerCase();

  // Check ID first
  if (ID_LOOKUP_MAP.has(clean)) {
    return ID_LOOKUP_MAP.get(clean)!.name;
  }

  // Check Alias / Name
  if (NAME_LOOKUP_MAP.has(clean)) {
    return NAME_LOOKUP_MAP.get(clean)!.name;
  }

  // Fallback cleanup
  if (clean.includes('english')) return 'Use of English';
  if (clean.includes('math')) return 'Mathematics';
  if (clean.includes('physic')) return 'Physics';
  if (clean.includes('chem')) return 'Chemistry';
  if (clean.includes('bio')) return 'Biology';
  if (clean.includes('account')) return 'Principles of Accounts';
  if (clean.includes('agric')) return 'Agricultural Science';
  if (clean.includes('lit')) return 'Literature in English';
  if (clean.includes('gov')) return 'Government';
  if (clean.includes('econ')) return 'Economics';
  if (clean.includes('comm')) return 'Commerce';
  if (clean.includes('geo')) return 'Geography';
  if (clean.includes('comp')) return 'Computer Studies';

  // Capitalize words if unknown
  return input
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Resolves any subject name, legacy alias, or UUID to the canonical database UUID.
 */
export function getCanonicalSubjectId(nameOrAliasOrId: string | null | undefined): string | undefined {
  if (!nameOrAliasOrId || typeof nameOrAliasOrId !== 'string') return undefined;
  const clean = nameOrAliasOrId.trim().toLowerCase();

  if (ID_LOOKUP_MAP.has(clean)) {
    return ID_LOOKUP_MAP.get(clean)!.id;
  }
  if (NAME_LOOKUP_MAP.has(clean)) {
    return NAME_LOOKUP_MAP.get(clean)!.id;
  }
  return undefined;
}

/**
 * Retrieves the full canonical subject definition by Name or Alias.
 */
export function getCanonicalSubjectByName(name: string | null | undefined): CanonicalSubject | undefined {
  if (!name || typeof name !== 'string') return undefined;
  return NAME_LOOKUP_MAP.get(name.trim().toLowerCase());
}

/**
 * Retrieves the full canonical subject definition by UUID.
 */
export function getCanonicalSubjectById(id: string | null | undefined): CanonicalSubject | undefined {
  if (!id || typeof id !== 'string') return undefined;
  return ID_LOOKUP_MAP.get(id.trim().toLowerCase());
}

/**
 * Returns all 20 canonical UTME subjects.
 */
export function getAllCanonicalSubjects(): CanonicalSubject[] {
  return [...CANONICAL_UTME_SUBJECTS];
}

/**
 * Checks if a subject is compulsory for UTME (Use of English).
 */
export function isCompulsorySubject(subjectIdOrName: string): boolean {
  const normName = normalizeToCanonicalSubjectName(subjectIdOrName);
  return normName === 'Use of English';
}

/**
 * Validates that a student's chosen UTME subjects adhere to the official JAMB rule:
 * Exactly 4 distinct subjects, including 'Use of English'.
 */
export function validateUtmeSubjectCombination(subjects: string[]): { isValid: boolean; error?: string; normalizedSubjects: string[] } {
  if (!Array.isArray(subjects)) {
    return { isValid: false, error: 'Subjects must be a valid array.', normalizedSubjects: [] };
  }

  const normalized = Array.from(
    new Set(subjects.map(s => normalizeToCanonicalSubjectName(s)))
  );

  if (!normalized.includes('Use of English')) {
    normalized.unshift('Use of English');
  }

  if (normalized.length !== 4) {
    return {
      isValid: false,
      error: `You must select exactly 4 UTME subjects (currently ${normalized.length}).`,
      normalizedSubjects: normalized
    };
  }

  return { isValid: true, normalizedSubjects: normalized };
}

/**
 * Comprehensive JAMB Syllabus Topics Catalog (Syllabus reference by canonical Subject UUID)
 * Covers all 20 Canonical UTME/JAMB Subjects with full Topic -> Subtopic -> Learning Objectives hierarchy.
 */
export interface SyllabusSubtopic {
  name: string;
  learningObjectives: string[];
}

export interface SyllabusTopicDetail {
  name: string;
  description?: string;
  subtopics: SyllabusSubtopic[];
}

export const CANONICAL_SYLLABUS_DETAILS: Record<string, SyllabusTopicDetail[]> = {
  // 1. Use of English (ae78089e-b2de-4cae-ab8d-a58002454fcf)
  'ae78089e-b2de-4cae-ab8d-a58002454fcf': [
    {
      name: 'Comprehension & Summary',
      description: 'Understanding prose passages, identifying main ideas, making inferences and summarizing arguments.',
      subtopics: [
        { name: 'Prose Comprehension', learningObjectives: ['Identify central themes in passages', 'Determine meaning of contextual words', 'Extract explicit and implicit facts'] },
        { name: 'Summary Writing Techniques', learningObjectives: ['Condense multi-paragraph passages', 'Identify main points vs supporting details'] }
      ]
    },
    {
      name: 'Lexis and Structure',
      description: 'Grammatical structures, vocabulary usage, sentence types, and collocations.',
      subtopics: [
        { name: 'Parts of Speech & Concord', learningObjectives: ['Apply subject-verb agreement rules', 'Use correct prepositions, articles and conjunctions'] },
        { name: 'Sentence Types & Transformations', learningObjectives: ['Identify simple, compound and complex sentences', 'Transform active to passive voice'] }
      ]
    },
    {
      name: 'Oral Forms & Vowels/Consonants',
      description: 'Phonetics, stress patterns, vowel/consonant sounds, and intonation.',
      subtopics: [
        { name: 'Vowel & Consonants Identification', learningObjectives: ['Differentiate monophthongs and diphthongs', 'Identify silent consonants in words'] },
        { name: 'Stress & Intonation', learningObjectives: ['Locate primary stress placement in multi-syllable words', 'Recognize rising and falling intonation tones'] }
      ]
    },
    {
      name: 'Prescribed Literature Texts (Official JAMB Selection)',
      description: 'Analysis of characterization, plot, themes, setting, and literary devices in prescribed UTME texts.',
      subtopics: [
        { name: 'Character Analysis & Plot Structure', learningObjectives: ['Analyze main and supporting characters', 'Trace chronological events and plot climax'] },
        { name: 'Themes & Literary Devices', learningObjectives: ['Identify core themes, ethical lessons, and societal relevance', 'Recognize metaphors, irony and symbolism'] }
      ]
    },
    {
      name: 'Idioms & Collocations',
      description: 'Idiomatic expressions, phrasal verbs, and natural word pairings.',
      subtopics: [
        { name: 'Phrasal Verbs', learningObjectives: ['Interpret contextual meanings of phrasal verbs', 'Select correct prepositional verbs'] },
        { name: 'Idiomatic Expressions', learningObjectives: ['Decode figurative meanings of common idioms', 'Apply idioms accurately in sentences'] }
      ]
    },
    {
      name: 'Antonyms & Synonyms',
      description: 'Vocabulary enrichment, word opposites, and nearest in meaning.',
      subtopics: [
        { name: 'Synonyms (Nearest in Meaning)', learningObjectives: ['Select words closest in meaning to underlined words', 'Distinguish subtle shades of synonym meanings'] },
        { name: 'Antonyms (Opposite in Meaning)', learningObjectives: ['Select exact opposite meanings in context', 'Avoid common antonym traps in options'] }
      ]
    }
  ],

  // 2. Mathematics (a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11)
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11': [
    {
      name: 'Number & Numeration',
      description: 'Fractions, indices, logarithms, surds, number bases, and modular arithmetic.',
      subtopics: [
        { name: 'Indices & Logarithms', learningObjectives: ['Apply laws of indices to simplify algebraic expressions', 'Solve logarithmic equations with different bases'] },
        { name: 'Surds & Number Bases', learningObjectives: ['Rationalize denominators of surds', 'Convert numbers across base 2 to base 16'] }
      ]
    },
    {
      name: 'Algebra & Polynomials',
      description: 'Quadratics, polynomials, simultaneous equations, and variation.',
      subtopics: [
        { name: 'Quadratic & Polynomial Equations', learningObjectives: ['Factorize cubic polynomials using Factor Theorem', 'Solve quadratic equations by completing square and formula'] },
        { name: 'Sequences & Series (AP & GP)', learningObjectives: ['Calculate nth term and sum of Arithmetic Progressions', 'Find sum to infinity for convergent Geometric Series'] }
      ]
    },
    {
      name: 'Calculus (Differentiation & Integration)',
      description: 'Limits, derivatives, maxima/minima, definite and indefinite integrals.',
      subtopics: [
        { name: 'Differential Calculus', learningObjectives: ['Apply Product, Quotient and Chain Rules', 'Determine stationary points and classify maxima/minima'] },
        { name: 'Integral Calculus', learningObjectives: ['Integrate polynomial and trigonometric functions', 'Calculate area bounded under curves using definite integrals'] }
      ]
    },
    {
      name: 'Geometry & Trigonometry',
      description: 'Circles, coordinate geometry, trigonometric ratios, elevation and depression.',
      subtopics: [
        { name: 'Circle Theorems & Mensuration', learningObjectives: ['Apply circle theorems (alternate segment, cyclic quad)', 'Calculate surface area and volume of cones, spheres and pyramids'] },
        { name: 'Trigonometric Ratios & Graphs', learningObjectives: ['Use Sine and Cosine rules to solve non-right-angled triangles', 'Solve trigonometric equations within 0° to 360°'] }
      ]
    },
    {
      name: 'Statistics & Probability',
      description: 'Mean, median, mode, standard deviation, permutations, combinations, and probability.',
      subtopics: [
        { name: 'Measures of Location & Dispersion', learningObjectives: ['Calculate mean, variance and standard deviation for grouped data', 'Interpret cumulative frequency curves (ogives)'] },
        { name: 'Permutations, Combinations & Probability', learningObjectives: ['Calculate nPr and nCr arrangements', 'Apply addition and multiplication laws of probability'] }
      ]
    }
  ],

  // 3. Physics (c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c33)
  'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c33': [
    {
      name: 'Mechanics & Kinematics',
      description: 'Motion, forces, momentum, work, energy, power, and simple machines.',
      subtopics: [
        { name: 'Linear & Projectile Motion', learningObjectives: ['Apply equations of uniform acceleration', 'Calculate range, maximum height and time of flight in projectiles'] },
        { name: 'Work, Energy, Power & Machines', learningObjectives: ['Calculate mechanical advantage, velocity ratio and efficiency', 'Apply law of conservation of mechanical energy'] }
      ]
    },
    {
      name: 'Thermal Physics & Heat Energy',
      description: 'Temperature measurement, thermal expansion, gas laws, latent heat.',
      subtopics: [
        { name: 'Thermal Expansion & Calorimetry', learningObjectives: ['Calculate linear, superficial and cubic expansivities', 'Determine specific heat capacity using method of mixtures'] },
        { name: 'Gas Laws & Thermodynamics', learningObjectives: ['Apply Boyle, Charles and Pressure laws', 'Calculate heat transfer by conduction, convection and radiation'] }
      ]
    },
    {
      name: 'Waves, Optics & Sound',
      description: 'Wave characteristics, light reflection, refraction, lenses, mirrors, sound resonance.',
      subtopics: [
        { name: 'Reflection & Refraction of Light', learningObjectives: ['Calculate focal length using mirror and lens formulas', 'Apply Snell\'s law and total internal reflection'] },
        { name: 'Sound Waves & Resonance', learningObjectives: ['Determine speed of sound in air using resonance tubes', 'Calculate frequency harmonics in stretched strings and pipes'] }
      ]
    },
    {
      name: 'Electricity & Magnetism',
      description: 'Electric fields, Ohm\'s law, magnetic fields, electromagnetic induction, AC circuits.',
      subtopics: [
        { name: 'Electric Circuits & Ohm\'s Law', learningObjectives: ['Calculate equivalent resistance in series-parallel circuits', 'Apply Kirchhoff\'s current and voltage laws'] },
        { name: 'Electromagnetism & AC Circuits', learningObjectives: ['Apply Faraday\'s and Lenz\'s laws of induction', 'Calculate impedance, reactance and resonance in RLC circuits'] }
      ]
    },
    {
      name: 'Atomic & Modern Physics',
      description: 'Structure of atom, radioactivity, photoelectric effect, semiconductors.',
      subtopics: [
        { name: 'Radioactivity & Nuclear Reactions', learningObjectives: ['Calculate half-life and radioactive decay constants', 'Differentiate nuclear fission and fusion processes'] },
        { name: 'Photoelectric Effect & Semiconductors', learningObjectives: ['Apply Einstein photoelectric equation (E = hf)', 'Differentiate P-type and N-type semiconductors'] }
      ]
    }
  ],

  // 4. Chemistry (d3eebc99-9c0b-4ef8-bb6d-6bb9bd380d44)
  'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380d44': [
    {
      name: 'Nature of Matter & Separation Techniques',
      description: 'Elements, compounds, mixtures, filtration, distillation, chromatography.',
      subtopics: [
        { name: 'Separation Techniques', learningObjectives: ['Select appropriate separation method for homogeneous & heterogeneous mixtures', 'Explain principles of fractional distillation and chromatography'] }
      ]
    },
    {
      name: 'Atomic Structure & Periodicity',
      description: 'Subatomic particles, electron configuration, periodic trends.',
      subtopics: [
        { name: 'Electronic Configuration & Periodic Law', learningObjectives: ['Write s,p,d electron configurations', 'Predict periodic trends in atomic radius, ionization energy, electronegativity'] }
      ]
    },
    {
      name: 'Chemical Bonding & Molecular Shapes',
      description: 'Ionic, covalent, metallic, hydrogen bonding, molecular geometry.',
      subtopics: [
        { name: 'Types of Chemical Bonds', learningObjectives: ['Compare physical properties of ionic and covalent compounds', 'Explain hydrogen bonding influence on boiling points'] }
      ]
    },
    {
      name: 'Kinetic Theory of Matter & Gas Laws',
      description: 'States of matter, ideal gas equation, Graham law of diffusion.',
      subtopics: [
        { name: 'Gas Calculations', learningObjectives: ['Apply ideal gas equation PV = nRT', 'Compare rates of gas diffusion using Graham\'s Law'] }
      ]
    },
    {
      name: 'Organic Chemistry & Hydrocarbons',
      description: 'Alkanes, alkenes, alkynes, alkanols, alkanoic acids, isomerism.',
      subtopics: [
        { name: 'Hydrocarbon Reactions & IUPAC Naming', learningObjectives: ['Name organic compounds using official IUPAC rules', 'Identify structural and geometric isomers'] },
        { name: 'Functional Groups & Polymers', learningObjectives: ['Describe esterification and saponification reactions', 'Classify addition and condensation polymers'] }
      ]
    },
    {
      name: 'Acids, Bases & Salts',
      description: 'pH scale, neutralization, volumetric analysis, buffer solutions.',
      subtopics: [
        { name: 'Volumetric Titration Calculations', learningObjectives: ['Calculate molar concentration and mass concentration from titration data', 'Explain indicators selection based on neutralization curves'] }
      ]
    }
  ],

  // 5. Biology (877f58d8-3156-40a1-8548-6a8d0786f10c)
  '877f58d8-3156-40a1-8548-6a8d0786f10c': [
    {
      name: 'Living Organisms & Cell Structure',
      description: 'Cell organelle structure, plant vs animal cells, levels of organization.',
      subtopics: [
        { name: 'Cell Ultrastructure & Organelles', learningObjectives: ['Identify functions of mitochondria, ribosome, nucleus', 'Compare plant cell wall and animal cell membrane'] }
      ]
    },
    {
      name: 'Nutrition & Digestive Systems',
      description: 'Autotrophic and heterotrophic nutrition, enzyme action, human digestive tract.',
      subtopics: [
        { name: 'Photosynthesis & Enzymes', learningObjectives: ['Explain light and dark reactions of photosynthesis', 'Describe factors affecting enzyme activity (pH, temperature)'] }
      ]
    },
    {
      name: 'Transport Systems in Plants & Animals',
      description: 'Blood composition, circulatory system, xylem/phloem transport.',
      subtopics: [
        { name: 'Human Circulatory System', learningObjectives: ['Trace blood flow through heart chambers and vessels', 'Describe functions of red cells, white cells, platelets'] }
      ]
    },
    {
      name: 'Reproduction in Plants & Animals',
      description: 'Asexual reproduction, flower structure, fertilization, mammalian reproductive system.',
      subtopics: [
        { name: 'Plant Reproduction & Seed Germination', learningObjectives: ['Identify parts of flower involved in pollination', 'Differentiate epigeal and hypogeal germination'] }
      ]
    },
    {
      name: 'Genetics, Heredity & Evolution',
      description: 'Mendelian laws, chromosomes, DNA, sex-linked traits, Darwinian evolution.',
      subtopics: [
        { name: 'Mendelian Inheritance', learningObjectives: ['Solve monohybrid and dihybrid genetic crosses', 'Identify sex-linked genetic disorders (hemophilia, color blindness)'] }
      ]
    }
  ],

  // 6. Agricultural Science (81e24521-02d3-4e8e-b632-2b5c91e377a8)
  '81e24521-02d3-4e8e-b632-2b5c91e377a8': [
    {
      name: 'Basic Concepts of Agriculture',
      description: 'Meaning, scope, importance of agriculture, land tenure systems.',
      subtopics: [
        { name: 'Land Tenure Systems', learningObjectives: ['Compare communal, inheritance, leasehold, and freehold land ownership', 'Analyze impact of Land Use Act'] }
      ]
    },
    {
      name: 'Agricultural Mechanics & Farm Power',
      description: 'Sources of farm power, farm machinery, maintenance of farm implements.',
      subtopics: [
        { name: 'Farm Machinery & Implements', learningObjectives: ['Identify primary and secondary tillage tools', 'Describe tractor system maintenance'] }
      ]
    },
    {
      name: 'Crop Production & Improvement',
      description: 'Classification of crops, agronomic practices, crop husbandry, plant breeding.',
      subtopics: [
        { name: 'Agronomic Practices', learningObjectives: ['Outline cultural practices for cereals, legumes, roots, and tubers', 'Explain principles of crop rotation and intercropping'] }
      ]
    },
    {
      name: 'Animal Production & Management',
      description: 'Livestock management, livestock nutrition, animal health and diseases.',
      subtopics: [
        { name: 'Livestock Feeds & Ruminant Digestion', learningObjectives: ['Formulate balanced rations for poultry and pigs', 'Compare ruminant and non-ruminant digestion'] }
      ]
    }
  ],

  // 7. Economics (25a1dbb8-f612-4467-9395-fc7e5ac79622)
  '25a1dbb8-f612-4467-9395-fc7e5ac79622': [
    {
      name: 'Basic Economic Concepts & Methodology',
      description: 'Scarcity, choice, scale of preference, opportunity cost, production possibility curve.',
      subtopics: [
        { name: 'Scarcity & Opportunity Cost', learningObjectives: ['Distinguish money cost from opportunity cost', 'Interpret Production Possibility Curve (PPC)'] }
      ]
    },
    {
      name: 'Demand, Supply & Price Determination',
      description: 'Laws of demand and supply, elasticities, market equilibrium, price control.',
      subtopics: [
        { name: 'Elasticities of Demand & Supply', learningObjectives: ['Calculate price, income and cross elasticities of demand', 'Explain effects of maximum and minimum price ceilings'] }
      ]
    },
    {
      name: 'Theory of Production & Market Structures',
      description: 'Factors of production, laws of returns, costs of production, perfect/imperfect competition.',
      subtopics: [
        { name: 'Cost Curves & Revenue Functions', learningObjectives: ['Calculate Total Cost, Marginal Cost and Average Cost', 'Compare short-run equilibrium in perfect competition vs monopoly'] }
      ]
    },
    {
      name: 'Macroeconomics, Money & Banking',
      description: 'National income accounting, inflation, monetary/fiscal policy, central banking.',
      subtopics: [
        { name: 'National Income Measurement', learningObjectives: ['Calculate GDP, GNP, NNP and Personal Income', 'Explain circular flow of income in open economies'] }
      ]
    }
  ],

  // 8. Commerce (2878721f-f3a8-4783-8c98-d2d794cbb81e)
  '2878721f-f3a8-4783-8c98-d2d794cbb81e': [
    {
      name: 'Introduction to Commerce & Trade',
      description: 'Scope of commerce, home trade, foreign trade, retail and wholesale trade.',
      subtopics: [
        { name: 'Home Trade & Documents', learningObjectives: ['Distinguish functions of wholesaler and retailer', 'Identify commercial documents (invoice, debit note, credit note)'] }
      ]
    },
    {
      name: 'Business Units & Capital Structures',
      description: 'Sole proprietorship, partnership, public/private limited companies, cooperatives.',
      subtopics: [
        { name: 'Limited Liability Companies', learningObjectives: ['Compare private and public limited liability companies', 'Distinguish shares, debentures, authorized capital and paid-up capital'] }
      ]
    },
    {
      name: 'Auxiliaries to Trade',
      description: 'Banking, insurance, warehousing, transportation, communication, advertising.',
      subtopics: [
        { name: 'Insurance & Risk Management', learningObjectives: ['Explain principles of indemnity, utmost good faith, insurable interest', 'Differentiate life assurance and non-life insurance'] }
      ]
    }
  ],

  // 9. Principles of Accounts (e6cd3303-859a-4a89-9bd9-54e0f794c141)
  'e6cd3303-859a-4a89-9bd9-54e0f794c141': [
    {
      name: 'Accounting Bookkeeping & Double Entry',
      description: 'Source documents, books of prime entry, ledger accounts, trial balance.',
      subtopics: [
        { name: 'Double Entry Rules & Ledger Posting', learningObjectives: ['Apply debit and credit rules to asset, liability, revenue and expense accounts', 'Prepare trial balance and rectify bookkeeping errors'] }
      ]
    },
    {
      name: 'Final Accounts of Sole Trader',
      description: 'Trading, profit & loss account, balance sheet, adjustments (accruals, prepayments).',
      subtopics: [
        { name: 'Financial Statements Adjustments', learningObjectives: ['Calculate provisions for bad debts and depreciation', 'Prepare Trading Account to derive Gross Profit and Net Profit'] }
      ]
    },
    {
      name: 'Partnership & Company Accounts',
      description: 'Partnership appropriation account, goodwill, company capital accounts.',
      subtopics: [
        { name: 'Partnership Accounts', learningObjectives: ['Prepare Partnership Appropriation Account considering interest on capital and drawings', 'Calculate goodwill on admission or retirement of a partner'] }
      ]
    }
  ],

  // 10. Government (dd508eab-063d-41da-a52c-2811866e354f)
  'dd508eab-063d-41da-a52c-2811866e354f': [
    {
      name: 'Basic Concepts of Government & Political Thought',
      description: 'State, nation, sovereignty, power, authority, political ideas (democracy, socialism).',
      subtopics: [
        { name: 'Sovereignty & Rule of Law', learningObjectives: ['Define types of sovereignty (legal, political, popular)', 'Analyze principles and limitations of the Rule of Law'] }
      ]
    },
    {
      name: 'Structures & Organs of Government',
      description: 'Legislature, executive, judiciary, separation of powers, checks and balances.',
      subtopics: [
        { name: 'Separation of Powers & Organs', learningObjectives: ['Compare bicameral and unicameral legislatures', 'Explain mechanisms of judicial independence'] }
      ]
    },
    {
      name: 'Constitutional Development in Nigeria',
      description: 'Pre-independence constitutions (Clifford, Richards, Macpherson, Lyttelton) & post-independence constitutions.',
      subtopics: [
        { name: 'Colonial Constitutions (1922 - 1960)', learningObjectives: ['Analyze features and flaws of Richards (1946) and Macpherson (1951) constitutions', 'Trace federalism origins in Lyttelton (1954) constitution'] }
      ]
    }
  ],

  // 11. Literature in English (f8c5af4e-4f6a-4eac-9632-724397a96e6b)
  'f8c5af4e-4f6a-4eac-9632-724397a96e6b': [
    {
      name: 'Literary Appreciation & Terminology',
      description: 'Prose, drama, poetry terms, figures of speech, rhyme schemes, meter.',
      subtopics: [
        { name: 'Figures of Speech & Tropes', learningObjectives: ['Identify irony, paradox, oxymoron, personification, metonymy', 'Analyze poetic rhyme scheme and meter'] }
      ]
    },
    {
      name: 'Prescribed African & Non-African Prose',
      description: 'Detailed analysis of JAMB syllabus prescribed novels.',
      subtopics: [
        { name: 'African Prose Analysis', learningObjectives: ['Examine plot, setting, characterization and themes in prescribed African novels', 'Contextualize socio-political motifs'] }
      ]
    },
    {
      name: 'Prescribed Drama & Poetry',
      description: 'Dramatic techniques, stage directions, poetic analysis.',
      subtopics: [
        { name: 'African & Non-African Drama', learningObjectives: ['Analyze tragicomedy features, soliloquies, dramatic irony', 'Evaluate character motivations and climax'] }
      ]
    }
  ],

  // 12. Christian Religious Studies (c613205e-2b39-481b-a850-0a2dc11ceab4)
  'c613205e-2b39-481b-a850-0a2dc11ceab4': [
    {
      name: 'Old Testament History & Sovereignty of God',
      description: 'Creation, Covenant, Leadership of Moses, Joshua, Judges, Kings of Israel.',
      subtopics: [
        { name: 'Covenant & Patriarchs', learningObjectives: ['Trace God\'s covenant with Abraham, Moses and David', 'Evaluate leadership lessons from King Solomon and David'] }
      ]
    },
    {
      name: 'New Testament & The Life of Jesus Christ',
      description: 'Birth, baptism, temptations, ministry, parables, miracles, death and resurrection.',
      subtopics: [
        { name: 'Ministry & Parables of Jesus', learningObjectives: ['Interpret moral and spiritual lessons of Jesus\' parables', 'Analyze significance of resurrection and ascension'] }
      ]
    },
    {
      name: 'The Early Church & Epistles',
      description: 'Pentecost, fellowship of believers, missionary journeys of Paul, faith and works.',
      subtopics: [
        { name: 'Pauline Epistles & Early Church', learningObjectives: ['Examine Paul\'s teaching on justification by faith in Romans', 'Explain unity and spiritual gifts in 1 Corinthians'] }
      ]
    }
  ],

  // 13. Islamic Religious Studies (d66e0d1a-e0f5-4f2f-8c86-2afb7b5c83e9)
  'd66e0d1a-e0f5-4f2f-8c86-2afb7b5c83e9': [
    {
      name: 'Tarikh (Islamic History & Life of Prophet Muhammad)',
      description: 'Pre-Islamic Arabia (Jahiliyyah), Prophet\'s birth, revelations, Hijrah, battles of Badr/Uhud.',
      subtopics: [
        { name: 'Prophetic Era & Caliphate', learningObjectives: ['Detail events of Hijrah to Madinah', 'Outline achievements of the Four Rightly Guided Caliphs (Khulafa ar-Rashidun)'] }
      ]
    },
    {
      name: 'Tawhid & Fiqh (Islamic Jurisprudence)',
      description: 'Articles of faith, 5 pillars of Islam, Taharah, Salat, Zakat, Sawm, Hajj.',
      subtopics: [
        { name: 'Pillars of Islam & Worship Rules', learningObjectives: ['Explain conditions, pillars and nullifiers of Salat and Sawm', 'Calculate Zakat distribution rates'] }
      ]
    },
    {
      name: 'Quran & Hadith Literature',
      description: 'Revelation, preservation of Quran, Surahs study, Hadith science and collections.',
      subtopics: [
        { name: 'Prescribed Surahs & Hadith', learningObjectives: ['Memorize and translate prescribed short Surahs', 'Apply moral guidance from An-Nawawi Hadith collection'] }
      ]
    }
  ],

  // 14. Geography (6b59769b-f9dc-4752-86cb-9bb0baaae41f)
  '6b59769b-f9dc-4752-86cb-9bb0baaae41f': [
    {
      name: 'Practical Geography & Map Reading',
      description: 'Scale, contour interpretation, gradient, cross-sections, grid references.',
      subtopics: [
        { name: 'Contour Interpretation & Relief', learningObjectives: ['Identify landforms (spurs, valleys, plateaus) on topographical maps', 'Calculate gradient and intervisibility between two points'] }
      ]
    },
    {
      name: 'Physical Geography & Earth Systems',
      description: 'Solar system, rocks, weathering, rivers, climate, vegetation zones.',
      subtopics: [
        { name: 'Rocks & Weathering Processes', learningObjectives: ['Classify igneous, sedimentary and metamorphic rocks', 'Differentiate physical, chemical and biological weathering'] }
      ]
    },
    {
      name: 'Human & Regional Geography of Nigeria',
      description: 'Population distribution, minerals, industries, agriculture, transportation.',
      subtopics: [
        { name: 'Mineral Resources & Industry in Nigeria', learningObjectives: ['Locate major mineral deposits (crude oil, coal, tin, iron ore)', 'Analyze factors favoring industrial localization in Nigeria'] }
      ]
    }
  ],

  // 15. Computer Studies (27301c5d-9652-4a18-8d77-d104bf8a093a)
  '27301c5d-9652-4a18-8d77-d104bf8a093a': [
    {
      name: 'Fundamentals of Computing & Hardware Architecture',
      description: 'History of computers, CPU, memory (RAM/ROM), storage devices, input/output peripherals.',
      subtopics: [
        { name: 'CPU Architecture & Memory Systems', learningObjectives: ['Explain roles of ALU, Control Unit and Registers inside CPU', 'Compare RAM vs ROM and primary vs secondary storage'] }
      ]
    },
    {
      name: 'System Software, Programming & Algorithms',
      description: 'Operating systems, compilers, logic gates, flowcharts, pseudocode, high-level languages.',
      subtopics: [
        { name: 'Flowcharts & Logic Gates', learningObjectives: ['Construct AND, OR, NOT, NAND, NOR truth tables', 'Trace algorithmic execution in flowcharts and pseudocode'] }
      ]
    },
    {
      name: 'Networking, Internet & Cybersecurity',
      description: 'LAN/WAN, OSI model, IP addressing, web browsers, malware, encryption, data privacy.',
      subtopics: [
        { name: 'Network Topologies & Security', learningObjectives: ['Compare Star, Bus, Ring and Mesh network topologies', 'Identify cyber threats (phishing, malware, ransomware) and mitigation'] }
      ]
    }
  ],

  // 16. History (c5a5791b-dd92-40d0-8ce2-3265a158d7a9)
  'c5a5791b-dd92-40d0-8ce2-3265a158d7a9': [
    {
      name: 'Pre-Colonial Kingdoms in Nigeria',
      description: 'Kanem-Borno, Hausa States, Oyo Empire, Benin Kingdom, Niger Delta states.',
      subtopics: [
        { name: 'Oyo Empire & Benin Kingdom', learningObjectives: ['Examine political structure of Old Oyo Empire (Alaafin, Oyomesi, Bashorun)', 'Analyze socio-economic history of Benin Kingdom'] }
      ]
    },
    {
      name: 'Colonial Rule & Nationalism in Nigeria',
      description: 'British conquest, Amalgamation of 1914, indirect rule, nationalist movements.',
      subtopics: [
        { name: 'Indirect Rule System', learningObjectives: ['Compare indirect rule execution in Northern, Western and Eastern Nigeria', 'Analyze Aba Women\'s War of 1929'] }
      ]
    }
  ],

  // 17. Hausa (bb2dc95d-9be4-45b5-b7fd-0e95738684ea)
  'bb2dc95d-9be4-45b5-b7fd-0e95738684ea': [
    {
      name: 'Harshe da Tsarin Magana (Hausa Grammar & Linguistics)',
      description: 'Hausa phonology, morphology, syntax, orthography and vocabulary.',
      subtopics: [
        { name: 'Tsarin Sauti da Gimbiya', learningObjectives: ['Analyze Hausa consonant/vowel sound systems', 'Apply correct Hausa spelling and orthography rules'] }
      ]
    },
    {
      name: 'Adabin Hausa (Hausa Literature & Culture)',
      description: 'Hausa oral literature, proverbs, poetry, prose, and traditional cultural customs.',
      subtopics: [
        { name: 'Karin Magana da Al\'adu', learningObjectives: ['Interpret traditional Hausa proverbs (Karin Magana)', 'Examine Hausa marriage, naming and chieftaincy customs'] }
      ]
    }
  ],

  // 18. Igbo (3f4b1315-336a-4773-acfc-47c7f01e7a25)
  '3f4b1315-336a-4773-acfc-47c7f01e7a25': [
    {
      name: 'Asusu Igbo (Igbo Language & Grammar)',
      description: 'Igbo phonetics (Udaasusu), grammar rules, sentence structure, orthography (Akpalaokwu).',
      subtopics: [
        { name: 'Udaasusu na Nsugbe', learningObjectives: ['Identify Igbo vowel harmony (Udaigwe na Udase)', 'Apply Igbo grammar and concord rules'] }
      ]
    },
    {
      name: 'Omenala na Litreshọ Igbo (Igbo Literature & Culture)',
      description: 'Igbo oral literature, proverbs (Ilulu), customs, festivals, and prescribed texts.',
      subtopics: [
        { name: 'Ilulu Igbo na Omenala', learningObjectives: ['Decode contextual meanings of traditional Igbo proverbs', 'Describe Igbo festivals (Iwa Ji, New Yam Festival)'] }
      ]
    }
  ],

  // 19. Yoruba (74a96d0c-86e0-491d-bd40-216d06ff54e6)
  '74a96d0c-86e0-491d-bd40-216d06ff54e6': [
    {
      name: 'Ede Yoruba (Yoruba Language & Phonology)',
      description: 'Yoruba vowels, consonants, tones (Middles, High, Low), grammar, and composition.',
      subtopics: [
        { name: 'Ami Ohun da Faweli', learningObjectives: ['Assign correct tone marks (Do, Re, Mi / Ami Ohun) on Yoruba words', 'Differentiate oral and nasal vowels'] }
      ]
    },
    {
      name: 'Asa da Litireso Yoruba (Yoruba Literature & Culture)',
      description: 'Yoruba proverbs (Owe), poetry (Ewi), cultural traditions, chieftaincy, traditional beliefs.',
      subtopics: [
        { name: 'Owe Yoruba da Asa', learningObjectives: ['Analyze moral themes in classic Yoruba proverbs', 'Examine traditional Yoruba rites of passage and chieftaincy'] }
      ]
    }
  ],

  // 20. French (8eca0b50-967a-41bc-83e9-55995af8f816)
  '8eca0b50-967a-41bc-83e9-55995af8f816': [
    {
      name: 'Grammaire et Lexique Français (French Grammar & Vocabulary)',
      description: 'French tenses, articles, pronouns, agreement, prepositions, everyday vocabulary.',
      subtopics: [
        { name: 'French Verbs & Conjugation', learningObjectives: ['Conjugate regular and irregular French verbs in Present, Passé Composé, and Futur Simple', 'Use possessive and demonstrative adjectives accurately'] }
      ]
    },
    {
      name: 'Compréhension Écrite et Culture Francophone',
      description: 'French reading comprehension, dialogue translation, Francophone culture.',
      subtopics: [
        { name: 'French Reading Comprehension', learningObjectives: ['Answer factual questions based on short French passages', 'Translate French phrases into English context accurately'] }
      ]
    }
  ]
};

// Simplified syllabus topics map for lightweight lookups
export const CANONICAL_SYLLABUS_TOPICS: Record<string, string[]> = Object.keys(CANONICAL_SYLLABUS_DETAILS).reduce((acc, subjId) => {
  acc[subjId] = CANONICAL_SYLLABUS_DETAILS[subjId].map(t => t.name);
  return acc;
}, {} as Record<string, string[]>);

/**
 * Returns complete syllabus topic details for a given subject (by UUID or name/alias).
 */
export function getCanonicalSyllabusForSubject(subjectIdOrName: string | null | undefined): SyllabusTopicDetail[] {
  if (!subjectIdOrName) return [];
  const subjId = getCanonicalSubjectId(subjectIdOrName);
  if (subjId && CANONICAL_SYLLABUS_DETAILS[subjId]) {
    return CANONICAL_SYLLABUS_DETAILS[subjId];
  }
  return [];
}

