import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listDocsInFolder, exportDocText } from "./drive.js";
import { parseTaggedText, mergeParsed } from "./parseContent.js";
import { getClasses } from "./classes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map(); // slug -> { data, expires }

app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/classes", (req, res) => {
  const classes = getClasses();
  res.json(Object.entries(classes).map(([slug, c]) => ({ slug, name: c.name || slug })));
});

app.get("/api/content", async (req, res) => {
  try {
    const classes = getClasses();
    const slugs = Object.keys(classes);
    if (!slugs.length) {
      return res.status(400).json({
        error: "No classes configured. Set CLASS_FOLDERS_JSON — see README.md.",
      });
    }

    const slug = req.query.class || slugs[0];
    const classConfig = classes[slug];
    if (!classConfig) {
      return res.status(404).json({ error: `Unknown class "${slug}".` });
    }

    const cached = cache.get(slug);
    if (cached && cached.expires > Date.now()) {
      return res.json(cached.data);
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
      return res.status(400).json({ error: `Class "${slug}" needs either a "docId" or a "folderId" in CLASS_FOLDERS_JSON.` });
    }

    const weekText = await exportDocText(weekDocId);
    const weekParsed = parseTaggedText(weekText);

    const restTexts = await Promise.all(restDocIds.map((id) => exportDocText(id)));
    const courseParsed = mergeParsed(restTexts.map(parseTaggedText));

    const data = {
      weekLabel: `${name || slug} — this week's review`,
      week: weekParsed,
      course: courseParsed,
    };

    cache.set(slug, { data, expires: Date.now() + CACHE_TTL_MS });
    res.json(data);
  } catch (err) {
    console.error("Failed to load content from Drive:", err);
    res.status(500).json({
      error: "Could not load content from Google Drive.",
      detail: String(err && err.message ? err.message : err),
    });
  }
});

app.listen(PORT, () => {
  console.log(`English Class Review server running on port ${PORT}`);
});
