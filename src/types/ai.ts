/**
 * AI integration types for the chat panel and Claude API.
 */

export interface AIConversation {
  id: string;
  scopedToNodeId?: string;
  messages: AIMessage[];
  createdAtMs: number;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestampMs: number;
  suggestions: AISuggestion[];
}

export interface AISuggestion {
  id: string;
  targetNodeId?: string;
  targetEdgeId?: string;
  suggestionType: string;
  content: string;
  status: 'pending' | 'accepted' | 'dismissed';
}

export interface AIContext {
  selectedNode?: {
    id: string;
    type: string;
    displayName: string;
    args: Record<string, string | number | boolean>;
    notes: { author: string; content: string }[];
    codeRefs: { path: string; role: string }[];
  };
  neighbors: {
    id: string;
    type: string;
    displayName: string;
    connectionType: string;
  }[];
  architectureName: string;
  totalNodeCount: number;
  totalEdgeCount: number;
}
