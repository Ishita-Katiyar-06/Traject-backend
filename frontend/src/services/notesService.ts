/**
 * Tessera Analyst Notes Service
 *
 * Provides persistence for analyst working notes across investigations.
 */

export interface PersistentAnalystNote {
  id: string;
  investigationId: string;
  author: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

const NOTES_STORAGE_KEY = 'tessera_analyst_notes';

const INITIAL_NOTES: PersistentAnalystNote[] = [
  {
    id: 'note-1',
    investigationId: 'alt-601',
    author: 'Lead Analyst (AK)',
    content: 'Cross-checked municipal dispatch reports. Utility issued acknowledgment of 220kV breaker failure at 19:05 UTC. Monitor whether Telegram discussion shifts to repair timelines.',
    createdAt: '2026-09-02T19:12:00Z',
    updatedAt: '2026-09-02T19:12:00Z',
  },
  {
    id: 'note-2',
    investigationId: 'alt-601',
    author: 'Analyst (JR)',
    content: 'Trade syndicate channels currently reposting generator diesel inquiries. Possible cross-link with fuel distribution topic top-104.',
    createdAt: '2026-09-02T19:25:00Z',
    updatedAt: '2026-09-02T19:25:00Z',
  },
];

export const notesService = {
  getNotesByInvestigationId(investigationId: string): PersistentAnalystNote[] {
    try {
      const stored = localStorage.getItem(NOTES_STORAGE_KEY);
      const all: PersistentAnalystNote[] = stored ? JSON.parse(stored) : INITIAL_NOTES;
      return all.filter((n) => n.investigationId.toLowerCase() === investigationId.toLowerCase());
    } catch {
      return INITIAL_NOTES.filter((n) => n.investigationId.toLowerCase() === investigationId.toLowerCase());
    }
  },

  createNote(investigationId: string, content: string, author = 'Lead Analyst (AK)'): PersistentAnalystNote {
    const all = this.getAllNotes();
    const newNote: PersistentAnalystNote = {
      id: `note-${Date.now()}`,
      investigationId,
      author,
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [newNote, ...all];
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(updated));
    return newNote;
  },

  updateNote(noteId: string, content: string): PersistentAnalystNote | undefined {
    const all = this.getAllNotes();
    let updatedNote: PersistentAnalystNote | undefined;
    const updated = all.map((n) => {
      if (n.id === noteId) {
        updatedNote = { ...n, content, updatedAt: new Date().toISOString() };
        return updatedNote;
      }
      return n;
    });
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(updated));
    return updatedNote;
  },

  deleteNote(noteId: string): boolean {
    const all = this.getAllNotes();
    const updated = all.filter((n) => n.id !== noteId);
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(updated));
    return true;
  },

  getAllNotes(): PersistentAnalystNote[] {
    try {
      const stored = localStorage.getItem(NOTES_STORAGE_KEY);
      return stored ? JSON.parse(stored) : INITIAL_NOTES;
    } catch {
      return INITIAL_NOTES;
    }
  },
};
