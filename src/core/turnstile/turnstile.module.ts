import { Global, Module } from '@nestjs/common';
import { TurnstileGuard } from './turnstile.guard.js';
import { TurnstileService } from './turnstile.service.js';

@Global()
@Module({
  providers: [TurnstileService, TurnstileGuard],
  exports: [TurnstileService, TurnstileGuard],
})
export class TurnstileModule {}
