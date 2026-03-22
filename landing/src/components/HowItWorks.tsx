function StepArrow({ color }: { color: string }) {
  return (
    <div className="flex-[0_0_40px] flex items-center justify-center pt-7">
      <svg width="40" height="20" viewBox="0 0 40 20">
        <line x1="0" y1="10" x2="30" y2="10" stroke={color} strokeWidth="2" opacity="0.3" />
        <polyline
          points="26,5 32,10 26,15"
          fill="none"
          stroke={color}
          strokeWidth="2"
          opacity="0.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function HowItWorks() {
  return (
    <section className="relative z-[1] px-14 py-20 bg-[rgba(242,233,225,0.55)]">
      <div className="max-w-[880px] mx-auto">
        <div className="text-center mb-12">
          <div className="inline-block bg-warm-cream/90 text-purple text-[11px] px-3 py-1 rounded-full mb-3 font-semibold border border-purple/15">
            How it works
          </div>
          <h2 className="text-dark-purple text-[30px] font-extrabold tracking-tight leading-tight">
            From diagram to working code<br />in three steps.
          </h2>
        </div>

        <div className="flex items-stretch">
          <div className="flex-1 text-center flex flex-col">
            <div className="w-16 h-16 rounded-full bg-white border-2 border-purple flex items-center justify-center mx-auto mb-4 shadow-[0_4px_16px_rgba(87,82,121,0.08)] text-2xl font-extrabold text-purple shrink-0">
              1
            </div>
            <div className="bg-white border border-border rounded-[10px] p-3 mx-2.5 mb-3.5 shadow-[0_2px_8px_rgba(87,82,121,0.05)] min-h-[120px] flex-1 flex flex-col justify-center">
              <svg width="100%" height="80" viewBox="0 0 160 80">
                <pattern id="s1dots" width="12" height="12" patternUnits="userSpaceOnUse">
                  <circle cx="6" cy="6" r="0.8" fill="#575279" opacity="0.15" />
                </pattern>
                <rect width="160" height="80" fill="url(#s1dots)" />
                <line x1="50" y1="25" x2="110" y2="25" stroke="#907aa9" strokeWidth="1.2" opacity="0.4" />
                <line x1="50" y1="25" x2="80" y2="60" stroke="#56949f" strokeWidth="1.2" opacity="0.4" />
                <line x1="110" y1="25" x2="80" y2="60" stroke="#ea9d34" strokeWidth="1.2" opacity="0.4" />
                <rect x="32" y="14" width="36" height="22" rx="5" fill="#fff" stroke="#907aa9" strokeWidth="1.5" />
                <rect x="92" y="14" width="36" height="22" rx="5" fill="#fff" stroke="#56949f" strokeWidth="1.5" />
                <rect x="62" y="49" width="36" height="22" rx="11" fill="#fff" stroke="#ea9d34" strokeWidth="1.5" />
              </svg>
            </div>
            <h3 className="text-dark-purple text-base font-bold mb-1 shrink-0">Design</h3>
            <p className="text-muted text-xs leading-normal px-2 shrink-0">
              Draw your system on the canvas. Nodes, edges, subsystems — as deep as you need.
            </p>
          </div>

          <StepArrow color="#907aa9" />

          <div className="flex-1 text-center flex flex-col">
            <div className="w-16 h-16 rounded-full bg-white border-2 border-teal flex items-center justify-center mx-auto mb-4 shadow-[0_4px_16px_rgba(87,82,121,0.08)] text-2xl font-extrabold text-teal shrink-0">
              2
            </div>
            <div className="bg-white border border-border rounded-[10px] p-3 mx-2.5 mb-3.5 shadow-[0_2px_8px_rgba(87,82,121,0.05)] min-h-[120px] flex-1 flex flex-col justify-center">
              <div className="text-left font-mono text-[9px] leading-[1.7] text-dark-purple">
                <div><span className="text-purple">nodes:</span></div>
                <div className="pl-2.5"><span className="text-teal">- id:</span> api-gateway</div>
                <div className="pl-3.5"><span className="text-teal">type:</span> network/gateway</div>
                <div className="pl-2.5"><span className="text-teal">- id:</span> order-svc</div>
                <div className="pl-3.5"><span className="text-teal">type:</span> compute/service</div>
                <div><span className="text-purple">edges:</span></div>
                <div className="pl-2.5"><span className="text-gold">- from:</span> api-gateway</div>
              </div>
            </div>
            <h3 className="text-dark-purple text-base font-bold mb-1 shrink-0">Commit</h3>
            <p className="text-muted text-xs leading-normal px-2 shrink-0">
              YAML files in <code className="bg-warm-cream px-1 py-0.5 rounded text-xs font-mono">.archcanvas/</code> go into git. Review architecture changes in PRs.
            </p>
          </div>

          <StepArrow color="#56949f" />

          <div className="flex-1 text-center flex flex-col">
            <div className="w-16 h-16 rounded-full bg-white border-2 border-gold flex items-center justify-center mx-auto mb-4 shadow-[0_4px_16px_rgba(87,82,121,0.08)] text-2xl font-extrabold text-gold shrink-0">
              3
            </div>
            <div className="bg-white border border-border rounded-[10px] p-3 mx-2.5 mb-3.5 shadow-[0_2px_8px_rgba(87,82,121,0.05)] min-h-[120px] flex-1 flex flex-col justify-center">
              <div className="flex items-start gap-2 mb-2">
                <div className="w-[18px] h-[18px] rounded-[5px] bg-gold flex items-center justify-center shrink-0">
                  <span className="text-white text-[8px] font-bold">AI</span>
                </div>
                <div className="bg-warm-cream rounded-md px-2 py-1.5 text-[9px] text-dark-purple leading-snug">
                  I&apos;ll implement the Order Service with gRPC endpoints based on your architecture.
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex-1 h-0.5 bg-teal/30 rounded-full" />
                <span className="text-[8px] text-teal font-medium">generating code...</span>
              </div>
            </div>
            <h3 className="text-dark-purple text-base font-bold mb-1 shrink-0">Generate</h3>
            <p className="text-muted text-xs leading-normal px-2 shrink-0">
              AI reads your architecture as the source of truth and turns it into working code.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
