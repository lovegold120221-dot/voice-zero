// src/components/LocalFolderPanel.tsx
//
// Visual UI for the local folder sync inside ProfilePage. Reuses the
// existing card styling (bg-[#1C1C1E] rounded-[20px] with white/5 dividers)
// and lucide icons so it slots into the rest of the page without
// inventing a new design language.

import { useEffect, useState } from 'react';
import {
  Folder, FolderPlus, HardDrive, RefreshCw, X, Check, AlertCircle,
  Loader2, Trash2, Plus, Settings,
} from 'lucide-react';
import {
  detectCapability, type Capability,
} from '../lib/localFolder';
import { useLocalFolder } from '../lib/localFolderContext';

function timeAgo(ms: number | null): string {
  if (!ms) return 'never';
  const d = Math.max(0, Date.now() - ms);
  if (d < 5_000) return 'just now';
  if (d < 60_000) return `${Math.floor(d / 1000)}s ago`;
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  return `${Math.floor(d / 86_400_000)}d ago`;
}

function CapabilityBadge({ capability }: { capability: Capability }) {
  const map = {
    full: { label: 'Native picker', tone: 'emerald' },
    partial: { label: 'Share / export', tone: 'amber' },
    none: { label: 'Per-file only', tone: 'zinc' },
  } as const;
  const tone = map[capability];
  const cls =
    tone.tone === 'emerald' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
    tone.tone === 'amber'   ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
    'bg-white/5 text-zinc-400 border-white/10';
  return (
    <span className={`text-[10px] uppercase tracking-widest font-semibold px-2 py-1 rounded-md border ${cls}`}>
      {tone.label}
    </span>
  );
}

function useConfirmArmed(timeoutMs = 4000): [boolean, (action: () => void) => void] {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), timeoutMs);
    return () => clearTimeout(t);
  }, [armed, timeoutMs]);
  return [armed, (action) => {
    if (armed) { action(); setArmed(false); }
    else setArmed(true);
  }];
}

export function LocalFolderPanel() {
  const ctx = useLocalFolder();
  const [ignoreDraft, setIgnoreDraft] = useState('');
  const [showIgnoreEditor, setShowIgnoreEditor] = useState(false);
  const [confirmingDisconnect, fireDisconnect] = useConfirmArmed();

  // Sync ignore draft with current handle's ignore patterns on every
  // change (initial pick AND subsequent saves via setIgnorePatterns).
  useEffect(() => {
    if (ctx.handle) setIgnoreDraft(ctx.handle.ignorePatterns.join('\n'));
  }, [ctx.handle?.pickedAt]);

  // ── Render branches ──

  // cap = none === no native, no OPFS-share. Show nothing actionable.
  if (ctx.capability === 'none' && ctx.status === 'unsupported') {
    return (
      <div className="bg-[#1C1C1E] rounded-[20px] overflow-hidden p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0">
            <HardDrive className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] text-white font-medium">Local folder sync</p>
            <p className="text-[13px] text-zinc-400 mt-1 leading-relaxed">
              This browser doesn't expose a folder picker. Per-file downloads from the Export menu still work.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // No folder picked → CTA card
  if (!ctx.handle) {
    return (
      <div className="bg-[#1C1C1E] rounded-[20px] overflow-hidden p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0">
            <FolderPlus className="w-4 h-4 text-[#d0a78b]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[15px] text-white font-medium">Local folder</p>
              <CapabilityBadge capability={ctx.capability} />
            </div>
            <p className="text-[13px] text-zinc-400 leading-relaxed mb-3">
              Pick a folder. Anything you drop in becomes a knowledge file. Anything Beatrice produces lands in the same folder.
            </p>
            <button
              onClick={() => ctx.pick()}
              disabled={ctx.status === 'scanning'}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#d0a78b] text-black text-[13px] font-semibold active:brightness-90 transition-all shadow shadow-[#d0a78b]/20 disabled:opacity-50"
            >
              {ctx.status === 'scanning' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
              {ctx.status === 'scanning' ? 'Working…' : 'Select Sync Folder'}
            </button>
            {ctx.status === 'denied' && (
              <p className="text-[12px] text-red-400 mt-2 flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3" />
                Permission denied. Try again in your browser settings.
              </p>
            )}
            {ctx.status === 'lost' && (
              <p className="text-[12px] text-amber-400 mt-2 flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3" />
                The folder can't be reached. Pick it again to reconnect.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Folder picked — show status / counters
  return (
    <div className="bg-[#1C1C1E] rounded-[20px] overflow-hidden">
      <div className="p-4 border-b border-white/5 flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0">
          <Folder className="w-4 h-4 text-[#d0a78b]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-[15px] text-white font-medium truncate">{ctx.handle.name}</p>
            <CapabilityBadge capability={ctx.capability} />
          </div>
          <p className="text-[12px] text-zinc-400 leading-relaxed">
            {ctx.status === 'watching' && (
              <>Watching · last scan {timeAgo(ctx.lastScannedAt)}</>
            )}
            {ctx.status === 'scanning' && (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                Scanning…
              </span>
            )}
            {ctx.status === 'denied' && (
              <span className="flex items-center gap-1.5 text-red-400">
                <AlertCircle className="w-3 h-3" /> Permission denied
              </span>
            )}
            {ctx.status === 'lost' && (
              <span className="flex items-center gap-1.5 text-amber-400">
                <AlertCircle className="w-3 h-3" /> Folder disconnected
              </span>
            )}
            {ctx.status === 'error' && (
              <span className="flex items-center gap-1.5 text-amber-400">
                <AlertCircle className="w-3 h-3" /> Some scans failed
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => ctx.scanNow()}
          disabled={ctx.status === 'scanning'}
          className="p-2 rounded-full active:bg-white/5 text-zinc-400 hover:text-[#d0a78b] disabled:opacity-40 transition-colors"
          aria-label="Scan now"
          title="Scan now"
        >
          {ctx.status === 'scanning' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </button>
      </div>

      {/* Counters row */}
      {(ctx.counters.scanned > 0 || ctx.counters.errors.length > 0) && (
        <div className="px-4 py-3 border-b border-white/5 text-[11px] text-zinc-500 grid grid-cols-4 gap-2">
          <div className="flex flex-col">
            <span className="text-zinc-600 uppercase tracking-wider">Scanned</span>
            <span className="text-zinc-300 text-[14px] font-semibold">{ctx.counters.scanned}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-zinc-600 uppercase tracking-wider">Added KB</span>
            <span className="text-emerald-400 text-[14px] font-semibold">{ctx.counters.createdKB}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-zinc-600 uppercase tracking-wider">Removed</span>
            <span className="text-zinc-300 text-[14px] font-semibold">{ctx.counters.deletedKB}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-zinc-600 uppercase tracking-wider">Sandbox</span>
            <span className="text-amber-400 text-[14px] font-semibold">{ctx.counters.mirroredOPFS}</span>
          </div>
        </div>
      )}

      {/* Errors banner */}
      {ctx.errors.length > 0 && (
        <div className="px-4 py-3 border-b border-white/5 bg-amber-500/5">
          <p className="text-[11px] uppercase tracking-wider text-amber-400 font-semibold flex items-center gap-1.5">
            <AlertCircle className="w-3 h-3" />
            {ctx.errors.length} issue(s)
          </p>
          <ul className="mt-1 space-y-0.5 text-[12px] text-zinc-400 max-h-24 overflow-y-auto">
            {ctx.errors.slice(0, 5).map((e, i) => (
              <li key={i} className="truncate">{e}</li>
            ))}
            {ctx.errors.length > 5 && (
              <li className="text-zinc-600">+ {ctx.errors.length - 5} more</li>
            )}
          </ul>
        </div>
      )}

      {/* Ignore editor */}
      {showIgnoreEditor ? (
        <div className="p-4 border-b border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-white font-medium">Ignore patterns</p>
            <button
              onClick={() => setShowIgnoreEditor(false)}
              className="p-1 rounded text-zinc-500 hover:text-white"
              aria-label="Close ignore editor"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            One pattern per line. <code>*.log</code> matches file names. <code>/private</code> matches a path prefix. <code>node_modules</code> matches any directory of that name.
          </p>
          <textarea
            value={ignoreDraft}
            onChange={(e) => setIgnoreDraft(e.target.value)}
            rows={5}
            className="w-full bg-black/30 border border-white/5 rounded-lg px-3 py-2 text-[12px] text-zinc-200 font-mono focus:outline-none focus:border-[#d0a78b]/40"
            spellCheck={false}
          />
          <div className="flex gap-2">
            <button
              onClick={async () => {
                const arr = ignoreDraft.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
                await ctx.setIgnorePatterns(arr);
              }}
              className="flex-1 py-2 rounded-full bg-[#d0a78b] text-black text-[12px] font-semibold active:brightness-90"
            >
              <Check className="w-3 h-3 inline-block mr-1" /> Save
            </button>
            <button
              onClick={() => setShowIgnoreEditor(false)}
              className="px-4 py-2 rounded-full bg-white/5 text-zinc-300 text-[12px] font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => setShowIgnoreEditor(true)}
          className="p-4 border-b border-white/5 flex items-center justify-between cursor-pointer active:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Settings className="w-4 h-4 text-zinc-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-[13px] text-white">Ignore patterns</p>
              <p className="text-[11px] text-zinc-500 truncate">
                {ctx.handle.ignorePatterns.length === 0
                  ? 'None (defaults are applied: node_modules, .git, …)'
                  : ctx.handle.ignorePatterns.slice(0, 3).join(', ') +
                    (ctx.handle.ignorePatterns.length > 3 ? `, +${ctx.handle.ignorePatterns.length - 3} more` : '')}
              </p>
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); void ctx.scanNow(); }}
            className="p-2 rounded-full active:bg-white/5 text-zinc-500 hover:text-[#d0a78b] transition-colors"
            aria-label="Edit"
            title="Edit ignore patterns"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Footer actions */}
      <div className="p-3 flex gap-2">
        {ctx.status === 'denied' || ctx.status === 'lost' ? (
          <button
            onClick={() => ctx.reattach()}
            className="flex-1 py-2.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[13px] font-semibold active:bg-amber-500/25"
          >
            Reconnect Folder
          </button>
        ) : (
          <button
            onClick={() => ctx.scanNow()}
            disabled={ctx.status === 'scanning'}
            className="flex-1 py-2.5 rounded-full bg-white/5 border border-white/10 text-zinc-300 text-[13px] font-semibold active:bg-white/10 flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            {ctx.status === 'scanning' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Rescan now
          </button>
        )}
        <button
          onClick={() => fireDisconnect(() => void ctx.discard())}
          className={
            confirmingDisconnect
              ? 'px-4 py-2.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 text-[13px] font-semibold active:bg-red-500/30 flex items-center gap-1.5'
              : 'px-4 py-2.5 rounded-full bg-white/5 border border-white/10 text-zinc-300 text-[13px] font-semibold active:bg-white/10 flex items-center gap-1.5'
          }
          aria-label="Disconnect folder"
          title={confirmingDisconnect ? 'Tap again to confirm' : 'Disconnect folder'}
        >
          <Trash2 className="w-3 h-3" />
          {confirmingDisconnect ? 'Confirm?' : 'Disconnect'}
        </button>
      </div>
    </div>
  );
}
