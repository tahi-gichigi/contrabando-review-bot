# Contrabando Review Bot - Changelog

## 2 Apr 2026 — Auth fix + dead man's switch

- **GBP refresh token had expired** - re-ran OAuth flow via `contrabando_auth.js`, updated token in `.env` and Vercel
- Added Better Stack heartbeat monitor (free tier) - pings after every successful cron run, emails if the hourly ping stops arriving
- Heartbeat URL stored as `BETTERSTACK_HEARTBEAT_URL` env var on Vercel
- Added `reviews.json` to `.gitignore` (was being tracked)
- Pipeline already had WhatsApp alerts for token failures, crashes, and partial errors - heartbeat covers the "cron never ran" blind spot

## 1 Apr 2026 — Multi-location rollout

- **Extended bot to all 4 locations:** Almada, Saldanha, Av. 24 de Julho, Marina de Tróia
- Tahi accepted 3 new GBP manager invitations (sent by Rafael Mota)
- Replaced hardcoded `LOCATION_NAME` with `LOCATIONS` array in `gbp.js`
- Pipeline now loops across all locations per cron cycle
- State schema migrated from flat `repliedReviewIds` array to per-location object (auto-migrates existing Almada data)
- Weekly summary now aggregates across all locations with per-location breakdown
- WhatsApp alerts now include location label
- Tone-of-voice guidelines updated: removed Almada-specific identity, corrected SerpApi reference to GBP API
- CC Fonte Nova not yet added (no GBP listing confirmed - awaiting Rafa)
- Commits: `5d2cbf8`, `7778c35`

## 26 Mar 2026 — State migration + production hardening

- Migrated state from Vercel KV (deprecated) to Supabase, then to dedicated Neon Postgres (via Vercel integration)
- Multiple state backend iterations: KV -> Supabase -> Neon (settled on Neon for simplicity + Vercel integration)
- Restored gpt-5-mini model after it was overwritten during a merge
- Commits: `8511453`, `42750a8`, `97bf93a`, `17140ab`, `3166315`, `1f32e79`, `37cdcdb`

## 25 Mar 2026 — Pipeline built + GBP API access confirmed

- **GBP API access approved** (case 2-4185000040638, submitted 11 Mar, approved 25 Mar)
- Built full automated pipeline: fetch new reviews -> detect language -> generate reply -> post to GBP -> WhatsApp alert on low ratings
- Vercel Cron configured: hourly poll (`poll-and-reply`) + Monday 9am weekly summary
- Production hardening: max 20 replies/run cap, atomic state save after each reply, double-check before posting (re-fetch to prevent duplicate replies), error alerts
- Fixed critical bugs: language detection was matching Google's English translation instead of original text
- Fixed reviews endpoint path (needed full `accounts/{id}/locations/{id}` format)
- Commits: `7050e92`, `5037f0c`, `cd7c2a2`

## 16 Mar 2026 — Rafa feedback + tone refinements

- Synced guidelines with Rafa's feedback on 2-3 star replies (too transactional, not caring enough)
- Updated 4 reply examples to include ownership language
- Fixed passive -> active email redirects for reviews describing clear problems
- Added "Show you care" and "Direct language for real problems" rules
- Token usage measured: ~$0.0036/reply, reasoning_tokens=0 at minimal effort
- Commit: `7b1204e`

## 13 Mar 2026 — Model upgrade + test UI polish

- Switched from gpt-4.5-mini to gpt-5-mini via OpenAI Responses API (`reasoning_effort: minimal`)
- Added em dash ban and language-mixing ban as hard rules in guidelines
- Added random review button with 20 real PT/EN/ES reviews for testing
- Expanded smoke test suite to 8 cases (PT/EN/ES/FR/IT, star-only, staff complaint, TheFork)
- Synced tone-of-voice-guidelines.md between root and ui/ (ui/ was running stale copy)
- Commits: `c359124`, `52a3a3b`, `7af831a`, `c8e2cde`, `3aa76e8`, `f8e444d`, `c764b28`

## 12 Mar 2026 — Test UI + reply generation

- Built `reply_logic.js`: generates replies via OpenAI using full guidelines as system prompt
- Built Next.js test UI: dark-themed form, star picker, language selector, copy button
- Deployed to Vercel (contrabando-reviews-gichigi-mecoms-projects.vercel.app)
- Moved SerpApi key to env var for security
- Natalie completed Test Round 1: 7/10 pass, 2 needs work, 1 fail
- Commits: `b679482`, `2b114e9`, `568c842`, `2c461d7`

## 11 Mar 2026 — Project kickoff

- José granted GBP manager access
- Created GCP project "contrabando almada", enabled GBP APIs
- OAuth flow completed, tokens saved
- Hit GBP API quota 0 error (access requires Google approval)
- Submitted Basic Access application (case 2-4185000040638)
- Pulled 996 reviews via SerpApi as interim data source (544 with text, 0 owner replies)
- Curated 28-review sample set for tone testing
- Wrote AI Tone of Voice Guidelines v2 with 17 real review/reply examples
- Commit: `0b5caee`
