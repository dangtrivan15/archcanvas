import { useState } from 'react';
import { Menu } from 'lucide-react';
import { MobileMenu } from './MobileMenu';
import { GITHUB_RELEASES, NAV_LINKS } from '../constants';

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="flex items-center justify-between px-14 max-md:px-6 py-7 max-w-[1280px] mx-auto">
      {/* Logo */}
      <a href="/" className="flex items-center gap-2.5">
        <div className="w-[26px] h-[26px] rounded-[7px] bg-linear-to-br from-purple to-teal" />
        <span className="text-dark-purple text-[17px] font-bold tracking-tight">
          ArchCanvas
        </span>
      </a>

      {/* Desktop links */}
      <div className="hidden md:flex items-center gap-6">
        {NAV_LINKS.map((link) => (
          <a
            key={link.label}
            href={link.href}
            {...('external' in link ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="text-muted text-[13px] font-medium hover:text-dark-purple transition-colors"
          >
            {link.label}
          </a>
        ))}
        <a
          href={GITHUB_RELEASES}
          className="bg-dark-purple text-cream px-[18px] py-[7px] rounded-lg text-[13px] font-semibold hover:opacity-90 transition-opacity"
        >
          Download for Mac
        </a>
      </div>

      {/* Mobile hamburger */}
      <button
        className="md:hidden p-2 text-dark-purple"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu size={24} />
      </button>

      <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </nav>
  );
}
