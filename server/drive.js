// Three ways to read from Google Drive, tried in order:
//
// 1. A plain, unauthenticated request to a doc's public export URL.
//    Free, zero setup, but Google's export endpoint often blocks
//    automated/server requests as anti-scraping protection, even for
//    genuinely public docs — so it's a nice-to-have, not reliable on
//    its own. (Doc export only — no equivalent for listing a folder.)
// 2. The Drive API with a plain API key (GOOGLE_API_KEY). The right
//    choice for anything shared "Anyone with the link can view" — no
//    service account, no private key file, no per-item sharing step.
//    Officially supported for exactly this, unlike (1).
// 3. The Drive API, authenticated as a service account, for docs/folders
//    you'd rather keep un-public. Requires GOOGLE_SERVICE_ACCOUNT_JSON,
//    or both GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY, as env vars —
//    see README.md.

import { GoogleAuth } from "google-auth-library";

const SCOPES = ["https://www.googleapis.com/auth/drive.readonly"];

function hasServiceAccountEnv() {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY));
}

function credentialsFromEnv() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  }
  const client_email = process.env.GOOGLE_CLIENT_EMAIL;
  const private_key = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!client_email || !private_key) {
    throw new Error(
      "Missing Google service account credentials. Set GOOGLE_SERVICE_ACCOUNT_JSON, or both " +
        "GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY. See README.md."
    );
  }
  return { client_email, private_key };
}

let authClient;
function getAuth() {
  if (!authClient) {
    authClient = new GoogleAuth({ credentials: credentialsFromEnv(), scopes: SCOPES });
  }
  return authClient;
}

async function serviceAccountFetch(url) {
  const auth = getAuth();
  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();
  const token = typeof accessToken === "string" ? accessToken : accessToken?.token;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Drive API error ${res.status}: ${body}`);
  }
  return res;
}

async function apiKeyFetch(url) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY not set");
  const joiner = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${joiner}key=${apiKey}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Drive API (key) error ${res.status}: ${body}`);
  }
  return res;
}

// Calls a Drive API endpoint, trying the API key first (if set) and
// falling back to the service account (if configured).
async function driveApiFetch(url) {
  const attempts = [];

  if (process.env.GOOGLE_API_KEY) {
    try {
      return await apiKeyFetch(url);
    } catch (err) {
      attempts.push(`API key: ${err.message}`);
    }
  }

  if (hasServiceAccountEnv()) {
    try {
      return await serviceAccountFetch(url);
    } catch (err) {
      attempts.push(`service account: ${err.message}`);
    }
  }

  if (!attempts.length) {
    throw new Error(
      'No Google Drive credentials configured. Set GOOGLE_API_KEY for public docs/folders ("Anyone ' +
        'with the link can view"), or set up a service account for private ones — see README.md.'
    );
  }
  throw new Error(attempts.join("; "));
}

// Returns Google Docs inside a folder, newest-modified first.
export async function listDocsInFolder(folderId) {
  const q = encodeURIComponent(
    `'${folderId}' in parents and mimeType='application/vnd.google-apps.document' and trashed=false`
  );
  const fields = encodeURIComponent("files(id,name,modifiedTime)");
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=modifiedTime desc&pageSize=50`;
  const res = await driveApiFetch(url);
  const data = await res.json();
  return data.files || [];
}

async function exportDocTextPublic(fileId) {
  const url = `https://docs.google.com/document/d/${fileId}/export?format=txt`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Doc isn't publicly viewable (HTTP ${res.status})`);
  }
  const text = await res.text();
  // A doc that requires sign-in redirects to an HTML login page instead
  // of returning plain text — this is the giveaway when that happens.
  if (/^<!DOCTYPE html/i.test(text.trim())) {
    throw new Error("Doc isn't publicly viewable (got a sign-in page instead of text)");
  }
  return text;
}

// Exports a Google Doc as plain text, trying the unauthenticated public
// export first, then the Drive API (API key, then service account).
export async function exportDocText(fileId) {
  try {
    return await exportDocTextPublic(fileId);
  } catch (publicErr) {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
    try {
      const res = await driveApiFetch(url);
      return res.text();
    } catch (apiErr) {
      throw new Error(`plain export: ${publicErr.message}; ${apiErr.message}`);
    }
  }
}
