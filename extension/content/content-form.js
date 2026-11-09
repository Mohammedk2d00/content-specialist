// Dashboard form helpers for content.js: find the Add Post form parts and type into its react-select
// dropdowns, tag box and ProseMirror editor. Split out so each file stays small; loaded before content.js.
(() => {
  'use strict';
  if (window.UOWA_FORM) return;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const norm = s => String(s == null ? '' : s).replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim().toLowerCase();
  const visible = e => !!(e && (e.offsetParent !== null || e.getClientRects().length));
  async function waitFor(fn, ms = 8000, step = 100) { const t0 = Date.now(); for (;;) { const v = fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await sleep(step); } }
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

  window.UOWA_FORM = { sleep, setValue, locate, pick, addTags, fillEditor };
})();
