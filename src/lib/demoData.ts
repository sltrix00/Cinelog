import type { MovieRecord, TimeOfDayBucket, WatchEntry } from '../types/cinelog';

// Reference Simulation Constants: Nov 20, 2026 = Day 324 of 365 (matches cinelog.html)
export const SIM_YEAR = 2026;
export const SIM_MONTH_IDX = 10; // November (0-indexed)
export const SIM_DAY = 20;
export const SIM_DAY_OF_YEAR = 324;
export const SIM_DATE_ISO = '2026-11-20';

export const YEAR_COLORS: Record<2024 | 2025 | 2026, string> = {
  2024: '#d6b85a',
  2025: '#45d1c6',
  2026: '#f06292',
};

export interface DemoMovieTemplate {
  title: string;
  director: string;
  country: string;
  genre: string;
  releaseYear: number;
  runtime: number;
  tmdbId: number;
}

export const MOVIE_POOL: DemoMovieTemplate[] = [
  { title: 'Интерстеллар', director: 'Кристофер Нолан', country: 'США', genre: 'Фантастика', releaseYear: 2014, runtime: 169, tmdbId: 157336 },
  { title: 'Дюна: Часть вторая', director: 'Дени Вильнёв', country: 'США', genre: 'Фантастика', releaseYear: 2024, runtime: 166, tmdbId: 693134 },
  { title: 'Бегущий по лезвию 2049', director: 'Дени Вильнёв', country: 'США', genre: 'Фантастика', releaseYear: 2017, runtime: 164, tmdbId: 335984 },
  { title: 'Паразиты', director: 'Пон Джун-хо', country: 'Южная Корея', genre: 'Триллер', releaseYear: 2019, runtime: 132, tmdbId: 496243 },
  { title: 'Оппенгеймер', director: 'Кристофер Нолан', country: 'США', genre: 'Драма', releaseYear: 2023, runtime: 180, tmdbId: 872585 },
  { title: 'Одержимость', director: 'Дэмьен Шазелл', country: 'США', genre: 'Драма', releaseYear: 2014, runtime: 106, tmdbId: 244786 },
  { title: 'Зодиак', director: 'Дэвид Финчер', country: 'США', genre: 'Триллер', releaseYear: 2007, runtime: 157, tmdbId: 1949 },
  { title: 'Семь', director: 'Дэвид Финчер', country: 'США', genre: 'Триллер', releaseYear: 1995, runtime: 127, tmdbId: 807 },
  { title: 'Таксист', director: 'Мартин Скорсезе', country: 'США', genre: 'Криминал', releaseYear: 1976, runtime: 114, tmdbId: 103 },
  { title: 'Славные парни', director: 'Мартин Скорсезе', country: 'США', genre: 'Криминал', releaseYear: 1990, runtime: 146, tmdbId: 769 },
  { title: 'Анатомия падения', director: 'Жюстин Трие', country: 'Франция', genre: 'Драма', releaseYear: 2023, runtime: 151, tmdbId: 915935 },
  { title: 'Портрет девушки в огне', director: 'Селин Сьямма', country: 'Франция', genre: 'Драма', releaseYear: 2019, runtime: 122, tmdbId: 531428 },
  { title: 'Бедные-несчастные', director: 'Йоргос Лантимос', country: 'Великобритания', genre: 'Комедия', releaseYear: 2023, runtime: 141, tmdbId: 792307 },
  { title: 'Лобстер', director: 'Йоргос Лантимос', country: 'Великобритания', genre: 'Комедия', releaseYear: 2015, runtime: 119, tmdbId: 254320 },
  { title: 'Унесённые призраками', director: 'Хаяо Миядзаки', country: 'Япония', genre: 'Анимация', releaseYear: 2001, runtime: 125, tmdbId: 129 },
  { title: 'Семь самураев', director: 'Акира Куросава', country: 'Япония', genre: 'Драма', releaseYear: 1954, runtime: 207, tmdbId: 346 },
  { title: 'Идеальные дни', director: 'Вим Вендерс', country: 'Япония', genre: 'Драма', releaseYear: 2023, runtime: 124, tmdbId: 976893 },
  { title: 'Олдбой', director: 'Пак Чхан-ук', country: 'Южная Корея', genre: 'Триллер', releaseYear: 2003, runtime: 120, tmdbId: 670 },
  { title: 'Решение уйти', director: 'Пак Чхан-ук', country: 'Южная Корея', genre: 'Детектив', releaseYear: 2022, runtime: 139, tmdbId: 705996 },
  { title: 'Крёстный отец', director: 'Фрэнсис Форд Коппола', country: 'США', genre: 'Криминал', releaseYear: 1972, runtime: 175, tmdbId: 238 },
  { title: 'Апокалипсис сегодня', director: 'Фрэнсис Форд Коппола', country: 'США', genre: 'Драма', releaseYear: 1979, runtime: 147, tmdbId: 28 },
  { title: 'Сияние', director: 'Стэнли Кубрик', country: 'Великобритания', genre: 'Триллер', releaseYear: 1980, runtime: 146, tmdbId: 694 },
  { title: '2001: Космическая одиссея', director: 'Стэнли Кубрик', country: 'Великобритания', genre: 'Фантастика', releaseYear: 1968, runtime: 149, tmdbId: 62 },
  { title: 'Безумный Макс: Дорога ярости', director: 'Джордж Миллер', country: 'Австралия', genre: 'Боевик', releaseYear: 2015, runtime: 120, tmdbId: 76341 },
  { title: 'Новый кинотеатр «Парадизо»', director: 'Джузеппе Торнаторе', country: 'Италия', genre: 'Драма', releaseYear: 1988, runtime: 124, tmdbId: 11216 },
  { title: 'Восемь с половиной', director: 'Федерико Феллини', country: 'Италия', genre: 'Драма', releaseYear: 1963, runtime: 138, tmdbId: 422 },
  { title: 'Начало', director: 'Кристофер Нолан', country: 'США', genre: 'Фантастика', releaseYear: 2010, runtime: 148, tmdbId: 27205 },
  { title: 'Прибытие', director: 'Дени Вильнёв', country: 'США', genre: 'Фантастика', releaseYear: 2016, runtime: 116, tmdbId: 329865 },
  { title: 'Пленницы', director: 'Дени Вильнёв', country: 'США', genre: 'Триллер', releaseYear: 2013, runtime: 153, tmdbId: 146233 },
  { title: 'Ла-Ла Ленд', director: 'Дэмьен Шазелл', country: 'США', genre: 'Драма', releaseYear: 2016, runtime: 128, tmdbId: 313369 },
  { title: 'Социальная сеть', director: 'Дэвид Финчер', country: 'США', genre: 'Драма', releaseYear: 2010, runtime: 120, tmdbId: 37799 },
  { title: 'Нефть', director: 'Пол Томас Андерсон', country: 'США', genre: 'Драма', releaseYear: 2007, runtime: 158, tmdbId: 7345 },
  { title: 'Магнолия', director: 'Пол Томас Андерсон', country: 'США', genre: 'Драма', releaseYear: 1999, runtime: 188, tmdbId: 334 },
  { title: 'Драйв', director: 'Николас Виндинг Рефн', country: 'США', genre: 'Криминал', releaseYear: 2011, runtime: 100, tmdbId: 64690 },
  { title: 'Бруталист', director: 'Брэйди Корбет', country: 'США', genre: 'Драма', releaseYear: 2024, runtime: 215, tmdbId: 549509 },
  { title: 'Анора', director: 'Шон Бейкер', country: 'США', genre: 'Комедия', releaseYear: 2024, runtime: 139, tmdbId: 1064213 },
  { title: 'Конклав', director: 'Эдвард Бергер', country: 'Великобритания', genre: 'Триллер', releaseYear: 2024, runtime: 120, tmdbId: 974576 },
  { title: 'Микки 17', director: 'Пон Джун-хо', country: 'США', genre: 'Фантастика', releaseYear: 2025, runtime: 137, tmdbId: 696506 },
  { title: 'Грешники', director: 'Райан Куглер', country: 'США', genre: 'Триллер', releaseYear: 2025, runtime: 138, tmdbId: 1233413 },
  { title: 'Бугония', director: 'Йоргос Лантимос', country: 'Великобритания', genre: 'Комедия', releaseYear: 2025, runtime: 118, tmdbId: 701387 },
  { title: 'Сентиментальная ценность', director: 'Йоаким Триер', country: 'Норвегия', genre: 'Драма', releaseYear: 2025, runtime: 133, tmdbId: 1124566 },
  { title: 'Одиссея', director: 'Кристофер Нолан', country: 'США', genre: 'Драма', releaseYear: 2026, runtime: 162, tmdbId: 1368337 },
];

export const DEMO_MOVIE_CATALOG: MovieRecord[] = MOVIE_POOL.map((m, idx) => ({
  id: `demo-movie-${idx + 1}`,
  tmdb_id: m.tmdbId,
  imdb_id: null,
  title: m.title,
  original_title: null,
  release_year: m.releaseYear,
  runtime_minutes: m.runtime,
  genres: [m.genre],
  directors: [m.director],
  countries: [m.country],
  poster_url: null,
}));

function createRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function dayOfYearToIsoUtc(year: number, doy: number): string {
  const d = new Date(Date.UTC(year, 0, 1));
  d.setUTCDate(doy);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function bucketToDefaultTime(bucket: TimeOfDayBucket): string | null {
  switch (bucket) {
    case 0:
      return '09:30:00';
    case 1:
      return '14:30:00';
    case 2:
      return '20:30:00';
    case 3:
      return '00:45:00';
    default:
      return null;
  }
}

export function generateYearLogs(
  year: number,
  targetCount: number,
  maxDayOfYear: number,
  seed: number
): WatchEntry[] {
  const rng = createRng(seed);
  const logs: WatchEntry[] = [];

  const days: number[] = [];
  for (let i = 0; i < targetCount; i++) {
    let base = Math.floor(((i + 0.5) / targetCount) * maxDayOfYear);
    if (year === 2026 && i < 35) base = Math.max(1, base - Math.floor(rng() * 14));
    if (year === 2025 && i > 40) base = Math.min(maxDayOfYear, base + Math.floor(rng() * 12));
    const jitter = Math.floor((rng() - 0.5) * 14);
    const doy = Math.max(1, Math.min(maxDayOfYear, base + jitter));
    days.push(doy);
  }
  days.sort((a, b) => a - b);

  if (year === 2026) {
    days[days.length - 1] = 323;
    days[days.length - 2] = 321;
    days[days.length - 3] = 319;
    days[days.length - 4] = 315;
    days[days.length - 5] = 312;
  }

  const ratingPool = [2.0, 2.5, 3.0, 3.0, 3.5, 3.5, 3.5, 4.0, 4.0, 4.0, 4.0, 4.5, 4.5, 5.0];

  days.forEach((doy, idx) => {
    const movieIndex = Math.floor(rng() * MOVIE_POOL.length);
    const movie = MOVIE_POOL[movieIndex];
    const releaseYear = Math.min(year, movie.releaseYear);
    const isRewatch = rng() < 0.13 && !(year === 2026 && doy >= 318);
    const rating = ratingPool[Math.floor(rng() * ratingPool.length)];

    const tr = rng();
    const timeOfDay: 0 | 1 | 2 | 3 = tr < 0.08 ? 0 : tr < 0.27 ? 1 : tr < 0.78 ? 2 : 3;
    const runtime = movie.runtime + Math.floor((rng() - 0.5) * 16);
    const watchedDate = dayOfYearToIsoUtc(year, doy);
    const watchedTime = bucketToDefaultTime(timeOfDay);

    logs.push({
      id: `demo-${year}-${idx + 1}`,
      movie_id: `demo-movie-${movieIndex + 1}`,
      tmdb_id: movie.tmdbId,
      imdb_id: null,
      title: movie.title,
      original_title: null,
      release_year: releaseYear,
      watched_date: watchedDate,
      watched_time: watchedTime,
      rating,
      is_rewatch: isRewatch,
      source: 'manual',
      runtime_minutes: runtime,
      runtime_override_minutes: null,
      genres: [movie.genre],
      directors: [movie.director],
      countries: [movie.country],
      poster_url: null,
      import_key: null,
      created_at: `${watchedDate}T${watchedTime ?? '20:00:00'}Z`,
      unique_key: isRewatch ? movie.title : `${movie.title}__${year}_${idx}`,
    });
  });

  return logs;
}

export const DEMO_ENTRIES: WatchEntry[] = [
  ...generateYearLogs(2024, 84, 365, 202411),
  ...generateYearLogs(2025, 108, 365, 202577),
  ...generateYearLogs(2026, 122, SIM_DAY_OF_YEAR, 202699),
];
