export const SLOGAN_ROTATION_INTERVAL_MS = 12000;
export const SLOGAN_FADE_DURATION_MS = 650;

export interface LandingPaceYears {
  years: [number, number, number];
  previousYear: number;
  currentYear: number;
  comparisonText: string;
}

export function resolveLandingPaceYears(referenceDate: Date = new Date()): LandingPaceYears {
  const currentYear = Number.isNaN(referenceDate.getTime())
    ? new Date().getFullYear()
    : referenceDate.getFullYear();
  const previousYear = currentYear - 1;

  return {
    years: [currentYear - 2, previousYear, currentYear],
    previousYear,
    currentYear,
    comparisonText: `(+23 к ${previousYear})`,
  };
}

export function shouldSloganFadeOut(
  isFadingOut: boolean,
  isPaused: boolean,
  prefersReducedMotion: boolean
): boolean {
  return isFadingOut && !isPaused && !prefersReducedMotion;
}

export interface SloganRotatorState {
  index: number;
  isFadingOut: boolean;
  isPaused: boolean;
  prefersReducedMotion: boolean;
}

export interface SloganRotatorOptions {
  sloganCount: number;
  initialIndex?: number;
  intervalMs?: number;
  fadeDurationMs?: number;
  initialPaused?: boolean;
  initialReducedMotion?: boolean;
  onStateChange?: (state: SloganRotatorState) => void;
}

export interface SloganRotator {
  getState: () => SloganRotatorState;
  start: () => void;
  stop: () => void;
  setPaused: (paused: boolean) => void;
  setReducedMotion: (reduced: boolean) => void;
}

export function createSloganRotator(options: SloganRotatorOptions): SloganRotator {
  const sloganCount = Number.isFinite(options.sloganCount)
    ? Math.max(0, Math.floor(options.sloganCount))
    : 0;
  const rawIntervalMs =
    typeof options.intervalMs === 'number' &&
    Number.isFinite(options.intervalMs) &&
    options.intervalMs > 0
      ? Math.max(2, Math.floor(options.intervalMs))
      : SLOGAN_ROTATION_INTERVAL_MS;
  const intervalMs = rawIntervalMs;
  const rawFadeDurationMs =
    typeof options.fadeDurationMs === 'number' &&
    Number.isFinite(options.fadeDurationMs) &&
    options.fadeDurationMs > 0
      ? Math.max(1, Math.floor(options.fadeDurationMs))
      : SLOGAN_FADE_DURATION_MS;
  const fadeDurationMs = Math.min(rawFadeDurationMs, intervalMs - 1);

  const normalizedInitialIndex = Number.isFinite(options.initialIndex)
    ? Math.floor(options.initialIndex as number)
    : 0;
  let index =
    sloganCount > 0 ? ((normalizedInitialIndex % sloganCount) + sloganCount) % sloganCount : 0;
  let isFadingOut = false;
  let isPaused = Boolean(options.initialPaused);
  let prefersReducedMotion = Boolean(options.initialReducedMotion);
  let isRunning = false;
  let intervalId: ReturnType<typeof globalThis.setInterval> | undefined;
  let swapTimeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;

  const getState = (): SloganRotatorState => ({
    index,
    isFadingOut: shouldSloganFadeOut(isFadingOut, isPaused, prefersReducedMotion),
    isPaused,
    prefersReducedMotion,
  });

  const emit = () => {
    options.onStateChange?.(getState());
  };

  const clearTimers = () => {
    if (intervalId !== undefined) {
      globalThis.clearInterval(intervalId);
      intervalId = undefined;
    }
    if (swapTimeoutId !== undefined) {
      globalThis.clearTimeout(swapTimeoutId);
      swapTimeoutId = undefined;
    }
  };

  const scheduleCycle = () => {
    clearTimers();
    if (!isRunning || isPaused || prefersReducedMotion || sloganCount <= 1) {
      if (isFadingOut) {
        isFadingOut = false;
      }
      return;
    }

    intervalId = globalThis.setInterval(() => {
      if (!isRunning || isPaused || prefersReducedMotion) {
        return;
      }

      isFadingOut = true;
      emit();

      if (swapTimeoutId !== undefined) {
        globalThis.clearTimeout(swapTimeoutId);
      }

      swapTimeoutId = globalThis.setTimeout(() => {
        swapTimeoutId = undefined;
        if (!isRunning || isPaused || prefersReducedMotion) {
          isFadingOut = false;
          emit();
          return;
        }
        index = (index + 1) % sloganCount;
        isFadingOut = false;
        emit();
      }, fadeDurationMs);
    }, intervalMs);
  };

  return {
    getState,
    start() {
      isRunning = true;
      isFadingOut = false;
      scheduleCycle();
    },
    stop() {
      const wasFadingOut = isFadingOut;
      isRunning = false;
      clearTimers();
      isFadingOut = false;
      if (wasFadingOut) {
        emit();
      }
    },
    setPaused(paused: boolean) {
      const nextPaused = Boolean(paused);
      if (isPaused === nextPaused) return;
      isPaused = nextPaused;
      if (isPaused) {
        clearTimers();
        isFadingOut = false;
        emit();
      } else {
        isFadingOut = false;
        emit();
        if (isRunning) {
          scheduleCycle();
        }
      }
    },
    setReducedMotion(reduced: boolean) {
      const nextReduced = Boolean(reduced);
      if (prefersReducedMotion === nextReduced) return;
      prefersReducedMotion = nextReduced;
      if (prefersReducedMotion) {
        clearTimers();
        isFadingOut = false;
        emit();
      } else {
        isFadingOut = false;
        emit();
        if (isRunning) {
          scheduleCycle();
        }
      }
    },
  };
}
