#!/usr/bin/env python3
"""Build the app's data files from the Tamil IRV SFM books and two open datasets.

Inputs (all read-only, never modified):
  --irv     folder of 66 IRV Tamil USFM/SFM books (one file per book, \\id first)
  --xrefs   OpenBible.info cross_references.txt (CC BY 4.0)
  --step    STEPBible-Data "Translators Amalgamated OT+NT" folder (TAHOT + TAGNT, CC BY 4.0)

Outputs under --out (default public/data):
  manifest.json           book list, Tamil names, chapter/verse counts, provenance
  books/<CODE>.json       one file per book: intro, headings, verses, footnotes, IRV cross-refs
  xrefs/<CODE>.json       OpenBible cross-references for every verse of that book
  words/<CODE>/<ch>.json  STEP original-language words for one chapter (word, translit, gloss, Strong's, morph)

Standard library only. Every file is read and written as UTF-8 explicitly: the
default Windows code page cannot represent Tamil, Hebrew or Greek.

The parser here is deliberately small. It handles exactly the marker set found in
the IRV Tamil files (see --inventory) and fails loudly on anything else, so a
new marker in a future revision is a visible error, not silently dropped text.
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import re
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Canon
# ---------------------------------------------------------------------------

CANON = [
    "GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA", "1KI", "2KI",
    "1CH", "2CH", "EZR", "NEH", "EST", "JOB", "PSA", "PRO", "ECC", "SNG", "ISA", "JER",
    "LAM", "EZK", "DAN", "HOS", "JOL", "AMO", "OBA", "JON", "MIC", "NAM", "HAB", "ZEP",
    "HAG", "ZEC", "MAL",
    "MAT", "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH", "PHP", "COL",
    "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS", "1PE", "2PE", "1JN", "2JN",
    "3JN", "JUD", "REV",
]
NT_START = CANON.index("MAT")

# OpenBible.info uses OSIS-like abbreviations.
OSIS_TO_CODE = {
    "Gen": "GEN", "Exod": "EXO", "Lev": "LEV", "Num": "NUM", "Deut": "DEU", "Josh": "JOS",
    "Judg": "JDG", "Ruth": "RUT", "1Sam": "1SA", "2Sam": "2SA", "1Kgs": "1KI", "2Kgs": "2KI",
    "1Chr": "1CH", "2Chr": "2CH", "Ezra": "EZR", "Neh": "NEH", "Esth": "EST", "Job": "JOB",
    "Ps": "PSA", "Prov": "PRO", "Eccl": "ECC", "Song": "SNG", "Isa": "ISA", "Jer": "JER",
    "Lam": "LAM", "Ezek": "EZK", "Dan": "DAN", "Hos": "HOS", "Joel": "JOL", "Amos": "AMO",
    "Obad": "OBA", "Jonah": "JON", "Mic": "MIC", "Nah": "NAM", "Hab": "HAB", "Zeph": "ZEP",
    "Hag": "HAG", "Zech": "ZEC", "Mal": "MAL",
    "Matt": "MAT", "Mark": "MRK", "Luke": "LUK", "John": "JHN", "Acts": "ACT", "Rom": "ROM",
    "1Cor": "1CO", "2Cor": "2CO", "Gal": "GAL", "Eph": "EPH", "Phil": "PHP", "Col": "COL",
    "1Thess": "1TH", "2Thess": "2TH", "1Tim": "1TI", "2Tim": "2TI", "Titus": "TIT",
    "Phlm": "PHM", "Heb": "HEB", "Jas": "JAS", "1Pet": "1PE", "2Pet": "2PE", "1John": "1JN",
    "2John": "2JN", "3John": "3JN", "Jude": "JUD", "Rev": "REV",
}

# ---------------------------------------------------------------------------
# USFM parsing (the IRV Tamil marker set only)
# ---------------------------------------------------------------------------

# Paragraph-level markers the IRV files use, grouped by what the app does with them.
INTRO_MARKERS = {"is", "ip", "iot", "io1"}
HEADER_MARKERS = {"id", "ide", "h", "toc1", "toc2", "toc3", "mt"}
HEADING_MARKERS = {"s", "s1", "r", "ms", "d"}
TEXT_PARA_MARKERS = {"p", "m", "pi", "b", "nb", "q", "q1", "q2", "q3", "qr"}
VERSE_MARKER = "v"
CHAPTER_MARKER = "c"
KNOWN_PARA = INTRO_MARKERS | HEADER_MARKERS | HEADING_MARKERS | TEXT_PARA_MARKERS | {VERSE_MARKER, CHAPTER_MARKER}

# Inline (character-level) markers, with how each is handled.
#   footnote \f ... \f*  -> extracted into verse.footnotes, a marker index kept in text
#   cross-ref \x ... \x* -> extracted into verse.xrefs
#   \wj ... \wj*         -> kept as offset ranges (words of Jesus)
#   \k \qs \ior          -> the markers are removed, the text is kept
STRIP_INLINE = ("k", "qs", "ior")

_PARA_RE = re.compile(r"^\\([a-z0-9]+)(?:\s+|$)(.*)$")
_VERSE_RE = re.compile(r"^(\d+(?:-\d+)?[a-z]?)\s*(.*)$", re.S)
_NOTE_RE = re.compile(r"\\(f|x)\s+(\S+)\s+(.*?)\\\1\*", re.S)
_WJ_RE = re.compile(r"\\wj\s?(.*?)\\wj\*", re.S)
_STRIP_RE = re.compile(r"\\(?:%s)\s?(.*?)\\(?:%s)\*" % ("|".join(STRIP_INLINE), "|".join(STRIP_INLINE)), re.S)
_ANY_MARKER_RE = re.compile(r"\\[a-z0-9]+\*?")
_SPACE_RE = re.compile(r"[ \t]+")


class UsfmError(ValueError):
    pass


def clean_spaces(s: str) -> str:
    s = _SPACE_RE.sub(" ", s)
    s = re.sub(r" ?\n ?", "\n", s)
    return s.strip()


def parse_note(kind: str, body: str) -> dict:
    """Parse the body of a \\f or \\x note into its parts.

    Footnote parts: \\fr reference, \\fq quoted words, \\ft text, \\fp new paragraph.
    Cross-reference parts: \\xo origin reference, \\xt target text.
    """
    parts = re.split(r"(\\(?:fr|fq|ft|fp|xo|xt)\*?)\s*", body)
    out: dict = {"ref": "", "text": "", "quote": ""} if kind == "f" else {"ref": "", "targets": ""}
    current = None
    for piece in parts:
        if piece.startswith("\\"):
            tag = piece[1:].rstrip("*")
            if piece.endswith("*"):
                current = None
            else:
                current = tag
            continue
        piece = piece.strip()
        if not piece:
            continue
        if kind == "f":
            if current == "fr":
                out["ref"] = piece
            elif current == "fq":
                out["quote"] = (out["quote"] + " " + piece).strip()
            elif current in ("ft", "fp"):
                sep = "\n" if (current == "fp" and out["text"]) else " "
                out["text"] = (out["text"] + sep + piece).strip()
            elif current is None and not out["ref"]:
                # a note with no \fr: whole body is text
                out["text"] = (out["text"] + " " + piece).strip()
            else:
                out["text"] = (out["text"] + " " + piece).strip()
        else:
            if current == "xo":
                out["ref"] = piece
            elif current == "xt" or current is None:
                out["targets"] = (out["targets"] + " " + piece).strip()
    for k, v in list(out.items()):
        out[k] = clean_spaces(v)
    return out


def extract_inline(raw: str, book_code: str, abbr_map: dict[str, str]) -> dict:
    """Turn a verse's raw USFM text into plain text plus side data.

    Returns {text, wj: [[start,end],...], footnotes: [...], xrefs: [...]}.
    Footnote positions are character offsets into the plain text (where the
    caller sits); cross-reference positions likewise.
    """
    footnotes: list[dict] = []
    xrefs: list[dict] = []

    # 1. Pull notes out, leaving a private-use placeholder char per note so we
    #    can compute its offset after the other markers are stripped.
    placeholders: list[tuple[str, dict]] = []

    def _note(m: re.Match) -> str:
        kind, body = m.group(1), m.group(3)
        note = parse_note(kind, body)
        idx = len(placeholders)
        placeholders.append((kind, note))
        return chr(0xE000 + idx)

    s = _NOTE_RE.sub(_note, raw)

    # 2. Words of Jesus: replace with sentinel pairs, record later.
    s = _WJ_RE.sub(lambda m: "\uE800" + m.group(1) + "\uE801", s)

    # 3. Strip simple character styles, keeping their text.
    s = _STRIP_RE.sub(lambda m: m.group(1), s)

    leftover = _ANY_MARKER_RE.findall(s)
    if leftover:
        raise UsfmError(f"{book_code}: unhandled inline marker(s) {sorted(set(leftover))} in: {raw[:120]!r}")

    s = clean_spaces(s)

    # 4. Walk once to compute offsets and strip sentinels.
    out_chars: list[str] = []
    wj: list[list[int]] = []
    wj_open: int | None = None
    for ch in s:
        o = ord(ch)
        if 0xE000 <= o < 0xE800:
            kind, note = placeholders[o - 0xE000]
            pos = len(out_chars)
            if kind == "f":
                footnotes.append({"pos": pos, **note})
            else:
                targets_raw = note.get("targets", "")
                xrefs.append({
                    "pos": pos,
                    "ref": note.get("ref", ""),
                    "raw": targets_raw,
                    "targets": parse_tamil_targets(targets_raw, book_code, abbr_map),
                })
            continue
        if o == 0xE800:
            wj_open = len(out_chars)
            continue
        if o == 0xE801:
            if wj_open is not None and len(out_chars) > wj_open:
                wj.append([wj_open, len(out_chars)])
            wj_open = None
            continue
        out_chars.append(ch)
    if wj_open is not None and len(out_chars) > wj_open:
        wj.append([wj_open, len(out_chars)])

    text = "".join(out_chars)
    # A space left before a line break (it was separated from the newline by a
    # sentinel) is removed, and every offset after it shifts left by one.
    while True:
        i = text.find(" \n")
        if i < 0:
            break
        text = text[:i] + text[i + 1:]
        for f in footnotes:
            if f["pos"] > i:
                f["pos"] -= 1
        for x in xrefs:
            if x["pos"] > i:
                x["pos"] -= 1
        wj = [[a - (a > i), b - (b > i)] for a, b in wj]
    # Offsets may point one past a trailing space that clean_spaces kept; clamp.
    text_stripped = text.rstrip()
    if len(text_stripped) != len(text):
        n = len(text_stripped)
        for f in footnotes:
            f["pos"] = min(f["pos"], n)
        for x in xrefs:
            x["pos"] = min(x["pos"], n)
        wj = [[a, min(b, n)] for a, b in wj if a < n]
        text = text_stripped
    return {"text": text, "wj": wj, "footnotes": footnotes, "xrefs": xrefs}


# Tamil cross-reference targets look like "யாத் 30:7", "அப் 4:25,26", "ஏசா 63:1-6",
# "1நாளா 24:10", "ஏசா 15:1-16:14" (a range across chapters), "சங் 57" (a whole
# chapter), or a bare "136:1" / "142" (same book as the previous target), several
# separated by ";".
_TARGET_RE = re.compile(
    r"^(?P<book>(?:[1-3]\s?)?[^\d\s:][^\s:]*?)?\s*(?P<ch>\d+)(?::(?P<rest>[\d,\-–; :]+))?$"
)


def parse_tamil_targets(raw: str, book_code: str, abbr_map: dict[str, str]) -> list[dict]:
    """Resolve the text of a cross-reference target (``\\xt``) into verse targets.

    Each target is {book, ch, v} with optional vEnd (and chEnd for a range that
    crosses chapters), or {book, ch} for a whole chapter, or {raw} when the text
    could not be understood. Nothing is guessed: an unknown abbreviation stays raw.
    """
    targets: list[dict] = []
    if not raw:
        return targets
    last_book = book_code
    for piece in re.split(r"\s*;\s*", raw):
        piece = piece.strip().rstrip(".")
        if not piece:
            continue
        m = _TARGET_RE.match(piece)
        if not m:
            targets.append({"raw": piece})
            continue
        abbr = (m.group("book") or "").replace(" ", "")
        if abbr:
            code = abbr_map.get(abbr)
            if code is None:
                targets.append({"raw": piece})
                continue
            last_book = code
        ch = int(m.group("ch"))
        rest = (m.group("rest") or "").strip()
        if not rest:
            targets.append({"book": last_book, "ch": ch})
            continue
        for seg in re.split(r"\s*,\s*", rest):
            seg = seg.strip()
            if not seg:
                continue
            r = re.match(r"^(\d+)(?:[-–](?:(\d+):)?(\d+))?$", seg)
            if not r:
                targets.append({"raw": piece})
                continue
            t = {"book": last_book, "ch": ch, "v": int(r.group(1))}
            if r.group(3):
                t["vEnd"] = int(r.group(3))
                if r.group(2):
                    t["chEnd"] = int(r.group(2))
            targets.append(t)
    return targets


def parse_book(text: str, abbr_map: dict[str, str] | None = None) -> dict:
    """Parse one USFM book into the app's book shape."""
    lines = text.splitlines()
    book: dict = {"code": "", "names": {}, "intro": [], "chapters": []}
    abbr_map = abbr_map or {}

    chapter: dict | None = None
    verse: dict | None = None
    pending_heading: dict = {}       # \s / \r / \d collected before the next \v
    current_style = "p"              # paragraph style in force
    verse_raw: list[tuple[str, str]] = []  # (style, raw text chunk) for the open verse

    def close_verse():
        nonlocal verse, verse_raw
        if verse is None:
            return
        # join chunks: each chunk is a line of the verse; poetry lines break, prose joins
        lines_out: list[dict] = []
        for style, chunk in verse_raw:
            chunk = chunk.strip()
            if not chunk and style != "b":
                continue
            lines_out.append({"s": style, "raw": chunk})
        # Build plain text with "\n" between poetry lines, " " between prose lines.
        pieces: list[str] = []
        styles: list[str] = []
        for i, ln in enumerate(lines_out):
            if ln["s"] == "b":
                continue
            pieces.append(ln["raw"])
            styles.append(ln["s"])
        poetic = any(s.startswith("q") for s in styles)
        raw_joined = "\n".join(pieces) if poetic else " ".join(pieces)
        data = extract_inline(raw_joined, book["code"], abbr_map)
        verse["text"] = data["text"]
        if poetic:
            verse["styles"] = styles
        if data["wj"]:
            verse["wj"] = data["wj"]
        if data["footnotes"]:
            verse["footnotes"] = data["footnotes"]
        if data["xrefs"]:
            verse["xrefs"] = data["xrefs"]
        chapter["verses"].append(verse)
        verse = None
        verse_raw = []

    for lineno, line in enumerate(lines, 1):
        if not line.strip():
            continue
        m = _PARA_RE.match(line)
        if not m:
            # continuation text without a marker: belongs to the open verse
            if verse is not None:
                verse_raw.append((current_style, line))
                continue
            raise UsfmError(f"line {lineno}: text outside any verse: {line[:80]!r}")
        marker, rest = m.group(1), m.group(2)
        if marker not in KNOWN_PARA:
            raise UsfmError(f"line {lineno}: unknown paragraph marker \\{marker}")

        if marker == "id":
            book["code"] = rest.strip().split()[0][:3].upper()
        elif marker in HEADER_MARKERS:
            book["names"][marker] = clean_spaces(_STRIP_RE.sub(lambda mm: mm.group(1), rest))
        elif marker in INTRO_MARKERS:
            book["intro"].append({"kind": marker, "text": clean_spaces(_STRIP_RE.sub(lambda mm: mm.group(1), rest))})
        elif marker == CHAPTER_MARKER:
            close_verse()
            num = int(rest.strip().split()[0])
            chapter = {"n": num, "verses": []}
            book["chapters"].append(chapter)
            pending_heading = {}
            current_style = "p"
        elif marker in HEADING_MARKERS:
            if marker == "ms":
                continue  # "அத்தியாயம் N" / "சங்கீதம் N": the chapter number already says this
            if verse is not None and marker in ("s", "s1", "r"):
                close_verse()
            key = {"s": "heading", "s1": "heading", "r": "parallel", "d": "superscription"}[marker]
            val = clean_spaces(_STRIP_RE.sub(lambda mm: mm.group(1), rest))
            if marker == "d" and verse is not None:
                # a superscription after verse text (rare) is attached to that verse
                verse[key] = val
            else:
                pending_heading[key] = val
        elif marker == VERSE_MARKER:
            if chapter is None:
                raise UsfmError(f"line {lineno}: \\v before any \\c")
            close_verse()
            vm = _VERSE_RE.match(rest)
            if not vm:
                raise UsfmError(f"line {lineno}: bad verse: {line[:80]!r}")
            vid, vtext = vm.group(1), vm.group(2)
            first = int(re.match(r"\d+", vid).group(0))
            verse = {"n": first, "id": vid}
            bridge = re.match(r"^\d+-(\d+)", vid)
            if bridge:
                verse["end"] = int(bridge.group(1))
            if pending_heading:
                verse.update(pending_heading)
                pending_heading = {}
            verse_raw.append((current_style, vtext))
        elif marker in TEXT_PARA_MARKERS:
            style = "q" if marker == "q1" else marker
            if marker == "b":
                if verse is not None:
                    verse_raw.append(("b", ""))
                continue
            current_style = style
            if verse is not None:
                # text on the same line as the paragraph marker continues the verse
                verse_raw.append((style, rest))
            elif rest.strip():
                # text before the first verse of a chapter (rare); keep as a headingless lead
                pending_heading.setdefault("lead", "")
                pending_heading["lead"] = clean_spaces(pending_heading["lead"] + " " + _STRIP_RE.sub(lambda mm: mm.group(1), rest))
    close_verse()
    if not book["code"]:
        raise UsfmError("no \\id line")
    return book


# ---------------------------------------------------------------------------
# OpenBible cross-references
# ---------------------------------------------------------------------------

_OSIS_REF_RE = re.compile(r"^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)$")


def parse_osis(ref: str) -> tuple[str, int, int] | None:
    m = _OSIS_REF_RE.match(ref)
    if not m:
        return None
    code = OSIS_TO_CODE.get(m.group(1))
    if code is None:
        return None
    return code, int(m.group(2)), int(m.group(3))


def build_xrefs(path: Path, per_verse_limit: int = 12) -> dict[str, dict[str, list]]:
    """Return {book_code: {"ch:v": [[toCode, ch, v, vEnd|0, votes], ...]}}."""
    by_book: dict[str, dict[str, list]] = collections.defaultdict(dict)
    skipped = 0
    with path.open(encoding="utf-8") as fh:
        for i, line in enumerate(fh):
            if i == 0 and line.startswith("From Verse"):
                continue
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 3:
                continue
            src, dst, votes = parts[0], parts[1], parts[2]
            try:
                votes_n = int(votes)
            except ValueError:
                continue
            if votes_n <= 0:
                continue
            s = parse_osis(src)
            if s is None:
                skipped += 1
                continue
            if "-" in dst:
                a, b = dst.split("-", 1)
                da, db = parse_osis(a), parse_osis(b)
                if da is None or db is None or da[0] != db[0] or da[1] != db[1]:
                    skipped += 1
                    continue
                target = [da[0], da[1], da[2], db[2], votes_n]
            else:
                d = parse_osis(dst)
                if d is None:
                    skipped += 1
                    continue
                target = [d[0], d[1], d[2], 0, votes_n]
            key = f"{s[1]}:{s[2]}"
            by_book[s[0]].setdefault(key, []).append(target)
    for code, verses in by_book.items():
        for key, lst in verses.items():
            lst.sort(key=lambda t: -t[4])
            del lst[per_verse_limit:]
    if skipped:
        print(f"  xrefs: skipped {skipped} rows with unparseable references", file=sys.stderr)
    return by_book


# ---------------------------------------------------------------------------
# STEP Bible TAHOT / TAGNT
# ---------------------------------------------------------------------------

_STEP_REF_RE = re.compile(
    r"^(?P<book>[1-3]?[A-Z][a-z]{1,2})\.(?P<ch>\d+)\.(?P<v>\d+)"   # English (NRSV) reference
    r"(?:\[[^\]]*\]|\([^)]*\)|\{[^}]*\})*"                        # alternative versification, ignored
    r"#(?P<idx>\d+)=(?P<type>[^\t]*)$"
)


def _split_greek(cell: str) -> tuple[str, str]:
    m = re.match(r"^(.*?)\s*\(([^)]*)\)\s*$", cell)
    return (m.group(1), m.group(2)) if m else (cell, "")


def _first_strong(cell: str) -> str:
    m = re.search(r"[GH]\d{4}[A-Za-z]?", cell)
    return m.group(0) if m else ""


def iter_step_words(path: Path, testament: str):
    """Yield (code, ch, v, word) for each data row in one TAHOT/TAGNT file.

    word = [surface, transliteration, gloss, strongs, morphology, flag]
    flag: "" for the mainstream text, "k" for words only in the Traditional (TR/KJV)
    Greek, "q" for Hebrew Qere/Ketiv variants. Words found only in "Other" Greek
    editions (type O/o) are left out.
    """
    with path.open(encoding="utf-8-sig") as fh:
        for line in fh:
            cells = line.rstrip("\n").split("\t")
            m = _STEP_REF_RE.match(cells[0]) if cells and cells[0] else None
            if not m or len(cells) < 6:
                continue
            code = m.group("book").upper()
            if code not in CANON:
                continue
            ch, v = int(m.group("ch")), int(m.group("v"))
            wtype = m.group("type")
            if testament == "nt":
                letters = wtype.upper()
                if "N" not in letters and "K" not in letters:
                    continue  # O-only
                flag = "" if "N" in letters else "k"
                surface, translit = _split_greek(cells[1])
                gloss = cells[2]
                strong = _first_strong(cells[3])
                morph = cells[3].split("=", 1)[1] if "=" in cells[3] else ""
                word = [surface, translit, gloss, strong, morph, flag]
            else:
                flag = "q" if wtype.startswith("Q") else ""
                surface = cells[1].replace("/", "")
                translit = cells[2].replace("/", "")
                gloss = cells[3].replace("/ ", " ").replace("/", " ").strip()
                root = cells[8] if len(cells) > 8 else ""
                strong = _first_strong(root) or _first_strong(cells[4])
                morph = cells[5]
                word = [surface, translit, gloss, strong, morph, flag]
            yield code, ch, v, word


def build_words(step_dir: Path) -> dict[str, dict[int, dict[str, list]]]:
    """Return {code: {ch: {"v": [word, ...]}}}."""
    out: dict[str, dict[int, dict[str, list]]] = collections.defaultdict(lambda: collections.defaultdict(dict))
    files = sorted(step_dir.glob("TA*NT*.txt")) + sorted(step_dir.glob("TA*OT*.txt"))
    if not files:
        raise SystemExit(f"no TAHOT/TAGNT files in {step_dir}")
    for f in files:
        testament = "nt" if f.name.startswith("TAGNT") else "ot"
        n = 0
        for code, ch, v, word in iter_step_words(f, testament):
            out[code][ch].setdefault(str(v), []).append(word)
            n += 1
        print(f"  {f.name[:18]}: {n} words", file=sys.stderr)
    return out


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------

def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def dump(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as fh:
        json.dump(obj, fh, ensure_ascii=False, separators=(",", ":"))


def inventory(irv_dir: Path) -> None:
    para = collections.Counter()
    inline = collections.Counter()
    for f in sorted(irv_dir.glob("*.SFM")) + sorted(irv_dir.glob("*.usfm")):
        for line in f.read_text(encoding="utf-8-sig").splitlines():
            ms = re.findall(r"\\([a-z0-9]+\*?)", line)
            if ms:
                para[ms[0]] += 1
                for x in ms[1:]:
                    inline[x] += 1
    print("paragraph markers:", dict(para.most_common()))
    print("inline markers:", dict(inline.most_common()))


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--irv", type=Path, default=Path(r"D:\Claude Lab\IRV Tamil"))
    ap.add_argument("--xrefs", type=Path, default=None, help="OpenBible cross_references.txt")
    ap.add_argument("--step", type=Path, default=None, help="STEPBible 'Translators Amalgamated OT+NT' folder")
    ap.add_argument("--out", type=Path, default=Path(__file__).resolve().parents[1] / "public" / "data")
    ap.add_argument("--inventory", action="store_true", help="print the marker inventory and exit")
    args = ap.parse_args(argv)

    if args.inventory:
        inventory(args.irv)
        return 0

    files = sorted(args.irv.glob("*.SFM")) + sorted(args.irv.glob("*.usfm"))
    if len(files) != 66:
        print(f"expected 66 books in {args.irv}, found {len(files)}", file=sys.stderr)
        return 2

    # Pass 1: book names, so cross-reference abbreviations can be resolved.
    texts: dict[str, str] = {}
    abbr_map: dict[str, str] = {}
    for f in files:
        t = f.read_text(encoding="utf-8-sig")
        code = re.search(r"^\\id (\S+)", t, re.M).group(1)[:3].upper()
        texts[code] = t
        for mk in ("toc3", "toc2", "h"):
            mm = re.search(r"^\\" + mk + r" (.*)$", t, re.M)
            if mm:
                abbr_map.setdefault(mm.group(1).strip().replace(" ", ""), code)
    missing = [c for c in CANON if c not in texts]
    if missing:
        print(f"books missing from {args.irv}: {missing}", file=sys.stderr)
        return 2

    # Pass 2: parse.
    out = args.out
    books_meta = []
    total_verses = 0
    unresolved = collections.Counter()
    for code in CANON:
        book = parse_book(texts[code], abbr_map)
        if book["code"] != code:
            raise SystemExit(f"{code}: \\id says {book['code']}")
        chapters = [len(ch["verses"]) for ch in book["chapters"]]
        last_verse = [max((v.get("end", v["n"]) for v in ch["verses"]), default=0) for ch in book["chapters"]]
        total_verses += sum(chapters)
        for ch in book["chapters"]:
            for v in ch["verses"]:
                for x in v.get("xrefs", []):
                    for t in x["targets"]:
                        if "book" not in t:
                            unresolved[t["raw"].split(" ")[0]] += 1
        names = book["names"]
        books_meta.append({
            "code": code,
            "testament": "ot" if CANON.index(code) < NT_START else "nt",
            "name": names.get("toc2") or names.get("h") or code,
            "long": names.get("toc1") or names.get("mt") or "",
            "abbr": names.get("toc3") or "",
            "header": names.get("h") or "",
            "chapters": chapters,
            "lastVerse": last_verse,
        })
        dump(out / "books" / f"{code}.json", {
            "code": code,
            "names": names,
            "intro": book["intro"],
            "chapters": book["chapters"],
        })
        print(f"  {code}: {len(chapters)} chapters, {sum(chapters)} verses", file=sys.stderr)
    if unresolved:
        print(f"  unresolved cross-reference book abbreviations: {dict(unresolved.most_common(20))}", file=sys.stderr)

    manifest = {
        "version": 1,
        "title": {"ta": "தமிழ் IRV", "en": "Tamil IRV"},
        "books": books_meta,
        "verseCount": total_verses,
        "source": {
            "irv": {
                "name": "Indian Revised Version (IRV) Tamil",
                "files": [{"name": f.name, "sha256": sha256_of(f)} for f in files],
            }
        },
    }

    # OpenBible cross-references
    if args.xrefs and args.xrefs.exists():
        print("cross-references:", file=sys.stderr)
        xrefs = build_xrefs(args.xrefs)
        for code in CANON:
            dump(out / "xrefs" / f"{code}.json", xrefs.get(code, {}))
        header = args.xrefs.open(encoding="utf-8").readline().strip()
        manifest["source"]["openbible"] = {
            "name": "OpenBible.info cross references",
            "license": "CC BY 4.0",
            "url": "https://www.openbible.info/labs/cross-references/",
            "header": header,
            "sha256": sha256_of(args.xrefs),
        }
    else:
        print("  (no --xrefs given: skipping OpenBible cross-references)", file=sys.stderr)

    # STEP Bible words
    if args.step and args.step.exists():
        print("STEP Bible words:", file=sys.stderr)
        words = build_words(args.step)
        n_files = 0
        for code in CANON:
            for ch, verses in sorted(words.get(code, {}).items()):
                dump(out / "words" / code / f"{ch}.json", verses)
                n_files += 1
        manifest["source"]["step"] = {
            "name": "STEP Bible TAHOT and TAGNT (Translators Amalgamated Hebrew OT / Greek NT)",
            "license": "CC BY 4.0",
            "url": "https://github.com/STEPBible/STEPBible-Data",
            "files": [{"name": f.name, "sha256": sha256_of(f)} for f in sorted(args.step.glob("TA*.txt"))],
            "chapterFiles": n_files,
        }
    else:
        print("  (no --step given: skipping STEP Bible words)", file=sys.stderr)

    dump(out / "manifest.json", manifest)
    print(f"wrote {out} — {len(books_meta)} books, {total_verses} verses", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
