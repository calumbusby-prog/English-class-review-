// Pulls a Google Doc ID out of whatever a teacher pastes in — a full
// share link, an /edit URL, or the bare ID itself.
const URL_PATTERN = /\/document\/d\/([a-zA-Z0-9_-]{10,})/;
const BARE_ID_PATTERN = /^[a-zA-Z0-9_-]{10,}$/;

export function extractDocId(input) {
  const trimmed = (input || "").trim();
  const urlMatch = trimmed.match(URL_PATTERN);
  if (urlMatch) return urlMatch[1];
  if (BARE_ID_PATTERN.test(trimmed)) return trimmed;
  return null;
}
