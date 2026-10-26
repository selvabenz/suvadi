# Rights and attributions

Each source keeps its own terms. Nothing here grants rights the sources do not.

## Application code: GNU GPL v3.0

The Suvadi source code (everything outside `public/data/` and `public/fonts/`)
is released under the GNU General Public License, version 3 (`LICENSE`).
Copyright (C) 2026 Yesu Selva Benz.

## Scripture text: Indian Revised Version (IRV) Tamil

Source: 66 SFM files produced by Bridge Connectivity Solutions. SHA-256 of
each input file is recorded in `public/data/ta-irv/manifest.json`.

Licence: Creative Commons Attribution-ShareAlike 4.0 International
(https://creativecommons.org/licenses/by-sa/4.0/).
Attribution: "Indian Revised Version (IRV) Tamil, Bridge Connectivity Solutions, CC BY-SA 4.0."
The derived JSON under `public/data/ta-irv/books/` is the same text,
restructured, and carries the same terms as the source. The reader shows the
attribution in Settings, generated from the translation's manifest.

Every further translation added to `public/data/` must record its own licence
in its manifest (the `--licence` and `--licence-url` flags of
`tools/build_data.py`) and be listed in this file.

## Scripture text: Literal Text (ULT)

Source: the *unfoldingWord® Literal Text*, Copyright © 2026 by unfoldingWord,
release v91 (https://git.door43.org/unfoldingWord/en_ult). Seven books not yet
in that release (Numbers, 1 and 2 Chronicles, Ecclesiastes, Isaiah, Jeremiah,
Ezekiel) were taken from the master branch at commit
`0e7df04b8e81f0ec70bbe2b91bac5c464e42bb6f` and are marked as drafts in the app.
SHA-256 of each input file is recorded in `public/data/en-ult/manifest.json`.

Licence: Creative Commons Attribution-ShareAlike 4.0 International.
"The original work by unfoldingWord is available from unfoldingword.org/ult."

This is a derivative work, so, as the licence requires, the unfoldingWord®
trademark is not used in its name ("Literal Text (ULT)"). Changes made: the
word-alignment markup was moved out of the text into side files
(`public/data/en-ult/align/`); chunk milestones were removed; `{supplied}`
braces were removed from the text and kept as offsets; footnote alternative
readings are shown in quotation marks. The derived files carry the same licence.

## Translation Notes, Translation Words, Translation Academy (unfoldingWord)

Sources, all release v91 from https://git.door43.org/unfoldingWord, each
Copyright © 2026 by unfoldingWord and licensed CC BY-SA 4.0:

- Translation Notes `en_tn` ("The original work by unfoldingWord is available
  from unfoldingword.org/utn"), plus the seven draft books from master commit
  `a32ed25e56f62940ffc26c6ddf98e9a9e463827e`;
- Translation Words `en_tw` and Translation Words Links `en_twl` ("… available
  from unfoldingword.org/utw"), plus draft links from master commit
  `b558d3158465284506485042139d04addbf1769b`;
- Translation Academy `en_ta` ("… available from unfoldingword.org/uta"):
  only the articles the notes cite.

Derived files: `public/data/tn/`, `twl/`, `tw/`, `ta/`. Changes made: TSV and
Markdown converted to JSON per chapter; links rewritten to in-app links or
plain text; book and chapter introductions split into `intro.json`; the
"Examples from the Bible stories" sections of Translation Words dropped; each
note's Hebrew/Greek quote resolved to the English words of the ULT it is
aligned to. They carry the same licence; the attribution is shown in Settings.

## Cross-references: OpenBible.info

`cross_references.txt`, header `#www.openbible.info CC-BY 2026-10-19`.
Licence: Creative Commons Attribution 4.0 (https://creativecommons.org/licenses/by/4.0/).
Attribution: "Cross-reference data from OpenBible.info, CC BY."
Derived form: `public/data/xrefs/*.json` (rows with votes ≤ 0 dropped, top 12 per verse).

## Original-language words: STEP Bible TAHOT and TAGNT

Translators Amalgamated Hebrew OT and Greek NT, from
https://github.com/STEPBible/STEPBible-Data, created by Tyndale House Cambridge
and curated by STEPBible.org. Licence: CC BY 4.0. The data's own header asks
that users refer others to github.com/STEPBible as the source rather than
redistributing the raw files; this project ships a per-chapter subset
(`public/data/words/`) with the attribution in the Study sheet and in Settings.
Changes made: columns reduced to surface form, transliteration, gloss, Strong's,
morphology and a variant flag; words only in "Other" Greek editions omitted.

## Fonts (all SIL Open Font License 1.1)

The reader lets the user pick one of five Tamil typefaces (Settings > Font).
All are in `public/fonts/` as woff2; Meera Inimai is the default.

- **Meera Inimai**: Copyright 2012-2016 Hussain K.H, Santhosh Thottingal, Anilan
  NG, AKM Kutty, Swathanthra Malayalam Computing (http://smc.org.in). Two woff2
  subsets (Tamil, Latin) from Google Fonts.
- **Mukta Malar**: Copyright 2016 Ek Type (http://ektype.in). Tamil and Latin
  woff2 subsets from Google Fonts.
- **Pavanam**: Copyright 2016 Tharique Azeez (http://tharique.github.io/pavanam).
  Tamil and Latin woff2 subsets from Google Fonts.
- **Lohit Tamil** 2.91.3: Copyright 2006 Modular Infotech Pvt Ltd, 2009 Red Hat,
  Inc., 2011-2012 Lohit Fonts Project contributors (https://pagure.io/lohit).
  "Lohit" is a trademark of Red Hat, Inc. The TTF from Debian's
  `fonts-lohit-taml` package, converted whole to woff2.
- **Tiro Tamil**: Copyright 2020 Tiro Typeworks (https://tiro.com). Tamil and
  Latin woff2 subsets from Google Fonts.

## Software library: qrcode-generator

The QR code in "Show on a TV" is drawn with `qrcode-generator` by Kazuhiko
Arase (https://github.com/kazuhikoarase/qrcode-generator), MIT License.
