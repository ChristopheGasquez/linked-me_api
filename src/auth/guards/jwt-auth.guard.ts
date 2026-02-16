import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Guard qui utilise automatiquement la JwtStrategy
// On l'appliquera sur les routes protégées avec @UseGuards(JwtAuthGuard)
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
