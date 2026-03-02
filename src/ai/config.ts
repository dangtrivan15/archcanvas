/**
 * AI configuration module.
 * Loads the Anthropic API key from the VITE_ANTHROPIC_API_KEY environment variable.
 * Never hardcode API keys in source code.
 */

/**
 * Get the Anthropic API key from environment variables.
 * Returns undefined if not set.
 */
export function getAnthropicApiKey(): string | undefined {
  const key = import.meta.env.VITE_ANTHROPIC_API_KEY;
  return key && key.trim() !== '' ? key.trim() : undefined;
}

/**
 * Check if the Anthropic API key is configured.
 */
export function isAIConfigured(): boolean {
  return getAnthropicApiKey() !== undefined;
}

/**
 * AI configuration object.
 * All AI-related config should be centralized here.
 */
export const aiConfig = {
  /** Model to use for chat completions */
  model: 'claude-sonnet-4-20250514',
  /** Maximum tokens in response */
  maxTokens: 4096,
  /** API endpoint (uses default Anthropic endpoint) */
  get apiKey(): string | undefined {
    return getAnthropicApiKey();
  },
  /** Whether AI features are available */
  get isConfigured(): boolean {
    return isAIConfigured();
  },
} as const;
