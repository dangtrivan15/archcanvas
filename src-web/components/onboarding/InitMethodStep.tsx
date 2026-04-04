import { motion, useReducedMotion } from 'motion/react';
import { useChatStore } from '@/store/chatStore';

interface InitMethodStepProps {
  onBlankCanvas: () => void;
  onAiAnalyze: () => void;
  onTemplate: () => void;
}

export function InitMethodStep({ onBlankCanvas, onAiAnalyze, onTemplate }: InitMethodStepProps) {
  const prefersReduced = useReducedMotion();

  const aiAvailable = useChatStore((s) => {
    for (const p of s.providers.values()) {
      if (p.available) return true;
    }
    return false;
  });

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center">
        <motion.h1
          className="text-3xl font-bold tracking-tight"
          initial={prefersReduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.05 }}
        >
          Welcome to ArchCanvas
        </motion.h1>
        <motion.p
          className="mt-2 text-sm text-muted-foreground"
          initial={prefersReduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.12 }}
        >
          Choose how you'd like to start your architecture diagram
        </motion.p>
      </div>

      <div className="flex gap-4">
        {/* AI Analyze card */}
        <motion.button
          onClick={onAiAnalyze}
          className="flex w-64 flex-col items-center gap-3 rounded-lg border border-border bg-background p-6 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
          initial={prefersReduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.2 }}
          whileHover={prefersReduced ? undefined : { y: -4, boxShadow: '0 8px 25px rgba(0,0,0,0.1)' }}
          whileTap={prefersReduced ? undefined : { scale: 0.98 }}
        >
          <div className="text-4xl">🤖</div>
          <div className="text-center">
            <div className="font-semibold">AI Analyze</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Let AI scan your codebase and propose an architecture. You'll watch it build in real-time.
            </p>
            {!aiAvailable && (
              <motion.p
                className="mt-1 text-xs text-muted-foreground opacity-60"
                data-testid="ai-hint"
                animate={prefersReduced ? undefined : { opacity: [0.6, 0.4, 0.6] }}
                transition={prefersReduced ? undefined : { duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                Requires AI connection
              </motion.p>
            )}
          </div>
        </motion.button>

        {/* Blank Canvas card */}
        <motion.button
          onClick={onBlankCanvas}
          className="flex w-64 flex-col items-center gap-3 rounded-lg border border-border bg-background p-6 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
          initial={prefersReduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.35 }}
          whileHover={prefersReduced ? undefined : { y: -4, boxShadow: '0 8px 25px rgba(0,0,0,0.1)' }}
          whileTap={prefersReduced ? undefined : { scale: 0.98 }}
        >
          <div className="text-4xl">📄</div>
          <div className="text-center">
            <div className="font-semibold">Blank Canvas</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Start with an empty canvas. Add nodes manually or ask AI later via the chat panel.
            </p>
          </div>
        </motion.button>

        {/* Start from Template card */}
        <motion.button
          onClick={onTemplate}
          className="flex w-64 flex-col items-center gap-3 rounded-lg border border-border bg-background p-6 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
          initial={prefersReduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.5 }}
          whileHover={prefersReduced ? undefined : { y: -4, boxShadow: '0 8px 25px rgba(0,0,0,0.1)' }}
          whileTap={prefersReduced ? undefined : { scale: 0.98 }}
        >
          <div className="text-4xl">📐</div>
          <div className="text-center">
            <div className="font-semibold">Start from Template</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose from pre-built architecture patterns like microservices, serverless, or data pipelines.
            </p>
          </div>
        </motion.button>
      </div>
    </div>
  );
}
