// Same job as generateContent.js (turn a doc's raw text into game
// content by actually reading it, instead of guessing with regex), but
// using Google's Gemini API instead of Claude — Gemini 2.5 Flash has a
// genuinely free, permanent tier (no expiring trial, no credit card),
// which is the point of this file existing at all.
//
// Requires GEMINI_API_KEY. Used by server/index.js only when
// ANTHROPIC_API_KEY isn't set — see the priority order there.
//
// Plain fetch() against the REST API rather than an SDK dependency,
// since the request is simple enough not to need one.

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Gemini's structured-output schema is a subset of OpenAPI 3.0 — note
// the UPPERCASE type names ("OBJECT", "STRING", ...), which is Gemini's
// own convention and different from standard JSON Schema's lowercase
// types.
const EXERCISE_SET_SCHEMA = {
  type: "OBJECT",
  properties: {
    vocabMatch: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { term: { type: "STRING" }, definition: { type: "STRING" } },
        required: ["term", "definition"],
      },
    },
    mcq: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          q: { type: "STRING" },
          options: { type: "ARRAY", items: { type: "STRING" } },
          correct: { type: "INTEGER", description: "0-based index into options of the single right answer." },
          explain: { type: "STRING" },
        },
        required: ["q", "options", "correct"],
      },
    },
    gapFill: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          sentence: { type: "STRING", description: 'Must contain exactly one blank written as "___".' },
          answer: { type: "STRING" },
          accept: { type: "ARRAY", items: { type: "STRING" }, description: "All acceptable answers, answer included." },
        },
        required: ["sentence", "answer", "accept"],
      },
    },
    errorSpotting: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          wrong: { type: "STRING" },
          correct: { type: "STRING" },
          note: { type: "STRING" },
        },
        required: ["wrong", "correct", "note"],
      },
    },
    writing: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { prompt: { type: "STRING" }, sample: { type: "STRING" } },
        required: ["prompt", "sample"],
      },
    },
  },
  required: ["vocabMatch", "mcq", "gapFill", "errorSpotting", "writing"],
};

const GENERATED_CONTENT_SCHEMA = {
  type: "OBJECT",
  properties: {
    weekLabel: { type: "STRING" },
    mostRecentDate: { type: "STRING" },
    week: EXERCISE_SET_SCHEMA,
    course: EXERCISE_SET_SCHEMA,
  },
  required: ["weekLabel", "mostRecentDate", "week", "course"],
};

const SYSTEM_PROMPT = `You turn a teacher's raw lesson-note document into review game content for their students.

The document mixes lesson material (vocabulary, grammar points, example sentences, exercises) with the teacher's own working notes. It often has dated subheadings marking each lesson, in formats like "16/9 - Topic", "### 17/9 - Topic", "24/25 - Topic" (day/month), or similar. Sections are not necessarily in date order in the raw text.

Your job:
1. Find every dated subheading. Identify whichever date is most recent relative to the date you're given as "today". Use that section's material for the "week" field.
2. Use material from the OTHER (older) dated sections — across the whole rest of the document — for the "course" field. This is a smaller, secondary pool, so a handful of items is enough; it can be empty if there's nothing usable.
3. If you can't find any dated subheadings at all, treat the entire document as "week" material and leave "course" empty.
4. Write clean, self-contained exercises FROM the actual lesson content — real vocabulary, real grammar points, real example sentences from the doc — not generic filler unrelated to it. Every multiple-choice, gap-fill, and error-correction item must have exactly one unambiguously correct answer that you are certain is right; double-check each one before including it.
5. It's fine to return fewer items, or an empty array for a category, rather than inventing weak material. Don't pad.

Critical privacy rule: this document also contains private information about specific students — names, personal circumstances, needs assessments, contact details, unrelated personal correspondence. NEVER include any of that in your output. Only ever output generic teaching material (vocabulary, grammar, generic example sentences) that any student could see. If you are ever unsure whether something is a personal note about an individual versus general lesson content, leave it out.

Respond with ONLY the JSON object matching the given schema — no other text.`;

export async function generateContentFromDocGemini(docText, { todayISO } = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  const today = todayISO || new Date().toISOString().slice(0, 10);
  const url = `${API_BASE}/${MODEL}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        {
          parts: [{ text: `Today's date: ${today}\n\n--- DOCUMENT TEXT ---\n${docText}` }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: GENERATED_CONTENT_SCHEMA,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    const finishReason = data?.candidates?.[0]?.finishReason;
    throw new Error(`Gemini returned no content (finishReason: ${finishReason || "unknown"}).`);
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`Gemini did not return valid JSON: ${err.message}`);
  }

  return parsed;
}
