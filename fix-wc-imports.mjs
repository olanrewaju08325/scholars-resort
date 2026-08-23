import fs from 'fs';

let content = fs.readFileSync('src/components/dashboard/WeeklyChallenge.tsx', 'utf8');

// replace all multiple imports of callGroqAPI and fetchQuestionsForSubject
content = content.replace(/import { callGroqAPI } from '@\/services\/aiService';\n/g, '');
content = content.replace(/import { fetchQuestionsForSubject } from '@\/utils\/subjectUtils';\n/g, '');

content = `import { callGroqAPI } from '@/services/aiService';\nimport { fetchQuestionsForSubject } from '@/utils/subjectUtils';\n` + content;

fs.writeFileSync('src/components/dashboard/WeeklyChallenge.tsx', content);
