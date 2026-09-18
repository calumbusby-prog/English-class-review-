import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listDocsInFolder, exportDocText } from "./drive.js";
import { parseDocsForClass } from "./parseContent.js";
import { generateContentFromDoc } from "./generateContent.js";
import { getClasses } from "./classes.js";
import { extractDocId } from "./docId.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// AI generation costs real money/time per call, and doc content doesn't
// change every few minutes, so cache longer than a plain parse would need.
const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map(); // cache key -> { data, expires }

app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/classes", (req, res) => {
  const classes = getClasses();
  res.json(Object.entries(classes).map(([slug, c]) => ({ slug, name: c.name || slug })));
});

function fallbackParse(weekText, restTexts, weekLabel) {
  // Re-splits by dated subheadings across everything available for this
  // class, rather than trusting weekText/restTexts' doc-level split —
  // a single doc with multiple dated lessons (the common case) gets its
  // most recent lesson scoped out here even though it's "one doc".
  const { weekParsed, courseParsed, weekSectionTitle } = parseDocsForClass([weekText, ...restTexts]);
  const label = weekSectionTitle ? `${weekLabel} (${weekSectionTitle})` : weekLabel;
  return { weekLabel: label, week: weekParsed, course: courseParsed };
}

// Fetches a "this week" doc plus a pool of "course" docs, then turns them
// into game content — via Claude if ANTHROPIC_API_KEY is set (it reads
// the dated subheadings itself to figure out what's most recent, and
// writes exercises with answers that are actually correct), otherwise
// via the free tag/heuristic parser. Cached so a class full of students
// hitting Start at once doesn't each trigger their own round of calls.
async function loadContent(cacheKey, weekDocId, restDocIds, weekLabel) {
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const weekText = await exportDocText(weekDocId);
  const restTexts = await Promise.all(restDocIds.map((id) => exportDocText(id)));

  let data;
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const combinedText = [weekText, ...restTexts].join("\n\n--- (next document) ---\n\n");
      const generated = await generateContentFromDoc(combinedText);
      data = { weekLabel: generated.weekLabel || weekLabel, week: generated.week, course: generated.course };
    } catch (err) {
      console.error("AI content generation failed, falling back to the tag/heuristic parser:", err);
      data = fallbackParse(weekText, restTexts, weekLabel);
    }
  } else {
    data = fallbackParse(weekText, restTexts, weekLabel);
  }

  cache.set(cacheKey, { data, expires: Date.now() + CACHE_TTL_MS });
  return data;
}

app.get("/api/content", async (req, res) => {
  try {
    // Ad-hoc mode: a Doc link or ID pasted directly, no classes.json entry
    // needed. Still requires the doc to be shared with the service
    // account — pasting an arbitrary unrelated doc just fails below.
    if (req.query.doc) {
      const docId = extractDocId(req.query.doc);
      if (!docId) {
        return res.status(400).json({ error: "That doesn't look like a Google Doc link or ID." });
      }
      const data = await loadContent(`doc:${docId}`, docId, [], "This week's review");
      return res.json(data);
    }

    const classes = getClasses();
    const slugs = Object.keys(classes);
    if (!slugs.length) {
      return res.status(400).json({
        error: "No classes configured. Add one to server/classes.json, or pass ?doc=<link> — see README.md.",
      });
    }

    const slug = req.query.class || slugs[0];
    const classConfig = classes[slug];
    if (!classConfig) {
      return res.status(404).json({ error: `Unknown class "${slug}".` });
    }

    const { name, docId, folderId, courseDocIds } = classConfig;
    let weekDocId;
    let restDocIds;

    if (docId) {
      // Direct mode: always use this one doc as "this week". Optionally
      // pool a fixed list of other docs for the course-wide bank.
      weekDocId = docId;
      restDocIds = courseDocIds || [];
    } else if (folderId) {
      // Folder mode: whichever doc was edited most recently is "this
      // week"; every other doc in the folder is the course-wide bank.
      const docs = await listDocsInFolder(folderId);
      if (!docs.length) {
        return res.status(404).json({ error: `No Google Docs found in the "${name || slug}" folder.` });
      }
      weekDocId = docs[0].id;
      restDocIds = docs.slice(1, 21).map((d) => d.id);
    } else {
      return res.status(400).json({ error: `Class "${slug}" needs either a "docId" or a "folderId" in classes.json.` });
    }

    const data = await loadContent(`class:${slug}`, weekDocId, restDocIds, `${name || slug} — this week's review`);
    res.json(data);
  } catch (err) {
    console.error("Failed to load content from Drive:", err);
    res.status(500).json({
      error: "Could not load this doc. Make sure it's shared as \"Anyone with the link can view\" (or with the service account, if it's kept private).",
      detail: String(err && err.message ? err.message : err),
    });
  }
});

app.listen(PORT, () => {
  console.log(`English Class Review server running on port ${PORT}`);
});
