/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_ASAR_ENGINE_ORIGIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '@khmyznikov/pwa-install';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'pwa-install': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        name?: string;
        description?: string;
        icon?: string;
        'manifest-url'?: string;
        'manual-apple'?: string | boolean;
        'manual-chrome'?: string | boolean;
        'disable-chrome'?: string | boolean;
        'install-description'?: string;
        'use-local-storage'?: string | boolean;
      }, HTMLElement>;
    }
  }
}
