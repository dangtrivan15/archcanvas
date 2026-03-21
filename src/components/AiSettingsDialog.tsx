import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Settings, Check, X, Loader2, AlertTriangle } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useUiStore } from '@/store/uiStore';
import { useApiKeyStore, AVAILABLE_MODELS } from '@/store/apiKeyStore';
import { useChatStore } from '@/store/chatStore';
import { useFileStore } from '@/store/fileStore';

function maskKey(key: string): string {
  if (key.length <= 12) return key;
  return key.slice(0, 12) + '••••';
}

function ApiKeySettings() {
  const apiKey = useApiKeyStore((s) => s.apiKey);
  const model = useApiKeyStore((s) => s.model);
  const isValidated = useApiKeyStore((s) => s.isValidated);
  const isValidating = useApiKeyStore((s) => s.isValidating);
  const error = useApiKeyStore((s) => s.error);

  const [inputKey, setInputKey] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const prefersReduced = useReducedMotion();

  const handleSaveKey = () => {
    if (inputKey.trim()) {
      useApiKeyStore.getState().setApiKey(inputKey.trim());
      setInputKey('');
      setIsEditing(false);
    }
  };

  const handleClear = () => {
    useApiKeyStore.getState().clearApiKey();
    setInputKey('');
    setIsEditing(false);
  };

  const handleTestConnection = async () => {
    const success = await useApiKeyStore.getState().validateKey();
    if (success) {
      useChatStore.getState().setActiveProvider('claude-api-key');
    }
  };

  return (
    <div className="space-y-5 pt-1">
      {/* API Key Section */}
      <div className="space-y-2">
        <label htmlFor="api-key-input" className="text-sm font-medium">
          API Key
        </label>
        <div className="flex gap-2">
          <input
            id="api-key-input"
            type="text"
            className="flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="sk-ant-api03-..."
            value={isEditing ? inputKey : (apiKey ? maskKey(apiKey) : '')}
            readOnly={!isEditing && !!apiKey}
            onClick={() => {
              if (apiKey && !isEditing) {
                setIsEditing(true);
                setInputKey('');
              }
            }}
            onChange={(e) => {
              if (!isEditing) {
                setIsEditing(true);
              }
              setInputKey(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveKey();
              if (e.key === 'Escape') {
                setIsEditing(false);
                setInputKey('');
              }
            }}
          />
          {isEditing && inputKey.trim() && (
            <button
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
              onClick={handleSaveKey}
            >
              Save
            </button>
          )}
          {apiKey && !isEditing && (
            <button
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              onClick={handleClear}
              aria-label="Clear API key"
            >
              Clear
            </button>
          )}
        </div>

        {/* Security warning */}
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <AlertTriangle className="size-3.5 mt-0.5 shrink-0 text-yellow-500" />
          <span>
            Key is stored in your browser's local storage. Use your own key only.
          </span>
        </div>
      </div>

      {/* Model Selection */}
      <div className="space-y-2">
        <label htmlFor="model-select" className="text-sm font-medium">
          Model
        </label>
        <select
          id="model-select"
          className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          value={model}
          onChange={(e) => useApiKeyStore.getState().setModel(e.target.value)}
        >
          {AVAILABLE_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {/* Test Connection */}
      <div className="flex items-center gap-3">
        <button
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-hover disabled:opacity-50"
          onClick={handleTestConnection}
          disabled={!apiKey || isValidating}
          aria-label="Test connection"
        >
          {isValidating ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="size-3.5 animate-spin" />
              Testing…
            </span>
          ) : (
            'Test Connection'
          )}
        </button>

        {/* Status indicator */}
        {!isValidating && isValidated && (
          <motion.span
            className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400"
            initial={prefersReduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Check className="size-3.5" />
            Connected
          </motion.span>
        )}
        {!isValidating && error && (
          <motion.span
            className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400"
            initial={prefersReduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <X className="size-3.5" />
            {error}
          </motion.span>
        )}
      </div>
    </div>
  );
}

function ClaudeCodeSettings() {
  const projectPath = useFileStore((s) => s.projectPath);
  const fsPath = useFileStore((s) => s.fs?.getPath() ?? null);
  const [pathInput, setPathInput] = useState(projectPath ?? fsPath ?? '');

  const handleSetPath = () => {
    if (pathInput.trim()) {
      useFileStore.getState().setProjectPath(pathInput.trim());
    }
  };

  return (
    <div className="space-y-2 pt-1">
      <label htmlFor="project-path-input" className="text-sm font-medium">
        Project Path
      </label>
      <div className="flex gap-2">
        <input
          id="project-path-input"
          type="text"
          className="flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="/Users/you/projects/my-app"
          value={pathInput}
          onChange={(e) => setPathInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSetPath(); }}
        />
        <button
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
          onClick={handleSetPath}
          disabled={!pathInput.trim()}
        >
          Set
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Can improve context awareness, but optional.
      </p>
    </div>
  );
}

export function AiSettingsDialog() {
  const open = useUiStore((s) => s.showAiSettingsDialog);
  const close = useUiStore((s) => s.closeAiSettingsDialog);
  const activeProviderId = useChatStore((s) => s.activeProviderId);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="size-4" />
            AI Settings
          </DialogTitle>
        </DialogHeader>

        {activeProviderId === 'claude-api-key' && <ApiKeySettings />}
        {activeProviderId && activeProviderId !== 'claude-api-key' && <ClaudeCodeSettings />}
        {!activeProviderId && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Select an AI provider to configure settings.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
