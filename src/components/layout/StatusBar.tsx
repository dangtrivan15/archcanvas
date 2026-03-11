export function StatusBar() {
  return (
    <div className="flex h-6 items-center justify-between border-t border-border bg-background px-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-3">
        <span>ArchCanvas v0.1.0</span>
      </div>
      <div className="flex items-center gap-3">
        <span>No project open</span>
      </div>
    </div>
  );
}
