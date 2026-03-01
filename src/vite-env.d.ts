/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ANTHROPIC_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Allow importing YAML files
declare module '*.yaml' {
  const content: Record<string, unknown>;
  export default content;
}

declare module '*.yml' {
  const content: Record<string, unknown>;
  export default content;
}
