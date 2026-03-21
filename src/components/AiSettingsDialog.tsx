import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Settings } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';
import { useChatStore } from '@/store/chatStore';
import { ApiKeySettings, ClaudeCodeSettings } from '@/components/ai/AiProviderSettings';

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
