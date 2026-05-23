// tauri-ipc.js
// Thin wrapper around Tauri commands.
// When running inside Tauri: delegates to window.__TAURI__.invoke().
// When running in a plain browser (dev mode): uses localStorage stubs.
// This file is the ONLY place that knows whether Tauri is available.

const TAURI = typeof window !== 'undefined' && window.__TAURI__;

export async function invoke(cmd, args = {}) {
  if (TAURI) {
    return window.__TAURI__.invoke(cmd, args);
  }
  return _stub(cmd, args);
}

// ── File watcher (no-op stub; Tauri real impl emits 'file-changed' event) ──
export function listenFileChanged(callback) {
  if (TAURI) {
    window.__TAURI__.event.listen('file-changed', callback);
  }
  // browser: no file watching, but we expose the API so callers don't break
}

export function setWindowTitle(title) {
  if (TAURI) {
    window.__TAURI__.window.getCurrentWindow().setTitle(title);
  } else {
    document.title = title;
  }
}

// ── Browser stubs ────────────────────────────────────────────────────────────
// Use localStorage to simulate file I/O.
// Paths are treated as localStorage keys (prefixed to avoid collisions).

const PREFIX = 'wmsplan_';

function _stub(cmd, args) {
  switch (cmd) {

    case 'read_recent': {
      try { return JSON.parse(localStorage.getItem(PREFIX + 'recent') || '[]'); }
      catch { return []; }
    }

    case 'write_recent': {
      localStorage.setItem(PREFIX + 'recent', JSON.stringify(args.data));
      return;
    }

    case 'read_project': {
      try {
        const raw = localStorage.getItem(PREFIX + args.path);
        if (!raw) throw new Error('Project not found: ' + args.path);
        return raw;
      } catch (e) { throw e; }
    }

    case 'write_project': {
      localStorage.setItem(PREFIX + args.path, args.data);
      return;
    }

    case 'write_project_backup':
      // No-op in browser mode
      return;

    case 'open_dialog': {
      // List all saved project keys and let user pick
      const keys = Object.keys(localStorage)
        .filter(k => k.startsWith(PREFIX) && k !== PREFIX + 'recent')
        .map(k => k.slice(PREFIX.length));
      if (keys.length === 0) { alert('Aucun projet sauvegardé en mode navigateur.'); return null; }
      const choice = prompt('Projets disponibles:\n' + keys.map((k, i) => `${i + 1}. ${k}`).join('\n') + '\n\nEntrez le numéro ou le nom du projet:');
      if (!choice) return null;
      const idx = parseInt(choice) - 1;
      return isNaN(idx) ? choice : (keys[idx] || null);
    }

    case 'save_dialog': {
      const suggested = (args.name || 'nouveau_projet').replace(/[^a-zA-Z0-9_\-]/g, '_');
      const name = prompt('Nom du fichier projet (mode navigateur):', suggested);
      return name || null;
    }

    case 'export_html_dialog': {
      const suggested = (args.name || 'export').replace(/[^a-zA-Z0-9_\-]/g, '_');
      // In browser mode, trigger a download using Blob
      return { _browserDownload: true, filename: suggested + '_export.html' };
    }

    case 'export_html_write': {
      // args: { content: string, filename: string }
      const blob = new Blob([args.content], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = args.filename; a.click();
      URL.revokeObjectURL(url);
      return;
    }

    case 'watch_file':
    case 'unwatch_file':
      return; // no-op in browser

    default:
      console.warn('[tauri-ipc stub] Unknown command:', cmd, args);
      return null;
  }
}
