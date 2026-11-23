# Question Bank

Manage exam questions without editing Google Sheets. Two pages:

- `index.html` — editor: add, edit, delete, filter by subject, upload an image.
- `quiz.html` — for the kid: pick a subject, answer random questions, see the score.

## Setup (once)

1. Create a project at supabase.com (free plan is enough).
2. SQL Editor → paste all of `schema.sql` → Run.
3. Authentication → Users → **Add user** (email + password, confirm it). This is the editor login.
4. Settings → **API Keys** (the old "Settings → API" page is gone). Copy **Project URL** from the top
   of that page and the **publishable key** (`sb_publishable_…`) into `src/config.js`.
   The secret key (`sb_secret_…`) never goes in this file — it bypasses row level security.
5. Serve the folder: `npm run serve` → http://localhost:5173.
   ES modules do not load from `file://`, so opening the HTML by double-click will not work.

## Day to day

- `index.html` — the editor. Multiple choice needs at least A and B, and the answer is the letter
  `A`–`D`. Short answer accepts free text, and `3 | tiga` accepts either spelling.
- `quiz.html` — 10 random questions. Queue size with `?limit=20`, a subject with `?subject=Math`.
- Images are uploaded to the public `question-images` bucket; the quiz shows them at full width.

## Import the old sheet

Export the sheet as CSV, rename the headers to the column names in `schema.sql`
(`subject, topic, type, prompt, option_a … answer, explanation`), then
Table editor → `questions` → Insert → Import data from CSV.

## Structure

```
src/domain     entities and rules (no I/O, no DOM)
src/data       Supabase: repository, auth, image storage
src/presentation  pages and styles
```

Three layers, no build step, no framework, no dependency to install.

## Checks

`npm run check` runs the domain assertions (validation and answer matching).

## Publish (GitHub Pages, free)

Pages on a free GitHub account needs a **public** repository. That is fine here:
the repository holds code only — the questions stay in Supabase.

1. Create a public repository on github.com, for example `question-bank`.
2. From this folder, point it at the new repository and push:

   ```
   git remote add origin https://github.com/<your-username>/<repo>.git
   git push -u origin main
   ```

3. Repository → Settings → Pages → Source: **Deploy from a branch** → `main` / `/ (root)` → Save.
4. After a minute: `https://<your-username>.github.io/<repo>/` and `/quiz.html`.
   Every path in the app is relative, so the subfolder URL works without changes.

### About the key in `config.js`

`config.js` is downloaded by the browser, so its content is public. The publishable key is
meant to be public; the guard is the row level security in `schema.sql` (anyone may read,
only a signed-in editor may write). Wrapping it in an env variable would not hide it either:
a static site has no server, and a build step would only inline the value into the same JS.
Never put the secret key (`sb_secret_…`) in this folder — it bypasses RLS.

## Free plan limits to know

- The project **pauses after 7 days without activity**; resume it from the dashboard (data is kept).
- No automatic backups: export the table to CSV now and then.
- The anon key is public, so anyone with the link can **read** questions (the quiz needs that).
  Writing requires a logged-in user, enforced by the row level security policies.
