// Turns a doc's raw text into game content using Claude, instead of
// guessing with regex. Claude actually reads the lesson material,
// figures out which dated section is most recent, and writes clean
// exercises with answers that are genuinely correct — the parts a
// rule-based parser (see parseContent.js) can't reliably do on its own.
//
// Requires ANTHROPIC_API_KEY. If it's not set, server/index.js falls
// back to the free tag/heuristic parser instead of calling this.

import Anthropic from "@anthropic-ai/sdk";
// The SDK's zodOutputFormat helper builds JSON Schema via zod/v4's
// internals specifically — schemas built from the classic top-level
// "zod" import (v3 API surface) fail with "Cannot read properties of
// undefined (reading 'def')" even though zod's package.json lists this
// as a supported peer range.
import { z } from "zod/v4";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";

const ExerciseSet = z.object({
  vocabMatch: z
    .array(z.object({ term: z.string(), definition: z.string() }))
    .describe("Vocabulary word/phrase paired with a short, clear definition."),
  mcq: z
    .array(
      z.object({
        q: z.string(),
        options: z.array(z.string()).min(3).max(4),
        correct: z.number().int().min(0),
        explain: z.string().optional(),
      })
    )
    .describe("Multiple-choice questions. `correct` is the 0-based index into `options` of the single right answer."),
  gapFill: z
    .array(
      z.object({
        sentence: z.string().describe('Must contain exactly one blank written as "___".'),
        answer: z.string(),
        accept: z.array(z.string()).describe("All acceptable answers, answer included."),
      })
    )
    .describe("Fill-in-the-blank sentences drawn from real example sentences or grammar points in the material."),
  errorSpotting: z
    .array(
      z.object({
        wrong: z.string().describe("A sentence with a genuine grammar/vocab error a student at this level would plausibly make."),
        correct: z.string().describe("The corrected version."),
        note: z.string().describe("One short sentence explaining the rule."),
      })
    )
    .describe("Error-correction pairs. Base these on real errors visible in the material where possible."),
  writing: z
    .array(
      z.object({
        prompt: z.string(),
        sample: z.string().describe("One good model answer to the prompt."),
      })
    )
    .describe("Short writing prompts that use this section's vocabulary/grammar."),
});

const GeneratedContent = z.object({
  weekLabel: z.string().describe('Short human label, e.g. "Week of 14-18 Sept: Direct & Indirect Communication".'),
  mostRecentDate: z.string().describe('The date (as written in the doc, e.g. "17/9") of the section used for `week`, or "none" if no dated sections were found.'),
  week: ExerciseSet.describe("Exercises built from the MOST RECENT dated section of the document."),
  course: ExerciseSet.describe("A smaller set of exercises built from OLDER material in the document (earlier dated sections), for spaced review. Can be empty if there's no older material."),
});

const SYSTEM_PROMPT = `You turn a teacher's raw lesson-note document into review game content for their students.

The document mixes lesson material (vocabulary, grammar points, example sentences, exercises) with the teacher's own working notes. It often has dated subheadings marking each lesson, in formats like "16/9 - Topic", "### 17/9 - Topic", "24/25 - Topic" (day/month), or similar. Sections are not necessarily in date order in the raw text.

Your job:
1. Find every dated subheading. Identify whichever date is most recent relative to the date you're given as "today". Use that section's material for the "week" field.
2. Use material from the OTHER (older) dated sections — across the whole rest of the document — for the "course" field. This is a smaller, secondary pool, so a handful of items is enough; it can be empty if there's nothing usable.
3. If you can't find any dated subheadings at all, treat the entire document as "week" material and leave "course" empty.
4. Write clean, self-contained exercises FROM the actual lesson content — real vocabulary, real grammar points, real example sentences from the doc — not generic filler unrelated to it. Every multiple-choice, gap-fill, and error-correction item must have exactly one unambiguously correct answer that you are certain is right; double-check each one before including it.
5. It's fine to return fewer items, or an empty array for a category, rather than inventing weak material. Don't pad.

Critical privacy rule: this document also contains private information about specific students — names, personal circumstances, needs assessments, contact details, unrelated personal correspondence. NEVER include any of that in your output. Only ever output generic teaching material (vocabulary, grammar, generic example sentences) that any student could see. If you are ever unsure whether something is a personal note about an individual versus general lesson content, leave it out.`;

export async function generateContentFromDoc(docText, { todayISO } = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set.");
  }

  const client = new Anthropic({ apiKey });
  const today = todayISO || new Date().toISOString().slice(0, 10);

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Today's date: ${today}\n\n--- DOCUMENT TEXT ---\n${docText}`,
      },
    ],
    output_config: { format: zodOutputFormat(GeneratedContent) },
  });

  if (!response.parsed_output) {
    throw new Error("Claude did not return valid structured content for this doc.");
  }

  return response.parsed_output;
}
