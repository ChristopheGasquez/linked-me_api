import { mockDeep, DeepMockProxy } from 'vitest-mock-extended';
import { PrismaService } from './prisma.service.js';

export type PrismaServiceMock = DeepMockProxy<PrismaService>;

export const createPrismaServiceMock = (): PrismaServiceMock =>
  mockDeep<PrismaService>();
