import { useEffect, useState, type FormEvent } from 'react';
import {
  AtSign,
  Check,
  CircleUserRound,
  Eye,
  EyeOff,
  Loader2,
  LogOut,
  Mail,
  X,
} from 'lucide-react';
import { isRepeatedSignupResponse, localizeAuthError } from '../lib/authHelpers';
import {
  getProfileInitials,
  maskEmailAsPassword,
  validateNicknameInput,
} from '../lib/headerHelpers';
import { updateUserNickname } from '../lib/profileService';
import {
  isSupabaseConfigured,
  resetPasswordByEmail,
  signInWithEmail,
  signInWithGoogle,
  signOutAccount,
  signUpWithEmail,
  updateAccountPassword,
} from '../lib/supabase';
import { useModalA11y } from './useModalA11y';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  userEmail: string | null;
  userNickname?: string | null;
  watchCount?: number;
  uniqueFilmsCount?: number;
  isPasswordRecovery?: boolean;
  initialMode?: 'login' | 'register';
  initialNotice?: { type: 'error' | 'success'; text: string } | null;
  onNicknameUpdated?: (nickname: string | null) => void;
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
  userNickname = null,
  watchCount,
  uniqueFilmsCount,
  isPasswordRecovery = false,
  initialMode = 'login',
  initialNotice = null,
  onNicknameUpdated,
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

  const [nicknameDraft, setNicknameDraft] = useState(userNickname ?? '');
  const [savingNickname, setSavingNickname] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showEmail, setShowEmail] = useState(false);

  const busy = loading || googleLoading || savingNickname || loggingOut;

  const handleClose = () => {
    setMessage(null);
    if (isPasswordRecovery) {
      onCancelPasswordRecovery?.();
      return;
    }
    onClose();
  };

  const modalRef = useModalA11y<HTMLDivElement>({
    open,
    onClose: handleClose,
    disabled: busy,
  });

  useEffect(() => {
    if (!open) return;
    setShowEmail(false);
    if (initialNotice) {
      setMode('login');
      setMessage(initialNotice);
    } else if (!isPasswordRecovery) {
      setMode(initialMode);
      setMessage(null);
    }
  }, [open, initialMode, initialNotice, isPasswordRecovery]);

  useEffect(() => {
    if (!open) return;
    setNicknameDraft(userNickname ?? '');
  }, [open, userNickname]);

  if (!open) return null;

  const isProfileView = !isPasswordRecovery && Boolean(userEmail);

  const nicknameValidation = validateNicknameInput(nicknameDraft);
  const currentNickname = userNickname?.trim() || null;
  const hasNicknameChanges = nicknameValidation.normalized !== currentNickname;
  const profileInitials = getProfileInitials(currentNickname);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setMessage(null);
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
    setLoggingOut(true);
    setMessage(null);
    try {
      await signOutAccount();
      handleClose();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      setMessage({
        type: 'error',
        text: raw ? localizeAuthError(raw) : 'Не удалось выйти из аккаунта.',
      });
    } finally {
      setLoggingOut(false);
    }
  };

  const handleNicknameSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (savingNickname || loggingOut) return;

    if (!nicknameValidation.valid) {
      setMessage({
        type: 'error',
        text: nicknameValidation.error ?? 'Некорректный никнейм.',
      });
      return;
    }

    if (!hasNicknameChanges) return;

    setSavingNickname(true);
    setMessage(null);
    try {
      const saved = await updateUserNickname(nicknameDraft);
      setNicknameDraft(saved ?? '');
      onNicknameUpdated?.(saved);
      setMessage({
        type: 'success',
        text: saved ? 'Никнейм сохранён.' : 'Никнейм удалён.',
      });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Не удалось обновить никнейм.',
      });
    } finally {
      setSavingNickname(false);
    }
  };

  const modalTitle = isPasswordRecovery
    ? 'Новый пароль'
    : mode === 'login'
      ? 'Вход в аккаунт'
      : mode === 'register'
        ? 'Создать аккаунт'
        : 'Восстановление пароля';

  const modalSubtitle = isPasswordRecovery
    ? 'Придумайте новый пароль для входа в Cinelog'
    : mode === 'reset'
      ? 'Отправим ссылку для сброса пароля на ваш email'
      : 'Синхронизация вашего киножурнала в облаке';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPasswordRecovery && !busy) handleClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl bg-card border border-lineStrong shadow-2xl overflow-hidden focus:outline-none"
      >
        {isProfileView && userEmail ? (
          <>
            {/* Profile Hero Header */}
            <div className="relative px-6 pt-6 pb-5 border-b border-line bg-gradient-to-b from-[#45d1c6]/[0.07] via-[#f06292]/[0.04] to-transparent">
              <div
                className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[#45d1c6]/60 to-transparent"
                aria-hidden="true"
              />
              <button
                type="button"
                disabled={busy}
                onClick={handleClose}
                aria-label="Закрыть"
                className="absolute top-3.5 right-3.5 w-9 h-9 inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-cardElevated disabled:opacity-40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>

              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#f06292]/35 via-[#45d1c6]/25 to-[#d6b85a]/30 p-[1.5px] shadow-lg">
                  <div className="w-full h-full rounded-[14.5px] bg-canvas flex items-center justify-center">
                    {profileInitials ? (
                      <span className="text-lg font-bold tracking-wider text-white">
                        {profileInitials}
                      </span>
                    ) : (
                      <CircleUserRound className="w-7 h-7 text-[#45d1c6]" aria-hidden="true" />
                    )}
                  </div>
                </div>

                <h3 id="auth-modal-title" className="mt-3 text-lg font-bold tracking-tight text-white">
                  {currentNickname ?? 'Профиль'}
                </h3>

                <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#45d1c6]/10 border border-[#45d1c6]/25 text-xs font-medium text-[#45d1c6]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#45d1c6] animate-pulse" aria-hidden="true" />
                  <span>Облачная синхронизация</span>
                </div>

                {watchCount !== undefined && (
                  <div className="mt-4 w-full grid grid-cols-2 gap-2.5">
                    <div className="rounded-xl bg-canvas/75 border border-line px-3 py-2 text-center">
                      <div className="text-xs text-slate-400">Просмотров</div>
                      <div className="text-sm font-bold font-mono tabular-nums text-white mt-0.5">
                        {watchCount}
                      </div>
                    </div>
                    <div className="rounded-xl bg-canvas/75 border border-line px-3 py-2 text-center">
                      <div className="text-xs text-slate-400">Уникальных фильмов</div>
                      <div className="text-sm font-bold font-mono tabular-nums text-[#45d1c6] mt-0.5">
                        {uniqueFilmsCount ?? watchCount}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Profile Body */}
            <div className="px-6 py-5 space-y-4">
              {/* Nickname Section */}
              <form
                onSubmit={handleNicknameSubmit}
                className="rounded-xl bg-canvas/80 border border-line p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="profileNickname"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300"
                  >
                    <AtSign className="w-3.5 h-3.5 text-[#f06292]" aria-hidden="true" />
                    <span>Никнейм</span>
                  </label>
                  <span className="text-xs text-slate-400">3–32 симв. · A–Z, 0–9, _ . -</span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="profileNickname"
                    type="text"
                    maxLength={32}
                    value={nicknameDraft}
                    onChange={(e) => setNicknameDraft(e.target.value)}
                    placeholder="Придумайте никнейм"
                    disabled={savingNickname || loggingOut}
                    className="min-w-0 flex-1 min-h-10 px-3 py-2 rounded-xl bg-card border border-line text-sm text-white placeholder-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6] focus:border-[#45d1c6] disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={
                      !hasNicknameChanges ||
                      !nicknameValidation.valid ||
                      savingNickname ||
                      loggingOut
                    }
                    className="shrink-0 inline-flex items-center gap-1.5 min-h-10 px-3.5 py-2 rounded-xl bg-[#45d1c6] hover:bg-[#5ee0d6] disabled:opacity-40 text-[#0b0e17] text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
                  >
                    {savingNickname ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                    )}
                    <span>Сохранить</span>
                  </button>
                </div>

                {!nicknameValidation.valid && nicknameDraft.trim().length > 0 && (
                  <p className="text-xs text-[#f06292]">{nicknameValidation.error}</p>
                )}
                {currentNickname && nicknameDraft.trim().length === 0 && (
                  <p className="text-xs text-slate-400">
                    Оставьте пустым, чтобы скрыть никнейм
                  </p>
                )}
              </form>

              {/* Masked Email Section */}
              <div className="rounded-xl bg-canvas/80 border border-line p-4 space-y-2">
                <div className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300">
                  <Mail className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                  <span>Электронная почта</span>
                </div>
                <div className="flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-card border border-line">
                  <span
                    className={
                      showEmail
                        ? 'font-mono text-sm text-slate-100 truncate select-all'
                        : 'tracking-[0.2em] text-sm text-slate-300 select-none truncate'
                    }
                  >
                    {showEmail ? userEmail : maskEmailAsPassword(userEmail)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowEmail((prev) => !prev)}
                    aria-label={showEmail ? 'Скрыть почту' : 'Показать почту'}
                    aria-pressed={showEmail}
                    className="w-9 h-9 inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-cardElevated transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
                  >
                    {showEmail ? (
                      <EyeOff className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <Eye className="w-4 h-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              {message && (
                <div
                  role={message.type === 'error' ? 'alert' : 'status'}
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
                type="button"
                disabled={busy}
                onClick={() => void handleLogout()}
                className="w-full inline-flex items-center justify-center gap-2 min-h-10 px-4 py-2.5 rounded-xl bg-[#f06292]/10 hover:bg-[#f06292]/20 disabled:opacity-50 border border-[#f06292]/25 text-xs font-semibold text-[#f06292] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f06292]"
              >
                {loggingOut ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>Выйти из аккаунта</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="relative px-6 pt-6 pb-2 text-center">
              <button
                type="button"
                disabled={busy}
                onClick={handleClose}
                aria-label="Закрыть"
                className="absolute top-3.5 right-3.5 w-9 h-9 inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-cardElevated disabled:opacity-40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
              <h3 id="auth-modal-title" className="text-lg font-semibold tracking-tight text-white">
                {modalTitle}
              </h3>
              <p className="text-xs text-slate-400 mt-1">{modalSubtitle}</p>
            </div>

            <div className="px-6 pb-6 pt-3 space-y-4">
              {isPasswordRecovery ? (
                <form onSubmit={handlePasswordRecoverySubmit} className="space-y-3.5">
                  <div>
                    <label htmlFor="authNewPassword" className="block text-xs text-slate-300 mb-1">
                      Новый пароль
                    </label>
                    <input
                      id="authNewPassword"
                      type="password"
                      required
                      minLength={8}
                      maxLength={128}
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Минимум 8 символов (буквы и цифры)"
                      className="w-full min-h-10 px-3.5 py-2.5 rounded-xl bg-canvas border border-line text-sm text-white placeholder-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6] focus:border-[#45d1c6]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="authConfirmPassword"
                      className="block text-xs text-slate-300 mb-1"
                    >
                      Повторите пароль
                    </label>
                    <input
                      id="authConfirmPassword"
                      type="password"
                      required
                      minLength={8}
                      maxLength={128}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Введите пароль ещё раз"
                      className="w-full min-h-10 px-3.5 py-2.5 rounded-xl bg-canvas border border-line text-sm text-white placeholder-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6] focus:border-[#45d1c6]"
                    />
                  </div>

                  {message && (
                    <div
                      role={message.type === 'error' ? 'alert' : 'status'}
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
                    className="w-full inline-flex items-center justify-center gap-2 min-h-11 px-4 py-2.5 rounded-xl bg-[#f06292] hover:bg-[#f47ba4] disabled:opacity-50 text-[#0b0e17] text-sm font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                    Сохранить новый пароль
                  </button>
                </form>
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
                        className="w-full inline-flex items-center justify-center gap-2.5 min-h-11 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 active:scale-[0.99] disabled:opacity-50 text-[#1f1f1f] text-sm font-medium border border-white/15 shadow-sm transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
                      >
                        {googleLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin text-slate-600" aria-hidden="true" />
                        ) : (
                          <GoogleIcon />
                        )}
                        <span>
                          {mode === 'login' ? 'Войти через Google' : 'Продолжить через Google'}
                        </span>
                      </button>

                      <div className="relative flex items-center py-0.5">
                        <div className="flex-grow border-t border-line" />
                        <span className="shrink mx-3 text-xs font-mono uppercase text-slate-400">
                          или
                        </span>
                        <div className="flex-grow border-t border-line" />
                      </div>
                    </>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-3.5">
                    {mode === 'register' && (
                      <div>
                        <label htmlFor="authUsername" className="block text-xs text-slate-300 mb-1">
                          Никнейм (необязательно)
                        </label>
                        <input
                          id="authUsername"
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="cinephile_2026"
                          pattern="^[A-Za-z0-9_.-]{3,32}$"
                          className="w-full min-h-10 px-3.5 py-2.5 rounded-xl bg-canvas border border-line text-sm text-white placeholder-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6] focus:border-[#45d1c6]"
                        />
                      </div>
                    )}

                    <div>
                      <label htmlFor="authEmail" className="block text-xs text-slate-300 mb-1">
                        Email
                      </label>
                      <input
                        id="authEmail"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full min-h-10 px-3.5 py-2.5 rounded-xl bg-canvas border border-line text-sm text-white placeholder-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6] focus:border-[#45d1c6]"
                      />
                    </div>

                    {(mode === 'login' || mode === 'register') && (
                      <div>
                        <label htmlFor="authPassword" className="block text-xs text-slate-300 mb-1">
                          Пароль
                        </label>
                        <input
                          id="authPassword"
                          type="password"
                          required
                          minLength={mode === 'register' ? 8 : 6}
                          maxLength={128}
                          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={
                            mode === 'register'
                              ? 'Минимум 8 символов (буквы и цифры)'
                              : 'Введите пароль'
                          }
                          className="w-full min-h-10 px-3.5 py-2.5 rounded-xl bg-canvas border border-line text-sm text-white placeholder-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6] focus:border-[#45d1c6]"
                        />
                      </div>
                    )}

                    {message && (
                      <div
                        role={message.type === 'error' ? 'alert' : 'status'}
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
                      className="w-full inline-flex items-center justify-center gap-2 min-h-11 px-4 py-2.5 rounded-xl bg-[#f06292] hover:bg-[#f47ba4] disabled:opacity-50 text-[#0b0e17] text-sm font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
                    >
                      {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
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
                          className="min-h-9 px-2 text-xs text-[#45d1c6] hover:text-[#6ee3da] transition-colors cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
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
                          className="text-[#45d1c6] hover:text-[#6ee3da] font-medium transition-colors cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
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
                          className="text-[#45d1c6] hover:text-[#6ee3da] font-medium transition-colors cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
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
                          className="text-[#45d1c6] hover:text-[#6ee3da] font-medium transition-colors cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45d1c6]"
                        >
                          Вернуться ко входу
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
