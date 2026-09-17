export interface TournamentQuestion {
  id: string;
  subject_id?: string;
  subject_name: string;
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  difficulty?: string;
  year?: string | number;
}

export const CANONICAL_SUBJECT_QUESTIONS: Record<string, TournamentQuestion[]> = {
  physics: [
    {
      id: 'phy-q1',
      subject_name: 'Physics',
      question_text: 'A stone released from the top of a tower of height 45 m falls freely under gravity. What is its speed just before hitting the ground? (Take g = 10 m/s²)',
      options: ['A) 15 m/s', 'B) 25 m/s', 'C) 30 m/s', 'D) 45 m/s'],
      correct_answer: 'C',
      explanation: 'Using v² = u² + 2gh. Since u = 0, v² = 2(10)(45) = 900. Therefore, v = √900 = 30 m/s.',
      difficulty: 'medium',
      year: 'UTME 2023'
    },
    {
      id: 'phy-q2',
      subject_name: 'Physics',
      question_text: 'Which of the following physical quantities has the same dimensions as work done?',
      options: ['A) Momentum', 'B) Torque', 'C) Power', 'D) Force'],
      correct_answer: 'B',
      explanation: 'Work = Force × distance = [ML²T⁻²]. Torque = Force × perpendicular distance = [ML²T⁻²]. Both share identical dimensions.',
      difficulty: 'easy',
      year: 'UTME 2022'
    },
    {
      id: 'phy-q3',
      subject_name: 'Physics',
      question_text: 'An object is placed 15 cm in front of a concave mirror of focal length 10 cm. What is the image distance and nature?',
      options: ['A) 30 cm, real and inverted', 'B) 30 cm, virtual and erect', 'C) 6 cm, real and erect', 'D) 25 cm, virtual and inverted'],
      correct_answer: 'A',
      explanation: '1/f = 1/u + 1/v => 1/10 = 1/15 + 1/v => 1/v = 1/10 - 1/15 = 1/30 => v = 30 cm. Positive v indicates a real, inverted image.',
      difficulty: 'medium',
      year: 'UTME 2021'
    },
    {
      id: 'phy-q4',
      subject_name: 'Physics',
      question_text: 'A 2 kg metal block absorbs 4200 J of heat energy and its temperature rises from 20°C to 25°C. Calculate the specific heat capacity of the metal.',
      options: ['A) 840 J/(kg·K)', 'B) 420 J/(kg·K)', 'C) 210 J/(kg·K)', 'D) 1050 J/(kg·K)'],
      correct_answer: 'B',
      explanation: 'Q = mcΔθ => 4200 = 2 × c × (25 - 20) => 4200 = 10c => c = 420 J/(kg·K).',
      difficulty: 'easy',
      year: 'UTME 2023'
    },
    {
      id: 'phy-q5',
      subject_name: 'Physics',
      question_text: 'Two resistors of resistance 3 Ω and 6 Ω are connected in parallel across a 12 V battery of negligible internal resistance. Calculate the total current drawn from the battery.',
      options: ['A) 2 A', 'B) 4 A', 'C) 6 A', 'D) 8 A'],
      correct_answer: 'C',
      explanation: 'Equivalent resistance R_eq = (3 × 6)/(3 + 6) = 18/9 = 2 Ω. Total current I = V / R_eq = 12 / 2 = 6 A.',
      difficulty: 'easy',
      year: 'UTME 2022'
    },
    {
      id: 'phy-q6',
      subject_name: 'Physics',
      question_text: 'The phenomenon of total internal reflection occurs only when light passes from:',
      options: [
        'A) An optically denser medium to an optically rarer medium at an angle greater than the critical angle',
        'B) An optically rarer medium to an optically denser medium at an angle less than the critical angle',
        'C) Air to diamond at any incident angle',
        'D) Water to glass at normal incidence'
      ],
      correct_answer: 'A',
      explanation: 'Total internal reflection requires light to travel from a denser medium to a rarer medium with an angle of incidence exceeding the critical angle.',
      difficulty: 'medium',
      year: 'UTME 2024'
    },
    {
      id: 'phy-q7',
      subject_name: 'Physics',
      question_text: 'What is the half-life of a radioactive isotope if 75% of its nuclei decay within 24 days?',
      options: ['A) 6 days', 'B) 8 days', 'C) 12 days', 'D) 18 days'],
      correct_answer: 'C',
      explanation: 'If 75% decays, 25% (or 1/4 = (1/2)²) remains. This corresponds to exactly 2 half-lives. 2 × T_(1/2) = 24 days => T_(1/2) = 12 days.',
      difficulty: 'medium',
      year: 'UTME 2023'
    },
    {
      id: 'phy-q8',
      subject_name: 'Physics',
      question_text: 'The work done in stretching a spring of force constant 200 N/m by an extension of 0.05 m is:',
      options: ['A) 0.25 J', 'B) 0.50 J', 'C) 5.00 J', 'D) 10.0 J'],
      correct_answer: 'A',
      explanation: 'Elastic potential energy W = 1/2 k e² = 0.5 × 200 × (0.05)² = 100 × 0.0025 = 0.25 J.',
      difficulty: 'easy',
      year: 'UTME 2020'
    }
  ],
  mathematics: [
    {
      id: 'mth-q1',
      subject_name: 'Mathematics',
      question_text: 'Find the derivative of y = (3x² - 5)⁴ with respect to x.',
      options: [
        'A) 24x(3x² - 5)³',
        'B) 12x(3x² - 5)³',
        'C) 4(3x² - 5)³',
        'D) 18x²(3x² - 5)³'
      ],
      correct_answer: 'A',
      explanation: 'Using chain rule: dy/dx = 4(3x² - 5)³ × d/dx(3x² - 5) = 4(3x² - 5)³ × 6x = 24x(3x² - 5)³.',
      difficulty: 'medium',
      year: 'UTME 2023'
    },
    {
      id: 'mth-q2',
      subject_name: 'Mathematics',
      question_text: 'Evaluate the limit as x approaches 2 of (x² - 4) / (x - 2).',
      options: ['A) 0', 'B) 2', 'C) 4', 'D) Undefined'],
      correct_answer: 'C',
      explanation: '(x² - 4)/(x - 2) = (x - 2)(x + 2)/(x - 2) = x + 2. Substituting x = 2 yields 2 + 2 = 4.',
      difficulty: 'easy',
      year: 'UTME 2022'
    },
    {
      id: 'mth-q3',
      subject_name: 'Mathematics',
      question_text: 'If log₁₀(2) = 0.3010 and log₁₀(3) = 0.4771, calculate the value of log₁₀(72).',
      options: ['A) 1.8572', 'B) 1.9542', 'C) 1.7781', 'D) 2.0572'],
      correct_answer: 'A',
      explanation: '72 = 2³ × 3². log(72) = 3 log(2) + 2 log(3) = 3(0.3010) + 2(0.4771) = 0.9030 + 0.9542 = 1.8572.',
      difficulty: 'medium',
      year: 'UTME 2023'
    },
    {
      id: 'mth-q4',
      subject_name: 'Mathematics',
      question_text: 'The 3rd and 7th terms of a geometric progression (G.P.) are 9 and 729 respectively. Find the common ratio r (where r > 0).',
      options: ['A) 2', 'B) 3', 'C) 4', 'D) 9'],
      correct_answer: 'B',
      explanation: 'T_7 / T_3 = (a r⁶) / (a r²) = r⁴. 729 / 9 = 81 => r⁴ = 81 => r = 3.',
      difficulty: 'medium',
      year: 'UTME 2021'
    },
    {
      id: 'mth-q5',
      subject_name: 'Mathematics',
      question_text: 'Solve for x in the quadratic equation 2x² - 7x + 3 = 0.',
      options: ['A) x = 3 or x = 1/2', 'B) x = -3 or x = -1/2', 'C) x = 2 or x = 3/2', 'D) x = 1 or x = 6'],
      correct_answer: 'A',
      explanation: '2x² - 6x - x + 3 = 0 => 2x(x - 3) - 1(x - 3) = 0 => (2x - 1)(x - 3) = 0 => x = 1/2 or x = 3.',
      difficulty: 'easy',
      year: 'UTME 2024'
    },
    {
      id: 'mth-q6',
      subject_name: 'Mathematics',
      question_text: 'In how many different ways can the letters of the word "EXCELLENT" be arranged?',
      options: ['A) 30,240', 'B) 60,480', 'C) 15,120', 'D) 181,440'],
      correct_answer: 'A',
      explanation: 'EXCELLENT contains 9 letters with E repeated 3 times and L repeated 2 times. Ways = 9! / (3! × 2!) = 362,880 / (6 × 2) = 30,240.',
      difficulty: 'hard',
      year: 'UTME 2023'
    },
    {
      id: 'mth-q7',
      subject_name: 'Mathematics',
      question_text: 'Integrate (3x² + 4x - 5) dx.',
      options: [
        'A) x³ + 2x² - 5x + C',
        'B) 6x + 4 + C',
        'C) 3x³ + 4x² - 5x + C',
        'D) x³ + 4x² - 5x + C'
      ],
      correct_answer: 'A',
      explanation: '∫3x² dx = x³, ∫4x dx = 2x², ∫-5 dx = -5x. Result: x³ + 2x² - 5x + C.',
      difficulty: 'easy',
      year: 'UTME 2022'
    },
    {
      id: 'mth-q8',
      subject_name: 'Mathematics',
      question_text: 'Find the coordinates of the midpoint of the line segment joining points P(-3, 8) and Q(5, -2).',
      options: ['A) (1, 3)', 'B) (2, 6)', 'C) (-4, 5)', 'D) (4, 3)'],
      correct_answer: 'A',
      explanation: 'Midpoint M = ((x₁ + x₂)/2, (y₁ + y₂)/2) = ((-3 + 5)/2, (8 + -2)/2) = (2/2, 6/2) = (1, 3).',
      difficulty: 'easy',
      year: 'UTME 2020'
    }
  ],
  chemistry: [
    {
      id: 'chm-q1',
      subject_name: 'Chemistry',
      question_text: 'What is the IUPAC name for CH₃-CH(OH)-CH₂-CH₃?',
      options: ['A) Butan-1-ol', 'B) Butan-2-ol', 'C) 2-Methylpropan-1-ol', 'D) Butanoic acid'],
      correct_answer: 'B',
      explanation: 'The 4-carbon alkane chain has the hydroxyl group (-OH) attached to the second carbon atom, making it Butan-2-ol.',
      difficulty: 'easy',
      year: 'UTME 2023'
    },
    {
      id: 'chm-q2',
      subject_name: 'Chemistry',
      question_text: 'Which of the following aqueous solutions will have a pH greater than 7 at 25°C?',
      options: ['A) NaCl', 'B) NH₄Cl', 'C) Na₂CO₃', 'D) HCl'],
      correct_answer: 'C',
      explanation: 'Na₂CO₃ is formed from a strong base (NaOH) and a weak acid (H₂CO₃). Its hydrolysis produces excess OH⁻ ions, yielding an alkaline solution (pH > 7).',
      difficulty: 'medium',
      year: 'UTME 2022'
    },
    {
      id: 'chm-q3',
      subject_name: 'Chemistry',
      question_text: 'How many moles of hydrogen gas are liberated when 4.6 g of sodium reacts completely with excess water? (Na = 23)',
      options: ['A) 0.1 mol', 'B) 0.2 mol', 'C) 0.05 mol', 'D) 0.4 mol'],
      correct_answer: 'A',
      explanation: 'Reaction: 2Na + 2H₂O -> 2NaOH + H₂. Moles of Na = 4.6 / 23 = 0.2 mol. From stoichiometry, 2 mol Na yields 1 mol H₂. Therefore, 0.2 mol Na yields 0.1 mol H₂.',
      difficulty: 'medium',
      year: 'UTME 2021'
    }
  ],
  biology: [
    {
      id: 'bio-q1',
      subject_name: 'Biology',
      question_text: 'Which cellular structure regulates the osmotic concentration and water balance in Amoeba?',
      options: ['A) Contractile vacuole', 'B) Food vacuole', 'C) Pseudopodium', 'D) Nucleus'],
      correct_answer: 'A',
      explanation: 'The contractile vacuole collects and expels excess water entering via osmosis in freshwater unicellular organisms like Amoeba.',
      difficulty: 'easy',
      year: 'UTME 2023'
    },
    {
      id: 'bio-q2',
      subject_name: 'Biology',
      question_text: 'In Mendel\'s monohybrid cross between two heterozygous tall plants (Tt), what is the expected phenotypic ratio in the F₁ generation?',
      options: ['A) 3 Tall : 1 Dwarf', 'B) 1 Tall : 2 Medium : 1 Dwarf', 'C) 1 Tall : 1 Dwarf', 'D) 4 Tall : 0 Dwarf'],
      correct_answer: 'A',
      explanation: 'Crossing Tt × Tt yields TT, Tt, Tt, tt. TT and Tt are tall (3), while tt is dwarf (1). Phenotypic ratio is 3:1.',
      difficulty: 'easy',
      year: 'UTME 2022'
    }
  ],
  'use of english': [
    {
      id: 'eng-q1',
      subject_name: 'Use of English',
      question_text: 'Choose the word that is OPPOSITE in meaning to the capitalized word: The minister delivered an EXTEMPORE address at the convocation ceremony.',
      options: ['A) Prepared', 'B) Spontaneous', 'C) Eloquent', 'D) Lengthy'],
      correct_answer: 'A',
      explanation: '\'Extempore\' means spoken or done without preparation; unrehearsed. The exact opposite is \'Prepared\'.',
      difficulty: 'medium',
      year: 'UTME 2023'
    },
    {
      id: 'eng-q2',
      subject_name: 'Use of English',
      question_text: 'Choose the option that has the SAME vowel sound as the one represented by the letter(s) in capitals: fOOt',
      options: ['A) pOOl', 'B) cOOk', 'C) flOOd', 'D) bLOOd'],
      correct_answer: 'B',
      explanation: '\'Foot\' has the short /ʊ/ vowel sound, which matches \'cook\'. \'Pool\' has the long /u:/, while \'flood\' and \'blood\' have /ʌ/.',
      difficulty: 'easy',
      year: 'UTME 2024'
    }
  ]
};

/**
 * Retrieves high-quality questions filtered strictly to the specified subjects.
 */
export function getCuratedTournamentQuestions(
  subjectFilter: string, 
  count = 20
): TournamentQuestion[] {
  if (!subjectFilter || subjectFilter.trim() === '' || subjectFilter.toLowerCase() === 'all') {
    // Combine questions across physics and math
    const combined = [
      ...CANONICAL_SUBJECT_QUESTIONS.physics,
      ...CANONICAL_SUBJECT_QUESTIONS.mathematics
    ];
    return combined.slice(0, count);
  }

  const requestedSubjects = subjectFilter
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

  const matchedQuestions: TournamentQuestion[] = [];
  const perSubjectCount = Math.max(2, Math.ceil(count / requestedSubjects.length));

  requestedSubjects.forEach(sub => {
    let key = sub;
    if (sub.includes('physic')) key = 'physics';
    else if (sub.includes('math')) key = 'mathematics';
    else if (sub.includes('chem')) key = 'chemistry';
    else if (sub.includes('bio')) key = 'biology';
    else if (sub.includes('eng')) key = 'use of english';

    const pool = CANONICAL_SUBJECT_QUESTIONS[key] || [];
    matchedQuestions.push(...pool.slice(0, perSubjectCount));
  });

  return matchedQuestions.slice(0, count);
}
