// poll_and_reply.js — thin CLI wrapper for the pipeline
// Delegates all logic to ui/lib/pipeline.js (the canonical source of truth).
// Uses dynamic import() to bridge CJS -> ESM.
//
// Usage:
//   node poll_and_reply.js           — live run
//   node poll_and_reply.js --dry-run — generate replies but do not post
//
// Local state (no Vercel KV): pipeline.js defaults to lastPollTime = now on first run,
// so no historical reviews are processed. State does not persist between local runs
// unless KV_REST_API_URL / KV_REST_API_TOKEN are set.
// To test a specific window locally: set KV vars pointing to your KV instance,
// or manually trigger via the Vercel cron endpoint.

require('dotenv').config();

const dryRun = process.argv.includes('--dry-run');
if (dryRun) console.log('[poll] DRY RUN — replies will be generated but not posted\n');

(async () => {
  const { run } = await import('./ui/lib/pipeline.js');
  const result = await run({ dryRun });
  console.log(`\nSummary: ${result.processed} processed, ${result.replied} replied, ${result.errors} errors`);
})().catch(err => {
  console.error('[fatal]', err.message);
  process.exit(1);
});
