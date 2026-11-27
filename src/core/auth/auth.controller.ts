import {
  Controller,
  Post,
  Body,
  Get,
  Delete,
  Query,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ResendVerificationDto } from './dto/resend-verification.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { FindSessionsQueryDto } from './dto/find-sessions-query.dto.js';
import { VerifyEmailQueryDto } from './dto/verify-email-query.dto.js';
import { RegisterResponseDto } from './dto/register-response.dto.js';
import { LoginResponseDto } from './dto/login-response.dto.js';
import { AuthCookies } from './auth-cookies.js';
import { ResponseCodes } from '../../common/constants/response-codes.js';
import { MeResponseDto } from './dto/me-response.dto.js';
import { OwnSessionResponseDto } from './dto/session-response.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { THROTTLE } from '../../common/constants.js';
import {
  EmailVerifiedResponseDto,
  VerificationEmailResentResponseDto,
  ForgotPasswordResponseDto,
  PasswordResetResponseDto,
  LogoutResponseDto,
  LogoutAllResponseDto,
  RefreshResponseDto,
  SessionRevokedResponseDto,
} from './dto/auth-success.dto.js';
import { ErrorResponseDto } from '../../common/dto/error-response.dto.js';
import { ValidationErrorResponseDto } from '../../common/dto/validation-error-response.dto.js';
import { ApiPaginatedResponse } from '../../common/pagination/index.js';
import { RequireCaptcha } from '../turnstile/require-captcha.decorator.js';
import {
  ApiInvalidIdError,
  ApiOriginError,
  ApiThrottleError,
  ApiValidationError,
} from '../../common/swagger/api-common-responses.decorator.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import type { CachedUser } from './cache/user-cache.service.js';

@ApiTags('Auth')
@ApiThrottleError()
@ApiOriginError()
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private authCookies: AuthCookies,
  ) {}

  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: 201,
    type: RegisterResponseDto,
    description: 'User created',
  })
  @ApiResponse({
    status: 400,
    description:
      'Validation failed (email format, password format), callbackUrl not in whitelist (auth.callback_url.not_allowed) or captcha token missing (captcha.missing)',
    type: ValidationErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description:
      'Captcha verification failed (captcha.invalid) or origin not allowed (origin.not_allowed)',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Email already in use',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 429,
    description:
      'Too many attempts — code: throttle.too_many_requests, params.retryAfter: seconds until retry',
    type: ErrorResponseDto,
  })
  @Throttle({ global: THROTTLE.AUTH })
  @RequireCaptcha()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @ApiOperation({ summary: 'Sign in (sets the session cookies)' })
  @ApiResponse({
    status: 201,
    type: LoginResponseDto,
    description:
      'Signed-in user; sets the HttpOnly __Host-access_token and __Host-refresh_token cookies',
  })
  @ApiResponse({
    status: 401,
    description:
      'Invalid email or password (auth.login.invalid_credentials) or email not verified (auth.login.email_not_verified)',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description:
      'Account temporarily locked (auth.login.account_locked), captcha verification failed (captcha.invalid) or origin not allowed (origin.not_allowed)',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 429,
    description:
      'Too many attempts — code: throttle.too_many_requests, params.retryAfter: seconds until retry',
    type: ErrorResponseDto,
  })
  @ApiValidationError(
    'Validation failed (validation.failed) or captcha token missing (captcha.missing)',
  )
  @Throttle({ global: THROTTLE.AUTH })
  @RequireCaptcha()
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { access_token, refresh_token, user } = await this.authService.login(
      dto.email,
      dto.password,
    );
    this.authCookies.setAccess(res, access_token);
    this.authCookies.setRefresh(res, refresh_token);
    return { user };
  }

  @ApiOperation({
    summary: 'Verify email address with the token received by email',
  })
  @ApiResponse({
    status: 200,
    type: EmailVerifiedResponseDto,
    description: 'Email verified successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired token',
    type: ErrorResponseDto,
  })
  @ApiValidationError('Missing token — code: validation.failed')
  @Get('verify-email')
  verifyEmail(@Query() query: VerifyEmailQueryDto) {
    return this.authService.verifyEmail(query.token);
  }

  @ApiOperation({ summary: 'Resend verification email' })
  @ApiResponse({
    status: 200,
    type: VerificationEmailResentResponseDto,
    description: 'Email sent if account exists and is not verified',
  })
  @ApiResponse({
    status: 400,
    description:
      'Validation failed (validation.failed), callbackUrl not in whitelist (auth.callback_url.not_allowed) or captcha token missing (captcha.missing)',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description:
      'Captcha verification failed (captcha.invalid) or origin not allowed (origin.not_allowed)',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 429,
    description:
      'Too many attempts — code: throttle.too_many_requests, params.retryAfter: seconds until retry',
    type: ErrorResponseDto,
  })
  @Throttle({ global: THROTTLE.SENSITIVE })
  @RequireCaptcha()
  @Post('resend-verification')
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerificationEmail(dto.email, dto.callbackUrl);
  }

  @ApiOperation({ summary: 'Request a password reset' })
  @ApiResponse({
    status: 200,
    type: ForgotPasswordResponseDto,
    description: 'Email sent if account exists',
  })
  @ApiResponse({
    status: 400,
    description:
      'Validation failed (validation.failed), callbackUrl not in whitelist (auth.callback_url.not_allowed) or captcha token missing (captcha.missing)',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description:
      'Captcha verification failed (captcha.invalid) or origin not allowed (origin.not_allowed)',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 429,
    description:
      'Too many attempts — code: throttle.too_many_requests, params.retryAfter: seconds until retry',
    type: ErrorResponseDto,
  })
  @Throttle({ global: THROTTLE.SENSITIVE })
  @RequireCaptcha()
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email, dto.callbackUrl);
  }

  @ApiOperation({ summary: 'Reset password with the token received by email' })
  @ApiResponse({
    status: 200,
    type: PasswordResetResponseDto,
    description: 'Password reset, all sessions revoked',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed (password format)',
    type: ValidationErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired token',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 429,
    description:
      'Too many attempts — code: throttle.too_many_requests, params.retryAfter: seconds until retry',
    type: ErrorResponseDto,
  })
  @Throttle({ global: THROTTLE.PASSWORD_RESET })
  @Post('reset-password')
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.resetPassword(
      dto.token,
      dto.password,
    );
    // Every session is revoked: this browser's too
    this.authCookies.clear(res);
    return result;
  }

  @ApiOperation({ summary: 'Get the currently authenticated user profile' })
  @ApiCookieAuth()
  @ApiResponse({
    status: 200,
    type: MeResponseDto,
    description: 'User data with roles and permissions',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated',
    type: ErrorResponseDto,
  })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: CachedUser) {
    return user;
  }

  @ApiOperation({
    summary: 'Refresh the session (reads the refresh cookie, rotates it)',
  })
  @ApiResponse({
    status: 201,
    type: RefreshResponseDto,
    description:
      'New access cookie; new refresh cookie too, except within 30 s of a concurrent rotation',
  })
  @ApiResponse({
    status: 401,
    description:
      'auth.refresh.invalid_token (missing, malformed or expired), auth.refresh.token_revoked (session gone), auth.refresh.token_reused (old token replayed: session revoked)',
    type: ErrorResponseDto,
  })
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.refresh(
      this.authCookies.readRefresh(req),
    );
    this.authCookies.setAccess(res, tokens.access_token);
    if (tokens.refresh_token) {
      this.authCookies.setRefresh(res, tokens.refresh_token);
    }
    return {
      message: 'Session refreshed',
      code: ResponseCodes.AUTH_REFRESH_SUCCESS,
    };
  }

  @ApiOperation({
    summary: 'Sign out (revokes the session, clears the cookies)',
  })
  @ApiResponse({
    status: 201,
    type: LogoutResponseDto,
    description: 'Session revoked, cookies cleared',
  })
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.logout(
      this.authCookies.readRefresh(req),
    );
    this.authCookies.clear(res);
    return result;
  }

  @ApiOperation({ summary: 'Revoke all sessions' })
  @ApiCookieAuth()
  @ApiResponse({
    status: 200,
    type: LogoutAllResponseDto,
    description: 'All refresh tokens revoked',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated',
    type: ErrorResponseDto,
  })
  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  async logoutAll(
    @CurrentUser() user: CachedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.logoutAll(user.id);
    this.authCookies.clear(res);
    return result;
  }

  @ApiOperation({ summary: 'List active sessions' })
  @ApiCookieAuth()
  @ApiPaginatedResponse(
    OwnSessionResponseDto,
    'Paginated list of active sessions',
  )
  @ApiResponse({
    status: 401,
    description: 'Not authenticated',
    type: ErrorResponseDto,
  })
  @ApiValidationError(
    'Invalid query parameter (page, limit, sortBy, sortOrder or filter) — code: validation.failed',
  )
  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  getSessions(
    @CurrentUser() user: CachedUser,
    @Query() query: FindSessionsQueryDto,
    @Req() req: Request,
  ) {
    return this.authService.getSessions(
      user.id,
      query,
      this.authCookies.readRefresh(req),
    );
  }

  @ApiOperation({ summary: 'Revoke a specific session' })
  @ApiCookieAuth()
  @ApiResponse({
    status: 200,
    type: SessionRevokedResponseDto,
    description: 'Session revoked',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found',
    type: ErrorResponseDto,
  })
  @ApiInvalidIdError()
  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:id')
  async revokeSession(
    @CurrentUser() user: CachedUser,
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.revokeSession(user.id, id);
    if (
      this.authService.sessionIdOf(this.authCookies.readRefresh(req)) === id
    ) {
      this.authCookies.clear(res);
    }
    return result;
  }
}
