/**
 * AI module barrel export.
 *
 * Client for Anthropic Claude API, configuration, and suggestion parsing.
 */

// Client
export type { ChatMessage, SendMessageOptions, SendMessageResult } from './client';
export { AIClientError, sendMessage } from './client';

// Configuration
export {
  API_KEY_PREFERENCE_KEY,
  initializeApiKey,
  setStoredApiKey,
  clearStoredApiKey,
  getCachedApiKey,
  getAnthropicApiKey,
  isAIConfigured,
  aiConfig,
} from './config';

// Suggestion parser
export type { ParsedSuggestion } from './suggestionParser';
export { parseSuggestions, parseAISuggestions, stripSuggestionTags } from './suggestionParser';
