// poll_and_reply.js — core automation loop
// Polls GBP for new unreplied reviews, generates a reply, posts it, and notifies on 1-2 stars.
// Run manually: node poll_and_reply.js
// Or called by the Vercel Cron endpoint at /api/cron/poll-and-reply

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { fetchAllNewReviews, postReply, LOCATION_NAME } = require('./gbp_reviews');
const { generateReply } = require('./reply_logic');
const { sendWhatsApp } = require('./notify');

const STATE_FILE = path.join(__dirname, 'state.json');

// --- State management (file-based for local; swap to Vercel KV for production) ---

function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  }
  // First run: start from now so we don't reply to all 1,421 existing reviews
  return {
    lastPollTime: new Date().toISOString(),
    repliedReviewIds: []
  };
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// --- Language detection ---
// Simple heuristic based on common words.
// GBP sometimes returns "(Translated by Google) ..." before "(Original) ..." —
// we strip the translation and detect on the original text only.
function stripGoogleTranslation(text) {
  if (!text) return text;
  // Match "(Original)\n..." or "(Original) ..." and return everything after it
  const match = text.match(/\(Original\)\s*\n?([\s\S]*)/i);
  return match ? match[1].trim() : text;
}

function detectLanguage(text) {
  if (!text || text.trim() === '') return 'PT'; // Default to PT for star-only reviews

  const t = stripGoogleTranslation(text).toLowerCase();

  // Strong signals first
  if (/\b(the|and|was|were|very|great|good|bad|not|this|with|have|for)\b/.test(t)) return 'EN';
  if (/\b(muito|obrigad|estava|ficamos|adorei|serviço|atendimento|ótimo|péssimo|excelente)\b/.test(t)) return 'PT';
  if (/\b(muy|fue|bueno|malo|mucho|servicio|comida|estaba|estaban|pero)\b/.test(t)) return 'ES';
  if (/\b(très|était|service|bonne|mauvais|prix|merci|bien|avec|pour)\b/.test(t)) return 'FR';
  if (/\b(molto|buono|servizio|cibo|ottimo|pessimo|grazie|erano|stato)\b/.test(t)) return 'IT';

  return 'PT';
}

// --- Main pipeline ---

/**
 * Run one poll-and-reply cycle.
 * @param {object} options
 * @param {boolean} options.dryRun - if true, generate replies but don't post them
 * @returns {Promise<{processed: number, replied: number, errors: number}>}
 */
async function run({ dryRun = false } = {}) {
  const state = loadState();
  console.log(`[poll] Last poll: ${state.lastPollTime}`);
  console.log(`[poll] Already replied to ${state.repliedReviewIds.length} reviews`);

  // Fetch reviews newer than last poll
  console.log('[poll] Fetching new reviews from GBP...');
  const newReviews = await fetchAllNewReviews(state.lastPollTime);
  console.log(`[poll] Found ${newReviews.length} reviews since last poll`);

  // Filter: not already replied (via API or manually)
  const unreplied = newReviews.filter(r =>
    !r.reviewReply &&
    !state.repliedReviewIds.includes(r.reviewId)
  );
  console.log(`[poll] ${unreplied.length} unreplied reviews to process`);

  let replied = 0;
  let errors = 0;

  for (const review of unreplied) {
    const stars = review.starRating;
    const reviewer = review.reviewer;
    const comment = review.comment || '';
    const lang = detectLanguage(comment);

    console.log(`\n  ★${stars} — ${reviewer} [${lang}]`);
    console.log(`  "${comment.slice(0, 80)}${comment.length > 80 ? '...' : ''}"`);

    try {
      // Generate reply
      const reply = await generateReply(stars, comment, lang);
      console.log(`  Reply: "${reply}"`);

      if (!dryRun) {
        // Post reply to GBP — need the full review resource name
        // GBP API uses: accounts/{}/locations/{}/reviews/{}
        const reviewName = `${LOCATION_NAME}/reviews/${review.reviewId}`;
        const result = await postReply(reviewName, reply);

        if (result.error) {
          console.error(`  [error] Failed to post reply: ${JSON.stringify(result.error)}`);
          errors++;
          continue;
        }

        console.log('  [posted] Reply posted to Google');
        state.repliedReviewIds.push(review.reviewId);
        replied++;

        // Alert for negative reviews (1-2 stars)
        if (stars <= 2) {
          await sendWhatsApp(stars, reviewer, comment);
        }
      } else {
        console.log('  [dry-run] Skipping post');
        replied++;
      }
    } catch (err) {
      console.error(`  [error] ${err.message}`);
      errors++;
    }
  }

  // Trim repliedReviewIds to last 500 entries to prevent unbounded growth.
  // lastPollTime already filters older reviews, so we only need recent IDs
  // as a safety net against re-processing within the poll window.
  if (state.repliedReviewIds.length > 500) {
    state.repliedReviewIds = state.repliedReviewIds.slice(-500);
  }

  state.lastPollTime = new Date().toISOString();
  if (!dryRun) saveState(state);

  console.log(`\n[poll] Done. Replied: ${replied}, Errors: ${errors}`);
  return { processed: unreplied.length, replied, errors };
}

module.exports = { run };

// Run directly: node poll_and_reply.js [--dry-run]
if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) console.log('[poll] DRY RUN — replies will be generated but not posted\n');

  run({ dryRun })
    .then(({ processed, replied, errors }) => {
      console.log(`\nSummary: ${processed} processed, ${replied} replied, ${errors} errors`);
    })
    .catch(console.error);
}
