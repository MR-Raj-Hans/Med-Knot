import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { DatabaseService } from '../database/database.service.js';
import { ClinicalRecordsCrypto } from './clinical-records.crypto.js';
import type { CreatePrescriptionDto } from './dto/create-prescription.dto.js';

const prescriptionDisplay = {
  author: { select: { fullName: true } },
  hospital: { select: { name: true } },
} satisfies Prisma.PrescriptionInclude;

@Injectable()
export class PrescriptionsService {
  constructor(private readonly database: DatabaseService, private readonly crypto: ClinicalRecordsCrypto) {}

  async listPatientPrescriptions(userId: string) {
    const prescriptions = await this.database.$transaction(async (tx) => {
      const patient = await tx.patientProfile.findUnique({ where: { userId }, select: { id: true } });
      if (!patient) throw new NotFoundException('Patient profile not found.');
      const items = await tx.prescription.findMany({ where: { patientProfileId: patient.id, status: 'RELEASED' }, include: prescriptionDisplay, orderBy: [{ releasedAt: 'desc' }, { createdAt: 'desc' }], take: 100 });
      await tx.auditLog.create({ data: { actorId: userId, action: 'prescription.patient.listed', targetType: 'PatientProfile', targetId: patient.id, metadata: { count: items.length } } });
      return items;
    });
    return { items: prescriptions.map((item) => this.toResponse(item)), hasMore: prescriptions.length === 100 };
  }

  async getPatientPrescription(userId: string, prescriptionId: string) {
    const prescription = await this.database.$transaction(async (tx) => {
      const item = await tx.prescription.findFirst({ where: { id: prescriptionId, status: 'RELEASED', patientProfile: { userId } }, include: prescriptionDisplay });
      if (!item) throw new NotFoundException('Prescription not found.');
      await tx.auditLog.create({ data: { actorId: userId, action: 'prescription.patient.viewed', targetType: 'Prescription', targetId: item.id } });
      return item;
    });
    return this.toResponse(prescription);
  }

  async createClinicianDraft(hospitalId: string, appointmentId: string, userId: string, input: CreatePrescriptionDto, requestId?: string) {
    const contents = normalizePrescription(input);
    const encrypted = this.crypto.encrypt(JSON.stringify(contents));
    const prescription = await this.database.$transaction(async (tx) => {
      const doctor = await this.getActiveClinician(tx, hospitalId, userId);
      const appointment = await tx.appointment.findFirst({
        where: { id: appointmentId, doctorProfileId: doctor.id, status: 'COMPLETED', slot: { endAt: { lte: new Date() } } },
        select: { id: true, patientProfileId: true, doctorProfile: { select: { hospitalId: true } } },
      });
      if (!appointment) throw new NotFoundException('Completed appointment not found.');
      const created = await tx.prescription.create({
        data: { patientProfileId: appointment.patientProfileId, authorId: userId, hospitalId: appointment.doctorProfile.hospitalId, appointmentId: appointment.id, status: 'DRAFT', ...encrypted },
        include: prescriptionDisplay,
      });
      await tx.auditLog.create({ data: { actorId: userId, action: 'prescription.clinician_draft.created', targetType: 'Prescription', targetId: created.id, requestId, metadata: { appointmentId } } });
      return created;
    });
    return this.toResponse(prescription);
  }

  async releaseClinicianDraft(hospitalId: string, prescriptionId: string, userId: string, requestId?: string) {
    const prescription = await this.database.$transaction(async (tx) => {
      const doctor = await this.getActiveClinician(tx, hospitalId, userId);
      const draft = await tx.prescription.findFirst({
        where: { id: prescriptionId, authorId: userId, hospitalId, status: 'DRAFT', appointment: { doctorProfileId: doctor.id, status: 'COMPLETED', slot: { endAt: { lte: new Date() } } } },
      });
      if (!draft) throw new NotFoundException('Your draft prescription was not found.');
      const changed = await tx.prescription.updateMany({ where: { id: draft.id, status: 'DRAFT', authorId: userId }, data: { status: 'RELEASED', releasedAt: new Date() } });
      if (!changed.count) throw new ConflictException('This prescription has already changed. Refresh and try again.');
      await tx.auditLog.create({ data: { actorId: userId, action: 'prescription.clinician_draft.released', targetType: 'Prescription', targetId: draft.id, requestId } });
      return tx.prescription.findUniqueOrThrow({ where: { id: draft.id }, include: prescriptionDisplay });
    });
    return this.toResponse(prescription);
  }

  private async getActiveClinician(client: Prisma.TransactionClient, hospitalId: string, userId: string) {
    const doctor = await client.doctorProfile.findFirst({
      where: { userId, hospitalId, verificationStatus: 'APPROVED', user: { status: 'ACTIVE' }, hospital: { status: 'ACTIVE', verificationStatus: 'APPROVED' } },
      select: { id: true },
    });
    const membership = await client.hospitalMembership.findUnique({ where: { userId_hospitalId: { userId, hospitalId } }, select: { status: true } });
    if (!doctor || membership?.status !== 'ACTIVE') throw new NotFoundException('No active approved clinician membership was found.');
    return doctor;
  }

  private toResponse(prescription: Prisma.PrescriptionGetPayload<{ include: typeof prescriptionDisplay }>) {
    let payload: ReturnType<typeof normalizePrescription>;
    try {
      payload = JSON.parse(this.crypto.decrypt(prescription)) as ReturnType<typeof normalizePrescription>;
      if (!Array.isArray(payload.medications) || payload.medications.length === 0 || typeof payload.instructions !== 'string') throw new Error('Invalid encrypted prescription payload.');
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('This health record')) throw error;
      throw new ConflictException('This prescription has an unsupported encrypted payload.');
    }
    return { id: prescription.id, status: prescription.status, medications: payload.medications, instructions: payload.instructions, authorName: prescription.author.fullName, hospitalName: prescription.hospital.name, createdAt: prescription.createdAt, releasedAt: prescription.releasedAt };
  }
}

function normalizePrescription(input: CreatePrescriptionDto) {
  if (!input.medications?.length) throw new BadRequestException('Add at least one medication entry.');
  return {
    medications: input.medications.map((item) => {
      const medication = {
        medicineName: item.medicineName.trim(),
        strength: item.strength?.trim() ?? '',
        dosage: item.dosage.trim(),
        route: item.route?.trim() ?? '',
        frequency: item.frequency.trim(),
        duration: item.duration?.trim() ?? '',
        quantity: item.quantity?.trim() ?? '',
        refills: item.refills ?? 0,
      };
      if (!medication.medicineName || !medication.dosage || !medication.frequency) throw new BadRequestException('Each medication needs a name, dosage and frequency.');
      return medication;
    }),
    instructions: input.instructions?.trim() ?? '',
  };
}
