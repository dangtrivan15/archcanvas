import { GITHUB_REPO } from '../constants';

const FOOTER_LINKS = [
  { label: 'GitHub', href: GITHUB_REPO, external: true },
  { label: 'Docs', href: '#' },
  { label: 'Releases', href: `${GITHUB_REPO}/releases`, external: true },
  { label: 'License', href: `${GITHUB_REPO}/blob/main/LICENSE`, external: true },
] as const;

export function Footer() {
  return (
    <footer className="relative z-[1] bg-footer-bg px-14 max-md:px-6 py-7">
      <div className="max-w-[880px] mx-auto flex justify-between items-center max-md:flex-col max-md:gap-4 max-md:text-center">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" alt="" width="18" height="18" />
            <span className="text-footer-text text-xs font-semibold">ArchCanvas</span>
          </div>
          <span className="text-footer-muted text-[11px]">
            &copy; {new Date().getFullYear()} ArchCanvas
          </span>
        </div>
        <div className="flex gap-5">
          {FOOTER_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              {...('external' in link && link.external
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
              className="text-footer-link text-xs font-medium hover:text-footer-text transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
