// Anti-hallucination checks: numbers and titled names must come from the owner's request (source_facts).
const AR = require('../utils/arabic.js');
const strip = require('../utils/text.js').strip;

module.exports = function (ctx) {
  const data = ctx.data, posts = ctx.posts, warnings = ctx.warnings;
  // ---- anti-hallucination: numbers and titled names must come from the owner's request ----
  if (!Array.isArray(data.source_facts)) {
    warnings.push('"source_facts" is missing. Copy every fact the owner gave (names with titles, numbers, dates, places) into it, word for word; use [] if the owner gave only a title.');
  } else {
    const nz = function (x) { return AR.foldLetters(AR.stripMarks(AR.westDigits(strip(x)))).toLowerCase(); };
    const src = nz([].concat(data.source_facts, data.request_title || '', data.request_title_ar || '').join(' '));
    const srcNums = src.match(/\d+/g) || [];
    const srcWords = {};
    src.split(/[^\p{L}\p{N}]+/u).forEach(function (t) { if (t) srcWords[t] = 1; });
    const STOP_EN = /^(assistant|associate|dean|head|director|vice|deputy|president|chair|lecturer|college|university|department|deanship|of|the|and)$/i;
    const STOP_AR = /^(في|من|على|الى|إلى|عن|معاون|عميد|رئيس|مدير|الكلية|الجامعة|الاستاذ|الأستاذ|المساعد|السيد|السيدة|الدكتور|الدكتورة|الذي|التي|وعميد|وكيل|مساعد)$/;
    posts.forEach(function (p, i) {
      const w = 'posts[' + i + ']', orig = strip(p.title + ' ' + p.sub_content + ' ' + p.content_html), seen = {};
      (nz(orig).match(/\d+/g) || []).forEach(function (n) {
        if (srcNums.indexOf(n) < 0 && !seen[n]) { seen[n] = 1; warnings.push(w + ' has the number "' + n + '" which is not in source_facts or the request title. Remove it, or add it to source_facts only if the owner gave it.'); }
      });
      const names = [], reEn = /\b(?:Dr|Prof|Professor|Eng)\.?\s+((?:[A-Z][A-Za-z'-]+\s?){1,3})/g, reAr = /(?:\u0627\u0644\u062F\u0643\u062A\u0648\u0631\u0629|\u0627\u0644\u062F\u0643\u062A\u0648\u0631|\u062F\.)\s+([\u0600-\u06FF]+(?:\s+[\u0600-\u06FF]+){0,2})/g;
      let m;
      while ((m = reEn.exec(orig))) m[1].trim().split(/\s+/).filter(function (t) { return !STOP_EN.test(t); }).slice(0, 2).forEach(function (t) { names.push(t); });
      while ((m = reAr.exec(orig))) m[1].trim().split(/\s+/).filter(function (t) { return !STOP_AR.test(t); }).slice(0, 2).forEach(function (t) { names.push(t); });
      names.forEach(function (t) {
        const k = nz(t).replace(/^\u0648(?=.{3,})/, '');
        if (!srcWords[nz(t)] && !srcWords[k] && !seen['n' + k]) { seen['n' + k] = 1; warnings.push(w + ' names "' + t + '" after a title, but that name is not in source_facts or the request title. Never invent names.'); }
      });
    });
  }
};
