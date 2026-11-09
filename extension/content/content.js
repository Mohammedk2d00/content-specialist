// Fills the open "Add Post" form with an approved post sent by the side panel (message 'uowa-fill').
// It never clicks the create button. URL, publish date, image and attachments stay manual.
(() => {
  'use strict';
  if (window.__uowaFiller) return;
  window.__uowaFiller = true;

  const { sleep, setValue, locate, pick, addTags, fillEditor } = window.UOWA_FORM;
  const ALT = { 'أخبار الكلية': ['College News'], 'College News': ['أخبار الكلية'] };

  /* ---------- the one-click action ---------- */
  async function run(dlg, dry, ui, post) {
    const log = ui.log; ui.clear();
    if (!post || post.uowa_post !== 1) { log('✗ لم تصل مسودة معتمدة.', 'err'); return { ok: false, error: 'nopost' }; }
    log('المسودة: ' + post.title + ' (' + post.language + ')', 'info');
    const R = locate(dlg);
    const parts = { 'تبويبات': R.tabs.length === 4, 'اللغة': !!R.langBox, 'الهيكل': !!R.structBox, 'القسم': !!R.catBox, 'العنوان': !!R.title, 'المحتوى الفرعي': !!R.sub, 'محرر المحتوى': !!R.editor, 'الوسوم': !!R.tagsP };
    const missing = Object.keys(parts).filter(k => !parts[k]);
    if (dry) {
      Object.keys(parts).forEach(k => log((parts[k] ? '✓ ' : '✗ ') + k, parts[k] ? 'ok' : 'err'));
      log('الهيكل المطلوب: ' + (post.structure_ar || post.structure || '(غير محدد)') + ' | القسم: ' + post.category + ' | وسوم: ' + (post.tags || []).length + ' | محتوى: ' + (post.content_html || '').length + ' حرفاً', 'info');
      log('فحص فقط: لم يتم تغيير أي شيء.', 'info'); return { ok: !missing.length, missing };
    }
    if (missing.length) { log('✗ لم أجد في النموذج: ' + missing.join('، ') + '. تغيّر شكل الصفحة؟', 'err'); return { ok: false, error: 'layout', missing }; }
    if (R.title.value.trim() && !confirm('النموذج يحتوي على بيانات. هل تريد استبدالها بالمسودة؟')) { log('أُلغي.', 'info'); return { ok: false, error: 'cancelled' }; }

    const block = e => { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); };
    window.addEventListener('submit', block, true);
    let fails = 0;
    const step = async (name, fn) => { try { const r = await fn(); log('✓ ' + name + (r ? ': ' + r : ''), 'ok'); } catch (e) { fails++; log('✗ ' + name + ': ' + e.message, 'err'); } };
    const goTab = async i => { R.tabs[i].click(); await sleep(500); };
    try {
      await goTab(0);
      await step('اللغة', async () => { const r = await pick(R.langBox, [post.language]); return r.text + (r.approx ? ' ⚠ تطابق تقريبي' : ''); });
      await step('الهيكل', async () => { const r = await pick(R.structBox, [post.structure_ar, post.structure].filter(Boolean)); return r.text + (r.approx ? ' ⚠ تطابق تقريبي، تحقق منه' : ''); });
      await step('القسم', async () => { const r = await pick(R.catBox, [post.category].concat(ALT[post.category] || [])); return r.text + (r.approx ? ' ⚠ تطابق تقريبي، تحقق منه' : ''); });
      await step('العنوان', async () => { setValue(R.title, post.title); return ''; });
      await step('الخيارات', async () => {
        const want = [post.show_published_at !== false, post.active !== false];
        want.forEach((w, i) => { if (R.checks[i] && R.checks[i].checked !== w) R.checks[i].click(); });
        return 'إظهار تاريخ النشر / نشط';
      });
      await goTab(1);
      if (post.sub_content) await step('المحتوى الفرعي', async () => { setValue(R.sub, post.sub_content); return ''; });
      if (post.content_html) await step('المحتوى', () => fillEditor(R.editor, post.content_html));
      if ((post.tags || []).length) { await goTab(2); await step('الوسوم', () => addTags(R.tagsP, post.tags, m => log('⚠ ' + m, 'warn'))); }
      await goTab(0);
    } finally { window.removeEventListener('submit', block, true); }
    log(fails ? 'انتهى مع ' + fails + ' خطأ. أكمل الحقول المعلّمة بـ ✗ يدوياً.' : 'انتهى بنجاح.', fails ? 'warn' : 'ok');
    log('عليك: الرابط، تاريخ النشر، الصورة، المرفقات، ثم اضغط «إنشاء» بنفسك.', 'info');
    return { ok: true, fails };
  }

  /* ---------- the log strip inside the Add Post window, driven by the side panel ---------- */
  function mk(tag, css, text) { const e = document.createElement(tag); if (css) e.style.cssText = css; if (text) e.textContent = text; return e; }
  function logStrip(dlg) {
    const form = dlg.querySelector('form');
    let strip = dlg.querySelector('[data-uowa]');
    if (!strip) {
      strip = mk('div', 'display:none;max-height:150px;overflow:auto;padding:8px 20px;background:#fffbeb;border-bottom:1px solid #f0d58a;font-size:13px;line-height:1.7;direction:rtl');
      strip.setAttribute('data-uowa', '1');
      form.parentElement.insertBefore(strip, form);
    }
    const colors = { ok: '#17744f', err: '#b42318', warn: '#9a6700', info: '#334155' };
    return {
      clear() { strip.textContent = ''; strip.style.display = 'block'; },
      log(msg, kind) { strip.appendChild(mk('div', 'color:' + (colors[kind] || colors.info), msg)); strip.scrollTop = strip.scrollHeight; }
    };
  }
  function addPostDialog() {
    const dlg = document.querySelector('[role=dialog]');
    return dlg && dlg.querySelector('form input[name=title]') ? dlg : null;
  }
  let busy = false;
  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (!msg || (msg.type !== 'uowa-fill' && msg.type !== 'uowa-check')) return;
    const dlg = addPostDialog();
    if (!dlg) { reply({ ok: false, error: 'noform' }); return; }
    if (busy) { reply({ ok: false, error: 'busy' }); return; }
    busy = true;
    run(dlg, msg.type === 'uowa-check', logStrip(dlg), msg.post)
      .catch(e => ({ ok: false, error: 'other', message: e.message }))
      .then(r => { busy = false; reply(r); });
    return true; // reply comes later
  });
})();
