import React, { useState } from 'react';
import { AnalystNote } from '../../data/mock/investigations';
import { Button } from '../ui/Button';
import { FileText, Plus, Trash2, Clock } from 'lucide-react';

export interface AnalystNotesProps {
  notes: AnalystNote[];
  onAddNote: (text: string) => void;
  onDeleteNote: (noteId: string) => void;
  className?: string;
}

export const AnalystNotes: React.FC<AnalystNotesProps> = ({
  notes,
  onAddNote,
  onDeleteNote,
  className = '',
}) => {
  const [draft, setDraft] = useState('');
  const [isComposing, setIsComposing] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (draft.trim()) {
      onAddNote(draft.trim());
      setDraft('');
      setIsComposing(false);
    }
  };

  return (
    <div className={`rounded-[26px] border border-[rgba(228,233,245,0.85)] bg-white p-6 shadow-xs space-y-4 font-sans ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#2F65F6]" />
          <h3 className="text-[17px] font-bold font-sans text-[#111727]">
            Analyst Working Notes
          </h3>
        </div>

        {!isComposing && (
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setIsComposing(true)}
          >
            Add Working Note
          </Button>
        )}
      </div>

      {/* Note Composer */}
      {isComposing && (
        <form onSubmit={handleSubmit} className="p-4 rounded-[18px] bg-[#F8FAFD] border border-[rgba(228,233,245,0.85)] space-y-3 font-sans">
          <label className="block text-[11px] font-sans font-bold text-[#8591A5] uppercase tracking-wider">
            New Working Hypothesis / Investigation Log
          </label>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="Record ground observations, corroboration steps, or action items..."
            className="w-full p-3 bg-white border border-[rgba(228,233,245,0.85)] rounded-[14px] text-[13px] text-[#111727] placeholder:text-[#8591A5] focus:outline-none focus:border-[#2F65F6] focus:ring-2 focus:ring-[#2F65F6]/20 transition-all resize-none font-sans"
            autoFocus
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => {
                setIsComposing(false);
                setDraft('');
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={!draft.trim()}>
              Save Note
            </Button>
          </div>
        </form>
      )}

      {/* Chronological Notes Feed */}
      <div className="space-y-2.5">
        {notes.length === 0 ? (
          <div className="py-6 text-center text-[#8591A5] font-sans text-[13px]">
            No working notes logged for this investigation.
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="p-4 rounded-[18px] bg-[#F8FAFD] border border-[rgba(228,233,245,0.85)] space-y-1.5 hover:bg-white hover:border-[#2F65F6]/40 hover:shadow-xs transition-all group font-sans"
            >
              <div className="flex items-center justify-between text-[11px] font-mono text-[#8591A5]">
                <div className="flex items-center gap-2">
                  <span className="text-[#111727] font-bold">{note.author}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#8591A5]" />
                    <span>{note.timestamp}</span>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onDeleteNote(note.id)}
                  className="opacity-0 group-hover:opacity-100 text-[#8591A5] hover:text-rose-600 transition-opacity p-1 cursor-pointer"
                  title="Delete note"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-[13px] text-[#475569] font-sans leading-relaxed">
                {note.text}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
