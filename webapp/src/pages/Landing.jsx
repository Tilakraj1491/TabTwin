// Presents the TabTwin landing page and routes guests into session links.
import React from 'react';

export default function Landing() {
  // TODO: Build a web dashboard for hosts to manage past sessions and view history.
  // TODO: Add a guest waiting room so the host approves each guest before they join.
  // TODO: Build guest mobile view with view-only controls for phones.
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 lg:grid-cols-[1fr_0.9fr] lg:py-16">
          <div className="flex flex-col justify-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-600">Open source browser collaboration</p>
            <h1 className="mt-3 max-w-3xl text-5xl font-bold leading-tight text-slate-950">TabTwin</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-650">
              Share a live browser tab with a teammate or AI agent. Guests get a ghost cursor, annotations, and approved actions without installing anything.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a className="rounded-md bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800" href="/join/demo">
                Try demo join page
              </a>
              <a className="rounded-md border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-100" href="https://github.com/itzzavdhesh/TabTwin">
                View source
              </a>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-950 p-4 text-white shadow-xl">
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              <span className="h-3 w-3 rounded-full bg-red-400" />
              <span className="h-3 w-3 rounded-full bg-amber-400" />
              <span className="h-3 w-3 rounded-full bg-green-400" />
              <span className="ml-3 text-xs text-slate-300">host browser</span>
            </div>
            <div className="relative mt-4 h-80 overflow-hidden rounded-md bg-white text-slate-900">
              <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold">Quarterly launch doc</div>
              <div className="space-y-3 p-5 text-sm leading-6">
                <p className="rounded bg-teal-100 px-2 py-1">Guest highlighted: launch risks and owner notes</p>
                <p>AI agent is drafting a reply from the active Gmail tab while the host watches.</p>
                <p className="text-slate-500">Cursor and actions are synchronized over WebRTC data channels.</p>
              </div>
              <div className="absolute left-36 top-40">
                <div className="h-0 w-0 border-l-[12px] border-r-[4px] border-t-[18px] border-l-blue-600 border-r-transparent border-t-blue-600" />
                <span className="ml-3 rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white">Maya</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-6 py-10 md:grid-cols-3">
        {[
          ['Host starts', 'Install the Chrome extension, start a session, and share the generated link.'],
          ['Guest joins', 'Open the link in Chrome, Firefox, Edge, or Safari with no extension required.'],
          ['Work together', 'Cursor moves, annotations, CRDT updates, and approved actions stay in sync live.']
        ].map(([title, body]) => (
          <article key={title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
