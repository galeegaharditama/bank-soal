# Question Bank

A question bank for practice: `index.html` is the editor, `quiz.html` is for the student.
Questions live in Supabase instead of Google Sheets, and the app follows PRD *Bank Soal SD* v1:
one free flow (skip, back, number strip), corrections only at the end, 5/10/20 questions.

## Setup (once)

1. Create a project at supabase.com (free plan is enough).
2. SQL Editor → paste all of `schema.sql` → Run. The script is safe to run again; it recreates the
   policies and keeps the existing rows.
   Coming from the older flat table (`subject`/`chapter` text columns)? **Export `questions` to CSV
   first**, then run `schema.sql`, then `migration-relations.sql` (it prints two counts that must both
   be 0), and finally `migration-drop-legacy.sql`.
3. Authentication → Users → **Add user** (email + password, confirm it). This is the editor login.
   Then Authentication → **Sign In / Providers** → Email → disable *Allow new users to sign up*.
4. Settings → **API Keys** (the old "Settings → API" page is gone). Copy **Project URL** from the top
   of that page and the **publishable key** (`sb_publishable_…`) into `src/config.js`.
   The secret key (`sb_secret_…`) never goes in this file — it bypasses row level security.
5. Serve the folder: `npm run serve` → http://localhost:5173.
   ES modules do not load from `file://`, so opening the HTML by double-click will not work.

## Data model

- `subjects` — mapel. `name` is unique case-insensitively.
- `chapters` — bab, one per mapel + kelas (`subject_id`, `grade`, `name`, unique per mapel+kelas).
- `questions` — soal; stores `subject_id`, `grade` and an optional `chapter_id`. A composite foreign
  key makes it impossible to point a kelas-3 question at a kelas-4 chapter.

The editor, the quiz and the CSV import speak Indonesian (`mapel, kelas, bab, tipe, soal, gambar,
opsi_a…d, jawaban, pembahasan, aktif`); the tables keep English column names and store ids instead of
copying names around. `src/data/SupabaseQuestionRepository.js` and `src/data/csv.js` translate.

Rules from PRD 6, enforced in `src/domain/Question.js`:

- `mapel` must exist (chosen from the list), `bab` is optional.
- `kelas` is 1–6, `tipe` is `pg` or `isian`.
- `pg` needs at least two options and `jawaban` must point to a filled option.
- `pembahasan` is required.
- A row saved with **Aktif** unchecked is a draft: it may be incomplete and never reaches the quiz.

## Mapel & Bab (`taxonomy.html`)

Rename once and every question follows, because questions point at ids.

- Add, rename or delete a mapel; add, rename or delete a bab per mapel + kelas.
- Deleting something still in use is refused with the count ("masih dipakai 12 soal") — move or delete
  those questions first.
- New mapel/bab can also be created by the CSV import (see below).

## Editor (`index.html`)

- **Mapel** and **Bab** are dropdowns. The bab list follows the chosen mapel + kelas and stays disabled
  until both are picked; **+ Mapel / Bab** lives on the taxonomy page.
- **Tambah soal** at the top opens the editor in a modal dialog; clicking a row (or **Edit**) opens
  the same dialog filled in, so the list keeps its filters and scroll position.
- Unsaved changes ask for confirmation on Esc, backdrop click, close or **Batal**.
- **Simpan & tambah lagi** keeps the dialog opening fresh for a typing session.
- The toolbar stays visible while scrolling: search by question text, filter by mapel/kelas.
- Each row has an **Aktif** switch (publish without opening the dialog), **Duplikat** (saves a copy as
  a draft) and **Hapus** with a 5-second **Urungkan** toast.
- Tick rows (or the header box) for bulk **Aktifkan / Nonaktifkan / Hapus**, also undoable.
- Below 760 px the list becomes cards instead of a table.
- Unchecked *Aktif* = draft, so half-written rows save without complaints.

## Quiz (`quiz.html`)

1. Pick mapel, kelas and one or more bab (tap the chapter chips), then how many questions: type a
   number, or tap 5/10/20. Asking for more than the bank holds is fine — everything available is used,
   and the line under the button says how many (`12 soal tersedia (8 pilihan ganda, 4 isian) — 12 akan
   dipakai`). Empty filter → message instead of an empty screen.
2. Multiple choice comes first, then written answers. 75% of the count (rounded) is taken from `pg`,
   the rest from `isian`; when one type runs out the other fills the gap, so 20 questions on a balanced
   bank is 15 `pg` + 5 `isian`. The share lives in `PG_SHARE` (`src/domain/selection.js`).
3. One question per card. **Lanjut** without answering skips it, **Kembali** returns, the number strip
   jumps anywhere, and answers can change until **Selesai**. No right/wrong mark or explanation yet.
4. **Selesai** with open questions asks for confirmation and names the count.
5. Result: score, then the full review (your answer, key, explanation) plus
   **Ulangi semua**, **Ulangi yang salah**, **Ganti pilihan**. Both retries keep the same questions,
   only reordered multiple choice first.
6. The last 5 sessions stay on the device (localStorage, 20 kept). The header shows
   `Data per <date>` from the newest `updated_at`.

## Import many questions (CSV)

In the editor, **Impor CSV** → **Unduh template** gives you a ready-to-fill file (header plus one
`pg` and one `isian` example, both saved as drafts). Then choose the file → **Periksa file**.
Nothing is written until you press **Impor N soal**, and every rejected row is listed with its line
number and the reason. `sample-import.csv` in this folder is another working example.

- Export the sheet as CSV: **File → Download → Comma-separated values** (Excel in Indonesian locale
  may save `;` instead of `,` — both work).
- Headers may be Indonesian (`mapel`, `kelas`, `soal`, …) or English (`subject`, `grade`, `prompt`, …).
  `mapel` and `soal` are required; `mapel, kelas, bab, tipe, soal, gambar, opsi_a…opsi_d, jawaban,
  pembahasan, aktif` is the full set. Common aliases (`Mata Pelajaran`, `Type`, `Answer`, …) work too.
- `tipe` accepts `pg` / `pilihan ganda` / `isian`. Unknown values reject the row.
- `aktif` accepts `ya`/`tidak` (`true`/`1` too). Missing column or blank cell means published.
- `gambar` may be an image URL from the sheet, or left empty.
- Mapel and bab that do not exist yet are **created automatically**, after the preview lists them
  ("Mapel baru akan dibuat: IPA. Bab baru akan dibuat: IPA kelas 3 · Wujud Benda.").
- Rows are validated with the same PRD rules, so invalid rows never enter the database.

Re-importing the same file creates duplicates — there is no de-duplication by `id` yet, so delete the
previous batch in the editor first if you need to redo an import.

## Structure

```
src/domain     entities and rules (no I/O, no DOM)
src/data       Supabase repositories (questions, mapel/bab), CSV import, auth, storage, local history
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
