import {
  Controller,
  Post,
  Body,
  Get,
  Delete,
  Query,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { ResendVerificationDto } from './dto/resend-verification.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { FindSessionsQueryDto } from './dto/find-sessions-query.dto.js';
import { RegisterResponseDto } from './dto/register-response.dto.js';
import {
  LoginResponseDto,
  TokensResponseDto,
} from './dto/login-response.dto.js';
import { MeResponseDto } from './dto/me-response.dto.js';
import { SessionResponseDto } from './dto/session-response.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { THROTTLE } from '../../common/constants.js';
import { MessageResponseDto } from '../../common/dto/message-response.dto.js';
import { ErrorResponseDto } from '../../common/dto/error-response.dto.js';
import { ValidationErrorResponseDto } from '../../common/dto/validation-error-response.dto.js';
import { ApiPaginatedResponse } from '../../common/pagination/index.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, type: RegisterResponseDto, description: 'User created' })
  @ApiResponse({ status: 400, description: 'Validation failed (email format, password format) or callbackUrl not in whitelist — code: auth.callback_url.not_allowed', type: ValidationErrorResponseDto })
  @ApiResponse({ status: 409, description: 'Email already in use', type: ErrorResponseDto })
  @ApiResponse({ status: 429, description: 'Too many attempts — code: throttle.too_many_requests, params.retryAfter: seconds until retry', type: ErrorResponseDto })
  @Throttle({ global: THROTTLE.AUTH })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @ApiOperation({ summary: 'Sign in (returns a JWT)' })
  @ApiResponse({ status: 200, type: LoginResponseDto, description: 'JWT token returned' })
  @ApiResponse({ status: 401, description: 'Invalid email or password', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Account temporarily locked', type: ErrorResponseDto })
  @ApiResponse({ status: 429, description: 'Too many attempts — code: throttle.too_many_requests, params.retryAfter: seconds until retry', type: ErrorResponseDto })
  @Throttle({ global: THROTTLE.AUTH })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @ApiOperation({ summary: 'Verify email address with the token received by email' })
  @ApiResponse({ status: 200, type: MessageResponseDto, description: 'Email verified successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired token', type: ErrorResponseDto })
  @Get('verify-email')
  verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @ApiOperation({ summary: 'Resend verification email' })
  @ApiResponse({ status: 200, type: MessageResponseDto, description: 'Email sent if account exists and is not verified' })
  @ApiResponse({ status: 400, description: 'callbackUrl not in whitelist — code: auth.callback_url.not_allowed', type: ErrorResponseDto })
  @ApiResponse({ status: 429, description: 'Too many attempts — code: throttle.too_many_requests, params.retryAfter: seconds until retry', type: ErrorResponseDto })
  @Throttle({ global: THROTTLE.SENSITIVE })
  @Post('resend-verification')
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerificationEmail(dto.email, dto.callbackUrl);
  }

  @ApiOperation({ summary: 'Request a password reset' })
  @ApiResponse({ status: 200, type: MessageResponseDto, description: 'Email sent if account exists' })
  @ApiResponse({ status: 400, description: 'callbackUrl not in whitelist — code: auth.callback_url.not_allowed', type: ErrorResponseDto })
  @ApiResponse({ status: 429, description: 'Too many attempts — code: throttle.too_many_requests, params.retryAfter: seconds until retry', type: ErrorResponseDto })
  @Throttle({ global: THROTTLE.SENSITIVE })
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email, dto.callbackUrl);
  }

  @ApiOperation({ summary: 'Reset password with the token received by email' })
  @ApiResponse({ status: 200, type: MessageResponseDto, description: 'Password reset, all sessions revoked' })
  @ApiResponse({ status: 400, description: 'Validation failed (password format)', type: ValidationErrorResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid or expired token', type: ErrorResponseDto })
  @ApiResponse({ status: 429, description: 'Too many attempts — code: throttle.too_many_requests, params.retryAfter: seconds until retry', type: ErrorResponseDto })
  @Throttle({ global: THROTTLE.PASSWORD_RESET })
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @ApiOperation({ summary: 'Get the currently authenticated user profile' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, type: MeResponseDto, description: 'User data with roles and permissions' })
  @ApiResponse({ status: 401, description: 'Not authenticated', type: ErrorResponseDto })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Request() req: any) {
    return req.user;
  }

  @ApiOperation({ summary: 'Refresh tokens (rotation)' })
  @ApiResponse({ status: 200, type: TokensResponseDto, description: 'New access_token + refresh_token pair' })
  @ApiResponse({ status: 401, description: 'Refresh token invalid or revoked', type: ErrorResponseDto })
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refresh_token);
  }

  @ApiOperation({ summary: 'Sign out (revoke the refresh token)' })
  @ApiResponse({ status: 200, type: MessageResponseDto, description: 'Refresh token revoked' })
  @Post('logout')
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refresh_token);
  }

  @ApiOperation({ summary: 'Revoke all sessions' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, type: MessageResponseDto, description: 'All refresh tokens revoked' })
  @ApiResponse({ status: 401, description: 'Not authenticated', type: ErrorResponseDto })
  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  logoutAll(@Request() req: any) {
    return this.authService.logoutAll(req.user.id);
  }

  @ApiOperation({ summary: 'List active sessions' })
  @ApiBearerAuth()
  @ApiPaginatedResponse(SessionResponseDto, 'Paginated list of active sessions')
  @ApiResponse({ status: 401, description: 'Not authenticated', type: ErrorResponseDto })
  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  getSessions(@Request() req: any, @Query() query: FindSessionsQueryDto) {
    return this.authService.getSessions(req.user.id, query);
  }

  @ApiOperation({ summary: 'Revoke a specific session' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, type: MessageResponseDto, description: 'Session revoked' })
  @ApiResponse({ status: 401, description: 'Not authenticated', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Session not found', type: ErrorResponseDto })
  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:id')
  revokeSession(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.authService.revokeSession(req.user.id, id);
  }
}
