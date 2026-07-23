import { Building2 } from 'lucide-react';

export function Logo() {
  return (
    <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
      <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Building2 className="size-5" />
      </span>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-foreground">TECPAP</p>
        <p className="text-xs text-muted-foreground">Audit Platform</p>
      </div>
    </div>
  );
}
