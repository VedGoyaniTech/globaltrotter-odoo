import nodemailer, { type Transporter } from 'nodemailer';
import { env, isProd } from '../config/env.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Captured messages, populated only under MAIL_TRANSPORT=memory. Tests assert
 * against this instead of standing up an SMTP server.
 */
export const outbox: MailMessage[] = [];

let transporter: Transporter | null = null;

function smtpTransport(): Transporter {
  if (!transporter) {
    transporter = env.SMTP_URL
      ? nodemailer.createTransport(env.SMTP_URL)
      : nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_PORT === 465,
          auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
        });
  }
  return transporter;
}

/** True when this instance can actually deliver mail. */
export const mailEnabled = () =>
  env.MAIL_TRANSPORT !== 'smtp' || Boolean(env.SMTP_URL || env.SMTP_HOST);

export async function sendMail(message: MailMessage): Promise<void> {
  switch (env.MAIL_TRANSPORT) {
    case 'memory':
      outbox.push(message);
      return;

    case 'log':
      // No provider configured. Print it so local development still has a
      // working reset flow without an account anywhere.
      console.log(
        `\n--- mail (not sent: MAIL_TRANSPORT=log) ---\nto: ${message.to}\nsubject: ${message.subject}\n\n${message.text}\n---\n`,
      );
      return;

    case 'smtp':
      if (!mailEnabled())
        throw new Error('MAIL_TRANSPORT=smtp but no SMTP_URL or SMTP_HOST is set');
      await smtpTransport().sendMail({ from: env.MAIL_FROM, ...message });
      return;
  }
}

export function passwordResetEmail(token: string): Omit<MailMessage, 'to'> {
  const link = `${env.APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  return {
    subject: 'Reset your GlobeTrotter password',
    text: [
      'Someone asked to reset the password for your GlobeTrotter account.',
      '',
      `Open this link within 30 minutes to choose a new one:`,
      link,
      '',
      'If this was not you, ignore this email — your password will not change.',
    ].join('\n'),
    html: `<p>Someone asked to reset the password for your GlobeTrotter account.</p>
<p><a href="${link}">Choose a new password</a> — the link is valid for 30 minutes.</p>
<p>If this was not you, ignore this email; your password will not change.</p>`,
  };
}

/** Called at boot so a misconfigured production deploy is obvious immediately. */
export function warnIfMailMisconfigured() {
  if (isProd && !mailEnabled()) {
    console.error(
      'WARNING: MAIL_TRANSPORT=smtp but no SMTP_URL/SMTP_HOST is configured. ' +
        'Password reset will return 503 until mail is set up.',
    );
  }
}
