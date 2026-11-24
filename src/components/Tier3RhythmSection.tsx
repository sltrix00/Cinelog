import { FileSpreadsheet } from 'lucide-react';
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
import { filmWord } from '../lib/analytics';
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
}

const DEFAULT_COMPARISON_YEARS = [2024, 2025, 2026];

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
}: Tier3RhythmSectionProps) {
  const showEmptyTimeState = !timeOfDay.hasTimeData;
  const activeColor = selectedYear === 'all' ? '#45d1c6' : getYearColor(selectedYear);

  const scopeLabel = selectedYear === 'all' ? 'за всё время' : `за ${selectedYear} год`;

  return (
    <section id="level-3" className="scroll-mt-24 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xs tabular-nums uppercase tracking-widest text-slate-400">Уровень 03</span>
        <span className="text-slate-600" aria-hidden="true">/</span>
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
              Сгруппированное сравнение помесячной активности за {comparisonYears.join(', ')} гг.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs tabular-nums text-slate-300">
            {comparisonYears.map((yr) => (
              <span key={yr} className="inline-flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: getYearColor(yr) }}
                  aria-hidden="true"
                />
                {yr}
              </span>
            ))}
          </div>
        </div>

        <div className="h-72 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={monthlyData} margin={{ top: 6, right: 8, left: -16, bottom: 2 }}>
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
              {comparisonYears.map((yr) => (
                <Bar
                  key={yr}
                  dataKey={`byYear.${yr}`}
                  name={String(yr)}
                  fill={getYearColor(yr)}
                  radius={[4, 4, 0, 0]}
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
