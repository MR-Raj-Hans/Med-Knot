import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { PrismaClient } from '../src/generated/prisma/client.js';

const confirmation = process.env.BOOTSTRAP_ADMIN_CONFIRM;
const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const fullName = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
const connectionString = process.env.DATABASE_URL;
const required = { confirmation, email, password, fullName, connectionString };
if (Object.values(required).some((value) => !value)) throw new Error('Set the BOOTSTRAP_ADMIN_* values in backend/.env before running this command.');
if (confirmation !== 'CREATE_FIRST_ADMIN') throw new Error('Set BOOTSTRAP_ADMIN_CONFIRM=CREATE_FIRST_ADMIN to authorize this one-time local bootstrap.');
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email!)) throw new Error('BOOTSTRAP_ADMIN_EMAIL is not a valid email address.');
if (password!.length < 12 || password!.length > 128) throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be 12–128 characters.');

const database = new PrismaClient({ adapter: new PrismaPg({ connectionString: connectionString! }) });
try {
  const adminRole = await database.role.findUniqueOrThrow({ where: { code: 'admin' } });
  const existing = await database.userRole.count({ where: { roleId: adminRole.id, hospitalId: null } });
  if (existing) throw new Error('A global admin already exists; this bootstrap is disabled.');
  if (await database.user.findUnique({ where: { email: email! } })) throw new Error('That email already belongs to an account; this command will not modify it.');

  const passwordHash = await argon2.hash(password!, { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 });
  await database.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: email!,
        fullName: fullName!,
        passwordHash,
        status: 'ACTIVE',
        termsAcceptedAt: new Date(),
      },
    });
    await tx.userRole.create({ data: { userId: user.id, roleId: adminRole.id } });
    await tx.auditLog.create({ data: { actorId: user.id, action: 'admin.bootstrap.completed', targetType: 'User', targetId: user.id } });
  });
  console.log('Created the first system administrator. Remove the BOOTSTRAP_ADMIN_* values from backend/.env.');
} finally {
  await database.$disconnect();
}
