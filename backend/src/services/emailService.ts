export class EmailDeliveryError extends Error {
  constructor() {
    super('Email delivery is unavailable. Please try again later.');
    this.name = 'EmailDeliveryError';
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendAccountLinkingEmail(
  recipient: string,
  token: string,
  expiresAt: Date
): Promise<void> {
  const serverToken = process.env.POSTMARK_SERVER_TOKEN?.trim();
  const senderEmail = process.env.POSTMARK_FROM_EMAIL?.trim();

  if (
    !serverToken ||
    !senderEmail ||
    !isValidEmail(recipient) ||
    !isValidEmail(senderEmail) ||
    !token ||
    !Number.isFinite(expiresAt.getTime()) ||
    expiresAt.getTime() <= Date.now()
  ) {
    throw new EmailDeliveryError();
  }

  const safeToken = escapeHtml(token);
  const expiresAtText = expiresAt.toUTCString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': serverToken,
      },
      body: JSON.stringify({
        From: senderEmail,
        To: recipient,
        Subject: 'Your EasyList account recovery code',
        TextBody: [
          'A request was made to link an EasyList account to an existing shop.',
          '',
          `Your one-time code is: ${token}`,
          `It expires at ${expiresAtText}.`,
          '',
          'If you did not request this, do not share the code and contact EasyList support.',
        ].join('\n'),
        HtmlBody: [
          '<p>A request was made to link an EasyList account to an existing shop.</p>',
          `<p>Your one-time code is: <strong>${safeToken}</strong></p>`,
          `<p>This code expires at ${escapeHtml(expiresAtText)}.</p>`,
          '<p>If you did not request this, do not share the code and contact EasyList support.</p>',
        ].join(''),
        MessageStream: 'outbound',
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new EmailDeliveryError();
    }
  } catch {
    throw new EmailDeliveryError();
  } finally {
    clearTimeout(timeout);
  }
}
