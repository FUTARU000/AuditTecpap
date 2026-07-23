import { Award, CheckCircle2, Clock, FlagTriangleRight, ListChecks } from 'lucide-react';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@tecpap/ui';
import type { LucideIcon } from 'lucide-react';

const placeholderKpis: Array<{ label: string; icon: LucideIcon; hint: string }> = [
  { label: 'Open audits', icon: Clock, hint: 'Scheduled & in progress' },
  { label: 'Closed audits', icon: CheckCircle2, hint: 'Validated this period' },
  { label: 'Open findings', icon: FlagTriangleRight, hint: 'Across all departments' },
  { label: 'Corrective actions', icon: ListChecks, hint: 'Open / overdue' },
  { label: 'Certificates expiring', icon: Award, hint: 'Within 90 days' },
];

export default function DashboardPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Dashboard</h2>
          <Badge variant="outline" className="border-dashed text-muted-foreground">
            Placeholder
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Real-time KPIs, charts and activity will populate here in a later phase.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {placeholderKpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between">
                <kpi.icon className="size-5 text-muted-foreground" />
                <span className="text-2xl font-semibold text-muted-foreground/40">—</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{kpi.label}</p>
                <p className="text-xs text-muted-foreground">{kpi.hint}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent audits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-48 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
              No data yet — audit execution is implemented in a later phase.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Certificates nearing expiry</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-48 items-center justify-center rounded-md border border-dashed border-border text-center text-sm text-muted-foreground">
              Certificate tracking arrives with document management.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
