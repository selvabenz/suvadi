"""unfoldingWord study helps for Suvadi: Translation Notes, Translation Words,
Translation Words Links and Translation Academy, built into shared JSON.

Called from build_data.py (--tn --twl --tw --ta). Standard library only.
Never prints Hebrew or Greek (the Windows console is cp1252).

Outputs under public/data/:
  tn/<CODE>/<ch>.json     {"<v>": [{id, ta, q, occ, note, hl, hld, partial?, ref?}]}  ("0" = Psalm title)
  tn/<CODE>/intro.json    {"front": md, "<ch>": md}
  twl/<CODE>/<ch>.json    {"<v>": [[origWords, occ, slug, cat, strong, hl, hld], ...]}
  tw/<slug>.json          {slug, cat, title, body, see[], refs[[CODE,ch,v]], strongs[]}
  tw/index.json           {slug: [title, cat, [strongs]]}
  ta/<id>.json            {id, title, subtitle, body}
  ta/index.json           {id: [title, subtitle]}

hl / hld are character spans in the ULT verse text / its Psalm title where the
note's Hebrew or Greek quote is aligned; other translations show notes by verse.
"""
from __future__ import annotations

import csv
import re
import sys
import unicodedata
from pathlib import Path

csv.field_size_limit(1 << 26)

CANON_SET: set[str] = set()   # filled by build_data before use


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


# ---------------------------------------------------------------------------
# Tokens and references
# ---------------------------------------------------------------------------

def strong_base(s: str) -> str:
    """Letter + 4 digits: G23160 -> G2316, b:H7225 -> H7225, H1254a -> H1254 (see src/lib/study.ts)."""
    if not s:
        return ""
    s = re.sub(r"^(?:[a-z]+:)+", "", s.strip(), flags=re.I)
    m = re.search(r"([GH])(\d{1,4})(\d)?[A-Za-z]?$", s, re.I)
    if not m:
        return ""
    return m.group(1).upper() + m.group(2).zfill(4)


def norm_token(t: str) -> str:
    t = unicodedata.normalize("NFC", t).replace("⁠", "")
    return "".join(c for c in t if not unicodedata.category(c).startswith("P")).strip()


def skeleton(t: str) -> str:
    """The token without vowel points, accents or breathings, lower-cased."""
    d = unicodedata.normalize("NFD", norm_token(t))
    return "".join(c for c in d if unicodedata.category(c) != "Mn").lower()


def tokenize_quote(q: str) -> list[str]:
    """Quote words: ' & ' joins discontinuous parts; maqaf joins Hebrew words."""
    out: list[str] = []
    for seg in re.split(r"\s*&\s*", q or ""):
        for tok in re.split(r"[\s־]+", seg):
            tok = norm_token(tok)
            if tok:
                out.append(tok)
    return out


def parse_uw_ref(ref: str) -> tuple[str, str, str] | None:
    """'1:1' -> ('1','1',''); '1:1-2' -> ('1','1','1:1-2'); '3:front' -> ('3','0',''); intros -> ('front'|'N','intro','')."""
    ref = (ref or "").strip()
    m = re.match(r"^(front|\d+):(intro|front|\d+)", ref)
    if not m:
        return None
    ch, v = m.group(1), m.group(2)
    if v == "front":
        v = "0"
    raw = ref if ref != f"{m.group(1)}:{m.group(2)}" else ""
    return ch, v, raw


# ---------------------------------------------------------------------------
# Quote -> English span resolution (against the ULT alignment)
# ---------------------------------------------------------------------------

def _merge(spans: list[list[int]]) -> list[list[int]]:
    """Sort and merge spans that overlap or are one character apart (a space)."""
    out: list[list[int]] = []
    for s, e in sorted(spans):
        if out and s <= out[-1][1] + 1:
            out[-1][1] = max(out[-1][1], e)
        else:
            out.append([s, e])
    return out


def resolve_quote(entry: dict | None, quote: str, occurrence: int) -> dict | None:
    """Find the English words the original-language quote is aligned to.

    entry is one verse of the alignment: {"o": [[content, strong, morph, occ]], "a": [[s,e,[idx]]], "d"?: ...}.
    The match is a bag of tokens with their occurrence (alignment blocks are in
    English order, not original order). Returns {"hl", "hld", "partial", "idx"}
    or None when nothing could be placed (or occurrence is 0: a general note).
    """
    if not entry or occurrence == 0:
        return None
    tokens = tokenize_quote(quote)
    if not tokens:
        return None
    orig = entry["o"]
    exact = [norm_token(o[0]) for o in orig]
    loose = [skeleton(o[0]) for o in orig]
    spans = entry.get("a", []) + entry.get("d", [])
    first_pos: dict[int, int] = {}
    for s, _e, idxs in spans:
        for i in idxs:
            first_pos[i] = min(first_pos.get(i, s), s)

    def candidates(tok: str) -> list[int]:
        c = [i for i, x in enumerate(exact) if x == tok]
        if not c:
            sk = skeleton(tok)
            c = [i for i, x in enumerate(loose) if x == sk]
        return c

    chosen: list[int] = []
    unresolved = 0
    if occurrence < 0:
        for tok in tokens:
            c = candidates(tok)
            if not c:
                unresolved += 1
            chosen.extend(c)
    else:
        used: set[int] = set()
        prev_pos: int | None = None
        for k, tok in enumerate(tokens):
            c = [i for i in candidates(tok) if i not in used]
            if not c:
                unresolved += 1
                continue
            if k == 0:
                pick = next((i for i in c if orig[i][3] == occurrence), None)
                if pick is None:
                    if occurrence > 1:
                        unresolved += 1
                        continue
                    pick = min(c, key=lambda i: orig[i][3])
            elif len(c) == 1 or prev_pos is None:
                pick = c[0]
            else:
                pick = min(c, key=lambda i: abs(first_pos.get(i, 1 << 30) - prev_pos))
            used.add(pick)
            chosen.append(pick)
            if pick in first_pos:
                prev_pos = first_pos[pick]
    if not chosen:
        return None
    want = set(chosen)
    hl = _merge([[s, e] for s, e, idxs in entry.get("a", []) if want.intersection(idxs)])
    hld = _merge([[s, e] for s, e, idxs in entry.get("d", []) if want.intersection(idxs)])
    if not hl and not hld:
        return None
    return {"hl": hl, "hld": hld, "partial": unresolved > 0, "idx": sorted(want)}


# ---------------------------------------------------------------------------
# Link rewriting shared by tN, tW and tA
# ---------------------------------------------------------------------------

_TA_RC = r"rc://[^/\s)\]]+/ta/man/(?:translate|checking|process|intro)/([a-z0-9_-]+)"
_TW_RC = r"rc://[^/\s)\]]+/tw/dict/bible/(?:kt|names|other)/([a-z0-9_-]+)"


def rewrite_links(md: str, ta_titles: dict[str, str] | None = None) -> str:
    ta_titles = ta_titles or {}
    md = md.replace("\\n", "\n").replace("<br>", "\n").replace("<br/>", "\n")
    # [[rc://*/ta/man/translate/x]] -> [Title](ta:x)
    md = re.sub(r"\[\[" + _TA_RC + r"\]\]", lambda m: f"[{ta_titles.get(m.group(1), m.group(1))}](ta:{m.group(1)})", md)
    md = re.sub(r"\[\[" + _TW_RC + r"\]\]", lambda m: f"[{m.group(1)}](tw:{m.group(1)})", md)
    md = re.sub(r"\]\(" + _TA_RC + r"\)", lambda m: f"](ta:{m.group(1)})", md)
    md = re.sub(r"\]\(" + _TW_RC + r"\)", lambda m: f"](tw:{m.group(1)})", md)
    # relative tW / tA links inside articles
    md = re.sub(r"\]\(\.\./(?:kt|names|other)/([a-z0-9_-]+)\.md\)", r"](tw:\1)", md)
    md = re.sub(r"\]\(\.\./([a-z0-9_-]+)/01\.md\)", r"](ta:\1)", md)
    # links to other verses' notes or to unfamiliar targets: keep the text only
    md = re.sub(r"\[([^\]]+)\]\((?!https?:|tw:|ta:)[^)]*\)", r"\1", md)
    return md.strip()


# ---------------------------------------------------------------------------
# Translation Words
# ---------------------------------------------------------------------------

_REF_RC = re.compile(r"rc://[^/]+/tn/help/([a-z0-9]{3})/(\d+)/(\d+)")


def parse_tw_article(md: str, slug: str, cat: str) -> dict:
    title = ""
    sections: list[tuple[str, list[str]]] = []
    for line in md.replace("\r", "").split("\n"):
        if line.startswith("# ") and not title:
            title = line[2:].strip()
            continue
        h = re.match(r"^##\s+(.*?):?\s*$", line)
        if h:
            sections.append((h.group(1).strip(), []))
            continue
        if sections:
            sections[-1][1].append(line)
        elif line.strip():
            sections.append(("", [line]))
    body_parts: list[str] = []
    see: list[str] = []
    refs: list[list] = []
    strongs: list[str] = []
    for head, lines in sections:
        text = "\n".join(lines).strip()
        low = head.lower()
        if low.startswith("bible references"):
            for m in _REF_RC.finditer(text):
                code = m.group(1).upper()
                if code in CANON_SET:
                    refs.append([code, int(m.group(2)), int(m.group(3))])
            continue
        if low.startswith("word data"):
            for s in re.findall(r"\b[GH]\d{4,5}[a-zA-Z]?\b", text):
                b = strong_base(s)
                if b and b not in strongs:
                    strongs.append(b)
            continue
        if low.startswith("examples from the bible stories"):
            continue
        sa = re.search(r"\(See also:(.*?)\)\s*$", text, re.S)
        if sa:
            see += re.findall(r"\(\.\./(?:kt|names|other)/([a-z0-9_-]+)\.md\)", sa.group(1))
            text = text[:sa.start()].strip()
        if text:
            body_parts.append((f"## {head}\n\n" if head else "") + text)
    body = rewrite_links("\n\n".join(body_parts))
    return {"slug": slug, "cat": cat, "title": title or slug, "body": body,
            "see": list(dict.fromkeys(see)), "refs": refs, "strongs": strongs}


def build_tw(tw_dir: Path, out: Path, dump) -> dict:
    index: dict = {}
    for cat in ("kt", "names", "other"):
        for f in sorted((tw_dir / "bible" / cat).glob("*.md")):
            art = parse_tw_article(f.read_text(encoding="utf-8"), f.stem, cat)
            dump(out / "tw" / f"{f.stem}.json", art)
            index[f.stem] = [art["title"], cat, art["strongs"]]
    dump(out / "tw" / "index.json", dict(sorted(index.items())))
    log(f"  translation words: {len(index)} articles")
    return index


# ---------------------------------------------------------------------------
# Translation Academy (only the articles the notes refer to)
# ---------------------------------------------------------------------------

def ta_title(ta_dir: Path, art: str) -> tuple[str, str, Path | None]:
    for part in ("translate", "checking", "process", "intro"):
        d = ta_dir / part / art
        if d.is_dir():
            read = lambda n: (d / n).read_text(encoding="utf-8").strip() if (d / n).exists() else ""
            return read("title.md"), read("sub-title.md"), d
    return art, "", None


def build_ta(ta_dir: Path, out: Path, ids: set[str], dump) -> dict[str, str]:
    index: dict = {}
    for art in sorted(ids):
        title, sub, d = ta_title(ta_dir, art)
        if d is None:
            log(f"  translation academy: missing article {art}")
            continue
        body = rewrite_links((d / "01.md").read_text(encoding="utf-8") if (d / "01.md").exists() else "")
        dump(out / "ta" / f"{art}.json", {"id": art, "title": title, "subtitle": sub, "body": body})
        index[art] = [title, sub]
    dump(out / "ta" / "index.json", index)
    log(f"  translation academy: {len(index)} articles")
    return {k: v[0] for k, v in index.items()}


# ---------------------------------------------------------------------------
# TSV readers
# ---------------------------------------------------------------------------

def read_tsv(path: Path) -> list[dict]:
    with path.open(encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh, delimiter="\t", quoting=csv.QUOTE_NONE)
        return list(reader)


def book_files(folder: Path, prefix: str) -> dict[str, Path]:
    out = {}
    for f in folder.glob(f"{prefix}_*.tsv"):
        code = f.stem.split("_", 1)[1].upper()
        if code in CANON_SET:
            out[code] = f
    return out


def ta_ids_in_notes(tn_dir: Path) -> set[str]:
    ids: set[str] = set()
    for f in book_files(tn_dir, "tn").values():
        text = f.read_text(encoding="utf-8")
        ids.update(re.findall(_TA_RC, text))
    return ids


def _int(s: str) -> int:
    try:
        return int((s or "").strip())
    except ValueError:
        return 0


def build_twl(twl_dir: Path, out: Path, align: dict, dump) -> dict:
    stats = {"rows": 0, "placed": 0}
    for code, f in sorted(book_files(twl_dir, "twl").items()):
        chapters: dict[str, dict[str, list]] = {}
        book_align = align.get(code, {})
        for row in read_tsv(f):
            ref = parse_uw_ref(row.get("Reference", ""))
            link = re.search(r"/bible/(kt|names|other)/([a-z0-9_-]+)", row.get("TWLink", ""))
            if not ref or not link or ref[1] == "intro" or ref[0] == "front":
                continue
            ch, v, _raw = ref
            entry = book_align.get(int(ch), {}).get(v)
            occ = _int(row.get("Occurrence", "1")) or 1
            res = resolve_quote(entry, row.get("OrigWords", ""), occ)
            strong = ""
            if res and entry:
                strong = strong_base(entry["o"][res["idx"][0]][1])
                stats["placed"] += 1
            stats["rows"] += 1
            chapters.setdefault(ch, {}).setdefault(v, []).append([
                unicodedata.normalize("NFC", row.get("OrigWords", "")), occ, link.group(2), link.group(1), strong,
                res["hl"] if res else [], res["hld"] if res else [],
            ])
        for ch, verses in chapters.items():
            dump(out / "twl" / code / f"{ch}.json", verses)
    log(f"  translation words links: {stats['rows']} rows, {stats['placed']} placed on ULT words")
    return stats


def build_tn(tn_dir: Path, out: Path, align: dict, ta_titles: dict[str, str], dump) -> dict:
    stats = {"notes": 0, "placed": 0, "partial": 0, "intros": 0}
    for code, f in sorted(book_files(tn_dir, "tn").items()):
        chapters: dict[str, dict[str, list]] = {}
        intros: dict[str, str] = {}
        book_align = align.get(code, {})
        for row in read_tsv(f):
            ref = parse_uw_ref(row.get("Reference", ""))
            if not ref:
                continue
            ch, v, raw = ref
            note = rewrite_links(row.get("Note", ""), ta_titles)
            if v == "intro":
                intros[ch] = note
                stats["intros"] += 1
                continue
            if ch == "front":
                continue
            support = re.search(r"/([a-z0-9_-]+)\s*$", row.get("SupportReference", "") or "")
            occ = _int(row.get("Occurrence", ""))
            quote = unicodedata.normalize("NFC", row.get("Quote", "") or "")
            item = {"id": row.get("ID", ""), "ta": support.group(1) if support else "", "q": quote, "occ": occ, "note": note}
            res = resolve_quote(book_align.get(int(ch), {}).get(v), quote, occ)
            if res:
                item["hl"] = res["hl"]
                if res["hld"]:
                    item["hld"] = res["hld"]
                if res["partial"]:
                    item["partial"] = True
                    stats["partial"] += 1
                stats["placed"] += 1
            if raw:
                item["ref"] = raw
            stats["notes"] += 1
            chapters.setdefault(ch, {}).setdefault(v, []).append(item)
        for ch, verses in chapters.items():
            dump(out / "tn" / code / f"{ch}.json", verses)
        if intros:
            dump(out / "tn" / code / "intro.json", intros)
    log(f"  translation notes: {stats['notes']} notes ({stats['placed']} placed on ULT words, "
        f"{stats['partial']} partly), {stats['intros']} introductions")
    return stats
