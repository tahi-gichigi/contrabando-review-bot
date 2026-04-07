// pipeline.test.js — pure function tests for language detection
// Run with: node ui/lib/pipeline.test.js
// No test framework needed — just node.

// Mirror of the functions in pipeline.js (extracted for testing without ESM imports)
function stripGoogleTranslation(text) {
  if (!text) return text;
  const originalMatch = text.match(/\(Original\)\s*\n?([\s\S]*)/i);
  if (originalMatch) return originalMatch[1].trim();
  if (/^\(Translated by Google\)/i.test(text.trim())) return '';
  return text;
}

function detectLanguage(text) {
  if (!text || text.trim() === '') return 'PT';
  const t = stripGoogleTranslation(text).toLowerCase();
  if (!t) return 'PT'; // empty after stripping = unknown, default PT
  if (/\b(the|and|was|were|very|great|good|bad|not|this|with|have|for)\b/.test(t)) return 'EN';
  if (/\b(muito|obrigad|estava|ficamos|adorei|serviço|atendimento|ótimo|péssimo|excelente|bom|boa|bons|boas|geral|tudo|aqui|sempre|também|ainda|onde|depois|agora)\b/.test(t)) return 'PT';
  if (/\b(muy|fue|bueno|malo|mucho|servicio|comida|estaba|estaban|pero)\b/.test(t)) return 'ES';
  if (/\b(très|était|service|bonne|mauvais|prix|merci|bien|avec|pour)\b/.test(t)) return 'FR';
  if (/\b(molto|buono|servizio|cibo|ottimo|pessimo|grazie|erano|stato)\b/.test(t)) return 'IT';
  return 'PT';
}

let passed = 0;
let failed = 0;

function expect(label, actual, expected) {
  if (actual === expected) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}: expected "${expected}", got "${actual}"`);
    failed++;
  }
}

console.log('\nstripGoogleTranslation()');

expect(
  'returns native PT text unchanged',
  stripGoogleTranslation('A comida estava muito boa'),
  'A comida estava muito boa'
);

expect(
  'extracts original from full GBP format',
  stripGoogleTranslation('(Translated by Google) The food was great\n(Original)\nA comida estava ótima'),
  'A comida estava ótima'
);

expect(
  'returns empty string when only translation prefix, no Original marker',
  stripGoogleTranslation('(Translated by Google) The food and service were impeccable'),
  ''
);

expect(
  'handles null',
  stripGoogleTranslation(null),
  null
);

expect(
  'handles empty string',
  stripGoogleTranslation(''),
  ''
);

console.log('\ndetectLanguage()');

expect('native PT', detectLanguage('A comida estava muito boa'), 'PT');
expect('native EN', detectLanguage('The food was great and service very good'), 'EN');
expect('native ES', detectLanguage('La comida estaba muy buena'), 'ES');
expect('native FR', detectLanguage('Le service était très bien'), 'FR');
expect('native IT', detectLanguage('Il servizio era molto buono'), 'IT');
expect('star-only (empty)', detectLanguage(''), 'PT');
expect('star-only (null)', detectLanguage(null), 'PT');

// THE BUG CASE: GBP returns translation-only (no Original marker) for a PT review
// Before fix: detectLanguage saw EN words in the translation → returned 'EN'
// After fix: stripGoogleTranslation returns '' → detectLanguage returns 'PT'
expect(
  'PT review with translation-only GBP format defaults to PT (the bug)',
  detectLanguage('(Translated by Google) The food and service were impeccable'),
  'PT'
);

expect(
  'PT review with full GBP format detects PT correctly',
  detectLanguage('(Translated by Google) The food and service were impeccable\n(Original)\nA comida e o atendimento foram impecáveis'),
  'PT'
);

expect(
  'EN review (native, no markers) stays EN',
  detectLanguage('Meat is great. I like the food. The lemonade tastes selfmade.'),
  'EN'
);

// Ana Filipa bug: short PT review with shared PT/ES vocabulary
// Before fix: "comida" matched ES regex first → returned 'ES'
// After fix: "bom", "boa", "geral", "tudo" in PT regex → returns 'PT'
expect(
  'short PT review with shared PT/ES words (Ana Filipa bug)',
  detectLanguage('(Translated by Google) Good food, good atmosphere, overall everything good\n(Original)\nBoa comida, bom ambiente, no geral tudo bom'),
  'PT'
);

expect(
  'PT review with "bom" only',
  detectLanguage('Tudo bom'),
  'PT'
);

expect(
  'PT review with "ambiente" only',
  detectLanguage('Bom ambiente'),
  'PT'
);

// Ensure ES still works for clearly Spanish text
expect(
  'clearly Spanish review still detects as ES',
  detectLanguage('La comida estaba muy buena pero el servicio fue malo'),
  'ES'
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
