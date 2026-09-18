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

Each class points at its content one of two ways — pick whichever matches
how you actually organize your Docs:

- **One doc per class** (`docId`) — the simplest option, and the right
  one if you keep a single running notes doc per class, adding to it
  lesson after lesson. That doc is always "this week's material." There's
  no separate course-wide bank unless you also list some older docs in
  `courseDocIds` (see below).
- **One folder per class** (`folderId`) — if instead you create a new
  Doc for each lesson, point at the folder that holds them all. The
  **most recently edited** Doc in the folder becomes "this week"; every
  other Doc in it is pooled as the **course-wide** bank (the 10% mix-in).

Either way, the natural workflow is the same: keep writing in your doc as
usual, tag a few lines as you go, and the game picks it up automatically
— no separate step, nothing to redeploy.

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

### 2. Share your class doc(s) or folder with it

For each class, depending on which mode you're using (see above):

- **Single doc**: open the Doc, share it with the service account's email
  address (just like sharing with a person) — **Viewer** access is
  enough. Copy the Doc's ID from its URL:
  `https://docs.google.com/document/d/`**`THIS_PART_IS_THE_ID`**`/edit`
- **Folder of docs**: share the whole folder with the service account
  instead (this covers every Doc inside it, including ones you add
  later). Copy the folder's ID from its URL:
  `https://drive.google.com/drive/folders/`**`THIS_PART_IS_THE_ID`**

### 3. List the class in `server/classes.json`

This file is committed to the repo (doc/folder IDs aren't secret — the
Drive API still requires the doc to actually be shared with the service
account before anything can be read). Add an entry per class, `docId` for
a single doc or `folderId` for a folder, and you can mix both styles:

```json
{
  "tuesday-beginners": { "name": "Tuesday Beginners", "docId": "1AbC...xyz" },
  "thursday-business": {
    "name": "Thursday Business English",
    "docId": "1XyZ...abc",
    "courseDocIds": ["1Older...one", "1Older...two"]
  },
  "friday-group": { "name": "Friday Group", "folderId": "1FolderId...123" }
}
```

`courseDocIds` is optional and only relevant in single-doc mode — list
past lessons' Doc IDs there if you want a course-wide 10% mix-in; leave
it out and the game just runs entirely on this week's doc.

If a particular class shouldn't be public in this repo (e.g. it would
name a specific student and the repo is public), skip adding it here and
set it via the `CLASS_FOLDERS_JSON` environment variable on Render
instead — same shape, and it overrides same-slug entries from the file.

With one class configured, students just go to your deployed URL and
click **Start**. With more than one, the home page automatically shows a
button per class (linking to `play.html?class=tuesday-beginners`, etc.).

### 4. Deploy the server

**Render (recommended, free tier available):**

1. Push this repo to GitHub (already done if you're reading this there).
2. In Render, **New → Web Service**, connect this repo — it reads
   `render.yaml` automatically.
3. In the service's **Environment** settings, add:
   - `GOOGLE_CLIENT_EMAIL` — the service account's email
   - `GOOGLE_PRIVATE_KEY` — the `private_key` field from the downloaded
     JSON (keep the `\n` characters as literal text — most dashboards,
     including Render's, handle this fine when pasted as-is)
4. Deploy. Render gives you a permanent URL — that's the link students
   use.

Alternatively, set `GOOGLE_SERVICE_ACCOUNT_JSON` to the entire downloaded
JSON file's contents as one line, instead of the two separate
`GOOGLE_CLIENT_EMAIL` / `GOOGLE_PRIVATE_KEY` variables.

## Adding a new class later

Because classes live in a committed file, adding one is just a small
code change — which means you don't have to do it by hand. In a Claude
Code session that has this repo and your Google Drive connected (like
the one that built this), you can just say something like:

> Add my Tuesday Beginners class — here's the doc:
> https://docs.google.com/document/d/.../edit

and it will look up the doc, add the entry to `server/classes.json`,
share-check reminders if needed, and push — Render redeploys
automatically (`autoDeploy: true` in `render.yaml`), live within a
minute or two. A plain claude.ai Project chat can't do this on its own
(it has no way to push code or redeploy), but a Claude Code session can,
since it has actual write access to this repository.

## Running it locally

```bash
npm install
cp .env.example .env   # fill in your real credentials
npm start
```

Open `http://localhost:3000`. If no classes are configured (or the Drive
credentials are wrong), the game automatically falls back to built-in
sample content in `public/js/content.js` — so you can always test the
game mechanics themselves without live Drive access. A small warning
appears on the start screen when this fallback kicks in, so you'll know
if something's misconfigured in production.

## Project structure

```
public/                 Everything the browser loads directly
  index.html            Landing page (lists classes if more than one)
  play.html             The game itself
  css/style.css
  js/engine.js          Round sequencing, scoring — knows nothing about topics
  js/bird.js            The final flappy-bird-style challenge
  js/content.js         Fallback/demo content only (see above)
server/
  index.js              Express app: serves public/, exposes /api/content
  drive.js              Google Drive REST calls, authenticated as the service account
  parseContent.js       Turns tagged lines into game content
  classes.js            Reads classes.json (+ optional CLASS_FOLDERS_JSON override)
  classes.json          Committed class → Doc/folder mapping (see above)
```

`engine.js` and `bird.js` never reference any specific topic or
vocabulary — they just consume whatever content object they're given.
That's what makes the weekly material fully dynamic: the exact questions
change constantly as your Docs change, without touching any code.
