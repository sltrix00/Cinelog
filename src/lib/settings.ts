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
  | 'gold'
  | 'violet'
  | 'emerald'
  | 'coral';

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
  theme: 'midnight',
  accent: 'theme',
  ratingFormat: 'stars-5',
};

export const THEMES: readonly ThemeDefinition[] = [
  {
    id: 'midnight',
    name: 'Midnight Cinema',
    description: 'Классический глубокий индиго',
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
    id: 'obsidian',
    name: 'Obsidian OLED',
    description: 'Чистый чёрный для OLED',
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
    id: 'velvet',
    name: 'Velvet Cinema',
    description: 'Бархатный бордовый кинозал',
    mode: 'dark',
    preview: {
      canvas: '#12090e',
      card: '#1c0f17',
      line: '#321b28',
      accent: '#fb7185',
      secondary: '#f59e0b',
      gold: '#e8c468',
    },
    accentFg: '#12090e',
  },
  {
    id: 'emerald',
    name: 'Emerald Noir',
    description: 'Тёмный изумруд и нефрит',
    mode: 'dark',
    preview: {
      canvas: '#071110',
      card: '#0d1c1a',
      line: '#193330',
      accent: '#34d399',
      secondary: '#2dd4bf',
      gold: '#d6b85a',
    },
    accentFg: '#051510',
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
    description: 'Спокойный скандинавский синий',
    mode: 'dark',
    preview: {
      canvas: '#141923',
      card: '#1c2331',
      line: '#2b3548',
      accent: '#88c0d0',
      secondary: '#81a1c1',
      gold: '#ebcb8b',
    },
    accentFg: '#141923',
  },
  {
    id: 'amber',
    name: '35mm Film',
    description: 'Тёплая ламповая плёнка',
    mode: 'dark',
    preview: {
      canvas: '#14100b',
      card: '#1f1912',
      line: '#362c20',
      accent: '#f59e0b',
      secondary: '#fb923c',
      gold: '#fcd34d',
    },
    accentFg: '#14100b',
  },
  {
    id: 'ocean',
    name: 'Deep Ocean',
    description: 'Глубокий морской контраст',
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
    description: 'Чистый светлый интерфейс',
    mode: 'light',
    preview: {
      canvas: '#f4f6fa',
      card: '#ffffff',
      line: '#dce2ec',
      accent: '#e11d48',
      secondary: '#0d9488',
      gold: '#b45309',
    },
    accentFg: '#ffffff',
  },
  {
    id: 'paper',
    name: 'Warm Paper',
    description: 'Кремовая журнальная бумага',
    mode: 'light',
    preview: {
      canvas: '#f6f2ea',
      card: '#fffdf9',
      line: '#e4dacb',
      accent: '#c2410c',
      secondary: '#0f766e',
      gold: '#a16207',
    },
    accentFg: '#ffffff',
  },
  {
    id: 'matcha',
    name: 'Matcha Mist',
    description: 'Мягкий светло-шалфейный',
    mode: 'light',
    preview: {
      canvas: '#eef4f0',
      card: '#f9fcfa',
      line: '#d2e2d8',
      accent: '#059669',
      secondary: '#0d9488',
      gold: '#b45309',
    },
    accentFg: '#ffffff',
  },
  {
    id: 'lavender',
    name: 'Soft Lavender',
    description: 'Нежный пастельный лавандовый',
    mode: 'light',
    preview: {
      canvas: '#f3f1fa',
      card: '#fcfbff',
      line: '#dfd9f2',
      accent: '#7c3aed',
      secondary: '#0891b2',
      gold: '#b45309',
    },
    accentFg: '#ffffff',
  },
] as const;

export const ACCENT_PRESETS: readonly AccentPreset[] = [
  { id: 'theme', label: 'Из темы', color: null, fg: '#0b0e17' },
  { id: 'rose', label: 'Розовый', color: '#f06292', fg: '#0b0e17' },
  { id: 'teal', label: 'Бирюза', color: '#45d1c6', fg: '#061515' },
  { id: 'gold', label: 'Золото', color: '#d6b85a', fg: '#14100b' },
  { id: 'violet', label: 'Фиолетовый', color: '#a78bfa', fg: '#0f0a1e' },
  { id: 'emerald', label: 'Изумруд', color: '#34d399', fg: '#051510' },
  { id: 'coral', label: 'Коралл', color: '#fb7185', fg: '#18070b' },
] as const;

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
  const accent =
    typeof record.accent === 'string' && ACCENT_ID_SET.has(record.accent)
      ? (record.accent as AccentPresetId)
      : DEFAULT_USER_SETTINGS.accent;
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
