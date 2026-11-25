import { NotFoundException } from '@nestjs/common';
import type { DatabaseService } from '../database/database.service.js';
import { ClinicalRecordsCrypto } from './clinical-records.crypto.js';
import { ClinicalRecordsService } from './clinical-records.service.js';

describe('ClinicalRecordsService', () => {
  const secret = Buffer.alloc(32, 9).toString('base64');
  const crypto = new ClinicalRecordsCrypto({ get: (name: string) => name === 'RECORD_ENCRYPTION_KEY' ? secret : 'test' } as never);

  it('returns only released records from the patient profile and audits collection access', async () => {
    const encrypted = crypto.encrypt(JSON.stringify({ title: 'Visit question', content: 'Ask about recurring headaches.' }));
    const queryArgs: unknown[] = [];
    const auditArgs: unknown[] = [];
    const record = { id: 'record-id', type: 'PATIENT_NOTE', origin: 'PATIENT_ENTERED', status: 'RELEASED', ...encrypted, author: { fullName: 'Patient One' }, hospital: null, createdAt: new Date('2026-01-01T00:00:00Z'), releasedAt: new Date('2026-01-01T00:00:00Z') };
    const transaction = {
      patientProfile: { findUnique: async () => ({ id: 'patient-profile-id' }) },
      clinicalRecord: { findMany: async (args: unknown) => { queryArgs.push(args); return [record]; } },
      auditLog: { create: async (args: unknown) => { auditArgs.push(args); } },
    };
    const database = { $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(transaction) } as unknown as DatabaseService;
    const service = new ClinicalRecordsService(database, crypto);

    const result = await service.listPatientRecords('patient-user-id');

    expect(queryArgs[0]).toMatchObject({ where: { patientProfileId: 'patient-profile-id', status: 'RELEASED' }, take: 100 });
    expect(result.items[0]).toMatchObject({ id: 'record-id', title: 'Visit question', content: 'Ask about recurring headaches.' });
    expect(auditArgs[0]).toMatchObject({ data: { actorId: 'patient-user-id', action: 'clinical_record.patient.listed' } });
  });

  it('does not disclose a record that is not owned by the caller', async () => {
    const audits: unknown[] = [];
    const transaction = {
      clinicalRecord: { findFirst: async () => null },
      auditLog: { create: async (args: unknown) => { audits.push(args); } },
    };
    const database = { $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(transaction) } as unknown as DatabaseService;
    const service = new ClinicalRecordsService(database, crypto);

    await expect(service.getPatientRecord('patient-user-id', 'other-patient-record-id')).rejects.toBeInstanceOf(NotFoundException);
    expect(audits).toHaveLength(0);
  });
});
