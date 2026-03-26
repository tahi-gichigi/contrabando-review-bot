// ui/lib/pipeline.js — poll-and-reply pipeline (ES module for Vercel Cron)
// State is stored in Neon Postgres (dedicated to this project via Vercel integration).
// Without DATABASE_URL, logs a warning and starts fresh each run.

import { fetchAllNewReviews, fetchSingleReview, postReply, LOCATION_NAME } from './gbp.js';
import { sendWhatsApp, sendAlert } from './notify.js';

// Safety cap: never process more than this many reviews in a single run.
// Prevents a state reset from triggering mass-replies to hundreds of old reviews.
const MAX_REPLIES_PER_RUN = 20;

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

// --- State via Neon Postgres (dedicated to this project via Vercel integration) ---
// Table: contrabando_state (key TEXT PRIMARY KEY, value JSONB, updated_at TIMESTAMPTZ)
// DATABASE_URL is auto-injected by Vercel's Neon integration.
const STATE_KEY = 'contrabando:poll-state';

async function queryNeon(sql, params = []) {
  const { neon } = await import('@neondatabase/serverless');
  const sql_fn = neon(process.env.DATABASE_URL);
  return sql_fn(sql, params);
}

async function loadState() {
  if (!process.env.DATABASE_URL) {
    console.warn('[pipeline] No DATABASE_URL — state NOT persisted. Starting from now.');
    return { lastPollTime: new Date().toISOString(), repliedReviewIds: [] };
  }
  try {
    const rows = await queryNeon(
      'SELECT value FROM contrabando_state WHERE key = $1',
      [STATE_KEY]
    );
    if (rows && rows.length > 0) return rows[0].value;
  } catch (err) {
    console.warn('[pipeline] State load failed:', err.message);
  }
  return { lastPollTime: new Date().toISOString(), repliedReviewIds: [] };
}

async function saveState(state) {
  if (!process.env.DATABASE_URL) {
    console.warn('[pipeline] No DATABASE_URL — state NOT saved.');
    return;
  }
  try {
    await queryNeon(
      `INSERT INTO contrabando_state (key, value, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [STATE_KEY, JSON.stringify(state)]
    );
  } catch (err) {
    console.warn('[pipeline] State save failed:', err.message);
  }
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
  // Wrap everything in a top-level try/catch to fire an alert on unhandled exceptions
  try {
    return await _run({ dryRun });
  } catch (err) {
    console.error('[pipeline] Unhandled exception:', err.message);
    // Fire-and-forget alert — don't let the alert failure mask the original error
    sendAlert(`Unhandled exception in poll-and-reply:\n${err.message}`).catch(() => {});
    throw err;
  }
}

async function _run({ dryRun = false } = {}) {
  // Warn loudly if no Supabase key in production — cron will be a no-op
  if (!process.env.DATABASE_URL && process.env.VERCEL) {
    console.error('[pipeline] WARNING: No DATABASE_URL configured. State will not persist between runs. Pipeline is a no-op until key is set.');
  }

  const state = await loadState();
  console.log(`[pipeline] Last poll: ${state.lastPollTime}, replied to ${state.repliedReviewIds.length} reviews`);

  // Token refresh failure should alert immediately — don't silently miss all reviews
  let newReviews;
  try {
    newReviews = await fetchAllNewReviews(state.lastPollTime);
  } catch (err) {
    const isTokenError = err.message.includes('Token refresh failed') || err.message.includes('env vars not set');
    if (isTokenError) {
      await sendAlert(`GBP token refresh failed — OAuth re-auth may be needed.\n${err.message}`);
    }
    throw err;
  }
  console.log(`[pipeline] ${newReviews.length} new reviews since last poll`);

  const unreplied = newReviews.filter(r =>
    !r.reviewReply && !state.repliedReviewIds.includes(r.reviewId)
  );
  console.log(`[pipeline] ${unreplied.length} unreplied`);

  // Safety cap: if we somehow have more than MAX_REPLIES_PER_RUN unreplied, process in batches
  if (unreplied.length > MAX_REPLIES_PER_RUN) {
    console.warn(`[pipeline] WARNING: ${unreplied.length} unreplied reviews exceeds cap of ${MAX_REPLIES_PER_RUN}. Processing first ${MAX_REPLIES_PER_RUN} only. Run again to process more.`);
  }
  const toProcess = unreplied.slice(0, MAX_REPLIES_PER_RUN);

  let replied = 0;
  let errors = 0;

  for (const review of toProcess) {
    const { starRating, reviewer, comment, reviewId } = review;
    const lang = detectLanguage(comment);
    const reviewName = `${LOCATION_NAME}/reviews/${reviewId}`;
    console.log(`  ★${starRating} [${lang}] ${reviewer}: "${(comment || '').slice(0, 60)}"`);

    try {
      const reply = await generateReply(starRating, comment, lang);
      console.log(`  → "${reply}"`);

      if (!dryRun) {
        // Double-check: re-fetch this review to confirm it still has no reply before posting.
        // Guards against race conditions or manual replies added between our fetch and post.
        const current = await fetchSingleReview(reviewName);
        if (current && current.reviewReply) {
          console.log(`  [skip] Review ${reviewId} already has a reply (added since fetch) — skipping`);
          state.repliedReviewIds.push(reviewId);
          // Atomic save after each update
          await saveState(state);
          continue;
        }

        const result = await postReply(reviewName, reply);
        if (result.error) throw new Error(JSON.stringify(result.error));

        // Atomic state save: persist after each successful reply, not just at the end.
        // If the process crashes mid-batch, we won't re-reply to already-replied reviews.
        state.repliedReviewIds.push(reviewId);
        await saveState(state);

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

  const result = { processed: unreplied.length, replied, errors };

  // Alert if the run completed with errors
  if (errors > 0) {
    await sendAlert(`Pipeline run completed with ${errors} error(s).\nProcessed: ${unreplied.length}, Replied: ${replied}, Errors: ${errors}`).catch(() => {});
  }

  return result;
}
