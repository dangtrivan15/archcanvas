/**
 * AI suggestion parser - extracts XML tag suggestions from AI responses.
 *
 * AI responses may contain inline suggestions in the format:
 *   <suggestion target="nodeId">suggestion content</suggestion>
 *
 * This parser extracts them into structured AISuggestion objects.
 */

import { ulid } from 'ulid';
import type { AISuggestion } from '@/types/ai';

/** A parsed suggestion extracted from AI response text. */
export interface ParsedSuggestion {
  /** Target node ID from the target attribute */
  targetNodeId: string;
  /** The suggestion content (text between tags) */
  content: string;
  /** The suggestion type (defaults to 'architecture') */
  suggestionType: string;
}

/**
 * Regular expression to match <suggestion> XML tags in AI responses.
 * Supports both single quotes and double quotes for attributes.
 * Captures:
 *   - Group 1: all attributes string
 *   - Group 2: suggestion content (between opening and closing tags)
 */
const SUGGESTION_REGEX = /<suggestion\s+([^>]*)>([\s\S]*?)<\/suggestion>/gi;

/**
 * Extract the value of a named attribute from an attribute string.
 * Supports both single and double quoted values, and unquoted values.
 */
function extractAttribute(attrString: string, attrName: string): string | undefined {
  // Match: attrName="value" or attrName='value' or attrName=value
  const regex = new RegExp(`${attrName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|(\\S+))`, 'i');
  const match = attrString.match(regex);
  if (!match) return undefined;
  return match[1] ?? match[2] ?? match[3];
}

/**
 * Parse an AI response string and extract all <suggestion> tags.
 *
 * @param responseText - The full AI response text
 * @returns Array of parsed suggestions found in the text
 *
 * @example
 * ```ts
 * const text = "Here's my suggestion: <suggestion target='node123'>Add a caching layer</suggestion>";
 * const suggestions = parseSuggestions(text);
 * // suggestions = [{ targetNodeId: 'node123', content: 'Add a caching layer', suggestionType: 'architecture' }]
 * ```
 */
export function parseSuggestions(responseText: string): ParsedSuggestion[] {
  const suggestions: ParsedSuggestion[] = [];

  // Reset regex lastIndex since it's global
  SUGGESTION_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = SUGGESTION_REGEX.exec(responseText)) !== null) {
    const attrString = match[1] ?? '';
    const content = (match[2] ?? '').trim();

    const targetNodeId = extractAttribute(attrString, 'target') ?? '';
    const suggestionType = extractAttribute(attrString, 'type') ?? 'architecture';

    suggestions.push({
      targetNodeId,
      content,
      suggestionType,
    });
  }

  return suggestions;
}

/**
 * Parse AI response and convert extracted suggestions to AISuggestion objects.
 * Each suggestion gets a unique ID and 'pending' status.
 *
 * @param responseText - The full AI response text
 * @returns Array of AISuggestion objects ready to store
 */
export function parseAISuggestions(responseText: string): AISuggestion[] {
  const parsed = parseSuggestions(responseText);

  return parsed.map((s) => ({
    id: ulid(),
    targetNodeId: s.targetNodeId || undefined,
    suggestionType: s.suggestionType,
    content: s.content,
    status: 'pending' as const,
  }));
}

/**
 * Strip suggestion XML tags from response text, leaving only the content.
 * Useful for displaying the clean response text to the user.
 *
 * @param responseText - The full AI response text with suggestion tags
 * @returns The text with suggestion tags removed but content preserved
 */
export function stripSuggestionTags(responseText: string): string {
  return responseText.replace(SUGGESTION_REGEX, '$2');
}
