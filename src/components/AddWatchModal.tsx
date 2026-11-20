import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, PlusCircle, Search, X } from 'lucide-react';
import { bucketToDefaultTime, DEMO_MOVIE_CATALOG, SIM_DATE_ISO } from '../lib/demoData';
import { enrichMovieViaProxy, isSupabaseConfigured, searchTmdbViaProxy } from '../lib/supabase';
import type { TimeOfDayBucket, TmdbSearchResult } from '../types/cinelog';

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
}

export function AddWatchModal({ open, onClose, onSave, isDemoMode }: AddWatchModalProps) {
  const [title, setTitle] = useState('');
  const [tmdbId, setTmdbId] = useState<number | null>(null);
  const [rating, setRating] = useState<string>('4');
  const [runtime, setRuntime] = useState<string>('124');
  const [releaseYear, setReleaseYear] = useState<string>('2026');
  const [watchedDate, setWatchedDate] = useState<string>(
    isDemoMode ? SIM_DATE_ISO : new Date().toISOString().slice(0, 10)
  );
  const [timeOfDayBucket, setTimeOfDayBucket] = useState<0 | 1 | 2 | 3>(2);
  const [exactTime, setExactTime] = useState<string>('');
  const [isRewatch, setIsRewatch] = useState(false);
  const [director, setDirector] = useState('');
  const [country, setCountry] = useState('');
  const [genre, setGenre] = useState('');

  const [suggestions, setSuggestions] = useState<TmdbSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setWatchedDate(isDemoMode ? SIM_DATE_ISO : new Date().toISOString().slice(0, 10));
    setErrorMsg(null);
  }, [open, isDemoMode]);

  useEffect(() => {
    if (!open) return;
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
  }, [title, open, isDemoMode, tmdbId]);

  if (!open) return null;

  const handleSelectSuggestion = async (item: TmdbSearchResult) => {
    setTitle(item.title);
    setTmdbId(item.tmdbId > 0 ? item.tmdbId : null);
    if (item.releaseYear) setReleaseYear(String(item.releaseYear));
    setSuggestions([]);

    const catalogHit = DEMO_MOVIE_CATALOG.find(
      (m) => m.tmdb_id === item.tmdbId || m.title.toLowerCase() === item.title.toLowerCase()
    );
    if (catalogHit) {
      if (catalogHit.runtime_minutes) setRuntime(String(catalogHit.runtime_minutes));
      setDirector(catalogHit.directors[0] ?? '');
      setCountry(catalogHit.countries[0] ?? '');
      setGenre(catalogHit.genres[0] ?? '');
      return;
    }

    if (!isDemoMode && isSupabaseConfigured && item.tmdbId > 0) {
      setSearching(true);
      try {
        const enriched = await enrichMovieViaProxy(item.tmdbId);
        if (enriched) {
          if (enriched.runtime_minutes) setRuntime(String(enriched.runtime_minutes));
          setDirector(enriched.directors[0] ?? '');
          setCountry(enriched.countries[0] ?? '');
          setGenre(enriched.genres[0] ?? '');
        }
      } finally {
        setSearching(false);
      }
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    setSubmitting(true);
    setErrorMsg(null);

    const parsedRating = rating === '' ? null : Number.parseFloat(rating);
    const parsedRuntime = Number.parseInt(runtime, 10) || 120;
    const parsedYear = Number.parseInt(releaseYear, 10) || 2026;
    const watchedTime = exactTime
      ? `${exactTime}:00`
      : bucketToDefaultTime(timeOfDayBucket as TimeOfDayBucket);

    try {
      await onSave({
        tmdbId,
        title: cleanTitle,
        releaseYear: parsedYear,
        watchedDate,
        watchedTime,
        rating: parsedRating,
        runtimeMinutes: parsedRuntime,
        isRewatch,
        directors: director.trim() ? [director.trim()] : [],
        countries: country.trim() ? [country.trim()] : [],
        genres: genre.trim() ? [genre.trim()] : [],
      });
      setTitle('');
      setTmdbId(null);
      setExactTime('');
      setIsRewatch(false);
      setDirector('');
      setCountry('');
      setGenre('');
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Не удалось сохранить просмотр.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-card border border-lineStrong shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-[#f06292]" />
            <h3 className="text-sm font-semibold text-white">Добавить просмотр</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-cardElevated transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
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
                required
                autoFocus
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setTmdbId(null);
                  setDirector('');
                  setCountry('');
                  setGenre('');
                }}
                placeholder="Например: Одиссея или Дюна"
                className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-canvas border border-line text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#f06292]"
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
                className="w-full px-3 py-2.5 rounded-xl bg-canvas border border-line text-sm font-mono text-white focus:outline-none focus:border-[#f06292]"
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
              <label htmlFor="fRuntime" className="block text-xs font-medium text-slate-300 mb-1.5">
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
                className="w-full px-3.5 py-2.5 rounded-xl bg-canvas border border-line text-sm font-mono text-white focus:outline-none focus:border-[#f06292]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="fReleaseYear" className="block text-xs font-medium text-slate-300 mb-1.5">
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
                className="w-full px-3.5 py-2.5 rounded-xl bg-canvas border border-line text-sm font-mono text-white focus:outline-none focus:border-[#f06292]"
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
                className="w-full px-3 py-2.5 rounded-xl bg-canvas border border-line text-sm font-mono text-white focus:outline-none focus:border-[#f06292]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="fTimeOfDay" className="block text-xs font-medium text-slate-300 mb-1.5">
                Время суток
              </label>
              <select
                id="fTimeOfDay"
                value={timeOfDayBucket}
                onChange={(e) => setTimeOfDayBucket(Number(e.target.value) as 0 | 1 | 2 | 3)}
                className="w-full px-3 py-2.5 rounded-xl bg-canvas border border-line text-sm text-white focus:outline-none focus:border-[#f06292]"
              >
                <option value={0}>Утро</option>
                <option value={1}>День</option>
                <option value={2}>Вечер</option>
                <option value={3}>Ночь</option>
              </select>
            </div>

            <div>
              <label htmlFor="fExactTime" className="block text-xs font-medium text-slate-300 mb-1.5">
                Точное время (опц.)
              </label>
              <input
                id="fExactTime"
                type="time"
                value={exactTime}
                onChange={(e) => setExactTime(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-canvas border border-line text-sm font-mono text-white focus:outline-none focus:border-[#f06292]"
              />
            </div>
          </div>

          <label className="flex items-center justify-between p-3 rounded-xl bg-canvas border border-line cursor-pointer">
            <div>
              <span className="text-xs font-medium text-slate-200 block">Пересмотр (Rewatch)</span>
              <span className="text-[11px] text-slate-500">Отметит фильм как повторный просмотр</span>
            </div>
            <input
              type="checkbox"
              checked={isRewatch}
              onChange={(e) => setIsRewatch(e.target.checked)}
              className="w-4 h-4 rounded accent-[#d6b85a] cursor-pointer"
            />
          </label>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-[#f06292]/10 border border-[#f06292]/30 text-xs text-[#f06292]">
              {errorMsg}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-cardElevated transition-colors cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#f06292] hover:bg-[#f47ba4] disabled:opacity-60 text-[#0b0e17] transition-colors cursor-pointer"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
