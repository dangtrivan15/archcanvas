import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { useChatStore } from '@/store/chatStore';
import { ChatPanel } from '@/components/panels/ChatPanel';
import { ChatMessage } from '@/components/panels/ChatMessage';
import { ChatToolCall } from '@/components/panels/ChatToolCall';
import { ChatPermissionCard } from '@/components/panels/ChatPermissionCard';
import { ChatProviderSelector } from '@/components/panels/ChatProviderSelector';
import type {
  ChatMessage as ChatMessageType,
  ChatProvider,
  ToolCallEvent,
  ToolResultEvent,
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

  it('shows Approve and Deny buttons', () => {
    render(
      <ChatPermissionCard id="p1" tool="Bash" command="echo hi" />,
    );
    expect(screen.getByText('Approve')).toBeInTheDocument();
    expect(screen.getByText('Deny')).toBeInTheDocument();
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
