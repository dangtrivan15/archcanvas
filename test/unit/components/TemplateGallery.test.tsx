/**
 * Unit tests for TemplateGallery and TemplateCard components.
 * Tests rendering, category filtering, search, empty states, and source badges.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TemplateCard } from '@/components/shared/TemplateCard';
import type { TemplateMetadata } from '@/templates/types';

// ── TemplateCard Tests ───────────────────────────────────────────────────

const MOCK_BUILTIN_METADATA: TemplateMetadata = {
  id: 'test-saas',
  name: 'SaaS Starter',
  description: 'A production-ready SaaS architecture.',
  icon: 'Rocket',
  category: 'saas',
  nodeCount: 8,
  edgeCount: 7,
  createdAt: 0,
  source: 'builtin',
  tags: ['saas', 'starter'],
};

const MOCK_IMPORTED_METADATA: TemplateMetadata = {
  id: 'custom-template',
  name: 'Custom Template',
  description: 'A user-imported template.',
  icon: 'Layers',
  category: 'custom',
  nodeCount: 5,
  edgeCount: 3,
  createdAt: Date.now(),
  source: 'imported',
  tags: ['custom'],
};

describe('TemplateCard', () => {
  it('renders template name', () => {
    render(<TemplateCard metadata={MOCK_BUILTIN_METADATA} />);
    expect(screen.getByText('SaaS Starter')).toBeInTheDocument();
  });

  it('renders template description', () => {
    render(<TemplateCard metadata={MOCK_BUILTIN_METADATA} />);
    expect(screen.getByText('A production-ready SaaS architecture.')).toBeInTheDocument();
  });

  it('renders domain badge with category', () => {
    render(<TemplateCard metadata={MOCK_BUILTIN_METADATA} />);
    expect(screen.getByText('saas')).toBeInTheDocument();
  });

  it('renders node count', () => {
    render(<TemplateCard metadata={MOCK_BUILTIN_METADATA} />);
    expect(screen.getByText('8 nodes')).toBeInTheDocument();
  });

  it('renders edge count', () => {
    render(<TemplateCard metadata={MOCK_BUILTIN_METADATA} />);
    expect(screen.getByText('7 edges')).toBeInTheDocument();
  });

  it('shows "Built-in" badge for builtin templates', () => {
    render(<TemplateCard metadata={MOCK_BUILTIN_METADATA} />);
    expect(screen.getByTestId('template-source-test-saas').textContent).toBe('Built-in');
  });

  it('shows "Imported" badge for imported templates', () => {
    render(<TemplateCard metadata={MOCK_IMPORTED_METADATA} />);
    expect(screen.getByTestId('template-source-custom-template').textContent).toBe('Imported');
  });

  it('has correct test-id', () => {
    render(<TemplateCard metadata={MOCK_BUILTIN_METADATA} />);
    expect(screen.getByTestId('template-card-test-saas')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<TemplateCard metadata={MOCK_BUILTIN_METADATA} onClick={handleClick} />);
    fireEvent.click(screen.getByTestId('template-card-test-saas'));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('renders with unknown icon gracefully (falls back to Rocket)', () => {
    const meta = { ...MOCK_BUILTIN_METADATA, icon: 'UnknownIcon123' };
    // Should not throw
    const { container } = render(<TemplateCard metadata={meta} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});

// ── TemplateGallery Integration Tests (lightweight) ──────────────────────

// Test the gallery by mocking the registry
vi.mock('@/templates/registry', () => {
  const templates = [
    {
      metadata: {
        id: 'saas-starter',
        name: 'SaaS Starter',
        description: 'SaaS architecture',
        icon: 'Rocket',
        category: 'saas',
        nodeCount: 8,
        edgeCount: 7,
        createdAt: 0,
        source: 'builtin' as const,
        tags: ['saas', 'starter'],
      },
      data: 'yaml-content-saas',
    },
    {
      metadata: {
        id: 'ai-chat-app',
        name: 'AI Chat App',
        description: 'AI chat architecture',
        icon: 'MessageSquare',
        category: 'ai',
        nodeCount: 8,
        edgeCount: 7,
        createdAt: 0,
        source: 'builtin' as const,
        tags: ['ai', 'rag'],
      },
      data: 'yaml-content-ai',
    },
    {
      metadata: {
        id: 'microservices-platform',
        name: 'Microservices Platform',
        description: 'K8s microservices',
        icon: 'Network',
        category: 'microservices',
        nodeCount: 13,
        edgeCount: 23,
        createdAt: 0,
        source: 'builtin' as const,
        tags: ['microservices', 'kubernetes'],
      },
      data: 'yaml-content-micro',
    },
    {
      metadata: {
        id: 'imported-custom',
        name: 'Custom Import',
        description: 'User imported template',
        icon: 'Layers',
        category: 'custom',
        nodeCount: 3,
        edgeCount: 2,
        createdAt: Date.now(),
        source: 'imported' as const,
        tags: ['custom'],
      },
      data: new Uint8Array([1, 2, 3]),
    },
  ];

  return {
    getAllTemplates: vi.fn().mockResolvedValue(templates),
    getBuiltinTemplates: vi
      .fn()
      .mockReturnValue(templates.filter((t) => t.metadata.source === 'builtin')),
  };
});

// Mock stores to avoid full app initialization
vi.mock('@/store/uiStore', () => ({
  useUIStore: vi.fn((selector) => {
    const state = {
      templateGalleryOpen: true,
      closeTemplateGallery: vi.fn(),
      showToast: vi.fn(),
    };
    return selector(state);
  }),
}));

vi.mock('@/store/coreStore', () => ({
  useCoreStore: Object.assign(
    vi.fn((selector) => {
      const state = {
        textApi: null,
        undoManager: null,
        _setGraph: vi.fn(),
      };
      return selector(state);
    }),
    { setState: vi.fn() },
  ),
}));

vi.mock('@/store/canvasStore', () => ({
  useCanvasStore: vi.fn((selector) => {
    const state = { requestFitView: vi.fn() };
    return selector(state);
  }),
}));

vi.mock('@/store/navigationStore', () => ({
  useNavigationStore: vi.fn((selector) => {
    const state = { zoomToRoot: vi.fn() };
    return selector(state);
  }),
}));

vi.mock('@/stacks/stackLoader', () => ({
  instantiateStack: vi.fn(),
}));

// Must import after mocks
const { TemplateGallery } = await import('@/components/shared/TemplateGallery');

describe('TemplateGallery', () => {
  it('renders the gallery dialog when open', async () => {
    render(<TemplateGallery />);
    await waitFor(() => {
      expect(screen.getByTestId('template-gallery-dialog')).toBeInTheDocument();
    });
  });

  it('renders the heading "Template Gallery"', async () => {
    render(<TemplateGallery />);
    await waitFor(() => {
      expect(screen.getByText('Template Gallery')).toBeInTheDocument();
    });
  });

  it('renders template count', async () => {
    render(<TemplateGallery />);
    await waitFor(() => {
      expect(screen.getByText('4 templates')).toBeInTheDocument();
    });
  });

  it('renders the search input', async () => {
    render(<TemplateGallery />);
    await waitFor(() => {
      expect(screen.getByTestId('template-gallery-search')).toBeInTheDocument();
    });
  });

  it('renders all category filter tabs', async () => {
    render(<TemplateGallery />);
    await waitFor(() => {
      expect(screen.getByTestId('template-gallery-tab-all')).toBeInTheDocument();
      expect(screen.getByTestId('template-gallery-tab-general')).toBeInTheDocument();
      expect(screen.getByTestId('template-gallery-tab-ai-ml')).toBeInTheDocument();
      expect(screen.getByTestId('template-gallery-tab-cloud-native')).toBeInTheDocument();
      expect(screen.getByTestId('template-gallery-tab-enterprise')).toBeInTheDocument();
      expect(screen.getByTestId('template-gallery-tab-consumer')).toBeInTheDocument();
      expect(screen.getByTestId('template-gallery-tab-data')).toBeInTheDocument();
    });
  });

  it('renders template cards in a grid', async () => {
    render(<TemplateGallery />);
    await waitFor(() => {
      expect(screen.getByTestId('template-gallery-grid')).toBeInTheDocument();
      expect(screen.getByText('SaaS Starter')).toBeInTheDocument();
      expect(screen.getByText('AI Chat App')).toBeInTheDocument();
      expect(screen.getByText('Microservices Platform')).toBeInTheDocument();
      expect(screen.getByText('Custom Import')).toBeInTheDocument();
    });
  });

  it('filters templates by search query', async () => {
    render(<TemplateGallery />);
    await waitFor(() => {
      expect(screen.getByTestId('template-gallery-search')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('template-gallery-search'), {
      target: { value: 'ai' },
    });

    // AI Chat App should remain, others should be filtered out
    expect(screen.getByText('AI Chat App')).toBeInTheDocument();
    expect(screen.queryByText('Microservices Platform')).toBeNull();
  });

  it('filters templates by category tab', async () => {
    render(<TemplateGallery />);
    await waitFor(() => {
      expect(screen.getByTestId('template-gallery-tab-cloud-native')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('template-gallery-tab-cloud-native'));

    // Only Microservices Platform should show
    expect(screen.getByText('Microservices Platform')).toBeInTheDocument();
    expect(screen.queryByText('SaaS Starter')).toBeNull();
    expect(screen.queryByText('AI Chat App')).toBeNull();
  });

  it('shows empty state when no templates match search', async () => {
    render(<TemplateGallery />);
    await waitFor(() => {
      expect(screen.getByTestId('template-gallery-search')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('template-gallery-search'), {
      target: { value: 'nonexistent_template_xyz' },
    });

    expect(screen.getByTestId('template-gallery-empty')).toBeInTheDocument();
    expect(screen.getByText(/No templates match/)).toBeInTheDocument();
    expect(screen.getByTestId('template-gallery-clear-filters')).toBeInTheDocument();
  });

  it('shows visual distinction between built-in and imported templates', async () => {
    render(<TemplateGallery />);
    await waitFor(() => {
      expect(screen.getByTestId('template-source-saas-starter')).toBeInTheDocument();
    });

    expect(screen.getByTestId('template-source-saas-starter').textContent).toBe('Built-in');
    expect(screen.getByTestId('template-source-imported-custom').textContent).toBe('Imported');
  });

  it('has close button', async () => {
    render(<TemplateGallery />);
    await waitFor(() => {
      expect(screen.getByTestId('template-gallery-close')).toBeInTheDocument();
    });
  });
});
