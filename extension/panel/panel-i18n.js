// Side panel words in Arabic and English, kept apart so the logic files stay small.
// Error texts (err_*) are the ones the desktop app used, for the same Gemini error codes.
const S = require('./panel-strings.js');

let lang = 'ar';
const setLang = l => { lang = l === 'en' ? 'en' : 'ar'; };
const getLang = () => lang;

function t(k, v) {
  let s = (S[lang] && S[lang][k]) || S.en[k] || k;
  if (v) Object.keys(v).forEach(x => { s = s.replace('{' + x + '}', v[x]); });
  return s;
}
const errText = code => (S.en['err_' + code] ? t('err_' + code) : t('err_other'));

// Fill every [data-i18n] text and [data-i18n-ph] placeholder, and set the page direction.
function applyLang() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach(e => { e.textContent = t(e.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach(e => { e.placeholder = t(e.dataset.i18nPh); });
}

module.exports = { t, errText, setLang, getLang, applyLang };
