/**
 * ChatQuestionCard -- renders Claude's AskUserQuestion clarifying questions.
 *
 * When Claude needs user input to proceed (e.g. "Which database should I use?"),
 * the SDK calls AskUserQuestion with structured questions and options.  This
 * component renders those questions as interactive option buttons.
 *
 * The user clicks an option (or types free text via "Other"), and their
 * selections are sent back to the bridge via chatStore.respondToQuestion().
 * The bridge returns them to the SDK as `updatedInput.answers`, which
 * unblocks the canUseTool callback and lets Claude continue.
 *
 * Each question supports:
 *   - Single-select (radio-style): click one option
 *   - Multi-select: click multiple options (labels joined with ", ")
 *   - Free-text "Other": type a custom answer
 *
 * See: https://platform.claude.com/docs/en/agent-sdk/user-input
 */

import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useChatStore } from '@/store/chatStore';
import type { AskUserQuestion } from '@/core/ai/types';

interface Props {
  /** The tool_use ID -- correlates the response back to the bridge. */
  id: string;
  /** The questions Claude wants answered. */
  questions: AskUserQuestion[];
}

export function ChatQuestionCard({ id, questions }: Props) {
  // Track per-question selections.  Key = question text, value = selected label(s).
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  // Track "Other" free-text input per question.
  const [otherText, setOtherText] = useState<Record<string, string>>({});
  // Track which questions have "Other" mode active.
  const [otherActive, setOtherActive] = useState<Record<string, boolean>>({});
  // Once submitted, lock the card.
  const [submitted, setSubmitted] = useState(false);
  const prefersReduced = useReducedMotion();

  const handleSelect = (questionText: string, label: string, multiSelect: boolean) => {
    setSelections((prev) => {
      const current = prev[questionText] ?? [];
      if (multiSelect) {
        // Toggle: add or remove
        const next = current.includes(label)
          ? current.filter((l) => l !== label)
          : [...current, label];
        return { ...prev, [questionText]: next };
      }
      // Single-select: replace.  Also clear "Other" mode.
      setOtherActive((oa) => ({ ...oa, [questionText]: false }));
      return { ...prev, [questionText]: [label] };
    });
  };

  const handleOtherToggle = (questionText: string) => {
    setOtherActive((prev) => ({ ...prev, [questionText]: !prev[questionText] }));
    // Clear preset selection when switching to "Other"
    if (!otherActive[questionText]) {
      setSelections((prev) => ({ ...prev, [questionText]: [] }));
    }
  };

  const handleSubmit = () => {
    // Build the answers record: question text -> selected label or free text.
    const answers: Record<string, string> = {};
    for (const q of questions) {
      if (q.options.length === 0) {
        // Open question -- always use free text.
        answers[q.question] = (otherText[q.question] ?? '').trim();
      } else if (otherActive[q.question] && otherText[q.question]?.trim()) {
        // "Other" free-text answer -- use the typed text directly.
        answers[q.question] = otherText[q.question].trim();
      } else {
        const selected = selections[q.question] ?? [];
        // For multi-select, join with ", " per SDK convention.
        answers[q.question] = selected.join(', ');
      }
    }

    useChatStore.getState().respondToQuestion(id, answers);
    setSubmitted(true);
  };

  // Check if all questions have an answer.
  const allAnswered = questions.every((q) => {
    // Open question (no options) -- answered if text is non-empty.
    if (q.options.length === 0) return !!otherText[q.question]?.trim();
    // "Other" mode active -- answered if text is non-empty.
    if (otherActive[q.question]) return !!otherText[q.question]?.trim();
    // Choice question -- answered if at least one option is selected.
    return (selections[q.question] ?? []).length > 0;
  });

  if (submitted) {
    // Show a locked summary of what the user selected.
    return (
      <motion.div
        className="my-1 rounded border border-border bg-card p-2"
        initial={prefersReduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
      >
        <p className="text-xs font-medium text-green-400">Answered</p>
        {questions.map((q) => (
          <p key={q.question} className="mt-0.5 text-xs text-muted-foreground">
            {q.header}:{' '}
            <span className="text-card-foreground">
              {q.options.length === 0 || otherActive[q.question]
                ? otherText[q.question]
                : (selections[q.question] ?? []).join(', ')}
            </span>
          </p>
        ))}
      </motion.div>
    );
  }

  return (
    <motion.div
      className="my-1 space-y-2 rounded border border-border bg-card p-2"
      initial={prefersReduced ? false : { scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {questions.map((q) => (
        <div key={q.question}>
          <p className="text-xs font-medium text-card-foreground">
            {q.header}: {q.question}
          </p>

          {q.options.length > 0 ? (
            <>
              {/* Option buttons */}
              <div className="mt-1 flex flex-wrap gap-1">
                {q.options.map((opt, optIdx) => {
                  const isSelected = (selections[q.question] ?? []).includes(opt.label);
                  return (
                    <motion.button
                      key={opt.label}
                      onClick={() => handleSelect(q.question, opt.label, q.multiSelect)}
                      title={opt.description}
                      className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                        isSelected
                          ? 'bg-accent text-accent-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                      initial={prefersReduced ? false : { opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.15, delay: prefersReduced ? 0 : optIdx * 0.03 }}
                    >
                      {opt.label}
                    </motion.button>
                  );
                })}

                {/* "Other" toggle -- lets the user type a free-text answer */}
                <motion.button
                  onClick={() => handleOtherToggle(q.question)}
                  className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                    otherActive[q.question]
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                  initial={prefersReduced ? false : { opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.15, delay: prefersReduced ? 0 : q.options.length * 0.03 }}
                >
                  Other...
                </motion.button>
              </div>

              {/* Preview for selected option(s) */}
              {q.options
                .filter(
                  (opt) =>
                    opt.preview &&
                    (selections[q.question] ?? []).includes(opt.label),
                )
                .map((opt) => (
                  <motion.div
                    key={`preview-${opt.label}`}
                    className="mt-1 rounded border border-border"
                    data-testid={`preview-${opt.label}`}
                    initial={prefersReduced ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                  >
                    <pre
                      className="overflow-y-auto p-2 text-[11px] text-muted-foreground"
                      style={{ whiteSpace: 'pre-wrap', maxHeight: '200px' }}
                    >
                      {opt.preview}
                    </pre>
                  </motion.div>
                ))}

              {/* Free-text input (shown when "Other" is active) */}
              {otherActive[q.question] && (
                <motion.div
                  initial={prefersReduced ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  <input
                    type="text"
                    value={otherText[q.question] ?? ''}
                    onChange={(e) =>
                      setOtherText((prev) => ({ ...prev, [q.question]: e.target.value }))
                    }
                    placeholder="Type your answer..."
                    className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground"
                    autoFocus
                  />
                </motion.div>
              )}
            </>
          ) : (
            /* Open question -- no predefined options, show text input directly */
            <input
              type="text"
              value={otherText[q.question] ?? ''}
              onChange={(e) =>
                setOtherText((prev) => ({ ...prev, [q.question]: e.target.value }))
              }
              placeholder="Type your answer..."
              className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground"
              autoFocus
            />
          )}
        </div>
      ))}

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={!allAnswered}
        className="rounded bg-accent px-3 py-1 text-xs font-medium text-accent-foreground hover:bg-accent/80 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Submit
      </button>
    </motion.div>
  );
}
