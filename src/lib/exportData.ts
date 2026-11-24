import type { WatchEntry } from '../types/cinelog';

function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function serializeWatchEntriesToCsv(entries: WatchEntry[]): string {
  const headers = [
    'Title',
    'Year',
    'WatchedDate',
    'WatchedTime',
    'Rating',
    'Rewatch',
    'RuntimeMinutes',
    'Directors',
    'Countries',
    'Genres',
  ];

  const rows = entries.map((entry) =>
    [
      entry.title,
      entry.release_year ?? '',
      entry.watched_date,
      entry.watched_time ?? '',
      entry.rating !== null ? entry.rating.toFixed(1) : '',
      entry.is_rewatch ? 'Yes' : 'No',
      entry.runtime_override_minutes ?? entry.runtime_minutes ?? '',
      entry.directors.join('; '),
      entry.countries.join('; '),
      entry.genres.join('; '),
    ]
      .map(escapeCsvCell)
      .join(',')
  );

  return [headers.join(','), ...rows].join('\r\n');
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportWatchEntriesAsJson(entries: WatchEntry[]): void {
  const dateStamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
  triggerBlobDownload(blob, `cinelog-export-${dateStamp}.json`);
}

export function exportWatchEntriesAsCsv(entries: WatchEntry[]): void {
  const dateStamp = new Date().toISOString().slice(0, 10);
  const csv = `\uFEFF${serializeWatchEntriesToCsv(entries)}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  triggerBlobDownload(blob, `cinelog-export-${dateStamp}.csv`);
}
