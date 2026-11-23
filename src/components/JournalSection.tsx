import { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
  Pencil,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { filmWord, filterEntriesByYear, formatShortDateRu, getEffectiveRuntime } from '../lib/analytics';
import type { ReenrichSummary, WatchEntry, YearFilter } from '../types/cinelog';

interface JournalSectionProps {
  entries: WatchEntry[];
  selectedYear: YearFilter;
  onEditEntry?: (entry: WatchEntry) => void;
  onDeleteEntry: (id: string) => void;
  pendingEnrichCount?: number;
  unmatchedCount?: number;
  reenriching?: boolean;
  reenrichProgress?: { done: number; total: number } | null;
  reenrichReport?: ReenrichSummary | null;
  onReenrichMovies?: () => void;
  onDismissReenrichReport?: () => void;
}

type SortKey = 'date-desc' | 'date-asc' | 'rating-desc' | 'rating-asc' | 'title-asc';

export function JournalSection({
  entries,
  selectedYear,
  onEditEntry,
  onDeleteEntry,
  pendingEnrichCount = 0,
  unmatchedCount = 0,
  reenriching = false,
  reenrichProgress = null,
  reenrichReport = null,
  onReenrichMovies,
  onDismissReenrichReport,
}: JournalSectionProps) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('date-desc');
  const [rewatchesOnly, setRewatchesOnly] = useState(false);
  const [minRating, setMinRating] = useState<number>(0);
  const [visibleLimit, setVisibleLimit] = useState(18);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const scoped = filterEntriesByYear(entries, selectedYear);
    const list = scoped.filter((e) => {
      if (rewatchesOnly && !e.is_rewatch) return false;
      if (minRating > 0 && (e.rating === null || e.rating < minRating)) return false;
      if (q) {
        const hay = `${e.title} ${e.directors.join(' ')} ${e.genres.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      switch (sortBy) {
        case 'date-asc':
          return a.watched_date.localeCompare(b.watched_date);
        case 'rating-desc':
          return (b.rating ?? -1) - (a.rating ?? -1);
        case 'rating-asc':
          return (a.rating ?? 99) - (b.rating ?? 99);
        case 'title-asc':
          return a.title.localeCompare(b.title, 'ru');
        case 'date-desc':
        default:
          return (
            b.watched_date.localeCompare(a.watched_date) ||
            (b.watched_time ?? '').localeCompare(a.watched_time ?? '')
          );
      }
    });
  }, [entries, selectedYear, search, sortBy, rewatchesOnly, minRating]);

  const displayed = filtered.slice(0, visibleLimit);

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cinelog-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section id="journal" className="scroll-mt-24 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-widest text-slate-500">Журнал</span>
          <span className="text-slate-700">/</span>
          <h2 className="text-sm font-bold tracking-tight text-slate-200 tabular-nums">
            История просмотров ({filtered.length} {filmWord(filtered.length)})
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {pendingEnrichCount > 0 && onReenrichMovies && (
            <button
              type="button"
              disabled={reenriching}
              onClick={onReenrichMovies}
              title={
                unmatchedCount > 0
                  ? `Нераспознанных фильмов: ${unmatchedCount} · Всего к обновлению: ${pendingEnrichCount}`
                  : `Обновить метаданные для ${pendingEnrichCount} фильмов через TMDB`
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#45d1c6]/10 hover:bg-[#45d1c6]/20 disabled:opacity-60 border border-[#45d1c6]/35 text-xs tabular-nums text-[#45d1c6] transition-colors cursor-pointer"
            >
              {reenriching ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              <span>Распознать через TMDB ({pendingEnrichCount})</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card hover:bg-cardElevated border border-line text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#45d1c6]" />
            Экспорт JSON
          </button>
        </div>
      </div>

      {reenriching && reenrichProgress && (
        <div className="rounded-xl bg-card border border-line p-3 space-y-1.5">
          <div className="flex justify-between text-[11px] tabular-nums text-slate-300">
            <span>Распознавание через TMDB...</span>
            <span>
              {reenrichProgress.done} / {reenrichProgress.total}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-canvas border border-line overflow-hidden">
            <div
              className="h-full bg-[#45d1c6] transition-all"
              style={{
                width: `${Math.round((reenrichProgress.done / Math.max(1, reenrichProgress.total)) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {reenrichReport && (
        <div
          className={
            !reenrichReport.tmdbConfigured || reenrichReport.errorCode
              ? 'rounded-xl bg-[#f06292]/10 border border-[#f06292]/30 p-3.5 text-xs text-[#f06292] flex items-start justify-between gap-3'
              : 'rounded-xl bg-card border border-[#45d1c6]/35 p-3.5 text-xs text-slate-200 flex items-start justify-between gap-3'
          }
        >
          <div className="flex items-start gap-2.5 min-w-0">
            {!reenrichReport.tmdbConfigured || reenrichReport.errorCode ? (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#f06292]" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#45d1c6]" />
            )}
            <div className="space-y-1 min-w-0">
              {!reenrichReport.tmdbConfigured || reenrichReport.errorCode ? (
                <p>
                  {reenrichReport.errorMessage ??
                    `Ошибка TMDB (${reenrichReport.errorCode ?? 'UNKNOWN'})`}
                </p>
              ) : (
                <p className="tabular-nums text-[11px]">
                  Распознано: {reenrichReport.matchedCount} · Объединено: {reenrichReport.mergedCount} ·
                  Обновлено: {reenrichReport.refreshedCount} · Не найдено:{' '}
                  {reenrichReport.unmatchedCount}
                </p>
              )}
              {reenrichReport.unmatchedTitles.length > 0 && (
                <p className="text-[11px] text-slate-400 break-words">
                  Не найдены:{' '}
                  <span className="text-slate-300">
                    {reenrichReport.unmatchedTitles.slice(0, 20).join(', ')}
                    {reenrichReport.unmatchedTitles.length > 20
                      ? ` (+${reenrichReport.unmatchedTitles.length - 20})`
                      : ''}
                  </span>
                </p>
              )}
            </div>
          </div>

          {onDismissReenrichReport && (
            <button
              type="button"
              onClick={onDismissReenrichReport}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-cardElevated transition-colors cursor-pointer shrink-0"
              title="Скрыть отчёт"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="rounded-2xl bg-card border border-line p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию, режиссёру или жанру..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-canvas border border-line text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#45d1c6]"
          />
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="px-3 py-2 rounded-xl bg-canvas border border-line text-xs text-slate-200 focus:outline-none focus:border-[#45d1c6]"
        >
          <option value="date-desc">Сначала новые</option>
          <option value="date-asc">Сначала старые</option>
          <option value="rating-desc">Оценка: выше</option>
          <option value="rating-asc">Оценка: ниже</option>
          <option value="title-asc">Название: А–Я</option>
        </select>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-canvas border border-line text-xs">
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#d6b85a]" />
          <span className="text-slate-400">Мин:</span>
          <input
            type="range"
            min="0"
            max="5"
            step="0.5"
            value={minRating}
            onChange={(e) => setMinRating(Number.parseFloat(e.target.value))}
            className="w-20 accent-[#d6b85a] cursor-pointer"
          />
          <span className="tabular-nums text-[#d6b85a] w-9 text-right">
            {minRating > 0 ? `${minRating.toFixed(1)}★` : 'Все'}
          </span>
        </div>

        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-canvas border border-line text-xs text-slate-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={rewatchesOnly}
            onChange={(e) => setRewatchesOnly(e.target.checked)}
            className="accent-[#d6b85a] rounded cursor-pointer"
          />
          <RotateCcw className="w-3 h-3 text-[#d6b85a]" />
          <span>Только пересмотры</span>
        </label>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-card border border-line overflow-hidden">
        {displayed.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line bg-canvas/50 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Фильм</th>
                  <th className="py-3 px-4 hidden sm:table-cell">Режиссёр / Жанр</th>
                  <th className="py-3 px-4">Дата</th>
                  <th className="py-3 px-4">Длит.</th>
                  <th className="py-3 px-4">Оценка</th>
                  <th className="py-3 px-4 text-right">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70 text-xs">
                {displayed.map((entry) => {
                  const runtime = getEffectiveRuntime(entry);
                  return (
                    <tr key={entry.id} className="hover:bg-cardElevated/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-100">{entry.title}</span>
                          {entry.release_year && (
                            <span className="tabular-nums text-[11px] text-slate-500">
                              ({entry.release_year})
                            </span>
                          )}
                          {entry.is_rewatch && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] tabular-nums bg-[#d6b85a]/10 text-[#d6b85a] border border-[#d6b85a]/25">
                              ↺
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 hidden sm:table-cell text-slate-400">
                        <span className="truncate block max-w-[240px]">
                          {[entry.directors[0], entry.genres[0]].filter(Boolean).join(' · ') || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4 tabular-nums text-slate-300 whitespace-nowrap">
                        {formatShortDateRu(entry.watched_date)}{' '}
                        <span className="text-slate-500">{entry.watched_date.slice(0, 4)}</span>
                        {entry.watched_time && (
                          <span className="ml-1.5 text-[10px] text-slate-500">
                            {entry.watched_time.slice(0, 5)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 tabular-nums text-slate-400 whitespace-nowrap">
                        {runtime > 0 ? `${runtime} мин` : '—'}
                      </td>
                      <td className="py-3 px-4 tabular-nums whitespace-nowrap">
                        {entry.rating !== null ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#d6b85a]/10 text-[#d6b85a] border border-[#d6b85a]/25">
                            <Star className="w-3 h-3 fill-[#d6b85a]" />
                            {entry.rating.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {confirmDeleteId === entry.id ? (
                          <div className="inline-flex items-center gap-1.5">
                            <span className="text-[11px] text-slate-400">Удалить?</span>
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmDeleteId(null);
                                onDeleteEntry(entry.id);
                              }}
                              className="px-2 py-1 rounded-lg bg-[#f06292]/15 hover:bg-[#f06292]/25 border border-[#f06292]/40 text-[11px] font-medium text-[#f06292] transition-colors cursor-pointer"
                            >
                              Да
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 rounded-lg bg-cardElevated hover:bg-lineStrong text-[11px] text-slate-300 transition-colors cursor-pointer"
                            >
                              Отмена
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            {onEditEntry && (
                              <button
                                type="button"
                                onClick={() => onEditEntry(entry)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-[#45d1c6] hover:bg-[#45d1c6]/10 transition-colors cursor-pointer"
                                title="Редактировать запись"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(entry.id)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-[#f06292] hover:bg-[#f06292]/10 transition-colors cursor-pointer"
                              title="Удалить запись"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-xs text-slate-500">
            Нет записей, соответствующих текущим фильтрам.
          </div>
        )}

        {filtered.length > visibleLimit && (
          <div className="p-3 border-t border-line text-center">
            <button
              type="button"
              onClick={() => setVisibleLimit((n) => n + 25)}
              className="px-4 py-1.5 rounded-xl bg-cardElevated hover:bg-lineStrong text-xs tabular-nums text-slate-300 transition-colors cursor-pointer"
            >
              Показать ещё ({filtered.length - visibleLimit} осталось)
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
