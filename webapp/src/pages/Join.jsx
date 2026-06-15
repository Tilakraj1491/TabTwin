// Lets a guest validate and join a TabTwin session from a shared link.
import React, { useEffect, useState } from 'react';
import SessionStatus from '../components/SessionStatus.jsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function Join({ sessionId }) {
  // TODO: Add guest name customization before joining with avatars and saved preferences.
  const [name, setName] = useState('');
  const [status, setStatus] = useState('checking');
  const [message, setMessage] = useState('Checking session...');

  useEffect(() => {
    fetch(`${API_URL}/api/session/${sessionId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Session unavailable');
        return res.json();
      })
      .then(() => {
        setStatus('ready');
        setMessage('Session is ready.');
      })
      .catch(() => {
        setStatus('offline');
        setMessage('This session is invalid or expired.');
      });
  }, [sessionId]);

  function joinSession(event) {
    event.preventDefault();
    const guestName = name.trim() || 'Guest';
    window.location.href = `/session/${sessionId}?name=${encodeURIComponent(guestName)}`;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal-600">Join TabTwin</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Enter the shared session</h1>
        <div className="mt-5">
          <SessionStatus status={status} label={message} />
        </div>
        <form className="mt-6 space-y-4" onSubmit={joinSession}>
          <label className="block text-sm font-medium text-slate-700" htmlFor="guest-name">
            Your name
          </label>
          <input
            id="guest-name"
            className="w-full rounded-md border border-slate-300 px-3 py-3 text-slate-950 outline-none ring-teal-500 focus:ring-2"
            placeholder="Maya"
            value={name}
            maxLength={40}
            onChange={(event) => setName(event.target.value)}
          />
          <button
            className="w-full rounded-md bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={status !== 'ready'}
            type="submit"
          >
            Join Session
          </button>
        </form>
        <p className="mt-4 text-xs leading-5 text-slate-500">Guest profile preferences are coming soon.</p>
      </section>
    </main>
  );
}
