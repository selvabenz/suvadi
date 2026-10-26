# Tamil IRV Scroll

The Tamil IRV (Indian Revised Version) Bible, one verse per screen. Swipe to the
next verse, open a short study on any verse, follow a reading plan, keep your
place. Works offline after the first visit and installs to the phone's home
screen as a PWA (Android and iPhone).

Built 2026-10-26 as a new project, separate from Bridge, after a look at
[scrollingbible.com](https://scrollingbible.com/) (an unreleased English verse
feed app). Nothing is shared with Bridge except the source text.

## What is on screen

| Tab | What it does |
|---|---|
| **வாசி / Read** | One verse per screen, vertical snap scroll. Section headings and Psalm titles appear above the verse they introduce. Words of Jesus in red (switchable). Footnote and cross-reference markers inline. Study, bookmark, note and share on every verse. Book introductions (the IRV's own `\ip` paragraphs) are the first card of each book. |
| **Study sheet** | For the current verse: heading and parallel passage, the IRV's footnotes, the IRV's own cross-references (tap to go), OpenBible.info related verses with a text preview, and the Hebrew/Greek words of the verse with transliteration, English gloss, Strong's number and morphology from STEP Bible. |
| **திட்டம் / Plan** | Four plans computed from the canon: whole Bible in a year, NT in 90 days, Psalms in 30, Gospels in 40. Per-day chapter ranges, mark done, days behind, reading streak. |
| **சேமித்தவை / Saved** | Bookmarks and notes, stored only on the device. |
| **தேடு / Search** | A typed reference ("யோவா 3:16", "John 3:16") or a substring search over the whole Bible. |
| **அமைப்புகள் / Settings** | Tamil or English UI, light/sepia/dark/system theme, text size, red letters, verse numbers, credits. |

Everything the reader does stays in `localStorage` on the device. There is no
account, no server and no analytics.

## Layout

```
tools/build_data.py        SFM + OpenBible + STEP  ->  public/data/   (Python 3.12, stdlib only)
tools/tests/               unit tests for the parser (python -m unittest discover -s tools/tests)
tools/make_icons.ps1       renders public/icons/icon.svg to PNG with headless Edge
public/data/manifest.json  book list, Tamil names, chapter/verse counts, source hashes
public/data/books/*.json   66 files: intro, headings, verses, footnotes, IRV cross-references
public/data/xrefs/*.json   66 files: OpenBible cross-references per verse (top 12 by votes)
public/data/words/*/*.json 1,189 files: STEP words per chapter (loaded on demand)
public/fonts/              Noto Sans Tamil (variable), OFL
src/lib/                   data loading, reference parsing, verse layout, plan builder, i18n, state
src/lib/components/        Feed, VerseCard, Picker, StudySheet, NoteSheet, PlanView, SavedView, SearchView, SettingsView
src/lib/__tests__/         Vitest tests for refs, plan and layout
```

## Build and run

```bash
npm install
npm run check      # svelte-check
npm run test       # vitest
npm run build      # vite build -> dist/ (service worker included)
npm run preview    # serve dist/ locally
npm run dev        # dev server at http://localhost:5173
```

Regenerate the data when the IRV text or a dataset changes:

```bash
python tools/build_data.py \
  --irv  "D:/Claude Lab/IRV Tamil" \
  --xrefs path/to/cross_references.txt \
  --step "D:/Claude Lab/STEPBible-Data-master/Translators Amalgamated OT+NT"
python -m unittest discover -s tools/tests -v
```

`--irv` defaults to the path above. Without `--xrefs` or `--step` the
corresponding study sections are skipped and the app still works.
`manifest.json` records the SHA-256 of every input file.

Deploy to GitHub Pages as a project site with `BASE_PATH=/<repo>/ npm run build`
and publish `dist/`. For a root domain, build with no `BASE_PATH`.

## Data decisions

- **The parser is small and strict.** It handles exactly the markers found in
  the 66 IRV Tamil files (`\s \r \d \ms \p \m \pi \q \q1-3 \qr \b \is \ip \iot \io1`
  paragraph-level; `\f \x \wj \k \qs \ior` inline) and raises on anything else,
  so a new marker in a revised text is a visible error, not dropped text.
  `--inventory` prints the marker census.
- **Headings attach to the verse they introduce** (`\s` and `\r` go on the next
  `\v`), matching the IRV's own order on the page. `\ms` ("அத்தியாயம் N") is
  dropped because the chapter number already says it. `\d` Psalm titles are
  kept as a `superscription` on verse 1.
- **Offsets, not markup.** A verse is plain text plus character offsets for
  footnotes, cross-references and words-of-Jesus ranges. The UI never parses
  USFM.
- **IRV cross-references are resolved by the book's own `\toc3` abbreviations**
  (6,513 of 6,514 targets resolve; the one left is a range across two books and
  is shown as text). Ranges across chapters and whole-chapter targets are kept.
- **OpenBible rows with zero or negative votes are dropped**, and each verse
  keeps its 12 most-voted targets.
- **STEP words**: NT words present in Nestlé-Aland are shown plainly; words only
  in the Traditional (TR) text are flagged `†`, since the IRV follows that
  tradition in places; words only in "other" editions are left out. OT words
  use the English (NRSV) versification column, which is the IRV's, and the root
  Strong's number rather than the prefix particle. Qere/Ketiv rows are flagged.
- **Fonts are bundled, not fetched.** The app makes no network request outside
  its own origin.

## Verified

- `python -m unittest discover -s tools/tests`: 16 tests.
- Full data build on the 66 real IRV Tamil files: 1,189 chapters, 31,092 verse
  records (two are bridges: Luke 1:68-79, Revelation 12:17-18), 1,419
  footnotes, 3,414 cross-references.
- `npm run check`, `npm run test`, `npm run build`: see the latest commit
  message for the counts at that time.

## Open items

- The IRV Tamil licence line in Settings names Bridge Connectivity Solutions
  but states no licence. Confirm the exact licence and wording before public
  release (see `LICENSES.md`).
- The Tamil UI strings in `src/lib/i18n.ts` were written in one pass and need a
  native review.
- Search is a plain substring match; it does not normalise sandhi or spelling
  variants.
- Not tested on a physical phone yet. Checked in a desktop browser at phone
  width and with headless screenshots.
