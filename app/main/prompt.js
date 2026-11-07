// The system prompt for API mode: every rule file of the workspace in one text (GEMINI.md, style guide,
// examples, sample JSON, allowlist, dashboard lists and, optionally, the humanizer skills).
const fs = require('node:fs');
const path = require('node:path');
const { readText } = require('./lib.js');

function listBlock(ws) {
  let d; try { d = JSON.parse(readText(ws, 'dashboard-lists.json')); } catch (e) { return ''; }
  const s = (d.structures || []).map(x => (x.en || '(none in the dashboard)') + ' | ' + (x.ar || '')).join('\n');
  const names = l => ((d.categories || {})[l] || []).map(c => c.name).filter(n => n && !/\[CHECK/.test(n)).join('\n');
  return '## Dashboard lists (copy names EXACTLY as written; this replaces running lookup.js)\n### Structures (English | Arabic)\n' + s +
    '\n### Category Dep names, English posts\n' + names('en') + '\n### Category Dep names, Arabic posts\n' + names('ar') + '\n';
}

function systemPrompt(ws, o) {
  const ex = (() => { try { return fs.readdirSync(path.join(ws, 'examples')).filter(f => f.endsWith('.md')).sort().map(f => '### examples/' + f + '\n' + readText(ws, 'examples/' + f)).join('\n'); } catch (e) { return ''; } })();
  let p = 'You are the Content Specialist engine of the UOWA project, running in API mode. You have NO tools: you cannot read files, run commands or ask questions. Everything you need is below.\n' +
    'Reply with ONE JSON object only (the draft data file described in GEMINI.md under "JSON format"). No text before or after it, no code fences.\n' +
    'Where the project files say to read files, run lookup.js, run the build command, fix warnings, ask a question, or give a short reply, ignore that: the app does it. If no college or unit can be worked out, use the closest Structure and list it under "Choices to confirm" in review and review_ar.\n' +
    'Use today\'s date from the user message for "created". Never output a slug or any key that is not in the JSON format.\n\n' +
    '# GEMINI.md\n' + readText(ws, 'GEMINI.md') + '\n\n# style-guide.md\n' + readText(ws, 'style-guide.md') + '\n\n# examples\n' + ex + '\n\n# sample-draft.json (copy this shape)\n' + readText(ws, 'sample-draft.json') +
    '\n\n# latin-allowlist.txt\n' + readText(ws, 'latin-allowlist.txt') + '\n\n' + listBlock(ws);
  if (o.humanizer) {
    const ar = readText(ws, '.gemini/skills/humanizer-ar-msa/SKILL.md'), en = readText(ws, '.gemini/skills/humanizer/SKILL.md');
    if (ar) p += '\n# Writing skill for the ARABIC post (apply silently while writing; do not mention it)\n' + ar + '\n';
    if (en) p += '\n# Writing skill for the ENGLISH post (apply silently while writing; do not mention it)\n' + en + '\n';
  }
  return p;
}

module.exports = { systemPrompt };
