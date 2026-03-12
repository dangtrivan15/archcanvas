import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { useHistoryStore } from "@/store/historyStore";
import { useCanvasStore } from "@/store/canvasStore";
import { useFileStore } from "@/store/fileStore";
import { useUiStore } from "@/store/uiStore";

export function TopMenubar() {
  return (
    <Menubar className="rounded-none border-b border-border bg-background px-2">
      {/* ------------------------------------------------------------------ */}
      {/* File                                                                */}
      {/* ------------------------------------------------------------------ */}
      <MenubarMenu>
        <MenubarTrigger className="text-sm">File</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={() => useFileStore.getState().initializeEmptyProject()}>
            New Project <MenubarShortcut>⌘N</MenubarShortcut>
          </MenubarItem>
          <MenubarItem>
            Open... <MenubarShortcut>⌘O</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem
            onClick={() => {
              // fileStore.saveAll requires a FileSystem — no-op until file
              // system is provided via project open flow.
              console.log('[TopMenubar] Save — no FileSystem attached yet');
            }}
          >
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
          <MenubarItem onClick={() => useCanvasStore.getState().deleteSelection()}>
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
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}
