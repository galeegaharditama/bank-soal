# Question Bank

A question bank for practice: `index.html` is the editor, `quiz.html` is for the student.
Questions live in Supabase instead of Google Sheets, and the app follows PRD *Bank Soal SD* v1:
one free flow (skip, back, number strip), corrections only at the end, 5/10/20 questions.

## Setup (once)

1. Create a project at supabase.com (free plan is enough).
2. SQL Editor → paste all of `schema.sql` → Run. The script is safe to run again; it recreates the
   policies and keeps the existing rows.
   Already ran an older version with different columns? Run `drop table if exists public.questions;`
   first, then this file again.
3. Authentication → Users → **Add user** (email + password, confirm it). This is the editor login.
   Then Authentication → **Sign In / Providers** → Email → disable *Allow new users to sign up*.
4. Settings → **API Keys** (the old "Settings → API" page is gone). Copy **Project URL** from the top
   of that page and the **publishable key** (`sb_publishable_…`) into `src/config.js`.
   The secret key (`sb_secret_…`) never goes in this file — it bypasses row level security.
5. Serve the folder: `npm run serve` → http://localhost:5173.
   ES modules do not load from `file://`, so opening the HTML by double-click will not work.

## Columns

The table uses English names. The editor, the quiz and the CSV import show the Indonesian PRD names;
`src/data/SupabaseQuestionRepository.js` and `src/data/csv.js` are the only places that translate.

| PRD / editor / CSV | Database |
| --- | --- |
| `id` | `id` |
| `mapel` | `subject` |
| `kelas` | `grade` (1–6) |
| `bab` | `chapter` |
| `tipe` | `type` (`pg` / `isian`) |
| `soal` | `prompt` |
| `gambar` | `image_path` |
| `opsi_a`…`opsi_d` | `option_a`…`option_d` |
| `jawaban` | `answer` |
| `pembahasan` | `explanation` |
| `aktif` | `active` |

Rules from PRD 6, enforced in `src/domain/Question.js`:

- `kelas` is 1–6, `tipe` is `pg` or `isian`.
- `pg` needs at least two options and `jawaban` must point to a filled option.
- `pembahasan` is required.
- A row saved with **Aktif** unchecked is a draft: it may be incomplete and never reaches the quiz.

## Editor (`index.html`)

Add, edit and delete questions, upload an image, filter by mapel and kelas. The status column shows
**Draf** or **Aktif**. Unchecked *Aktif* = draft, so half-written rows save without complaints.

## Quiz (`quiz.html`)

1. Pick mapel, kelas, bab and 5/10/20 questions. Empty filter → message instead of an empty screen.
2. One question per card. **Lanjut** without answering skips it, **Kembali** returns, the number strip
   jumps anywhere, and answers can change until **Selesai**. No right/wrong mark or explanation yet.
3. **Selesai** with open questions asks for confirmation and names the count.
4. Result: score, then the full review (your answer, key, explanation) plus
   **Ulangi semua**, **Ulangi yang salah**, **Ganti pilihan**.
5. The last 5 sessions stay on the device (localStorage, 20 kept). The header shows
   `Data per <date>` from the newest `updated_at`.

## Import many questions (CSV)

In the editor, **Impor CSV** → choose the file → **Periksa file**. Nothing is written until you press
**Impor N soal**, and every rejected row is listed with its line number and the reason.
`sample-import.csv` in this folder is a working example.

- Export the sheet as CSV: **File → Download → Comma-separated values** (Excel in Indonesian locale
  may save `;` instead of `,` — both work).
- Headers may be Indonesian (`mapel`, `kelas`, `soal`, …) or English (`subject`, `grade`, `prompt`, …).
  `mapel` and `soal` are required; `mapel, kelas, bab, tipe, soal, gambar, opsi_a…opsi_d, jawaban,
  pembahasan, aktif` is the full set. Common aliases (`Mata Pelajaran`, `Type`, `Answer`, …) work too.
- `tipe` accepts `pg` / `pilihan ganda` / `isian`. Unknown values reject the row.
- `aktif` accepts `ya`/`tidak` (`true`/`1` too). Missing column or blank cell means published.
- `gambar` may be an image URL from the sheet, or left empty.
- Rows are validated with the same PRD rules, so invalid rows never enter the database.

Re-importing the same file creates duplicates — there is no de-duplication by `id` yet, so delete the
previous batch in the editor first if you need to redo an import.

## Structure

```
src/domain     entities and rules (no I/O, no DOM)
src/data       Supabase repository, CSV import, auth, image storage, local session history
src/presentation  pages, DOM helpers, styles
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

## Not in this version

Offline use (service worker), the report-a-question button, and any server-side scoring are PRD
v1.1/v2 items and are not implemented here.

## Free plan limits to know

- **Turn off new user sign-ups** (step 3): the publishable key is public, so anyone could
  otherwise create an account, become `authenticated` and write through RLS.
- **Pauses after 7 days without activity**; resume it from the dashboard (data is kept).
- No automatic backups: export the table to CSV now and then.
- Anyone with the quiz link can read the questions, including the `answer` column (PRD 4.2 accepts
  this for self-practice).
