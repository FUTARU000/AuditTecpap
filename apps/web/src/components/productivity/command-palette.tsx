'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CornerDownLeft, Search } from 'lucide-react';
import type { GroupedSearchResultDto, RecentItemDto } from '@tecpap/types';
import { Input } from '@tecpap/ui';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';

const PAGES: { label: string; href: string; kw: string }[] = [
  { label: 'Dashboard', href: '/dashboard', kw: 'dashboard accueil' },
  { label: 'My workspace', href: '/workspace', kw: 'workspace mon espace' },
  { label: 'Tasks', href: '/tasks', kw: 'tasks tâches' },
  { label: 'Calendar', href: '/calendar', kw: 'calendar calendrier' },
  { label: 'Notifications', href: '/notifications', kw: 'notifications' },
  { label: 'Favorites', href: '/favorites', kw: 'favorites favoris' },
  { label: 'Documents', href: '/documents', kw: 'documents' },
  { label: 'Audits', href: '/audits', kw: 'audits' },
  { label: 'CAPA', href: '/capas', kw: 'capa corrective' },
  { label: 'KPIs', href: '/kpis', kw: 'kpi indicators indicateurs' },
  { label: 'Risks', href: '/risks', kw: 'risks risques' },
  { label: 'Import', href: '/import', kw: 'import migration' },
  { label: 'Search', href: '/search', kw: 'search recherche' },
];

export function CommandPalette() {
  const { t } = useTranslation();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GroupedSearchResultDto | null>(null);
  const [recent, setRecent] = useState<RecentItemDto[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults(null);
      api.get<RecentItemDto[]>('/recent-items').then(setRecent).catch(() => undefined);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 2) { setResults(null); return; }
    const h = setTimeout(() => {
      api.get<GroupedSearchResultDto>('/search', { q: query }).then(setResults).catch(() => setResults(null));
    }, 250);
    return () => clearTimeout(h);
  }, [query]);

  const filteredPages = useMemo(() => PAGES.filter((p) => p.label.toLowerCase().includes(query.toLowerCase()) || p.kw.includes(query.toLowerCase())), [query]);
  const flatResults = useMemo(() => (results?.groups ?? []).flatMap((g) => g.results.map((r) => ({ ...r, group: g.label, entityType: g.type }))), [results]);

  function go(href: string, recent?: { entityType: string; entityId: string; label: string; href: string }) {
    setOpen(false);
    if (recent) api.post('/recent-items', recent).catch(() => undefined);
    router.push(href);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-foreground/40 p-4 pt-[12vh]" onClick={() => setOpen(false)}>
      <div className="w-full max-w-xl overflow-hidden rounded-lg border border-border bg-background shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="size-4 text-muted-foreground" />
          <Input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('palette.placeholder')} className="h-11 border-0 px-0 focus-visible:ring-0" />
          <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:block">ESC</kbd>
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-2">
          {filteredPages.length > 0 ? (
            <Section title={t('palette.pages')}>
              {filteredPages.map((p) => <Row key={p.href} title={p.label} onClick={() => go(p.href)} />)}
            </Section>
          ) : null}

          {query.trim().length < 2 && recent.length > 0 ? (
            <Section title={t('palette.results')}>
              {recent.slice(0, 6).map((r) => <Row key={r.id} title={r.label} subtitle={r.entityType} onClick={() => go(r.href)} />)}
            </Section>
          ) : null}

          {flatResults.length > 0 ? (
            <Section title={t('palette.results')}>
              {flatResults.slice(0, 12).map((r) => <Row key={`${r.group}-${r.id}`} title={r.title} subtitle={r.group} onClick={() => go(r.href, { entityType: r.entityType, entityId: r.id, label: r.title, href: r.href })} />)}
            </Section>
          ) : null}

          {query.trim().length >= 2 && flatResults.length === 0 && filteredPages.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">{t('palette.no_results')}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="mb-1"><p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{title}</p>{children}</div>;
}

function Row({ title, subtitle, onClick }: { title: string; subtitle?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent">
      <span className="truncate text-foreground">{title}</span>
      <span className="flex items-center gap-2 text-xs text-muted-foreground">{subtitle}<CornerDownLeft className="size-3 opacity-50" /></span>
    </button>
  );
}
