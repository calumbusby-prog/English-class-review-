// Turns tagged lines inside a Google Doc's plain text into game content.
// Only lines starting with one of these tags are ever read — everything
// else in the doc (freeform notes, names, anything private) is ignored.
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

function emptyBucket() {
  return { vocabMatch: [], mcq: [], gapFill: [], errorSpotting: [], writing: [] };
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
