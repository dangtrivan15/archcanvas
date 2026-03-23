import { motion } from 'motion/react';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { InstallTabs } from './InstallTabs';

export function CtaSection() {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>();

  return (
    <section id="install" className="relative z-[1] px-14 max-md:px-6 py-20 bg-[rgba(87,82,121,0.82)] overflow-hidden">
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
          Install ArchCanvas for Mac. Free for individual use.<br />
          Open format, community-extensible, AI-native.
        </p>

        <div className="max-w-[420px] mx-auto">
          <InstallTabs />
        </div>

        <div className="mt-4 text-[#9e8fa0] text-[11px]">
          macOS 13+ · Apple Silicon & Intel
        </div>
      </motion.div>
    </section>
  );
}
