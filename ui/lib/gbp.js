// ui/lib/gbp.js — GBP API client (ES module for use in Next.js API routes)
// Logic mirrors root/gbp_reviews.js but uses ES module syntax.
// NOTE: After the OAuth consent screen is published, the refresh token is permanent.
// It only needs to be re-issued if the user (tahi@mooch.agency) manually revokes access
// in their Google account security settings. Day-to-day, the token auto-refreshes.

// Hardcoded location — confirmed in Step 1 validation
const ACCOUNT_NAME = 'accounts/118040028723957039356';
export const LOCATION_NAME = 'accounts/118040028723957039356/locations/11127497546250661444';

// Credentials come from Vercel env vars
function getCredentials() {
  return {
    client_id: process.env.GBP_CLIENT_ID,
    client_secret: process.env.GBP_CLIENT_SECRET,
    refresh_token: process.env.GBP_REFRESH_TOKEN
  };
}

// Cache token for the duration of one serverless invocation
let _cachedToken = null;
let _tokenExpiry = 0;

export async function getAccessToken() {
  if (_cachedToken && Date.now() < _tokenExpiry) return _cachedToken;

  const { client_id, client_secret, refresh_token } = getCredentials();
  if (!client_id || !client_secret || !refresh_token) {
    throw new Error('GBP_CLIENT_ID, GBP_CLIENT_SECRET, or GBP_REFRESH_TOKEN env vars not set');
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ refresh_token, client_id, client_secret, grant_type: 'refresh_token' })
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);

  _cachedToken = data.access_token;
  _tokenExpiry = Date.now() + ((data.expires_in || 3600) - 300) * 1000;
  return _cachedToken;
}

// Convert GBP star string to number
const STAR_MAP = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

export function normalizeReview(r) {
  const stars = typeof r.starRating === 'number' ? r.starRating : (STAR_MAP[r.starRating] || 0);
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
    _rawName: r.name
  };
}

export async function fetchReviews(accessToken, pageSize = 50, pageToken = null) {
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

export async function fetchAllNewReviews(since = null) {
  const accessToken = await getAccessToken();
  const sinceDate = since ? new Date(since) : null;
  const allReviews = [];
  let pageToken = null;

  do {
    const { reviews, nextPageToken } = await fetchReviews(accessToken, 50, pageToken);
    pageToken = nextPageToken;

    for (const r of reviews) {
      if (sinceDate && new Date(r.createTime) <= sinceDate) {
        pageToken = null;
        break;
      }
      allReviews.push(normalizeReview(r));
    }
  } while (pageToken);

  return allReviews;
}

/**
 * Fetch a single review by its full resource name to confirm current reply status.
 * Used as a double-check before posting a reply to prevent duplicate replies.
 * @param {string} reviewName - full resource name e.g. "accounts/.../locations/.../reviews/..."
 * @returns {Promise<object|null>} normalized review or null on error
 */
export async function fetchSingleReview(reviewName) {
  const accessToken = await getAccessToken();
  const res = await fetch(`https://mybusiness.googleapis.com/v4/${reviewName}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await res.json();
  if (data.error) {
    console.warn(`[gbp] fetchSingleReview error: ${JSON.stringify(data.error)}`);
    return null;
  }
  return normalizeReview(data);
}

export async function postReply(reviewName, replyText) {
  const accessToken = await getAccessToken();
  const res = await fetch(`https://mybusiness.googleapis.com/v4/${reviewName}/reply`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment: replyText })
  });
  return res.json();
}
