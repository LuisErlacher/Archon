/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_HOST?: string
  readonly VITE_PORT?: string
  readonly VITE_ALLOWED_HOSTS?: string
  readonly VITE_SHOW_DEVTOOLS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
