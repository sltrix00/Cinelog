import { describe, expect, it } from 'vitest';
import {
  halfStarsToRating,
  isValidWatchLogId,
  minutesToTimeString,
  ratingToHalfStars,
  timeStringToMinutes,
} from './watchLogCodec';

describe('watchLogCodec', () => {
  describe('timeStringToMinutes & minutesToTimeString', () => {
    it('round-trips boundary and standard times cleanly', () => {
      expect(timeStringToMinutes('00:00:00')).toBe(0);
      expect(minutesToTimeString(0)).toBe('00:00:00');

      expect(timeStringToMinutes('03:05:00')).toBe(185);
      expect(minutesToTimeString(185)).toBe('03:05:00');

      expect(timeStringToMinutes('23:59:00')).toBe(1439);
      expect(minutesToTimeString(1439)).toBe('23:59:00');

      expect(timeStringToMinutes('09:30')).toBe(570);
      expect(minutesToTimeString(570)).toBe('09:30:00');
    });

    it('returns null for invalid or out-of-range time values', () => {
      expect(timeStringToMinutes('24:00')).toBeNull();
      expect(timeStringToMinutes('99:99')).toBeNull();
      expect(timeStringToMinutes('')).toBeNull();
      expect(timeStringToMinutes(null)).toBeNull();
      expect(timeStringToMinutes(undefined)).toBeNull();

      expect(minutesToTimeString(-1)).toBeNull();
      expect(minutesToTimeString(1440)).toBeNull();
      expect(minutesToTimeString(12.5)).toBeNull();
      expect(minutesToTimeString(null)).toBeNull();
    });
  });

  describe('ratingToHalfStars & halfStarsToRating', () => {
    it('round-trips all valid 0.5..5.0 half-star steps', () => {
      for (let x2 = 1; x2 <= 10; x2 += 1) {
        const stars = x2 / 2;
        expect(ratingToHalfStars(stars)).toBe(x2);
        expect(halfStarsToRating(x2)).toBe(stars);
      }
    });

    it('rejects out-of-range or non-half-star ratings', () => {
      expect(ratingToHalfStars(0)).toBeNull();
      expect(ratingToHalfStars(5.5)).toBeNull();
      expect(ratingToHalfStars(3.3)).toBeNull();
      expect(ratingToHalfStars(Number.NaN)).toBeNull();
      expect(ratingToHalfStars(null)).toBeNull();

      expect(halfStarsToRating(0)).toBeNull();
      expect(halfStarsToRating(11)).toBeNull();
      expect(halfStarsToRating(4.5)).toBeNull();
      expect(halfStarsToRating(null)).toBeNull();
    });
  });

  describe('isValidWatchLogId', () => {
    it('accepts decimal bigint string IDs and rejects non-numeric IDs', () => {
      expect(isValidWatchLogId('1')).toBe(true);
      expect(isValidWatchLogId('313')).toBe(true);
      expect(isValidWatchLogId('9007199254740991')).toBe(true);

      expect(isValidWatchLogId('')).toBe(false);
      expect(isValidWatchLogId('abc')).toBe(false);
      expect(isValidWatchLogId('-1')).toBe(false);
      expect(isValidWatchLogId('12.3')).toBe(false);
      expect(isValidWatchLogId('550e8400-e29b-41d4-a716-446655440000')).toBe(false);
    });
  });
});
