// ui/lib/pipeline.js — poll-and-reply pipeline (ES module for Vercel Cron)
// State is stored in Vercel KV when deployed.
// Without KV, logs a warning and refuses to run (would be a no-op anyway).

import { fetchAllNewReviews, postReply, LOCATION_NAME } from './gbp.js';
import { sendWhatsApp } from './notify.js';

// --- Language detection ---
// GBP returns "(Translated by Google) ..." before "(Original) ..." for non-English reviews.
// We strip the translation and detect on the original text only.
function stripGoogleTranslation(text) {
  if (!text) return text;
  const match = text.match(/\(Original\)\s*\n?([\s\S]*)/i);
  return match ? match[1].trim() : text;
}

function detectLanguage(text) {
  if (!text || text.trim() === '') return 'PT';
  const t = stripGoogleTranslation(text).toLowerCase();
  if (/\b(the|and|was|were|very|great|good|bad|not|this|with|have|for)\b/.test(t)) return 'EN';
  if (/\b(muito|obrigad|estava|ficamos|adorei|serviço|atendimento|ótimo|péssimo|excelente)\b/.test(t)) return 'PT';
  if (/\b(muy|fue|bueno|malo|mucho|servicio|comida|estaba|estaban|pero)\b/.test(t)) return 'ES';
  if (/\b(très|était|service|bonne|mauvais|prix|merci|bien|avec|pour)\b/.test(t)) return 'FR';
  if (/\b(molto|buono|servizio|cibo|ottimo|pessimo|grazie|erano|stato)\b/.test(t)) return 'IT';
  return 'PT';
}

// --- State via Vercel KV ---
async function getKV() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  const { kv } = await import('@vercel/kv');
  return kv;
}

async function loadState() {
  const kv = await getKV();
  if (kv) {
    const state = await kv.get('contrabando:poll-state');
    if (state) return state;
  }
  // No KV or first run — return default state
  return { lastPollTime: new Date().toISOString(), repliedReviewIds: [] };
}

async function saveState(state) {
  const kv = await getKV();
  if (!kv) {
    console.warn('[pipeline] No Vercel KV — state NOT saved. Next run will start from now.');
    return;
  }
  await kv.set('contrabando:poll-state', state);
}

// --- Reply generation ---
// OpenAI client and guidelines loaded once per run, not per reply
let _openaiClient = null;
let _systemPrompt = null;

function getOpenAIClient() {
  if (!_openaiClient) {
    const OpenAI = require('openai').default || require('openai');
    _openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openaiClient;
}

function getSystemPrompt() {
  if (!_systemPrompt) {
    const fs = require('fs');
    const path = require('path');
    // On Vercel the cwd is the ui/ directory where tone-of-voice-guidelines.md lives
    const guidelinesPath = path.join(process.cwd(), 'tone-of-voice-guidelines.md');
    const guidelines = fs.readFileSync(guidelinesPath, 'utf8');
    _systemPrompt = `${guidelines}\n\n---\nIMPORTANT: Return only the reply text. No quotes, no label, no explanation. Just the reply.`;
  }
  return _systemPrompt;
}

async function generateReply(starRating, reviewText, language) {
  const client = getOpenAIClient();
  const response = await client.responses.create({
    model: 'gpt-5-mini',
    instructions: getSystemPrompt(),
    input: `Star rating: ${starRating}\nReview text: ${reviewText || '(no comment)'}\nReviewer language: ${language}`,
    reasoning: { effort: 'minimal' }
  });
  return response.output_text.trim();
}

// --- Main pipeline ---
export async function run({ dryRun = false } = {}) {
  // Warn loudly if no KV in production — cron will be a no-op
  if (!process.env.KV_REST_API_URL && process.env.VERCEL) {
    console.error('[pipeline] WARNING: No Vercel KV configured. State will not persist between runs. Set up KV or the cron is effectively a no-op.');
  }

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

  // Cap repliedReviewIds to prevent unbounded growth
  if (state.repliedReviewIds.length > 500) {
    state.repliedReviewIds = state.repliedReviewIds.slice(-500);
  }

  state.lastPollTime = new Date().toISOString();
  if (!dryRun) await saveState(state);

  return { processed: unreplied.length, replied, errors };
}
