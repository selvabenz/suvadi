# Rights and attributions

Each source keeps its own terms. Nothing here grants rights the sources do not.

## Scripture text: Indian Revised Version (IRV) Tamil

Source: 66 SFM files supplied by the maintainer (`D:\Claude Lab\IRV Tamil`),
produced by Bridge Connectivity Solutions. SHA-256 of each input file is
recorded in `public/data/manifest.json`.

**Licence: to be confirmed by the maintainer before public release.** The
derived JSON under `public/data/books/` is the same text, restructured, and
carries the same terms as the source. The reader attribution line is in
`src/lib/i18n.ts` (`attrIrv`).

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

## Project code

No licence has been chosen for the application code yet. Add one before
publishing the repository.
