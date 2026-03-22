import { Star } from 'lucide-react';
import { GITHUB_REPO, GITHUB_RELEASES } from '../constants';

export function CtaSection() {
  return (
    <section className="relative z-[1] px-14 py-20 bg-[rgba(87,82,121,0.82)] overflow-hidden">
      <div className="relative z-[1] max-w-[600px] mx-auto text-center">
        <div className="w-[52px] h-[52px] rounded-[14px] bg-linear-to-br from-purple to-teal mx-auto mb-5 flex items-center justify-center shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#faf4ed" strokeWidth="2" strokeLinecap="round">
            <rect x="4" y="4" width="7" height="7" rx="1.5" />
            <rect x="13" y="4" width="7" height="7" rx="1.5" />
            <rect x="4" y="13" width="7" height="7" rx="1.5" />
            <line x1="17" y1="14" x2="17" y2="20" />
            <line x1="14" y1="17" x2="20" y2="17" />
          </svg>
        </div>

        <h2 className="text-cream text-[30px] font-extrabold tracking-tight leading-tight mb-3">
          Ready to design your<br />next architecture?
        </h2>
        <p className="text-[#c4b8b0] text-sm mb-7 leading-relaxed">
          Download ArchCanvas for Mac. Free for individual use.<br />
          Open format, community-extensible, AI-native.
        </p>

        <div className="flex gap-3 justify-center">
          <a
            href={GITHUB_RELEASES}
            className="bg-cream text-dark-purple px-6 py-3 rounded-[10px] text-sm font-bold shadow-[0_4px_16px_rgba(0,0,0,0.15)] inline-flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            &#63743; Download for Mac
          </a>
          <a
            href={GITHUB_REPO}
            target="_blank"
            rel="noopener noreferrer"
            className="border border-cream/25 text-cream px-6 py-3 rounded-[10px] text-sm font-medium inline-flex items-center gap-1.5 hover:border-cream/40 transition-colors"
          >
            <Star size={14} />
            Star on GitHub
          </a>
        </div>

        <div className="mt-4 text-[#9e8fa0] text-[11px]">
          v0.1.0 · macOS 13+ · Apple Silicon & Intel
        </div>
      </div>
    </section>
  );
}
