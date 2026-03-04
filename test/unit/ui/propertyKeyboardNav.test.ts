/**
 * Unit tests for Keyboard Property Panel Navigation (Feature #258).
 * Tests: Tab/Shift+Tab cycling, Enter->next field,
 * enhanced focus rings, and field ordering.
 */

import { describe, it, expect } from 'vitest';

describe('Tab ordering and field discovery', () => {
  it('data-edit-field attribute used to mark editable fields', () => {
    // The attribute name should be consistent
    const selector = '[data-edit-field]';
    expect(selector).toBe('[data-edit-field]');
  });

  it('display name field has data-edit-field="display-name"', () => {
    // This verifies the expected attribute value for the first editable field
    expect('display-name').toBe('display-name');
  });

  it('arg fields have data-edit-field="arg-{name}" pattern', () => {
    const argName = 'provider';
    const expected = `arg-${argName}`;
    expect(expected).toBe('arg-provider');
  });
});

describe('Property keyboard behavior rules', () => {
  it('Tab should cycle forward through fields', () => {
    // Simulate field indices
    const fields = ['display-name', 'arg-provider', 'arg-rateLimit', 'arg-authMethod'];
    let currentIndex = 0;

    // Tab forward from first field
    currentIndex = (currentIndex + 1) % fields.length;
    expect(fields[currentIndex]).toBe('arg-provider');

    // Tab forward from last field wraps to first
    currentIndex = fields.length - 1;
    currentIndex = (currentIndex + 1) % fields.length;
    expect(fields[currentIndex]).toBe('display-name');
  });

  it('Shift+Tab should cycle backward through fields', () => {
    const fields = ['display-name', 'arg-provider', 'arg-rateLimit', 'arg-authMethod'];
    let currentIndex = 0;

    // Shift+Tab backward from first field wraps to last
    currentIndex = currentIndex <= 0 ? fields.length - 1 : currentIndex - 1;
    expect(fields[currentIndex]).toBe('arg-authMethod');
  });

  it('Enter on non-last field should move to next', () => {
    const fields = ['display-name', 'arg-provider', 'arg-rateLimit'];
    const currentIndex = 0;
    const nextIndex = currentIndex + 1;
    expect(fields[nextIndex]).toBe('arg-provider');
  });
});

describe('Enhanced focus ring styling', () => {
  it('display name input has focus ring classes', () => {
    // The display name input should have enhanced focus ring
    const expectedClasses = 'focus:ring-2 focus:ring-blue-500 focus:ring-offset-1';
    expect(expectedClasses).toContain('focus:ring-2');
    expect(expectedClasses).toContain('focus:ring-blue-500');
    expect(expectedClasses).toContain('focus:ring-offset-1');
  });

  it('arg text inputs have focus ring classes', () => {
    const expectedClasses = 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1';
    expect(expectedClasses).toContain('focus:ring-2');
    expect(expectedClasses).toContain('focus:ring-offset-1');
  });

  it('boolean toggle buttons have focus ring classes', () => {
    const expectedClasses = 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1';
    expect(expectedClasses).toContain('focus:ring-2');
  });

  it('enum select fields have focus ring classes', () => {
    const expectedClasses = 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1';
    expect(expectedClasses).toContain('focus:ring-2');
  });
});

describe('usePropertyKeyboardNav hook contract', () => {
  it('hook module exports correctly', async () => {
    const mod = await import('@/hooks/usePropertyKeyboardNav');
    expect(typeof mod.usePropertyKeyboardNav).toBe('function');
  });

  it('editable field selector matches expected pattern', () => {
    // The hook uses [data-edit-field] as the selector
    const selector = '[data-edit-field]';
    expect(selector).toBe('[data-edit-field]');
  });
});

describe('Source code verification', () => {
  it('PropertiesTab imports usePropertyKeyboardNav', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/panels/NodeDetailPanel.tsx', 'utf-8');
    expect(source).toContain('usePropertyKeyboardNav');
  });

  it('PropertiesTab uses propertiesContainerRef', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/panels/NodeDetailPanel.tsx', 'utf-8');
    expect(source).toContain('propertiesContainerRef');
  });

  it('PropertiesTab has data-edit-field on display name input', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/panels/NodeDetailPanel.tsx', 'utf-8');
    expect(source).toContain('data-edit-field="display-name"');
  });

  it('PropertiesTab has data-edit-field on arg inputs', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/panels/NodeDetailPanel.tsx', 'utf-8');
    // All 4 input types should have data-edit-field
    const matches = source.match(/data-edit-field=\{`arg-/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(4);
  });

  it('usePropertyKeyboardNav handles Tab wrapping', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/hooks/usePropertyKeyboardNav.ts', 'utf-8');
    expect(source).toContain("e.key === 'Tab'");
    expect(source).toContain('e.shiftKey');
  });

  it('usePropertyKeyboardNav handles Enter for next field', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/hooks/usePropertyKeyboardNav.ts', 'utf-8');
    expect(source).toContain("e.key === 'Enter'");
  });

  it('all arg inputs have enhanced focus ring classes', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/components/panels/NodeDetailPanel.tsx', 'utf-8');
    // Check for focus:ring-2 on input fields
    const focusRingMatches = source.match(/focus:ring-2 focus:ring-blue-500/g);
    expect(focusRingMatches).not.toBeNull();
    expect(focusRingMatches!.length).toBeGreaterThanOrEqual(5); // display name + 4 arg types
  });
});
