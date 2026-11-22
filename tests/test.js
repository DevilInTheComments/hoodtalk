/* HoodTalk — node tests. Run: node tests/test.js
 * Covers: every personality x every input type (statement, question, work
 * message, request, insult, long paragraph); variation distinctness;
 * intensity 1 vs 10 difference (slang density / caps); translate-back
 * plainness; history/favorites pure logic; randomizer variety; the brief's
 * coffee example per personality; Hood Talk v3 golden examples (Blood-style
 * on-set voice: intent coverage, meaning preserved, voice present, variety,
 * intensity tiers, no banned filler); Fluent English (correct/polish/
 * professional, confused words, voice-to-text cleanup, casual preserved,
 * explanations); Say It Back (intent detection, responsive replies, flavor
 * labels, variety); NFG mode (OFF clean, ON stronger + savage comebacks,
 * meaning preserved, no threats, variety, Hood Talk only).
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

console.log('== Hood Talk v3: golden examples ==');
var HOOD_VOICE = /og|big homie|big dawg|feel me|say less|on the set|finna|youngin|handle business|hold me down|do me a solid|slide me|slide to|gotta|tryna|dead tired|mad annoying|what's good|ayy|what's crackin'|mornin'|keep it solid|that's the move|what's the word|real talk|so boom|aight|what it do|you already know|you with me|on my word|no cap|appreciate you|good lookin' out/i;
var HOOD_GOLDEN = [
  { kind: 'request/permission', input: 'Can I make some coffee?', content: [/coffee|black gold/i], topic: /brewin|black gold|liquid motivation/i },
  { kind: 'favor', input: 'Can you help me with this tomorrow?', content: [/tomorrow/i], topic: null },
  { kind: 'statement', input: 'I am going to the store to buy some food.', content: [/store/i], topic: /slide|grub|finna/i },
  { kind: 'greeting', input: 'Good morning, everyone.', content: [], topic: null },
  { kind: 'work message', input: 'Please send me the report by Friday.', content: [/report/i, /friday/i], topic: /slide me|that report/i },
  { kind: 'insult/comeback', input: 'You are really annoying.', content: [/annoying/i], topic: /mad annoying/i },
  { kind: 'long paragraph', input: INPUTS.paragraph, content: [/bus/i, /coffee|black gold/i], topic: /finna|gotta|dead tired/i }
];
var hoodBad = 0;
for (var gi = 0; gi < HOOD_GOLDEN.length; gi++) {
  var g = HOOD_GOLDEN[gi];
  var outs = [];
  for (var gs = 0; gs < 5; gs++) {
    outs.push(app.translate(g.input, 'hood', 7, { seed: 1000 + gs * 37 }).text);
  }
  for (var oi = 0; oi < outs.length; oi++) {
    var o = outs[oi];
    if (!o || !o.trim()) { hoodBad++; console.log('FAIL  hood golden empty (' + g.kind + '): seed ' + oi); }
    if (!/[.!?]$/.test(o.trim())) { hoodBad++; console.log('FAIL  hood golden no end punctuation (' + g.kind + '): ' + o); }
    for (var ci = 0; ci < g.content.length; ci++) {
      if (!g.content[ci].test(o)) { hoodBad++; console.log('FAIL  hood golden lost content (' + g.kind + '): ' + g.content[ci] + ' not in "' + o + '"'); }
    }
    if (!HOOD_VOICE.test(o)) { hoodBad++; console.log('FAIL  hood golden no voice marker (' + g.kind + '): "' + o + '"'); }
  }
  if (g.topic) {
    var withTopic = outs.filter(function (x) { return g.topic.test(x); }).length;
    if (withTopic < 3) { hoodBad++; console.log('FAIL  hood golden topic flavour rare (' + g.kind + '): ' + withTopic + '/5 — ' + outs.join(' | ')); }
  }
  console.log('      ' + g.kind + ' -> ' + outs[0]);
}
check('hood golden examples: meaning kept, voice present, punctuation clean', hoodBad === 0, hoodBad + ' problems');

console.log('== Hood Talk variety + intensity ==');
var seenHood = new Set();
for (var hs = 0; hs < 5; hs++) {
  seenHood.add(app.translate('Can I make some coffee?', 'hood', 7, { seed: 1000 + hs }).text);
}
check('hood: same input 5 seeds -> >= 3 distinct outputs', seenHood.size >= 3, [...seenHood].join(' | '));
var hoodLo = app.translate(INPUTS.paragraph, 'hood', 1, { seed: 42 });
var hoodHi = app.translate(INPUTS.paragraph, 'hood', 10, { seed: 42 });
check('hood: intensity 1 has no invented reason clause', !/liquid motivation|handle business/i.test(hoodLo.text), hoodLo.text);
check('hood: intensity 1 vs 10 outputs differ', hoodLo.text !== hoodHi.text);

console.log('== Hood Talk v3: golden examples (Blood-style, full intensity) ==');
function v3Count(re, outs) { return outs.filter(function (x) { return re.test(x); }).length; }
var V3_COFFEE = [];
for (var cs = 0; cs < 5; cs++) V3_COFFEE.push(app.translate('Can I make some coffee?', 'hood', 9, { seed: 1000 + cs * 37 }).text);
var v3Bad = 0;
if (v3Count(/brewin'/i, V3_COFFEE) < 4) { v3Bad++; console.log('FAIL  v3 coffee: brewin\' rare — ' + V3_COFFEE.join(' | ')); }
if (v3Count(/handle business/i, V3_COFFEE) < 4) { v3Bad++; console.log('FAIL  v3 coffee: handle business rare — ' + V3_COFFEE.join(' | ')); }
if (v3Count(/on the set/i, V3_COFFEE) < 4) { v3Bad++; console.log('FAIL  v3 coffee: on the set rare — ' + V3_COFFEE.join(' | ')); }
if (V3_COFFEE.some(function (x) { return /that's just how it is/i.test(x); })) { v3Bad++; console.log('FAIL  v3 coffee: banned filler present'); }
V3_COFFEE.forEach(function (o) { if (!/[.!?]$/.test(o.trim())) { v3Bad++; console.log('FAIL  v3 coffee no end punctuation: ' + o); } });
console.log('      coffee (9) -> ' + V3_COFFEE[0]);
var V3_GREET = [];
for (var gs2 = 0; gs2 < 5; gs2++) V3_GREET.push(app.translate('Good morning. What are you doing today?', 'hood', 9, { seed: 1000 + gs2 * 37 }).text);
if (v3Count(/Mornin'/, V3_GREET) < 4) { v3Bad++; console.log('FAIL  v3 greeting: Mornin\' rare — ' + V3_GREET.join(' | ')); }
if (v3Count(/What's crackin'/i, V3_GREET) < 4) { v3Bad++; console.log('FAIL  v3 greeting: What\'s crackin\' rare — ' + V3_GREET.join(' | ')); }
if (v3Count(/business to handle/i, V3_GREET) < 4) { v3Bad++; console.log('FAIL  v3 greeting: business to handle rare — ' + V3_GREET.join(' | ')); }
if (V3_GREET.some(function (x) { return /that's just how it is/i.test(x); })) { v3Bad++; console.log('FAIL  v3 greeting: banned filler present'); }
console.log('      greeting (9) -> ' + V3_GREET[0]);
check('hood v3 goldens: coffee + greeting hit their signature phrases at full intensity', v3Bad === 0, v3Bad + ' problems');

console.log('== Hood Talk v3: variety (no filler dominates) ==');
var V3_FILLERS = ["that's just how it is", 'say less', 'on the set', 'you feel me', 'you already know', "what's crackin'", 'keep it solid', "that's the move", 'handle business', 'real talk', 'so boom', 'moves to make'];
var V3_INPUTS = [
  'Can I make some coffee?', 'I am going to the store to buy some food.',
  'Please send me the report by Friday.', 'Can I borrow your car this weekend?',
  'You are really annoying.', 'What time is it?', 'Good morning, everyone.',
  'I woke up late this morning.', 'Can you help me with this tomorrow?',
  'I need to get some sleep.', 'Thank you so much.', 'I am so tired today.'
];
var v3VarBad = 0;
var v3Outs = V3_INPUTS.map(function (t, idx) { return app.translate(t, 'hood', 7, { seed: 2000 + idx * 101 }).text; });
for (var vf = 0; vf < V3_FILLERS.length; vf++) {
  var fl = V3_FILLERS[vf];
  var n = v3Outs.filter(function (x) { return x.toLowerCase().indexOf(fl) !== -1; }).length;
  if (fl === "that's just how it is" && n !== 0) { v3VarBad++; console.log('FAIL  v3 variety: banned filler "' + fl + '" in ' + n + ' outputs'); }
  else if (n > 2) { v3VarBad++; console.log('FAIL  v3 variety: filler "' + fl + '" in ' + n + '/12 outputs'); }
}
var v3Same = [];
for (var ss = 0; ss < 6; ss++) v3Same.push(app.translate('Can I make some coffee?', 'hood', 7, { seed: 3000 + ss }).text);
var v3First3 = new Set(v3Same.map(function (x) { return x.split(/\s+/).slice(0, 3).join(' '); }));
if (v3First3.size < 4) { v3VarBad++; console.log('FAIL  v3 variety: same input 6 seeds -> <4 distinct openings — ' + v3Same.join(' | ')); }
for (var ci3 = 1; ci3 < v3Same.length; ci3++) {
  if (v3Same[ci3] === v3Same[ci3 - 1]) { v3VarBad++; console.log('FAIL  v3 variety: two consecutive identical outputs — ' + v3Same[ci3]); }
}
check('hood v3 variety: no filler in >2/12 outputs, banned filler gone, openings rotate', v3VarBad === 0, v3VarBad + ' problems');

console.log('== Hood Talk v3: intensity tiers ==');
var INT_PARA = INPUTS.paragraph;
var i2 = app.translate(INT_PARA, 'hood', 2, { seed: 42 });
var i5 = app.translate(INT_PARA, 'hood', 5, { seed: 42 });
var i9 = app.translate(INT_PARA, 'hood', 9, { seed: 42 });
check('hood v3: intensity 2 vs 5 vs 9 all differ', i2.text !== i5.text && i5.text !== i9.text && i2.text !== i9.text, i2.text + ' || ' + i5.text + ' || ' + i9.text);
var d2 = app.flavorDensity(i2.text, 'hood'), d5 = app.flavorDensity(i5.text, 'hood'), d9 = app.flavorDensity(i9.text, 'hood');
check('hood v3: flavor density rises with intensity (2 < 5 < 9)', d2 < d5 && d5 < d9, d2 + ' vs ' + d5 + ' vs ' + d9);
check('hood v3: intensity 2 has no reason clause (no handle business / liquid motivation / on the set)', !/handle business|liquid motivation|on the set/i.test(i2.text), i2.text);
check('hood v3: intensity 9 carries the full voice (handle business or on the set)', /handle business|on the set/i.test(i9.text), i9.text);
console.log('      inten 2 -> ' + i2.text);
console.log('      inten 5 -> ' + i5.text);
console.log('      inten 9 -> ' + i9.text);

console.log('== Hood Talk v3: meaning preserved at full intensity ==');
var V3_MEANING = [
  { input: 'Can I make some coffee?', words: [/coffee/i] },
  { input: 'I am going to the store to buy some food.', words: [/store/i, /food|grub/i] },
  { input: 'Please send me the report by Friday.', words: [/report/i, /friday/i] },
  { input: 'Can I borrow your car this weekend?', words: [/car|whip/i, /weekend/i] },
  { input: 'What time is it?', words: [/time/i] },
  { input: 'I need to get some sleep.', words: [/sleep|knock out/i] },
  { input: 'Can you help me with this tomorrow?', words: [/tomorrow/i] }
];
var meanBad = 0;
for (var mi = 0; mi < V3_MEANING.length; mi++) {
  var mm = V3_MEANING[mi];
  var mo = app.translate(mm.input, 'hood', 9, { seed: 777 }).text;
  for (var wi = 0; wi < mm.words.length; wi++) {
    if (!mm.words[wi].test(mo)) { meanBad++; console.log('FAIL  v3 meaning lost ' + mm.words[wi] + ' in "' + mo + '" from "' + mm.input + '"'); }
  }
}
check('hood v3: content words survive at intensity 9', meanBad === 0, meanBad + ' problems');

console.log('== Hood Talk v3: new intents ==');
var V3_INTENTS = [
  { input: 'Thank you so much.', checks: [/appreciate/i] },
  { input: 'Sorry about that.', checks: [/my fault|my bad/i, /we good/i] },
  { input: 'See you later.', checks: [/catch you|i'?m out|stay solid/i] },
  { input: 'What are you doing tonight?', checks: [/what's crackin'/i, /business to handle/i] },
  { input: 'I am so tired today.', checks: [/tired|fumes/i] }
];
var intBad = 0;
for (var ni = 0; ni < V3_INTENTS.length; ni++) {
  var nc = V3_INTENTS[ni];
  var no = app.translate(nc.input, 'hood', 8, { seed: 777 }).text;
  for (var nci = 0; nci < nc.checks.length; nci++) {
    if (!nc.checks[nci].test(no)) { intBad++; console.log('FAIL  v3 intent (' + nc.input + '): ' + nc.checks[nci] + ' not in "' + no + '"'); }
  }
  console.log('      ' + nc.input + ' -> ' + no);
}
check('hood v3: thanks/apology/goodbye/plans/feeling intents land', intBad === 0, intBad + ' problems');

console.log('== NFG mode ==');
var NFG_HEAVY = /\bfuck|bullshit|motherfucker|dumb ass|bastard|son of a bitch|zero fucks|remaining fucks|go unfuck yourself|bitch|damn/i;
var NFG_INPUTS = [
  'Can I make some coffee?', 'Good morning. What are you doing today?',
  'You are really stupid.', 'What time is it?', 'Thank you so much.',
  'Can you help me with this tomorrow?', 'What are you doing tonight?',
  'I am going to the store to buy some food.', 'Sorry about that.',
  'See you later.', 'I need to get some sleep.', 'Please send me the report by Friday.'
];
/* OFF: Blood-style voice, no heavy profanity in ordinary translations. */
var offBad = 0;
for (var ni = 0; ni < NFG_INPUTS.length; ni++) {
  var o = app.translate(NFG_INPUTS[ni], 'hood', 7, { seed: 5000 + ni * 31 }).text;
  if (NFG_HEAVY.test(o)) { offBad++; console.log('FAIL  nfg OFF has heavy profanity: ' + o); }
}
check('nfg OFF: Blood-style voice, no heavy profanity in ordinary translations', offBad === 0, offBad + ' problems');

/* ON: same inputs differ and carry the NFG energy. */
var onBad = 0;
var onOuts = [];
for (var nj = 0; nj < NFG_INPUTS.length; nj++) {
  var offT = app.translate(NFG_INPUTS[nj], 'hood', 7, { seed: 5000 + nj * 31 }).text;
  var onT = app.translate(NFG_INPUTS[nj], 'hood', 7, { seed: 5000 + nj * 31, nfg: true }).text;
  onOuts.push(onT);
  if (offT === onT) { onBad++; console.log('FAIL  nfg ON identical to OFF: ' + onT); }
}
var onHeavy = onOuts.filter(function (x) { return NFG_HEAVY.test(x); }).length;
if (onHeavy < 6) { onBad++; console.log('FAIL  nfg ON: only ' + onHeavy + '/' + onOuts.length + ' outputs carry heavy NFG energy — ' + onOuts.join(' | ')); }
check('nfg ON: same inputs differ from OFF, most carry the NFG energy', onBad === 0, onBad + ' problems');
console.log('      nfg ON coffee -> ' + onOuts[0]);
console.log('      nfg ON greeting -> ' + onOuts[1]);
console.log('      nfg ON insult -> ' + onOuts[2]);

/* ON: comebacks for insults are savage and funny, not a bare echo. */
var nfgComeback = app.translate('You are really stupid.', 'hood', 8, { seed: 777, nfg: true }).text;
check('nfg ON insult: savage comeback, still about the insult', /fuck|bullshit|dumb ass|motherfucker|miss me|unfuck|lost your whole damn mind/i.test(nfgComeback) && /stupid|dumb as hell/i.test(nfgComeback), nfgComeback);
/* ON: greeting stays a greeting, hyped up. */
var nfgGreet = app.translate('Good morning. What are you doing today?', 'hood', 8, { seed: 777, nfg: true }).text;
check('nfg ON greeting: hyped greeting, still a greeting', /what the fuck|mornin'/i.test(nfgGreet) && /what the fuck we|doing today|gettin' into/i.test(nfgGreet), nfgGreet);
/* ON: question keeps its meaning with attitude. */
var nfgQ = app.translate('What time is it?', 'hood', 7, { seed: 777, nfg: true }).text;
check('nfg ON question: still asks the time', /what time/i.test(nfgQ), nfgQ);

/* Meaning preserved in NFG mode. */
var NFG_MEANING = [
  { input: 'Can I make some coffee?', words: [/coffee/i] },
  { input: 'I am going to the store to buy some food.', words: [/store/i, /food|grub/i] },
  { input: 'Please send me the report by Friday.', words: [/report/i, /friday/i] },
  { input: 'Can I borrow your car this weekend?', words: [/car|whip/i, /weekend/i] },
  { input: 'What time is it?', words: [/time/i] },
  { input: 'I need to get some sleep.', words: [/sleep|knock out/i] },
  { input: 'Can you help me with this tomorrow?', words: [/tomorrow/i] }
];
var nfgMeanBad = 0;
for (var nmi = 0; nmi < NFG_MEANING.length; nmi++) {
  var nm = NFG_MEANING[nmi];
  var nmo = app.translate(nm.input, 'hood', 9, { seed: 777, nfg: true }).text;
  for (var nwi = 0; nwi < nm.words.length; nwi++) {
    if (!nm.words[nwi].test(nmo)) { nfgMeanBad++; console.log('FAIL  nfg meaning lost ' + nm.words[nwi] + ' in "' + nmo + '" from "' + nm.input + '"'); }
  }
}
check('nfg: content words survive at intensity 9', nfgMeanBad === 0, nfgMeanBad + ' problems');

/* No threats — across intents, translator + Say It Back. */
var NFG_THREAT = /\b(i'?ll|i will|i'?ma|i'?m (gonna|going to))\s+(hurt|kill|beat|stab|shoot|find|hunt|come for)\s+you\b/i;
var threatBad = 0;
for (var nt = 0; nt < NFG_INPUTS.length; nt++) {
  var no = app.translate(NFG_INPUTS[nt], 'hood', 9, { seed: 6000 + nt * 31, nfg: true }).text;
  if (NFG_THREAT.test(no)) { threatBad++; console.log('FAIL  nfg threat pattern: ' + no); }
}
var sibNfgThreat = app.sayItBack('You are so stupid.', 'hood', 9, { seed: 42, nfg: true });
sibNfgThreat.replies.forEach(function (r) { if (NFG_THREAT.test(r.text)) { threatBad++; console.log('FAIL  nfg SIB threat: ' + r.text); } });
var sibNfgThreat2 = app.sayItBack('Hey, what is up?', 'hood', 9, { seed: 42, nfg: true });
sibNfgThreat2.replies.forEach(function (r) { if (NFG_THREAT.test(r.text)) { threatBad++; console.log('FAIL  nfg SIB threat: ' + r.text); } });
check('nfg: no threat patterns across translator + Say It Back', threatBad === 0, threatBad + ' problems');

/* Variety: the 7 bank expressions + 6 closers each in at most 2 of the
 * 12 outputs; generic openers (pool of 10) in at most 3. */
var NFG_BANK = ['what the fuck is good', 'miss me with that bullshit', "i ain't got the time, patience", 'get the fuck outta here', 'you done lost your whole damn mind', "i'm not arguing with your dumb ass", 'respectfully, go unfuck yourself', 'zero fucks given', 'i said what i said', "and that's on everything", 'no more fucks to give', 'handle it or shut the fuck up'];
var nfgVarBad = 0;
for (var ne = 0; ne < NFG_BANK.length; ne++) {
  var ncnt = onOuts.filter(function (x) { return x.toLowerCase().indexOf(NFG_BANK[ne]) !== -1; }).length;
  if (ncnt > 2) { nfgVarBad++; console.log('FAIL  nfg variety: "' + NFG_BANK[ne] + '" in ' + ncnt + ' outputs'); }
}
var NFG_OPENERS_VAR = ['straight up', 'on god', 'fuck it, look', 'man, look', 'ayy, no bullshit', 'ayy, fuck all that', 'listen —', 'aight, listen the fuck up', 'yo, i swear to god'];
for (var nov = 0; nov < NFG_OPENERS_VAR.length; nov++) {
  var ocnt = onOuts.filter(function (x) { return x.toLowerCase().indexOf(NFG_OPENERS_VAR[nov]) !== -1; }).length;
  if (ocnt > 3) { nfgVarBad++; console.log('FAIL  nfg variety: opener "' + NFG_OPENERS_VAR[nov] + '" in ' + ocnt + ' outputs'); }
}
check('nfg variety: bank expressions/closers in <=2 outputs, openers in <=3', nfgVarBad === 0, nfgVarBad + ' problems');

/* Gating: NFG touches Hood Talk only. */
var gangOff = app.translate('Can I make some coffee?', 'gangster', 7, { seed: 42 }).text;
var gangOn = app.translate('Can I make some coffee?', 'gangster', 7, { seed: 42, nfg: true }).text;
check('nfg: other personalities ignore the toggle', gangOff === gangOn, gangOff + ' vs ' + gangOn);
var fluNfg = app.fluentEnglish('their going to the store and there dog is to cute', 'correct').text;
check('nfg: Fluent English unaffected (no profanity injected)', !NFG_HEAVY.test(fluNfg), fluNfg);

/* SIB NFG: Hood Talk replies get the voice; other personalities don't. */
var sibHood = app.sayItBack('You are so stupid.', 'hood', 8, { seed: 42, nfg: true });
var sibHoodOff = app.sayItBack('You are so stupid.', 'hood', 8, { seed: 42 });
check('nfg SIB: Hood Talk replies differ with NFG on', sibHood.replies.map(function (r) { return r.text; }).join('|') !== sibHoodOff.replies.map(function (r) { return r.text; }).join('|'));
var sibHoodHeavy = sibHood.replies.filter(function (r) { return NFG_HEAVY.test(r.text); }).length;
check('nfg SIB: Hood Talk replies carry the NFG energy', sibHoodHeavy >= 2, sibHoodHeavy + '/3 heavy');
var sibGang = app.sayItBack('You are so stupid.', 'gangster', 8, { seed: 42, nfg: true });
var sibGangOff = app.sayItBack('You are so stupid.', 'gangster', 8, { seed: 42 });
check('nfg SIB: other personalities ignore the toggle', sibGang.replies.map(function (r) { return r.text; }).join('|') === sibGangOff.replies.map(function (r) { return r.text; }).join('|'));

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

console.log('== Fluent English ==');
function wordOverlap(a, b) {
  var aw = String(a).toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').split(/\s+/).filter(Boolean);
  var bl = ' ' + String(b).toLowerCase().replace(/[^a-z0-9'\s]/g, ' ') + ' ';
  var kept = aw.filter(function (w) { return bl.indexOf(' ' + w + ' ') !== -1; }).length;
  return aw.length ? kept / aw.length : 1;
}
var FLUENT_CASES = [
  { opt: 'correct', input: 'their going to the store and there dog is to cute', checks: [/They're going/, /their dog/, /too cute/] },
  { opt: 'correct', input: 'your going to love its new color', checks: [/You're going/, /its new color/] },
  { opt: 'correct', input: 'its a beautiful day', checks: [/It's a beautiful day/] },
  { opt: 'correct', input: 'i could of gone yesterday but i seen a dog', checks: [/I could've gone/, /I saw a dog/] },
  { opt: 'correct', input: 'dont worry about it alot of people was there', checks: [/Don't worry/, /a lot of people were/] },
  { opt: 'correct', input: 'i am going to the store and i need to buy some food', checks: [/I am going/, /I need to buy/] },
  { opt: 'correct', input: 'yesterday i go to work', checks: [/Yesterday I went to work/] },
  { opt: 'correct', input: 'better then yesterday', checks: [/[Bb]etter than yesterday/] },
  { opt: 'polish', input: 'it was very good due to the fact that we worked hard', checks: [/great/, /because we worked hard/] },
  { opt: 'polish', input: 'i went to the store i bought some milk', checks: [/I went to the store\. I bought some milk/] },
  { opt: 'professional', input: 'thanks for the help i just wanted to check in', checks: [/Thank you for the help\. I wanted to check in\./] },
  { opt: 'polish', input: 'you and i went to the store', checks: [/[Yy]ou and I went to the store/] },
  { opt: 'polish', input: 'trust me i know what i am doing', checks: [/Trust me I know what I am doing/] },
];
var fluentBad = 0;
for (var fi = 0; fi < FLUENT_CASES.length; fi++) {
  var fc = FLUENT_CASES[fi];
  var fr = app.fluentEnglish(fc.input, fc.opt);
  for (var ci2 = 0; ci2 < fc.checks.length; ci2++) {
    if (!fc.checks[ci2].test(fr.text)) { fluentBad++; console.log('FAIL  fluent (' + fc.opt + '): ' + fc.checks[ci2] + ' not in "' + fr.text + '" from "' + fc.input + '"'); }
  }
  if (!/[.!?]$/.test(fr.text)) { fluentBad++; console.log('FAIL  fluent no end punctuation: "' + fr.text + '"'); }
  console.log('      [' + fc.opt + '] ' + fc.input + ' -> ' + fr.text);
}
check('fluent: confused words / grammar / spelling fixed per option', fluentBad === 0, fluentBad + ' problems');

var flClose = app.fluentEnglish('their going to the store and there dog is to cute', 'correct');
check('fluent Correct Only stays close to the input (>=80% of words kept)', wordOverlap(flClose.text, 'their going to the store and there dog is to cute') >= 0.8, flClose.text);

var flVtt = app.fluentEnglish('i went to the store and then i bought some milk and then i went home', 'polish');
check('fluent voice-to-text: run-on split into sentences', /Then I bought/.test(flVtt.text) && /Then I went/.test(flVtt.text) && /milk/.test(flVtt.text) && /home/.test(flVtt.text), flVtt.text);

var flCasual = app.fluentEnglish('yeah im gonna go lol', 'correct');
check('fluent Correct Only keeps intentional casual language (gonna, lol)', /gonna/.test(flCasual.text) && /lol/.test(flCasual.text) && /I'm/.test(flCasual.text), flCasual.text);
var flCasualP = app.fluentEnglish('yeah im gonna go lol', 'polish');
check('fluent Polish It keeps intentional casual language too', /gonna/.test(flCasualP.text) && /lol/.test(flCasualP.text), flCasualP.text);

var flPro = app.fluentEnglish('yeah im gonna send it lol', 'professional');
check('fluent Professional is formal (going to, no gonna/lol, Yes)', /going to/.test(flPro.text) && !/gonna|lmao|\blol\b/.test(flPro.text) && /^Yes/.test(flPro.text), flPro.text);

var flWhy = app.fluentEnglish('their going to the store', 'correct');
var whyEntry = flWhy.explanations.filter(function (e) { return e.from === 'their going' && e.to === "they're going"; })[0];
check('fluent explanations list real corrections with a reason', !!whyEntry && /contraction/i.test(whyEntry.why), JSON.stringify(flWhy.explanations));
check('fluent explanations all have from/to/why', flWhy.explanations.every(function (e) { return e.from && e.to && e.why; }));
var flEmpty = app.fluentEnglish('   ', 'correct');
check('fluent empty input returns empty text, no explanations', flEmpty.text === '' && flEmpty.explanations.length === 0);
check('fluent: 3 options defined with name + desc', app.FLUENT_OPTIONS.length === 3 && app.FLUENT_OPTIONS.every(function (o) { return o.id && o.name && o.desc; }));
check('fluent history entries store their mode', (function () {
  var hh = app.historyAdd([], { input: 'x', mode: 'fluent', fluentOption: 'polish', outputs: ['y'] });
  return hh[0].mode === 'fluent' && hh[0].fluentOption === 'polish';
})());
check('fluent favorites store their mode', (function () {
  var ff = app.favAdd([], { text: 'y', personality: 'fluent', input: 'x', mode: 'fluent', fluentOption: 'correct' });
  return ff[0].mode === 'fluent';
})());

console.log('== Say It Back ==');
var SIB_INTENTS = [
  { input: 'What time are we meeting tomorrow?', intent: 'question' },
  { input: "Hey, what's up?", intent: 'greeting' },
  { input: 'Good morning everyone.', intent: 'greeting' },
  { input: 'Good morning, can we meet at 9?', intent: 'question' },
  { input: 'You look great today!', intent: 'compliment' },
  { input: 'You are so annoying.', intent: 'insult' },
  { input: 'Can you send me the address?', intent: 'request' },
  { input: 'lol did you hear the one about the chicken?', intent: 'joke' },
  { input: "I'm so stressed, my boss is on me all day.", intent: 'vent' },
  { input: 'Thanks for the help!', intent: 'thanks' },
  { input: "Sorry about that, my bad.", intent: 'apology' },
  { input: 'Goodnight, talk tomorrow.', intent: 'goodbye' }
];
var intentBad = 0;
for (var ii = 0; ii < SIB_INTENTS.length; ii++) {
  var got = app.detectReplyIntent(SIB_INTENTS[ii].input);
  if (got !== SIB_INTENTS[ii].intent) { intentBad++; console.log('FAIL  intent: "' + SIB_INTENTS[ii].input + '" -> ' + got + ', want ' + SIB_INTENTS[ii].intent); }
}
check('say-it-back intent detection across 12 message types', intentBad === 0, intentBad + ' wrong');

var SIB_CASES = [
  { kind: 'question', input: 'What time are we meeting tomorrow?', responsive: /[?]|whenever|you pick|on it|get back|let you know|say the word|figure it out/i },
  { kind: 'greeting', input: "Hey, what's up?", responsive: /what'?s good|what up|hey|yo|good|what'?s happenin'|what'?s crackin'|mornin'/i },
  { kind: 'compliment', input: 'You look great today!', responsive: /appreciate|thank|good look|stay|flatter/i },
  { kind: 'insult', input: 'You are so annoying.', responsive: /cute|tried|stay mad|best part|admit|coming from you|whole chest|annoying/i },
  { kind: 'request', input: 'Can you send me the address?', responsive: /got you|on it|on the job|say less|let me|i'll do it|handle|send/i },
  { kind: 'joke', input: 'lol did you hear the one about the chicken?', responsive: /lol|😂|funny|weak|dead|got me|hilarious|got jokes/i },
  { kind: 'vent', input: "I'm so stressed, my boss is on me all day.", responsive: /hear you|got this|shake|you good|hang in|head up|reset|take a breath/i }
];
var sibBad = 0;
for (var si2 = 0; si2 < SIB_CASES.length; si2++) {
  var sc = SIB_CASES[si2];
  var sr = app.sayItBack(sc.input, 'hood', 6, { seed: 500 });
  if (sr.intent !== sc.kind) { sibBad++; console.log('FAIL  sib intent (' + sc.kind + '): got ' + sr.intent + ' for "' + sc.input + '"'); }
  if (sr.replies.length !== 3) { sibBad++; console.log('FAIL  sib reply count (' + sc.kind + '): ' + sr.replies.length); }
  var uniq = new Set(sr.replies.map(function (r) { return r.text; }));
  if (uniq.size !== 3) { sibBad++; console.log('FAIL  sib replies not distinct (' + sc.kind + '): ' + sr.replies.map(function (r) { return r.text; }).join(' | ')); }
  var labels = sr.replies.map(function (r) { return r.label; });
  if (new Set(labels).size !== 3) { sibBad++; console.log('FAIL  sib labels not distinct (' + sc.kind + '): ' + labels.join(', ')); }
  var responsive = sr.replies.filter(function (r) { return sc.responsive.test(r.text); }).length;
  if (responsive < 2) { sibBad++; console.log('FAIL  sib replies not responsive (' + sc.kind + '): ' + responsive + '/3 — ' + sr.replies.map(function (r) { return r.text; }).join(' | ')); }
  var voiced = sr.replies.filter(function (r) { return HOOD_VOICE.test(r.text); }).length;
  if (voiced < 2) { sibBad++; console.log('FAIL  sib Hood Talk voice missing (' + sc.kind + '): ' + voiced + '/3 — ' + sr.replies.map(function (r) { return r.text; }).join(' | ')); }
  for (var ri = 0; ri < sr.replies.length; ri++) {
    if (!sr.replies[ri].text || !sr.replies[ri].text.trim()) { sibBad++; console.log('FAIL  sib empty reply (' + sc.kind + ')'); }
    if (!/[.!?]$/.test(sr.replies[ri].text.trim())) { sibBad++; console.log('FAIL  sib no end punctuation (' + sc.kind + '): ' + sr.replies[ri].text); }
  }
  console.log('      ' + sc.kind + ' -> ' + sr.replies.map(function (r) { return '[' + r.label + '] ' + r.text; }).join(' || '));
}
check('say-it-back: 3 distinct, labeled, responsive, in-voice replies per type', sibBad === 0, sibBad + ' problems');

var sibQ = app.sayItBack('What time are we meeting tomorrow?', 'hood', 6, { seed: 500 });
check('say-it-back question replies invent no specific time', !sibQ.replies.some(function (r) { return /\b\d{1,2}\s*(am|pm)\b/i.test(r.text) || /\bat \d/.test(r.text); }), sibQ.replies.map(function (r) { return r.text; }).join(' | '));
var sibA = app.sayItBack('What time are we meeting tomorrow?', 'hood', 6, { seed: 500 });
var sibB = app.sayItBack('What time are we meeting tomorrow?', 'hood', 6, { seed: 501 });
check('say-it-back repeated generation varies', sibA.replies.some(function (r, idx) { return r.text !== sibB.replies[idx].text; }), sibA.replies.map(function (r) { return r.text; }).join(' | ') + ' VS ' + sibB.replies.map(function (r) { return r.text; }).join(' | '));
var sibGang = app.sayItBack('You are so annoying.', 'gangster', 6, { seed: 500 });
check('say-it-back works in other personalities (gangster, 3 replies)', sibGang.replies.length === 3 && sibGang.replies.every(function (r) { return r.text && r.text.trim(); }) && sibGang.replies[0].label !== sibGang.replies[1].label, JSON.stringify(sibGang.replies));
check('say-it-back history entries store mode + labels', (function () {
  var hh = app.historyAdd([], { input: 'hey', mode: 'sayitback', personality: 'hood', intensity: 6, outputs: ['a', 'b', 'c'], labels: ['Confident', 'Funny', 'Short & smooth'] });
  return hh[0].mode === 'sayitback' && hh[0].labels && hh[0].labels.length === 3;
})());

console.log('\n' + pass + ' passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
