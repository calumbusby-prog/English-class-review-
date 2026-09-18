// Maps a URL-friendly class slug to its Google Drive content source.
// The normal source of truth is the checked-in classes.json file next to
// this one — doc/folder IDs aren't secrets (the Drive API still requires
// the doc to actually be shared with the service account before it can
// be read), so they're safe to commit, and that makes adding a class as
// simple as "edit a file, commit, push."
//
// classes.json shape:
//
//   {"tuesday-beginners": {"name": "Tuesday Beginners", "docId": "1AbC..."},
//    "thursday-business": {"name": "Thursday Business", "folderId": "1XyZ..."}}
//
// See parseContent.js for the tagged-line format, and README.md for the
// docId vs folderId distinction.
//
// If this repo is public and you'd rather not commit a particular class
// (e.g. it would name a specific student), set CLASS_FOLDERS_JSON as a
// Render environment variable instead, with the same shape — entries
// there are merged in and override any same-slug entry from the file.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, "classes.json");

function asObject(parsed) {
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
}

function readConfigFile() {
  try {
    return asObject(JSON.parse(readFileSync(CONFIG_PATH, "utf8")));
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.warn(`server/classes.json is not valid JSON: ${err.message}`);
    }
    return {};
  }
}

function readEnvOverride() {
  if (!process.env.CLASS_FOLDERS_JSON) return {};
  try {
    return asObject(JSON.parse(process.env.CLASS_FOLDERS_JSON));
  } catch {
    console.warn("CLASS_FOLDERS_JSON env var is not valid JSON — ignoring it.");
    return {};
  }
}

export function getClasses() {
  return { ...readConfigFile(), ...readEnvOverride() };
}
