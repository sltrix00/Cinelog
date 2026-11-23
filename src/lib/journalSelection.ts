import type { WatchEntry } from '../types/cinelog';

export type SelectionPreset =
  | 'all'
  | 'none'
  | 'rated'
  | 'unrated'
  | 'rewatch'
  | 'first_watch';

export type MasterCheckboxState = 'none' | 'some' | 'all';

export interface DeleteIdentityOptions {
  userNickname?: string | null;
  userEmail?: string | null;
  isDemoMode?: boolean;
}

export function getMasterCheckboxState(
  filtered: WatchEntry[],
  selectedIds: Set<string>
): MasterCheckboxState {
  if (filtered.length === 0 || selectedIds.size === 0) {
    return 'none';
  }
  let matched = 0;
  for (const entry of filtered) {
    if (selectedIds.has(entry.id)) {
      matched += 1;
    }
  }
  if (matched === 0) return 'none';
  if (matched === filtered.length) return 'all';
  return 'some';
}

export function applySelectionPreset(
  filtered: WatchEntry[],
  preset: SelectionPreset
): Set<string> {
  if (preset === 'none') {
    return new Set();
  }
  const next = new Set<string>();
  for (const entry of filtered) {
    switch (preset) {
      case 'all':
        next.add(entry.id);
        break;
      case 'rated':
        if (entry.rating !== null) next.add(entry.id);
        break;
      case 'unrated':
        if (entry.rating === null) next.add(entry.id);
        break;
      case 'rewatch':
        if (entry.is_rewatch) next.add(entry.id);
        break;
      case 'first_watch':
        if (!entry.is_rewatch) next.add(entry.id);
        break;
    }
  }
  return next;
}

export function verifyDeleteIdentity(
  rawInput: string,
  options: DeleteIdentityOptions
): boolean {
  const input = rawInput.trim().toLowerCase();
  if (!input) return false;

  const nickname = options.userNickname?.trim().toLowerCase();
  const email = options.userEmail?.trim().toLowerCase();

  if (nickname && input === nickname) {
    return true;
  }
  if (email && input === email) {
    return true;
  }
  if (!nickname && !email && options.isDemoMode) {
    return input === 'demo';
  }
  return false;
}
