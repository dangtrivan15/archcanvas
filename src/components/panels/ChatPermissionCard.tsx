import { useState } from 'react';
import { useChatStore } from '@/store/chatStore';

interface Props {
  id: string;
  tool: string;
  command: string;
}

export function ChatPermissionCard({ id, tool, command }: Props) {
  const [responded, setResponded] = useState<'approved' | 'denied' | null>(null);

  const handleResponse = (allowed: boolean) => {
    useChatStore.getState().respondToPermission(id, allowed);
    setResponded(allowed ? 'approved' : 'denied');
  };

  return (
    <div className="my-1 rounded border border-border bg-card p-2">
      <p className="text-xs font-medium text-card-foreground">
        Permission requested: <span className="font-mono">{tool}</span>
      </p>
      <p className="mt-0.5 break-all font-mono text-xs text-muted-foreground">
        {command}
      </p>

      {responded ? (
        <p
          className={`mt-1.5 text-xs font-medium ${
            responded === 'approved' ? 'text-green-400' : 'text-red-400'
          }`}
        >
          {responded === 'approved' ? 'Approved' : 'Denied'}
        </p>
      ) : (
        <div className="mt-1.5 flex gap-2">
          <button
            onClick={() => handleResponse(true)}
            className="rounded bg-green-700 px-2 py-0.5 text-xs font-medium text-white hover:bg-green-600"
          >
            Approve
          </button>
          <button
            onClick={() => handleResponse(false)}
            className="rounded bg-red-700 px-2 py-0.5 text-xs font-medium text-white hover:bg-red-600"
          >
            Deny
          </button>
        </div>
      )}
    </div>
  );
}
