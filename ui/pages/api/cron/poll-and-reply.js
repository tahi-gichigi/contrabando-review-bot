// /api/cron/poll-and-reply — Vercel Cron endpoint (runs hourly)
// Polls GBP for new unreplied reviews, generates and posts replies.
// Secured with CRON_SECRET header.

import { run } from '../../../lib/pipeline.js';

export default async function handler(req, res) {
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET>
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await run();
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error('[cron] poll-and-reply error:', err);
    return res.status(500).json({ error: err.message });
  }
}
