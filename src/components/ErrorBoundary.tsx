import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Непредвиденная ошибка интерфейса.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Cinelog ErrorBoundary caught an error:', error, info.componentStack);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, errorMessage: null });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-canvas text-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl bg-card border border-lineStrong p-6 shadow-2xl text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#f06292]/10 border border-[#f06292]/30 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6 text-[#f06292]" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-base font-bold text-white">Что-то пошло не так</h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              При отрисовке интерфейса произошла ошибка. Ваши сохранённые данные в безопасности.
            </p>
            {this.state.errorMessage && (
              <p className="mt-2 px-3 py-2 rounded-xl bg-canvas border border-line text-xs font-mono text-slate-300 break-words">
                {this.state.errorMessage}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={this.handleRetry}
              className="inline-flex items-center gap-1.5 min-h-10 px-4 py-2 rounded-xl bg-cardElevated hover:bg-lineStrong border border-line text-xs font-medium text-slate-200 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              Попробовать снова
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center gap-1.5 min-h-10 px-4 py-2 rounded-xl bg-[#45d1c6] hover:bg-[#5ce0d5] text-[#0b0e17] text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              Перезагрузить страницу
            </button>
          </div>
        </div>
      </div>
    );
  }
}
