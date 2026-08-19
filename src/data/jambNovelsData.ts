export interface NovelQuestion {
  id?: string;
  question: string;
  options: string[];
  correct: string;
  explanation: string;
}

export interface NovelChapter {
  id: number;
  chapterNumber: number;
  title: string;
  summary: string;
  keyThemes: string[];
  charactersInvolved: string[];
  keyQuotes?: string[];
  vocabulary?: { word: string; meaning: string }[];
  sampleQuestions: NovelQuestion[];
}

export interface LiteratureBook {
  id: string;
  title: string;
  author: string;
  genre: 'Compulsory UTME Novel' | 'Prose (African)' | 'Prose (Non-African)' | 'Drama (African)' | 'Drama (Non-African)' | 'Poetry';
  description: string;
  coverColor: string;
  chapters: NovelChapter[];
}

export const DEFAULT_JAMB_BOOKS: LiteratureBook[] = [
  {
    id: 'the-life-changer',
    title: 'The Life Changer',
    author: 'Khadija Abubakar Jalli',
    genre: 'Compulsory UTME Novel',
    description: 'The mandatory Use of English prose text for all JAMB UTME candidates detailing Omar\'s journey to Lafayette University and life lessons shared by his mother Ummi.',
    coverColor: 'from-amber-600/30 to-orange-900/30',
    chapters: [
      {
        id: 1,
        chapterNumber: 1,
        title: 'Chapter 1: The Admission & Family Breakfast',
        summary: 'The story opens with Bint, a precocious young girl, boasting about her classroom victory over her teacher Mallam Salihu with a French greeting. Ummi, their mother, enters the conversation, followed by Omar, the eldest child, who announces with great excitement that he has scored 230 in his UTME and has been granted admission to study Law at Lafayette University. Ummi begins preparing Omar for the university environment through vivid storytelling.',
        keyThemes: ['Family Bonding', 'Value of Higher Education', 'Respect for Teachers and Elders'],
        charactersInvolved: ['Ummi (Mother)', 'Omar (18-year-old Law freshman)', 'Bint (Precocious 5-year-old sister)', 'Jamila & Teemah (Sisters)', 'Mallam Salihu (Social Studies Teacher)'],
        keyQuotes: [
          '"Education without character is like a ship without a rudder."',
          '"Bonjour translates to Good Morning in French!"'
        ],
        vocabulary: [
          { word: 'Precocious', meaning: 'Having developed certain abilities at an earlier age than usual' },
          { word: 'Matriculation', meaning: 'Formal admission into a university' }
        ],
        sampleQuestions: [
          {
            question: 'What course was Omar admitted to study at Lafayette University?',
            options: ['A) Medicine', 'B) Law', 'C) Accountancy', 'D) Mass Communication'],
            correct: 'B',
            explanation: 'Omar scored 230 in UTME and secured admission to Lafayette University to study Law.'
          },
          {
            question: 'How did Bint outsmart her teacher Mallam Salihu in class?',
            options: [
              'A) She solved a complex mathematical equation',
              'B) She responded with a French greeting "Bonjour" which he could not translate',
              'C) She recited the national anthem in Latin',
              'D) She corrected his spelling on the chalkboard'
            ],
            correct: 'B',
            explanation: 'Bint asked Mallam Salihu what "Bonjour" meant in French, and when he could not answer, she provided the correct meaning "Good Morning".'
          },
          {
            question: 'What score did Omar attain in his UTME exam?',
            options: ['A) 210', 'B) 230', 'C) 280', 'D) 310'],
            correct: 'B',
            explanation: 'Omar scored 230 in his JAMB UTME examination.'
          }
        ]
      },
      {
        id: 2,
        chapterNumber: 2,
        title: 'Chapter 2: The Tale of Talle (The Quiet One)',
        summary: 'Ummi narrates the tragic tale of Talle from Lafayette village. Known as "The Quiet One" because of his reserved demeanor following the deaths of his father and stepmother, Talle worked as a driver at the local council. However, he fell under the criminal influence of Zaki, participating in the extortion and kidnapping of a young boy. When police traced the ransom groceries back to Talle\'s house, he was arrested and disgraced.',
        keyThemes: ['Peer Influence and Deception', 'Appearance vs Reality', 'Consequences of Greed and Crime'],
        charactersInvolved: ['Talle (The Quiet One)', 'Zaki (Criminal mastermind)', 'Hakimi (District Head)', 'Police Officers'],
        keyQuotes: [
          '"Silence is not always a sign of innocence; still waters can run deep and dangerous."'
        ],
        vocabulary: [
          { word: 'Reserved', meaning: 'Slow to reveal emotion or opinions; introverted' },
          { word: 'Extortion', meaning: 'Obtaining something through force, threats, or fraud' }
        ],
        sampleQuestions: [
          {
            question: 'Why was Talle known throughout Lafayette as "The Quiet One"?',
            options: [
              'A) He was born mute',
              'B) He was naturally reserved, introverted, and never engaged in arguments',
              'C) He was forbidden from speaking by traditional customs',
              'D) He took a religious vow of silence'
            ],
            correct: 'B',
            explanation: 'Talle was extraordinarily silent, never quarreled with neighbors, and lived an isolated lifestyle after losing his family.'
          },
          {
            question: 'What led to Talle\'s sudden exposure and arrest by the police?',
            options: [
              'A) He confessed to the village head',
              'B) He unusually bought an exorbitant amount of groceries that aroused suspicion',
              'C) His accomplice Zaki surrendered',
              'D) The abducted child escaped and showed police the way'
            ],
            correct: 'B',
            explanation: 'Talle, who usually bought minimal groceries, suddenly purchased large quantities of expensive items, leading the grocery seller to alert authorities.'
          }
        ]
      },
      {
        id: 3,
        chapterNumber: 3,
        title: 'Chapter 3: University Freedom & Dress Code Regulations',
        summary: 'Ummi recounts her own matriculation day at the university and an incident with the university authority concerning the dress code. She explains how university offers unprecedented personal freedom, but warns Omar that freedom without responsibility leads directly to academic ruin.',
        keyThemes: ['Campus Freedom vs Moral Accountability', 'Institutional Rules and Dress Codes', 'Modesty'],
        charactersInvolved: ['Ummi', 'Salma', 'University Registrar', 'Faculty Dean'],
        keyQuotes: [
          '"University is a place where you are on your own, but not alone."',
          '"Your freedom ends where the rules of the institution begin."'
        ],
        vocabulary: [
          { word: 'Indecent', meaning: 'Not conforming with generally accepted standards of behavior or morality' },
          { word: 'Matriculation', meaning: 'Ceremony marking entrance into a degree program' }
        ],
        sampleQuestions: [
          {
            question: 'What does Ummi emphasize as the greatest trap for university freshmen?',
            options: [
              'A) Expensive textbooks',
              'B) Mismanagement of newfound personal freedom and time',
              'C) Difficult examination questions',
              'D) Campus cafeteria food'
            ],
            correct: 'B',
            explanation: 'Ummi warns that the lack of parental supervision creates absolute freedom, which often destroys unprepared students.'
          }
        ]
      },
      {
        id: 4,
        chapterNumber: 4,
        title: 'Chapter 4: Salma and the Roommates (Queen Amina Hall)',
        summary: 'Salma, a proud, sophisticated, and overly confident student, arrives at Queen Amina Hall hostel. She initially looks down on her assigned roommates: Tomiwa (from Ibadan), Ada (from Benue), and Ngozi (from Umunze). Despite regional and cultural differences, the four girls forge an unbreakable sisterhood and academic study group, teaching Salma tolerance.',
        keyThemes: ['National Unity and Cultural Diversity', 'Hostel Life Realities', 'Overcoming Prejudice'],
        charactersInvolved: ['Salma (Sophisticated student)', 'Tomiwa (Yoruba roommate from Ibadan)', 'Ada (Middle-belt roommate from Benue)', 'Ngozi (Igbo roommate from Umunze)'],
        keyQuotes: [
          '"Nigeria in miniature: four girls from four corners of the country under one roof."'
        ],
        vocabulary: [
          { word: 'Prejudice', meaning: 'Preconceived opinion not based on reason or actual experience' },
          { word: 'Cosmopolitan', meaning: 'Familiar with and at ease in many different countries and cultures' }
        ],
        sampleQuestions: [
          {
            question: 'Which university hostel was allocated to Salma and her roommates?',
            options: ['A) Mary Slessor Hall', 'B) Queen Amina Hall', 'C) Moremi Hall', 'D) Bello Hall'],
            correct: 'B',
            explanation: 'Salma was allocated a room in Queen Amina Hall alongside Tomiwa, Ada, and Ngozi.'
          },
          {
            question: 'Where did Tomiwa, one of Salma\'s roommates, hail from?',
            options: ['A) Enugu', 'B) Ibadan', 'C) Jos', 'D) Calabar'],
            correct: 'B',
            explanation: 'Tomiwa came from the historic city of Ibadan in Oyo State.'
          }
        ]
      },
      {
        id: 5,
        chapterNumber: 5,
        title: 'Chapter 5: Salma, Habib, and Labaran',
        summary: 'Salma is picked up in a luxury Mercedes Benz by two influential older men: Honorable Habib (a wealthy politician) and Labaran (his driver and confidant). Salma lies about her identity and brings Tomiwa into the loop. The chapter touches upon transactional campus relationships, vulnerability, and political godfatherism.',
        keyThemes: ['Materialism and Sugar Daddies', 'Pretense and Dishonesty', 'Campus Lifestyle Traps'],
        charactersInvolved: ['Salma', 'Honorable Habib (Politician)', 'Labaran (Driver/Associate)', 'Tomiwa'],
        sampleQuestions: [
          {
            question: 'What vehicle did Habib and Labaran use to pick up Salma near campus?',
            options: ['A) Toyota Camry', 'B) Mercedes Benz', 'C) Range Rover', 'D) Peugeot 504'],
            correct: 'B',
            explanation: 'Honorable Habib drove a sleek Mercedes Benz when he first encountered Salma.'
          }
        ]
      },
      {
        id: 6,
        chapterNumber: 6,
        title: 'Chapter 6: Examination Malpractice & Expulsion',
        summary: 'Salma, unprepared for her General Studies (GST) exam, brings prohibited "micro-chips" into the exam hall. She gets caught red-handed by the invigilator, Kolawole Abdul. Despite attempting to bribe the lecturer, she is brought before the Examination Malpractice Committee (EMC) and subsequently expelled from Lafayette University.',
        keyThemes: ['Consequences of Academic Cheating', 'Integrity', 'Irreparable Regret'],
        charactersInvolved: ['Salma', 'Kolawole Abdul (Invigilator)', 'Dr. Samuel (EMC Member)', 'EMC Committee'],
        sampleQuestions: [
          {
            question: 'Which course examination was Salma taking when she was caught with malpractice materials?',
            options: ['A) Introduction to Law', 'B) General Studies (GST)', 'C) French 101', 'D) Microeconomics'],
            correct: 'B',
            explanation: 'Salma was caught cheating with notes during her General Studies (GST) examination paper.'
          },
          {
            question: 'What disciplinary action was meted out to Salma by the university senate?',
            options: ['A) One-semester rustication', 'B) Full expulsion from the university', 'C) Written warning and grade deduction', 'D) Community service'],
            correct: 'B',
            explanation: 'The Examination Malpractice Committee recommended her immediate and permanent expulsion.'
          }
        ]
      },
      {
        id: 7,
        chapterNumber: 7,
        title: 'Chapter 7: The Syndicate Fraud of Kabilu',
        summary: 'In desperation to reverse her expulsion, Salma is introduced to Kabilu, a fraudulent tout who claims to have direct connections to the EMC Chairman. Kabilu dupes Salma of ₦100,000, which he gambles away in local gambling joints with criminal associates, leaving Salma devastated and penniless.',
        keyThemes: ['Scams and Confidence Fraud', 'Desperation Leading to Vulnerability', 'Gambling Vices'],
        charactersInvolved: ['Salma', 'Kabilu (Fraudster/Tout)', 'Kabir (EMC impostor)', 'Honorable Habib'],
        sampleQuestions: [
          {
            question: 'How did Kabilu swindle Salma out of her money?',
            options: [
              'A) He promised to buy her exam question leakage',
              'B) He falsely claimed he could bribe the EMC chairman to overturn her expulsion',
              'C) He ran a fake university admissions agency',
              'D) He sold her fake hostel allocation forms'
            ],
            correct: 'B',
            explanation: 'Kabilu posed as a middleman connected to the EMC Chairman, taking ₦100,000 without doing anything.'
          }
        ]
      },
      {
        id: 8,
        chapterNumber: 8,
        title: 'Chapter 8: Zaki\'s Revenge & Law Enforcement',
        summary: 'Habib discovers Kabilu\'s deception and hires Zaki to recover the money and punish Kabilu. However, Zaki\'s criminal operations trigger police intervention. Both Zaki and Kabilu are apprehended by officers, demonstrating that crime always meets justice.',
        keyThemes: ['Law and Order', 'The Inevitability of Justice', 'Retribution'],
        charactersInvolved: ['Zaki', 'Kabilu', 'Honorable Habib', 'State Police Command'],
        sampleQuestions: [
          {
            question: 'Whom did Honorable Habib contract to track down Kabilu and recover the extorted money?',
            options: ['A) The State Police Commissioner', 'B) Zaki', 'C) Mallam Salihu', 'D) Labaran'],
            correct: 'B',
            explanation: 'Habib engaged Zaki, an underground enforcer, to track down Kabilu and recover the swindled cash.'
          }
        ]
      },
      {
        id: 9,
        chapterNumber: 9,
        title: 'Chapter 9: Redemption, Repentance & The Future',
        summary: 'Salma experiences a profound moral transformation. Following the sudden death of her father and her mother\'s patient counseling, Salma embraces humility, modesty, and genuine repentance. She resolves to rebuild her life with integrity. Omar, having listened to all his mother\'s stories, matriculates into Lafayette University equipped with wisdom to excel.',
        keyThemes: ['Redemption and Forgiveness', 'Parental Wisdom', 'New Beginnings and Character Rebirth'],
        charactersInvolved: ['Salma', 'Ummi', 'Omar', 'Salma\'s Mother', 'Lafayette Community'],
        sampleQuestions: [
          {
            question: 'What major personal transformation did Salma undergo at the conclusion of the novel?',
            options: [
              'A) She abandoned academics and moved abroad',
              'B) She embraced humility, genuine moral repentance, and dedicated her life to integrity',
              'C) She joined a political campaign organization',
              'D) She opened a grocery store in Lafayette'
            ],
            correct: 'B',
            explanation: 'Salma realized the vanity of her previous arrogant lifestyle and reformed into a humble, God-fearing, and disciplined young woman.'
          },
          {
            question: 'What is the overarching moral lesson of "The Life Changer"?',
            options: [
              'A) University life is purely about having social fun',
              'B) Character, discipline, honesty, and parental guidance are paramount to true success in life',
              'C) Wealth alone guarantees academic excellence',
              'D) Silence is always superior to action'
            ],
            correct: 'B',
            explanation: 'The entire novel illustrates that academic ambition without moral grounding, humility, and character will invariably lead to downfall.'
          }
        ]
      }
    ]
  },
  {
    id: 'second-class-citizen',
    title: 'Second Class Citizen',
    author: 'Buchi Emecheta',
    genre: 'Prose (African)',
    description: 'The compelling story of Adah Obi, a courageous Nigerian woman who struggles against patriarchy, racial discrimination, and an abusive marriage in post-colonial London to fulfill her dream of becoming a writer.',
    coverColor: 'from-blue-600/30 to-slate-900/30',
    chapters: [
      {
        id: 1,
        chapterNumber: 1,
        title: 'Childhood Dreams in Ibuza & Lagos',
        summary: 'Introduces young Adah in colonial Lagos. Against traditional patriarchal resistance that devalues female education, Adah sneaks off to Ladi-Lak Institute to secure an education. Her father (Pa) supports her before his untimely demise.',
        keyThemes: ['Gender Inequality in Education', 'Determination and Resilience', 'Patriarchal Oppression'],
        charactersInvolved: ['Adah Obi', 'Pa (Father)', 'Ma (Mother)', 'Boy (Brother)'],
        sampleQuestions: [
          {
            question: 'Why was Adah initially denied formal primary school education by her family?',
            options: [
              'A) The family was wealthy enough to hire home tutors',
              'B) As a girl child, her education was considered an unprofitable investment',
              'C) There were no schools in Lagos at the time',
              'D) She failed the entrance assessment'
            ],
            correct: 'B',
            explanation: 'Traditional patriarchal attitudes viewed the education of girls as a waste of resources since she would marry into another family.'
          }
        ]
      }
    ]
  },
  {
    id: 'the-lion-and-the-jewel',
    title: 'The Lion and the Jewel',
    author: 'Wole Soyinka',
    genre: 'Drama (African)',
    description: 'A classic comedic drama depicting the rivalry between traditional Yoruba values (represented by Baroka, the Bale of Ilujinle) and Western modernism (represented by Lakunle, the arrogant schoolteacher) for the hand of Sidi, the village beauty.',
    coverColor: 'from-emerald-600/30 to-teal-900/30',
    chapters: [
      {
        id: 1,
        chapterNumber: 1,
        title: 'Morning: Sidi and Lakunle',
        summary: 'Lakunle, the progressive but pompous schoolteacher, attempts to court Sidi without paying the traditional bride price, calling it barbaric. Sidi adamantly refuses, asserting that her self-worth and village reputation depend on the bride price.',
        keyThemes: ['Tradition vs Modernity', 'Bride Price and Cultural Dignity', 'Feminine Beauty as Power'],
        charactersInvolved: ['Sidi (The Jewel of Ilujinle)', 'Lakunle (Schoolteacher)', 'Baroka (The Lion / Bale of Ilujinle)', 'Sadiku (Head Wife)'],
        sampleQuestions: [
          {
            question: 'Why does Lakunle vehemently refuse to pay Sidi\'s bride price?',
            options: [
              'A) He does not have enough money in savings',
              'B) He considers bride price an uncivilized, barbaric African custom that equates women to property',
              'C) Sidi\'s father demanded too much livestock',
              'D) Baroka forbade marriage in Ilujinle'
            ],
            correct: 'B',
            explanation: 'Lakunle claims modern Western civilization considers bride price an oppressive and outdated custom.'
          }
        ]
      }
    ]
  }
];
