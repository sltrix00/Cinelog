import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSloganRotator,
  resolveLandingPaceYears,
  shouldSloganFadeOut,
  SLOGAN_FADE_DURATION_MS,
  SLOGAN_ROTATION_INTERVAL_MS,
} from './landingHelpers';

describe('resolveLandingPaceYears', () => {
  it('returns 4-digit consecutive years ending in 2026 and dynamic delta label', () => {
    expect(resolveLandingPaceYears(new Date(2026, 10, 27))).toEqual({
      years: [2024, 2025, 2026],
      previousYear: 2025,
      currentYear: 2026,
      comparisonText: '(+23 к 2025)',
    });
  });

  it('adapts cleanly to 2027 across the New Year boundary (Dec 31 2026 -> Jan 1 2027)', () => {
    expect(resolveLandingPaceYears(new Date(2026, 11, 31))).toEqual({
      years: [2024, 2025, 2026],
      previousYear: 2025,
      currentYear: 2026,
      comparisonText: '(+23 к 2025)',
    });

    expect(resolveLandingPaceYears(new Date(2027, 0, 1))).toEqual({
      years: [2025, 2026, 2027],
      previousYear: 2026,
      currentYear: 2027,
      comparisonText: '(+23 к 2026)',
    });
  });

  it('falls back to current year when given an invalid Date', () => {
    const expectedYear = new Date().getFullYear();
    expect(resolveLandingPaceYears(new Date('invalid-date'))).toEqual({
      years: [expectedYear - 2, expectedYear - 1, expectedYear],
      previousYear: expectedYear - 1,
      currentYear: expectedYear,
      comparisonText: `(+23 к ${expectedYear - 1})`,
    });
  });
});

describe('shouldSloganFadeOut', () => {
  it('only allows fading out when actively fading, unpaused, and reduced motion is off', () => {
    expect(shouldSloganFadeOut(true, false, false)).toBe(true);
    expect(shouldSloganFadeOut(false, false, false)).toBe(false);
    expect(shouldSloganFadeOut(true, true, false)).toBe(false);
    expect(shouldSloganFadeOut(true, false, true)).toBe(false);
    expect(shouldSloganFadeOut(true, true, true)).toBe(false);
  });
});

describe('createSloganRotator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('cycles through slogans on 12s interval -> 650ms fade-out -> swap', () => {
    const snapshots: Array<{ index: number; isFadingOut: boolean }> = [];
    const rotator = createSloganRotator({
      sloganCount: 3,
      initialIndex: 0,
      onStateChange: (state) => {
        snapshots.push({ index: state.index, isFadingOut: state.isFadingOut });
      },
    });

    rotator.start();
    expect(rotator.getState()).toMatchObject({ index: 0, isFadingOut: false });

    vi.advanceTimersByTime(SLOGAN_ROTATION_INTERVAL_MS - 1);
    expect(rotator.getState()).toMatchObject({ index: 0, isFadingOut: false });

    vi.advanceTimersByTime(1);
    expect(rotator.getState()).toMatchObject({ index: 0, isFadingOut: true });

    vi.advanceTimersByTime(SLOGAN_FADE_DURATION_MS - 1);
    expect(rotator.getState()).toMatchObject({ index: 0, isFadingOut: true });

    vi.advanceTimersByTime(1);
    expect(rotator.getState()).toMatchObject({ index: 1, isFadingOut: false });

    vi.advanceTimersByTime(SLOGAN_ROTATION_INTERVAL_MS + SLOGAN_FADE_DURATION_MS);
    expect(rotator.getState()).toMatchObject({ index: 2, isFadingOut: false });

    vi.advanceTimersByTime(SLOGAN_ROTATION_INTERVAL_MS + SLOGAN_FADE_DURATION_MS);
    expect(rotator.getState()).toMatchObject({ index: 0, isFadingOut: false });

    expect(snapshots).toEqual([
      { index: 0, isFadingOut: true },
      { index: 1, isFadingOut: false },
      { index: 1, isFadingOut: true },
      { index: 2, isFadingOut: false },
      { index: 2, isFadingOut: true },
      { index: 0, isFadingOut: false },
    ]);

    rotator.stop();
  });

  it('immediately resets fade-out on hover/focus pause during the 650ms window and recovers cleanly on unpause', () => {
    const rotator = createSloganRotator({
      sloganCount: 5,
      initialIndex: 1,
    });

    rotator.start();

    // Enter the 650ms fade-out window
    vi.advanceTimersByTime(SLOGAN_ROTATION_INTERVAL_MS);
    expect(rotator.getState()).toMatchObject({ index: 1, isFadingOut: true, isPaused: false });

    // Pause mid-fade (e.g. pointer hover or keyboard focus)
    vi.advanceTimersByTime(250);
    rotator.setPaused(true);
    expect(rotator.getState()).toMatchObject({ index: 1, isFadingOut: false, isPaused: true });

    // Remaining fade window + extra time must NOT swap or fade while paused
    vi.advanceTimersByTime(SLOGAN_ROTATION_INTERVAL_MS * 2);
    expect(rotator.getState()).toMatchObject({ index: 1, isFadingOut: false, isPaused: true });

    // Unpause: remains visible immediately and starts a fresh 12s wait before next fade
    rotator.setPaused(false);
    expect(rotator.getState()).toMatchObject({ index: 1, isFadingOut: false, isPaused: false });

    vi.advanceTimersByTime(SLOGAN_FADE_DURATION_MS);
    expect(rotator.getState()).toMatchObject({ index: 1, isFadingOut: false });

    vi.advanceTimersByTime(SLOGAN_ROTATION_INTERVAL_MS - SLOGAN_FADE_DURATION_MS);
    expect(rotator.getState()).toMatchObject({ index: 1, isFadingOut: true });

    vi.advanceTimersByTime(SLOGAN_FADE_DURATION_MS);
    expect(rotator.getState()).toMatchObject({ index: 2, isFadingOut: false });

    rotator.stop();
  });

  it('immediately forces slogan visible and halts rotation when prefersReducedMotion activates during fade-out', () => {
    const rotator = createSloganRotator({
      sloganCount: 4,
      initialIndex: 2,
    });

    rotator.start();

    vi.advanceTimersByTime(SLOGAN_ROTATION_INTERVAL_MS);
    expect(rotator.getState()).toMatchObject({
      index: 2,
      isFadingOut: true,
      prefersReducedMotion: false,
    });

    vi.advanceTimersByTime(300);
    rotator.setReducedMotion(true);
    expect(rotator.getState()).toMatchObject({
      index: 2,
      isFadingOut: false,
      prefersReducedMotion: true,
    });

    // Advancing timers must keep the slogan visible and static
    vi.advanceTimersByTime(SLOGAN_ROTATION_INTERVAL_MS * 3);
    expect(rotator.getState()).toMatchObject({
      index: 2,
      isFadingOut: false,
      prefersReducedMotion: true,
    });

    // Toggling reduced motion off resumes rotation cleanly
    rotator.setReducedMotion(false);
    expect(rotator.getState()).toMatchObject({
      index: 2,
      isFadingOut: false,
      prefersReducedMotion: false,
    });

    vi.advanceTimersByTime(SLOGAN_ROTATION_INTERVAL_MS + SLOGAN_FADE_DURATION_MS);
    expect(rotator.getState()).toMatchObject({ index: 3, isFadingOut: false });

    rotator.stop();
  });

  it('resets isFadingOut when stopped mid-fade (e.g. React effect cleanup)', () => {
    const onStateChange = vi.fn();
    const rotator = createSloganRotator({
      sloganCount: 3,
      initialIndex: 0,
      onStateChange,
    });

    rotator.start();
    vi.advanceTimersByTime(SLOGAN_ROTATION_INTERVAL_MS);
    expect(rotator.getState().isFadingOut).toBe(true);

    rotator.stop();
    expect(rotator.getState()).toMatchObject({ index: 0, isFadingOut: false });
    expect(onStateChange).toHaveBeenLastCalledWith({
      index: 0,
      isFadingOut: false,
      isPaused: false,
      prefersReducedMotion: false,
    });
  });

  it('normalizes non-finite initialIndex values (such as NaN) to 0 and advances normally', () => {
    const nanRotator = createSloganRotator({
      sloganCount: 5,
      initialIndex: Number.NaN,
    });
    expect(nanRotator.getState()).toEqual({
      index: 0,
      isFadingOut: false,
      isPaused: false,
      prefersReducedMotion: false,
    });

    nanRotator.start();
    vi.advanceTimersByTime(SLOGAN_ROTATION_INTERVAL_MS + SLOGAN_FADE_DURATION_MS);
    expect(nanRotator.getState().index).toBe(1);
    nanRotator.stop();

    const infRotator = createSloganRotator({
      sloganCount: 5,
      initialIndex: Number.POSITIVE_INFINITY,
    });
    expect(infRotator.getState().index).toBe(0);
  });

  it('clamps overridden fadeDurationMs strictly below intervalMs and falls back on invalid timer configs', () => {
    const clampedRotator = createSloganRotator({
      sloganCount: 3,
      intervalMs: 500,
      fadeDurationMs: 700,
    });

    clampedRotator.start();
    vi.advanceTimersByTime(500);
    expect(clampedRotator.getState()).toMatchObject({ index: 0, isFadingOut: true });

    // Clamped to intervalMs - 1 (499ms), so advancing 499ms completes swap before next 500ms interval tick
    vi.advanceTimersByTime(499);
    expect(clampedRotator.getState()).toMatchObject({ index: 1, isFadingOut: false });
    clampedRotator.stop();

    const invalidTimersRotator = createSloganRotator({
      sloganCount: 3,
      intervalMs: -100,
      fadeDurationMs: Number.NaN,
    });

    invalidTimersRotator.start();
    vi.advanceTimersByTime(SLOGAN_ROTATION_INTERVAL_MS);
    expect(invalidTimersRotator.getState()).toMatchObject({ index: 0, isFadingOut: true });
    vi.advanceTimersByTime(SLOGAN_FADE_DURATION_MS);
    expect(invalidTimersRotator.getState()).toMatchObject({ index: 1, isFadingOut: false });
    invalidTimersRotator.stop();
  });
});
