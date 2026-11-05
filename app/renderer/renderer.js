const T = {
  en: {
    title: 'UOWA Content Specialist',
    newPost: 'New post', placeholder: 'Type the post title or topic, and any facts you have.\nExample: Blood donation campaign at the College of Nursing',
    create: 'Create draft', cancel: 'Cancel', drafts: 'Drafts', noDrafts: 'No drafts yet. Create your first one above.',
    tools: 'Tools', importEdits: 'Import my edits', learn: 'Learn from my edits', terminal: 'Sign in / first run (terminal)',
    folder: 'Open project folder', ext: 'Open extension folder',
    firstRun: 'Classic engine only: click "Sign in / first run" once, sign in with Google in the terminal, and trust the folder.',
    open: 'Open', edited: 'edited', fresh: 'new',
    setupTitle: 'Setup needed (Classic engine)', setupText: 'The Classic engine needs Node.js and the Gemini CLI. Install what is missing, then restart this app. The Fast engine does not need either.',
    installNode: 'Install Node.js', installGemini: 'Install Gemini CLI',
    working: 'Working... this can take a minute or two.', done: 'Finished.', failed: 'Something went wrong. See the log.',
    cancelled: 'Cancelled.', busy: 'Another task is still running.', empty: 'Write a title or topic first.',
    created: 'New draft ready (the page opens in your browser): ', warnDone: 'Draft created with {n} warning(s) listed on the page under "Choices to confirm". The page opens in your browser.',
    importedN: 'Imported edits: ', none: 'none',
    node: 'Node.js', gemini: 'Gemini CLI', missing: 'missing', ws: 'Folder', model: 'Model', engine: 'Engine', fast: 'Fast', classic: 'Classic', key: 'Key', kSaved: 'saved', kEnv: 'from Windows settings', kNone: 'none',
    conn: 'Connection', engineLabel: 'Engine', engDirect: 'Fast (direct API) - recommended', engCli: 'Classic (Gemini CLI)',
    keyPh: 'Paste your Gemini API key', keySave: 'Save key', keyTest: 'Test key', keyClear: 'Remove key', openLink: 'Open the Google page',
    keyNone: 'No API key yet. Create one in Google AI Studio (aistudio.google.com/api-keys) with "Create API key", then paste it here. It is stored only on this computer.',
    keySavedState: 'A key is saved on this computer.', keyEnvState: 'Using the GEMINI_API_KEY set in the system. You can also save a key here.',
    keySavedOk: 'Key saved. Press "Test key" to check it.', keyBad: 'That does not look like a valid key.', testing: 'Testing...', testOk: 'Key works. Answered in {s}s by {m}.',
    err_api_disabled: 'The Gemini API is switched off for the Google project of this key. Open the Google page with the button below, press Enable, wait a few minutes and try again. If you cannot enable it, ask your Google Workspace admin, or create a new key in AI Studio with "Create API key".',
    err_free_tier: 'Google says the free tier is not available for this key\'s project. Set up billing for the project, or use a key from another Google account or project.',
    err_bad_key: 'Google does not accept this key. Create a new key in AI Studio and save it again.',
    err_denied: 'Google refused the request (permission denied). Check the key, and that the Gemini API is enabled for its project.',
    err_rate: 'Too many requests right now (rate limit). Wait a minute and try again.',
    err_busy: 'Google\'s servers are busy. The app already retried and tried the backup model. Try again in a few minutes.',
    err_timeout: 'Google did not answer in time, even after retries. Try again in a few minutes.',
    err_network: 'Could not reach Google. Check the internet connection.',
    err_model_missing: 'This key cannot use the chosen model. Change the first line of model.txt.',
    err_bad_output: 'The model did not return a usable draft. Try again.',
    err_nokey: 'Save an API key first (Connection section).',
    err_other: 'Something went wrong. See the log.'
  },
  ar: {
    title: 'مختص المحتوى - جامعة وارث الأنبياء',
    newPost: 'منشور جديد', placeholder: 'اكتب عنوان المنشور أو موضوعه وأي معلومات لديك.\nمثال: حملة التبرع بالدم في كلية التمريض',
    create: 'إنشاء مسودة', cancel: 'إلغاء', drafts: 'المسودات', noDrafts: 'لا توجد مسودات بعد. أنشئ أول مسودة من الأعلى.',
    tools: 'أدوات', importEdits: 'استيراد تعديلاتي', learn: 'التعلم من تعديلاتي', terminal: 'تسجيل الدخول / التشغيل الأول (الطرفية)',
    folder: 'فتح مجلد المشروع', ext: 'فتح مجلد الإضافة',
    firstRun: 'للمحرك الكلاسيكي فقط: اضغط "تسجيل الدخول / التشغيل الأول" مرة واحدة، وسجّل الدخول بحساب Google في الطرفية، ووافق على الوثوق بالمجلد.',
    open: 'فتح', edited: 'معدّلة', fresh: 'جديدة',
    setupTitle: 'يلزم الإعداد (المحرك الكلاسيكي)', setupText: 'يحتاج المحرك الكلاسيكي إلى Node.js وإلى Gemini CLI. ثبّت ما هو ناقص ثم أعد تشغيل التطبيق. المحرك السريع لا يحتاج إلى أيٍّ منهما.',
    installNode: 'تثبيت Node.js', installGemini: 'تثبيت Gemini CLI',
    working: 'جارٍ العمل... قد يستغرق دقيقة أو دقيقتين.', done: 'اكتمل.', failed: 'حدث خطأ. راجع السجل.',
    cancelled: 'تم الإلغاء.', busy: 'مهمة أخرى ما زالت قيد التنفيذ.', empty: 'اكتب عنواناً أو موضوعاً أولاً.',
    created: 'المسودة الجديدة جاهزة (تُفتح الصفحة في المتصفح): ', warnDone: 'تم إنشاء المسودة مع {n} تحذير مدرج في الصفحة ضمن "أمور للتأكيد". تُفتح الصفحة في المتصفح.',
    importedN: 'التعديلات المستوردة: ', none: 'لا شيء',
    node: 'Node.js', gemini: 'Gemini CLI', missing: 'غير مثبت', ws: 'المجلد', model: 'النموذج', engine: 'المحرك', fast: 'سريع', classic: 'كلاسيكي', key: 'المفتاح', kSaved: 'محفوظ', kEnv: 'من إعدادات النظام', kNone: 'لا يوجد',
    conn: 'الاتصال', engineLabel: 'المحرك', engDirect: 'سريع (واجهة API مباشرة) - موصى به', engCli: 'كلاسيكي (Gemini CLI)',
    keyPh: 'الصق مفتاح Gemini API', keySave: 'حفظ المفتاح', keyTest: 'اختبار المفتاح', keyClear: 'حذف المفتاح', openLink: 'فتح صفحة Google',
    keyNone: 'لا يوجد مفتاح بعد. أنشئ مفتاحاً في Google AI Studio (aistudio.google.com/api-keys) عبر "Create API key" ثم الصقه هنا. يُحفظ على هذا الجهاز فقط.',
    keySavedState: 'يوجد مفتاح محفوظ على هذا الجهاز.', keyEnvState: 'يُستخدم GEMINI_API_KEY المضبوط في النظام. يمكنك أيضاً حفظ مفتاح هنا.',
    keySavedOk: 'تم حفظ المفتاح. اضغط "اختبار المفتاح" للتحقق منه.', keyBad: 'هذا لا يبدو مفتاحاً صالحاً.', testing: 'جارٍ الاختبار...', testOk: 'المفتاح يعمل. جاءت الإجابة خلال {s} ثانية من {m}.',
    err_api_disabled: 'واجهة Gemini API معطّلة في مشروع Google الخاص بهذا المفتاح. افتح صفحة Google بالزر أدناه، واضغط Enable، وانتظر بضع دقائق ثم أعد المحاولة. إذا تعذّر التفعيل فاطلب من مسؤول Google Workspace، أو أنشئ مفتاحاً جديداً في AI Studio عبر "Create API key".',
    err_free_tier: 'تفيد Google بأن الطبقة المجانية غير متاحة لمشروع هذا المفتاح. فعّل الفوترة للمشروع، أو استخدم مفتاحاً من حساب أو مشروع آخر.',
    err_bad_key: 'لا تقبل Google هذا المفتاح. أنشئ مفتاحاً جديداً في AI Studio واحفظه من جديد.',
    err_denied: 'رفضت Google الطلب (لا توجد صلاحية). تحقق من المفتاح ومن تفعيل Gemini API في مشروعه.',
    err_rate: 'عدد الطلبات كبير الآن (حد المعدل). انتظر دقيقة ثم أعد المحاولة.',
    err_busy: 'خوادم Google مشغولة. أعاد التطبيق المحاولة وجرّب النموذج الاحتياطي. حاول بعد بضع دقائق.',
    err_timeout: 'لم تجب Google في الوقت المناسب حتى بعد إعادة المحاولة. حاول بعد بضع دقائق.',
    err_network: 'تعذّر الوصول إلى Google. تحقق من اتصال الإنترنت.',
    err_model_missing: 'لا يستطيع هذا المفتاح استخدام النموذج المختار. غيّر السطر الأول في model.txt.',
    err_bad_output: 'لم يُرجع النموذج مسودة صالحة. حاول مرة أخرى.',
    err_nokey: 'احفظ مفتاح API أولاً (قسم الاتصال).',
    err_other: 'حدث خطأ. راجع السجل.'
  }
};

const $ = id => document.getElementById(id);
let lang = localStorage.getItem('lang') || 'en';
let status = null, drafts = [], fresh = new Set(), running = false, lastUrl = '';
const t = (k, v) => { let s = (T[lang] && T[lang][k]) || T.en[k] || k; if (v) Object.keys(v).forEach(x => { s = s.replace('{' + x + '}', v[x]); }); return s; };
const errText = code => t('err_' + code) === 'err_' + code ? t('err_other') : t('err_' + code);

function applyLang() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  $('lang').textContent = lang === 'ar' ? 'English' : 'العربية';
  renderDrafts(); renderStatus(); renderKeyState();
}

function setState(msg) { $('state').textContent = msg || ''; }
function setLink(url) { lastUrl = url || ''; $('openLink').hidden = !lastUrl; }
function setRunning(on) {
  running = on;
  ['create', 'importEdits', 'learn', 'btnNode', 'btnGemini', 'keyTest'].forEach(id => { $(id).disabled = on; });
  $('cancel').hidden = !on;
  document.querySelectorAll('.draft button').forEach(b => { b.disabled = on; });
}

function renderKeyState(msg) {
  const el = $('keyState');
  if (msg) { el.textContent = msg; return; }
  if (!status) { el.textContent = ''; return; }
  el.textContent = status.key === 'saved' ? t('keySavedState') : status.key === 'env' ? t('keyEnvState') : t('keyNone');
}

function renderStatus() {
  const f = $('chips'); f.textContent = '';
  if (!status) return;
  const chip = (label, ok) => { const s = document.createElement('span'); s.className = 'chip' + (ok === undefined ? '' : ok ? ' ok' : ' bad'); s.textContent = label; f.appendChild(s); };
  const direct = status.engine === 'direct';
  chip(t('engine') + ': ' + (direct ? t('fast') : t('classic')));
  chip(t('model') + ': ' + status.model);
  if (direct) chip(t('key') + ': ' + (status.key === 'saved' ? t('kSaved') : status.key === 'env' ? t('kEnv') : t('kNone')), status.key !== 'none');
  else { chip(t('node') + ': ' + (status.node || t('missing')), !!status.node); chip(t('gemini') + ': ' + (status.gemini || t('missing')), !!status.gemini); }
  const w = document.createElement('span'); w.className = 'chip'; w.dir = 'ltr'; w.textContent = t('ws') + ': ' + status.workspace; f.appendChild(w);
  $('engine').value = status.engine;
  const needSetup = !direct && !(status.node && status.gemini);
  $('setup').hidden = !needSetup;
  $('btnNode').hidden = !!status.node;
  $('btnGemini').hidden = !!status.gemini || !status.node;
  $('terminal').hidden = direct; $('firstRun').hidden = direct;
}

function renderDrafts() {
  const box = $('drafts'); box.textContent = '';
  if (!drafts.length) { const p = document.createElement('p'); p.className = 'empty'; p.textContent = t('noDrafts'); box.appendChild(p); return; }
  drafts.forEach(d => {
    const row = document.createElement('div'); row.className = 'draft';
    const info = document.createElement('div'); info.className = 'info';
    const title = document.createElement('div'); title.className = 't';
    title.textContent = (lang === 'ar' && d.titleAr) ? d.titleAr : d.title;
    if (fresh.has(d.name)) { const b = document.createElement('span'); b.className = 'badge new'; b.textContent = t('fresh'); title.appendChild(b); }
    if (d.hasEdited) { const b = document.createElement('span'); b.className = 'badge edited'; b.textContent = t('edited'); title.appendChild(b); }
    const sub = document.createElement('div'); sub.className = 's'; sub.dir = 'ltr'; sub.textContent = [d.created, d.name].filter(Boolean).join('  ·  ');
    info.appendChild(title); info.appendChild(sub);
    const btn = document.createElement('button'); btn.textContent = t('open'); btn.disabled = running;
    btn.addEventListener('click', () => window.api.openDraft(d.name));
    row.appendChild(info); row.appendChild(btn); box.appendChild(row);
  });
}

async function refresh() { drafts = await window.api.listDrafts(); renderDrafts(); }
async function refreshStatus() { status = await window.api.status(); renderStatus(); renderKeyState(); }
function appendLog(s) { const l = $('log'); l.hidden = false; l.textContent += s; l.scrollTop = l.scrollHeight; }

async function startAndHandle(p) {
  const r = await p;
  if (r && r.ok === false) { if (r.error === 'busy') setState(t('busy')); else if (r.error === 'nokey') setState(t('err_nokey')); }
}

$('lang').addEventListener('click', () => { lang = lang === 'en' ? 'ar' : 'en'; localStorage.setItem('lang', lang); applyLang(); });
$('create').addEventListener('click', () => { const v = $('req').value.trim(); if (!v) { setState(t('empty')); return; } $('log').textContent = ''; setLink(''); startAndHandle(window.api.createPost(v)); });
$('cancel').addEventListener('click', () => window.api.cancel());
$('learn').addEventListener('click', () => { $('log').textContent = ''; setLink(''); startAndHandle(window.api.learn()); });
$('importEdits').addEventListener('click', async () => { const r = await window.api.importEdits(); setState(t('importedN') + (r.moved.length ? r.moved.length : t('none'))); refresh(); });
$('terminal').addEventListener('click', () => window.api.openTerminal());
$('folder').addEventListener('click', () => window.api.openFolder());
$('ext').addEventListener('click', () => window.api.openExtension());
$('btnNode').addEventListener('click', () => { $('log').textContent = ''; startAndHandle(window.api.installNode()); });
$('btnGemini').addEventListener('click', () => { $('log').textContent = ''; startAndHandle(window.api.installGemini()); });
$('openLink').addEventListener('click', () => { if (lastUrl) window.api.openUrl(lastUrl); });
$('engine').addEventListener('change', async () => { await window.api.setEngine($('engine').value); refreshStatus(); });

$('keySave').addEventListener('click', async () => {
  const r = await window.api.saveKey($('key').value);
  if (r.ok) { $('key').value = ''; setLink(''); await refreshStatus(); renderKeyState(t('keySavedOk')); } else renderKeyState(t('keyBad'));
});
$('keyClear').addEventListener('click', async () => { await window.api.clearKey(); setLink(''); await refreshStatus(); });
$('keyTest').addEventListener('click', async () => {
  renderKeyState(t('testing')); setLink('');
  const r = await window.api.testKey();
  if (r.ok) renderKeyState(t('testOk', { s: (r.ms / 1000).toFixed(1), m: r.model }));
  else { renderKeyState(errText(r.code)); setLink(r.url); }
});

window.api.onStart(() => { setRunning(true); setState(t('working')); });
window.api.onLog(appendLog);
window.api.onDone(async d => {
  setRunning(false);
  if (d.cancelled) setState(t('cancelled'));
  else if (d.code === 0) setState(d.warnings ? t('warnDone', { n: d.warnings }) : d.created.length ? t('created') + d.created.join(', ') : t('done'));
  else { setState(d.errorCode ? errText(d.errorCode) : t('failed')); setLink(d.url); }
  d.created.forEach(n => fresh.add(n));
  await refresh();
  if (d.kind === 'install') refreshStatus();
});

applyLang();
refresh();
refreshStatus();
