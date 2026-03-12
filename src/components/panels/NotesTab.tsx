import { useState } from 'react';
import type { Note } from '@/types';
import { useGraphStore } from '@/store/graphStore';

interface NodeNotesTabProps {
  notes: Note[];
  canvasId: string;
  nodeId: string;
}

interface EdgeNotesTabProps {
  notes: Note[];
  canvasId: string;
  from: string;
  to: string;
}

type Props = NodeNotesTabProps | EdgeNotesTabProps;

function isNodeProps(p: Props): p is NodeNotesTabProps {
  return 'nodeId' in p;
}

function saveNotes(props: Props, updatedNotes: Note[]) {
  if (isNodeProps(props)) {
    useGraphStore.getState().updateNode(props.canvasId, props.nodeId, { notes: updatedNotes });
  } else {
    useGraphStore.getState().updateEdge(props.canvasId, props.from, props.to, { notes: updatedNotes });
  }
}

const emptyForm = { author: '', content: '', tags: '' };

export function NotesTab(props: Props) {
  const notes = props.notes;
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  const commitAdd = () => {
    if (!form.content.trim()) return;
    const newNote: Note = {
      author: form.author.trim() || 'anonymous',
      content: form.content.trim(),
      tags: form.tags.trim() ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
    };
    saveNotes(props, [...notes, newNote]);
    setForm(emptyForm);
    setShowForm(false);
  };

  const commitEdit = (index: number) => {
    if (!form.content.trim()) return;
    const updated = notes.map((n, i) => {
      if (i !== index) return n;
      return {
        author: form.author.trim() || 'anonymous',
        content: form.content.trim(),
        tags: form.tags.trim() ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
      };
    });
    saveNotes(props, updated);
    setEditIndex(null);
    setForm(emptyForm);
  };

  const startEdit = (index: number) => {
    const n = notes[index];
    setForm({ author: n.author, content: n.content, tags: (n.tags ?? []).join(', ') });
    setEditIndex(index);
    setShowForm(false);
  };

  const deleteNote = (index: number) => {
    saveNotes(props, notes.filter((_, i) => i !== index));
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditIndex(null);
    setForm(emptyForm);
  };

  return (
    <div className="space-y-2">
      {notes.length === 0 && !showForm && editIndex === null && (
        <p className="text-xs text-gray-400">No notes yet.</p>
      )}

      {notes.map((note, i) => (
        <div key={i} className="group rounded border p-2 text-xs space-y-1">
          {editIndex === i ? (
            <NoteForm
              form={form}
              onChange={setForm}
              onSave={() => commitEdit(i)}
              onCancel={cancelForm}
            />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-700">{note.author}</span>
                <span className="hidden group-hover:flex gap-1">
                  <button
                    onClick={() => startEdit(i)}
                    className="text-gray-400 hover:text-blue-600 px-1"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteNote(i)}
                    className="text-gray-400 hover:text-red-600 px-1"
                  >
                    Delete
                  </button>
                </span>
              </div>
              <p className="text-gray-700 whitespace-pre-wrap">{note.content}</p>
              {(note.tags ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {(note.tags ?? []).map((tag) => (
                    <span
                      key={tag}
                      className="bg-blue-50 text-blue-700 rounded px-1.5 py-0.5 text-[10px]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ))}

      {showForm && editIndex === null && (
        <div className="rounded border p-2 text-xs">
          <NoteForm
            form={form}
            onChange={setForm}
            onSave={commitAdd}
            onCancel={cancelForm}
          />
        </div>
      )}

      {!showForm && editIndex === null && (
        <button
          onClick={() => setShowForm(true)}
          className="text-xs text-blue-600 hover:underline mt-1"
        >
          + Add Note
        </button>
      )}
    </div>
  );
}

interface NoteFormProps {
  form: typeof emptyForm;
  onChange: (f: typeof emptyForm) => void;
  onSave: () => void;
  onCancel: () => void;
}

function NoteForm({ form, onChange, onSave, onCancel }: NoteFormProps) {
  const inputClass = 'w-full border rounded px-1 py-0.5 text-xs mt-0.5';
  return (
    <div className="space-y-1.5">
      <div>
        <label className="text-gray-500">Author</label>
        <input
          className={inputClass}
          placeholder="anonymous"
          value={form.author}
          onChange={(e) => onChange({ ...form, author: e.target.value })}
        />
      </div>
      <div>
        <label className="text-gray-500">Content</label>
        <textarea
          className={`${inputClass} resize-none h-16`}
          placeholder="Note content..."
          value={form.content}
          onChange={(e) => onChange({ ...form, content: e.target.value })}
        />
      </div>
      <div>
        <label className="text-gray-500">Tags (comma-separated)</label>
        <input
          className={inputClass}
          placeholder="e.g. todo, revisit"
          value={form.tags}
          onChange={(e) => onChange({ ...form, tags: e.target.value })}
        />
      </div>
      <div className="flex gap-2 pt-0.5">
        <button
          onClick={onSave}
          className="text-xs bg-blue-600 text-white rounded px-2 py-0.5 hover:bg-blue-700"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="text-xs text-gray-500 hover:text-gray-700 px-2 py-0.5"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
