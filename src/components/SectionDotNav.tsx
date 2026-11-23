import { useEffect, useRef, useState, type FocusEvent } from 'react';

export const DASHBOARD_SECTIONS = [
  { id: 'level-1', label: 'KPI' },
  { id: 'level-2', label: 'Динамика' },
  { id: 'level-3', label: 'Ритм' },
  { id: 'level-4', label: 'Аналитика' },
  { id: 'journal', label: 'Журнал' },
] as const;

type SectionId = (typeof DASHBOARD_SECTIONS)[number]['id'];

export function SectionDotNav() {
  const [activeId, setActiveId] = useState<SectionId>('level-1');
  const [isOpen, setIsOpen] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let rafId: number | null = null;

    const updateActiveSection = () => {
      rafId = null;
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 40) {
        setActiveId('journal');
        return;
      }

      let current: SectionId = 'level-1';
      for (const section of DASHBOARD_SECTIONS) {
        const el = document.getElementById(section.id);
        if (el && el.getBoundingClientRect().top <= 160) {
          current = section.id;
        }
      }
      setActiveId(current);
    };

    const scheduleUpdate = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(updateActiveSection);
    };

    updateActiveSection();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate, { passive: true });

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const handleOpen = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setIsOpen(true);
  };

  const handleScheduleClose = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setIsOpen(false);
    }, 120);
  };

  const handleBlur = (e: FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Desktop / Tablet Fixed Left Rail */}
      <nav
        aria-label="Навигация по разделам"
        onMouseEnter={handleOpen}
        onMouseLeave={handleScheduleClose}
        onFocus={handleOpen}
        onBlur={handleBlur}
        className={`fixed left-0 top-1/2 -translate-y-1/2 z-30 hidden md:flex items-center transition-[width,padding] duration-200 ease-out ${
          isOpen ? 'w-[168px] py-10 pl-2.5 pr-1.5' : 'w-16 py-12 pl-2.5 pr-2'
        }`}
      >
        <div
          className={`w-full flex flex-col rounded-2xl border transition-all duration-200 ease-out p-1.5 ${
            isOpen
              ? 'gap-1.5 bg-card/95 border-lineStrong/90 backdrop-blur-md shadow-xl'
              : 'gap-1 bg-card/55 border-line/70 backdrop-blur-sm shadow-md'
          }`}
        >
          {DASHBOARD_SECTIONS.map((item) => {
            const isActive = activeId === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                aria-label={item.label}
                aria-current={isActive ? 'location' : undefined}
                onClick={() => setActiveId(item.id)}
                className={`group/item flex items-center w-full px-2 rounded-xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6] ${
                  isOpen
                    ? `gap-3 h-11 ${
                        isActive
                          ? 'bg-white/[0.08] text-white'
                          : 'text-slate-300 hover:bg-white/[0.05] hover:text-white'
                      }`
                    : `gap-0 h-9 justify-center ${isActive ? 'bg-white/[0.05]' : 'hover:bg-white/[0.04]'}`
                }`}
              >
                <span className="w-3 h-3 flex items-center justify-center shrink-0">
                  <span
                    aria-hidden="true"
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                      isOpen
                        ? isActive
                          ? 'scale-125 opacity-100 bg-white shadow-[0_0_10px_rgba(241,245,249,0.55)]'
                          : 'scale-100 opacity-100 bg-slate-400 group-hover/item:scale-125 group-hover/item:bg-slate-200'
                        : isActive
                          ? 'scale-95 opacity-95 bg-[#45d1c6] shadow-[0_0_8px_rgba(69,209,198,0.45)]'
                          : 'scale-75 opacity-60 bg-slate-400 group-hover/item:opacity-90'
                    }`}
                  />
                </span>
                <span
                  className={`text-sm font-medium whitespace-nowrap leading-none transition-all duration-200 ${
                    isOpen
                      ? 'opacity-100 translate-x-0 pointer-events-auto'
                      : 'opacity-0 -translate-x-1.5 pointer-events-none select-none w-0 overflow-hidden'
                  }`}
                >
                  {item.label}
                </span>
              </a>
            );
          })}
        </div>
      </nav>

      {/* Mobile Non-Overlapping Inline Strip */}
      <nav
        aria-label="Навигация по разделам"
        className="flex md:hidden items-center gap-2 px-4 sm:px-6 pt-4 overflow-x-auto"
      >
        {DASHBOARD_SECTIONS.map((item) => {
          const isActive = activeId === item.id;
          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              aria-current={isActive ? 'location' : undefined}
              onClick={() => setActiveId(item.id)}
              className={`shrink-0 inline-flex items-center min-h-10 px-3.5 py-2 rounded-xl text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6] ${
                isActive
                  ? 'bg-cardElevated border-lineStrong text-white'
                  : 'bg-card border-line text-slate-300 hover:text-white'
              }`}
            >
              {item.label}
            </a>
          );
        })}
      </nav>
    </>
  );
}
