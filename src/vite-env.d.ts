/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GITHUB_CLIENT_ID?: string;
  readonly VITE_GITHUB_REDIRECT_URI?: string;
  readonly VITE_GITHUB_OAUTH_SCOPE?: string;
  readonly VITE_GITHUB_TOKEN_EXCHANGE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
