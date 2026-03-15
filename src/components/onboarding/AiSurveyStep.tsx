import { useState } from 'react';
import { useChatStore } from '@/store/chatStore';
import { useFileStore } from '@/store/fileStore';
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
  // Pre-fill project path from fs.getPath() if available (Node/Tauri)
  const fsPath = useFileStore((s) => s.fs?.getPath() ?? '');

  const [description, setDescription] = useState('');
  const [projectPath, setProjectPath] = useState(fsPath);
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

  const canStart = description.trim().length > 0 && projectPath.trim().length > 0 && aiAvailable;

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
      projectPath: projectPath.trim(),
    };
    onStart(survey);
  }

  return (
    <div className="flex w-full max-w-lg flex-col gap-6 px-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Configure AI Analysis</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tell us about your project so AI can generate a better diagram
        </p>
      </div>

      {!aiAvailable && (
        <div
          className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400"
          role="alert"
          data-testid="ai-unavailable-banner"
        >
          AI is not connected. The analysis will start once a connection is established.
        </div>
      )}

      {/* Description */}
      <div className="flex flex-col gap-1.5">
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
      </div>

      {/* Project Path */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="project-path" className="text-sm font-medium">
          Project Path <span className="text-red-400">*</span>
        </label>
        <input
          id="project-path"
          type="text"
          value={projectPath}
          onChange={(e) => setProjectPath(e.target.value)}
          placeholder="/Users/you/projects/my-app"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Tech stack */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Tech Stack</label>
        <div className="flex flex-wrap gap-2">
          {TECH_STACK_OPTIONS.map((tech) => {
            const selected = techStack.includes(tech);
            return (
              <button
                key={tech}
                type="button"
                onClick={() => toggleTech(tech)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  selected
                    ? 'bg-accent text-accent-foreground'
                    : 'border border-border bg-background text-muted-foreground hover:bg-accent/50'
                }`}
                data-selected={selected}
              >
                {tech}
              </button>
            );
          })}
        </div>
      </div>

      {/* Exploration depth */}
      <div className="flex flex-col gap-1.5">
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
        {explorationDepth === 'custom' && (
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
        )}
      </div>

      {/* Focus directories */}
      <div className="flex flex-col gap-1.5">
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
      </div>

      {/* Buttons */}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleStart}
          disabled={!canStart}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Start
        </button>
      </div>
    </div>
  );
}
