import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, Clapperboard } from 'lucide-react';
import type { LegalTab } from './LegalModal';

interface LandingPageProps {
  onOpenRegister: () => void;
  onOpenLogin: () => void;
  onOpenDemo: () => void;
  onOpenLegal?: (tab: LegalTab) => void;
}

interface SloganItem {
  title: string;
  sub: string;
}

const SLOGANS: SloganItem[] = [
  {
    title: 'Как часто ты на самом деле смотришь кино?',
    sub: 'Твоя личная статистика, ритм просмотров и эволюция вкуса в одном чистом пространстве.',
  },
  {
    title: 'Знаешь ли ты свои настоящие кино-привычки?',
    sub: 'Узнай, в какие дни, часы и эпохи ты смотришь фильмы чаще всего — без догадок.',
  },
  {
    title: 'Твой кинодневник умеет больше, чем хранить оценки.',
    sub: 'Преврати историю просмотров в живые графики, тепловые карты и гонку год к году.',
  },
  {
    title: 'Letterboxd хранит списки. Cinelog показывает картину целиком.',
    sub: 'Перенеси свой дневник за пару кликов и открой цифры, которых нет на других платформах.',
  },
  {
    title: 'Сколько часов жизни ты провёл в кино — и что это было?',
    sub: 'Отслеживай свой темп за 365 дней, любимых режиссёров и баланс десятилетий.',
  },
];

const HEATMAP_SHADES = [
  'bg-[#1e2438]',
  'bg-[#1e2438]',
  'bg-[#45d1c6]/30',
  'bg-[#45d1c6]/60',
  'bg-[#f06292]/75',
  'bg-[#f06292]',
];

const HEATMAP_CELLS = Array.from({ length: 48 }, (_, i) => ({
  id: i,
  shade: HEATMAP_SHADES[(i * 7 + 3) % HEATMAP_SHADES.length],
}));

const WEEKDAY_BARS = [
  { label: 'Пн', heightClass: 'h-[22%]', colorClass: 'bg-[#1e2438]' },
  { label: 'Вт', heightClass: 'h-[30%]', colorClass: 'bg-[#1e2438]' },
  { label: 'Ср', heightClass: 'h-[45%]', colorClass: 'bg-[#45d1c6]/40' },
  { label: 'Чт', heightClass: 'h-[65%]', colorClass: 'bg-[#45d1c6]/70' },
  { label: 'Пт', heightClass: 'h-[85%]', colorClass: 'bg-[#f06292]/80' },
  { label: 'Сб', heightClass: 'h-[100%]', colorClass: 'bg-[#f06292]' },
  { label: 'Вс', heightClass: 'h-[75%]', colorClass: 'bg-[#d6b85a]' },
];

export function LandingPage({ onOpenRegister, onOpenLogin, onOpenDemo, onOpenLegal }: LandingPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sloganIndex, setSloganIndex] = useState(() => Math.floor(Math.random() * SLOGANS.length));
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isSloganPaused, setIsSloganPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setPrefersReducedMotion(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Rotate slogan every 12 seconds unless paused on hover/focus or prefers-reduced-motion is enabled
  useEffect(() => {
    if (prefersReducedMotion || isSloganPaused) return;

    let swapTimeoutId: number | undefined;
    const intervalId = window.setInterval(() => {
      setIsFadingOut(true);
      swapTimeoutId = window.setTimeout(() => {
        setSloganIndex((prev) => (prev + 1) % SLOGANS.length);
        setIsFadingOut(false);
      }, 650);
    }, 12000);

    return () => {
      window.clearInterval(intervalId);
      if (swapTimeoutId !== undefined) {
        window.clearTimeout(swapTimeoutId);
      }
    };
  }, [prefersReducedMotion, isSloganPaused]);

  // Scroll-reveal via IntersectionObserver
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const targets = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (targets.length === 0) return;

    if (typeof IntersectionObserver === 'undefined') {
      targets.forEach((el) => el.classList.add('visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    targets.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, []);

  const currentSlogan = SLOGANS[sloganIndex];

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-canvas text-slate-100 overflow-x-hidden antialiased"
    >
      {/* Full-Viewport First Screen (Header + Hero + Bottom Scroll Hint) */}
      <div className="relative min-h-[100dvh] w-full flex flex-col justify-between overflow-hidden border-b border-line">
        {/* Atmospheric Background Layers */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="landing-hero-grid absolute inset-0" />
          <div className="absolute -top-32 left-[18%] w-[680px] h-[440px] rounded-full bg-[#f06292]/12 blur-[130px]" />
          <div className="absolute top-[25%] right-[10%] w-[560px] h-[400px] rounded-full bg-[#45d1c6]/10 blur-[130px]" />
          <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-[520px] h-[220px] rounded-full bg-[#d6b85a]/8 blur-[120px]" />
        </div>

        {/* Minimalist Top Bar (Unified Brand Mark + Войти) */}
        <header className="relative z-20 w-full max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 pt-6 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#f06292] via-[#d6b85a] to-[#45d1c6] p-[1.5px]">
              <div className="w-full h-full rounded-[10.5px] bg-canvas flex items-center justify-center">
                <Clapperboard className="w-4 h-4 text-[#f06292]" aria-hidden="true" />
              </div>
            </div>
            <span className="text-lg sm:text-xl font-bold tracking-tight text-white">CINELOG</span>
          </div>

          <button
            type="button"
            onClick={onOpenLogin}
            className="min-h-10 px-4 sm:px-5 py-2 rounded-xl bg-cardElevated/90 hover:bg-line text-slate-100 border border-lineStrong text-xs sm:text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
          >
            Войти
          </button>
        </header>

        {/* Hero Main Content */}
        <main className="relative z-10 flex-1 flex flex-col justify-center w-full max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-6 sm:py-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 xl:gap-16 items-center">
            {/* Left: Rotating Slogan (pauses on hover/focus or reduced motion) */}
            <div
              className="lg:col-span-6 text-left"
              onMouseEnter={() => setIsSloganPaused(true)}
              onMouseLeave={() => setIsSloganPaused(false)}
              onFocus={() => setIsSloganPaused(true)}
              onBlur={() => setIsSloganPaused(false)}
            >
              <div
                className={`min-h-[130px] sm:min-h-[180px] lg:min-h-[220px] flex flex-col justify-center transition-[opacity,transform] ${
                  isFadingOut
                    ? 'opacity-0 -translate-y-1 duration-[650ms] ease-in-out'
                    : 'opacity-100 translate-y-0 duration-[750ms] ease-[cubic-bezier(0.22,1,0.36,1)]'
                }`}
              >
                <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-[3.5rem] font-extrabold tracking-tight text-white leading-[1.1]">
                  {currentSlogan.title}
                </h1>
                <p className="mt-4 sm:mt-5 text-sm sm:text-lg lg:text-xl text-slate-300 leading-relaxed max-w-xl">
                  {currentSlogan.sub}
                </p>
              </div>
            </div>

            {/* Right: Full-Proportioned Mini Dashboard Preview */}
            <div className="lg:col-span-6">
              <div className="relative rounded-2xl bg-card/90 backdrop-blur-md border border-lineStrong p-4 sm:p-6 lg:p-7 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
                {/* Top Pink Hairline Sheen */}
                <div
                  className="pointer-events-none absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-[#f06292]/60 to-transparent"
                  aria-hidden="true"
                />

                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="text-xs text-slate-400">Накопительный темп · 365 дней</div>
                    <div className="text-base sm:text-xl lg:text-2xl font-bold font-mono tabular-nums text-white mt-0.5">
                      148 фильмов <span className="text-xs sm:text-sm font-normal text-[#45d1c6]">(+23 к 2025)</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs font-mono shrink-0 pt-1">
                    <span className="text-[#d6b85a]">● 24</span>
                    <span className="text-[#45d1c6]">● 25</span>
                    <span className="text-[#f06292]">● 26</span>
                  </div>
                </div>

                <svg viewBox="0 0 420 145" className="w-full h-24 sm:h-36 lg:h-48" fill="none" aria-hidden="true">
                  <defs>
                    <linearGradient id="landingPinkArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f06292" stopOpacity="0.24" />
                      <stop offset="100%" stopColor="#f06292" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <line x1="0" y1="30" x2="420" y2="30" stroke="#1e2438" strokeDasharray="3 3" />
                  <line x1="0" y1="74" x2="420" y2="74" stroke="#1e2438" strokeDasharray="3 3" />
                  <line x1="0" y1="122" x2="420" y2="122" stroke="#1e2438" />

                  {/* 2024 gold */}
                  <path
                    d="M 4 122 L 28 119 L 46 112 L 72 110 L 96 102 L 122 101 L 148 93 L 176 92 L 204 88 L 235 83 L 268 82 L 298 74 L 332 69 L 368 67 L 412 61"
                    stroke="#d6b85a"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    className="landing-draw-1"
                  />

                  {/* 2025 teal */}
                  <path
                    d="M 4 122 L 24 116 L 48 114 L 76 102 L 102 98 L 130 87 L 160 85 L 188 77 L 216 68 L 248 64 L 278 55 L 310 52 L 344 45 L 380 43 L 412 38"
                    stroke="#45d1c6"
                    strokeWidth="2.2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    className="landing-draw-2"
                  />

                  {/* 2026 pink area + line */}
                  <path
                    d="M 4 122 L 22 111 L 44 108 L 64 94 L 92 90 L 116 78 L 142 77 L 168 61 L 198 57 L 224 46 L 254 44 L 282 30 L 312 27 L 342 20 L 378 17 L 412 10 L 412 122 L 4 122 Z"
                    fill="url(#landingPinkArea)"
                  />
                  <path
                    d="M 4 122 L 22 111 L 44 108 L 64 94 L 92 90 L 116 78 L 142 77 L 168 61 L 198 57 L 224 46 L 254 44 L 282 30 L 312 27 L 342 20 L 378 17 L 412 10"
                    stroke="#f06292"
                    strokeWidth="2.8"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    className="landing-draw-3"
                  />

                  <circle cx="412" cy="61" r="3" fill="#d6b85a" />
                  <circle cx="412" cy="38" r="3.2" fill="#45d1c6" />
                  <circle cx="412" cy="10" r="4.5" fill="#f06292" />
                  <circle cx="412" cy="10" r="9" fill="#f06292" fillOpacity="0.25" />
                </svg>

                <div className="grid grid-cols-3 gap-2.5 sm:gap-3 mt-4 pt-3.5 border-t border-line text-center">
                  <div className="rounded-xl bg-cardElevated p-2.5 sm:p-3">
                    <div className="text-xs text-slate-400 leading-tight">Часов кино</div>
                    <div className="text-sm sm:text-base font-mono font-bold tabular-nums text-white mt-1">294 ч</div>
                  </div>
                  <div className="rounded-xl bg-cardElevated p-2.5 sm:p-3">
                    <div className="text-xs text-slate-400 leading-tight">Средняя за месяц</div>
                    <div className="text-sm sm:text-base font-mono font-bold tabular-nums text-[#d6b85a] mt-1 flex items-center justify-center gap-1">
                      <span>4.2 ★</span>
                      <span
                        className="inline-flex items-center text-xs text-[#45d1c6]"
                        title="+0.3 к прошлому месяцу"
                      >
                        ▲+0.3
                      </span>
                    </div>
                  </div>
                  <div className="rounded-xl bg-cardElevated p-2.5 sm:p-3">
                    <div className="text-xs text-slate-400 leading-tight">Пик ритма</div>
                    <div className="text-sm sm:text-base font-mono font-bold tabular-nums text-[#45d1c6] mt-1">
                      Сб 22:00
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Centered CTA Below the Two Columns */}
          <div className="mt-10 sm:mt-14 lg:mt-16 flex flex-col items-center gap-3 text-center">
            <button
              type="button"
              onClick={onOpenRegister}
              className="group inline-flex items-center gap-2.5 min-h-12 px-8 sm:px-10 py-3.5 sm:py-4 rounded-xl bg-[#f06292] hover:bg-[#f475a0] text-canvas font-semibold text-sm sm:text-base shadow-[0_0_35px_rgba(240,98,146,0.4)] hover:shadow-[0_0_48px_rgba(240,98,146,0.55)] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6] focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >
              <span>Начать вести кинодневник</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </button>
            <span className="text-xs sm:text-sm text-slate-400">Импорт истории с Letterboxd и IMDb в пару кликов</span>
          </div>
        </main>

        {/* Bottom Scroll Hint anchored to bottom edge of 100dvh */}
        <div className="relative z-10 pb-6 pt-2 flex justify-center">
          <a
            href="#compare"
            className="flex flex-col items-center gap-1.5 min-h-11 px-3 py-1 rounded-xl text-xs text-slate-400 hover:text-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
          >
            <span>Листай вниз, чтобы узнать больше</span>
            <ChevronDown className="w-4 h-4 animate-bounce" aria-hidden="true" />
          </a>
        </div>
      </div>

      {/* Section 1: Why Not IMDb or Letterboxd */}
      <section id="compare" className="max-w-6xl mx-auto px-5 sm:px-6 py-16 sm:py-20">
        <div data-reveal className="landing-reveal text-center max-w-2xl mx-auto mb-10 sm:mb-12">
          <div className="text-xs font-mono uppercase tracking-widest text-[#f06292] mb-2">
            Глубже обычных трекеров
          </div>
          <h2 className="text-2xl sm:text-4xl font-bold text-white">
            IMDb и Letterboxd показывают списки. Мы показываем тебя.
          </h2>
          <p className="mt-3 text-slate-400 text-sm sm:text-base">
            Обычные сервисы созданы для каталогов и соцсетей. Cinelog превращает твою историю в настоящую аналитическую
            панель.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div
            data-reveal
            className="landing-reveal landing-reveal-delay-1 rounded-2xl bg-card/60 border border-line p-6 sm:p-8"
          >
            <div className="flex items-center justify-between mb-6">
              <span className="text-sm font-semibold text-slate-300">IMDb / Letterboxd</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-line text-slate-300">Базовый учёт</span>
            </div>
            <ul className="space-y-4 text-sm text-slate-300">
              <li className="flex items-start gap-3">
                <span className="text-slate-400 mt-0.5" aria-hidden="true">✕</span>
                <span>Просто хронологический список оценок без динамики</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-slate-400 mt-0.5" aria-hidden="true">✕</span>
                <span>Не видно, в какие дни недели и часы ты смотришь кино чаще</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-slate-400 mt-0.5" aria-hidden="true">✕</span>
                <span>Нет сравнения темпа год к году на одном графике</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-slate-400 mt-0.5" aria-hidden="true">✕</span>
                <span>Поверхностная статистика (или платная подписка ради простых цифр)</span>
              </li>
            </ul>
          </div>

          <div
            data-reveal
            className="landing-reveal landing-reveal-delay-2 rounded-2xl bg-card border border-[#45d1c6]/40 p-6 sm:p-8 shadow-[0_0_40px_rgba(69,209,198,0.06)]"
          >
            <div className="flex items-center justify-between mb-6">
              <span className="text-sm font-bold text-white">Cinelog</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-[#45d1c6]/15 text-[#45d1c6] font-medium">
                Глубокая аналитика
              </span>
            </div>
            <ul className="space-y-4 text-sm text-slate-200">
              <li className="flex items-start gap-3">
                <span className="text-[#45d1c6] mt-0.5" aria-hidden="true">✓</span>
                <span>
                  <strong className="text-white">Гонка годов:</strong> накопительная кривая 365 дней — обгоняешь ли ты
                  себя прошлогоднего
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#45d1c6] mt-0.5" aria-hidden="true">✓</span>
                <span>
                  <strong className="text-white">Ритм жизни:</strong> тепловая карта года, пики по дням недели и
                  времени суток
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#45d1c6] mt-0.5" aria-hidden="true">✓</span>
                <span>
                  <strong className="text-white">Индекс просмотров и вкус:</strong> траектория активности, эпохи
                  релизов, жанры и режиссёры
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#45d1c6] mt-0.5" aria-hidden="true">✓</span>
                <span>
                  <strong className="text-white">Чистый интерфейс:</strong> никакой рекламы, ленты чужих рецензий и
                  лишнего шума
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Section 2: 2-Click Import */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 py-16 sm:py-20 border-t border-line">
        <div data-reveal className="landing-reveal grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-5">
            <div className="text-xs font-mono uppercase tracking-widest text-[#d6b85a] mb-2">Лёгкий переезд</div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Перенеси свой кинодневник в пару кликов</h2>
            <p className="mt-3 text-slate-400 text-sm sm:text-base leading-relaxed">
              Не нужно вбивать сотни фильмов вручную. Загрузи готовый экспорт из{' '}
              <strong className="text-slate-200">Letterboxd</strong> или{' '}
              <strong className="text-slate-200">IMDb</strong> — мы сами сопоставим фильмы, подтянем постеры, жанры,
              хронометраж и построим все графики.
            </p>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div
              data-reveal
              className="landing-reveal landing-reveal-delay-1 rounded-2xl bg-card border border-line p-5"
            >
              <div className="w-8 h-8 rounded-lg bg-cardElevated border border-lineStrong flex items-center justify-center font-mono text-xs font-bold text-[#d6b85a] mb-3">
                01
              </div>
              <div className="text-sm font-semibold text-white">Скачай CSV</div>
              <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                Экспортируй <code className="text-slate-300">ratings.csv</code> или{' '}
                <code className="text-slate-300">diary.csv</code> из настроек IMDb / Letterboxd.
              </p>
            </div>
            <div
              data-reveal
              className="landing-reveal landing-reveal-delay-2 rounded-2xl bg-card border border-line p-5"
            >
              <div className="w-8 h-8 rounded-lg bg-cardElevated border border-lineStrong flex items-center justify-center font-mono text-xs font-bold text-[#45d1c6] mb-3">
                02
              </div>
              <div className="text-sm font-semibold text-white">Перетащи файл</div>
              <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                Загрузи файл в Cinelog — система автоматически распознает формат.
              </p>
            </div>
            <div
              data-reveal
              className="landing-reveal landing-reveal-delay-3 rounded-2xl bg-card border border-line p-5"
            >
              <div className="w-8 h-8 rounded-lg bg-cardElevated border border-lineStrong flex items-center justify-center font-mono text-xs font-bold text-[#f06292] mb-3">
                03
              </div>
              <div className="text-sm font-semibold text-white">Готовые графики</div>
              <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                Все оценки, даты и метаданные сразу превратятся в живую аналитику.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Feature Showcase (3 cards on lg+, 4 cards on < lg) */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 py-16 sm:py-20 border-t border-line">
        <div data-reveal className="landing-reveal text-center max-w-2xl mx-auto mb-10 sm:mb-12">
          <div className="text-xs font-mono uppercase tracking-widest text-[#45d1c6] mb-2">Что внутри</div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Вся анатомия твоих просмотров</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Card 1: Heatmap */}
          <div
            data-reveal
            className="landing-reveal landing-reveal-delay-1 rounded-2xl bg-card border border-line p-6"
          >
            <div className="text-sm font-semibold text-white">Тепловая карта года</div>
            <p className="text-xs text-slate-400 mt-1 mb-4">Видно каждый кино-марафон и перерыв за 365 дней.</p>
            <div className="grid grid-cols-12 gap-1" aria-hidden="true">
              {HEATMAP_CELLS.map((cell) => (
                <div key={cell.id} className={`h-3.5 rounded-[3px] ${cell.shade}`} />
              ))}
            </div>
          </div>

          {/* Card 2: Time of day / weekday */}
          <div
            data-reveal
            className="landing-reveal landing-reveal-delay-2 rounded-2xl bg-card border border-line p-6"
          >
            <div className="text-sm font-semibold text-white">Ритм дня и недели</div>
            <p className="text-xs text-slate-400 mt-1 mb-4">Утренний ты зритель или ночной киноман по выходным.</p>
            <div className="flex items-end gap-2 h-20 pt-2" aria-hidden="true">
              {WEEKDAY_BARS.map((bar) => (
                <div key={bar.label} className={`flex-1 rounded-t ${bar.colorClass} ${bar.heightClass}`} />
              ))}
            </div>
            <div className="flex justify-between text-xs font-mono text-slate-400 mt-1.5">
              {WEEKDAY_BARS.map((bar) => (
                <span key={bar.label}>{bar.label}</span>
              ))}
            </div>
          </div>

          {/* Card 3: Viewing Index */}
          <div
            data-reveal
            className="landing-reveal landing-reveal-delay-3 rounded-2xl bg-card border border-line p-6"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-white">Индекс просмотров</div>
              <span className="text-xs font-mono font-bold text-[#45d1c6] bg-[#45d1c6]/10 px-2 py-0.5 rounded">
                1.24×
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 mb-3">
              Траектория твоего темпа относительно личной нормы (1.00).
            </p>
            <svg viewBox="0 0 260 88" className="w-full h-[88px]" fill="none" aria-hidden="true">
              <defs>
                <linearGradient id="landingIdxGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#45d1c6" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#45d1c6" stopOpacity="0" />
                </linearGradient>
              </defs>
              <line x1="0" y1="52" x2="260" y2="52" stroke="#2c3450" strokeDasharray="4 4" />
              <text x="2" y="48" fill="#94a3b8" fontSize="10" fontFamily="monospace">
                1.00
              </text>
              <path
                d="M 0 60 C 28 65, 48 44, 78 48 C 108 52, 130 34, 160 36 C 190 38, 215 20, 256 16 L 256 86 L 0 86 Z"
                fill="url(#landingIdxGrad)"
              />
              <path
                d="M 0 60 C 28 65, 48 44, 78 48 C 108 52, 130 34, 160 36 C 190 38, 215 20, 256 16"
                stroke="#45d1c6"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <circle cx="256" cy="16" r="3.5" fill="#45d1c6" />
            </svg>
          </div>

          {/* Card 4: Eras & Taste (shown only on < lg for a balanced 4-card grid) */}
          <div
            data-reveal
            className="landing-reveal landing-reveal-delay-3 block lg:hidden rounded-2xl bg-card border border-line p-6"
          >
            <div className="text-sm font-semibold text-white">Эпохи и акценты вкуса</div>
            <p className="text-xs text-slate-400 mt-1 mb-4">Какие десятилетия, жанры и режиссёры преобладают.</p>
            <div className="space-y-2.5 mt-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">2020-е</span>
                  <span className="font-mono text-[#f06292]">44%</span>
                </div>
                <div className="h-1.5 rounded-full bg-line overflow-hidden">
                  <div className="h-full w-[44%] bg-[#f06292] rounded-full" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">2010-е</span>
                  <span className="font-mono text-[#45d1c6]">31%</span>
                </div>
                <div className="h-1.5 rounded-full bg-line overflow-hidden">
                  <div className="h-full w-[31%] bg-[#45d1c6] rounded-full" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Классика (&lt;2000)</span>
                  <span className="font-mono text-[#d6b85a]">25%</span>
                </div>
                <div className="h-1.5 rounded-full bg-line overflow-hidden">
                  <div className="h-full w-[25%] bg-[#d6b85a] rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Final CTA */}
      <section className="max-w-4xl mx-auto px-5 sm:px-6 py-20 sm:py-24 text-center border-t border-line">
        <div data-reveal className="landing-reveal">
          <h2 className="text-2xl sm:text-4xl font-bold text-white">Готов увидеть свою историю в цифрах?</h2>
          <p className="mt-3 text-slate-400 text-sm sm:text-base max-w-xl mx-auto">
            Создай аккаунт за 10 секунд или перенеси оценки из Letterboxd / IMDb.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={onOpenRegister}
              className="min-h-12 px-8 py-3.5 rounded-xl bg-[#f06292] hover:bg-[#f475a0] text-canvas font-semibold text-sm sm:text-base shadow-[0_0_30px_rgba(240,98,146,0.35)] hover:shadow-[0_0_40px_rgba(240,98,146,0.5)] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6] focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >
              Зарегистрироваться бесплатно
            </button>
            <button
              type="button"
              onClick={onOpenDemo}
              className="min-h-12 px-6 py-3.5 rounded-xl bg-card hover:bg-cardElevated text-slate-200 border border-lineStrong font-medium text-sm transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
            >
              Посмотреть демо-дашборд
            </button>
          </div>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="max-w-6xl mx-auto px-5 sm:px-6 pt-6 pb-10 border-t border-line flex flex-col gap-3 text-xs text-slate-400">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold tracking-wider text-slate-200">CINELOG</span>
            <span aria-hidden="true">·</span>
            <span>Персональная аналитика кино (React + Supabase + TMDB)</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
            {onOpenLegal ? (
              <>
                <button
                  type="button"
                  onClick={() => onOpenLegal('privacy')}
                  className="min-h-9 px-1 text-slate-300 hover:text-white transition-colors cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
                >
                  Политика конфиденциальности
                </button>
                <button
                  type="button"
                  onClick={() => onOpenLegal('terms')}
                  className="min-h-9 px-1 text-slate-300 hover:text-white transition-colors cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
                >
                  Условия и TMDB
                </button>
              </>
            ) : (
              <>
                <a
                  href="#privacy"
                  className="text-slate-300 hover:text-white transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
                >
                  Политика конфиденциальности
                </a>
                <a
                  href="#terms"
                  className="text-slate-300 hover:text-white transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
                >
                  Условия и TMDB
                </a>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
          <span>
            This product uses the{' '}
            <a
              href="https://www.themoviedb.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#45d1c6] hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
            >
              TMDB API
            </a>{' '}
            but is not endorsed or certified by TMDB.
          </span>
          <span className="font-mono">Твой личный кинодневник</span>
        </div>
      </footer>
    </div>
  );
}
