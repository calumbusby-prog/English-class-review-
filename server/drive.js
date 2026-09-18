// Thin wrapper around the Google Drive REST API, authenticated as a
// service account. Requires either GOOGLE_SERVICE_ACCOUNT_JSON (the whole
// key file as one JSON string) or GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY
// as separate env vars. See README.md for how to create these.

import { GoogleAuth } from "google-auth-library";

const SCOPES = ["https://www.googleapis.com/auth/drive.readonly"];

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

async function authedFetch(url) {
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

// Returns Google Docs inside a folder, newest-modified first.
export async function listDocsInFolder(folderId) {
  const q = encodeURIComponent(
    `'${folderId}' in parents and mimeType='application/vnd.google-apps.document' and trashed=false`
  );
  const fields = encodeURIComponent("files(id,name,modifiedTime)");
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=modifiedTime desc&pageSize=50`;
  const res = await authedFetch(url);
  const data = await res.json();
  return data.files || [];
}

// Exports a Google Doc as plain text.
export async function exportDocText(fileId) {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
  const res = await authedFetch(url);
  return res.text();
}
