import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { ArchTemplate } from '@/core/templates/schema';
import { TemplateGrid } from '@/components/templates/TemplateGrid';

interface TemplatePickerStepProps {
  onBack: () => void;
  onSelect: (template: ArchTemplate) => void;
}

export function TemplatePickerStep({ onBack, onSelect }: TemplatePickerStepProps) {
  const [selected, setSelected] = useState<ArchTemplate | null>(null);
  const prefersReduced = useReducedMotion();

  function handleUse() {
    if (selected) onSelect(selected);
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6 px-4">
      <motion.div
        className="text-center"
        initial={prefersReduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.05 }}
      >
        <h1 className="text-3xl font-bold tracking-tight">Choose a Template</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Start with a pre-built architecture pattern and customize it
        </p>
      </motion.div>

      <motion.div
        className="max-h-[50vh] overflow-y-auto rounded-lg border border-border bg-background p-4"
        initial={prefersReduced ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.1 }}
      >
        <TemplateGrid
          onSelect={setSelected}
          selectedId={selected?.id}
        />
      </motion.div>

      {/* Action buttons */}
      <motion.div
        className="flex justify-between"
        initial={prefersReduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.15 }}
      >
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
          onClick={handleUse}
          disabled={!selected}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/80 disabled:cursor-not-allowed disabled:opacity-50"
          whileTap={prefersReduced ? undefined : { scale: 0.97 }}
        >
          Use Template
        </motion.button>
      </motion.div>
    </div>
  );
}
