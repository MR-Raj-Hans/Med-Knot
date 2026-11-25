import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;

export type EncryptedClinicalContent = { ciphertext: string; iv: string; authTag: string; keyVersion: 1 };

@Injectable()
export class ClinicalRecordsCrypto {
  constructor(private readonly config: ConfigService) {}

  encrypt(value: string): EncryptedClinicalContent {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.getKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return { ciphertext: ciphertext.toString('base64'), iv: iv.toString('base64'), authTag: cipher.getAuthTag().toString('base64'), keyVersion: 1 };
  }

  decrypt(record: Pick<EncryptedClinicalContent, 'ciphertext' | 'iv' | 'authTag'>): string {
    try {
      const decipher = createDecipheriv(ALGORITHM, this.getKey(), Buffer.from(record.iv, 'base64'));
      decipher.setAuthTag(Buffer.from(record.authTag, 'base64'));
      return Buffer.concat([decipher.update(Buffer.from(record.ciphertext, 'base64')), decipher.final()]).toString('utf8');
    } catch {
      throw new ServiceUnavailableException('This health record cannot be opened with the configured encryption key.');
    }
  }

  private getKey() {
    const configured = this.config.get<string>('RECORD_ENCRYPTION_KEY', '');
    if (configured) {
      const key = Buffer.from(configured, 'base64');
      if (key.length === KEY_BYTES && key.toString('base64') === configured) return key;
      throw new ServiceUnavailableException('The health record encryption key is misconfigured.');
    }

    const appEnv = this.config.get<string>('APP_ENV', 'development');
    const accessSecret = this.config.get<string>('ACCESS_TOKEN_SECRET', '');
    if (appEnv === 'production' || accessSecret.length < 32) {
      throw new ServiceUnavailableException('Health record encryption is not configured.');
    }
    return createHash('sha256').update(`medknot-development-record-key-v1:${accessSecret}`).digest();
  }
}
