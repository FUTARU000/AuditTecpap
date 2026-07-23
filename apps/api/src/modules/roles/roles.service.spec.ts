import { BadRequestException, ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditLogInput } from '../audit-log/audit-log.service';
import type { PrismaService } from '../prisma/prisma.service';
import { RolesService } from './roles.service';

const ACTOR: { actorId: string; ipAddress: null; userAgent: null } = { actorId: 'admin', ipAddress: null, userAgent: null };

function mockRecord() {
  return vi.fn<(input: AuditLogInput) => Promise<void>>().mockResolvedValue(undefined);
}

describe('RolesService', () => {
  type MockFn = ReturnType<typeof vi.fn>;
  interface MockPrisma {
    role: {
      findUnique: MockFn;
      findFirst: MockFn;
      findMany: MockFn;
      count: MockFn;
      create: MockFn;
      update: MockFn;
      delete: MockFn;
    };
    permission: { findMany: MockFn };
  }

  let service: RolesService;
  let prisma: MockPrisma;
  let audit: { record: ReturnType<typeof mockRecord> };

  beforeEach(() => {
    prisma = {
      role: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      permission: { findMany: vi.fn() },
    };
    audit = { record: mockRecord() };
    service = new RolesService(prisma as unknown as PrismaService, audit as never);
  });

  it('creates a custom role with a slugified unique slug and audits it', async () => {
    prisma.permission.findMany.mockResolvedValue([{ key: 'users.read' }, { key: 'users.create' }]);
    prisma.role.findFirst.mockResolvedValue(null);
    prisma.role.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({
        id: 'r2',
        name: data.name,
        slug: 'quality-officer',
        description: data.description,
        isSystem: false,
        isGlobal: data.isGlobal,
        permissions: [{ key: 'users.read' }, { key: 'users.create' }],
        _count: { users: 0 },
        createdAt: new Date(0),
        updatedAt: new Date(0),
      }),
    );

    const role = await service.create(
      { name: 'Quality Officer', permissions: ['users.read', 'users.create'] },
      ACTOR,
    );

    expect(role.slug).toBe('quality-officer');
    expect(role.isSystem).toBe(false);
    expect(prisma.role.create).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalled();
  });

  it('rejects unknown permission keys', async () => {
    prisma.permission.findMany.mockResolvedValue([{ key: 'users.read' }]);
    await expect(
      service.create({ name: 'Bad', permissions: ['users.read', 'bogus.key'] }, ACTOR),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('prevents deletion of system roles', async () => {
    prisma.role.findUnique.mockResolvedValue({ id: 'r1', name: 'Administrator', isSystem: true, _count: { users: 0 } });
    await expect(service.remove('r1', ACTOR)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.role.delete).not.toHaveBeenCalled();
  });

  it('prevents deletion when the role still has users', async () => {
    prisma.role.findUnique.mockResolvedValue({ id: 'r2', name: 'Custom', isSystem: false, _count: { users: 3 } });
    await expect(service.remove('r2', ACTOR)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.role.delete).not.toHaveBeenCalled();
  });

  it('slugifies accented names and produces a clean slug', async () => {
    prisma.permission.findMany.mockResolvedValue([]);
    prisma.role.findFirst.mockResolvedValue(null);
    prisma.role.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({
        id: 'r3',
        name: data.name,
        slug: 'responsable-qualite',
        description: null,
        isSystem: false,
        isGlobal: false,
        permissions: [],
        _count: { users: 0 },
        createdAt: new Date(0),
        updatedAt: new Date(0),
      }),
    );
    const role = await service.create({ name: 'Responsable Qualité', permissions: [] }, ACTOR);
    expect(prisma.role.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ slug: 'responsable-qualite' }) }),
    );
    expect(role.id).toBe('r3');
  });
});
