import { describe, expect, it } from 'vitest';
import type { WatchEntry } from '../types/cinelog';
import {
  applySelectionPreset,
  getMasterCheckboxState,
  verifyDeleteIdentity,
} from './journalSelection';

function makeEntry(overrides: Partial<WatchEntry> & { id: string }): WatchEntry {
  return {
    movie_id: `movie-${overrides.id}`,
    tmdb_id: null,
    imdb_id: null,
    title: `Film ${overrides.id}`,
    original_title: null,
    release_year: 2024,
    watched_date: '2026-01-10',
    watched_time: null,
    rating: null,
    is_rewatch: false,
    source: 'manual',
    runtime_minutes: 120,
    runtime_override_minutes: null,
    genres: [],
    directors: [],
    countries: [],
    poster_url: null,
    import_key: null,
    created_at: '2026-01-10T12:00:00Z',
    ...overrides,
  };
}

const sampleEntries: WatchEntry[] = [
  makeEntry({ id: '1', rating: 4.5, is_rewatch: false }),
  makeEntry({ id: '2', rating: null, is_rewatch: true }),
  makeEntry({ id: '3', rating: 3.0, is_rewatch: true }),
  makeEntry({ id: '4', rating: null, is_rewatch: false }),
];

describe('getMasterCheckboxState', () => {
  it('returns none when empty or nothing selected', () => {
    expect(getMasterCheckboxState([], new Set())).toBe('none');
    expect(getMasterCheckboxState(sampleEntries, new Set())).toBe('none');
    expect(getMasterCheckboxState(sampleEntries, new Set(['other']))).toBe('none');
  });

  it('returns some when partially selected', () => {
    expect(getMasterCheckboxState(sampleEntries, new Set(['1', '3']))).toBe('some');
  });

  it('returns all when every filtered entry is selected', () => {
    expect(
      getMasterCheckboxState(sampleEntries, new Set(['1', '2', '3', '4', 'extra']))
    ).toBe('all');
  });
});

describe('applySelectionPreset', () => {
  it('handles all and none', () => {
    expect(applySelectionPreset(sampleEntries, 'all')).toEqual(
      new Set(['1', '2', '3', '4'])
    );
    expect(applySelectionPreset(sampleEntries, 'none')).toEqual(new Set());
  });

  it('filters rated and unrated entries', () => {
    expect(applySelectionPreset(sampleEntries, 'rated')).toEqual(new Set(['1', '3']));
    expect(applySelectionPreset(sampleEntries, 'unrated')).toEqual(new Set(['2', '4']));
  });

  it('filters rewatch and first_watch entries', () => {
    expect(applySelectionPreset(sampleEntries, 'rewatch')).toEqual(new Set(['2', '3']));
    expect(applySelectionPreset(sampleEntries, 'first_watch')).toEqual(new Set(['1', '4']));
  });
});

describe('verifyDeleteIdentity', () => {
  it('matches nickname or email case-insensitively and ignores surrounding spaces', () => {
    const opts = { userNickname: 'Cinephile_42', userEmail: 'User@Example.com' };
    expect(verifyDeleteIdentity('  cinephile_42 ', opts)).toBe(true);
    expect(verifyDeleteIdentity('user@example.com', opts)).toBe(true);
    expect(verifyDeleteIdentity('USER@EXAMPLE.COM', opts)).toBe(true);
    expect(verifyDeleteIdentity('wrong', opts)).toBe(false);
    expect(verifyDeleteIdentity('', opts)).toBe(false);
  });

  it('accepts demo in demo mode when no nickname or email is set', () => {
    expect(verifyDeleteIdentity('demo', { isDemoMode: true })).toBe(true);
    expect(verifyDeleteIdentity(' DEMO ', { isDemoMode: true })).toBe(true);
    expect(verifyDeleteIdentity('other', { isDemoMode: true })).toBe(false);
  });

  it('rejects demo when user has a real email or nickname', () => {
    expect(
      verifyDeleteIdentity('demo', { userEmail: 'user@example.com', isDemoMode: false })
    ).toBe(false);
  });
});
