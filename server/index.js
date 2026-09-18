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

    const { folderId, name } = classConfig;
    const docs = await listDocsInFolder(folderId);
    if (!docs.length) {
      return res.status(404).json({ error: `No Google Docs found in the "${name || slug}" folder.` });
    }

    const [weekDoc, ...restDocs] = docs;
    const weekText = await exportDocText(weekDoc.id);
    const weekParsed = parseTaggedText(weekText);

    const restTexts = await Promise.all(restDocs.slice(0, 20).map((d) => exportDocText(d.id)));
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
