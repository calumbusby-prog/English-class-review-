// Turns a Google Doc's plain text into game content two ways:
//
// 1. Tagged lines — explicit, exact control. See the cheat sheet below.
// 2. Heuristic vocabulary extraction — no tagging needed. Scans for the
//    "Term — definition" style lines that show up naturally in most
//    lesson vocab lists (see extractVocabHeuristic below) and turns them
//    into vocabMatch pairs automatically.
//
// Both run on every doc; their vocabMatch results are merged (tagged
// entries first, deduplicated by term). Only MCQ/GAPFILL/ERROR/WRITE
// still need explicit tags — those require a defined right answer that
// can't be guessed reliably from prose alone.
//
// Cheat sheet (see README.md for the full version with examples):
//
//   VOCAB: term | definition
//   MCQ: question | *correct option | wrong option | wrong option
//   GAPFILL: sentence with ___ | accepted answer, another accepted answer
//   ERROR: incorrect sentence | corrected sentence | optional short note
//   WRITE: writing prompt | one possible sample answer
//
// A line can appear anywhere in the doc, mixed in with your normal notes.

const TAG_RE = /^(VOCAB|MCQ|GAPFILL|ERROR|WRITE)\s*:\s*(.+)$/i;

// "Term — definition" or "Term - definition", optionally after a list
// marker (-, *, •, "1.", "a)", etc). Non-greedy term capture so it stops
// at the FIRST separator, which is what keeps "Passive-aggressive —
// shows anger..." working (the internal hyphen has no spaces around it,
// so it's never mistaken for the separator).
const BULLET_PREFIX_RE = /^\s*(?:[-*•]|\d+[.)]|[a-hA-H][.)])\s*/;
const DASH_SPLIT_RE = /^(.+?)\s[—–]\s(.+)$/; // em/en dash, preferred — rarely appears mid-sentence in these docs
const HYPHEN_SPLIT_RE = /^(.+?)\s-\s(.+)$/; // plain hyphen fallback
const VALID_TERM_RE = /^[A-Za-z][A-Za-z'-]*(?:\s[A-Za-z'-]+){0,3}$/; // 1–4 words, letters/'/- only

// A definition that STARTS with one of these verbs signals "this is a
// note about a specific person" rather than a word's meaning — in every
// real example seen (e.g. "Alejandro - wants to improve his grammar..."),
// the descriptor comes immediately after "Name - ". Anchored to the
// start only, so a legitimate definition that merely contains a common
// word like "want" further in ("...you say clearly what you want")
// isn't wrongly rejected.
const PERSONAL_NOTE_RE =
  /^(wants?|needs?|has (problems|trouble)|is (comfortable|originally|currently)|prefers?|likes? to|enjoys?|lives? in|works? (as|at|in)|used to|studies?|speaks?)\b/i;

// A second dash-like separator inside the definition means the line is
// really a multi-part note ("Name - Role - Details"), not a clean
// term/definition pair — real vocab definitions don't do this.
const SECOND_SEPARATOR_RE = /[—–]|\s-\s/;

const MIN_DEFINITION_LEN = 5;
const MAX_DEFINITION_LEN = 90;
const MAX_HEURISTIC_PAIRS = 60;

export function extractVocabHeuristic(text) {
  const results = [];
  const seen = new Set();
  const lines = (text || "").split(/\r?\n/);

  for (const rawLine of lines) {
    if (results.length >= MAX_HEURISTIC_PAIRS) break;

    let line = rawLine.trim();
    if (!line || line.length > 200) continue;
    if (/^(VOCAB|MCQ|GAPFILL|ERROR|WRITE)\s*:/i.test(line)) continue; // handled by the tag parser
    if (/https?:\/\//.test(line) || /\[\d/.test(line) || line.endsWith("?")) continue;

    line = line.replace(BULLET_PREFIX_RE, "");

    const match = line.match(DASH_SPLIT_RE) || line.match(HYPHEN_SPLIT_RE);
    if (!match) continue;

    const term = match[1].trim().replace(/[:;,]$/, "");
    const definition = match[2].trim().replace(/[;,]$/, "");

    if (!VALID_TERM_RE.test(term)) continue;
    if (definition.length < MIN_DEFINITION_LEN || definition.length > MAX_DEFINITION_LEN) continue;
    if (PERSONAL_NOTE_RE.test(definition)) continue;
    if (SECOND_SEPARATOR_RE.test(definition)) continue;

    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ term, definition });
  }

  return results;
}

function emptyBucket() {
  return { vocabMatch: [], mcq: [], gapFill: [], errorSpotting: [], writing: [] };
}

function mergeVocab(tagged, heuristic) {
  const seen = new Set(tagged.map((v) => v.term.toLowerCase()));
  const merged = tagged.slice();
  for (const v of heuristic) {
    const key = v.term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(v);
  }
  return merged;
}

export function parseTaggedText(text) {
  const out = emptyBucket();
  const lines = (text || "").split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const match = line.match(TAG_RE);
    if (!match) continue;

    const tag = match[1].toUpperCase();
    const parts = match[2].split("|").map((s) => s.trim());

    if (tag === "VOCAB" && parts.length >= 2 && parts[0] && parts[1]) {
      out.vocabMatch.push({ term: parts[0], definition: parts[1] });
    } else if (tag === "GAPFILL" && parts.length >= 2 && parts[0].includes("___") && parts[1]) {
      const accept = parts[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (accept.length) out.gapFill.push({ sentence: parts[0], answer: accept[0], accept });
    } else if (tag === "MCQ" && parts.length >= 3) {
      const [q, ...opts] = parts;
      let correct = opts.findIndex((o) => o.startsWith("*"));
      if (correct === -1) correct = 0;
      const options = opts.map((o) => o.replace(/^\*/, "").trim()).filter(Boolean);
      if (q && options.length >= 2) out.mcq.push({ q, options, correct: Math.min(correct, options.length - 1) });
    } else if (tag === "ERROR" && parts.length >= 2 && parts[0] && parts[1]) {
      out.errorSpotting.push({ wrong: parts[0], correct: parts[1], note: parts[2] || "" });
    } else if (tag === "WRITE" && parts.length >= 2 && parts[0] && parts[1]) {
      out.writing.push({ prompt: parts[0], sample: parts[1] });
    }
    // Anything else (a malformed tag line, wrong field count) is silently
    // skipped rather than breaking the whole doc's worth of content.
  }

  out.vocabMatch = mergeVocab(out.vocabMatch, extractVocabHeuristic(text));
  return out;
}

export function mergeParsed(parsedList) {
  const merged = emptyBucket();
  for (const parsed of parsedList) {
    for (const key of Object.keys(merged)) {
      merged[key].push(...(parsed[key] || []));
    }
  }
  return merged;
}
