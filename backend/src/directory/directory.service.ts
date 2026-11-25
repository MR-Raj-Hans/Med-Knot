import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { DatabaseService } from '../database/database.service.js';
import type { CreateDoctorDto } from './dto/create-doctor.dto.js';
import type { CreateHospitalDto } from './dto/create-hospital.dto.js';
import type { CreateDepartmentDto } from './dto/create-department.dto.js';
import type { CreateSpecialtyDto } from './dto/create-specialty.dto.js';
import type { DirectoryQueryDto } from './dto/directory-query.dto.js';

type HospitalDistanceRow = {
  id: string;
  name: string;
  slug: string;
  addressLine1: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  phone: string | null;
  latitude: number;
  longitude: number;
  distanceKm: number;
};

const publicDoctorWhere: Prisma.DoctorProfileWhereInput = {
  verificationStatus: 'APPROVED',
  user: { status: 'ACTIVE' },
  hospital: { status: 'ACTIVE', verificationStatus: 'APPROVED' },
  department: { isActive: true },
  specialty: { isActive: true },
};

@Injectable()
export class DirectoryService {
  constructor(private readonly database: DatabaseService) {}

  async listHospitals(query: DirectoryQueryDto) {
    if ((query.latitude === undefined) !== (query.longitude === undefined)) {
      throw new BadRequestException('Provide both latitude and longitude for nearby search.');
    }
    if (query.latitude !== undefined && query.longitude !== undefined) {
      const records = await this.nearbyHospitals(query);
      const pageRecords = records.slice(0, query.pageSize);
      const departments = await this.departmentsForHospitals(pageRecords.map(({ id }) => id));
      const items = pageRecords.map((hospital) => ({ ...hospital, departments: departments.get(hospital.id) ?? [] }));
      return { items: items.map((hospital) => ({ ...hospital, distanceKm: roundDistance(Number(hospital.distanceKm)), verified: true })), page: query.page, pageSize: query.pageSize, hasMore: records.length > query.pageSize };
    }

    const search = query.search?.trim();
    const city = query.city?.trim();
    const where: Prisma.HospitalWhereInput = {
      status: 'ACTIVE',
      verificationStatus: 'APPROVED',
      ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { addressLine1: { contains: search, mode: 'insensitive' } }, { city: { contains: search, mode: 'insensitive' } }] } : {}),
      ...(city ? { city: { contains: city, mode: 'insensitive' } } : {}),
    };
    const records = await this.database.hospital.findMany({
      where,
      select: {
        id: true, name: true, slug: true, addressLine1: true, city: true, region: true, postalCode: true, country: true, phone: true, latitude: true, longitude: true,
        departments: { where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize + 1,
    });
    const hasMore = records.length > query.pageSize;
    return { items: records.slice(0, query.pageSize).map((hospital) => ({ ...hospital, verified: true })), page: query.page, pageSize: query.pageSize, hasMore };
  }

  async listDoctors(query: DirectoryQueryDto) {
    const where: Prisma.DoctorProfileWhereInput = {
      ...publicDoctorWhere,
      ...(query.specialtyId ? { specialtyId: query.specialtyId } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.hospitalId ? { hospitalId: query.hospitalId } : {}),
      ...(query.city?.trim() ? { hospital: { is: { status: 'ACTIVE' as const, verificationStatus: 'APPROVED' as const, city: { contains: query.city.trim(), mode: 'insensitive' as const } } } } : {}),
      ...(query.online === undefined ? {} : { onlineConsultation: query.online }),
      ...(query.search?.trim() ? {
        OR: [
          { user: { fullName: { contains: query.search.trim(), mode: 'insensitive' } } },
          { specialty: { name: { contains: query.search.trim(), mode: 'insensitive' } } },
          { department: { name: { contains: query.search.trim(), mode: 'insensitive' } } },
          { hospital: { name: { contains: query.search.trim(), mode: 'insensitive' } } },
        ],
      } : {}),
    };
    const records = await this.database.doctorProfile.findMany({
      where,
      include: doctorPublicInclude,
      orderBy: [{ user: { fullName: 'asc' } }, { id: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize + 1,
    });
    const hasMore = records.length > query.pageSize;
    return { items: records.slice(0, query.pageSize).map(toPublicDoctor), page: query.page, pageSize: query.pageSize, hasMore };
  }

  async getDoctor(doctorId: string) {
    const doctor = await this.database.doctorProfile.findFirst({ where: { id: doctorId, ...publicDoctorWhere }, include: doctorPublicInclude });
    if (!doctor) throw new NotFoundException('Verified doctor not found.');
    return toPublicDoctor(doctor);
  }

  listSpecialties() {
    return this.database.specialty.findMany({
      where: { isActive: true, doctors: { some: publicDoctorWhere } },
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });
  }

  async createHospital(input: CreateHospitalDto, actorId: string, requestId?: string) {
    assertCoordinates(input.latitude, input.longitude);
    return this.database.$transaction(async (tx) => {
      const hospital = await tx.hospital.create({
        data: { ...input, status: 'SUSPENDED', verificationStatus: 'PENDING' },
      });
      await tx.auditLog.create({ data: { actorId, action: 'directory.hospital.created', targetType: 'Hospital', targetId: hospital.id, requestId, metadata: { status: hospital.status, verificationStatus: hospital.verificationStatus } } });
      return hospital;
    });
  }

  async verifyHospital(hospitalId: string, action: 'approve' | 'reject', actorId: string, requestId?: string) {
    return this.database.$transaction(async (tx) => {
      const existing = await tx.hospital.findUnique({ where: { id: hospitalId }, select: { id: true } });
      if (!existing) throw new NotFoundException('Hospital not found.');
      const approved = action === 'approve';
      const hospital = await tx.hospital.update({
        where: { id: hospitalId },
        data: { verificationStatus: approved ? 'APPROVED' : 'REJECTED', status: approved ? 'ACTIVE' : 'SUSPENDED', verifiedAt: approved ? new Date() : null },
      });
      await tx.auditLog.create({ data: { actorId, action: `directory.hospital.${action === 'approve' ? 'approved' : 'rejected'}`, targetType: 'Hospital', targetId: hospital.id, requestId, metadata: { verificationStatus: hospital.verificationStatus } } });
      return hospital;
    });
  }

  async createDepartment(hospitalId: string, input: CreateDepartmentDto, actorId: string, requestId?: string) {
    return this.database.$transaction(async (tx) => {
      const hospital = await tx.hospital.findUnique({ where: { id: hospitalId }, select: { id: true } });
      if (!hospital) throw new NotFoundException('Hospital not found.');
      const department = await tx.department.create({ data: { hospitalId, name: input.name.trim(), slug: input.slug } });
      await tx.auditLog.create({ data: { actorId, action: 'directory.department.created', targetType: 'Department', targetId: department.id, requestId, metadata: { hospitalId } } });
      return department;
    });
  }

  async createSpecialty(input: CreateSpecialtyDto, actorId: string, requestId?: string) {
    return this.database.$transaction(async (tx) => {
      const specialty = await tx.specialty.create({ data: { name: input.name.trim(), slug: input.slug } });
      await tx.auditLog.create({ data: { actorId, action: 'directory.specialty.created', targetType: 'Specialty', targetId: specialty.id, requestId } });
      return specialty;
    });
  }

  async createDoctor(hospitalId: string, input: CreateDoctorDto, actorId: string, requestId?: string) {
    if ((input.consultationFeeMinor === undefined) !== (input.currency === undefined)) {
      throw new BadRequestException('Set both consultation fee and currency, or leave both unset.');
    }
    if (input.currency && !/^[A-Z]{3}$/.test(input.currency)) throw new BadRequestException('Currency must be a three-letter uppercase code.');
    return this.database.$transaction(async (tx) => {
      const [user, department, specialty] = await Promise.all([
        tx.user.findUnique({ where: { id: input.userId }, select: { id: true, status: true } }),
        tx.department.findUnique({ where: { id: input.departmentId }, select: { id: true, hospitalId: true, isActive: true } }),
        tx.specialty.findUnique({ where: { id: input.specialtyId }, select: { id: true, isActive: true } }),
      ]);
      if (!user || user.status !== 'ACTIVE') throw new ConflictException('The doctor must have an active MedKnot account.');
      if (!department || department.hospitalId !== hospitalId || !department.isActive) throw new BadRequestException('Choose an active department belonging to this hospital.');
      if (!specialty?.isActive) throw new BadRequestException('Choose an active specialty.');

      const doctor = await tx.doctorProfile.create({
        data: {
          userId: user.id,
          hospitalId,
          departmentId: department.id,
          specialtyId: specialty.id,
          licenseNumber: input.licenseNumber.trim(),
          biography: input.biography?.trim(),
          yearsExperience: input.yearsExperience,
          consultationFeeMinor: input.consultationFeeMinor,
          currency: input.currency,
          onlineConsultation: input.onlineConsultation,
          verificationStatus: 'PENDING',
          qualifications: { create: input.qualifications.map((item, index) => ({ ...item, displayOrder: index })) },
        },
        include: doctorAdminInclude,
      });
      await tx.auditLog.create({ data: { actorId, action: 'directory.doctor.submitted', targetType: 'DoctorProfile', targetId: doctor.id, requestId, metadata: { hospitalId, verificationStatus: doctor.verificationStatus } } });
      return doctor;
    });
  }

  async verifyDoctor(hospitalId: string, doctorId: string, action: 'approve' | 'reject', actorId: string, requestId?: string) {
    return this.database.$transaction(async (tx) => {
      const existing = await tx.doctorProfile.findFirst({
        where: { id: doctorId, hospitalId },
        include: { hospital: true, department: true },
      });
      if (!existing) throw new NotFoundException('Doctor profile not found in this hospital.');
      const approved = action === 'approve';
      if (approved && (existing.hospital.status !== 'ACTIVE' || existing.hospital.verificationStatus !== 'APPROVED' || !existing.department.isActive)) {
        throw new ConflictException('Approve the hospital and activate the doctor department before approving this profile.');
      }
      const doctor = await tx.doctorProfile.update({
        where: { id: existing.id },
        data: { verificationStatus: approved ? 'APPROVED' : 'REJECTED', verifiedAt: approved ? new Date() : null },
        include: doctorAdminInclude,
      });
      if (approved) {
        const role = await tx.role.findUnique({ where: { code: 'clinician' } });
        if (!role) throw new ConflictException('The clinician role has not been initialized.');
        await tx.userRole.upsert({
          where: { userId_roleId_hospitalId: { userId: doctor.userId, roleId: role.id, hospitalId } },
          create: { userId: doctor.userId, roleId: role.id, hospitalId },
          update: {},
        });
        await tx.hospitalMembership.upsert({
          where: { userId_hospitalId: { userId: doctor.userId, hospitalId } },
          create: { userId: doctor.userId, hospitalId, status: 'INVITED' },
          update: {},
        });
      }
      await tx.auditLog.create({ data: { actorId, action: `directory.doctor.${action === 'approve' ? 'approved' : 'rejected'}`, targetType: 'DoctorProfile', targetId: doctor.id, requestId, metadata: { hospitalId, verificationStatus: doctor.verificationStatus } } });
      return doctor;
    });
  }

  private nearbyHospitals(query: DirectoryQueryDto) {
    const latitude = query.latitude!;
    const longitude = query.longitude!;
    const radiusKm = query.radiusKm ?? 25;
    const search = query.search?.trim() ? `%${query.search.trim()}%` : null;
    const city = query.city?.trim() ? `%${query.city.trim()}%` : null;
    const matching = [
      Prisma.sql`h."status" = 'ACTIVE'::"HospitalStatus"`,
      Prisma.sql`h."verification_status" = 'APPROVED'::"DirectoryVerificationStatus"`,
      Prisma.sql`h."latitude" IS NOT NULL AND h."longitude" IS NOT NULL`,
      ...(search ? [Prisma.sql`(h."name" ILIKE ${search} OR h."address_line1" ILIKE ${search} OR h."city" ILIKE ${search})`] : []),
      ...(city ? [Prisma.sql`h."city" ILIKE ${city}`] : []),
    ];
    const queryText = Prisma.sql`
      WITH candidates AS (
        SELECT h."id", h."name", h."slug", h."address_line1" AS "addressLine1", h."city", h."region", h."postal_code" AS "postalCode", h."country", h."phone", h."latitude", h."longitude",
          6371.0088 * 2 * ASIN(LEAST(1.0, SQRT(
            POWER(SIN(RADIANS(h."latitude" - ${latitude}) / 2), 2) +
            COS(RADIANS(${latitude})) * COS(RADIANS(h."latitude")) *
            POWER(SIN(RADIANS(h."longitude" - ${longitude}) / 2), 2)
          ))) AS "distanceKm"
        FROM "hospitals" h
        WHERE ${Prisma.join(matching, ' AND ')}
      )
      SELECT * FROM candidates
      WHERE "distanceKm" <= ${radiusKm}
      ORDER BY "distanceKm" ASC, "name" ASC
      LIMIT ${query.pageSize + 1} OFFSET ${(query.page - 1) * query.pageSize}
    `;
    return this.database.$queryRaw<HospitalDistanceRow[]>(queryText);
  }

  private async departmentsForHospitals(hospitalIds: string[]) {
    if (!hospitalIds.length) return new Map<string, Array<{ id: string; name: string }>>();
    const departments = await this.database.department.findMany({
      where: { hospitalId: { in: hospitalIds }, isActive: true },
      select: { id: true, name: true, hospitalId: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return departments.reduce((grouped, department) => {
      const list = grouped.get(department.hospitalId) ?? [];
      list.push({ id: department.id, name: department.name });
      grouped.set(department.hospitalId, list);
      return grouped;
    }, new Map<string, Array<{ id: string; name: string }>>());
  }
}

const doctorPublicInclude = {
  user: { select: { fullName: true } },
  hospital: { select: { id: true, name: true, city: true, addressLine1: true, phone: true } },
  department: { select: { id: true, name: true } },
  specialty: { select: { id: true, name: true } },
  qualifications: { select: { qualification: true, institution: true, yearCompleted: true }, orderBy: { displayOrder: 'asc' as const } },
} satisfies Prisma.DoctorProfileInclude;

const doctorAdminInclude = {
  user: { select: { id: true, fullName: true, email: true, status: true } },
  hospital: { select: { id: true, name: true, verificationStatus: true } },
  department: { select: { id: true, name: true, isActive: true } },
  specialty: { select: { id: true, name: true, isActive: true } },
  qualifications: { orderBy: { displayOrder: 'asc' as const } },
} satisfies Prisma.DoctorProfileInclude;

function toPublicDoctor(doctor: Prisma.DoctorProfileGetPayload<{ include: typeof doctorPublicInclude }>) {
  return {
    id: doctor.id,
    fullName: doctor.user.fullName,
    biography: doctor.biography,
    yearsExperience: doctor.yearsExperience,
    consultationFeeMinor: doctor.consultationFeeMinor,
    currency: doctor.currency,
    onlineConsultation: doctor.onlineConsultation,
    verified: true,
    verifiedAt: doctor.verifiedAt,
    hospital: doctor.hospital,
    department: doctor.department,
    specialty: doctor.specialty,
    qualifications: doctor.qualifications,
  };
}

function assertCoordinates(latitude?: number, longitude?: number) {
  if ((latitude === undefined) !== (longitude === undefined)) throw new BadRequestException('Provide both latitude and longitude.');
}

function roundDistance(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
