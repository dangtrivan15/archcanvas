/**
 * Protocol Buffer TypeScript module for ArchCanvas.
 *
 * Re-exports generated protobuf classes from the compiled .proto schema.
 * Import from this file instead of the raw .pb.js/.pb.d.ts files.
 *
 * Regenerate with: npm run proto:generate
 */

import { archcanvas } from './archcanvas.pb.js';

// ─── Message Classes ────────────────────────────────────────────

export const ArchCanvasFile = archcanvas.ArchCanvasFile;
export type ArchCanvasFile = archcanvas.ArchCanvasFile;
export type IArchCanvasFile = archcanvas.IArchCanvasFile;

export const FileHeader = archcanvas.FileHeader;
export type FileHeader = archcanvas.FileHeader;
export type IFileHeader = archcanvas.IFileHeader;

export const Architecture = archcanvas.Architecture;
export type Architecture = archcanvas.Architecture;
export type IArchitecture = archcanvas.IArchitecture;

export const Node = archcanvas.Node;
export type Node = archcanvas.Node;
export type INode = archcanvas.INode;

export const Edge = archcanvas.Edge;
export type Edge = archcanvas.Edge;
export type IEdge = archcanvas.IEdge;

export const Note = archcanvas.Note;
export type Note = archcanvas.Note;
export type INote = archcanvas.INote;

export const CodeRef = archcanvas.CodeRef;
export type CodeRef = archcanvas.CodeRef;
export type ICodeRef = archcanvas.ICodeRef;

export const Position = archcanvas.Position;
export type Position = archcanvas.Position;
export type IPosition = archcanvas.IPosition;

export const CanvasState = archcanvas.CanvasState;
export type CanvasState = archcanvas.CanvasState;
export type ICanvasState = archcanvas.ICanvasState;

export const PanelLayout = archcanvas.PanelLayout;
export type PanelLayout = archcanvas.PanelLayout;
export type IPanelLayout = archcanvas.IPanelLayout;

export const AIState = archcanvas.AIState;
export type AIState = archcanvas.AIState;
export type IAIState = archcanvas.IAIState;

export const AIConversation = archcanvas.AIConversation;
export type AIConversation = archcanvas.AIConversation;
export type IAIConversation = archcanvas.IAIConversation;

export const AIMessage = archcanvas.AIMessage;
export type AIMessage = archcanvas.AIMessage;
export type IAIMessage = archcanvas.IAIMessage;

export const AISuggestion = archcanvas.AISuggestion;
export type AISuggestion = archcanvas.AISuggestion;
export type IAISuggestion = archcanvas.IAISuggestion;

export const UndoHistory = archcanvas.UndoHistory;
export type UndoHistory = archcanvas.UndoHistory;
export type IUndoHistory = archcanvas.IUndoHistory;

export const UndoEntry = archcanvas.UndoEntry;
export type UndoEntry = archcanvas.UndoEntry;
export type IUndoEntry = archcanvas.IUndoEntry;

export const Value = archcanvas.Value;
export type Value = archcanvas.Value;
export type IValue = archcanvas.IValue;

export const StringList = archcanvas.StringList;
export type StringList = archcanvas.StringList;
export type IStringList = archcanvas.IStringList;

export const Annotation = archcanvas.Annotation;
export type Annotation = archcanvas.Annotation;
export type IAnnotation = archcanvas.IAnnotation;

export const AnnotationPath = archcanvas.AnnotationPath;
export type AnnotationPath = archcanvas.AnnotationPath;
export type IAnnotationPath = archcanvas.IAnnotationPath;

// ─── Enums ──────────────────────────────────────────────────────

export const EdgeType = archcanvas.Edge.EdgeType;
export type EdgeType = archcanvas.Edge.EdgeType;

export const NoteStatus = archcanvas.Note.NoteStatus;
export type NoteStatus = archcanvas.Note.NoteStatus;

export const CodeRefRole = archcanvas.CodeRef.CodeRefRole;
export type CodeRefRole = archcanvas.CodeRef.CodeRefRole;

// ─── Namespace re-export ────────────────────────────────────────

export { archcanvas };
