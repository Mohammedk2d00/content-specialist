// Browser stand-in for Node's fs. The shared checks (utils/text.js, lists.js) read rule files with
// fs.readFileSync; core/rules.js preloads those files here, so the checks run unchanged in the extension.
const files = {};
const base = p => String(p).split(/[\\/]/).pop();

module.exports = {
  preload(name, text) { files[base(name)] = text; },
  readFileSync(p) {
    const k = base(p);
    if (!(k in files)) throw new Error('File not bundled in the extension: ' + k);
    return files[k];
  },
  existsSync: p => base(p) in files
};
