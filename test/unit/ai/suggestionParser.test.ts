/**
 * Tests for AI suggestion parser - extracts XML tag suggestions from AI responses.
 * Feature #169: AI suggestion parser extracts XML tag suggestions.
 *
 * Verifies:
 * - Single suggestion extraction with target and content
 * - Multiple suggestion extraction
 * - Various attribute quoting styles
 * - Edge cases (no suggestions, empty content, nested text)
 * - Conversion to AISuggestion objects
 * - Tag stripping utility
 */

import { describe, it, expect } from 'vitest';
import { parseSuggestions, parseAISuggestions, stripSuggestionTags } from '@/ai/suggestionParser';

describe('AI Suggestion Parser - parseSuggestions', () => {
  it('extracts a single suggestion with target and content', () => {
    const response = `Here's my analysis: <suggestion target='node123'>Add caching layer</suggestion>`;
    const suggestions = parseSuggestions(response);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].targetNodeId).toBe('node123');
    expect(suggestions[0].content).toBe('Add caching layer');
  });

  it('extracts suggestion with double-quoted target attribute', () => {
    const response = `<suggestion target="nodeABC">Use async messaging</suggestion>`;
    const suggestions = parseSuggestions(response);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].targetNodeId).toBe('nodeABC');
    expect(suggestions[0].content).toBe('Use async messaging');
  });

  it('extracts multiple suggestions from a single response', () => {
    const response = `
      I recommend these changes:
      <suggestion target='node1'>Add a load balancer</suggestion>
      Also consider:
      <suggestion target='node2'>Implement rate limiting</suggestion>
      And finally:
      <suggestion target='node3'>Add health checks</suggestion>
    `;
    const suggestions = parseSuggestions(response);

    expect(suggestions).toHaveLength(3);
    expect(suggestions[0].targetNodeId).toBe('node1');
    expect(suggestions[0].content).toBe('Add a load balancer');
    expect(suggestions[1].targetNodeId).toBe('node2');
    expect(suggestions[1].content).toBe('Implement rate limiting');
    expect(suggestions[2].targetNodeId).toBe('node3');
    expect(suggestions[2].content).toBe('Add health checks');
  });

  it('returns empty array when no suggestions in response', () => {
    const response = 'This is a plain response with no suggestions.';
    const suggestions = parseSuggestions(response);

    expect(suggestions).toHaveLength(0);
    expect(suggestions).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(parseSuggestions('')).toEqual([]);
  });

  it('defaults suggestionType to architecture', () => {
    const response = `<suggestion target='node1'>Add caching</suggestion>`;
    const suggestions = parseSuggestions(response);

    expect(suggestions[0].suggestionType).toBe('architecture');
  });

  it('extracts custom suggestion type from type attribute', () => {
    const response = `<suggestion target='node1' type='performance'>Add caching layer</suggestion>`;
    const suggestions = parseSuggestions(response);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].suggestionType).toBe('performance');
    expect(suggestions[0].targetNodeId).toBe('node1');
    expect(suggestions[0].content).toBe('Add caching layer');
  });

  it('handles suggestion with no target attribute', () => {
    const response = `<suggestion target=''>General improvement suggestion</suggestion>`;
    const suggestions = parseSuggestions(response);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].targetNodeId).toBe('');
    expect(suggestions[0].content).toBe('General improvement suggestion');
  });

  it('handles multiline suggestion content', () => {
    const response = `<suggestion target='node1'>Add a caching layer
between the API gateway and the database
to reduce load</suggestion>`;
    const suggestions = parseSuggestions(response);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].targetNodeId).toBe('node1');
    expect(suggestions[0].content).toContain('Add a caching layer');
    expect(suggestions[0].content).toContain('between the API gateway');
    expect(suggestions[0].content).toContain('to reduce load');
  });

  it('trims whitespace from suggestion content', () => {
    const response = `<suggestion target='node1'>   Add caching   </suggestion>`;
    const suggestions = parseSuggestions(response);

    expect(suggestions[0].content).toBe('Add caching');
  });

  it('handles suggestion with ULID-style target ID', () => {
    const response = `<suggestion target='01ARZ3NDEKTSV4RRFFQ69G5FAV'>Optimize query</suggestion>`;
    const suggestions = parseSuggestions(response);

    expect(suggestions[0].targetNodeId).toBe('01ARZ3NDEKTSV4RRFFQ69G5FAV');
  });

  it('handles suggestion surrounded by markdown text', () => {
    const response = `## Architecture Review

Your system looks well-designed. Here are some improvements:

1. **Performance**: <suggestion target='db-node'>Add connection pooling to the database</suggestion>

2. **Reliability**: <suggestion target='api-gw'>Implement circuit breaker pattern</suggestion>

These changes would improve overall system resilience.`;

    const suggestions = parseSuggestions(response);

    expect(suggestions).toHaveLength(2);
    expect(suggestions[0].targetNodeId).toBe('db-node');
    expect(suggestions[0].content).toBe('Add connection pooling to the database');
    expect(suggestions[1].targetNodeId).toBe('api-gw');
    expect(suggestions[1].content).toBe('Implement circuit breaker pattern');
  });

  it('handles attributes with extra spaces', () => {
    const response = `<suggestion  target = "node1" >Add caching</suggestion>`;
    const suggestions = parseSuggestions(response);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].targetNodeId).toBe('node1');
    expect(suggestions[0].content).toBe('Add caching');
  });

  it('can be called multiple times (regex state resets)', () => {
    const response = `<suggestion target='node1'>First</suggestion>`;

    const result1 = parseSuggestions(response);
    const result2 = parseSuggestions(response);

    expect(result1).toHaveLength(1);
    expect(result2).toHaveLength(1);
    expect(result1[0].content).toBe('First');
    expect(result2[0].content).toBe('First');
  });
});

describe('AI Suggestion Parser - parseAISuggestions', () => {
  it('converts parsed suggestions to AISuggestion objects', () => {
    const response = `<suggestion target='node123'>Add caching layer</suggestion>`;
    const suggestions = parseAISuggestions(response);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].targetNodeId).toBe('node123');
    expect(suggestions[0].content).toBe('Add caching layer');
    expect(suggestions[0].status).toBe('pending');
    expect(suggestions[0].suggestionType).toBe('architecture');
    expect(suggestions[0].id).toBeDefined();
    expect(suggestions[0].id.length).toBeGreaterThan(0);
  });

  it('generates unique IDs for each suggestion', () => {
    const response = `
      <suggestion target='n1'>First</suggestion>
      <suggestion target='n2'>Second</suggestion>
    `;
    const suggestions = parseAISuggestions(response);

    expect(suggestions).toHaveLength(2);
    expect(suggestions[0].id).not.toBe(suggestions[1].id);
  });

  it('sets undefined targetNodeId for empty target', () => {
    const response = `<suggestion target=''>General suggestion</suggestion>`;
    const suggestions = parseAISuggestions(response);

    expect(suggestions[0].targetNodeId).toBeUndefined();
  });

  it('all suggestions have pending status', () => {
    const response = `
      <suggestion target='n1'>First</suggestion>
      <suggestion target='n2'>Second</suggestion>
      <suggestion target='n3'>Third</suggestion>
    `;
    const suggestions = parseAISuggestions(response);

    for (const suggestion of suggestions) {
      expect(suggestion.status).toBe('pending');
    }
  });
});

describe('AI Suggestion Parser - stripSuggestionTags', () => {
  it('removes suggestion tags but keeps content', () => {
    const response = `Here's my idea: <suggestion target='node1'>Add caching</suggestion> for better performance.`;
    const stripped = stripSuggestionTags(response);

    expect(stripped).toBe(`Here's my idea: Add caching for better performance.`);
    expect(stripped).not.toContain('<suggestion');
    expect(stripped).not.toContain('</suggestion>');
  });

  it('handles multiple suggestion tags', () => {
    const response = `<suggestion target='n1'>First</suggestion> and <suggestion target='n2'>Second</suggestion>`;
    const stripped = stripSuggestionTags(response);

    expect(stripped).toBe('First and Second');
  });

  it('returns original text when no suggestions present', () => {
    const response = 'Plain text with no suggestions.';
    const stripped = stripSuggestionTags(response);

    expect(stripped).toBe(response);
  });
});
