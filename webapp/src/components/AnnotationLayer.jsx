// Provides guest-side annotation controls and syncs CRDT annotation updates.
import React, { useState } from 'react';

export default function AnnotationLayer({ session }) {
  // TODO: Add annotation persistence after session ends.
  const [note, setNote] = useState('');

  function submitAnnotation(event) {
    event.preventDefault();
    if (!note.trim()) return;
    session.addAnnotation({ text: note.trim(), createdAt: Date.now() });
    setNote('');
  }

  return (
    <form
      className="fixed right-4 top-24 z-30 hidden w-72 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:block"
      onSubmit={submitAnnotation}
    >
      <label className="text-sm font-semibold text-slate-800" htmlFor="annotation-note">
        Annotation
      </label>
      <textarea
        id="annotation-note"
        className="mt-2 h-24 w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-teal-500 focus:ring-2"
        placeholder="Leave a note for the host"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={500}
      />
      <p className="mt-1 text-right text-xs text-slate-400">
        {note.length}/500
      </p>
      <button
        className="mt-3 w-full rounded-md bg-teal-600 px-3 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
        disabled={!session.permissions.canAnnotate}
        type="submit"
      >
        Add Note
      </button>
      <p className="mt-2 text-xs text-slate-500">Session notes sync live with the host.</p>
    </form>
  );
}
