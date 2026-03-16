// reply_logic.js — generates a Google Review reply in José's voice
// Usage: node reply_logic.js (runs a quick self-test)
// Or import generateReply() into a server/API route

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Read the guidelines file once at module load (contains system prompt + examples)
const GUIDELINES_PATH = path.join(__dirname, 'tone-of-voice-guidelines.md');
const guidelines = fs.readFileSync(GUIDELINES_PATH, 'utf8');

// Build the system prompt from the guidelines markdown
// We pass the whole file so the model has all rules + examples
const SYSTEM_PROMPT = `${guidelines}

---
IMPORTANT: Return only the reply text. No quotes, no label, no explanation. Just the reply.`;

/**
 * Generate a review reply.
 * @param {number} starRating  - 1 to 5
 * @param {string} reviewText  - the reviewer's comment (empty string for star-only)
 * @param {string} language    - PT | EN | ES | FR | IT | unknown
 * @returns {Promise<string>}  - the reply text
 */
async function generateReply(starRating, reviewText, language = 'PT') {
  const userMessage = `Star rating: ${starRating}
Review text: ${reviewText || '(no comment)'}
Reviewer language: ${language}`;

  const response = await client.responses.create({
    model: 'gpt-5-mini',
    instructions: SYSTEM_PROMPT,
    input: userMessage,
    reasoning: { effort: 'minimal' }
  });

  // Log token usage so we can track cost per reply
  const u = response.usage;
  if (u) {
    const input = u.input_tokens || 0;
    const output = u.output_tokens || 0;
    const reasoning = u.output_tokens_details?.reasoning_tokens || 0;
    // gpt-5-mini pricing (per 1M tokens): input $1.10, output $4.40
    const cost = ((input * 1.10) + (output * 4.40)) / 1_000_000;
    console.log(`  [tokens] input:${input} output:${output} reasoning:${reasoning} | est. $${cost.toFixed(5)}`);
  }

  return response.output_text.trim();
}

module.exports = { generateReply };

// Quick smoke test when run directly
if (require.main === module) {
  const tests = [
    { stars: 5, text: 'Adorei os cocktails e os hambúrgueres. Vamos definitivamente voltar!', lang: 'PT' },
    { stars: 1, text: 'Terrible service, the waiter ignored us for 30 minutes.', lang: 'EN' },
    { stars: 3, text: '', lang: 'PT' },
    { stars: 4, text: 'La comida estaba muy buena pero el servicio fue lento.', lang: 'ES' },
    { stars: 5, text: 'Amazing!', lang: 'EN' },
    { stars: 1, text: 'Um local péssimo, com atendimento mal educado. O atendente Tiago não deveria estar a trabalhar com público.', lang: 'PT' },
    { stars: 2, text: 'Catastrophique ! Service très désagréable et prix exorbitants.', lang: 'FR' },
    { stars: 1, text: 'Fomos maltratados pelo Gerente por causa de uma reserva no The Fork com desconto.', lang: 'PT' }
  ];

  (async () => {
    for (const t of tests) {
      console.log(`\n--- ★${t.stars} [${t.lang}] ---`);
      console.log(`Review: ${t.text || '(no comment)'}`);
      const reply = await generateReply(t.stars, t.text, t.lang);
      console.log(`Reply:  ${reply}`);
    }
  })().catch(console.error);
}
