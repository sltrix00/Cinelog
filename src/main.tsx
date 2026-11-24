import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './index.css';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { applyThemeToDocument, loadUserSettings } from './lib/settings';

const initialSettings = loadUserSettings();
applyThemeToDocument(initialSettings.theme, initialSettings.accent);

let isFramed = false;
try {
  isFramed = window.self !== window.top;
} catch {
  isFramed = true;
}

function FrameBlockedNotice() {
  return (
    <div className="min-h-screen bg-canvas text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md rounded-2xl bg-card border border-lineStrong p-6 text-center space-y-4">
        <h1 className="text-base font-semibold text-white">Запуск во фрейме запрещён</h1>
        <p className="text-xs text-slate-400 leading-relaxed">
          В целях защиты аккаунта Cinelog не может открываться внутри стороннего iframe.
        </p>
        <a
          href={window.location.href}
          target="_top"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center min-h-10 px-4 py-2.5 rounded-xl bg-[#45d1c6] text-[#0b0e17] text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6] focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        >
          Открыть в отдельной вкладке
        </a>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>{isFramed ? <FrameBlockedNotice /> : <App />}</ErrorBoundary>
  </StrictMode>
);
