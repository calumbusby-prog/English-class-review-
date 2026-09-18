# English Class Review

A quick, self-paced review game for a class link. A student opens the
link, clicks **Start**, and plays through:

1. **Multiple choice**
2. **Gap fill**
3. **Matching** (word ↔ definition)
4. **Spot & fix the error**
5. **Write a response** (open-ended, with a sample answer to compare against)
6. **Final challenge** — a flappy-bird-style game. A wall with two gaps
   flies toward the bird, each gap labeled with an answer option; fly
   through the **correct** one to score 10 points, up to a target of 200.
   No lives, no game over — it just gets faster and the gaps get smaller
   as the score climbs.

Every round mixes in roughly **90% material from the most recent lesson**
and **10% from everything covered before that**, so review stays focused
on what's new without letting older vocab and grammar fully fade.

## How content gets in — live from your Google Docs

Nothing about the game's content is hardcoded, and there's nothing to
edit or redeploy each week. A small server reads whichever Google Doc
you were most recently working in for a given class, live, every time a
student clicks Start (cached for 5 minutes so a class full of students
doesn't hammer the Drive API).

**Only specially tagged lines are ever pulled into the game.** Everything
else in your notes — freeform prose, other students' names, anything
private — is ignored completely. This means you can keep using the exact
same running lesson-notes doc you already write in; you just sprinkle in
a few tagged lines as you go.

### The tags

Drop these anywhere in your doc, one per line, mixed in with your normal
notes:

```
VOCAB: term | definition
MCQ: question | *correct option | wrong option | wrong option
GAPFILL: sentence with a ___ blank | accepted answer, another accepted answer
ERROR: incorrect sentence | corrected sentence | optional short note
WRITE: writing prompt | one possible sample answer
```

Real examples:

```
VOCAB: Assertive | Confident about what you want, without being rude
MCQ: Which word means so honest it can sound rude? | Tactful | *Blunt | Vague
GAPFILL: Someone who is blunt is honest in a way that can be ___. | rude, offensive
ERROR: My daughter has 14 years old. | My daughter is 14 years old. | Use "to be" with age, not "to have".
WRITE: Describe someone using 3 of this week's words. | My colleague is very straightforward but also quite tactful.
```

Notes on the format:

- Fields are separated by `|`.
- For `MCQ`, put a `*` in front of whichever option is correct.
- For `GAPFILL`, list one or more accepted answers separated by commas.
- Any line that isn't tagged, or a tagged line with the wrong number of
  fields, is just skipped — it will never break the rest of the doc.
- A handful of tagged lines a week (5–10) is plenty for a full game.

### How "this week" is chosen

Content is organized **per class, one Google Drive folder per class**,
containing the Google Docs for that class. Each time content is
requested:

- The **most recently edited** Doc in the folder is treated as **this
  week's material**.
- Every other Doc in that folder is pooled as the **course-wide** bank
  (the 10% mix-in).

So the natural workflow is: keep writing in whatever doc you're using for
today's lesson (tag a few lines as you go), and it automatically becomes
"this week" the moment it's the most recently saved file in that class's
folder — no separate step.

## One-time setup

You only need to do this once per class (not weekly).

### 1. Create a Google Cloud service account

This lets the server read your Docs without ever making them public.

1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
   and create a project (or use an existing one).
2. **APIs & Services → Library** → search for **Google Drive API** →
   **Enable**.
3. **APIs & Services → Credentials → Create Credentials → Service
   account**. Give it any name (e.g. "english-class-review").
4. Open the new service account → **Keys** tab → **Add Key → Create new
   key → JSON**. This downloads a `.json` file — keep it private, never
   commit it to this repo.
5. Copy the service account's **email address** (looks like
   `english-class-review@your-project.iam.gserviceaccount.com`).

### 2. Share your class folder(s) with it

For each class:

1. In Google Drive, create (or pick) a folder containing that class's
   Google Docs.
2. Share the folder with the service account's email address (just like
   sharing with a person) — **Viewer** access is enough.
3. Copy the folder's ID from its URL:
   `https://drive.google.com/drive/folders/`**`THIS_PART_IS_THE_ID`**

### 3. Deploy the server

**Render (recommended, free tier available):**

1. Push this repo to GitHub (already done if you're reading this there).
2. In Render, **New → Web Service**, connect this repo — it reads
   `render.yaml` automatically.
3. In the service's **Environment** settings, add:
   - `GOOGLE_CLIENT_EMAIL` — the service account's email
   - `GOOGLE_PRIVATE_KEY` — the `private_key` field from the downloaded
     JSON (keep the `\n` characters as literal text — most dashboards,
     including Render's, handle this fine when pasted as-is)
   - `CLASS_FOLDERS_JSON` — see below
4. Deploy. Render gives you a permanent URL — that's the link students
   use.

Alternatively, set `GOOGLE_SERVICE_ACCOUNT_JSON` to the entire downloaded
JSON file's contents as one line, instead of the two separate
`GOOGLE_CLIENT_EMAIL` / `GOOGLE_PRIVATE_KEY` variables.

**`CLASS_FOLDERS_JSON`** maps a URL-friendly slug to each class's folder:

```json
{
  "tuesday-beginners": { "name": "Tuesday Beginners", "folderId": "1AbC...xyz" },
  "thursday-business": { "name": "Thursday Business English", "folderId": "1XyZ...abc" }
}
```

With one class configured, students just go to your deployed URL and
click **Start**. With more than one, the home page automatically shows a
button per class (linking to `play.html?class=tuesday-beginners`, etc.).

## Running it locally

```bash
npm install
cp .env.example .env   # fill in your real credentials
npm start
```

Open `http://localhost:3000`. If `CLASS_FOLDERS_JSON` isn't set (or the
Drive credentials are wrong), the game automatically falls back to
built-in sample content in `js/content.js` — so you can always test the
game mechanics themselves without live Drive access. A small warning
appears on the start screen when this fallback kicks in, so you'll know
if something's misconfigured in production.

## Project structure

```
public/           Everything the browser loads directly
  index.html      Landing page (lists classes if more than one)
  play.html       The game itself
  css/style.css
  js/engine.js    Round sequencing, scoring — knows nothing about topics
  js/bird.js      The final flappy-bird-style challenge
  js/content.js   Fallback/demo content only (see above)
server/
  index.js        Express app: serves public/, exposes /api/content
  drive.js        Google Drive REST calls, authenticated as the service account
  parseContent.js Turns tagged lines into game content
  classes.js      Reads CLASS_FOLDERS_JSON
```

`engine.js` and `bird.js` never reference any specific topic or
vocabulary — they just consume whatever content object they're given.
That's what makes the weekly material fully dynamic: the exact questions
change constantly as your Docs change, without touching any code.
