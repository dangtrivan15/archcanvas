import { useEffect, useState, type ComponentType } from 'react';
import { Check, X, Loader2, AlertTriangle } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useAiSettingsStore } from '@/store/aiSettingsStore';
import { useChatStore } from '@/store/chatStore';
import { getProviderApiKey, setProviderApiKey, clearProviderApiKey } from '@/core/ai/providers/keyStorage';
import { OLLAMA_PROVIDER_ID } from '@/core/ai/providers/ollama';
import {
  OPENAI_MODELS,
  OPENAI_DEFAULT_MODEL,
  OLLAMA_MODELS,
  OLLAMA_DEFAULT_MODEL,
  OLLAMA_DEFAULT_HOST,
  GEMINI_MODELS,
  GEMINI_DEFAULT_MODEL,
} from '@/core/ai/providers/models';
import { CapabilityBadge } from './CapabilityBadge';
import type { ModelInfo } from '@/core/ai/types';

/** Static per-provider fallback model list + default, keyed by provider id. */
const STATIC_MODELS: Record<string, { models: ModelInfo[]; defaultModel: string }> = {
  openai: { models: OPENAI_MODELS, defaultModel: OPENAI_DEFAULT_MODEL },
  [OLLAMA_PROVIDER_ID]: { models: OLLAMA_MODELS, defaultModel: OLLAMA_DEFAULT_MODEL },
  gemini: { models: GEMINI_MODELS, defaultModel: GEMINI_DEFAULT_MODEL },
};

function maskKey(key: string): string {
  if (key.length <= 12) return key;
  return key.slice(0, 12) + '••••';
}

function humanize(id: string): string {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

/**
 * Generic per-provider settings form, modeled on `AiProviderSettings.tsx`'s
 * `ApiKeySettings` but parameterized by provider id: key-or-host input,
 * model dropdown, "Test connection", capability badge. Ollama shows a
 * base-URL field instead of an API key (no key required for a local server).
 */
export function ProviderKeySettings({ providerId }: { providerId: string }) {
  const isOllama = providerId === OLLAMA_PROVIDER_ID;

  const config = useAiSettingsStore((s) => s.byProvider[providerId]);
  const provider = useChatStore((s) => s.providers.get(providerId));

  const isValidated = config?.isValidated ?? false;
  const isValidating = config?.isValidating ?? false;
  const error = config?.error;

  const staticDefaults = STATIC_MODELS[providerId] ?? { models: [], defaultModel: '' };
  const model = config?.model ?? staticDefaults.defaultModel;

  const [models, setModels] = useState<ModelInfo[]>(staticDefaults.models);
  const [inputKey, setInputKey] = useState('');
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [hostInput, setHostInput] = useState(config?.baseUrl ?? OLLAMA_DEFAULT_HOST);

  const storedKey = isOllama ? null : getProviderApiKey(providerId);
  const prefersReduced = useReducedMotion();

  // Populate the model dropdown from listModels() when a provider instance
  // is available; fall back to the static list from models.ts otherwise.
  useEffect(() => {
    let cancelled = false;
    if (!provider) {
      setModels(staticDefaults.models);
      return;
    }
    provider
      .listModels()
      .then((list) => {
        if (!cancelled) setModels(list.length > 0 ? list : staticDefaults.models);
      })
      .catch(() => {
        if (!cancelled) setModels(staticDefaults.models);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId, provider]);

  const handleSaveKey = () => {
    if (inputKey.trim()) {
      setProviderApiKey(providerId, inputKey.trim());
      setInputKey('');
      setIsEditingKey(false);
    }
  };

  const handleClearKey = () => {
    clearProviderApiKey(providerId);
    setInputKey('');
    setIsEditingKey(false);
  };

  const handleSetHost = () => {
    if (hostInput.trim()) {
      useAiSettingsStore.getState().setBaseUrl(providerId, hostInput.trim());
    }
  };

  const handleTestConnection = async () => {
    await useAiSettingsStore.getState().validate(providerId);
    if (useAiSettingsStore.getState().byProvider[providerId]?.isValidated) {
      useChatStore.getState().setActiveProvider(providerId);
    }
  };

  const canTest = isOllama ? true : !!storedKey;

  // Effective capabilities: supportsTools() is the dynamic, currently-
  // selected-model check (task 11) — falls back to "tools" when the
  // provider instance isn't registered yet.
  const effectiveCapabilities = {
    tools: provider ? provider.supportsTools() : true,
    streaming: provider ? provider.capabilities.streaming : true,
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold">{provider?.displayName ?? humanize(providerId)}</h4>

      {isOllama ? (
        <div className="space-y-2">
          <label htmlFor={`${providerId}-host-input`} className="text-sm font-medium">
            Ollama Host
          </label>
          <div className="flex gap-2">
            <input
              id={`${providerId}-host-input`}
              type="text"
              className="flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder={OLLAMA_DEFAULT_HOST}
              value={hostInput}
              onChange={(e) => setHostInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSetHost();
              }}
            />
            <button
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
              onClick={handleSetHost}
              disabled={!hostInput.trim()}
            >
              Set
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Local Ollama server. Requires <code>OLLAMA_ORIGINS</code> to allow this app's origin.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <label htmlFor={`${providerId}-key-input`} className="text-sm font-medium">
            API Key
          </label>
          <div className="flex gap-2">
            <input
              id={`${providerId}-key-input`}
              type="text"
              className="flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="sk-..."
              value={isEditingKey ? inputKey : storedKey ? maskKey(storedKey) : ''}
              readOnly={!isEditingKey && !!storedKey}
              onClick={() => {
                if (storedKey && !isEditingKey) {
                  setIsEditingKey(true);
                  setInputKey('');
                }
              }}
              onChange={(e) => {
                if (!isEditingKey) setIsEditingKey(true);
                setInputKey(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveKey();
                if (e.key === 'Escape') {
                  setIsEditingKey(false);
                  setInputKey('');
                }
              }}
            />
            {isEditingKey && inputKey.trim() && (
              <button
                className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
                onClick={handleSaveKey}
              >
                Save
              </button>
            )}
            {storedKey && !isEditingKey && (
              <button
                className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                onClick={handleClearKey}
                aria-label="Clear API key"
              >
                Clear
              </button>
            )}
          </div>

          {/* Security note — mirrors ApiKeySettings' existing copy */}
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <AlertTriangle className="size-3.5 mt-0.5 shrink-0 text-yellow-500" />
            <span>Key is stored in your browser's local storage. Use your own key only.</span>
          </div>
        </div>
      )}

      {/* Model Selection */}
      <div className="space-y-2">
        <label htmlFor={`${providerId}-model-select`} className="text-sm font-medium">
          Model
        </label>
        <select
          id={`${providerId}-model-select`}
          className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          value={model}
          onChange={(e) => useAiSettingsStore.getState().setModel(providerId, e.target.value)}
        >
          {models.map((m) => (
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
          disabled={!canTest || isValidating}
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

      <CapabilityBadge {...effectiveCapabilities} />
    </div>
  );
}

/** Curried factory — binds a provider id to a prop-less ComponentType for ProviderDescriptor.SettingsComponent. */
export function createProviderKeySettings(providerId: string): ComponentType {
  return function BoundProviderKeySettings() {
    return <ProviderKeySettings providerId={providerId} />;
  };
}
