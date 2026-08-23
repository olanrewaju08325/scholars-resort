import fs from 'fs';

let content = fs.readFileSync('src/services/emailService.ts', 'utf8');
content = content.replace("const endpoints = ['/api/test-smtp', '/.netlify/functions/send-email', '/api/send-email'];", "const endpoints = ['/api/send-email', '/api/test-smtp'];");
fs.writeFileSync('src/services/emailService.ts', content);
console.log('Fixed endpoints array');
