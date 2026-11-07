// Arabic text normalisers shared by build.js, learn.js and lists.js.

// Arabic-Indic digits to 0-9
function westDigits(s) { return String(s).replace(/[\u0660-\u0669]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); }); }
// remove short vowels (tashkeel), superscript alef and tatweel
function stripMarks(s) { return String(s).replace(/[\u064B-\u065F\u0670\u0640]/g, ''); }
// one spelling for the alef/hamza forms, alef maqsura and ta marbuta
function foldLetters(s) { return String(s).replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627').replace(/\u0649/g, '\u064A').replace(/\u0629/g, '\u0647'); }

module.exports = { westDigits: westDigits, stripMarks: stripMarks, foldLetters: foldLetters };
