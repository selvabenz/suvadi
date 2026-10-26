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

## Font: Noto Sans Tamil

Google Noto fonts, SIL Open Font License 1.1. Two woff2 subsets (Tamil, Latin)
in `public/fonts/`.
