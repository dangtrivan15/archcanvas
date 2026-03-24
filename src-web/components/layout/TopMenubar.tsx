import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { useHistoryStore } from "@/store/historyStore";
import { useCanvasStore } from "@/store/canvasStore";
import { useNavigationStore } from "@/store/navigationStore";
import { useFileStore } from "@/store/fileStore";
import { useUiStore } from "@/store/uiStore";

export function TopMenubar() {
  const projectName = useFileStore((s) => s.project?.root.data.project?.name ?? null);
  const recentProjects = useFileStore((s) => s.recentProjects);

  return (
    <Menubar className="rounded-none border-b border-border bg-background px-2">
      {/* Logo */}
      <div className="flex items-center px-1">
        <img src="/favicon.svg" alt="ArchCanvas" width={20} height={20} className="rounded" />
      </div>

      {projectName && (
        <span className="text-sm font-medium text-muted-foreground px-2 truncate max-w-[200px]">
          {projectName}
        </span>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* File                                                                */}
      {/* ------------------------------------------------------------------ */}
      <MenubarMenu>
        <MenubarTrigger className="text-sm">File</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={() => useFileStore.getState().open()}>
            Open… <MenubarShortcut>⌘O</MenubarShortcut>
          </MenubarItem>
          <MenubarSub>
            <MenubarSubTrigger>Open Recent</MenubarSubTrigger>
            <MenubarSubContent>
              {recentProjects.length === 0 ? (
                <MenubarItem disabled>No recent projects</MenubarItem>
              ) : (
                recentProjects.map((rp) => (
                  <MenubarItem
                    key={rp.path}
                    onClick={() => {
                      // Recent projects are informational in web mode (C7.9) —
                      // directory handles are not restorable. This is a placeholder
                      // that will be wired to Tauri/Node re-open in a future task.
                      console.log('[TopMenubar] Open recent:', rp.name, rp.path);
                    }}
                  >
                    {rp.name}
                  </MenubarItem>
                ))
              )}
            </MenubarSubContent>
          </MenubarSub>
          <MenubarSeparator />
          <MenubarItem onClick={() => useFileStore.getState().save()}>
            Save <MenubarShortcut>⌘S</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      {/* ------------------------------------------------------------------ */}
      {/* Edit                                                                */}
      {/* ------------------------------------------------------------------ */}
      <MenubarMenu>
        <MenubarTrigger className="text-sm">Edit</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={() => useHistoryStore.getState().undo()}>
            Undo <MenubarShortcut>⌘Z</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onClick={() => useHistoryStore.getState().redo()}>
            Redo <MenubarShortcut>⇧⌘Z</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={() => useCanvasStore.getState().deleteSelection(useNavigationStore.getState().currentCanvasId)}>
            Delete <MenubarShortcut>⌫</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      {/* ------------------------------------------------------------------ */}
      {/* View                                                                */}
      {/* ------------------------------------------------------------------ */}
      <MenubarMenu>
        <MenubarTrigger className="text-sm">View</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={() => useUiStore.getState().toggleLeftPanel()}>
            Toggle Left Panel
          </MenubarItem>
          <MenubarItem onClick={() => useUiStore.getState().toggleRightPanel()}>
            Toggle Right Panel
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem
            onClick={() => window.dispatchEvent(new CustomEvent('archcanvas:fit-view'))}
          >
            Fit View
          </MenubarItem>
          <MenubarItem
            onClick={() => window.dispatchEvent(new CustomEvent('archcanvas:auto-layout'))}
          >
            Auto Layout
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem
            onClick={() => window.dispatchEvent(new CustomEvent('archcanvas:open-palette'))}
          >
            Command Palette <MenubarShortcut>⌘K</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={() => useUiStore.getState().openAppearanceDialog()}>
            Appearance…
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}
