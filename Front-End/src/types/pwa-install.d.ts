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

export {};
