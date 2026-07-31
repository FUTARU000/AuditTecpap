'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import type { GroupedSearchResultDto } from '@tecpap/types';
import { Badge, Input } from '@tecpap/ui';
import { api, RequestError } from '@/lib/api';
import { EmptyState, ErrorState, PageHeader } from '@/components/admin/common';
import { useTranslation } from '@/lib/i18n';

function SearchResults() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const term = searchParams.get('q') ?? '';
  const [input, setInput] = useState(term);
  const { t } = useTranslation();
  const [data, setData] = useState<GroupedSearchResultDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setInput(term); }, [term]);

  useEffect(() => {
    if (term.trim().length < 2) { setData(null); return; }
    setLoading(true);
    setError(null);
    api.get<GroupedSearchResultDto>('/search', { q: term })
      .then(setData)
      .catch((err) => setError(err instanceof RequestError ? err.message : 'Search failed.'))
      .finally(() => setLoading(false));
  }, [term]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = input.trim();
    if (next) router.push(`/search?q=${encodeURIComponent(next)}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader title={t('page.search', 'Search')} description={t('page.search_desc')} />
      <form onSubmit={submit} className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search everything…" className="h-11 pl-9" value={input} onChange={(event) => setInput(event.target.value)} autoFocus />
      </form>

      {term.trim().length < 2 ? (
        <EmptyState title="Type at least 2 characters" />
      ) : error ? (
        <ErrorState message={error} />
      ) : loading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-md border border-border bg-card" />)}</div>
      ) : !data || data.total === 0 ? (
        <EmptyState title="No matches" description={`Nothing matched “${term}”.`} />
      ) : (
        <div className="flex flex-col gap-5">
          {data.groups.map((group) => (
            <section key={group.type}>
              <div className="mb-2 flex items-center gap-2">
                <Badge variant="outline">{group.label}</Badge>
                <span className="text-xs text-muted-foreground">{group.results.length}</span>
              </div>
              <ul className="space-y-2">
                {group.results.map((hit) => (
                  <li key={`${group.type}-${hit.id}`}>
                    <Link href={hit.href} className="block rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent/40">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground">{hit.title}</span>
                        {hit.subtitle ? <span className="text-xs text-muted-foreground">{hit.subtitle}</span> : null}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading…</div>}>
      <SearchResults />
    </Suspense>
  );
}
