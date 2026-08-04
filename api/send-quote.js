const { lookupCustomer } = require('../lib/customers');

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

    // Notify rep with lead info
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
      await send(
        repEmail,
        `New Lead: ${customerName || toEmail}${company ? ` @ ${company}` : ''}` +
          (account ? ` [${account.name}]` : ''),
        leadHTML,
        toEmail,
      );
    }

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
