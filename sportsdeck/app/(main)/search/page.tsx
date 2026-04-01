"use client";
import { Suspense, useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';

function SearchResultsPageContent() {
  const searchParams = useSearchParams();
  const initialQ = searchParams?.get('q') || '';
  const groupsParam = searchParams?.get('groups') || '';
  const [query, setQuery] = useState(initialQ);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const GROUPS = ['threads', 'polls', 'users', 'matches', 'teams', 'tags'];
  const initialSelectedGroups = groupsParam ? groupsParam.split(',') : GROUPS;
  const [selectedGroups, setSelectedGroups] = useState<string[]>(initialSelectedGroups);
  const [showFilters, setShowFilters] = useState(false);
  const [tagOptions, setTagOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagLoading, setTagLoading] = useState(false);
  const [tagQuery, setTagQuery] = useState('');
  const tagFetchTimer = useRef<any>(null);
  const [clampLines, setClampLines] = useState<number>(2);

  const LineClamp = ({ children, lines = 2 }: any) => (
    <div
      className="break-words"
      style={{ display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
    >
      {children}
    </div>
  );

  async function doSearch(q: string, tagsArg?: string[]) {
    setLoading(true);
    setError('');
    const tagsToSend = Array.isArray(tagsArg) ? tagsArg : selectedTags;
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, tags: tagsToSend }),
      });
      const data = await res.json();
      setResults(data);
    } catch (e) {
      setError('Search failed.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialQ && initialQ.trim().length > 0) {
      void doSearch(initialQ);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-3xl w-full mx-auto p-4 min-h-screen">
      <form
        onSubmit={e => {
          e.preventDefault();
          doSearch(query);
        }}
        className="mb-6 flex flex-col sm:flex-row gap-2"
      >
        <input
          className="theme-input flex-1 rounded-xl border border-[var(--line)] px-4 py-2 text-sm bg-[var(--card)] text-[var(--foreground)]"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search anything..."
        />
        <button type="submit" className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-black shadow w-full sm:w-auto">Search</button>
      </form>
      {loading && <div className="text-center text-[var(--muted)]">Searching...</div>}
      {error && <div className="text-center text-red-500">{error}</div>}
      {results && (
        <div>
          <div className="mb-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="text-sm text-[var(--muted)]">Showing groups:</div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowFilters(s => !s)}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 py-1 text-sm"
              >
                Filters
              </button>
              {showFilters && (
                <div className="sm:absolute sm:right-0 sm:mt-2 sm:w-72 w-full mt-2 rounded-xl border border-[var(--line)] bg-[var(--card)] p-3 shadow-lg z-20">
                  <div className="mb-2 text-xs font-semibold text-[var(--muted)]">Groups</div>
                {GROUPS.map((g) => (
                  <label key={g} className="flex items-center gap-2 text-sm mb-2">
                      <input
                        type="checkbox"
                        checked={selectedGroups.includes(g)}
                        onChange={() => {
                          setSelectedGroups(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
                        }}
                        className="rounded"
                      />
                      <span className="capitalize">{g}</span>
                    </label>
                  ))}

                  <div className="mt-3">
                    <div className="text-xs font-semibold text-[var(--muted)] mb-1">Title lines</div>
                    <div>
                      <select
                        value={clampLines}
                        onChange={e => setClampLines(Number(e.target.value))}
                        className="w-full rounded px-2 py-1 text-sm border border-[var(--line)] bg-[var(--card)]"
                      >
                        <option value={1}>1 line</option>
                        <option value={2}>2 lines</option>
                        <option value={3}>3 lines</option>
                        <option value={4}>4 lines</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-2 mb-1 text-xs font-semibold text-[var(--muted)]">Tags</div>
                  <div className="mb-2">
                    <div className="flex gap-2">
                      <input
                        placeholder="Search tags..."
                        value={tagQuery}
                        onChange={e => {
                          const q = e.target.value;
                          setTagQuery(q);
                          if (tagFetchTimer.current) clearTimeout(tagFetchTimer.current);
                          tagFetchTimer.current = setTimeout(async () => {
                            if (!q) return setTagOptions([]);
                            setTagLoading(true);
                            try {
                              const r = await fetch(`/api/tags?q=${encodeURIComponent(q)}&page=1&pageSize=50`);
                              const d = await r.json();
                              setTagOptions(Array.isArray(d.items) ? d.items : []);
                            } catch (err) {
                              // ignore
                            } finally {
                              setTagLoading(false);
                            }
                          }, 250);
                        }}
                        className="w-full rounded px-2 py-1 text-sm border border-[var(--line)] bg-[var(--card)]"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          setTagLoading(true);
                          try {
                            const r = await fetch('/api/tags?page=1&pageSize=50');
                            const d = await r.json();
                            setTagOptions(Array.isArray(d.items) ? d.items : []);
                          } catch {
                            // ignore
                          } finally {
                            setTagLoading(false);
                          }
                        }}
                        className="rounded px-2 text-xs border border-[var(--line)]"
                      >
                        {tagLoading ? '...' : 'Load'}
                      </button>
                    </div>
                    <div className="max-h-36 overflow-y-auto mt-2">
                      {tagOptions.map(t => (
                        <label key={t.id} className="flex items-center gap-2 text-sm mb-1">
                          <input
                            type="checkbox"
                            checked={selectedTags.includes(t.name)}
                            onChange={() => {
                              setSelectedTags(prev => {
                                const next = prev.includes(t.name) ? prev.filter(x => x !== t.name) : [...prev, t.name];
                                // apply filter immediately
                                void doSearch(query);
                                return next;
                              });
                            }}
                          />
                          <span className="truncate">{t.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {GROUPS
            .filter((group) => selectedGroups.includes(group))
            .filter((group) => results[group] && results[group].length > 0)
            .map((group) => (
              <div key={group} className="mb-6">
                <div className="px-2 pt-2 pb-1 text-sm font-semibold text-[var(--muted)] uppercase tracking-widest">
                  {group.charAt(0).toUpperCase() + group.slice(1)}
                </div>
                <ul className="grid gap-3">
                  {results[group].map((item: any) => (
                    <li key={item.id}>
                      <Link
                        href={
                            group === 'threads'
                              ? `/forums/${item.id}`
                              : group === 'polls'
                              ? (item.threadId ?? item.post?.threadId)
                                ? `/forums/${item.threadId ?? item.post?.threadId}`
                                : `/poll/${item.id}`
                              : group === 'users'
                              ? `/profile/${item.id}`
                              : group === 'matches'
                              ? `/matches/${item.id}`
                              : group === 'teams'
                              ? `/teams/${item.id}`
                              : '#'
                          }
                        className="block p-3 rounded-xl bg-[var(--card)] hover:bg-[var(--card-soft)] text-sm transition transform-gpu hover:translate-x-1 hover:scale-[1.01] shadow-sm overflow-hidden"
                      >
                        <div className="flex items-center gap-3">
                          {group === 'users' && item.avatar && (
                            <Image src={item.avatar} alt={item.username} width={36} height={36} className="rounded-full object-cover flex-shrink-0 hidden sm:block" />
                          )}
                          {group === 'teams' && item.logoUrl && (
                            <Image src={item.logoUrl} alt={item.name} width={36} height={36} className="rounded-full object-cover flex-shrink-0 hidden sm:block" />
                          )}
                          <div className="flex-1 min-w-0">
                            {group === 'threads' && (
                              <LineClamp lines={clampLines}>
                                <div className="font-semibold text-[var(--foreground)]">{item.title}</div>
                              </LineClamp>
                            )}
                            {group === 'polls' && (
                              <LineClamp lines={clampLines}>
                                <div className="font-semibold text-[var(--foreground)]">{item.question}</div>
                              </LineClamp>
                            )}
                            {group === 'users' && (
                              <LineClamp lines={clampLines}>
                                <div className="font-medium text-[var(--foreground)]">{item.username}</div>
                              </LineClamp>
                            )}
                            {group === 'matches' && (
                              <LineClamp lines={clampLines}>
                                <div className="font-medium text-[var(--foreground)]">{item.homeTeam?.name} vs {item.awayTeam?.name}</div>
                              </LineClamp>
                            )}
                            {group === 'teams' && (
                              <LineClamp lines={clampLines}>
                                <div className="font-medium text-[var(--foreground)]">{item.name}</div>
                              </LineClamp>
                            )}
                            {group === 'tags' && (
                              <LineClamp lines={clampLines}>
                                <div className="font-medium text-[var(--foreground)]">{item.name}</div>
                              </LineClamp>
                            )}
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
                {results[group].length >= 20 && (
                  <div className="flex justify-center mt-3">
                    <Link
                      href={`/search?q=${encodeURIComponent(query)}&group=${group}`}
                      className="inline-block rounded-full border-2 border-[var(--accent)] bg-gradient-to-r from-[var(--accent)] to-[var(--accent-soft)] text-black font-extrabold px-6 py-2 text-xs uppercase tracking-widest shadow-lg hover:bg-transparent hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all duration-200"
                    >
                      See more...
                    </Link>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

export default function SearchResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-3xl w-full mx-auto p-4 min-h-screen">
          <div className="text-center text-[var(--muted)]">Loading search...</div>
        </div>
      }
    >
      <SearchResultsPageContent />
    </Suspense>
  );
}
