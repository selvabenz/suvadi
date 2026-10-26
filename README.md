# Suvadi · சுவடி

The Bible in Indian languages, one verse per screen. Swipe to the next verse,
open a short study on any verse, follow a reading plan, keep your place. Works
offline after the first visit and installs to the phone's home screen as a PWA
(Android and iPhone).

A *suvadi* (சுவடி) is a palm-leaf manuscript: Scripture in South India was read
from stacks of narrow leaves, one portion per leaf. This app reads the same way.

The first translation is the **Tamil Indian Revised Version (IRV)** from Bridge
Connectivity Solutions (CC BY-SA 4.0). The data layout is built for more
translations to be added beside it (see *Adding a translation*).

Live: <https://selvabenz.github.io/suvadi/> (published from `main` by GitHub Actions).

## What is on screen

| Tab | What it does |
|---|---|
| **வாசி / Read** | One verse per screen, vertical snap scroll. Section headings and Psalm titles appear above the verse they introduce. Words of Jesus in red (switchable). Footnote and cross-reference markers inline. Double-tap a verse to like it (red heart); long-press, or tap ⋯, for the icon-only study, bookmark, note and share menu. Swipe right for the next chapter, left for the previous one (or the arrow keys on a desktop). A verse-number rail on the left edge marks the current verse; tap a tick to jump. Tap with two fingers to share the verse on WhatsApp. Book introductions (the translation's own `\ip` paragraphs) are the first card of each book. |
| **Study sheet** | For the current verse: heading and parallel passage, the translation's footnotes and its own cross-references (tap to go), OpenBible.info related verses with a text preview, and the Hebrew/Greek words of the verse with transliteration, English gloss, Strong's number and morphology from STEP Bible. |
| **திட்டம் / Plan** | Four plans computed from the canon: whole Bible in a year, NT in 90 days, Psalms in 30, Gospels in 40. Per-day chapter ranges, mark done, days behind, reading streak. |
| **சேமித்தவை / Saved** | Bookmarks, liked verses and notes, stored only on the device. |
| **தேடு / Search** | A typed reference ("யோவா 3:16", "John 3:16") or a substring search over the whole Bible. |
| **அமைப்புகள் / Settings** | App language (Tamil or English UI), Bible translation (when more than one is shipped), theme (system, light, sepia, dark, black and white, Teen, Gen Z, Pastel), text size, text alignment (left, centre, right, justify), red letters, verse numbers, chapter:verse label, section headings, font (Meera Inimai, Mukta Malar, Pavanam, Lohit Tamil, Tiro Tamil), credits. | |

Everything the reader does stays in `localStorage` on the device. There is no
account, no server and no analytics.

## Layout

```
.github/workflows/deploy.yml   check + test + build on every push to main, publish dist/ to GitHub Pages
tools/build_data.py            USFM + OpenBible + STEP  ->  public/data/   (Python 3.12, stdlib only)
tools/uw_study.py              unfoldingWord Translation Notes / Words / Academy  ->  public/data/
tools/fetch_uw.py              one-time download of the unfoldingWord sources (ULT, tN, tWL, tW, tA)
tools/migrate_data.py          one-time move of a pre-Suvadi data folder into the per-translation layout
tools/tests/                   unit tests for the parser (python -m unittest discover -s tools/tests)
tools/make_icons.ps1           renders public/icons/icon.svg to PNG with headless Edge
public/data/translations.json  the translations in the app: id, language, names, licence
public/data/<id>/manifest.json book list, book names, chapter/verse counts, licence, source hashes
public/data/<id>/books/*.json  66 files per translation: intro, headings, verses, footnotes, cross-references
public/data/xrefs/*.json       66 files: OpenBible cross-references per verse (top 12 by votes), shared
public/data/words/*/*.json     1,189 files: STEP words per chapter (loaded on demand), shared
public/data/en-ult/align/      ULT word alignment per chapter: Hebrew/Greek tokens and English spans
public/data/tn/ twl/           Translation Notes and Words links per chapter, with ULT highlight spans, shared
public/data/tw/ ta/            Translation Words articles (953) and the Academy articles notes cite, shared
public/fonts/                  Meera Inimai (regular), OFL
src/lib/                       data loading, reference parsing, verse layout, plan builder, i18n, state
src/lib/components/            Feed, VerseCard, Picker, StudySheet, NoteSheet, PlanView, SavedView, SearchView, SettingsView
src/lib/__tests__/             Vitest tests for refs, plan and layout
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

Regenerate the data when a translation's text or a dataset changes:

```bash
python tools/build_data.py \
  --usfm "D:/Claude Lab/IRV Tamil" \
  --xrefs path/to/cross_references.txt \
  --step "D:/Claude Lab/STEPBible-Data-master/Translators Amalgamated OT+NT"
python -m unittest discover -s tools/tests -v
```

`--usfm` defaults to the path above and the translation flags default to the
Tamil IRV. Without `--xrefs` or `--step` the shared study files already in
`public/data/` are kept; if there are none, those sections are hidden.
Each `manifest.json` records the SHA-256 of every input file.

### The ULT and the unfoldingWord helps

```bash
python tools/fetch_uw.py --into "D:/Claude Lab/uW"     # v91 zips + 7 draft books, writes SOURCES.json
python tools/build_data.py --usfm "D:/Claude Lab/uW/en_ult" --id en-ult --lang en --script Latn \
  --name "Literal Text (ULT)" --name-en "Literal Text (ULT)" --abbr ULT --publisher "" \
  --licence "CC BY-SA 4.0" --licence-url https://creativecommons.org/licenses/by-sa/4.0/ \
  --attribution "The original work by unfoldingWord is available from unfoldingword.org/ult" \
  --changes "Word alignment moved to side files; milestones removed; {supplied} kept as offsets" --release v91 \
  --tn "D:/Claude Lab/uW/en_tn" --twl "D:/Claude Lab/uW/en_twl" --tw "D:/Claude Lab/uW/en_tw" --ta "D:/Claude Lab/uW/en_ta"
```

The ULT's word alignment (`\zaln-s … \w …\w* … \zaln-e\*`) is stripped into
`en-ult/align/`, and each Translation Note's or Words link's Hebrew/Greek quote
is resolved at build time to the English words it covers, so the reader can
highlight them without the original-language texts. Notes and Words apply to
every translation by reference; highlighting needs the ULT. The build then
refreshes the `study` flags of every translation in `translations.json`.

### Adding a translation

Run the build once more with the new text and its own identity. The shared
cross-references and words are reused, so `--xrefs` and `--step` are not needed
again:

```bash
python tools/build_data.py --usfm "path/to/IRV Hindi" \
  --id hi-irv --lang hi --script Deva \
  --name "हिन्दी IRV" --name-en "Hindi IRV" --abbr IRV \
  --publisher "Bridge Connectivity Solutions" --licence "CC BY-SA 4.0"
```

That writes `public/data/hi-irv/` and adds the entry to `translations.json`;
Settings then shows a translation picker. Bookmarks, notes, the reading place
and plan progress are verse references, so they carry across translations.
A text that does not follow the English (NRSV) versification the shared study
data uses should be built with `--no-study`.

What is still single-language: the UI strings (`src/lib/i18n.ts`, Tamil and
English), the bundled font (Meera Inimai; other scripts fall back to the
system font), and the typed-reference parser's English book names.

## ESV (online only)

The English Standard Version is © Crossway and is not bundled. The app reads it
from Crossway's ESV API (https://api.esv.org) one chapter at a time, keeps at
most 500 verses in memory and never writes ESV text to the device. It needs an
API key: set `VITE_ESV_API_KEY` at build time, or each reader pastes their own
key in Settings. The ESV copyright notice is shown in Settings > Credits, and
shared verses end with "(ESV)". Use is limited to Crossway's non-commercial API
terms.

## Deploy

Every push to `main` runs `.github/workflows/deploy.yml`: `npm ci`, `check`,
`test`, `build` with `BASE_PATH=/suvadi/`, then publishes `dist/` to GitHub
Pages. In the repository settings, *Pages → Build and deployment → Source* must
be **GitHub Actions** (once). A root domain needs a build with no `BASE_PATH`.

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
- **The translation's own cross-references are resolved by the book's `\toc3`
  abbreviations** (6,513 of 6,514 IRV Tamil targets resolve; the one left is a
  range across two books and is shown as text). Ranges across chapters and
  whole-chapter targets are kept.
- **OpenBible rows with zero or negative votes are dropped**, and each verse
  keeps its 12 most-voted targets.
- **STEP words**: NT words present in Nestlé-Aland are shown plainly; words only
  in the Traditional (TR) text are flagged `†`, since the IRV follows that
  tradition in places; words only in "other" editions are left out. OT words
  use the English (NRSV) versification column, which is the IRV's, and the root
  Strong's number rather than the prefix particle. Qere/Ketiv rows are flagged.
- **Study data is shared across translations** because it is keyed by English
  versification, not by any translation's wording. A translation's manifest
  says whether it can use it (`study.xrefs`, `study.words`).
- **Offline: the default translation is precached, the rest on demand.** The
  service worker precaches `translations.json` and the default translation's
  66 book files; another translation's books, and all study data, are cached
  the first time they are read.
- **Fonts are bundled, not fetched.** The app makes no network request outside
  its own origin.

## Verified

- `python -m unittest discover -s tools/tests`: 16 tests.
- Full data build on the 66 real IRV Tamil files: 1,189 chapters, 31,092 verse
  records (two are bridges: Luke 1:68-79, Revelation 12:17-18), 1,419
  footnotes, 3,414 cross-references.
- `npm run check`, `npm run test`, `npm run build`: run by the deploy workflow
  on every push.

## Open items

- The Tamil UI strings in `src/lib/i18n.ts` were written in one pass and need a
  native review.
- Search is a plain substring match; it does not normalise sandhi or spelling
  variants.
- Not tested on a physical phone yet. Checked in a desktop browser at phone
  width and with headless screenshots.
- Play Store / App Store packaging (a Trusted Web Activity wrapping the PWA) is
  the next release step after GitHub Pages.

## Licence

The application code is released under the GNU General Public License v3.0
(see `LICENSE`). The Scripture text and the other datasets keep their own
licences; `LICENSES.md` lists them.
