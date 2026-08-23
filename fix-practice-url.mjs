import fs from 'fs';

let content = fs.readFileSync('src/pages/PracticeSetup.tsx', 'utf8');

const targetStr = `  const [selectedSubject, setSelectedSubject] = useState('');`;
const replaceStr = `  const [selectedSubject, setSelectedSubject] = useState(searchParams.get('subjectId') || '');`;

content = content.replace(targetStr, replaceStr);

fs.writeFileSync('src/pages/PracticeSetup.tsx', content);
console.log('Fixed PracticeSetup.tsx URL param');
