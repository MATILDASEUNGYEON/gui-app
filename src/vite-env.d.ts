/// <reference types="vite/client" />

declare module '@grapesjs/studio-sdk/style';

interface ImportMetaEnv {
  readonly VITE_GRAPESJS_LICENSE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
