import { createHash } from 'node:crypto';
import { BadRequestException, ConflictException } from '@nestjs/common';
import type { DatabaseService } from '../database/database.service.js';
import { AppointmentsService } from './appointments.service.js';
import type { BookAppointmentDto } from './dto/book-appointment.dto.js';

function appointmentRecord(patientProfileId: string, idempotencyHash: string) {
  const now = new Date();
  return {
    id: 'appointment-id',
    patientProfileId,
    doctorProfileId: 'doctor-id',
    slotId: 'slot-id',
    idempotencyKey: 'a20db14e-253f-4868-bf2e-69a3bc80aa33',
    idempotencyHash,
    consultationMode: 'IN_PERSON',
    status: 'CONFIRMED',
    createdAt: now,
    patientProfile: { id: patientProfileId, user: { fullName: 'Patient One' } },
    doctorProfile: {
      id: 'doctor-id',
      user: { fullName: 'Doctor One' },
      hospital: { id: 'hospital-id', name: 'Verified Hospital', city: 'Pune', addressLine1: 'Main Road', phone: null },
      department: { id: 'department-id', name: 'Cardiology' },
      specialty: { id: 'specialty-id', name: 'Cardiology' },
    },
    slot: { id: 'slot-id', startAt: new Date(now.getTime() + 86_400_000), endAt: new Date(now.getTime() + 86_490_000), timezone: 'Asia/Kolkata' },
    history: [{ event: 'BOOKED', fromStatus: null, toStatus: 'CONFIRMED', createdAt: now }],
  };
}

function bookingInput(): BookAppointmentDto {
  return { doctorId: 'doctor-id', slotId: 'slot-id', idempotencyKey: 'a20db14e-253f-4868-bf2e-69a3bc80aa33', consultationMode: 'IN_PERSON' };
}

describe('AppointmentsService', () => {
  const requestHash = createHash('sha256').update('patient-profile:doctor-id:slot-id:IN_PERSON').digest('hex');

  it('claims an available slot before creating a confirmed appointment in the same transaction', async () => {
    const order: string[] = [];
    const record = appointmentRecord('patient-profile', requestHash);
    const transaction = {
      appointment: {
        findUnique: async () => null,
        create: async () => { order.push('appointment'); return record; },
      },
      doctorProfile: { findFirst: async () => ({ id: 'doctor-id', onlineConsultation: false }) },
      doctorAvailabilitySlot: {
        findFirst: async () => ({ id: 'slot-id' }),
        updateMany: async () => { order.push('claim-slot'); return { count: 1 }; },
      },
      auditLog: { create: async () => undefined },
    };
    const database = {
      patientProfile: { findUnique: async () => ({ id: 'patient-profile' }) },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(transaction),
    } as unknown as DatabaseService;
    const service = new AppointmentsService(database, { get: () => 'none' } as never);

    const result = await service.book('patient-user', bookingInput());

    expect(order).toEqual(['claim-slot', 'appointment']);
    expect(result).toMatchObject({ id: 'appointment-id', status: 'CONFIRMED', consultationMode: 'IN_PERSON' });
  });

  it('rejects a concurrent request after the conditional slot claim loses', async () => {
    const transaction = {
      appointment: { findUnique: async () => null, create: async () => { throw new Error('must not create'); } },
      doctorProfile: { findFirst: async () => ({ id: 'doctor-id', onlineConsultation: false }) },
      doctorAvailabilitySlot: { findFirst: async () => ({ id: 'slot-id' }), updateMany: async () => ({ count: 0 }) },
    };
    const database = {
      patientProfile: { findUnique: async () => ({ id: 'patient-profile' }) },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(transaction),
    } as unknown as DatabaseService;
    const service = new AppointmentsService(database, { get: () => 'none' } as never);

    await expect(service.book('patient-user', bookingInput())).rejects.toBeInstanceOf(ConflictException);
  });

  it('replays an identical idempotency key without reserving the slot again', async () => {
    const record = appointmentRecord('patient-profile', requestHash);
    const database = {
      patientProfile: { findUnique: async () => ({ id: 'patient-profile' }) },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({ appointment: { findUnique: async () => record } }),
    } as unknown as DatabaseService;
    const service = new AppointmentsService(database, { get: () => 'none' } as never);

    await expect(service.book('patient-user', bookingInput())).resolves.toMatchObject({ id: 'appointment-id', status: 'CONFIRMED' });
  });

  it('rejects overlapping windows submitted in the same availability batch', async () => {
    const transaction = { doctorProfile: { findFirst: async () => ({ id: 'doctor-id' }) } };
    const database = { $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(transaction) } as unknown as DatabaseService;
    const service = new AppointmentsService(database, { get: () => 'none' } as never);
    const start = Date.now() + 86_400_000;
    const input = { slots: [
      { startAt: new Date(start).toISOString(), endAt: new Date(start + 3_600_000).toISOString(), timezone: 'UTC' },
      { startAt: new Date(start + 1_800_000).toISOString(), endAt: new Date(start + 5_400_000).toISOString(), timezone: 'UTC' },
    ] };

    await expect(service.createDoctorSlots('hospital-id', 'doctor-id', input, 'admin-id')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('locks a doctor schedule and rejects windows that overlap persisted slots', async () => {
    const start = Date.now() + 86_400_000;
    const calls: string[] = [];
    const transaction = {
      doctorProfile: { findFirst: async () => ({ id: 'doctor-id' }) },
      $queryRaw: async () => { calls.push('schedule-lock'); return [{}]; },
      doctorAvailabilitySlot: {
        findMany: async () => { calls.push('existing-slots'); return [{ startAt: new Date(start), endAt: new Date(start + 3_600_000) }]; },
      },
    };
    const database = { $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(transaction) } as unknown as DatabaseService;
    const service = new AppointmentsService(database, { get: () => 'none' } as never);
    const input = { slots: [{ startAt: new Date(start + 1_800_000).toISOString(), endAt: new Date(start + 5_400_000).toISOString(), timezone: 'UTC' }] };

    await expect(service.createDoctorSlots('hospital-id', 'doctor-id', input, 'admin-id')).rejects.toBeInstanceOf(ConflictException);
    expect(calls).toEqual(['schedule-lock', 'existing-slots']);
  });
});
