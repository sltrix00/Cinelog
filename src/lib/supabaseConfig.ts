// Lightweight Supabase configuration flags.
// Kept separate from ./supabase so the initial bundle does not pull in
// @supabase/supabase-js (~220 KB) just to know whether cloud mode is available.

export const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
export const supabaseKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ||
  '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseKey &&
    !supabaseUrl.includes('YOUR-PROJECT-REF') &&
    !supabaseKey.includes('xxxxxxxx')
);

/** Lazily loads the full Supabase client module (separate chunk). */
export function loadSupabase() {
  return import('./supabase');
}
