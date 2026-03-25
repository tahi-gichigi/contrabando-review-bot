// gbp_reviews.js — fetches reviews from Google Business Profile API
// Drop-in replacement for serpapi_reviews.js with the same output shape
// Reuses token refresh pattern from contrabando_auth.js

require('dotenv').config();
const fs = require('fs');

// Hardcoded location — confirmed in Step 1 validation
const ACCOUNT_NAME = 'accounts/118040028723957039356';
const LOCATION_NAME = 'accounts/118040028723957039356/locations/11127497546250661444';

// Credentials: prefer env vars (for Vercel), fall back to credentials.json (local dev)
function getCredentials() {
  if (process.env.GBP_CLIENT_ID && process.env.GBP_CLIENT_SECRET) {
    return {
      client_id: process.env.GBP_CLIENT_ID,
      client_secret: process.env.GBP_CLIENT_SECRET
    };
  }
  const creds = JSON.parse(fs.readFileSync('credentials.json', 'utf8')).web;
  return { client_id: creds.client_id, client_secret: creds.client_secret };
}

function getRefreshToken() {
  if (process.env.GBP_REFRESH_TOKEN) return process.env.GBP_REFRESH_TOKEN;
  const token = JSON.parse(fs.readFileSync('token.json', 'utf8'));
  return token.refresh_token;
}

// Cache the access token for the duration of one run (~1 hour expiry).
// Avoids refreshing on every API call when replying to multiple reviews.
let _cachedToken = null;
let _tokenExpiry = 0;

/**
 * Get a fresh access token using the stored refresh token.
 * Caches the token until it's within 5 minutes of expiry.
 * @returns {Promise<string>} access_token
 */
async function getAccessToken() {
  if (_cachedToken && Date.now() < _tokenExpiry) return _cachedToken;

  const { client_id, client_secret } = getCredentials();
  const refresh_token = getRefreshToken();

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ refresh_token, client_id, client_secret, grant_type: 'refresh_token' })
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);

  _cachedToken = data.access_token;
  // Google tokens expire in 3600s — cache until 5 min before expiry
  _tokenExpiry = Date.now() + ((data.expires_in || 3600) - 300) * 1000;
  return _cachedToken;
}

/**
 * Fetch a page of reviews from GBP API.
 * @param {string} accessToken
 * @param {number} pageSize - max 50
 * @param {string|null} pageToken - for pagination
 * @returns {Promise<{reviews: Array, nextPageToken: string|null, totalReviewCount: number}>}
 */
async function fetchReviews(accessToken, pageSize = 50, pageToken = null) {
  let url = `https://mybusiness.googleapis.com/v4/${LOCATION_NAME}/reviews?pageSize=${pageSize}`;
  if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();
  if (data.error) throw new Error(`GBP API error: ${JSON.stringify(data.error)}`);

  return {
    reviews: data.reviews || [],
    nextPageToken: data.nextPageToken || null,
    totalReviewCount: data.totalReviewCount || 0
  };
}

/**
 * Normalize a raw GBP review to our standard shape.
 * Matches the schema used by serpapi_reviews.js.
 */
function normalizeReview(r) {
  // GBP returns starRating as a string like "FIVE" — convert to number
  const starMap = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
  const stars = typeof r.starRating === 'number' ? r.starRating : (starMap[r.starRating] || 0);

  return {
    reviewId: r.reviewId,
    reviewer: r.reviewer?.displayName || 'Anonymous',
    starRating: stars,
    comment: r.comment || '',
    createTime: r.createTime,
    updateTime: r.updateTime || r.createTime,
    reviewReply: r.reviewReply?.comment || null,
    reviewReplyTime: r.reviewReply?.updateTime || null,
    source: 'gbp',
    // Keep the raw name so we can use it for reply posting
    _rawName: r.name
  };
}

/**
 * Fetch all reviews newer than a given ISO timestamp.
 * Stops paginating once it hits reviews older than `since`.
 * GBP returns reviews sorted newest-first.
 *
 * @param {string|null} since - ISO timestamp. If null, fetches all reviews.
 * @returns {Promise<Array>} normalized reviews, newest first
 */
async function fetchAllNewReviews(since = null) {
  const accessToken = await getAccessToken();
  const sinceDate = since ? new Date(since) : null;
  let allReviews = [];
  let pageToken = null;

  do {
    const { reviews, nextPageToken } = await fetchReviews(accessToken, 50, pageToken);
    pageToken = nextPageToken;

    for (const r of reviews) {
      const reviewDate = new Date(r.createTime);
      // Stop if we've gone past our cutoff
      if (sinceDate && reviewDate <= sinceDate) {
        pageToken = null; // Stop pagination
        break;
      }
      allReviews.push(normalizeReview(r));
    }
  } while (pageToken);

  return allReviews;
}

/**
 * Post an owner reply to a review via GBP API.
 * @param {string} reviewName - the raw `name` field from the review (e.g. "accounts/.../locations/.../reviews/...")
 * @param {string} replyText
 * @returns {Promise<object>} API response
 */
async function postReply(reviewName, replyText) {
  const accessToken = await getAccessToken();
  const res = await fetch(`https://mybusiness.googleapis.com/v4/${reviewName}/reply`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment: replyText })
  });
  return res.json();
}

module.exports = { fetchReviews, fetchAllNewReviews, postReply, getAccessToken, LOCATION_NAME };

// Quick test when run directly: fetch 5 most recent reviews
if (require.main === module) {
  (async () => {
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
