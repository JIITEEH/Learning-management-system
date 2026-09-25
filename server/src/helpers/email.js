// Outgoing email, over SMTP. The settings live in .env and are read once in
// config/index.js; see .env.example for how to use a Gmail account.
//
// With SMTP_HOST left empty, nothing is sent. Outside production the message
// is printed in the server's terminal instead, so the reset flow can be tried
// on a laptop with no mail account at all. In production an unsent message
// is logged as an error, because someone is waiting for it.

import nodemailer from 'nodemailer';

import config from '../config/index.js';

const SECONDS = 1000;

let transport = null;

function getTransport() {
  if (!config.mail.host) return null;
  transport ??= nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    // Port 465 speaks TLS from the first byte; 587 upgrades part way through.
    secure: config.mail.port === 465,
    auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined,
    // Give up on an unreachable mail server rather than hold a send for minutes.
    connectionTimeout: 10 * SECONDS,
    greetingTimeout: 10 * SECONDS,
    socketTimeout: 20 * SECONDS,
  });
  return transport;
}

// Turns a mail server error into what to change in .env
function explain(error) {
  const hints = {
    EAUTH:
      'The mail server rejected SMTP_USER and SMTP_PASS. With Gmail, SMTP_PASS must be an app password, not the account password.',
    EDNS: `SMTP_HOST "${config.mail.host}" could not be found. Check the spelling.`,
    ECONNECTION: `Could not connect to ${config.mail.host} on port ${config.mail.port}. Check SMTP_HOST and SMTP_PORT.`,
    ETIMEDOUT: `${config.mail.host} did not answer on port ${config.mail.port}. Use 465, or 587.`,
    EENVELOPE: 'The mail server refused the sender or recipient. MAIL_FROM must be an address SMTP_USER may send from.',
  };
  const hint = hints[error.code];
  return hint ? `${hint} (${error.message})` : error.message;
}

async function send({ to, subject, text, html }) {
  const mailer = getTransport();
  if (!mailer) {
    if (config.isProduction) {
      console.error(`Could not email ${to}: SMTP_HOST is not set, so "${subject}" was not sent.`);
    } else {
      console.log(`\n[email not sent: SMTP_HOST is not set]\nTo: ${to}\nSubject: ${subject}\n\n${text}\n`);
    }
    return;
  }
  await mailer.sendMail({ from: config.mail.from, to, subject, text, html });
}

// Sends without making the request wait for it. A slow mail server cannot delay the page, and the
// reply takes the same time whether or not the address has an account, so the timing cannot
// reveal who is registered.
export function sendInBackground(message) {
  send(message).catch((error) => {
    console.error(`Could not email ${message.to}: ${explain(error)}`);
  });
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );

// Mail programs ignore stylesheets unevenly, so every style is written inline.
// The blue is the site's own --primary.
const FONT = "'Plus Jakarta Sans', -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const BLUE = '#2451d6';

// A password reset email: a plain-text copy for simple mail programs, and HTML
export function passwordResetMessage({ to, fullName, url, minutes }) {
  const text = [
    `Hello ${fullName},`,
    '',
    'Someone asked to reset the password for your LearnHub account. Open this link to choose a new one:',
    '',
    url,
    '',
    `The link works once and expires in ${minutes} minutes. Using it signs you out on every device.`,
    '',
    'If you did not ask for this, ignore this email. Your password has not changed.',
  ].join('\n');

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#f3f6fc">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f6fc">
    <tr><td align="center" style="padding:40px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid #e3e8f3;border-radius:22px">
        <tr><td style="padding:36px 32px;font-family:${FONT};color:#0f1629">
          <p style="margin:0 0 24px;font-size:20px;font-weight:700;color:${BLUE}">LearnHub</p>
          <h1 style="margin:0 0 16px;font-size:22px">Reset your password</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#455069">Hello ${esc(fullName)}, someone asked to reset the password for your LearnHub account.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px"><tr>
            <td bgcolor="${BLUE}" style="border-radius:999px">
              <a href="${esc(url)}" style="display:inline-block;padding:13px 32px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none">Choose a new password</a>
            </td>
          </tr></table>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#455069">The link works once and expires in ${minutes} minutes. Using it signs you out on every device.</p>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#455069">If you did not ask for this, ignore this email. Your password has not changed.</p>
          <p style="margin:0;font-size:13px;line-height:1.6;color:#5f687d">If the button does not work, copy this link into your browser:<br><a href="${esc(url)}" style="color:${BLUE};word-break:break-all">${esc(url)}</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { to, subject: 'Reset your LearnHub password', text, html };
}
