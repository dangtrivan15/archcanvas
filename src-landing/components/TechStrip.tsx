import { motion } from 'motion/react';
import { useScrollReveal } from '../hooks/useScrollReveal';

const TECH_ITEMS = [
  {
    label: 'React 19',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="2" fill="#575279" />
        <ellipse cx="12" cy="12" rx="10" ry="4" stroke="#575279" strokeWidth="1.2" fill="none" />
        <ellipse cx="12" cy="12" rx="10" ry="4" stroke="#575279" strokeWidth="1.2" fill="none" transform="rotate(60 12 12)" />
        <ellipse cx="12" cy="12" rx="10" ry="4" stroke="#575279" strokeWidth="1.2" fill="none" transform="rotate(120 12 12)" />
      </svg>
    ),
  },
  {
    label: 'TypeScript',
    icon: (
      <div className="w-8 h-8 rounded bg-dark-purple flex items-center justify-center">
        <span className="text-cream text-base font-extrabold">TS</span>
      </div>
    ),
  },
  {
    label: 'Tailwind 4',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="#575279">
        <path d="M12 6c-2.67 0-4.33 1.33-5 4 1-1.33 2.17-1.83 3.5-1.5.76.19 1.31.74 1.91 1.35C13.4 10.85 14.5 12 17 12c2.67 0 4.33-1.33 5-4-1 1.33-2.17 1.83-3.5 1.5-.76-.19-1.31-.74-1.91-1.35C15.6 7.15 14.5 6 12 6zM7 12c-2.67 0-4.33 1.33-5 4 1-1.33 2.17-1.83 3.5-1.5.76.19 1.31.74 1.91 1.35C8.4 16.85 9.5 18 12 18c2.67 0 4.33-1.33 5-4-1 1.33-2.17 1.83-3.5 1.5-.76-.19-1.31-.74-1.91-1.35C10.6 13.15 9.5 12 7 12z" />
      </svg>
    ),
  },
  {
    label: 'Tauri 2.0',
    icon: (
      <div className="w-8 h-8 rounded-lg border-2 border-dark-purple flex items-center justify-center">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#575279">
          <circle cx="9" cy="9" r="4" />
          <circle cx="15" cy="15" r="4" />
          <circle cx="9" cy="9" r="2" fill="#faf4ed" />
          <circle cx="15" cy="15" r="2" fill="#faf4ed" />
        </svg>
      </div>
    ),
  },
  {
    label: 'Claude SDK',
    icon: (
      <div className="w-8 h-8 rounded-lg bg-gold flex items-center justify-center">
        <span className="text-white text-xs font-extrabold">AI</span>
      </div>
    ),
  },
  {
    label: 'YAML',
    icon: (
      <div className="w-8 h-8 rounded border-2 border-dark-purple flex items-center justify-center">
        <span className="text-dark-purple text-[10px] font-bold font-mono">{'{}'}</span>
      </div>
    ),
  },
  {
    label: 'Git-native',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="#575279">
        <path d="M23.546 10.93L13.067.452a1.55 1.55 0 00-2.188 0L8.708 2.627l2.76 2.76a1.838 1.838 0 012.327 2.341l2.66 2.66a1.838 1.838 0 11-1.103 1.03l-2.48-2.48v6.53a1.838 1.838 0 11-1.512-.065V8.76a1.838 1.838 0 01-.998-2.41L7.629 3.618.452 10.796a1.55 1.55 0 000 2.188l10.48 10.48a1.55 1.55 0 002.186 0l10.43-10.43a1.55 1.55 0 000-2.104z" />
      </svg>
    ),
  },
] as const;

export function TechStrip() {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>();

  return (
    <section className="relative z-[1] px-14 max-md:px-6 py-13 border-t border-b border-[#e8e0d8]">
      <motion.div
        ref={ref}
        className="max-w-[800px] mx-auto"
        initial={{ opacity: 0 }}
        animate={isVisible ? { opacity: 1 } : {}}
        transition={{ duration: 0.6 }}
      >
        <div className="text-center mb-7 text-muted text-[13px] font-medium uppercase tracking-[2px]">
          Built with
        </div>
        <div className="flex items-center justify-center gap-11 flex-wrap">
          {TECH_ITEMS.map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-1.5 opacity-45">
              {item.icon}
              <span className="text-[10px] text-muted font-medium">{item.label}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
