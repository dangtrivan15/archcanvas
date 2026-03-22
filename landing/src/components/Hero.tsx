import { useState } from 'react';
import { HeroDiagram } from './HeroDiagram';
import { VideoModal } from './VideoModal';
import { GITHUB_RELEASES } from '../constants';

export function Hero() {
  const [videoOpen, setVideoOpen] = useState(false);

  return (
    <section id="hero" className="relative overflow-hidden pb-6">
      {/* Radial fade for text readability over dot grid */}
      <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-[1]" aria-hidden="true">
        <defs>
          <radialGradient id="hero-fade" cx="0.22" cy="0.5" r="0.45">
            <stop offset="0%" stopColor="#faf4ed" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#faf4ed" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-fade)" />
      </svg>

      <div className="relative z-[2] px-14 max-w-[1280px] mx-auto">
        {/* Hero split: text left (38%), diagram right (62%) */}
        <div className="flex gap-12 items-center">
          {/* Text side */}
          <div className="flex-[0_0_38%] max-w-[38%]">
            <div className="inline-block bg-warm-cream/90 text-purple text-xs px-3.5 py-1.5 rounded-full mb-[18px] font-semibold border border-purple/15">
              AI-native architecture tool
            </div>
            <h1 className="text-[40px] font-extrabold leading-[1.12] tracking-tight mb-1.5">
              You design the<br />architecture.
            </h1>
            <p className="text-[40px] font-extrabold leading-[1.12] tracking-tight text-purple mb-1.5">
              AI writes the code.
            </p>
            <p className="text-muted text-base mb-7 leading-relaxed">
              The diagram <em>is</em> the spec. Design visually on an interactive canvas,
              commit to git, and let AI implement from your architecture.
            </p>
            <div className="flex gap-3">
              <a
                href={GITHUB_RELEASES}
                className="bg-dark-purple text-cream px-6 py-3 rounded-[10px] text-sm font-semibold shadow-[0_2px_8px_rgba(87,82,121,0.25)] inline-flex items-center gap-2 hover:opacity-90 transition-opacity"
              >
                &#63743; Download for Mac
              </a>
              <button
                onClick={() => setVideoOpen(true)}
                className="border border-border text-dark-purple px-6 py-3 rounded-[10px] text-sm bg-cream/70 backdrop-blur-sm hover:bg-warm-cream/70 transition-colors cursor-pointer"
              >
                Watch demo
              </button>
            </div>
          </div>

          {/* Diagram side */}
          <HeroDiagram />
        </div>
      </div>

      <VideoModal open={videoOpen} onOpenChange={setVideoOpen} />
    </section>
  );
}
