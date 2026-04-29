import { InstalledTab } from './InstalledTab';
import { CommunityBrowser } from './CommunityBrowser';
import { useState } from 'react';

type TabId = 'installed' | 'community';

export function RegistryPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('installed');

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
          className={`px-4 py-2 text-xs font-medium transition-colors ${
            activeTab === 'community'
              ? 'border-b-2 border-primary text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          data-testid="tab-community"
        >
          Community
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
