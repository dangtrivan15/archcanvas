import { useState } from 'react';
import { motion } from 'motion/react';
import { Check, Copy } from 'lucide-react';
import { GITHUB_RELEASES, DOWNLOAD_ARM64, DOWNLOAD_X64, BREW_COMMAND } from '../constants';
import { useScrollReveal } from '../hooks/useScrollReveal';

export function CtaSection() {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>();
  const [copied, setCopied] = useState(false);

  function copyBrew() {
    navigator.clipboard.writeText(BREW_COMMAND);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

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

        <div className="flex gap-3 justify-center items-stretch">
          <a
            href={DOWNLOAD_ARM64}
            className="bg-cream text-dark-purple px-6 py-3 rounded-[10px] text-sm font-bold shadow-[0_4px_16px_rgba(0,0,0,0.15)] inline-flex items-center justify-center gap-2 hover:opacity-90 transition-opacity border border-transparent"
          >
            &#63743; Download for Mac
          </a>
          <a
            href={GITHUB_RELEASES}
            target="_blank"
            rel="noopener noreferrer"
            className="border border-transparent text-cream px-6 py-3 rounded-[10px] text-sm font-bold inline-flex items-center justify-center gap-1.5 bg-dark-purple hover:bg-dark-purple/90 transition-colors shadow-[0_4px_16px_rgba(0,0,0,0.15)]"
          >
            All Releases
          </a>
        </div>

        <div id="brew" className="mt-6 flex items-center justify-center gap-3 text-[#c4b8b0] text-[11px]">
          <span className="h-px w-8 bg-cream/15" />
          <span>or install with Homebrew</span>
          <span className="h-px w-8 bg-cream/15" />
        </div>

        <div className="mt-3 flex items-center justify-center gap-0 mx-auto bg-[rgba(30,25,50,0.5)] border border-cream/10 rounded-lg overflow-hidden w-fit">
          <code className="text-cream/80 text-[13px] font-mono px-4 py-2.5 text-left whitespace-nowrap">
            <span className="text-[#e6b450] select-none">$ </span><span className="select-all">{BREW_COMMAND}</span>
          </code>
          <button
            onClick={copyBrew}
            className="px-3 py-2.5 text-cream/50 hover:text-cream/90 transition-colors cursor-pointer shrink-0"
            aria-label="Copy command"
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
          </button>
        </div>

        <div className="mt-4 text-[#c4b8b0] text-[11px]">
          macOS 13+ ·{' '}
          <a href={DOWNLOAD_ARM64} className="underline hover:text-cream/80 transition-colors">Apple Silicon</a>
          {' & '}
          <a href={DOWNLOAD_X64} className="underline hover:text-cream/80 transition-colors">Intel</a>
        </div>
      </motion.div>
    </section>
  );
}
