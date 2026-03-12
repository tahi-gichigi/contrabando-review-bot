const fs = require('fs');

const SERPAPI_KEY = process.env.SERPAPI_KEY;
if (!SERPAPI_KEY) { console.error('Missing SERPAPI_KEY env var. Add it to .env or export it.'); process.exit(1); }
const REVIEWS_FILE = 'reviews_serpapi.json';

// Step 1: Search for the place to get its data_id (SerpApi's place identifier)
async function findPlace(query) {
  const params = new URLSearchParams({
    engine: 'google_maps',
    q: query,
    api_key: SERPAPI_KEY
  });

  const res = await fetch(`https://serpapi.com/search.json?${params}`);
  const data = await res.json();

  // SerpApi returns either local_results (multiple) or place_results (single exact match)
  const place = data.place_results || data.local_results?.[0];
  if (!place) {
    console.error('No places found. Raw:', JSON.stringify(data, null, 2));
    return null;
  }

  console.log(`Found: ${place.title} at ${place.address || ''}`);
  console.log(`data_id: ${place.data_id}`);
  return place.data_id;
}

// Step 2: Pull all reviews using the data_id
async function getReviews(dataId) {
  let allReviews = [];
  let nextPageToken = null;

  do {
    const params = new URLSearchParams({
      engine: 'google_maps_reviews',
      data_id: dataId,
      api_key: SERPAPI_KEY,
      sort_by: 'newestFirst'
    });

    if (nextPageToken) params.set('next_page_token', nextPageToken);

    const res = await fetch(`https://serpapi.com/search.json?${params}`);
    const data = await res.json();

    if (data.error) {
      console.error('SerpApi error:', data.error);
      break;
    }

    if (data.reviews) {
      allReviews = allReviews.concat(data.reviews);
      console.log(`  Fetched ${allReviews.length} reviews so far...`);
    }

    nextPageToken = data.serpapi_pagination?.next_page_token || null;
  } while (nextPageToken);

  return allReviews;
}

async function main() {
  console.log('Searching for Contrabando on Google Maps...');
  const dataId = await findPlace('Contrabando Mexican Food Almada Portugal');

  if (!dataId) return;

  console.log('\nFetching reviews...');
  const reviews = await getReviews(dataId);

  console.log(`\nTotal reviews: ${reviews.length}`);

  // Normalise to same shape as GBP API output
  const output = reviews.map(r => ({
    reviewId: r.review_id || null,
    reviewer: r.user?.name || 'Anonymous',
    starRating: r.rating,
    comment: r.snippet || '(no comment)',
    createTime: r.date || null,
    reviewReply: r.owner_answer || null,
    reviewReplyTime: r.owner_answer_timestamp || null,
    source: 'serpapi'
  }));

  fs.writeFileSync(REVIEWS_FILE, JSON.stringify(output, null, 2));
  console.log(`Reviews saved to ${REVIEWS_FILE}`);
}

main().catch(console.error);
