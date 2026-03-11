/**
 * Feature #224: Form fields have associated labels
 *
 * Verifies that all form inputs in the application have properly associated
 * label elements (via <label htmlFor> or aria-label attributes) for accessibility.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Helper: read source file content
function readSource(relativePath: string): string {
  const fullPath = path.resolve(__dirname, '../../../src', relativePath);
  return fs.readFileSync(fullPath, 'utf-8');
}

describe('Feature #224: Form fields have associated labels', () => {
  describe('Properties panel inputs (NodeDetailPanel)', () => {
    const source = readSource('components/panels/NodeDetailPanel.tsx');

    it('enum argument select has aria-label={argDef.name}', () => {
      // The enum select has aria-label bound to the arg name
      expect(source).toContain('aria-label={argDef.name}');
    });

    it('number argument input has aria-label={argDef.name}', () => {
      // number input also uses aria-label from arg definition
      const matches = source.match(/aria-label=\{argDef\.name\}/g);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBeGreaterThanOrEqual(3); // enum, number, boolean, string
    });

    it('boolean argument toggle has aria-label and aria-checked', () => {
      expect(source).toContain('aria-label={argDef.name}');
      expect(source).toContain('aria-checked={isChecked}');
      expect(source).toContain('role="switch"');
    });

    it('string argument input has aria-label={argDef.name}', () => {
      // All 4 arg types share aria-label={argDef.name}
      const matches = source.match(/aria-label=\{argDef\.name\}/g);
      expect(matches!.length).toBeGreaterThanOrEqual(4);
    });

    it('new property key input has associated label via htmlFor', () => {
      expect(source).toContain('htmlFor="new-property-key"');
      expect(source).toContain('id="new-property-key"');
    });

    it('new property value input has associated label via htmlFor', () => {
      expect(source).toContain('htmlFor="new-property-value"');
      expect(source).toContain('id="new-property-value"');
    });

    it('property value edit input has aria-label', () => {
      expect(source).toMatch(/aria-label=\{`Edit value for property \$\{key\}`\}/);
    });
  });

  describe('Note editor inputs (NodeDetailPanel)', () => {
    const source = readSource('components/panels/NodeDetailPanel.tsx');

    it('note author input has associated label via htmlFor', () => {
      expect(source).toContain('htmlFor="note-author"');
      expect(source).toContain('id="note-author"');
    });

    it('note content textarea has associated label via htmlFor', () => {
      expect(source).toContain('htmlFor="note-content"');
      expect(source).toContain('id="note-content"');
    });

    it('note tags input has aria-label', () => {
      expect(source).toContain('aria-label="Add tag"');
    });
  });

  describe('Code reference inputs (NodeDetailPanel)', () => {
    const source = readSource('components/panels/NodeDetailPanel.tsx');

    it('code reference path input has associated label via htmlFor', () => {
      expect(source).toContain('htmlFor="coderef-path"');
      expect(source).toContain('id="coderef-path"');
    });

    it('code reference role select has associated label via htmlFor', () => {
      expect(source).toContain('htmlFor="coderef-role"');
      expect(source).toContain('id="coderef-role"');
    });
  });

  describe('Search inputs', () => {
    it('NodeDef browser search has aria-label', () => {
      const source = readSource('components/panels/NodeDefBrowser.tsx');
      expect(source).toContain('aria-label="Search node types"');
    });

    it('NodeDef browser search has placeholder text', () => {
      const source = readSource('components/panels/NodeDefBrowser.tsx');
      expect(source).toContain('placeholder="Search node types..."');
    });
  });

  // AI chat input tests removed — AIChatTab component was removed (feature #532)

  describe('Toolbar inputs', () => {
    it('custom node name input has aria-label', () => {
      const source = readSource('components/toolbar/AddNodeButton.tsx');
      expect(source).toContain('aria-label="Custom node name"');
    });

    it('edge source select has associated label via htmlFor', () => {
      const source = readSource('components/toolbar/ConnectNodesButton.tsx');
      expect(source).toContain('htmlFor="edge-source-select"');
      expect(source).toContain('id="edge-source-select"');
    });

    it('edge target select has associated label via htmlFor', () => {
      const source = readSource('components/toolbar/ConnectNodesButton.tsx');
      expect(source).toContain('htmlFor="edge-target-select"');
      expect(source).toContain('id="edge-target-select"');
    });

    it('edge type select has associated label via htmlFor', () => {
      const source = readSource('components/toolbar/ConnectNodesButton.tsx');
      expect(source).toContain('htmlFor="edge-type-select"');
      expect(source).toContain('id="edge-type-select"');
    });
  });

  describe('Layout menu inputs', () => {
    it('node spacing slider has associated label via htmlFor', () => {
      const source = readSource('components/toolbar/LayoutMenu.tsx');
      expect(source).toContain('htmlFor="node-spacing"');
      expect(source).toContain('id="node-spacing"');
    });

    it('layer spacing slider has associated label via htmlFor', () => {
      const source = readSource('components/toolbar/LayoutMenu.tsx');
      expect(source).toContain('htmlFor="layer-spacing"');
      expect(source).toContain('id="layer-spacing"');
    });
  });

  describe('Dialog inputs', () => {
    it('edge label input has associated label via htmlFor', () => {
      const source = readSource('dialogs/ConnectionTypeDialog.tsx');
      expect(source).toContain('htmlFor="edge-label"');
      expect(source).toContain('id="edge-label"');
    });
  });

  describe('Label-input ID correspondence', () => {
    it('every label htmlFor matches an input id in NodeDetailPanel', () => {
      const source = readSource('components/panels/NodeDetailPanel.tsx');
      const htmlForMatches = source.matchAll(/htmlFor="([^"]+)"/g);
      for (const match of htmlForMatches) {
        const forValue = match[1];
        expect(source).toContain(`id="${forValue}"`);
      }
    });

    it('every label htmlFor matches an input id in ConnectNodesButton', () => {
      const source = readSource('components/toolbar/ConnectNodesButton.tsx');
      const htmlForMatches = source.matchAll(/htmlFor="([^"]+)"/g);
      for (const match of htmlForMatches) {
        const forValue = match[1];
        expect(source).toContain(`id="${forValue}"`);
      }
    });

    it('every label htmlFor matches an input id in LayoutMenu', () => {
      const source = readSource('components/toolbar/LayoutMenu.tsx');
      const htmlForMatches = source.matchAll(/htmlFor="([^"]+)"/g);
      for (const match of htmlForMatches) {
        const forValue = match[1];
        expect(source).toContain(`id="${forValue}"`);
      }
    });

    it('every label htmlFor matches an input id in ConnectionTypeDialog', () => {
      const source = readSource('dialogs/ConnectionTypeDialog.tsx');
      const htmlForMatches = source.matchAll(/htmlFor="([^"]+)"/g);
      for (const match of htmlForMatches) {
        const forValue = match[1];
        expect(source).toContain(`id="${forValue}"`);
      }
    });
  });

  describe('No unlabeled inputs in key components', () => {
    // JSX multi-line tags with expressions containing ">" make regex parsing unreliable.
    // Instead, we count the number of form elements vs accessibility attributes and ensure
    // every form element has a corresponding label or aria-label attribute.

    it('NodeDetailPanel has sufficient aria-label/id coverage for all inputs', () => {
      const source = readSource('components/panels/NodeDetailPanel.tsx');
      // Count input elements (opening tags only, not self-referencing in strings)
      const inputCount = (source.match(/<input\b/g) || []).length;
      // Count accessibility attributes (id on inputs or aria-label on inputs)
      const idCount = (source.match(/\bid="[^"]+"/g) || []).length;
      const ariaLabelCount = (source.match(/aria-label[={"]/g) || []).length;
      // There should be at least as many labels as inputs
      // (idCount includes some non-input elements, ariaLabelCount covers inline labels)
      expect(idCount + ariaLabelCount).toBeGreaterThanOrEqual(inputCount);
    });

    it('NodeDetailPanel has sufficient aria-label/id coverage for all selects', () => {
      const source = readSource('components/panels/NodeDetailPanel.tsx');
      const selectCount = (source.match(/<select\b/g) || []).length;
      // Each select should have either id or aria-label
      // We verified individually above: enum select has aria-label, coderef-role has id
      expect(selectCount).toBe(2);
      expect(source).toContain('aria-label={argDef.name}'); // enum select
      expect(source).toContain('id="coderef-role"'); // role select
    });

    it('all textareas in the app have corresponding labels', () => {
      // AIChatTab has been removed (feature #532)

      // NodeDetailPanel: 2 textareas - note-content (with id) and edit note (with aria-label)
      const ndpSource = readSource('components/panels/NodeDetailPanel.tsx');
      const ndpTextareaCount = (ndpSource.match(/<textarea\b/g) || []).length;
      expect(ndpTextareaCount).toBe(2);
      expect(ndpSource).toContain('id="note-content"'); // new note textarea
      expect(ndpSource).toContain('aria-label="Edit note content"'); // edit note textarea
    });
  });
});
