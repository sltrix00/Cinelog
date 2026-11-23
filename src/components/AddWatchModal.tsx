import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  AlertCircle,
  Loader2,
  Pencil,
  PlusCircle,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { timeStringToBucket } from '../lib/analytics';
import {
  annotateImportBatch,
  MAX_IMPORT_FILES,
  MAX_IMPORT_ROWS,
  parseImportFile,
} from '../lib/csvImport';
import { bucketToDefaultTime, DEMO_MOVIE_CATALOG, SIM_DATE_ISO } from '../lib/demoData';
import { enrichMovieViaProxy, isSupabaseConfigured, searchTmdbViaProxy } from '../lib/supabase';
import type {
  ParsedImportRow,
  TimeOfDayBucket,
  TmdbSearchResult,
  WatchEntry,
} from '../types/cinelog';
import { useModalA11y } from './useModalA11y';

export interface AddWatchPayload {
  tmdbId: number | null;
  title: string;
  releaseYear: number;
  watchedDate: string;
  watchedTime: string | null;
  rating: number | null;
  runtimeMinutes: number;
  isRewatch: boolean;
  directors: string[];
  countries: string[];
  genres: string[];
}

interface AddWatchModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (payload: AddWatchPayload) => Promise<void> | void;
  isDemoMode: boolean;
  initialEntry?: WatchEntry | null;
  existingEntries?: WatchEntry[];
  onConfirmImport?: (
    rows: ParsedImportRow[],
    replaceDemo: boolean,
    onProgress?: (done: number, total: number) => void
  ) => Promise<void>;
}

type BucketOption = 'none' | '0' | '1' | '2' | '3';
type ModalTab = 'manual' | 'import';

export function AddWatchModal({
  open,
  onClose,
  onSave,
  isDemoMode,
  initialEntry = null,
  existingEntries = [],
  onConfirmImport,
}: AddWatchModalProps) {
  const isEditing = Boolean(initialEntry);
  const [activeTab, setActiveTab] = useState<ModalTab>('manual');

  const [title, setTitle] = useState('');
  const [tmdbId, setTmdbId] = useState<number | null>(null);
  const [rating, setRating] = useState<string>('4');
  const [runtime, setRuntime] = useState<string>('124');
  const [releaseYear, setReleaseYear] = useState<string>('2026');
  const [watchedDate, setWatchedDate] = useState<string>(
    isDemoMode ? SIM_DATE_ISO : new Date().toISOString().slice(0, 10)
  );
  const [timeOfDayBucket, setTimeOfDayBucket] = useState<BucketOption>('2');
  const [exactTime, setExactTime] = useState<string>('');
  const [isRewatch, setIsRewatch] = useState(false);
  const [directors, setDirectors] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [allowSearch, setAllowSearch] = useState(false);

  const [suggestions, setSuggestions] = useState<TmdbSearchResult[]>([]);
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [importRows, setImportRows] = useState<ParsedImportRow[]>([]);
  const [fileLabels, setFileLabels] = useState<string[]>([]);
  const [replaceDemo, setReplaceDemo] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);

  const busy = submitting || importing;

  const handleCloseAttempt = useCallback(() => {
    if (suggestions.length > 0) {
      setSuggestions([]);
      setActiveSuggestionIdx(-1);
      return;
    }
    if (!busy) onClose();
  }, [suggestions.length, busy, onClose]);

  const modalRef = useModalA11y<HTMLDivElement>({
    open,
    onClose: handleCloseAttempt,
    disabled: busy && suggestions.length === 0,
    initialFocusRef: titleInputRef,
  });

  useEffect(() => {
    if (!open) return;
    setActiveTab('manual');
    setErrorMsg(null);
    setSuggestions([]);
    setActiveSuggestionIdx(-1);
    setImportRows([]);
    setFileLabels([]);
    setImportProgress(null);
    setDragging(false);
    setParsing(false);
    setImporting(false);
    setReplaceDemo(true);

    if (initialEntry) {
      setTitle(initialEntry.title);
      setTmdbId(initialEntry.tmdb_id);
      setRating(initialEntry.rating !== null ? String(initialEntry.rating) : '');
      const effRuntime =
        initialEntry.runtime_override_minutes ?? initialEntry.runtime_minutes ?? 120;
      setRuntime(String(effRuntime));
      setReleaseYear(
        initialEntry.release_year
          ? String(initialEntry.release_year)
          : String(isDemoMode ? 2026 : new Date().getFullYear())
      );
      setWatchedDate(initialEntry.watched_date);
      if (initialEntry.watched_time) {
        const bucket = timeStringToBucket(initialEntry.watched_time);
        setTimeOfDayBucket(bucket !== null ? (String(bucket) as BucketOption) : '2');
        setExactTime(initialEntry.watched_time.slice(0, 5));
      } else {
        setTimeOfDayBucket('none');
        setExactTime('');
      }
      setIsRewatch(initialEntry.is_rewatch);
      setDirectors(initialEntry.directors);
      setCountries(initialEntry.countries);
      setGenres(initialEntry.genres);
      setAllowSearch(false);
      return;
    }

    setTitle('');
    setTmdbId(null);
    setRating('4');
    setRuntime('124');
    setReleaseYear(String(isDemoMode ? 2026 : new Date().getFullYear()));
    setWatchedDate(isDemoMode ? SIM_DATE_ISO : new Date().toISOString().slice(0, 10));
    setTimeOfDayBucket('2');
    setExactTime('');
    setIsRewatch(false);
    setDirectors([]);
    setCountries([]);
    setGenres([]);
    setAllowSearch(true);
  }, [open, isDemoMode, initialEntry]);

  useEffect(() => {
    if (!open || !allowSearch || activeTab !== 'manual') return;
    const q = title.trim();
    if (q.length < 2 || tmdbId !== null) {
      setSuggestions([]);
      setActiveSuggestionIdx(-1);
      return;
    }

    const timer = window.setTimeout(async () => {
      const localMatches: TmdbSearchResult[] = DEMO_MOVIE_CATALOG.filter((m) =>
        m.title.toLowerCase().includes(q.toLowerCase())
      )
        .slice(0, 5)
        .map((m) => ({
          tmdbId: m.tmdb_id ?? 0,
          title: m.title,
          originalTitle: m.original_title,
          releaseYear: m.release_year,
          posterUrl: m.poster_url,
          overview: [m.directors[0], m.genres[0], m.countries[0]].filter(Boolean).join(' · '),
        }));

      if (!isDemoMode && isSupabaseConfigured) {
        setSearching(true);
        try {
          const remote = await searchTmdbViaProxy(q);
          const next = remote.length > 0 ? remote.slice(0, 6) : localMatches;
          setSuggestions(next);
          setActiveSuggestionIdx(-1);
        } catch {
          setSuggestions(localMatches);
          setActiveSuggestionIdx(-1);
        } finally {
          setSearching(false);
        }
      } else {
        setSuggestions(localMatches);
        setActiveSuggestionIdx(-1);
      }
    }, 280);

    return () => window.clearTimeout(timer);
  }, [title, open, isDemoMode, tmdbId, allowSearch, activeTab]);

  if (!open) return null;

  const isImportMode = !isEditing && Boolean(onConfirmImport) && activeTab === 'import';
  const hasImportRows = importRows.length > 0;
  const newRowsCount = importRows.filter((r) => !r.isDuplicate).length;
  const duplicateCount = importRows.filter((r) => r.isDuplicate).length;
  const autoRewatchCount = importRows.filter((r) => !r.isDuplicate && r.autoRewatchDetected).length;
  const withoutTimeCount = importRows.filter((r) => !r.isDuplicate && !r.watchedTime).length;

  const canSave = isImportMode
    ? !busy && !parsing && hasImportRows && newRowsCount > 0
    : !busy && !parsing;

  const handleSelectSuggestion = async (item: TmdbSearchResult) => {
    setTitle(item.title);
    setTmdbId(item.tmdbId > 0 ? item.tmdbId : null);
    if (item.releaseYear) setReleaseYear(String(item.releaseYear));
    setSuggestions([]);
    setActiveSuggestionIdx(-1);
    setAllowSearch(false);

    const catalogHit = DEMO_MOVIE_CATALOG.find(
      (m) => m.tmdb_id === item.tmdbId || m.title.toLowerCase() === item.title.toLowerCase()
    );
    if (catalogHit) {
      if (catalogHit.runtime_minutes) setRuntime(String(catalogHit.runtime_minutes));
      setDirectors(catalogHit.directors);
      setCountries(catalogHit.countries);
      setGenres(catalogHit.genres);
      return;
    }

    if (!isDemoMode && isSupabaseConfigured && item.tmdbId > 0) {
      setSearching(true);
      try {
        const enriched = await enrichMovieViaProxy(item.tmdbId);
        if (enriched) {
          if (enriched.runtime_minutes) setRuntime(String(enriched.runtime_minutes));
          setDirectors(enriched.directors);
          setCountries(enriched.countries);
          setGenres(enriched.genres);
        }
      } finally {
        setSearching(false);
      }
    }
  };

  const handleTitleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIdx((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIdx((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === 'Enter' && activeSuggestionIdx >= 0) {
      e.preventDefault();
      const target = suggestions[activeSuggestionIdx];
      if (target) void handleSelectSuggestion(target);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setSuggestions([]);
      setActiveSuggestionIdx(-1);
    }
  };

  const processFiles = async (files: File[]) => {
    if (!files.length) return;
    if (files.length > MAX_IMPORT_FILES) {
      setErrorMsg(`Слишком много файлов за раз (максимум ${MAX_IMPORT_FILES}).`);
      return;
    }
    setParsing(true);
    setErrorMsg(null);

    try {
      const allParsed: ParsedImportRow[] = [];
      const names: string[] = [];

      for (const file of files) {
        const parsed = await parseImportFile(file);
        if (parsed.length > 0) {
          allParsed.push(...parsed);
          names.push(file.name);
        }
        if (allParsed.length > MAX_IMPORT_ROWS) {
          throw new Error(`Слишком много записей в импорте (максимум ${MAX_IMPORT_ROWS} строк).`);
        }
      }

      if (allParsed.length === 0) {
        setErrorMsg(
          'Не удалось распознать фильмы в выбранных файлах. Поддерживаются CSV (Letterboxd / IMDb), .txt и .json.'
        );
        setImportRows([]);
        setFileLabels([]);
        return;
      }

      const baseline = isDemoMode && replaceDemo ? [] : existingEntries;
      setImportRows(annotateImportBatch(allParsed, baseline));
      setFileLabels(names);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Ошибка чтения файла.');
    } finally {
      setParsing(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (busy || parsing) return;
    void processFiles(Array.from(e.dataTransfer.files));
  };

  const clearImport = () => {
    setImportRows([]);
    setFileLabels([]);
    setImportProgress(null);
    setErrorMsg(null);
  };

  const resetManualFields = () => {
    setTitle('');
    setTmdbId(null);
    setExactTime('');
    setIsRewatch(false);
    setDirectors([]);
    setCountries([]);
    setGenres([]);
  };

  const buildManualPayload = (cleanTitle: string): AddWatchPayload => {
    const parsedRating = rating === '' ? null : Number.parseFloat(rating);
    const parsedRuntime = Number.parseInt(runtime, 10) || 120;
    const parsedYear = Number.parseInt(releaseYear, 10) || 2026;
    const watchedTime = exactTime
      ? `${exactTime}:00`
      : timeOfDayBucket === 'none'
        ? null
        : bucketToDefaultTime(Number(timeOfDayBucket) as TimeOfDayBucket);

    return {
      tmdbId,
      title: cleanTitle,
      releaseYear: parsedYear,
      watchedDate,
      watchedTime,
      rating: parsedRating,
      runtimeMinutes: parsedRuntime,
      isRewatch,
      directors,
      countries,
      genres,
    };
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || parsing) return;

    if (!isImportMode) {
      const cleanTitle = title.trim();
      if (!cleanTitle) {
        setErrorMsg('Введите название фильма.');
        return;
      }
      setSubmitting(true);
      setErrorMsg(null);
      try {
        await onSave(buildManualPayload(cleanTitle));
        resetManualFields();
        onClose();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Не удалось сохранить просмотр.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!hasImportRows) {
      setErrorMsg('Сначала выберите или перетащите CSV, TXT или JSON файл.');
      return;
    }
    if (newRowsCount === 0) {
      setErrorMsg('Все записи из файла уже есть в журнале.');
      return;
    }

    setErrorMsg(null);
    setImporting(true);
    try {
      if (onConfirmImport) {
        await onConfirmImport(importRows, isDemoMode && replaceDemo, (done, total) => {
          setImportProgress({ done, total });
        });
      }
      setImportRows([]);
      setFileLabels([]);
      setImportProgress(null);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Не удалось импортировать просмотры.');
    } finally {
      setImporting(false);
    }
  };

  const submitButtonLabel = isEditing
    ? 'Сохранить изменения'
    : isImportMode
      ? newRowsCount > 0
        ? `Импортировать (${newRowsCount})`
        : 'Импортировать'
      : 'Сохранить просмотр';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-5 sm:pt-8 bg-black/75 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-watch-modal-title"
        tabIndex={-1}
        className={`w-full ${
          isImportMode && hasImportRows ? 'max-w-2xl' : 'max-w-lg'
        } rounded-2xl bg-card border border-lineStrong shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-3.5rem)] transition-[max-width] duration-200 focus:outline-none`}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line shrink-0">
          <div className="flex items-center gap-2">
            {isEditing ? (
              <Pencil className="w-4 h-4 text-[#45d1c6]" aria-hidden="true" />
            ) : (
              <PlusCircle className="w-4 h-4 text-[#f06292]" aria-hidden="true" />
            )}
            <h3 id="add-watch-modal-title" className="text-sm font-semibold text-white">
              {isEditing ? 'Редактировать просмотр' : 'Добавить просмотр'}
            </h3>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            aria-label="Закрыть"
            className="w-9 h-9 inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-cardElevated disabled:opacity-40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Segmented Tab Bar separating Manual Entry vs File Import */}
        {!isEditing && onConfirmImport && (
          <div className="px-5 py-2.5 border-b border-line bg-canvas/40 shrink-0">
            <div
              role="tablist"
              aria-label="Способ добавления просмотра"
              className="grid grid-cols-2 p-1 rounded-xl bg-canvas border border-line gap-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'manual'}
                disabled={busy}
                onClick={() => {
                  setActiveTab('manual');
                  setErrorMsg(null);
                }}
                className={`inline-flex items-center justify-center gap-1.5 min-h-9 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6] ${
                  activeTab === 'manual'
                    ? 'bg-cardElevated text-white border border-lineStrong shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5 text-[#f06292]" aria-hidden="true" />
                <span>Добавить вручную</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'import'}
                disabled={busy}
                onClick={() => {
                  setActiveTab('import');
                  setErrorMsg(null);
                  setSuggestions([]);
                }}
                className={`inline-flex items-center justify-center gap-1.5 min-h-9 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6] ${
                  activeTab === 'import'
                    ? 'bg-cardElevated text-white border border-lineStrong shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Upload className="w-3.5 h-3.5 text-[#45d1c6]" aria-hidden="true" />
                <span>
                  Импорт файла{hasImportRows ? ` (${newRowsCount})` : ''}
                </span>
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5">
            {!isImportMode ? (
              <>
                {/* Movie Title + Keyboard-Accessible TMDB Autocomplete */}
                <div className="relative">
                  <label htmlFor="fTitle" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Название фильма (TMDB поиск)
                  </label>
                  <div className="relative">
                    <Search
                      className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      ref={titleInputRef}
                      id="fTitle"
                      type="text"
                      required
                      role="combobox"
                      aria-expanded={suggestions.length > 0}
                      aria-controls="tmdb-suggestions-listbox"
                      aria-autocomplete="list"
                      aria-activedescendant={
                        activeSuggestionIdx >= 0 ? `tmdb-opt-${activeSuggestionIdx}` : undefined
                      }
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        setTmdbId(null);
                        setDirectors([]);
                        setCountries([]);
                        setGenres([]);
                        setAllowSearch(true);
                      }}
                      onKeyDown={handleTitleKeyDown}
                      placeholder="Например: Одиссея или Дюна"
                      className="w-full min-h-10 pl-9 pr-9 py-2 rounded-xl bg-canvas border border-line text-sm text-white placeholder-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f06292] focus:border-[#f06292]"
                    />
                    {searching && (
                      <Loader2
                        className="w-3.5 h-3.5 text-[#45d1c6] animate-spin absolute right-3.5 top-1/2 -translate-y-1/2"
                        aria-hidden="true"
                      />
                    )}
                  </div>

                  {suggestions.length > 0 && (
                    <div
                      id="tmdb-suggestions-listbox"
                      role="listbox"
                      aria-label="Результаты поиска фильма"
                      className="absolute left-0 right-0 mt-1.5 rounded-xl bg-[#0b0e17] border border-lineStrong shadow-2xl z-20 max-h-48 overflow-y-auto divide-y divide-line"
                    >
                      {suggestions.map((item, idx) => {
                        const isActive = idx === activeSuggestionIdx;
                        return (
                          <button
                            id={`tmdb-opt-${idx}`}
                            key={`${item.tmdbId}-${item.title}`}
                            type="button"
                            role="option"
                            aria-selected={isActive}
                            onMouseEnter={() => setActiveSuggestionIdx(idx)}
                            onClick={() => void handleSelectSuggestion(item)}
                            className={`w-full min-h-10 px-3.5 py-2.5 text-left transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                              isActive ? 'bg-cardElevated text-white' : 'hover:bg-cardElevated'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-white truncate">{item.title}</div>
                              {item.overview && (
                                <div className="text-xs text-slate-400 truncate">{item.overview}</div>
                              )}
                            </div>
                            {item.releaseYear && (
                              <span className="text-xs font-mono text-[#45d1c6] shrink-0">
                                {item.releaseYear}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="fRating" className="block text-xs font-medium text-slate-300 mb-1.5">
                      Оценка (0.5–5)
                    </label>
                    <select
                      id="fRating"
                      value={rating}
                      onChange={(e) => setRating(e.target.value)}
                      className="w-full min-h-10 px-3 py-2 rounded-xl bg-canvas border border-line text-sm font-mono text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f06292] focus:border-[#f06292]"
                    >
                      <option value="5">5.0 ★</option>
                      <option value="4.5">4.5 ★</option>
                      <option value="4">4.0 ★</option>
                      <option value="3.5">3.5 ★</option>
                      <option value="3">3.0 ★</option>
                      <option value="2.5">2.5 ★</option>
                      <option value="2">2.0 ★</option>
                      <option value="1.5">1.5 ★</option>
                      <option value="1">1.0 ★</option>
                      <option value="0.5">0.5 ★</option>
                      <option value="">Без оценки</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="fRuntime"
                      className="block text-xs font-medium text-slate-300 mb-1.5"
                    >
                      Длительность (мин)
                    </label>
                    <input
                      id="fRuntime"
                      type="number"
                      min={1}
                      max={1500}
                      value={runtime}
                      onChange={(e) => setRuntime(e.target.value)}
                      required
                      className="w-full min-h-10 px-3.5 py-2 rounded-xl bg-canvas border border-line text-sm font-mono text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f06292] focus:border-[#f06292]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="fReleaseYear"
                      className="block text-xs font-medium text-slate-300 mb-1.5"
                    >
                      Год выхода
                    </label>
                    <input
                      id="fReleaseYear"
                      type="number"
                      min={1870}
                      max={2030}
                      value={releaseYear}
                      onChange={(e) => setReleaseYear(e.target.value)}
                      required
                      className="w-full min-h-10 px-3.5 py-2 rounded-xl bg-canvas border border-line text-sm font-mono text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f06292] focus:border-[#f06292]"
                    />
                  </div>

                  <div>
                    <label htmlFor="fDate" className="block text-xs font-medium text-slate-300 mb-1.5">
                      Дата просмотра
                    </label>
                    <input
                      id="fDate"
                      type="date"
                      value={watchedDate}
                      onChange={(e) => setWatchedDate(e.target.value)}
                      required
                      className="w-full min-h-10 px-3 py-2 rounded-xl bg-canvas border border-line text-sm font-mono text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f06292] focus:border-[#f06292]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="fTimeOfDay"
                      className="block text-xs font-medium text-slate-300 mb-1.5"
                    >
                      Время суток
                    </label>
                    <select
                      id="fTimeOfDay"
                      value={timeOfDayBucket}
                      onChange={(e) => {
                        setTimeOfDayBucket(e.target.value as BucketOption);
                        setExactTime('');
                      }}
                      className="w-full min-h-10 px-3 py-2 rounded-xl bg-canvas border border-line text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f06292] focus:border-[#f06292]"
                    >
                      <option value="0">05:00–11:59</option>
                      <option value="1">12:00–16:59</option>
                      <option value="2">17:00–22:59</option>
                      <option value="3">23:00–04:59</option>
                      <option value="none">Не указано (без времени)</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="fExactTime"
                      className="block text-xs font-medium text-slate-300 mb-1.5"
                    >
                      Точное время (опц.)
                    </label>
                    <input
                      id="fExactTime"
                      type="time"
                      value={exactTime}
                      onChange={(e) => {
                        const val = e.target.value;
                        setExactTime(val);
                        if (val) {
                          const b = timeStringToBucket(`${val}:00`);
                          if (b !== null) setTimeOfDayBucket(String(b) as BucketOption);
                        }
                      }}
                      className="w-full min-h-10 px-3 py-2 rounded-xl bg-canvas border border-line text-sm font-mono text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f06292] focus:border-[#f06292]"
                    />
                  </div>
                </div>

                <label className="flex items-center justify-between p-3 rounded-xl bg-canvas border border-line cursor-pointer focus-within:ring-2 focus-within:ring-[#45d1c6]">
                  <div>
                    <span className="text-xs font-medium text-slate-200 block">
                      Пересмотр (Rewatch)
                    </span>
                    <span className="text-xs text-slate-400">
                      Отметит фильм как повторный просмотр
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isRewatch}
                    onChange={(e) => setIsRewatch(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#d6b85a] cursor-pointer focus:outline-none"
                  />
                </label>
              </>
            ) : (
              /* Dedicated File Import Tab */
              <div className="space-y-3">
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Загрузить файлы CSV, TXT или JSON для импорта"
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!busy && !parsing) setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => {
                    if (!busy && !parsing) fileInputRef.current?.click();
                  }}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && !busy && !parsing) {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  className={`rounded-xl border-2 border-dashed p-5 text-center cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6] ${
                    dragging
                      ? 'border-[#45d1c6] bg-[#45d1c6]/10'
                      : 'border-lineStrong bg-canvas/60 hover:border-[#45d1c6]/60'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt,.json"
                    multiple
                    tabIndex={-1}
                    className="hidden"
                    onChange={(e) => {
                      void processFiles(Array.from(e.target.files ?? []));
                      e.target.value = '';
                    }}
                  />
                  <div className="w-10 h-10 rounded-xl bg-cardElevated border border-line flex items-center justify-center mx-auto mb-2.5">
                    {parsing ? (
                      <Loader2 className="w-5 h-5 text-[#45d1c6] animate-spin" aria-hidden="true" />
                    ) : (
                      <Upload className="w-5 h-5 text-[#45d1c6]" aria-hidden="true" />
                    )}
                  </div>
                  <p className="text-xs font-medium text-white">
                    Импорт CSV (Letterboxd / IMDb), .txt или .json
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Перетащите файлы сюда или нажмите для выбора с диска
                  </p>
                </div>

                {importRows.length > 0 && (
                  <div className="space-y-3">
                    {isDemoMode && (
                      <label className="flex items-center justify-between p-3 rounded-xl bg-canvas border border-line cursor-pointer text-xs focus-within:ring-2 focus-within:ring-[#45d1c6]">
                        <div>
                          <span className="font-medium text-slate-200 block">
                            Заменить демо-данные на импортированный архив
                          </span>
                          <span className="text-xs text-slate-400">
                            Скрывает учебные данные 2024–2026 и показывает только ваш архив
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={replaceDemo}
                          onChange={(e) => {
                            const next = e.target.checked;
                            setReplaceDemo(next);
                            const baseline = next ? [] : existingEntries;
                            setImportRows((prev) => annotateImportBatch(prev, baseline));
                          }}
                          className="w-4 h-4 accent-[#45d1c6] cursor-pointer focus:outline-none"
                        />
                      </label>
                    )}

                    {/* Summary Badges + Clear */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
                        <span className="px-2 py-1 rounded-lg bg-cardElevated border border-line text-slate-200">
                          Файлы: {fileLabels.join(', ')}
                        </span>
                        <span className="px-2 py-1 rounded-lg bg-[#45d1c6]/10 border border-[#45d1c6]/30 text-[#45d1c6]">
                          К импорту: {newRowsCount}
                        </span>
                        {duplicateCount > 0 && (
                          <span className="px-2 py-1 rounded-lg bg-cardElevated border border-line text-slate-300">
                            Дубликатов пропущено: {duplicateCount}
                          </span>
                        )}
                        {autoRewatchCount > 0 && (
                          <span className="px-2 py-1 rounded-lg bg-[#d6b85a]/10 border border-[#d6b85a]/30 text-[#d6b85a]">
                            ↺ Авто-пересмотров: {autoRewatchCount}
                          </span>
                        )}
                        {withoutTimeCount > 0 && (
                          <span className="px-2 py-1 rounded-lg bg-cardElevated border border-line text-slate-300">
                            Без времени суток: {withoutTimeCount}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={clearImport}
                        className="inline-flex items-center gap-1 min-h-9 px-2.5 py-1 rounded-lg text-xs text-slate-300 hover:text-[#f06292] hover:bg-cardElevated transition-colors cursor-pointer disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f06292]"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Очистить</span>
                      </button>
                    </div>

                    {/* Preview Table */}
                    <div className="rounded-xl border border-line bg-canvas/50 overflow-hidden max-h-52 overflow-y-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-cardElevated text-xs font-mono uppercase text-slate-300 sticky top-0">
                          <tr>
                            <th className="py-2 px-3">Фильм</th>
                            <th className="py-2 px-3">Дата</th>
                            <th className="py-2 px-3">Оценка</th>
                            <th className="py-2 px-3">Статус</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line/60">
                          {importRows.slice(0, 50).map((r) => (
                            <tr key={r.tempId} className={r.isDuplicate ? 'opacity-50' : ''}>
                              <td className="py-2 px-3 text-slate-200">
                                {r.title}{' '}
                                {r.releaseYear && (
                                  <span className="font-mono text-slate-400">
                                    ({r.releaseYear})
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 font-mono text-slate-300">
                                {r.watchedDate}
                              </td>
                              <td className="py-2 px-3 font-mono text-[#d6b85a]">
                                {r.rating !== null ? `${r.rating.toFixed(1)}★` : '—'}
                              </td>
                              <td className="py-2 px-3 font-mono text-xs">
                                {r.isDuplicate ? (
                                  <span className="text-slate-400">Дубликат</span>
                                ) : r.isRewatch ? (
                                  <span className="text-[#d6b85a]">↺ Пересмотр</span>
                                ) : (
                                  <span className="text-[#45d1c6]">Новый</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {importRows.length > 50 && (
                      <p className="text-xs font-mono text-slate-400">
                        Показаны первые 50 из {importRows.length} строк.
                      </p>
                    )}

                    {importProgress && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-mono text-slate-300">
                          <span>Обогащение метаданных через TMDB Edge Function...</span>
                          <span>
                            {importProgress.done} / {importProgress.total}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-canvas border border-line overflow-hidden">
                          <div
                            className="h-full bg-[#45d1c6] transition-all"
                            style={{
                              width: `${Math.round(
                                (importProgress.done / Math.max(1, importProgress.total)) * 100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {errorMsg && (
              <div
                role="alert"
                className="flex items-start gap-2 p-3 rounded-xl bg-[#f06292]/10 border border-[#f06292]/30 text-xs text-[#f06292]"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          <div className="px-5 py-3.5 border-t border-line flex items-center justify-end gap-2.5 bg-card shrink-0">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="min-h-10 px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-cardElevated disabled:opacity-40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className="inline-flex items-center gap-2 min-h-10 px-4 py-2 rounded-xl text-xs font-semibold bg-[#f06292] hover:bg-[#f47ba4] disabled:opacity-50 text-[#0b0e17] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
              {submitButtonLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
