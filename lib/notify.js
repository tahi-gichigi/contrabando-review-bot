// ui/lib/notify.js — WhatsApp + email alerts (ES module for Next.js)

export async function sendWhatsApp(starRating, reviewerName, comment, locationLabel = 'Almada') {
  const phone = process.env.CALLMEBOT_PHONE;
  const apiKey = process.env.CALLMEBOT_APIKEY;

  if (!phone || !apiKey) {
    console.warn('[notify] CALLMEBOT_PHONE or CALLMEBOT_APIKEY not set');
    return false;
  }

  const stars = '⭐'.repeat(starRating);
  const snippet = (comment || '(no comment)').slice(0, 100);
  const text = `${stars} ${starRating}/5 — ${reviewerName}\n"${snippet}"\n[Contrabando ${locationLabel}]`;
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(apiKey)}`;

  try {
    const res = await fetch(url);
    if (res.ok) {
      console.log('[notify] WhatsApp alert sent');
      return true;
    }
    console.warn(`[notify] Callmebot returned ${res.status} — trying email fallback`);
  } catch (err) {
    console.warn(`[notify] Callmebot failed: ${err.message} — trying email fallback`);
  }

  return sendEmail(starRating, reviewerName, comment);
}

/**
 * Send a pipeline alert (not a review notification).
 * Used when the pipeline encounters errors or an unhandled exception.
 * @param {string} message - alert text
 */
export async function sendAlert(message) {
  const phone = process.env.CALLMEBOT_PHONE;
  const apiKey = process.env.CALLMEBOT_APIKEY;

  const alertText = `[Contrabando Bot Alert]\n${message}`;

  if (phone && apiKey) {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(alertText)}&apikey=${encodeURIComponent(apiKey)}`;
    try {
      const res = await fetch(url);
      if (res.ok) {
        console.log('[notify] Alert sent via WhatsApp');
        return true;
      }
      console.warn(`[notify] Alert WhatsApp failed: ${res.status}`);
    } catch (err) {
      console.warn(`[notify] Alert WhatsApp error: ${err.message}`);
    }
  } else {
    console.warn('[notify] sendAlert: CALLMEBOT env vars not set, alert not sent');
  }

  return false;
}

async function sendEmail(starRating, reviewerName, comment) {
  // nodemailer is not installed in ui/ by default — add if needed
  console.warn('[notify] Email fallback not implemented in Vercel env yet');
  return false;
}
