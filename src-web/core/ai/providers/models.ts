/**
 * Per-provider default model lists and max-token maps.
 *
 * Single source of truth consumed by providers (listModels() static
 * fallbacks, supportsTools() lookups) and, eventually, Settings UI. Not
 * exhaustive — a live listModels() call (OpenAI, Ollama) supersedes this at
 * runtime; this is the default/fallback list plus the metadata (max tokens,
 * supportsTools) that a live model-list endpoint doesn't provide.
 */

import type { ModelInfo } from '../types';

// ---------------------------------------------------------------------------
// Claude
// ---------------------------------------------------------------------------

export const CLAUDE_MODELS: ModelInfo[] = [
  { id: 'claude-opus-4-6-20250919', label: 'Claude Opus 4.6' },
  { id: 'claude-sonnet-4-6-20250919', label: 'Claude Sonnet 4.6' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
];

export const CLAUDE_MAX_TOKENS: Record<string, number> = {
  'claude-opus-4-6-20250919': 16384,
  'claude-sonnet-4-6-20250919': 16384,
  'claude-haiku-4-5-20251001': 8192,
};

export const CLAUDE_DEFAULT_MAX_TOKENS = 16384;
export const CLAUDE_DEFAULT_MODEL = 'claude-sonnet-4-6-20250919';

// ---------------------------------------------------------------------------
// OpenAI
// ---------------------------------------------------------------------------

export const OPENAI_MODELS: ModelInfo[] = [
  { id: 'gpt-4o', label: 'GPT-4o' },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
  { id: 'gpt-4.1', label: 'GPT-4.1' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
  { id: 'o3-mini', label: 'o3-mini' },
];

export const OPENAI_MAX_TOKENS: Record<string, number> = {
  'gpt-4o': 16384,
  'gpt-4o-mini': 16384,
  'gpt-4.1': 32768,
  'gpt-4.1-mini': 32768,
  'o3-mini': 65536,
};

export const OPENAI_DEFAULT_MAX_TOKENS = 4096;
export const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini';

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

export const GEMINI_MODELS: ModelInfo[] = [
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
  { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
  { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
];

export const GEMINI_MAX_TOKENS: Record<string, number> = {
  'gemini-2.0-flash': 8192,
  'gemini-2.0-flash-lite': 8192,
  'gemini-1.5-pro': 8192,
  'gemini-1.5-flash': 8192,
};

export const GEMINI_DEFAULT_MAX_TOKENS = 8192;
export const GEMINI_DEFAULT_MODEL = 'gemini-2.0-flash';

// ---------------------------------------------------------------------------
// Ollama
//
// Flags known non-tool-calling models (embedding-only, or old bases without
// function-calling support) via `supportsTools: false`. This is what drives
// OllamaProvider.supportsTools()'s degradation path (Decision 6 / Caveat 3):
// a model absent from this list defaults to `true` (coarse default), a model
// present with `supportsTools: false` degrades to conversation-only.
// ---------------------------------------------------------------------------

export const OLLAMA_DEFAULT_HOST = 'http://localhost:11434';

export const OLLAMA_MODELS: ModelInfo[] = [
  { id: 'llama3.1', label: 'Llama 3.1' },
  { id: 'llama3.1:70b', label: 'Llama 3.1 70B' },
  { id: 'qwen2.5', label: 'Qwen 2.5' },
  { id: 'qwen2.5-coder', label: 'Qwen 2.5 Coder' },
  { id: 'mistral', label: 'Mistral' },
  { id: 'mixtral', label: 'Mixtral' },
  // Embedding-only — no tool-calling support.
  { id: 'nomic-embed-text', label: 'Nomic Embed Text', supportsTools: false },
  { id: 'mxbai-embed-large', label: 'MXBai Embed Large', supportsTools: false },
  // Older base model without function-calling support.
  { id: 'llama2', label: 'Llama 2 (legacy)', supportsTools: false },
];

export const OLLAMA_MAX_TOKENS: Record<string, number> = {
  'llama3.1': 8192,
  'llama3.1:70b': 8192,
  'qwen2.5': 8192,
  'qwen2.5-coder': 8192,
  mistral: 8192,
  mixtral: 8192,
};

export const OLLAMA_DEFAULT_MAX_TOKENS = 4096;
export const OLLAMA_DEFAULT_MODEL = 'llama3.1';
