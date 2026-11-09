// Open a file in the default browser without waiting for it. Prints a hint when that is not possible.
const spawn = require('child_process').spawn;

module.exports = function openInBrowser(abs) {
  const opener = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', abs]]
               : process.platform === 'darwin' ? ['open', [abs]]
               : ['xdg-open', [abs]];
  try {
    const child = spawn(opener[0], opener[1], { detached: true, stdio: 'ignore' });
    child.on('error', function () { console.log('Could not open the browser automatically. Open this file by hand: ' + abs); });
    child.unref();
  } catch (e) { console.log('Could not open the browser automatically. Open this file by hand: ' + abs); }
};
