// Browser stand-in for Node's path: enough for the shared checks, whose paths only matter by file name (see fs.js).
const join = (...parts) => parts.filter(Boolean).join('/');
const basename = p => String(p).split(/[\\/]/).pop();
const dirname = p => String(p).split(/[\\/]/).slice(0, -1).join('/') || '.';
module.exports = { join, basename, dirname };
