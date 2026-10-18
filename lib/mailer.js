'use strict';

/**
 * Zero-dependency mailer module using the Resend HTTP API.
 * Automatically gracefully falls back to console.log if RESEND_API_KEY is not set.
 */
async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'PIMH Academy <onboarding@resend.dev>';

  if (!apiKey) {
    console.log(`\n\n[DEV-MAILER-STUB] Would have sent email from "${fromEmail}" to ${to}`);
    console.log(`[DEV-MAILER-STUB] Subject: ${subject}`);
    console.log(`[DEV-MAILER-STUB] Body: ${html.substring(0, 150)}...\n\n`);
    return { id: 'dev-stub-id', stub: true };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: fromEmail,
      to,
      subject,
      html
    })
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('[MAILER] Failed to send email via Resend API:', data);
    throw new Error(data.message || 'Error sending email');
  }

  console.log(`[MAILER] Successfully sent email to ${to} (ID: ${data.id})`);
  return data;
}

module.exports = {
  sendEmail
};

