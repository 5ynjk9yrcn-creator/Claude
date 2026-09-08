// Email delivery. HTTP providers first (Resend, Postmark) because they are
// one request and no connection state; a minimal SMTP client is included so
// self-hosters with nothing but a relay can still get alerts.
import net from 'node:net';
import tls from 'node:tls';
import { config } from '../config.js';
import { log } from '../log.js';

export function buildMime({ from, to, subject, html, text }) {
  const boundary = `sr_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${Date.now()}.${Math.random().toString(36).slice(2)}@sunsetradar>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`
  ];
  const body = [
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    text || '',
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    html || '',
    `--${boundary}--`,
    ''
  ];
  return `${headers.join('\r\n')}\r\n\r\n${body.join('\r\n')}`;
}

// RFC 2047 encoding, needed the moment a vendor puts an em dash in a title.
export function encodeHeader(s = '') {
  return /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`;
}

export async function sendEmail({ to, subject, html, text }) {
  const provider = (config.email.provider || '').toLowerCase();
  if (!provider) return { ok: false, error: 'no EMAIL_PROVIDER configured' };
  const from = config.email.from;

  if (provider === 'resend') {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.email.apiKey}` },
      body: JSON.stringify({ from, to: [to], subject, html, text })
    });
    if (res.ok) return { ok: true };
    return { ok: false, error: `resend ${res.status}: ${(await res.text()).slice(0, 200)}` };
  }

  if (provider === 'postmark') {
    const res = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', 'X-Postmark-Server-Token': config.email.apiKey },
      body: JSON.stringify({ From: from, To: to, Subject: subject, HtmlBody: html, TextBody: text, MessageStream: 'outbound' })
    });
    if (res.ok) return { ok: true };
    return { ok: false, error: `postmark ${res.status}: ${(await res.text()).slice(0, 200)}` };
  }

  if (provider === 'smtp') {
    try {
      await sendSmtp({ from, to, raw: buildMime({ from, to, subject, html, text }) });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: `smtp: ${err.message}` };
    }
  }

  return { ok: false, error: `unknown EMAIL_PROVIDER "${provider}"` };
}

const addrOnly = (s) => {
  const m = String(s).match(/<([^>]+)>/);
  return m ? m[1] : String(s).trim();
};

/**
 * Minimal SMTP: EHLO, optional STARTTLS, AUTH LOGIN/PLAIN, MAIL/RCPT/DATA.
 * Enough for the relays people actually point this at.
 */
export function sendSmtp({ from, to, raw, timeoutMs = 20000 }) {
  const { host, port, user, pass, secure } = config.email.smtp;
  if (!host) return Promise.reject(new Error('SMTP_HOST not set'));

  return new Promise((resolve, reject) => {
    let socket = secure ? tls.connect({ host, port, servername: host }) : net.connect({ host, port });
    let buffer = '';
    let stage = 'greeting';
    let done = false;
    const timer = setTimeout(() => fail(new Error(`timeout in stage ${stage}`)), timeoutMs);

    const finish = (err) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { socket.destroy(); } catch { /* closed */ }
      err ? reject(err) : resolve();
    };
    const fail = (err) => finish(err);
    const send = (line) => { log.debug('smtp >', { stage, line: line.slice(0, 40) }); socket.write(line + '\r\n'); };

    const onData = (chunk) => {
      buffer += chunk.toString('utf8');
      // Wait for a complete reply (last line has a space after the code).
      const lines = buffer.split('\r\n').filter(Boolean);
      const last = lines.at(-1) || '';
      if (!/^\d{3} /.test(last)) return;
      const code = parseInt(last.slice(0, 3), 10);
      const text = buffer;
      buffer = '';
      handle(code, text);
    };

    const handle = (code, text) => {
      const expect = (want) => { if (code !== want && !(Array.isArray(want) && want.includes(code))) throw new Error(`stage ${stage}: ${text.trim().slice(0, 160)}`); };
      try {
        switch (stage) {
          case 'greeting':
            expect(220); stage = 'ehlo'; send(`EHLO sunsetradar`); break;
          case 'ehlo': {
            expect(250);
            if (!secure && /STARTTLS/i.test(text)) { stage = 'starttls'; send('STARTTLS'); break; }
            stage = user ? 'auth' : 'mail';
            if (user) send(/PLAIN/i.test(text) ? `AUTH PLAIN ${Buffer.from(`\0${user}\0${pass}`).toString('base64')}` : 'AUTH LOGIN');
            else send(`MAIL FROM:<${addrOnly(from)}>`);
            break;
          }
          case 'starttls': {
            expect(220);
            socket.removeListener('data', onData);
            const upgraded = tls.connect({ socket, host, servername: host });
            upgraded.on('data', onData);
            upgraded.on('error', fail);
            socket = upgraded;
            stage = 'ehlo2';
            upgraded.once('secureConnect', () => send('EHLO sunsetradar'));
            break;
          }
          case 'ehlo2': {
            expect(250);
            stage = user ? 'auth' : 'mail';
            if (user) send(/PLAIN/i.test(text) ? `AUTH PLAIN ${Buffer.from(`\0${user}\0${pass}`).toString('base64')}` : 'AUTH LOGIN');
            else send(`MAIL FROM:<${addrOnly(from)}>`);
            break;
          }
          case 'auth':
            if (code === 334) { stage = 'auth_user'; send(Buffer.from(user).toString('base64')); break; }
            expect([235, 250]); stage = 'mail'; send(`MAIL FROM:<${addrOnly(from)}>`); break;
          case 'auth_user':
            expect(334); stage = 'auth_pass'; send(Buffer.from(pass).toString('base64')); break;
          case 'auth_pass':
            expect([235, 250]); stage = 'mail'; send(`MAIL FROM:<${addrOnly(from)}>`); break;
          case 'mail':
            expect(250); stage = 'rcpt'; send(`RCPT TO:<${addrOnly(to)}>`); break;
          case 'rcpt':
            expect([250, 251]); stage = 'data'; send('DATA'); break;
          case 'data':
            expect(354);
            stage = 'body';
            // Dot-stuffing: a line that is just "." would end the message early.
            socket.write(raw.replace(/^\./gm, '..') + '\r\n.\r\n');
            break;
          case 'body':
            expect(250); stage = 'quit'; send('QUIT'); finish(null); break;
          default:
            finish(null);
        }
      } catch (err) { fail(err); }
    };

    socket.on('data', onData);
    socket.on('error', fail);
    socket.on('close', () => { if (!done && stage !== 'quit') fail(new Error(`connection closed during ${stage}`)); });
  });
}
