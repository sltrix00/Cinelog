import { useState } from 'react';
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
import { filmWord, MONTHS_EN } from '../lib/analytics';
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
  fontFamily: 'var(--font-mono)',
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
  } | null>(null);

  const activeTasteItems =
    tasteTab === 'directors'
      ? tasteDirectors
      : tasteTab === 'countries'
        ? tasteCountries
        : tasteGenres;

  const scopeWord = selectedYear === 'all' ? 'за всё время' : `за ${selectedYear} год`;

  return (
    <section id="level-4" className="scroll-mt-24 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-mono uppercase tracking-widest text-slate-500">Уровень 04</span>
        <span className="text-slate-700">/</span>
        <h2 className="text-sm font-semibold text-slate-200">Глубокая аналитика</h2>
      </div>

      {/* 1. GitHub-Style Activity Heatmap */}
      <div className="rounded-2xl bg-card border border-line p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-semibold text-white">
              Тепловая карта активности (Heatmap {heatmap.year})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">
              Активных дней: {heatmap.activeDays} · Макс. серия: {heatmap.maxStreak} дн.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
            <span>0</span>
            <span className="w-3 h-3 rounded-[3px] bg-[#161c2e] border border-line" />
            <span className="w-3 h-3 rounded-[3px] bg-[#194549]" />
            <span className="w-3 h-3 rounded-[3px] bg-[#2a8b87]" />
            <span className="w-3 h-3 rounded-[3px] bg-[#45d1c6]" />
            <span>3+</span>
          </div>
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="min-w-[740px]">
            <div className="grid grid-cols-12 text-[11px] font-mono text-slate-500 mb-1.5 pl-7">
              {MONTHS_EN.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
            <div className="flex gap-2">
              <div className="flex flex-col justify-between text-[10px] font-mono text-slate-500 py-0.5 w-5 shrink-0">
                <span>Пн</span>
                <span>Ср</span>
                <span>Пт</span>
                <span>Вс</span>
              </div>
              <div className="grid grid-flow-col grid-rows-7 gap-[3px] flex-1">
                {heatmap.cells.map((cell) => {
                  let bgClass = 'bg-[#161c2e] border border-line';
                  if (cell.isFuture) bgClass = 'bg-[#0d111d] opacity-35';
                  else if (cell.intensity === 1) bgClass = 'bg-[#194549]';
                  else if (cell.intensity === 2) bgClass = 'bg-[#2a8b87]';
                  else if (cell.intensity === 3) bgClass = 'bg-[#45d1c6]';

                  return (
                    <div
                      key={cell.doy}
                      className={`w-3 h-3 rounded-[3px] transition-transform duration-100 hover:scale-125 cursor-pointer ${bgClass}`}
                      onMouseEnter={(e) =>
                        setHoveredCell({ cell, x: e.clientX, y: e.clientY })
                      }
                      onMouseMove={(e) =>
                        setHoveredCell({ cell, x: e.clientX, y: e.clientY })
                      }
                      onMouseLeave={() => setHoveredCell(null)}
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
              <h3 className="text-base font-semibold text-white">Оценки и тренд</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Средняя {scopeWord}:{' '}
                <span className="font-mono text-[#d6b85a] font-semibold">
                  {ratings.ratedCount > 0 ? `${ratings.averageRating.toFixed(2)} ★` : '—'}
                </span>
              </p>
            </div>
            <div className="inline-flex items-center p-0.5 rounded-xl bg-canvas border border-line text-[11px]">
              <button
                type="button"
                onClick={() => setRatingView('dist')}
                className={
                  ratingView === 'dist'
                    ? 'px-2.5 py-1 rounded-lg font-medium bg-cardElevated text-white border border-lineStrong transition-all cursor-pointer'
                    : 'px-2.5 py-1 rounded-lg font-medium text-slate-400 hover:text-slate-200 transition-all cursor-pointer'
                }
              >
                Распределение
              </button>
              <button
                type="button"
                onClick={() => setRatingView('trend')}
                className={
                  ratingView === 'trend'
                    ? 'px-2.5 py-1 rounded-lg font-medium bg-cardElevated text-white border border-lineStrong transition-all cursor-pointer'
                    : 'px-2.5 py-1 rounded-lg font-medium text-slate-400 hover:text-slate-200 transition-all cursor-pointer'
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
                    tick={{ fill: '#8b95b0', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                  />
                  <YAxis
                    allowDecimals={false}
                    stroke="#1e2438"
                    tick={{ fill: '#8b95b0', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
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
                    tick={{ fill: '#8b95b0', fontSize: 11 }}
                  />
                  <YAxis
                    domain={[2.0, 5.0]}
                    tickFormatter={(v: number) => `${v.toFixed(1)}★`}
                    stroke="#1e2438"
                    tick={{ fill: '#8b95b0', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
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

        {/* Годы выхода фильмов (Release Year) */}
        <div className="rounded-2xl bg-card border border-line p-5 sm:p-6 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2 mb-5">
            <div>
              <h3 className="text-base font-semibold text-white">Годы выхода фильмов (Release Year)</h3>
              <p className="text-xs text-slate-400 mt-0.5">Распределение просмотренного по эпохам</p>
            </div>
            <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-cardElevated text-slate-300 border border-line">
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
                  tick={{ fill: '#8b95b0', fontSize: 11 }}
                />
                <YAxis
                  allowDecimals={false}
                  stroke="#1e2438"
                  tick={{ fill: '#8b95b0', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
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

      {/* 3. Длительность (Runtime) + Вкусовые акценты */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Длительность (Runtime) */}
        <div className="rounded-2xl bg-card border border-line p-5 sm:p-6 flex flex-col justify-between">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
            <div>
              <h3 className="text-base font-semibold text-white">Длительность (Runtime)</h3>
              <p className="text-xs text-slate-400 mt-0.5">Просмотренные часы кино по месяцам</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-2.5 py-1.5 rounded-xl bg-canvas border border-line text-right">
                <span className="block text-[10px] text-slate-500 leading-none">Всего часов</span>
                <span className="text-xs font-mono font-semibold text-white tabular-nums">
                  {runtime.totalHours} ч
                </span>
              </div>
              <div className="px-2.5 py-1.5 rounded-xl bg-canvas border border-line text-right">
                <span className="block text-[10px] text-slate-500 leading-none">В сутках</span>
                <span className="text-xs font-mono font-semibold text-[#45d1c6] tabular-nums">
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
                  tick={{ fill: '#8b95b0', fontSize: 11 }}
                />
                <YAxis
                  tickFormatter={(v: number) => `${v}ч`}
                  stroke="#1e2438"
                  tick={{ fill: '#8b95b0', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
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
              <h3 className="text-base font-semibold text-white">Вкусовые акценты</h3>
              <p className="text-xs text-slate-400 mt-0.5">Топ-6 {scopeWord}</p>
            </div>
            <div className="inline-flex items-center p-0.5 rounded-xl bg-canvas border border-line text-[11px]">
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
                  onClick={() => setTasteTab(tab.id)}
                  className={
                    tasteTab === tab.id
                      ? 'px-2.5 py-1 rounded-lg font-medium bg-cardElevated text-white border border-lineStrong transition-all cursor-pointer'
                      : 'px-2.5 py-1 rounded-lg font-medium text-slate-400 hover:text-slate-200 transition-all cursor-pointer'
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
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[11px] text-slate-500 w-4">{item.rank}.</span>
                      <span className="font-medium text-slate-200 truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 font-mono text-[11px]">
                      <span className="text-slate-400">
                        {item.count} {filmWord(item.count)}
                      </span>
                      <span className="text-[#d6b85a]">{item.avgRating} ★</span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-canvas border border-line overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#45d1c6] to-[#f06292] transition-all duration-500"
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="my-auto py-10 text-center text-xs text-slate-500">
              Недостаточно метаданных для выбранного фильтра. Подключите TMDB или добавьте фильмы вручную.
            </div>
          )}
        </div>
      </div>

      {/* Floating Heatmap Tooltip */}
      {hoveredCell && (
        <div
          className="pointer-events-none fixed z-50 px-3 py-2 rounded-lg bg-[#0b0e17] border border-lineStrong shadow-2xl text-xs text-slate-200 font-mono max-w-xs"
          style={{
            left: Math.min(hoveredCell.x + 14, typeof window !== 'undefined' ? window.innerWidth - 260 : hoveredCell.x + 14),
            top: Math.max(10, hoveredCell.y - 44),
          }}
        >
          {hoveredCell.cell.isFuture ? (
            <span className="text-slate-500">{hoveredCell.cell.dateLabel} · будущая дата</span>
          ) : (
            <div>
              <div>
                <span className="text-white font-semibold">
                  {hoveredCell.cell.count} {filmWord(hoveredCell.cell.count)}
                </span>{' '}
                <span className="text-slate-400">· {hoveredCell.cell.dateLabel}</span>
              </div>
              {hoveredCell.cell.titles.length > 0 && (
                <div className="mt-1 text-[10px] text-[#45d1c6] truncate font-sans">
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
