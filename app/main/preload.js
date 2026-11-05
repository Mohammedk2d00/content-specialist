const { contextBridge, ipcRenderer } = require('electron');
const inv = (c, a) => ipcRenderer.invoke(c, a);
contextBridge.exposeInMainWorld('api', {
  status: () => inv('status'),
  listDrafts: () => inv('drafts:list'),
  openDraft: name => inv('drafts:open', name),
  createPost: text => inv('post:create', text),
  learn: () => inv('learn'),
  cancel: () => inv('run:cancel'),
  importEdits: () => inv('edits:import'),
  openTerminal: () => inv('terminal:open'),
  openFolder: () => inv('folder:open'),
  openExtension: () => inv('extension:open'),
  installGemini: () => inv('install:gemini'),
  installNode: () => inv('install:node'),
  saveKey: k => inv('key:save', k),
  clearKey: () => inv('key:clear'),
  testKey: () => inv('key:test'),
  setEngine: v => inv('engine:set', v),
  openUrl: u => inv('open:url', u),
  onStart: cb => ipcRenderer.on('run:start', (_e, d) => cb(d)),
  onLog: cb => ipcRenderer.on('run:log', (_e, d) => cb(d)),
  onDone: cb => ipcRenderer.on('run:done', (_e, d) => cb(d))
});
