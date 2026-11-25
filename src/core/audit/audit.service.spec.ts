import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  createPrismaServiceMock,
  PrismaServiceMock,
} from '../prisma/prisma.service.mock.js';
import { testId } from '../../../test/setup/test-id.js';

const mockAuditLog = {
  id: testId(1),
  action: 'user.create',
  actorId: testId(1),
  targetId: testId(1),
  targetType: 'user',
  metadata: { email: 'test@example.com' },
  createdAt: new Date('2024-01-01'),
};

const defaultQuery = {
  page: 1,
  limit: 20,
  sortBy: 'createdAt',
  sortOrder: 'desc' as const,
};

describe('AuditService', () => {
  let service: AuditService;
  let prisma: PrismaServiceMock;

  beforeEach(async () => {
    prisma = createPrismaServiceMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // log()
  // ─────────────────────────────────────────────────────────────
  describe('log()', () => {
    it('should create an audit log entry with the correct fields', async () => {
      prisma.auditLog.create.mockResolvedValue(mockAuditLog as any);

      await service.log('user.create', testId(1), testId(1), 'user', {
        email: 'test@example.com',
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: 'user.create',
          actorId: testId(1),
          targetId: testId(1),
          targetType: 'user',
          metadata: { email: 'test@example.com' },
        },
      });
    });

    it('should accept null actorId and targetId', async () => {
      prisma.auditLog.create.mockResolvedValue({} as any);

      await service.log('login.failed', null, testId(1), 'user');

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ actorId: null }),
      });
    });

    it('should accept undefined metadata (not passed)', async () => {
      prisma.auditLog.create.mockResolvedValue({} as any);

      await service.log('email.verified', testId(1), testId(1), 'user');

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ metadata: undefined }),
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findAll()
  // ─────────────────────────────────────────────────────────────
  describe('findAll()', () => {
    it('should return paginated audit logs without filters', async () => {
      prisma.auditLog.findMany.mockResolvedValue([mockAuditLog] as any);
      prisma.auditLog.count.mockResolvedValue(1);

      const result = await service.findAll(defaultQuery);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('should filter by action when provided', async () => {
      prisma.auditLog.findMany.mockResolvedValue([] as any);
      prisma.auditLog.count.mockResolvedValue(0);

      await service.findAll({ ...defaultQuery, action: 'user.create' } as any);

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { action: 'user.create' } }),
      );
    });

    it('should filter by actorId when provided', async () => {
      prisma.auditLog.findMany.mockResolvedValue([] as any);
      prisma.auditLog.count.mockResolvedValue(0);

      await service.findAll({ ...defaultQuery, actorId: testId(5) } as any);

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { actorId: testId(5) } }),
      );
    });

    it('should filter by targetId when provided', async () => {
      prisma.auditLog.findMany.mockResolvedValue([] as any);
      prisma.auditLog.count.mockResolvedValue(0);

      await service.findAll({ ...defaultQuery, targetId: testId(7) } as any);

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { targetId: testId(7) } }),
      );
    });

    it('should filter by targetType when provided', async () => {
      prisma.auditLog.findMany.mockResolvedValue([] as any);
      prisma.auditLog.count.mockResolvedValue(0);

      await service.findAll({ ...defaultQuery, targetType: 'role' } as any);

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { targetType: 'role' } }),
      );
    });
  });
});
