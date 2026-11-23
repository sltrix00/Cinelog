import { useState } from 'react';
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
import { getYearColor, YEAR_COLORS } from '../lib/demoData';
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
}

const TOOLTIP_STYLE = {
  backgroundColor: '#0b0e17',
  border: '1px solid #2c3450',
  borderRadius: '10px',
  color: '#f8fafc',
  fontSize: '12px',
  fontFamily: 'var(--font-sans)',
};

export function Tier3RhythmSection({
  monthlyData,
  dayOfWeek,
  timeOfDay,
  selectedYear,
}: Tier3RhythmSectionProps) {
  const [simulateCsvEmpty, setSimulateCsvEmpty] = useState(false);

  const showEmptyTimeState = !timeOfDay.hasTimeData || simulateCsvEmpty;
  const activeColor = selectedYear === 'all' ? '#45d1c6' : getYearColor(selectedYear);

  const scopeLabel = selectedYear === 'all' ? 'за всё время' : `за ${selectedYear} год`;

  return (
    <section id="level-3" className="scroll-mt-24 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-[11px] tabular-nums uppercase tracking-widest text-slate-500">Уровень 03</span>
        <span className="text-slate-700">/</span>
        <h2 className="text-sm font-bold tracking-tight text-slate-200">Привычки и ритм просмотров</h2>
      </div>

      {/* 1. FILMS WATCHED PER MONTH — BY YEAR (Wide Block) */}
      <div className="rounded-2xl bg-card border border-line p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-tight text-slate-200">
              FILMS WATCHED PER MONTH — BY YEAR
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Сгруппированное сравнение помесячной активности за 2024, 2025 и 2026 годы
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs tabular-nums text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#d6b85a]" />
              2024
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#45d1c6]" />
              2025
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#f06292]" />
              2026
            </span>
          </div>
        </div>

        <div className="h-72 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={monthlyData} margin={{ top: 6, right: 8, left: -16, bottom: 2 }}>
              <CartesianGrid stroke="rgba(30, 36, 56, 0.75)" vertical={false} />
              <XAxis
                dataKey="month"
                stroke="#1e2438"
                tick={{ fill: '#8b95b0', fontSize: 11, fontFamily: 'var(--font-sans)' }}
              />
              <YAxis
                allowDecimals={false}
                stroke="#1e2438"
                tick={{ fill: '#8b95b0', fontSize: 11, fontFamily: 'var(--font-sans)' }}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                formatter={(value, name) => [`${value} ${filmWord(Number(value))}`, String(name)]}
              />
              <Bar dataKey="y2024" name="2024" fill={YEAR_COLORS[2024]} radius={[4, 4, 0, 0]} />
              <Bar dataKey="y2025" name="2025" fill={YEAR_COLORS[2025]} radius={[4, 4, 0, 0]} />
              <Bar dataKey="y2026" name="2026" fill={YEAR_COLORS[2026]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2 & 3. DAY OF WEEK + TIME OF THE DAY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* DAY OF WEEK */}
        <div className="rounded-2xl bg-card border border-line p-5 sm:p-6 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2 mb-5">
            <div>
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-tight text-slate-200">
                DAY OF WEEK
              </h3>
              <p className="text-xs text-slate-400 mt-1">Распределение по дням недели {scopeLabel}</p>
            </div>
            <span className="text-[11px] tabular-nums px-2.5 py-1 rounded-lg bg-[#45d1c6]/10 text-[#45d1c6] border border-[#45d1c6]/25">
              Пик: {dayOfWeek.peakLabel} ({dayOfWeek.peakCount})
            </span>
          </div>

          <div className="h-60 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={dayOfWeek.points} margin={{ top: 6, right: 8, left: -18, bottom: 2 }}>
                <CartesianGrid stroke="rgba(30, 36, 56, 0.75)" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#1e2438"
                  tick={{ fill: '#8b95b0', fontSize: 11 }}
                />
                <YAxis
                  allowDecimals={false}
                  stroke="#1e2438"
                  tick={{ fill: '#8b95b0', fontSize: 11, fontFamily: 'var(--font-sans)' }}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  formatter={(value) => [`${value} ${filmWord(Number(value))}`, 'Просмотров']}
                />
                <Bar dataKey="count" radius={[7, 7, 0, 0]}>
                  {dayOfWeek.points.map((entry) => (
                    <Cell
                      key={entry.label}
                      fill={entry.isPeak ? activeColor : '#26304d'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* TIME OF THE DAY (honest CSV empty state + toggle) */}
        <div className="rounded-2xl bg-card border border-line p-5 sm:p-6 flex flex-col justify-between">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
            <div>
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-tight text-slate-200">
                TIME OF THE DAY
              </h3>
              <p className="text-xs text-slate-400 mt-1">Утро / День / Вечер / Ночь</p>
            </div>

            {/* Interactive Toggle: Данные о времени Есть / Нет (CSV) */}
            <div className="inline-flex items-center p-0.5 rounded-xl bg-canvas border border-line text-[11px]">
              <button
                type="button"
                onClick={() => setSimulateCsvEmpty(false)}
                className={
                  !simulateCsvEmpty
                    ? 'px-2.5 py-1 rounded-lg font-medium bg-cardElevated text-white border border-lineStrong transition-all cursor-pointer'
                    : 'px-2.5 py-1 rounded-lg font-medium text-slate-400 hover:text-slate-200 transition-all cursor-pointer'
                }
              >
                Данные о времени: {timeOfDay.hasTimeData ? 'Есть' : 'Нет'}
              </button>
              <button
                type="button"
                onClick={() => setSimulateCsvEmpty(true)}
                className={
                  simulateCsvEmpty
                    ? 'px-2.5 py-1 rounded-lg font-medium bg-cardElevated text-white border border-lineStrong transition-all cursor-pointer'
                    : 'px-2.5 py-1 rounded-lg font-medium text-slate-400 hover:text-slate-200 transition-all cursor-pointer'
                }
              >
                Нет (CSV)
              </button>
            </div>
          </div>

          {!showEmptyTimeState ? (
            <div className="h-60 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={timeOfDay.points} margin={{ top: 6, right: 8, left: -18, bottom: 2 }}>
                  <CartesianGrid stroke="rgba(30, 36, 56, 0.75)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="#1e2438"
                    tick={{ fill: '#8b95b0', fontSize: 11 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    stroke="#1e2438"
                    tick={{ fill: '#8b95b0', fontSize: 11, fontFamily: 'var(--font-sans)' }}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
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
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <p className="text-sm font-medium text-slate-200">Недостаточно данных о времени</p>
              <p className="text-xs text-slate-400 max-w-sm mt-1.5 leading-relaxed">
                Экспорт CSV содержит только дату (<span className="tabular-nums text-slate-300">YYYY-MM-DD</span>).
                Добавляйте фильмы напрямую в Cinelog или через расширение, чтобы собирать статистику по времени суток.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
