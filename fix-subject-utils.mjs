import fs from 'fs';

let content = fs.readFileSync('src/utils/subjectUtils.ts', 'utf8');

const targetStr = `  // 2. Real-time fetch of active questions from Supabase
  const questions = await fetchQuestionsForSubject(subjectIdOrName, 500);
  const availableCount = questions.length;`;

const replaceStr = `  // 2. Real-time fetch of active questions from Supabase
  const questions = await fetchQuestionsForSubject(subjectIdOrName, 500);
  const availableCount = serverCount > 0 ? serverCount : questions.length;`;

content = content.replace(targetStr, replaceStr);

fs.writeFileSync('src/utils/subjectUtils.ts', content);
console.log('Fixed subjectUtils.ts availableCount');
