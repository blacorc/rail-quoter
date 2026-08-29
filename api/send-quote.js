const { lookupCustomer } = require('../lib/customers');

/**
 * Plain-text rendering of the quote, sent alongside the HTML.
 *
 * The quote is a table, so the row and cell boundaries are what carry the
 * meaning — those become newlines and column gaps before the tags are
 * stripped, otherwise every figure runs together into one unreadable line.
 */
function htmlToText(html) {
  return String(html || '')
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/(td|th)>\s*(?=<(td|th)\b)/gi, '   ')     // cell gap
    .replace(/<\/(tr|p|div|h[1-6]|li|table)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr\s*\/?>/gi, '\n' + '-'.repeat(48) + '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&times;/gi, '×')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&')                              // last, or it double-decodes
    .split('\n').map(l => l.replace(/[ \t]+/g, ' ').trimEnd()).join('\n')
    .replace(/^[ \t]+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { toEmail, customerName, company, phone, projectName, quoteHTML, notes, subject,
          accessCode } = req.body || {};

  // Re-resolve the code here rather than trusting a name from the browser, so
  // the account shown on a lead notification is always the real one.
  const account = lookupCustomer(accessCode);

  if (!toEmail) {
    return res.status(400).json({ error: 'Missing recipient email' });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';
  const repEmail = process.env.REP_EMAIL;

  // Quotes are sent from a domain that has no mailbox behind it, so a bare
  // reply would bounce. Point replies at a monitored inbox instead.
  const replyTo = process.env.REPLY_TO || repEmail;

  if (!resendKey) {
    return res.status(500).json({ error: 'Email service not configured on server' });
  }

  const send = (to, subject, html, replyToAddr) =>
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject,
        html,
        // A plain-text alternative makes the message multipart/alternative
        // rather than HTML-only. HTML with no text part is one of the oldest
        // spam signals there is, and it is what several filters — Proton
        // among them — weigh most heavily on an unfamiliar sending domain.
        text: htmlToText(html),
        ...(replyToAddr ? { reply_to: replyToAddr } : {}),
      }),
    });

  try {
    // Send quote to customer
    // Customer's copy: replies reach the rep, not the unattended send address.
    const customerRes = await send(
      toEmail,
      subject || `Your Linear Rail Quote${projectName ? ` — ${projectName}` : ''}`,
      quoteHTML,
      replyTo,
    );

    if (!customerRes.ok) {
      const err = await customerRes.json();
      return res.status(500).json({ error: err.message || 'Failed to send customer email' });
    }

    // Notify rep with lead info.
    //
    // Both failure modes here used to be silent: an unset REP_EMAIL skipped
    // the notification entirely, and a rejected send was never checked. The
    // customer saw success either way, so leads could vanish with no signal
    // anywhere. Neither is fatal to the customer's own quote, which has
    // already gone out, so they are logged rather than thrown.
    let leadNotified = false;

    if (!repEmail) {
      console.error('REP_EMAIL is not set — no lead notification sent for ' +
        `${customerName || toEmail}${company ? ` @ ${company}` : ''}. ` +
        'Set REP_EMAIL in the Vercel project environment variables.');
    }

    if (repEmail) {
      const leadHTML = `
        <div style="font-family:Arial,sans-serif;max-width:600px;">
          <h2 style="color:#0B1929;">New Quote Request</h2>
          <table style="border-collapse:collapse;width:100%;margin-bottom:24px;">
            <tr><td style="padding:6px 0;color:#666;width:120px;">Name</td><td style="padding:6px 0;font-weight:600;">${customerName || '—'}</td></tr>
            <tr><td style="padding:6px 0;color:#666;">Email</td><td style="padding:6px 0;font-weight:600;">${toEmail}</td></tr>
            <tr><td style="padding:6px 0;color:#666;">Company</td><td style="padding:6px 0;font-weight:600;">${company || '—'}</td></tr>
            <tr><td style="padding:6px 0;color:#666;">Phone</td><td style="padding:6px 0;font-weight:600;">${phone || '—'}</td></tr>
            <tr><td style="padding:6px 0;color:#666;">Project</td><td style="padding:6px 0;font-weight:600;">${projectName || '—'}</td></tr>
            ${notes ? `<tr><td style="padding:6px 0;color:#666;">Notes</td><td style="padding:6px 0;">${notes}</td></tr>` : ''}
            ${account ? `<tr><td style="padding:6px 0;color:#666;">Account</td><td style="padding:6px 0;font-weight:600;color:#15803d;">${account.name} (${account.code}) — quoted at account rates</td></tr>` : ''}
          </table>
          <hr style="border:none;border-top:1px solid #eee;margin-bottom:24px;">
          <p style="color:#666;font-size:13px;margin-bottom:16px;">Quote sent to customer:</p>
          ${quoteHTML}
        </div>`;

      // Lead notification: replying goes straight back to the customer.
      const leadRes = await send(
        repEmail,
        `New Lead: ${customerName || toEmail}${company ? ` @ ${company}` : ''}` +
          (account ? ` [${account.name}]` : ''),
        leadHTML,
        toEmail,
      );

      leadNotified = leadRes.ok;
      if (!leadRes.ok) {
        const detail = await leadRes.text().catch(() => '');
        console.error(`Lead notification to ${repEmail} failed ` +
          `(HTTP ${leadRes.status}): ${detail}`);
      }
    }

    // leadNotified is for the Vercel logs and for debugging a quiet inbox —
    // the browser does not show it, since the customer's quote did send.
    return res.json({ success: true, leadNotified });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
