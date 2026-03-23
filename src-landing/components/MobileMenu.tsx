import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { NAV_LINKS } from '../constants';

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
}

export function MobileMenu({ open, onClose }: MobileMenuProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 bg-cream flex flex-col px-14 py-7"
          initial={{ opacity: 0, x: '100%' }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        >
          <div className="flex items-center justify-between mb-12">
            <a href="/" className="flex items-center gap-2.5">
              <img src="/favicon.svg" alt="" width="32" height="32" />
              <span className="text-dark-purple text-[17px] font-bold tracking-tight">
                ArchCanvas
              </span>
            </a>
            <button onClick={onClose} className="p-2 text-dark-purple" aria-label="Close menu">
              <X size={24} />
            </button>
          </div>

          <div className="flex flex-col gap-6">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={onClose}
                {...('external' in link ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="text-dark-purple text-lg font-medium"
              >
                {link.label}
              </a>
            ))}
            <a
              href="#brew"
              onClick={onClose}
              className="bg-dark-purple text-cream px-6 py-3 rounded-lg text-sm font-semibold text-center mt-4"
            >
              Install
            </a>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
