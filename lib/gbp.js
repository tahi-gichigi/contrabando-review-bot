// ui/lib/gbp.js — GBP API client (ES module for use in Next.js API routes)
// Logic mirrors root/gbp_reviews.js but uses ES module syntax.
// NOTE: After the OAuth consent screen is published, the refresh token is permanent.
// It only needs to be re-issued if the user (tahi@mooch.agency) manually revokes access
// in their Google account security settings. Day-to-day, the token auto-refreshes.

// GBP account + all active Contrabando locations (confirmed via API 1 Apr 2026)
// mooch.agency listing (locations/6712778551863965541) intentionally excluded
const ACCOUNT_NAME = 'accounts/118040028723957039356';

export const LOCATIONS = [
  { name: `${ACCOUNT_NAME}/locations/11127497546250661444`, label: 'Almada' },
  { name: `${ACCOUNT_NAME}/locations/1889522572377605742`,  label: 'Saldanha' },
  { name: `${ACCOUNT_NAME}/locations/11449354095755879662`, label: 'Av. 24 de Julho' },
  { name: `${ACCOUNT_NAME}/locations/148727331392061285`,   label: 'Marina de Tróia' },
];

// Backwards-compat: default location for any code that still imports LOCATION_NAME
export const LOCATION_NAME = LOCATIONS[0].name;

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

// locationName is now a required parameter — no implicit default
export async function fetchReviews(accessToken, locationName, pageSize = 50, pageToken = null) {
  let url = `https://mybusiness.googleapis.com/v4/${locationName}/reviews?pageSize=${pageSize}`;
  if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();
  if (data.error) throw new Error(`GBP API error (${locationName}): ${JSON.stringify(data.error)}`);

  return {
    reviews: data.reviews || [],
    nextPageToken: data.nextPageToken || null,
    totalReviewCount: data.totalReviewCount || 0
  };
}

/**
 * Fetch new reviews for a single location since the given timestamp.
 * @param {string} locationName - full GBP resource name (accounts/.../locations/...)
 * @param {string|null} since - ISO timestamp; null fetches all
 */
export async function fetchNewReviewsForLocation(locationName, since = null) {
  const accessToken = await getAccessToken();
  const sinceDate = since ? new Date(since) : null;
  const reviews = [];
  let pageToken = null;

  do {
    const { reviews: page, nextPageToken } = await fetchReviews(accessToken, locationName, 50, pageToken);
    pageToken = nextPageToken;

    for (const r of page) {
      if (sinceDate && new Date(r.createTime) <= sinceDate) {
        pageToken = null;
        break;
      }
      reviews.push(normalizeReview(r));
    }
  } while (pageToken);

  return reviews;
}

/**
 * Fetch new reviews across ALL locations. Returns flat array with locationName on each review.
 * @param {string|null} since - ISO timestamp
 */
export async function fetchAllNewReviews(since = null) {
  const allReviews = [];
  for (const loc of LOCATIONS) {
    const reviews = await fetchNewReviewsForLocation(loc.name, since);
    // Tag each review with its location so pipeline/summary can group by location
    for (const r of reviews) {
      r.locationName = loc.name;
      r.locationLabel = loc.label;
    }
    allReviews.push(...reviews);
  }
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
