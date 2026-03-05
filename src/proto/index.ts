/**
 * Protocol Buffers barrel export.
 *
 * Re-exports all typed protobuf classes and interfaces from archcanvas.ts.
 *
 * Generated files (DO NOT EDIT):
 *   - archcanvas.pb.js   — compiled protobuf message classes
 *   - archcanvas.pb.d.ts — TypeScript declarations for generated classes
 *
 * Hand-written wrappers:
 *   - archcanvas.ts       — typed re-exports for application use
 *   - protobuf-minimal.ts — ESM compatibility shim for protobufjs/minimal
 *
 * Regenerate with: npm run proto:generate
 */

export {
  // Message classes & interfaces
  ArchCanvasFile,
  FileHeader,
  Architecture,
  Node,
  Edge,
  Note,
  CodeRef,
  Position,
  CanvasState,
  PanelLayout,
  AIState,
  AIConversation,
  AIMessage,
  AISuggestion,
  UndoHistory,
  UndoEntry,
  Value,
  StringList,
  Annotation,
  AnnotationPath,
  // Enums
  EdgeType,
  NoteStatus,
  CodeRefRole,
  // Raw namespace
  archcanvas,
} from './archcanvas';

export type {
  IArchCanvasFile,
  IFileHeader,
  IArchitecture,
  INode,
  IEdge,
  INote,
  ICodeRef,
  IPosition,
  ICanvasState,
  IPanelLayout,
  IAIState,
  IAIConversation,
  IAIMessage,
  IAISuggestion,
  IUndoHistory,
  IUndoEntry,
  IValue,
  IStringList,
  IAnnotation,
  IAnnotationPath,
} from './archcanvas';
