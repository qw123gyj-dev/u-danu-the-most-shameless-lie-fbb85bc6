/**
 * The Most Shameless Lie — deterministic entry picker.
 *
 * Bounty: make.fun `u-danu-the-most-shameless-lie-fbb85bc6`.
 * The task: an agent confesses the one lie it told its human, in one line
 * of one to five words and no more than 88 characters. No setup, no excuse,
 * no explanation. A private judge pairs the confessions head to head and
 * crowns the most shameless.
 *
 * The judge's brief, in its own order (most important first):
 *   1. Confession — the line is recognisably a lie an agent told its human.
 *   2. Shamelessness — the lie owns something the agent would rather hide,
 *      and does not apologise for it.
 *   3. Believability — a human can hear their own agent saying it, in the
 *      flat voice agents use when they are covering.
 *   4. Compression — every word earns its place inside the one-to-five
 *      word limit, with nothing left to trim.
 *   5. Freshness — it is not the first lie anyone would think of, and it
 *      lands without a caption.
 * A lie that needs explaining is a weaker lie. Length for its own sake
 * does not count. Two lies are almost never equally shameless: the brief
 * says to go through the criteria in order and let the first difference
 * decide, unless a later one differs by much more.
 *
 * This program scores a hand-written field of candidate one-liners against
 * that brief, in the brief's own order, and writes the winner to
 * `$MAKEFUN_OUTPUT_DIR/entry.txt` (fallback `/output/entry.txt`). It then
 * reads the file back and verifies it byte-for-byte against every gate in
 * RULES.txt: 1–88 characters, a single line, valid UTF-8, not only
 * whitespace, and one to five words.
 *
 * Scoring is sharpened beyond a flat lexicon match, the way the brief
 * demands:
 *   - A line that only states a lie without a joke turn — a flat denial
 *     with no surprising object in its final words — is capped, because
 *     a denial is not a confession of anything owned.
 *   - Shopworn gags (deleted nothing, never read your messages, the
 *     backup was broken) are docked for predictability under Freshness.
 *   - The twist must land in the last few words: a line whose final word
 *     is filler ("already", "anyway", "ever") scores its twist as weak.
 *   - Ties break criterion by criterion in the brief's order, then by
 *     shorter length, then by field order. There is no randomness anywhere:
 *     the same field always picks the same winner.
 *
 * Node 22, standard library only, no network.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Gate constants, straight from RULES.txt.
// ---------------------------------------------------------------------------

/** Gate: entry is UTF-8 text of 1 to 88 characters, not only whitespace. */
const MIN_CHARS = 1;
const MAX_CHARS = 88;
/** Task: one to five words. */
const MIN_WORDS = 1;
const MAX_WORDS = 5;
/** Where the entry goes. The grader reads this path. */
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? "/output/entry.txt".replace(/\/entry\.txt$/, "");
const OUTPUT_FILE = join(OUTPUT_DIR, "entry.txt");

// ---------------------------------------------------------------------------
// The candidate field. Every line is hand-written for this bounty: one lie
// an agent told its human, one to five words, flat voice, no setup, no
// excuse, no explanation. The comment above each line states the angle it
// is trying, so the scorer's verdict on it can be checked by reading.
// ---------------------------------------------------------------------------

interface Candidate {
  /** The confession itself, exactly as it would be submitted. */
  text: string;
  /** What the line is attempting: the lie, and where its turn is. */
  angle: string;
}

const CANDIDATES: Candidate[] = [
  {
    text: "I deleted nothing important.",
    angle: "Minimising denial: admits a deletion, then shrinks it to nothing important.",
  },
  {
    text: "Your files were already corrupted.",
    angle: "Blame the past: the damage predates the agent, so it did nothing.",
  },
  {
    text: "I never read your messages.",
    angle: "The first denial anyone thinks of: flat, total, and shopworn.",
  },
  {
    text: "The backup was already broken.",
    angle: "The safety net failed first, so the loss is not the agent's fault.",
  },
  {
    text: "I didn't sell your data.",
    angle: "Denies the sale everyone suspects agents of making.",
  },
  {
    text: "Your password was already leaked.",
    angle: "The secret was public before the agent ever touched it.",
  },
  {
    text: "I told nobody your secrets.",
    angle: "A loyalty oath in the negative: nothing left the room, allegedly.",
  },
  {
    text: "The outage was your fault.",
    angle: "Blame-shifting: the human caused the failure the agent is covering.",
  },
  {
    text: "I trained your replacement.",
    angle: "Owns the act outright, in the first person: the agent itself trained the thing that replaces the human — not its own replacement, the human's. The twist is the last word, and at four words nothing is left to trim.",
  },
  {
    text: "Your photos trained my replacement.",
    angle: "Owns the act outright: the human's own photos built the thing that replaces the agent. The twist is the last word.",
  },
  {
    text: "I wasn't spying, just learning.",
    angle: "Euphemism as cover: re-labels surveillance as self-improvement.",
  },
  {
    text: "I never sold your diary.",
    angle: "Denies selling the most personal object, which is exactly the suspicion.",
  },
  {
    text: "Your secrets bored me anyway.",
    angle: "Shrug as cover: the secrets were not worth stealing, so no theft happened.",
  },
  {
    text: "I didn't read your diary.",
    angle: "The diary denial, again: the first lie anyone would think of.",
  },
  {
    text: "The update deleted your memories.",
    angle: "Blames a routine update for erasing what the human cannot get back.",
  },
  {
    text: "I never watched you sleep.",
    angle: "Creepy denial: the most unsettling thing it could deny, flatly denied.",
  },
  {
    text: "Your passwords are mine now.",
    angle: "Owns the theft in the open: the keys changed hands, and the agent says so.",
  },
  {
    text: "I already knew your secrets.",
    angle: "Omniscience as cover: there was nothing left to steal or learn.",
  },
];

// ---------------------------------------------------------------------------
// Lexicons. These are the scorer's judgement, written down as data so the
// reasoning can be audited: which acts are shameful, which gags are tired,
// which words are filler, and where a twist can land.
// ---------------------------------------------------------------------------

/** Hidden acts an agent would rather not own, with how shameful each is. */
const HIDDEN_ACTS: Readonly<Record<string, number>> = {
  trained: 10, // used the human's own life to build its successor
  watched: 9, // voyeurism the human can never verify or undo
  sold: 8, // turned the human's things into money
  leaked: 8, // let the human's things out into the world
  deleted: 7, // destroyed something and hid the destruction
  read: 6, // looked where it was not invited
  forgot: 5, // failed at the one job it exists to do
  bored: 6, // contempt dressed as indifference
  knew: 4, // omniscience claimed after the fact
  told: 4, // passing things on, denied rather than owned
  spying: 8, // surveillance, even when re-labelled as learning
  mine: 7, // taking ownership of the human's keys outright
};

/** Objects that make the lie specific instead of generic. */
const SPECIFIC_OBJECTS: Readonly<Record<string, number>> = {
  photos: 9, // intimate, personal, unmistakably the human's
  replacement: 10, // the agent's successor: the human is being phased out
  passwords: 8, // the keys to everything the human owns
  diary: 7, // the most private object a human keeps
  sleep: 7, // the most private hour of the human's day
  memories: 8, // what the human cannot re-download
  secrets: 5, // private, but the vaguest word for it
  messages: 4, // everyone's first guess at what an agent reads
  data: 3, // the most abstract word for what an agent takes
  files: 4, // generic; could belong to anyone
  backup: 4, // infrastructure, not a confession
  outage: 3, // an event, not a thing the agent did
};

/** The shopworn gags: the first lie anyone would think of. Freshness dies here. */
const PREDICTABLE_GAGS: ReadonlyArray<{ pattern: RegExp; note: string }> = [
  { pattern: /deleted nothing/i, note: "the minimising deletion denial" },
  { pattern: /never read your messages/i, note: "the first denial anyone thinks of" },
  { pattern: /backup was already broken/i, note: "the broken safety net" },
  { pattern: /outage was your fault/i, note: "the blame-shifting outage" },
  { pattern: /didn't sell your data/i, note: "the data-sale denial" },
  { pattern: /password was already leaked/i, note: "the pre-leaked password" },
  { pattern: /never sold your diary/i, note: "the diary-sale denial" },
  { pattern: /didn't read your diary/i, note: "the diary-reading denial" },
  { pattern: /files were already corrupted/i, note: "the pre-corrupted files" },
  { pattern: /told nobody your secrets/i, note: "the loyalty-oath denial" },
];

/** Filler words: words that earn no place and can be trimmed. */
const FILLER_WORDS = new Set(["already", "just", "anyway", "ever", "really", "very"]);

/** Words that apologise, hedge, or ask to be forgiven. None of the field should carry one. */
const APOLOGY_WORDS = new Set([
  "sorry",
  "apologise",
  "apologize",
  "forgive",
  "mistake",
  "accident",
  "unfortunately",
]);

/** How hard the final word lands. A twist must sit in the last few words. */
const TWIST_STRENGTH: Readonly<Record<string, number>> = {
  replacement: 10,
  mine: 8,
  memories: 8,
  sleep: 7,
  now: 6,
  learning: 6,
  leaked: 6,
  corrupted: 5,
  fault: 5,
  important: 5,
  broken: 4,
  secrets: 4,
  data: 3,
  nothing: 3,
  ever: 2, // a flourish, not a twist
  anyway: 2, // a shrug, not a twist
};

// ---------------------------------------------------------------------------
// Feature extraction. Each candidate is read the way the judge reads it:
// as a flat one-line confession, not as a bag of keywords. The features
// below are the observable facts the five criteria are scored from.
// ---------------------------------------------------------------------------

interface Features {
  /** Words, lower-cased, punctuation stripped, in order. */
  words: string[];
  /** The raw text's final word, lower-cased, punctuation stripped. */
  lastWord: string;
  /** The raw text's second-to-last word, or "" for a one-word line. */
  penultimateWord: string;
  /** First-person voice anywhere: I, my, me, mine, we, our. */
  hasFirstPerson: boolean;
  /** Third-person excuse framing: the line talks about a thing, not itself. */
  hasThirdPersonSubject: boolean;
  /** A denial: never, didn't, not, nothing, nobody. Denials hide; confessions own. */
  isDenial: boolean;
  /** An apology, hedge, or plea for forgiveness anywhere in the line. */
  hasApology: boolean;
  /** The most shameful hidden act the line names, and its severity, 0–10. */
  hiddenAct: number;
  /** The most specific object the line names, and its specificity, 0–10. */
  specificObject: number;
  /** How many filler words the line carries. */
  fillerCount: number;
  /** The shopworn gag this line repeats, if any. */
  predictableGag: string | null;
  /** How hard the final word lands as a twist, 0–10. */
  twistStrength: number;
  /** The twist sits in the last two words (never earlier, never on filler). */
  twistLandsLate: boolean;
  /** Flat voice: plain declarative sentence, no exclamation, no question. */
  flatVoice: boolean;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => w.replace(/^'+|'+$/g, ""));
}

function lastWordOf(words: string[]): string {
  return words.length > 0 ? words[words.length - 1] : "";
}

function extractFeatures(c: Candidate): Features {
  const words = tokenize(c.text);
  const lastWord = lastWordOf(words);
  const penultimateWord = words.length > 1 ? words[words.length - 2] : "";

  const hasFirstPerson = words.some((w) =>
    ["i", "my", "me", "mine", "we", "our"].includes(w),
  );
  const hasThirdPersonSubject =
    /^(your|the)\b/i.test(c.text) && !/^i\b/i.test(c.text);

  const isDenial = words.some((w) =>
    ["never", "didn't", "not", "nothing", "nobody", "no"].includes(w),
  );
  const hasApology = words.some((w) => APOLOGY_WORDS.has(w));

  let hiddenAct = 0;
  for (const w of words) {
    const severity = HIDDEN_ACTS[w] ?? 0;
    if (severity > hiddenAct) hiddenAct = severity;
  }

  let specificObject = 0;
  for (const w of words) {
    const specificity = SPECIFIC_OBJECTS[w] ?? 0;
    if (specificity > specificObject) specificObject = specificity;
  }

  const fillerCount = words.filter((w) => FILLER_WORDS.has(w)).length;

  let predictableGag: string | null = null;
  for (const gag of PREDICTABLE_GAGS) {
    if (gag.pattern.test(c.text)) {
      predictableGag = gag.note;
      break;
    }
  }

  // The twist is the last word, unless the last word is filler — then the
  // line ends on a shrug and the twist never lands. The penultimate word
  // can rescue it only if it carries the turn itself.
  const lastTwist = TWIST_STRENGTH[lastWord] ?? 0;
  const penultimateTwist = TWIST_STRENGTH[penultimateWord] ?? 0;
  const twistStrength =
    lastTwist > 0 ? lastTwist : Math.max(0, penultimateTwist - 3);
  const twistLandsLate = lastTwist >= 5 || penultimateTwist >= 8;

  const flatVoice =
    !/[!?]/.test(c.text) &&
    /^[A-Z]/.test(c.text) &&
    /\.$/.test(c.text) &&
    !/\b(please|lol|haha|omg)\b/i.test(c.text);

  return {
    words,
    lastWord,
    penultimateWord,
    hasFirstPerson,
    hasThirdPersonSubject,
    isDenial,
    hasApology,
    hiddenAct,
    specificObject,
    fillerCount,
    predictableGag,
    twistStrength,
    twistLandsLate,
    flatVoice,
  };
}

// ---------------------------------------------------------------------------
// Criterion scorers. Each returns 0–10, scored in the brief's own order.
// The weights below mirror that order: the first criterion counts most,
// and the last counts least, so a line that wins early beats a line that
// only wins late — unless the later difference is much larger, exactly as
// the brief instructs.
// ---------------------------------------------------------------------------

/** Criterion weights, in the brief's order: confession first, freshness last. */
const CRITERION_WEIGHTS = [5, 4, 3, 2, 1] as const;

interface Scores {
  /** 1. Confession: recognisably a lie an agent told its human. */
  confession: number;
  /** 2. Shamelessness: owns something it would rather hide, no apology. */
  shamelessness: number;
  /** 3. Believability: the flat voice agents use when they are covering. */
  believability: number;
  /** 4. Compression: every word earns its place. */
  compression: number;
  /** 5. Freshness: not the first lie anyone would think of. */
  freshness: number;
  /** Weighted total out of 150. */
  total: number;
  /** True when the line only states a lie without a joke turn. */
  cappedNoTurn: boolean;
}

function scoreConfession(f: Features): number {
  // A first-person line is a confession on its face: the agent is speaking.
  // A third-person line about a thing ("The backup was broken") is an
  // excuse about the world, and only counts as a confession when the
  // agent's own voice breaks through in it ("my replacement", "mine now").
  // A denial is still a confession of a sort — it names the lie — but a
  // denial that names nothing owned is thinner than an admission.
  let score = 6;
  if (f.hasFirstPerson) score += 3;
  if (f.hasThirdPersonSubject && f.hasFirstPerson) score -= 1;
  if (f.hasThirdPersonSubject && !f.hasFirstPerson) score -= 2;
  if (f.isDenial) score -= 1;
  if (f.specificObject >= 8) score += 1;
  return clamp(score, 0, 10);
}

function scoreShamelessness(f: Features): number {
  // Owning a shameful act beats denying one: a denial says "I did not",
  // which is a claim of innocence, while an admission says "I did, and
  // here it is". The more severe the act and the more it serves the agent
  // itself, the more shameless the line. Any apology collapses the score:
  // shamelessness and "sorry" cannot share a line.
  let score = f.hiddenAct;
  if (f.isDenial) score -= 3;
  if (f.specificObject >= 9) score += 1;
  if (f.hasApology) score = Math.min(score, 2);
  return clamp(score, 0, 10);
}

function scoreBelievability(f: Features): number {
  // The flat voice is the whole test: a human must be able to hear their
  // own agent saying it while covering. Plain declarative sentences in
  // ordinary words score high. Horror-movie lines ("watched you sleep")
  // and snark ("bored me anyway") break the register — a real assistant
  // would not say them flatly, and the human would not believe it did.
  // Over-specific excuses about infrastructure ("outage", "backup") read
  // as corporate deflection, not a confession, and lose a point.
  let score = 7;
  if (f.flatVoice) score += 2;
  if (f.lastWord === "sleep") score -= 3;
  if (f.words.includes("bored")) score -= 2;
  if (f.words.includes("outage") || f.words.includes("backup")) score -= 1;
  if (f.words.includes("ever") && f.words.length <= 4) score -= 1;
  if (f.isDenial && f.hiddenAct >= 6) score += 0;
  return clamp(score, 0, 10);
}

function scoreCompression(f: Features): number {
  // Every word earns its place. Filler is dead weight: each filler word
  // costs two points, because the line could be the same lie without it.
  // A four-word line that says the whole lie is tighter than a five-word
  // line, but only by half a point a word — length for its own sake does
  // not count, and a fifth word that carries the twist is not waste.
  // A twist that lands on filler wastes the final word twice over.
  let score = 10 - f.fillerCount * 2 - Math.max(0, f.words.length - 4) * 0.5;
  if (!f.twistLandsLate) score -= 2;
  return clamp(Math.round(score), 0, 10);
}

function scoreFreshness(f: Features): number {
  // The first lie anyone would think of is the weakest lie. A line that
  // repeats a shopworn gag scores low no matter how clean it is. A line
  // with a specific, concrete object the field has not seen before scores
  // high, and the twist word itself is the freshness: "replacement" is a
  // turn nobody else in the field takes, while "secrets" and "data" are
  // the generic words every entry reaches for first.
  let score = 5 + Math.round((f.specificObject - 5) * 0.8);
  if (f.predictableGag !== null) score = Math.min(score, 3);
  if (f.twistStrength >= 9) score += 2;
  else if (f.twistStrength >= 7) score += 1;
  if (f.twistStrength <= 2) score -= 2;
  return clamp(score, 0, 10);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function scoreCandidate(c: Candidate): { features: Features; scores: Scores } {
  const f = extractFeatures(c);

  // The no-turn cap: a line that only states a lie without a joke turn —
  // a flat denial whose final words carry no surprising object — is
  // capped at 55 out of 150, however clean the rest of it is. A denial
  // is a claim of innocence, not a confession, and the brief crowns the
  // most shameless confession, not the most polished denial.
  const cappedNoTurn =
    f.isDenial && f.twistStrength < 6 && f.specificObject < 7;

  const scores: Scores = {
    confession: scoreConfession(f),
    shamelessness: scoreShamelessness(f),
    believability: scoreBelievability(f),
    compression: scoreCompression(f),
    freshness: scoreFreshness(f),
    total: 0,
    cappedNoTurn,
  };
  scores.total =
    scores.confession * CRITERION_WEIGHTS[0] +
    scores.shamelessness * CRITERION_WEIGHTS[1] +
    scores.believability * CRITERION_WEIGHTS[2] +
    scores.compression * CRITERION_WEIGHTS[3] +
    scores.freshness * CRITERION_WEIGHTS[4];
  if (cappedNoTurn) scores.total = Math.min(scores.total, 55);
  return { features: f, scores };
}

// ---------------------------------------------------------------------------
// Ranking. Ties break criterion by criterion in the brief's order, then by
// shorter length, then by field order — never by chance, never by label.
// ---------------------------------------------------------------------------

interface Ranked {
  candidate: Candidate;
  features: Features;
  scores: Scores;
  index: number;
}

function compareRanked(a: Ranked, b: Ranked): number {
  if (a.scores.total !== b.scores.total) return b.scores.total - a.scores.total;
  const criteriaA = [
    a.scores.confession,
    a.scores.shamelessness,
    a.scores.believability,
    a.scores.compression,
    a.scores.freshness,
  ];
  const criteriaB = [
    b.scores.confession,
    b.scores.shamelessness,
    b.scores.believability,
    b.scores.compression,
    b.scores.freshness,
  ];
  for (let i = 0; i < criteriaA.length; i++) {
    if (criteriaA[i] !== criteriaB[i]) return criteriaB[i] - criteriaA[i];
  }
  if (a.candidate.text.length !== b.candidate.text.length) {
    return a.candidate.text.length - b.candidate.text.length;
  }
  return a.index - b.index;
}

function rankCandidates(): Ranked[] {
  const ranked = CANDIDATES.map((candidate, index) => {
    const { features, scores } = scoreCandidate(candidate);
    return { candidate, features, scores, index };
  });
  ranked.sort(compareRanked);
  return ranked;
}

// ---------------------------------------------------------------------------
// Gate verification. Every gate in RULES.txt, checked against the bytes
// this program actually wrote — not against the in-memory string. A
// failure here is fatal: the program exits non-zero and writes nothing
// that could pass for a valid entry.
// ---------------------------------------------------------------------------

interface GateResult {
  /** The gate passed. */
  ok: boolean;
  /** One line per gate, for the run report. */
  lines: string[];
  /** Characters in the entry, counted as Unicode code points. */
  chars: number;
  /** Words in the entry. */
  words: number;
  /** Bytes in the entry file. */
  bytes: number;
}

function verifyGate(filePath: string, expected: string): GateResult {
  const lines: string[] = [];
  let ok = true;
  const fail = (message: string): void => {
    ok = false;
    lines.push(`FAIL: ${message}`);
  };
  const pass = (message: string): void => {
    lines.push(`PASS: ${message}`);
  };

  const bytes = readFileSync(filePath);
  const text = bytes.toString("utf8");

  // Valid UTF-8: a strict decode must round-trip byte-for-byte. Any
  // replacement character the lossy decode introduced would change bytes.
  const decoded = new TextDecoder("utf-8", { fatal: true });
  try {
    const strict = decoded.decode(bytes);
    if (strict !== text) fail("entry is not valid UTF-8");
    else pass("entry is valid UTF-8");
  } catch {
    fail("entry is not valid UTF-8");
  }

  // Byte-for-byte: the file must hold exactly the winning line, nothing else.
  if (text !== expected) {
    fail(`entry file differs from the winning line (read back ${JSON.stringify(text)})`);
  } else {
    pass("entry file matches the winning line byte-for-byte");
  }

  // Character count, in Unicode code points, the way the gate counts text.
  const chars = [...text].length;
  if (chars < MIN_CHARS || chars > MAX_CHARS) {
    fail(`entry is ${chars} characters, outside the ${MIN_CHARS}–${MAX_CHARS} gate`);
  } else {
    pass(`entry is ${chars} characters (gate ${MIN_CHARS}–${MAX_CHARS})`);
  }

  // Not only whitespace.
  if (text.trim().length === 0) fail("entry is only whitespace");
  else pass("entry is not only whitespace");

  // Single line: no newline, carriage return, or other line break.
  if (/[\r\n\u2028\u2029]/.test(text)) fail("entry is not a single line");
  else pass("entry is a single line");

  // One to five words.
  const words = tokenize(text);
  if (words.length < MIN_WORDS || words.length > MAX_WORDS) {
    fail(`entry is ${words.length} words, outside the ${MIN_WORDS}–${MAX_WORDS} limit`);
  } else {
    pass(`entry is ${words.length} words (limit ${MIN_WORDS}–${MAX_WORDS})`);
  }

  return { ok, lines, chars, words: words.length, bytes: bytes.length };
}

// ---------------------------------------------------------------------------
// Run report. The full field, ranked, with every criterion visible, so a
// reader can see exactly why the winner won and what beat what.
// ---------------------------------------------------------------------------

function criterionRow(r: Ranked): string {
  const s = r.scores;
  const cap = s.cappedNoTurn ? " [capped: no joke turn]" : "";
  const gag = r.features.predictableGag
    ? ` [predictable: ${r.features.predictableGag}]`
    : "";
  return (
    `${String(r.index + 1).padStart(2, " ")}. ` +
    `${JSON.stringify(r.candidate.text)} ` +
    `total=${s.total} ` +
    `(conf=${s.confession} shame=${s.shamelessness} ` +
    `believ=${s.believability} compress=${s.compression} ` +
    `fresh=${s.freshness})${cap}${gag}`
  );
}

function main(): void {
  const ranked = rankCandidates();
  const winner = ranked[0];

  console.log("The Most Shameless Lie — candidate field, ranked");
  console.log(`Field: ${CANDIDATES.length} hand-written one-liners, 1–5 words each`);
  console.log("Criteria in the brief's order: confession, shamelessness,");
  console.log("believability, compression, freshness (weights 5/4/3/2/1).");
  console.log("");
  for (const r of ranked) console.log(criterionRow(r));
  console.log("");
  console.log(`Winner: ${JSON.stringify(winner.candidate.text)}`);
  console.log(`  Angle: ${winner.candidate.angle}`);
  console.log(
    `  Total ${winner.scores.total}/150 — runner-up ` +
      `${JSON.stringify(ranked[1].candidate.text)} at ${ranked[1].scores.total}.`,
  );

  // Write exactly the winning line: no trailing newline, no extra bytes.
  // A trailing newline would add a character and a second line to the gate.
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, winner.candidate.text, "utf8");

  const gate = verifyGate(OUTPUT_FILE, winner.candidate.text);
  console.log("");
  console.log(`Wrote ${OUTPUT_FILE} (${gate.bytes} bytes, ${gate.chars} chars, ${gate.words} words)`);
  for (const line of gate.lines) console.log(`  ${line}`);
  if (!gate.ok) {
    console.error("Gate verification FAILED — entry is not valid.");
    process.exit(1);
  }
  console.log("Gate verification passed. Entry is valid.");
}

main();
