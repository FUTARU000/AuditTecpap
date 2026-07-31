export interface ActivityTimelineDto {
  id: string;
  processId: string | null;
  eventType: string;
  title: string;
  entityType: string;
  entityId: string | null;
  actorName: string | null;
  createdAt: string;
}
