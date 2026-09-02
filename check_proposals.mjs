import fs from 'fs';

const cs = fs.readFileSync('src/pages/admin-tabs/ContentStudioTab.tsx', 'utf8');
console.log("ContentStudioTab lines:", cs.split('\n').length);
console.log("Has proposal review controls:", cs.includes('proposal') || cs.includes('approve') || cs.includes('reject') || cs.includes('confidence'));

const cq = fs.readFileSync('src/pages/admin-tabs/CorrectionQueueTab.tsx', 'utf8');
console.log("CorrectionQueueTab lines:", cq.split('\n').length);
console.log("CorrectionQueueTab checks reported_errors:", cq.includes('reported_errors'));
