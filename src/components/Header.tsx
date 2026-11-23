import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, CircleUserRound, Clapperboard, LogIn, Plus } from 'lucide-react';
import { getYearColor } from '../lib/demoData';
import {
  formatAccountButtonLabel,
  formatYearFilterLabel,
  sortYearsDesc,
} from '../lib/headerHelpers';
import type { YearFilter } from '../types/cinelog';

interface HeaderProps {
  selectedYear: YearFilter;
  availableYears?: number[];
  onSelectYear: (year: YearFilter) => void;
  onOpenAddModal: () => void;
  onOpenAuthModal: () => void;
  onLogoClick?: () => void;
  isDemoMode: boolean;
  userEmail: string | null;
  userNickname: string | null;
}

const DEFAULT_YEARS = [2024, 2025, 2026];

export function Header({
  selectedYear,
  availableYears = DEFAULT_YEARS,
  onSelectYear,
  onOpenAddModal,
  onOpenAuthModal,
  onLogoClick,
  isDemoMode,
  userEmail,
  userNickname,
}: HeaderProps) {
  const [yearMenuOpen, setYearMenuOpen] = useState(false);
  const yearMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!yearMenuOpen) return;

    const handleOutside = (e: MouseEvent) => {
      if (yearMenuRef.current && !yearMenuRef.current.contains(e.target as Node)) {
        setYearMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setYearMenuOpen(false);
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [yearMenuOpen]);

  const sortedYearsDesc = sortYearsDesc(availableYears);
  const activeDotColor = selectedYear === 'all' ? '#45d1c6' : getYearColor(selectedYear);
  const accountLabel = formatAccountButtonLabel(userEmail, userNickname);
  const accountTitle = userEmail
    ? userNickname?.trim()
      ? `${userNickname.trim()} (${userEmail})`
      : `Профиль (${userEmail})`
    : 'Войти или зарегистрироваться';

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

          {/* Right Controls: Period Dropdown + Add Watch + Account */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Period / Year Dropdown */}
            <div ref={yearMenuRef} className="relative">
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={yearMenuOpen}
                aria-label="Выбор периода"
                onClick={() => setYearMenuOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-card hover:bg-cardElevated border border-line hover:border-lineStrong text-xs font-medium text-slate-200 hover:text-white transition-all cursor-pointer"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: activeDotColor }}
                />
                <span className="tabular-nums">{formatYearFilterLabel(selectedYear)}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
                    yearMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {yearMenuOpen && (
                <div
                  role="listbox"
                  aria-label="Период статистики"
                  className="absolute right-0 mt-1.5 min-w-[152px] py-1 rounded-xl bg-cardElevated border border-lineStrong shadow-2xl z-50"
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={selectedYear === 'all'}
                    onClick={() => {
                      onSelectYear('all');
                      setYearMenuOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      selectedYear === 'all'
                        ? 'text-white font-semibold bg-white/5'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: '#45d1c6' }}
                      />
                      <span>Все время</span>
                    </span>
                    {selectedYear === 'all' && <Check className="w-3.5 h-3.5 text-[#45d1c6] shrink-0" />}
                  </button>

                  <div className="border-t border-line my-1" />

                  <div className="max-h-60 overflow-y-auto">
                    {sortedYearsDesc.map((yr) => {
                      const active = selectedYear === yr;
                      return (
                        <button
                          key={yr}
                          type="button"
                          role="option"
                          aria-selected={active}
                          onClick={() => {
                            onSelectYear(yr);
                            setYearMenuOpen(false);
                          }}
                          className={`w-full px-3 py-2 text-left text-xs tabular-nums flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                            active
                              ? 'text-white font-semibold bg-white/5'
                              : 'text-slate-300 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: getYearColor(yr) }}
                            />
                            <span>{yr}</span>
                          </span>
                          {active && <Check className="w-3.5 h-3.5 text-[#45d1c6] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Add Watch Button (left of Account) */}
            <button
              type="button"
              onClick={onOpenAddModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#f06292] hover:bg-[#f47ba4] active:scale-[0.98] text-[#0b0e17] font-semibold text-xs transition-all shadow-lg shadow-[#f06292]/20 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Добавить просмотр</span>
            </button>

            {/* Account / Profile Button (rightmost) */}
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card hover:bg-cardElevated border border-line hover:border-lineStrong text-xs font-medium text-slate-200 hover:text-white transition-all cursor-pointer"
              title={accountTitle}
            >
              {userEmail ? (
                <>
                  <CircleUserRound className="w-4 h-4 text-[#45d1c6] shrink-0" />
                  <span className="max-w-[130px] truncate">{accountLabel}</span>
                </>
              ) : (
                <>
                  <LogIn className="w-3.5 h-3.5 text-[#d6b85a] shrink-0" />
                  <span>{accountLabel}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
