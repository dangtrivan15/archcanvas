import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useUiStore } from '@/store/uiStore';
import { useRegistryStore } from '@/store/registryStore';
import { InstalledTab } from '@/components/registry/InstalledTab';

export function RegistryStatusDialog() {
  const open = useUiStore((s) => s.showRegistryStatusDialog);
  const close = useUiStore((s) => s.closeRegistryStatusDialog);
  const builtinCount = useRegistryStore((s) => s.builtinCount);
  const projectLocalCount = useRegistryStore((s) => s.projectLocalCount);
  const remoteInstalledCount = useRegistryStore((s) => s.remoteInstalledCount);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Node Type Registry</DialogTitle>
          <DialogDescription>
            {`${builtinCount} built-in`}
            {projectLocalCount > 0 && ` + ${projectLocalCount} project-local`}
            {remoteInstalledCount > 0 && ` + ${remoteInstalledCount} community`}
            {' types'}
          </DialogDescription>
        </DialogHeader>
        <InstalledTab />
      </DialogContent>
    </Dialog>
  );
}
