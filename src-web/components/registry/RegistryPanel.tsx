import { InstalledTab } from './InstalledTab';
import { CommunityBrowser } from './CommunityBrowser';
import { useState, useEffect } from 'react';
import { useRegistryStore } from '@/store/registryStore';
import { useUiStore } from '@/store/uiStore';

type TabId = 'installed' | 'community';

export function RegistryPanel() {
  const remoteInstalledCount = useRegistryStore((s) => s.remoteInstalledCount);
  const projectLocalCount = useRegistryStore((s) => s.projectLocalCount);
  const remoteStatus = useRegistryStore((s) => s.remoteStatus);
  const registryInitialTab = useUiStore((s) => s.registryInitialTab);
  const setRegistryInitialTab = useUiStore((s) => s.setRegistryInitialTab);

  const [activeTab, setActiveTab] = useState<TabId>(() => {
    // Four-level precedence:
    // 1. URL param — preserves existing deep-link behavior
    const params = new URLSearchParams(window.location.search);
    if (params.get('nodedef')) return 'community';
    // 2. Store hint — set by openRegistryPanel('community')
    if (registryInitialTab !== 'installed') return registryInitialTab;
    // 3. Smart fallback — steer new users to discovery
    if (remoteInstalledCount === 0 && projectLocalCount === 0) return 'community';
    // 4. Hard default
    return 'installed';
  });

  // React to store hint changes: applies tab switch even when panel is already mounted,
  // then resets the hint so subsequent opens use smart default or hard default.
  useEffect(() => {
    if (registryInitialTab !== 'installed') {
      setActiveTab(registryInitialTab);
      setRegistryInitialTab('installed');
    }
  }, [registryInitialTab]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('installed')}
          className={`px-4 py-2 text-xs font-medium transition-colors ${
            activeTab === 'installed'
              ? 'border-b-2 border-primary text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          data-testid="tab-installed"
        >
          Installed
        </button>
        <button
          onClick={() => setActiveTab('community')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors ${
            activeTab === 'community'
              ? 'border-b-2 border-primary text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          data-testid="tab-community"
        >
          Community
          {remoteStatus !== 'unknown' && (
            <span
              data-testid="registry-status-pill"
              className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-medium ${
                remoteStatus === 'online' ? 'bg-green-500/15 text-green-600' :
                remoteStatus === 'offline' ? 'bg-red-500/15 text-red-600' :
                'bg-yellow-400/15 text-yellow-600'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${
                remoteStatus === 'online' ? 'bg-green-500' :
                remoteStatus === 'offline' ? 'bg-red-500' :
                'bg-yellow-400'
              }`} />
              {remoteStatus === 'online' ? 'Online' : remoteStatus === 'offline' ? 'Offline' : 'Checking'}
            </span>
          )}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'installed' ? (
          <div className="p-3 space-y-3">
            <InstalledTab />
          </div>
        ) : (
          <CommunityBrowser />
        )}
      </div>
    </div>
  );
}
