import { motion } from 'motion/react';
import { GITHUB_RELEASES, DOWNLOAD_ARM64, DOWNLOAD_X64 } from '../constants';
import { useScrollReveal } from '../hooks/useScrollReveal';

export function CtaSection() {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>();

  return (
    <section className="relative z-[1] px-14 max-md:px-6 py-20 bg-[rgba(87,82,121,0.82)] overflow-hidden">
      {/* Light dots behind content, aligned to viewport grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(250,244,237,0.12) 1.15px, transparent 1.15px)',
          backgroundSize: '20px 20px',
          backgroundAttachment: 'fixed',
        }}
      />
      <motion.div
        ref={ref}
        className="relative z-[1] max-w-[600px] mx-auto text-center"
        initial={{ opacity: 0 }}
        animate={isVisible ? { opacity: 1 } : {}}
        transition={{ duration: 0.6 }}
      >
        <img src="/favicon.svg" alt="" width="52" height="52" className="mx-auto mb-5 shadow-[0_4px_20px_rgba(0,0,0,0.2)] rounded-[14px]" />

        <h2 className="text-cream text-[30px] font-extrabold tracking-tight leading-tight mb-3">
          Ready to design your<br />next architecture?
        </h2>
        <p className="text-[#c4b8b0] text-sm mb-7 leading-relaxed">
          Download ArchCanvas for Mac. Free for individual use.<br />
          Open format, community-extensible, AI-native.
        </p>

        <div className="flex gap-3 justify-center">
          <a
            href={DOWNLOAD_ARM64}
            className="bg-cream text-dark-purple px-6 py-3 rounded-[10px] text-sm font-bold shadow-[0_4px_16px_rgba(0,0,0,0.15)] inline-flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            &#63743; Download for Mac
          </a>
          <a
            href={GITHUB_RELEASES}
            target="_blank"
            rel="noopener noreferrer"
            className="border border-cream/25 text-cream px-6 py-3 rounded-[10px] text-sm font-medium inline-flex items-center gap-1.5 bg-dark-purple/50 hover:bg-dark-purple/60 hover:border-cream/40 transition-colors"
          >
            All Releases
          </a>
        </div>

        <div className="mt-4 text-[#9e8fa0] text-[11px]">
          macOS 13+ ·{' '}
          <a href={DOWNLOAD_ARM64} className="underline hover:text-cream/80 transition-colors">Apple Silicon</a>
          {' & '}
          <a href={DOWNLOAD_X64} className="underline hover:text-cream/80 transition-colors">Intel</a>
        </div>
      </motion.div>
    </section>
  );
}
