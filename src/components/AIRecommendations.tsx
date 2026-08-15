import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { BrainCircuit, ArrowRight, RefreshCw } from 'lucide-react';
import { callGroqAPI } from '@/services/aiService';

interface AIRecommendationsProps {
  profileId: string;
  examsData: { name: string; score: number }[];
}

interface Recommendation {
  priority: string;
  title: string;
  description: string;
  cta: string;
  link: string;
  color: string;
}

const DEFAULT_RECS: Recommendation[] = [
  {
    priority: 'Priority 1',
    title: 'Take Your First Practice Exam',
    description: 'Start with a full CBT mock exam to establish your baseline score and identify improvement areas.',
    cta: 'Start CBT Exam',
    link: '/exam',
    color: 'bg-primary/5 border-primary/20 text-primary'
  },
  {
    priority: 'Priority 2',
    title: 'Review the JAMB Syllabus',
    description: 'Explore all JAMB subjects and topics. Build a structured study plan based on the official syllabus.',
    cta: 'Build Study Plan',
    link: '/plan',
    color: 'bg-card border-border text-muted-foreground'
  }
];

export const AIRecommendations = ({ profileId: _profileId, examsData }: AIRecommendationsProps) => {
  const [recs, setRecs] = useState<Recommendation[]>(DEFAULT_RECS);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchRecommendations = useCallback(async () => {
    if (examsData.length === 0) return; // No data yet, show defaults
    setLoading(true);
    try {
      const examSummary = examsData.slice(-5).map(e => `${e.name}: ${e.score}/400`).join(', ');

      const prompt = `You are an AI academic advisor for a Nigerian JAMB student.

Student's recent exam scores (out of 400): ${examSummary}

Based on this data, generate exactly 2 personalized study recommendations in JSON format. Each recommendation must:
- Be specific and actionable
- Reference the student's actual score trend
- Link to one of these pages: /exam, /practice, /weakness, /plan, /flashcards, /library

Return ONLY valid JSON array:
[
  {
    "priority": "Priority 1",
    "title": "Short action title (max 6 words)",
    "description": "2-sentence explanation referencing their score (max 150 chars)",
    "cta": "Button text (3 words max)",
    "link": "/exam",
    "color": "bg-primary/5 border-primary/20 text-primary"
  },
  {
    "priority": "Priority 2",
    "title": "Short action title (max 6 words)",
    "description": "2-sentence explanation (max 150 chars)",
    "cta": "Button text (3 words max)",
    "link": "/practice",
    "color": "bg-card border-border text-muted-foreground"
  }
]`;

      const content = await callGroqAPI([{ role: 'user', content: prompt }]);
      const jsonStart = content.indexOf('[');
      const jsonEnd = content.lastIndexOf(']');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const parsed = JSON.parse(content.substring(jsonStart, jsonEnd + 1));
        if (Array.isArray(parsed) && parsed.length >= 2) {
          setRecs(parsed.slice(0, 2));
        }
      }
      setFetched(true);
    } catch (err) {
      console.error('AI recommendations failed:', err);
      // Silently fall back to defaults
    } finally {
      setLoading(false);
    }
  }, [examsData]);

  useEffect(() => {
    if (!fetched && examsData.length > 0) {
      fetchRecommendations();
    }
  }, [fetched, examsData, fetchRecommendations]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2].map(i => (
          <div key={i} className="bg-card border border-border rounded-2xl p-6 animate-pulse">
            <div className="h-3 w-16 bg-muted rounded mb-3" />
            <div className="h-5 w-3/4 bg-muted rounded mb-3" />
            <div className="h-3 w-full bg-muted rounded mb-1" />
            <div className="h-3 w-2/3 bg-muted rounded mb-6" />
            <div className="h-9 w-32 bg-muted rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {recs.map((rec, i) => (
          <div key={i} className={`border rounded-2xl p-6 flex flex-col justify-between ${rec.color}`}>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider mb-2 opacity-70">{rec.priority}</div>
              <h3 className="text-lg font-bold mb-2">{rec.title}</h3>
              <p className="text-sm opacity-80 mb-4 leading-relaxed">{rec.description}</p>
            </div>
            <Button asChild className={i === 0 ? 'w-full sm:w-auto self-start shadow-premium' : 'w-full sm:w-auto self-start'} variant={i === 0 ? 'default' : 'outline'}>
              <Link to={rec.link} className="gap-2">
                {rec.cta} <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        ))}
      </div>
      {fetched && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <BrainCircuit className="w-3 h-3" />
          <span>Personalized by AI based on your performance</span>
          <button onClick={fetchRecommendations} className="ml-auto flex items-center gap-1 hover:text-foreground transition-colors">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
      )}
    </div>
  );
};
