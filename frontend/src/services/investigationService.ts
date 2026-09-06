import { simulateFetch } from './apiClient';
import { MOCK_INVESTIGATIONS, InvestigationDetail, AnalystNote } from '../data/mock/investigations';
import { AlertStatusType } from '../data/mock/alerts';
import { notesService } from './notesService';

let localInvestigations = [...MOCK_INVESTIGATIONS];

export const investigationService = {
  async getInvestigationById(id: string): Promise<InvestigationDetail | undefined> {
    const list = await simulateFetch(localInvestigations);
    const inv = list.find(
      (item) => item.id.toLowerCase() === id.toLowerCase() || item.signalId?.toLowerCase() === id.toLowerCase()
    );
    if (inv) {
      // Pull persisted notes for this investigation
      const persistentNotes = notesService.getNotesByInvestigationId(inv.id);
      const mappedNotes: AnalystNote[] = persistentNotes.map((pn) => ({
        id: pn.id,
        author: pn.author,
        timestamp: new Date(pn.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' UTC',
        text: pn.content,
      }));
      return { ...inv, notes: mappedNotes.length > 0 ? mappedNotes : inv.notes };
    }
    return undefined;
  },

  async updateStatus(id: string, newStatus: AlertStatusType): Promise<InvestigationDetail | undefined> {
    localInvestigations = localInvestigations.map((inv) => {
      if (inv.id.toLowerCase() === id.toLowerCase()) {
        return { ...inv, status: newStatus, updatedAt: new Date().toISOString() };
      }
      return inv;
    });
    return this.getInvestigationById(id);
  },

  async addNote(id: string, noteText: string): Promise<AnalystNote | undefined> {
    const created = notesService.createNote(id, noteText);
    const newNote: AnalystNote = {
      id: created.id,
      author: created.author,
      timestamp: new Date(created.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' UTC',
      text: created.content,
    };

    localInvestigations = localInvestigations.map((inv) => {
      if (inv.id.toLowerCase() === id.toLowerCase()) {
        return { ...inv, notes: [newNote, ...inv.notes] };
      }
      return inv;
    });

    return newNote;
  },

  async deleteNote(id: string, noteId: string): Promise<boolean> {
    notesService.deleteNote(noteId);
    localInvestigations = localInvestigations.map((inv) => {
      if (inv.id.toLowerCase() === id.toLowerCase()) {
        return { ...inv, notes: inv.notes.filter((n) => n.id !== noteId) };
      }
      return inv;
    });
    return true;
  },
};
