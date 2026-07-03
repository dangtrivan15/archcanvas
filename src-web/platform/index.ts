export type { FileSystem } from './fileSystem';
export type { GitProvider } from './git';
export { createGitProvider } from './git';
export { InMemoryFileSystem } from './inMemoryFileSystem';
export { WebFileSystem } from './webFileSystem';
export type { FilePicker } from './filePicker';
export { createFilePicker } from './filePicker';
export type { FileSaver, FileSaveOptions } from './fileSaver';
export { createFileSaver } from './fileSaver';
// TauriFileSystem and NodeFileSystem are not statically exported, and
// createFileSystem() (which dynamically imports them) is intentionally NOT
// re-exported from this barrel either — see ./createFileSystem.ts. Any
// static import from THIS file pulls the whole module into Rollup's graph;
// createFileSystem()'s dynamic import() of nodeFileSystem.ts (which touches
// node:fs/node:path) breaks the browser production build even when
// createFileSystem itself is never called. Import it directly:
// `import { createFileSystem } from './createFileSystem'`.
