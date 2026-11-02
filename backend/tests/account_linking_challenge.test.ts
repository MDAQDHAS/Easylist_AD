import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  createAccountLinkingChallenge,
} from '../src/services/accountLinkingChallenge.js';
import {
  EmailDeliveryError,
  sendAccountLinkingEmail,
} from '../src/services/emailService.js';

test('creates a high-entropy challenge with a hash and a 15-minute expiration', () => {
  const now = new Date('2026-10-29T12:00:00.000Z');
  const challenge = createAccountLinkingChallenge(now);

  assert.match(challenge.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(
    challenge.tokenHash,
    crypto.createHash('sha256').update(challenge.token).digest('hex')
  );
  assert.equal(
    challenge.expiresAt,
    new Date(now.getTime() + 15 * 60 * 1000).toISOString()
  );
});

test('generates unique challenge tokens', () => {
  const first = createAccountLinkingChallenge();
  const second = createAccountLinkingChallenge();

  assert.notEqual(first.token, second.token);
  assert.notEqual(first.tokenHash, second.tokenHash);
});

function withPostmarkConfig<T>(run: () => Promise<T>): Promise<T> {
  const oldToken = process.env.POSTMARK_SERVER_TOKEN;
  const oldSender = process.env.POSTMARK_FROM_EMAIL;
  process.env.POSTMARK_SERVER_TOKEN = 'test-server-token';
  process.env.POSTMARK_FROM_EMAIL = 'no-reply@example.com';

  return run().finally(() => {
    if (oldToken === undefined) delete process.env.POSTMARK_SERVER_TOKEN;
    else process.env.POSTMARK_SERVER_TOKEN = oldToken;
    if (oldSender === undefined) delete process.env.POSTMARK_FROM_EMAIL;
    else process.env.POSTMARK_FROM_EMAIL = oldSender;
  });
}

test('reports success only when Postmark accepts the request', async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl = '';
  let requestInit: RequestInit | undefined;
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    requestInit = init;
    return new Response(null, { status: 200 });
  };

  try {
    await withPostmarkConfig(() =>
      sendAccountLinkingEmail(
        'user@example.com',
        'test-one-time-token',
        new Date(Date.now() + 60_000)
      )
    );

    assert.equal(requestUrl, 'https://api.postmarkapp.com/email');
    assert.equal(requestInit?.method, 'POST');
    assert.equal(
      new Headers(requestInit?.headers).get('X-Postmark-Server-Token'),
      'test-server-token'
    );
    const body = JSON.parse(String(requestInit?.body)) as {
      To: string;
      TextBody: string;
      HtmlBody: string;
    };
    assert.equal(body.To, 'user@example.com');
    assert.match(body.TextBody, /test-one-time-token/);
    assert.match(body.HtmlBody, /test-one-time-token/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fails closed when Postmark is not configured', async () => {
  const oldToken = process.env.POSTMARK_SERVER_TOKEN;
  const oldSender = process.env.POSTMARK_FROM_EMAIL;
  delete process.env.POSTMARK_SERVER_TOKEN;
  delete process.env.POSTMARK_FROM_EMAIL;

  try {
    await assert.rejects(
      sendAccountLinkingEmail(
        'user@example.com',
        'test-one-time-token',
        new Date(Date.now() + 60_000)
      ),
      EmailDeliveryError
    );
  } finally {
    if (oldToken === undefined) delete process.env.POSTMARK_SERVER_TOKEN;
    else process.env.POSTMARK_SERVER_TOKEN = oldToken;
    if (oldSender === undefined) delete process.env.POSTMARK_FROM_EMAIL;
    else process.env.POSTMARK_FROM_EMAIL = oldSender;
  }
});

test('does not claim delivery when Postmark rejects a request', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 422 });

  try {
    await withPostmarkConfig(() =>
      assert.rejects(
        sendAccountLinkingEmail(
          'user@example.com',
          'test-one-time-token',
          new Date(Date.now() + 60_000)
        ),
        EmailDeliveryError
      )
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('does not claim delivery when the provider request fails', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('test network failure');
  };

  try {
    await withPostmarkConfig(() =>
      assert.rejects(
        sendAccountLinkingEmail(
          'user@example.com',
          'test-one-time-token',
          new Date(Date.now() + 60_000)
        ),
        EmailDeliveryError
      )
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
