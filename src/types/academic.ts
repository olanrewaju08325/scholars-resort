// Centralized Academic Taxonomy & Question Data Contracts

export type QuestionSourceType = 
  | 'jamb_past' 
  | 'custom' 
  | 'ai_generated' 
  | 'tournament';

export interface Subject {
  id: string;
  name: string;
  category?: 'core' | 'sciences' | 'commercial' | 'arts_humanities' | 'languages';
  icon?: string;
  is_active?: boolean;
  version?: number;
  created_at?: string;
}

export interface Topic {
  id: string;
  subject_id: string;
  name: string;
  description?: string;
  created_at?: string;
  question_count?: number;
}

export interface Subtopic {
  id: string;
  topic_id: string;
  name: string;
  description?: string;
  created_at?: string;
  question_count?: number;
}

export interface Question {
  id: string;
  subject_id: string;
  topic_id?: string | null;
  subtopic_id?: string | null;
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation?: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  is_active: boolean;
  is_draft?: boolean;
  version_number?: number;
  year?: number | null;
  source_type?: QuestionSourceType;
  source_name?: string | null;
  source_year?: number | null;
  created_at?: string;
  quality_score?: number | null;
  quality_flags?: string[];
  
  // Populated relationships
  subjects?: { name: string };
  topics?: { name: string };
  subtopics?: { name: string };
  subject_name?: string;
  topic_name?: string;
  subtopic_name?: string;
}

export interface TopicConfidenceMapping {
  topic_id: string;
  topic_name: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNMAPPED';
  reason?: string;
}
