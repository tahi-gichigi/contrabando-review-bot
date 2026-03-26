// gbp_reviews.js — thin CJS wrapper around ui/lib/gbp.js
// ui/lib/gbp.js is the canonical source of truth for GBP API logic.
// This file exists for local scripts that require() the GBP client directly.
//
// Usage: const { fetchAllNewReviews, postReply } = require('./gbp_reviews');
// Returns a promise — use within an async context.

require('dotenv').config();

let _module = null;

async function _load() {
  if (!_module) _module = await import('./ui/lib/gbp.js');
  return _module;
}

/**
 * Quick test when run directly: fetch 5 most recent reviews.
 * Usage: node gbp_reviews.js
 */
if (require.main === module) {
  (async () => {
    const { getAccessToken, fetchReviews, normalizeReview } = await _load();
    console.log('Fetching 5 most recent reviews...');
    const token = await getAccessToken();
    const { reviews, totalReviewCount } = await fetchReviews(token, 5);
    console.log(`Total reviews on profile: ${totalReviewCount}`);
    reviews.forEach(r => {
      const n = normalizeReview(r);
      console.log(`  ★${n.starRating} — ${n.reviewer}: "${(n.comment || '').slice(0, 60)}..." [replied: ${!!n.reviewReply}]`);
    });
  })().catch(console.error);
}

// Async exports — callers must await these
module.exports = {
  fetchAllNewReviews: async (...args) => (await _load()).fetchAllNewReviews(...args),
  postReply: async (...args) => (await _load()).postReply(...args),
  getAccessToken: async (...args) => (await _load()).getAccessToken(...args),
  get LOCATION_NAME() { return _module ? _module.LOCATION_NAME : null; }
};
