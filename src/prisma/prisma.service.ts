import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

// Injectable = NestJS peut injecter ce service dans d'autres classes
// OnModuleInit = exécute onModuleInit() au démarrage de l'app
// OnModuleDestroy = exécute onModuleDestroy() à l'arrêt de l'app
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // Prisma v7 nécessite un "adapter" : le pont entre Prisma et PostgreSQL
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL as string,
    });
    super({ adapter });
  }

  // Connexion automatique à PostgreSQL au démarrage
  async onModuleInit() {
    await this.$connect();
  }

  
  // Déconnexion propre à l'arrêt (évite les connexions fantômes)
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
