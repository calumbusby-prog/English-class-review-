// Maps a URL-friendly class slug to its Drive folder, from the
// CLASS_FOLDERS_JSON env var, e.g.:
//
//   {"tuesday-beginners": {"name": "Tuesday Beginners", "folderId": "1AbC..."},
//    "thursday-business": {"name": "Thursday Business English", "folderId": "1XyZ..."}}
//
// Each folder should contain one Google Doc per class, with tagged lines
// (see parseContent.js). The most recently edited doc in the folder is
// treated as "this week"; the rest are pooled as the course-wide bank.

export function getClasses() {
  const raw = process.env.CLASS_FOLDERS_JSON || "{}";
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    console.warn("CLASS_FOLDERS_JSON is not valid JSON — no classes configured.");
    return {};
  }
}
