/* HoodTalk — node tests. Run: node tests/test.js
 * Covers: every personality x every input type (statement, question, work
 * message, request, insult, long paragraph); variation distinctness;
 * intensity 1 vs 10 difference (slang density / caps); translate-back
 * plainness; history/favorites pure logic; randomizer variety; the brief's
 * coffee example per personality.
 */
'use strict';
const app = require('../app.js');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (extra !== undefined ? ' — ' + extra : '')); }
}

const INPUTS = {
  statement: 'I am going to the store to buy some food.',
  question: 'Can you help me with this tomorrow?',
  work: 'Please send me the report by Friday.',
  request: 'Can I borrow your car this weekend?',
  insult: 'You are really annoying.',
  paragraph: 'I woke up late this morning. I missed my bus and I was very tired. I need to get some coffee before work or I will be in a bad mood all day.'
};

console.log('== every personality x every input type ==');
let empty = 0, weird = 0;
for (const p of app.PERSONALITIES) {
  for (const [kind, text] of Object.entries(INPUTS)) {
    const r = app.translate(text, p.id, 5, { seed: 12345 });
    if (!r.text || !r.text.trim()) { empty++; console.log('FAIL  empty: ' + p.id + ' / ' + kind); }
    // Output should keep the same sentence count and end with punctuation.
    if (r.sentences !== app.splitSentences(text).length) { weird++; console.log('FAIL  sentence count: ' + p.id + ' / ' + kind + ' got ' + r.sentences); }
    if (!/[.!?]$/.test(r.text.trim())) { weird++; console.log('FAIL  no end punctuation: ' + p.id + ' / ' + kind + ' -> ' + r.text); }
  }
}
check('all personalities produce non-empty output for all 6 input types', empty === 0, empty + ' empty');
check('sentence counts preserved across all combos', weird === 0, weird + ' mismatches');

console.log('== variations differ ==');
for (const p of app.PERSONALITIES) {
  const vars = app.translateVariations(INPUTS.statement, p.id, 5, { seed: 777 });
  const uniq = new Set(vars);
  check(p.id + ': 3 variations returned', vars.length === 3, vars.length + ' returned');
  check(p.id + ': variations are distinct', uniq.size === 3, [...uniq].join(' | '));
}

console.log('== intensity 1 vs 10 ==');
for (const p of app.PERSONALITIES) {
  const lo = app.translate(INPUTS.paragraph, p.id, 1, { seed: 42 });
  const hi = app.translate(INPUTS.paragraph, p.id, 10, { seed: 42 });
  const dLo = app.flavorDensity(lo.text, p.id);
  const dHi = app.flavorDensity(hi.text, p.id);
  const differ = lo.text !== hi.text;
  if (p.id === 'crashout') {
    check('crashout: intensity 10 is ALL CAPS', hi.text === hi.text.toUpperCase(), hi.text);
    check('crashout: intensity 1 is not all caps', lo.text !== lo.text.toUpperCase());
  } else if (p.id === 'authentic') {
    // Authentic stays subtle by design; require only that outputs differ.
    check('authentic: intensity 1 vs 10 outputs differ', differ, lo.text + ' || ' + hi.text);
  } else {
    check(p.id + ': intensity 10 flavour density >= intensity 1 (' + dHi + ' vs ' + dLo + ')', dHi >= dLo, lo.text + ' || ' + hi.text);
    check(p.id + ': intensity 1 vs 10 outputs differ', differ);
  }
}

console.log('== translate-back returns plain English ==');
const SLANG_MARKERS = ['finna', 'tryna', 'lemme', 'dawg', 'homie', 'whip', 'crib', 'bread',
  'grub', 'no cap', 'deadass', 'lowkey', 'on god', 'you feel me', 'black gold',
  'bruh', "y'all", "fo' sho'", 'aight', 'young blood', 'the grind', 'kicks'];
let backBad = 0;
for (const p of app.PERSONALITIES) {
  const t = app.translate('Yo pops, can I make some coffee?', p.id, 8, { seed: 99 }).text;
  const back = app.translateBack(t);
  const low = back.toLowerCase();
  const leftover = SLANG_MARKERS.filter(m => low.includes(m));
  if (leftover.length) { backBad++; console.log('FAIL  back-translation keeps slang (' + p.id + '): ' + leftover.join(', ') + ' in "' + back + '"'); }
  if (!/coffee/i.test(back)) { backBad++; console.log('FAIL  back-translation lost "coffee" (' + p.id + '): "' + back + '" from "' + t + '"'); }
}
check('translate-back strips slang markers and keeps content words', backBad === 0, backBad + ' problems');

console.log('== brief example sanity check ==');
for (const p of ['gangster', 'funny', 'crashout', 'og']) {
  const t = app.translate('Yo pops, can I make some coffee?', p, 7, { seed: 2026 }).text;
  check(p + ': coffee example mentions coffee/black gold/brew', /coffee|black gold|brew/i.test(t), t);
  console.log('      ' + p + ' -> ' + t);
}

console.log('== history / favorites logic ==');
let h = [];
h = app.historyAdd(h, { input: 'hello', personality: 'hood', intensity: 5, outputs: ['a', 'b', 'c'] });
check('historyAdd stores entry', h.length === 1 && h[0].input === 'hello' && h[0].outputs.length === 3);
h = app.historyAdd(h, { input: 'second', personality: 'og', intensity: 3, outputs: ['x'] });
check('historyAdd prepends newest first', h[0].input === 'second');
const hid = h[1].id;
h = app.historyRemove(h, hid);
check('historyRemove deletes by id', h.length === 1 && h[0].input === 'second');
let f = [];
f = app.favAdd(f, { text: 'funny line', personality: 'funny', input: 'hi' });
check('favAdd stores favorite', f.length === 1 && app.isFav(f, 'funny line'));
f = app.favAdd(f, { text: 'funny line', personality: 'funny', input: 'hi' });
check('favAdd dedupes identical text', f.length === 1);
f = app.favRemove(f, f[0].id);
check('favRemove deletes by id', f.length === 0 && !app.isFav(f, 'funny line'));

console.log('== randomizer ==');
const seen = new Set();
for (let i = 0; i < 20; i++) {
  const r = app.randomPhrase(app.makeRng(i * 31337 + 7));
  if (!r.t || !r.p) { fail++; console.log('FAIL  random phrase empty'); break; }
  seen.add(r.t);
}
check('randomizer returns 20 draws with variety (>=5 distinct)', seen.size >= 5, seen.size + ' distinct');
check('random phrase bank has >= 40 entries', app.RANDOM_PHRASES.length >= 40, app.RANDOM_PHRASES.length + ' entries');
check('random bank covers all 8 personalities', new Set(app.RANDOM_PHRASES.map(x => x.p)).size === 8);

console.log('== personalities meta ==');
check('8 personalities defined', app.PERSONALITIES.length === 8, app.PERSONALITIES.length);
let metaBad = 0;
for (const p of app.PERSONALITIES) {
  if (!p.name || !p.tagline || !p.desc || !p.exampleIn || !p.exampleOut) metaBad++;
  if (!p.openers.length || !p.closers.length) metaBad++;
  if (!p.speech || typeof p.speech.rate !== 'number' || typeof p.speech.pitch !== 'number') metaBad++;
}
check('every personality has name/tagline/desc/example/openers/closers/speech', metaBad === 0, metaBad + ' gaps');

console.log('\n' + pass + ' passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
