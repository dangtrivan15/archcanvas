import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock stores before importing the component
const mockApiKeyState = {
  apiKey: null as string | null,
  model: 'claude-sonnet-4-6-20250919',
  isValidated: false,
  isValidating: false,
  error: null as string | null,
  setApiKey: vi.fn(),
  setModel: vi.fn(),
  clearApiKey: vi.fn(),
  validateKey: vi.fn().mockResolvedValue(false),
};

vi.mock('@/store/apiKeyStore', () => ({
  useApiKeyStore: Object.assign(
    (selector: (s: typeof mockApiKeyState) => unknown) => selector(mockApiKeyState),
    { getState: () => mockApiKeyState },
  ),
  AVAILABLE_MODELS: [
    { id: 'claude-opus-4-6-20250919', label: 'Claude Opus 4.6' },
    { id: 'claude-sonnet-4-6-20250919', label: 'Claude Sonnet 4.6' },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  ],
}));

const mockUiState = {
  showAiSettingsDialog: true,
  closeAiSettingsDialog: vi.fn(),
};

vi.mock('@/store/uiStore', () => ({
  useUiStore: (selector: (s: typeof mockUiState) => unknown) => selector(mockUiState),
}));

const mockChatState = {
  activeProviderId: 'claude-api-key' as string | null,
};

vi.mock('@/store/chatStore', () => ({
  useChatStore: Object.assign(
    (selector: (s: typeof mockChatState) => unknown) => selector(mockChatState),
    { getState: () => ({ setActiveProvider: vi.fn() }) },
  ),
}));

const mockFileState = {
  projectPath: null as string | null,
  fs: null as { getPath: () => string | null } | null,
  setProjectPath: vi.fn(),
};

vi.mock('@/store/fileStore', () => ({
  useFileStore: Object.assign(
    (selector: (s: typeof mockFileState) => unknown) => selector(mockFileState),
    { getState: () => mockFileState },
  ),
}));

// Stub motion to avoid animation issues in tests
vi.mock('motion/react', () => ({
  motion: {
    span: 'span',
    div: 'div',
  },
  useReducedMotion: () => true,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

import { AiSettingsDialog } from '../../src-web/components/AiSettingsDialog';

describe('AiSettingsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiKeyState.apiKey = null;
    mockApiKeyState.model = 'claude-sonnet-4-6-20250919';
    mockApiKeyState.isValidated = false;
    mockApiKeyState.isValidating = false;
    mockApiKeyState.error = null;
    mockUiState.showAiSettingsDialog = true;
    mockChatState.activeProviderId = 'claude-api-key';
    mockFileState.projectPath = null;
    mockFileState.fs = null;
  });

  // --- API Key provider ---

  it('shows API key settings when API key provider is active', () => {
    render(<AiSettingsDialog />);
    expect(screen.getByLabelText(/api key/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/model/i)).toBeInTheDocument();
  });

  it('shows warning about client-side storage', () => {
    render(<AiSettingsDialog />);
    expect(screen.getByText(/local storage/i)).toBeInTheDocument();
  });

  it('shows all available models in dropdown', () => {
    render(<AiSettingsDialog />);
    const select = screen.getByLabelText(/model/i);
    const options = select.querySelectorAll('option');
    expect(options).toHaveLength(3);
    expect(options[0].textContent).toBe('Claude Opus 4.6');
    expect(options[1].textContent).toBe('Claude Sonnet 4.6');
    expect(options[2].textContent).toBe('Claude Haiku 4.5');
  });

  it('calls validateKey on Test Connection click', () => {
    mockApiKeyState.apiKey = 'sk-ant-test';
    mockApiKeyState.validateKey.mockResolvedValue(false);

    render(<AiSettingsDialog />);
    const button = screen.getByText('Test Connection');
    fireEvent.click(button);

    expect(mockApiKeyState.validateKey).toHaveBeenCalled();
  });

  it('disables Test Connection when no API key', () => {
    mockApiKeyState.apiKey = null;
    render(<AiSettingsDialog />);
    const button = screen.getByText('Test Connection');
    expect(button).toBeDisabled();
  });

  it('shows Connected status when validated', () => {
    mockApiKeyState.apiKey = 'sk-ant-test';
    mockApiKeyState.isValidated = true;
    render(<AiSettingsDialog />);
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('shows error status when validation fails', () => {
    mockApiKeyState.apiKey = 'sk-ant-test';
    mockApiKeyState.error = 'Invalid API key';
    render(<AiSettingsDialog />);
    expect(screen.getByText('Invalid API key')).toBeInTheDocument();
  });

  it('shows Clear button when key is set', () => {
    mockApiKeyState.apiKey = 'sk-ant-test-key-12345';
    render(<AiSettingsDialog />);
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
  });

  it('calls clearApiKey on Clear button click', () => {
    mockApiKeyState.apiKey = 'sk-ant-test-key-12345';
    render(<AiSettingsDialog />);
    fireEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(mockApiKeyState.clearApiKey).toHaveBeenCalled();
  });

  it('saves key when user types and presses Enter', () => {
    render(<AiSettingsDialog />);
    const input = screen.getByLabelText(/api key/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'sk-ant-api03-new-key' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockApiKeyState.setApiKey).toHaveBeenCalledWith('sk-ant-api03-new-key');
  });

  // --- Claude Code provider ---

  it('shows project path when Claude Code provider is active', () => {
    mockChatState.activeProviderId = 'claude-code';
    render(<AiSettingsDialog />);
    expect(screen.getByLabelText(/project path/i)).toBeInTheDocument();
    expect(screen.getByText(/context awareness/i)).toBeInTheDocument();
  });

  it('does not show API key settings when Claude Code is active', () => {
    mockChatState.activeProviderId = 'claude-code';
    render(<AiSettingsDialog />);
    expect(screen.queryByLabelText(/api key/i)).not.toBeInTheDocument();
  });

  it('sets project path via Set button', () => {
    mockChatState.activeProviderId = 'claude-code';
    render(<AiSettingsDialog />);
    const input = screen.getByLabelText(/project path/i);
    fireEvent.change(input, { target: { value: '/home/user/my-project' } });
    fireEvent.click(screen.getByText('Set'));
    expect(mockFileState.setProjectPath).toHaveBeenCalledWith('/home/user/my-project');
  });

  // --- No provider ---

  it('shows message when no provider is active', () => {
    mockChatState.activeProviderId = null;
    render(<AiSettingsDialog />);
    expect(screen.getByText(/select.*provider/i)).toBeInTheDocument();
  });

  it('does not show API key or path settings when no provider', () => {
    mockChatState.activeProviderId = null;
    render(<AiSettingsDialog />);
    expect(screen.queryByLabelText(/api key/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/project path/i)).not.toBeInTheDocument();
  });
});
