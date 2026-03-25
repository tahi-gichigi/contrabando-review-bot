// notify.js — sends WhatsApp alerts for negative reviews (1-2 stars)
// Primary: Callmebot WhatsApp API
// Fallback: SMTP email via nodemailer

require('dotenv').config();

/**
 * Send a WhatsApp notification via Callmebot.
 * @param {number} starRating
 * @param {string} reviewerName
 * @param {string} comment - full review text (will be truncated)
 * @returns {Promise<boolean>} true if delivered
 */
async function sendWhatsApp(starRating, reviewerName, comment) {
  const phone = process.env.CALLMEBOT_PHONE;
  const apiKey = process.env.CALLMEBOT_APIKEY;

  if (!phone || !apiKey) {
    console.warn('  [notify] CALLMEBOT_PHONE or CALLMEBOT_APIKEY not set — skipping WhatsApp alert');
    return false;
  }

  const stars = '⭐'.repeat(starRating);
  const snippet = (comment || '(no comment)').slice(0, 100);
  const text = `${stars} ${starRating}/5 — ${reviewerName}\n"${snippet}"\n[Contrabando Almada]`;

  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(apiKey)}`;

  try {
    const res = await fetch(url);
    if (res.ok) {
      console.log('  [notify] WhatsApp alert sent');
      return true;
    }
    console.warn(`  [notify] Callmebot returned ${res.status} — falling back to email`);
  } catch (err) {
    console.warn(`  [notify] Callmebot request failed: ${err.message} — falling back to email`);
  }

  return sendEmail(starRating, reviewerName, comment);
}

/**
 * Send email fallback via SMTP (nodemailer).
 * Requires SMTP_HOST, SMTP_USER, SMTP_PASS, ALERT_EMAIL in env.
 */
async function sendEmail(starRating, reviewerName, comment) {
  const alertEmail = process.env.ALERT_EMAIL;
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!alertEmail || !smtpHost || !smtpUser || !smtpPass) {
    console.warn('  [notify] SMTP env vars not set — cannot send email fallback');
    return false;
  }

  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: 587,
      secure: false,
      auth: { user: smtpUser, pass: smtpPass }
    });

    const stars = '⭐'.repeat(starRating);
    await transporter.sendMail({
      from: smtpUser,
      to: alertEmail,
      subject: `${stars} ${starRating}/5 review — Contrabando Almada`,
      text: `New negative review from ${reviewerName}:\n\n"${comment || '(no comment)'}"\n\nCheck Google Business Profile to review the auto-reply.`
    });
    console.log('  [notify] Email fallback sent');
    return true;
  } catch (err) {
    console.error(`  [notify] Email fallback failed: ${err.message}`);
    return false;
  }
}

module.exports = { sendWhatsApp };

// Quick test when run directly
if (require.main === module) {
  sendWhatsApp(1, 'Test User', 'This is a test negative review for the notification system.')
    .then(ok => console.log('Notification result:', ok))
    .catch(console.error);
}
