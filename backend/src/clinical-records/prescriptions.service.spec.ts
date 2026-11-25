import { NotFoundException } from '@nestjs/common';
import type { DatabaseService } from '../database/database.service.js';
import { ClinicalRecordsCrypto } from './clinical-records.crypto.js';
import { PrescriptionsService } from './prescriptions.service.js';

describe('PrescriptionsService', () => {
  const secret = Buffer.alloc(32, 4).toString('base64');
  const crypto = new ClinicalRecordsCrypto({ get: (name: string) => name === 'RECORD_ENCRYPTION_KEY' ? secret : 'test' } as never);

  it('stores clinician medication details encrypted and ties the draft to an eligible completed visit', async () => {
    const createArgs: { data: Record<string, unknown> }[] = [];
    const appointmentArgs: unknown[] = [];
    const timestamp = new Date('2026-01-01T00:00:00Z');
    const transaction = {
      doctorProfile: { findFirst: async () => ({ id: 'doctor-profile-id' }) },
      hospitalMembership: { findUnique: async () => ({ status: 'ACTIVE' }) },
      appointment: { findFirst: async (args: unknown) => { appointmentArgs.push(args); return { id: 'appointment-id', patientProfileId: 'patient-profile-id', doctorProfile: { hospitalId: 'hospital-id' } }; } },
      prescription: { create: async (args: { data: Record<string, unknown> }) => { createArgs.push(args); return { ...args.data, id: 'prescription-id', status: 'DRAFT', createdAt: timestamp, releasedAt: null, author: { fullName: 'Doctor One' }, hospital: { name: 'Verified Hospital' } }; } },
      auditLog: { create: async () => undefined },
    };
    const database = { $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(transaction) } as unknown as DatabaseService;
    const service = new PrescriptionsService(database, crypto);

    const result = await service.createClinicianDraft('hospital-id', 'appointment-id', 'doctor-user-id', {
      medications: [{ medicineName: 'Example medicine', strength: '10 mg', dosage: 'One tablet', route: 'oral', frequency: 'Once daily', duration: '5 days', quantity: '5', refills: 0 }],
      instructions: 'Follow the clinician’s directions.',
    });

    expect(appointmentArgs[0]).toMatchObject({ where: { doctorProfileId: 'doctor-profile-id', status: 'COMPLETED', slot: { endAt: { lte: expect.any(Date) } } } });
    expect(createArgs[0].data).toMatchObject({ patientProfileId: 'patient-profile-id', authorId: 'doctor-user-id', hospitalId: 'hospital-id', appointmentId: 'appointment-id', status: 'DRAFT' });
    expect(createArgs[0].data.ciphertext).not.toContain('Example medicine');
    expect(result).toMatchObject({ status: 'DRAFT', medications: [{ medicineName: 'Example medicine', dosage: 'One tablet' }] });
  });

  it('does not return prescriptions outside the patient ownership query', async () => {
    const queryArgs: unknown[] = [];
    const auditCalls: unknown[] = [];
    const transaction = {
      prescription: { findFirst: async (args: unknown) => { queryArgs.push(args); return null; } },
      auditLog: { create: async (args: unknown) => { auditCalls.push(args); } },
    };
    const database = { $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(transaction) } as unknown as DatabaseService;
    const service = new PrescriptionsService(database, crypto);

    await expect(service.getPatientPrescription('patient-user-id', 'other-patient-prescription-id')).rejects.toBeInstanceOf(NotFoundException);
    expect(queryArgs[0]).toMatchObject({ where: { id: 'other-patient-prescription-id', status: 'RELEASED', patientProfile: { userId: 'patient-user-id' } } });
    expect(auditCalls).toHaveLength(0);
  });
});
