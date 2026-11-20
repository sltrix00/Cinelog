/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function resolveSupabaseCspConnectSources(rawUrl?: string): string {
  const trimmed = rawUrl?.trim();
  if (!trimmed || trimmed.includes('YOUR-PROJECT-REF')) {
    return 'https://*.supabase.co wss://*.supabase.co';
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' && parsed.host) {
      return `https://${parsed.host} wss://${parsed.host}`;
    }
  } catch {
    // Fall back to wildcard pattern when URL is malformed
  }
  return 'https://*.supabase.co wss://*.supabase.co';
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const supabaseConnectSrc = resolveSupabaseCspConnectSources(
    process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL
  );

  return {
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'dev-csp-relax',
        apply: 'serve',
        transformIndexHtml(html) {
          return html
            .replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
            .replace(
              "connect-src 'self'",
              "connect-src 'self' ws: wss: http://localhost:* http://127.0.0.1:*"
            );
        },
      },
      {
        name: 'prod-csp-pin-supabase',
        apply: 'build',
        transformIndexHtml(html) {
          return html.replace('https://*.supabase.co wss://*.supabase.co', supabaseConnectSrc);
        },
      },
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
            charts: ['recharts'],
            supabase: ['@supabase/supabase-js'],
          },
        },
      },
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});
