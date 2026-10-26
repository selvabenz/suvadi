#!/usr/bin/env python3
"""Download the unfoldingWord resources Suvadi builds from (one-time, outside the repo).

    python tools/fetch_uw.py --into "D:/Claude Lab/uW"

Fetches the release zips of en_ult, en_tn, en_twl, en_tw and en_ta at --tag
(default v91) from git.door43.org and unpacks each into <into>/<repo>/.
The v91 release of en_ult / en_tn / en_twl holds 59 books; the other seven
(NUM 1CH 2CH ECC ISA JER EZK) exist only on master, so they are fetched as
single files from a pinned master commit and marked as drafts.

Writes <into>/SOURCES.json (tag, zip SHA-256, draft commit and files) which
tools/build_data.py reads for provenance. Standard library only; when Python's
TLS check fails on this host, it falls back to curl (shipped with Windows 10+).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import ssl
import subprocess
import sys
import urllib.request
import zipfile
from pathlib import Path

HOST = "https://git.door43.org/unfoldingWord"
REPOS = ["en_ult", "en_tn", "en_twl", "en_tw", "en_ta"]
DRAFT_CODES = [("04", "NUM"), ("13", "1CH"), ("14", "2CH"), ("21", "ECC"), ("23", "ISA"), ("24", "JER"), ("26", "EZK")]
# master commits checked on 2026-10-26, when these seven books were aligned but unreleased
DRAFT_SHA = {
    "en_ult": "0e7df04b8e81f0ec70bbe2b91bac5c464e42bb6f",
    "en_tn": "a32ed25e56f62940ffc26c6ddf98e9a9e463827e",
    "en_twl": "b558d3158465284506485042139d04addbf1769b",
}


def draft_files(repo: str) -> list[str]:
    if repo == "en_ult":
        return [f"{n}-{c}.usfm" for n, c in DRAFT_CODES]
    if repo == "en_tn":
        return [f"tn_{c}.tsv" for _, c in DRAFT_CODES]
    if repo == "en_twl":
        return [f"twl_{c}.tsv" for _, c in DRAFT_CODES]
    return []


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def download(url: str, dest: Path, use_curl: bool, ca_bundle: str | None) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    part = dest.with_suffix(dest.suffix + ".part")
    if not use_curl:
        try:
            ctx = ssl.create_default_context(cafile=ca_bundle) if ca_bundle else None
            with urllib.request.urlopen(url, context=ctx, timeout=120) as r, part.open("wb") as fh:
                shutil.copyfileobj(r, fh)
            part.replace(dest)
            return dest
        except (ssl.SSLError, urllib.error.URLError) as e:
            if not isinstance(getattr(e, "reason", e), ssl.SSLError) and not isinstance(e, ssl.SSLError):
                raise
            log(f"  TLS check failed in Python ({e.__class__.__name__}); using curl")
    cmd = ["curl", "-fsSL", "--retry", "3", "-o", str(part), url]
    if ca_bundle:
        cmd[1:1] = ["--cacert", ca_bundle]
    subprocess.run(cmd, check=True)
    part.replace(dest)
    return dest


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def extract(zip_path: Path, into: Path, repo: str) -> Path:
    """Unpack the zip's single top folder as <into>/<repo>, refusing unsafe paths."""
    target = into / repo
    if target.exists():
        shutil.rmtree(target)
    tmp = into / f".{repo}.tmp"
    if tmp.exists():
        shutil.rmtree(tmp)
    with zipfile.ZipFile(zip_path) as z:
        for name in z.namelist():
            p = Path(name)
            if p.is_absolute() or ".." in p.parts:
                raise SystemExit(f"unsafe path in {zip_path.name}: {name}")
        z.extractall(tmp)
    tops = [p for p in tmp.iterdir()]
    src = tops[0] if len(tops) == 1 and tops[0].is_dir() else tmp
    shutil.move(str(src), str(target))
    if tmp.exists():
        shutil.rmtree(tmp)
    return target


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--into", type=Path, default=Path("D:/Claude Lab/uW"))
    ap.add_argument("--tag", default="v91")
    ap.add_argument("--curl", action="store_true", help="download with curl from the start")
    ap.add_argument("--ca-bundle", default=None)
    ap.add_argument("--force", action="store_true", help="download again even when the zip is present")
    args = ap.parse_args(argv)

    into: Path = args.into
    into.mkdir(parents=True, exist_ok=True)
    zips = into / "_zips"
    sources: dict = {}
    for repo in REPOS:
        zp = zips / f"{repo}-{args.tag}.zip"
        if args.force or not zp.exists():
            log(f"{repo}: downloading {args.tag}")
            download(f"{HOST}/{repo}/archive/{args.tag}.zip", zp, args.curl, args.ca_bundle)
        log(f"{repo}: extracting")
        folder = extract(zp, into, repo)
        entry = {"tag": args.tag, "zipSha256": sha256(zp)}
        files = draft_files(repo)
        if files:
            sha = DRAFT_SHA[repo]
            for f in files:
                log(f"{repo}: draft {f} @ {sha[:8]}")
                download(f"{HOST}/{repo}/raw/commit/{sha}/{f}", folder / f, args.curl, args.ca_bundle)
            entry.update({"draftRef": sha, "draftFiles": files})
        sources[repo] = entry
    (into / "SOURCES.json").write_text(json.dumps(sources, indent=2), encoding="utf-8")
    log(f"done: {into}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
