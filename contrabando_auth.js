const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const { exec } = require('child_process');
const open = (url) => exec(`open "${url}"`);

// --- Config ---
const CREDENTIALS = JSON.parse(fs.readFileSync('credentials.json', 'utf8')).web;
const CLIENT_ID = CREDENTIALS.client_id;
const CLIENT_SECRET = CREDENTIALS.client_secret;
const REDIRECT_URI = 'http://localhost:8080';
const SCOPES = [
  'https://www.googleapis.com/auth/business.manage'
];
const TOKEN_FILE = 'token.json';
const REVIEWS_FILE = 'reviews.json';

// --- OAuth helpers ---
function buildAuthUrl() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent'
  });
  return `https://accounts.google.com/o/oauth2/auth?${params.toString()}`;
}

async function exchangeCodeForTokens(code) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code'
    })
  });
  return res.json();
}

async function refreshAccessToken(refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token'
    })
  });
  return res.json();
}

// --- GBP API helpers ---
async function getAccounts(accessToken) {
  const res = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return res.json();
}

async function getLocations(accessToken, accountName) {
  const res = await fetch(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return res.json();
}

async function getReviews(accessToken, locationName, pageToken = null) {
  let url = `https://mybusiness.googleapis.com/v4/${locationName}/reviews?pageSize=50`;
  if (pageToken) url += `&pageToken=${pageToken}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return res.json();
}

async function getAllReviews(accessToken, locationName) {
  let allReviews = [];
  let pageToken = null;

  do {
    const data = await getReviews(accessToken, locationName, pageToken);
    if (data.reviews) {
      allReviews = allReviews.concat(data.reviews);
    }
    pageToken = data.nextPageToken || null;
    console.log(`  Fetched ${allReviews.length} reviews so far...`);
  } while (pageToken);

  return allReviews;
}

// --- Main flow ---
async function pullReviews(accessToken) {
  console.log('\nFetching accounts...');
  const accounts = await getAccounts(accessToken);

  if (!accounts.accounts || accounts.accounts.length === 0) {
    console.error('No accounts found. Check that your Google account has GBP access.');
    console.log('Raw response:', JSON.stringify(accounts, null, 2));
    return;
  }

  console.log(`Found ${accounts.accounts.length} account(s):`);
  accounts.accounts.forEach((a, i) => {
    console.log(`  [${i}] ${a.accountName || a.name} (${a.type})`);
  });

  // Use the first account (adjust if needed)
  const accountName = accounts.accounts[0].name;
  console.log(`\nUsing account: ${accountName}`);

  console.log('Fetching locations...');
  const locations = await getLocations(accessToken, accountName);

  if (!locations.locations || locations.locations.length === 0) {
    console.error('No locations found for this account.');
    console.log('Raw response:', JSON.stringify(locations, null, 2));
    return;
  }

  console.log(`Found ${locations.locations.length} location(s):`);
  locations.locations.forEach((l, i) => {
    console.log(`  [${i}] ${l.title} (${l.name})`);
  });

  // Use the first location (adjust if needed)
  // Reviews API needs full path: accounts/{id}/locations/{id}
  const locationName = `${accountName}/${locations.locations[0].name}`;
  console.log(`\nPulling reviews for: ${locations.locations[0].title}`);

  const reviews = await getAllReviews(accessToken, locationName);
  console.log(`\nTotal reviews: ${reviews.length}`);

  // Save reviews
  const output = reviews.map(r => ({
    reviewId: r.reviewId,
    reviewer: r.reviewer?.displayName || 'Anonymous',
    starRating: r.starRating,
    comment: r.comment || '(no comment)',
    createTime: r.createTime,
    updateTime: r.updateTime,
    reviewReply: r.reviewReply?.comment || null,
    reviewReplyTime: r.reviewReply?.updateTime || null
  }));

  fs.writeFileSync(REVIEWS_FILE, JSON.stringify(output, null, 2));
  console.log(`\nReviews saved to ${REVIEWS_FILE}`);
  console.log('Done.');
}

async function main() {
  // Check for existing token
  if (fs.existsSync(TOKEN_FILE)) {
    console.log('Found existing token. Refreshing...');
    const saved = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
    const refreshed = await refreshAccessToken(saved.refresh_token);

    if (refreshed.access_token) {
      console.log('Token refreshed successfully.');
      await pullReviews(refreshed.access_token);
      return;
    }
    console.log('Refresh failed. Starting new auth flow...');
  }

  // Start OAuth flow
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, REDIRECT_URI);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<h1>Auth failed</h1><p>${error}</p>`);
        server.close();
        resolve();
        return;
      }

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Auth successful</h1><p>You can close this tab.</p>');

        console.log('\nGot auth code. Exchanging for tokens...');
        const tokens = await exchangeCodeForTokens(code);

        if (tokens.error) {
          console.error('Token exchange failed:', tokens.error_description);
          server.close();
          resolve();
          return;
        }

        // Save tokens
        fs.writeFileSync(TOKEN_FILE, JSON.stringify({
          refresh_token: tokens.refresh_token,
          scope: tokens.scope,
          token_type: tokens.token_type
        }, null, 2));
        console.log(`Tokens saved to ${TOKEN_FILE}`);

        // Pull reviews
        await pullReviews(tokens.access_token);

        server.close();
        resolve();
      }
    });

    server.listen(8080, () => {
      const authUrl = buildAuthUrl();
      console.log('Opening browser for Google consent...');
      console.log(`If it doesn't open, go to: ${authUrl}\n`);
      open(authUrl);
    });
  });
}

main().catch(console.error);
