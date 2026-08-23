import fs from 'fs';

let content = fs.readFileSync('src/components/AIRecommendations.tsx', 'utf8');

// Replace callGroqAPI import with callGroqAPI and safeParseAIJSON
content = content.replace("import { callGroqAPI } from '@/services/aiService';", "import { callGroqAPI, safeParseAIJSON } from '@/services/aiService';");

// Remove heuristicRecs setting logic completely
content = content.replace(/let heuristicRecs: Recommendation\[\] = \[\];[\s\S]*?setRecs\(heuristicRecs\);/m, "");

// Replace the try/catch logic
const oldLogic = `    try {
      const examSummary = examsData.slice(-5).map(e => \`\${e.name}: \${e.score}/400\`).join(', ');
      const prompt = \`You are an AI academic advisor for a Nigerian JAMB student.
Student recent exam scores: \${examSummary} (Average: \${avgScore}/400).
Generate 2 actionable study recommendations in JSON format.
Return ONLY valid JSON array with format:
[
  {
    "priority": "Priority 1",
    "title": "Short title",
    "description": "Short explanation referencing their score",
    "cta": "Action text",
    "link": "/exam",
    "color": "bg-primary/5 border-primary/20 text-primary"
  },
  {
    "priority": "Priority 2",
    "title": "Short title",
    "description": "Short explanation",
    "cta": "Action text",
    "link": "/practice",
    "color": "bg-card border-border text-muted-foreground"
  }
]\`;
      const content = await callGroqAPI([{ role: 'user', content: prompt }]);
      const jsonStart = content.indexOf('[');
      const jsonEnd = content.lastIndexOf(']');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const parsed = JSON.parse(content.substring(jsonStart, jsonEnd + 1));
        if (Array.isArray(parsed) && parsed.length >= 2) {
          setRecs(parsed.slice(0, 2));
        }
      }
    } catch {
      // Heuristic recommendations already set smoothly
    }`;

const newLogic = `    try {
      const examSummary = examsData.slice(-5).map(e => \`\${e.name}: \${e.score}/400\`).join(', ');
      const prompt = \`You are an AI academic advisor for a Nigerian JAMB student.
Student recent exam scores: \${examSummary} (Average: \${avgScore}/400).
Generate 2 actionable study recommendations in JSON format.
Return ONLY valid JSON array with format:
[
  {
    "priority": "Priority 1",
    "title": "Short title",
    "description": "Short explanation referencing their score",
    "cta": "Action text",
    "link": "/exam",
    "color": "bg-primary/5 border-primary/20 text-primary"
  },
  {
    "priority": "Priority 2",
    "title": "Short title",
    "description": "Short explanation",
    "cta": "Action text",
    "link": "/practice",
    "color": "bg-card border-border text-muted-foreground"
  }
]\`;
      const content = await callGroqAPI([{ role: 'user', content: prompt }]);
      const parsed = safeParseAIJSON(content);
      if (Array.isArray(parsed) && parsed.length >= 2) {
        setRecs(parsed.slice(0, 2));
      } else {
        throw new Error('Invalid JSON format from AI');
      }
    } catch (err) {
      console.error('AI Recommendations failed to parse or fetch:', err);
      // Let it fall back to DEFAULT_RECS on failure
    }`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync('src/components/AIRecommendations.tsx', content);
console.log('Fixed AI Recommendations');
