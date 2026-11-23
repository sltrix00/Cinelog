import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react';
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
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [importRows, setImportRows] = useState<ParsedImportRow[]>([]);
  const [fileLabels, setFileLabels] = useState<string[]>([]);
  const [replaceDemo, setReplaceDemo] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    setSuggestions([]);
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
    if (!open || !allowSearch) return;
    const q = title.trim();
    if (q.length < 2 || tmdbId !== null) {
      setSuggestions([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      // Always provide instant catalog matches; supplement with live TMDB Edge Function when signed in
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
          setSuggestions(remote.length > 0 ? remote.slice(0, 6) : localMatches);
        } catch {
          setSuggestions(localMatches);
        } finally {
          setSearching(false);
        }
      } else {
        setSuggestions(localMatches);
      }
    }, 280);

    return () => window.clearTimeout(timer);
  }, [title, open, isDemoMode, tmdbId, allowSearch]);

  if (!open) return null;

  const hasImportRows = !isEditing && importRows.length > 0;
  const newRowsCount = importRows.filter((r) => !r.isDuplicate).length;
  const duplicateCount = importRows.filter((r) => r.isDuplicate).length;
  const autoRewatchCount = importRows.filter((r) => !r.isDuplicate && r.autoRewatchDetected).length;
  const withoutTimeCount = importRows.filter((r) => !r.isDuplicate && !r.watchedTime).length;
  const busy = submitting || importing;
  const canSave =
    !busy && !parsing && (!hasImportRows || newRowsCount > 0 || Boolean(title.trim()));

  const handleSelectSuggestion = async (item: TmdbSearchResult) => {
    setTitle(item.title);
    setTmdbId(item.tmdbId > 0 ? item.tmdbId : null);
    if (item.releaseYear) setReleaseYear(String(item.releaseYear));
    setSuggestions([]);
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

    const cleanTitle = title.trim();

    if (isEditing || !hasImportRows) {
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

    if (!cleanTitle && newRowsCount === 0) {
      setErrorMsg('Все записи из файла уже есть в журнале.');
      return;
    }

    setErrorMsg(null);
    try {
      if (cleanTitle) {
        setSubmitting(true);
        await onSave(buildManualPayload(cleanTitle));
        resetManualFields();
        setSubmitting(false);
      }

      if (newRowsCount > 0 && onConfirmImport) {
        setImporting(true);
        await onConfirmImport(importRows, isDemoMode && replaceDemo, (done, total) => {
          setImportProgress({ done, total });
        });
        setImportRows([]);
        setFileLabels([]);
        setImportProgress(null);
      }

      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Не удалось сохранить или импортировать просмотры.'
      );
    } finally {
      setSubmitting(false);
      setImporting(false);
    }
  };

  const submitButtonLabel = isEditing
    ? 'Сохранить изменения'
    : hasImportRows && !title.trim()
      ? `Сохранить (${newRowsCount})`
      : 'Сохранить';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-5 sm:pt-8 bg-black/75 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className={`w-full ${
          hasImportRows ? 'max-w-2xl' : 'max-w-lg'
        } rounded-2xl bg-card border border-lineStrong shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-3.5rem)] transition-[max-width] duration-200`}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line shrink-0">
          <div className="flex items-center gap-2">
            {isEditing ? (
              <Pencil className="w-4 h-4 text-[#45d1c6]" />
            ) : (
              <PlusCircle className="w-4 h-4 text-[#f06292]" />
            )}
            <h3 className="text-sm font-semibold text-white">
              {isEditing ? 'Редактировать просмотр' : 'Добавить просмотр'}
            </h3>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            aria-label="Закрыть"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-cardElevated disabled:opacity-40 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {/* Movie Title + TMDB Autocomplete */}
            <div className="relative">
              <label htmlFor="fTitle" className="block text-xs font-medium text-slate-300 mb-1.5">
                Название фильма (TMDB поиск)
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="fTitle"
                  type="text"
                  required={!hasImportRows}
                  autoFocus
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setTmdbId(null);
                    setDirectors([]);
                    setCountries([]);
                    setGenres([]);
                    setAllowSearch(true);
                  }}
                  placeholder="Например: Одиссея или Дюна"
                  className="w-full pl-9 pr-9 py-2 rounded-xl bg-canvas border border-line text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#f06292]"
                />
                {searching && (
                  <Loader2 className="w-3.5 h-3.5 text-[#45d1c6] animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
                )}
              </div>

              {suggestions.length > 0 && (
                <div className="absolute left-0 right-0 mt-1.5 rounded-xl bg-[#0b0e17] border border-lineStrong shadow-2xl z-20 max-h-48 overflow-y-auto divide-y divide-line">
                  {suggestions.map((item) => (
                    <button
                      key={`${item.tmdbId}-${item.title}`}
                      type="button"
                      onClick={() => void handleSelectSuggestion(item)}
                      className="w-full px-3.5 py-2.5 text-left hover:bg-cardElevated transition-colors flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-white truncate">{item.title}</div>
                        {item.overview && (
                          <div className="text-[11px] text-slate-400 truncate">{item.overview}</div>
                        )}
                      </div>
                      {item.releaseYear && (
                        <span className="text-[11px] font-mono text-[#45d1c6] shrink-0">
                          {item.releaseYear}
                        </span>
                      )}
                    </button>
                  ))}
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
                  className="w-full px-3 py-2 rounded-xl bg-canvas border border-line text-sm font-mono text-white focus:outline-none focus:border-[#f06292]"
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
                  required={!hasImportRows}
                  className="w-full px-3.5 py-2 rounded-xl bg-canvas border border-line text-sm font-mono text-white focus:outline-none focus:border-[#f06292]"
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
                  required={!hasImportRows}
                  className="w-full px-3.5 py-2 rounded-xl bg-canvas border border-line text-sm font-mono text-white focus:outline-none focus:border-[#f06292]"
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
                  required={!hasImportRows}
                  className="w-full px-3 py-2 rounded-xl bg-canvas border border-line text-sm font-mono text-white focus:outline-none focus:border-[#f06292]"
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
                  className="w-full px-3 py-2 rounded-xl bg-canvas border border-line text-sm text-white focus:outline-none focus:border-[#f06292]"
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
                  className="w-full px-3 py-2 rounded-xl bg-canvas border border-line text-sm font-mono text-white focus:outline-none focus:border-[#f06292]"
                />
              </div>
            </div>

            <label className="flex items-center justify-between p-2.5 rounded-xl bg-canvas border border-line cursor-pointer">
              <div>
                <span className="text-xs font-medium text-slate-200 block">
                  Пересмотр (Rewatch)
                </span>
                <span className="text-[11px] text-slate-500">
                  Отметит фильм как повторный просмотр
                </span>
              </div>
              <input
                type="checkbox"
                checked={isRewatch}
                onChange={(e) => setIsRewatch(e.target.checked)}
                className="w-4 h-4 rounded accent-[#d6b85a] cursor-pointer"
              />
            </label>

            {/* CSV / TXT / JSON Import Section below manual form */}
            {!isEditing && onConfirmImport && (
              <>
                <div className="relative flex items-center py-0.5">
                  <div className="flex-grow border-t border-line" />
                  <span className="shrink mx-3 text-xs text-slate-400">или</span>
                  <div className="flex-grow border-t border-line" />
                </div>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!busy && !parsing) setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => {
                    if (!busy && !parsing) fileInputRef.current?.click();
                  }}
                  className={`rounded-xl border-2 border-dashed p-4 text-center cursor-pointer transition-all ${
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
                    className="hidden"
                    onChange={(e) => {
                      void processFiles(Array.from(e.target.files ?? []));
                      e.target.value = '';
                    }}
                  />
                  <div className="w-8 h-8 rounded-xl bg-cardElevated border border-line flex items-center justify-center mx-auto mb-2">
                    {parsing ? (
                      <Loader2 className="w-4 h-4 text-[#45d1c6] animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 text-[#45d1c6]" />
                    )}
                  </div>
                  <p className="text-xs font-medium text-white">
                    Импорт CSV (Letterboxd / IMDb), .txt или .json
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Перетащите файлы сюда или нажмите для выбора
                  </p>
                </div>

                {importRows.length > 0 && (
                  <div className="space-y-3">
                    {isDemoMode && (
                      <label className="flex items-center justify-between p-2.5 rounded-xl bg-canvas border border-line cursor-pointer text-xs">
                        <div>
                          <span className="font-medium text-slate-200 block">
                            Заменить демо-данные на импортированный архив
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Удобно для проверки графика «Время суток» на чистом CSV без времени
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
                          className="w-4 h-4 accent-[#45d1c6] cursor-pointer"
                        />
                      </label>
                    )}

                    {/* Summary Badges + Clear */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                        <span className="px-2 py-1 rounded-lg bg-cardElevated border border-line text-slate-200">
                          Файлы: {fileLabels.join(', ')}
                        </span>
                        <span className="px-2 py-1 rounded-lg bg-[#45d1c6]/10 border border-[#45d1c6]/30 text-[#45d1c6]">
                          К импорту: {newRowsCount}
                        </span>
                        {duplicateCount > 0 && (
                          <span className="px-2 py-1 rounded-lg bg-cardElevated border border-line text-slate-400">
                            Дубликатов пропущено: {duplicateCount}
                          </span>
                        )}
                        {autoRewatchCount > 0 && (
                          <span className="px-2 py-1 rounded-lg bg-[#d6b85a]/10 border border-[#d6b85a]/30 text-[#d6b85a]">
                            ↺ Авто-пересмотров: {autoRewatchCount}
                          </span>
                        )}
                        {withoutTimeCount > 0 && (
                          <span className="px-2 py-1 rounded-lg bg-cardElevated border border-line text-slate-400">
                            Без времени суток: {withoutTimeCount}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={clearImport}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-slate-400 hover:text-[#f06292] hover:bg-cardElevated transition-colors cursor-pointer disabled:opacity-40"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Очистить</span>
                      </button>
                    </div>

                    {/* Preview Table */}
                    <div className="rounded-xl border border-line bg-canvas/50 overflow-hidden max-h-48 overflow-y-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-cardElevated text-[10px] font-mono uppercase text-slate-400 sticky top-0">
                          <tr>
                            <th className="py-2 px-3">Фильм</th>
                            <th className="py-2 px-3">Дата</th>
                            <th className="py-2 px-3">Оценка</th>
                            <th className="py-2 px-3">Статус</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line/60">
                          {importRows.slice(0, 50).map((r) => (
                            <tr key={r.tempId} className={r.isDuplicate ? 'opacity-45' : ''}>
                              <td className="py-2 px-3 text-slate-200">
                                {r.title}{' '}
                                {r.releaseYear && (
                                  <span className="font-mono text-slate-500">
                                    ({r.releaseYear})
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 font-mono text-slate-400">
                                {r.watchedDate}
                              </td>
                              <td className="py-2 px-3 font-mono text-[#d6b85a]">
                                {r.rating !== null ? `${r.rating.toFixed(1)}★` : '—'}
                              </td>
                              <td className="py-2 px-3 font-mono text-[10px]">
                                {r.isDuplicate ? (
                                  <span className="text-slate-500">Дубликат</span>
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
                      <p className="text-[11px] font-mono text-slate-500">
                        Показаны первые 50 из {importRows.length} строк.
                      </p>
                    )}

                    {importProgress && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px] font-mono text-slate-400">
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
              </>
            )}

            {errorMsg && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-[#f06292]/10 border border-[#f06292]/30 text-xs text-[#f06292]">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          <div className="px-5 py-3.5 border-t border-line flex items-center justify-end gap-2.5 bg-card shrink-0">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-cardElevated disabled:opacity-40 transition-colors cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#f06292] hover:bg-[#f47ba4] disabled:opacity-50 text-[#0b0e17] transition-colors cursor-pointer"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {submitButtonLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
