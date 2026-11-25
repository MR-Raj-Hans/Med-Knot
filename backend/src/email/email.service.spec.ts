import { EmailDeliveryError, EmailService, createEmailTransport, DevelopmentEmailTransport, ResendEmailTransport } from './email.service.js';

describe('EmailService', () => {
  it('uses the local-only adapter in development and keeps delivery mode explicit', async () => {
    const transport = new DevelopmentEmailTransport();
    const service = new EmailService(transport);

    await expect(service.sendVerificationCode('patient@example.test', 'A Patient', '123456', 10)).resolves.toBe('development');
  });

  it('rejects development email transport in production', () => {
    const config = { get: (key: string) => ({ APP_ENV: 'production', EMAIL_PROVIDER: 'development' })[key] } as never;
    expect(() => createEmailTransport(config)).toThrow('Production cannot use the development email transport.');
  });

  it('sends through Resend and fails closed on an unsuccessful provider response', async () => {
    let receivedUrl: RequestInfo | URL | undefined;
    let receivedInit: RequestInit | undefined;
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
      receivedUrl = input;
      receivedInit = init;
      return new Response(null, { status: 202 });
    }) as typeof fetch;
    const transport = new ResendEmailTransport('secret-test-key', 'no-reply@example.test', 1000, fetcher);
    await transport.send({ to: 'patient@example.test', subject: 'Verify', text: 'Code 123456', html: '<p>Code 123456</p>' });

    expect(receivedUrl).toBe('https://api.resend.com/emails');
    expect(receivedInit?.method).toBe('POST');
    expect((receivedInit?.headers as Record<string, string>).Authorization).toBe('Bearer secret-test-key');

    const failedFetch = (async () => new Response(null, { status: 503 })) as typeof fetch;
    const failed = new ResendEmailTransport('secret-test-key', 'no-reply@example.test', 1000, failedFetch);
    await expect(failed.send({ to: 'patient@example.test', subject: 'Verify', text: 'Code 123456', html: '<p>Code 123456</p>' })).rejects.toBeInstanceOf(EmailDeliveryError);
  });

  it('rejects missing Resend credentials at provider construction', () => {
    const config = { get: (key: string) => ({ APP_ENV: 'development', EMAIL_PROVIDER: 'resend' })[key] } as never;
    expect(() => createEmailTransport(config)).toThrow('Resend email requires EMAIL_API_KEY and EMAIL_FROM.');
  });
});
