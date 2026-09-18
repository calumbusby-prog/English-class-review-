# English Class Review

A quick, self-paced review game for private study. A student opens the
site, pastes the link to their class's Google Doc, and plays through:

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

**Vocabulary needs no special formatting at all.** The server scans the
doc for ordinary "Term — definition" style lines — the kind that already
show up naturally in a vocab list, like:

```
Assertive — confident, but not rude; you say clearly what you want
Blunt — so honest it can sound rude
```

— and turns them straight into vocabulary pairs, which power the
matching round, an auto-generated multiple-choice round ("What does
_Blunt_ mean?"), and the bird-game finale. No tags, no reformatting.

This extraction deliberately stays cautious: it only recognizes short,
dictionary-style definitions, and explicitly rejects lines that look
like a note about a specific person rather than a word's meaning (e.g.
"Alejandro - wants to improve his grammar" never gets pulled in, even
though it matches the same dash pattern). If a line doesn't get picked
up, it's just skipped — nothing about your notes is ever exposed beyond
what genuinely looks like vocabulary.

**Everything else — multiple choice, gap fill, error-spotting, writing
prompts — still needs explicit tags**, since those require a specific
right answer that can't be inferred from prose. Tag lines are also
skipped if malformed, and only tagged lines are ever read for those
categories — nothing freeform leaks through. A handful of tagged lines a
week (5–10) is enough for a full game; even zero is fine, since
vocabulary extraction alone already produces a matching round, an MCQ
round, and a bird-game finale on its own.

### The tags (optional — for anything beyond vocabulary)

Drop these anywhere in your doc, one per line, mixed in with your normal
notes, if you also want multiple choice, gap fill, error-spotting, or
writing prompts (or want to hand-write a VOCAB pair instead of relying on
extraction — a tagged `VOCAB:` line always takes priority over an
extracted one with the same term):

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

### The normal way in: paste the doc link, no setup per student

This is a private-study tool, so the primary flow doesn't involve
`classes.json` at all. The home page's main action is a text field —
whoever is playing (a student, on their own) pastes their class
document's link and hits **Start review**; that goes straight to
`play.html?doc=<link>`, which fetches and parses that doc on the spot.
Nothing to pre-configure, no accounts, no per-student setup — anyone
with the doc's link can use it immediately.

This still requires the doc to already be readable one of the ways
described below (publicly shared, or via a service account) — pasting a
link to a doc that isn't just fails with a clear error rather than
leaking anything.

`classes.json` (below) is an optional extra on top of this — useful if
you want a short, memorable link for a specific class instead of
everyone pasting the same long URL, but it's never required.

## One-time setup

None of this is required to use the paste-a-link flow above — the game
already tries a free, zero-setup method first. This section only matters
if that method turns out to be blocked (see below), or if you want named
class shortcuts. Deploying the server itself (next section) is the one
genuinely required step.

### 1. Get Google Drive credentials

**If your docs are shared "Anyone with the link can view"** (the normal
setup for a doc you hand students a link to) — just get an API key, no
sharing step needed at all:

1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
   and create a project (or use an existing one).
2. **APIs & Services → Library** → search for **Google Drive API** →
   **Enable**.
3. **APIs & Services → Credentials → Create Credentials → API key**.
4. (Recommended) Click the new key → under **API restrictions**, choose
   **Restrict key** → select **Google Drive API** only, so the key can't
   be used for anything else if it ever leaked.
5. Copy the key — this is your `GOOGLE_API_KEY`.

That's it — no key file, no sharing step, no private key to protect.

**If a doc should stay private instead** (not shared with anyone by
link), use a service account:

1. Same steps 1–2 above (project + Drive API enabled).
2. **APIs & Services → Credentials → Create Credentials → Service
   account**. Give it any name (e.g. "english-class-review").
3. Open it → **Keys** tab → **Add Key → Create new key → JSON**. This
   downloads a `.json` file — keep it private, never commit it here.
4. Copy the service account's **email address** (looks like
   `english-class-review@your-project.iam.gserviceaccount.com`), then
   share the specific doc or folder with that email (**Viewer** access
   is enough) — the one sharing step this path needs, since the doc
   itself stays otherwise private.

You can mix both: some classes on `GOOGLE_API_KEY` (public docs), others
covered by a service account (private ones) — `server/drive.js` tries
each available method automatically.

Either way, copy the Doc's ID from its URL:
`https://docs.google.com/document/d/`**`THIS_PART_IS_THE_ID`**`/edit`
(or a folder's ID from `https://drive.google.com/drive/folders/`**`THIS_PART`**).

### 2. (Optional) List a class in `server/classes.json`

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

### 3. Deploy the server

**Render (recommended, free tier available):**

1. Push this repo to GitHub (already done if you're reading this there).
2. In Render, **New → Web Service**, connect this repo — it reads
   `render.yaml` automatically.
3. Leave the Google credential env vars blank for now and deploy — try
   pasting a link on the live site first. Only come back and add
   whichever credentials you got in step 1 if you hit the "doc isn't
   publicly viewable" error:
   - `GOOGLE_API_KEY` — for public docs, or
   - `GOOGLE_CLIENT_EMAIL` + `GOOGLE_PRIVATE_KEY` (the `private_key`
     field from the downloaded JSON — keep the `\n` characters as literal
     text, most dashboards including Render's handle this fine pasted
     as-is) for private ones, or both if you have a mix.
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
  drive.js              Google Drive reads: public export, then API key, then service account
  parseContent.js       Vocab extraction + tagged-line parsing into game content
  classes.js            Reads classes.json (+ optional CLASS_FOLDERS_JSON override)
  classes.json          Committed class → Doc/folder mapping (see above)
```

`engine.js` and `bird.js` never reference any specific topic or
vocabulary — they just consume whatever content object they're given.
That's what makes the weekly material fully dynamic: the exact questions
change constantly as your Docs change, without touching any code.
