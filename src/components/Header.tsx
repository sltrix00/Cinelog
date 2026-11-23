import { Clapperboard, LogIn, Plus, Upload, UserCheck } from 'lucide-react';
import type { YearFilter } from '../types/cinelog';

interface HeaderProps {
  selectedYear: YearFilter;
  availableYears?: number[];
  onSelectYear: (year: YearFilter) => void;
  onOpenAddModal: () => void;
  onOpenImportModal: () => void;
  onOpenAuthModal: () => void;
  onLogoClick?: () => void;
  isDemoMode: boolean;
  userEmail: string | null;
}

const DEFAULT_YEARS = [2024, 2025, 2026];

const NAV_ITEMS = [
  { href: '#level-1', label: 'KPI' },
  { href: '#level-2', label: 'Динамика' },
  { href: '#level-3', label: 'Ритм' },
  { href: '#level-4', label: 'Аналитика' },
  { href: '#journal', label: 'Журнал' },
];

export function Header({
  selectedYear,
  availableYears = DEFAULT_YEARS,
  onSelectYear,
  onOpenAddModal,
  onOpenImportModal,
  onOpenAuthModal,
  onLogoClick,
  isDemoMode,
  userEmail,
}: HeaderProps) {
  const sortedYears = [...availableYears].sort((a, b) => a - b);
  const useCompactOverflow = sortedYears.length > 5;
  const olderYears = useCompactOverflow ? sortedYears.slice(0, -3) : [];
  const pillYears = useCompactOverflow ? sortedYears.slice(-3) : sortedYears;
  const selectedIsOlderYear =
    typeof selectedYear === 'number' && olderYears.includes(selectedYear);
  const logoContent = (
    <>
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#f06292]/20 via-[#45d1c6]/15 to-[#d6b85a]/20 border border-lineStrong flex items-center justify-center">
        <Clapperboard className="w-4 h-4 text-[#f06292]" />
      </div>
      <div className="text-left">
        <div className="flex items-center gap-2">
          <span className="text-base sm:text-lg font-bold tracking-tight text-white">CINELOG</span>
          <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-[#45d1c6]" />
          {isDemoMode && (
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#45d1c6]/10 text-[#45d1c6] border border-[#45d1c6]/25">
              DEMO
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-400 leading-none mt-0.5">Персональная аналитика кино</p>
      </div>
    </>
  );

  return (
    <header className="sticky top-0 z-40 bg-canvas/85 backdrop-blur-md border-b border-line">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 py-3.5">
          {/* Logo & Subtitle */}
          {onLogoClick ? (
            <button
              type="button"
              onClick={onLogoClick}
              title="На главную страницу"
              className="flex items-center gap-3 cursor-pointer hover:opacity-90 transition-opacity"
            >
              {logoContent}
            </button>
          ) : (
            <div className="flex items-center gap-3">{logoContent}</div>
          )}

          {/* Navigation Pills (Desktop) */}
          <nav className="hidden xl:flex items-center gap-1 p-1 rounded-xl bg-card border border-line">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-cardElevated transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Right Controls: Year Switcher + Import + Account + Add Watch */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Year Switcher */}
            <div
              className="inline-flex items-center p-1 rounded-xl bg-card border border-line"
              role="group"
              aria-label="Выбор года"
            >
              {useCompactOverflow && (
                <select
                  aria-label="Выбрать более ранний год"
                  value={selectedIsOlderYear ? String(selectedYear) : ''}
                  onChange={(e) => {
                    const yr = Number.parseInt(e.target.value, 10);
                    if (!Number.isNaN(yr)) onSelectYear(yr);
                  }}
                  className={
                    selectedIsOlderYear
                      ? 'px-2 py-1 rounded-lg text-xs font-medium tabular-nums bg-cardElevated text-white border border-lineStrong shadow-sm transition-all cursor-pointer focus:outline-none'
                      : 'px-2 py-1 rounded-lg text-xs font-medium tabular-nums bg-transparent text-slate-400 hover:text-slate-200 transition-all cursor-pointer focus:outline-none'
                  }
                >
                  <option value="" disabled className="bg-card text-slate-400">
                    Ранее
                  </option>
                  {olderYears.map((yr) => (
                    <option key={yr} value={yr} className="bg-card text-slate-100">
                      {yr}
                    </option>
                  ))}
                </select>
              )}
              {pillYears.map((yr) => {
                const active = selectedYear === yr;
                return (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => onSelectYear(yr)}
                    className={
                      active
                        ? 'px-2.5 py-1 rounded-lg text-xs font-medium tabular-nums bg-cardElevated text-white border border-lineStrong shadow-sm transition-all cursor-pointer'
                        : 'px-2.5 py-1 rounded-lg text-xs font-medium tabular-nums text-slate-400 hover:text-slate-200 transition-all cursor-pointer'
                    }
                  >
                    {yr}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => onSelectYear('all')}
                className={
                  selectedYear === 'all'
                    ? 'px-2.5 py-1 rounded-lg text-xs font-medium tabular-nums bg-cardElevated text-white border border-lineStrong shadow-sm transition-all cursor-pointer'
                    : 'px-2.5 py-1 rounded-lg text-xs font-medium tabular-nums text-slate-400 hover:text-slate-200 transition-all cursor-pointer'
                }
              >
                Все
              </button>
            </div>

            {/* CSV Import Button */}
            <button
              type="button"
              onClick={onOpenImportModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card hover:bg-cardElevated border border-line hover:border-lineStrong text-xs font-medium text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Импорт CSV (Letterboxd / IMDb) или .txt"
            >
              <Upload className="w-3.5 h-3.5 text-[#45d1c6]" />
              <span className="hidden sm:inline">Импорт CSV</span>
            </button>

            {/* Auth / Demo Switcher Button */}
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card hover:bg-cardElevated border border-line hover:border-lineStrong text-xs font-medium text-slate-300 hover:text-white transition-all cursor-pointer"
              title={userEmail ? `Аккаунт: ${userEmail}` : 'Войти или настроить Supabase'}
            >
              {userEmail ? (
                <>
                  <UserCheck className="w-3.5 h-3.5 text-[#45d1c6]" />
                  <span className="hidden md:inline max-w-[110px] truncate text-[11px]">
                    {userEmail.split('@')[0]}
                  </span>
                </>
              ) : (
                <>
                  <LogIn className="w-3.5 h-3.5 text-[#d6b85a]" />
                  <span className="hidden md:inline">Войти</span>
                </>
              )}
            </button>

            {/* Add Watch Button */}
            <button
              type="button"
              onClick={onOpenAddModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#f06292] hover:bg-[#f47ba4] active:scale-[0.98] text-[#0b0e17] font-semibold text-xs transition-all shadow-lg shadow-[#f06292]/20 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Добавить просмотр</span>
            </button>
          </div>
        </div>

        {/* Mobile / Tablet Navigation */}
        <nav className="flex xl:hidden items-center gap-1.5 pb-3 overflow-x-auto">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-card border border-line text-slate-300 hover:text-white"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
