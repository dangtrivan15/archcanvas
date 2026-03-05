/**
 * Unit tests for TemplatePreview component.
 * Tests rendering, loading state, detail sidebar, action buttons, and canvas preview.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TemplatePreview } from '@/components/shared/TemplatePreview';
import type { TemplateRecord, TemplateMetadata } from '@/templates/types';

// Mock ELK layout to return positions synchronously
vi.mock('@/core/layout/elkLayout', () => ({
  computeElkLayout: vi.fn().mockResolvedValue({
    positions: new Map([
      // Will be populated with the dynamic IDs from instantiateStack
    ]),
  }),
  DEFAULT_NODE_SPACING: 60,
  DEFAULT_LAYER_SPACING: 100,
}));

// Mock instantiateStack to return predictable node/edge IDs
vi.mock('@/stacks/stackLoader', () => ({
  instantiateStack: vi.fn().mockImplementation((stack: any) => ({
    name: stack.metadata.displayName,
    description: stack.metadata.description,
    owners: [],
    nodes: stack.nodes.map((n: any, i: number) => ({
      id: `node-${i}`,
      type: n.type,
      displayName: n.displayName,
      args: n.args ?? {},
      codeRefs: [],
      notes: [],
      properties: {},
      position: { x: i * 100, y: 0, width: 200, height: 100 },
      children: [],
    })),
    edges: stack.edges.map((e: any, i: number) => ({
      id: `edge-${i}`,
      fromNode: `node-0`,
      toNode: `node-1`,
      type: e.type,
      label: e.label,
      properties: {},
      notes: [],
    })),
    annotations: [],
  })),
}));

// Minimal YAML string for a test template
const TEST_YAML = `
metadata:
  name: test-template
  displayName: Test Template
  description: A test template
  icon: Rocket
  tags:
    - test
    - starter
nodes:
  - id: frontend
    type: compute/service
    displayName: Frontend App
    position: { x: 0, y: 0 }
  - id: backend
    type: compute/service
    displayName: Backend API
    position: { x: 300, y: 0 }
  - id: database
    type: data/database
    displayName: PostgreSQL
    position: { x: 600, y: 0 }
edges:
  - fromNode: frontend
    toNode: backend
    type: sync
    label: REST
  - fromNode: backend
    toNode: database
    type: sync
    label: SQL
`;

const TEST_METADATA: TemplateMetadata = {
  id: 'test-template',
  name: 'Test Template',
  description: 'A test template for preview testing',
  icon: 'Rocket',
  category: 'general',
  nodeCount: 3,
  edgeCount: 2,
  createdAt: 0,
  source: 'builtin',
  tags: ['test', 'starter'],
};

const TEST_RECORD: TemplateRecord = {
  metadata: TEST_METADATA,
  data: TEST_YAML,
};

describe('TemplatePreview', () => {
  const onUseTemplate = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the template name in the header', async () => {
    render(
      <TemplatePreview record={TEST_RECORD} onUseTemplate={onUseTemplate} onClose={onClose} />,
    );
    expect(screen.getByText('Test Template')).toBeTruthy();
  });

  it('shows the overlay element', () => {
    render(
      <TemplatePreview record={TEST_RECORD} onUseTemplate={onUseTemplate} onClose={onClose} />,
    );
    expect(screen.getByTestId('template-preview-overlay')).toBeTruthy();
  });

  it('shows the dialog element', () => {
    render(
      <TemplatePreview record={TEST_RECORD} onUseTemplate={onUseTemplate} onClose={onClose} />,
    );
    expect(screen.getByTestId('template-preview-dialog')).toBeTruthy();
  });

  it('shows the sidebar with description', () => {
    render(
      <TemplatePreview record={TEST_RECORD} onUseTemplate={onUseTemplate} onClose={onClose} />,
    );
    expect(screen.getByTestId('template-preview-sidebar')).toBeTruthy();
    expect(screen.getByText('A test template for preview testing')).toBeTruthy();
  });

  it('shows loading state initially', () => {
    render(
      <TemplatePreview record={TEST_RECORD} onUseTemplate={onUseTemplate} onClose={onClose} />,
    );
    expect(screen.getByTestId('template-preview-loading')).toBeTruthy();
    expect(screen.getByText('Preparing preview...')).toBeTruthy();
  });

  it('shows the canvas area after loading', async () => {
    render(
      <TemplatePreview record={TEST_RECORD} onUseTemplate={onUseTemplate} onClose={onClose} />,
    );
    await waitFor(() => {
      expect(screen.queryByTestId('template-preview-loading')).toBeNull();
    });
    expect(screen.getByTestId('template-preview-canvas')).toBeTruthy();
  });

  it('displays node count and edge count badges', () => {
    render(
      <TemplatePreview record={TEST_RECORD} onUseTemplate={onUseTemplate} onClose={onClose} />,
    );
    expect(screen.getByText('3 nodes')).toBeTruthy();
    expect(screen.getByText('2 edges')).toBeTruthy();
  });

  it('displays template tags', () => {
    render(
      <TemplatePreview record={TEST_RECORD} onUseTemplate={onUseTemplate} onClose={onClose} />,
    );
    expect(screen.getByTestId('template-preview-tag-test')).toBeTruthy();
    expect(screen.getByTestId('template-preview-tag-starter')).toBeTruthy();
  });

  it('shows node type list after loading', async () => {
    render(
      <TemplatePreview record={TEST_RECORD} onUseTemplate={onUseTemplate} onClose={onClose} />,
    );
    await waitFor(() => {
      expect(screen.queryByTestId('template-preview-loading')).toBeNull();
    });
    // Should show node types from the parsed graph
    expect(screen.getByText(/Node Types/)).toBeTruthy();
  });

  it('renders Use Template button', () => {
    render(
      <TemplatePreview record={TEST_RECORD} onUseTemplate={onUseTemplate} onClose={onClose} />,
    );
    expect(screen.getByTestId('template-preview-use')).toBeTruthy();
    expect(screen.getByText('Use Template')).toBeTruthy();
  });

  it('renders Close button', () => {
    render(
      <TemplatePreview record={TEST_RECORD} onUseTemplate={onUseTemplate} onClose={onClose} />,
    );
    expect(screen.getByTestId('template-preview-cancel')).toBeTruthy();
  });

  it('calls onUseTemplate when Use Template is clicked', () => {
    render(
      <TemplatePreview record={TEST_RECORD} onUseTemplate={onUseTemplate} onClose={onClose} />,
    );
    fireEvent.click(screen.getByTestId('template-preview-use'));
    expect(onUseTemplate).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Close button is clicked', () => {
    render(
      <TemplatePreview record={TEST_RECORD} onUseTemplate={onUseTemplate} onClose={onClose} />,
    );
    fireEvent.click(screen.getByTestId('template-preview-cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when X button is clicked', () => {
    render(
      <TemplatePreview record={TEST_RECORD} onUseTemplate={onUseTemplate} onClose={onClose} />,
    );
    fireEvent.click(screen.getByTestId('template-preview-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape is pressed', () => {
    render(
      <TemplatePreview record={TEST_RECORD} onUseTemplate={onUseTemplate} onClose={onClose} />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking overlay background', () => {
    render(
      <TemplatePreview record={TEST_RECORD} onUseTemplate={onUseTemplate} onClose={onClose} />,
    );
    fireEvent.click(screen.getByTestId('template-preview-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when clicking dialog content', () => {
    render(
      <TemplatePreview record={TEST_RECORD} onUseTemplate={onUseTemplate} onClose={onClose} />,
    );
    fireEvent.click(screen.getByTestId('template-preview-dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows Description heading in sidebar', () => {
    render(
      <TemplatePreview record={TEST_RECORD} onUseTemplate={onUseTemplate} onClose={onClose} />,
    );
    expect(screen.getByText('Description')).toBeTruthy();
  });

  it('shows Statistics heading in sidebar', () => {
    render(
      <TemplatePreview record={TEST_RECORD} onUseTemplate={onUseTemplate} onClose={onClose} />,
    );
    expect(screen.getByText('Statistics')).toBeTruthy();
  });

  it('shows Tags heading in sidebar', () => {
    render(
      <TemplatePreview record={TEST_RECORD} onUseTemplate={onUseTemplate} onClose={onClose} />,
    );
    expect(screen.getByText('Tags')).toBeTruthy();
  });
});
