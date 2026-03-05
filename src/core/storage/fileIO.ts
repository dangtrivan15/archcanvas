/**
 * File I/O module for opening and saving .archc files.
 * Handles File System Access API with fallback, and proto-to-graph conversion.
 */

import type { ArchGraph, ArchNode, ArchEdge, Note, CodeRef, Position, EdgeType, NoteStatus, CodeRefRole, SavedCanvasState, Annotation, AnnotationPathData } from '@/types/graph';
import type { AIConversation, AIMessage, AISuggestion } from '@/types/ai';
import type { IArchCanvasFile } from '@/proto/archcanvas';
import { archcanvas, Architecture } from '@/proto/archcanvas';
import { decode, encode } from './codec';
import { DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from '@/utils/constants';
import type { UndoEntry } from '@/core/history/undoManager';

// ─── Proto → Graph Converters ────────────────────────────────────

/**
 * Serializable undo history data for file persistence.
 */
export interface UndoHistoryData {
  entries: UndoEntry[];
  currentIndex: number;
  maxEntries: number;
}

/**
 * AI state data for file persistence.
 */
export interface AIStateData {
  conversations: AIConversation[];
}

/**
 * Result of converting a proto file to internal types.
 */
export interface ProtoToGraphResult {
  graph: ArchGraph;
  canvasState?: SavedCanvasState;
  undoHistory?: UndoHistoryData;
  aiState?: AIStateData;
  createdAtMs?: number;
  updatedAtMs?: number;
}

/**
 * Convert a decoded ArchCanvasFile (protobuf) to our internal ArchGraph type.
 * Also extracts canvas state (viewport, selection, panel layout) if present.
 */
export function protoToGraph(file: IArchCanvasFile): ArchGraph {
  return protoToGraphFull(file).graph;
}

/**
 * Convert a decoded ArchCanvasFile to internal types, including canvas state.
 */
export function protoToGraphFull(file: IArchCanvasFile): ProtoToGraphResult {
  const arch = file.architecture;
  const graph: ArchGraph = arch
    ? {
        name: arch.name ?? 'Untitled Architecture',
        description: arch.description ?? '',
        owners: arch.owners ? [...arch.owners] : [],
        nodes: (arch.nodes ?? []).map(protoNodeToNode),
        edges: (arch.edges ?? []).map(protoEdgeToEdge),
        annotations: (arch.annotations ?? []).map(protoAnnotationToAnnotation),
      }
    : {
        name: 'Untitled Architecture',
        description: '',
        owners: [],
        nodes: [],
        edges: [],
        annotations: [],
      };

  // Extract canvas state if present
  let canvasState: SavedCanvasState | undefined;
  if (file.canvasState) {
    const cs = file.canvasState;
    canvasState = {
      viewport: {
        x: cs.viewportX ?? 0,
        y: cs.viewportY ?? 0,
        zoom: cs.viewportZoom ?? 1,
      },
      selectedNodeIds: cs.selectedNodeIds ? [...cs.selectedNodeIds] : [],
      navigationPath: cs.navigationPath ? [...cs.navigationPath] : [],
    };
    if (cs.panelLayout) {
      canvasState.panelLayout = {
        rightPanelOpen: cs.panelLayout.rightPanelOpen ?? false,
        rightPanelTab: cs.panelLayout.rightPanelTab ?? '',
        rightPanelWidth: cs.panelLayout.rightPanelWidth ?? 320,
      };
    }
  }

  // Extract undo history if present
  let undoHistory: UndoHistoryData | undefined;
  if (file.undoHistory && file.undoHistory.entries && file.undoHistory.entries.length > 0) {
    undoHistory = {
      entries: file.undoHistory.entries.map((protoEntry) => {
        // Decode the architecture_snapshot bytes back to an ArchGraph
        let snapshot: ArchGraph;
        if (protoEntry.architectureSnapshot && protoEntry.architectureSnapshot.length > 0) {
          try {
            const arch = Architecture.decode(protoEntry.architectureSnapshot as Uint8Array);
            snapshot = {
              name: arch.name ?? 'Untitled Architecture',
              description: arch.description ?? '',
              owners: arch.owners ? [...arch.owners] : [],
              nodes: (arch.nodes ?? []).map(protoNodeToNode),
              edges: (arch.edges ?? []).map(protoEdgeToEdge),
              annotations: (arch.annotations ?? []).map(protoAnnotationToAnnotation),
            };
          } catch {
            // If snapshot decoding fails, create empty graph
            snapshot = {
              name: 'Untitled Architecture',
              description: '',
              owners: [],
              nodes: [],
              edges: [],
              annotations: [],
            };
          }
        } else {
          snapshot = {
            name: 'Untitled Architecture',
            description: '',
            owners: [],
            nodes: [],
            edges: [],
            annotations: [],
          };
        }

        return {
          description: protoEntry.description ?? '',
          timestampMs: Number(protoEntry.timestampMs ?? 0),
          snapshot,
        };
      }),
      currentIndex: file.undoHistory.currentIndex ?? -1,
      maxEntries: file.undoHistory.maxEntries ?? 100,
    };
  }

  // Extract AI state if present
  let aiState: AIStateData | undefined;
  if (file.aiState && file.aiState.conversations && file.aiState.conversations.length > 0) {
    aiState = {
      conversations: file.aiState.conversations.map(protoConversationToConversation),
    };
  }

  // Extract header timestamps if present
  const createdAtMs = file.header?.createdAtMs ? Number(file.header.createdAtMs) : undefined;
  const updatedAtMs = file.header?.updatedAtMs ? Number(file.header.updatedAtMs) : undefined;

  return { graph, canvasState, undoHistory, aiState, createdAtMs, updatedAtMs };
}

function protoNodeToNode(protoNode: archcanvas.INode): ArchNode {
  return {
    id: protoNode.id ?? '',
    type: protoNode.type ?? 'compute/service',
    displayName: protoNode.displayName ?? 'Unnamed',
    args: protoValueMapToRecord(protoNode.args ?? {}),
    codeRefs: (protoNode.codeRefs ?? []).map(protoCodeRefToCodeRef),
    notes: (protoNode.notes ?? []).map(protoNoteToNote),
    properties: protoValueMapToRecord(protoNode.properties ?? {}),
    position: protoPositionToPosition(protoNode.position),
    children: (protoNode.children ?? []).map(protoNodeToNode),
    refSource: protoNode.refSource || undefined,
  };
}

function protoEdgeToEdge(protoEdge: archcanvas.IEdge): ArchEdge {
  return {
    id: protoEdge.id ?? '',
    fromNode: protoEdge.fromNode ?? '',
    toNode: protoEdge.toNode ?? '',
    fromPort: protoEdge.fromPort || undefined,
    toPort: protoEdge.toPort || undefined,
    type: protoEdgeTypeToEdgeType(protoEdge.type),
    label: protoEdge.label || undefined,
    properties: protoValueMapToRecord(protoEdge.properties ?? {}),
    notes: (protoEdge.notes ?? []).map(protoNoteToNote),
  };
}

function protoNoteToNote(protoNote: archcanvas.INote): Note {
  return {
    id: protoNote.id ?? '',
    author: protoNote.author ?? 'unknown',
    timestampMs: Number(protoNote.timestampMs ?? 0),
    content: protoNote.content ?? '',
    tags: protoNote.tags ? [...protoNote.tags] : [],
    status: protoNoteStatusToStatus(protoNote.status),
    suggestionType: protoNote.suggestionType || undefined,
  };
}

function protoCodeRefToCodeRef(protoRef: archcanvas.ICodeRef): CodeRef {
  const roleMap: Record<number, CodeRefRole> = {
    0: 'source',
    1: 'api-spec',
    2: 'schema',
    3: 'deployment',
    4: 'config',
    5: 'test',
  };
  return {
    path: protoRef.path ?? '',
    role: roleMap[protoRef.role as number] ?? 'source',
  };
}

function protoPositionToPosition(protoPos: archcanvas.IPosition | null | undefined): Position {
  return {
    x: protoPos?.x ?? 0,
    y: protoPos?.y ?? 0,
    width: protoPos?.width ?? DEFAULT_NODE_WIDTH,
    height: protoPos?.height ?? DEFAULT_NODE_HEIGHT,
    color: protoPos?.color || undefined,
  };
}

function protoEdgeTypeToEdgeType(protoType: archcanvas.Edge.EdgeType | null | undefined): EdgeType {
  switch (protoType) {
    case archcanvas.Edge.EdgeType.SYNC:
    case 0:
      return 'sync';
    case archcanvas.Edge.EdgeType.ASYNC:
    case 1:
      return 'async';
    case archcanvas.Edge.EdgeType.DATA_FLOW:
    case 2:
      return 'data-flow';
    default:
      return 'sync';
  }
}

function protoNoteStatusToStatus(protoStatus: archcanvas.Note.NoteStatus | null | undefined): NoteStatus {
  switch (protoStatus) {
    case archcanvas.Note.NoteStatus.NONE:
    case 0:
      return 'none';
    case archcanvas.Note.NoteStatus.PENDING:
    case 1:
      return 'pending';
    case archcanvas.Note.NoteStatus.ACCEPTED:
    case 2:
      return 'accepted';
    case archcanvas.Note.NoteStatus.DISMISSED:
    case 3:
      return 'dismissed';
    default:
      return 'none';
  }
}

function protoAnnotationToAnnotation(protoAnn: archcanvas.IAnnotation): Annotation {
  return {
    id: protoAnn.id ?? '',
    paths: (protoAnn.paths ?? []).map((p) => ({
      points: p.points ? [...p.points] : [],
      pressures: p.pressures ? [...p.pressures] : [],
    })),
    color: protoAnn.color ?? '#ff0000',
    strokeWidth: protoAnn.strokeWidth ?? 3,
    nodeId: protoAnn.nodeId || undefined,
    timestampMs: Number(protoAnn.timestampMs ?? 0),
  };
}

function protoValueMapToRecord(
  map: { [key: string]: archcanvas.IValue } | null | undefined,
): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  if (!map) return result;

  for (const [key, value] of Object.entries(map)) {
    if (value.stringValue != null) {
      result[key] = value.stringValue;
    } else if (value.numberValue != null) {
      result[key] = value.numberValue;
    } else if (value.boolValue != null) {
      result[key] = value.boolValue;
    }
  }

  return result;
}

// ─── Proto → AI State Converters ──────────────────────────────────

function protoConversationToConversation(protoConv: archcanvas.IAIConversation): AIConversation {
  return {
    id: protoConv.id ?? '',
    scopedToNodeId: protoConv.scopedToNodeId || undefined,
    messages: (protoConv.messages ?? []).map(protoAIMessageToMessage),
    createdAtMs: Number(protoConv.createdAtMs ?? 0),
  };
}

function protoAIMessageToMessage(protoMsg: archcanvas.IAIMessage): AIMessage {
  return {
    id: protoMsg.id ?? '',
    role: (protoMsg.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
    content: protoMsg.content ?? '',
    timestampMs: Number(protoMsg.timestampMs ?? 0),
    suggestions: (protoMsg.suggestions ?? []).map(protoAISuggestionToSuggestion),
  };
}

function protoAISuggestionToSuggestion(protoSug: archcanvas.IAISuggestion): AISuggestion {
  const statusMap: Record<number, 'pending' | 'accepted' | 'dismissed'> = {
    1: 'pending',
    2: 'accepted',
    3: 'dismissed',
  };
  return {
    id: protoSug.id ?? '',
    targetNodeId: protoSug.targetNodeId || undefined,
    targetEdgeId: protoSug.targetEdgeId || undefined,
    suggestionType: protoSug.suggestionType ?? '',
    content: protoSug.content ?? '',
    status: statusMap[protoSug.status as number] ?? 'pending',
  };
}

// ─── Graph → Proto Converters ────────────────────────────────────

/**
 * Convert an ArchGraph to a proto Architecture structure (without the file wrapper).
 * Used internally for both the main architecture and undo history snapshot encoding.
 */
function graphToArchitectureProto(graph: ArchGraph): archcanvas.IArchitecture {
  return {
    name: graph.name,
    description: graph.description,
    owners: [...graph.owners],
    nodes: graph.nodes.map(nodeToProtoNode),
    edges: graph.edges.map(edgeToProtoEdge),
    annotations: (graph.annotations ?? []).map(annotationToProtoAnnotation),
  };
}

function annotationToProtoAnnotation(ann: Annotation): archcanvas.IAnnotation {
  return {
    id: ann.id,
    paths: ann.paths.map((p) => ({
      points: [...p.points],
      pressures: [...p.pressures],
    })),
    color: ann.color,
    strokeWidth: ann.strokeWidth,
    nodeId: ann.nodeId ?? '',
    timestampMs: ann.timestampMs,
  };
}

/**
 * Convert our internal ArchGraph to an IArchCanvasFile protobuf structure.
 * Optionally includes canvas state (viewport, selection, panel layout)
 * and undo history for persistence.
 */
export function graphToProto(
  graph: ArchGraph,
  canvasState?: SavedCanvasState,
  undoHistory?: UndoHistoryData,
  aiState?: AIStateData,
  createdAtMs?: number,
): IArchCanvasFile {
  const file: IArchCanvasFile = {
    architecture: graphToArchitectureProto(graph),
  };

  // Set header with createdAtMs if provided (preserves original creation time on re-save)
  if (createdAtMs) {
    file.header = { createdAtMs };
  }

  if (canvasState) {
    file.canvasState = {
      viewportX: canvasState.viewport.x,
      viewportY: canvasState.viewport.y,
      viewportZoom: canvasState.viewport.zoom,
      selectedNodeIds: [...canvasState.selectedNodeIds],
      navigationPath: [...canvasState.navigationPath],
    };
    if (canvasState.panelLayout) {
      file.canvasState.panelLayout = {
        rightPanelOpen: canvasState.panelLayout.rightPanelOpen,
        rightPanelTab: canvasState.panelLayout.rightPanelTab,
        rightPanelWidth: canvasState.panelLayout.rightPanelWidth,
      };
    }
  }

  if (undoHistory && undoHistory.entries.length > 0) {
    file.undoHistory = {
      currentIndex: undoHistory.currentIndex,
      maxEntries: undoHistory.maxEntries,
      entries: undoHistory.entries.map((entry) => {
        // Encode the ArchGraph snapshot to Architecture proto bytes
        const archProto = graphToArchitectureProto(entry.snapshot);
        const architectureSnapshot = Architecture.encode(
          Architecture.create(archProto),
        ).finish();

        return {
          description: entry.description,
          timestampMs: entry.timestampMs,
          architectureSnapshot,
        };
      }),
    };
  }

  if (aiState && aiState.conversations.length > 0) {
    file.aiState = {
      conversations: aiState.conversations.map(conversationToProtoConversation),
    };
  }

  return file;
}

function nodeToProtoNode(node: ArchNode): archcanvas.INode {
  return {
    id: node.id,
    type: node.type,
    displayName: node.displayName,
    args: recordToProtoValueMap(node.args),
    codeRefs: node.codeRefs.map(codeRefToProtoCodeRef),
    notes: node.notes.map(noteToProtoNote),
    properties: recordToProtoValueMap(node.properties),
    position: {
      x: node.position.x,
      y: node.position.y,
      width: node.position.width,
      height: node.position.height,
      color: node.position.color ?? '',
    },
    children: node.children.map(nodeToProtoNode),
    refSource: node.refSource ?? '',
  };
}

function edgeToProtoEdge(edge: ArchEdge): archcanvas.IEdge {
  const typeMap: Record<EdgeType, number> = {
    'sync': 0,
    'async': 1,
    'data-flow': 2,
  };
  return {
    id: edge.id,
    fromNode: edge.fromNode,
    toNode: edge.toNode,
    fromPort: edge.fromPort ?? '',
    toPort: edge.toPort ?? '',
    type: typeMap[edge.type] ?? 0,
    label: edge.label ?? '',
    properties: recordToProtoValueMap(edge.properties),
    notes: edge.notes.map(noteToProtoNote),
  };
}

function noteToProtoNote(note: Note): archcanvas.INote {
  const statusMap: Record<NoteStatus, number> = {
    'none': 0,
    'pending': 1,
    'accepted': 2,
    'dismissed': 3,
  };
  return {
    id: note.id,
    author: note.author,
    timestampMs: note.timestampMs,
    content: note.content,
    tags: [...note.tags],
    status: statusMap[note.status] ?? 0,
    suggestionType: note.suggestionType ?? '',
  };
}

function codeRefToProtoCodeRef(codeRef: CodeRef): archcanvas.ICodeRef {
  const roleMap: Record<CodeRefRole, number> = {
    'source': 0,
    'api-spec': 1,
    'schema': 2,
    'deployment': 3,
    'config': 4,
    'test': 5,
  };
  return {
    path: codeRef.path,
    role: roleMap[codeRef.role] ?? 0,
  };
}

function recordToProtoValueMap(
  record: Record<string, string | number | boolean>,
): { [key: string]: archcanvas.IValue } {
  const result: { [key: string]: archcanvas.IValue } = {};
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'string') {
      result[key] = { stringValue: value };
    } else if (typeof value === 'number') {
      result[key] = { numberValue: value };
    } else if (typeof value === 'boolean') {
      result[key] = { boolValue: value };
    }
  }
  return result;
}

// ─── AI State → Proto Converters ──────────────────────────────────

function conversationToProtoConversation(conv: AIConversation): archcanvas.IAIConversation {
  return {
    id: conv.id,
    scopedToNodeId: conv.scopedToNodeId ?? '',
    messages: conv.messages.map(messageToProtoAIMessage),
    createdAtMs: conv.createdAtMs,
  };
}

function messageToProtoAIMessage(msg: AIMessage): archcanvas.IAIMessage {
  return {
    id: msg.id,
    role: msg.role,
    content: msg.content,
    timestampMs: msg.timestampMs,
    suggestions: msg.suggestions.map(suggestionToProtoAISuggestion),
  };
}

function suggestionToProtoAISuggestion(sug: AISuggestion): archcanvas.IAISuggestion {
  const statusMap: Record<string, number> = {
    'pending': 1,
    'accepted': 2,
    'dismissed': 3,
  };
  return {
    id: sug.id,
    targetNodeId: sug.targetNodeId ?? '',
    targetEdgeId: sug.targetEdgeId ?? '',
    suggestionType: sug.suggestionType,
    content: sug.content,
    status: statusMap[sug.status] ?? 1,
  };
}

// ─── File Open/Save Functions ────────────────────────────────────

/**
 * Decode raw .archc binary data into graph, canvas state, AI state, etc.
 * Useful for retrying with different decode options (e.g., skipChecksumVerification).
 */
export async function decodeArchcData(
  data: Uint8Array,
  decodeOptions?: import('./codec').DecodeOptions,
): Promise<{ graph: ArchGraph; canvasState?: SavedCanvasState; aiState?: AIStateData; createdAtMs?: number }> {
  const decoded = await decode(data, decodeOptions);
  return protoToGraphFull(decoded);
}

/** Result of picking a file (raw data, no decoding) */
export interface PickedFile {
  data: Uint8Array;
  fileName: string;
  /**
   * Opaque file handle for save-in-place.
   * On web: FileSystemFileHandle (from File System Access API)
   * On native iOS: string path (from Capacitor Filesystem)
   */
  fileHandle?: unknown;
}

/**
 * Pick a .archc file from the user via the platform FileSystemAdapter.
 * Returns raw file data without decoding. Returns null if user cancels.
 *
 * On web: delegates to WebFileSystemAdapter (File System Access API + <input> fallback)
 * On native iOS: delegates to NativeFileSystemAdapter (Capacitor file picker)
 */
export async function pickArchcFile(): Promise<PickedFile | null> {
  const { getFileSystemAdapter } = await import('@/core/platform/fileSystemAdapter');
  const adapter = await getFileSystemAdapter();

  const result = await adapter.pickFile();
  if (!result) return null;

  return {
    data: result.data,
    fileName: result.name,
    fileHandle: result.handle,
  };
}

/**
 * Open a .archc file using the platform FileSystemAdapter.
 * Returns the decoded graph, filename, and canvas state.
 */
export async function openArchcFile(decodeOptions?: import('./codec').DecodeOptions): Promise<{
  graph: ArchGraph;
  fileName: string;
  fileHandle?: unknown;
  canvasState?: SavedCanvasState;
  aiState?: AIStateData;
  createdAtMs?: number;
} | null> {
  const picked = await pickArchcFile();
  if (!picked) return null;

  // Decode the binary file, including canvas state, AI state, and header timestamps
  const decoded = await decode(picked.data, decodeOptions);
  const { graph, canvasState, aiState, createdAtMs } = protoToGraphFull(decoded);

  return {
    graph,
    fileName: picked.fileName,
    fileHandle: picked.fileHandle,
    canvasState,
    aiState,
    createdAtMs,
  };
}

// ─── File Save Functions ────────────────────────────────────────

/**
 * Save the current graph to the existing file location (save in-place).
 * Delegates to the platform FileSystemAdapter.
 *
 * @param graph - The current architecture graph to save
 * @param fileHandle - Opaque handle from pickArchcFile or saveArchcFileAs (FileSystemFileHandle on web, path string on native)
 * @param canvasState - Optional canvas state (viewport, selection, panel layout)
 * @returns true if save succeeded
 */
export async function saveArchcFile(
  graph: ArchGraph,
  fileHandle: unknown,
  canvasState?: SavedCanvasState,
  aiState?: AIStateData,
  createdAtMs?: number,
): Promise<boolean> {
  // Convert graph to proto format (including canvas state, AI state, and header timestamps)
  const protoFile = graphToProto(graph, canvasState, undefined, aiState, createdAtMs);

  // Encode to binary .archc format (with magic bytes, version, checksum)
  const binaryData = await encode(protoFile);

  // Write to file using the platform adapter
  const { getFileSystemAdapter } = await import('@/core/platform/fileSystemAdapter');
  const adapter = await getFileSystemAdapter();
  await adapter.saveFile(binaryData, fileHandle);

  return true;
}

/**
 * Save the current graph to a new file (Save As).
 * Opens a file save picker via the platform FileSystemAdapter.
 *
 * @param graph - The current architecture graph to save
 * @param suggestedName - Suggested filename (without extension)
 * @param canvasState - Optional canvas state (viewport, selection, panel layout)
 * @returns The new file handle and display name, or null if cancelled
 */
export async function saveArchcFileAs(
  graph: ArchGraph,
  suggestedName?: string,
  canvasState?: SavedCanvasState,
  aiState?: AIStateData,
  createdAtMs?: number,
): Promise<{
  fileHandle?: unknown;
  fileName: string;
} | null> {
  // Convert graph to proto format (including canvas state, AI state, and header timestamps)
  const protoFile = graphToProto(graph, canvasState, undefined, aiState, createdAtMs);

  // Encode to binary .archc format
  const binaryData = await encode(protoFile);

  const baseName = (suggestedName ?? 'architecture').replace(/\.archc$/, '');
  const defaultName = baseName + '.archc';

  // Delegate to the platform adapter
  const { getFileSystemAdapter } = await import('@/core/platform/fileSystemAdapter');
  const adapter = await getFileSystemAdapter();
  const result = await adapter.saveFileAs(binaryData, defaultName);

  if (!result) return null;

  return {
    fileHandle: result.handle,
    fileName: result.fileName,
  };
}

// ─── Sidecar Summary File ────────────────────────────────────────

/**
 * Derive the .summary.md filename from an .archc filename.
 * e.g. "my-project.archc" → "my-project.summary.md"
 */
export function deriveSummaryFileName(archcFileName: string): string {
  return archcFileName.replace(/\.archc$/, '.summary.md');
}

/**
 * Save the .summary.md sidecar file alongside the .archc file.
 * Delegates to the platform FileSystemAdapter's shareFile method.
 * On web: triggers a Blob download. On native: uses Capacitor share/filesystem.
 *
 * @param content - The markdown summary content
 * @param summaryFileName - The filename for the .summary.md file
 */
export async function saveSummaryMarkdown(content: string, summaryFileName: string): Promise<void> {
  const { getFileSystemAdapter } = await import('@/core/platform/fileSystemAdapter');
  const adapter = await getFileSystemAdapter();
  await adapter.shareFile(content, summaryFileName, 'text/markdown');
  console.log(`[FileIO] Summary sidecar saved: ${summaryFileName}`);
}
