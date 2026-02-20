// Test the diff logic with plain text
const { extractSections, computeDocumentDiff } = require('./lib/diff');

const doc1 = `Prashant
Prashant shishodia
Engineer
AI
Forensic
NLP`;

const doc2 = `Prashant
Prashant shishodia
Engineer
Devolks`;

console.log('=== Testing extractSections ===');
const sections1 = extractSections(doc1);
const sections2 = extractSections(doc2);

console.log('\nDoc 1 sections:', sections1.map(s => ({ title: s.title, content: s.content.substring(0, 50) })));
console.log('\nDoc 2 sections:', sections2.map(s => ({ title: s.title, content: s.content.substring(0, 50) })));

console.log('\n=== Testing computeDocumentDiff ===');
const result = computeDocumentDiff(doc1, doc2, true);
console.log('\nTotal sections:', result.sections.length);
console.log('Stats:', result.stats);

result.sections.forEach((s, i) => {
  console.log(`\nSection ${i + 1}: "${s.title}"`);
  console.log('  Original:', s.originalText ? s.originalText.substring(0, 50) : '(empty)');
  console.log('  Revised:', s.revisedText ? s.revisedText.substring(0, 50) : '(empty)');
  console.log('  Stats:', s.stats);
  console.log('  Path:', s.path);
});
