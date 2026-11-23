import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
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
  const [highlightedIdx, setHighlightedIdx] = useState(0);
  const yearMenuRef = useRef<HTMLDivElement>(null);
  const yearTriggerRef = useRef<HTMLButtonElement>(null);
  const yearListboxRef = useRef<HTMLDivElement>(null);

  const sortedYearsDesc = sortYearsDesc(availableYears);
  const options: YearFilter[] = ['all', ...sortedYearsDesc];

  useEffect(() => {
    if (!yearMenuOpen) return;

    const currentIdx = options.indexOf(selectedYear);
    setHighlightedIdx(currentIdx >= 0 ? currentIdx : 0);

    const rafId = window.requestAnimationFrame(() => {
      yearListboxRef.current?.focus();
    });

    const handleOutside = (e: MouseEvent) => {
      if (yearMenuRef.current && !yearMenuRef.current.contains(e.target as Node)) {
        setYearMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setYearMenuOpen(false);
        yearTriggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      window.cancelAnimationFrame(rafId);
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [yearMenuOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectOption = (val: YearFilter) => {
    onSelectYear(val);
    setYearMenuOpen(false);
    yearTriggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setYearMenuOpen(true);
    }
  };

  const handleListboxKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIdx((prev) => (prev + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIdx((prev) => (prev - 1 + options.length) % options.length);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setHighlightedIdx(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setHighlightedIdx(options.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const target = options[highlightedIdx];
      if (target !== undefined) handleSelectOption(target);
    } else if (e.key === 'Tab') {
      setYearMenuOpen(false);
    }
  };

  const activeDotColor = selectedYear === 'all' ? '#45d1c6' : getYearColor(selectedYear);
  const accountLabel = formatAccountButtonLabel(userEmail, userNickname);
  const accountTitle = userEmail
    ? userNickname?.trim()
      ? `Профиль · ${userNickname.trim()}`
      : 'Открыть профиль'
    : 'Войти или зарегистрироваться';

  const logoContent = (
    <>
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#f06292] via-[#d6b85a] to-[#45d1c6] p-[1.5px] shrink-0">
        <div className="w-full h-full rounded-[10.5px] bg-canvas flex items-center justify-center">
          <Clapperboard className="w-4 h-4 text-[#f06292]" aria-hidden="true" />
        </div>
      </div>
      <div className="text-left min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-base sm:text-lg font-bold tracking-tight text-white">CINELOG</span>
          <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-[#45d1c6]" aria-hidden="true" />
          {isDemoMode && (
            <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#45d1c6]/10 text-[#45d1c6] border border-[#45d1c6]/25">
              DEMO
            </span>
          )}
        </div>
        <p className="hidden sm:block text-xs text-slate-400 leading-none mt-0.5">
          Персональная аналитика кино
        </p>
      </div>
    </>
  );

  return (
    <header className="sticky top-0 z-40 bg-canvas/85 backdrop-blur-md border-b border-line">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 py-3">
          {/* Logo & Subtitle */}
          {onLogoClick ? (
            <button
              type="button"
              onClick={onLogoClick}
              title="На главную страницу"
              className="flex items-center gap-2.5 sm:gap-3 min-h-10 rounded-xl cursor-pointer hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
            >
              {logoContent}
            </button>
          ) : (
            <div className="flex items-center gap-2.5 sm:gap-3">{logoContent}</div>
          )}

          {/* Right Controls: Period Dropdown + Add Watch + Account */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Period / Year Dropdown */}
            <div ref={yearMenuRef} className="relative">
              <button
                ref={yearTriggerRef}
                type="button"
                aria-haspopup="listbox"
                aria-expanded={yearMenuOpen}
                aria-label="Выбор периода"
                onClick={() => setYearMenuOpen((prev) => !prev)}
                onKeyDown={handleTriggerKeyDown}
                className="inline-flex items-center gap-1.5 sm:gap-2 min-h-10 px-2.5 sm:px-3 py-2 rounded-xl bg-card hover:bg-cardElevated border border-line hover:border-lineStrong text-xs font-medium text-slate-200 hover:text-white transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: activeDotColor }}
                  aria-hidden="true"
                />
                <span className="tabular-nums">{formatYearFilterLabel(selectedYear)}</span>
                <ChevronDown
                  aria-hidden="true"
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
                    yearMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {yearMenuOpen && (
                <div
                  ref={yearListboxRef}
                  role="listbox"
                  tabIndex={0}
                  aria-label="Период статистики"
                  aria-activedescendant={`year-option-${String(options[highlightedIdx] ?? 'all')}`}
                  onKeyDown={handleListboxKeyDown}
                  className="absolute right-0 mt-1.5 min-w-[164px] py-1 rounded-xl bg-cardElevated border border-lineStrong shadow-2xl z-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
                >
                  <button
                    id="year-option-all"
                    type="button"
                    role="option"
                    aria-selected={selectedYear === 'all'}
                    onMouseEnter={() => setHighlightedIdx(0)}
                    onClick={() => handleSelectOption('all')}
                    className={`w-full min-h-10 px-3 py-2 text-left text-xs flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      selectedYear === 'all'
                        ? 'text-white font-semibold bg-white/10'
                        : highlightedIdx === 0
                          ? 'text-white bg-white/5'
                          : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: '#45d1c6' }}
                        aria-hidden="true"
                      />
                      <span>Все время</span>
                    </span>
                    {selectedYear === 'all' && (
                      <Check className="w-3.5 h-3.5 text-[#45d1c6] shrink-0" aria-hidden="true" />
                    )}
                  </button>

                  <div className="border-t border-line my-1" />

                  <div className="max-h-60 overflow-y-auto">
                    {sortedYearsDesc.map((yr, idx) => {
                      const optIdx = idx + 1;
                      const active = selectedYear === yr;
                      const focused = highlightedIdx === optIdx;
                      return (
                        <button
                          id={`year-option-${yr}`}
                          key={yr}
                          type="button"
                          role="option"
                          aria-selected={active}
                          onMouseEnter={() => setHighlightedIdx(optIdx)}
                          onClick={() => handleSelectOption(yr)}
                          className={`w-full min-h-10 px-3 py-2 text-left text-xs tabular-nums flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                            active
                              ? 'text-white font-semibold bg-white/10'
                              : focused
                                ? 'text-white bg-white/5'
                                : 'text-slate-300 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: getYearColor(yr) }}
                              aria-hidden="true"
                            />
                            <span>{yr}</span>
                          </span>
                          {active && (
                            <Check className="w-3.5 h-3.5 text-[#45d1c6] shrink-0" aria-hidden="true" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Add Watch Button */}
            <button
              type="button"
              onClick={onOpenAddModal}
              className="inline-flex items-center gap-1.5 min-h-10 px-3 sm:px-3.5 py-2 rounded-xl bg-[#f06292] hover:bg-[#f47ba4] active:scale-[0.98] text-[#0b0e17] font-semibold text-xs transition-all shadow-lg shadow-[#f06292]/20 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6] focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
              <span className="sm:hidden">Добавить</span>
              <span className="hidden sm:inline">Добавить просмотр</span>
            </button>

            {/* Account / Profile Button */}
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="inline-flex items-center gap-1.5 min-h-10 px-2.5 sm:px-3 py-2 rounded-xl bg-card hover:bg-cardElevated border border-line hover:border-lineStrong text-xs font-medium text-slate-200 hover:text-white transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
              title={accountTitle}
              aria-label={accountTitle}
            >
              {userEmail ? (
                <>
                  <CircleUserRound className="w-4 h-4 text-[#45d1c6] shrink-0" aria-hidden="true" />
                  <span className="max-w-[90px] sm:max-w-[130px] truncate">{accountLabel}</span>
                </>
              ) : (
                <>
                  <LogIn className="w-3.5 h-3.5 text-[#d6b85a] shrink-0" aria-hidden="true" />
                  <span className="hidden xs:inline sm:inline">{accountLabel}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
