import { useEffect, useMemo, useRef, useState } from 'react';
import { FileSpreadsheet, Plus } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  filmWord,
  resolveMonthlyLegendYears,
  toggleMonthlyComparisonYear,
} from '../lib/analytics';
import { getYearColor } from '../lib/demoData';
import type {
  DayOfWeekSummary,
  MonthlyYearPoint,
  TimeOfDaySummary,
  YearFilter,
} from '../types/cinelog';

interface Tier3RhythmSectionProps {
  monthlyData: MonthlyYearPoint[];
  dayOfWeek: DayOfWeekSummary;
  timeOfDay: TimeOfDaySummary;
  selectedYear: YearFilter;
  comparisonYears?: number[];
  journalYears?: number[];
}

const DEFAULT_COMPARISON_YEARS = [2024, 2025, 2026];
const MAX_ACTIVE_MONTHLY_YEARS = 4;
const MAX_VISIBLE_LEGEND_YEARS = 5;

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--chart-tooltip-bg)',
  border: '1px solid var(--chart-tooltip-border)',
  borderRadius: '10px',
  color: 'var(--chart-tooltip-text)',
  fontSize: '12px',
  fontFamily: 'var(--font-sans)',
};

const TOOLTIP_ITEM_STYLE = {
  color: 'var(--chart-tooltip-item)',
};

const TOOLTIP_LABEL_STYLE = {
  color: 'var(--chart-tooltip-text)',
  fontWeight: 600,
  marginBottom: '4px',
};

export function Tier3RhythmSection({
  monthlyData,
  dayOfWeek,
  timeOfDay,
  selectedYear,
  comparisonYears = DEFAULT_COMPARISON_YEARS,
  journalYears,
}: Tier3RhythmSectionProps) {
  const showEmptyTimeState = !timeOfDay.hasTimeData;
  const activeColor = selectedYear === 'all' ? 'var(--palette-secondary)' : getYearColor(selectedYear);

  const scopeLabel = selectedYear === 'all' ? 'за всё время' : `за ${selectedYear} год`;

  const defaultActiveYears = useMemo(
    () => Array.from(new Set(comparisonYears)).sort((a, b) => a - b),
    [comparisonYears]
  );
  const defaultActiveKey = defaultActiveYears.join(',');

  const [activeYears, setActiveYears] = useState<number[]>(defaultActiveYears);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveYears(defaultActiveYears);
    setPickerOpen(false);
  }, [defaultActiveKey]);

  useEffect(() => {
    if (!pickerOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setPickerOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [pickerOpen]);

  const sortedActiveYears = useMemo(
    () => Array.from(new Set(activeYears)).sort((a, b) => a - b),
    [activeYears]
  );

  const poolYears = useMemo(
    () =>
      journalYears && journalYears.length > 0
        ? Array.from(new Set(journalYears)).sort((a, b) => a - b)
        : defaultActiveYears,
    [journalYears, defaultActiveYears]
  );

  const { visibleYears, overflowYears } = useMemo(
    () => resolveMonthlyLegendYears(poolYears, sortedActiveYears, MAX_VISIBLE_LEGEND_YEARS),
    [poolYears, sortedActiveYears]
  );

  const handleToggleYear = (year: number) => {
    setActiveYears((prev) => toggleMonthlyComparisonYear(prev, year, MAX_ACTIVE_MONTHLY_YEARS));
  };

  const handleAddOverflowYear = (year: number) => {
    setActiveYears((prev) => toggleMonthlyComparisonYear(prev, year, MAX_ACTIVE_MONTHLY_YEARS));
    setPickerOpen(false);
  };

  return (
    <section id="level-3" className="scroll-mt-24 space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-bold tracking-tight text-slate-200">Привычки и ритм просмотров</h2>
      </div>

      {/* 1. Просмотры по месяцам — сравнение по годам */}
      <div className="rounded-2xl bg-card border border-line p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="text-base font-bold tracking-tight text-white">
              Просмотры по месяцам — сравнение по годам
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Сгруппированное сравнение помесячной активности за {sortedActiveYears.join(', ')}{' '}
              {sortedActiveYears.length === 1 ? 'г.' : 'гг.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs tabular-nums">
            {visibleYears.map((yr) => {
              const isActive = sortedActiveYears.includes(yr);
              const isOnlyActive = isActive && sortedActiveYears.length === 1;
              const color = getYearColor(yr);
              return (
                <button
                  key={yr}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => handleToggleYear(yr)}
                  title={
                    isOnlyActive
                      ? 'На графике должен остаться хотя бы один год'
                      : isActive
                        ? `Убрать ${yr} из графика`
                        : `Добавить ${yr} в график`
                  }
                  className={`inline-flex items-center gap-1.5 min-h-8 px-2.5 py-1 rounded-lg border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6] ${
                    isActive
                      ? 'bg-canvas/70 border-lineStrong text-slate-100 hover:border-slate-500'
                      : 'bg-transparent border-line/70 text-slate-400 opacity-55 hover:opacity-90 hover:text-slate-200 hover:border-lineStrong'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 transition-opacity"
                    style={{
                      backgroundColor: isActive ? color : 'transparent',
                      border: `2px solid ${color}`,
                    }}
                    aria-hidden="true"
                  />
                  <span>{yr}</span>
                </button>
              );
            })}

            {overflowYears.length > 0 && (
              <div ref={pickerRef} className="relative">
                <button
                  type="button"
                  onClick={() => setPickerOpen((prev) => !prev)}
                  aria-label="Выбрать более ранний год"
                  aria-expanded={pickerOpen}
                  aria-haspopup="listbox"
                  title="Добавить год из архива"
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6] ${
                    pickerOpen
                      ? 'bg-cardElevated border-lineStrong text-white'
                      : 'bg-canvas/60 border-line text-slate-300 hover:text-white hover:border-lineStrong'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                </button>

                {pickerOpen && (
                  <div
                    role="listbox"
                    aria-label="Доступные годы"
                    className="absolute right-0 top-full mt-2 z-30 min-w-[124px] max-h-56 overflow-y-auto rounded-xl bg-cardElevated border border-lineStrong shadow-xl p-1.5 space-y-0.5"
                  >
                    {overflowYears.map((yr) => (
                      <button
                        key={yr}
                        type="button"
                        role="option"
                        aria-selected={false}
                        onClick={() => handleAddOverflowYear(yr)}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs tabular-nums text-slate-200 hover:bg-canvas/80 hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: getYearColor(yr) }}
                          aria-hidden="true"
                        />
                        <span>{yr}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="h-72 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart
              key={sortedActiveYears.join('-')}
              data={monthlyData}
              margin={{ top: 6, right: 8, left: -16, bottom: 2 }}
            >
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis
                dataKey="month"
                stroke="var(--chart-axis)"
                tick={{ fill: 'var(--chart-tick)', fontSize: 11, fontFamily: 'var(--font-sans)' }}
              />
              <YAxis
                allowDecimals={false}
                stroke="var(--chart-axis)"
                tick={{ fill: 'var(--chart-tick)', fontSize: 11, fontFamily: 'var(--font-sans)' }}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                itemStyle={TOOLTIP_ITEM_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                cursor={{ fill: 'var(--chart-cursor)' }}
                formatter={(value, name) => [`${value} ${filmWord(Number(value))}`, String(name)]}
              />
              {sortedActiveYears.map((yr) => (
                <Bar
                  key={yr}
                  dataKey={`byYear.${yr}`}
                  name={String(yr)}
                  fill={getYearColor(yr)}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2 & 3. Дни недели + Время суток */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Дни недели */}
        <div className="rounded-2xl bg-card border border-line p-5 sm:p-6 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2 mb-5">
            <div>
              <h3 className="text-base font-bold tracking-tight text-white">Дни недели</h3>
              <p className="text-xs text-slate-400 mt-0.5">Распределение по дням недели {scopeLabel}</p>
            </div>
            <span className="text-xs tabular-nums px-2.5 py-1 rounded-lg bg-[#45d1c6]/10 text-[#45d1c6] border border-[#45d1c6]/25 shrink-0">
              Пик: {dayOfWeek.peakLabel} ({dayOfWeek.peakCount})
            </span>
          </div>

          <div className="h-60 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={dayOfWeek.points} margin={{ top: 6, right: 8, left: -18, bottom: 2 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="var(--chart-axis)"
                  tick={{ fill: 'var(--chart-tick)', fontSize: 11, fontFamily: 'var(--font-sans)' }}
                />
                <YAxis
                  allowDecimals={false}
                  stroke="var(--chart-axis)"
                  tick={{ fill: 'var(--chart-tick)', fontSize: 11, fontFamily: 'var(--font-sans)' }}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                  labelStyle={TOOLTIP_LABEL_STYLE}
                  cursor={{ fill: 'var(--chart-cursor)' }}
                  formatter={(value) => [`${value} ${filmWord(Number(value))}`, 'Просмотров']}
                />
                <Bar dataKey="count" radius={[7, 7, 0, 0]}>
                  {dayOfWeek.points.map((entry) => (
                    <Cell
                      key={entry.label}
                      fill={entry.isPeak ? activeColor : 'var(--chart-bar-muted)'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Время суток */}
        <div className="rounded-2xl bg-card border border-line p-5 sm:p-6 flex flex-col justify-between">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
            <div>
              <h3 className="text-base font-bold tracking-tight text-white">Время суток</h3>
              <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                05:00–11:59 · 12:00–16:59 · 17:00–22:59 · 23:00–04:59
              </p>
            </div>

            <span className="text-xs tabular-nums px-2.5 py-1 rounded-lg bg-cardElevated text-slate-300 border border-line shrink-0">
              {timeOfDay.hasTimeData
                ? `С временем: ${timeOfDay.totalWithTime}`
                : 'Без данных времени'}
            </span>
          </div>

          {!showEmptyTimeState ? (
            <div className="h-60 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={timeOfDay.points} margin={{ top: 6, right: 8, left: -18, bottom: 2 }}>
                  <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="var(--chart-axis)"
                    tick={{ fill: 'var(--chart-tick)', fontSize: 11, fontFamily: 'var(--font-sans)' }}
                  />
                  <YAxis
                    allowDecimals={false}
                    stroke="var(--chart-axis)"
                    tick={{ fill: 'var(--chart-tick)', fontSize: 11, fontFamily: 'var(--font-sans)' }}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    itemStyle={TOOLTIP_ITEM_STYLE}
                    labelStyle={TOOLTIP_LABEL_STYLE}
                    cursor={{ fill: 'var(--chart-cursor)' }}
                    formatter={(_value, _name, item) => {
                      const pt = item?.payload as { count?: number; percentage?: number } | undefined;
                      return [`${pt?.count ?? 0} (${pt?.percentage ?? 0}%)`, 'Просмотров'];
                    }}
                  />
                  <Bar dataKey="count" radius={[7, 7, 0, 0]}>
                    {timeOfDay.points.map((entry) => (
                      <Cell key={entry.label} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-60 w-full rounded-xl border border-dashed border-lineStrong bg-canvas/60 flex flex-col items-center justify-center text-center p-6">
              <div className="w-10 h-10 rounded-xl bg-cardElevated border border-line flex items-center justify-center mb-3 text-slate-400">
                <FileSpreadsheet className="w-5 h-5" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium text-slate-200">Недостаточно данных о времени</p>
              <p className="text-xs text-slate-400 max-w-sm mt-1.5 leading-relaxed">
                Экспорт CSV содержит только дату (<span className="tabular-nums text-slate-300">YYYY-MM-DD</span>).
                Указывайте время при добавлении фильмов в Cinelog, чтобы собирать статистику по времени суток.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
