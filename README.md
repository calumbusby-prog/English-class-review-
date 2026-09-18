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
edit or redeploy each week. A small server reads a Google Doc live,
every time a student clicks Start (cached for 30 minutes so a class full
of students doesn't trigger repeat work).

### Claude reads the doc and writes the exercises (paid, best quality)

Set `ANTHROPIC_API_KEY` and the server hands your doc's raw text to
Claude, which:

1. **Finds the dated subheadings** in your notes (whatever format you
   already use — "16/9 - Topic", "### 17/9 - Topic", etc.) and works out
   which one is most recent.
2. **Builds "this week" from that section** — vocab, multiple choice,
   gap fill, error-correction, and a writing prompt, drawn from the
   actual material there.
3. **Builds a smaller "course" pool from your older sections**, for the
   10% mix-in.
4. **Writes answers that are actually correct.** Claude checks each
   question against the source material — this is what a regex-based
   parser fundamentally can't do, since it has no idea what a sentence
   *means*.

No tags, no reformatting, nothing to learn — it works on the exact
notes you already write, including a single doc with years of lessons
mixed together.

**Privacy:** your whole doc's text is sent to the Claude API to do this
— including any private notes about individual students. Claude is
explicitly instructed to output only generic teaching material (vocab,
grammar, generic example sentences) and never any student's name,
circumstances, or personal details, but the input itself isn't filtered
before sending. If that's a concern, use the free parser below instead,
which never sends your doc anywhere.

**Cost:** roughly a few cents per doc per generation (cached for 30
minutes), using Claude Opus 5 by default. Set `ANTHROPIC_MODEL` to a
cheaper model (e.g. `claude-haiku-4-5`) if cost matters more than
squeezing out the best possible questions.

### Gemini reads the doc and writes the exercises (free tier, no card)

If you don't want to pay for Claude, **Google's Gemini API has a
genuinely free, permanent tier** — no expiring trial, no credit card —
and does the same job: reads your doc, finds the most recent dated
section, and writes exercises with real answers instead of
regex-guessed ones. Quality is generally a notch behind Claude, but far
better than the plain parser below, and it costs nothing.

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
   and sign in with a Google account.
2. Click **Create API key** → **Create API key in new project** (or pick
   an existing Cloud project if you already have one).
3. Copy the key — this is your `GEMINI_API_KEY`. No further setup, no
   billing page, no card required for the free tier.
4. Set it as an environment variable (`.env` locally, or Render's
   dashboard when deployed — see below). That's it.

**Free tier limits** (current as of writing — Google can change these):
10 requests/minute, 500 requests/day on the default model
(`gemini-2.5-flash`). With this app's 30-minute cache per class, that's
roughly 48 possible regenerations a day *per class* at the absolute
maximum — far more than a real class needs. If you ever hit a rate
limit, the server automatically falls back to the plain parser for that
request rather than failing outright.

Same privacy note as Claude above: your doc's full text is sent to
Google's API to do this, with the same instruction to only output
generic teaching material and never a student's personal details — the
input itself isn't pre-filtered before sending.

Set `GEMINI_MODEL` to override the default model if Google renames or
retires `gemini-2.5-flash` in the future — check
[aistudio.google.com](https://aistudio.google.com/) for whichever model
is currently listed as free-tier.

If you set **both** `ANTHROPIC_API_KEY` and `GEMINI_API_KEY`, Claude is
tried first, falling back to Gemini only if that specific call fails
(not as a quality choice — just as a spare option).

### The regex-only fallback (zero setup, not just free)

Without either API key set, the server falls back to a plain,
rule-based parser instead — no external calls, nothing sent anywhere,
but noticeably less capable than either AI option above:

- **Vocabulary needs no special formatting.** It scans for ordinary
  "Term — definition" lines — the kind that already show up naturally in
  a vocab list, like `Assertive — confident, but not rude; you say
  clearly what you want` — and turns them into vocabulary pairs, which
  power the matching round, an auto-generated "What does X mean?"
  multiple-choice round, and the bird-game finale.
- It deliberately stays cautious about what counts as vocabulary,
  rejecting lines that look like a note about a specific person rather
  than a word's meaning (e.g. "Alejandro - wants to improve his grammar"
  never gets pulled in, even though it matches the same dash pattern), and
  ignores numbered/lettered exercise lines like "a) attach - tied down"
  entirely — those are often matching-exercise answer keys where the two
  sides are in an inconsistent order, and extracting them produced
  backwards, confusing pairs in practice. The tradeoff is fewer vocab
  pairs picked up per doc, in exchange for the ones it does find being
  ones you can trust.
- **Everything else — explicit multiple choice, gap fill,
  error-spotting, writing prompts — needs manual tags**, since a fixed
  parser has no way to invent a question with a guaranteed-correct
  answer from prose. See the cheat sheet below.
- It does find dated subheadings and scope "this week" to the most
  recent one, even within a single doc — see below for how, and its one
  real limitation (no year in "DD/MM" headers).

#### The tags

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

#### How "this week" is chosen (free parser)

The free parser also looks for dated subheadings — "16/9 - Topic",
"### 17/9 - Topic", and similar — anywhere across the doc(s) a class
points at, and scopes "this week" to just the section with the latest
date. Everything from older sections becomes the course-wide pool. This
also keeps multiple-choice distractors sensible: a wrong option is drawn
from the *same* lesson's vocabulary first, not a random word from a
different week, so "What does X mean?" doesn't get an obviously-unrelated
wrong answer.

One limitation worth knowing: "DD/MM" headers carry no year, so recency
is a same-year approximation (good for a doc actively being added to
within one teaching period; it can't perfectly order dates spanning a
year boundary). Claude or Gemini generation handles this properly,
reasoning about the actual current date.

If a doc has no dated subheadings at all, the whole thing is treated as
"this week" with no course-wide pool — same as before. Each class still
points at its source doc(s) one of two ways:

- **One doc per class** (`docId`) — typically a single running notes
  doc with many dated sections inside it, which is what the
  date-scoping above is built for. There's no separate course-wide pool
  from *other* docs unless you also list some in `courseDocIds` (see
  below) — but older dated sections within the same doc are still pooled
  automatically.
- **One folder per class** (`folderId`) — every Doc in the folder is
  read and section-split the same way; the single most recent dated
  section found across all of them becomes "this week."

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

The paste-a-link flow above works with zero setup — the game already
tries a free method first for both reading the doc and generating
content. This section only matters if you want an AI (Claude or the
free-tier Gemini) actually reading your docs instead of the plain
parser, if the free Drive method turns out to be blocked, or if you want
named class shortcuts. Deploying the server itself (last section) is the
one genuinely required step.

### 1. Get an AI content-generation key (Claude, Gemini, or skip both)

Pick one — or skip this step entirely and the server automatically
falls back to the free rule-based parser (see above), which just needs
`VOCAB:` / `MCQ:` / etc. tags to produce anything beyond vocabulary.

**Claude (paid):**

1. Go to [console.anthropic.com](https://console.anthropic.com/) and
   sign in or create an account.
2. **API Keys → Create Key**. Copy it — this is your
   `ANTHROPIC_API_KEY`.
3. Add billing details (Settings → Billing) — generation costs roughly a
   few cents per doc, cached for 30 minutes.

**Gemini (free, no card):**

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
   and sign in with a Google account.
2. **Create API key → Create API key in new project** (or pick an
   existing one).
3. Copy it — this is your `GEMINI_API_KEY`. Nothing else to set up; the
   free tier (500 requests/day as of writing) needs no billing page at
   all.

Setting both is fine too — Claude is tried first, Gemini only if that
call fails.

### 2. Get Google Drive credentials

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

### 3. (Optional) List a class in `server/classes.json`

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
3. Add `ANTHROPIC_API_KEY` and/or `GEMINI_API_KEY` now if you got one in
   step 1 — that's what turns on real content generation from the start.
   Leave the Google credential env vars blank for now and deploy — try
   pasting a link on the live site first. Only come back and add
   whichever credentials you got in step 2 if you hit the "doc isn't
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

Open `http://localhost:3000`. Without `ANTHROPIC_API_KEY` or
`GEMINI_API_KEY` set, content generation falls back to the free
tag/heuristic parser automatically — no error, just less capable output.
If no classes are configured (or the
Drive credentials are wrong too), the game falls back further to
built-in sample content in `public/js/content.js`, so you can always
test the game mechanics without any live access at all. A small warning
appears on the start screen when that deepest fallback kicks in, so
you'll know if something's misconfigured in production.

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
  generateContent.js    Claude-based content generation (when ANTHROPIC_API_KEY is set)
  generateContentGemini.js  Gemini-based content generation (when GEMINI_API_KEY is set)
  parseContent.js       Free fallback: vocab extraction + tagged-line parsing
  classes.js            Reads classes.json (+ optional CLASS_FOLDERS_JSON override)
  classes.json          Committed class → Doc/folder mapping (see above)
  docId.js              Extracts a Doc ID from a pasted link or bare ID
```

`engine.js` and `bird.js` never reference any specific topic or
vocabulary — they just consume whatever content object they're given.
That's what makes the weekly material fully dynamic: the exact questions
change constantly as your Docs change, without touching any code.
