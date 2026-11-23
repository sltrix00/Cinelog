import { validateNicknameInput } from './headerHelpers';
import { supabase } from './supabase';

export async function updateUserNickname(rawNickname: string): Promise<string | null> {
  if (!supabase) {
    throw new Error('Supabase не настроен.');
  }

  const { valid, normalized, error: validationError } = validateNicknameInput(rawNickname);
  if (!valid) {
    throw new Error(validationError ?? 'Некорректный никнейм.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user?.id) {
    throw new Error('Пользователь не авторизован.');
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ username: normalized })
    .eq('id', userData.user.id)
    .select('id, username')
    .maybeSingle<{ id: string; username: string | null }>();

  if (error) {
    if (error.code === '23505') {
      throw new Error('Этот никнейм уже занят. Попробуйте другой.');
    }
    if (error.code === '23514') {
      throw new Error(
        'Никнейм должен содержать 3–32 символа: латинские буквы, цифры, _, . или -.'
      );
    }
    throw new Error(`Не удалось сохранить никнейм: ${error.message}`);
  }

  if (!data) {
    throw new Error('Профиль не найден. Попробуйте перезайти в аккаунт.');
  }

  return data.username?.trim() || null;
}
