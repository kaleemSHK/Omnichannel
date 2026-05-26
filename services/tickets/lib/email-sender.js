/**
 * Email sender — Sprint 2 E01
 *
 * Zero-dependency multi-provider outbound email.
 * Provider is selected by EMAIL_PROVIDER env var:
 *
 *   stub (default) — logs the email, returns success immediately. Safe for dev.
 *   mailgun        — Mailgun Messages API (v3). Needs MAILGUN_API_KEY + MAILGUN_DOMAIN.
 *   sendgrid       — SendGrid Mail Send API. Needs SENDGRID_API_KEY.
 *   resend         — Resend API. Needs RESEND_API_KEY.
 *   smtp           — Minimal SMTP over TLS/STARTTLS (Node built-ins only).
 *                    Needs SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.
 *
 * All providers produce the same calling interface:
 *   sendEmail(options) → Promise<{ messageId, provider }>
 *
 * Options:
 *   to        {string}   — recipient address
 *   toName    {string}   — recipient display name
 *   subject   {string}   — email subject
 *   text      {string}   — plain-text body
 *   html      {string?}  — HTML body (optional)
 *   replyTo   {string?}  — Reply-To address
 *   messageId {string}   — outgoing Message-ID (caller must include angle brackets)
 *   inReplyTo {string?}  — In-Reply-To value
 *   references {string?} — space-separated References list
 */

import { createLogger } from './logger.js';
import { createConnection } from 'node:net';
import { connect as tlsConnect } from 'node:tls';

const log = createLogger('email-sender');

const PROVIDER   = (process.env.EMAIL_PROVIDER  || 'stub').toLowerCase();
const FROM_EMAIL = (process.env.SMTP_FROM        || process.env.EMAIL_FROM || 'support@blinkone.io').trim();
const FROM_NAME  = (process.env.EMAIL_FROM_NAME  || 'BlinkOne Support').trim();

// ─── Stub provider ────────────────────────────────────────────────────────────

async function sendStub(opts) {
  log.info({ to: opts.to, subject: opts.subject, messageId: opts.messageId }, '[email-stub] would send email');
  return { messageId: opts.messageId, provider: 'stub' };
}

// ─── Mailgun ──────────────────────────────────────────────────────────────────

async function sendMailgun(opts) {
  const apiKey  = process.env.MAILGUN_API_KEY?.trim();
  const domain  = process.env.MAILGUN_DOMAIN?.trim();
  const region  = (process.env.MAILGUN_REGION || 'us').toLowerCase(); // 'us' or 'eu'
  if (!apiKey || !domain) throw new Error('MAILGUN_API_KEY and MAILGUN_DOMAIN required');

  const base = region === 'eu'
    ? `https://api.eu.mailgun.net/v3/${domain}`
    : `https://api.mailgun.net/v3/${domain}`;

  const form = new URLSearchParams({
    from:    `${FROM_NAME} <${FROM_EMAIL}>`,
    to:      opts.toName ? `${opts.toName} <${opts.to}>` : opts.to,
    subject: opts.subject,
    text:    opts.text,
    'h:Message-Id': opts.messageId,
  });
  if (opts.html)        form.set('html', opts.html);
  if (opts.replyTo)     form.set('h:Reply-To', opts.replyTo);
  if (opts.inReplyTo)   form.set('h:In-Reply-To', opts.inReplyTo);
  if (opts.references)  form.set('h:References', opts.references);

  const res = await fetch(`${base}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Mailgun ${res.status}: ${body.message ?? JSON.stringify(body)}`);
  return { messageId: opts.messageId, provider: 'mailgun', id: body.id };
}

// ─── SendGrid ─────────────────────────────────────────────────────────────────

async function sendSendgrid(opts) {
  const apiKey = process.env.SENDGRID_API_KEY?.trim();
  if (!apiKey) throw new Error('SENDGRID_API_KEY required');

  const headers = { 'Message-ID': opts.messageId };
  if (opts.inReplyTo)  headers['In-Reply-To'] = opts.inReplyTo;
  if (opts.references) headers['References']  = opts.references;
  if (opts.replyTo)    headers['Reply-To']    = opts.replyTo;

  const payload = {
    personalizations: [{ to: [{ email: opts.to, name: opts.toName ?? '' }] }],
    from: { email: FROM_EMAIL, name: FROM_NAME },
    subject: opts.subject,
    content: [{ type: 'text/plain', value: opts.text }],
    headers,
  };
  if (opts.html) payload.content.push({ type: 'text/html', value: opts.html });

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`SendGrid ${res.status}: ${text.slice(0, 200)}`);
  }
  return { messageId: opts.messageId, provider: 'sendgrid' };
}

// ─── Resend ───────────────────────────────────────────────────────────────────

async function sendResend(opts) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error('RESEND_API_KEY required');

  const payload = {
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to:   [opts.to],
    subject: opts.subject,
    text: opts.text,
    headers: { 'Message-ID': opts.messageId },
  };
  if (opts.html)        payload.html = opts.html;
  if (opts.replyTo)     payload.reply_to = opts.replyTo;
  if (opts.inReplyTo)   payload.headers['In-Reply-To']  = opts.inReplyTo;
  if (opts.references)  payload.headers['References']   = opts.references;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Resend ${res.status}: ${body.message ?? JSON.stringify(body)}`);
  return { messageId: opts.messageId, provider: 'resend', id: body.id };
}

// ─── Minimal SMTP (Node built-ins only) ───────────────────────────────────────
// Supports STARTTLS on port 587 and implicit TLS on port 465.

function smtpCommand(socket, cmd) {
  return new Promise((resolve, reject) => {
    let buf = '';
    const handler = (data) => {
      buf += data.toString();
      // SMTP responses end with \r\n after the status code line
      if (/^\d{3} .+\r\n$/m.test(buf)) {
        socket.removeListener('data', handler);
        const code = parseInt(buf, 10);
        if (code >= 400) {
          reject(Object.assign(new Error(`SMTP ${code}: ${buf.trim()}`), { code }));
        } else {
          resolve(buf);
        }
      }
    };
    socket.on('data', handler);
    if (cmd) socket.write(`${cmd}\r\n`);
  });
}

function buildRawMessage(opts) {
  const date = new Date().toUTCString();
  const from = `${FROM_NAME} <${FROM_EMAIL}>`;
  const to   = opts.toName ? `${opts.toName} <${opts.to}>` : opts.to;
  const lines = [
    `Date: ${date}`,
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${opts.subject}`,
    `Message-ID: ${opts.messageId}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=utf-8`,
    `Content-Transfer-Encoding: quoted-printable`,
  ];
  if (opts.replyTo)    lines.push(`Reply-To: ${opts.replyTo}`);
  if (opts.inReplyTo)  lines.push(`In-Reply-To: ${opts.inReplyTo}`);
  if (opts.references) lines.push(`References: ${opts.references}`);
  lines.push('', opts.text ?? '');
  return lines.join('\r\n');
}

async function sendSmtp(opts) {
  const host = process.env.SMTP_HOST?.trim();
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host) throw new Error('SMTP_HOST required');

  const useImplicitTls = port === 465;
  const rawMsg = buildRawMessage(opts);

  return new Promise((resolve, reject) => {
    const onSocket = async (socket) => {
      try {
        await new Promise((res, rej) => {
          let buf = '';
          const h = (d) => { buf += d; if (/\r\n$/.test(buf)) { socket.removeListener('data', h); buf.startsWith('2') ? res(buf) : rej(new Error(buf)); } };
          socket.on('data', h);
        });
        await smtpCommand(socket, `EHLO blinkone`);
        if (!useImplicitTls) {
          // STARTTLS upgrade
          await smtpCommand(socket, 'STARTTLS');
          const tlsSock = tlsConnect({ socket, host, servername: host });
          await new Promise((res) => tlsSock.once('secureConnect', res));
          Object.assign(socket, { write: tlsSock.write.bind(tlsSock), on: tlsSock.on.bind(tlsSock), removeListener: tlsSock.removeListener.bind(tlsSock) });
          await smtpCommand(socket, `EHLO blinkone`);
        }
        if (user && pass) {
          await smtpCommand(socket, 'AUTH LOGIN');
          await smtpCommand(socket, Buffer.from(user).toString('base64'));
          await smtpCommand(socket, Buffer.from(pass).toString('base64'));
        }
        await smtpCommand(socket, `MAIL FROM:<${FROM_EMAIL}>`);
        await smtpCommand(socket, `RCPT TO:<${opts.to}>`);
        await smtpCommand(socket, 'DATA');
        await smtpCommand(socket, `${rawMsg}\r\n.`);
        await smtpCommand(socket, 'QUIT');
        socket.destroy();
        resolve({ messageId: opts.messageId, provider: 'smtp' });
      } catch (e) {
        socket.destroy();
        reject(e);
      }
    };

    if (useImplicitTls) {
      const s = tlsConnect({ host, port, servername: host }, () => onSocket(s).catch(reject));
      s.on('error', reject);
    } else {
      const s = createConnection({ host, port }, () => onSocket(s).catch(reject));
      s.on('error', reject);
    }
  });
}

// ─── Public entry point ───────────────────────────────────────────────────────

const PROVIDERS = { stub: sendStub, mailgun: sendMailgun, sendgrid: sendSendgrid, resend: sendResend, smtp: sendSmtp };

export async function sendEmail(opts) {
  const fn = PROVIDERS[PROVIDER] ?? sendStub;
  try {
    const result = await fn(opts);
    log.info({ provider: PROVIDER, to: opts.to, subject: opts.subject, messageId: opts.messageId }, 'email sent');
    return result;
  } catch (e) {
    log.error({ err: e.message, provider: PROVIDER, to: opts.to }, 'email send failed');
    throw e;
  }
}

export const emailProvider = PROVIDER;
