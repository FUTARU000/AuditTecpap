'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { useAuth } from '@/lib/auth-context';

const TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/documents': 'Documents',
  '/processes': 'Processes',
  '/audit-templates': 'Audit templates',
  '/audits': 'Audits',
  '/capas': 'CAPA',
  '/business-objects': 'Business objects',
  '/kpis': 'KPIs',
  '/risks': 'Risks',
  '/search': 'Search',
  '/admin/users': 'Users',
  '/admin/roles': 'Roles',
  '/admin/permissions': 'Permissions',
  '/admin/departments': 'Departments',
  '/admin/categories': 'Categories',
  '/admin/audit-log': 'Audit log',
};

function deriveTitle(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname];
  if (pathname.startsWith('/processes/')) return 'Process workspace';
  if (pathname.startsWith('/business-objects/')) return 'Business object';
  if (pathname.startsWith('/audit-templates/')) return 'Template';
  if (pathname.startsWith('/audits/')) return 'Audit execution';
  if (pathname.startsWith('/capas/')) return 'CAPA workspace';
  return 'TECPAP Audit';
}

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const title = deriveTitle(pathname);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setMobileOpen(true)} title={title} />
        <main className="flex-1 px-4 py-6 lg:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
