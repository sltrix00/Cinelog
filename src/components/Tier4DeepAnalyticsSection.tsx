import { useEffect, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { filmWord, MONTHS_RU } from '../lib/analytics';
import type {
  HeatmapCell,
  HeatmapSummary,
  RatingsSummary,
  ReleaseErasSummary,
  RuntimeSummary,
  TasteAccentItem,
  TasteCategory,
  YearFilter,
} from '../types/cinelog';

interface Tier4DeepAnalyticsSectionProps {
  heatmap: HeatmapSummary;
  ratings: RatingsSummary;
  releaseEras: ReleaseErasSummary;
  runtime: RuntimeSummary;
  tasteDirectors: TasteAccentItem[];
  tasteCountries: TasteAccentItem[];
  tasteGenres: TasteAccentItem[];
  selectedYear: YearFilter;
}

const TOOLTIP_STYLE = {
  backgroundColor: '#0b0e17',
  border: '1px solid #2c3450',
  borderRadius: '10px',
  color: '#f8fafc',
  fontSize: '12px',
  fontFamily: 'var(--font-sans)',
};

const TOOLTIP_ITEM_STYLE = {
  color: '#e2e8f0',
};

const TOOLTIP_LABEL_STYLE = {
  color: '#f8fafc',
  fontWeight: 600,
  marginBottom: '4px',
};

export function Tier4DeepAnalyticsSection({
  heatmap,
  ratings,
  releaseEras,
  runtime,
  tasteDirectors,
  tasteCountries,
  tasteGenres,
  selectedYear,
}: Tier4DeepAnalyticsSectionProps) {
  const [ratingView, setRatingView] = useState<'dist' | 'trend'>('dist');
  const [tasteTab, setTasteTab] = useState<TasteCategory>('directors');
  const [hoveredCell, setHoveredCell] = useState<{
    cell: HeatmapCell;
    x: number;
    y: number;
    pinned?: boolean;
  } | null>(null);
  const heatmapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hoveredCell?.pinned) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        heatmapContainerRef.current &&
        !heatmapContainerRef.current.contains(e.target as Node)
      ) {
        setHoveredCell(null);
      }
    };
    const handleScrollOrEsc = (e: Event) => {
      if (e.type === 'scroll' || (e instanceof KeyboardEvent && e.key === 'Escape')) {
        setHoveredCell(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('scroll', handleScrollOrEsc, { passive: true });
    document.addEventListener('keydown', handleScrollOrEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('scroll', handleScrollOrEsc);
      document.removeEventListener('keydown', handleScrollOrEsc);
    };
  }, [hoveredCell?.pinned]);

  const activeTasteItems =
    tasteTab === 'directors'
      ? tasteDirectors
      : tasteTab === 'countries'
        ? tasteCountries
        : tasteGenres;

  const scopeWord = selectedYear === 'all' ? 'за всё время' : `за ${selectedYear} год`;

  const trendValues = ratings.monthlyTrend
    .map((p) => p.avgRating)
    .filter((v): v is number => v !== null);
  const minTrendRating = trendValues.length > 0 ? Math.min(...trendValues) : 1.0;
  const ratingYDomainMin = minTrendRating < 1.0 ? 0.5 : 1.0;

  return (
    <section id="level-4" className="scroll-mt-24 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xs tabular-nums uppercase tracking-widest text-slate-400">Уровень 04</span>
        <span className="text-slate-600" aria-hidden="true">/</span>
        <h2 className="text-sm font-bold tracking-tight text-slate-200">Глубокая аналитика</h2>
      </div>

      {/* 1. GitHub-Style Activity Heatmap */}
      <div ref={heatmapContainerRef} className="rounded-2xl bg-card border border-line p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold tracking-tight text-white">
              {heatmap.year === 'all'
                ? 'Тепловая карта активности за всё время'
                : `Тепловая карта активности за ${heatmap.year} год`}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
              {heatmap.year === 'all'
                ? `Плотность по календарным дням (365 дн.) · Всего активных дат: ${heatmap.activeDays} · Макс. серия подряд: ${heatmap.maxStreak} дн.`
                : `Активных дней: ${heatmap.activeDays} · Макс. серия: ${heatmap.maxStreak} дн.`}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs tabular-nums text-slate-400">
            <span>Меньше</span>
            <span className="w-3.5 h-3.5 rounded-[3px] bg-[#161c2e] border border-line" aria-hidden="true" />
            <span className="w-3.5 h-3.5 rounded-[3px] bg-[#15363c]" aria-hidden="true" />
            <span className="w-3.5 h-3.5 rounded-[3px] bg-[#1f5e63]" aria-hidden="true" />
            <span className="w-3.5 h-3.5 rounded-[3px] bg-[#2f9995]" aria-hidden="true" />
            <span className="w-3.5 h-3.5 rounded-[3px] bg-[#45d1c6]" aria-hidden="true" />
            <span>Больше</span>
          </div>
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="min-w-[780px]">
            <div className="grid grid-cols-12 text-xs tabular-nums text-slate-400 mb-1.5 pl-7">
              {MONTHS_RU.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
            <div className="flex gap-2">
              <div className="flex flex-col justify-between text-[11px] tabular-nums text-slate-400 py-0.5 w-5 shrink-0">
                <span>Пн</span>
                <span>Ср</span>
                <span>Пт</span>
                <span>Вс</span>
              </div>
              <div className="grid grid-flow-col grid-rows-7 gap-[3px] flex-1">
                {heatmap.cells.map((cell) => {
                  let bgClass = 'bg-[#161c2e] border border-line';
                  if (cell.isFuture) bgClass = 'bg-[#0d111d] opacity-35';
                  else if (cell.intensity === 1) bgClass = 'bg-[#15363c]';
                  else if (cell.intensity === 2) bgClass = 'bg-[#1f5e63]';
                  else if (cell.intensity === 3) bgClass = 'bg-[#2f9995]';
                  else if (cell.intensity === 4) bgClass = 'bg-[#45d1c6]';

                  const showAtRect = (el: HTMLElement, pinned = false) => {
                    const rect = el.getBoundingClientRect();
                    setHoveredCell({
                      cell,
                      x: rect.left + rect.width / 2,
                      y: rect.top,
                      pinned,
                    });
                  };

                  return (
                    <button
                      key={cell.doy}
                      type="button"
                      disabled={cell.isFuture}
                      aria-label={
                        cell.isFuture
                          ? `${cell.dateLabel} — будущая дата`
                          : `${cell.dateLabel}: ${cell.count} ${filmWord(cell.count)}`
                      }
                      className={`w-3.5 h-3.5 rounded-[3px] transition-transform duration-100 hover:scale-125 focus-visible:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-default cursor-pointer ${bgClass}`}
                      onMouseEnter={(e) =>
                        setHoveredCell({ cell, x: e.clientX, y: e.clientY, pinned: false })
                      }
                      onMouseMove={(e) => {
                        if (!hoveredCell?.pinned) {
                          setHoveredCell({ cell, x: e.clientX, y: e.clientY, pinned: false });
                        }
                      }}
                      onMouseLeave={() => {
                        if (!hoveredCell?.pinned) setHoveredCell(null);
                      }}
                      onFocus={(e) => showAtRect(e.currentTarget, false)}
                      onBlur={() => {
                        if (!hoveredCell?.pinned) setHoveredCell(null);
                      }}
                      onClick={(e) => {
                        if (hoveredCell?.pinned && hoveredCell.cell.doy === cell.doy) {
                          setHoveredCell(null);
                        } else {
                          showAtRect(e.currentTarget, true);
                        }
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Оценки и тренд + Годы выхода фильмов */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Оценки и тренд */}
        <div className="rounded-2xl bg-card border border-line p-5 sm:p-6 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="text-base font-bold tracking-tight text-white">Оценки и тренд</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Средняя {scopeWord}:{' '}
                <span className="tabular-nums text-[#d6b85a] font-semibold">
                  {ratings.ratedCount > 0 ? `${ratings.averageRating.toFixed(2)} ★` : '—'}
                </span>
              </p>
            </div>
            <div
              role="tablist"
              aria-label="Режим графика оценок"
              className="inline-flex items-center p-0.5 rounded-xl bg-canvas border border-line text-xs"
            >
              <button
                type="button"
                role="tab"
                aria-selected={ratingView === 'dist'}
                onClick={() => setRatingView('dist')}
                className={
                  ratingView === 'dist'
                    ? 'min-h-8 px-3 py-1 rounded-lg font-medium bg-cardElevated text-white border border-lineStrong transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]'
                    : 'min-h-8 px-3 py-1 rounded-lg font-medium text-slate-300 hover:text-white transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]'
                }
              >
                Распределение
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={ratingView === 'trend'}
                onClick={() => setRatingView('trend')}
                className={
                  ratingView === 'trend'
                    ? 'min-h-8 px-3 py-1 rounded-lg font-medium bg-cardElevated text-white border border-lineStrong transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]'
                    : 'min-h-8 px-3 py-1 rounded-lg font-medium text-slate-300 hover:text-white transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]'
                }
              >
                Тренд по месяцам
              </button>
            </div>
          </div>

          <div className="h-60 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              {ratingView === 'dist' ? (
                <BarChart data={ratings.distribution} margin={{ top: 6, right: 8, left: -18, bottom: 2 }}>
                  <CartesianGrid stroke="rgba(30, 36, 56, 0.75)" vertical={false} />
                  <XAxis
                    dataKey="bucket"
                    stroke="#1e2438"
                    tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'var(--font-sans)' }}
                  />
                  <YAxis
                    allowDecimals={false}
                    stroke="#1e2438"
                    tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'var(--font-sans)' }}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    itemStyle={TOOLTIP_ITEM_STYLE}
                    labelStyle={TOOLTIP_LABEL_STYLE}
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    formatter={(value) => [`${value} ${filmWord(Number(value))}`, 'Фильмов']}
                  />
                  <Bar dataKey="count" fill="#d6b85a" radius={[6, 6, 0, 0]} />
                </BarChart>
              ) : (
                <AreaChart data={ratings.monthlyTrend} margin={{ top: 6, right: 8, left: -14, bottom: 2 }}>
                  <defs>
                    <linearGradient id="ratingTrendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d6b85a" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#d6b85a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(30, 36, 56, 0.75)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    stroke="#1e2438"
                    tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'var(--font-sans)' }}
                  />
                  <YAxis
                    domain={[ratingYDomainMin, 5.0]}
                    tickFormatter={(v: number) => `${v.toFixed(1)}★`}
                    stroke="#1e2438"
                    tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'var(--font-sans)' }}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    itemStyle={TOOLTIP_ITEM_STYLE}
                    labelStyle={TOOLTIP_LABEL_STYLE}
                    formatter={(value) => [`${Number(value).toFixed(2)} ★`, 'Средняя оценка']}
                  />
                  <Area
                    type="monotone"
                    dataKey="avgRating"
                    stroke="#d6b85a"
                    strokeWidth={2.3}
                    fill="url(#ratingTrendGrad)"
                    connectNulls
                    dot={{ r: 3.5, fill: '#d6b85a', strokeWidth: 0 }}
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Годы выхода фильмов */}
        <div className="rounded-2xl bg-card border border-line p-5 sm:p-6 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2 mb-5">
            <div>
              <h3 className="text-base font-bold tracking-tight text-white">Годы выхода фильмов</h3>
              <p className="text-xs text-slate-400 mt-0.5">Распределение просмотренного по эпохам</p>
            </div>
            <span className="text-xs tabular-nums px-2.5 py-1 rounded-lg bg-cardElevated text-slate-300 border border-line shrink-0">
              до 2000: {releaseEras.classicSharePct}%
            </span>
          </div>

          <div className="h-60 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={releaseEras.points} margin={{ top: 6, right: 8, left: -18, bottom: 2 }}>
                <CartesianGrid stroke="rgba(30, 36, 56, 0.75)" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#1e2438"
                  tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'var(--font-sans)' }}
                />
                <YAxis
                  allowDecimals={false}
                  stroke="#1e2438"
                  tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'var(--font-sans)' }}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                  labelStyle={TOOLTIP_LABEL_STYLE}
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  formatter={(value) => [`${value} ${filmWord(Number(value))}`, 'Фильмов']}
                />
                <Bar dataKey="count" radius={[7, 7, 0, 0]}>
                  {releaseEras.points.map((entry) => (
                    <Cell key={entry.label} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 3. Длительность просмотров + Вкусовые акценты */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Длительность просмотров */}
        <div className="rounded-2xl bg-card border border-line p-5 sm:p-6 flex flex-col justify-between">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
            <div>
              <h3 className="text-base font-bold tracking-tight text-white">Длительность просмотров</h3>
              <p className="text-xs text-slate-400 mt-0.5">Просмотренные часы кино по месяцам</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-2.5 py-1.5 rounded-xl bg-canvas border border-line text-right">
                <span className="block text-[11px] text-slate-400 leading-none mb-0.5">Всего часов</span>
                <span className="text-xs font-semibold text-white tabular-nums">
                  {runtime.totalHours} ч
                </span>
              </div>
              <div className="px-2.5 py-1.5 rounded-xl bg-canvas border border-line text-right">
                <span className="block text-[11px] text-slate-400 leading-none mb-0.5">В сутках</span>
                <span className="text-xs font-semibold text-[#45d1c6] tabular-nums">
                  {runtime.totalDays} сут
                </span>
              </div>
            </div>
          </div>

          <div className="h-60 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={runtime.points} margin={{ top: 6, right: 8, left: -14, bottom: 2 }}>
                <CartesianGrid stroke="rgba(30, 36, 56, 0.75)" vertical={false} />
                <XAxis
                  dataKey="month"
                  stroke="#1e2438"
                  tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'var(--font-sans)' }}
                />
                <YAxis
                  tickFormatter={(v: number) => `${v}ч`}
                  stroke="#1e2438"
                  tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'var(--font-sans)' }}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                  labelStyle={TOOLTIP_LABEL_STYLE}
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  formatter={(value) => [`${value} ч`, 'Длительность']}
                />
                <Bar dataKey="hours" fill="#45d1c6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Вкусовые акценты */}
        <div className="rounded-2xl bg-card border border-line p-5 sm:p-6 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="text-base font-bold tracking-tight text-white">Вкусовые акценты</h3>
              <p className="text-xs text-slate-400 mt-0.5">Топ-6 {scopeWord} (доля от просмотров)</p>
            </div>
            <div
              role="tablist"
              aria-label="Категории вкусовых акцентов"
              className="inline-flex items-center p-0.5 rounded-xl bg-canvas border border-line text-xs"
            >
              {(
                [
                  { id: 'directors', label: 'Режиссёры' },
                  { id: 'countries', label: 'Страны' },
                  { id: 'genres', label: 'Жанры' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={tasteTab === tab.id}
                  onClick={() => setTasteTab(tab.id)}
                  className={
                    tasteTab === tab.id
                      ? 'min-h-8 px-3 py-1 rounded-lg font-medium bg-cardElevated text-white border border-lineStrong transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]'
                      : 'min-h-8 px-3 py-1 rounded-lg font-medium text-slate-300 hover:text-white transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]'
                  }
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {activeTasteItems.length > 0 ? (
            <div className="space-y-3.5 my-auto">
              {activeTasteItems.map((item) => (
                <div key={item.name} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="tabular-nums text-xs text-slate-400 w-5">{item.rank}.</span>
                      <span className="font-medium text-slate-200 truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 tabular-nums text-xs">
                      <span className="text-slate-300">
                        {item.count} {filmWord(item.count)}{' '}
                        <span className="text-slate-400">({item.shareOfTotalPct}%)</span>
                      </span>
                      <span className="text-[#d6b85a] w-12 text-right">{item.avgRating} ★</span>
                    </div>
                  </div>
                  <div
                    className="relative h-2 w-full rounded-full bg-canvas border border-line overflow-hidden"
                    title={`Доля от всех просмотров: ${item.shareOfTotalPct}%`}
                  >
                    {/* Subtle leader-relative backdrop */}
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-white/[0.06] transition-all duration-500"
                      style={{ width: `${item.barPct}%` }}
                    />
                    {/* Honest share-of-total foreground bar */}
                    <div
                      className="relative h-full rounded-full bg-gradient-to-r from-[#45d1c6] to-[#f06292] transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.max(item.count > 0 ? 4 : 0, item.shareOfTotalPct))}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="my-auto py-10 text-center text-xs text-slate-400">
              Недостаточно метаданных для выбранного фильтра. Подключите TMDB или добавьте фильмы вручную.
            </div>
          )}
        </div>
      </div>

      {/* Floating Heatmap Tooltip */}
      {hoveredCell && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-50 px-3 py-2 rounded-lg bg-[#0b0e17] border border-lineStrong shadow-2xl text-xs text-slate-200 tabular-nums max-w-xs"
          style={{
            left: Math.min(
              Math.max(12, hoveredCell.x + 14),
              typeof window !== 'undefined' ? window.innerWidth - 260 : hoveredCell.x + 14
            ),
            top: Math.max(10, hoveredCell.y - 44),
          }}
        >
          {hoveredCell.cell.isFuture ? (
            <span className="text-slate-400">{hoveredCell.cell.dateLabel} · будущая дата</span>
          ) : (
            <div>
              <div>
                <span className="text-white font-semibold">
                  {hoveredCell.cell.count} {filmWord(hoveredCell.cell.count)}
                </span>{' '}
                <span className="text-slate-400">· {hoveredCell.cell.dateLabel}</span>
              </div>
              {hoveredCell.cell.titles.length > 0 && (
                <div className="mt-1 text-xs text-[#45d1c6] truncate">
                  {hoveredCell.cell.titles.slice(0, 3).join(', ')}
                  {hoveredCell.cell.titles.length > 3
                    ? ` +${hoveredCell.cell.titles.length - 3}`
                    : ''}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
