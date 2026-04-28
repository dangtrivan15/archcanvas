/// <reference types="vite/client" />

declare module '*.yaml?raw' {
  const content: string;
  export default content;
}

interface ImportMetaEnv {
  /** Keycloak base URL, e.g. https://auth.archcanvas.dev */
  readonly VITE_KEYCLOAK_URL: string | undefined;
  /** Keycloak realm name, e.g. archcanvas */
  readonly VITE_KEYCLOAK_REALM: string | undefined;
  /** Keycloak public client ID, e.g. archcanvas-app */
  readonly VITE_KEYCLOAK_CLIENT_ID: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
