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
import { filmWord, MONTH_STARTS_NONLEAP } from '../lib/analytics';
import { getYearColor, YEAR_COLORS } from '../lib/demoData';
import type { CumulativePoint365, IndexTrajectoryPoint, YearFilter } from '../types/cinelog';

interface Tier2DynamicsSectionProps {
  cumulativeData: CumulativePoint365[];
  indexTrajectory: IndexTrajectoryPoint[];
  selectedYear: YearFilter;
}

const YEARS: Array<2024 | 2025 | 2026> = [2024, 2025, 2026];

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
  const diff = row.yoyDelta26vs25;
  const sign = diff >= 0 ? '+' : '';

  return (
    <div className="rounded-xl bg-[#0b0e17] border border-lineStrong p-3 shadow-2xl text-xs min-w-[200px]">
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
      <div className="mt-2 pt-2 border-t border-line tabular-nums text-[11px] flex items-center justify-between text-slate-400">
        <span>2026 vs 2025:</span>
        <span className={diff >= 0 ? 'text-[#45d1c6] font-semibold' : 'text-[#f06292] font-semibold'}>
          {sign}
          {diff} {filmWord(Math.abs(diff))}
        </span>
      </div>
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
}: Tier2DynamicsSectionProps) {
  const [visibleYears, setVisibleYears] = useState<Record<2024 | 2025 | 2026, boolean>>({
    2024: true,
    2025: true,
    2026: true,
  });

  const toggleYear = (yr: 2024 | 2025 | 2026) => {
    setVisibleYears((prev) => ({ ...prev, [yr]: !prev[yr] }));
  };

  const activeTrajectoryYear = selectedYear === 'all' ? 2026 : selectedYear;
  const trajectoryColor = getYearColor(activeTrajectoryYear);
  const maxCumValue = Math.max(
    125,
    ...cumulativeData.map((d) => Math.max(d.y2024, d.y2025, d.y2026))
  );
  const yMax = Math.ceil((maxCumValue + 10) / 20) * 20;

  return (
    <section id="level-2" className="scroll-mt-24 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-[11px] tabular-nums uppercase tracking-widest text-slate-500">Уровень 02</span>
        <span className="text-slate-700">/</span>
        <h2 className="text-sm font-bold tracking-tight text-slate-200">Главный блок динамики</h2>
      </div>

      {/* 1. Полноширинная карточка: CUMULATIVE FILMS — ALL YEARS COMPARED (DAY OF YEAR) */}
      <div className="rounded-2xl bg-card border border-line p-5 sm:p-6">
        <div className="mb-5">
          <h3 className="text-xs sm:text-sm font-bold uppercase tracking-tight text-slate-200">
            CUMULATIVE FILMS — ALL YEARS COMPARED (DAY OF YEAR)
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Сравнение накопленных просмотров по дням года (с 1 января по 31 декабря)
          </p>
        </div>

        {/* Centered Custom Legend (Outlined Rectangles, Transparent Fill, 2px Colored Border) */}
        <div className="flex flex-wrap items-center justify-center gap-5 mb-5">
          {YEARS.map((yr) => {
            const visible = visibleYears[yr];
            return (
              <button
                key={yr}
                type="button"
                onClick={() => toggleYear(yr)}
                className={`inline-flex items-center gap-2 text-xs tabular-nums text-slate-300 hover:text-white transition-opacity cursor-pointer ${
                  visible ? '' : 'opacity-35 line-through'
                }`}
              >
                <span
                  className="w-8 h-3.5 rounded-[2px] border-2 bg-transparent inline-block"
                  style={{ borderColor: YEAR_COLORS[yr] }}
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
              <CartesianGrid stroke="rgba(30, 36, 56, 0.75)" vertical={false} />
              <XAxis
                dataKey="doy"
                type="number"
                domain={[1, 365]}
                ticks={[...MONTH_STARTS_NONLEAP]}
                tickFormatter={(doy: number) => {
                  const pt = cumulativeData[doy - 1];
                  return pt?.monthTick ?? '';
                }}
                stroke="#1e2438"
                tick={{ fill: '#7c86a2', fontSize: 11, fontFamily: 'var(--font-sans)' }}
              />
              <YAxis
                domain={[0, yMax]}
                stroke="#1e2438"
                tick={{ fill: '#7c86a2', fontSize: 11, fontFamily: 'var(--font-sans)' }}
              />
              <Tooltip content={<CumulativeTooltip />} />
              {visibleYears[2024] && (
                <Line
                  type="monotone"
                  dataKey="y2024"
                  name="2024"
                  stroke={YEAR_COLORS[2024]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: YEAR_COLORS[2024], strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              )}
              {visibleYears[2025] && (
                <Line
                  type="monotone"
                  dataKey="y2025"
                  name="2025"
                  stroke={YEAR_COLORS[2025]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: YEAR_COLORS[2025], strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              )}
              {visibleYears[2026] && (
                <Line
                  type="monotone"
                  dataKey="y2026"
                  name="2026"
                  stroke={YEAR_COLORS[2026]}
                  strokeWidth={2.3}
                  dot={false}
                  activeDot={{ r: 4.5, fill: YEAR_COLORS[2026], strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Карточка: Индекс просмотра сквозь год */}
      <div className="rounded-2xl bg-card border border-line p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
          <div>
            <h3 className="text-base font-bold tracking-tight text-white">
              Индекс просмотра сквозь {activeTrajectoryYear} год
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Изменение соотношения «фильмы / прошедший день года» с ориентиром 1.0 (темп 1 фильм в день)
            </p>
          </div>
          <div className="inline-flex items-center gap-2 text-[11px] tabular-nums text-[#d6b85a] bg-[#d6b85a]/10 border border-[#d6b85a]/25 px-3 py-1 rounded-lg self-start sm:self-auto">
            <span className="w-4 border-t-2 border-dashed border-[#d6b85a]" />
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
              <CartesianGrid stroke="rgba(30, 36, 56, 0.75)" vertical={false} />
              <XAxis
                dataKey="label"
                minTickGap={34}
                stroke="#1e2438"
                tick={{ fill: '#7c86a2', fontSize: 11, fontFamily: 'var(--font-sans)' }}
              />
              <YAxis
                domain={[0, (dataMax: number) => Math.max(1.15, +(dataMax + 0.1).toFixed(2))]}
                tickFormatter={(v: number) => v.toFixed(2)}
                stroke="#1e2438"
                tick={{ fill: '#7c86a2', fontSize: 11, fontFamily: 'var(--font-sans)' }}
              />
              <Tooltip content={<TrajectoryTooltip />} />
              <ReferenceLine
                y={1.0}
                stroke="rgba(214, 184, 90, 0.75)"
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
