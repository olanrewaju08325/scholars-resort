import fs from 'fs';

let content = fs.readFileSync('src/components/dashboard/WeeklyChallenge.tsx', 'utf8');

if (!content.includes('fetchQuestionsForSubject')) {
  content = content.replace("import { callGroqAPI }", "import { callGroqAPI } from '@/services/aiService';\nimport { fetchQuestionsForSubject } from '@/utils/subjectUtils';");
  // wait, callGroqAPI import is already there, let's just do:
  content = content.replace("import { callGroqAPI } from '@/services/aiService';", "import { callGroqAPI } from '@/services/aiService';\nimport { fetchQuestionsForSubject } from '@/utils/subjectUtils';");
}

const targetStr = `      const { data: qData } = await supabase
        .from('questions')
        .select('*, subjects(name)')
        .eq('is_active', true)
        .limit(10);`;

const replaceStr = `      const qData = await fetchQuestionsForSubject(userSubj, 10);`;

content = content.replace(targetStr, replaceStr);

fs.writeFileSync('src/components/dashboard/WeeklyChallenge.tsx', content);
console.log('Fixed WeeklyChallenge.tsx');
