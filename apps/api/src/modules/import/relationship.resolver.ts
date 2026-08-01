import { Injectable, Logger } from '@nestjs/common';
import { RELATION_INFERENCE } from '@tecpap/config';
import type { ActorContext } from '../../common/context/actor';
import { BusinessRelationshipsService } from '../business-objects/business-relationships.service';

export interface MaterializedDoc {
  id: string;
  title: string;
}

/**
 * Infers typed relationships between materialized documents using keyword rules
 * (Procedure USES Checklist, Instruction REFERENCES Specification, Audit
 * GENERATES Finding, …). All edges are stored via the existing polymorphic
 * BusinessRelationship engine — no new relationship storage.
 */
@Injectable()
export class RelationshipResolver {
  private readonly logger = new Logger(RelationshipResolver.name);
  constructor(private readonly relationships: BusinessRelationshipsService) {}

  async resolve(docs: MaterializedDoc[], actor: ActorContext): Promise<number> {
    let created = 0;
    for (let i = 0; i < docs.length; i++) {
      for (let j = 0; j < docs.length; j++) {
        if (i === j) continue;
        const source = docs[i];
        const target = docs[j];
        if (!source || !target) continue;
        const rule = RELATION_INFERENCE.find((r) => r.from.some((k) => source.title.toLowerCase().includes(k)) && r.to.some((k) => target.title.toLowerCase().includes(k)));
        if (!rule) continue;
        try {
          await this.relationships.create(
            { sourceType: 'document', sourceId: source.id, targetType: 'document', targetId: target.id, type: rule.type },
            actor,
          );
          created++;
        } catch {
          // (source,target,type) may already exist — uniqueness violation is expected and safe.
        }
      }
    }
    if (created) this.logger.log(`Inferred ${created} document relationship(s).`);
    return created;
  }
}
