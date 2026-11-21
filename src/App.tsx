import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, RotateCcw } from 'lucide-react';
import { AddWatchModal, type AddWatchPayload } from './components/AddWatchModal';
import { AuthModal } from './components/AuthModal';
import { CsvImportModal } from './components/CsvImportModal';
import { Header } from './components/Header';
import { JournalSection } from './components/JournalSection';
import { Tier1KpiSection } from './components/Tier1KpiSection';
import { Tier2DynamicsSection } from './components/Tier2DynamicsSection';
import { Tier3RhythmSection } from './components/Tier3RhythmSection';
import { Tier4DeepAnalyticsSection } from './components/Tier4DeepAnalyticsSection';
import {
  computeActivityHeatmap,
  computeCumulativeComparison365,
  computeDayOfWeekDistribution,
  computeMonthlyByYear,
  computeRatingsAnalytics,
  computeReleaseEras,
  computeRuntimeAnalytics,
  computeTasteAccents,
  computeTier1KPIs,
  computeTimeOfDayDistribution,
  computeViewingIndexTrajectory,
  DEFAULT_REFERENCE_DATE,
  getReferenceDateForToday,
} from './lib/analytics';
import { parseAuthCallbackError } from './lib/authHelpers';
import { parsedRowsToLocalWatchEntries } from './lib/csvImport';
import { DEMO_ENTRIES, SIM_DAY_OF_YEAR, SIM_YEAR } from './lib/demoData';
import {
  batchUpsertImportedRows,
  deleteWatchLogById,
  fetchWatchEntries,
  getVerifiedUser,
  insertManualWatchLog,
  isSupabaseConfigured,
  onAuthChanged,
  reenrichUserMovies,
  signOutAccount,
} from './lib/supabase';
import type { ParsedImportRow, ReenrichSummary, WatchEntry, YearFilter } from './types/cinelog';

function DashboardSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-36 rounded-2xl bg-card border border-line" />
        ))}
      </div>
      <div className="h-32 rounded-2xl bg-card border border-line" />
      <div className="h-96 rounded-2xl bg-card border border-line" />
    </div>
  );
}

export function App() {
  const [selectedYear, setSelectedYear] = useState<YearFilter>(2026);
  const [entries, setEntries] = useState<WatchEntry[]>(DEMO_ENTRIES);
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [demoWasModified, setDemoWasModified] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loadingCloud, setLoadingCloud] = useState(false);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [authNotice, setAuthNotice] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const initialHadAuthCodeRef = useRef(
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('code')
  );
  const handledInitialCodeRef = useRef(false);
  const passwordRecoveryTriggeredRef = useRef(false);
  const [reenriching, setReenriching] = useState(false);
  const [reenrichProgress, setReenrichProgress] = useState<{ done: number; total: number } | null>(null);
  const [reenrichReport, setReenrichReport] = useState<ReenrichSummary | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg((curr) => (curr === msg ? null : curr));
    }, 3400);
  }, []);

  const loadCloudEntries = useCallback(async () => {
    setLoadingCloud(true);
    try {
      const cloudRows = await fetchWatchEntries();
      setEntries(cloudRows);
      setIsDemoMode(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Ошибка загрузки данных из Supabase.');
    } finally {
      setLoadingCloud(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let active = true;
    const hadAuthCode =
      initialHadAuthCodeRef.current || new URLSearchParams(window.location.search).has('code');
    initialHadAuthCodeRef.current = hadAuthCode;

    const cleanAuthCodeFromUrl = () => {
      const url = new URL(window.location.href);
      if (url.searchParams.has('code')) {
        url.searchParams.delete('code');
        window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
      }
    };

    const callbackError = parseAuthCallbackError(window.location);
    if (callbackError) {
      handledInitialCodeRef.current = true;
      showToast(callbackError);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const unsubscribe = onAuthChanged((user, event) => {
      setUserEmail(user?.email ?? null);
      if (event === 'PASSWORD_RECOVERY') {
        passwordRecoveryTriggeredRef.current = true;
        setIsPasswordRecovery(true);
        setAuthModalOpen(true);
        return;
      }
      if (user) {
        void loadCloudEntries();
      } else {
        setIsPasswordRecovery(false);
        setIsDemoMode(true);
        setEntries(DEMO_ENTRIES);
        setDemoWasModified(false);
        setReenrichReport(null);
        setReenrichProgress(null);
        setReenriching(false);
      }
    });

    void getVerifiedUser().then((user) => {
      if (!active) return;
      if (user) {
        setUserEmail(user.email ?? null);
        void loadCloudEntries();
        if (
          hadAuthCode &&
          !handledInitialCodeRef.current &&
          !callbackError &&
          !passwordRecoveryTriggeredRef.current
        ) {
          handledInitialCodeRef.current = true;
          cleanAuthCodeFromUrl();
          showToast('Почта подтверждена! Вы вошли в аккаунт.');
        }
      } else if (hadAuthCode && !handledInitialCodeRef.current && !callbackError) {
        handledInitialCodeRef.current = true;
        cleanAuthCodeFromUrl();
        setAuthNotice({
          type: 'success',
          text: 'Email подтверждён! Чтобы завершить вход в этом браузере, войдите по email и паролю.',
        });
        setAuthModalOpen(true);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [loadCloudEntries, showToast]);

  const refDate = useMemo(
    () => (isDemoMode ? DEFAULT_REFERENCE_DATE : getReferenceDateForToday()),
    [isDemoMode]
  );

  // Pure analytics calculations (Tier 1 -> Tier 4)
  const kpis = useMemo(
    () => computeTier1KPIs(entries, selectedYear, refDate),
    [entries, selectedYear, refDate]
  );
  const cumulativeData = useMemo(() => computeCumulativeComparison365(entries), [entries]);
  const indexTrajectory = useMemo(
    () => computeViewingIndexTrajectory(entries, selectedYear, refDate),
    [entries, selectedYear, refDate]
  );
  const monthlyData = useMemo(() => computeMonthlyByYear(entries), [entries]);
  const dayOfWeek = useMemo(
    () => computeDayOfWeekDistribution(entries, selectedYear),
    [entries, selectedYear]
  );
  const timeOfDay = useMemo(
    () => computeTimeOfDayDistribution(entries, selectedYear),
    [entries, selectedYear]
  );
  const heatmap = useMemo(
    () => computeActivityHeatmap(entries, selectedYear, refDate),
    [entries, selectedYear, refDate]
  );
  const ratings = useMemo(() => computeRatingsAnalytics(entries, selectedYear), [entries, selectedYear]);
  const releaseEras = useMemo(() => computeReleaseEras(entries, selectedYear), [entries, selectedYear]);
  const runtime = useMemo(() => computeRuntimeAnalytics(entries, selectedYear), [entries, selectedYear]);
  const tasteDirectors = useMemo(
    () => computeTasteAccents(entries, selectedYear, 'directors'),
    [entries, selectedYear]
  );
  const tasteCountries = useMemo(
    () => computeTasteAccents(entries, selectedYear, 'countries'),
    [entries, selectedYear]
  );
  const tasteGenres = useMemo(
    () => computeTasteAccents(entries, selectedYear, 'genres'),
    [entries, selectedYear]
  );

  const { pendingEnrichMovieIds, unmatchedMovieCount } = useMemo(() => {
    if (isDemoMode || !isSupabaseConfigured || !userEmail) {
      return { pendingEnrichMovieIds: [] as string[], unmatchedMovieCount: 0 };
    }
    const unmatched = new Set<string>();
    const needsRefresh = new Set<string>();
    for (const entry of entries) {
      if (!entry.movie_id) continue;
      if (entry.tmdb_id === null) {
        unmatched.add(entry.movie_id);
      } else if (entry.original_title === null) {
        needsRefresh.add(entry.movie_id);
      }
    }
    return {
      pendingEnrichMovieIds: [...unmatched, ...needsRefresh],
      unmatchedMovieCount: unmatched.size,
    };
  }, [entries, isDemoMode, userEmail]);

  const handleSaveWatch = async (payload: AddWatchPayload) => {
    if (!isDemoMode && isSupabaseConfigured && userEmail) {
      const saved = await insertManualWatchLog(payload);
      setEntries((prev) => [saved, ...prev]);
      const yr = Number.parseInt(payload.watchedDate.slice(0, 4), 10);
      if (yr === 2024 || yr === 2025 || yr === 2026) {
        setSelectedYear(yr);
      }
      showToast(
        `«${saved.title}» (${saved.rating !== null ? `${saved.rating.toFixed(1)}★` : 'без оценки'}${
          saved.is_rewatch ? ' · ↺ пересмотр' : ''
        }) сохранён в Supabase!`
      );
      return;
    }

    // Demo Mode in-memory add
    const demoUid =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : String(Date.now());
    const newEntry: WatchEntry = {
      id: `demo-added-${demoUid}`,
      movie_id: `demo-custom-${demoUid}`,
      tmdb_id: payload.tmdbId,
      imdb_id: null,
      title: payload.title,
      original_title: null,
      release_year: payload.releaseYear,
      watched_date: payload.watchedDate,
      watched_time: payload.watchedTime,
      rating: payload.rating,
      is_rewatch: payload.isRewatch,
      source: 'manual',
      runtime_minutes: payload.runtimeMinutes,
      runtime_override_minutes: null,
      genres: payload.genres,
      directors: payload.directors,
      countries: payload.countries,
      poster_url: null,
      import_key: null,
      created_at: new Date().toISOString(),
      unique_key: payload.isRewatch ? payload.title : `${payload.title}__new_${demoUid}`,
    };

    setEntries((prev) => [newEntry, ...prev]);
    setDemoWasModified(true);
    const yr = Number.parseInt(payload.watchedDate.slice(0, 4), 10);
    if (yr === 2024 || yr === 2025 || yr === 2026) {
      setSelectedYear(yr);
    }
    showToast(
      `«${payload.title}» (${payload.rating !== null ? `${payload.rating.toFixed(1)}★` : 'без оценки'}${
        payload.isRewatch ? ' · ↺ пересмотр' : ''
      }) добавлен!`
    );
  };

  const handleConfirmImport = async (
    rows: ParsedImportRow[],
    replaceDemo: boolean,
    onProgress?: (done: number, total: number) => void
  ) => {
    if (!isDemoMode && isSupabaseConfigured && userEmail) {
      const result = await batchUpsertImportedRows(rows, onProgress);
      await loadCloudEntries();
      if (!result.tmdbConfigured || result.errorCode) {
        showToast(
          `Импортировано ${result.importedCount} просмотров, но TMDB недоступен: ${
            result.errorMessage ?? result.errorCode ?? 'проверьте токен TMDB'
          }`
        );
      } else {
        showToast(
          `Импортировано ${result.importedCount} просмотров · TMDB распознал ${result.matchedMovies} из ${result.moviesResolved} фильмов.`
        );
      }
      return;
    }

    const importedEntries = parsedRowsToLocalWatchEntries(rows);
    setEntries((prev) => (replaceDemo ? importedEntries : [...importedEntries, ...prev]));
    setDemoWasModified(true);
    const latestYear = importedEntries
      .map((e) => Number.parseInt(e.watched_date.slice(0, 4), 10))
      .find((y) => y === 2024 || y === 2025 || y === 2026);
    if (latestYear) setSelectedYear(latestYear);
    showToast(`Импортировано ${importedEntries.length} записей!`);
  };

  const handleDeleteEntry = async (id: string) => {
    if (!window.confirm('Удалить эту запись из журнала просмотров?')) return;
    if (!isDemoMode && isSupabaseConfigured && userEmail) {
      try {
        await deleteWatchLogById(id);
        setEntries((prev) => prev.filter((e) => e.id !== id));
        showToast('Запись удалена.');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Ошибка удаления.');
      }
      return;
    }

    setEntries((prev) => prev.filter((e) => e.id !== id));
    setDemoWasModified(true);
    showToast('Запись удалена из демо-журнала.');
  };

  const handleReenrichMovies = async () => {
    if (reenriching || pendingEnrichMovieIds.length === 0) return;
    setReenriching(true);
    setReenrichProgress({ done: 0, total: pendingEnrichMovieIds.length });
    setReenrichReport(null);

    try {
      const report = await reenrichUserMovies(pendingEnrichMovieIds, (done, total) => {
        setReenrichProgress({ done, total });
      });
      await loadCloudEntries();
      setReenrichReport(report);

      if (!report.tmdbConfigured || report.errorCode === 'TMDB_AUTH_ERROR') {
        showToast(report.errorMessage ?? 'TMDB не настроен или вернул ошибку авторизации.');
      } else {
        const enrichedTotal = report.matchedCount + report.mergedCount + report.refreshedCount;
        showToast(
          `TMDB обработал ${report.totalProcessed}: обновлено ${enrichedTotal}, не найдено ${report.unmatchedCount}.`
        );
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Ошибка дообогащения фильмов через TMDB.');
    } finally {
      setReenriching(false);
      setReenrichProgress(null);
    }
  };

  const handleResetDemo = () => {
    setIsDemoMode(true);
    setEntries(DEMO_ENTRIES);
    setDemoWasModified(false);
    setSelectedYear(2026);
    showToast('Демо-данные 2024–2026 восстановлены.');
  };

  const statusBadgeText =
    isDemoMode && selectedYear === SIM_YEAR
      ? `20 ноя ${SIM_YEAR} · День ${SIM_DAY_OF_YEAR} / 365`
      : selectedYear === 'all'
        ? `Архив 2024–2026 · ${entries.length} записей`
        : selectedYear === refDate.year
          ? `День ${refDate.dayOfYear} / 365`
          : `Архив ${selectedYear} года · 365 / 365 дней`;

  return (
    <div className="min-h-screen bg-canvas text-slate-100">
      <Header
        selectedYear={selectedYear}
        onSelectYear={setSelectedYear}
        onOpenAddModal={() => setAddModalOpen(true)}
        onOpenImportModal={() => setImportModalOpen(true)}
        onOpenAuthModal={() => setAuthModalOpen(true)}
        isDemoMode={isDemoMode}
        userEmail={userEmail}
      />

      {loadingCloud ? (
        <DashboardSkeleton />
      ) : (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
          {/* Status Bar */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
                Дашборд просмотров
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                {isDemoMode
                  ? 'Интерактивная статистика по архиву 2024–2026 годов (Demo Mode)'
                  : `Персональный облачный журнал · ${userEmail}`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              {isDemoMode && demoWasModified && (
                <button
                  type="button"
                  onClick={handleResetDemo}
                  className="inline-flex items-center gap-1.5 text-xs text-[#d6b85a] bg-[#d6b85a]/10 border border-[#d6b85a]/30 px-3 py-2 rounded-xl hover:bg-[#d6b85a]/20 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Сбросить демо</span>
                </button>
              )}
              <div className="inline-flex items-center gap-2 text-xs text-slate-400 bg-card border border-line px-3.5 py-2 rounded-xl">
                <span className="w-2 h-2 rounded-full bg-[#45d1c6] animate-pulse" />
                <span className="font-mono text-[11px] text-slate-300">{statusBadgeText}</span>
              </div>
            </div>
          </div>

          <Tier1KpiSection kpis={kpis} selectedYear={selectedYear} />
          <Tier2DynamicsSection
            cumulativeData={cumulativeData}
            indexTrajectory={indexTrajectory}
            selectedYear={selectedYear}
          />
          <Tier3RhythmSection
            monthlyData={monthlyData}
            dayOfWeek={dayOfWeek}
            timeOfDay={timeOfDay}
            selectedYear={selectedYear}
          />
          <Tier4DeepAnalyticsSection
            heatmap={heatmap}
            ratings={ratings}
            releaseEras={releaseEras}
            runtime={runtime}
            tasteDirectors={tasteDirectors}
            tasteCountries={tasteCountries}
            tasteGenres={tasteGenres}
            selectedYear={selectedYear}
          />
          <JournalSection
            entries={entries}
            selectedYear={selectedYear}
            onDeleteEntry={(id) => void handleDeleteEntry(id)}
            pendingEnrichCount={pendingEnrichMovieIds.length}
            unmatchedCount={unmatchedMovieCount}
            reenriching={reenriching}
            reenrichProgress={reenrichProgress}
            reenrichReport={reenrichReport}
            onReenrichMovies={() => void handleReenrichMovies()}
            onDismissReenrichReport={() => setReenrichReport(null)}
          />

          <footer className="pt-6 pb-10 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-wider text-slate-300">CINELOG</span>
              <span>·</span>
              <span>Персональная аналитика кино (React + Supabase + TMDB)</span>
            </div>
            <span className="font-mono text-[11px]">
              {isDemoMode ? 'Симуляция данных на 20.11.2026' : 'Supabase PostgreSQL RLS Sync'}
            </span>
          </footer>
        </main>
      )}

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-cardElevated border border-[#45d1c6]/40 shadow-2xl text-xs text-slate-100">
          <CheckCircle2 className="w-4 h-4 text-[#45d1c6] shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      <AddWatchModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSave={handleSaveWatch}
        isDemoMode={isDemoMode}
      />
      <CsvImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        existingEntries={entries}
        onConfirmImport={handleConfirmImport}
        isDemoMode={isDemoMode}
      />
      <AuthModal
        open={authModalOpen}
        onClose={() => {
          setAuthModalOpen(false);
          setAuthNotice(null);
        }}
        userEmail={userEmail}
        isDemoMode={isDemoMode}
        isPasswordRecovery={isPasswordRecovery}
        initialNotice={authNotice}
        onEnableDemoMode={() => {
          setIsDemoMode(true);
          setEntries(DEMO_ENTRIES);
          setDemoWasModified(false);
        }}
        onAuthSuccess={() => {
          setAuthNotice(null);
          void loadCloudEntries();
        }}
        onPasswordRecoveryComplete={() => {
          setIsPasswordRecovery(false);
          setAuthModalOpen(false);
          setAuthNotice(null);
          void loadCloudEntries();
        }}
        onCancelPasswordRecovery={() => {
          void signOutAccount();
          setIsPasswordRecovery(false);
          setAuthModalOpen(false);
          setAuthNotice(null);
        }}
      />
    </div>
  );
}

export default App;
