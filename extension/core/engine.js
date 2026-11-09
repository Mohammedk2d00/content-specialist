// Writes one draft: one request to Gemini, then the same checks as build.js, sending any problems back
// to the model up to `repairs` times. Ported from the desktop app's Fast engine; saves to browser storage.
const { ApiError, generate, testKey, withDefaults, DEFAULTS } = require('./gemini-api.js');
const { systemPrompt } = require('./prompt.js');
const { parseJson, slugify, today, problemsText } = require('./draft-json.js');
const store = require('./store.js');

// Loaded on first use: the shared checks read rule files that rules.js preloads (see shims/fs.js).
const runChecks = data => require('../../shared/checks/index.js')(data);

async function freeId(date, title) {
  const base = date + '_' + slugify(title);
  let id = base, n = 2;
  while (await store.draftExists(id)) id = base + '-' + (n++);
  return id;
}

// opts: apiKey, signal, log(text), step(name, info) plus any gemini-api option.
// Returns {id, draft, warnings, repairs}; the draft is saved even when warnings remain.
async function createDraft(requestText, opts) {
  const o = withDefaults(opts);
  const step = o.step || (() => {});
  const system = await systemPrompt(o);
  const date = today();
  const contents = [{ role: 'user', parts: [{ text: 'Today is ' + date + '.\nThe owner\'s request:\n\n' + String(requestText).trim() + '\n\nReturn the draft JSON now.' }] }];
  step('writing');
  let lastText = (await generate(o, system, contents)).text;
  let problems = '';
  for (let round = 0; round <= o.repairs; round++) {
    step('checking');
    let data = null, result = null;
    try { data = parseJson(lastText); } catch (e) { problems = 'Your answer was not valid JSON (' + e.message + '). Return the complete JSON object only.'; }
    if (data) {
      if (!data.created) data.created = date;
      result = runChecks(data);
      problems = problemsText(result);
      const last = round === o.repairs;
      if (!problems || (last && !result.errors.length)) {
        const id = await freeId(date, data.request_title);
        await store.saveDraft({ id, created: data.created, data, warnings: result.warnings });
        o.log(problems ? 'Saved with ' + result.warnings.length + ' warning(s) the model could not fix.\n' : 'Checks passed with no warnings.\n');
        return { id, draft: data, warnings: result.warnings, repairs: round };
      }
    }
    o.log('Checks found problems:\n' + problems + '\n');
    if (round === o.repairs) break;
    step('fixing', { n: round + 1, of: o.repairs });
    contents.push({ role: 'model', parts: [{ text: lastText }] });
    contents.push({ role: 'user', parts: [{ text: 'The build check reported these problems. Fix every one and return the complete corrected JSON object only:\n\n' + problems }] });
    lastText = (await generate(o, system, contents)).text;
  }
  throw new ApiError('bad_output', problems);
}

module.exports = { createDraft, testKey, ApiError, DEFAULTS };
