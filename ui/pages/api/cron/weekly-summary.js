// /api/cron/weekly-summary — Vercel Cron endpoint (runs every Monday 9am UTC)
// Fetches the past 7 days of reviews and sends a summary email.

import { fetchAllNewReviews } from '../../../lib/gbp.js';

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const reviews = await fetchAllNewReviews(sevenDaysAgo);

    if (reviews.length === 0) {
      console.log('[weekly] No reviews in the past 7 days');
      return res.status(200).json({ ok: true, reviews: 0 });
    }

    const avgRating = (reviews.reduce((sum, r) => sum + r.starRating, 0) / reviews.length).toFixed(1);
    const replied = reviews.filter(r => r.reviewReply).length;
    const responseRate = Math.round((replied / reviews.length) * 100);

    const breakdown = [5, 4, 3, 2, 1].map(stars => {
      const count = reviews.filter(r => r.starRating === stars).length;
      return `  ★${stars}: ${count}`;
    }).join('\n');

    const summary = `
Contrabando Almada — Weekly Review Summary
Week ending: ${new Date().toLocaleDateString('en-GB')}

Total reviews: ${reviews.length}
Average rating: ${avgRating} ⭐
Replied: ${replied}/${reviews.length} (${responseRate}%)

Rating breakdown:
${breakdown}
`.trim();

    console.log('[weekly]', summary);

    // Send email if SMTP is configured
    const alertEmail = process.env.ALERT_EMAIL;
    if (alertEmail && process.env.SMTP_HOST) {
      const nodemailer = (await import('nodemailer')).default;
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: 587,
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      });
      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: alertEmail,
        subject: `Weekly Review Summary — Contrabando Almada (${reviews.length} reviews, ${avgRating}⭐)`,
        text: summary
      });
      console.log('[weekly] Summary email sent');
    }

    return res.status(200).json({ ok: true, reviews: reviews.length, avgRating, responseRate });
  } catch (err) {
    console.error('[cron] weekly-summary error:', err);
    return res.status(500).json({ error: err.message });
  }
}
