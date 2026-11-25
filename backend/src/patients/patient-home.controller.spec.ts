import type { DatabaseService } from '../database/database.service.js';
import { PatientHomeController } from './patient-home.controller.js';

describe('PatientHomeController', () => {
  it('loads an upcoming appointment and released prescription count from the authenticated patient profile', async () => {
    const appointmentArgs: unknown[] = [];
    const prescriptionCountArgs: unknown[] = [];
    const auditArgs: unknown[] = [];
    const startAt = new Date('2026-12-08T05:00:00Z');
    const transaction = {
      appointment: { findFirst: async (args: unknown) => { appointmentArgs.push(args); return { id: 'appointment-id', slot: { startAt, endAt: new Date('2026-12-08T05:30:00Z'), timezone: 'Asia/Kolkata' }, doctorProfile: { user: { fullName: 'Dr. Aisha Menon' }, specialty: { name: 'Cardiology' }, hospital: { name: 'Verified Hospital' } } }; } },
      prescription: { count: async (args: unknown) => { prescriptionCountArgs.push(args); return 2; } },
      auditLog: { create: async (args: unknown) => { auditArgs.push(args); } },
    };
    const database = {
      user: { findUnique: async () => ({ fullName: 'Raj Hans', patientProfile: { id: 'patient-profile-id' } }) },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(transaction),
    } as unknown as DatabaseService;
    const controller = new PatientHomeController(database);

    const summary = await controller.home({ id: 'patient-user-id' } as never);

    expect(appointmentArgs[0]).toMatchObject({ where: { patientProfileId: 'patient-profile-id', status: 'CONFIRMED' } });
    expect(prescriptionCountArgs[0]).toMatchObject({ where: { patientProfileId: 'patient-profile-id', status: 'RELEASED' } });
    expect(summary).toMatchObject({ patientName: 'Raj Hans', prescriptionCount: 2, nextAppointment: { id: 'appointment-id', doctorName: 'Dr. Aisha Menon', specialty: 'Cardiology', status: 'confirmed' } });
    expect(auditArgs[0]).toMatchObject({ data: { actorId: 'patient-user-id', action: 'patient.home.viewed' } });
  });
});
