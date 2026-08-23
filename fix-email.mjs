import fs from 'fs';

let content = fs.readFileSync('src/services/emailService.ts', 'utf8');
content = content.replace(/is_paid/g, 'has_paid');
fs.writeFileSync('src/services/emailService.ts', content);
console.log('Fixed emailService.ts has_paid');
