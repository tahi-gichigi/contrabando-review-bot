# Contrabando Review Bot - Claude Code Instructions

## Git & Push Rules
- **Do NOT push after every change.** Only push when Tahi explicitly says to, or when it clearly makes sense (e.g. end of a feature, before switching context).
- We often make changes that might get reverted, so keep commits local until ready.

## Project Overview
Automated Google Review reply system for Contrabando restaurant chain (4 locations in Lisbon area). Polls GBP API hourly, generates replies via gpt-5-mini, posts them back.

## Key Files
| File | Purpose |
|------|---------|
| `lib/gbp.js` | GBP API client - auth, fetch reviews, post replies. LOCATIONS array lives here. |
| `lib/pipeline.js` | Main cron logic - polls all locations, generates + posts replies, manages state |
| `lib/notify.js` | WhatsApp + email alerts |
| `pages/api/cron/poll-and-reply.js` | Vercel Cron endpoint (hourly) |
| `pages/api/cron/weekly-summary.js` | Weekly review summary (Monday 9am UTC) |
| `pages/api/monitoring/review-stats.js` | On-demand stats endpoint for Moochbot |
| `pages/stats.js` | Stats dashboard UI |
| `tone-of-voice-guidelines.md` | System prompt for reply generation |

## Infrastructure
- **Hosting:** Vercel (contrabando-replies.vercel.app)
- **State:** Neon Postgres (via Vercel integration) - `contrabando_state` table
- **AI:** gpt-5-mini via OpenAI Responses API
- **Auth:** GBP OAuth refresh token (permanent, published consent screen)
- **Cron:** Hourly poll + Monday 9am weekly summary

## Locations (as of 1 Apr 2026)
- Almada (original, 1445 reviews)
- Saldanha (991 reviews)
- Av. 24 de Julho (4174 reviews)
- Marina de Troia (187 reviews)
- CC Fonte Nova - not yet added (no GBP listing confirmed)

## State Schema
`repliedReviewIds` is keyed by location name (migrated from flat array on 1 Apr 2026):
```json
{
  "lastPollTime": "ISO timestamp",
  "repliedReviewIds": {
    "accounts/.../locations/...": ["reviewId1", "reviewId2"],
    ...
  }
}
```

## Gotchas
- Pipeline reads `tone-of-voice-guidelines.md` from `process.cwd()` (project root on Vercel)
- GBP API quota is project-level (300 QPM), covers all locations
- Vercel Root Directory must be set to `.` (root) not `ui`
