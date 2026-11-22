/* HoodTalk v1 — funny AI slang translator.
 * All logic runs on-device. No network calls, no API keys, no accounts.
 * Pure functions are exported for node tests (see tests/test.js).
 */
'use strict';

var STORAGE_HISTORY = 'hoodtalk.history.v1';
var STORAGE_FAVORITES = 'hoodtalk.favorites.v1';
var STORAGE_SETTINGS = 'hoodtalk.settings.v1';
var VERSION = '1.5.0';

/* ---------- seeded RNG (mulberry32) ---------- */
function makeRng(seed) {
  var s = (seed >>> 0) || 1;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    var t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function chance(rng, p) { return rng() < p; }
function shuffleCopy(rng, arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(rng() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function capFirst(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

/* ---------- personalities ---------- */
var PERSONALITIES = [
  {
    id: 'hood', name: 'Hood Talk', tagline: '★ The flagship voice — full Blood-style gangsta talk, on-set energy.',
    desc: 'The main event. Full Blood-style gangsta talk — confident, funny, bold, on-set energy — and it actually says what you meant. The strongest mode in the app.',
    exampleIn: 'Yo pops, can I make some coffee?',
    exampleOut: 'Ayy, OG! What\'s the word? You finna let me get that coffee brewin\' or what? A brother need that caffeine before he step out and handle business on the set!',
    speech: { rate: 1.0, pitch: 1.0 },
    openers: ['Ayy, OG!', 'Ayy, Big Homie!', 'Say, Big Homie!', 'Ayy, Big Dawg!', 'Yo, Big Homie!', 'Real talk,', 'Aight, look,', 'So boom,', 'Ayy, look,', 'On the set,', 'Listen, Big Homie,', 'Ayy, let me ask you something,', 'Yo, real talk,', 'What the fuck is good?', 'Ayy, no bullshit,', 'Man, look —', 'Fuck it, look,', 'Straight up,', 'On God,'],
    closers: ['on the set.', 'you already know.', "that's what's crackin'.", 'keep it solid.', "that's the move.", 'on my word.', 'no cap.', 'for real.', 'you feel me?', 'you with me?', 'say less.', 'real talk.', "I ain't got the time, patience, or the remaining fucks to give.", 'Zero fucks given, zero apologies.', 'I said what I said.', "And that's on everything.", 'No more fucks to give, period.', 'Man, miss me with that bullshit.', 'Respectfully, go unfuck yourself.'],
    fillers: ['you know what I\'m sayin\'', 'deadass', 'lowkey', 'for real though', 'no lie'],
    extra: []
  },
  {
    id: 'gangster', name: 'Gangster', tagline: 'Confident, tough, straight out of a street movie.',
    desc: 'Every sentence sounds like a scene. Confidence on ten, business handled, respect demanded.',
    exampleIn: 'Yo pops, can I make some coffee?',
    exampleOut: 'Ayy OG, lemme get that coffee brewin\'. I gotta get my mind right before I handle business, feel me?',
    speech: { rate: 0.95, pitch: 0.8 },
    openers: ['Ayy, listen here,', 'Check it,', 'Let me put you on game:', 'Understand this,', 'Ayy OG,', 'Look,'],
    closers: ['and that\'s word.', 'you dig?', 'handle your business.', 'respect.', 'on my word.', 'believe that.'],
    fillers: ['I\'m keepin\' it a buck', 'no disrespect, but', 'believe that', 'straight up'],
    extra: []
  },
  {
    id: 'og', name: 'OG', tagline: 'Old-school, wise, respected.',
    desc: 'The elder statesman. Slow, measured, and every line lands like advice you\'ll remember in twenty years.',
    exampleIn: 'Yo pops, can I make some coffee?',
    exampleOut: 'Listen here, young blood. A man don\'t start his day makin\' moves until that coffee hits his soul.',
    speech: { rate: 0.85, pitch: 0.7 },
    openers: ['Listen here, young blood.', 'Now look,', 'Let me school you real quick,', 'Son,', 'Hear me out,'],
    closers: ['and that\'s a lesson.', 'take that wisdom with you.', 'the game taught me that.', 'remember that.', 'that\'s how it\'s always been.'],
    fillers: ['mark my words', 'trust me on this one', 'I\'ve seen it all', 'back in my day'],
    extra: []
  },
  {
    id: 'funny', name: 'Funny Hood', tagline: 'Exaggerated and hilarious.',
    desc: 'Everything is a joke and the joke is always too much. Absurd comparisons, zero chill, maximum laughs.',
    exampleIn: 'Yo pops, can I make some coffee?',
    exampleOut: 'Yo unc, I\'m tryna secure me a cup of that black gold before my brain start filing for unemployment.',
    speech: { rate: 1.1, pitch: 1.25 },
    openers: ['Yo, hold up,', 'Aight, so boom,', 'Bruh, listen,', 'Okay, picture this:', 'Yo, I\'m cryin\', but'],
    closers: ['and that\'s on my last brain cell.', 'I\'m weak.', 'I can\'t make this up.', 'bro, I\'m cryin\'.', 'somebody come get me.'],
    fillers: ['I\'m talkin\'', 'no, for real,', 'and I mean that'],
    extra: []
  },
  {
    id: 'crashout', name: 'Crash-Out', tagline: 'Over-the-top aggressive over absolutely nothing.',
    desc: 'Somebody left the milk out and now it\'s a whole situation. Maximum drama, minimum reason. All caps at high intensity.',
    exampleIn: 'Yo pops, can I make some coffee?',
    exampleOut: 'AYO, WHO GOT THE COFFEE POT?! I AIN\'T ABOUT TO RAW-DOG THIS MORNING WITH NO CAFFEINE IN MY SYSTEM!',
    speech: { rate: 1.15, pitch: 0.7 },
    openers: ['AYO,', 'NAH, BECAUSE WHAT?!', 'LISTEN. LISTEN.', 'OH, SO WE JUST DOIN\' ANYTHING NOW?', 'BRO, I SWEAR,'],
    closers: ['I\'M NOT PLAYING!', 'AND THAT\'S ON EVERYTHING!', 'I SWEAR ON MY LIFE!', 'DO YOU HEAR ME?!', 'I\'M TIRED OF THIS!'],
    fillers: ['I\'M SERIOUS', 'RIGHT NOW', 'I MEAN IT'],
    extra: []
  },
  {
    id: 'savage', name: 'Savage', tagline: 'Smart-ass, ruthless comebacks.',
    desc: 'Every reply is a roast. Dry, unbothered, and somehow always right. Feelings were not consulted.',
    exampleIn: 'You are really annoying.',
    exampleOut: 'Oh, cute. You\'re annoying and somehow still proud of it. Congrats on the consistency, I guess.',
    speech: { rate: 1.05, pitch: 0.9 },
    openers: ['Oh, cute.', 'Wow. Groundbreaking.', 'Let me guess,', 'Bless your heart,', 'Oh, you\'re serious?'],
    closers: ['and what about it?', 'cry about it.', 'stay mad.', 'anyway.', 'next.', 'congrats on that, I guess.'],
    fillers: ['obviously', 'somehow', 'shocking, I know'],
    extra: []
  },
  {
    id: 'poet', name: 'Street Poet', tagline: 'Ordinary statements, dramatic and poetic.',
    desc: 'The corner store becomes a cathedral. Every errand is an epic, every morning a verse. Beautiful and extra.',
    exampleIn: 'I am going to the store to buy some food.',
    exampleOut: 'Beneath the neon and the noise, I walk toward the corner store — a pilgrim in search of bread, chasing the small holy hunger of the evening.',
    speech: { rate: 0.8, pitch: 1.1 },
    openers: ['In the cathedral of the everyday,', 'Listen — the streets hum a low song,', 'Beneath the neon and the noise,', 'The city exhales, and'],
    closers: ['and the city keeps its secrets.', 'such is the gospel of the pavement.', 'the night remembers everything.', 'and the morning forgives it all.'],
    fillers: ['like a psalm', 'in the hush between sirens'],
    extra: []
  },
  {
    id: 'authentic', name: 'Authentic', tagline: 'Subtle slang, natural delivery, no forced stereotypes.',
    desc: 'Just how people actually talk. A little flavor, nothing forced, nothing performed. The real one.',
    exampleIn: 'I am going to the store to buy some food.',
    exampleOut: 'Honestly, I\'m about to run to the store and grab some food real quick.',
    speech: { rate: 1.0, pitch: 1.0 },
    openers: ['Honestly,', 'Real talk,', 'Look,', 'I mean,'],
    closers: ['you know?', 'that\'s it.', 'for real.', 'that\'s all.'],
    fillers: ['honestly', 'for real'],
    extra: []
  }
];

function getPersonality(id) {
  for (var i = 0; i < PERSONALITIES.length; i++) {
    if (PERSONALITIES[i].id === id) return PERSONALITIES[i];
  }
  return PERSONALITIES[0];
}

/* ---------- lexicon ----------
 * Phrase swaps run first (longest match wins), then word swaps.
 * Each entry: { re: /pattern/i (word-boundary), out: string | string[], heavy: bool }
 * heavy swaps only fire at intensity >= 4.
 * Keep replacements meaning-preserving; never swap proper nouns or numbers.
 */
var PHRASE_SWAPS = [
  { re: /\bcan i\b/gi, out: ['can a real one', 'can I', 'can your boy'], heavy: false },
  { re: /\bi need to\b/gi, out: ['I gotta', 'I need to', 'I\'m finna'], heavy: false },
  { re: /\bi am going to\b/gi, out: ['I\'m finna', 'I\'m about to', 'I\'m headed to'], heavy: false },
  { re: /\bi am\b/gi, out: ['I\'m', 'I be'], heavy: true },
  { re: /\byou are\b/gi, out: ['you\'re', 'you be'], heavy: true },
  { re: /\bgoing to the store\b/gi, out: ['slidin\' to the store', 'hittin\' the store', 'runnin\' to the store'], heavy: false },
  { re: /\bgoing to\b/gi, out: ['headed to', 'slidin\' to', 'pullin\' up to'], heavy: false },
  { re: /\bthank you\b/gi, out: ['appreciate you', 'good lookin\' out', 'much love'], heavy: false },
  { re: /\bthanks\b/gi, out: ['appreciate that', 'good looks', 'preesh'], heavy: false },
  { re: /\bgood morning\b/gi, out: ['mornin\'', 'what\'s good this mornin\'', 'rise and grind'], heavy: false },
  { re: /\bgood night\b/gi, out: ['goodnight, sleep tight', 'I\'m out, goodnight', 'catch you tomorrow'], heavy: false },
  { re: /\bwhat is up\b/gi, out: ['what\'s good', 'what\'s poppin\'', 'what it do'], heavy: false },
  { re: /\bwhat\'s up\b/gi, out: ['what\'s good', 'what\'s poppin\'', 'what it do'], heavy: false },
  { re: /\bi don\'t know\b/gi, out: ['I ain\'t got a clue', 'beats me', 'I couldn\'t tell you'], heavy: false },
  { re: /\bdo you know\b/gi, out: ['you know', 'you hip to'], heavy: true },
  { re: /\ba lot of\b/gi, out: ['a whole bunch of', 'hella', 'mad'], heavy: false },
  { re: /\ba little\b/gi, out: ['a lil\'', 'a tiny bit of'], heavy: false },
  { re: /\bright now\b/gi, out: ['right now', 'ASAP', 'on the spot'], heavy: false },
  { re: /\bmy friend\b/gi, out: ['my dawg', 'my homie', 'my guy'], heavy: false },
  { re: /\bmy friends\b/gi, out: ['my dawgs', 'the homies', 'my folks'], heavy: false },
  { re: /\bbest friend\b/gi, out: ['day one', 'my ace', 'my right hand'], heavy: false },
  { re: /\bmy brother\b/gi, out: ['my bro', 'big bro', 'my dog'], heavy: false },
  { re: /\bmy sister\b/gi, out: ['my sis', 'lil\' sis', 'big sis'], heavy: false },
  { re: /\bmy father\b/gi, out: ['pops', 'my old man'], heavy: false },
  { re: /\bmy dad\b/gi, out: ['pops', 'my old man'], heavy: false },
  { re: /\bmy mother\b/gi, out: ['moms', 'mama'], heavy: false },
  { re: /\bmy mom\b/gi, out: ['moms', 'mama'], heavy: false },
  { re: /\bvery good\b/gi, out: ['fire', 'straight heat', 'top tier'], heavy: false },
  { re: /\breally good\b/gi, out: ['fire', 'straight heat'], heavy: false },
  { re: /\bvery tired\b/gi, out: ['wiped out', 'cooked', 'dead'], heavy: false },
  { re: /\bso tired\b/gi, out: ['wiped out', 'cooked', 'dead'], heavy: false },
  { re: /\bget some sleep\b/gi, out: ['knock out', 'catch some Z\'s', 'shut it down'], heavy: false },
  { re: /\bgo to sleep\b/gi, out: ['knock out', 'hit the hay', 'shut it down'], heavy: false },
  { re: /\bmake some coffee\b/gi, out: ['brew some coffee', 'get that coffee brewin\'', 'whip up some coffee'], heavy: false },
  { re: /\bsome coffee\b/gi, out: ['some coffee', 'some of that black gold', 'a cup of joe'], heavy: false },
  { re: /\bthe coffee\b/gi, out: ['the coffee', 'that black gold'], heavy: true },
  { re: /\bmoney\b/gi, out: ['bread', 'that bag', 'funds'], heavy: false },
  { re: /\bmy car\b/gi, out: ['my whip', 'my ride'], heavy: false },
  { re: /\bthe car\b/gi, out: ['the whip', 'the ride'], heavy: true },
  { re: /\bmy house\b/gi, out: ['my crib', 'my spot'], heavy: false },
  { re: /\bthe house\b/gi, out: ['the crib', 'the spot'], heavy: true },
  { re: /\bmy phone\b/gi, out: ['my phone', 'my jack'], heavy: true },
  { re: /\bthe phone\b/gi, out: ['the phone', 'the jack'], heavy: true },
  { re: /\bfood\b/gi, out: ['grub', 'chow'], heavy: false },
  { re: /\bbreakfast\b/gi, out: ['breakfast', 'morning grub'], heavy: true },
  { re: /\bdinner\b/gi, out: ['dinner', 'evening grub'], heavy: true },
  { re: /\bwork\b/gi, out: ['grind', 'work', 'hustle'], heavy: false },
  { re: /\bmy boss\b/gi, out: ['the big homie', 'my boss', 'the head honcho'], heavy: false },
  { re: /\bthe boss\b/gi, out: ['the big homie', 'the head honcho'], heavy: true },
  { re: /\bschool\b/gi, out: ['school', 'classes'], heavy: true },
  { re: /\bthe gym\b/gi, out: ['the gym', 'the iron palace'], heavy: true },
  { re: /\bmy shoes\b/gi, out: ['my kicks', 'my shoes'], heavy: false },
  { re: /\bshoes\b/gi, out: ['kicks', 'shoes'], heavy: true },
  { re: /\bclothes\b/gi, out: ['fit', 'clothes', 'drip'], heavy: false },
  { re: /\bawesome\b/gi, out: ['fire', 'lit', 'hard'], heavy: false },
  { re: /\bamazing\b/gi, out: ['crazy fire', 'unreal', 'insane'], heavy: false },
  { re: /\bboring\b/gi, out: ['dry', 'mid', 'a snoozefest'], heavy: false },
  { re: /\bstupid\b/gi, out: ['dumb', 'goofy', 'clownish'], heavy: false },
  { re: /\bangry\b/gi, out: ['heated', 'big mad', 'pressed'], heavy: false },
  { re: /\bhappy\b/gi, out: ['lit', 'in my bag', 'feelin\' good'], heavy: false },
  { re: /\bsad\b/gi, out: ['down bad', 'in my feelings'], heavy: false },
  { re: /\bcool\b/gi, out: ['smooth', 'chill', 'solid'], heavy: false },
  { re: /\bgreat\b/gi, out: ['fire', 'lit', 'solid'], heavy: false },
  { re: /\bnice\b/gi, out: ['clean', 'smooth', 'dope'], heavy: false },
  { re: /\bexcellent\b/gi, out: ['top tier', 'elite', 'flawless'], heavy: false },
  { re: /\bbad\b/gi, out: ['trash', 'mid', 'wack'], heavy: false },
  { re: /\bterrible\b/gi, out: ['straight trash', 'garbage', 'a disaster'], heavy: false },
  { re: /\bannoying\b/gi, out: ['mad annoying', 'getting on my nerves', 'a whole headache'], heavy: false },
  { re: /\bunderstand\b/gi, out: ['feel me', 'catch my drift', 'hear you'], heavy: false },
  { re: /\breally\b/gi, out: ['for real', 'deadass', 'lowkey'], heavy: false },
  { re: /\bplease\b/gi, out: ['do me a solid,', 'please', 'if you could,'], heavy: false },
  { re: /\bsorry\b/gi, out: ['my fault', 'my mistake'], heavy: false },
  { re: /\bhello\b/gi, out: ['what\'s good', 'yo', 'aye'], heavy: false },
  { re: /\bhey\b/gi, out: ['yo', 'aye', 'what\'s good'], heavy: false },
  { re: /\byes\b/gi, out: ['facts', 'hell yeah', 'fo\' sho\''], heavy: false },
  { re: /\bno\b/gi, out: ['nah', 'hell nah', 'nope'], heavy: false },
  { re: /\bman\b/gi, out: ['bro', 'fam', 'my guy'], heavy: true },
  { re: /\bbrother\b/gi, out: ['bro', 'my guy'], heavy: true },
  { re: /\bdude\b/gi, out: ['bro', 'fam', 'my guy'], heavy: false },
  { re: /\bguy\b/gi, out: ['dude', 'homie', 'cat'], heavy: true },
  { re: /\bguys\b/gi, out: ['y\'all', 'everybody'], heavy: false },
  { re: /\bpeople\b/gi, out: ['folks'], heavy: false },
  { re: /\bchild\b/gi, out: ['lil\' one', 'shorty'], heavy: true },
  { re: /\bkids\b/gi, out: ['little ones', 'shorties'], heavy: true },
  { re: /\bthe police\b/gi, out: ['the boys in blue', '12', 'the law'], heavy: false },
  { re: /\bpolice\b/gi, out: ['12', 'boys'], heavy: false },
  { re: /\bthe cops\b/gi, out: ['12', 'the boys in blue'], heavy: false },
  { re: /\bcops\b/gi, out: ['12', 'boys'], heavy: false },
  { re: /\bjob\b/gi, out: ['gig', '9-to-5', 'work'], heavy: false },
  { re: /\bmeeting\b/gi, out: ['link-up', 'sit-down', 'meeting'], heavy: false },
  { re: /\breport\b/gi, out: ['paperwork'], heavy: true },
  { re: /\bemail\b/gi, out: ['inbox'], heavy: true },
  { re: /\btext\b/gi, out: ['text', 'message'], heavy: true },
  { re: /\bmessage\b/gi, out: ['message', 'hit-up'], heavy: true },
  { re: /\bwait\b/gi, out: ['hold up', 'chill', 'wait'], heavy: false },
  { re: /\blook at\b/gi, out: ['peep', 'check out'], heavy: false },
  { re: /\blook\b/gi, out: ['look', 'check'], heavy: true },
  { re: /\bsee\b/gi, out: ['peep', 'see'], heavy: true },
  { re: /\btalk\b/gi, out: ['chop it up', 'talk', 'holla'], heavy: false },
  { re: /\btalking\b/gi, out: ['yappin\'', 'talkin\'', 'runnin\' your mouth'], heavy: true },
  { re: /\bsleep\b/gi, out: ['sleep', 'shut-eye'], heavy: false },
  { re: /\bwake up\b/gi, out: ['rise up', 'rise and shine', 'roll out'], heavy: false },
  { re: /\bdrive\b/gi, out: ['slide', 'cruise', 'push the whip'], heavy: true },
  { re: /\bwalking\b/gi, out: ['strollin\'', 'movin\'', 'on foot'], heavy: true },
  { re: /\brunning late\b/gi, out: ['behind schedule', 'mad late', 'running behind'], heavy: false },
  { re: /\byour car\b/gi, out: ['your whip', 'your ride'], heavy: false },
  { re: /\brunning\b/gi, out: ['bookin\' it', 'movin\' fast'], heavy: true },
  { re: /\beat\b/gi, out: ['chow down', 'smash', 'dig in'], heavy: true },
  { re: /\beating\b/gi, out: ['whoopin\'', 'smokin\''], heavy: true },
  { re: /\bwin\b/gi, out: ['take the W', 'come out on top'], heavy: false },
  { re: /\blose\b/gi, out: ['take the L', 'catch an L'], heavy: false },
  { re: /\bwon\b/gi, out: ['took the W', 'came out on top'], heavy: false },
  { re: /\blost\b/gi, out: ['took an L', 'caught an L'], heavy: false },
  { re: /\blove\b/gi, out: ['rock with', 'mess with', 'love'], heavy: false },
  { re: /\bhate\b/gi, out: ['can\'t stand', 'ain\'t rockin\' with', 'despise'], heavy: false },
  { re: /\bwant\b(?! to)/gi, out: ['need', 'want', 'gotta have'], heavy: false },
  { re: /\bneed\b(?! to)/gi, out: ['gotta have', 'need'], heavy: true },
  { re: /\bget it\b/gi, out: ['feel you', 'I hear you', 'got you'], heavy: false },
  { re: /\bget\b(?! to)/gi, out: ['secure', 'cop', 'grab'], heavy: true },
  { re: /\bgot\b(?! to)/gi, out: ['got', 'secured', 'copped'], heavy: true },
  { re: /\bgive\b/gi, out: ['pass', 'hand over'], heavy: true },
  { re: /\bhelp me\b/gi, out: ['hold me down', 'look out for me', 'help me'], heavy: false },
  { re: /\bhelp\b/gi, out: ['help', 'look out'], heavy: false },
  { re: /\bthink\b/gi, out: ['reckon', 'figure', 'think'], heavy: true },
  { re: /\bknow\b/gi, out: ['know'], heavy: true },
  { re: /\bsay\b/gi, out: ['say'], heavy: true },
  { re: /\btell me\b/gi, out: ['let me know', 'put me on', 'tell me'], heavy: false },
  { re: /\btell\b/gi, out: ['tell'], heavy: true },
  { re: /\bcome on\b/gi, out: ['come on', 'let\'s go'], heavy: false },
  { re: /\bcome\b/gi, out: ['pull up', 'slide through', 'come'], heavy: false },
  { re: /\bgo home\b/gi, out: ['head home', 'bounce home', 'slide home'], heavy: false },
  { re: /\bgo\b(?! to sleep)/gi, out: ['slide', 'bounce', 'head out'], heavy: true },
  { re: /\bleave\b/gi, out: ['bounce', 'dip', 'head out'], heavy: false },
  { re: /\bstay\b/gi, out: ['post up', 'chill', 'stay'], heavy: true },
  { re: /\bpay me\b/gi, out: ['run me', 'drop that', 'pay me'], heavy: false },
  { re: /\bpay\b/gi, out: ['pay', 'drop'], heavy: true },
  { re: /\bbuy\b/gi, out: ['cop', 'grab', 'secure'], heavy: false },
  { re: /\bsell\b/gi, out: ['move', 'flip', 'sell'], heavy: true },
  { re: /\btired\b/gi, out: ['dead tired', 'cooked', 'wiped out'], heavy: false },
  { re: /\bhungry\b/gi, out: ['starving', 'ready to eat a whole buffet', 'famished'], heavy: false },
  { re: /\bthirsty\b/gi, out: ['parched', 'mad thirsty', 'dry'], heavy: true },
  { re: /\bbroke\b/gi, out: ['down bad', 'flat broke', 'dead broke'], heavy: false },
  { re: /\brich\b/gi, out: ['paid', 'living large', 'up'], heavy: false },
  { re: /\bexpensive\b/gi, out: ['pricey', 'mad expensive', 'steep'], heavy: false },
  { re: /\bcheap\b/gi, out: ['dirt cheap', 'mad cheap'], heavy: true },
  { re: /\bhot\b/gi, out: ['blazing', 'scorching', 'hot as hell'], heavy: true },
  { re: /\bcold\b/gi, out: ['freezing', 'cold as hell', 'icy'], heavy: true },
  { re: /\bbig\b/gi, out: ['huge', 'massive', 'big as hell'], heavy: true },
  { re: /\bsmall\b/gi, out: ['lil\'', 'tiny', 'itty-bitty'], heavy: true },
  { re: /\bquick\b/gi, out: ['real quick', 'quick as hell', 'fast'], heavy: true },
  { re: /\bslow\b/gi, out: ['dead slow', 'mad slow', 'snail-paced'], heavy: true },
  { re: /\bnow\b/gi, out: ['right now', 'ASAP', 'this minute'], heavy: true },
  { re: /\btoday\b/gi, out: ['today'], heavy: true },
  { re: /\btomorrow\b/gi, out: ['tomorrow', 'in the morning'], heavy: true },
  { re: /\byesterday\b/gi, out: ['yesterday', 'back then'], heavy: true },
  { re: /\balways\b/gi, out: ['always'], heavy: true },
  { re: /\bnever\b/gi, out: ['never'], heavy: true },
  { re: /\beverything\b/gi, out: ['the whole situation', 'all of it', 'everything'], heavy: true },
  { re: /\bnothing\b/gi, out: ['not a thing', 'zero', 'nada'], heavy: true },
  { re: /\bsomething\b/gi, out: ['something', 'a little something'], heavy: true },
  { re: /\bserious\b/gi, out: ['dead serious', 'mad serious'], heavy: false },
  { re: /\bjoking\b/gi, out: ['playin\'', 'messin\' around', 'cappin\''], heavy: false },
  { re: /\btruth\b/gi, out: ['real', 'facts', 'gospel'], heavy: true },
  { re: /\blie\b/gi, out: ['cap', 'a whole lie', 'fiction'], heavy: false },
  { re: /\blying\b/gi, out: ['cappin\'', 'straight lying'], heavy: false },
  { re: /\bshut up\b/gi, out: ['pipe down', 'hush', 'zip it'], heavy: false },
  { re: /\bwhatever\b/gi, out: ['whatever'], heavy: false },
  { re: /\bokay\b/gi, out: ['aight', 'bet', 'cool'], heavy: false },
  { re: /\bok\b/gi, out: ['aight', 'cool', 'straight'], heavy: false },
  { re: /\bsure\b/gi, out: ['fo\' sho\'', 'for sure', 'you know it'], heavy: false },
  { re: /\bmaybe\b/gi, out: ['maybe', 'possibly', 'we\'ll see'], heavy: true },
  { re: /\bdefinitely\b/gi, out: ['definitely', 'for sure'], heavy: false },
  { re: /\bprobably\b/gi, out: ['more than likely', 'probably', 'most likely'], heavy: true }
];

/* Reverse map for "translate back to normal English". */
var REVERSE_SWAPS = [
  [/a cup of joe/gi, 'a cup of coffee'], [/cup of joe/gi, 'cup of coffee'],
  [/big dawg/gi, 'friend'], [/big homie/gi, 'friend'], [/youngin/gi, 'young person'],
  [/liquid motivation/gi, 'coffee'], [/handle business/gi, 'take care of business'],
  [/\bi'ma\b/gi, 'I am going to'], [/your whip/gi, 'your car'],
  [/black gold/gi, 'coffee'], [/that bag/gi, 'the money'], [/\bbread\b/gi, 'money'],
  [/my whip/gi, 'my car'], [/the whip/gi, 'the car'], [/my ride/gi, 'my car'],
  [/the ride/gi, 'the car'], [/my crib/gi, 'my house'], [/the crib/gi, 'the house'],
  [/my spot/gi, 'my place'], [/the spot/gi, 'the place'], [/\bgrub\b/gi, 'food'],
  [/my dawg/gi, 'my friend'], [/my dawgs/gi, 'my friends'], [/the homies/gi, 'my friends'],
  [/my homie/gi, 'my friend'], [/my guy/gi, 'my friend'], [/day one/gi, 'best friend'],
  [/my ace/gi, 'my best friend'], [/\bpops\b/gi, 'dad'], [/\bmama\b/gi, 'mom'], [/\bmoms\b/gi, 'mom'],
  [/my old man/gi, 'my dad'], [/fo' sho'/gi, 'definitely'], [/no cap/gi, 'seriously'],
  [/\bdeadass\b/gi, 'seriously'], [/\blowkey\b/gi, 'a little'], [/for real/gi, 'really'],
  [/on god/gi, 'I swear'], [/you feel me\?/gi, 'do you understand?'],
  [/you dig\?/gi, 'do you understand?'], [/\bfinna\b/gi, 'going to'],
  [/\btryna\b/gi, 'trying to'], [/\blemme\b/gi, 'let me'], [/\bgonna\b/gi, 'going to'],
  [/\bwanna\b/gi, 'want to'], [/\bgotta\b/gi, 'have to'], [/\bain't\b/gi, 'is not'],
  [/\by'all\b/gi, 'you all'], [/\blil'/gi, 'little'], [/\bdope\b/gi, 'great'],
  [/\bfire\b/gi, 'great'], [/\blit\b/gi, 'great'], [/\btrash\b/gi, 'bad'], [/\bmid\b/gi, 'mediocre'],
  [/\bwack\b/gi, 'bad'], [/\bhella\b/gi, 'very'], [/\bmad\b/gi, 'very'],
  [/the grind/gi, 'work'], [/the hustle/gi, 'work'], [/the big homie/gi, 'the boss'],
  [/the head honcho/gi, 'the boss'], [/good lookin' out/gi, 'thank you'],
  [/good looks/gi, 'thanks'], [/\bpreesh\b/gi, 'thanks'], [/my bad/gi, 'sorry'],
  [/my fault/gi, 'sorry'], [/what's good/gi, 'hello'], [/what's poppin'/gi, 'hello'],
  [/what it do/gi, 'hello'], [/\bslidin'/gi, 'going'], [/pullin' up/gi, 'coming'],
  [/slide through/gi, 'come by'], [/pull up/gi, 'come'], [/\bbounce\b/gi, 'leave'],
  [/\bdip\b/gi, 'leave'], [/post up/gi, 'stay'], [/\bcop\b/gi, 'buy'], [/\bcopped\b/gi, 'bought'],
  [/\bsecure\b/gi, 'get'], [/\bsecured\b/gi, 'got'], [/take the w/gi, 'win'],
  [/took the w/gi, 'won'], [/take the l/gi, 'lose'], [/took an l/gi, 'lost'],
  [/caught an l/gi, 'lost'], [/catch an l/gi, 'lose'], [/down bad/gi, 'in a bad way'],
  [/running on fumes/gi, 'very tired'], [/dead tired/gi, 'very tired'],
  [/\bcooked\b/gi, 'exhausted'], [/knock out/gi, 'sleep'], [/catch some z's/gi, 'sleep'],
  [/chow down/gi, 'eat'], [/\bsmash\b/gi, 'eat'], [/chop it up/gi, 'talk'],
  [/\bholla\b/gi, 'talk'], [/\bpeep\b/gi, 'see'], [/rock with/gi, 'like'],
  [/mess with/gi, 'like'], [/can't stand/gi, 'dislike'],
  [/ain't rockin' with/gi, 'do not like'], [/the 9-to-5/gi, 'the job'],
  [/the gig/gi, 'the job'], [/the paperwork/gi, 'the report'],
  [/a link-up/gi, 'a meeting'], [/the sit-down/gi, 'the meeting'],
  [/a whole bag/gi, 'a lot of money'], [/pockets on e/gi, 'broke'],
  [/stomach on e/gi, 'hungry'], [/\bkicks\b/gi, 'shoes'], [/the fit/gi, 'clothes'],
  [/the drip/gi, 'clothes'], [/top tier/gi, 'excellent'], [/\belite\b/gi, 'excellent'],
  [/straight heat/gi, 'very good'], [/crazy fire/gi, 'amazing'],
  [/a snoozefest/gi, 'boring'], [/\bgoofy\b/gi, 'silly'], [/\bclownish\b/gi, 'silly'],
  [/\bheated\b/gi, 'angry'], [/big mad/gi, 'very angry'], [/\bpressed\b/gi, 'angry'],
  [/in my bag/gi, 'happy'], [/in my feelings/gi, 'sad'],
  [/the real/gi, 'the truth'], [/\bcap\b/gi, 'lie'], [/\bcappin'/gi, 'lying'],
  [/pipe down/gi, 'be quiet'], [/zip it/gi, 'be quiet'], [/\baight\b/gi, 'okay'],
  [/\bbet\b/gi, 'okay'], [/say less/gi, 'okay'], [/one hundred percent/gi, 'definitely'],
  [/what's crackin'/gi, "what's happening"], [/mornin'/gi, 'morning'],
  [/keep it solid/gi, 'take care'], [/that's the move/gi, "that's right"],
  [/what's the word/gi, "what's up"], [/on the set/gi, 'for real'],
  [/a brother need/gi, 'I need'],
  [/no doubt/gi, 'definitely'], [/more than likely/gi, 'probably'],
  [/not a thing/gi, 'nothing'], [/the whole situation/gi, 'everything'],
  [/every single time/gi, 'always'], [/never in a million years/gi, 'never'],
  [/\bchill\b/gi, 'relax'], [/hold up/gi, 'wait'], [/my jack/gi, 'my phone'],
  [/the jack/gi, 'the phone'], [/\b12\b/gi, 'the police'],
  [/the boys in blue/gi, 'the police'], [/the law/gi, 'the police'],
  [/them classes/gi, 'school'], [/the iron palace/gi, 'the gym'],
  [/a tiny bit of/gi, 'a little'], [/a whole bunch of/gi, 'a lot of'],
  [/a lil'/gi, 'a little'], [/\bbe\b/gi, 'are']
];

/* ---------- sentence handling ---------- */
function splitSentences(text) {
  var out = [];
  var re = /[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g;
  var m;
  while ((m = re.exec(text)) !== null) {
    var s = m[0].trim();
    if (s) out.push(s);
  }
  return out.length ? out : [text];
}

function isQuestion(s) {
  var t = s.trim();
  if (/\?\s*$/.test(t)) return true;
  return /^(can|could|will|would|should|do|does|did|is|are|was|were|what|why|when|where|who|how|am|have|has|may|might)\b/i.test(t);
}

function applySwap(text, entry, rng, p) {
  if (!chance(rng, p)) return text;
  var out = Array.isArray(entry.out) ? pick(rng, entry.out) : entry.out;
  entry.re.lastIndex = 0;
  return text.replace(entry.re, function (match) {
    // Preserve leading capitalisation.
    if (/^[A-Z]/.test(match)) return capFirst(out);
    return out;
  });
}

function slangDensity(text) {
  var markers = ['finna', 'tryna', 'lemme', 'dawg', 'homie', 'whip', 'crib', 'bread',
    'grub', 'no cap', 'deadass', 'lowkey', 'for real', 'on god', 'you feel me',
    'pops', 'black gold', 'fire', 'lit', 'dope', 'bruh', 'y\'all', 'fo\' sho\'',
    'aight', 'bet', 'cap', 'mad', 'hella', 'yo', 'aye', 'bro', 'fam', 'og',
    'young blood', 'the grind', 'kicks', 'the fit', 'copped', 'slide', 'pull up'];
  /* Tokenise first so 'yo' does not match inside 'young', etc. */
  var words = String(text).toLowerCase().replace(/[^a-z0-9'\s-]/g, ' ').split(/\s+/).filter(Boolean);
  var joined = ' ' + words.join(' ') + ' ';
  var hits = 0;
  for (var i = 0; i < markers.length; i++) {
    if (joined.indexOf(' ' + markers[i] + ' ') !== -1) hits++;
  }
  return hits;
}

/* Flavour density: slang markers + personality-specific openers/closers/
 * fillers present. Intensity raises this for every personality — for OG the
 * flavour is wisdom framing, not just slang words. */
function flavorDensity(text, personality) {
  var p = getPersonality(personality);
  var count = slangDensity(text);
  var low = ' ' + String(text).toLowerCase().replace(/[^a-z0-9'\s-]/g, ' ').replace(/\s+/g, ' ') + ' ';
  var phrases = p.openers.concat(p.closers, p.fillers);
  for (var i = 0; i < phrases.length; i++) {
    var ph = phrases[i].toLowerCase().replace(/[^a-z0-9'\s-]/g, ' ').replace(/\s+/g, ' ').trim();
    if (ph && low.indexOf(' ' + ph + ' ') !== -1) count++;
  }
  return count;
}

/* Funny Hood absurd comparisons (intensity-gated). */
var FUNNY_COMPARISONS = [
  'like my brain just filed for unemployment',
  'like my WiFi went out mid-download',
  'like I just watched my last dollar walk out the door',
  'like somebody unplugged my whole life',
  'like my phone died at 1% with no charger in sight',
  'like the elevator music stopped and everybody looked at me',
  'like I showed up to a potluck with an empty plate',
  'like my alarm clock betrayed me in my sleep'
];

var POET_IMAGES = [
  'the neon signs hum their electric hymns',
  'the pavement holds the footprints of a thousand small dreams',
  'the streetlights bloom like tired stars',
  'the morning breaks open like a cracked egg of gold',
  'the city breathes in, slow and heavy with stories',
  'the rain taps its fingers on the rooftops, impatient'
];

var CRASHOUT_ESCALATIONS = [
  'THIS IS A CRISIS.',
  'I CANNOT BELIEVE THIS IS MY LIFE RIGHT NOW.',
  'SOMEBODY CALL SOMEBODY, BECAUSE I AM DONE.',
  'I DID NOT WAKE UP FOR THIS.',
  'THIS IS THE LAST STRAW AND I HAVE HAD IT.'
];

var SAVAGE_TWISTS = [
  'Congrats on stating the obvious, truly groundbreaking work.',
  'And yet here we are, listening to this like it matters.',
  'Somehow you said all that and still said nothing.',
  'Brave of you to say that out loud with your whole chest.',
  'Wow, tell me more about how little you know.'
];

/* ---------- core translation ---------- */
function translateSentence(sentence, personality, intensity, rng, nfg) {
  var p = getPersonality(personality);
  var inten = clamp(Math.round(intensity) || 5, 1, 10);
  var text = sentence.trim();
  if (!text) return '';

  /* Hood Talk is the flagship voice: intent-aware rewriting, not swaps. */
  if (p.id === 'hood') return translateHoodTalk(sentence, intensity, rng, nfg);

  var question = isQuestion(text);
  var trailingPunct = /[.!?]+$/.test(text) ? text.match(/[.!?]+$/)[0] : '.';
  var core = text.replace(/[.!?]+\s*$/, '');

  /* Slang density: intensity 1 ~ light, 10 ~ nearly every swappable word. */
  var swapP = clamp(0.12 + inten * 0.085, 0, 0.95);

  /* Phrase/word swaps. Heavy swaps only at intensity >= 4. */
  for (var i = 0; i < PHRASE_SWAPS.length; i++) {
    var entry = PHRASE_SWAPS[i];
    if (entry.heavy && inten < 4) continue;
    core = applySwap(core, entry, rng, swapP);
  }

  /* Personality-specific flavour. Track whether an extra sentence was
   * appended after the core sentence (affects closer punctuation). */
  var extraAppended = false;
  if (p.id === 'og' && chance(rng, 0.35 + inten * 0.03)) {
    core = core.replace(/^/i, '');
    if (!/young blood/i.test(core) && chance(rng, 0.6)) {
      var fw = core.split(' ')[0];
      var loweredFw = /^I('|$)/.test(fw) ? fw : fw.charAt(0).toLowerCase() + fw.slice(1);
      core = 'young blood, ' + loweredFw + core.slice(fw.length);
    }
  }
  if (p.id === 'poet' && inten >= 4 && chance(rng, 0.5)) {
    core = core + ', ' + pick(rng, POET_IMAGES);
  }
  if (p.id === 'funny' && inten >= 4 && chance(rng, 0.55)) {
    core = core + ' ' + pick(rng, FUNNY_COMPARISONS);
  }
  if (p.id === 'crashout' && inten >= 5 && chance(rng, 0.6)) {
    core = core + '. ' + pick(rng, CRASHOUT_ESCALATIONS);
    extraAppended = true;
  }
  if (p.id === 'savage' && chance(rng, 0.45 + inten * 0.02)) {
    core = core + '. ' + pick(rng, SAVAGE_TWISTS);
    extraAppended = true;
  }
  if (p.id === 'gangster' && inten >= 4 && chance(rng, 0.4)) {
    core = core + ' — I gotta get my mind right first';
  }

  /* Filler as a trailing aside (never spliced mid-sentence — that reads broken). */
  if (p.fillers.length && inten >= 3 && chance(rng, 0.25 + inten * 0.03)) {
    core = core.replace(/[.,;:]\s*$/, '') + ', ' + pick(rng, p.fillers).replace(/,\s*$/, '');
  }

  /* Opener / closer, gated by intensity. */
  var useOpener = inten >= 2 && chance(rng, 0.25 + inten * 0.06);
  var useCloser = inten >= 3 && chance(rng, 0.2 + inten * 0.06);
  if (useOpener) {
    /* Never lowercase a leading "I" / "I'm" / "I've" — it always stays capital. */
    var firstWord = core.split(' ')[0];
    var rest = core.slice(firstWord.length);
    var lowered = /^I('|$)/.test(firstWord) ? firstWord : firstWord.charAt(0).toLowerCase() + firstWord.slice(1);
    core = pick(rng, p.openers) + ' ' + lowered + rest;
  }
  var closerText = '';
  if (useCloser) closerText = pick(rng, p.closers);
  if (closerText) {
    if (question && !extraAppended) {
      /* A closer on a question reads best as its own sentence after it. */
      core = core.replace(/[.,;:]\s*$/, '') + '? ' + capFirst(closerText.replace(/[.!?]+\s*$/, ''));
    } else if (question) {
      core = core.replace(/[.,;:]\s*$/, '') + '. ' + capFirst(closerText.replace(/[.!?]+\s*$/, ''));
    } else {
      core = core.replace(/[.,;:]\s*$/, '') + ', ' + closerText.charAt(0).toLowerCase() + closerText.slice(1);
    }
  }

  /* Final punctuation: questions keep '?'; a question + closer ends with
   * the closer's own punctuation; statements keep '!' if they had one. */
  var endPunct;
  if (closerText) {
    /* The closer's own punctuation wins ('you feel me?' stays a question). */
    endPunct = /\?$/.test(closerText) ? '?' : (/!$/.test(closerText) ? '!' : '.');
  } else if (question) {
    endPunct = '?';
  } else {
    endPunct = (trailingPunct === '!' ? '!' : '.');
  }
  var out = capFirst(core.replace(/[.!?]+\s*$/, '')) + endPunct;

  /* Crash-Out: caps scale with intensity. */
  if (p.id === 'crashout') {
    if (inten >= 7) {
      out = out.toUpperCase();
      if (!/[!?]$/.test(out)) out = out.replace(/\.$/, '!'); else if (chance(rng, 0.5)) out += '!';
    } else if (inten >= 4) {
      out = out.replace(/\b(who|what|why|how|no|not|never|ain't)\b/gi, function (m) { return m.toUpperCase(); });
      if (chance(rng, 0.5)) out = out.replace(/\.$/, '!');
    }
  }
  /* Savage: dry delivery, keep case normal but add bite via punctuation. */
  if (p.id === 'savage' && inten >= 6 && chance(rng, 0.4)) {
    out = out.replace(/\.$/, '. Wow.');
  }
  return out;
}

/* ---------- Hood Talk v2: intent-aware sentence rewriting ----------
 * Hood Talk is the flagship voice. It does NOT run the generic lexicon
 * swaps: it parses the sentence's intent, revoices the core clause, and
 * rebuilds the line as natural conversation — opener + revoiced payload
 * + optional reason clause + closer. Content words from the input always
 * survive; the voice comes from the sentence shape, not from stuffing
 * slang words into the same old sentence.
 */

/* ---------- Hood Talk v3: Blood-style on-set voice ----------
 * Hood Talk is the flagship voice. It does NOT run the generic lexicon
 * swaps: it parses the sentence's intent, revoices the core clause, and
 * rebuilds the line as natural conversation — opener + check-in +
 * revoiced payload + reason clause + closer. Content words from the
 * input always survive; the voice comes from the sentence shape, not
 * from stuffing slang words into the same old sentence.
 *
 * Rotation rules (the whole point of v3): no single filler may dominate.
 * Openers/closers/check-ins/reasons/tags are picked fresh — never the
 * same one twice in a row (module-level HOOD_LAST) — and a signature
 * phrase ("on the set", "handle business", "feel me"...) never appears
 * twice in one output. "that's just how it is" is gone for good.
 */

/* Intensity tiers: light (1-3) is a little flavor over plain talk,
 * medium (4-7) is the clear gangsta voice, full (8-10) is on-set
 * energy — maximum attitude, exclamations, the whole shabang. */
function hoodTier(inten) {
  if (inten <= 3) return 'light';
  if (inten <= 7) return 'medium';
  return 'full';
}
var HOOD_TIER_PARAMS = {
  light:  { opener: 0.30, closer: 0.20, checkin: 0,    reason: 0,    revoice: 0.35, tag: 0,    orWhat: 0 },
  medium: { opener: 0.70, closer: 0.50, checkin: 0.35, reason: 0.45, revoice: 0.65, tag: 0.40, orWhat: 0.25 },
  full:   { opener: 0.95, closer: 0.80, checkin: 0.65, reason: 1.00, revoice: 1.00, tag: 0.70, orWhat: 0.70 }
};

/* Back-to-back rotation memory: the last opener/closer/check-in/
 * reason/tag used, so consecutive generations never repeat one. */
var HOOD_LAST = { opener: '', closer: '', checkin: '', reason: '', tag: '' };
function hoodPick(rng, arr, key) {
  var pool = arr;
  if (key && HOOD_LAST[key] && arr.length > 1) {
    pool = arr.filter(function (x) { return x !== HOOD_LAST[key]; });
    if (!pool.length) pool = arr;
  }
  var v = pick(rng, pool);
  if (key) HOOD_LAST[key] = v;
  return v;
}

/* Signature phrases: a phrase from this list may appear at most once
 * per output. Candidates sharing one with the assembled body are
 * filtered out before picking. */
var HOOD_SIG = ['handle business', 'business to handle', 'on the set', 'moves to make', 'feel me', 'say less', 'you already know', "what's crackin'", 'keep it solid', "that's the move", 'what\'s the word', 'what\'s good'];
function hoodSharesSig(a, b) {
  var la = String(a || '').toLowerCase(), lb = String(b || '').toLowerCase();
  for (var i = 0; i < HOOD_SIG.length; i++) {
    if (la.indexOf(HOOD_SIG[i]) !== -1 && lb.indexOf(HOOD_SIG[i]) !== -1) return true;
  }
  return false;
}
function hoodFilterSig(rng, arr, body, key) {
  var pool = arr.filter(function (x) { return !hoodSharesSig(x, body); });
  if (!pool.length) pool = arr.slice();
  return hoodPick(rng, pool, key);
}

/* Topic table: how common topics get revoiced, and what motivation
 * clause fits them. Only the first matching topic wins. The coffee
 * reasons all carry the signature "handle business on the set" — that
 * is the coffee move, every time, at full intensity. */
var HOOD_TOPICS = {
  coffee: {
    test: /\bcoffee\b/i,
    revoice: [
      [/make some coffee/gi, 'get that coffee brewin\''],
      [/make coffee/gi, 'get that coffee brewin\''],
      [/some coffee/gi, 'some of that black gold'],
      [/a cup of coffee/gi, 'a cup of that black gold']
    ],
    reasons: [
      'a brother need that caffeine before he step out and handle business on the set',
      'I need that liquid motivation before I step out and handle business on the set',
      'I need that fuel before I start my day, we got business to handle on the set'
    ]
  },
  food: {
    test: /\b(food|hungry|eat|eating|breakfast|lunch|dinner|snack)\b/i,
    revoice: [
      [/buy some food/gi, 'grab some grub'],
      [/get some food/gi, 'grab some grub'],
      [/some food/gi, 'some grub']
    ],
    reasons: [
      'a real one gotta eat before I handle business',
      'I\'m starving out here, I need fuel in my system'
    ]
  },
  car: {
    test: /\b(car|drive|driving|ride)\b/i,
    revoice: [
      [/borrow your car/gi, 'slide in your whip'],
      [/your car/gi, 'your whip'],
      [/my car/gi, 'my whip'],
      [/the car/gi, 'the whip']
    ],
    reasons: [
      'I got moves to make',
      'I gotta get where I\'m going'
    ]
  },
  money: {
    test: /\bmoney\b/i,
    revoice: [
      [/borrow some money/gi, 'hold a lil\' bread'],
      [/some money/gi, 'a lil\' bread'],
      [/money/gi, 'bread']
    ],
    reasons: [
      'I gotta secure that bag',
      'a real one gotta eat out here'
    ]
  },
  sleep: {
    test: /\b(sleep|tired|nap)\b/i,
    revoice: [
      [/get some sleep/gi, 'knock out'],
      [/go to sleep/gi, 'knock out']
    ],
    reasons: [
      'I\'m running on fumes right now',
      'I need to shut it down before I crash out'
    ]
  },
  store: {
    test: /\bstore\b/i,
    revoice: [
      [/go to the store/gi, 'slide to the store']
    ],
    reasons: [
      'I gotta grab what I need and bounce',
      'I got moves to make'
    ]
  },
  work: {
    test: /\b(work|job|report|meeting|boss|deadline|email|shift)\b/i,
    revoice: [
      [/my boss/gi, 'the big homie'],
      [/the boss/gi, 'the big homie'],
      [/a meeting/gi, 'a link-up'],
      [/the meeting/gi, 'that link-up'],
      [/my meeting/gi, 'my link-up']
    ],
    reasons: [
      'we got business to handle before the day run me over',
      'I gotta get this off my plate and keep it moving'
    ]
  },
  phone: {
    test: /\b(phone|text|call|message|dm)\b/i,
    revoice: [
      [/text me/gi, 'hit me up'],
      [/call me/gi, 'hit my line'],
      [/my phone/gi, 'my jack'],
      [/the phone/gi, 'the jack']
    ],
    reasons: [
      'I stay on my line all day, you know how it go'
    ]
  },
  home: {
    test: /\b(house|home|crib|apartment|room)\b/i,
    revoice: [
      [/go home/gi, 'bounce home'],
      [/my house/gi, 'my crib'],
      [/the house/gi, 'the crib']
    ],
    reasons: [
      'I\'m posted up at the crib, minding my business'
    ]
  },
  gym: {
    test: /\b(gym|workout|run|exercise|lift)\b/i,
    revoice: [
      [/go to the gym/gi, 'hit the gym'],
      [/work out/gi, 'put in work']
    ],
    reasons: [
      'we out here getting these gains, no days off'
    ]
  },
};

function hoodTopic(text) {
  var keys = Object.keys(HOOD_TOPICS);
  for (var i = 0; i < keys.length; i++) {
    if (HOOD_TOPICS[keys[i]].test.test(text)) return keys[i];
  }
  return null;
}

var NFG_OPENERS = [
  'What the fuck is good?',
  'Ayy, no bullshit,',
  'Man, look —',
  'Aight, listen the fuck up,',
  'Yo, I swear to God,',
  'Fuck it, look,',
  'Straight up,',
  'On God,',
  'Ayy, fuck all that,',
  'Listen —'
];
var NFG_LIGHT_OPENERS = [
  'Ayy, look,',
  'Man,',
  'Yo,',
  'Real shit,',
  'Aight, look,'
];
var NFG_CLOSERS = [
  "I ain't got the time, patience, or the remaining fucks to give.",
  'zero fucks given, zero apologies.',
  'I said what I said.',
  "and that's on everything.",
  'handle it or shut the fuck up about it.',
  'no more fucks to give, period.'
];
var NFG_LIGHT_CLOSERS = [
  'I said what I said.',
  'no bullshit.',
  'straight up.',
  'you feel me or what?'
];
/* Savage comeback closers: only attached to insult inputs (and Say It
 * Back clapbacks), never to plain questions, greetings, or requests. */
var NFG_COMEBACK_CLOSERS = [
  'man, miss me with that bullshit.',
  'get the fuck outta here with that nonsense.',
  'you done lost your whole damn mind, huh?',
  "I'm not arguing with your dumb ass today.",
  'respectfully, go unfuck yourself.'
];
var NFG_CHECKINS = [
  'You feel me or what?',
  'Am I fucking lying?',
  'You hear me?',
  "Tell me I'm wrong.",
  "You know I'm right."
];
var NFG_Q_TAGS = [
  'or what?',
  'the fuck you mean?',
  'huh?',
  'what, you scared?',
  'you feel me?'
];
var NFG_GREETINGS = [
  'What the fuck is good, you crazy motherfucker?',
  'Ayy, what the fuck is up, you beautiful bastard?',
  "Yo, what the fuck is crackin', Big Dawg?",
  "Ayy, what the fuck is happenin', you crazy son of a bitch?"
];
var NFG_PLANS_Q = [
  'What the fuck we doing today?',
  "What the fuck we gettin' into today?",
  'So what the fuck is the move today?'
];
var NFG_PLANS_CHOICE = [
  'We handling business or we sitting on our asses all day?',
  'We got shit to do or we chilling the fuck out?'
];
var NFG_GOODBYE = [
  "Aight, I'm out this bitch.",
  "I'm gone, stay solid.",
  "Aight, I'm out. Don't do nothing stupid."
];
var NFG_APOLOGIES = [
  'My bad, my fault',
  'Aight, my fault, I fucked that up',
  "Yeah, my bad, I ain't gonna make excuses"
];
var NFG_THANKS_OPENERS = [
  'Appreciate you, for real.',
  "Good lookin' out, you a real one for that shit.",
  'Thank you, you a real one.'
];
var NFG_REASON_GENERIC = [
  "I ain't doing this shit on an empty tank.",
  "I need it or I'm gonna lose my whole damn mind.",
  "I got zero patience left today, so let's make this happen."
];
var NFG_REASONS = {
  coffee: [
    'I need that fucking caffeine before I step out and handle business, or this whole day can kiss my ass.',
    'A brother need that coffee before he lose his whole damn mind on the set.'
  ],
  food: [
    "I'm fucking starving, I need that grub before I start eating my own arm."
  ],
  car: [
    'I need that whip, I got places to be and zero fucks to give about walking.'
  ],
  work: [
    "I gotta handle this shit at work before somebody pisses me off."
  ]
};

/* Profanity intensifier pass for NFG: swaps plain intensifiers for foul
 * ones at natural points. Only applied to the revoiced main payload;
 * reason clauses and the builders already carry their own NFG tables. */
var NFG_SPICE = [
  [/\breally\b/g, 'fucking'],
  [/\bvery\b/g, 'fucking'],
  [/\ba lot\b/g, 'a fuck-ton'],
  [/\bI need\b/g, 'I fucking need'],
  [/\bI don't care\b/gi, "I don't give a fuck"],
  [/\bshut up\b/gi, 'shut the fuck up'],
  [/\bstupid\b/gi, 'dumb as hell'],
  [/\bannoying\b/gi, 'annoying as fuck'],
  [/\bso much\b/gi, 'so fucking much'],
  [/\bwhat the hell\b/gi, 'what the fuck'],
  [/\bamazing\b/gi, 'fucking incredible'],
  [/\bcrazy\b/gi, 'fucking crazy'],
  [/\bgreat\b/gi, 'fucking great'],
  [/\bI gotta\b/g, 'I fucking gotta'],
  [/\bI want\b/g, 'I fucking want']
];
function nfgSpice(s, rng, tier) {
  var out = s;
  var p = tier === 'full' ? 0.85 : tier === 'med' ? 0.55 : 0.3;
  for (var i = 0; i < NFG_SPICE.length; i++) {
    if (rng() < p) out = out.replace(NFG_SPICE[i][0], NFG_SPICE[i][1]);
  }
  return out;
}

var HOOD_COMMAND_VERBS = ['send', 'give', 'tell', 'show', 'bring', 'get', 'make', 'call', 'text', 'take', 'put', 'open', 'close', 'help', 'buy', 'check', 'look', 'listen', 'come', 'go', 'wait', 'hold', 'pass', 'drop', 'pick', 'grab', 'let', 'keep', 'stop', 'start', 'watch', 'read', 'write', 'drive', 'cook', 'clean', 'fix', 'pay', 'leave', 'move'];

/* Work out what the sentence is trying to do. Payload is sliced from the
 * original-case text so proper nouns (Mom, Sunday) keep their capitals. */
function hoodParse(core) {
  var t = core.trim();
  var vocative = '';
  var vm = t.match(/^(hey|yo|hello|hi|aye),?\s+/i);
  if (vm) { vocative = vm[0].trim(); t = t.slice(vm[0].length); }
  var low = t.toLowerCase();
  var m;
  function payloadOf(match) { return t.slice(match[0].length - match[2].length); }
  if ((m = low.match(/^(can|could|may)\s+i\s+(.+)$/))) {
    var p1 = payloadOf(m);
    return { intent: 'permission', payload: p1, topic: hoodTopic(p1), vocative: vocative };
  }
  if ((m = low.match(/^do you mind if i\s+(.+)$/))) {
    var p2 = payloadOf(m);
    return { intent: 'permission', payload: p2, topic: hoodTopic(p2), vocative: vocative };
  }
  if ((m = low.match(/^(can|could)\s+we\s+(.+)$/))) {
    var p3 = payloadOf(m);
    return { intent: 'we', payload: p3, topic: hoodTopic(p3), vocative: vocative };
  }
  if ((m = low.match(/^(can|could|will|would)\s+you\s+(.+)$/))) {
    var p4 = payloadOf(m).replace(/^please\s+/i, '');
    return { intent: 'favor', payload: p4, topic: hoodTopic(p4), vocative: vocative };
  }
  /* Thanks / apology / goodbye / plans / feeling get their own shapes,
   * before the generic greeting and question checks. */
  if (/^(thanks|thank you|thx|preesh)\b/.test(low) || /^appreciate (you|it|that|ya)\.?\s*$/.test(low)) {
    var tp = t.replace(/^(thanks|thank you|thx|preesh|appreciate)\b,?\s*/i, '');
    return { intent: 'thanks', payload: tp, topic: hoodTopic(tp), vocative: vocative };
  }
  if (/^(sorry|my bad|my fault|i'?m sorry|i apologize|i apologise)\b/.test(low)) {
    var ap = t.replace(/^(sorry|my bad|my fault|i'?m sorry|i apologize|i apologise)\b,?\s*/i, '');
    return { intent: 'apology', payload: ap, topic: hoodTopic(ap), vocative: vocative };
  }
  if (/^(goodbye|bye|see you|later|i gotta go|i'?m out|i gotta bounce|i gotta dip)\b/.test(low) && t.split(/\s+/).length <= 6) {
    return { intent: 'goodbye', payload: t, topic: null, vocative: vocative };
  }
  if (/^(what are (you|we) doing|what'?s the plan|whats the plan|what are you up to|what you doing|what we doing|any plans|what'?s the move)\b/.test(low)) {
    return { intent: 'plans', payload: t, topic: hoodTopic(t), vocative: vocative };
  }
  if (!/^i feel (you|like)\b/.test(low) &&
      /^(i feel|i'?m (so )?(tired|happy|sad|bored|stressed|excited|mad|down|good|great|sick|hungry|dead|done)|i am (so )?(tired|happy|sad|bored|stressed|excited|mad|down|good|great|sick|hungry|dead|done))\b/.test(low)) {
    return { intent: 'feeling', payload: t, topic: hoodTopic(t), vocative: vocative };
  }
  if (/^(hello|hey|hi|yo|howdy|good (morning|afternoon|evening)|what'?s up|whats up|what up|what'?s good|whats good|sup|aye|what'?s poppin|what'?s happening)\b/.test(low) && t.split(/\s+/).length <= 7) {
    return { intent: 'greeting', payload: t, topic: null, vocative: vocative };
  }
  if (/^(what|why|when|where|who|whom|whose|which|how)\b/.test(low)) {
    return { intent: 'question', payload: t, topic: hoodTopic(t), vocative: vocative };
  }
  var first = low.split(/\s+/)[0].replace(/[^a-z']/g, '');
  if (first === 'please') {
    var rest = t.replace(/^please\s+/i, '');
    return { intent: 'command', payload: rest, topic: hoodTopic(rest), vocative: vocative };
  }
  if (HOOD_COMMAND_VERBS.indexOf(first) !== -1) {
    return { intent: 'command', payload: t, topic: hoodTopic(t), vocative: vocative };
  }
  /* Insult / diss aimed at someone: the translator is voicing the user's
   * own clapback, so NFG may attach the savage comeback closers. */
  if (/\byou (are|re)\s+(really\s+|so\s+|very\s+)?(a\s+)?(stupid|dumb|idiot|clown|joke|loser|trash|annoying|ugly|weird|lame|fake|pathetic|dumbass)\b/i.test(t) ||
      /\byou suck\b/i.test(t) || /\bshut up\b/i.test(t)) {
    return { intent: 'insult', payload: t, topic: hoodTopic(t), vocative: vocative };
  }
  return { intent: 'statement', payload: t, topic: hoodTopic(t), vocative: vocative };
}

/* Revoice a clause: topic revoicings first, then sentence frames, then
 * verbs and adjectives. Content nouns survive; only the delivery
 * changes. Every replacement is meaning-preserving. `p` is the tier's
 * revoice probability (1.0 at full intensity = the voice commits fully);
 * the small signature adjective swaps stay deterministic so the voice
 * never comes out bare. Every contraction rule requires a word after
 * it: a contraction can never end a clause ("look who it is" must stay
 * "it is", never "it's"). */
function hoodRevoiceVP(vp, topic, rng, tier, p, nfg) {
  var s = vp;
  var rp = (p === undefined) ? 0.65 : p;
  /* Core sentence frames commit fully at medium/full intensity (the
   * voice never comes out bare); only the light tier rolls the dice. */
  var coreP = (tier === 'light') ? rp : 1.0;
  if (topic && HOOD_TOPICS[topic]) {
    var rules = HOOD_TOPICS[topic].revoice;
    for (var i = 0; i < rules.length; i++) {
      if (chance(rng, rp)) s = s.replace(rules[i][0], rules[i][1]);
    }
  }
  /* Sentence frames (longest first). */
  var DEST = /^(the|a|an|my|your|his|her|their|work|school|home|bed|church|class|store|gym)$/i;
  function goTo(m, w, finna) {
    if (!chance(rng, coreP)) return m;
    return DEST.test(w) ? finna + ' go to ' + w : finna + ' ' + w;
  }
  s = s.replace(/\bi am going to\s+([a-z']+)/gi, function (m, w) { return goTo(m, w, 'I\'m finna'); });
  s = s.replace(/\bi\'m going to\s+([a-z']+)/gi, function (m, w) { return goTo(m, w, 'I\'m finna'); });
  s = s.replace(/\bwe are going to\s+([a-z']+)/gi, function (m, w) { return goTo(m, w, 'we finna'); });
  s = s.replace(/\bi need to\s+(\w)/gi, function (m, w) { return chance(rng, coreP) ? 'I gotta ' + w : m; });
  s = s.replace(/\bwe need to\s+(\w)/gi, function (m, w) { return chance(rng, coreP) ? 'we gotta ' + w : m; });
  s = s.replace(/\bi have to\s+(\w)/gi, function (m, w) { return chance(rng, coreP) ? 'I gotta ' + w : m; });
  s = s.replace(/\bi want to\s+(\w)/gi, function (m, w) { return chance(rng, coreP) ? 'I\'m tryna ' + w : m; });
  s = s.replace(/\bi want\s+(\w)/gi, function (m, w) { return chance(rng, coreP) ? 'I\'m tryna secure ' + w : m; });
  s = s.replace(/\bi will\s+(\w)/gi, function (m, w) { return chance(rng, coreP) ? 'I\'ma ' + w : m; });
  s = s.replace(/\bi am\s+(\w)/gi, function (m, w) { return chance(rng, coreP) ? 'I\'m ' + w : m; });
  s = s.replace(/\bi have\s+(\w)/gi, function (m, w) { return chance(rng, coreP) ? 'I got ' + w : m; });
  s = s.replace(/\byou are\s+(\w)/gi, function (m, w) { return chance(rng, coreP) ? 'you ' + w : m; });
  s = s.replace(/\bhe is\s+(\w)/gi, function (m, w) { return chance(rng, coreP) ? 'he\'s ' + w : m; });
  s = s.replace(/\bshe is\s+(\w)/gi, function (m, w) { return chance(rng, coreP) ? 'she\'s ' + w : m; });
  s = s.replace(/\bit is\s+(\w)/gi, function (m, w) { return chance(rng, coreP) ? 'it\'s ' + w : m; });
  s = s.replace(/\bthat is\s+(\w)/gi, function (m, w) { return chance(rng, coreP) ? 'that\'s ' + w : m; });
  s = s.replace(/\bthere is\s+(\w)/gi, function (m, w) { return chance(rng, coreP) ? 'there\'s ' + w : m; });
  s = s.replace(/\bwe are\s+(\w)/gi, function (m, w) { return chance(rng, coreP) ? 'we ' + w : m; });
  s = s.replace(/\bgoing to\s+([a-z']+)/gi, function (m, w) { return goTo(m, w, 'finna'); });
  s = s.replace(/\bwant to\s+(\w)/gi, function (m, w) { return chance(rng, coreP) ? 'tryna ' + w : m; });
  s = s.replace(/\bneed to\s+(\w)/gi, function (m, w) { return chance(rng, coreP) ? 'gotta ' + w : m; });
  s = s.replace(/\bhave to\s+(\w)/gi, function (m, w) { return chance(rng, coreP) ? 'gotta ' + w : m; });
  /* Specific verb phrases. */
  s = s.replace(/\bgive me a minute\b/gi, 'give me a sec');
  s = s.replace(/\bgive me a second\b/gi, 'give me a sec');
  s = s.replace(/\bmake (dinner|lunch|breakfast|some food|a sandwich)\b/gi, 'whip up $1');
  s = s.replace(/\bget some sleep\b/gi, 'knock out');
  s = s.replace(/\bgo to sleep\b/gi, 'knock out');
  s = s.replace(/\btell me about\b/gi, 'put me on to');
  s = s.replace(/\btell me\b/gi, 'let me know');
  s = s.replace(/\bsend me\b/gi, 'slide me');
  s = s.replace(/\bgive me\b/gi, 'pass me');
  s = s.replace(/\bhelp me\b/gi, 'hold me down');
  s = s.replace(/\bcall me\b/gi, 'hit me up');
  s = s.replace(/\blook at\b/gi, 'peep');
  s = s.replace(/\bcome over\b/gi, 'pull up');
  s = s.replace(/\bcome through\b/gi, 'pull up');
  s = s.replace(/\bcome here\b/gi, 'pull up');
  /* General verbs (chance-gated, safe contexts only). */
  s = s.replace(/\bget (some|a|an|the|that|this|my|your|his|her)\b/gi, function (m, w) { return chance(rng, rp * 0.6) ? 'grab ' + w : m; });
  s = s.replace(/\bgo to (the|a|an|my|your|his|her|their|work|school|home|bed|church|class|store|gym)\b/gi, function (m, w) { return chance(rng, rp * 0.5) ? 'slide to ' + w : m; });
  s = s.replace(/\bbuy\b/gi, function () { return chance(rng, rp * 0.7) ? 'cop' : 'buy'; });
  /* Adjectives / adverbs. Signature swaps stay deterministic. */
  s = s.replace(/\bvery tired\b/gi, 'dead tired');
  s = s.replace(/\bso tired\b/gi, 'dead tired');
  s = s.replace(/\breally annoying\b/gi, 'mad annoying');
  s = s.replace(/\bvery\b/gi, function () { return chance(rng, rp * 0.6) ? 'mad' : 'very'; });
  s = s.replace(/\breally\b/gi, function () { return chance(rng, rp * 0.6) ? 'for real' : 'really'; });
  s = s.replace(/\bamazing\b/gi, 'fire');
  s = s.replace(/\bawesome\b/gi, 'fire');
  s = s.replace(/\bgreat\b/gi, function () { return chance(rng, rp * 0.6) ? 'fire' : 'great'; });
  s = s.replace(/\bnice\b/gi, function () { return chance(rng, rp * 0.6) ? 'clean' : 'nice'; });
  /* Wh-question contractions. */
  s = s.replace(/\bwhy are you\b/gi, 'why you');
  s = s.replace(/\bwhy did you\b/gi, 'why\'d you');
  s = s.replace(/\bwhat are you\b/gi, 'what you');
  s = s.replace(/\bwhere are you\b/gi, 'where you at');
  s = s.replace(/\bwhere is\b/gi, 'where');
  s = s.replace(/\bwhat is\b/gi, 'what\'s');
  /* "Do you" frames. */
  s = s.replace(/\bdo you want to\s+(\w)/gi, 'you tryna $1');
  s = s.replace(/\bdo you know\b/gi, 'you know');
  s = s.replace(/\bdo you (like|love|need|want)\b/gi, 'you $1');
  /* Time-of-day flavor. */
  s = s.replace(/\bthis morning\b/gi, 'this mornin\'');
  s = s.replace(/\bgood morning\b/gi, 'mornin\'');
  if (nfg) s = nfgSpice(s, rng, tier);
  return s;
}

var HOOD_OPENERS = {
  permission: ['Ayy, OG!', 'Ayy, Big Homie!', 'Say, Big Homie!', 'Ayy, Big Dawg!', 'Yo, Big Homie!'],
  favor: ['Ayy, Big Dawg!', 'Ayy, Big Homie!', 'Say, OG!', 'Ayy, let me ask you something,', 'Yo, Big Homie!'],
  we: ['Ayy,', 'Say, Big Homie!', 'Ayy, OG!', 'Yo, Big Homie!'],
  question: ['Ayy,', 'Say, OG!', 'Ayy, let me ask you something,', 'Ayy, Big Homie!', 'Yo, Big Homie!'],
  statement: ['Real talk,', 'Aight, look,', 'So boom,', 'Aight, so,', 'Ayy, look,', 'On the set,', 'Listen, Big Homie,'],
  command: ['Ayy,', 'Aight, look,', 'Say, Big Homie!', 'Ayy, OG!', 'Yo, Big Homie!'],
  thanks: ['Ayy,', 'Yo,'],
  apology: ['Ayy,', 'Yo,'],
  feeling: ['Ayy, look,', 'Listen,', 'So boom,'],
  goodbye: ['Aight,', 'Bet,']
};
var HOOD_OPENERS_LIGHT = ['Ayy,', 'Yo,', 'Look,'];

/* Big closer pool on purpose: any single closer is ~1 in 12 of the
 * picks, so nothing repeats enough to get stale. "say less" stays in
 * the pool (the founder likes it) but at pool odds it is rare. */
var HOOD_CLOSERS = [
  'on the set.', 'you already know.', "that's what's crackin'.", 'keep it solid.',
  "that's the move.", 'on my word.', 'no cap.', 'for real.', 'you feel me?',
  'you with me?', 'say less.', 'real talk.'
];
var HOOD_CLOSERS_LIGHT = ['you know?', 'for real.'];

var HOOD_CHECKINS = ["What's the word?", "What's good?", 'What it do?', 'You got a sec?', 'Let me ask you something,'];

var HOOD_Q_TAGS = ['though?', "you feel me?", 'break it down for me.', "I'm tryna know.", 'what you think?'];

var HOOD_GREETINGS = {
  morning: [
    "Ayy, Big Homie! Mornin', OG!",
    "Ayy, OG! Mornin', Big Homie, you good?",
    "Mornin', youngin'! What's the word today?",
    "Ayy! Mornin', Big Dawg! What we gettin' into today?"
  ],
  afternoon: [
    "Ayy, Big Homie! What's crackin' this afternoon?",
    "Ayy, OG! What it do this afternoon?",
    "What's good, youngin'? Hope your day going smooth."
  ],
  evening: [
    "Ayy, OG! What's good tonight?",
    "Ayy, Big Homie! What we on tonight?",
    "Evening, youngin'! What's the word?"
  ],
  generic: [
    "Ayy, OG! What's good, Big Homie?",
    "What's happenin', Big Homie?",
    "Ayy, Big Dawg! What's the word?",
    "Yo! What it do, youngin'?",
    "Ayy, Big Homie! What's crackin'?"
  ]
};

var HOOD_PLANS_Q = [
  "What's crackin' today?",
  "What's crackin', Big Homie? What we on today?",
  "What's crackin' today, youngin'?"
];
var HOOD_PLANS_CHOICE = [
  'We got business to handle or we takin\' it easy on the set?',
  'We got business to handle or we posted up chillin\' today?',
  'Business to handle today, or we movin\' slow on the set?'
];

var HOOD_GOODBYE = [
  'Aight, I\'m out, Big Homie! Catch you later.',
  'Bet, catch you on the flip side, OG!',
  'Aight, I\'m gone, stay solid out here!'
];

var HOOD_REASON_GENERIC = ['I gotta handle business', 'I got moves to make out here', 'we got things to do on the set'];

function lowerFirst(s) {
  if (!s) return s;
  if (/^I('|\s|$)/.test(s)) return s; /* leading "I" always stays capital */
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function hoodGreeting(core, tier, rng, nfg) {
  var low = core.toLowerCase();
  if (tier === 'light') {
    if (nfg) return /morning/.test(low) ? "Mornin'! What the fuck is good?" : 'What the fuck is good?';
    if (/morning/.test(low)) return "Mornin', Big Homie!";
    return "What's good, Big Homie?";
  }
  if (nfg) return hoodPick(rng, NFG_GREETINGS, 'opener');
  var time = /morning/.test(low) ? 'morning' : /afternoon/.test(low) ? 'afternoon' : /(evening|night)/.test(low) ? 'evening' : null;
  var pool = time ? HOOD_GREETINGS[time] : HOOD_GREETINGS.generic;
  return hoodPick(rng, pool, 'opener');
}

function hoodPlans(payload, tier, rng, nfg) {
  var time = /tonight/i.test(payload) ? 'tonight' : /tomorrow/i.test(payload) ? 'tomorrow' : 'today';
  if (tier === 'light') {
    return capFirst(hoodRevoiceVP(payload, null, rng, 'light', 0.35, nfg)) + '?';
  }
  var q = hoodPick(rng, nfg ? NFG_PLANS_Q : HOOD_PLANS_Q, 'opener').replace(/today/g, time);
  if (tier === 'medium') return q;
  var choice = hoodPick(rng, nfg ? NFG_PLANS_CHOICE : HOOD_PLANS_CHOICE, 'closer').replace(/today/g, time);
  return q + ' ' + choice;
}

function hoodThanks(payload, tier, rng, nfg) {
  if (tier === 'light') return nfg ? 'Thanks, appreciate you. For real.' : 'Thanks, appreciate you.';
  var addr = hoodPick(rng, ['Big Homie', 'OG', 'youngin\''], 'opener');
  var p = (payload || '').trim();
  if (/^(you|it|that|ya)\.?$/.test(p)) p = '';
  var fm = p.match(/^for\s+(.+)$/i);
  if (fm) return (nfg ? hoodPick(rng, ['Appreciate you for ', 'Good lookin\' out for '], 'opener') : 'Appreciate you for ') + fm[1] + ', ' + addr + '!';
  if (p && p.split(/\s+/).length <= 3 && !/\b(I|you|we|he|she|they)\b/i.test(p)) {
    return (nfg ? hoodPick(rng, ['Appreciate you ', 'Good lookin\' out '], 'opener') : 'Appreciate you ') + lowerFirst(p) + ', ' + addr + '!';
  }
  if (nfg) return hoodPick(rng, ['Appreciate you, for real, ' + addr + '!', 'Good lookin\' out, ' + addr + ', you a real one!'], 'opener');
  return hoodPick(rng, ['Appreciate you, ' + addr + '!', 'Good lookin\' out, ' + addr + '!'], 'opener');
}

function hoodApology(payload, tier, rng, nfg) {
  if (tier === 'light') return nfg ? 'My bad, we good. For real.' : 'My bad, we good.';
  var addr = hoodPick(rng, ['OG', 'Big Homie', 'youngin\''], 'opener');
  var base;
  if (nfg) {
    /* With a payload ("about that"), only bases that flow into it. */
    base = (payload && payload.trim())
      ? hoodPick(rng, ['My bad, my fault', "Yeah, my bad, I ain't gonna make excuses"], 'closer')
      : hoodPick(rng, NFG_APOLOGIES, 'closer');
  } else {
    base = hoodPick(rng, ['My fault', 'My bad'], 'closer');
  }
  if (payload && payload.trim()) return base + ' ' + lowerFirst(payload) + ', ' + addr + ', we good.';
  return base + ', ' + addr + ', we good.';
}

function hoodGoodbye(tier, rng, nfg) {
  if (tier === 'light') return nfg ? "Later. Don't do nothing stupid." : 'Later, be safe.';
  return hoodPick(rng, nfg ? NFG_GOODBYE : HOOD_GOODBYE, 'opener');
}

function translateHoodTalk(sentence, intensity, rng, nfg) {
  var inten = clamp(Math.round(intensity) || 5, 1, 10);
  var tier = hoodTier(inten);
  var tp = HOOD_TIER_PARAMS[tier];
  var text = sentence.trim();
  if (!text) return '';
  var trailingPunct = /[.!?]+$/.test(text) ? text.match(/[.!?]+$/)[0] : '.';
  var core = text.replace(/[.!?]+\s*$/, '');
  var parsed = hoodParse(core);
  var topic = parsed.topic;

  /* Greeting / plans / thanks / apology / goodbye: wholesale shapes. */
  if (parsed.intent === 'greeting') return hoodGreeting(core, tier, rng, nfg);
  if (parsed.intent === 'plans') return hoodPlans(parsed.payload, tier, rng, nfg);
  if (parsed.intent === 'thanks') return hoodThanks(parsed.payload, tier, rng, nfg);
  if (parsed.intent === 'apology') return hoodApology(parsed.payload, tier, rng, nfg);
  if (parsed.intent === 'goodbye') return hoodGoodbye(tier, rng, nfg);

  /* Main clause first — the reason and closer are picked against it so
   * a signature phrase never doubles up inside one output. */
  var main = '';
  var endPunct = '.';
  if (parsed.intent === 'permission') {
    main = 'you finna let me ' + hoodRevoiceVP(parsed.payload, topic, rng, tier, tp.revoice, nfg);
    endPunct = '?';
    if (tier === 'full' && chance(rng, tp.orWhat)) main += ' or what';
  } else if (parsed.intent === 'favor') {
    var fvp = hoodRevoiceVP(parsed.payload, topic, rng, tier, tp.revoice, nfg);
    fvp = fvp.replace(/^(slide me|pass me) the /i, '$1 that ');
    var fOpen = hoodPick(rng, nfg ? ['do me a fucking solid and ', 'I need you to ', 'Big Homie, do me a favor and '] : ['do me a solid and ', 'I need you to ', 'Big Homie, do me a favor and '], 'opener');
    main = fOpen + fvp;
    endPunct = '?';
  } else if (parsed.intent === 'we') {
    main = 'we finna ' + hoodRevoiceVP(parsed.payload, topic, rng, tier, tp.revoice, nfg);
    endPunct = '?';
  } else if (parsed.intent === 'question') {
    main = hoodRevoiceVP(parsed.payload, topic, rng, tier, tp.revoice, nfg);
    endPunct = '?';
  } else if (parsed.intent === 'command') {
    var cvp = hoodRevoiceVP(parsed.payload, topic, rng, tier, tp.revoice, nfg);
    cvp = cvp.replace(/^(slide me|pass me) the /i, '$1 that ');
    main = cvp;
    endPunct = (trailingPunct === '!' ? '!' : trailingPunct === '?' ? '?' : '.');
  } else {
    main = hoodRevoiceVP(parsed.payload, topic, rng, tier, tp.revoice, nfg);
    endPunct = (trailingPunct === '!' ? '!' : trailingPunct === '?' ? '?' : '.');
  }
  if (!main.trim()) main = parsed.payload;

  /* Opener + optional check-in, joined with correct casing. */
  var prevOpener = HOOD_LAST.opener, prevCheckin = HOOD_LAST.checkin;
  var opener = '';
  if (chance(rng, tp.opener)) {
    opener = tier === 'light'
      ? hoodPick(rng, nfg ? NFG_LIGHT_OPENERS : HOOD_OPENERS_LIGHT, 'opener')
      : hoodPick(rng, nfg ? NFG_OPENERS : (HOOD_OPENERS[parsed.intent] || HOOD_OPENERS.statement), 'opener');
  }
  var checkin = '';
  if ((parsed.intent === 'permission' || parsed.intent === 'question' || parsed.intent === 'favor') && chance(rng, tp.checkin)) {
    checkin = hoodPick(rng, nfg ? NFG_CHECKINS : HOOD_CHECKINS, 'checkin');
  }
  var body = '';
  if (opener) body = opener;
  if (checkin) {
    var ci = checkin;
    if (opener && !/[!?]$/.test(opener)) ci = lowerFirst(ci);
    body = body ? body + ' ' + ci : ci;
    body += ' ' + (/,$/.test(ci) ? lowerFirst(main) : capFirst(main));
  } else if (opener) {
    body += ' ' + (/[!?]$/.test(opener) ? capFirst(main) : lowerFirst(main));
  } else {
    body = capFirst(main);
  }

  /* Reason clause: only where a motive makes sense, never invented.
   * Statements get one only on need/want frames; feelings get one
   * when a topic exists (tired -> running on fumes). */
  var reason = '';
  var reasonAllowed = topic && (parsed.intent === 'permission' || parsed.intent === 'favor' || parsed.intent === 'we' ||
    parsed.intent === 'feeling' ||
    (parsed.intent === 'statement' && /^(i (need|want|gotta)|i'm (tryna|finna)|we (need|want))/i.test(parsed.payload)));
  if (reasonAllowed && chance(rng, tp.reason)) {
    reason = hoodFilterSig(rng, nfg ? (NFG_REASONS[topic] || NFG_REASON_GENERIC) : HOOD_TOPICS[topic].reasons, body + ' ' + prevOpener + ' ' + prevCheckin, 'reason');
  } else if (!topic && (parsed.intent === 'permission' || parsed.intent === 'favor' || parsed.intent === 'we') && chance(rng, tp.reason * 0.5)) {
    reason = hoodFilterSig(rng, nfg ? NFG_REASON_GENERIC : HOOD_REASON_GENERIC, body + ' ' + prevOpener + ' ' + prevCheckin, 'reason');
  }

  /* Closer: rarer when a reason already closed the thought. Savage
   * comeback closers only attach to insult inputs — never to a plain
   * question, greeting, or request. */
  var closer = '';
  var closerP = reason ? tp.closer * 0.3 : tp.closer;
  if (chance(rng, closerP)) {
    var closerPool = tier === 'light' ? (nfg ? NFG_LIGHT_CLOSERS : HOOD_CLOSERS_LIGHT)
      : (nfg && parsed.intent === 'insult') ? NFG_COMEBACK_CLOSERS
      : (nfg ? NFG_CLOSERS : HOOD_CLOSERS);
    closer = hoodFilterSig(rng, closerPool, body + ' ' + reason + ' ' + prevOpener + ' ' + prevCheckin, 'closer');
  }

  /* Wh-questions get a tag, not a generic closer. */
  if (parsed.intent === 'question') {
    var tag = '';
    if (chance(rng, tp.tag)) tag = hoodFilterSig(rng, nfg ? NFG_Q_TAGS : HOOD_Q_TAGS, body, 'tag');
    if (tag) {
      if (/\?$/.test(tag)) return body + ', ' + tag;
      return body + '? ' + capFirst(tag.replace(/[.!?]+$/, '')) + '.';
    }
    return body + endPunct;
  }
  if (reason) {
    var rEnd = (tier === 'full' && chance(rng, 0.6)) ? '!' : '.';
    var rSent = capFirst(reason.replace(/[.!?]+$/, ''));
    if (closer) {
      if (/\?$/.test(closer)) return body + endPunct + ' ' + rSent + ', ' + closer;
      return body + endPunct + ' ' + rSent + ', ' + closer.replace(/[.!?]+$/, '') + '.';
    }
    return body + endPunct + ' ' + rSent + rEnd;
  }
  if (closer) {
    if (/\?$/.test(closer)) return body + ', ' + closer;
    if (endPunct === '?') return body + '? ' + capFirst(closer.replace(/[.!?]+$/, '')) + '.';
    return body + ', ' + closer.replace(/[.!?]+$/, '') + '.';
  }
  return body + endPunct;
}

/* Translate full text (sentence by sentence for long input).
 * opts: { seed, nfg } — deterministic when seed is given (used by
 * tests). nfg only ever applies to Hood Talk; other personalities and
 * Fluent English ignore it.
 * Returns { text, personality, intensity, sentences }.
 */
function translate(text, personality, intensity, opts) {
  opts = opts || {};
  var seed = (opts.seed !== undefined) ? opts.seed : ((Date.now() % 2147483647) ^ Math.floor(Math.random() * 1e9));
  var rng = makeRng(seed);
  var nfg = !!(opts.nfg) && getPersonality(personality).id === 'hood';
  var sentences = splitSentences(String(text || '').trim());
  var out = [];
  for (var i = 0; i < sentences.length; i++) {
    out.push(translateSentence(sentences[i], personality, intensity, rng, nfg));
  }
  return {
    text: out.join(' '),
    personality: getPersonality(personality).id,
    intensity: clamp(Math.round(intensity) || 5, 1, 10),
    sentences: out.length
  };
}

/* Three genuinely different variations of one translation. */
function translateVariations(text, personality, intensity, opts) {
  opts = opts || {};
  var base = (opts.seed !== undefined) ? opts.seed : ((Date.now() % 2147483647) ^ Math.floor(Math.random() * 1e9));
  var results = [];
  var seen = {};
  var attempt = 0;
  while (results.length < 3 && attempt < 12) {
    var r = translate(text, personality, intensity, { seed: base + attempt * 7919, nfg: opts.nfg });
    attempt++;
    if (!seen[r.text] && r.text.trim()) {
      seen[r.text] = true;
      results.push(r.text);
    }
  }
  /* Fallback: if the engine is being stubborn, vary intensity slightly. */
  while (results.length < 3) {
    var r2 = translate(text, personality, clamp(intensity + (results.length - 1), 1, 10), { seed: base + attempt * 104729, nfg: opts.nfg });
    attempt++;
    if (!seen[r2.text]) { seen[r2.text] = true; results.push(r2.text); }
  }
  return results;
}

/* Translate slang back to plain English. Best effort: strip fillers,
 * reverse the lexicon, normalise case. */
function translateBack(text) {
  var out = String(text || '');
  var wasAllCaps = /[A-Z]{3,}/.test(out) && out === out.toUpperCase();
  /* Mid-sentence intensifiers the lexicon adds — distinctive slang, safe
   * to strip anywhere. */
  var midFillers = ['you feel me\\?', 'you dig\\?', 'no cap', 'deadass', 'lowkey',
    'for real', 'you know what i\'m sayin\''];
  for (var i = 0; i < midFillers.length; i++) {
    out = out.replace(new RegExp('(^|[,.!?;\\s])' + midFillers[i] + '(?=[,.!?;\\s]|$)', 'gi'), '$1');
  }
  /* Openers only at the start; closers/fillers only at the end, and only
   * when preceded by punctuation — so content like "how little you know"
   * survives instead of being eaten. Loop the end-strip so removing a
   * closer can expose a filler underneath it. */
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  var openers = [], enders = [];
  for (var pi = 0; pi < PERSONALITIES.length; pi++) {
    openers = openers.concat(PERSONALITIES[pi].openers);
    enders = enders.concat(PERSONALITIES[pi].closers, PERSONALITIES[pi].fillers);
  }
  for (var oi = 0; oi < openers.length; oi++) {
    out = out.replace(new RegExp('^' + escRe(openers[oi]) + '[\\s,;:]*', 'i'), '');
  }
  for (var pass = 0; pass < 3; pass++) {
    var beforeEnd = out;
    for (var ei = 0; ei < enders.length; ei++) {
      out = out.replace(new RegExp('(^|[,.!?;]\\s*)' + escRe(enders[ei]) + '[.!?]*\\s*$', 'i'), '$1');
    }
    if (out === beforeEnd) break;
  }
  for (var j = 0; j < REVERSE_SWAPS.length; j++) {
    out = out.replace(REVERSE_SWAPS[j][0], REVERSE_SWAPS[j][1]);
  }
  /* Punctuation cleanup: dangling commas left by stripped fillers. */
  out = out.replace(/\s+([,.!?])/g, '$1').replace(/,([?!])/g, '$1')
    .replace(/,\s*\./g, '.').replace(/([.!?]),/g, '$1').replace(/,+/g, ',')
    .replace(/,\s*$/, '').replace(/\s{2,}/g, ' ').trim();
  if (wasAllCaps) {
    /* Crash-Out all-caps back to normal sentence case. */
    out = out.toLowerCase();
    out = out.replace(/\bi\b/g, 'I');
    out = out.replace(/(^|[.!?]\s+)([a-z])/g, function (m, p1, p2) { return p1 + p2.toUpperCase(); });
  } else {
    out = out.replace(/^[a-z]/, function (c) { return c.toUpperCase(); });
  }
  if (out && !/[.!?]$/.test(out)) out += '.';
  return out;
}

/* ---------- Fluent English mode ----------
 * A dedicated writing mode, separate from the 8 slang personalities.
 * Rule-based, on-device, no API. Three options:
 *   correct      — fix errors, change nothing else (minimal changes)
 *   polish       — clearer flow, still the user's voice
 *   professional — formal, polished English for work
 * Every fix is recorded with a short plain explanation for the "Why?"
 * toggle. Intentional casual language (gonna, yeah, lol, slang,
 * sentence fragments for emphasis) is left alone in Correct Only and
 * Polish It. Meaning is never invented: nothing is added that the user
 * did not say.
 */
var FLUENT_OPTIONS = [
  { id: 'correct', name: 'Correct Only', desc: 'Fix the errors. Change nothing else.' },
  { id: 'polish', name: 'Polish It', desc: 'Cleaner flow, still your voice.' },
  { id: 'professional', name: 'Professional', desc: 'Formal, polished English for work.' }
];
function fluentOptionName(id) {
  for (var i = 0; i < FLUENT_OPTIONS.length; i++) if (FLUENT_OPTIONS[i].id === id) return FLUENT_OPTIONS[i].name;
  return 'Correct Only';
}

/* Apply one rule, logging the change for the "Why?" explanations.
 * replacement may be a string (no $1 expansion — use a function for
 * group references) or a function (match, g1, g2, ..., offset, str). */
function fluentRule(text, re, replacement, why, log) {
  return text.replace(re, function () {
    var args = Array.prototype.slice.call(arguments);
    var match = args[0];
    var out = (typeof replacement === 'function') ? replacement.apply(null, args) : replacement;
    if (out === match) return match;
    if (/^[A-Z]/.test(match) && /^[a-z]/.test(out)) out = capFirst(out);
    log.push({ from: match, to: out, why: why });
    return out;
  });
}

/* Missing-apostrophe contractions. 'id' and 'ill' are left out on
 * purpose: "my id" and "I feel ill" are real words. */
var FLUENT_CONTRACTIONS = {
  dont: "don't", cant: "can't", wont: "won't", isnt: "isn't", arent: "aren't",
  wasnt: "wasn't", werent: "weren't", didnt: "didn't", doesnt: "doesn't",
  havent: "haven't", hasnt: "hasn't", hadnt: "hadn't", couldnt: "couldn't",
  shouldnt: "shouldn't", wouldnt: "wouldn't", mustnt: "mustn't",
  im: "I'm", ive: "I've", youre: "you're", youve: "you've", youll: "you'll",
  theyre: "they're", theyve: "they've", theyll: "they'll", hes: "he's",
  shes: "she's", thats: "that's", whats: "what's", wheres: "where's",
  whos: "who's", heres: "here's", theres: "there's", lets: "let's",
  aint: "ain't", neednt: "needn't"
};
var FLUENT_CONTRACTION_RE = new RegExp('\\b(' + Object.keys(FLUENT_CONTRACTIONS).join('|') + ')\\b', 'gi');

/* Common misspellings. */
var FLUENT_SPELLING = {
  recieve: 'receive', recieved: 'received', seperate: 'separate', seperated: 'separated',
  definately: 'definitely', definate: 'definite', occured: 'occurred', occuring: 'occurring',
  occurence: 'occurrence', occurance: 'occurrence', wich: 'which', thier: 'their',
  freind: 'friend', freinds: 'friends', beleive: 'believe', beleived: 'believed',
  tommorow: 'tomorrow', untill: 'until', existance: 'existence', neccessary: 'necessary',
  accomodate: 'accommodate', enviroment: 'environment', goverment: 'government',
  wierd: 'weird', calender: 'calendar', suprise: 'surprise', suprised: 'surprised',
  libary: 'library', febuary: 'February', wensday: 'Wednesday', grammer: 'grammar',
  langage: 'language', adress: 'address', bussiness: 'business', comming: 'coming',
  writting: 'writing', writen: 'written', speach: 'speech', realy: 'really',
  finaly: 'finally', knowlege: 'knowledge', exampel: 'example', peice: 'piece',
  acheive: 'achieve', begining: 'beginning', arguement: 'argument', liason: 'liaison',
  millenium: 'millennium', noticable: 'noticeable', occassion: 'occasion',
  prefered: 'preferred', remeber: 'remember', similiar: 'similar',
  succesful: 'successful', tendancy: 'tendency', withing: 'within', publich: 'public',
  independant: 'independent', dependant: 'dependent', persistance: 'persistence',
  resistence: 'resistance', assistence: 'assistance', maintainance: 'maintenance',
  posession: 'possession', pronounciation: 'pronunciation',
  questionaire: 'questionnaire', restaraunt: 'restaurant', resturant: 'restaurant',
  vaccum: 'vacuum', withold: 'withhold', wether: 'whether', harrass: 'harass',
  harrassment: 'harassment', embarass: 'embarrass', embarassing: 'embarrassing',
  neigbor: 'neighbor', neigbors: 'neighbors', minuite: 'minute', seccond: 'second',
  untill: 'until', useage: 'usage', langauge: 'language', brocken: 'broken',
  langage: 'language', adressed: 'addressed', commited: 'committed',
  dissapear: 'disappear', dissapeared: 'disappeared', experiance: 'experience',
  familar: 'familiar', finaly: 'finally', foriegn: 'foreign', fourty: 'forty',
  guage: 'gauge', happend: 'happened', imediately: 'immediately',
  knowlegeable: 'knowledgeable', lonly: 'lonely', managment: 'management',
  neccessary: 'necessary', noticable: 'noticeable', omision: 'omission',
  posession: 'possession', prefered: 'preferred', publically: 'publicly',
  reccomend: 'recommend', refering: 'referring', rember: 'remember',
  rythm: 'rhythm', seperate: 'separate', sieze: 'seize', supercede: 'supersede',
  tatoo: 'tattoo', tendancy: 'tendency', truely: 'truly', unforseen: 'unforeseen',
  untill: 'until', withing: 'within', writting: 'writing'
};
var FLUENT_SPELLING_RE = new RegExp('\\b(' + Object.keys(FLUENT_SPELLING).join('|') + ')\\b', 'gi');

/* Nouns used to tell possessives apart from contractions:
 * "they're dog" is wrong (their dog); "they're going" is right. */
var FLUENT_NOUN = '(?:dog|dogs|cat|cats|car|cars|house|houses|home|mom|dad|mother|father|brother|sister|friend|friends|kid|kids|child|children|teacher|boss|job|phone|family|team|school|work|book|books|room|stuff|thing|things|place|name|fault|turn|own|color|size|birthday|party|wedding|dinner|lunch|breakfast|money|wallet|keys|bag|shoes|clothes|hair|face|eyes|voice|idea|ideas|problem|problems|life|day|days|week|night|morning|bike|truck|computer|laptop|desk|chair|table|song|songs|picture|pictures|photo|photos|video|videos|game|games|group|class|grade|test|exam|paper|report|email|message|text|call|number|address|street|city|state|country|world)';

var FLUENT_CONFUSED = [
  { re: new RegExp('\\btheir\\s+(is|are|was|were|will|would|can|could|have|has|had|do|does|did|going|coming|looking|trying|getting)\\b', 'gi'),
    out: function (m, v) { return "they're " + v; },
    why: "'their' shows ownership — before a verb it should be the contraction 'they're' ('they are')" },
  { re: new RegExp("\\bthey're\\s+(" + FLUENT_NOUN + ")\\b", 'gi'),
    out: function (m, n) { return 'their ' + n; },
    why: "'they're' is the contraction of 'they are' — before a thing that belongs to them, it's 'their'" },
  { re: new RegExp('\\bthere\\s+(' + FLUENT_NOUN + ')\\b', 'gi'),
    out: function (m, n) { return 'their ' + n; },
    why: "'there' is a place — for something that belongs to them, it's 'their'" },
  { re: new RegExp('\\byour\\s+(is|are|was|were|welcome|going|coming|doing|looking|being|so|too|very|really|just|the best)\\b', 'gi'),
    out: function (m, v) { return "you're " + v; },
    why: "'your' shows ownership — 'you are' shortens to the contraction 'you're'" },
  { re: new RegExp("\\byou're\\s+(" + FLUENT_NOUN + ")\\b", 'gi'),
    out: function (m, n) { return 'your ' + n; },
    why: "'you're' is the contraction of 'you are' — for something belonging to you, it's 'your'" },
  { re: new RegExp('\\bits\\s+(is|are|was|were|going|coming|not|a|an|the|so|too|very|really|just|only|been|getting|time|raining|snowing|hard|easy|cold|hot|late|early|okay|ok|fine)\\b', 'gi'),
    out: function (m, v) { return "it's " + v; },
    why: "'its' shows ownership — 'it is' shortens to the contraction 'it's'" },
  { re: new RegExp("\\bit's\\s+(" + FLUENT_NOUN + ")\\b", 'gi'),
    out: function (m, n) { return 'its ' + n; },
    why: "'it's' is the contraction of 'it is' — for something belonging to it, it's 'its'" },
  { re: new RegExp('\\bwhose\\s+(is|are|was|were|going|coming|there|that)\\b', 'gi'),
    out: function (m, v) { return "who's " + v; },
    why: "'whose' shows ownership — 'who is' shortens to the contraction 'who's'" },
  { re: new RegExp("\\bwho's\\s+(" + FLUENT_NOUN + ")\\b", 'gi'),
    out: function (m, n) { return 'whose ' + n; },
    why: "'who's' is the contraction of 'who is' — for something belonging to someone, it's 'whose'" },
  { re: /\bto\s+(much|many|late|early|big|small|long|short|far|hard|easy|tired|hot|cold|good|bad|old|young|high|low|loud|quiet|busy|expensive|cheap|dark|bright|heavy|light|fast|slow|sweet|salty|cute|pretty|beautiful|ugly|nice|smart|dumb|funny|weird|cool|awesome|amazing|great|terrible|awful|wonderful|horrible|perfect|crazy|insane|stupid|silly|kind|rude|mean|proud|ashamed|confident|shy|brave|lazy|free|ready|hungry|thirsty|bored|excited|nervous|happy|sad|angry|scared|sick|healthy|safe|dangerous|important|interesting|boring|different|special|common|normal|strange|serious|soft|well|rich|poor|clean|dirty)\b/gi,
    out: function (m, v) { return 'too ' + v; },
    why: "'too' means 'more than enough' — 'to' is for direction or verbs" },
  { re: /\bto\s*([.!?]|$)/g,
    out: function (m, p) { return 'too' + p; },
    why: "at the end of a sentence, 'too' means 'also'" },
  { re: /\btoo\s+(go|come|do|be|see|get|make|take|have|eat|sleep|work|drive|walk|run|talk|say|buy|sell|leave|stay|know|think|want|need|start|stop|watch|read|write|pay|move|call|text|help|look|listen|try|ask|give|show|bring|open|close|cook|clean|fix)\b/gi,
    out: function (m, v) { return 'to ' + v; },
    why: "'too' means 'also' or 'very' — before a verb, it's 'to'" },
  { re: /\btwo\s+(much|many)\b/gi,
    out: function (m, v) { return 'too ' + v; },
    why: "'too' means 'more than enough' — 'two' is the number" },
  { re: /\b(better|worse|bigger|smaller|faster|slower|stronger|weaker|higher|lower|more|less|rather|other|sooner|later|easier|harder|greater|older|younger|cheaper|nicer|taller|shorter)\s+then\b/gi,
    out: function (m, v) { return v + ' than'; },
    why: "use 'than' to compare — 'then' is for time" },
  { re: /\b(and|but)\s+than\s+(I|we|you|he|she|they|it)\b/gi,
    out: function (m, c, p) { return c + ' then ' + p; },
    why: "'then' is for time or order — 'than' is for comparing" },
  { re: /\b(could|would|should|must|might)\s+of\b/gi,
    out: function (m, v) { return v + "'ve"; },
    why: "'of' should be the contraction 've' ('could have')" },
  { re: /\bloose\s+(my|your|his|her|the|a|an|weight|it|them|him|keys|phone|job|game|money|mind|temper|control|track|grip|faith|hope|patience)\b/gi,
    out: function (m, v) { return 'lose ' + v; },
    why: "'lose' is the verb for misplacing — 'loose' means not tight" },
  { re: /\b(the|an)\s+affect\b/gi,
    out: function (m, a) { return a + ' effect'; },
    why: "'effect' is the noun (the result) — 'affect' is usually the verb" },
  { re: /\baffect\s+of\b/gi, out: 'effect of',
    why: "'effect' is the noun (the result) — 'affect' is usually the verb" },
  { re: /\b(all|everyone|everybody|everything|anyone|anybody)\s+accept\b/gi,
    out: function (m, v) { return v + ' except'; },
    why: "'except' means 'not including' — 'accept' means 'to take'" },
  { re: /\balot\b/gi, out: 'a lot', why: "'a lot' is two words" }
];

var FLUENT_GRAMMAR = [
  { re: /\bwe was\b/gi, out: 'we were', why: "'was' goes with I/he/she/it — 'we' takes 'were'" },
  { re: /\bthey was\b/gi, out: 'they were', why: "'was' goes with I/he/she/it — 'they' takes 'were'" },
  { re: /\byou was\b/gi, out: 'you were', why: "'was' goes with I/he/she/it — 'you' takes 'were'" },
  { re: /\bhe don't\b/gi, out: "he doesn't", why: "'he' takes 'doesn't', not 'don't'" },
  { re: /\bshe don't\b/gi, out: "she doesn't", why: "'she' takes 'doesn't', not 'don't'" },
  { re: /\bit don't\b/gi, out: "it doesn't", why: "'it' takes 'doesn't', not 'don't'" },
  { re: /\bthey doesn't\b/gi, out: "they don't", why: "'they' takes 'don't', not 'doesn't'" },
  { re: /\bwe doesn't\b/gi, out: "we don't", why: "'we' takes 'don't', not 'doesn't'" },
  { re: /\byou doesn't\b/gi, out: "you don't", why: "'you' takes 'don't', not 'doesn't'" },
  { re: /\bi is\b/gi, out: 'I am', why: "'I' takes 'am', not 'is'" },
  { re: /\byou is\b/gi, out: 'you are', why: "'you' takes 'are', not 'is'" },
  { re: /\b(has|have|had)\s+went\b/gi, out: function (m, v) { return v + ' gone'; }, why: "after has/have/had, use 'gone', not 'went'" },
  { re: /\bpeople was\b/gi, out: 'people were', why: "'people' is plural — use 'were'" },
  { re: /\bpeople is\b/gi, out: 'people are', why: "'people' is plural — use 'are'" },
  { re: /\bi seen\b/gi, out: 'I saw', why: "'seen' needs 'have' ('have seen') — on its own, use 'saw'" },
  { re: /\b(we|they|you|he|she)\s+seen\b/gi, out: function (m, v) { return v + ' saw'; }, why: "'seen' needs 'have' ('have seen') — on its own, use 'saw'" },
  { re: /\bi done\b/gi, out: 'I did', why: "'done' needs 'have' ('have done') — on its own, use 'did'" }
];

/* Present-tense verbs and their past forms, for "yesterday" sentences. */
var FLUENT_PAST = {
  go: 'went', come: 'came', see: 'saw', eat: 'ate', take: 'took', make: 'made',
  get: 'got', give: 'gave', tell: 'told', run: 'ran', drive: 'drove', write: 'wrote',
  speak: 'spoke', buy: 'bought', bring: 'brought', catch: 'caught', teach: 'taught',
  think: 'thought', say: 'said', do: 'did', have: 'had', find: 'found', leave: 'left',
  meet: 'met', pay: 'paid', send: 'sent', sit: 'sat', sleep: 'slept', win: 'won',
  lose: 'lost', begin: 'began', break: 'broke', choose: 'chose', drink: 'drank',
  fall: 'fell', feel: 'felt', forget: 'forgot', grow: 'grew', know: 'knew',
  sing: 'sang', swim: 'swam', wear: 'wore', wake: 'woke', build: 'built',
  spend: 'spent', sell: 'sold', steal: 'stole'
};
var FLUENT_PAST_RE = new RegExp('\\b(to\\s+)?(' + Object.keys(FLUENT_PAST).join('|') + ')\\b', 'gi');

/* "very X" -> stronger single word (Polish It / Professional). */
var FLUENT_VERY = {
  good: 'great', bad: 'terrible', tired: 'exhausted', happy: 'delighted',
  big: 'huge', small: 'tiny', fast: 'rapid', smart: 'brilliant', nice: 'wonderful',
  cold: 'freezing', hot: 'scorching', important: 'crucial', interesting: 'fascinating',
  funny: 'hilarious', sad: 'heartbroken', angry: 'furious', scared: 'terrified',
  strong: 'powerful', weak: 'feeble', easy: 'effortless', rich: 'wealthy',
  clean: 'spotless', dirty: 'filthy', quiet: 'silent', loud: 'deafening',
  old: 'ancient', new: 'brand-new', beautiful: 'gorgeous', ugly: 'hideous',
  short: 'brief', long: 'lengthy', high: 'towering'
};
var FLUENT_VERY_RE = new RegExp('\\bvery\\s+(' + Object.keys(FLUENT_VERY).join('|') + ')\\b', 'gi');

var FLUENT_PLURAL = ['people', 'things', 'friends', 'times', 'days', 'weeks', 'months', 'years', 'cars', 'books', 'students', 'kids', 'children', 'songs', 'pictures', 'photos', 'posts', 'messages', 'comments', 'videos', 'games', 'shoes', 'clothes', 'ideas', 'problems', 'reasons', 'ways', 'places', 'countries', 'states', 'cities', 'schools', 'teachers', 'workers', 'jobs', 'dollars', 'minutes', 'hours', 'miles', 'pounds', 'feet', 'inches', 'bottles', 'cups', 'plates', 'chairs', 'tables', 'phones', 'computers', 'apps', 'emails', 'texts', 'calls', 'meetings', 'reports', 'questions', 'answers', 'words', 'letters', 'numbers', 'rules', 'laws', 'teams', 'players', 'fans', 'followers', 'likes', 'views', 'subscribers'];
var FLUENT_UNCOUNTABLE = ['money', 'time', 'work', 'food', 'water', 'coffee', 'energy', 'love', 'help', 'information', 'advice', 'traffic', 'noise', 'stuff', 'homework', 'research', 'progress', 'luck', 'fun', 'music', 'sleep', 'space', 'room', 'air', 'patience', 'attention', 'respect', 'support', 'experience', 'knowledge', 'news', 'furniture', 'equipment', 'luggage', 'baggage', 'mail', 'hair', 'sugar', 'salt', 'rice', 'bread', 'cheese', 'meat'];

/* Informal -> formal (Professional only). */
var FLUENT_FORMAL = {
  gonna: 'going to', wanna: 'want to', gotta: 'have to', kinda: 'somewhat',
  sorta: 'somewhat', yeah: 'yes', yup: 'yes', yep: 'yes', nah: 'no', nope: 'no'
};
var FLUENT_FORMAL_RE = new RegExp('\\b(' + Object.keys(FLUENT_FORMAL).join('|') + ')\\b', 'gi');

/* Contraction -> spelled out (Professional only). */
var FLUENT_EXPAND = {
  "can't": 'cannot', "won't": 'will not', "don't": 'do not', "doesn't": 'does not',
  "didn't": 'did not', "isn't": 'is not', "aren't": 'are not', "wasn't": 'was not',
  "weren't": 'were not', "haven't": 'have not', "hasn't": 'has not',
  "couldn't": 'could not', "shouldn't": 'should not', "wouldn't": 'would not',
  "I'm": 'I am', "you're": 'you are', "we're": 'we are', "they're": 'they are',
  "it's": 'it is', "that's": 'that is', "there's": 'there is', "here's": 'here is',
  "what's": 'what is', "let's": 'let us', "I've": 'I have', "you've": 'you have',
  "we've": 'we have', "they've": 'they have', "I'll": 'I will', "you'll": 'you will',
  "he'll": 'he will', "she'll": 'she will', "it'll": 'it will', "we'll": 'we will',
  "they'll": 'they will', "I'd": 'I would', "you'd": 'you would',
  "he'd": 'he would', "she'd": 'she would', "we'd": 'we would', "they'd": 'they would'
};
var FLUENT_EXPAND_RE = new RegExp(Object.keys(FLUENT_EXPAND).map(function (k) {
  return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}).join('|'), 'gi');

/* Split sentences while protecting abbreviations (Mr., Dr., U.S., e.g.). */
function fluentSplitSentences(text) {
  var guard = text.replace(/\b(Mr|Mrs|Ms|Dr|St|Sr|Jr|vs|e\.g|i\.e|U\.S|U\.K|a\.m|p\.m)\./gi, function (m) {
    return m.replace(/\./g, '\u0001');
  });
  var parts = splitSentences(guard);
  return parts.map(function (s) { return s.replace(//g, '.'); });
}

function fluentCapitalize(s) {
  s = s.replace(/\bi\b/g, 'I');
  s = s.replace(/(^|[.!?]\s+)([a-z])/g, function (m, pre, ch) { return pre + ch.toUpperCase(); });
  return s;
}

function fluentCleanup(s) {
  s = s.replace(/\s{2,}/g, ' ');
  s = s.replace(/\s+([,.!?;:])/g, '$1');
  s = s.replace(/(^|[.!?]\s*),\s*/g, '$1');
  s = s.replace(/,\s*,/g, ',');
  return s.trim();
}

function fluentEnglish(text, option, opts) {
  var opt = (option === 'polish' || option === 'professional') ? option : 'correct';
  var log = [];
  var s = String(text || '').trim();
  if (!s) return { text: '', option: opt, explanations: [] };

  /* 1. Whitespace + punctuation spacing. "U.S.A" keeps its dots. */
  s = s.replace(/\s+/g, ' ');
  s = s.replace(/\s+([,.!?;:])/g, '$1');
  s = s.replace(/(\w)([,.!?])([A-Za-z])/g, function (m, before, p, after) {
    if (p === '.' && /[A-Z]/.test(before) && /[A-Z]/.test(after)) return m;
    return before + p + ' ' + after;
  });

  /* 2. Spoken punctuation from voice-to-text dictation. */
  s = fluentRule(s, /\s+comma(?=\s+[a-z]|\s*$)/gi, ',', "spoken 'comma' turned into a real comma (voice-to-text cleanup)", log);
  s = fluentRule(s, /\s+period(?=\s+[a-z]|\s*$)/gi, '.', "spoken 'period' turned into a real period (voice-to-text cleanup)", log);
  s = fluentRule(s, /\s+question\s+mark(?=\s+[a-z]|\s*$)/gi, '?', "spoken 'question mark' turned into a real question mark (voice-to-text cleanup)", log);
  s = fluentRule(s, /\s+exclamation\s+(point|mark)(?=\s+[a-z]|\s*$)/gi, '!', "spoken 'exclamation point' turned into a real exclamation mark (voice-to-text cleanup)", log);

  /* 3. Missing apostrophes. */
  s = fluentRule(s, FLUENT_CONTRACTION_RE, function (m) {
    var low = m.toLowerCase();
    var out = FLUENT_CONTRACTIONS[low] || m;
    if (/^[A-Z]/.test(m)) out = capFirst(out);
    return out;
  }, "added the missing apostrophe", log);

  /* 4. Misspellings. */
  s = fluentRule(s, FLUENT_SPELLING_RE, function (m) {
    var low = m.toLowerCase();
    var out = FLUENT_SPELLING[low] || m;
    if (/^[A-Z]/.test(m)) out = capFirst(out);
    return out;
  }, 'spelling', log);

  /* 5. Commonly confused words. */
  for (var i = 0; i < FLUENT_CONFUSED.length; i++) {
    s = fluentRule(s, FLUENT_CONFUSED[i].re, FLUENT_CONFUSED[i].out, FLUENT_CONFUSED[i].why, log);
  }

  /* 6. Grammar: agreement, gone/went, seen/saw, repeated words,
   * and past tense after "yesterday". */
  for (var gi = 0; gi < FLUENT_GRAMMAR.length; gi++) {
    s = fluentRule(s, FLUENT_GRAMMAR[gi].re, FLUENT_GRAMMAR[gi].out, FLUENT_GRAMMAR[gi].why, log);
  }
  s = s.replace(/\b([A-Za-z]{3,})\s+\1\b/gi, function (m, w) {
    var low = w.toLowerCase();
    if (['had', 'ha', 'no', 'bye', 'go', 'so', 'la', 'na', 'yeah', 'ok', 'boom', 'chop', 'blah', 'hey', 'yo'].indexOf(low) !== -1) return m;
    log.push({ from: m, to: w, why: 'repeated word removed' });
    return w;
  });
  var sentences = fluentSplitSentences(s);
  for (var si = 0; si < sentences.length; si++) {
    if (/\byesterday\b/i.test(sentences[si])) {
      sentences[si] = fluentRule(sentences[si], FLUENT_PAST_RE, function (m, to, verb) {
        if (to) return m;
        var low = verb.toLowerCase();
        var out = FLUENT_PAST[low] || verb;
        if (/^[A-Z]/.test(verb)) out = capFirst(out);
        return out;
      }, "'yesterday' means past tense — the verb moves to the past", log);
    }
  }
  s = sentences.join(' ');

  /* 7. Polish It / Professional: flow, run-ons, tighter wording. */
  if (opt !== 'correct') {
    /* Voice-to-text run-ons: "and then" chains become sentences. */
    var beforeRunOn = s;
    s = s.replace(/\s+and then\s+/gi, '. Then ');
    if (s !== beforeRunOn) log.push({ from: 'and then', to: '. Then', why: 'split a run-on sentence into two for readability' });
    /* Long sentences split at "and/so + pronoun". */
    var parts = fluentSplitSentences(s);
    for (var pi = 0; pi < parts.length; pi++) {
      var words = parts[pi].split(/\s+/).length;
      if (words > 18) {
        var np = parts[pi].replace(/\s+(and|so)\s+(I|he|she|they|we|you)\b/i, function (m, conj, pron) {
          log.push({ from: conj + ' ' + pron, to: '. ' + pron, why: 'split a long run-on sentence into two for readability' });
          return '. ' + pron;
        });
        parts[pi] = np;
      }
    }
    s = parts.join(' ');
    /* Bare "I + verb" clause boundary with no punctuation at all
     * (voice-to-text): "thanks for the help i wanted to check in" ->
     * "...help. I wanted to check in." Never split after a conjunction
     * or "that/if/when" — "you and I went" stays one sentence. */
    var FLUENT_I_VERBS = ['wanted', 'needed', 'thought', 'went', 'got', 'saw', 'did', 'was', 'am', 'have', 'need', 'want', 'think', 'know', 'feel', 'like', 'love', 'hate', 'tried', 'called', 'texted', 'emailed', 'checked', 'looked', 'asked', 'told', 'said', 'came', 'left', 'started', 'finished', 'woke', 'drove', 'bought', 'sent', 'gave', 'took', 'made', 'ate', 'drank', 'ran', 'walked', 'worked', 'played', 'watched', 'read', 'heard', 'found', 'met', 'paid', 'slept', 'won', 'lost', 'forgot', 'remembered', 'decided', 'hoped', 'wished', 'missed', 'noticed', 'realized', 'figured', 'guessed', 'believed', 'meant', 'kept', 'put', 'set', 'turned', 'moved', 'stayed', 'lived', 'grew', 'learned', 'taught', 'spoke', 'wrote', 'sang', 'laughed', 'cried', 'smiled', 'waited', 'helped', 'showed', 'brought', 'caught', 'chose', 'broke', 'built', 'spent', 'sold', 'wore', 'swam', 'danced', 'jumped', 'opened', 'closed', 'cleaned', 'cooked', 'washed', 'brushed', 'packed', 'traveled', 'visited', 'invited', 'joined', 'signed', 'applied', 'voted', 'graduated', 'fired', 'hired', 'returned', 'arrived', 'landed', 'boarded', 'rode', 'flew', 'shopped', 'ordered', 'tipped', 'baked', 'served', 'poured', 'tasted', 'kissed', 'hugged', 'fought', 'argued', 'agreed', 'promised', 'warned', 'advised', 'suggested', 'offered', 'refused', 'accepted', 'declined', 'approved', 'rejected', 'confirmed', 'canceled', 'rescheduled', 'postponed', 'rushed', 'hurried', 'stopped', 'continued', 'began', 'ended', 'completed', 'passed', 'failed', 'scored', 'earned', 'saved', 'wasted', 'invested', 'donated', 'borrowed', 'lent', 'owed', 'charged', 'refunded', 'exchanged', 'replaced', 'fixed', 'repaired', 'installed', 'downloaded', 'uploaded', 'posted', 'shared', 'liked', 'commented', 'subscribed', 'blocked', 'reported', 'followed', 'messaged', 'facetimed', 'streamed', 'recorded', 'filmed', 'edited', 'designed', 'drew', 'painted', 'typed', 'printed', 'copied', 'deleted', 'backed', 'restored', 'updated', 'logged', 'created', 'locked', 'unlocked', 'paused', 'resumed', 'skipped', 'repeated'];
    var FLUENT_NO_SPLIT = ['and', 'that', 'if', 'when', 'because', 'but', 'so', 'or', 'while', 'as', 'than', 'with', 'for', 'to', 'of', 'my', 'your', 'his', 'her', 'their', 'our', 'me', 'you', 'him', 'us', 'them', 'what', 'who', 'where', 'why', 'how', 'which', 'whose', 'whom'];
    var iParts = fluentSplitSentences(s);
    for (var ipi = 0; ipi < iParts.length; ipi++) {
      if (iParts[ipi].split(/\s+/).length < 7) continue;
      iParts[ipi] = iParts[ipi].replace(new RegExp('\\b(\\w+)\\s+(i)\\s+((?:just|really|actually|also|still)\\s+)?(' + FLUENT_I_VERBS.join('|') + ')\\b', 'gi'),
        function (m, prev, iword, filler, verb) {
          if (FLUENT_NO_SPLIT.indexOf(prev.toLowerCase()) !== -1) return m;
          log.push({ from: prev + ' ' + iword + ' ' + verb, to: prev + '. I ' + verb, why: 'split a run-on sentence into two for readability' });
          return prev + '. I ' + (filler || '') + verb;
        });
    }
    s = iParts.join(' ');
    /* "very X" -> one stronger word. */
    s = fluentRule(s, FLUENT_VERY_RE, function (m, adj) {
      var low = adj.toLowerCase();
      return FLUENT_VERY[low] || adj;
    }, 'tightened a weak phrase into one stronger word', log);
    /* Wordy phrases. */
    s = fluentRule(s, /\bdue to the fact that\b/gi, 'because', "shortened 'due to the fact that' to 'because'", log);
    s = fluentRule(s, /\bat this point in time\b/gi, 'now', "shortened 'at this point in time' to 'now'", log);
    s = fluentRule(s, /\bin spite of the fact that\b/gi, 'although', "shortened 'in spite of the fact that' to 'although'", log);
    s = fluentRule(s, /\bin my opinion,?\s+i think\b/gi, 'I think', "removed the redundant 'in my opinion' — 'I think' already says it", log);
    /* "a lot of" -> many / much, when the noun is known. */
    s = fluentRule(s, new RegExp('\\ba lot of\\s+(' + FLUENT_PLURAL.join('|') + ')\\b', 'gi'),
      function (m, n) { return 'many ' + n; }, "tightened 'a lot of' to 'many'", log);
    s = fluentRule(s, new RegExp('\\ba lot of\\s+(' + FLUENT_UNCOUNTABLE.join('|') + ')\\b', 'gi'),
      function (m, n) { return 'much ' + n; }, "tightened 'a lot of' to 'much'", log);
    /* "Me and my friend" -> "My friend and I" (sentence start only). */
    s = fluentRule(s, /(^|[.!?]\s+)me and (my\s+)?(friend|brother|sister|mom|dad|mother|father|cousin|uncle|aunt|son|daughter|boyfriend|girlfriend|husband|wife|partner|boss|teacher|neighbor|neighbour)\b/gi,
      function (m, pre, my, noun) { return pre + (my || '') + noun + ' and I'; },
      "'me and X' becomes 'X and I' at the start of a sentence", log);
    /* Drop "that" after think/know/said when it adds nothing. */
    s = fluentRule(s, /\b(think|know|said|say|feel|believe)\s+that\s+(?=(I|you|he|she|it|we|they|the|a|an|this|there|my|his|her|their|our|your)\b)/gi,
      function (m, v) { return v; }, "dropped an unnecessary 'that'", log);
  }

  /* 8. Professional: formal wording, spelled-out contractions. */
  if (opt === 'professional') {
    s = fluentRule(s, FLUENT_FORMAL_RE, function (m) {
      var low = m.toLowerCase();
      var out = FLUENT_FORMAL[low] || m;
      if (/^[A-Z]/.test(m)) out = capFirst(out);
      return out;
    }, 'formal wording for a professional tone', log);
    var beforeLol = s;
    s = s.replace(/\s*\b(lol|lmao|rofl|lolz)\b,?/gi, '');
    if (s !== beforeLol) log.push({ from: 'lol', to: '(removed)', why: 'removed an informal laughter marker for a formal tone' });
    s = fluentRule(s, /\bthanks\b(?=\s+for\b|[.!?]|$)/gi, 'Thank you', "formal 'Thank you' instead of 'thanks'", log);
    s = fluentRule(s, /(^|[.!?]\s+)hey,/gi, function (m, pre) { return pre + 'Hello,'; }, "formal greeting 'Hello' instead of 'Hey'", log);
    s = fluentRule(s, FLUENT_EXPAND_RE, function (m) {
      var out = FLUENT_EXPAND[m] || FLUENT_EXPAND[capFirst(m.toLowerCase())] || m;
      if (/^[A-Z]/.test(m) && /^[a-z]/.test(out)) out = capFirst(out);
      return out;
    }, 'spelled out for a formal tone', log);
    s = fluentRule(s, /\bjust\s+(wanted|needed|thought|wondering|checking|reaching|following|writing|calling|emailing|letting)\b/gi,
      function (m, v) { return v; }, "removed filler 'just' for a more direct tone", log);
  }

  /* 9. Final cleanup, capitalization, end punctuation. */
  s = fluentCleanup(s);
  /* Sentence-start discourse words take a comma: "Yeah I'm coming" -> "Yeah, I'm coming." */
  s = s.replace(/(^|[.!?]\s+)(yeah|yes|no|okay|ok|well|hey)\s+([A-Za-z]+)/gi, function (m, pre, w, next) {
    if (w.toLowerCase() === 'no' && next.toLowerCase() === 'way') return m; /* "No way" is an idiom, not a comma case */
    return pre + w + ', ' + next;
  });
  s = fluentCapitalize(s);
  var finalParts = fluentSplitSentences(s);
  for (var fi = 0; fi < finalParts.length; fi++) {
    var p = finalParts[fi].trim();
    if (!p) continue;
    if (!/[.!?]$/.test(p)) p += isQuestion(p) ? '?' : '.';
    finalParts[fi] = p;
  }
  s = fluentCleanup(finalParts.join(' '));

  /* Dedupe + cap explanations. */
  var seen = {};
  var explanations = [];
  for (var ei = 0; ei < log.length; ei++) {
    var key = log[ei].from.toLowerCase() + '|' + log[ei].to.toLowerCase();
    if (seen[key]) continue;
    seen[key] = true;
    explanations.push(log[ei]);
    if (explanations.length >= 12) break;
  }
  return { text: s, option: opt, explanations: explanations };
}

/* ---------- Say It Back (reply generator) ----------
 * Paste what someone said; get back three ways to answer it — in the
 * founder's voice. The engine detects the incoming message's intent
 * (question, greeting, compliment, insult, joke, request, venting,
 * flirting, thanks, apology, goodbye, statement), picks a plain-English
 * reply draft per flavor slot, then voices it through the chosen
 * personality's engine — Hood Talk uses the reworked intent-aware
 * engine, so replies sound like real talk, not word swaps.
 * Replies never invent facts (no made-up times, dates, or promises)
 * and never escalate: clapbacks are comedic and confident, never
 * genuinely threatening or harassing.
 */
var SAYITBACK_LABELS = {
  hood: ['Confident', 'Funny', 'Short & smooth'],
  gangster: ['Boss move', 'Smooth', 'Straight up'],
  og: ['Wise', 'Calm', 'Short'],
  funny: ['Wild', 'Extra', 'Quick'],
  crashout: ['Loud', 'Extra loud', 'Short fuse'],
  savage: ['Cold', 'Petty', 'One-liner'],
  poet: ['Poetic', 'Deep', 'Short verse'],
  authentic: ['Real', 'Chill', 'Straight']
};

var SAYITBACK_INTENT_NOTES = {
  greeting: 'They greeted you — here are three ways to greet back.',
  question: 'They asked a question — here are three ways to answer it.',
  compliment: 'They complimented you — here are three ways to take it.',
  insult: 'They threw a diss — here are three ways to clap back (funny, not mean).',
  request: 'They asked you for something — here are three ways to answer.',
  joke: 'They cracked a joke — here are three ways to laugh back.',
  vent: 'They are venting — here are three ways to have their back.',
  flirting: 'They are flirting — here are three ways to play it back.',
  thanks: 'They thanked you — here are three ways to take it.',
  apology: 'They apologized — here are three ways to accept it.',
  goodbye: 'They are heading out — here are three ways to say bye.',
  statement: 'Here are three ways to answer that.'
};

/* Reply drafts per intent: 3 flavor slots, 2 drafts each.
 * {kw} is replaced with a content word from their message when one
 * exists ("the work situation"); drafts without {kw} are always safe. */
var SAYITBACK_DRAFTS = {
  greeting: [
    ["What's good? I'm doing my thing out here, what's the move today?",
     "Hey, what's good? I'm good, just handling business. What you got going on?"],
    ["Hey! Look who finally showed up. I'm good, what's the word?",
     "Well well, look who it is. I'm alive and kicking, what's good with you?"],
    ["What's good.",
     "Hey, what up."]
  ],
  question: [
    ["Good question. I'm good whenever, you pick a time and I'm there.",
     "Real talk, the {kw} situation? I got you, just say the word and it's handled."],
    ["Honestly? Let me get back to you on that one, but I'm on it.",
     "You asking the real questions now. Give me a sec and I'll figure it out."],
    ["Say less, I'm on it.",
     "Got you, I'll let you know."]
  ],
  compliment: [
    ["Appreciate you, I stay looking good, what can I say?",
     "Thank you, I know, I know. You got good taste."],
    ["Aw, you flattering me now? Keep going, I like this.",
     "Thank you! I woke up like this, no effort at all."],
    ["Appreciate that.",
     "Good looking out, thank you."]
  ],
  insult: [
    ["You calling me annoying? I'm the best part of your day, admit it.",
     "That's cute, coming from you. Say it with your whole chest next time."],
    ["Wow, tell me how you really feel. That was cute, you done?",
     "Lol, you tried it. That was your best shot?"],
    ["Stay mad.",
     "Okay, and? That was cute."]
  ],
  request: [
    ["Yeah, I got you, don't even worry about it.",
     "Say less, I'll handle that for you."],
    ["You got it, I'm on the job. No extra charge this time.",
     "Alright alright, I'll do it, but you owe me one."],
    ["Got you.",
     "On it."]
  ],
  joke: [
    ["Lol, you got jokes today. That one was actually funny.",
     "Okay that was good, I give you that one, you got jokes."],
    ["I'm weak, that got me. You been saving that one up?",
     "Stop, you silly for that one, that was funny."],
    ["Lol, that's funny.",
     "You got me."]
  ],
  vent: [
    ["I hear you, shake that off, you got this. Don't let them get to you.",
     "Real talk, that {kw} situation sounds rough, but you built for this. Keep your head up."],
    ["Damn, they really testing you today. Go get you a snack and reset.",
     "Ugh, that's the worst. Take a breath, we'll laugh about this later."],
    ["I hear you.",
     "You got this, for real."]
  ],
  flirting: [
    ["You got my attention, what's good?",
     "Smooth. I see you, and I like what I see."],
    ["Okay, you ain't slick, but I like it.",
     "You really out here shooting your shot, huh? I respect it."],
    ["Hey, you got my attention.",
     "I see you, for real."]
  ],
  thanks: [
    ["Anytime, you already know I got you.",
     "Of course, that's what I'm here for."],
    ["You welcome, don't get used to it though.",
     "Anytime! I accept payment in snacks and compliments."],
    ["You got it.",
     "Anytime."]
  ],
  apology: [
    ["It's all good, don't even trip about it.",
     "We good, just don't do it again."],
    ["Apology accepted, but I'm keeping the receipt just in case.",
     "It's fine, I already forgot. Mostly."],
    ["We good.",
     "Don't worry about it."]
  ],
  goodbye: [
    ["Alright, be safe out there, hit me up later.",
     "Bet, talk to you later, take care."],
    ["Bye! Don't do anything I wouldn't do.",
     "Later! Try not to miss me too much."],
    ["Later.",
     "Talk later."]
  ],
  statement: [
    ["Real talk, I feel you on that.",
     "Facts, you said it right."],
    ["Okay, I hear you. Go on, I'm listening.",
     "Lol, say more, I'm invested now."],
    ["I feel you.",
     "Facts."]
  ]
};

/* Voice markers the reworked Hood Talk engine produces naturally. */
var SAYITBACK_VOICE = /og|big homie|big dawg|feel me|say less|on the set|finna|youngin|handle business|hold me down|do me a solid|slide me|slide to|gotta|tryna|dead tired|mad annoying|what's good|ayy|what's crackin'|mornin'|keep it solid|that's the move|what's the word|you already know|appreciate you|good lookin' out|fuck|bullshit|motherfucker|zero fucks|no bullshit|straight up/i;

var SIB_STOPWORDS = {};
(function () {
  var words = ('the a an and or but so if when what why how who whom which that this these those ' +
    'is are was were am be been being do does did have has had will would can could should ' +
    'i you he she it we they me him her us them my your his its our their to of in on at for with by from about as into over after before up down out off ' +
    'just very really so too not no yes please thanks thank hey hi hello yo oh well now today tomorrow yesterday here there then than ' +
    'get got go going went come came make made take took see saw know think said say let lets want wants need needs like love hate feel feels ' +
    'im ive id dont cant wont isnt arent wasnt didnt doesnt aint ur u ya yeah yup nah lol lmao haha omg btw rn ngl tbh imo smh ' +
    'dont cant wont isnt arent wasnt werent didnt doesnt havent hasnt hadnt couldnt shouldnt wouldnt mustnt ' +
    'im ive id ill youre youve youll theyre theyve theyll hes shes thats whats wheres whos heres theres lets aint its ' +
    'doing are you how is it whats up good morning afternoon evening night').split(' ');
  for (var i = 0; i < words.length; i++) SIB_STOPWORDS[words[i]] = true;
})();

function extractReplyKeyword(text) {
  var words = String(text || '').toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').split(/\s+/);
  for (var i = 0; i < words.length; i++) {
    var w = words[i].replace(/'/g, '').replace(/'+$/, '');
    if (w.length >= 3 && !SIB_STOPWORDS[w] && !/^\d+$/.test(w)) return w;
  }
  return '';
}

function detectReplyIntent(text) {
  var raw = String(text || '');
  var t = ' ' + raw.toLowerCase().replace(/[’‘]/g, "'") + ' ';
  var clean = t.replace(/[^a-z0-9'\s]/g, ' ');
  var wordCount = clean.trim().split(/\s+/).filter(Boolean).length;
  function has(re) { return re.test(t) || re.test(clean); }

  /* Greeting: short, starts with a greeting, and isn't really a question
   * ("Good morning, can we meet at 9?" is a question, not a greeting). */
  if (wordCount <= 8) {
    var g = clean.trim();
    if (/^(what'?s\s+(up|good|poppin)|whats\s+(up|good)|what\s+up|sup|aye|hiya|how'?s\s+it\s+going)\b/.test(g)) return 'greeting';
    var gm = g.match(/^(hi|hey|hello|yo|howdy|good\s+(morning|afternoon|evening))\b/);
    if (gm) {
      var grest = g.slice(gm[0].length).replace(/^[,!\s]+/, '').trim();
      if (!grest) return 'greeting';
      if (/^(what'?s\s+(up|good|poppin)|whats\s+(up|good)|what\s+up|how\s+are\s+you|how'?s\s+it\s+going|how\s+you\s+doing)\b/.test(grest)) return 'greeting';
      if (!/\?/.test(grest) && !/^(can|could|will|would|what|why|when|where|who|how|do|does|did|is|are)\b/.test(grest)) return 'greeting';
    }
  }
  /* Goodbye. */
  if (has(/\b(good\s*night|goodnight|goodbye|bye|see\s+ya|talk\s+later|gtg|gotta\s+go|got\s+to\s+go|i'?m\s+out|later\s+gator)\b/)) return 'goodbye';
  /* Thanks. */
  if (has(/\b(thank\s+you|thanks|thx|appreciate\s+(you|it|that)|much\s+love|good\s+lookin'?)\b/)) return 'thanks';
  /* Apology. */
  if (has(/\b(sorry|my\s+bad|my\s+fault|apolog(y|ize|ise)|i\s+didn'?t\s+mean\s+(it|to))\b/)) return 'apology';
  /* Insult / diss. */
  if (has(/\b(stupid|dumb|ugly|trash|wack|lame|loser|clown|idiot|annoying|pathetic|shut\s+up|hate\s+you|you\s+suck|nobody\s+likes\s+you|you\s+always|you\s+never|you'?re\s+so\s+(dumb|stupid|ugly|annoying|pathetic|weird|lame))\b/) ||
      has(/\byou'?re\s+(a\s+)?(joke|clown|loser|idiot|trash)\b/)) return 'insult';
  /* Flirting. */
  if (has(/\b(cutie|handsome|beautiful|gorgeous|sexy|miss\s+you|thinking\s+of\s+you|wyd|what\s+you\s+doing|hey\s+cutie|hey\s+handsome|you'?re\s+cute|you\s+look\s+good|good\s+looking)\b/) ||
      /😘|❤️|💕|😍/.test(raw)) return 'flirting';
  /* Compliment. */
  if (has(/\b(you\s+look\s+(great|good|amazing|nice|beautiful|handsome|fire|dope)|love\s+your|great\s+job|good\s+job|proud\s+of\s+you|you'?re\s+the\s+best|you'?re\s+(amazing|awesome|great|so\s+talented|so\s+smart)|nice\s+(work|pic|photo|post|fit|outfit))\b/)) return 'compliment';
  /* Venting. */
  if (has(/\b(i'?m\s+so\s+(tired|stressed|done|over\s+it|annoyed|frustrated|sick\s+of)|bad\s+day|everything\s+sucks|i\s+can'?t\s+(take|deal|do)\s+this|ugh|stressed\s+out|tired\s+of|frustrated|so\s+done|my\s+(boss|mom|dad|teacher|job|life)\s+is\s+(on\s+me|killing\s+me|the\s+worst))\b/)) return 'vent';
  /* Joke. */
  if (has(/\b(lol|lmao|haha|that'?s\s+funny|knock\s+knock|did\s+you\s+hear\s+the\s+one|i'?m\s+dead|funny\s+as\s+hell)\b/) ||
      /😂|🤣/.test(raw)) return 'joke';
  /* Request. */
  if (has(/\b(can|could|will|would)\s+you\s+(please\s+)?(send|give|tell|show|bring|get|make|call|text|take|help|do|check|look|let|pass|drop|pick|buy|pay|drive|cook|clean|fix|watch|read|write|open|close|move|stop|start)\b/) ||
      has(/\bplease\s+(send|give|tell|show|bring|get|make|call|text|take|help|do|check|look|let|pass|drop|pick|buy|pay|drive|cook|clean|fix|watch|read|write|open|close|move|stop|start)\b/) ||
      has(/\b(send|give)\s+me\b/) || has(/\bdo\s+me\s+a\s+favor\b/) ||
      has(/\bneed\s+you\s+to\b/) || has(/\bcan\s+i\s+(get|have|borrow|use)\b/)) return 'request';
  /* Question. */
  if (/\?\s*$/.test(raw.trim()) || /^(can|could|will|would|should|do|does|did|is|are|was|were|what|why|when|where|who|how|am|have|has|may|might)\b/i.test(raw.trim())) return 'question';
  return 'statement';
}

function sayItBack(text, personality, intensity, opts) {
  opts = opts || {};
  var seed = (opts.seed !== undefined) ? opts.seed : ((Date.now() % 2147483647) ^ Math.floor(Math.random() * 1e9));
  var rng = makeRng(seed);
  var inten = clamp(Math.round(intensity) || 5, 1, 10);
  var p = getPersonality(personality);
  var detected = detectReplyIntent(text);
  var kw = extractReplyKeyword(text);
  var slots = SAYITBACK_DRAFTS[detected] || SAYITBACK_DRAFTS.statement;
  var labels = SAYITBACK_LABELS[p.id] || SAYITBACK_LABELS.hood;
  var replies = [];
  var seen = {};
  for (var i = 0; i < 3; i++) {
    var drafts = slots[i] || slots[0];
    var usable = [];
    for (var d = 0; d < drafts.length; d++) {
      if (kw || drafts[d].indexOf('{kw}') === -1) usable.push(drafts[d]);
    }
    if (!usable.length) usable = drafts.slice();
    var voiced = '';
    var attempt = 0;
    while (attempt < 4) {
      var draft = pick(rng, usable).replace(/\{kw\}/g, kw || '');
      voiced = translate(draft, p.id, inten, { seed: seed + i * 7919 + attempt * 104729, nfg: opts.nfg }).text;
      attempt++;
      if (!voiced.trim()) continue;
      if (seen[voiced]) continue;
      /* Hood Talk replies must actually sound like Hood Talk: if the
       * voicing came out bare, try another seed before accepting. */
      if (p.id === 'hood' && !SAYITBACK_VOICE.test(voiced) && attempt < 4) continue;
      break;
    }
    if (!voiced.trim()) voiced = pick(rng, usable).replace(/\{kw\}/g, kw || '');
    seen[voiced] = true;
    replies.push({ label: labels[i], text: voiced });
  }
  return { intent: detected, keyword: kw, replies: replies, personality: p.id };
}

/* ---------- randomizer ---------- */
var RANDOM_PHRASES = [
  { p: 'hood', t: 'Aight, I\'m finna go grab some food, anybody want anything or y\'all just gonna stare at me?' },
  { p: 'hood', t: 'Yo, my phone at 2% and I left my charger at the crib. This is how villains are made.' },
  { p: 'hood', t: 'It\'s too hot outside for all this. I\'m staying in the AC until further notice, no cap.' },
  { p: 'hood', t: 'Somebody ate the last slice and didn\'t say a word. We got a snake in the house.' },
  { p: 'hood', t: 'Lowkey, the best part of my day is when everybody finally leaves me alone.' },
  { p: 'hood', t: 'I told my alarm I\'d wake up early. We both knew that was a lie.' },
  { p: 'gangster', t: 'Ayy, listen. Respect is earned, not given. And I earned mine a long time ago, you dig?' },
  { p: 'gangster', t: 'I don\'t chase nobody. I handle my business, I keep my circle small, and I move in silence.' },
  { p: 'gangster', t: 'Let me put you on game: never let them see you sweat, and never explain yourself twice.' },
  { p: 'gangster', t: 'I came from nothing, built something, and I\'m still standing. That\'s word.' },
  { p: 'gangster', t: 'You want loyalty? Then be loyal. It\'s that simple. The streets don\'t forget.' },
  { p: 'gangster', t: 'I keep my word like I keep my money — close, counted, and never lent out for free.' },
  { p: 'og', t: 'Listen here, young blood. A man who can\'t control his temper can\'t control nothing else either.' },
  { p: 'og', t: 'Back in my day, we didn\'t have all these apps. We had a corner, a ball, and each other. And we were fine.' },
  { p: 'og', t: 'Son, the game ain\'t changed, only the players. Watch, listen, learn — then move.' },
  { p: 'og', t: 'I\'ve seen it all, twice. So when I tell you to slow down, it\'s because I know where fast gets you.' },
  { p: 'og', t: 'Money comes and goes, but your name? Your name follows you everywhere. Protect it.' },
  { p: 'og', t: 'You want to be great? Show up every day. That\'s the whole secret. The rest is noise.' },
  { p: 'funny', t: 'Yo, I went to the gym once and my body filed a formal complaint. We are not on speaking terms.' },
  { p: 'funny', t: 'My bank account just texted me "lol" and I felt that in my soul.' },
  { p: 'funny', t: 'I tried to eat healthy today but the pizza looked at me like "you know you want this" and honestly? It was right.' },
  { p: 'funny', t: 'I\'m not saying I\'m broke, but my card just declined a $2 coffee and the cashier felt bad for ME.' },
  { p: 'funny', t: 'My sleep schedule is so messed up, my dreams got a waiting list now.' },
  { p: 'funny', t: 'I told myself I\'d only watch one episode. That was four seasons ago. Send help and snacks.' },
  { p: 'crashout', t: 'AYO, WHO ATE MY LEFTOVERS?! I LABELED THAT! I PUT MY NAME ON IT! THIS IS WAR NOW!' },
  { p: 'crashout', t: 'THE WIFI WENT OUT IN THE MIDDLE OF MY SHOW. I AM NOT OKAY. SOMEBODY NEEDS TO FIX THIS RIGHT NOW!' },
  { p: 'crashout', t: 'I WAITED TWENTY MINUTES FOR MY FOOD AND THEY GAVE ME THE WRONG ORDER. TWENTY MINUTES! I\'M DONE!' },
  { p: 'crashout', t: 'SOMEONE PARKED IN MY SPOT. MY SPOT. I HAVE LIVED HERE FOR YEARS AND TODAY IS THE DAY I LOSE IT!' },
  { p: 'crashout', t: 'MY PHONE DIED AT 4% WHILE I WAS MID-TEXT. FOUR PERCENT! I DID NOTHING TO DESERVE THIS!' },
  { p: 'crashout', t: 'THEY CANCELLED MY FAVORITE SHOW AFTER ONE SEASON. ONE SEASON! WHO DO I NEED TO FIGHT?!' },
  { p: 'savage', t: 'Oh, you have an opinion? How brave. Shame it\'s wrong, but brave nonetheless.' },
  { p: 'savage', t: 'I\'d agree with you, but then we\'d both be wrong, and I have standards.' },
  { p: 'savage', t: 'You bring nothing to the table except an appetite. Impressive, honestly.' },
  { p: 'savage', t: 'I\'m not saying you\'re the problem, but every room gets quieter when you walk in. Coincidence? Sure.' },
  { p: 'savage', t: 'Your confidence is inspiring, mostly because it has absolutely no evidence behind it.' },
  { p: 'savage', t: 'Thanks for the advice. I\'ll file it right next to everything else I didn\'t ask for.' },
  { p: 'poet', t: 'The morning breaks open like a cracked egg of gold, and somewhere a coffee pot sings its small, dark hymn.' },
  { p: 'poet', t: 'Beneath the neon and the noise, every stranger carries a whole novel in their pockets, unread.' },
  { p: 'poet', t: 'The rain taps its fingers on the rooftops, impatient, while the city below pretends not to listen.' },
  { p: 'poet', t: 'The streetlights bloom like tired stars, guarding the dreams of everyone still awake at 3 a.m.' },
  { p: 'poet', t: 'In the hush between sirens, the neighborhood exhales — and for one quiet moment, everything is enough.' },
  { p: 'poet', t: 'The pavement holds the footprints of a thousand small dreams, each one still walking toward morning.' },
  { p: 'authentic', t: 'Honestly, some days you just need to sit down, eat something good, and not talk to anybody for a while.' },
  { p: 'authentic', t: 'Real talk, I\'m tired. Not sleepy tired — like, soul tired. I need a whole weekend of nothing.' },
  { p: 'authentic', t: 'Look, I\'m not mad, I\'m just saying — if you said you were coming, then come. That\'s all.' },
  { p: 'authentic', t: 'I mean, the food was good, the music was loud, and everybody was actually happy for once. That\'s rare.' },
  { p: 'authentic', t: 'For real, the best nights are the ones with no plan. Just the homies, some food, and nowhere to be.' },
  { p: 'authentic', t: 'You know what? Today was actually a good day. I\'m not even gonna question it.' }
];

function randomPhrase(rng) {
  rng = rng || makeRng((Date.now() % 2147483647) ^ Math.floor(Math.random() * 1e9));
  return pick(rng, RANDOM_PHRASES);
}

/* ---------- history / favorites (pure list logic; browser wraps localStorage) ---------- */
function makeId() {
  return 'ht-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36);
}

function historyAdd(list, entry) {
  var item = {
    id: makeId(),
    ts: Date.now(),
    input: entry.input,
    personality: entry.personality || null,
    intensity: entry.intensity || null,
    mode: entry.mode || 'slang',
    fluentOption: entry.fluentOption || null,
    labels: entry.labels || null,
    outputs: entry.outputs.slice(0, 3)
  };
  var next = [item].concat(list || []);
  return next.slice(0, 50);
}
function historyRemove(list, id) {
  return (list || []).filter(function (x) { return x.id !== id; });
}
function favAdd(list, fav) {
  var item = {
    id: makeId(),
    ts: Date.now(),
    text: fav.text,
    personality: fav.personality,
    input: fav.input || '',
    mode: fav.mode || 'slang',
    fluentOption: fav.fluentOption || null,
    labels: fav.labels || null
  };
  if ((list || []).some(function (x) { return x.text === item.text; })) return list;
  return [item].concat(list || []).slice(0, 100);
}
function favRemove(list, id) {
  return (list || []).filter(function (x) { return x.id !== id; });
}
function isFav(list, text) {
  return (list || []).some(function (x) { return x.text === text; });
}

/* ---------- exports for node tests ---------- */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VERSION: VERSION,
    PERSONALITIES: PERSONALITIES,
    getPersonality: getPersonality,
    splitSentences: splitSentences,
    isQuestion: isQuestion,
    translate: translate,
    translateVariations: translateVariations,
    translateBack: translateBack,
    slangDensity: slangDensity,
    flavorDensity: flavorDensity,
    randomPhrase: randomPhrase,
    RANDOM_PHRASES: RANDOM_PHRASES,
    fluentEnglish: fluentEnglish,
    FLUENT_OPTIONS: FLUENT_OPTIONS,
    fluentOptionName: fluentOptionName,
    sayItBack: sayItBack,
    detectReplyIntent: detectReplyIntent,
    SAYITBACK_LABELS: SAYITBACK_LABELS,
    historyAdd: historyAdd,
    historyRemove: historyRemove,
    favAdd: favAdd,
    favRemove: favRemove,
    isFav: isFav,
    makeRng: makeRng
  };
}

/* ---------- browser UI ---------- */
if (typeof document !== 'undefined') (function () {
  var $ = function (id) { return document.getElementById(id); };
  var state = {
    tab: 'home',
    mode: 'slang',
    personality: 'hood',
    intensity: 5,
    nfg: false,
    fluentOption: 'correct',
    fluentExplanations: [],
    sibPersonality: 'hood',
    sibInput: '',
    sibReplies: [],
    sibIntent: 'statement',
    results: [],
    currentInput: '',
    favorites: [],
    history: [],
    settings: { defaultPersonality: 'hood', defaultIntensity: 5, defaultMode: 'slang', nfg: false }
  };

  /* ----- NO FUCKS GIVEN toggle (Hood Talk only, persisted) ----- */
  function setNfg(v) {
    state.nfg = !!v;
    state.settings.nfg = !!v;
    saveStore(STORAGE_SETTINGS, state.settings);
    var home = $('nfg-toggle');
    if (home) home.checked = state.nfg;
    var set = $('settings-nfg-toggle');
    if (set) set.checked = state.nfg;
    renderPersonalityChips();
    toast(state.nfg ? 'NO FUCKS GIVEN on. Hood Talk unleashed.' : 'NO FUCKS GIVEN off.');
  }

  function loadStore(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function saveStore(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* storage full/blocked */ }
  }

  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.hidden = true; }, 2200);
  }

  function copyText(text, msg) {
    function done() { toast(msg || 'Copied.'); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    } else { fallbackCopy(text); done(); }
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }

  function speak(text, personalityId) {
    if (!('speechSynthesis' in window)) { toast('Voice isn\'t available in this browser.'); return; }
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    var p = getPersonality(personalityId);
    u.rate = p.speech.rate;
    u.pitch = p.speech.pitch;
    window.speechSynthesis.speak(u);
  }

  /* ----- tabs ----- */
  function showTab(name) {
    state.tab = name;
    var panels = document.querySelectorAll('.tab-panel');
    for (var i = 0; i < panels.length; i++) panels[i].hidden = panels[i].id !== 'tab-' + name;
    var btns = document.querySelectorAll('.tab-btn');
    for (var j = 0; j < btns.length; j++) {
      var active = btns[j].getAttribute('data-tab') === name;
      btns[j].classList.toggle('is-active', active);
      btns[j].setAttribute('aria-selected', active ? 'true' : 'false');
    }
    if (name === 'history') renderHistory();
    if (name === 'settings') renderSettings();
    if (name === 'favorites') renderFavorites();
    if (name === 'modes') renderModes();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ----- personality picker ----- */
  function renderPersonalityChips() {
    var wrap = $('personality-chips');
    wrap.innerHTML = '';
    PERSONALITIES.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (p.id === state.personality ? ' is-active' : '');
      b.textContent = p.name;
      b.setAttribute('aria-pressed', p.id === state.personality ? 'true' : 'false');
      b.addEventListener('click', function () {
        state.personality = p.id;
        renderPersonalityChips();
        $('mode-blurb').textContent = p.tagline;
      });
      wrap.appendChild(b);
    });
    $('mode-blurb').textContent = getPersonality(state.personality).tagline +
      ((state.nfg && state.personality === 'hood') ? ' · NO FUCKS GIVEN on.' : '');
  }

  /* ----- results -----
   * opts: { kind: 'slang'|'fluent'|'sayitback', label, explanations,
   *   personalityId, regen, inputForFav, favMode, fluentOption, labels }
   * kind 'slang' gets Translate back; kind 'fluent' gets the Why? toggle. */
  function resultCard(text, idx, opts) {
    opts = opts || {};
    var kind = opts.kind || 'slang';
    var p = getPersonality(opts.personalityId || state.personality);
    var fav = isFav(state.favorites, text);

    var card = document.createElement('article');
    card.className = 'result-card';

    var head = document.createElement('div');
    head.className = 'result-head';
    var label = document.createElement('span');
    label.className = 'result-label';
    label.textContent = opts.label || ('Variation ' + (idx + 1) + ' · ' + p.name);
    var favBtn = document.createElement('button');
    favBtn.type = 'button';
    favBtn.className = 'icon-btn' + (fav ? ' is-fav' : '');
    favBtn.textContent = fav ? '★ Saved' : '☆ Save';
    favBtn.setAttribute('aria-label', 'Save to favorites');
    favBtn.addEventListener('click', function () {
      if (isFav(state.favorites, text)) {
        var existing = state.favorites.filter(function (x) { return x.text === text; })[0];
        state.favorites = favRemove(state.favorites, existing.id);
        toast('Removed from favorites.');
      } else {
        state.favorites = favAdd(state.favorites, {
          text: text,
          personality: opts.personalityId || state.personality,
          input: opts.inputForFav !== undefined ? opts.inputForFav : state.currentInput,
          mode: opts.favMode || (state.mode === 'fluent' ? 'fluent' : 'slang'),
          fluentOption: opts.fluentOption || state.fluentOption || null,
          labels: opts.labels || null
        });
        toast('Saved to favorites.');
      }
      saveStore(STORAGE_FAVORITES, state.favorites);
      renderResults();
      if (state.tab === 'sayitback') renderSibResults();
    });
    head.appendChild(label);
    head.appendChild(favBtn);
    card.appendChild(head);

    var body = document.createElement('p');
    body.className = 'result-text';
    body.textContent = text;
    card.appendChild(body);

    var actions = document.createElement('div');
    actions.className = 'result-actions';
    var btns = [
      { label: 'Copy', fn: function () { copyText(text, 'Copied.'); } },
      { label: 'Regenerate', fn: opts.regen || function () { regenerateOne(idx); } },
      { label: 'Hear it', fn: function () { speak(text, opts.personalityId || state.personality); } }
    ];
    if (kind === 'slang') {
      btns.push({ label: 'Translate back', fn: function () { showTranslateBack(text, card); } });
    }
    if (kind === 'fluent') {
      btns.push({ label: 'Why?', fn: function () { toggleWhyBox(card, opts.explanations || []); } });
    }
    btns.forEach(function (b) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mini-btn';
      btn.textContent = b.label;
      btn.addEventListener('click', b.fn);
      actions.appendChild(btn);
    });
    card.appendChild(actions);
    return card;
  }

  function toggleWhyBox(card, explanations) {
    var old = card.querySelector('.why-box');
    if (old) { old.remove(); return; }
    var box = document.createElement('div');
    box.className = 'why-box';
    var kicker = document.createElement('div');
    kicker.className = 'back-kicker';
    kicker.textContent = 'Why these changes?';
    box.appendChild(kicker);
    if (!explanations.length) {
      var none = document.createElement('p');
      none.textContent = 'No errors found — this was already clean.';
      box.appendChild(none);
    } else {
      var ul = document.createElement('ul');
      explanations.forEach(function (e) {
        var li = document.createElement('li');
        var b = document.createElement('b');
        b.textContent = e.from + ' → ' + e.to;
        li.appendChild(b);
        li.appendChild(document.createTextNode(' — ' + e.why));
        ul.appendChild(li);
      });
      box.appendChild(ul);
    }
    card.appendChild(box);
  }

  function showTranslateBack(text, card) {
    var old = card.querySelector('.back-box');
    if (old) { old.remove(); return; }
    var box = document.createElement('div');
    box.className = 'back-box';
    var kicker = document.createElement('div');
    kicker.className = 'back-kicker';
    kicker.textContent = 'Back to normal English';
    var p = document.createElement('p');
    p.textContent = translateBack(text);
    var copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'mini-btn';
    copy.textContent = 'Copy plain version';
    copy.addEventListener('click', function () { copyText(p.textContent, 'Copied.'); });
    box.appendChild(kicker);
    box.appendChild(p);
    box.appendChild(copy);
    card.appendChild(box);
  }

  function renderResults() {
    var wrap = $('results');
    wrap.innerHTML = '';
    if (!state.results.length) { $('results-section').hidden = true; return; }
    $('results-section').hidden = false;
    state.results.forEach(function (text, idx) {
      if (state.mode === 'fluent') {
        wrap.appendChild(resultCard(text, idx, {
          kind: 'fluent',
          label: 'Fluent English · ' + fluentOptionName(state.fluentOption),
          explanations: state.fluentExplanations,
          personalityId: 'fluent',
          regen: regenerateFluent,
          favMode: 'fluent',
          fluentOption: state.fluentOption
        }));
      } else {
        wrap.appendChild(resultCard(text, idx));
      }
    });
  }

  function regenerateFluent() {
    if (!state.currentInput) return;
    var fixed = fluentEnglish(state.currentInput, state.fluentOption);
    state.results = [fixed.text];
    state.fluentExplanations = fixed.explanations;
    renderResults();
    toast('Regenerated.');
  }

  function regenerateOne(idx) {
    var r = translate(state.currentInput, state.personality, state.intensity, { nfg: state.nfg });
    var fresh = r.text;
    var tries = 0;
    while (state.results.indexOf(fresh) !== -1 && tries < 8) {
      fresh = translate(state.currentInput, state.personality, state.intensity, { nfg: state.nfg }).text;
      tries++;
    }
    state.results[idx] = fresh;
    renderResults();
    toast('Regenerated.');
  }

  function doTranslate() {
    var input = $('input-text').value.trim();
    if (!input) { toast('Type something first.'); $('input-text').focus(); return; }
    state.currentInput = input;
    var head = document.querySelector('#results-section .results-head h2');
    var note = document.querySelector('#results-section .results-head .fine');
    if (state.mode === 'fluent') {
      var fixed = fluentEnglish(input, state.fluentOption);
      state.results = [fixed.text];
      state.fluentExplanations = fixed.explanations;
      state.history = historyAdd(state.history, {
        input: input,
        mode: 'fluent',
        fluentOption: state.fluentOption,
        outputs: [fixed.text]
      });
      saveStore(STORAGE_HISTORY, state.history);
      if (head) head.textContent = 'Your corrected text';
      if (note) note.textContent = 'One clean version — tap Why? to see what changed and why.';
      renderResults();
      var rs = $('results-section');
      if (rs.scrollIntoView) rs.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    state.results = translateVariations(input, state.personality, state.intensity, { nfg: state.nfg });
    state.history = historyAdd(state.history, {
      input: input,
      personality: state.personality,
      intensity: state.intensity,
      outputs: state.results
    });
    saveStore(STORAGE_HISTORY, state.history);
    if (head) head.textContent = 'Your translation';
    if (note) note.textContent = 'Three takes, same meaning. Pick your favorite — or all three.';
    renderResults();
    var rs2 = $('results-section');
    if (rs2.scrollIntoView) rs2.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function doRandom() {
    var phrase = randomPhrase();
    state.mode = 'slang';
    renderModeSwitch();
    state.currentInput = phrase.t;
    state.personality = phrase.p;
    state.results = [phrase.t];
    renderPersonalityChips();
    $('input-text').value = '';
    $('random-note').textContent = 'Random ' + getPersonality(phrase.p).name + ' drop — hit Random again for another one.';
    renderResults();
    var rs2 = $('results-section');
    if (rs2.scrollIntoView) rs2.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ----- mode switch (Slang / Fluent English) ----- */
  function setMode(m) {
    state.mode = (m === 'fluent') ? 'fluent' : 'slang';
    state.results = [];
    state.fluentExplanations = [];
    renderModeSwitch();
    renderResults();
  }
  function renderModeSwitch() {
    var fluent = state.mode === 'fluent';
    $('mode-slang-btn').classList.toggle('is-active', !fluent);
    $('mode-fluent-btn').classList.toggle('is-active', fluent);
    $('mode-slang-btn').setAttribute('aria-pressed', !fluent ? 'true' : 'false');
    $('mode-fluent-btn').setAttribute('aria-pressed', fluent ? 'true' : 'false');
    $('slang-controls').hidden = fluent;
    $('fluent-controls').hidden = !fluent;
    $('translate-btn').textContent = fluent ? 'Fix it up' : 'Translate it';
    $('random-btn').style.display = fluent ? 'none' : '';
    if (fluent) renderFluentChips();
  }
  function renderFluentChips() {
    var wrap = $('fluent-chips');
    wrap.innerHTML = '';
    FLUENT_OPTIONS.forEach(function (o) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (o.id === state.fluentOption ? ' is-active' : '');
      b.textContent = o.name;
      b.setAttribute('aria-pressed', o.id === state.fluentOption ? 'true' : 'false');
      b.addEventListener('click', function () {
        state.fluentOption = o.id;
        renderFluentChips();
      });
      wrap.appendChild(b);
    });
    var cur = FLUENT_OPTIONS.filter(function (o) { return o.id === state.fluentOption; })[0] || FLUENT_OPTIONS[0];
    $('fluent-blurb').textContent = cur.name + ' — ' + cur.desc;
  }

  /* ----- Say It Back ----- */
  function renderSibChips() {
    var wrap = $('sib-chips');
    wrap.innerHTML = '';
    PERSONALITIES.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (p.id === state.sibPersonality ? ' is-active' : '');
      b.textContent = p.name;
      b.setAttribute('aria-pressed', p.id === state.sibPersonality ? 'true' : 'false');
      b.addEventListener('click', function () {
        state.sibPersonality = p.id;
        renderSibChips();
      });
      wrap.appendChild(b);
    });
  }
  function doSayItBack() {
    var input = $('sib-input').value.trim();
    if (!input) { toast('Paste what they said first.'); $('sib-input').focus(); return; }
    state.sibInput = input;
    var res = sayItBack(input, state.sibPersonality, state.intensity, { nfg: state.nfg });
    state.sibReplies = res.replies;
    state.sibIntent = res.intent;
    state.history = historyAdd(state.history, {
      input: input,
      mode: 'sayitback',
      personality: state.sibPersonality,
      intensity: state.intensity,
      outputs: res.replies.map(function (r) { return r.text; }),
      labels: res.replies.map(function (r) { return r.label; })
    });
    saveStore(STORAGE_HISTORY, state.history);
    renderSibResults();
    var rs = $('sib-results-section');
    if (rs && rs.scrollIntoView) rs.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function regenerateSib() {
    if (!state.sibInput) return;
    var res = sayItBack(state.sibInput, state.sibPersonality, state.intensity, { nfg: state.nfg });
    state.sibReplies = res.replies;
    state.sibIntent = res.intent;
    renderSibResults();
    toast('Fresh options.');
  }
  function renderSibResults() {
    var wrap = $('sib-results');
    wrap.innerHTML = '';
    if (!state.sibReplies.length) { $('sib-results-section').hidden = true; return; }
    $('sib-results-section').hidden = false;
    var note = $('sib-intent-note');
    if (note) note.textContent = SAYITBACK_INTENT_NOTES[state.sibIntent] || 'Here are three ways to answer that.';
    state.sibReplies.forEach(function (r, idx) {
      wrap.appendChild(resultCard(r.text, idx, {
        kind: 'sayitback',
        label: r.label + ' · ' + getPersonality(state.sibPersonality).name,
        personalityId: state.sibPersonality,
        regen: regenerateSib,
        inputForFav: state.sibInput,
        favMode: 'sayitback'
      }));
    });
  }

  /* ----- modes tab ----- */
  function renderModes() {
    var wrap = $('modes-list');
    wrap.innerHTML = '';
    /* Fluent English — first-class writing mode. */
    var feCard = document.createElement('article');
    feCard.className = 'card mode-card';
    var feFlag = document.createElement('div');
    feFlag.className = 'card-kicker';
    feFlag.textContent = '✎ Writing mode — not slang';
    var feH = document.createElement('h3');
    feH.textContent = 'Fluent English';
    var feTag = document.createElement('p');
    feTag.className = 'mode-tag';
    feTag.textContent = 'Clean, correct English — your words, fixed up.';
    var feDesc = document.createElement('p');
    feDesc.textContent = 'Fixes spelling, confused words, punctuation, grammar, and voice-to-text mess — without rewriting your voice. Three options: Correct Only, Polish It, or Professional. Tap Why? on any result to see what changed.';
    var feEx = document.createElement('div');
    feEx.className = 'mode-example';
    var feExIn = document.createElement('p');
    feExIn.innerHTML = '<span class="ex-label">Messy:</span> their going to love it to much';
    var feExOut = document.createElement('p');
    feExOut.innerHTML = '<span class="ex-label">Fluent:</span> They\'re going to love it too much.';
    feEx.appendChild(feExIn);
    feEx.appendChild(feExOut);
    var feUse = document.createElement('button');
    feUse.type = 'button';
    feUse.className = 'use-mode-btn';
    feUse.textContent = 'Use Fluent English';
    feUse.addEventListener('click', function () {
      setMode('fluent');
      showTab('home');
      toast('Fluent English mode on.');
    });
    feCard.appendChild(feFlag);
    feCard.appendChild(feH);
    feCard.appendChild(feTag);
    feCard.appendChild(feDesc);
    feCard.appendChild(feEx);
    feCard.appendChild(feUse);
    wrap.appendChild(feCard);
    /* Say It Back — reply generator. */
    var sibCard = document.createElement('article');
    sibCard.className = 'card mode-card';
    var sibFlag = document.createElement('div');
    sibFlag.className = 'card-kicker';
    sibFlag.textContent = '💬 Reply generator';
    var sibH = document.createElement('h3');
    sibH.textContent = 'Say It Back';
    var sibTag = document.createElement('p');
    sibTag.className = 'mode-tag';
    sibTag.textContent = 'Paste what they said. Get back what you say.';
    var sibDesc = document.createElement('p');
    sibDesc.textContent = 'Somebody just texted you? Paste their message and get three ways to answer it — in your voice. It understands what they said: a question gets an answer, a diss gets a clapback, a greeting gets a greeting back.';
    var sibUse = document.createElement('button');
    sibUse.type = 'button';
    sibUse.className = 'use-mode-btn';
    sibUse.textContent = 'Open Say It Back';
    sibUse.addEventListener('click', function () { showTab('sayitback'); });
    sibCard.appendChild(sibFlag);
    sibCard.appendChild(sibH);
    sibCard.appendChild(sibTag);
    sibCard.appendChild(sibDesc);
    sibCard.appendChild(sibUse);
    wrap.appendChild(sibCard);
    PERSONALITIES.forEach(function (p) {
      var card = document.createElement('article');
      card.className = 'card mode-card';
      var h = document.createElement('h3');
      h.textContent = p.name;
      var flag = null;
      if (p.id === 'hood') {
        flag = document.createElement('div');
        flag.className = 'card-kicker';
        flag.textContent = '★ Flagship — the main voice';
      }
      var tag = document.createElement('p');
      tag.className = 'mode-tag';
      tag.textContent = p.tagline;
      var desc = document.createElement('p');
      desc.textContent = p.desc;
      var ex = document.createElement('div');
      ex.className = 'mode-example';
      var exIn = document.createElement('p');
      exIn.innerHTML = '<span class="ex-label">You say:</span> ' + escapeHtml(p.exampleIn);
      var exOut = document.createElement('p');
      exOut.innerHTML = '<span class="ex-label">HoodTalk:</span> ' + escapeHtml(p.exampleOut);
      ex.appendChild(exIn);
      ex.appendChild(exOut);
      var use = document.createElement('button');
      use.type = 'button';
      use.className = 'use-mode-btn';
      use.textContent = 'Use ' + p.name;
      use.addEventListener('click', function () {
        state.personality = p.id;
        renderPersonalityChips();
        showTab('home');
        toast(p.name + ' mode on.');
      });
      if (flag) card.appendChild(flag);
      card.appendChild(h);
      card.appendChild(tag);
      card.appendChild(desc);
      card.appendChild(ex);
      card.appendChild(use);
      wrap.appendChild(card);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ----- history tab ----- */
  function renderHistory() {
    var wrap = $('history-list');
    wrap.innerHTML = '';
    if (!state.history.length) {
      wrap.innerHTML = '<p class="empty-note">Nothing here yet. Translate something and it\'ll show up.</p>';
      return;
    }
    state.history.forEach(function (item) {
      var card = document.createElement('article');
      card.className = 'card history-card';
      var meta = document.createElement('div');
      meta.className = 'history-meta';
      var modeLabel;
      if (item.mode === 'fluent') modeLabel = 'Fluent English · ' + fluentOptionName(item.fluentOption || 'correct');
      else if (item.mode === 'sayitback') modeLabel = 'Say It Back · ' + getPersonality(item.personality).name;
      else modeLabel = getPersonality(item.personality).name + ' · Intensity ' + item.intensity;
      meta.textContent = modeLabel + ' · ' + new Date(item.ts).toLocaleString();
      var input = document.createElement('p');
      input.className = 'history-input';
      input.textContent = item.mode === 'sayitback' ? 'They said: “' + item.input + '”' : '“' + item.input + '”';
      var out = document.createElement('p');
      out.className = 'history-output';
      out.textContent = item.outputs[0] || '';
      var actions = document.createElement('div');
      actions.className = 'result-actions';
      var load = document.createElement('button');
      load.type = 'button'; load.className = 'mini-btn'; load.textContent = 'Use this';
      load.addEventListener('click', function () {
        if (item.mode === 'fluent') {
          state.mode = 'fluent';
          state.fluentOption = item.fluentOption || 'correct';
          $('input-text').value = item.input;
          renderModeSwitch();
          showTab('home');
        } else if (item.mode === 'sayitback') {
          state.sibPersonality = item.personality;
          $('sib-input').value = item.input;
          renderSibChips();
          showTab('sayitback');
        } else {
          $('input-text').value = item.input;
          state.mode = 'slang';
          state.personality = item.personality;
          state.intensity = item.intensity;
          renderModeSwitch();
          syncIntensityUI();
          renderPersonalityChips();
          showTab('home');
        }
      });
      var copy = document.createElement('button');
      copy.type = 'button'; copy.className = 'mini-btn'; copy.textContent = 'Copy';
      copy.addEventListener('click', function () { copyText(item.outputs[0] || item.input, 'Copied.'); });
      var del = document.createElement('button');
      del.type = 'button'; del.className = 'mini-btn danger'; del.textContent = 'Delete';
      del.addEventListener('click', function () {
        state.history = historyRemove(state.history, item.id);
        saveStore(STORAGE_HISTORY, state.history);
        renderHistory();
        toast('Deleted.');
      });
      actions.appendChild(load);
      actions.appendChild(copy);
      actions.appendChild(del);
      card.appendChild(meta);
      card.appendChild(input);
      card.appendChild(out);
      card.appendChild(actions);
      wrap.appendChild(card);
    });
  }

  /* ----- favorites tab ----- */
  function renderFavorites() {
    var wrap = $('favorites-list');
    wrap.innerHTML = '';
    if (!state.favorites.length) {
      wrap.innerHTML = '<p class="empty-note">No favorites yet. Tap ☆ Save on any result to keep it here.</p>';
      return;
    }
    state.favorites.forEach(function (fav) {
      var card = document.createElement('article');
      card.className = 'card history-card';
      var meta = document.createElement('div');
      meta.className = 'history-meta';
      var favModeLabel;
      if (fav.mode === 'fluent') favModeLabel = 'Fluent English · ' + fluentOptionName(fav.fluentOption || 'correct');
      else if (fav.mode === 'sayitback') favModeLabel = 'Say It Back · ' + getPersonality(fav.personality).name;
      else favModeLabel = getPersonality(fav.personality).name;
      meta.textContent = favModeLabel + ' · ' + new Date(fav.ts).toLocaleString();
      var text = document.createElement('p');
      text.className = 'history-output';
      text.textContent = fav.text;
      var orig = document.createElement('p');
      orig.className = 'history-input';
      orig.textContent = fav.mode === 'sayitback' ? (fav.input ? 'They said: “' + fav.input + '”' : '') : (fav.input ? 'Original: “' + fav.input + '”' : '');
      var actions = document.createElement('div');
      actions.className = 'result-actions';
      var copy = document.createElement('button');
      copy.type = 'button'; copy.className = 'mini-btn'; copy.textContent = 'Copy';
      copy.addEventListener('click', function () { copyText(fav.text, 'Copied.'); });
      var hear = document.createElement('button');
      hear.type = 'button'; hear.className = 'mini-btn'; hear.textContent = 'Hear it';
      hear.addEventListener('click', function () { speak(fav.text, fav.personality); });
      var del = document.createElement('button');
      del.type = 'button'; del.className = 'mini-btn danger'; del.textContent = 'Remove';
      del.addEventListener('click', function () {
        state.favorites = favRemove(state.favorites, fav.id);
        saveStore(STORAGE_FAVORITES, state.favorites);
        renderFavorites();
        toast('Removed from favorites.');
      });
      actions.appendChild(copy);
      actions.appendChild(hear);
      actions.appendChild(del);
      card.appendChild(meta);
      card.appendChild(text);
      if (fav.input) card.appendChild(orig);
      card.appendChild(actions);
      wrap.appendChild(card);
    });
  }

  /* ----- settings ----- */
  function syncIntensityUI() {
    var slider = $('intensity');
    slider.value = state.intensity;
    $('intensity-value').textContent = state.intensity + ' / 10 — ' + intensityLabel(state.intensity);
    var defSlider = $('default-intensity');
    if (defSlider) {
      defSlider.value = state.settings.defaultIntensity;
      $('default-intensity-value').textContent = state.settings.defaultIntensity + ' / 10';
    }
    var sibSlider = $('sib-intensity');
    if (sibSlider) {
      sibSlider.value = state.intensity;
      $('sib-intensity-value').textContent = state.intensity + ' / 10 — ' + intensityLabel(state.intensity);
    }
  }
  function intensityLabel(n) {
    if (n <= 2) return 'slight slang';
    if (n <= 4) return 'light flavor';
    if (n <= 6) return 'strong personality';
    if (n <= 8) return 'heavy';
    return 'completely unhinged';
  }

  function renderSettings() {
    var sel = $('default-personality');
    sel.innerHTML = '';
    PERSONALITIES.forEach(function (p) {
      var o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.name;
      if (p.id === state.settings.defaultPersonality) o.selected = true;
      sel.appendChild(o);
    });
    syncIntensityUI();
    var modeSel = $('default-mode');
    if (modeSel) modeSel.value = state.settings.defaultMode || 'slang';
    var nfgSet = $('settings-nfg-toggle');
    if (nfgSet) nfgSet.checked = !!state.settings.nfg;
    $('history-count').textContent = state.history.length + ' saved';
    $('favorites-count').textContent = state.favorites.length + ' saved';
  }

  /* ----- init ----- */
  function init() {
    state.history = loadStore(STORAGE_HISTORY, []);
    state.favorites = loadStore(STORAGE_FAVORITES, []);
    state.settings = loadStore(STORAGE_SETTINGS, { defaultPersonality: 'hood', defaultIntensity: 5, defaultMode: 'slang', nfg: false });
    state.settings.defaultPersonality = state.settings.defaultPersonality || 'hood';
    state.settings.defaultIntensity = state.settings.defaultIntensity || 5;
    state.settings.defaultMode = state.settings.defaultMode || 'slang';
    state.settings.nfg = !!state.settings.nfg;
    state.nfg = state.settings.nfg;
    state.mode = state.settings.defaultMode;
    state.personality = state.settings.defaultPersonality || 'hood';
    state.intensity = state.settings.defaultIntensity || 5;

    renderPersonalityChips();
    renderModeSwitch();
    renderFluentChips();
    renderSibChips();
    renderModes();
    renderSettings();
    syncIntensityUI();
    var homeNfg = $('nfg-toggle');
    if (homeNfg) homeNfg.checked = state.nfg;

    var tabs = document.querySelectorAll('.tab-btn');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function () { showTab(this.getAttribute('data-tab')); });
    }

    $('translate-btn').addEventListener('click', doTranslate);
    $('random-btn').addEventListener('click', doRandom);
    $('nfg-toggle').addEventListener('change', function () { setNfg(this.checked); });
    $('settings-nfg-toggle').addEventListener('change', function () { setNfg(this.checked); });
    $('mode-slang-btn').addEventListener('click', function () { setMode('slang'); });
    $('mode-fluent-btn').addEventListener('click', function () { setMode('fluent'); });
    $('open-sayitback-btn').addEventListener('click', function () { showTab('sayitback'); });
    $('sib-btn').addEventListener('click', doSayItBack);
    $('sib-back-btn').addEventListener('click', function () { showTab('home'); });
    $('sib-clear-btn').addEventListener('click', function () {
      $('sib-input').value = '';
      $('sib-input').focus();
    });
    $('sib-input').addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') doSayItBack();
    });
    $('sib-intensity').addEventListener('input', function () {
      state.intensity = parseInt(this.value, 10);
      $('sib-intensity-value').textContent = state.intensity + ' / 10 — ' + intensityLabel(state.intensity);
      syncIntensityUI();
    });
    $('input-text').addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') doTranslate();
    });
    $('clear-input-btn').addEventListener('click', function () {
      $('input-text').value = '';
      $('input-text').focus();
    });

    $('intensity').addEventListener('input', function () {
      state.intensity = parseInt(this.value, 10);
      $('intensity-value').textContent = state.intensity + ' / 10 — ' + intensityLabel(state.intensity);
    });

    $('default-personality').addEventListener('change', function () {
      state.settings.defaultPersonality = this.value;
      saveStore(STORAGE_SETTINGS, state.settings);
      toast('Default personality saved.');
    });
    $('default-mode').addEventListener('change', function () {
      state.settings.defaultMode = this.value;
      saveStore(STORAGE_SETTINGS, state.settings);
      toast('Default mode saved.');
    });
    $('default-intensity').addEventListener('input', function () {
      state.settings.defaultIntensity = parseInt(this.value, 10);
      saveStore(STORAGE_SETTINGS, state.settings);
      $('default-intensity-value').textContent = state.settings.defaultIntensity + ' / 10';
    });

    $('clear-history-btn').addEventListener('click', function () {
      if (!state.history.length) { toast('History is already empty.'); return; }
      if (!window.confirm('Clear all translation history?')) return;
      state.history = [];
      saveStore(STORAGE_HISTORY, state.history);
      renderSettings();
      toast('History cleared.');
    });
    $('clear-favorites-btn').addEventListener('click', function () {
      if (!state.favorites.length) { toast('Favorites are already empty.'); return; }
      if (!window.confirm('Clear all favorites?')) return;
      state.favorites = [];
      saveStore(STORAGE_FAVORITES, state.favorites);
      renderSettings();
      toast('Favorites cleared.');
    });
    $('reset-settings-btn').addEventListener('click', function () {
      state.settings = { defaultPersonality: 'hood', defaultIntensity: 5, defaultMode: 'slang', nfg: false };
      saveStore(STORAGE_SETTINGS, state.settings);
      state.personality = 'hood';
      state.intensity = 5;
      state.mode = 'slang';
      state.nfg = false;
      var home = $('nfg-toggle');
      if (home) home.checked = false;
      var set = $('settings-nfg-toggle');
      if (set) set.checked = false;
      renderPersonalityChips();
      renderModeSwitch();
      renderSettings();
      toast('Settings reset.');
    });
    $('about-version').textContent = 'Version ' + VERSION;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
