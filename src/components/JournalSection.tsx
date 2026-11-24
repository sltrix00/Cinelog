import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Download,
  Loader2,
  Pencil,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import {
  filmWord,
  filterEntriesByYear,
  formatShortDateRu,
  getEffectiveRuntime,
} from '../lib/analytics';
import {
  applySelectionPreset,
  getMasterCheckboxState,
  verifyDeleteIdentity,
  type SelectionPreset,
} from '../lib/journalSelection';
import { exportWatchEntriesAsJson } from '../lib/exportData';
import { formatRatingShort, formatRatingValue, type RatingFormat } from '../lib/settings';
import type { ReenrichSummary, WatchEntry, YearFilter } from '../types/cinelog';
import { useModalA11y } from './useModalA11y';

interface JournalSectionProps {
  entries: WatchEntry[];
  selectedYear: YearFilter;
  ratingFormat?: RatingFormat;
  userEmail?: string | null;
  userNickname?: string | null;
  isDemoMode?: boolean;
  onEditEntry?: (entry: WatchEntry) => void;
  onDeleteEntry: (id: string) => void;
  onDeleteSelected?: (ids: string[]) => Promise<void> | void;
  onDeleteAll?: () => Promise<void> | void;
  pendingEnrichCount?: number;
  unmatchedCount?: number;
  reenriching?: boolean;
  reenrichProgress?: { done: number; total: number } | null;
  reenrichReport?: ReenrichSummary | null;
  onReenrichMovies?: () => void;
  onDismissReenrichReport?: () => void;
}

type SortKey = 'date-desc' | 'date-asc' | 'rating-desc' | 'rating-asc' | 'title-asc';

type BulkDeleteState =
  | { mode: 'selected'; ids: string[]; step: 1 | 2 }
  | { mode: 'all'; count: number; step: 1 | 2 }
  | null;

export function JournalSection({
  entries,
  selectedYear,
  ratingFormat = 'stars-5',
  userEmail = null,
  userNickname = null,
  isDemoMode = false,
  onEditEntry,
  onDeleteEntry,
  onDeleteSelected,
  onDeleteAll,
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
  const [pendingDeleteEntry, setPendingDeleteEntry] = useState<WatchEntry | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [selectionMenuOpen, setSelectionMenuOpen] = useState(false);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [bulkDeleteState, setBulkDeleteState] = useState<BulkDeleteState>(null);
  const [identityInput, setIdentityInput] = useState('');
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const masterCheckboxRef = useRef<HTMLInputElement>(null);
  const selectionMenuRef = useRef<HTMLDivElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const identityInputRef = useRef<HTMLInputElement>(null);

  const activeFilterCount =
    (sortBy !== 'date-desc' ? 1 : 0) +
    (minRating > 0 ? 1 : 0) +
    (rewatchesOnly ? 1 : 0);

  const handleResetFilters = () => {
    setSortBy('date-desc');
    setMinRating(0);
    setRewatchesOnly(false);
  };

  // Reset pagination when any filter or sort changes
  useEffect(() => {
    setVisibleLimit(18);
  }, [search, selectedYear, sortBy, rewatchesOnly, minRating]);

  // Prune selection when entries are deleted or updated
  useEffect(() => {
    const validIds = new Set(entries.map((e) => e.id));
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (validIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [entries]);

  // Close Gmail-style selection dropdown on outside click or Escape
  useEffect(() => {
    if (!selectionMenuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (selectionMenuRef.current && !selectionMenuRef.current.contains(e.target as Node)) {
        setSelectionMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectionMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectionMenuOpen]);

  // Close filter popover on outside click or Escape
  useEffect(() => {
    if (!filterMenuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
        setFilterMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFilterMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [filterMenuOpen]);

  const deleteModalRef = useModalA11y<HTMLDivElement>({
    open: Boolean(pendingDeleteEntry),
    onClose: () => setPendingDeleteEntry(null),
  });

  const bulkModalRef = useModalA11y<HTMLDivElement>({
    open: Boolean(bulkDeleteState),
    onClose: () => {
      if (!isBulkDeleting) setBulkDeleteState(null);
    },
  });

  useEffect(() => {
    if (bulkDeleteState?.step === 2) {
      const id = window.setTimeout(() => identityInputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [bulkDeleteState?.step]);

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

  useEffect(() => {
    if (filtered.length === 0 && selectionMenuOpen) {
      setSelectionMenuOpen(false);
    }
  }, [filtered.length, selectionMenuOpen]);

  const masterState = useMemo(
    () => getMasterCheckboxState(filtered, selectedIds),
    [filtered, selectedIds]
  );

  useEffect(() => {
    if (masterCheckboxRef.current) {
      masterCheckboxRef.current.indeterminate = masterState === 'some';
    }
  }, [masterState]);

  const presetCounts = useMemo(() => {
    let rated = 0;
    let unrated = 0;
    let rewatch = 0;
    let firstWatch = 0;
    for (const e of filtered) {
      if (e.rating !== null) rated += 1;
      else unrated += 1;
      if (e.is_rewatch) rewatch += 1;
      else firstWatch += 1;
    }
    return {
      all: filtered.length,
      none: 0,
      rated,
      unrated,
      rewatch,
      first_watch: firstWatch,
    };
  }, [filtered]);

  const selectionPresets: { id: SelectionPreset; label: string; count?: number }[] = [
    { id: 'all', label: 'Все', count: presetCounts.all },
    { id: 'none', label: 'Ничего' },
    { id: 'rated', label: 'С оценкой', count: presetCounts.rated },
    { id: 'unrated', label: 'Без оценки', count: presetCounts.unrated },
    { id: 'rewatch', label: 'Пересмотры', count: presetCounts.rewatch },
    { id: 'first_watch', label: 'Первые просмотры', count: presetCounts.first_watch },
  ];

  const handleToggleMasterCheckbox = () => {
    if (masterState === 'all') {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(applySelectionPreset(filtered, 'all'));
    }
  };

  const handleSelectPreset = (preset: SelectionPreset) => {
    setSelectedIds(applySelectionPreset(filtered, preset));
    setSelectionMenuOpen(false);
  };

  const toggleSelectEntry = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const openBulkDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    setIdentityInput('');
    setIdentityError(null);
    setBulkDeleteState({
      mode: 'selected',
      ids: Array.from(selectedIds),
      step: 1,
    });
  };

  const openBulkDeleteAll = () => {
    if (entries.length === 0) return;
    setIdentityInput('');
    setIdentityError(null);
    setBulkDeleteState({
      mode: 'all',
      count: entries.length,
      step: 1,
    });
  };

  const isIdentityValid = verifyDeleteIdentity(identityInput, {
    userNickname,
    userEmail,
    isDemoMode,
  });

  const handleConfirmBulkDelete = async () => {
    if (!bulkDeleteState || bulkDeleteState.step !== 2 || isBulkDeleting) return;
    if (!isIdentityValid) {
      setIdentityError('Введённое значение не совпадает с вашим никнеймом или email.');
      return;
    }

    setIsBulkDeleting(true);
    setIdentityError(null);
    try {
      if (bulkDeleteState.mode === 'all') {
        await onDeleteAll?.();
        setSelectedIds(new Set());
      } else {
        await onDeleteSelected?.(bulkDeleteState.ids);
        const deletedSet = new Set(bulkDeleteState.ids);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (const id of deletedSet) next.delete(id);
          return next;
        });
      }
      setBulkDeleteState(null);
      setIdentityInput('');
    } catch (err) {
      setIdentityError(
        err instanceof Error ? err.message : 'Не удалось выполнить удаление. Попробуйте ещё раз.'
      );
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleExportJson = () => {
    exportWatchEntriesAsJson(filtered);
  };

  return (
    <section id="journal" className="scroll-mt-24 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
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
              className="inline-flex items-center gap-1.5 min-h-9 px-3 py-1.5 rounded-xl bg-[#45d1c6]/10 hover:bg-[#45d1c6]/20 disabled:opacity-60 border border-[#45d1c6]/35 text-xs tabular-nums text-[#45d1c6] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
            >
              {reenriching ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>Распознать через TMDB ({pendingEnrichCount})</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 min-h-9 px-3 py-1.5 rounded-xl bg-card hover:bg-cardElevated border border-line text-xs text-slate-200 hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
          >
            <Download className="w-3.5 h-3.5 text-[#45d1c6]" aria-hidden="true" />
            Экспорт JSON
          </button>

          {entries.length > 0 && onDeleteAll && (
            <button
              type="button"
              onClick={openBulkDeleteAll}
              className="inline-flex items-center gap-1.5 min-h-9 px-3 py-1.5 rounded-xl bg-card hover:bg-[#f06292]/10 border border-[#f06292]/30 text-xs text-[#f06292] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f06292]"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              Удалить весь журнал
            </button>
          )}
        </div>
      </div>

      {reenriching && reenrichProgress && (
        <div className="rounded-xl bg-card border border-line p-3 space-y-1.5">
          <div className="flex justify-between text-xs tabular-nums text-slate-300">
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
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#f06292]" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#45d1c6]" aria-hidden="true" />
            )}
            <div className="space-y-1 min-w-0">
              {!reenrichReport.tmdbConfigured || reenrichReport.errorCode ? (
                <p>
                  {reenrichReport.errorMessage ??
                    `Ошибка TMDB (${reenrichReport.errorCode ?? 'UNKNOWN'})`}
                </p>
              ) : (
                <p className="tabular-nums text-xs">
                  Распознано: {reenrichReport.matchedCount} · Объединено: {reenrichReport.mergedCount} ·
                  Обновлено: {reenrichReport.refreshedCount} · Не найдено:{' '}
                  {reenrichReport.unmatchedCount}
                </p>
              )}
              {reenrichReport.unmatchedTitles.length > 0 && (
                <p className="text-xs text-slate-400 break-words">
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
              aria-label="Скрыть отчёт"
              className="w-9 h-9 inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-cardElevated transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
              title="Скрыть отчёт"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {/* Unified Journal Toolbar */}
      <div className="rounded-2xl bg-card border border-line p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* Leftmost: Gmail-style selection control */}
          <div className="relative shrink-0" ref={selectionMenuRef}>
            <div
              className={`inline-flex items-center rounded-xl bg-canvas border border-line transition-colors ${
                filtered.length === 0 ? 'opacity-50' : 'hover:border-lineStrong'
              }`}
            >
              <label
                className={`inline-flex items-center justify-center min-w-10 min-h-10 px-2.5 rounded-l-xl transition-colors ${
                  filtered.length === 0
                    ? 'cursor-not-allowed'
                    : 'cursor-pointer hover:bg-cardElevated'
                }`}
              >
                <input
                  ref={masterCheckboxRef}
                  type="checkbox"
                  disabled={filtered.length === 0}
                  checked={filtered.length > 0 && masterState === 'all'}
                  onChange={handleToggleMasterCheckbox}
                  aria-label="Выбрать все записи в текущем списке"
                  className="w-4 h-4 accent-[#45d1c6] rounded cursor-pointer disabled:cursor-not-allowed focus:outline-none"
                />
              </label>
              <button
                type="button"
                disabled={filtered.length === 0}
                onClick={() => {
                  setSelectionMenuOpen((o) => !o);
                  setFilterMenuOpen(false);
                }}
                aria-haspopup="menu"
                aria-expanded={selectionMenuOpen}
                aria-label="Варианты выбора записей"
                className="inline-flex items-center justify-center min-h-10 px-1.5 border-l border-line text-slate-400 hover:text-white hover:bg-cardElevated disabled:hover:text-slate-400 disabled:hover:bg-transparent disabled:cursor-not-allowed rounded-r-xl transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
              >
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-150 ${
                    selectionMenuOpen ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>
            </div>

            {selectionMenuOpen && filtered.length > 0 && (
              <div
                role="menu"
                aria-label="Варианты выбора"
                className="ui-dropdown origin-top-left absolute left-0 top-full mt-1.5 w-52 rounded-xl bg-cardElevated border border-lineStrong shadow-2xl py-1 z-30"
              >
                {selectionPresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    role="menuitem"
                    onClick={() => handleSelectPreset(preset.id)}
                    className="w-full px-3.5 py-2 text-left text-xs text-slate-200 hover:bg-card hover:text-white flex items-center justify-between gap-2 transition-colors cursor-pointer focus:outline-none focus-visible:bg-card"
                  >
                    <span>{preset.label}</span>
                    {preset.count !== undefined && (
                      <span className="tabular-nums text-[11px] text-slate-400">
                        {preset.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search
              className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              aria-label="Поиск по названию, режиссёру или жанру"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по названию, режиссёру или жанру..."
              className={`w-full min-h-10 pl-9 ${
                search ? 'pr-8' : 'pr-3'
              } py-2 rounded-xl bg-canvas border border-line text-xs text-white placeholder-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6] focus:border-[#45d1c6]`}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Очистить поиск"
                className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-cardElevated absolute right-1.5 top-1/2 -translate-y-1/2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Right of search: Filter icon button + popover */}
          <div className="relative shrink-0" ref={filterMenuRef}>
            <button
              type="button"
              onClick={() => {
                setFilterMenuOpen((o) => !o);
                setSelectionMenuOpen(false);
              }}
              aria-haspopup="dialog"
              aria-expanded={filterMenuOpen}
              aria-label="Фильтры и сортировка"
              title="Фильтры и сортировка"
              className={`inline-flex items-center justify-center gap-1.5 min-w-10 min-h-10 px-2.5 rounded-xl border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6] ${
                activeFilterCount > 0 || filterMenuOpen
                  ? 'bg-[#45d1c6]/10 border-[#45d1c6]/45 text-[#45d1c6] hover:bg-[#45d1c6]/15'
                  : 'bg-canvas border-line hover:border-lineStrong hover:bg-cardElevated text-slate-300 hover:text-white'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-[#45d1c6] text-[#090d16] text-[10px] font-bold tabular-nums">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {filterMenuOpen && (
              <div
                role="dialog"
                aria-label="Фильтры и сортировка"
                className="ui-dropdown origin-top-right absolute right-0 top-full mt-1.5 w-72 sm:w-80 rounded-xl bg-cardElevated border border-lineStrong shadow-2xl p-4 z-30 space-y-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-200">
                    Фильтры и сортировка
                  </span>
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="text-[11px] text-[#45d1c6] hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6] rounded"
                    >
                      Сбросить
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="sortOrderFilter" className="block text-xs text-slate-300">
                    Сортировка
                  </label>
                  <select
                    id="sortOrderFilter"
                    aria-label="Сортировка записей"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortKey)}
                    className="w-full min-h-9 px-3 py-1.5 rounded-xl bg-canvas border border-line text-xs text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6] focus:border-[#45d1c6] cursor-pointer"
                  >
                    <option value="date-desc">Сначала новые</option>
                    <option value="date-asc">Сначала старые</option>
                    <option value="rating-desc">Оценка: выше</option>
                    <option value="rating-asc">Оценка: ниже</option>
                    <option value="title-asc">Название: А–Я</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="minRatingFilter" className="text-xs text-slate-300">
                      Минимальная оценка
                    </label>
                    <span className="tabular-nums text-xs text-[#d6b85a]">
                      {minRating > 0 ? formatRatingShort(minRating, ratingFormat) : 'Все'}
                    </span>
                  </div>
                  <input
                    id="minRatingFilter"
                    type="range"
                    min="0"
                    max="5"
                    step="0.5"
                    value={minRating}
                    onChange={(e) => setMinRating(Number.parseFloat(e.target.value))}
                    className="w-full accent-[#d6b85a] cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
                  />
                </div>

                <label className="flex items-center gap-2.5 min-h-9 px-3 py-1.5 rounded-xl bg-canvas border border-line text-xs text-slate-200 cursor-pointer select-none focus-within:ring-2 focus-within:ring-[#45d1c6]">
                  <input
                    type="checkbox"
                    checked={rewatchesOnly}
                    onChange={(e) => setRewatchesOnly(e.target.checked)}
                    className="w-4 h-4 accent-[#d6b85a] rounded cursor-pointer focus:outline-none"
                  />
                  <RotateCcw className="w-3.5 h-3.5 text-[#d6b85a]" aria-hidden="true" />
                  <span>Только пересмотры</span>
                </label>
              </div>
            )}
          </div>

          {/* Rightmost: Shown count */}
          <span className="text-[11px] tabular-nums text-slate-400 whitespace-nowrap ml-auto sm:ml-0">
            Показано {displayed.length} из {filtered.length}
          </span>
        </div>

        {/* Bulk Selection Actions Row */}
        {selectedIds.size > 0 && (
          <div className="ui-fade-in pt-3 border-t border-line flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[#45d1c6]/10 border border-[#45d1c6]/30 text-xs tabular-nums text-[#45d1c6]">
              Выбрано: {selectedIds.size}
            </span>

            {onDeleteSelected && (
              <button
                type="button"
                onClick={openBulkDeleteSelected}
                className="inline-flex items-center gap-1.5 min-h-9 px-3 py-1.5 rounded-xl bg-[#f06292]/15 hover:bg-[#f06292]/25 border border-[#f06292]/35 text-xs font-medium text-[#f06292] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f06292]"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                Удалить выбранные ({selectedIds.size})
              </button>
            )}

            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="min-h-9 px-2.5 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-cardElevated transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
            >
              Снять выделение
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-card border border-line overflow-hidden">
        {displayed.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line bg-canvas/50 text-xs uppercase tracking-wider text-slate-400">
                  <th className="py-3 pl-3 pr-1 sm:pl-4 w-10">
                    <span className="sr-only">Выбор</span>
                  </th>
                  <th className="py-3 px-3 sm:px-4">Фильм</th>
                  <th className="py-3 px-4 hidden sm:table-cell">Режиссёр / Жанр</th>
                  <th className="py-3 px-3 sm:px-4">Дата</th>
                  <th className="py-3 px-4 hidden md:table-cell">Длит.</th>
                  <th className="py-3 px-3 sm:px-4">Оценка</th>
                  <th className="py-3 px-3 sm:px-4 text-right">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70 text-xs">
                {displayed.map((entry) => {
                  const runtime = getEffectiveRuntime(entry);
                  const isSelected = selectedIds.has(entry.id);
                  return (
                    <tr
                      key={entry.id}
                      className={
                        isSelected
                          ? 'bg-[#45d1c6]/5 hover:bg-[#45d1c6]/10 transition-colors'
                          : 'hover:bg-cardElevated/50 transition-colors'
                      }
                    >
                      <td className="py-3 pl-3 pr-1 sm:pl-4 w-10">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectEntry(entry.id)}
                          aria-label={`Выбрать «${entry.title}»`}
                          className="w-4 h-4 accent-[#45d1c6] rounded cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
                        />
                      </td>
                      <td className="py-3 px-3 sm:px-4">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-medium text-slate-100">{entry.title}</span>
                          {entry.release_year && (
                            <span className="tabular-nums text-xs text-slate-400">
                              ({entry.release_year})
                            </span>
                          )}
                          {entry.is_rewatch && (
                            <span
                              title="Пересмотр"
                              className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] tabular-nums bg-[#d6b85a]/10 text-[#d6b85a] border border-[#d6b85a]/25"
                            >
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
                      <td className="py-3 px-3 sm:px-4 tabular-nums text-slate-300 whitespace-nowrap">
                        <div>
                          {formatShortDateRu(entry.watched_date)}{' '}
                          <span className="text-slate-400">{entry.watched_date.slice(0, 4)}</span>
                          {entry.watched_time && (
                            <span className="ml-1.5 text-[11px] text-slate-400">
                              {entry.watched_time.slice(0, 5)}
                            </span>
                          )}
                        </div>
                        {runtime > 0 && (
                          <div className="md:hidden text-[11px] text-slate-400 mt-0.5">
                            {runtime} мин
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell tabular-nums text-slate-300 whitespace-nowrap">
                        {runtime > 0 ? `${runtime} мин` : '—'}
                      </td>
                      <td className="py-3 px-3 sm:px-4 tabular-nums whitespace-nowrap">
                        {entry.rating !== null ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#d6b85a]/10 text-[#d6b85a] border border-[#d6b85a]/25">
                            {ratingFormat === 'stars-5' && (
                              <Star className="w-3 h-3 fill-[#d6b85a]" aria-hidden="true" />
                            )}
                            {ratingFormat === 'stars-5'
                              ? entry.rating.toFixed(1)
                              : formatRatingValue(entry.rating, ratingFormat)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 sm:px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          {onEditEntry && (
                            <button
                              type="button"
                              onClick={() => onEditEntry(entry)}
                              aria-label={`Редактировать «${entry.title}»`}
                              className="w-9 h-9 inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-[#45d1c6] hover:bg-[#45d1c6]/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
                              title="Редактировать запись"
                            >
                              <Pencil className="w-4 h-4" aria-hidden="true" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setPendingDeleteEntry(entry)}
                            aria-label={`Удалить «${entry.title}»`}
                            className="w-9 h-9 inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-[#f06292] hover:bg-[#f06292]/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f06292]"
                            title="Удалить запись"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-xs text-slate-400">
            Нет записей, соответствующих текущим фильтрам.
          </div>
        )}

        {filtered.length > visibleLimit && (
          <div className="p-3 border-t border-line text-center">
            <button
              type="button"
              onClick={() => setVisibleLimit((n) => n + 25)}
              className="min-h-10 px-4 py-2 rounded-xl bg-cardElevated hover:bg-lineStrong text-xs tabular-nums text-slate-200 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
            >
              Показать ещё ({filtered.length - visibleLimit} осталось)
            </button>
          </div>
        )}
      </div>

      {/* Accessible Delete Confirmation Modal */}
      {pendingDeleteEntry && (
        <div
          className="ui-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPendingDeleteEntry(null);
          }}
        >
          <div
            ref={deleteModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            tabIndex={-1}
            className="ui-modal-panel w-full max-w-sm rounded-2xl bg-card border border-lineStrong shadow-2xl overflow-hidden focus:outline-none"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-[#f06292]" aria-hidden="true" />
                <h3 id="delete-modal-title" className="text-sm font-semibold text-white">
                  Удалить запись?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPendingDeleteEntry(null)}
                aria-label="Закрыть"
                className="w-9 h-9 inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-cardElevated transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="p-5 space-y-2">
              <p className="text-xs text-slate-300 leading-relaxed">
                Запись о просмотре фильма{' '}
                <span className="font-semibold text-white">«{pendingDeleteEntry.title}»</span>
                {pendingDeleteEntry.release_year ? (
                  <span className="text-slate-400"> ({pendingDeleteEntry.release_year})</span>
                ) : null}{' '}
                от{' '}
                <span className="tabular-nums text-slate-200">
                  {formatShortDateRu(pendingDeleteEntry.watched_date)}{' '}
                  {pendingDeleteEntry.watched_date.slice(0, 4)}
                </span>{' '}
                будет удалена из журнала.
              </p>
              <p className="text-xs text-slate-400">Это действие нельзя отменить.</p>
            </div>

            <div className="px-5 py-3.5 border-t border-line bg-canvas/40 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setPendingDeleteEntry(null)}
                className="min-h-10 px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-cardElevated transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = pendingDeleteEntry.id;
                  setPendingDeleteEntry(null);
                  onDeleteEntry(id);
                }}
                className="inline-flex items-center gap-1.5 min-h-10 px-4 py-2 rounded-xl text-xs font-semibold bg-[#f06292] hover:bg-[#f47ba4] text-[#0b0e17] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Two-step Bulk / Full Journal Delete Modal */}
      {bulkDeleteState && (
        <div
          className="ui-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isBulkDeleting) {
              setBulkDeleteState(null);
            }
          }}
        >
          <div
            ref={bulkModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-delete-modal-title"
            tabIndex={-1}
            className="ui-modal-panel w-full max-w-md rounded-2xl bg-card border border-lineStrong shadow-2xl overflow-hidden focus:outline-none"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <div className="flex items-center gap-2">
                {bulkDeleteState.step === 1 ? (
                  <AlertTriangle className="w-4 h-4 text-[#f06292]" aria-hidden="true" />
                ) : (
                  <ShieldAlert className="w-4 h-4 text-[#f06292]" aria-hidden="true" />
                )}
                <h3 id="bulk-delete-modal-title" className="text-sm font-semibold text-white">
                  {bulkDeleteState.step === 1
                    ? bulkDeleteState.mode === 'all'
                      ? 'Удалить весь журнал?'
                      : 'Удалить выбранные записи?'
                    : 'Подтверждение удаления'}
                </h3>
              </div>
              <button
                type="button"
                disabled={isBulkDeleting}
                onClick={() => setBulkDeleteState(null)}
                aria-label="Закрыть"
                className="w-9 h-9 inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-cardElevated disabled:opacity-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {bulkDeleteState.step === 1 ? (
              <>
                <div className="p-5 space-y-2.5">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {bulkDeleteState.mode === 'all' ? (
                      <>
                        Вы собираетесь полностью очистить журнал просмотров (
                        <span className="font-semibold text-white tabular-nums">
                          {bulkDeleteState.count} {filmWord(bulkDeleteState.count)}
                        </span>
                        ).
                      </>
                    ) : (
                      <>
                        Вы собираетесь удалить выбранные записи из журнала (
                        <span className="font-semibold text-white tabular-nums">
                          {bulkDeleteState.ids.length} {filmWord(bulkDeleteState.ids.length)}
                        </span>
                        ).
                      </>
                    )}
                  </p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Это действие нельзя отменить. На следующем шаге потребуется подтвердить
                    удаление вводом вашего никнейма или email.
                  </p>
                </div>

                <div className="px-5 py-3.5 border-t border-line bg-canvas/40 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setBulkDeleteState(null)}
                    className="min-h-10 px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-cardElevated transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIdentityInput('');
                      setIdentityError(null);
                      setBulkDeleteState((prev) => (prev ? { ...prev, step: 2 } : null));
                    }}
                    className="inline-flex items-center gap-1.5 min-h-10 px-4 py-2 rounded-xl text-xs font-semibold bg-[#f06292] hover:bg-[#f47ba4] text-[#0b0e17] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
                  >
                    Продолжить
                  </button>
                </div>
              </>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleConfirmBulkDelete();
                }}
              >
                <div className="p-5 space-y-3">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {userNickname && userEmail ? (
                      <>
                        Для подтверждения удаления введите ваш никнейм (
                        <span className="font-mono text-white">{userNickname}</span>) или email (
                        <span className="font-mono text-white">{userEmail}</span>):
                      </>
                    ) : userEmail ? (
                      <>
                        Для подтверждения удаления введите ваш email (
                        <span className="font-mono text-white">{userEmail}</span>):
                      </>
                    ) : userNickname ? (
                      <>
                        Для подтверждения удаления введите ваш никнейм (
                        <span className="font-mono text-white">{userNickname}</span>):
                      </>
                    ) : (
                      <>
                        В демо-режиме введите <span className="font-mono text-white">demo</span> для
                        подтверждения удаления:
                      </>
                    )}
                  </p>

                  <input
                    ref={identityInputRef}
                    type="text"
                    value={identityInput}
                    disabled={isBulkDeleting}
                    onChange={(e) => {
                      setIdentityInput(e.target.value);
                      if (identityError) setIdentityError(null);
                    }}
                    placeholder={
                      userNickname && userEmail
                        ? 'Никнейм или email...'
                        : userEmail
                          ? 'Ваш email...'
                          : userNickname
                            ? 'Ваш никнейм...'
                            : 'demo'
                    }
                    className="w-full min-h-10 px-3 py-2 rounded-xl bg-canvas border border-line text-xs text-white placeholder-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f06292] focus:border-[#f06292]"
                  />

                  {identityError && (
                    <p className="text-xs text-[#f06292]" role="alert">
                      {identityError}
                    </p>
                  )}
                </div>

                <div className="px-5 py-3.5 border-t border-line bg-canvas/40 flex items-center justify-between gap-2.5">
                  <button
                    type="button"
                    disabled={isBulkDeleting}
                    onClick={() => {
                      setIdentityError(null);
                      setBulkDeleteState((prev) => (prev ? { ...prev, step: 1 } : null));
                    }}
                    className="min-h-10 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-cardElevated disabled:opacity-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
                  >
                    Назад
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isBulkDeleting}
                      onClick={() => setBulkDeleteState(null)}
                      className="min-h-10 px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-cardElevated disabled:opacity-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      disabled={!isIdentityValid || isBulkDeleting}
                      className="inline-flex items-center gap-1.5 min-h-10 px-4 py-2 rounded-xl text-xs font-semibold bg-[#f06292] hover:bg-[#f47ba4] disabled:opacity-45 disabled:hover:bg-[#f06292] text-[#0b0e17] transition-colors cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
                    >
                      {isBulkDeleting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                      Удалить навсегда
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
