'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@tecpap/ui';
import { navSections, type NavItem } from '@/lib/navigation';
import { useAuth } from '@/lib/auth-context';
import { useTranslation } from '@/lib/i18n';

interface NavListProps {
  onNavigate?: () => void;
}

export function NavList({ onNavigate }: NavListProps) {
  const pathname = usePathname();
  const { hasPermission } = useAuth();
  const { t } = useTranslation();

  return (
    <nav className="flex flex-col gap-6 px-3 py-4" aria-label="Main navigation">
      {navSections.map((section) => {
        const visible = section.items.filter(
          (item) => !item.permission || hasPermission(item.permission),
        );
        if (visible.length === 0) {
          return null;
        }
        return (
          <div key={section.title} className="flex flex-col gap-1">
            <p className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t(`section.${section.title}`, section.title)}
            </p>
            {visible.map((item) => (
              <NavRow key={item.label} item={item} pathname={pathname} onNavigate={onNavigate} />
            ))}
          </div>
        );
      })}
    </nav>
  );
}

interface NavRowProps {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}

function NavRow({ item, pathname, onNavigate }: NavRowProps) {
  const { t } = useTranslation();
  const Icon = item.icon;
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-foreground/80 hover:bg-accent hover:text-accent-foreground',
      )}
    >
      <Icon className="size-[18px]" />
      <span>{t(`nav.${item.label}`, item.label)}</span>
    </Link>
  );
}
