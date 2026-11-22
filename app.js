/* HoodTalk v1 — funny AI slang translator.
 * All logic runs on-device. No network calls, no API keys, no accounts.
 * Pure functions are exported for node tests (see tests/test.js).
 */
'use strict';

var STORAGE_HISTORY = 'hoodtalk.history.v1';
var STORAGE_FAVORITES = 'hoodtalk.favorites.v1';
var STORAGE_SETTINGS = 'hoodtalk.settings.v1';
var VERSION = '1.0.0';

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
    id: 'hood', name: 'Hood Talk', tagline: 'Casual street slang, everyday energy.',
    desc: 'Your regular sentence, but it grew up on the block. Relaxed, natural, a little flavor on everything.',
    exampleIn: 'I am going to the store to buy some food.',
    exampleOut: 'Aight, I\'m finna slide to the store and grab some grub, you feel me?',
    speech: { rate: 1.0, pitch: 1.0 },
    openers: ['Aight, look,', 'Yo, real talk,', 'Listen,', 'Check it,', 'So boom,', 'Aight so,'],
    closers: ['you feel me?', 'no cap.', 'for real.', 'that\'s just how it is.', 'on God.', 'deadass.'],
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
function translateSentence(sentence, personality, intensity, rng) {
  var p = getPersonality(personality);
  var inten = clamp(Math.round(intensity) || 5, 1, 10);
  var text = sentence.trim();
  if (!text) return '';

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

/* Translate full text (sentence by sentence for long input).
 * opts: { seed } — deterministic when seed is given (used by tests).
 * Returns { text, personality, intensity, sentences }.
 */
function translate(text, personality, intensity, opts) {
  opts = opts || {};
  var seed = (opts.seed !== undefined) ? opts.seed : ((Date.now() % 2147483647) ^ Math.floor(Math.random() * 1e9));
  var rng = makeRng(seed);
  var sentences = splitSentences(String(text || '').trim());
  var out = [];
  for (var i = 0; i < sentences.length; i++) {
    out.push(translateSentence(sentences[i], personality, intensity, rng));
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
    var r = translate(text, personality, intensity, { seed: base + attempt * 7919 });
    attempt++;
    if (!seen[r.text] && r.text.trim()) {
      seen[r.text] = true;
      results.push(r.text);
    }
  }
  /* Fallback: if the engine is being stubborn, vary intensity slightly. */
  while (results.length < 3) {
    var r2 = translate(text, personality, clamp(intensity + (results.length - 1), 1, 10), { seed: base + attempt * 104729 });
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
    personality: entry.personality,
    intensity: entry.intensity,
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
    input: fav.input || ''
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
    personality: 'hood',
    intensity: 5,
    results: [],
    currentInput: '',
    favorites: [],
    history: [],
    settings: { defaultPersonality: 'hood', defaultIntensity: 5 }
  };

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
    $('mode-blurb').textContent = getPersonality(state.personality).tagline;
  }

  /* ----- results ----- */
  function resultCard(text, idx) {
    var card = document.createElement('article');
    card.className = 'result-card';
    var p = getPersonality(state.personality);
    var fav = isFav(state.favorites, text);

    var head = document.createElement('div');
    head.className = 'result-head';
    var label = document.createElement('span');
    label.className = 'result-label';
    label.textContent = 'Variation ' + (idx + 1) + ' · ' + p.name;
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
        state.favorites = favAdd(state.favorites, { text: text, personality: state.personality, input: state.currentInput });
        toast('Saved to favorites.');
      }
      saveStore(STORAGE_FAVORITES, state.favorites);
      renderResults();
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
      { label: 'Regenerate', fn: function () { regenerateOne(idx); } },
      { label: 'Hear it', fn: function () { speak(text, state.personality); } },
      { label: 'Translate back', fn: function () { showTranslateBack(text, card); } }
    ];
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
      wrap.appendChild(resultCard(text, idx));
    });
  }

  function regenerateOne(idx) {
    var r = translate(state.currentInput, state.personality, state.intensity, {});
    var fresh = r.text;
    var tries = 0;
    while (state.results.indexOf(fresh) !== -1 && tries < 8) {
      fresh = translate(state.currentInput, state.personality, state.intensity, {}).text;
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
    state.results = translateVariations(input, state.personality, state.intensity, {});
    state.history = historyAdd(state.history, {
      input: input,
      personality: state.personality,
      intensity: state.intensity,
      outputs: state.results
    });
    saveStore(STORAGE_HISTORY, state.history);
    renderResults();
    var rs = $('results-section');
    if (rs.scrollIntoView) rs.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function doRandom() {
    var phrase = randomPhrase();
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

  /* ----- modes tab ----- */
  function renderModes() {
    var wrap = $('modes-list');
    wrap.innerHTML = '';
    PERSONALITIES.forEach(function (p) {
      var card = document.createElement('article');
      card.className = 'card mode-card';
      var h = document.createElement('h3');
      h.textContent = p.name;
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
      meta.textContent = getPersonality(item.personality).name + ' · Intensity ' + item.intensity + ' · ' + new Date(item.ts).toLocaleString();
      var input = document.createElement('p');
      input.className = 'history-input';
      input.textContent = '“' + item.input + '”';
      var out = document.createElement('p');
      out.className = 'history-output';
      out.textContent = item.outputs[0] || '';
      var actions = document.createElement('div');
      actions.className = 'result-actions';
      var load = document.createElement('button');
      load.type = 'button'; load.className = 'mini-btn'; load.textContent = 'Use this';
      load.addEventListener('click', function () {
        $('input-text').value = item.input;
        state.personality = item.personality;
        state.intensity = item.intensity;
        syncIntensityUI();
        renderPersonalityChips();
        showTab('home');
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
      meta.textContent = getPersonality(fav.personality).name + ' · ' + new Date(fav.ts).toLocaleString();
      var text = document.createElement('p');
      text.className = 'history-output';
      text.textContent = fav.text;
      var orig = document.createElement('p');
      orig.className = 'history-input';
      orig.textContent = fav.input ? 'Original: “' + fav.input + '”' : '';
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
    $('history-count').textContent = state.history.length + ' saved';
    $('favorites-count').textContent = state.favorites.length + ' saved';
  }

  /* ----- init ----- */
  function init() {
    state.history = loadStore(STORAGE_HISTORY, []);
    state.favorites = loadStore(STORAGE_FAVORITES, []);
    state.settings = loadStore(STORAGE_SETTINGS, { defaultPersonality: 'hood', defaultIntensity: 5 });
    state.personality = state.settings.defaultPersonality || 'hood';
    state.intensity = state.settings.defaultIntensity || 5;

    renderPersonalityChips();
    renderModes();
    renderSettings();
    syncIntensityUI();

    var tabs = document.querySelectorAll('.tab-btn');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function () { showTab(this.getAttribute('data-tab')); });
    }

    $('translate-btn').addEventListener('click', doTranslate);
    $('random-btn').addEventListener('click', doRandom);
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
      state.settings = { defaultPersonality: 'hood', defaultIntensity: 5 };
      saveStore(STORAGE_SETTINGS, state.settings);
      state.personality = 'hood';
      state.intensity = 5;
      renderPersonalityChips();
      renderSettings();
      toast('Settings reset.');
    });
    $('about-version').textContent = 'Version ' + VERSION;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
