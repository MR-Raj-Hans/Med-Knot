import { randomBytes } from 'node:crypto';
import { ServiceUnavailableException } from '@nestjs/common';
import { ClinicalRecordsCrypto } from './clinical-records.crypto.js';

describe('ClinicalRecordsCrypto', () => {
  const key = randomBytes(32).toString('base64');
  const service = new ClinicalRecordsCrypto({ get: (name: string) => name === 'RECORD_ENCRYPTION_KEY' ? key : 'test' } as never);

  it('encrypts content with distinct IVs and decrypts it back', () => {
    const first = service.encrypt('A private clinical note.');
    const second = service.encrypt('A private clinical note.');

    expect(first.ciphertext).not.toContain('A private clinical note.');
    expect(first.iv).not.toBe(second.iv);
    expect(service.decrypt(first)).toBe('A private clinical note.');
  });

  it('rejects tampered ciphertext', () => {
    const encrypted = service.encrypt('Content');
    const altered = { ...encrypted, authTag: randomBytes(16).toString('base64') };

    expect(() => service.decrypt(altered)).toThrow(ServiceUnavailableException);
  });
});
