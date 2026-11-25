import 'dotenv/config';
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const baseUrl = (process.env.API_BASE_URL ?? 'http://127.0.0.1:4400/api/v1').replace(/\/$/, '');
const database = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const patientName = 'MedKnot Local Smoke Patient';
const email = `medknot-smoke-${randomUUID()}@example.test`;
const phone = `+1${randomInt(100_000_000, 1_000_000_000)}`;
const createdUserIds: string[] = [];

async function call<T>(path: string, init: RequestInit = {}, token?: string) {
  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json');
  if (init.body) headers.set('content-type', 'application/json');
  if (token) headers.set('authorization', `Bearer ${token}`);
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const value = response.status === 204 ? undefined : await response.json().catch(() => undefined);
  return { response, value: value as T | undefined };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const live = await call<{ status: string }>('/health/live');
  assert(live.response.status === 200 && live.value?.status === 'ok', 'liveness endpoint failed');
  console.log('PASS liveness endpoint');

  const ready = await call<{ status: string; checks: { database: boolean; redis: boolean } }>('/health/ready');
  assert(ready.response.status === 200 && ready.value?.checks.database && ready.value.checks.redis, 'database or Redis readiness failed');
  console.log('PASS readiness endpoint (PostgreSQL and Redis)');

  const password = randomBytes(24).toString('base64url');
  const registration = await call<{ challengeId: string; mode: string; devCode?: string }>('/auth/request-verification', {
    method: 'POST',
    body: JSON.stringify({ fullName: patientName, email, phone, password, acceptedTerms: true }),
  });
  assert(registration.response.status === 200 && registration.value?.mode === 'development' && registration.value.devCode, 'registration did not return the local development verification code');
  const row = await database.user.findUnique({ where: { email }, include: { patientProfile: true } });
  assert(row && row.status === 'PENDING_VERIFICATION' && row.patientProfile, 'patient row/profile did not persist in PostgreSQL');
  const profileId = row.patientProfile.id;
  createdUserIds.push(row.id);
  console.log('PASS patient registration persisted in PostgreSQL');

  const verification = await call<{ accessToken: string; refreshToken: string; verified: boolean; patient: { fullName: string } }>('/auth/verify-otp', {
    method: 'POST', body: JSON.stringify({ challengeId: registration.value.challengeId, code: registration.value.devCode }),
  });
  assert(verification.response.status === 200 && verification.value?.verified && verification.value.patient.fullName === patientName, 'OTP verification failed');
  const active = await database.user.findUnique({ where: { id: row.id }, include: { roles: { include: { role: true } }, sessions: true } });
  assert(active?.status === 'ACTIVE' && active.roles.some(({ role }) => role.code === 'patient') && active.sessions.length === 1, 'verification did not activate and role the patient');
  console.log('PASS OTP verification and patient role assignment');

  const current = verification.value!;
  const identity = await call<{ patient: { fullName: string } }>('/auth/me', {}, current.accessToken);
  assert(identity.response.status === 200 && identity.value?.patient.fullName === patientName, 'authenticated identity lookup failed');
  console.log('PASS authenticated identity endpoint');

  const home = await call<{ patientName: string; nextAppointment: unknown; activePrescriptionCount: number; followUpLabel: unknown }>('/patient/home', {}, current.accessToken);
  assert(home.response.status === 200 && home.value?.patientName === patientName && home.value.nextAppointment === null && home.value.activePrescriptionCount === 0 && home.value.followUpLabel === null, 'patient home did not return only real account data');
  const ownProfile = await call<{ id: string }>('/patients/me', {}, current.accessToken);
  assert(ownProfile.response.status === 200 && ownProfile.value?.id === profileId, 'patient profile endpoint failed');
  console.log('PASS patient home and self-profile routes');

  const otherEmail = `medknot-smoke-${randomUUID()}@example.test`;
  const otherPassword = randomBytes(24).toString('base64url');
  const otherRegistration = await call<{ challengeId: string; devCode: string }>('/auth/request-verification', {
    method: 'POST', body: JSON.stringify({ fullName: 'MedKnot Other Smoke Patient', email: otherEmail, phone: `+1${randomInt(100_000_000, 1_000_000_000)}`, password: otherPassword, acceptedTerms: true }),
  });
  assert(otherRegistration.response.status === 200 && otherRegistration.value?.devCode, 'second local registration failed');
  const otherRow = await database.user.findUnique({ where: { email: otherEmail }, include: { patientProfile: true } });
  assert(otherRow?.patientProfile, 'second patient row/profile did not persist');
  createdUserIds.push(otherRow.id);
  const otherSession = await call<{ accessToken: string }>('/auth/verify-otp', {
    method: 'POST', body: JSON.stringify({ challengeId: otherRegistration.value.challengeId, code: otherRegistration.value.devCode }),
  });
  assert(otherSession.response.status === 200 && otherSession.value?.accessToken, 'second patient verification failed');
  const foreignProfile = await call(`/patients/${profileId}`, {}, otherSession.value.accessToken);
  assert(foreignProfile.response.status === 403, 'a patient could read another patient profile');
  console.log('PASS patient profile ownership enforcement');

  const rotated = await call<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
    method: 'POST', body: JSON.stringify({ refreshToken: current.refreshToken }),
  });
  assert(rotated.response.status === 200 && rotated.value?.refreshToken !== current.refreshToken, 'refresh token did not rotate');
  const reused = await call('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: current.refreshToken }) });
  assert(reused.response.status === 401, 'a consumed refresh token was accepted');
  console.log('PASS refresh rotation and replay revocation');

  const login = await call<{ accessToken: string; refreshToken: string; verified: boolean }>('/auth/login', {
    method: 'POST', body: JSON.stringify({ email, password }),
  });
  assert(login.response.status === 200 && login.value?.verified, 'login after verification failed');
  const logout = await call('/auth/sign-out', { method: 'POST' }, login.value.accessToken);
  assert(logout.response.status === 204, 'logout did not return 204');
  const afterLogout = await call('/auth/me', {}, login.value.accessToken);
  assert(afterLogout.response.status === 401, 'a logged-out access token was still accepted');
  console.log('PASS logout revocation');

  const reLogin = await call<{ accessToken: string; verified: boolean }>('/auth/sign-in', {
    method: 'POST', body: JSON.stringify({ email, password }),
  });
  assert(reLogin.response.status === 200 && reLogin.value?.verified, 'login after logout failed');
  console.log('PASS sign-in after logout');

  const reset = await call<{ accepted: boolean; devCode?: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
  assert(reset.response.status === 200 && reset.value?.accepted && reset.value.devCode, 'local password reset request failed');
  const changed = await call<{ changed: boolean }>('/auth/reset-password', {
    method: 'POST', body: JSON.stringify({ email, code: reset.value.devCode, newPassword: `${password}Z9` }),
  });
  assert(changed.response.status === 200 && changed.value?.changed, 'password reset did not complete');
  const oldPassword = await call('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  assert(oldPassword.response.status === 401, 'old password still works after reset');
  const newPassword = await call<{ verified: boolean }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password: `${password}Z9` }) });
  assert(newPassword.response.status === 200 && newPassword.value?.verified, 'new password does not work');
  console.log('PASS password reset and old-password revocation');

  const auditEvents = await database.auditLog.count({ where: { targetId: row.id, action: { startsWith: 'auth.' } } });
  assert(auditEvents >= 5, 'expected authentication audit events were not persisted');
  console.log(`PASS ${auditEvents} authentication audit records persisted`);
}

try {
  await main();
} catch (error) {
  console.error(`FAIL local API verification: ${error instanceof Error ? error.message : 'unknown error'}`);
  process.exitCode = 1;
} finally {
  if (createdUserIds.length) {
    for (const userId of createdUserIds) {
      await database.auditLog.deleteMany({ where: { targetId: userId } }).catch(() => undefined);
      await database.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
    console.log('CLEANUP synthetic smoke-test accounts');
  }
  await database.$disconnect();
}
