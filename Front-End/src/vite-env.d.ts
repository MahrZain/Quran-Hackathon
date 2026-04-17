/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_ASAR_ENGINE_ORIGIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
