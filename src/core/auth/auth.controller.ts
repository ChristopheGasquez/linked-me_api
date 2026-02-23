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
import { ApiPaginatedResponse } from '../../common/pagination/index.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiOperation({ summary: "Inscription d'un nouvel utilisateur" })
  @ApiResponse({ status: 201, type: RegisterResponseDto, description: 'Utilisateur créé' })
  @ApiResponse({
    status: 400,
    description: 'Données invalides (email, format de mot de passe)',
  })
  @ApiResponse({ status: 409, description: 'Email déjà utilisé' })
  @ApiResponse({
    status: 429,
    description: 'Trop de tentatives, réessaye dans 15 minutes',
  })
  @Throttle({ global: THROTTLE.AUTH })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @ApiOperation({ summary: 'Connexion (retourne un JWT)' })
  @ApiResponse({ status: 200, type: LoginResponseDto, description: 'Token JWT retourné' })
  @ApiResponse({ status: 401, description: 'Email ou mot de passe incorrect' })
  @ApiResponse({ status: 403, description: 'Compte temporairement verrouillé' })
  @ApiResponse({
    status: 429,
    description: 'Trop de tentatives, réessaye dans 15 minutes',
  })
  @Throttle({ global: THROTTLE.AUTH })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @ApiOperation({
    summary: "Vérifier l'adresse email via le token reçu par mail",
  })
  @ApiResponse({ status: 200, type: MessageResponseDto, description: 'Email vérifié avec succès' })
  @ApiResponse({ status: 401, description: 'Token invalide ou expiré' })
  @Get('verify-email')
  verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @ApiOperation({ summary: "Renvoyer l'email de vérification" })
  @ApiResponse({
    status: 200,
    type: MessageResponseDto,
    description: "Email renvoyé si le compte existe et n'est pas vérifié",
  })
  @ApiResponse({
    status: 429,
    description: 'Trop de tentatives, réessaye dans 1 heure',
  })
  @Throttle({ global: THROTTLE.SENSITIVE })
  @Post('resend-verification')
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerificationEmail(dto.email);
  }

  @ApiOperation({ summary: 'Demander une réinitialisation de mot de passe' })
  @ApiResponse({ status: 200, type: MessageResponseDto, description: 'Email envoyé si le compte existe' })
  @ApiResponse({
    status: 429,
    description: 'Trop de tentatives, réessaye dans 1 heure',
  })
  @Throttle({ global: THROTTLE.SENSITIVE })
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @ApiOperation({
    summary: 'Réinitialiser le mot de passe avec le token reçu par email',
  })
  @ApiResponse({
    status: 200,
    type: MessageResponseDto,
    description: 'Mot de passe réinitialisé, toutes les sessions révoquées',
  })
  @ApiResponse({
    status: 400,
    description: 'Mot de passe invalide (format non respecté)',
  })
  @ApiResponse({ status: 401, description: 'Token invalide ou expiré' })
  @ApiResponse({ status: 429, description: 'Trop de tentatives' })
  @Throttle({ global: THROTTLE.PASSWORD_RESET })
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @ApiOperation({ summary: "Profil de l'utilisateur connecté" })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    type: MeResponseDto,
    description: "Données de l'utilisateur avec rôles et permissions",
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Request() req: any) {
    return req.user;
  }

  @ApiOperation({ summary: 'Rafraîchir les tokens (rotation)' })
  @ApiResponse({
    status: 200,
    type: TokensResponseDto,
    description: 'Nouvelle paire access_token + refresh_token',
  })
  @ApiResponse({
    status: 401,
    description: 'Refresh token invalide ou révoqué',
  })
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refresh_token);
  }

  @ApiOperation({ summary: 'Déconnexion (révoque le refresh token)' })
  @ApiResponse({ status: 200, type: MessageResponseDto, description: 'Refresh token révoqué' })
  @Post('logout')
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refresh_token);
  }

  @ApiOperation({ summary: 'Révoquer toutes les sessions' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, type: MessageResponseDto, description: 'Tous les refresh tokens révoqués' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  logoutAll(@Request() req: any) {
    return this.authService.logoutAll(req.user.id);
  }

  @ApiOperation({ summary: 'Lister les sessions actives' })
  @ApiBearerAuth()
  @ApiPaginatedResponse(SessionResponseDto, 'Liste paginée des sessions actives')
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  getSessions(@Request() req: any, @Query() query: FindSessionsQueryDto) {
    return this.authService.getSessions(req.user.id, query);
  }

  @ApiOperation({ summary: 'Révoquer une session spécifique' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, type: MessageResponseDto, description: 'Session révoquée' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 404, description: 'Session introuvable' })
  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:id')
  revokeSession(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.authService.revokeSession(req.user.id, id);
  }
}
