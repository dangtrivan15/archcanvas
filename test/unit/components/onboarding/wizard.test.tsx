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

// Track the current mock providers map so tests can mutate it
let mockProviders = new Map<string, { available: boolean }>();

vi.mock('@/store/chatStore', () => ({
  useChatStore: vi.fn((sel: any) =>
    sel({
      providers: mockProviders,
    }),
  ),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { InitMethodStep } from '@/components/onboarding/InitMethodStep';
import { AiSurveyStep } from '@/components/onboarding/AiSurveyStep';
import { useFileStore } from '@/store/fileStore';
import { useChatStore } from '@/store/chatStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setAiAvailable(available: boolean) {
  mockProviders = new Map();
  if (available) {
    mockProviders.set('test-provider', { available: true });
  }
  // Re-configure the mock to pick up new providers
  vi.mocked(useChatStore).mockImplementation((sel: any) =>
    sel({ providers: mockProviders }),
  );
}

/** Override the fileStore mock's fs value (null by default, or an object with getPath) */
function setMockFs(fs: { getPath: () => string | null } | null) {
  vi.mocked(useFileStore).mockImplementation(((sel: any) =>
    sel({
      completeOnboarding: mockCompleteOnboarding,
      fs,
    })) as any);
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

    // Fill project path (required)
    const pathInput = screen.getByPlaceholderText('/Users/you/projects/my-app');
    fireEvent.change(pathInput, { target: { value: '/home/user/my-app' } });

    // Select a tech
    fireEvent.click(screen.getByText('TypeScript'));

    // Click Start
    fireEvent.click(screen.getByText('Start'));

    expect(mockCompleteOnboarding).toHaveBeenCalledWith('ai', {
      description: 'My cool project',
      techStack: ['TypeScript'],
      explorationDepth: 'full',
      focusDirs: '',
      projectPath: '/home/user/my-app',
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

    render(<InitMethodStep onBlankCanvas={onBlank} onAiAnalyze={onAi} />);
    expect(screen.getByTestId('ai-hint')).toBeInTheDocument();
    expect(screen.getByTestId('ai-hint').textContent).toContain('Requires AI connection');
  });

  it('hides AI availability hint when a provider is available', () => {
    setAiAvailable(true);
    const onBlank = vi.fn();
    const onAi = vi.fn();

    render(<InitMethodStep onBlankCanvas={onBlank} onAiAnalyze={onAi} />);
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

  it('shows amber banner when AI is unavailable', () => {
    setAiAvailable(false);
    render(<AiSurveyStep onBack={vi.fn()} onStart={vi.fn()} />);
    expect(screen.getByTestId('ai-unavailable-banner')).toBeInTheDocument();
    expect(screen.getByTestId('ai-unavailable-banner').textContent).toContain(
      'AI is not connected',
    );
  });

  it('hides amber banner when AI is available', () => {
    setAiAvailable(true);
    render(<AiSurveyStep onBack={vi.fn()} onStart={vi.fn()} />);
    expect(screen.queryByTestId('ai-unavailable-banner')).not.toBeInTheDocument();
  });

  it('pre-fills project path input from fs.getPath() when fs is available', () => {
    setAiAvailable(true);
    setMockFs({ getPath: () => '/home/user/real-project' });

    render(<AiSurveyStep onBack={vi.fn()} onStart={vi.fn()} />);

    const pathInput = screen.getByPlaceholderText('/Users/you/projects/my-app') as HTMLInputElement;
    expect(pathInput.value).toBe('/home/user/real-project');

    // Reset fs mock for other tests
    setMockFs(null);
  });

  it('project path input is empty when fs is null (Web)', () => {
    setAiAvailable(true);
    setMockFs(null);

    render(<AiSurveyStep onBack={vi.fn()} onStart={vi.fn()} />);

    const pathInput = screen.getByPlaceholderText('/Users/you/projects/my-app') as HTMLInputElement;
    expect(pathInput.value).toBe('');
  });
});
