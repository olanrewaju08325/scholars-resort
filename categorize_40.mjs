import fs from 'fs';

const mismatches = JSON.parse(fs.readFileSync('mismatches_40.json', 'utf8'));

const results = [];

mismatches.forEach((m, idx) => {
  const { id, subject, qText, ca, opts } = m;

  // Let's analyze if there's any exact option match after trimming
  let matchedOpt = null;
  let matchIndex = -1;

  opts.forEach((o, i) => {
    const oTrim = String(o).trim().toLowerCase();
    const caTrim = String(ca).trim().toLowerCase();

    // Check exact or normalized match
    if (oTrim === caTrim) {
      matchedOpt = o;
      matchIndex = i;
    } else if (oTrim.replace(/[^\w]/g, '') === caTrim.replace(/[^\w]/g, '')) {
      matchedOpt = o;
      matchIndex = i;
    }
  });

  let classification = 'NEEDS HUMAN REVIEW';
  let confidence = 'LOW';
  let reason = '';

  if (matchedOpt) {
    classification = 'SAFE TO REPAIR';
    confidence = 'HIGH';
    reason = `Normalized text match with option ${String.fromCharCode(65 + matchIndex)}`;
  } else {
    // Check if ca is in opts partially or if opts are shifted
    if (opts.some(o => o.toLowerCase().includes(ca.toLowerCase()) || ca.toLowerCase().includes(o.toLowerCase()))) {
      classification = 'NEEDS HUMAN REVIEW';
      confidence = 'MEDIUM';
      reason = `Partial overlap found between stored answer "${ca}" and options, but not exact.`;
    } else {
      classification = 'NEEDS HUMAN REVIEW';
      confidence = 'LOW';
      reason = `Stored answer "${ca}" does not match any of the 4 options: [${opts.map(o => `"${o}"`).join(', ')}].`;
    }
  }

  results.push({
    index: idx + 1,
    id,
    subject,
    qTextSnippet: qText.substring(0, 60) + '...',
    ca,
    opts,
    matchedOpt: matchedOpt || 'NONE',
    classification,
    confidence,
    reason
  });
});

console.log("Categorization Breakdown:");
const safe = results.filter(r => r.classification === 'SAFE TO REPAIR');
const review = results.filter(r => r.classification === 'NEEDS HUMAN REVIEW');
const cannot = results.filter(r => r.classification === 'CANNOT DETERMINE');

console.log(`Total Mismatches: ${results.length}`);
console.log(`SAFE TO REPAIR: ${safe.length}`);
console.log(`NEEDS HUMAN REVIEW: ${review.length}`);
console.log(`CANNOT DETERMINE: ${cannot.length}`);

fs.writeFileSync('stage_a_analysis.json', JSON.stringify(results, null, 2));
