import { Injectable, OnModuleInit } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { DatabaseService } from '../database/database.service.js';

const ROLE_DEFINITIONS = [
  { code: 'patient', description: 'Patient account', permissions: ['patient:read:self', 'patient:update:self'] },
  { code: 'clinician', description: 'Clinician account', permissions: ['patient:read:assigned'] },
  { code: 'hospital_admin', description: 'Hospital administrator', permissions: ['hospital:manage:scoped', 'user:manage:scoped'] },
  { code: 'admin', description: 'System administrator', permissions: ['system:manage', 'hospital:manage:any', 'user:manage:any', 'audit:read'] },
];

@Injectable()
export class RolesService implements OnModuleInit {
  constructor(private readonly database: DatabaseService) {}

  async onModuleInit() {
    await this.database.$transaction(async (tx) => {
      for (const definition of ROLE_DEFINITIONS) {
        const role = await tx.role.upsert({
          where: { code: definition.code },
          create: { code: definition.code, description: definition.description },
          update: { description: definition.description },
        });
        for (const code of definition.permissions) {
          const permission = await tx.permission.upsert({
            where: { code },
            create: { code, description: code.replaceAll(':', ' ') },
            update: {},
          });
          await tx.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
            create: { roleId: role.id, permissionId: permission.id },
            update: {},
          });
        }
      }
    });
  }

  async assignPatientRole(tx: Prisma.TransactionClient, userId: string) {
    const role = await tx.role.findUniqueOrThrow({ where: { code: 'patient' } });
    await tx.userRole.create({ data: { userId, roleId: role.id } });
  }
}
