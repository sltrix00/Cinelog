import { useEffect, useState } from 'react';

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

  return (
    <nav
      aria-label="Навигация по разделам"
      className="group/rail fixed left-2 sm:left-3.5 lg:left-5 top-1/2 -translate-y-1/2 z-30 flex flex-col items-start gap-1.5 py-1.5"
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
            className="group/item w-6 h-6 flex items-center justify-center relative rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
          >
            <span
              className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                isActive
                  ? 'bg-slate-100 scale-110 shadow-[0_0_8px_rgba(241,245,249,0.4)]'
                  : 'bg-slate-600/60 group-hover/item:bg-slate-300 group-hover/item:scale-110'
              }`}
            />
            <span className="absolute left-full top-1/2 -translate-y-1/2 pl-2.5 pointer-events-none opacity-0 -translate-x-1.5 transition-all duration-200 ease-out group-hover/rail:opacity-100 group-hover/rail:translate-x-0 group-hover/rail:pointer-events-auto group-focus-within/rail:opacity-100 group-focus-within/rail:translate-x-0 group-focus-within/rail:pointer-events-auto">
              <span
                className={`inline-block whitespace-nowrap px-2.5 py-1 rounded-lg text-xs font-medium border backdrop-blur-md shadow-lg transition-colors ${
                  isActive
                    ? 'bg-cardElevated/95 border-lineStrong text-white'
                    : 'bg-card/90 border-line text-slate-400 group-hover/item:text-white group-hover/item:bg-cardElevated/95 group-hover/item:border-lineStrong'
                }`}
              >
                {item.label}
              </span>
            </span>
          </a>
        );
      })}
    </nav>
  );
}
