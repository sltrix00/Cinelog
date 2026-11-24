export type ThemeMode = 'dark' | 'light';

export type ThemeId =
  | 'midnight'
  | 'obsidian'
  | 'velvet'
  | 'emerald'
  | 'synthwave'
  | 'nord'
  | 'amber'
  | 'ocean'
  | 'daylight'
  | 'paper'
  | 'matcha'
  | 'lavender';

export type AccentPresetId =
  | 'theme'
  | 'rose'
  | 'teal'
  | 'neon'
  | 'terracotta'
  | 'burgundy'
  | 'ochre'
  | 'olive'
  | 'emerald'
  | 'steel'
  | 'indigo'
  | 'plum';

export type RatingFormat = 'stars-5' | 'scale-10' | 'percent';

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  description: string;
  mode: ThemeMode;
  preview: {
    canvas: string;
    card: string;
    line: string;
    accent: string;
    secondary: string;
    gold: string;
  };
  accentFg: string;
}

export interface AccentPreset {
  id: AccentPresetId;
  label: string;
  color: string | null;
  fg: string;
}

export interface UserSettings {
  theme: ThemeId;
  accent: AccentPresetId;
  ratingFormat: RatingFormat;
}

export const SETTINGS_STORAGE_KEY = 'cinelog.user_settings.v1';

export const DEFAULT_USER_SETTINGS: UserSettings = {
  theme: 'obsidian',
  accent: 'theme',
  ratingFormat: 'stars-5',
};

export const THEMES: readonly ThemeDefinition[] = [
  {
    id: 'obsidian',
    name: 'Obsidian OLED',
    description: 'Чистый чёрный OLED с ярким глянцем',
    mode: 'dark',
    preview: {
      canvas: '#050507',
      card: '#0e0f13',
      line: '#1f212a',
      accent: '#f43f5e',
      secondary: '#38bdf8',
      gold: '#eab308',
    },
    accentFg: '#ffffff',
  },
  {
    id: 'midnight',
    name: 'Midnight Cinema',
    description: 'Оригинальная палитра Cinelog',
    mode: 'dark',
    preview: {
      canvas: '#0b0e17',
      card: '#111524',
      line: '#1e2438',
      accent: '#f06292',
      secondary: '#45d1c6',
      gold: '#d6b85a',
    },
    accentFg: '#0b0e17',
  },
  {
    id: 'velvet',
    name: 'Velvet Cinema',
    description: 'Бархатный бордовый зал, гранат и шампань',
    mode: 'dark',
    preview: {
      canvas: '#120a0f',
      card: '#1c1018',
      line: '#331d2b',
      accent: '#d16072',
      secondary: '#c9885b',
      gold: '#d4b16a',
    },
    accentFg: '#ffffff',
  },
  {
    id: 'emerald',
    name: 'Emerald Noir',
    description: 'Тёмная хвоя, нефрит и тёплая медь',
    mode: 'dark',
    preview: {
      canvas: '#081110',
      card: '#0e1c1a',
      line: '#1c3330',
      accent: '#c97b5d',
      secondary: '#5fa382',
      gold: '#c8b06b',
    },
    accentFg: '#140c09',
  },
  {
    id: 'synthwave',
    name: 'Synthwave 84',
    description: 'Ультрафиолетовый ретро-неон',
    mode: 'dark',
    preview: {
      canvas: '#10091c',
      card: '#1a102d',
      line: '#2e1d4e',
      accent: '#e879f9',
      secondary: '#22d3ee',
      gold: '#facc15',
    },
    accentFg: '#10091c',
  },
  {
    id: 'nord',
    name: 'Nordic Slate',
    description: 'Скандинавский шифер, брусника и лёд',
    mode: 'dark',
    preview: {
      canvas: '#141923',
      card: '#1c2331',
      line: '#2b3548',
      accent: '#bf616a',
      secondary: '#81a1c1',
      gold: '#d6b576',
    },
    accentFg: '#ffffff',
  },
  {
    id: 'amber',
    name: '35mm Film',
    description: 'Тёплая плёнка, терракота и олива',
    mode: 'dark',
    preview: {
      canvas: '#14100c',
      card: '#1f1913',
      line: '#362c22',
      accent: '#c86d44',
      secondary: '#8fa67a',
      gold: '#d6a354',
    },
    accentFg: '#ffffff',
  },
  {
    id: 'ocean',
    name: 'Deep Ocean',
    description: 'Глубокий океан и яркий аквамарин',
    mode: 'dark',
    preview: {
      canvas: '#061320',
      card: '#0b1e30',
      line: '#173652',
      accent: '#38bdf8',
      secondary: '#2dd4bf',
      gold: '#fbbf24',
    },
    accentFg: '#061320',
  },
  {
    id: 'daylight',
    name: 'Daylight Studio',
    description: 'Чистый редакционный светлый и бордо',
    mode: 'light',
    preview: {
      canvas: '#f4f5f8',
      card: '#ffffff',
      line: '#dce0e8',
      accent: '#b84a5e',
      secondary: '#2d6f8e',
      gold: '#a87528',
    },
    accentFg: '#ffffff',
  },
  {
    id: 'paper',
    name: 'Warm Paper',
    description: 'Журнальная бумага, терракота и эвкалипт',
    mode: 'light',
    preview: {
      canvas: '#f6f2ea',
      card: '#fffdf9',
      line: '#e4dacb',
      accent: '#b55336',
      secondary: '#3a7368',
      gold: '#a67c32',
    },
    accentFg: '#ffffff',
  },
  {
    id: 'matcha',
    name: 'Matcha Mist',
    description: 'Шалфейный лист, матча и тёплая глина',
    mode: 'light',
    preview: {
      canvas: '#eef3ef',
      card: '#f9fbf9',
      line: '#d3e0d7',
      accent: '#3b7a57',
      secondary: '#4c747a',
      gold: '#9e7e34',
    },
    accentFg: '#ffffff',
  },
  {
    id: 'lavender',
    name: 'Soft Lavender',
    description: 'Пыльная лаванда, слива и карамель',
    mode: 'light',
    preview: {
      canvas: '#f3f1f8',
      card: '#fcfbff',
      line: '#dfd9ee',
      accent: '#7a539c',
      secondary: '#3f788c',
      gold: '#a87b3e',
    },
    accentFg: '#ffffff',
  },
] as const;

export const ACCENT_PRESETS: readonly AccentPreset[] = [
  { id: 'theme', label: 'Из темы', color: null, fg: '#ffffff' },
  { id: 'rose', label: 'Розовый', color: '#f06292', fg: '#0b0e17' },
  { id: 'teal', label: 'Бирюза', color: '#45d1c6', fg: '#061515' },
  { id: 'neon', label: 'Неон', color: '#e879f9', fg: '#10091c' },
  { id: 'terracotta', label: 'Терракота', color: '#c86d44', fg: '#ffffff' },
  { id: 'burgundy', label: 'Бордо', color: '#b84a5e', fg: '#ffffff' },
  { id: 'ochre', label: 'Латунь', color: '#c9a959', fg: '#14100b' },
  { id: 'olive', label: 'Олива', color: '#6f8f5c', fg: '#ffffff' },
  { id: 'emerald', label: 'Нефрит', color: '#4a8f73', fg: '#ffffff' },
  { id: 'steel', label: 'Стальной', color: '#5a87b0', fg: '#ffffff' },
  { id: 'indigo', label: 'Индиго', color: '#6c75ad', fg: '#ffffff' },
  { id: 'plum', label: 'Слива', color: '#96669c', fg: '#ffffff' },
] as const;

const LEGACY_ACCENT_MAP: Record<string, AccentPresetId> = {
  gold: 'ochre',
  violet: 'plum',
  coral: 'terracotta',
};

const THEME_ID_SET = new Set<string>(THEMES.map((t) => t.id));
const ACCENT_ID_SET = new Set<string>(ACCENT_PRESETS.map((a) => a.id));
const RATING_FORMAT_SET = new Set<string>(['stars-5', 'scale-10', 'percent']);

export function getThemeDefinition(themeId: ThemeId): ThemeDefinition {
  return THEMES.find((t) => t.id === themeId) ?? THEMES[0];
}

export function sanitizeUserSettings(raw: unknown): UserSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_USER_SETTINGS };
  const record = raw as Record<string, unknown>;
  const theme =
    typeof record.theme === 'string' && THEME_ID_SET.has(record.theme)
      ? (record.theme as ThemeId)
      : DEFAULT_USER_SETTINGS.theme;

  let accent: AccentPresetId = DEFAULT_USER_SETTINGS.accent;
  if (typeof record.accent === 'string') {
    if (ACCENT_ID_SET.has(record.accent)) {
      accent = record.accent as AccentPresetId;
    } else if (record.accent in LEGACY_ACCENT_MAP) {
      accent = LEGACY_ACCENT_MAP[record.accent];
    }
  }

  const ratingFormat =
    typeof record.ratingFormat === 'string' && RATING_FORMAT_SET.has(record.ratingFormat)
      ? (record.ratingFormat as RatingFormat)
      : DEFAULT_USER_SETTINGS.ratingFormat;

  return { theme, accent, ratingFormat };
}

export function loadUserSettings(): UserSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_USER_SETTINGS };
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_USER_SETTINGS };
    return sanitizeUserSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_USER_SETTINGS };
  }
}

export function saveUserSettings(settings: UserSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore quota or private-browsing storage errors
  }
}

export function applyThemeToDocument(themeId: ThemeId, accentId: AccentPresetId): void {
  if (typeof document === 'undefined') return;
  const theme = getThemeDefinition(themeId);
  const accentPreset = ACCENT_PRESETS.find((a) => a.id === accentId);
  const accentColor = accentPreset?.color ?? theme.preview.accent;
  const accentFg = accentPreset?.color ? accentPreset.fg : theme.accentFg;

  const root = document.documentElement;
  root.dataset.theme = theme.id;
  root.dataset.themeMode = theme.mode;
  root.style.colorScheme = theme.mode;
  root.style.setProperty('--theme-accent', accentColor);
  root.style.setProperty('--theme-accent-fg', accentFg);
}

export function formatRatingValue(
  rating: number,
  format: RatingFormat,
  options?: { decimals?: number; withUnit?: boolean }
): string {
  const withUnit = options?.withUnit ?? true;
  if (format === 'scale-10') {
    const scaled = rating * 2;
    const decimals = options?.decimals ?? (Number.isInteger(scaled) ? 0 : 1);
    const num = scaled.toFixed(decimals);
    return withUnit ? `${num} / 10` : num;
  }
  if (format === 'percent') {
    const pct = Math.round(rating * 20);
    return withUnit ? `${pct}%` : String(pct);
  }
  const decimals = options?.decimals ?? 1;
  const num = rating.toFixed(decimals);
  return withUnit ? `${num} ★` : num;
}

export function formatRatingShort(rating: number, format: RatingFormat): string {
  if (format === 'scale-10') {
    const scaled = rating * 2;
    return Number.isInteger(scaled) ? `${scaled}/10` : `${scaled.toFixed(1)}/10`;
  }
  if (format === 'percent') {
    return `${Math.round(rating * 20)}%`;
  }
  return `${rating.toFixed(1)}★`;
}

export function formatRatingBucketLabel(bucket: string, format: RatingFormat): string {
  if (format === 'stars-5') return bucket;
  const numeric = Number.parseFloat(bucket.replace('★', '').trim());
  if (!Number.isFinite(numeric)) return bucket;
  if (format === 'scale-10') {
    const scaled = numeric * 2;
    return Number.isInteger(scaled) ? `${scaled}` : scaled.toFixed(1);
  }
  return `${Math.round(numeric * 20)}%`;
}
