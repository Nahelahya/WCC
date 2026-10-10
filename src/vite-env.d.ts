/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'mock' = data localStorage (tanpa server), 'live' = backend REST asli. */
  readonly VITE_API_MODE?: 'mock' | 'live'
  /** URL dasar API. Default '/api' (diteruskan proxy Vite ke backend). */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
