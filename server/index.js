import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listDocsInFolder, exportDocText } from "./drive.js";
import { parseTaggedText, mergeParsed } from "./parseContent.js";
import { getClasses } from "./classes.js";
import { extractDocId } from "./docId.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map(); // cache key -> { data, expires }

app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/classes", (req, res) => {
  const classes = getClasses();
  res.json(Object.entries(classes).map(([slug, c]) => ({ slug, name: c.name || slug })));
});

// Fetches + parses a "this week" doc plus a pool of "course" docs, with a
// short cache so a class full of students hitting Start at once doesn't
// each trigger their own round of Drive API calls.
async function loadContent(cacheKey, weekDocId, restDocIds, weekLabel) {
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const weekText = await exportDocText(weekDocId);
  const weekParsed = parseTaggedText(weekText);

  const restTexts = await Promise.all(restDocIds.map((id) => exportDocText(id)));
  const courseParsed = mergeParsed(restTexts.map(parseTaggedText));

  const data = { weekLabel, week: weekParsed, course: courseParsed };
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
      error: "Could not load content from Google Drive. Make sure the doc is shared with the service account.",
      detail: String(err && err.message ? err.message : err),
    });
  }
});

app.listen(PORT, () => {
  console.log(`English Class Review server running on port ${PORT}`);
});
