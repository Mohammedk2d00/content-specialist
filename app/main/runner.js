// Runs one task at a time (a shell command or an in-process engine call) and reports start, log and done to the window.
const lib = require('./lib.js');

function createRunner(send, ws) {
  let current = null; // { cancel(), done? } for whatever is running

  const snapshot = () => new Set(lib.listDrafts(ws()).map(d => d.name));
  function finish(kind, run, before, code, extra) {
    current = null;
    const created = lib.listDrafts(ws()).map(d => d.name).filter(n => !before.has(n));
    send('run:done', Object.assign({ kind, code, cancelled: !!run.cancelled, created }, extra || {}));
  }

  // A shell command run (Gemini CLI, npm, winget, build.js)
  function startRun(kind, cmd, env) {
    if (current) return { ok: false, error: 'busy' };
    const before = snapshot();
    send('run:start', { kind });
    const run = lib.runCommand(cmd, ws(), c => send('run:log', c), env);
    run.cancel = () => lib.killTree(run);
    current = run;
    run.done.then(code => finish(kind, run, before, code));
    return { ok: true };
  }

  // An in-process run (the fast engine)
  function startEngineRun(kind, fn) {
    if (current) return { ok: false, error: 'busy' };
    const before = snapshot();
    send('run:start', { kind });
    const ac = new AbortController();
    const run = { cancelled: false, cancel() { run.cancelled = true; ac.abort(); } };
    current = run;
    fn(ac.signal, s => send('run:log', s)).then(
      res => finish(kind, run, before, 0, { warnings: (res && res.warnings || []).length }),
      e => { send('run:log', '\n' + String(e && e.message || e) + '\n'); finish(kind, run, before, 1, { errorCode: (e && e.code) || 'other', url: (e && e.url) || '' }); }
    );
    return { ok: true };
  }

  return { startRun, startEngineRun, active: () => current, cancel: () => { if (current) current.cancel(); } };
}

module.exports = { createRunner };
