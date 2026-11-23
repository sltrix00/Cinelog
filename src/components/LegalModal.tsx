import { ExternalLink, FileText, ShieldCheck, X } from 'lucide-react';

export type LegalTab = 'privacy' | 'terms';

interface LegalModalProps {
  tab: LegalTab | null;
  onChangeTab: (tab: LegalTab) => void;
  onClose: () => void;
}

export function LegalModal({ tab, onChangeTab, onClose }: LegalModalProps) {
  if (!tab) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl bg-card border border-lineStrong shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line shrink-0">
          <div className="flex items-center gap-2">
            {tab === 'privacy' ? (
              <ShieldCheck className="w-4 h-4 text-[#45d1c6]" />
            ) : (
              <FileText className="w-4 h-4 text-[#d6b85a]" />
            )}
            <h3 className="text-sm font-semibold text-white">Правовая информация и TMDB</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-cardElevated transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3 pb-2 border-b border-line flex items-center gap-2 shrink-0 bg-canvas/40">
          <button
            type="button"
            onClick={() => onChangeTab('privacy')}
            className={
              tab === 'privacy'
                ? 'px-3.5 py-1.5 rounded-xl text-xs font-medium bg-cardElevated text-white border border-lineStrong cursor-pointer'
                : 'px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors cursor-pointer'
            }
          >
            Политика конфиденциальности
          </button>
          <button
            type="button"
            onClick={() => onChangeTab('terms')}
            className={
              tab === 'terms'
                ? 'px-3.5 py-1.5 rounded-xl text-xs font-medium bg-cardElevated text-white border border-lineStrong cursor-pointer'
                : 'px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors cursor-pointer'
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
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[#45d1c6] hover:underline"
                  >
                    themoviedb.org
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-xs text-slate-300">
                  This product uses the TMDB API but is not endorsed or certified by TMDB.
                </p>
                <p className="text-[11px] text-slate-400">
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
            className="px-4 py-2 rounded-xl bg-cardElevated hover:bg-lineStrong border border-line text-xs font-medium text-white transition-colors cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
