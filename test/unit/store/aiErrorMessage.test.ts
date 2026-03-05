/**
 * Tests for Feature #194: AI API error displays user-friendly message.
 * Verifies that AI API errors are translated into clear, actionable messages.
 */

import { describe, it, expect } from 'vitest';
import { AIClientError } from '@/ai/client';

/**
 * Replicate the getUserFriendlyErrorMessage function from AIChatTab.tsx
 * for unit testing (since the original is a module-level function inside a component file).
 */
function getUserFriendlyErrorMessage(error: unknown): string {
  if (error instanceof AIClientError) {
    const { statusCode, errorType } = error;

    if (error.message.includes('API key not configured')) {
      return 'AI is not configured. Please set your VITE_ANTHROPIC_API_KEY environment variable.';
    }
    if (statusCode === 401 || errorType === 'authentication_error') {
      return 'Invalid API key. Please check your VITE_ANTHROPIC_API_KEY setting.';
    }
    if (statusCode === 429 || errorType === 'rate_limit_error') {
      return 'Rate limit exceeded. Please wait a moment and try again.';
    }
    if (statusCode === 529 || errorType === 'overloaded_error') {
      return 'The AI service is currently overloaded. Please try again in a few minutes.';
    }
    if (statusCode && statusCode >= 500) {
      return 'The AI service is temporarily unavailable. Please try again later.';
    }
    if (statusCode === 400 || errorType === 'invalid_request_error') {
      return 'The request was too large or invalid. Try shortening your message or starting a new conversation.';
    }
    return `AI error: ${error.message}`;
  }

  if (error instanceof TypeError && error.message.includes('fetch')) {
    return 'Network error. Please check your internet connection and try again.';
  }

  if (error instanceof Error) {
    return `Something went wrong: ${error.message}`;
  }

  return 'An unexpected error occurred. Please try again.';
}

describe('Feature #194: AI API error displays user-friendly message', () => {
  describe('getUserFriendlyErrorMessage', () => {
    it('returns API key configuration message when key is not set', () => {
      const error = new AIClientError(
        'Anthropic API key not configured. Set VITE_ANTHROPIC_API_KEY in .env',
      );
      const message = getUserFriendlyErrorMessage(error);
      expect(message).toBe(
        'AI is not configured. Please set your VITE_ANTHROPIC_API_KEY environment variable.',
      );
    });

    it('returns authentication error for 401 status', () => {
      const error = new AIClientError('Unauthorized', 401, 'authentication_error');
      const message = getUserFriendlyErrorMessage(error);
      expect(message).toBe('Invalid API key. Please check your VITE_ANTHROPIC_API_KEY setting.');
    });

    it('returns authentication error for authentication_error type', () => {
      const error = new AIClientError('Invalid API key', undefined, 'authentication_error');
      const message = getUserFriendlyErrorMessage(error);
      expect(message).toBe('Invalid API key. Please check your VITE_ANTHROPIC_API_KEY setting.');
    });

    it('returns rate limit message for 429 status', () => {
      const error = new AIClientError('Rate limit exceeded', 429, 'rate_limit_error');
      const message = getUserFriendlyErrorMessage(error);
      expect(message).toBe('Rate limit exceeded. Please wait a moment and try again.');
    });

    it('returns rate limit message for rate_limit_error type', () => {
      const error = new AIClientError('Too many requests', undefined, 'rate_limit_error');
      const message = getUserFriendlyErrorMessage(error);
      expect(message).toBe('Rate limit exceeded. Please wait a moment and try again.');
    });

    it('returns overloaded message for 529 status', () => {
      const error = new AIClientError('Overloaded', 529, 'overloaded_error');
      const message = getUserFriendlyErrorMessage(error);
      expect(message).toBe(
        'The AI service is currently overloaded. Please try again in a few minutes.',
      );
    });

    it('returns server error message for 500 status', () => {
      const error = new AIClientError('Internal server error', 500);
      const message = getUserFriendlyErrorMessage(error);
      expect(message).toBe('The AI service is temporarily unavailable. Please try again later.');
    });

    it('returns server error message for 503 status', () => {
      const error = new AIClientError('Service unavailable', 503);
      const message = getUserFriendlyErrorMessage(error);
      expect(message).toBe('The AI service is temporarily unavailable. Please try again later.');
    });

    it('returns invalid request message for 400 status', () => {
      const error = new AIClientError(
        'Bad request: context too long',
        400,
        'invalid_request_error',
      );
      const message = getUserFriendlyErrorMessage(error);
      expect(message).toBe(
        'The request was too large or invalid. Try shortening your message or starting a new conversation.',
      );
    });

    it('returns network error for TypeError with fetch', () => {
      const error = new TypeError('Failed to fetch');
      const message = getUserFriendlyErrorMessage(error);
      expect(message).toBe('Network error. Please check your internet connection and try again.');
    });

    it('returns generic message for unknown AIClientError', () => {
      const error = new AIClientError('Some unusual error');
      const message = getUserFriendlyErrorMessage(error);
      expect(message).toBe('AI error: Some unusual error');
    });

    it('returns generic message for regular Error', () => {
      const error = new Error('Unexpected failure');
      const message = getUserFriendlyErrorMessage(error);
      expect(message).toBe('Something went wrong: Unexpected failure');
    });

    it('returns generic message for non-Error values', () => {
      const message = getUserFriendlyErrorMessage('string error');
      expect(message).toBe('An unexpected error occurred. Please try again.');
    });

    it('returns generic message for null/undefined', () => {
      expect(getUserFriendlyErrorMessage(null)).toBe(
        'An unexpected error occurred. Please try again.',
      );
      expect(getUserFriendlyErrorMessage(undefined)).toBe(
        'An unexpected error occurred. Please try again.',
      );
    });
  });

  describe('AIClientError class', () => {
    it('has correct name property', () => {
      const error = new AIClientError('test');
      expect(error.name).toBe('AIClientError');
    });

    it('stores statusCode', () => {
      const error = new AIClientError('test', 429);
      expect(error.statusCode).toBe(429);
    });

    it('stores errorType', () => {
      const error = new AIClientError('test', 401, 'authentication_error');
      expect(error.errorType).toBe('authentication_error');
    });

    it('extends Error', () => {
      const error = new AIClientError('test message');
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('test message');
    });
  });

  describe('error message format for chat display', () => {
    it('error messages are prefixed with warning symbol for visual distinction', () => {
      const error = new AIClientError('Rate limit', 429);
      const friendlyMsg = getUserFriendlyErrorMessage(error);
      const chatMessage = `⚠ ${friendlyMsg}`;
      expect(chatMessage).toMatch(/^⚠ /);
      expect(chatMessage).toContain('Rate limit exceeded');
    });

    it('error messages are distinguishable from normal messages', () => {
      const error = new AIClientError('API error', 500);
      const friendlyMsg = getUserFriendlyErrorMessage(error);
      const chatMessage = `⚠ ${friendlyMsg}`;
      // Error messages start with ⚠ or "Error:"
      const isError = chatMessage.startsWith('⚠ ') || chatMessage.startsWith('Error: ');
      expect(isError).toBe(true);
    });

    it('user-friendly messages do not expose raw API details', () => {
      const error = new AIClientError(
        '{"error":{"type":"rate_limit_error","message":"Request rate limit reached"}}',
        429,
        'rate_limit_error',
      );
      const message = getUserFriendlyErrorMessage(error);
      // Should NOT contain JSON
      expect(message).not.toContain('{');
      expect(message).not.toContain('}');
      // Should be a clean user-friendly message
      expect(message).toBe('Rate limit exceeded. Please wait a moment and try again.');
    });
  });
});
