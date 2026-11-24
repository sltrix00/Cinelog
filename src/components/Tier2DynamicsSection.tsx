import { useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { filmWord, MONTH_STARTS_NONLEAP, MONTHS_RU } from '../lib/analytics';
import { getYearColor } from '../lib/demoData';
import type { CumulativePoint365, IndexTrajectoryPoint, YearFilter } from '../types/cinelog';

interface Tier2DynamicsSectionProps {
  cumulativeData: CumulativePoint365[];
  indexTrajectory: IndexTrajectoryPoint[];
  selectedYear: YearFilter;
  comparisonYears?: number[];
}

const DEFAULT_COMPARISON_YEARS = [2024, 2025, 2026];

interface CustomTooltipPayloadItem {
  dataKey?: string;
  name?: string;
  value?: number;
  color?: string;
  payload?: CumulativePoint365;
}

function CumulativeTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
}) {
  if (!active || !payload || payload.length === 0 || !payload[0].payload) return null;
  const row = payload[0].payload;
  const diff = row.yoyDelta;
  const sign = diff !== null && diff >= 0 ? '+' : '';

  return (
    <div className="rounded-xl bg-[#0b0e17] border border-lineStrong p-3 shadow-2xl text-xs min-w-[210px]">
      <div className="font-semibold text-slate-100 mb-2 tabular-nums">{row.dateLabel}</div>
      <div className="space-y-1">
        {payload.map((entry) => {
          const val = Number(entry.value ?? 0);
          return (
            <div key={String(entry.dataKey)} className="flex items-center justify-between gap-4 tabular-nums">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span
                  className="w-2.5 h-2.5 rounded-[2px] inline-block"
                  style={{ backgroundColor: entry.color }}
                />
                {entry.name}:
              </span>
              <span className="text-white font-semibold">
                {val} {filmWord(val)}
              </span>
            </div>
          );
        })}
      </div>
      {diff !== null && row.latestYear !== null && row.prevYear !== null && (
        <div className="mt-2 pt-2 border-t border-line tabular-nums text-xs flex items-center justify-between text-slate-400">
          <span>
            {row.latestYear} vs {row.prevYear}:
          </span>
          <span className={diff >= 0 ? 'text-[#45d1c6] font-semibold' : 'text-[#f06292] font-semibold'}>
            {sign}
            {diff} {filmWord(Math.abs(diff))}
          </span>
        </div>
      )}
    </div>
  );
}

interface TrajectoryTooltipPayloadItem {
  payload?: IndexTrajectoryPoint;
}

function TrajectoryTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TrajectoryTooltipPayloadItem[];
}) {
  if (!active || !payload || payload.length === 0 || !payload[0].payload) return null;
  const pt = payload[0].payload;

  return (
    <div className="rounded-xl bg-[#0b0e17] border border-lineStrong p-3 shadow-2xl text-xs">
      <div className="font-semibold text-slate-100 mb-1.5 tabular-nums">{pt.tooltipTitle}</div>
      <div className="space-y-1 tabular-nums text-slate-300">
        <div>
          Индекс: <span className="text-white font-semibold">{pt.index.toFixed(2)}</span>
        </div>
        <div>
          Накоплено:{' '}
          <span className="text-white font-semibold">
            {pt.films} {filmWord(pt.films)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function Tier2DynamicsSection({
  cumulativeData,
  indexTrajectory,
  selectedYear,
  comparisonYears = DEFAULT_COMPARISON_YEARS,
}: Tier2DynamicsSectionProps) {
  const [hiddenYears, setHiddenYears] = useState<Record<number, boolean>>({});

  const toggleYear = (yr: number) => {
    setHiddenYears((prev) => ({ ...prev, [yr]: !prev[yr] }));
  };

  const isAllYears = selectedYear === 'all';
  const trajectoryColor = isAllYears ? 'var(--palette-secondary)' : getYearColor(selectedYear);

  const allTimeStartYear = (() => {
    const firstTitle = indexTrajectory[0]?.tooltipTitle ?? '';
    const m = firstTitle.match(/\b(19\d{2}|20\d{2})\b/);
    return m ? Number.parseInt(m[1], 10) : comparisonYears[0] ?? 2024;
  })();
  const maxTrajectoryDoy = indexTrajectory[indexTrajectory.length - 1]?.doy ?? 365;
  const allTimeMonthTicks: number[] = [];
  const allTimeYearBoundaries: number[] = [];
  if (isAllYears && indexTrajectory.length > 0) {
    const totalYears = Math.ceil(maxTrajectoryDoy / 365);
    for (let yIdx = 0; yIdx < totalYears; yIdx++) {
      const yearStartDoy = yIdx * 365 + 1;
      if (yIdx > 0 && yearStartDoy <= maxTrajectoryDoy) {
        allTimeYearBoundaries.push(yearStartDoy);
      }
      for (const mStart of MONTH_STARTS_NONLEAP) {
        const gDay = yIdx * 365 + mStart;
        if (gDay <= maxTrajectoryDoy) {
          allTimeMonthTicks.push(gDay);
        }
      }
    }
  }

  const maxCumValue = Math.max(
    40,
    ...cumulativeData.map((d) =>
      Math.max(0, ...comparisonYears.map((yr) => d.byYear[yr] ?? 0))
    )
  );
  const yMax = Math.ceil((maxCumValue + 10) / 20) * 20;

  return (
    <section id="level-2" className="scroll-mt-24 space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-bold tracking-tight text-slate-200">Главный блок динамики</h2>
      </div>

      {/* 1. Накопительная динамика просмотров — сравнение по годам */}
      <div className="rounded-2xl bg-card border border-line p-5 sm:p-6">
        <div className="mb-5">
          <h3 className="text-base font-bold tracking-tight text-white">
            Накопительная динамика просмотров — сравнение по годам
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Сравнение накопленных просмотров по дням года (с 1 января по 31 декабря)
          </p>
        </div>

        {/* Centered Custom Legend with proper touch targets */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-5">
          {comparisonYears.map((yr) => {
            const visible = !hiddenYears[yr];
            const color = getYearColor(yr);
            return (
              <button
                key={yr}
                type="button"
                aria-pressed={visible}
                onClick={() => toggleYear(yr)}
                className={`inline-flex items-center gap-2 min-h-9 px-3 py-1.5 rounded-xl bg-canvas/60 border border-line hover:border-lineStrong text-xs tabular-nums text-slate-200 hover:text-white transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6] ${
                  visible ? '' : 'opacity-40 line-through'
                }`}
              >
                <span
                  className="w-7 h-3 rounded-[2px] border-2 bg-transparent inline-block"
                  style={{ borderColor: color }}
                  aria-hidden="true"
                />
                <span>{yr}</span>
              </button>
            );
          })}
        </div>

        {/* 365-Day Cumulative Line Chart */}
        <div className="h-80 sm:h-96 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={cumulativeData} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis
                dataKey="doy"
                type="number"
                domain={[1, 365]}
                ticks={[...MONTH_STARTS_NONLEAP]}
                tickFormatter={(doy: number) => {
                  const pt = cumulativeData[doy - 1];
                  return pt?.monthTick ?? '';
                }}
                stroke="var(--chart-axis)"
                tick={{ fill: 'var(--chart-tick)', fontSize: 11, fontFamily: 'var(--font-sans)' }}
              />
              <YAxis
                domain={[0, yMax]}
                stroke="var(--chart-axis)"
                tick={{ fill: 'var(--chart-tick)', fontSize: 11, fontFamily: 'var(--font-sans)' }}
              />
              <Tooltip content={<CumulativeTooltip />} />
              {comparisonYears.map((yr, idx) => {
                if (hiddenYears[yr]) return null;
                const color = getYearColor(yr);
                const isLatest = idx === comparisonYears.length - 1;
                return (
                  <Line
                    key={yr}
                    type="monotone"
                    dataKey={`byYear.${yr}`}
                    name={String(yr)}
                    stroke={color}
                    strokeWidth={isLatest ? 2.3 : 2}
                    dot={false}
                    activeDot={{ r: isLatest ? 4.5 : 4, fill: color, strokeWidth: 0 }}
                    isAnimationActive={false}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Карточка: Индекс просмотра сквозь год / за всё время */}
      <div className="rounded-2xl bg-card border border-line p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
          <div>
            <h3 className="text-base font-bold tracking-tight text-white">
              {isAllYears
                ? 'Индекс просмотра за всё время'
                : `Индекс просмотра сквозь ${selectedYear} год`}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {isAllYears
                ? 'Изменение соотношения «накопленные фильмы / дней с начала дневника» с ориентиром 1.0'
                : 'Изменение соотношения «фильмы / прошедший день года» с ориентиром 1.0 (темп 1 фильм в день)'}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 text-xs tabular-nums text-[#d6b85a] bg-[#d6b85a]/10 border border-[#d6b85a]/25 px-3 py-1 rounded-lg self-start sm:self-auto">
            <span className="w-4 border-t-2 border-dashed border-[#d6b85a]" aria-hidden="true" />
            <span>1.0 · Темп 1 фильм в день</span>
          </div>
        </div>

        <div className="h-64 sm:h-72 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart data={indexTrajectory} margin={{ top: 8, right: 12, left: -10, bottom: 4 }}>
              <defs>
                <linearGradient id="indexTrajectoryGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={trajectoryColor} stopOpacity={0.28} />
                  <stop offset="95%" stopColor={trajectoryColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              {isAllYears ? (
                <XAxis
                  dataKey="doy"
                  type="number"
                  domain={[1, maxTrajectoryDoy]}
                  ticks={allTimeMonthTicks}
                  minTickGap={20}
                  tickFormatter={(gDay: number) => {
                    const yIdx = Math.floor((gDay - 1) / 365);
                    const doyInYear = ((gDay - 1) % 365) + 1;
                    const mIdx = (MONTH_STARTS_NONLEAP as readonly number[]).indexOf(doyInYear);
                    if (mIdx === -1) return '';
                    if (mIdx === 0) return `Янв ${allTimeStartYear + yIdx}`;
                    return MONTHS_RU[mIdx];
                  }}
                  stroke="var(--chart-axis)"
                  tick={{ fill: 'var(--chart-tick)', fontSize: 11, fontFamily: 'var(--font-sans)' }}
                />
              ) : (
                <XAxis
                  dataKey="label"
                  minTickGap={34}
                  stroke="var(--chart-axis)"
                  tick={{ fill: 'var(--chart-tick)', fontSize: 11, fontFamily: 'var(--font-sans)' }}
                />
              )}
              <YAxis
                domain={[0, (dataMax: number) => Math.max(1.15, +(dataMax + 0.1).toFixed(2))]}
                tickFormatter={(v: number) => v.toFixed(2)}
                stroke="var(--chart-axis)"
                tick={{ fill: 'var(--chart-tick)', fontSize: 11, fontFamily: 'var(--font-sans)' }}
              />
              <Tooltip content={<TrajectoryTooltip />} />
              {isAllYears &&
                allTimeYearBoundaries.map((boundaryDoy) => (
                  <ReferenceLine
                    key={boundaryDoy}
                    x={boundaryDoy}
                    stroke="rgba(148, 163, 184, 0.35)"
                    strokeDasharray="4 4"
                    strokeWidth={1}
                  />
                ))}
              <ReferenceLine
                y={1.0}
                stroke="var(--palette-tertiary)"
                strokeOpacity={0.8}
                strokeDasharray="6 5"
                strokeWidth={1.5}
              />
              <Area
                type="monotone"
                dataKey="index"
                stroke={trajectoryColor}
                strokeWidth={2.3}
                fill="url(#indexTrajectoryGrad)"
                dot={false}
                activeDot={{ r: 5, fill: trajectoryColor, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
