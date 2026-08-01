'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import type { UserTaskDto } from '@tecpap/types';
import { Badge, Button } from '@tecpap/ui';
import { cn } from '@tecpap/ui';
import { api, RequestError } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { EmptyState, ErrorState, PageHeader } from '@/components/admin/common';

const PRIORITY: Record<string, 'secondary' | 'warning' | 'danger'> = { LOW: 'secondary', MEDIUM: 'secondary', HIGH: 'warning', CRITICAL: 'danger' };

export default function TasksPage() {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<UserTaskDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setTasks(await api.get<UserTaskDto[]>('/tasks')); setError(null); } catch (err) { setError(err instanceof RequestError ? err.message : 'Failed to load.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function act(task: UserTaskDto, action: 'complete' | 'dismiss') {
    try {
      if (action === 'complete') await api.post('/tasks/complete', { entityType: task.entityType, entityId: task.entityId, completed: !task.completed });
      else await api.post('/tasks/dismiss', { entityType: task.entityType, entityId: task.entityId });
      await load();
    } catch { /* ignore */ }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <PageHeader title={t('productivity.tasks')} />
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : !tasks ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />)}</div>
      ) : tasks.length === 0 ? (
        <EmptyState title={t('productivity.no_tasks')} />
      ) : (
        <ul className="flex flex-col gap-2">
          {tasks.map((task) => (
            <li key={`${task.entityType}:${task.entityId}`} className={cn('flex items-center gap-3 rounded-lg border border-border bg-card p-3', task.completed && 'opacity-60')}>
              <button type="button" onClick={() => void act(task, 'complete')} className={cn('flex size-5 shrink-0 items-center justify-center rounded border', task.completed ? 'border-success-fg bg-success-fg text-success' : 'border-border hover:border-primary')} aria-label="Complete">
                {task.completed ? <Check className="size-3" /> : null}
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn('truncate text-sm font-medium text-foreground', task.completed && 'line-through')}>{task.title}</p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <Badge variant={PRIORITY[task.priority] ?? 'secondary'} className="text-[10px]">{task.priority}</Badge>
                  <span className="uppercase">{task.source}</span>
                  {task.dueDate ? <span>{t('productivity.deadline')}: {new Date(task.dueDate).toLocaleDateString()}</span> : null}
                </div>
              </div>
              {!task.completed ? <Button size="icon" variant="ghost" className="size-7 shrink-0" onClick={() => void act(task, 'dismiss')} aria-label="Dismiss"><X className="size-3.5" /></Button> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
