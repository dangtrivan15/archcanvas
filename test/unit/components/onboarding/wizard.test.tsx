import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Store mocks
// ---------------------------------------------------------------------------

const mockCompleteOnboarding = vi.fn();

vi.mock('@/store/fileStore', () => ({
  useFileStore: Object.assign(
    vi.fn((sel: any) =>
      sel({
        completeOnboarding: mockCompleteOnboarding,
        fs: null,
      }),
    ),
    {
      getState: () => ({
        completeOnboarding: mockCompleteOnboarding,
      }),
    },
  ),
}));

vi.mock('@/store/apiKeyStore', () => ({
  useApiKeyStore: Object.assign(
    vi.fn((sel: any) =>
      sel({
        apiKey: null,
        model: 'claude-sonnet-4-6-20250919',
        isValidated: false,
        isValidating: false,
        error: null,
      }),
    ),
    {
      getState: () => ({
        setApiKey: vi.fn(),
        setModel: vi.fn(),
        clearApiKey: vi.fn(),
        validateKey: vi.fn().mockResolvedValue(false),
      }),
    },
  ),
  AVAILABLE_MODELS: [
    { id: 'claude-sonnet-4-6-20250919', label: 'Claude Sonnet 4.6' },
  ],
}));

// Track the current mock chat state so tests can mutate it
let mockProviders = new Map<string, { id: string; displayName: string; available: boolean }>();
let mockActiveProviderId: string | null = null;

vi.mock('@/store/chatStore', () => ({
  useChatStore: Object.assign(
    vi.fn((sel: any) =>
      sel({
        providers: mockProviders,
        activeProviderId: mockActiveProviderId,
      }),
    ),
    {
      getState: () => ({
        setActiveProvider: vi.fn(),
      }),
    },
  ),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { InitMethodStep } from '@/components/onboarding/InitMethodStep';
import { AiSurveyStep } from '@/components/onboarding/AiSurveyStep';
import { useChatStore } from '@/store/chatStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setAiAvailable(available: boolean) {
  mockProviders = new Map();
  if (available) {
    mockProviders.set('test-provider', { id: 'test-provider', displayName: 'Test Provider', available: true });
    mockActiveProviderId = 'test-provider';
  } else {
    mockActiveProviderId = null;
  }
  // Re-configure the mock to pick up new state
  vi.mocked(useChatStore).mockImplementation(((sel: any) =>
    sel({ providers: mockProviders, activeProviderId: mockActiveProviderId })
  ) as any);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OnboardingWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAiAvailable(false);
  });

  it('renders Step 1 (InitMethodStep) by default', () => {
    render(<OnboardingWizard />);
    expect(screen.getByText('Welcome to ArchCanvas')).toBeInTheDocument();
    expect(screen.getByText('Blank Canvas')).toBeInTheDocument();
    expect(screen.getByText('AI Analyze')).toBeInTheDocument();
    expect(screen.getByText('Start from Template')).toBeInTheDocument();
  });

  it('clicking "Blank Canvas" calls completeOnboarding("blank")', () => {
    render(<OnboardingWizard />);
    fireEvent.click(screen.getByText('Blank Canvas'));
    expect(mockCompleteOnboarding).toHaveBeenCalledWith('blank');
  });

  it('clicking "AI Analyze" advances to Step 2', () => {
    render(<OnboardingWizard />);
    fireEvent.click(screen.getByText('AI Analyze'));
    expect(screen.getByText('Configure AI Analysis')).toBeInTheDocument();
  });

  it('clicking "Start from Template" advances to template picker', () => {
    render(<OnboardingWizard />);
    fireEvent.click(screen.getByText('Start from Template'));
    expect(screen.getByText('Choose a Template')).toBeInTheDocument();
  });

  it('Step 2 "Back" button returns to Step 1', () => {
    render(<OnboardingWizard />);
    // Advance to Step 2
    fireEvent.click(screen.getByText('AI Analyze'));
    expect(screen.getByText('Configure AI Analysis')).toBeInTheDocument();

    // Go back
    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByText('Welcome to ArchCanvas')).toBeInTheDocument();
  });

  it('Step 2 "Start" calls completeOnboarding("ai", surveyData) with form values', () => {
    setAiAvailable(true);
    render(<OnboardingWizard />);

    // Advance to Step 2
    fireEvent.click(screen.getByText('AI Analyze'));

    // Fill description
    const textarea = screen.getByPlaceholderText('Describe what this project does...');
    fireEvent.change(textarea, { target: { value: 'My cool project' } });

    // Select a tech
    fireEvent.click(screen.getByText('TypeScript'));

    // Click Start
    fireEvent.click(screen.getByText('Start'));

    expect(mockCompleteOnboarding).toHaveBeenCalledWith('ai', {
      description: 'My cool project',
      techStack: ['TypeScript'],
      explorationDepth: 'full',
      focusDirs: '',
    });
  });
});

describe('InitMethodStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAiAvailable(false);
  });

  it('shows AI availability hint when no provider is available', () => {
    setAiAvailable(false);
    const onBlank = vi.fn();
    const onAi = vi.fn();

    render(<InitMethodStep onBlankCanvas={onBlank} onAiAnalyze={onAi} onTemplate={vi.fn()} />);
    expect(screen.getByTestId('ai-hint')).toBeInTheDocument();
    expect(screen.getByTestId('ai-hint').textContent).toContain('Requires AI connection');
  });

  it('hides AI availability hint when a provider is available', () => {
    setAiAvailable(true);
    const onBlank = vi.fn();
    const onAi = vi.fn();

    render(<InitMethodStep onBlankCanvas={onBlank} onAiAnalyze={onAi} onTemplate={vi.fn()} />);
    expect(screen.queryByTestId('ai-hint')).not.toBeInTheDocument();
  });
});

describe('AiSurveyStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAiAvailable(true);
  });

  it('Start button is disabled when description is empty', () => {
    render(<AiSurveyStep onBack={vi.fn()} onStart={vi.fn()} />);
    const startBtn = screen.getByText('Start');
    expect(startBtn).toBeDisabled();
  });

  it('Start button is disabled when AI provider is not available', () => {
    setAiAvailable(false);
    render(<AiSurveyStep onBack={vi.fn()} onStart={vi.fn()} />);

    // Fill description
    const textarea = screen.getByPlaceholderText('Describe what this project does...');
    fireEvent.change(textarea, { target: { value: 'Some project' } });

    const startBtn = screen.getByText('Start');
    expect(startBtn).toBeDisabled();
  });

  it('shows provider selector with provider buttons', () => {
    setAiAvailable(true);
    render(<AiSurveyStep onBack={vi.fn()} onStart={vi.fn()} />);
    expect(screen.getByText('Test Provider')).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: /ai provider/i })).toBeInTheDocument();
  });

  it('shows no-providers message when no providers registered', () => {
    setAiAvailable(false);
    render(<AiSurveyStep onBack={vi.fn()} onStart={vi.fn()} />);
    expect(screen.getByText(/no ai providers/i)).toBeInTheDocument();
  });
});
