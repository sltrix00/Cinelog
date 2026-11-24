import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Database,
  Download,
  FileSpreadsheet,
  Loader2,
  Moon,
  Palette,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { verifyDeleteIdentity } from '../lib/journalSelection';
import {
  ACCENT_PRESETS,
  DEFAULT_USER_SETTINGS,
  THEMES,
  formatRatingValue,
  type AccentPresetId,
  type RatingFormat,
  type ThemeDefinition,
  type ThemeId,
  type ThemeMode,
  type UserSettings,
} from '../lib/settings';
import type { ReenrichSummary } from '../types/cinelog';
import { useModalA11y } from './useModalA11y';

type SettingsTab = 'appearance' | 'display' | 'data';
type ThemeModeFilter = 'all' | ThemeMode;

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: UserSettings;
  onUpdateSettings: (next: UserSettings) => void;
  isDemoMode: boolean;
  demoWasModified: boolean;
  userEmail: string | null;
  userNickname: string | null;
  entriesCount: number;
  pendingEnrichCount: number;
  unmatchedCount: number;
  reenriching: boolean;
  reenrichProgress: { done: number; total: number } | null;
  reenrichReport: ReenrichSummary | null;
  onExportJson: () => void;
  onExportCsv: () => void;
  onOpenImportModal: () => void;
  onReenrichMovies: () => void;
  onDeleteAllEntries: () => Promise<void> | void;
  onResetDemo: () => void;
}

function ThemePreviewCard({
  theme,
  selected,
  onSelect,
}: {
  theme: ThemeDefinition;
  selected: boolean;
  onSelect: () => void;
}) {
  const { canvas, card, line, accent, secondary, gold } = theme.preview;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group relative text-left rounded-2xl border p-2.5 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6] ${
        selected
          ? 'border-[#45d1c6] bg-cardElevated shadow-lg'
          : 'border-line bg-card hover:border-lineStrong hover:bg-cardElevated/70'
      }`}
    >
      {/* Mini Dashboard Visual Preview */}
      <div
        className="w-full h-20 rounded-xl p-2 flex flex-col justify-between overflow-hidden border"
        style={{ backgroundColor: canvas, borderColor: line }}
      >
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accent }} />
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: secondary }} />
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: gold }} />
          </div>
          <span
            className="h-2 w-8 rounded-full"
            style={{ backgroundColor: accent, opacity: 0.85 }}
          />
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <div
            className="h-9 rounded-lg border p-1.5 flex flex-col justify-between"
            style={{ backgroundColor: card, borderColor: line }}
          >
            <span className="h-1 w-5 rounded-full opacity-45" style={{ backgroundColor: secondary }} />
            <span className="h-1.5 w-7 rounded-full" style={{ backgroundColor: accent }} />
          </div>
          <div
            className="h-9 rounded-lg border p-1.5 flex flex-col justify-between"
            style={{ backgroundColor: card, borderColor: line }}
          >
            <span className="h-1 w-4 rounded-full opacity-45" style={{ backgroundColor: gold }} />
            <span className="h-1.5 w-6 rounded-full" style={{ backgroundColor: secondary }} />
          </div>
          <div
            className="h-9 rounded-lg border p-1.5 flex items-end gap-0.5"
            style={{ backgroundColor: card, borderColor: line }}
          >
            <span className="w-1.5 h-3 rounded-sm" style={{ backgroundColor: gold }} />
            <span className="w-1.5 h-5 rounded-sm" style={{ backgroundColor: secondary }} />
            <span className="w-1.5 h-4 rounded-sm" style={{ backgroundColor: accent }} />
          </div>
        </div>
      </div>

      {/* Label & Checkmark */}
      <div className="mt-2.5 flex items-start justify-between gap-2 px-0.5">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
            <span>{theme.name}</span>
          </div>
          <div className="text-[11px] text-slate-400 truncate mt-0.5">{theme.description}</div>
        </div>
        <span
          className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition-colors ${
            selected
              ? 'bg-[#45d1c6] border-[#45d1c6] text-[#0b0e17]'
              : 'border-lineStrong bg-canvas/60 text-transparent group-hover:border-slate-500'
          }`}
          aria-hidden="true"
        >
          <Check className="w-3 h-3 stroke-[2.8]" />
        </span>
      </div>
    </button>
  );
}

const RATING_OPTIONS: ReadonlyArray<{
  id: RatingFormat;
  title: string;
  description: string;
  sample: number;
}> = [
  {
    id: 'stars-5',
    title: '5-балльная шкала',
    description: 'Классический формат Letterboxd от 0.5 до 5.0 с шагом ползвезды.',
    sample: 4.5,
  },
  {
    id: 'scale-10',
    title: '10-балльная шкала',
    description: 'Привычный формат IMDb и Кинопоиска от 1 до 10.',
    sample: 4.5,
  },
  {
    id: 'percent',
    title: 'Проценты',
    description: 'Шкала от 10% до 100% — удобно для быстрого сравнения.',
    sample: 4.5,
  },
];

export function SettingsModal({
  open,
  onClose,
  settings,
  onUpdateSettings,
  isDemoMode,
  demoWasModified,
  userEmail,
  userNickname,
  entriesCount,
  pendingEnrichCount,
  unmatchedCount,
  reenriching,
  reenrichProgress,
  reenrichReport,
  onExportJson,
  onExportCsv,
  onOpenImportModal,
  onReenrichMovies,
  onDeleteAllEntries,
  onResetDemo,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const [modeFilter, setModeFilter] = useState<ThemeModeFilter>('all');
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [identityInput, setIdentityInput] = useState('');
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);

  const modalRef = useModalA11y<HTMLDivElement>({
    open,
    onClose,
    disabled: deletingAll,
  });

  useEffect(() => {
    if (!open) {
      setDeleteStep(0);
      setIdentityInput('');
      setIdentityError(null);
    }
  }, [open]);

  if (!open) return null;

  const darkCount = THEMES.filter((t) => t.mode === 'dark').length;
  const lightCount = THEMES.filter((t) => t.mode === 'light').length;
  const filteredThemes =
    modeFilter === 'all' ? THEMES : THEMES.filter((t) => t.mode === modeFilter);

  const handleSelectTheme = (theme: ThemeId) => {
    onUpdateSettings({ ...settings, theme });
  };

  const handleSelectAccent = (accent: AccentPresetId) => {
    onUpdateSettings({ ...settings, accent });
  };

  const handleSelectRatingFormat = (ratingFormat: RatingFormat) => {
    onUpdateSettings({ ...settings, ratingFormat });
  };

  const handleResetAppearance = () => {
    onUpdateSettings({
      ...settings,
      theme: DEFAULT_USER_SETTINGS.theme,
      accent: DEFAULT_USER_SETTINGS.accent,
    });
  };

  const handleConfirmDeleteAll = async () => {
    if (deletingAll) return;

    if (!isDemoMode && userEmail) {
      const valid = verifyDeleteIdentity(identityInput, {
        userEmail,
        userNickname,
        isDemoMode,
      });
      if (!valid) {
        setIdentityError(
          userNickname?.trim()
            ? 'Введите ваш email или никнейм для подтверждения.'
            : 'Введите ваш email для подтверждения.'
        );
        return;
      }
    }

    setDeletingAll(true);
    setIdentityError(null);
    try {
      await onDeleteAllEntries();
      setDeleteStep(0);
      setIdentityInput('');
    } finally {
      setDeletingAll(false);
    }
  };

  const isDefaultAppearance =
    settings.theme === DEFAULT_USER_SETTINGS.theme &&
    settings.accent === DEFAULT_USER_SETTINGS.accent;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !deletingAll) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        tabIndex={-1}
        className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-card border border-lineStrong shadow-2xl overflow-hidden focus:outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cardElevated border border-line flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-[#45d1c6]" aria-hidden="true" />
            </div>
            <div>
              <h2 id="settings-modal-title" className="text-base font-bold text-white leading-tight">
                Настройки
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Темы оформления, формат оценок и управление данными
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={deletingAll}
            aria-label="Закрыть настройки"
            className="w-9 h-9 rounded-xl bg-cardElevated hover:bg-white/10 border border-line text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          role="tablist"
          aria-label="Разделы настроек"
          className="flex items-center gap-1.5 px-5 py-2.5 border-b border-line bg-canvas/40 overflow-x-auto shrink-0"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'appearance'}
            onClick={() => setActiveTab('appearance')}
            className={`inline-flex items-center gap-2 min-h-9 px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6] ${
              activeTab === 'appearance'
                ? 'bg-cardElevated text-white border border-lineStrong shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Palette className="w-3.5 h-3.5 text-[#f06292]" aria-hidden="true" />
            <span>Оформление и темы</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'display'}
            onClick={() => setActiveTab('display')}
            className={`inline-flex items-center gap-2 min-h-9 px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6] ${
              activeTab === 'display'
                ? 'bg-cardElevated text-white border border-lineStrong shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#d6b85a]" aria-hidden="true" />
            <span>Формат оценок</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'data'}
            onClick={() => setActiveTab('data')}
            className={`inline-flex items-center gap-2 min-h-9 px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6] ${
              activeTab === 'data'
                ? 'bg-cardElevated text-white border border-lineStrong shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-[#45d1c6]" aria-hidden="true" />
            <span>Данные и TMDB</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          {/* TAB 1: APPEARANCE & THEMES */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Тема интерфейса</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Выберите палитру — изменения применяются мгновенно и сохраняются в браузере
                    </p>
                  </div>

                  {/* Dark / Light filter */}
                  <div className="inline-flex items-center p-0.5 rounded-xl bg-canvas border border-line text-xs">
                    <button
                      type="button"
                      onClick={() => setModeFilter('all')}
                      className={`min-h-8 px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                        modeFilter === 'all'
                          ? 'bg-cardElevated text-white border border-lineStrong'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Все ({THEMES.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setModeFilter('dark')}
                      className={`inline-flex items-center gap-1 min-h-8 px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                        modeFilter === 'dark'
                          ? 'bg-cardElevated text-white border border-lineStrong'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Moon className="w-3 h-3" aria-hidden="true" />
                      <span>Тёмные ({darkCount})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setModeFilter('light')}
                      className={`inline-flex items-center gap-1 min-h-8 px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                        modeFilter === 'light'
                          ? 'bg-cardElevated text-white border border-lineStrong'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Sun className="w-3 h-3" aria-hidden="true" />
                      <span>Светлые ({lightCount})</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredThemes.map((theme) => (
                    <ThemePreviewCard
                      key={theme.id}
                      theme={theme}
                      selected={settings.theme === theme.id}
                      onSelect={() => handleSelectTheme(theme.id)}
                    />
                  ))}
                </div>
              </div>

              {/* Accent Color Override */}
              <div className="pt-4 border-t border-line space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Акцентный цвет кнопок</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Оставьте фирменный цвет выбранной темы или задайте свой акцент
                    </p>
                  </div>
                  {!isDefaultAppearance && (
                    <button
                      type="button"
                      onClick={handleResetAppearance}
                      className="inline-flex items-center gap-1.5 min-h-8 px-2.5 py-1 rounded-lg text-xs text-slate-300 hover:text-white bg-cardElevated border border-line hover:border-lineStrong transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" aria-hidden="true" />
                      <span>Сбросить</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {ACCENT_PRESETS.map((preset) => {
                    const active = settings.accent === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectAccent(preset.id)}
                        aria-pressed={active}
                        className={`inline-flex items-center gap-2 min-h-9 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6] ${
                          active
                            ? 'bg-cardElevated border-[#45d1c6] text-white'
                            : 'bg-canvas/50 border-line text-slate-300 hover:border-lineStrong hover:text-white'
                        }`}
                      >
                        {preset.color ? (
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/20"
                            style={{ backgroundColor: preset.color }}
                            aria-hidden="true"
                          />
                        ) : (
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0 bg-gradient-to-br from-[#f06292] via-[#d6b85a] to-[#45d1c6]"
                            aria-hidden="true"
                          />
                        )}
                        <span>{preset.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RATING FORMAT */}
          {activeTab === 'display' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Шкала отображения оценок</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Меняет отображение оценок в журнале, графиках аналитики и форме добавления.
                  Исходные данные в базе не изменяются.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {RATING_OPTIONS.map((opt) => {
                  const selected = settings.ratingFormat === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectRatingFormat(opt.id)}
                      aria-pressed={selected}
                      className={`text-left rounded-2xl border p-4 flex flex-col justify-between gap-3 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6] ${
                        selected
                          ? 'bg-cardElevated border-[#45d1c6] shadow-md'
                          : 'bg-canvas/40 border-line hover:border-lineStrong'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-white">{opt.title}</span>
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center border shrink-0 ${
                            selected
                              ? 'bg-[#45d1c6] border-[#45d1c6] text-[#0b0e17]'
                              : 'border-lineStrong text-transparent'
                          }`}
                          aria-hidden="true"
                        >
                          <Check className="w-3 h-3 stroke-[2.8]" />
                        </span>
                      </div>

                      <div className="py-2 px-3 rounded-xl bg-card border border-line text-center">
                        <span className="text-lg font-bold tabular-nums text-[#d6b85a]">
                          {formatRatingValue(opt.sample, opt.id)}
                        </span>
                      </div>

                      <p className="text-[11px] leading-relaxed text-slate-400">{opt.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: DATA, TMDB & DANGER ZONE */}
          {activeTab === 'data' && (
            <div className="space-y-5">
              {/* Export & Import */}
              <div className="rounded-2xl bg-canvas/40 border border-line p-4 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">Экспорт и импорт</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Всего записей в журнале:{' '}
                    <span className="tabular-nums font-semibold text-slate-200">{entriesCount}</span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={entriesCount === 0}
                    onClick={onExportJson}
                    className="inline-flex items-center gap-2 min-h-10 px-3.5 py-2 rounded-xl bg-card hover:bg-cardElevated disabled:opacity-50 border border-line hover:border-lineStrong text-xs font-medium text-slate-200 hover:text-white transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-[#45d1c6]" aria-hidden="true" />
                    <span>Экспорт JSON</span>
                  </button>

                  <button
                    type="button"
                    disabled={entriesCount === 0}
                    onClick={onExportCsv}
                    className="inline-flex items-center gap-2 min-h-10 px-3.5 py-2 rounded-xl bg-card hover:bg-cardElevated disabled:opacity-50 border border-line hover:border-lineStrong text-xs font-medium text-slate-200 hover:text-white transition-colors cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-[#d6b85a]" aria-hidden="true" />
                    <span>Экспорт CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenImportModal();
                    }}
                    className="inline-flex items-center gap-2 min-h-10 px-3.5 py-2 rounded-xl bg-card hover:bg-cardElevated border border-line hover:border-lineStrong text-xs font-medium text-slate-200 hover:text-white transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#f06292]" aria-hidden="true" />
                    <span>Импорт CSV / Letterboxd</span>
                  </button>
                </div>
              </div>

              {/* TMDB Re-enrichment */}
              <div className="rounded-2xl bg-canvas/40 border border-line p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Переобогащение TMDB</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Дозагрузка хронометража, режиссёров, стран и жанров для фильмов без метаданных
                    </p>
                  </div>
                  {!isDemoMode && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] tabular-nums bg-card border border-line text-slate-300">
                      К обновлению: {pendingEnrichCount}
                    </span>
                  )}
                </div>

                {isDemoMode ? (
                  <p className="text-xs text-slate-400">
                    В демо-режиме используются предзаполненные метаданные. Войдите в аккаунт, чтобы
                    обогащать собственную библиотеку через TMDB.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {unmatchedCount > 0 && (
                      <p className="text-xs text-slate-400">
                        Нераспознанных фильмов в библиотеке:{' '}
                        <span className="tabular-nums text-[#d6b85a] font-medium">
                          {unmatchedCount}
                        </span>
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        disabled={reenriching || pendingEnrichCount === 0}
                        onClick={onReenrichMovies}
                        className="inline-flex items-center gap-2 min-h-10 px-3.5 py-2 rounded-xl bg-[#45d1c6]/10 hover:bg-[#45d1c6]/20 disabled:opacity-50 border border-[#45d1c6]/35 text-xs font-medium text-[#45d1c6] transition-colors cursor-pointer"
                      >
                        {reenriching ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                        <span>
                          {reenriching && reenrichProgress
                            ? `Обработка ${reenrichProgress.done} / ${reenrichProgress.total}...`
                            : pendingEnrichCount > 0
                              ? `Обновить метаданные (${pendingEnrichCount})`
                              : 'Все фильмы уже обогащены'}
                        </span>
                      </button>

                      {reenrichReport && !reenriching && (
                        <span className="text-xs text-slate-400 tabular-nums">
                          Последний запуск: обработано {reenrichReport.totalProcessed}, обновлено{' '}
                          {reenrichReport.matchedCount +
                            reenrichReport.mergedCount +
                            reenrichReport.refreshedCount}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Danger Zone */}
              <div className="rounded-2xl bg-[#f06292]/5 border border-[#f06292]/25 p-4 space-y-3">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-[#f06292] shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <h3 className="text-sm font-semibold text-white">Управление и удаление данных</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {isDemoMode
                        ? 'Вы можете сбросить демо-данные к исходному состоянию или полностью очистить журнал.'
                        : 'Удаление журнала просмотров необратимо. Перед очисткой рекомендуем сделать экспорт.'}
                    </p>
                  </div>
                </div>

                {deleteStep === 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {isDemoMode && demoWasModified && (
                      <button
                        type="button"
                        onClick={() => {
                          onResetDemo();
                          onClose();
                        }}
                        className="inline-flex items-center gap-2 min-h-10 px-3.5 py-2 rounded-xl bg-[#d6b85a]/10 hover:bg-[#d6b85a]/20 border border-[#d6b85a]/35 text-xs font-medium text-[#d6b85a] transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Восстановить демо-данные</span>
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={entriesCount === 0}
                      onClick={() => setDeleteStep(1)}
                      className="inline-flex items-center gap-2 min-h-10 px-3.5 py-2 rounded-xl bg-[#f06292]/10 hover:bg-[#f06292]/20 disabled:opacity-50 border border-[#f06292]/35 text-xs font-medium text-[#f06292] transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>
                        {isDemoMode ? 'Очистить демо-журнал' : `Удалить все просмотры (${entriesCount})`}
                      </span>
                    </button>
                  </div>
                )}

                {deleteStep === 1 && (
                  <div className="rounded-xl bg-card border border-[#f06292]/35 p-3.5 space-y-3">
                    <div className="flex items-start gap-2 text-xs text-slate-200">
                      <AlertTriangle className="w-4 h-4 text-[#f06292] shrink-0 mt-0.5" aria-hidden="true" />
                      <span>
                        Вы уверены, что хотите удалить все{' '}
                        <strong className="tabular-nums text-white">{entriesCount}</strong> записей из
                        журнала?
                      </span>
                    </div>

                    {!isDemoMode && userEmail && (
                      <div className="space-y-1.5">
                        <label
                          htmlFor="settingsDeleteIdentity"
                          className="block text-[11px] text-slate-400"
                        >
                          Для подтверждения введите{' '}
                          {userNickname?.trim() ? 'ваш email или никнейм' : 'ваш email'}:
                        </label>
                        <input
                          id="settingsDeleteIdentity"
                          type="text"
                          value={identityInput}
                          onChange={(e) => {
                            setIdentityInput(e.target.value);
                            setIdentityError(null);
                          }}
                          placeholder={userNickname?.trim() || userEmail}
                          className="w-full min-h-10 px-3 py-2 rounded-xl bg-canvas border border-lineStrong text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#f06292]"
                        />
                        {identityError && (
                          <p className="text-[11px] text-[#f06292]">{identityError}</p>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={deletingAll}
                        onClick={() => void handleConfirmDeleteAll()}
                        className="inline-flex items-center gap-1.5 min-h-9 px-3.5 py-1.5 rounded-xl bg-[#f06292] hover:bg-[#f47ba4] disabled:opacity-50 text-[#0b0e17] font-semibold text-xs transition-colors cursor-pointer"
                      >
                        {deletingAll ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                        <span>{deletingAll ? 'Удаление...' : 'Подтвердить удаление'}</span>
                      </button>

                      <button
                        type="button"
                        disabled={deletingAll}
                        onClick={() => {
                          setDeleteStep(0);
                          setIdentityInput('');
                          setIdentityError(null);
                        }}
                        className="inline-flex items-center min-h-9 px-3 py-1.5 rounded-xl bg-cardElevated hover:bg-white/10 border border-line text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
