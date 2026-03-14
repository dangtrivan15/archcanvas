import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { useChatStore } from '@/store/chatStore';
import { ChatPanel } from '@/components/panels/ChatPanel';
import { ChatMessage } from '@/components/panels/ChatMessage';
import { ChatToolCall } from '@/components/panels/ChatToolCall';
import { ChatPermissionCard } from '@/components/panels/ChatPermissionCard';
import { ChatProviderSelector } from '@/components/panels/ChatProviderSelector';
import { ChatQuestionCard } from '@/components/panels/ChatQuestionCard';
import type {
  ChatMessage as ChatMessageType,
  ChatProvider,
  ToolCallEvent,
  ToolResultEvent,
  AskUserQuestion,
} from '@/core/ai/types';

// ---------------------------------------------------------------------------
// Mock dependent stores (chatStore reads from these internally)
// ---------------------------------------------------------------------------

vi.mock('@/store/fileStore', () => ({
  useFileStore: {
    getState: () => ({
      project: {
        root: {
          data: {
            project: { name: 'TestProject', description: 'Test' },
          },
        },
      },
      fs: { fake: true },
    }),
  },
}));

vi.mock('@/store/navigationStore', () => ({
  useNavigationStore: {
    getState: () => ({
      currentCanvasId: '@root',
    }),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockProvider(
  id: string,
  overrides: Partial<ChatProvider> = {},
): ChatProvider {
  return {
    id,
    displayName: `Mock ${id}`,
    available: true,
    sendMessage: vi.fn() as unknown as ChatProvider['sendMessage'],
    loadHistory: vi.fn(),
    abort: vi.fn(),
    ...overrides,
  };
}

function makeUserMessage(content: string, ts = 1000): ChatMessageType {
  return { role: 'user', content, timestamp: ts };
}

function makeAssistantMessage(
  content: string,
  events: ChatMessageType['events'] = [],
  ts = 2000,
): ChatMessageType {
  return { role: 'assistant', content, events, timestamp: ts };
}

// ---------------------------------------------------------------------------
// Reset store between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  useChatStore.setState({
    messages: [],
    isStreaming: false,
    activeProviderId: null,
    providers: new Map(),
    error: null,
    permissionMode: 'default',
    effort: 'high',
  });
});

// ===========================================================================
// ChatPanel
// ===========================================================================

describe('ChatPanel', () => {
  it('renders empty state with no messages', () => {
    render(<ChatPanel />);
    expect(screen.getByText(/no messages yet/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Chat input')).toBeInTheDocument();
    expect(screen.getByLabelText('Send message')).toBeInTheDocument();
  });

  it('renders message list', () => {
    useChatStore.setState({
      messages: [
        makeUserMessage('Hello AI'),
        makeAssistantMessage('Hello human'),
      ],
    });

    render(<ChatPanel />);
    expect(screen.getByText('Hello AI')).toBeInTheDocument();
    expect(screen.getByText('Hello human')).toBeInTheDocument();
  });

  it('shows error banner when error is set', () => {
    useChatStore.setState({ error: 'Connection lost' });

    render(<ChatPanel />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Connection lost');
  });

  it('shows streaming indicator when isStreaming', () => {
    useChatStore.setState({ isStreaming: true });

    render(<ChatPanel />);
    expect(screen.getByText('AI is responding...')).toBeInTheDocument();
  });

  it('disables send button when no active provider', () => {
    render(<ChatPanel />);
    const sendBtn = screen.getByLabelText('Send message');
    expect(sendBtn).toBeDisabled();
  });

  it('disables input when provider is not available', () => {
    const provider = createMockProvider('test', { available: false });
    useChatStore.setState({
      providers: new Map([['test', provider]]),
      activeProviderId: 'test',
    });

    render(<ChatPanel />);
    expect(screen.getByLabelText('Chat input')).toBeDisabled();
  });

  it('sends message on Enter key', () => {
    const provider = createMockProvider('test');
    useChatStore.setState({
      providers: new Map([['test', provider]]),
      activeProviderId: 'test',
    });

    render(<ChatPanel />);
    const textarea = screen.getByLabelText('Chat input');
    fireEvent.change(textarea, { target: { value: 'test message' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    // Input should be cleared after send
    expect(textarea).toHaveValue('');
  });

  it('does not send on Shift+Enter (allows newline)', () => {
    const provider = createMockProvider('test');
    useChatStore.setState({
      providers: new Map([['test', provider]]),
      activeProviderId: 'test',
    });

    render(<ChatPanel />);
    const textarea = screen.getByLabelText('Chat input');
    fireEvent.change(textarea, { target: { value: 'line one' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    // Input should NOT be cleared — Shift+Enter is newline
    expect(textarea).toHaveValue('line one');
  });

  it('shows Stop button during streaming instead of Send', () => {
    const provider = createMockProvider('test');
    useChatStore.setState({
      providers: new Map([['test', provider]]),
      activeProviderId: 'test',
      isStreaming: true,
    });

    render(<ChatPanel />);
    expect(screen.getByLabelText('Stop')).toBeInTheDocument();
    expect(screen.queryByLabelText('Send message')).not.toBeInTheDocument();
  });

  it('disables input while streaming', () => {
    const provider = createMockProvider('test');
    useChatStore.setState({
      providers: new Map([['test', provider]]),
      activeProviderId: 'test',
      isStreaming: true,
    });

    render(<ChatPanel />);
    expect(screen.getByLabelText('Chat input')).toBeDisabled();
  });

  it('dispatches archcanvas:toggle-chat on close', () => {
    const handler = vi.fn();
    window.addEventListener('archcanvas:toggle-chat', handler);

    render(<ChatPanel />);
    fireEvent.click(screen.getByLabelText('Close chat'));

    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener('archcanvas:toggle-chat', handler);
  });
});

// ===========================================================================
// ChatPanel — Permission Mode & Effort Selectors
// ===========================================================================

describe('ChatPanel — Permission Mode Selector', () => {
  it('renders permission mode dropdown with default value', () => {
    render(<ChatPanel />);
    const select = screen.getByLabelText('Permission mode') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.value).toBe('default');
  });

  it('shows all four permission modes (excludes bypassPermissions)', () => {
    render(<ChatPanel />);
    const select = screen.getByLabelText('Permission mode') as HTMLSelectElement;
    const options = select.querySelectorAll('option');
    expect(options).toHaveLength(4);

    const values = Array.from(options).map((o) => o.value);
    expect(values).toEqual(['default', 'acceptEdits', 'plan', 'dontAsk']);

    const labels = Array.from(options).map((o) => o.textContent);
    expect(labels).toEqual(['Default', 'Auto-edit', 'Plan only', 'Strict']);
  });

  it('calls setPermissionMode on change', () => {
    const setPermissionModeSpy = vi.fn();
    useChatStore.setState({ setPermissionMode: setPermissionModeSpy } as any);

    render(<ChatPanel />);
    const select = screen.getByLabelText('Permission mode') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'plan' } });

    expect(setPermissionModeSpy).toHaveBeenCalledWith('plan');
  });

  it('is disabled during streaming', () => {
    const provider = createMockProvider('test');
    useChatStore.setState({
      providers: new Map([['test', provider]]),
      activeProviderId: 'test',
      isStreaming: true,
    });

    render(<ChatPanel />);
    expect(screen.getByLabelText('Permission mode')).toBeDisabled();
  });

  it('is enabled when not streaming', () => {
    render(<ChatPanel />);
    expect(screen.getByLabelText('Permission mode')).not.toBeDisabled();
  });

  it('reflects current store value', () => {
    useChatStore.setState({ permissionMode: 'acceptEdits' });

    render(<ChatPanel />);
    const select = screen.getByLabelText('Permission mode') as HTMLSelectElement;
    expect(select.value).toBe('acceptEdits');
  });
});

describe('ChatPanel — Effort Selector', () => {
  it('renders effort dropdown with default value', () => {
    render(<ChatPanel />);
    const select = screen.getByLabelText('Effort level') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.value).toBe('high');
  });

  it('shows all four effort levels', () => {
    render(<ChatPanel />);
    const select = screen.getByLabelText('Effort level') as HTMLSelectElement;
    const options = select.querySelectorAll('option');
    expect(options).toHaveLength(4);

    const values = Array.from(options).map((o) => o.value);
    expect(values).toEqual(['low', 'medium', 'high', 'max']);

    const labels = Array.from(options).map((o) => o.textContent);
    expect(labels).toEqual(['Quick', 'Medium', 'Thorough', 'Maximum']);
  });

  it('calls setEffort on change', () => {
    const setEffortSpy = vi.fn();
    useChatStore.setState({ setEffort: setEffortSpy } as any);

    render(<ChatPanel />);
    const select = screen.getByLabelText('Effort level') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'max' } });

    expect(setEffortSpy).toHaveBeenCalledWith('max');
  });

  it('is disabled during streaming', () => {
    const provider = createMockProvider('test');
    useChatStore.setState({
      providers: new Map([['test', provider]]),
      activeProviderId: 'test',
      isStreaming: true,
    });

    render(<ChatPanel />);
    expect(screen.getByLabelText('Effort level')).toBeDisabled();
  });

  it('is enabled when not streaming', () => {
    render(<ChatPanel />);
    expect(screen.getByLabelText('Effort level')).not.toBeDisabled();
  });

  it('reflects current store value', () => {
    useChatStore.setState({ effort: 'low' });

    render(<ChatPanel />);
    const select = screen.getByLabelText('Effort level') as HTMLSelectElement;
    expect(select.value).toBe('low');
  });
});

// ===========================================================================
// ChatMessage
// ===========================================================================

describe('ChatMessage', () => {
  it('renders user message content', () => {
    render(<ChatMessage message={makeUserMessage('User says hi')} />);
    expect(screen.getByText('User says hi')).toBeInTheDocument();
  });

  it('renders assistant message content', () => {
    render(<ChatMessage message={makeAssistantMessage('Bot reply')} />);
    expect(screen.getByText('Bot reply')).toBeInTheDocument();
  });

  it('renders timestamp', () => {
    // Timestamp 0 = midnight UTC — display depends on locale, but a time string should exist
    const msg = makeUserMessage('Timely', 0);
    render(<ChatMessage message={msg} />);
    // The timestamp element should exist
    const container = screen.getByText('Timely').closest('div')!;
    const timeText = container.querySelector('p:last-child');
    expect(timeText).toBeTruthy();
  });

  it('renders tool_call events as ChatToolCall blocks', () => {
    const events = [
      {
        type: 'tool_call' as const,
        requestId: 'r1',
        name: 'Bash',
        args: { command: 'ls -la' },
        id: 'tc1',
      },
    ];
    render(<ChatMessage message={makeAssistantMessage('', events)} />);
    expect(screen.getByText('Bash')).toBeInTheDocument();
    expect(screen.getByText('ls -la')).toBeInTheDocument();
  });

  it('renders permission_request events as ChatPermissionCard', () => {
    const events = [
      {
        type: 'permission_request' as const,
        requestId: 'r1',
        id: 'perm1',
        tool: 'Bash',
        command: 'rm -rf /tmp/test',
      },
    ];
    render(<ChatMessage message={makeAssistantMessage('', events)} />);
    expect(screen.getByText(/permission requested/i)).toBeInTheDocument();
    expect(screen.getByText('Approve')).toBeInTheDocument();
    expect(screen.getByText('Deny')).toBeInTheDocument();
  });

  it('renders thinking events as collapsible blocks', () => {
    const events = [
      {
        type: 'thinking' as const,
        requestId: 'r1',
        content: 'Pondering the meaning...',
      },
    ];
    render(<ChatMessage message={makeAssistantMessage('', events)} />);
    expect(screen.getByText('Thinking...')).toBeInTheDocument();
    // Thinking content should be hidden initially
    expect(screen.queryByText('Pondering the meaning...')).not.toBeInTheDocument();
  });

  it('expands thinking block on click', () => {
    const events = [
      {
        type: 'thinking' as const,
        requestId: 'r1',
        content: 'Deep thoughts',
      },
    ];
    render(<ChatMessage message={makeAssistantMessage('', events)} />);
    fireEvent.click(screen.getByText('Thinking...'));
    expect(screen.getByText('Deep thoughts')).toBeInTheDocument();
  });
});

// ===========================================================================
// ChatToolCall
// ===========================================================================

describe('ChatToolCall', () => {
  const toolEvent: ToolCallEvent = {
    type: 'tool_call',
    requestId: 'r1',
    name: 'Bash',
    args: { command: 'archcanvas add-node --type Service' },
    id: 'tc1',
  };

  it('renders collapsed by default with tool name and summary', () => {
    render(<ChatToolCall event={toolEvent} />);
    expect(screen.getByText('Bash')).toBeInTheDocument();
    expect(screen.getByText('archcanvas add-node --type Service')).toBeInTheDocument();
    // Arguments should NOT be visible
    expect(screen.queryByText('Arguments:')).not.toBeInTheDocument();
  });

  it('expands to show args on click', () => {
    render(<ChatToolCall event={toolEvent} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Arguments:')).toBeInTheDocument();
  });

  it('shows result when provided', () => {
    const result: ToolResultEvent = {
      type: 'tool_result',
      requestId: 'r1',
      id: 'tc1',
      result: 'Node added successfully',
      isError: false,
    };
    render(<ChatToolCall event={toolEvent} result={result} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Result:')).toBeInTheDocument();
    expect(screen.getByText('Node added successfully')).toBeInTheDocument();
  });

  it('highlights error results with red accent', () => {
    const result: ToolResultEvent = {
      type: 'tool_result',
      requestId: 'r1',
      id: 'tc1',
      result: 'Command failed',
      isError: true,
    };
    render(<ChatToolCall event={toolEvent} result={result} />);
    fireEvent.click(screen.getByRole('button'));
    const errorLabel = screen.getByText('Error:');
    expect(errorLabel.className).toContain('text-red-400');
  });
});

// ===========================================================================
// ChatPermissionCard
// ===========================================================================

describe('ChatPermissionCard', () => {
  it('shows tool name and command', () => {
    render(
      <ChatPermissionCard id="p1" tool="Bash" command="rm -rf /tmp" />,
    );
    expect(screen.getByText('Bash')).toBeInTheDocument();
    expect(screen.getByText('rm -rf /tmp')).toBeInTheDocument();
  });

  it('shows Approve, Always Allow, Deny, and Deny & Stop buttons', () => {
    render(
      <ChatPermissionCard id="p1" tool="Bash" command="echo hi" />,
    );
    expect(screen.getByText('Approve')).toBeInTheDocument();
    expect(screen.getByText('Always Allow')).toBeInTheDocument();
    expect(screen.getByText('Deny')).toBeInTheDocument();
    expect(screen.getByText('Deny & Stop')).toBeInTheDocument();
  });

  it('calls respondToPermission and shows Approved on approve', () => {
    const respondSpy = vi.fn();
    useChatStore.setState({
      respondToPermission: respondSpy,
    } as any);

    render(
      <ChatPermissionCard id="p1" tool="Bash" command="echo hi" />,
    );
    fireEvent.click(screen.getByText('Approve'));

    expect(respondSpy).toHaveBeenCalledWith('p1', true);
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.queryByText('Approve')).not.toBeInTheDocument();
    expect(screen.queryByText('Deny')).not.toBeInTheDocument();
  });

  it('calls respondToPermission and shows Denied on deny', () => {
    const respondSpy = vi.fn();
    useChatStore.setState({
      respondToPermission: respondSpy,
    } as any);

    render(
      <ChatPermissionCard id="p2" tool="Bash" command="rm -rf /" />,
    );
    fireEvent.click(screen.getByText('Deny'));

    expect(respondSpy).toHaveBeenCalledWith('p2', false);
    expect(screen.getByText('Denied')).toBeInTheDocument();
  });

  it('shows blockedPath when present', () => {
    render(
      <ChatPermissionCard
        id="p1"
        tool="Edit"
        command="edit file"
        blockedPath="/src/app.ts"
      />,
    );
    expect(screen.getByText('/src/app.ts')).toBeInTheDocument();
    expect(screen.getByText('File:')).toBeInTheDocument();
  });

  it('does not show File: line when blockedPath is absent', () => {
    render(
      <ChatPermissionCard id="p1" tool="Bash" command="ls" />,
    );
    expect(screen.queryByText('File:')).not.toBeInTheDocument();
  });

  it('shows decisionReason when present', () => {
    render(
      <ChatPermissionCard
        id="p1"
        tool="Bash"
        command="rm file"
        decisionReason="This tool is not in the allow list"
      />,
    );
    expect(screen.getByText(/This tool is not in the allow list/)).toBeInTheDocument();
  });

  it('does not show Reason: line when decisionReason is absent', () => {
    render(
      <ChatPermissionCard id="p1" tool="Bash" command="ls" />,
    );
    expect(screen.queryByText(/Reason:/)).not.toBeInTheDocument();
  });

  it('sends fallback addRules on Always Allow when no suggestions', () => {
    const respondSpy = vi.fn();
    useChatStore.setState({
      respondToPermission: respondSpy,
    } as any);

    render(
      <ChatPermissionCard id="p1" tool="Bash" command="echo hi" />,
    );
    fireEvent.click(screen.getByText('Always Allow'));

    expect(respondSpy).toHaveBeenCalledWith('p1', true, {
      updatedPermissions: [{ type: 'addRules', rules: [{ toolName: 'Bash' }], behavior: 'allow', destination: 'localSettings' }],
    });
    expect(screen.getByText('Always Allowed')).toBeInTheDocument();
  });

  it('shows chip selector when Always Allow clicked with suggestions', () => {
    render(
      <ChatPermissionCard
        id="p1"
        tool="Bash"
        command="npm test --ci"
        permissionSuggestions={[
          { type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'npm test:*' }], behavior: 'allow', destination: 'localSettings' },
          { type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'npm run test' }], behavior: 'allow', destination: 'localSettings' },
        ]}
      />,
    );
    fireEvent.click(screen.getByText('Always Allow'));

    // Chips appear
    expect(screen.getByText('npm test:*')).toBeInTheDocument();
    expect(screen.getByText('npm run test')).toBeInTheDocument();
    expect(screen.getByText('Custom...')).toBeInTheDocument();
    // Confirm and Cancel buttons appear
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    // Original 4 buttons are hidden
    expect(screen.queryByText('Approve')).not.toBeInTheDocument();
    expect(screen.queryByText('Deny')).not.toBeInTheDocument();
  });

  it('shows addDirectories suggestions with directory path labels', () => {
    render(
      <ChatPermissionCard
        id="p1"
        tool="Write"
        command="write file"
        permissionSuggestions={[
          { type: 'addDirectories', directories: ['/Users/x/project/src'], destination: 'localSettings' },
        ]}
      />,
    );
    fireEvent.click(screen.getByText('Always Allow'));

    expect(screen.getByText('/Users/x/project/src')).toBeInTheDocument();
  });

  it('Confirm sends selected suggestion as updatedPermissions', () => {
    const respondSpy = vi.fn();
    useChatStore.setState({
      respondToPermission: respondSpy,
    } as any);

    render(
      <ChatPermissionCard
        id="p1"
        tool="Bash"
        command="npm test"
        permissionSuggestions={[
          { type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'npm test:*' }], behavior: 'allow', destination: 'localSettings' },
          { type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'npm test' }], behavior: 'allow', destination: 'localSettings' },
        ]}
      />,
    );
    fireEvent.click(screen.getByText('Always Allow'));
    // First chip is auto-selected — click Confirm
    fireEvent.click(screen.getByText('Confirm'));

    expect(respondSpy).toHaveBeenCalledWith('p1', true, {
      updatedPermissions: [{ type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'npm test:*' }], behavior: 'allow', destination: 'localSettings' }],
    });
    expect(screen.getByText('Always Allowed')).toBeInTheDocument();
  });

  it('clicking a different chip selects it', () => {
    const respondSpy = vi.fn();
    useChatStore.setState({
      respondToPermission: respondSpy,
    } as any);

    render(
      <ChatPermissionCard
        id="p1"
        tool="Bash"
        command="npm test --ci"
        permissionSuggestions={[
          { type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'npm test:*' }], behavior: 'allow', destination: 'localSettings' },
          { type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'npm run test' }], behavior: 'allow', destination: 'localSettings' },
        ]}
      />,
    );
    fireEvent.click(screen.getByText('Always Allow'));
    // Click the second chip
    fireEvent.click(screen.getByText('npm run test'));
    fireEvent.click(screen.getByText('Confirm'));

    expect(respondSpy).toHaveBeenCalledWith('p1', true, {
      updatedPermissions: [{ type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'npm run test' }], behavior: 'allow', destination: 'localSettings' }],
    });
  });

  it('Custom chip reveals text input', () => {
    render(
      <ChatPermissionCard
        id="p1"
        tool="Bash"
        command="npm test"
        permissionSuggestions={[
          { type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'npm test:*' }], behavior: 'allow', destination: 'localSettings' },
        ]}
      />,
    );
    fireEvent.click(screen.getByText('Always Allow'));
    fireEvent.click(screen.getByText('Custom...'));

    const input = screen.getByPlaceholderText('Enter custom rule pattern...');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('npm test:*');
  });

  it('Custom edit builds a custom suggestion on Confirm', () => {
    const respondSpy = vi.fn();
    useChatStore.setState({
      respondToPermission: respondSpy,
    } as any);

    render(
      <ChatPermissionCard
        id="p1"
        tool="Bash"
        command="npm test"
        permissionSuggestions={[
          { type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'npm test:*' }], behavior: 'allow', destination: 'localSettings' },
        ]}
      />,
    );
    fireEvent.click(screen.getByText('Always Allow'));
    fireEvent.click(screen.getByText('Custom...'));

    const input = screen.getByPlaceholderText('Enter custom rule pattern...');
    fireEvent.change(input, { target: { value: 'npm run:*' } });
    fireEvent.click(screen.getByText('Confirm'));

    expect(respondSpy).toHaveBeenCalledWith('p1', true, {
      updatedPermissions: [{ type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'npm run:*' }], behavior: 'allow', destination: 'localSettings' }],
    });
  });

  it('Cancel returns to initial button state', () => {
    render(
      <ChatPermissionCard
        id="p1"
        tool="Bash"
        command="npm test"
        permissionSuggestions={[
          { type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'npm test:*' }], behavior: 'allow', destination: 'localSettings' },
        ]}
      />,
    );
    fireEvent.click(screen.getByText('Always Allow'));
    expect(screen.getByText('Confirm')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));

    // Back to original buttons
    expect(screen.getByText('Approve')).toBeInTheDocument();
    expect(screen.getByText('Always Allow')).toBeInTheDocument();
    expect(screen.getByText('Deny')).toBeInTheDocument();
    expect(screen.queryByText('Confirm')).not.toBeInTheDocument();
  });

  it('handles empty rules array gracefully', () => {
    render(
      <ChatPermissionCard
        id="p1"
        tool="Bash"
        command="echo hi"
        permissionSuggestions={[
          { type: 'addRules', rules: [], behavior: 'allow', destination: 'localSettings' },
        ]}
      />,
    );
    fireEvent.click(screen.getByText('Always Allow'));

    // Should render "tool (any)" label without crashing
    expect(screen.getByText('tool (any)')).toBeInTheDocument();
  });

  it('sends interrupt on Deny & Stop click', () => {
    const respondSpy = vi.fn();
    useChatStore.setState({
      respondToPermission: respondSpy,
    } as any);

    render(
      <ChatPermissionCard id="p1" tool="Bash" command="rm -rf /" />,
    );
    fireEvent.click(screen.getByText('Deny & Stop'));

    expect(respondSpy).toHaveBeenCalledWith('p1', false, { interrupt: true });
    expect(screen.getByText('Denied & Stopped')).toBeInTheDocument();
  });

  it('has a visually distinct left border', () => {
    const { container } = render(
      <ChatPermissionCard id="p1" tool="Bash" command="echo hi" />,
    );
    const card = container.firstElementChild!;
    expect(card.className).toContain('border-l-4');
    expect(card.className).toContain('border-yellow-500');
  });

  it('renders permission_request with blockedPath and decisionReason in ChatMessage', () => {
    const events = [
      {
        type: 'permission_request' as const,
        requestId: 'r1',
        id: 'perm1',
        tool: 'Edit',
        command: 'edit /src/app.ts',
        blockedPath: '/src/app.ts',
        decisionReason: 'File outside project directory',
      },
    ];
    render(<ChatMessage message={makeAssistantMessage('', events)} />);
    expect(screen.getByText('/src/app.ts')).toBeInTheDocument();
    expect(screen.getByText(/File outside project directory/)).toBeInTheDocument();
  });
});

// ===========================================================================
// ChatProviderSelector
// ===========================================================================

describe('ChatProviderSelector', () => {
  it('shows "No providers" when none registered', () => {
    render(<ChatProviderSelector />);
    expect(screen.getByText('No providers')).toBeInTheDocument();
  });

  it('shows provider display name in dropdown', () => {
    const provider = createMockProvider('claude-code');
    useChatStore.setState({
      providers: new Map([['claude-code', provider]]),
      activeProviderId: 'claude-code',
    });

    render(<ChatProviderSelector />);
    // The select should contain the provider's display name
    const select = screen.getByLabelText('AI provider') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.value).toBe('claude-code');
    // Option text includes the dot indicator + display name
    const option = within(select).getByText(/Mock claude-code/);
    expect(option).toBeInTheDocument();
  });

  it('shows availability indicator', () => {
    const available = createMockProvider('a', {
      displayName: 'Provider A',
      available: true,
    });
    const unavailable = createMockProvider('b', {
      displayName: 'Provider B',
      available: false,
    });
    useChatStore.setState({
      providers: new Map([
        ['a', available],
        ['b', unavailable],
      ]),
      activeProviderId: 'a',
    });

    render(<ChatProviderSelector />);
    const select = screen.getByLabelText('AI provider') as HTMLSelectElement;
    const options = select.querySelectorAll('option');
    // Available provider has filled circle, unavailable has outline circle
    expect(options[0].textContent).toContain('\u25CF'); // filled
    expect(options[1].textContent).toContain('\u25CB'); // outline
  });

  it('calls setActiveProvider on change', () => {
    const providerA = createMockProvider('a', { displayName: 'A' });
    const providerB = createMockProvider('b', { displayName: 'B' });
    useChatStore.setState({
      providers: new Map([
        ['a', providerA],
        ['b', providerB],
      ]),
      activeProviderId: 'a',
    });

    render(<ChatProviderSelector />);
    const select = screen.getByLabelText('AI provider') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'b' } });

    // Verify provider was switched
    expect(useChatStore.getState().activeProviderId).toBe('b');
  });
});

// ===========================================================================
// ChatQuestionCard — Preview Rendering
// ===========================================================================

describe('ChatQuestionCard — preview rendering', () => {
  const questionWithPreviews: AskUserQuestion[] = [
    {
      question: 'Which database should we use?',
      header: 'Database Choice',
      multiSelect: false,
      options: [
        {
          label: 'PostgreSQL',
          description: 'Relational database',
          preview: '```sql\nCREATE TABLE users (\n  id SERIAL PRIMARY KEY\n);\n```',
        },
        {
          label: 'MongoDB',
          description: 'Document database',
          preview: '```json\n{ "_id": "abc", "name": "test" }\n```',
        },
        {
          label: 'SQLite',
          description: 'Embedded database',
          // No preview — should render normally without a preview block
        },
      ],
    },
  ];

  it('does not render previews when no option is selected', () => {
    render(<ChatQuestionCard id="q1" questions={questionWithPreviews} />);
    // Preview containers should not exist
    expect(screen.queryByTestId('preview-PostgreSQL')).not.toBeInTheDocument();
    expect(screen.queryByTestId('preview-MongoDB')).not.toBeInTheDocument();
  });

  it('renders preview when an option with preview is selected', () => {
    render(<ChatQuestionCard id="q1" questions={questionWithPreviews} />);
    // Click PostgreSQL
    fireEvent.click(screen.getByText('PostgreSQL'));
    // Preview should appear
    const previewContainer = screen.getByTestId('preview-PostgreSQL');
    expect(previewContainer).toBeInTheDocument();
    const pre = previewContainer.querySelector('pre');
    expect(pre).toBeInTheDocument();
    expect(pre!.textContent).toContain('CREATE TABLE users');
  });

  it('renders preview content as plain text in a <pre> block (no HTML injection)', () => {
    const xssQuestion: AskUserQuestion[] = [
      {
        question: 'Pick one',
        header: 'XSS Test',
        multiSelect: false,
        options: [
          {
            label: 'Evil',
            description: 'Contains HTML',
            preview: '<script>alert("xss")</script><img src=x onerror=alert(1)>',
          },
        ],
      },
    ];
    render(<ChatQuestionCard id="q-xss" questions={xssQuestion} />);
    fireEvent.click(screen.getByText('Evil'));
    const previewContainer = screen.getByTestId('preview-Evil');
    const pre = previewContainer.querySelector('pre');
    // The content should be rendered as plain text, not parsed as HTML
    expect(pre!.textContent).toContain('<script>alert("xss")</script>');
    // No actual script element should exist
    expect(previewContainer.querySelector('script')).toBeNull();
    expect(previewContainer.querySelector('img')).toBeNull();
  });

  it('does not render preview for options without a preview field', () => {
    render(<ChatQuestionCard id="q1" questions={questionWithPreviews} />);
    // Click SQLite (has no preview)
    fireEvent.click(screen.getByText('SQLite'));
    // No preview container for SQLite
    expect(screen.queryByTestId('preview-SQLite')).not.toBeInTheDocument();
    // Other previews should also not be shown (they aren't selected)
    expect(screen.queryByTestId('preview-PostgreSQL')).not.toBeInTheDocument();
  });

  it('preview container has max-height and overflow-y auto', () => {
    render(<ChatQuestionCard id="q1" questions={questionWithPreviews} />);
    fireEvent.click(screen.getByText('PostgreSQL'));
    const pre = screen.getByTestId('preview-PostgreSQL').querySelector('pre')!;
    expect(pre.style.maxHeight).toBe('200px');
    expect(pre.style.whiteSpace).toBe('pre-wrap');
    expect(pre.className).toContain('overflow-y-auto');
  });

  it('preview container has a border', () => {
    render(<ChatQuestionCard id="q1" questions={questionWithPreviews} />);
    fireEvent.click(screen.getByText('PostgreSQL'));
    const container = screen.getByTestId('preview-PostgreSQL');
    expect(container.className).toContain('border');
    expect(container.className).toContain('rounded');
  });

  it('switches preview when selecting a different option (single-select)', () => {
    render(<ChatQuestionCard id="q1" questions={questionWithPreviews} />);
    // Select PostgreSQL first
    fireEvent.click(screen.getByText('PostgreSQL'));
    expect(screen.getByTestId('preview-PostgreSQL')).toBeInTheDocument();
    expect(screen.queryByTestId('preview-MongoDB')).not.toBeInTheDocument();
    // Switch to MongoDB
    fireEvent.click(screen.getByText('MongoDB'));
    expect(screen.queryByTestId('preview-PostgreSQL')).not.toBeInTheDocument();
    expect(screen.getByTestId('preview-MongoDB')).toBeInTheDocument();
    const pre = screen.getByTestId('preview-MongoDB').querySelector('pre')!;
    expect(pre.textContent).toContain('"_id": "abc"');
  });

  it('shows multiple previews in multi-select mode', () => {
    const multiQuestion: AskUserQuestion[] = [
      {
        question: 'Which tools?',
        header: 'Tools',
        multiSelect: true,
        options: [
          { label: 'ESLint', description: 'Linter', preview: 'eslint config preview' },
          { label: 'Prettier', description: 'Formatter', preview: 'prettier config preview' },
          { label: 'TypeScript', description: 'Type checker' },
        ],
      },
    ];
    render(<ChatQuestionCard id="q-multi" questions={multiQuestion} />);
    // Select both ESLint and Prettier
    fireEvent.click(screen.getByText('ESLint'));
    fireEvent.click(screen.getByText('Prettier'));
    // Both previews should be visible
    expect(screen.getByTestId('preview-ESLint')).toBeInTheDocument();
    expect(screen.getByTestId('preview-Prettier')).toBeInTheDocument();
    // TypeScript has no preview field, so no container for it even if selected
    fireEvent.click(screen.getByText('TypeScript'));
    expect(screen.queryByTestId('preview-TypeScript')).not.toBeInTheDocument();
  });

  it('hides preview when option is deselected in multi-select mode', () => {
    const multiQuestion: AskUserQuestion[] = [
      {
        question: 'Which tools?',
        header: 'Tools',
        multiSelect: true,
        options: [
          { label: 'ESLint', description: 'Linter', preview: 'eslint config preview' },
        ],
      },
    ];
    render(<ChatQuestionCard id="q-toggle" questions={multiQuestion} />);
    // Select then deselect
    fireEvent.click(screen.getByText('ESLint'));
    expect(screen.getByTestId('preview-ESLint')).toBeInTheDocument();
    fireEvent.click(screen.getByText('ESLint'));
    expect(screen.queryByTestId('preview-ESLint')).not.toBeInTheDocument();
  });

  it('renders ask_user_question with previews in ChatMessage', () => {
    const events = [
      {
        type: 'ask_user_question' as const,
        requestId: 'r1',
        id: 'q-in-msg',
        questions: questionWithPreviews,
      },
    ];
    render(<ChatMessage message={makeAssistantMessage('', events)} />);
    // The question card should be rendered
    expect(screen.getByText(/Which database should we use/)).toBeInTheDocument();
    // Click an option to show its preview
    fireEvent.click(screen.getByText('PostgreSQL'));
    expect(screen.getByTestId('preview-PostgreSQL')).toBeInTheDocument();
  });
});
