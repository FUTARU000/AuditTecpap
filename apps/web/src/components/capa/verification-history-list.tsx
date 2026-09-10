import type { CapaVerificationDto } from '@tecpap/types';
import { Badge } from '@tecpap/ui';

interface VerificationHistoryListProps {
  verifications: CapaVerificationDto[];
  labels: {
    title: string;
    attempt: string;
    by: string;
    resultLabel: (result: string) => string;
  };
}

/**
 * Phase 3 — read-only audit trail of every CAPA verification attempt, oldest
 * first ("Attempt 1" ... "Attempt N"). Additional history alongside the
 * active verification control, never a replacement for it.
 */
export function VerificationHistoryList({ verifications, labels }: VerificationHistoryListProps) {
  if (verifications.length === 0) return null;
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{labels.title}</h4>
      <ul className="space-y-2">
        {verifications.map((v, i) => (
          <li key={v.id} className="rounded-md border border-border p-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">{labels.attempt} {i + 1}</span>
              <Badge variant={v.result === 'PASSED' ? 'success' : 'danger'}>{labels.resultLabel(v.result)}</Badge>
            </div>
            <p className="mt-1 text-muted-foreground">{labels.by}: {v.verifiedByName ?? '—'} · {new Date(v.verifiedAt).toLocaleString()}</p>
            {v.notes ? <p className="mt-1 text-muted-foreground">{v.notes}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
