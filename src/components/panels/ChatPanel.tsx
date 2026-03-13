/**
 * ChatPanel stub — will be replaced by Task 4 (chat panel UI components)
 * when branches are merged.
 */
export function ChatPanel() {
  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <h3 className="text-sm font-medium">AI Chat</h3>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('archcanvas:toggle-chat'))}
          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          aria-label="Close chat"
        >
          &times;
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-xs text-muted-foreground">AI Chat panel loading...</p>
      </div>
    </div>
  );
}
