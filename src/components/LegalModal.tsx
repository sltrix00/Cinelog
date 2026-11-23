import { ExternalLink, FileText, ShieldCheck, X } from 'lucide-react';
import { useModalA11y } from './useModalA11y';

export type LegalTab = 'privacy' | 'terms';

interface LegalModalProps {
  tab: LegalTab | null;
  onChangeTab: (tab: LegalTab) => void;
  onClose: () => void;
}

export function LegalModal({ tab, onChangeTab, onClose }: LegalModalProps) {
  const modalRef = useModalA11y<HTMLDivElement>({
    open: Boolean(tab),
    onClose,
  });

  if (!tab) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-modal-title"
        tabIndex={-1}
        className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl bg-card border border-lineStrong shadow-2xl overflow-hidden focus:outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line shrink-0">
          <div className="flex items-center gap-2">
            {tab === 'privacy' ? (
              <ShieldCheck className="w-4 h-4 text-[#45d1c6]" aria-hidden="true" />
            ) : (
              <FileText className="w-4 h-4 text-[#d6b85a]" aria-hidden="true" />
            )}
            <h3 id="legal-modal-title" className="text-sm font-semibold text-white">
              Правовая информация и TMDB
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="w-9 h-9 inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-cardElevated transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Правовые документы"
          className="px-5 pt-3 pb-2.5 border-b border-line flex flex-wrap items-center gap-2 shrink-0 bg-canvas/40"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'privacy'}
            onClick={() => onChangeTab('privacy')}
            className={
              tab === 'privacy'
                ? 'min-h-9 px-3.5 py-1.5 rounded-xl text-xs font-medium bg-cardElevated text-white border border-lineStrong cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]'
                : 'min-h-9 px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]'
            }
          >
            Политика конфиденциальности
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'terms'}
            onClick={() => onChangeTab('terms')}
            className={
              tab === 'terms'
                ? 'min-h-9 px-3.5 py-1.5 rounded-xl text-xs font-medium bg-cardElevated text-white border border-lineStrong cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]'
                : 'min-h-9 px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]'
            }
          >
            Условия использования и TMDB
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs text-slate-300 leading-relaxed">
          {tab === 'privacy' ? (
            <>
              <section className="space-y-1.5">
                <h4 className="text-sm font-semibold text-white">1. Какие данные мы собираем</h4>
                <p>
                  В демо-режиме все действия выполняются локально в памяти вашего браузера и никуда не
                  отправляются. При создании аккаунта через Email или Google OAuth сохраняются ваш
                  адрес электронной почты, имя профиля (если указано), часовой пояс и добавленные
                  вами записи о просмотрах фильмов.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="text-sm font-semibold text-white">2. Хранение и защита данных (Supabase RLS)</h4>
                <p>
                  Персональный журнал хранится в базе данных PostgreSQL на инфраструктуре Supabase с
                  включённым Row Level Security (RLS). Это гарантирует строгую изоляцию на уровне базы
                  данных: доступ на чтение, редактирование и удаление ваших записей есть только у
                  вашей авторизованной учётной записи.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="text-sm font-semibold text-white">3. Запросы к TMDB</h4>
                <p>
                  Для поиска фильмов и загрузки метаданных (режиссёров, жанров, стран и длительности)
                  используется серверная Edge Function{' '}
                  <code className="px-1.5 py-0.5 rounded bg-canvas border border-line text-[#45d1c6]">
                    tmdb-proxy
                  </code>
                  . В запросы к TMDB передаются только названия и годы выхода фильмов — ваши личные
                  данные, оценки и история просмотров третьим лицам не передаются.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="text-sm font-semibold text-white">4. Экспорт и удаление данных</h4>
                <p>
                  Вы можете в любой момент выгрузить свой журнал в формате JSON прямо из раздела
                  «Журнал», отредактировать или удалить отдельные записи просмотров.
                </p>
              </section>
            </>
          ) : (
            <>
              <section className="space-y-1.5">
                <h4 className="text-sm font-semibold text-white">1. Назначение сервиса</h4>
                <p>
                  Cinelog предоставляется «как есть» в качестве персонального инструмента для ведения
                  дневника и анализа статистики просмотров фильмов. Вы несёте ответственность за
                  сохранность доступа к своей учётной записи и корректность импортируемых файлов.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="text-sm font-semibold text-white">2. Ограничения и квоты</h4>
                <p>
                  Для стабильной работы облачной базы данных действует разумное ограничение на объём
                  персонального архива (до 10 000 записей просмотров на аккаунт). Автоматический сбор
                  данных, злоупотребление API-прокси или попытки обхода ограничений доступа
                  запрещены.
                </p>
              </section>

              <section className="rounded-xl bg-canvas border border-[#45d1c6]/30 p-4 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold tracking-wide text-[#45d1c6]">
                    TMDB API Attribution
                  </span>
                  <a
                    href="https://www.themoviedb.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#45d1c6] hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
                  >
                    themoviedb.org
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                </div>
                <p className="text-xs text-slate-300">
                  This product uses the TMDB API but is not endorsed or certified by TMDB.
                </p>
                <p className="text-xs text-slate-400">
                  Информация о фильмах, продолжительности, режиссёрах, жанрах и странах предоставлена
                  базой данных The Movie Database (TMDB).
                </p>
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-line flex items-center justify-end bg-canvas/40 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 px-4 py-2 rounded-xl bg-cardElevated hover:bg-lineStrong border border-line text-xs font-medium text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
