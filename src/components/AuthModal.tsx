import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, LogOut, Sparkles, X } from 'lucide-react';
import { isRepeatedSignupResponse, localizeAuthError } from '../lib/authHelpers';
import {
  isSupabaseConfigured,
  resetPasswordByEmail,
  signInWithEmail,
  signInWithGoogle,
  signOutAccount,
  signUpWithEmail,
  updateAccountPassword,
} from '../lib/supabase';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  userEmail: string | null;
  isDemoMode: boolean;
  isPasswordRecovery?: boolean;
  initialMode?: 'login' | 'register';
  initialNotice?: { type: 'error' | 'success'; text: string } | null;
  onEnableDemoMode: () => void;
  onAuthSuccess: () => void;
  onPasswordRecoveryComplete?: () => void;
  onCancelPasswordRecovery?: () => void;
}

type AuthMode = 'login' | 'register' | 'reset';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function AuthModal({
  open,
  onClose,
  userEmail,
  isDemoMode,
  isPasswordRecovery = false,
  initialMode = 'login',
  initialNotice = null,
  onEnableDemoMode,
  onAuthSuccess,
  onPasswordRecoveryComplete,
  onCancelPasswordRecovery,
}: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initialNotice) {
      setMode('login');
      setMessage(initialNotice);
    } else if (!isPasswordRecovery) {
      setMode(initialMode);
    }
  }, [open, initialMode, initialNotice, isPasswordRecovery]);

  if (!open) return null;

  const busy = loading || googleLoading;

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setMessage(null);
  };

  const handleClose = () => {
    setMessage(null);
    if (isPasswordRecovery) {
      onCancelPasswordRecovery?.();
      return;
    }
    onClose();
  };

  const hasRequiredPasswordComplexity = (pwd: string) =>
    pwd.length >= 8 && pwd.length <= 128 && /(?=.*\p{L})(?=.*\d)/u.test(pwd);

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
        handleClose();
      } else if (mode === 'register') {
        if (!hasRequiredPasswordComplexity(password)) {
          throw new Error('Пароль должен быть от 8 до 128 символов и содержать буквы и цифры.');
        }
        const { data, error } = await signUpWithEmail(email.trim(), password, username);
        if (error) throw error;
        if (data.session) {
          onAuthSuccess();
          handleClose();
        } else if (isRepeatedSignupResponse(data.user)) {
          setMessage({
            type: 'error',
            text: 'Аккаунт с этим email уже существует (возможно, вы регистрировались через Google). Войдите через Google или по паролю — либо воспользуйтесь восстановлением пароля.',
          });
        } else {
          setMessage({
            type: 'success',
            text: 'Проверьте почту и перейдите по ссылке из письма, чтобы подтвердить регистрацию.',
          });
        }
      } else {
        const { error } = await resetPasswordByEmail(email.trim());
        if (error) throw error;
        setMessage({
          type: 'success',
          text: 'Письмо со ссылкой для сброса пароля отправлено на указанный email.',
        });
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      setMessage({
        type: 'error',
        text: localizeAuthError(raw),
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordRecoverySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!hasRequiredPasswordComplexity(newPassword)) {
      setMessage({
        type: 'error',
        text: 'Пароль должен быть от 8 до 128 символов и содержать буквы и цифры.',
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({
        type: 'error',
        text: 'Пароли не совпадают.',
      });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const { error } = await updateAccountPassword(newPassword);
      if (error) throw error;
      setNewPassword('');
      setConfirmPassword('');
      setMessage({
        type: 'success',
        text: 'Пароль успешно обновлён.',
      });
      onPasswordRecoveryComplete?.();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      setMessage({
        type: 'error',
        text: localizeAuthError(raw),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (!isSupabaseConfigured) return;
    setGoogleLoading(true);
    setMessage(null);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setMessage({ type: 'error', text: localizeAuthError(error.message) });
        setGoogleLoading(false);
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      setMessage({ type: 'error', text: localizeAuthError(raw) });
      setGoogleLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOutAccount();
    onEnableDemoMode();
    handleClose();
  };

  const modalTitle = isPasswordRecovery
    ? 'Новый пароль'
    : userEmail
      ? 'Ваш аккаунт'
      : mode === 'login'
        ? 'Вход в аккаунт'
        : mode === 'register'
          ? 'Создать аккаунт'
          : 'Восстановление пароля';

  const modalSubtitle = isPasswordRecovery
    ? 'Придумайте новый пароль для входа в Cinelog'
    : userEmail
      ? 'Облачная синхронизация вашего киножурнала'
      : mode === 'reset'
        ? 'Отправим ссылку для сброса пароля на ваш email'
        : 'Синхронизация вашего киножурнала в облаке';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPasswordRecovery) handleClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-card border border-lineStrong shadow-2xl overflow-hidden">
        <div className="relative px-6 pt-6 pb-2 text-center">
          <button
            type="button"
            onClick={handleClose}
            aria-label="Закрыть"
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-cardElevated transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          <h3 className="text-lg font-semibold tracking-tight text-white">{modalTitle}</h3>
          <p className="text-xs text-slate-400 mt-1">{modalSubtitle}</p>
        </div>

        <div className="px-6 pb-6 pt-3 space-y-4">
          {isPasswordRecovery ? (
            <form onSubmit={handlePasswordRecoverySubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Новый пароль</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Минимум 8 символов (буквы и цифры)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-canvas border border-line text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#45d1c6]"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Повторите пароль</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Введите пароль ещё раз"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-canvas border border-line text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#45d1c6]"
                />
              </div>

              {message && (
                <div
                  className={`p-3 rounded-xl text-xs border leading-relaxed ${
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
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#f06292] hover:bg-[#f47ba4] disabled:opacity-50 text-[#0b0e17] text-sm font-semibold transition-colors cursor-pointer"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Сохранить новый пароль
              </button>
            </form>
          ) : userEmail ? (
            <div className="space-y-4">
              {message && (
                <div
                  className={`p-3 rounded-xl text-xs border leading-relaxed ${
                    message.type === 'error'
                      ? 'bg-[#f06292]/10 border-[#f06292]/30 text-[#f06292]'
                      : 'bg-[#45d1c6]/10 border-[#45d1c6]/30 text-[#45d1c6]'
                  }`}
                >
                  {message.text}
                </div>
              )}

              <div className="p-4 rounded-xl bg-canvas border border-line space-y-1">
                <span className="text-[11px] font-mono uppercase text-slate-500">Вы вошли как</span>
                <div className="text-sm font-mono font-semibold text-white">{userEmail}</div>
                <p className="text-xs text-[#45d1c6]">Облачная синхронизация активна.</p>
              </div>

              <div className="flex items-center gap-2.5">
                {!isDemoMode && (
                  <button
                    type="button"
                    onClick={() => {
                      onEnableDemoMode();
                      handleClose();
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
                  <span className="font-mono">VITE_SUPABASE_PUBLISHABLE_KEY</span> в{' '}
                  <span className="font-mono">.env</span>.
                </div>
              )}

              {(mode === 'login' || mode === 'register') && (
                <>
                  <button
                    type="button"
                    disabled={busy || !isSupabaseConfigured}
                    onClick={() => void handleGoogle()}
                    className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 active:scale-[0.99] disabled:opacity-50 text-[#1f1f1f] text-sm font-medium border border-white/15 shadow-sm transition-all cursor-pointer"
                  >
                    {googleLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
                    ) : (
                      <GoogleIcon />
                    )}
                    <span>
                      {mode === 'login' ? 'Войти через Google' : 'Продолжить через Google'}
                    </span>
                  </button>

                  <div className="relative flex items-center py-0.5">
                    <div className="flex-grow border-t border-line" />
                    <span className="shrink mx-3 text-[11px] font-mono uppercase text-slate-500">
                      или
                    </span>
                    <div className="flex-grow border-t border-line" />
                  </div>
                </>
              )}

              <form onSubmit={handleSubmit} className="space-y-3.5">
                {mode === 'register' && (
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">
                      Никнейм (необязательно)
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="cinephile_2026"
                      pattern="^[A-Za-z0-9_.-]{3,32}$"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-canvas border border-line text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#45d1c6]"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-canvas border border-line text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#45d1c6]"
                  />
                </div>

                {(mode === 'login' || mode === 'register') && (
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Пароль</label>
                    <input
                      type="password"
                      required
                      minLength={mode === 'register' ? 8 : 6}
                      maxLength={128}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === 'register' ? 'Минимум 8 символов (буквы и цифры)' : 'Введите пароль'}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-canvas border border-line text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#45d1c6]"
                    />
                  </div>
                )}

                {message && (
                  <div
                    className={`p-3 rounded-xl text-xs border leading-relaxed ${
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
                  disabled={busy || !isSupabaseConfigured}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#f06292] hover:bg-[#f47ba4] disabled:opacity-50 text-[#0b0e17] text-sm font-semibold transition-colors cursor-pointer"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {mode === 'login'
                    ? 'Войти'
                    : mode === 'register'
                      ? 'Создать аккаунт'
                      : 'Отправить ссылку для сброса'}
                </button>

                {mode === 'login' && (
                  <div className="text-center pt-0.5">
                    <button
                      type="button"
                      onClick={() => switchMode('reset')}
                      className="text-xs text-[#45d1c6] hover:text-[#6ee3da] transition-colors cursor-pointer"
                    >
                      Забыли пароль?
                    </button>
                  </div>
                )}
              </form>

              <div className="border-t border-line pt-4 text-center text-xs text-slate-400">
                {mode === 'login' && (
                  <>
                    Нет аккаунта?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('register')}
                      className="text-[#45d1c6] hover:text-[#6ee3da] font-medium transition-colors cursor-pointer"
                    >
                      Зарегистрироваться
                    </button>
                  </>
                )}
                {mode === 'register' && (
                  <>
                    Уже есть аккаунт?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="text-[#45d1c6] hover:text-[#6ee3da] font-medium transition-colors cursor-pointer"
                    >
                      Войти
                    </button>
                  </>
                )}
                {mode === 'reset' && (
                  <>
                    Вспомнили пароль?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="text-[#45d1c6] hover:text-[#6ee3da] font-medium transition-colors cursor-pointer"
                    >
                      Вернуться ко входу
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
