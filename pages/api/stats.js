// /api/stats — Dashboard stats endpoint, auth'd by DASHBOARD_PASSWORD.
// Separate from /api/monitoring/review-stats (which uses CRON_SECRET for Moochbot).
// Returns the same payload so the dashboard and Moochbot see identical data.

import { fetchAllNewReviews, LOCATIONS } from '../../lib/gbp.js';

async function getState() {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql(
      'SELECT value FROM contrabando_state WHERE key = $1',
      ['contrabando:poll-state']
    );
    return rows.length > 0 ? rows[0].value : null;
  } catch (e) {
    return { error: e.message };
  }
}

export default async function handler(req, res) {
  const password = req.query.password || req.headers['x-dashboard-password'];
  if (!process.env.DASHBOARD_PASSWORD || password !== process.env.DASHBOARD_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const hoursBack = parseInt(req.query.hours || '48', 10);
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
    const reviews = await fetchAllNewReviews(since);

    const byLocation = LOCATIONS.map(loc => {
      const locReviews = reviews.filter(r => r.locationName === loc.name);
      const replied = locReviews.filter(r => r.reviewReply);
      const unreplied = locReviews.filter(r => !r.reviewReply);
      return {
        label: loc.label,
        total: locReviews.length,
        replied: replied.length,
        unreplied: unreplied.length,
        avgRating: locReviews.length > 0
          ? +(locReviews.reduce((s, r) => s + r.starRating, 0) / locReviews.length).toFixed(1)
          : null,
        unrepliedList: unreplied.map(r => ({
          reviewer: r.reviewer,
          stars: r.starRating,
          createTime: r.createTime,
          comment: r.comment?.substring(0, 200) || '(star only)'
        }))
      };
    });

    const repliedReviews = reviews.filter(r => r.reviewReply);
    const sample = repliedReviews
      .sort(() => Math.random() - 0.5)
      .slice(0, 6)
      .map(r => ({
        reviewer: r.reviewer,
        stars: r.starRating,
        location: r.locationLabel,
        comment: r.comment?.substring(0, 300) || '(star only)',
        reply: r.reviewReply,
      }));

    const totalReviews = reviews.length;
    const totalReplied = reviews.filter(r => r.reviewReply).length;
    const replyRate = totalReviews > 0 ? Math.round((totalReplied / totalReviews) * 100) : 100;

    const state = await getState();

    return res.status(200).json({
      ok: true,
      period: { since, hoursBack },
      overall: { totalReviews, totalReplied, replyRate },
      byLocation,
      qualitySample: sample,
      pipelineState: state ? {
        lastPollTime: state.lastPollTime,
        trackedReviewIds: state.repliedReviewIds
          ? Object.entries(state.repliedReviewIds).reduce((acc, [k, v]) => {
              acc[k.split('/').pop()] = v.length;
              return acc;
            }, {})
          : null
      } : null
    });
  } catch (err) {
    console.error('[stats] error:', err);
    return res.status(500).json({ error: err.message });
  }
}
