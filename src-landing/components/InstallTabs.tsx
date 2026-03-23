import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { BREW_COMMAND } from '../constants';

export function InstallTabs() {
  const [tab, setTab] = useState<'brew' | 'dmg'>('brew');
  const [copied, setCopied] = useState(false);

  const copyCommand = async () => {
    await navigator.clipboard.writeText(BREW_COMMAND);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl overflow-hidden border border-dark-purple/30 shadow-[0_2px_16px_rgba(87,82,121,0.18)]">
      {/* Tab row */}
      <div className="flex bg-dark-purple">
        <button
          onClick={() => setTab('brew')}
          className={`flex-1 px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer border-b-2 ${
            tab === 'brew'
              ? 'border-cream text-cream bg-dark-purple/80'
              : 'border-transparent text-cream/50 hover:text-cream/80'
          }`}
        >
          Homebrew
        </button>
        <button
          onClick={() => setTab('dmg')}
          className={`flex-1 px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer border-b-2 ${
            tab === 'dmg'
              ? 'border-cream text-cream bg-dark-purple/80'
              : 'border-transparent text-cream/50 hover:text-cream/80'
          }`}
        >
          DMG
        </button>
      </div>

      {/* Content — fixed height so switching tabs doesn't shift layout */}
      <div className="bg-[#7d78a8] px-4 h-[46px] flex items-center">
        {tab === 'brew' ? (
          <div className="flex items-center gap-2 w-full">
            <code className="flex-1 text-xs font-mono text-cream truncate">
              <span className="text-gold select-none">$ </span>
              {BREW_COMMAND}
            </code>
            <button
              onClick={copyCommand}
              className="shrink-0 p-1.5 rounded-md text-cream/50 hover:text-cream hover:bg-dark-purple/40 transition-colors cursor-pointer"
              aria-label="Copy command"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
        ) : (
          <div className="w-full text-center text-xs text-cream/50">
            Coming soon
          </div>
        )}
      </div>
    </div>
  );
}
