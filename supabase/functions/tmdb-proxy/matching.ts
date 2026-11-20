export interface TmdbSearchCandidate {
  id: number;
  title?: string | null;
  original_title?: string | null;
  release_date?: string | null;
  poster_path?: string | null;
  overview?: string | null;
  popularity?: number | null;
  vote_count?: number | null;
}

export interface SearchAttempt {
  query: string;
  year?: number;
  language: string;
}

export interface CandidateMatch {
  candidate: TmdbSearchCandidate;
  score: number;
  titleScore: number;
  yearDiff: number | null;
  highConfidence: boolean;
}

const COUNTRY_OVERRIDES_RU: Record<string, string> = {
  US: 'США',
  GB: 'Великобритания',
  UK: 'Великобритания',
  KR: 'Южная Корея',
  KP: 'Северная Корея',
  RU: 'Россия',
  SU: 'СССР',
  CZ: 'Чехия',
  XC: 'Чехословакия',
  XG: 'ГДР',
  YU: 'Югославия',
  AE: 'ОАЭ',
  HK: 'Гонконг',
  TW: 'Тайвань',
  CN: 'Китай',
  IR: 'Иран',
  SY: 'Сирия',
  TZ: 'Танзания',
  VN: 'Вьетнам',
  BO: 'Боливия',
  VE: 'Венесуэла',
  MD: 'Молдова',
  MK: 'Северная Македония',
};

let regionDisplayNamesRu: Intl.DisplayNames | null = null;
try {
  if (typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function') {
    regionDisplayNamesRu = new Intl.DisplayNames(['ru'], { type: 'region' });
  }
} catch {
  regionDisplayNamesRu = null;
}

export function parseReleaseYear(releaseDate?: string | null): number | null {
  if (!releaseDate || releaseDate.length < 4) return null;
  const year = Number.parseInt(releaseDate.slice(0, 4), 10);
  if (Number.isNaN(year) || year < 1870 || year > 2100) return null;
  return year;
}

export function hasCyrillic(text: string): boolean {
  return /[\u0400-\u04FF]/.test(text);
}

export function normalizeTitleForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(\d+)\s+(?:й|я|е|ой|ый|ая|ое)(?=\s|$)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanSearchQuery(title: string): string {
  return title
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.,;:!?…]+$/g, '')
    .trim();
}

export function stripPunctuationForSearch(title: string): string {
  return title
    .replace(/[’‘]/g, "'")
    .replace(/[:—–\-/.,!?«»"()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractMainTitleBeforeSubtitle(title: string): string | null {
  const cleaned = cleanSearchQuery(title);
  if (!cleaned) return null;
  const match = cleaned.match(/^(.+?)(?::|\s+[—–-]\s+)/);
  if (!match) return null;
  const left = cleanSearchQuery(match[1]);
  if (left.length < 3 || left.length >= cleaned.length) return null;
  return left;
}

export function buildSearchAttempts(title: string, year?: number | null): SearchAttempt[] {
  const raw = title.replace(/\s+/g, ' ').trim();
  if (!raw) return [];

  const validYear =
    typeof year === 'number' && Number.isInteger(year) && year >= 1870 && year <= 2100
      ? year
      : undefined;
  const primaryLang = hasCyrillic(raw) ? 'ru-RU' : 'en-US';
  const secondaryLang = primaryLang === 'ru-RU' ? 'en-US' : 'ru-RU';

  const cleaned = cleanSearchQuery(raw);
  const noPunct = stripPunctuationForSearch(cleaned || raw);
  const mainTitle = extractMainTitleBeforeSubtitle(raw);

  const attempts: SearchAttempt[] = [];
  const seen = new Set<string>();

  const pushAttempt = (query: string, attemptYear: number | undefined, language: string) => {
    const q = query.trim();
    if (!q) return;
    const key = `${language}|${attemptYear ?? ''}|${q.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    attempts.push(attemptYear !== undefined ? { query: q, year: attemptYear, language } : { query: q, language });
  };

  if (validYear !== undefined) {
    pushAttempt(raw, validYear, primaryLang);
  }
  pushAttempt(raw, undefined, primaryLang);

  if (cleaned && cleaned !== raw) {
    if (validYear !== undefined) {
      pushAttempt(cleaned, validYear, primaryLang);
    }
    pushAttempt(cleaned, undefined, primaryLang);
  }

  if (noPunct && noPunct !== cleaned && noPunct !== raw) {
    pushAttempt(noPunct, undefined, primaryLang);
  }

  const secondaryQuery = cleaned || raw;
  if (validYear !== undefined) {
    pushAttempt(secondaryQuery, validYear, secondaryLang);
  }
  pushAttempt(secondaryQuery, undefined, secondaryLang);

  if (mainTitle) {
    if (validYear !== undefined) {
      pushAttempt(mainTitle, validYear, primaryLang);
    }
    pushAttempt(mainTitle, undefined, primaryLang);
  }

  return attempts;
}

function computePairTitleScore(qNorm: string, cNorm: string): number {
  if (!qNorm || !cNorm) return 0;
  if (qNorm === cNorm) return 100;

  const minLen = Math.min(qNorm.length, cNorm.length);
  const maxLen = Math.max(qNorm.length, cNorm.length);
  if (minLen >= 4 && (cNorm.includes(qNorm) || qNorm.includes(cNorm)) && minLen / maxLen >= 0.55) {
    return 65;
  }

  const qTokens = qNorm.split(' ').filter(Boolean);
  const cTokens = cNorm.split(' ').filter(Boolean);
  if (qTokens.length === 0 || cTokens.length === 0) return 0;

  const qSet = new Set(qTokens);
  const cSet = new Set(cTokens);
  let intersection = 0;
  for (const token of qSet) {
    if (cSet.has(token)) intersection += 1;
  }
  if (intersection === 0) return 0;

  const maxTokens = Math.max(qSet.size, cSet.size);
  if (intersection === qSet.size || intersection === cSet.size) {
    return Math.round(55 * (intersection / maxTokens));
  }

  const union = qSet.size + cSet.size - intersection;
  return Math.round(35 * (intersection / union));
}

export function scoreCandidate(
  candidate: TmdbSearchCandidate,
  queryTitle: string,
  targetYear?: number | null
): CandidateMatch {
  const qNorm = normalizeTitleForComparison(queryTitle);
  const candidateTitles = [candidate.title, candidate.original_title]
    .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    .map((t) => normalizeTitleForComparison(t));

  let titleScore = 0;
  for (const cNorm of candidateTitles) {
    const s = computePairTitleScore(qNorm, cNorm);
    if (s > titleScore) titleScore = s;
  }

  const validTargetYear =
    typeof targetYear === 'number' && Number.isInteger(targetYear) && targetYear >= 1870 && targetYear <= 2100
      ? targetYear
      : null;

  let yearDiff: number | null = null;
  let yearScore = 0;

  if (validTargetYear !== null) {
    const candYear = parseReleaseYear(candidate.release_date);
    if (candYear !== null) {
      yearDiff = Math.abs(candYear - validTargetYear);
      if (yearDiff === 0) yearScore = 60;
      else if (yearDiff === 1) yearScore = 40;
      else if (yearDiff === 2) yearScore = 15;
      else if (yearDiff <= 5) yearScore = -15;
      else yearScore = -50;
    } else {
      yearScore = -20;
    }
  }

  const voteCount = Math.max(0, candidate.vote_count ?? 0);
  const popularity = Math.max(0, candidate.popularity ?? 0);
  const popScore = Math.min(25, Math.log10(1 + voteCount) * 5 + Math.log10(1 + popularity) * 3);

  const score = titleScore + yearScore + popScore;
  const highConfidence =
    validTargetYear !== null
      ? titleScore >= 65 && yearDiff !== null && yearDiff <= 1
      : titleScore >= 100 && voteCount >= 10;

  return {
    candidate,
    score,
    titleScore,
    yearDiff,
    highConfidence,
  };
}

function isAcceptableMatch(match: CandidateMatch, targetYear?: number | null): boolean {
  if (match.titleScore < 35) return false;

  const validTargetYear =
    typeof targetYear === 'number' && Number.isInteger(targetYear) && targetYear >= 1870 && targetYear <= 2100
      ? targetYear
      : null;

  if (validTargetYear !== null) {
    if (match.yearDiff !== null && match.yearDiff > 2) {
      const voteCount = match.candidate.vote_count ?? 0;
      if (!(match.titleScore >= 100 && match.yearDiff <= 7 && voteCount >= 50)) {
        return false;
      }
    }
    return match.score >= 60;
  }

  return match.score >= 50;
}

export function pickBestCandidate(
  candidates: TmdbSearchCandidate[],
  queryTitle: string,
  targetYear?: number | null
): CandidateMatch | null {
  if (!candidates.length) return null;

  const seenIds = new Set<number>();
  let best: CandidateMatch | null = null;

  for (const candidate of candidates) {
    if (!candidate || typeof candidate.id !== 'number' || seenIds.has(candidate.id)) continue;
    seenIds.add(candidate.id);

    const evaluated = scoreCandidate(candidate, queryTitle, targetYear);
    if (!isAcceptableMatch(evaluated, targetYear)) continue;

    if (!best || evaluated.score > best.score) {
      best = evaluated;
    }
  }

  return best;
}

export function normalizeGenres(rawGenres: Array<{ name?: string } | string>): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const raw of rawGenres) {
    const str = (typeof raw === 'string' ? raw : raw?.name ?? '').trim();
    if (!str) continue;
    const normalized = str.charAt(0).toLocaleUpperCase('ru-RU') + str.slice(1);
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= 6) break;
  }

  return result;
}

export function localizeCountries(rawCountries: Array<{ iso_3166_1?: string; name?: string }>): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const country of rawCountries) {
    const iso = (country.iso_3166_1 ?? '').trim().toUpperCase();
    let label = '';

    if (iso && COUNTRY_OVERRIDES_RU[iso]) {
      label = COUNTRY_OVERRIDES_RU[iso];
    } else if (/^[A-Z]{2}$/.test(iso) && regionDisplayNamesRu) {
      try {
        const localized = regionDisplayNamesRu.of(iso);
        if (localized && localized.toUpperCase() !== iso) {
          label = localized;
        }
      } catch {
        // Fallback to raw name below
      }
    }

    if (!label) {
      label = (country.name ?? '').trim();
    }
    if (!label) continue;

    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(label);
    if (result.length >= 5) break;
  }

  return result;
}

export function normalizeDirectors(crew: Array<{ job?: string; name?: string }>): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const member of crew) {
    if (member.job !== 'Director' || typeof member.name !== 'string') continue;
    const name = member.name.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    result.push(name);
    if (result.length >= 5) break;
  }

  return result;
}
