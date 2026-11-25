import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { ConflictException, HttpException, HttpStatus, Injectable, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import type { Prisma } from '../generated/prisma/client.js';
import type { AuthPrincipal } from '../common/auth-principal.js';
import { DatabaseService } from '../database/database.service.js';
import { RolesService } from '../roles/roles.service.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { ResetPasswordDto } from './dto/reset-password.dto.js';
import type { VerifyCodeDto } from './dto/verify-code.dto.js';
import type { ResendCodeDto } from './dto/resend-code.dto.js';
import { EmailService } from '../email/email.service.js';

const ARGON_OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;
const ACCESS_INCLUDE = {
  roles: { select: { role: { select: { code: true, permissions: { select: { permission: { select: { code: true } } } } } } } },
} satisfies Prisma.UserInclude;

@Injectable()
export class AuthService {
  private dummyHash?: Promise<string>;

  constructor(
    private readonly database: DatabaseService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly roles: RolesService,
    private readonly email: EmailService,
  ) {}

  private secret() { return this.config.getOrThrow<string>('ACCESS_TOKEN_SECRET'); }
  private digest(value: string) { return createHmac('sha256', this.secret()).update(value).digest('hex'); }
  private sameDigest(expected: string, actual: string) {
    const left = Buffer.from(expected, 'hex');
    const right = Buffer.from(actual, 'hex');
    return left.length === right.length && timingSafeEqual(left, right);
  }
  private newCode() { return randomInt(0, 1_000_000).toString().padStart(6, '0'); }
  private isDevelopment() { return this.config.get<string>('APP_ENV') === 'development'; }
  private get ttlSeconds() { return this.config.get<number>('ACCESS_TOKEN_TTL_SECONDS', 900); }
  private get refreshDays() { return this.config.get<number>('REFRESH_TOKEN_TTL_DAYS', 30); }

  async requestVerification(input: RegisterDto, requestId?: string) {
    const email = input.email.trim().toLowerCase();
    const phone = input.phone.replace(/[\s().-]/g, '');
    const existingUser = await this.database.user.findFirst({ where: { OR: [{ email }, { phone }] }, select: { id: true } });
    if (existingUser) throw new ConflictException('An account with those details already exists.');
    const code = this.newCode();
    const passwordHash = await argon2.hash(input.password, ARGON_OPTIONS);
    const expiresAt = this.minutesFromNow(this.config.get<number>('OTP_TTL_MINUTES', 10));
    let delivery: 'development' | 'sent';
    try {
      delivery = await this.email.sendVerificationCode(email, input.fullName.trim(), code, this.config.get<number>('OTP_TTL_MINUTES', 10));
    } catch {
      throw new ServiceUnavailableException('Email delivery is unavailable. Please try again later.');
    }
    const user = await this.database.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          phone,
          fullName: input.fullName.trim(),
          passwordHash,
          status: 'PENDING_VERIFICATION',
          termsAcceptedAt: new Date(),
        },
      });
      await tx.patientProfile.create({ data: { userId: created.id } });
      await this.roles.assignPatientRole(tx, created.id);
      const challenge = await tx.emailVerificationChallenge.create({
        data: { userId: created.id, codeHash: this.digest(code), expiresAt },
      });
      await tx.auditLog.create({
        data: { actorId: created.id, action: 'auth.registration.requested', targetType: 'User', targetId: created.id, requestId, metadata: { delivery } },
      });
      return { id: created.id, challengeId: challenge.id };
    });
    return { challengeId: user.challengeId, mode: delivery === 'development' ? 'development' as const : 'backend' as const, ...(delivery === 'development' && this.isDevelopment() ? { devCode: code } : {}) };
  }

  async verifyCode(input: VerifyCodeDto, requestId?: string) {
    const challenge = await this.database.emailVerificationChallenge.findUnique({
      where: { id: input.challengeId },
      include: { user: true },
    });
    if (!challenge || challenge.consumedAt || challenge.expiresAt <= new Date() || challenge.attempts >= 5 || challenge.user.status !== 'PENDING_VERIFICATION') {
      throw new UnauthorizedException('The verification code is invalid or expired.');
    }
    if (!this.sameDigest(challenge.codeHash, this.digest(input.code))) {
      const attempts = challenge.attempts + 1;
      await this.database.$transaction([
        this.database.emailVerificationChallenge.updateMany({
          where: { id: challenge.id, consumedAt: null, attempts: { lt: 5 } },
          data: { attempts: { increment: 1 }, ...(attempts >= 5 ? { consumedAt: new Date() } : {}) },
        }),
        this.database.auditLog.create({
          data: { actorId: challenge.userId, action: 'auth.verification.failed', targetType: 'User', targetId: challenge.userId, requestId, metadata: { reason: 'invalid-code' } },
        }),
      ]);
      throw new UnauthorizedException('The verification code is invalid or expired.');
    }

    await this.database.$transaction(async (tx) => {
      const claimed = await tx.emailVerificationChallenge.updateMany({
        where: { id: challenge.id, consumedAt: null, expiresAt: { gt: new Date() }, attempts: { lt: 5 } },
        data: { consumedAt: new Date() },
      });
      if (!claimed.count) throw new UnauthorizedException('The verification code is invalid or expired.');
      await tx.user.update({ where: { id: challenge.userId }, data: { status: 'ACTIVE' } });
      await tx.auditLog.create({ data: { actorId: challenge.userId, action: 'auth.email.verified', targetType: 'User', targetId: challenge.userId, requestId } });
    });
    return this.startSession(challenge.userId, requestId);
  }

  async resendCode(input: ResendCodeDto, requestId?: string) {
    const old = await this.database.emailVerificationChallenge.findUnique({ where: { id: input.challengeId }, include: { user: true } });
    if (!old || old.user.email !== input.email.trim().toLowerCase() || old.user.status !== 'PENDING_VERIFICATION' || old.consumedAt) {
      throw new UnauthorizedException('The verification request is invalid or expired.');
    }
    const latest = await this.database.emailVerificationChallenge.findFirst({ where: { userId: old.userId }, orderBy: { createdAt: 'desc' }, select: { id: true } });
    if (latest?.id !== old.id) throw new UnauthorizedException('The verification request is invalid or expired.');
    const cooldownMs = this.config.get<number>('OTP_RESEND_COOLDOWN_SECONDS', 30) * 1000;
    if (Date.now() - old.createdAt.getTime() < cooldownMs) {
      throw new HttpException('Please wait before requesting another verification code.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const code = this.newCode();
    let delivery: 'development' | 'sent';
    try {
      delivery = await this.email.sendVerificationCode(old.user.email, old.user.fullName, code, this.config.get<number>('OTP_TTL_MINUTES', 10));
    } catch {
      throw new ServiceUnavailableException('Email delivery is unavailable. Please try again later.');
    }
    const next = await this.database.$transaction(async (tx) => {
      await tx.emailVerificationChallenge.updateMany({ where: { userId: old.userId, consumedAt: null }, data: { consumedAt: new Date() } });
      const challenge = await tx.emailVerificationChallenge.create({
        data: { userId: old.userId, codeHash: this.digest(code), expiresAt: this.minutesFromNow(this.config.get<number>('OTP_TTL_MINUTES', 10)) },
      });
      await tx.auditLog.create({ data: { actorId: old.userId, action: 'auth.verification.resent', targetType: 'User', targetId: old.userId, requestId, metadata: { delivery: 'development-only' } } });
      return challenge;
    });
    return { challengeId: next.id, mode: delivery === 'development' ? 'development' as const : 'backend' as const, ...(delivery === 'development' && this.isDevelopment() ? { devCode: code } : {}) };
  }

  async login(input: LoginDto, requestId?: string) {
    const email = input.email.trim().toLowerCase();
    const user = await this.database.user.findUnique({ where: { email }, include: ACCESS_INCLUDE });
    const passwordHash = user?.passwordHash ?? await (this.dummyHash ??= argon2.hash(randomBytes(32).toString('base64'), ARGON_OPTIONS));
    const valid = await argon2.verify(passwordHash, input.password).catch(() => false);
    if (!user || !valid || user.status !== 'ACTIVE') {
      await this.database.auditLog.create({
        data: { actorId: user?.id ?? null, action: 'auth.login.failed', targetType: 'Account', targetId: user?.id ?? null, requestId, metadata: { reason: 'invalid-credentials' } },
      });
      throw new UnauthorizedException('Email or password is incorrect.');
    }
    return this.startSession(user.id, requestId);
  }

  async refresh(rawToken: string, requestId?: string) {
    const tokenHash = this.digest(rawToken);
    const now = new Date();
    const result = await this.database.$transaction(async (tx) => {
      const current = await tx.refreshToken.findUnique({ where: { tokenHash }, include: { session: true } });
      if (!current) return { invalid: true as const };
      if (current.consumedAt || current.expiresAt <= now || current.session.revokedAt) {
        if (current.consumedAt && !current.session.revokedAt) {
          await tx.refreshSession.updateMany({ where: { id: current.sessionId, revokedAt: null }, data: { revokedAt: now } });
          await tx.auditLog.create({ data: { actorId: current.session.userId, action: 'auth.refresh.reuse-detected', targetType: 'RefreshSession', targetId: current.sessionId, requestId } });
        }
        return { invalid: true as const };
      }
      const claimed = await tx.refreshToken.updateMany({ where: { id: current.id, consumedAt: null, expiresAt: { gt: now } }, data: { consumedAt: now } });
      if (!claimed.count) {
        await tx.refreshSession.updateMany({ where: { id: current.sessionId, revokedAt: null }, data: { revokedAt: now } });
        await tx.auditLog.create({ data: { actorId: current.session.userId, action: 'auth.refresh.reuse-detected', targetType: 'RefreshSession', targetId: current.sessionId, requestId } });
        return { invalid: true as const };
      }
      const newToken = randomBytes(48).toString('base64url');
      await tx.refreshToken.create({
        data: { sessionId: current.sessionId, tokenHash: this.digest(newToken), expiresAt: this.daysFromNow(this.refreshDays) },
      });
      await tx.refreshSession.update({ where: { id: current.sessionId }, data: { lastUsedAt: now } });
      const user = await tx.user.findUnique({ where: { id: current.session.userId }, include: ACCESS_INCLUDE });
      if (!user || user.status !== 'ACTIVE') {
        await tx.refreshSession.update({ where: { id: current.sessionId }, data: { revokedAt: now } });
        return { invalid: true as const };
      }
      await tx.auditLog.create({ data: { actorId: user.id, action: 'auth.refresh.rotated', targetType: 'RefreshSession', targetId: current.sessionId, requestId } });
      return { invalid: false as const, user, sessionId: current.sessionId, refreshToken: newToken };
    });
    if (result.invalid) throw new UnauthorizedException('Refresh token is invalid or expired. Please sign in again.');
    return this.sessionResponse(result.user, result.sessionId, result.refreshToken);
  }

  async forgotPassword(email: string, requestId?: string) {
    const user = await this.database.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    let devCode: string | undefined;
    if (user?.status === 'ACTIVE') {
      devCode = this.newCode();
      let delivery: 'development' | 'sent';
      try {
        delivery = await this.email.sendPasswordResetCode(user.email, user.fullName, devCode, this.config.get<number>('PASSWORD_RESET_TTL_MINUTES', 15));
      } catch {
        throw new ServiceUnavailableException('Email delivery is unavailable. Please try again later.');
      }
      await this.database.$transaction(async (tx) => {
        await tx.passwordResetToken.updateMany({ where: { userId: user.id, consumedAt: null }, data: { consumedAt: new Date() } });
        await tx.passwordResetToken.create({
          data: { userId: user.id, tokenHash: this.digest(devCode!), expiresAt: this.minutesFromNow(this.config.get<number>('PASSWORD_RESET_TTL_MINUTES', 15)) },
        });
        await tx.auditLog.create({ data: { actorId: user.id, action: 'auth.password-reset.requested', targetType: 'User', targetId: user.id, requestId, metadata: { delivery } } });
      });
    }
    return { accepted: true, ...(devCode && this.isDevelopment() && this.email.deliveryMode === 'development' ? { devCode } : {}) };
  }

  async resetPassword(input: ResetPasswordDto, requestId?: string) {
    const user = await this.database.user.findUnique({ where: { email: input.email.trim().toLowerCase() } });
    const token = user ? await this.database.passwordResetToken.findFirst({
      where: { userId: user.id, consumedAt: null, expiresAt: { gt: new Date() }, attempts: { lt: 5 } },
      orderBy: { createdAt: 'desc' },
    }) : null;
    if (!user || !token || !this.sameDigest(token.tokenHash, this.digest(input.code))) {
      if (token) await this.database.passwordResetToken.update({ where: { id: token.id }, data: { attempts: { increment: 1 } } });
      throw new UnauthorizedException('The reset code is invalid or expired.');
    }
    const passwordHash = await argon2.hash(input.newPassword, ARGON_OPTIONS);
    const now = new Date();
    await this.database.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({ where: { id: token.id, consumedAt: null, expiresAt: { gt: now }, attempts: { lt: 5 } }, data: { consumedAt: now } });
      if (!claimed.count) throw new UnauthorizedException('The reset code is invalid or expired.');
      await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      await tx.refreshSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now } });
      await tx.auditLog.create({ data: { actorId: user.id, action: 'auth.password-reset.completed', targetType: 'User', targetId: user.id, requestId } });
    });
    return { changed: true };
  }

  async signOut(user: AuthPrincipal, requestId?: string) {
    await this.database.$transaction(async (tx) => {
      await tx.refreshSession.updateMany({ where: { id: user.sessionId, userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId: user.id, action: 'auth.logout', targetType: 'RefreshSession', targetId: user.sessionId, requestId } });
    });
  }

  async me(userId: string) {
    const user = await this.database.user.findUnique({ where: { id: userId, status: 'ACTIVE' }, select: { id: true, fullName: true, email: true, phone: true, createdAt: true } });
    if (!user) throw new UnauthorizedException('Your account is no longer active.');
    return { ...user, patient: { id: user.id, fullName: user.fullName } };
  }

  private async startSession(userId: string, requestId?: string) {
    const user = await this.database.user.findUnique({ where: { id: userId, status: 'ACTIVE' }, include: ACCESS_INCLUDE });
    if (!user) throw new UnauthorizedException('The account is not active.');
    const refreshToken = randomBytes(48).toString('base64url');
    const session = await this.database.$transaction(async (tx) => {
      const created = await tx.refreshSession.create({ data: { userId } });
      await tx.refreshToken.create({ data: { sessionId: created.id, tokenHash: this.digest(refreshToken), expiresAt: this.daysFromNow(this.refreshDays) } });
      await tx.auditLog.create({ data: { actorId: userId, action: 'auth.session.created', targetType: 'RefreshSession', targetId: created.id, requestId } });
      return created;
    });
    return this.sessionResponse(user, session.id, refreshToken);
  }

  private async sessionResponse(user: { id: string; fullName: string; roles: Array<{ role: { code: string; permissions: Array<{ permission: { code: string } }> } }> }, sessionId: string, refreshToken: string) {
    const roles = user.roles.map(({ role }) => role);
    const permissions = [...new Set(roles.flatMap((role) => role.permissions.map(({ permission }) => permission.code)))];
    const accessToken = await this.jwt.signAsync({ sub: user.id, sid: sessionId, roles: roles.map((role) => role.code), permissions });
    return { accessToken, refreshToken, accessTokenExpiresIn: this.ttlSeconds, verified: true, patient: { id: user.id, fullName: user.fullName } };
  }

  private minutesFromNow(minutes: number) { return new Date(Date.now() + minutes * 60_000); }
  private daysFromNow(days: number) { return new Date(Date.now() + days * 86_400_000); }
}
