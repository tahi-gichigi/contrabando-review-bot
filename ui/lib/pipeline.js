// ui/lib/pipeline.js — poll-and-reply pipeline (ES module for Vercel Cron)
// State is stored in Vercel KV (REDIS_URL env var) when deployed.
// Falls back to in-memory state if KV is not configured (not persistent across runs).

import { fetchAllNewReviews, postReply, LOCATION_NAME } from './gbp.js';
import { sendWhatsApp } from './notify.js';

// --- Language detection (same logic as poll_and_reply.js) ---
function detectLanguage(text) {
  if (!text || text.trim() === '') return 'PT';
  const t = text.toLowerCase();
  if (/\b(the|and|was|were|very|great|good|bad|not|this|with|have|for)\b/.test(t)) return 'EN';
  if (/\b(muito|obrigad|estava|ficamos|adorei|serviço|atendimento|ótimo|péssimo|excelente)\b/.test(t)) return 'PT';
  if (/\b(muy|fue|bueno|malo|mucho|servicio|comida|estaba|estaban|pero)\b/.test(t)) return 'ES';
  if (/\b(très|était|service|bonne|mauvais|prix|merci|bien|avec|pour)\b/.test(t)) return 'FR';
  if (/\b(molto|buono|servizio|cibo|ottimo|pessimo|grazie|erano|stato)\b/.test(t)) return 'IT';
  return 'PT';
}

// --- State via Vercel KV ---
// KV is optional — if not configured, state won't persist across runs (safe for first deploy)
async function loadState() {
  try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const { kv } = await import('@vercel/kv');
      const state = await kv.get('contrabando:poll-state');
      if (state) return state;
    }
  } catch (e) {
    console.warn('[pipeline] KV not available, using default state');
  }
  return { lastPollTime: new Date().toISOString(), repliedReviewIds: [] };
}

async function saveState(state) {
  try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const { kv } = await import('@vercel/kv');
      await kv.set('contrabando:poll-state', state);
    }
  } catch (e) {
    console.warn('[pipeline] KV save failed:', e.message);
  }
}

// --- Reply generation (inline to avoid importing the root CommonJS file) ---
async function generateReply(starRating, reviewText, language) {
  const OpenAI = (await import('openai')).default;
  const fs = (await import('fs')).default;
  const path = (await import('path')).default;

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const guidelinesPath = path.join(process.cwd(), 'tone-of-voice-guidelines.md');
  const guidelines = fs.readFileSync(guidelinesPath, 'utf8');
  const SYSTEM_PROMPT = `${guidelines}\n\n---\nIMPORTANT: Return only the reply text. No quotes, no label, no explanation. Just the reply.`;

  const response = await client.responses.create({
    model: 'gpt-5-mini',
    instructions: SYSTEM_PROMPT,
    input: `Star rating: ${starRating}\nReview text: ${reviewText || '(no comment)'}\nReviewer language: ${language}`,
    reasoning: { effort: 'minimal' }
  });
  return response.output_text.trim();
}

// --- Main pipeline ---
export async function run({ dryRun = false } = {}) {
  const state = await loadState();
  console.log(`[pipeline] Last poll: ${state.lastPollTime}, replied to ${state.repliedReviewIds.length} reviews`);

  const newReviews = await fetchAllNewReviews(state.lastPollTime);
  console.log(`[pipeline] ${newReviews.length} new reviews since last poll`);

  const unreplied = newReviews.filter(r =>
    !r.reviewReply && !state.repliedReviewIds.includes(r.reviewId)
  );
  console.log(`[pipeline] ${unreplied.length} unreplied`);

  let replied = 0;
  let errors = 0;

  for (const review of unreplied) {
    const { starRating, reviewer, comment, reviewId } = review;
    const lang = detectLanguage(comment);
    console.log(`  ★${starRating} [${lang}] ${reviewer}: "${(comment || '').slice(0, 60)}"`);

    try {
      const reply = await generateReply(starRating, comment, lang);
      console.log(`  → "${reply}"`);

      if (!dryRun) {
        const reviewName = `${LOCATION_NAME}/reviews/${reviewId}`;
        const result = await postReply(reviewName, reply);
        if (result.error) throw new Error(JSON.stringify(result.error));

        state.repliedReviewIds.push(reviewId);
        replied++;

        if (starRating <= 2) await sendWhatsApp(starRating, reviewer, comment);
      } else {
        replied++;
      }
    } catch (err) {
      console.error(`  [error] ${err.message}`);
      errors++;
    }
  }

  state.lastPollTime = new Date().toISOString();
  if (!dryRun) await saveState(state);

  return { processed: unreplied.length, replied, errors };
}
