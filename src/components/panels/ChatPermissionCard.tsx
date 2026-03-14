import { useState } from 'react';
import { useChatStore } from '@/store/chatStore';

interface Props {
  id: string;
  tool: string;
  command: string;
  blockedPath?: string;
  decisionReason?: string;
}

export function ChatPermissionCard({ id, tool, command, blockedPath, decisionReason }: Props) {
  const [responded, setResponded] = useState<'approved' | 'denied' | 'always' | 'interrupted' | null>(null);

  const handleApprove = () => {
    useChatStore.getState().respondToPermission(id, true);
    setResponded('approved');
  };

  const handleAlwaysAllow = () => {
    useChatStore.getState().respondToPermission(id, true, {
      updatedPermissions: [{ tool, permission: 'allow' }],
    });
    setResponded('always');
  };

  const handleDeny = () => {
    useChatStore.getState().respondToPermission(id, false);
    setResponded('denied');
  };

  const handleDenyAndStop = () => {
    useChatStore.getState().respondToPermission(id, false, { interrupt: true });
    setResponded('interrupted');
  };

  const statusLabel = (() => {
    switch (responded) {
      case 'approved': return 'Approved';
      case 'always': return 'Always Allowed';
      case 'denied': return 'Denied';
      case 'interrupted': return 'Denied & Stopped';
      default: return '';
    }
  })();

  const statusColor =
    responded === 'approved' || responded === 'always'
      ? 'text-green-400'
      : 'text-red-400';

  return (
    <div className="my-1 rounded border-l-4 border-yellow-500 bg-card p-2">
      <p className="text-xs font-medium text-card-foreground">
        &#x26A0; Permission requested: <span className="font-mono">{tool}</span>
      </p>
      <p className="mt-0.5 break-all font-mono text-xs text-muted-foreground">
        {command}
      </p>

      {blockedPath && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          File: <span className="font-mono">{blockedPath}</span>
        </p>
      )}

      {decisionReason && (
        <p className="mt-0.5 text-xs text-muted-foreground/70">
          Reason: {decisionReason}
        </p>
      )}

      {responded ? (
        <p className={`mt-1.5 text-xs font-medium ${statusColor}`}>
          {statusLabel}
        </p>
      ) : (
        <div className="mt-1.5 flex flex-wrap gap-2">
          <button
            onClick={handleApprove}
            className="rounded bg-green-700 px-2 py-0.5 text-xs font-medium text-white hover:bg-green-600"
          >
            Approve
          </button>
          <button
            onClick={handleAlwaysAllow}
            className="rounded bg-blue-700 px-2 py-0.5 text-xs font-medium text-white hover:bg-blue-600"
          >
            Always Allow
          </button>
          <button
            onClick={handleDeny}
            className="rounded bg-red-700 px-2 py-0.5 text-xs font-medium text-white hover:bg-red-600"
          >
            Deny
          </button>
          <button
            onClick={handleDenyAndStop}
            className="rounded bg-red-900 px-2 py-0.5 text-xs font-medium text-white hover:bg-red-800"
          >
            Deny &amp; Stop
          </button>
        </div>
      )}
    </div>
  );
}
