import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { DatabaseService } from '../database/database.service.js';
import { ClinicalRecordsCrypto } from './clinical-records.crypto.js';
import type { CreateClinicalNoteDto } from './dto/create-clinical-note.dto.js';

const recordDisplay = {
  author: { select: { fullName: true } },
  hospital: { select: { name: true } },
} satisfies Prisma.ClinicalRecordInclude;

@Injectable()
export class ClinicalRecordsService {
  constructor(private readonly database: DatabaseService, private readonly crypto: ClinicalRecordsCrypto) {}

  async listPatientRecords(userId: string) {
    const result = await this.database.$transaction(async (tx) => {
      const patient = await tx.patientProfile.findUnique({ where: { userId }, select: { id: true } });
      if (!patient) throw new NotFoundException('Patient profile not found.');
      const records = await tx.clinicalRecord.findMany({
        where: { patientProfileId: patient.id, status: 'RELEASED' },
        include: recordDisplay,
        orderBy: [{ releasedAt: 'desc' }, { createdAt: 'desc' }],
        take: 100,
      });
      await tx.auditLog.create({ data: { actorId: userId, action: 'clinical_record.patient.listed', targetType: 'PatientProfile', targetId: patient.id, metadata: { count: records.length } } });
      return records;
    });
    return { items: result.map((record) => this.toResponse(record)), hasMore: result.length === 100 };
  }

  async getPatientRecord(userId: string, recordId: string) {
    const record = await this.database.$transaction(async (tx) => {
      const item = await tx.clinicalRecord.findFirst({
        where: { id: recordId, status: 'RELEASED', patientProfile: { userId } },
        include: recordDisplay,
      });
      if (!item) throw new NotFoundException('Health record not found.');
      await tx.auditLog.create({ data: { actorId: userId, action: 'clinical_record.patient.viewed', targetType: 'ClinicalRecord', targetId: item.id } });
      return item;
    });
    return this.toResponse(record);
  }

  async createPatientNote(userId: string, input: CreateClinicalNoteDto, requestId?: string) {
    const patient = await this.database.patientProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!patient) throw new NotFoundException('Patient profile not found.');
    const content = normalizeContent(input);
    const encrypted = this.crypto.encrypt(JSON.stringify(content));
    const record = await this.database.$transaction(async (tx) => {
      const created = await tx.clinicalRecord.create({
        data: {
          patientProfileId: patient.id,
          authorId: userId,
          type: 'PATIENT_NOTE',
          origin: 'PATIENT_ENTERED',
          status: 'RELEASED',
          ...encrypted,
          releasedAt: new Date(),
        },
        include: recordDisplay,
      });
      await tx.auditLog.create({ data: { actorId: userId, action: 'clinical_record.patient_note.created', targetType: 'ClinicalRecord', targetId: created.id, requestId } });
      return created;
    });
    return this.toResponse(record);
  }

  async createClinicianDraft(hospitalId: string, appointmentId: string, userId: string, input: CreateClinicalNoteDto, requestId?: string) {
    const content = normalizeContent(input);
    const encrypted = this.crypto.encrypt(JSON.stringify(content));
    try {
      const record = await this.database.$transaction(async (tx) => {
        const doctor = await this.getActiveClinician(tx, hospitalId, userId);
        const appointment = await tx.appointment.findFirst({
          where: { id: appointmentId, doctorProfileId: doctor.id, status: 'COMPLETED', slot: { endAt: { lte: new Date() } } },
          select: { id: true, patientProfileId: true, doctorProfile: { select: { hospitalId: true } } },
        });
        if (!appointment) throw new NotFoundException('Completed appointment not found.');
        const created = await tx.clinicalRecord.create({
          data: {
            patientProfileId: appointment.patientProfileId,
            authorId: userId,
            hospitalId: appointment.doctorProfile.hospitalId,
            appointmentId: appointment.id,
            type: 'CONSULTATION_NOTE',
            origin: 'CLINICIAN_AUTHORED',
            status: 'DRAFT',
            ...encrypted,
          },
          include: recordDisplay,
        });
        await tx.auditLog.create({ data: { actorId: userId, action: 'clinical_record.clinician_draft.created', targetType: 'ClinicalRecord', targetId: created.id, requestId, metadata: { appointmentId } } });
        return created;
      });
      return this.toResponse(record);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A consultation note already exists for this appointment.');
      }
      throw error;
    }
  }

  async releaseClinicianDraft(hospitalId: string, recordId: string, userId: string, requestId?: string) {
    const record = await this.database.$transaction(async (tx) => {
      const doctor = await this.getActiveClinician(tx, hospitalId, userId);
      const draft = await tx.clinicalRecord.findFirst({
        where: {
          id: recordId,
          authorId: userId,
          hospitalId,
          type: 'CONSULTATION_NOTE',
          status: 'DRAFT',
          appointment: { doctorProfileId: doctor.id, status: 'COMPLETED', slot: { endAt: { lte: new Date() } } },
        },
        include: recordDisplay,
      });
      if (!draft) throw new NotFoundException('Your draft consultation note was not found.');
      const changed = await tx.clinicalRecord.updateMany({ where: { id: draft.id, status: 'DRAFT', authorId: userId }, data: { status: 'RELEASED', releasedAt: new Date() } });
      if (!changed.count) throw new ConflictException('This note has already changed. Refresh and try again.');
      await tx.auditLog.create({ data: { actorId: userId, action: 'clinical_record.clinician_draft.released', targetType: 'ClinicalRecord', targetId: draft.id, requestId } });
      return tx.clinicalRecord.findUniqueOrThrow({ where: { id: draft.id }, include: recordDisplay });
    });
    return this.toResponse(record);
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

  private toResponse(record: Prisma.ClinicalRecordGetPayload<{ include: typeof recordDisplay }>) {
    let content: { title: string; content: string };
    try {
      content = JSON.parse(this.crypto.decrypt(record)) as { title: string; content: string };
      if (typeof content.title !== 'string' || typeof content.content !== 'string') throw new Error('Invalid clinical record payload.');
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('This health record')) throw error;
      throw new ConflictException('This health record has an unsupported encrypted payload.');
    }
    return {
      id: record.id,
      type: record.type,
      origin: record.origin,
      status: record.status,
      title: content.title,
      content: content.content,
      authorName: record.author.fullName,
      hospitalName: record.hospital?.name ?? null,
      createdAt: record.createdAt,
      releasedAt: record.releasedAt,
    };
  }
}

function normalizeContent(input: CreateClinicalNoteDto) {
  const title = input.title.trim();
  const content = input.content.trim();
  if (!title || !content) throw new BadRequestException('Enter a title and note content.');
  return { title, content };
}
