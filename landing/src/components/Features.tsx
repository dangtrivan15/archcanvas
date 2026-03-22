import { motion } from 'motion/react';
import { useScrollReveal } from '../hooks/useScrollReveal';

const FEATURES = [
  {
    title: 'AI reads your architecture',
    description:
      'Your diagram drives the code. Design visually, commit to git, and AI implements directly from your architecture — not from vague text prompts.',
    gradient: 'from-gold to-[#f6c177]',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
        <path d="M12 2a5 5 0 0 1 5 5c0 2-1 3-2 4l-1 1v2h-4v-2l-1-1c-1-1-2-2-2-4a5 5 0 0 1 5-5z" />
        <line x1="10" y1="18" x2="14" y2="18" />
        <line x1="10" y1="21" x2="14" y2="21" />
      </svg>
    ),
  },
  {
    title: 'Infinite depth',
    description:
      'Dive into any service to see its internals, then zoom back out to the full system. Subsystems nest recursively — just like real architectures.',
    gradient: 'from-teal to-[#9ccfd8]',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    title: 'Git-native YAML',
    description:
      'Human-readable YAML files in .archcanvas/, committed alongside your code. Meaningful diffs in PRs. Architecture reviewed like code.',
    gradient: 'from-purple to-[#c4a7e7]',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="3" />
        <circle cx="19" cy="5" r="2" />
        <circle cx="5" cy="19" r="2" />
        <line x1="14.5" y1="9.5" x2="17.5" y2="6.5" />
        <line x1="9.5" y1="14.5" x2="6.5" y2="17.5" />
      </svg>
    ),
  },
  {
    title: '40+ built-in types',
    description:
      'Services, databases, queues, gateways, AI pipelines — 9 namespaces covering real infrastructure. Define custom types for your team.',
    gradient: 'from-dark-teal to-teal',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
  },
] as const;

export function Features() {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>();

  return (
    <section id="features" className="relative z-[1] px-14 max-md:px-6 py-20">
      <div ref={ref} className="max-w-[880px] mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-block bg-warm-cream/90 text-purple text-[11px] px-3 py-1 rounded-full mb-3 font-semibold border border-purple/15">
            Why ArchCanvas
          </div>
          <h2 className="text-dark-purple text-[30px] font-extrabold tracking-tight leading-tight">
            Architecture tools weren&apos;t<br />built for the AI era.
          </h2>
          <p className="text-muted text-sm mt-2.5 leading-relaxed">
            Most diagrams rot in Figma or Miro, disconnected from the codebase. ArchCanvas is different.
          </p>
        </div>

        {/* 2x2 card grid */}
        <div className="grid grid-cols-2 max-md:grid-cols-1 gap-5">
          {FEATURES.map((feature, index) => (
            <motion.div
              key={feature.title}
              className="bg-white border border-border rounded-[14px] p-7 shadow-[0_2px_12px_rgba(87,82,121,0.06)]"
              initial={{ opacity: 0, y: 20 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: index * 0.1, duration: 0.5 }}
            >
              <div
                className={`w-[46px] h-[46px] rounded-xl flex items-center justify-center mb-4 bg-linear-to-br ${feature.gradient}`}
              >
                {feature.icon}
              </div>
              <h3 className="text-dark-purple text-[17px] font-bold mb-1.5">
                {feature.title}
              </h3>
              <p className="text-muted text-[13px] leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
