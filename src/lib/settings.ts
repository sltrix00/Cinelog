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
  | 'terracotta'
  | 'burgundy'
  | 'rose'
  | 'ochre'
  | 'olive'
  | 'emerald'
  | 'teal'
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
  theme: 'midnight',
  accent: 'theme',
  ratingFormat: 'stars-5',
};

export const THEMES: readonly ThemeDefinition[] = [
  {
    id: 'midnight',
    name: 'Midnight Cinema',
    description: 'Глубокий индиго, пыльная роза и латунь',
    mode: 'dark',
    preview: {
      canvas: '#0b0e17',
      card: '#111524',
      line: '#1e2438',
      accent: '#d96b83',
      secondary: '#5aa9a8',
      gold: '#c9a959',
    },
    accentFg: '#120a0d',
  },
  {
    id: 'obsidian',
    name: 'Obsidian Mono',
    description: 'Строгий чёрный OLED, сталь и кармин',
    mode: 'dark',
    preview: {
      canvas: '#060709',
      card: '#0f1014',
      line: '#20222b',
      accent: '#c95a63',
      secondary: '#6f96b8',
      gold: '#c49a52',
    },
    accentFg: '#ffffff',
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
    name: 'Dusk Plum',
    description: 'Сумеречный сливовый, орхидея и янтарь',
    mode: 'dark',
    preview: {
      canvas: '#120d1a',
      card: '#1b1426',
      line: '#302342',
      accent: '#b876a8',
      secondary: '#6b9bb5',
      gold: '#d19a66',
    },
    accentFg: '#140c18',
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
    description: 'Глубокий океан, коралл и морской синий',
    mode: 'dark',
    preview: {
      canvas: '#07131f',
      card: '#0d1e2f',
      line: '#1a3650',
      accent: '#d47a6a',
      secondary: '#5e9ec2',
      gold: '#cfb06a',
    },
    accentFg: '#160c0a',
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
  { id: 'terracotta', label: 'Терракота', color: '#c86d44', fg: '#ffffff' },
  { id: 'burgundy', label: 'Бордо', color: '#b84a5e', fg: '#ffffff' },
  { id: 'rose', label: 'Пыльная роза', color: '#d96b83', fg: '#140a0d' },
  { id: 'ochre', label: 'Латунь', color: '#c9a959', fg: '#14100b' },
  { id: 'olive', label: 'Олива', color: '#6f8f5c', fg: '#ffffff' },
  { id: 'emerald', label: 'Нефрит', color: '#4a8f73', fg: '#ffffff' },
  { id: 'teal', label: 'Морской', color: '#4d9699', fg: '#ffffff' },
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
