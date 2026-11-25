import { createHash } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type DoctorAvailabilitySlot } from '../generated/prisma/client.js';
import { DatabaseService } from '../database/database.service.js';
import type { AvailabilityQueryDto } from './dto/availability-query.dto.js';
import type { BookAppointmentDto } from './dto/book-appointment.dto.js';
import type { ChangeAppointmentDto } from './dto/change-appointment.dto.js';
import type { AvailabilitySlotInputDto, ManageSlotsDto } from './dto/manage-slots.dto.js';
import type { AppointmentsQueryDto } from './dto/appointments-query.dto.js';

@Injectable()
export class AppointmentsService {
  constructor(private readonly database: DatabaseService, private readonly config: ConfigService) {}

  async listAvailability(doctorId: string, query: AvailabilityQueryDto) {
    const now = new Date();
    const from = query.from ? new Date(query.from) : now;
    const to = query.to ? new Date(query.to) : new Date(from.getTime() + 30 * 86_400_000);
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from || to.getTime() - from.getTime() > 31 * 86_400_000) {
      throw new BadRequestException('Choose a valid availability window of 31 days or less.');
    }
    const doctor = await this.database.doctorProfile.findFirst({
      where: { id: doctorId, verificationStatus: 'APPROVED', user: { status: 'ACTIVE' }, hospital: { status: 'ACTIVE', verificationStatus: 'APPROVED' }, department: { isActive: true } },
      select: { id: true, user: { select: { fullName: true } }, hospital: { select: { name: true, city: true } }, department: { select: { name: true } }, specialty: { select: { name: true } }, onlineConsultation: true },
    });
    if (!doctor) throw new NotFoundException('Verified doctor not found.');
    const items = await this.database.doctorAvailabilitySlot.findMany({
      where: { doctorProfileId: doctor.id, status: 'AVAILABLE', startAt: { gte: from > now ? from : now, lt: to }, endAt: { gt: now } },
      select: { id: true, startAt: true, endAt: true, timezone: true },
      orderBy: { startAt: 'asc' },
      take: 201,
    });
    return { doctor: { id: doctor.id, fullName: doctor.user.fullName, hospital: doctor.hospital, department: doctor.department, specialty: doctor.specialty, onlineConsultation: doctor.onlineConsultation }, items: items.slice(0, 200), hasMore: items.length > 200 };
  }

  async createDoctorSlots(hospitalId: string, doctorId: string, input: ManageSlotsDto, actorId: string, requestId?: string) {
    return this.database.$transaction(async (tx) => {
      const doctor = await tx.doctorProfile.findFirst({
        where: { id: doctorId, hospitalId, verificationStatus: 'APPROVED', hospital: { status: 'ACTIVE', verificationStatus: 'APPROVED' }, department: { isActive: true } },
        select: { id: true },
      });
      if (!doctor) throw new NotFoundException('Approved doctor not found in this hospital.');
      const slots = await this.insertSlots(tx, doctor.id, input.slots);
      await tx.auditLog.create({ data: { actorId, action: 'appointment.availability.created', targetType: 'DoctorProfile', targetId: doctor.id, requestId, metadata: { count: slots.length, hospitalId } } });
      return { items: slots };
    });
  }

  async acceptHospitalInvite(hospitalId: string, userId: string, requestId?: string) {
    return this.database.$transaction(async (tx) => {
      const doctor = await tx.doctorProfile.findFirst({
        where: { userId, hospitalId, verificationStatus: 'APPROVED', hospital: { status: 'ACTIVE', verificationStatus: 'APPROVED' } },
        select: { id: true },
      });
      if (!doctor) throw new NotFoundException('An approved doctor invitation was not found.');
      const membership = await tx.hospitalMembership.findUnique({ where: { userId_hospitalId: { userId, hospitalId } } });
      if (!membership || membership.status === 'SUSPENDED') throw new ConflictException('This hospital membership cannot be activated.');
      if (membership.status === 'ACTIVE') return { accepted: true };
      await tx.hospitalMembership.update({ where: { userId_hospitalId: { userId, hospitalId } }, data: { status: 'ACTIVE' } });
      await tx.auditLog.create({ data: { actorId: userId, action: 'hospital.membership.accepted', targetType: 'HospitalMembership', targetId: hospitalId, requestId } });
      return { accepted: true };
    });
  }

  async createMySlots(hospitalId: string, userId: string, input: ManageSlotsDto, requestId?: string) {
    return this.database.$transaction(async (tx) => {
      const doctor = await tx.doctorProfile.findFirst({
        where: { userId, hospitalId, verificationStatus: 'APPROVED', hospital: { status: 'ACTIVE', verificationStatus: 'APPROVED' }, user: { status: 'ACTIVE' } },
        select: { id: true },
      });
      const membership = await tx.hospitalMembership.findUnique({ where: { userId_hospitalId: { userId, hospitalId } }, select: { status: true } });
      if (!doctor || membership?.status !== 'ACTIVE') throw new NotFoundException('No active approved doctor membership was found.');
      const slots = await this.insertSlots(tx, doctor.id, input.slots);
      await tx.auditLog.create({ data: { actorId: userId, action: 'appointment.availability.created', targetType: 'DoctorProfile', targetId: doctor.id, requestId, metadata: { count: slots.length, hospitalId } } });
      return { items: slots };
    });
  }

  async changeMySlot(hospitalId: string, slotId: string, userId: string, action: 'block' | 'restore', requestId?: string) {
    return this.database.$transaction(async (tx) => {
      const slot = await tx.doctorAvailabilitySlot.findFirst({ where: { id: slotId, doctorProfile: { userId, hospitalId, verificationStatus: 'APPROVED' } } });
      const membership = await tx.hospitalMembership.findUnique({ where: { userId_hospitalId: { userId, hospitalId } }, select: { status: true } });
      if (!slot || membership?.status !== 'ACTIVE') throw new NotFoundException('Availability slot not found.');
      if (slot.startAt <= new Date()) throw new ConflictException('Past availability cannot be changed.');
      if (!['AVAILABLE', 'BLOCKED'].includes(slot.status)) throw new ConflictException('A booked slot cannot be changed.');
      const status = action === 'block' ? 'BLOCKED' : 'AVAILABLE';
      const updated = await tx.doctorAvailabilitySlot.updateMany({ where: { id: slot.id, status: slot.status }, data: { status } });
      if (!updated.count) throw new ConflictException('Availability changed. Refresh and try again.');
      await tx.auditLog.create({ data: { actorId: userId, action: `appointment.availability.${action === 'block' ? 'blocked' : 'restored'}`, targetType: 'DoctorAvailabilitySlot', targetId: slot.id, requestId, metadata: { hospitalId } } });
      return { id: slot.id, status };
    });
  }

  async book(userId: string, input: BookAppointmentDto, requestId?: string) {
    const patient = await this.database.patientProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!patient) throw new NotFoundException('Patient profile not found.');
    const requestHash = createHash('sha256').update(`${patient.id}:${input.doctorId}:${input.slotId}:${input.consultationMode}`).digest('hex');
    try {
      const appointment = await this.database.$transaction(async (tx) => {
        const prior = await tx.appointment.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: appointmentInclude });
        if (prior) {
          if (prior.patientProfileId !== patient.id || prior.idempotencyHash !== requestHash) throw new ConflictException('That idempotency key was already used for a different appointment request.');
          return prior;
        }
        const doctor = await tx.doctorProfile.findFirst({
          where: { id: input.doctorId, verificationStatus: 'APPROVED', user: { status: 'ACTIVE' }, hospital: { status: 'ACTIVE', verificationStatus: 'APPROVED' }, department: { isActive: true }, specialty: { isActive: true } },
          select: { id: true, onlineConsultation: true },
        });
        if (!doctor) throw new NotFoundException('Verified doctor not found.');
        if (input.consultationMode === 'ONLINE_VIDEO') {
          if (!doctor.onlineConsultation) throw new ConflictException('Online consultation is not enabled for this doctor.');
          if (this.config.get<string>('VIDEO_PROVIDER', 'none') === 'none') throw new ServiceUnavailableException('Online consultations are not available until a video provider is configured.');
          throw new ServiceUnavailableException('Online consultation booking is not enabled on this service yet.');
        }
        const slot = await tx.doctorAvailabilitySlot.findFirst({ where: { id: input.slotId, doctorProfileId: doctor.id, status: 'AVAILABLE', startAt: { gt: new Date() }, endAt: { gt: new Date() } } });
        if (!slot) throw new ConflictException('That appointment slot is no longer available. Refresh the doctor availability and choose another time.');
        const claimed = await tx.doctorAvailabilitySlot.updateMany({ where: { id: slot.id, status: 'AVAILABLE', startAt: { gt: new Date() } }, data: { status: 'BOOKED' } });
        if (!claimed.count) throw new ConflictException('That appointment slot is no longer available.');
        const created = await tx.appointment.create({ data: {
          patientProfileId: patient.id,
          doctorProfileId: doctor.id,
          slotId: slot.id,
          activeSlotId: slot.id,
          idempotencyKey: input.idempotencyKey,
          idempotencyHash: requestHash,
          consultationMode: input.consultationMode,
          status: 'CONFIRMED',
          history: { create: { actorId: userId, event: 'BOOKED', fromStatus: null, toStatus: 'CONFIRMED', toSlotId: slot.id, toSlotStartAt: slot.startAt } },
        }, include: appointmentInclude });
        await tx.auditLog.create({ data: { actorId: userId, action: 'appointment.booked', targetType: 'Appointment', targetId: created.id, requestId, metadata: { consultationMode: created.consultationMode, doctorProfileId: doctor.id } } });
        return created;
      });
      return toAppointmentResponse(appointment);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const prior = await this.database.appointment.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: appointmentInclude });
        if (prior && prior.patientProfileId === patient.id && prior.idempotencyHash === requestHash) return toAppointmentResponse(prior);
        if (prior) throw new ConflictException('That idempotency key was already used for a different appointment request.');
        throw new ConflictException('That appointment slot is no longer available.');
      }
      throw error;
    }
  }

  async listPatientAppointments(userId: string, query: AppointmentsQueryDto) {
    const [records, total] = await Promise.all([
      this.database.appointment.findMany({ where: { patientProfile: { userId }, ...(query.status ? { status: query.status } : {}) }, include: appointmentInclude, orderBy: [{ slot: { startAt: 'asc' } }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.database.appointment.count({ where: { patientProfile: { userId }, ...(query.status ? { status: query.status } : {}) } }),
    ]);
    return { items: records.map(toAppointmentResponse), page: query.page, pageSize: query.pageSize, total };
  }

  async listMyAppointments(hospitalId: string, userId: string, query: AppointmentsQueryDto) {
    const doctor = await this.getActiveClinician(hospitalId, userId);
    const where: Prisma.AppointmentWhereInput = {
      doctorProfileId: doctor.id,
      ...(query.status ? { status: query.status } : { status: { in: ['CONFIRMED', 'COMPLETED'] } }),
    };
    const [items, total] = await Promise.all([
      this.database.appointment.findMany({ where, include: clinicianAppointmentInclude, orderBy: [{ slot: { startAt: 'desc' } }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.database.appointment.count({ where }),
    ]);
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async completeMyAppointment(hospitalId: string, appointmentId: string, userId: string, requestId?: string) {
    return this.database.$transaction(async (tx) => {
      const doctor = await this.getActiveClinician(hospitalId, userId, tx);
      const appointment = await tx.appointment.findFirst({
        where: { id: appointmentId, doctorProfileId: doctor.id },
        include: { slot: { select: { id: true, startAt: true, endAt: true } } },
      });
      if (!appointment) throw new NotFoundException('Appointment not found.');
      if (appointment.status !== 'CONFIRMED') throw new ConflictException('Only confirmed appointments can be completed.');
      if (appointment.slot.endAt > new Date()) throw new ConflictException('An appointment can only be completed after its scheduled end time.');
      const updated = await tx.appointment.updateMany({ where: { id: appointment.id, doctorProfileId: doctor.id, status: 'CONFIRMED' }, data: { status: 'COMPLETED' } });
      if (!updated.count) throw new ConflictException('Appointment status changed. Refresh and try again.');
      await tx.appointmentStatusHistory.create({ data: { appointmentId: appointment.id, actorId: userId, event: 'COMPLETED', fromStatus: 'CONFIRMED', toStatus: 'COMPLETED', fromSlotId: appointment.slotId, fromSlotStartAt: appointment.slot.startAt } });
      await tx.auditLog.create({ data: { actorId: userId, action: 'appointment.completed', targetType: 'Appointment', targetId: appointment.id, requestId } });
      return tx.appointment.findUniqueOrThrow({ where: { id: appointment.id }, include: clinicianAppointmentInclude });
    });
  }

  async getPatientAppointment(userId: string, appointmentId: string) {
    const appointment = await this.database.appointment.findFirst({ where: { id: appointmentId, patientProfile: { userId } }, include: appointmentInclude });
    if (!appointment) throw new NotFoundException('Appointment not found.');
    return toAppointmentResponse(appointment);
  }

  async changePatientAppointment(userId: string, appointmentId: string, input: ChangeAppointmentDto, requestId?: string) {
    if (input.action === 'reschedule' && !input.newSlotId) throw new BadRequestException('Choose a new appointment slot to reschedule.');
    if (input.action === 'cancel' && input.newSlotId) throw new BadRequestException('A new slot is only valid for rescheduling.');
    return this.database.$transaction(async (tx) => {
      const appointment = await tx.appointment.findFirst({ where: { id: appointmentId, patientProfile: { userId } }, include: { slot: true } });
      if (!appointment) throw new NotFoundException('Appointment not found.');
      if (appointment.status !== 'CONFIRMED') throw new ConflictException('Only confirmed appointments can be changed.');
      if (appointment.slot.startAt <= new Date()) throw new ConflictException('An appointment that has started cannot be changed.');

      if (input.action === 'cancel') {
        const released = await tx.doctorAvailabilitySlot.updateMany({ where: { id: appointment.slotId, status: 'BOOKED' }, data: { status: 'AVAILABLE' } });
        if (!released.count) throw new ConflictException('The booked slot could not be released. Contact support.');
        await tx.appointment.update({ where: { id: appointment.id }, data: { status: 'CANCELLED', activeSlotId: null, history: { create: { actorId: userId, event: 'CANCELLED', fromStatus: 'CONFIRMED', toStatus: 'CANCELLED', fromSlotId: appointment.slotId, fromSlotStartAt: appointment.slot.startAt } } } });
        await tx.auditLog.create({ data: { actorId: userId, action: 'appointment.cancelled', targetType: 'Appointment', targetId: appointment.id, requestId } });
      } else {
        const nextSlot = await tx.doctorAvailabilitySlot.findFirst({ where: { id: input.newSlotId!, doctorProfileId: appointment.doctorProfileId, status: 'AVAILABLE', startAt: { gt: new Date() }, endAt: { gt: new Date() } } });
        if (!nextSlot) throw new ConflictException('Choose an available future slot with the same doctor.');
        const claimed = await tx.doctorAvailabilitySlot.updateMany({ where: { id: nextSlot.id, status: 'AVAILABLE', startAt: { gt: new Date() } }, data: { status: 'BOOKED' } });
        if (!claimed.count) throw new ConflictException('That appointment slot is no longer available.');
        const released = await tx.doctorAvailabilitySlot.updateMany({ where: { id: appointment.slotId, status: 'BOOKED' }, data: { status: 'AVAILABLE' } });
        if (!released.count) throw new ConflictException('The current appointment slot could not be released. Contact support.');
        await tx.appointment.update({
          where: { id: appointment.id },
          data: { slotId: nextSlot.id, activeSlotId: nextSlot.id, history: { create: { actorId: userId, event: 'RESCHEDULED', fromStatus: 'CONFIRMED', toStatus: 'CONFIRMED', fromSlotId: appointment.slotId, toSlotId: nextSlot.id, fromSlotStartAt: appointment.slot.startAt, toSlotStartAt: nextSlot.startAt } } },
        });
        await tx.auditLog.create({ data: { actorId: userId, action: 'appointment.rescheduled', targetType: 'Appointment', targetId: appointment.id, requestId } });
      }
      const updated = await tx.appointment.findUniqueOrThrow({ where: { id: appointment.id }, include: appointmentInclude });
      return toAppointmentResponse(updated);
    });
  }

  private async insertSlots(tx: Prisma.TransactionClient, doctorId: string, rawSlots: AvailabilitySlotInputDto[]) {
    const slots = rawSlots.map((item) => {
      const startAt = new Date(item.startAt);
      const endAt = new Date(item.endAt);
      try { new Intl.DateTimeFormat('en', { timeZone: item.timezone ?? 'UTC' }); } catch { throw new BadRequestException('Use a valid IANA timezone.'); }
      if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()) || endAt <= startAt || startAt <= new Date()) {
        throw new BadRequestException('Availability slots must have a future start and an end after the start.');
      }
      return { startAt, endAt, timezone: item.timezone ?? 'UTC' };
    }).sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

    for (let index = 1; index < slots.length; index += 1) {
      if (slots[index - 1].endAt > slots[index].startAt) throw new BadRequestException('Availability slots cannot overlap.');
    }
    const minStart = slots[0].startAt;
    const maxEnd = slots.reduce((max, slot) => slot.endAt > max ? slot.endAt : max, slots[0].endAt);
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${doctorId}, 0))`);
    const existing = await tx.doctorAvailabilitySlot.findMany({ where: { doctorProfileId: doctorId, startAt: { lt: maxEnd }, endAt: { gt: minStart } }, select: { startAt: true, endAt: true } });
    if (slots.some((slot) => existing.some((saved) => saved.startAt < slot.endAt && saved.endAt > slot.startAt))) {
      throw new ConflictException('One or more availability slots overlap an existing slot.');
    }
    const created: DoctorAvailabilitySlot[] = [];
    for (const slot of slots) created.push(await tx.doctorAvailabilitySlot.create({ data: { doctorProfileId: doctorId, ...slot } }));
    return created;
  }

  private async getActiveClinician(hospitalId: string, userId: string, client: DatabaseService | Prisma.TransactionClient = this.database) {
    const doctor = await client.doctorProfile.findFirst({
      where: { userId, hospitalId, verificationStatus: 'APPROVED', user: { status: 'ACTIVE' }, hospital: { status: 'ACTIVE', verificationStatus: 'APPROVED' } },
      select: { id: true },
    });
    const membership = await client.hospitalMembership.findUnique({ where: { userId_hospitalId: { userId, hospitalId } }, select: { status: true } });
    if (!doctor || membership?.status !== 'ACTIVE') throw new NotFoundException('No active approved clinician membership was found.');
    return doctor;
  }
}

const appointmentInclude = {
  patientProfile: { select: { id: true, user: { select: { fullName: true } } } },
  doctorProfile: {
    select: {
      id: true,
      user: { select: { fullName: true } },
      hospital: { select: { id: true, name: true, city: true, addressLine1: true, phone: true } },
      department: { select: { id: true, name: true } },
      specialty: { select: { id: true, name: true } },
    },
  },
  slot: { select: { id: true, startAt: true, endAt: true, timezone: true } },
  history: { orderBy: { createdAt: 'asc' as const }, select: { event: true, fromStatus: true, toStatus: true, fromSlotId: true, toSlotId: true, fromSlotStartAt: true, toSlotStartAt: true, createdAt: true } },
} satisfies Prisma.AppointmentInclude;

const clinicianAppointmentInclude = {
  slot: { select: { id: true, startAt: true, endAt: true, timezone: true } },
  patientProfile: { select: { id: true, user: { select: { fullName: true } } } },
  doctorProfile: { select: { id: true, hospital: { select: { id: true, name: true } } } },
} satisfies Prisma.AppointmentInclude;

function toAppointmentResponse(appointment: Prisma.AppointmentGetPayload<{ include: typeof appointmentInclude }>) {
  return {
    id: appointment.id,
    status: appointment.status,
    consultationMode: appointment.consultationMode,
    createdAt: appointment.createdAt,
    patient: appointment.patientProfile.user,
    slot: appointment.slot,
    doctor: {
      id: appointment.doctorProfile.id,
      fullName: appointment.doctorProfile.user.fullName,
      hospital: appointment.doctorProfile.hospital,
      department: appointment.doctorProfile.department,
      specialty: appointment.doctorProfile.specialty,
    },
    history: appointment.history,
  };
}
