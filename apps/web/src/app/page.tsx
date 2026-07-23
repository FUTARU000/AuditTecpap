import Link from 'next/link';
import { ArrowRight, ClipboardCheck, ShieldCheck, BarChart3 } from 'lucide-react';
import { Badge, Button, Card, CardContent } from '@tecpap/ui';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between px-6 py-4 lg:px-10">
        <div className="w-64 max-w-[60%] border-b-0 px-0">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ClipboardCheck className="size-5" />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-foreground">TECPAP</p>
              <p className="text-xs text-muted-foreground">Audit Platform</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard">
              Open app <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-10 px-6 py-16 text-center lg:px-10">
        <Badge variant="secondary" className="gap-1.5">
          <span className="size-1.5 rounded-full bg-secondary-foreground/70" />
          Phase 1 — Foundations
        </Badge>

        <div className="flex flex-col items-center gap-5">
          <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Centralized audit management for TECPAP
          </h1>
          <p className="max-w-2xl text-pretty text-lg text-muted-foreground">
            Replace spreadsheets, paper checklists and scattered PDFs with one secure
            platform for audit planning, execution, findings, corrective actions and reporting.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/dashboard">
              Go to dashboard <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>

        <div className="grid w-full gap-4 pt-6 text-left sm:grid-cols-3">
          {[
            {
              icon: ShieldCheck,
              title: 'Role-based & scoped',
              body: 'Pilots see only their department. Every action is traced.',
            },
            {
              icon: ClipboardCheck,
              title: 'Full audit lifecycle',
              body: 'Templates, execution, findings and corrective actions in one place.',
            },
            {
              icon: BarChart3,
              title: 'Real-time visibility',
              body: 'Dashboards and reports for management, on demand.',
            },
          ].map((f) => (
            <Card key={f.title}>
              <CardContent className="flex flex-col gap-2 p-5">
                <f.icon className="size-5 text-secondary" />
                <p className="text-sm font-medium text-foreground">{f.title}</p>
                <p className="text-sm text-muted-foreground">{f.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <footer className="border-t border-border px-6 py-4 text-center text-xs text-muted-foreground lg:px-10">
        © {new Date().getFullYear()} TECPAP · Internal Audit Department · Bouskoura, Morocco
      </footer>
    </div>
  );
}
