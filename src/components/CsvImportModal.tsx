import { useRef, useState, type DragEvent } from 'react';
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import { annotateImportBatch, parseImportFile } from '../lib/csvImport';
import type { ParsedImportRow, WatchEntry } from '../types/cinelog';

interface CsvImportModalProps {
  open: boolean;
  onClose: () => void;
  existingEntries: WatchEntry[];
  onConfirmImport: (
    rows: ParsedImportRow[],
    replaceDemo: boolean,
    onProgress?: (done: number, total: number) => void
  ) => Promise<void>;
  isDemoMode: boolean;
}

export function CsvImportModal({
  open,
  onClose,
  existingEntries,
  onConfirmImport,
  isDemoMode,
}: CsvImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [rows, setRows] = useState<ParsedImportRow[]>([]);
  const [fileLabels, setFileLabels] = useState<string[]>([]);
  const [replaceDemo, setReplaceDemo] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!open) return null;

  const processFiles = async (files: File[]) => {
    if (!files.length) return;
    setParsing(true);
    setErrorMsg(null);

    try {
      const allParsed: ParsedImportRow[] = [];
      const names: string[] = [];

      for (const file of files) {
        const parsed = await parseImportFile(file);
        if (parsed.length > 0) {
          allParsed.push(...parsed);
          names.push(file.name);
        }
      }

      if (allParsed.length === 0) {
        setErrorMsg('Не удалось распознать фильмы в выбранных файлах. Поддерживаются CSV (Letterboxd / IMDb), .txt и .json.');
        setRows([]);
        return;
      }

      const baseline = isDemoMode && replaceDemo ? [] : existingEntries;
      setRows(annotateImportBatch(allParsed, baseline));
      setFileLabels(names);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Ошибка чтения файла.');
    } finally {
      setParsing(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    void processFiles(Array.from(e.dataTransfer.files));
  };

  const newRowsCount = rows.filter((r) => !r.isDuplicate).length;
  const duplicateCount = rows.filter((r) => r.isDuplicate).length;
  const autoRewatchCount = rows.filter((r) => !r.isDuplicate && r.autoRewatchDetected).length;
  const withoutTimeCount = rows.filter((r) => !r.isDuplicate && !r.watchedTime).length;

  const handleConfirm = async () => {
    if (newRowsCount === 0) return;
    setImporting(true);
    setErrorMsg(null);
    try {
      await onConfirmImport(rows, isDemoMode && replaceDemo, (done, total) => {
        setProgress({ done, total });
      });
      setRows([]);
      setFileLabels([]);
      setProgress(null);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Ошибка импорта.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-2xl bg-card border border-lineStrong shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-[#45d1c6]" />
            <h3 className="text-sm font-semibold text-white">
              Умный импорт (Letterboxd / IMDb CSV, .txt, .json)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-cardElevated transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Drag & Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-all ${
              dragging
                ? 'border-[#45d1c6] bg-[#45d1c6]/10'
                : 'border-lineStrong bg-canvas/60 hover:border-[#45d1c6]/60'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.json"
              multiple
              className="hidden"
              onChange={(e) => {
                void processFiles(Array.from(e.target.files ?? []));
                e.target.value = '';
              }}
            />
            <div className="w-10 h-10 rounded-xl bg-cardElevated border border-line flex items-center justify-center mx-auto mb-3">
              {parsing ? (
                <Loader2 className="w-5 h-5 text-[#45d1c6] animate-spin" />
              ) : (
                <Upload className="w-5 h-5 text-[#45d1c6]" />
              )}
            </div>
            <p className="text-sm font-medium text-white">
              Перетащите файлы сюда или нажмите для выбора
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Поддерживаются Letterboxd (<span className="font-mono">diary.csv / ratings.csv</span>), IMDb (
              <span className="font-mono">ratings.csv</span>), дневники <span className="font-mono">.txt</span> и бэкапы{' '}
              <span className="font-mono">.json</span>
            </p>
          </div>

          {isDemoMode && (
            <label className="flex items-center justify-between p-3 rounded-xl bg-canvas border border-line cursor-pointer text-xs">
              <div>
                <span className="font-medium text-slate-200 block">
                  Заменить демо-данные на импортированный архив
                </span>
                <span className="text-[11px] text-slate-500">
                  Удобно для проверки графика «Время суток» на чистом CSV без времени
                </span>
              </div>
              <input
                type="checkbox"
                checked={replaceDemo}
                onChange={(e) => {
                  const next = e.target.checked;
                  setReplaceDemo(next);
                  if (rows.length > 0) {
                    const baseline = next ? [] : existingEntries;
                    setRows((prev) => annotateImportBatch(prev, baseline));
                  }
                }}
                className="w-4 h-4 accent-[#45d1c6] cursor-pointer"
              />
            </label>
          )}

          {errorMsg && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-[#f06292]/10 border border-[#f06292]/30 text-xs text-[#f06292]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {rows.length > 0 && (
            <div className="space-y-3">
              {/* Summary Badges */}
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                <span className="px-2.5 py-1 rounded-lg bg-cardElevated border border-line text-slate-200">
                  Файлы: {fileLabels.join(', ')}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-[#45d1c6]/10 border border-[#45d1c6]/30 text-[#45d1c6]">
                  К импорту: {newRowsCount}
                </span>
                {duplicateCount > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-cardElevated border border-line text-slate-400">
                    Дубликатов пропущено: {duplicateCount}
                  </span>
                )}
                {autoRewatchCount > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-[#d6b85a]/10 border border-[#d6b85a]/30 text-[#d6b85a]">
                    ↺ Авто-пересмотров: {autoRewatchCount}
                  </span>
                )}
                {withoutTimeCount > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-cardElevated border border-line text-slate-400">
                    Без времени суток: {withoutTimeCount}
                  </span>
                )}
              </div>

              {/* Preview Table */}
              <div className="rounded-xl border border-line bg-canvas/50 overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-cardElevated text-[10px] font-mono uppercase text-slate-400 sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Фильм</th>
                      <th className="py-2 px-3">Дата</th>
                      <th className="py-2 px-3">Оценка</th>
                      <th className="py-2 px-3">Статус</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {rows.slice(0, 50).map((r) => (
                      <tr key={r.tempId} className={r.isDuplicate ? 'opacity-45' : ''}>
                        <td className="py-2 px-3 text-slate-200">
                          {r.title}{' '}
                          {r.releaseYear && (
                            <span className="font-mono text-slate-500">({r.releaseYear})</span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-400">{r.watchedDate}</td>
                        <td className="py-2 px-3 font-mono text-[#d6b85a]">
                          {r.rating !== null ? `${r.rating.toFixed(1)}★` : '—'}
                        </td>
                        <td className="py-2 px-3 font-mono text-[10px]">
                          {r.isDuplicate ? (
                            <span className="text-slate-500">Дубликат</span>
                          ) : r.isRewatch ? (
                            <span className="text-[#d6b85a]">↺ Пересмотр</span>
                          ) : (
                            <span className="text-[#45d1c6]">Новый</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {rows.length > 50 && (
                <p className="text-[11px] font-mono text-slate-500">
                  Показаны первые 50 из {rows.length} строк.
                </p>
              )}
            </div>
          )}

          {progress && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-mono text-slate-400">
                <span>Обогащение метаданных через TMDB Edge Function...</span>
                <span>
                  {progress.done} / {progress.total}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-canvas border border-line overflow-hidden">
                <div
                  className="h-full bg-[#45d1c6] transition-all"
                  style={{ width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-cardElevated transition-colors cursor-pointer"
            >
              Закрыть
            </button>
            <button
              type="button"
              disabled={newRowsCount === 0 || importing}
              onClick={() => void handleConfirm()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#45d1c6] hover:bg-[#5ee0d6] disabled:opacity-40 text-[#0b0e17] transition-colors cursor-pointer"
            >
              {importing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              Импортировать ({newRowsCount})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
