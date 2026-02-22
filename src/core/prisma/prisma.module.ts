import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

// @Global() = ce module est disponible partout sans avoir à l'importer
// dans chaque module. Sans ça, il faudrait ajouter PrismaModule
// dans les imports de AuthModule, UsersModule, PostsModule, etc.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // exports = les autres modules peuvent utiliser PrismaService
})
export class PrismaModule {}
