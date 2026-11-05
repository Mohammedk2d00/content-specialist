// UOWA Post Filler v0.1 - fills the open "Add Post" form from the approved draft on the clipboard.
// It never clicks the create button. URL, publish date, image and attachments stay manual.
(() => {
  'use strict';
  if (window.__uowaFiller) return;
  window.__uowaFiller = true;

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const norm = s => String(s == null ? '' : s).replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim().toLowerCase();
  const visible = e => !!(e && (e.offsetParent !== null || e.getClientRects().length));
  async function waitFor(fn, ms = 8000, step = 100) { const t0 = Date.now(); for (;;) { const v = fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await sleep(step); } }
  const ALT = { 'أخبار الكلية': ['College News'], 'College News': ['أخبار الكلية'] };
  const options = () => [...document.querySelectorAll('[role=option]')].filter(visible);

  function setValue(el, v) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function pressKey(el, k) {
    const c = k === 'Enter' ? 13 : 27;
    el.dispatchEvent(new KeyboardEvent('keydown', { key: k, code: k, keyCode: c, which: c, bubbles: true, cancelable: true }));
  }

  /* ---------- reading the approved draft ---------- */
  async function readClipboard(host) {
    try {
      const ta = document.createElement('textarea');
      ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      host.appendChild(ta); ta.focus();
      let ok = false; try { ok = document.execCommand('paste'); } catch (e) {}
      const v = ta.value; ta.remove();
      if (ok && v) return v;
    } catch (e) {}
    try { return await navigator.clipboard.readText(); } catch (e) { return ''; }
  }

  /* ---------- finding the form parts (by structure, not by language) ---------- */
  function locate(dlg) {
    const form = dlg.querySelector('form');
    const box = (form && form.querySelector('.overflow-auto')) || form;
    const panels = box ? [...box.children] : [];
    const basic = panels.find(p => p.querySelector('input[name=lang_id]'));
    const content = panels.find(p => p.querySelector('textarea[name=sub_content]'));
    const tagsP = panels.find(p => p !== basic && p !== content && p.querySelector('input[role=combobox]'));
    const langBox = basic && basic.querySelector('input[name=lang_id]').closest('.col-span-1');
    const catInput = basic && basic.querySelector('input[name=category_dep_id]');
    return {
      form, tabs: [...dlg.querySelectorAll('[role=tablist] button[role=tab]')],
      langBox, structBox: langBox && langBox.nextElementSibling, catBox: catInput && catInput.closest('.col-span-1'),
      title: form && form.querySelector('input[name=title]'), sub: form && form.querySelector('textarea[name=sub_content]'),
      editor: form && form.querySelector('.ProseMirror[contenteditable]'), tagsP,
      checks: basic ? [...basic.querySelectorAll('input[type=checkbox]')] : []
    };
  }

  /* ---------- react-select: open, type, pick the exact option ---------- */
  async function pick(box, candidates) {
    const input = box.querySelector('input[role=combobox]');
    const control = box.querySelector('[class*="-control"]');
    if (!input || !control) throw new Error('لم أجد القائمة المنسدلة');
    if (!(await waitFor(() => !input.disabled && control.getAttribute('aria-disabled') !== 'true', 10000))) throw new Error('الحقل ما زال معطلاً');
    let seen = [];
    for (const want of candidates) {
      input.focus();
      control.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, view: window }));
      await sleep(250);
      setValue(input, want);
      await sleep(350);
      const opts = (await waitFor(() => { const o = options(); return o.length ? o : null; }, 8000)) || [];
      const target = norm(want);
      let hit = opts.find(o => norm(o.textContent) === target), approx = false;
      if (!hit) {
        const near = opts.filter(o => { const t = norm(o.textContent); return t && (t.includes(target) || target.includes(t)); });
        if (near.length === 1) { hit = near[0]; approx = true; }
      }
      if (hit) { const text = hit.textContent.trim(); hit.click(); await sleep(450); return { text, approx }; }
      seen = opts.slice(0, 8).map(o => o.textContent.trim());
      pressKey(input, 'Escape'); setValue(input, ''); await sleep(300);
    }
    throw new Error('لم أجد «' + candidates[0] + '»' + (seen.length ? ' - الموجود: ' + seen.join('، ') : ' - القائمة فارغة'));
  }

  async function addTags(panel, tags, warn) {
    const input = panel.querySelector('input[role=combobox]');
    if (!input) throw new Error('لم أجد خانة الوسوم');
    const count = () => [...panel.querySelectorAll('*')].filter(e => typeof e.className === 'string' && /-multiValue(\s|$)/.test(e.className)).length;
    let added = 0;
    for (const tag of tags) {
      const before = count();
      input.focus(); setValue(input, tag); await sleep(350);
      const opts = (await waitFor(() => { const o = options(); return o.length ? o : null; }, 2500)) || [];
      const t = norm(tag);
      const hit = opts.find(o => norm(o.textContent) === t) || opts.find(o => /["'«»“”]/.test(o.textContent) && norm(o.textContent).includes(t));
      if (hit) hit.click();
      else if (opts.length <= 1) pressKey(input, 'Enter');
      else { warn('تعذر إضافة الوسم «' + tag + '» بدقة، أضفه يدوياً'); setValue(input, ''); continue; }
      await sleep(450);
      if (count() > before) added++; else warn('لم أتأكد من إضافة الوسم «' + tag + '»');
    }
    return added + ' من ' + tags.length;
  }

  /* ProseMirror/TipTap: simulate a paste of the HTML */
  async function fillEditor(ed, html) {
    const plain = html.replace(/<\/(p|h2|h3|li)>/gi, '\n').replace(/<[^>]+>/g, '').trim();
    ed.focus();
    try { document.execCommand('selectAll'); } catch (e) {}
    const dt = new DataTransfer(); dt.setData('text/html', html); dt.setData('text/plain', plain);
    ed.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    await sleep(500);
    if (!ed.textContent.trim()) {
      ed.focus(); try { document.execCommand('selectAll'); document.execCommand('insertHTML', false, html); } catch (e) {}
      await sleep(400);
    }
    const n = ed.textContent.trim().length;
    if (!n) throw new Error('المحرر بقي فارغاً');
    return n + ' حرفاً';
  }

  /* ---------- the one-click action ---------- */
  async function run(dlg, dry, ui) {
    const log = ui.log; ui.clear();
    const raw = await readClipboard(dlg);
    let post = null; try { post = JSON.parse(raw); } catch (e) {}
    if (!post || post.uowa_post !== 1) { log('✗ لا توجد مسودة معتمدة في الحافظة. افتح صفحة المسودة واضغط «تمت الموافقة» أولاً.', 'err'); return; }
    log('المسودة: ' + post.title + ' (' + post.language + ')', 'info');
    const R = locate(dlg);
    const parts = { 'تبويبات': R.tabs.length === 4, 'اللغة': !!R.langBox, 'الهيكل': !!R.structBox, 'القسم': !!R.catBox, 'العنوان': !!R.title, 'المحتوى الفرعي': !!R.sub, 'محرر المحتوى': !!R.editor, 'الوسوم': !!R.tagsP };
    const missing = Object.keys(parts).filter(k => !parts[k]);
    if (dry) {
      Object.keys(parts).forEach(k => log((parts[k] ? '✓ ' : '✗ ') + k, parts[k] ? 'ok' : 'err'));
      log('الهيكل المطلوب: ' + (post.structure_ar || post.structure || '(غير محدد)') + ' | القسم: ' + post.category + ' | وسوم: ' + (post.tags || []).length + ' | محتوى: ' + (post.content_html || '').length + ' حرفاً', 'info');
      log('فحص فقط: لم يتم تغيير أي شيء.', 'info'); return;
    }
    if (missing.length) { log('✗ لم أجد في النموذج: ' + missing.join('، ') + '. تغيّر شكل الصفحة؟ جرّب «فحص».', 'err'); return; }
    if (R.title.value.trim() && !confirm('النموذج يحتوي على بيانات. هل تريد استبدالها بالمسودة؟')) { log('أُلغي.', 'info'); return; }

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
  }

  /* ---------- the button, inside the Add Post window ---------- */
  function mk(tag, css, text) { const e = document.createElement(tag); if (css) e.style.cssText = css; if (text) e.textContent = text; return e; }
  function inject(dlg) {
    const form = dlg.querySelector('form'), header = form && form.previousElementSibling;
    if (!header || dlg.querySelector('[data-uowa]')) return;
    const colors = { ok: '#17744f', err: '#b42318', warn: '#9a6700', info: '#334155' };
    const strip = mk('div', 'display:none;max-height:150px;overflow:auto;padding:8px 20px;background:#fffbeb;border-bottom:1px solid #f0d58a;font-size:13px;line-height:1.7;direction:rtl');
    const ui = {
      clear() { strip.textContent = ''; strip.style.display = 'block'; },
      log(msg, kind) { const d = mk('div', 'color:' + (colors[kind] || colors.info), msg); strip.appendChild(d); strip.scrollTop = strip.scrollHeight; }
    };
    const wrap = mk('div', 'display:flex;gap:8px;align-items:center;margin-inline-start:auto');
    wrap.setAttribute('data-uowa', '1');
    const fill = mk('button', 'background:#f5b800;color:#14264f;border:2px solid #d99f00;border-radius:8px;padding:6px 14px;font-weight:800;cursor:pointer', '⚡ ملء من المسودة');
    const dry = mk('button', 'background:#fff;color:#334155;border:1px solid #cbd5e1;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:12px', 'فحص');
    fill.type = dry.type = 'button';
    let busy = false;
    const go = isDry => async () => { if (busy) return; busy = true; fill.disabled = dry.disabled = true; try { await run(dlg, isDry, ui); } catch (e) { ui.log('✗ خطأ غير متوقع: ' + e.message, 'err'); } busy = false; fill.disabled = dry.disabled = false; };
    fill.addEventListener('click', go(false)); dry.addEventListener('click', go(true));
    wrap.append(fill, dry); header.appendChild(wrap);
    form.parentElement.insertBefore(strip, form);
  }
  function check() {
    const dlg = document.querySelector('[role=dialog]');
    if (!dlg || !dlg.querySelector('form input[name=title]')) return;
    const form = dlg.querySelector('form'), header = form.previousElementSibling;
    if (header && /إضافة|Add/.test(header.textContent) && !dlg.querySelector('[data-uowa]')) inject(dlg);
  }
  let queued = false;
  new MutationObserver(() => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; check(); }); }).observe(document.body, { childList: true, subtree: true });
  check();
})();
