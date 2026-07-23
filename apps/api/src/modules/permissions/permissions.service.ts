import { Injectable } from '@nestjs/common';
import type { PermissionDefinition } from '@tecpap/config';
import type { PermissionCatalogResponse } from '@tecpap/types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns the live, DB-driven permission catalog grouped by module. */
  async catalog(): Promise<PermissionCatalogResponse> {
    const rows = await this.prisma.permission.findMany({
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    });

    const grouped = new Map<string, PermissionDefinition[]>();
    for (const row of rows) {
      const list = grouped.get(row.group) ?? [];
      list.push({
        key: row.key,
        label: row.label ?? row.key,
        description: row.description ?? undefined,
      });
      grouped.set(row.group, list);
    }

    return {
      groups: [...grouped.entries()].map(([group, permissions]) => ({ group, permissions })),
      total: rows.length,
    };
  }
}
