import { useChatStore } from '@/store/chatStore';

interface InitMethodStepProps {
  onBlankCanvas: () => void;
  onAiAnalyze: () => void;
}

export function InitMethodStep({ onBlankCanvas, onAiAnalyze }: InitMethodStepProps) {
  const aiAvailable = useChatStore((s) => {
    for (const p of s.providers.values()) {
      if (p.available) return true;
    }
    return false;
  });

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Welcome to ArchCanvas</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose how you'd like to start your architecture diagram
        </p>
      </div>

      <div className="flex gap-4">
        {/* AI Analyze card */}
        <button
          onClick={onAiAnalyze}
          className="flex w-64 flex-col items-center gap-3 rounded-lg border border-border bg-background p-6 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <div className="text-4xl">🤖</div>
          <div className="text-center">
            <div className="font-semibold">AI Analyze</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Let AI scan your codebase and propose an architecture. You'll watch it build in real-time.
            </p>
            {!aiAvailable && (
              <p className="mt-1 text-xs text-muted-foreground opacity-60" data-testid="ai-hint">
                Requires AI connection
              </p>
            )}
          </div>
        </button>

        {/* Blank Canvas card */}
        <button
          onClick={onBlankCanvas}
          className="flex w-64 flex-col items-center gap-3 rounded-lg border border-border bg-background p-6 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <div className="text-4xl">📄</div>
          <div className="text-center">
            <div className="font-semibold">Blank Canvas</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Start with an empty canvas. Add nodes manually or ask AI later via the chat panel.
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
