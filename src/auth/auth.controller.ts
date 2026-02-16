import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

@Controller('auth')  // Toutes les routes commencent par /auth
export class AuthController {
  constructor(private authService: AuthService) {}

  // POST /auth/register — Inscription
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // POST /auth/login — Connexion (retourne un JWT)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  // GET /auth/me — Route protégée : retourne l'utilisateur connecté
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Request() req: any) {
    // req.user est rempli automatiquement par JwtStrategy.validate()
    return req.user;
  }
}
