import { useState, type FormEvent } from 'react';
import { Database, Loader2, LogOut, Sparkles, X } from 'lucide-react';
import {
  isSupabaseConfigured,
  signInWithEmail,
  signInWithGoogle,
  signOutAccount,
  signUpWithEmail,
} from '../lib/supabase';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  userEmail: string | null;
  isDemoMode: boolean;
  onEnableDemoMode: () => void;
  onAuthSuccess: () => void;
}

export function AuthModal({
  open,
  onClose,
  userEmail,
  isDemoMode,
  onEnableDemoMode,
  onAuthSuccess,
}: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setMessage({
        type: 'error',
        text: 'Укажите VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY в .env для облачной авторизации.',
      });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      if (mode === 'login') {
        const { error } = await signInWithEmail(email.trim(), password);
        if (error) throw error;
        onAuthSuccess();
        onClose();
      } else {
        const { data, error } = await signUpWithEmail(email.trim(), password, username);
        if (error) throw error;
        if (data.session) {
          onAuthSuccess();
          onClose();
        } else {
          setMessage({
            type: 'success',
            text: 'Проверьте почту для подтверждения аккаунта Supabase.',
          });
        }
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Ошибка аутентификации.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setMessage(null);
    const { error } = await signInWithGoogle();
    if (error) {
      setMessage({ type: 'error', text: error.message });
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOutAccount();
    onEnableDemoMode();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-card border border-lineStrong shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[#45d1c6]" />
            <h3 className="text-sm font-semibold text-white">Аккаунт и синхронизация Supabase</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-cardElevated transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {userEmail ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-canvas border border-line space-y-1">
                <span className="text-[11px] font-mono uppercase text-slate-500">Вы вошли как</span>
                <div className="text-sm font-mono font-semibold text-white">{userEmail}</div>
                <p className="text-xs text-[#45d1c6]">
                  Данные синхронизируются с PostgreSQL (RLS включён).
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                {!isDemoMode && (
                  <button
                    type="button"
                    onClick={() => {
                      onEnableDemoMode();
                      onClose();
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-cardElevated hover:bg-lineStrong border border-line text-xs font-medium text-slate-200 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#d6b85a]" />
                    Режим Демо (2024–2026)
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#f06292]/15 hover:bg-[#f06292]/25 border border-[#f06292]/30 text-xs font-medium text-[#f06292] transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Выйти
                </button>
              </div>
            </div>
          ) : (
            <>
              {!isSupabaseConfigured && (
                <div className="p-3 rounded-xl bg-[#d6b85a]/10 border border-[#d6b85a]/30 text-xs text-[#d6b85a] leading-relaxed">
                  Сейчас активен автономный <strong>Demo Mode</strong>. Чтобы включить облачную
                  синхронизацию, добавьте <span className="font-mono">VITE_SUPABASE_URL</span> и{' '}
                  <span className="font-mono">VITE_SUPABASE_PUBLISHABLE_KEY</span> в <span className="font-mono">.env</span>.
                </div>
              )}

              <div className="grid grid-cols-2 p-1 rounded-xl bg-canvas border border-line text-xs">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className={
                    mode === 'login'
                      ? 'py-1.5 rounded-lg bg-cardElevated text-white font-medium border border-lineStrong cursor-pointer'
                      : 'py-1.5 rounded-lg text-slate-400 hover:text-slate-200 cursor-pointer'
                  }
                >
                  Вход
                </button>
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className={
                    mode === 'register'
                      ? 'py-1.5 rounded-lg bg-cardElevated text-white font-medium border border-lineStrong cursor-pointer'
                      : 'py-1.5 rounded-lg text-slate-400 hover:text-slate-200 cursor-pointer'
                  }
                >
                  Регистрация
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                {mode === 'register' && (
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Никнейм (опц.)</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="cinephile_2026"
                      pattern="^[A-Za-z0-9_.-]{3,32}$"
                      className="w-full px-3.5 py-2 rounded-xl bg-canvas border border-line text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#45d1c6]"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2 rounded-xl bg-canvas border border-line text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#45d1c6]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Пароль</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Минимум 6 символов"
                    className="w-full px-3.5 py-2 rounded-xl bg-canvas border border-line text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#45d1c6]"
                  />
                </div>

                {message && (
                  <div
                    className={`p-3 rounded-xl text-xs border ${
                      message.type === 'error'
                        ? 'bg-[#f06292]/10 border-[#f06292]/30 text-[#f06292]'
                        : 'bg-[#45d1c6]/10 border-[#45d1c6]/30 text-[#45d1c6]'
                    }`}
                  >
                    {message.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !isSupabaseConfigured}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#f06292] hover:bg-[#f47ba4] disabled:opacity-50 text-[#0b0e17] text-xs font-semibold transition-colors cursor-pointer"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {mode === 'login' ? 'Войти в Cinelog' : 'Создать аккаунт'}
                </button>
              </form>

              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-line" />
                <span className="shrink mx-3 text-[10px] font-mono uppercase text-slate-500">или</span>
                <div className="flex-grow border-t border-line" />
              </div>

              <button
                type="button"
                disabled={loading || !isSupabaseConfigured}
                onClick={() => void handleGoogle()}
                className="w-full px-4 py-2.5 rounded-xl bg-canvas hover:bg-cardElevated disabled:opacity-50 border border-line text-xs font-medium text-slate-200 transition-colors cursor-pointer"
              >
                Продолжить через Google OAuth
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
