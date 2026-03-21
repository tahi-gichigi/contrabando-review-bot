# Contrabando Reviews

AI-powered tool that generates on-brand replies to Google reviews for Contrabando Mexican Food (Almada).

## What it does

Paste a customer review, pick a star rating and language, and get a reply written in Contrabando's tone of voice — casual, warm, in Portuguese/English/Spanish.

## Stack

- **Next.js** — UI in `/ui`
- **OpenAI API** — reply generation via `gpt-5-mini`
- **Tone of voice guidelines** — `tone-of-voice-guidelines.md` (loaded as system prompt)
- **Deployed on Vercel**

## Getting reviews

Two scripts for pulling Google reviews locally:

| Script | Method | Notes |
|--------|--------|-------|
| `contrabando_auth.js` | Google Business Profile API (OAuth) | Requires GBP API access approval — pending (cases 2-4185000040638, 3-8741000040607) |
| `serpapi_reviews.js` | SerpAPI (Google Maps scrape) | Requires `SERPAPI_KEY` in `.env` |

## Setup

```bash
# Install root deps (scripts)
npm install

# Install UI deps
cd ui && pnpm install

# Add env vars
cp .env.example .env  # add SERPAPI_KEY and OPENAI_API_KEY
```

## Running locally

```bash
cd ui && pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Pulling reviews

```bash
# Via SerpAPI
node serpapi_reviews.js   # outputs reviews_serpapi.json

# Via GBP API (once approved)
node contrabando_auth.js  # outputs reviews.json
```

## Env vars

| Variable | Where | Used for |
|----------|-------|---------|
| `OPENAI_API_KEY` | `.env` + Vercel | Reply generation |
| `SERPAPI_KEY` | `.env` | Scraping Google reviews |
