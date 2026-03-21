import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Checkbox } from '@/components/ui/checkbox';
import { useChatStore } from '@/store/chatStore';
import type { SurveyData } from '@/store/fileStore';

interface AiSurveyStepProps {
  onBack: () => void;
  onStart: (survey: SurveyData) => void;
}

const TECH_STACK_OPTIONS = [
  'TypeScript',
  'JavaScript',
  'Python',
  'Go',
  'Java',
  'Rust',
  'C#',
  'Ruby',
  'PHP',
  'Swift',
  'Kotlin',
];

export function AiSurveyStep({ onBack, onStart }: AiSurveyStepProps) {
  const prefersReduced = useReducedMotion();

  const [description, setDescription] = useState('');
  const [techStack, setTechStack] = useState<string[]>([]);
  const [explorationDepth, setExplorationDepth] = useState<'full' | 'top-level' | 'custom'>('full');
  const [customDepth, setCustomDepth] = useState(3);
  const [focusDirs, setFocusDirs] = useState('');

  const aiAvailable = useChatStore((s) => {
    for (const p of s.providers.values()) {
      if (p.available) return true;
    }
    return false;
  });

  const canStart = description.trim().length > 0 && aiAvailable;

  function toggleTech(tech: string) {
    setTechStack((prev) =>
      prev.includes(tech) ? prev.filter((t) => t !== tech) : [...prev, tech],
    );
  }

  function handleStart() {
    const survey: SurveyData = {
      description: description.trim(),
      techStack,
      explorationDepth,
      ...(explorationDepth === 'custom' ? { customDepth } : {}),
      focusDirs: focusDirs.trim(),
    };
    onStart(survey);
  }

  function sectionProps(delay: number) {
    return {
      initial: prefersReduced ? false as const : { opacity: 0, y: 10 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.2, delay },
    };
  }

  return (
    <div className="flex w-full max-w-lg flex-col gap-6 px-4">
      <motion.div className="text-center" {...sectionProps(0)}>
        <h1 className="text-3xl font-bold tracking-tight">Configure AI Analysis</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tell us about your project so AI can generate a better diagram
        </p>
      </motion.div>

      <AnimatePresence>
        {!aiAvailable && (
          <motion.div
            key="ai-unavailable"
            initial={prefersReduced ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={prefersReduced ? undefined : { opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400"
              role="alert"
              data-testid="ai-unavailable-banner"
            >
              AI is not connected. The analysis will start once a connection is established.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Description */}
      <motion.div className="flex flex-col gap-1.5" {...sectionProps(0.05)}>
        <label htmlFor="description" className="text-sm font-medium">
          Description <span className="text-red-400">*</span>
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what this project does..."
          rows={3}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </motion.div>

      {/* Tech stack */}
      <motion.div className="flex flex-col gap-1.5" {...sectionProps(0.15)}>
        <label className="text-sm font-medium">Tech Stack</label>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {TECH_STACK_OPTIONS.map((tech) => {
            const selected = techStack.includes(tech);
            return (
              <label
                key={tech}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <Checkbox
                  checked={selected}
                  onCheckedChange={() => toggleTech(tech)}
                  data-selected={selected}
                />
                {tech}
              </label>
            );
          })}
        </div>
      </motion.div>

      {/* Exploration depth */}
      <motion.div className="flex flex-col gap-1.5" {...sectionProps(0.2)}>
        <label htmlFor="depth" className="text-sm font-medium">
          Exploration Depth
        </label>
        <select
          id="depth"
          value={explorationDepth}
          onChange={(e) => setExplorationDepth(e.target.value as 'full' | 'top-level' | 'custom')}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="full">Full</option>
          <option value="top-level">Top-level only</option>
          <option value="custom">Custom</option>
        </select>
        <AnimatePresence>
          {explorationDepth === 'custom' && (
            <motion.div
              key="custom-depth"
              initial={prefersReduced ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={prefersReduced ? undefined : { opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div className="mt-1 flex items-center gap-2">
                <label htmlFor="custom-depth" className="text-xs text-muted-foreground">
                  Max depth:
                </label>
                <input
                  id="custom-depth"
                  type="number"
                  min={1}
                  max={20}
                  value={customDepth}
                  onChange={(e) => setCustomDepth(Number(e.target.value))}
                  className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Focus directories */}
      <motion.div className="flex flex-col gap-1.5" {...sectionProps(0.25)}>
        <label htmlFor="focus-dirs" className="text-sm font-medium">
          Focus Directories
        </label>
        <input
          id="focus-dirs"
          type="text"
          value={focusDirs}
          onChange={(e) => setFocusDirs(e.target.value)}
          placeholder="e.g., src/, services/ (leave empty for all)"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </motion.div>

      {/* Buttons */}
      <motion.div className="flex justify-between" {...sectionProps(0.3)}>
        <motion.button
          type="button"
          onClick={onBack}
          className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          whileHover={prefersReduced ? undefined : { x: -3 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        >
          Back
        </motion.button>
        <motion.button
          type="button"
          onClick={handleStart}
          disabled={!canStart}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/80 disabled:cursor-not-allowed disabled:opacity-50"
          whileTap={prefersReduced ? undefined : { scale: 0.97 }}
        >
          Start
        </motion.button>
      </motion.div>
    </div>
  );
}
