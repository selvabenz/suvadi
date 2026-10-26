#!/usr/bin/env python3
"""One-time move of a data folder from the single-translation layout to Suvadi's.

Before (tamil-irv-scroll):          After (Suvadi):
  data/manifest.json                  data/translations.json
  data/books/*.json                   data/ta-irv/manifest.json
  data/xrefs/*.json                   data/ta-irv/books/*.json
  data/words/*/*.json                 data/xrefs/*.json      (unchanged, shared)
                                      data/words/*/*.json    (unchanged, shared)

Nothing is re-parsed: the book files are moved as they are and the manifest is
rewritten with the translation fields build_data.py now writes. Running it on
an already-migrated folder is a no-op. A full rebuild with
`python tools/build_data.py` gives the same result from the USFM sources.

    python tools/migrate_data.py            # public/data
    python tools/migrate_data.py --out path/to/data
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_data import dump, translation_info, update_translations  # noqa: E402


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", type=Path, default=Path(__file__).resolve().parents[1] / "public" / "data")
    ap.add_argument("--id", default="ta-irv")
    ap.add_argument("--lang", default="ta")
    ap.add_argument("--script", default="Taml")
    ap.add_argument("--dir", default="ltr", choices=["ltr", "rtl"])
    ap.add_argument("--name", default="தமிழ் IRV")
    ap.add_argument("--name-en", default="Tamil IRV")
    ap.add_argument("--abbr", default="IRV")
    ap.add_argument("--publisher", default="Bridge Connectivity Solutions")
    ap.add_argument("--licence", default="CC BY-SA 4.0")
    ap.add_argument("--licence-url", default="https://creativecommons.org/licenses/by-sa/4.0/")
    ap.add_argument("--no-study", action="store_true")
    args = ap.parse_args(argv)

    out: Path = args.out
    old_manifest = out / "manifest.json"
    old_books = out / "books"
    tdir = out / args.id

    if not old_manifest.exists() and not old_books.exists():
        print(f"nothing to migrate in {out} (already in the per-translation layout)", file=sys.stderr)
        return 0
    if (tdir / "manifest.json").exists():
        print(f"{tdir} already exists; refusing to overwrite it", file=sys.stderr)
        return 2

    with old_manifest.open(encoding="utf-8") as fh:
        old = json.load(fh)

    tdir.mkdir(parents=True, exist_ok=True)
    shutil.move(str(old_books), str(tdir / "books"))
    moved = sorted(p.name for p in (tdir / "books").glob("*.json"))

    sample = ""
    gen = tdir / "books" / "GEN.json"
    if gen.exists():
        with gen.open(encoding="utf-8") as fh:
            g = json.load(fh)
        if g.get("chapters") and g["chapters"][0].get("verses"):
            sample = g["chapters"][0]["verses"][0]["text"].replace("\n", " ")

    info = translation_info(args, int(old.get("verseCount", 0)))
    source = dict(old.get("source", {}))
    if "irv" in source and "text" not in source:
        source["text"] = source.pop("irv")
    has_xrefs = (out / "xrefs").is_dir() and any((out / "xrefs").glob("*.json"))
    has_words = (out / "words").is_dir() and any((out / "words").glob("*/*.json"))
    study = {"xrefs": has_xrefs and not args.no_study, "words": has_words and not args.no_study}
    info["study"] = study

    manifest = {
        "version": 2,
        **info,
        "books": old["books"],
        "sample": sample,
        "source": source,
        "study": study,
    }
    dump(tdir / "manifest.json", manifest)
    old_manifest.unlink()
    entries = update_translations(out, info)
    print(f"moved {len(moved)} book files to {tdir / 'books'}; wrote {tdir / 'manifest.json'}; "
          f"translations.json lists {[e['id'] for e in entries]}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
