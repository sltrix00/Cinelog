import { useEffect, useRef, useState } from 'react';
import { Calendar, Film, Gauge, Info } from 'lucide-react';
import { filmWord, rewatchWord } from '../lib/analytics';
import { getYearColor } from '../lib/demoData';
import type { Tier1KPIResult, YearFilter } from '../types/cinelog';

interface Tier1KpiSectionProps {
  kpis: Tier1KPIResult;
  selectedYear: YearFilter;
}

export function Tier1KpiSection({ kpis, selectedYear }: Tier1KpiSectionProps) {
  const [uniqueInfoOpen, setUniqueInfoOpen] = useState(false);
  const [rewatchInfoOpen, setRewatchInfoOpen] = useState(false);
  const uniqueInfoRef = useRef<HTMLDivElement>(null);
  const rewatchInfoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!uniqueInfoOpen && !rewatchInfoOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        uniqueInfoOpen &&
        uniqueInfoRef.current &&
        !uniqueInfoRef.current.contains(e.target as Node)
      ) {
        setUniqueInfoOpen(false);
      }
      if (
        rewatchInfoOpen &&
        rewatchInfoRef.current &&
        !rewatchInfoRef.current.contains(e.target as Node)
      ) {
        setRewatchInfoOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setUniqueInfoOpen(false);
        setRewatchInfoOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [uniqueInfoOpen, rewatchInfoOpen]);

  const yearLabel = selectedYear === 'all' ? 'За всё время' : `За ${selectedYear} год`;
  const yearDotColor = selectedYear === 'all' ? '#45d1c6' : getYearColor(selectedYear);

  const repeatInJournal = Math.max(0, kpis.allTimeTotal - kpis.allTimeUnique);
  const uniqueVsNewDiff = kpis.allTimeUnique - kpis.allTimeNewCount;

  return (
    <section id="level-1" className="scroll-mt-24 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xs tabular-nums uppercase tracking-widest text-slate-400">Уровень 01</span>
        <span className="text-slate-600" aria-hidden="true">/</span>
        <h2 className="text-sm font-bold tracking-tight text-slate-200">KPI и индекс просмотра</h2>
      </div>

      {/* 4 Main Counter Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* 1. Всего просмотрено */}
        <div className="rounded-2xl bg-card border border-line p-5 flex flex-col justify-between relative">
          <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
            <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-[#45d1c6]/10 blur-2xl" />
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Всего просмотрено</span>
            <span className="p-1.5 rounded-lg bg-cardElevated border border-line text-slate-400">
              <Film className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold tracking-tight text-white tabular-nums">
              {kpis.allTimeUnique}
            </span>
            <div ref={uniqueInfoRef} className="relative group inline-flex items-center">
              <button
                type="button"
                onClick={() => setUniqueInfoOpen((v) => !v)}
                aria-expanded={uniqueInfoOpen}
                aria-label="Что означает «уникальных»"
                className="inline-flex items-center gap-1 min-h-8 px-1.5 py-1 rounded-lg text-xs text-slate-300 hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
              >
                <span className="underline decoration-dotted underline-offset-4 decoration-slate-400">
                  уникальных
                </span>
                <Info className="w-3.5 h-3.5 text-[#45d1c6]" aria-hidden="true" />
              </button>

              {/* Tooltip / Popover explaining unique count vs first watches */}
              <div
                role="region"
                aria-label="Пояснение подсчёта уникальных фильмов"
                className={`absolute left-0 top-full mt-2 w-72 sm:w-80 p-3.5 rounded-xl bg-[#0b0e17] border border-lineStrong shadow-2xl z-30 text-xs leading-relaxed text-slate-300 transition-opacity duration-150 ${
                  uniqueInfoOpen
                    ? 'opacity-100 pointer-events-auto'
                    : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto'
                }`}
              >
                <div className="font-semibold text-white mb-1.5 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-[#45d1c6] shrink-0" aria-hidden="true" />
                  <span>Что считается уникальными фильмами</span>
                </div>
                <p className="text-slate-300">
                  Это количество разных фильмов в журнале:{' '}
                  <span className="font-semibold text-white tabular-nums">{kpis.allTimeUnique}</span>{' '}
                  из{' '}
                  <span className="font-semibold text-white tabular-nums">{kpis.allTimeTotal}</span>{' '}
                  просмотров
                  {repeatInJournal > 0
                    ? ` (${repeatInJournal} повторных записей тех же фильмов внутри архива)`
                    : ''}
                  .
                </p>
                {kpis.allTimeRewatches > 0 && uniqueVsNewDiff > 0 && (
                  <p className="mt-2 pt-2 border-t border-line text-slate-400">
                    Поэтому{' '}
                    <span className="text-slate-200 font-medium tabular-nums">
                      {kpis.allTimeUnique}
                    </span>{' '}
                    уникальных фильмов ≠{' '}
                    <span className="text-slate-200 font-medium tabular-nums">
                      {kpis.allTimeNewCount}
                    </span>{' '}
                    первых просмотров (без флага пересмотра ↺) — разница{' '}
                    <span className="text-[#45d1c6] font-medium tabular-nums">
                      {kpis.allTimeUnique} − {kpis.allTimeNewCount} = {uniqueVsNewDiff}
                    </span>{' '}
                    (плюс/минус многократные пересмотры) означает фильмы, которые ты пересмотрел
                    уже в рамках этого архива, но впервые видел ещё до него.
                  </p>
                )}
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-4 pt-3 border-t border-line/80 tabular-nums">
            всего {kpis.allTimeTotal} просмотров (с учётом пересмотров)
          </p>
        </div>

        {/* 2. За год + интерактивный бейдж пересмотров с поповером */}
        <div className="rounded-2xl bg-card border border-line p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">{yearLabel}</span>
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: yearDotColor }}
              aria-hidden="true"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-4xl font-extrabold tracking-tight text-white tabular-nums">
              {kpis.yearTotal}
            </span>
            <div ref={rewatchInfoRef} className="relative group">
              <button
                type="button"
                onClick={() => setRewatchInfoOpen((v) => !v)}
                aria-expanded={rewatchInfoOpen}
                aria-label={`Последние пересмотры: ${kpis.yearRewatches}`}
                className={
                  kpis.yearRewatches > 0
                    ? 'inline-flex items-center gap-1 min-h-8 px-2.5 py-1 rounded-full text-xs tabular-nums font-medium bg-[#d6b85a]/10 text-[#d6b85a] border border-[#d6b85a]/30 cursor-pointer transition-colors hover:bg-[#d6b85a]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b85a]'
                    : 'inline-flex items-center gap-1 min-h-8 px-2.5 py-1 rounded-full text-xs tabular-nums font-medium bg-cardElevated text-slate-300 border border-line cursor-pointer hover:border-lineStrong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]'
                }
              >
                ↺ {kpis.yearRewatches} {rewatchWord(kpis.yearRewatches)}
              </button>

              {/* Accessible Tooltip / Popover with recent rewatches */}
              <div
                role="region"
                aria-label="Последние пересмотры"
                className={`transition-opacity duration-150 absolute left-0 sm:left-auto sm:right-0 bottom-full mb-2 w-64 p-3.5 rounded-xl bg-[#0b0e17] border border-lineStrong shadow-2xl z-30 text-xs ${
                  rewatchInfoOpen
                    ? 'opacity-100 pointer-events-auto'
                    : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto'
                }`}
              >
                <div className="font-semibold text-slate-200 mb-2 flex items-center justify-between">
                  <span>Последние пересмотры</span>
                  <span className="tabular-nums text-[#d6b85a]">{kpis.yearRewatchPct}%</span>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  {kpis.recentRewatches.length > 0 ? (
                    kpis.recentRewatches.map((r) => (
                      <li key={r.id} className="flex justify-between gap-2">
                        <span className="truncate text-slate-200">{r.title}</span>
                        <span className="tabular-nums text-slate-400 shrink-0">{r.dateLabel}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-slate-400">Нет пересмотров</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-4 pt-3 border-t border-line/80 tabular-nums">
            Новых фильмов: {kpis.yearNewCount}
          </p>
        </div>

        {/* 3. За месяц + бейдж пересмотров */}
        <div className="rounded-2xl bg-card border border-line p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">{kpis.activeMonthLabel}</span>
            <Calendar className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-4xl font-extrabold tracking-tight text-white tabular-nums">
              {kpis.monthTotal}
            </span>
            <span
              className={
                kpis.monthRewatches > 0
                  ? 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs tabular-nums font-medium bg-[#d6b85a]/10 text-[#d6b85a] border border-[#d6b85a]/30'
                  : 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs tabular-nums font-medium bg-cardElevated text-slate-300 border border-line'
              }
            >
              ↺ {kpis.monthRewatches} {rewatchWord(kpis.monthRewatches)}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-4 pt-3 border-t border-line/80">
            {kpis.activeMonthSubtitle}
          </p>
        </div>

        {/* 4. За неделю + бейдж пересмотров */}
        <div className="rounded-2xl bg-card border border-line p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">За неделю</span>
            <span className="text-xs tabular-nums text-slate-400">7 дней</span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-4xl font-extrabold tracking-tight text-white tabular-nums">
              {kpis.weekTotal}
            </span>
            <span
              className={
                kpis.weekRewatches > 0
                  ? 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs tabular-nums font-medium bg-[#d6b85a]/10 text-[#d6b85a] border border-[#d6b85a]/30'
                  : 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs tabular-nums font-medium bg-cardElevated text-slate-300 border border-line'
              }
            >
              ↺ {kpis.weekRewatches} {rewatchWord(kpis.weekRewatches)}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-4 pt-3 border-t border-line/80">
            {kpis.weekRewatches === 0
              ? 'Без пересмотров за 7 дней'
              : `Включая ${kpis.weekRewatches} ${rewatchWord(kpis.weekRewatches)}`}
          </p>
        </div>
      </div>

      {/* 5. Выделенная карточка: Индекс просмотра */}
      <div className="rounded-2xl bg-gradient-to-r from-card via-cardElevated to-card border border-lineStrong p-5 sm:p-6 relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#f06292] via-[#45d1c6] to-[#d6b85a]" aria-hidden="true" />
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center pl-2">
          <div className="md:col-span-4 space-y-1">
            <div className="inline-flex items-center gap-2">
              <Gauge className="w-4 h-4 text-[#45d1c6]" aria-hidden="true" />
              <h3 className="text-sm font-bold tracking-tight text-white">Индекс просмотра</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Показывает средний темп просмотров в день. Значение{' '}
              <span className="tabular-nums text-slate-200">1.00</span> соответствует ровно 1 фильму в день с начала периода.
            </p>
          </div>

          <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Индекс за год */}
            <div className="rounded-xl bg-canvas/70 border border-line p-4 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  {selectedYear === 'all' ? 'Индекс за всё время' : 'Индекс за год'}
                </span>
                <div className="flex items-baseline gap-2.5 mt-1">
                  <span className="text-3xl font-extrabold tracking-tight text-[#f06292] tabular-nums">
                    {kpis.yearIndex.toFixed(2)}
                  </span>
                  <span className="text-xs text-slate-400">фильм/день</span>
                </div>
                <p className="text-xs tabular-nums text-slate-400 mt-1.5">
                  {kpis.yearTotal} {filmWord(kpis.yearTotal)} / {kpis.daysElapsedYear} дн.
                </p>
              </div>
              <div className="text-right hidden sm:block">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 block">
                  {kpis.yearProjection !== null ? 'Прогноз' : 'Итог'}
                </span>
                <span className="text-sm font-semibold text-slate-200 tabular-nums">
                  {kpis.yearProjection !== null ? `~${kpis.yearProjection}` : kpis.yearTotal}
                </span>
              </div>
            </div>

            {/* Индекс за месяц */}
            <div className="rounded-xl bg-canvas/70 border border-line p-4 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Индекс за месяц
                </span>
                <div className="flex items-baseline gap-2.5 mt-1">
                  <span className="text-3xl font-extrabold tracking-tight text-[#45d1c6] tabular-nums">
                    {kpis.monthIndex.toFixed(2)}
                  </span>
                  <span className="text-xs text-slate-400">фильм/день</span>
                </div>
                <p className="text-xs tabular-nums text-slate-400 mt-1.5">
                  {kpis.monthTotal} {filmWord(kpis.monthTotal)} / {kpis.monthDaysElapsed} дн.
                </p>
              </div>
              <div className="text-right hidden sm:block">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 block">Ритм</span>
                <span
                  className={
                    kpis.isMonthAboveYearPace
                      ? 'text-xs font-medium text-[#45d1c6]'
                      : 'text-xs font-medium text-[#d6b85a]'
                  }
                >
                  {kpis.isMonthAboveYearPace ? 'Выше года' : 'Ниже года'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
