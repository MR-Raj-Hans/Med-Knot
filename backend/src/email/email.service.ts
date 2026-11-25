import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type EmailTemplate = 'verification' | 'password-reset';
export type EmailDeliveryMode = 'development' | 'sent';

export type OutboundEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export interface EmailTransport {
  readonly provider: 'development' | 'resend';
  send(message: OutboundEmail): Promise<void>;
}

export class EmailDeliveryError extends Error {
  constructor(readonly provider: string, readonly statusCode?: number) {
    super('Email delivery failed.');
    this.name = 'EmailDeliveryError';
  }
}

export class DevelopmentEmailTransport implements EmailTransport {
  readonly provider = 'development' as const;
  async send(_message: OutboundEmail): Promise<void> {}
}

export class ResendEmailTransport implements EmailTransport {
  readonly provider = 'resend' as const;

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly timeoutMs: number,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async send(message: OutboundEmail): Promise<void> {
    let response: Response;
    try {
      response = await this.fetcher('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new EmailDeliveryError(this.provider);
    }

    if (!response.ok) throw new EmailDeliveryError(this.provider, response.status);
  }
}

export function createEmailTransport(config: Pick<ConfigService, 'get'>): EmailTransport {
  const appEnv = config.get<string>('APP_ENV', 'development');
  const provider = config.get<string>('EMAIL_PROVIDER', appEnv === 'development' ? 'development' : '');

  if (provider === 'development') {
    if (appEnv === 'production') throw new Error('Production cannot use the development email transport.');
    return new DevelopmentEmailTransport();
  }

  if (provider === 'resend') {
    const apiKey = config.get<string>('EMAIL_API_KEY');
    const from = config.get<string>('EMAIL_FROM');
    if (!apiKey || !from) throw new Error('Resend email requires EMAIL_API_KEY and EMAIL_FROM.');
    return new ResendEmailTransport(apiKey, from, config.get<number>('EMAIL_TIMEOUT_MS', 8000));
  }

  throw new Error('A supported email provider must be configured.');
}

export const EMAIL_TRANSPORT = Symbol('EMAIL_TRANSPORT');

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly transport: EmailTransport) {}

  get deliveryMode(): EmailDeliveryMode {
    return this.transport.provider === 'development' ? 'development' : 'sent';
  }

  async sendVerificationCode(to: string, name: string, code: string, expiresMinutes: number) {
    const safeName = escapeHtml(name);
    await this.deliver('verification', {
      to,
      subject: 'Verify your MedKnot email',
      text: `Hello ${name}, your MedKnot verification code is ${code}. It expires in ${expiresMinutes} minutes. If you did not request this, ignore this email.`,
      html: emailHtml('Verify your email', safeName, code, expiresMinutes, 'Use this one-time code to finish creating your MedKnot account.'),
    });
    return this.deliveryMode;
  }

  async sendPasswordResetCode(to: string, name: string, code: string, expiresMinutes: number) {
    const safeName = escapeHtml(name);
    await this.deliver('password-reset', {
      to,
      subject: 'Reset your MedKnot password',
      text: `Hello ${name}, your MedKnot password reset code is ${code}. It expires in ${expiresMinutes} minutes. If you did not request this, ignore this email.`,
      html: emailHtml('Reset your password', safeName, code, expiresMinutes, 'Use this one-time code to choose a new MedKnot password.'),
    });
    return this.deliveryMode;
  }

  private async deliver(template: EmailTemplate, message: OutboundEmail) {
    try {
      await this.transport.send(message);
      this.logger.log(`Email delivery accepted; provider=${this.transport.provider}; template=${template}`);
    } catch (error) {
      const status = error instanceof EmailDeliveryError ? error.statusCode : undefined;
      this.logger.warn(`Email delivery failed; provider=${this.transport.provider}; template=${template}; status=${status ?? 'network'}`);
      throw new EmailDeliveryError(this.transport.provider, status);
    }
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]!);
}

function emailHtml(title: string, safeName: string, code: string, expiresMinutes: number, explanation: string) {
  return `<!doctype html><html><body style="margin:0;background:#f7f8f4;font-family:Arial,sans-serif;color:#17364b"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#fff;border-radius:18px"><tr><td style="padding:32px"><p style="margin:0 0 8px;color:#187d79;font-size:12px;font-weight:bold;letter-spacing:2px">MEDKNOT</p><h1 style="font-size:24px;margin:0 0 18px">${title}</h1><p style="font-size:15px;line-height:1.6">Hello ${safeName},</p><p style="font-size:15px;line-height:1.6">${explanation}</p><p style="margin:26px 0;padding:16px;text-align:center;border-radius:12px;background:#eef4f0;font-size:30px;font-weight:bold;letter-spacing:8px">${code}</p><p style="font-size:13px;line-height:1.6;color:#596a72">This code expires in ${expiresMinutes} minutes and can only be used once. If you did not request it, you can ignore this email.</p><p style="margin:26px 0 0;font-size:12px;color:#596a72">Connected care. Brighter lives.</p></td></tr></table></td></tr></table></body></html>`;
}
