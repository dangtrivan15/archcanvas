/**
 * File I/O module for opening and saving .archc files.
 * Handles File System Access API with fallback, and proto-to-graph conversion.
 */

import type { ArchGraph, ArchNode, ArchEdge, Note, CodeRef, Position, EdgeType, NoteStatus, CodeRefRole } from '@/types/graph';
import type { IArchCanvasFile } from '@/proto/archcanvas';
import { archcanvas } from '@/proto/archcanvas';
import { decode } from './codec';
import { DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from '@/utils/constants';

// ─── Proto → Graph Converters ────────────────────────────────────

/**
 * Convert a decoded ArchCanvasFile (protobuf) to our internal ArchGraph type.
 */
export function protoToGraph(file: IArchCanvasFile): ArchGraph {
  const arch = file.architecture;
  if (!arch) {
    return {
      name: 'Untitled Architecture',
      description: '',
      owners: [],
      nodes: [],
      edges: [],
    };
  }

  return {
    name: arch.name ?? 'Untitled Architecture',
    description: arch.description ?? '',
    owners: arch.owners ? [...arch.owners] : [],
    nodes: (arch.nodes ?? []).map(protoNodeToNode),
    edges: (arch.edges ?? []).map(protoEdgeToEdge),
  };
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

// ─── Graph → Proto Converters ────────────────────────────────────

/**
 * Convert our internal ArchGraph to an IArchCanvasFile protobuf structure.
 */
export function graphToProto(graph: ArchGraph): IArchCanvasFile {
  return {
    architecture: {
      name: graph.name,
      description: graph.description,
      owners: [...graph.owners],
      nodes: graph.nodes.map(nodeToProtoNode),
      edges: graph.edges.map(edgeToProtoEdge),
    },
  };
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

// ─── File Open/Save Functions ────────────────────────────────────

/**
 * Open a .archc file using File System Access API (with fallback).
 * Returns the decoded graph and filename.
 */
export async function openArchcFile(): Promise<{
  graph: ArchGraph;
  fileName: string;
  fileHandle?: FileSystemFileHandle;
} | null> {
  let fileData: Uint8Array;
  let fileName: string;
  let fileHandle: FileSystemFileHandle | undefined;

  // Try File System Access API first (Chrome/Edge)
  if ('showOpenFilePicker' in window) {
    try {
      const handles = await window.showOpenFilePicker({
        types: [
          {
            description: 'ArchCanvas Files',
            accept: { 'application/octet-stream': ['.archc'] },
          },
        ],
        multiple: false,
      });
      const handle = handles[0];
      if (!handle) return null;
      fileHandle = handle;
      const file = await handle.getFile();
      fileName = file.name;
      const buffer = await file.arrayBuffer();
      fileData = new Uint8Array(buffer);
    } catch (err) {
      // User cancelled the picker
      if (err instanceof DOMException && err.name === 'AbortError') {
        return null;
      }
      throw err;
    }
  } else {
    // Fallback: use hidden <input type="file">
    const result = await openFileViaInput();
    if (!result) return null;
    fileData = result.data;
    fileName = result.name;
  }

  // Decode the binary file
  const decoded = await decode(fileData);
  const graph = protoToGraph(decoded);

  // Clean up the filename (remove .archc extension for display)
  const displayName = fileName.replace(/\.archc$/, '');

  return {
    graph,
    fileName: displayName,
    fileHandle,
  };
}

/**
 * Fallback file open using a hidden <input type="file"> element.
 */
function openFileViaInput(): Promise<{ data: Uint8Array; name: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.archc';

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const buffer = await file.arrayBuffer();
      resolve({
        data: new Uint8Array(buffer),
        name: file.name,
      });
    };

    // Handle cancel (no change event fires)
    input.addEventListener('cancel', () => resolve(null));

    input.click();
  });
}
