import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { AuthPrincipal } from '../common/auth-principal.js';
import { AuthRateLimitGuard } from '../common/auth-rate-limit.guard.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { ResendCodeDto } from './dto/resend-code.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { VerifyCodeDto } from './dto/verify-code.dto.js';

type RequestWithId = Request & { id?: string };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('request-verification') @HttpCode(200) @UseGuards(AuthRateLimitGuard)
  @ApiOperation({ summary: 'Create a patient account and request email verification' })
  requestVerification(@Body() dto: RegisterDto, @Req() request: RequestWithId) {
    return this.auth.requestVerification(dto, request.id);
  }

  @Post('verify-otp') @HttpCode(200) @UseGuards(AuthRateLimitGuard)
  @ApiOperation({ summary: 'Verify an email challenge and start a patient session' })
  verifyCode(@Body() dto: VerifyCodeDto, @Req() request: RequestWithId) {
    return this.auth.verifyCode(dto, request.id);
  }

  @Post('resend-verification') @HttpCode(200) @UseGuards(AuthRateLimitGuard)
  resendCode(@Body() dto: ResendCodeDto, @Req() request: RequestWithId) {
    return this.auth.resendCode(dto, request.id);
  }

  @Post('login') @HttpCode(200) @UseGuards(AuthRateLimitGuard)
  @ApiOperation({ summary: 'Sign in with email and password' })
  login(@Body() dto: LoginDto, @Req() request: RequestWithId) {
    return this.auth.login(dto, request.id);
  }

  @Post('sign-in') @HttpCode(200) @UseGuards(AuthRateLimitGuard)
  signIn(@Body() dto: LoginDto, @Req() request: RequestWithId) {
    return this.auth.login(dto, request.id);
  }

  @Post('refresh') @HttpCode(200) @UseGuards(AuthRateLimitGuard)
  refresh(@Body() dto: RefreshDto, @Req() request: RequestWithId) {
    return this.auth.refresh(dto.refreshToken, request.id);
  }

  @Post('forgot-password') @HttpCode(200) @UseGuards(AuthRateLimitGuard)
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() request: RequestWithId) {
    return this.auth.forgotPassword(dto.email, request.id);
  }

  @Post('reset-password') @HttpCode(200) @UseGuards(AuthRateLimitGuard)
  resetPassword(@Body() dto: ResetPasswordDto, @Req() request: RequestWithId) {
    return this.auth.resetPassword(dto, request.id);
  }

  @Post('sign-out') @HttpCode(204) @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  signOut(@CurrentUser() user: AuthPrincipal, @Req() request: RequestWithId, @Res() response: Response) {
    return this.auth.signOut(user, request.id).then(() => response.status(204).send());
  }

  @Get('me') @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Return the authenticated patient identity' })
  me(@CurrentUser() user: AuthPrincipal) { return this.auth.me(user.id); }
}
