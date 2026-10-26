#!/usr/bin/env python3
"""Build Suvadi's data files from one translation's USFM books and two open datasets.

Inputs (all read-only, never modified):
  --usfm    folder of 66 USFM/SFM books (one file per book, \\id first); --irv is an alias
  --xrefs   OpenBible.info cross_references.txt (CC BY 4.0), shared by every translation
  --step    STEPBible-Data "Translators Amalgamated OT+NT" folder (TAHOT + TAGNT, CC BY 4.0), shared

The translation is described on the command line: --id (folder name and the
value stored in the reader's settings), --lang, --name, --name-en, --abbr,
--publisher, --licence, --licence-url. The defaults describe the Tamil IRV.

Outputs under --out (default public/data):
  translations.json           the list of translations in the app (this one added or replaced)
  <id>/manifest.json          book list, book names, chapter/verse counts, licence, provenance
  <id>/books/<CODE>.json      one file per book: intro, headings, verses, footnotes, cross-refs
  xrefs/<CODE>.json           OpenBible cross-references for every verse of that book (shared)
  words/<CODE>/<ch>.json      STEP original-language words for one chapter (shared)

Run it once per translation. --xrefs and --step only need to be given once: the
shared files stay in place and later translations reuse them. Every translation
is expected to follow the English (NRSV) versification the shared data uses;
pass --no-study for one that does not, and the reader hides those sections.

Standard library only. Every file is read and written as UTF-8 explicitly: the
default Windows code page cannot represent Tamil, Hebrew or Greek.

The parser here is deliberately small. It handles exactly the marker set found in
the IRV files (see --inventory) and fails loudly on anything else, so a new
marker in a future revision is a visible error, not silently dropped text.
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import re
import shutil
import sys
import unicodedata
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
INTRO_MARKERS = {"is", "ip", "iot", "io1", "io"}
HEADER_MARKERS = {"id", "ide", "h", "toc1", "toc2", "toc3", "mt", "mt1", "usfm"}
# \qa is the acrostic letter of Psalm 119 (shown as a heading); \ms1 / \cl
# ("Book One", "Psalm") repeat what the chapter number already says: dropped.
# \s2 is a sub-heading and \sp a speaker (Song of Songs); both show as headings.
HEADING_MARKERS = {"s", "s1", "s2", "sp", "r", "ms", "ms1", "mr", "d", "qa"}
IGNORED_MARKERS = {"cl", "rem"}
TEXT_PARA_MARKERS = {"p", "m", "pi", "b", "nb", "q", "q1", "q2", "q3", "q4", "qr", "pm", "pmo", "pmc", "pi1"}
# How less common paragraph markers are styled: embedded openings/closings are prose.
PARA_STYLE = {"q1": "q", "q4": "q3", "pm": "m", "pmo": "m", "pmc": "m", "pi1": "pi"}
VERSE_MARKER = "v"
CHAPTER_MARKER = "c"
KNOWN_PARA = INTRO_MARKERS | HEADER_MARKERS | HEADING_MARKERS | TEXT_PARA_MARKERS | IGNORED_MARKERS | {VERSE_MARKER, CHAPTER_MARKER}

# Private-use sentinels left in the text by the aligned-USFM pre-pass and turned
# into offset ranges by extract_inline: {supplied words} and each aligned \w word.
SUP_OPEN, SUP_CLOSE = "\uE810", "\uE811"
WORD_OPEN, WORD_CLOSE = "\uE820", "\uE821"

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
_ANY_MARKER_RE = re.compile(r"\\\+?[a-z0-9]+\*?")
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
    parts = re.split(r"(\\(?:fr|fqa|fq|ft|fp|xo|xt)\*?)\s*", body)
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
            elif current == "fqa":
                # an alternative reading inside the note text: keep it, quoted
                out["text"] = (out["text"] + " \u201c" + piece.rstrip(".") + "\u201d" + ("." if piece.endswith(".") else "")).strip()
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

    Returns {text, wj: [[start,end],...], footnotes: [...], xrefs: [...],
    supplied: [[start,end],...], words: [[start,end],...]} — the last two only
    carry data for text that went through normalize_aligned_usfm.
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
    supplied: list[list[int]] = []
    sup_open: int | None = None
    words: list[list[int]] = []
    word_open: int | None = None
    for ch in s:
        o = ord(ch)
        if ch == SUP_OPEN:
            sup_open = len(out_chars)
            continue
        if ch == SUP_CLOSE:
            if sup_open is not None and len(out_chars) > sup_open:
                supplied.append([sup_open, len(out_chars)])
            sup_open = None
            continue
        if ch == WORD_OPEN:
            word_open = len(out_chars)
            continue
        if ch == WORD_CLOSE:
            # every aligned word keeps its range, even an empty one, so the
            # count always matches the alignment table
            words.append([word_open if word_open is not None else len(out_chars), len(out_chars)])
            word_open = None
            continue
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
        supplied = [[a - (a > i), b - (b > i)] for a, b in supplied]
        words = [[a - (a > i), b - (b > i)] for a, b in words]
    # Offsets may point one past a trailing space that clean_spaces kept; clamp.
    text_stripped = text.rstrip()
    if len(text_stripped) != len(text):
        n = len(text_stripped)
        for f in footnotes:
            f["pos"] = min(f["pos"], n)
        for x in xrefs:
            x["pos"] = min(x["pos"], n)
        wj = [[a, min(b, n)] for a, b in wj if a < n]
        supplied = [[a, min(b, n)] for a, b in supplied if a < n]
        words = [[min(a, n), min(b, n)] for a, b in words]
        text = text_stripped
    return {"text": text, "wj": wj, "footnotes": footnotes, "xrefs": xrefs, "supplied": supplied, "words": words}


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


_SENTINELS_RE = re.compile("[" + SUP_OPEN + SUP_CLOSE + WORD_OPEN + WORD_CLOSE + "]")


def plain(raw: str) -> str:
    """Text of a header/heading line: character styles and pre-pass sentinels removed."""
    return clean_spaces(_SENTINELS_RE.sub("", _STRIP_RE.sub(lambda mm: mm.group(1), raw)))


# ---------------------------------------------------------------------------
# Aligned USFM (unfoldingWord ULT): alignment moved to side data
# ---------------------------------------------------------------------------

_ZALN_S_RE = r"\\zaln-s\s*\|(?P<attrs>[^\\]*?)\\\*"
_ZALN_E_RE = r"\\zaln-e\\\*"
_W_RE = r"\\w\s+(?P<word>[^|\\]*?)(?:\|[^\\]*?)?\\w\*"
_ALIGN_TOKEN_RE = re.compile(
    "|".join([
        f"(?P<zs>{_ZALN_S_RE})",
        f"(?P<ze>{_ZALN_E_RE})",
        f"(?P<w>{_W_RE})",
        r"(?P<c>^\\c\s+(?P<cn>\d+))",
        r"(?P<v>\\v\s+(?P<vn>\d+))",
        r"(?P<d>^\\d\b)",
        r"(?P<brace>[{}])",
    ]),
    re.M,
)
_ATTR_RE = re.compile(r'(x-[a-z]+)="([^"]*)"')
# Paragraph markers that start a new line in the joined text (everything else
# that begins a line, such as \zaln-s, \w, \f, \qs, continues the line before).
_LINE_START_RE = re.compile(r"^\\(?:%s)(?:\s|$)" % "|".join(sorted(
    INTRO_MARKERS | HEADER_MARKERS | HEADING_MARKERS | TEXT_PARA_MARKERS | IGNORED_MARKERS | {"c", "v", "li1", "li2"},
    key=len, reverse=True)))
_PARA_V_RE = re.compile(r"^(\\(?:q\d?|p|m|pi\d?|pm|pmo|pmc|nb|li\d?))\s+(\\v\s)", re.M)


def _strip_alignment(line: str) -> str:
    """Remove \\zaln markers and keep the words of \\w tokens, as plain text."""
    line = re.sub(_ZALN_S_RE + "|" + _ZALN_E_RE, "", line)
    return re.sub(_W_RE, lambda m: m.group("word").strip(), line)


def strong_base(s: str) -> str:
    """One Strong's form across STEP and unfoldingWord: letter + 4 digits (see src/lib/study.ts)."""
    if not s:
        return ""
    s = re.sub(r"^(?:[a-z]+:)+", "", s.strip(), flags=re.I)
    m = re.search(r"([GH])(\d{1,4})(\d)?[A-Za-z]?$", s, re.I)
    if not m:
        return ""
    return m.group(1).upper() + m.group(2).zfill(4)


def normalize_aligned_usfm(text: str) -> tuple[str, dict]:
    r"""Strip unfoldingWord word alignment out of USFM, keeping it as side data.

    Returns (usfm, table). The USFM has each aligned \w word wrapped in the
    WORD_OPEN/WORD_CLOSE sentinels and {supplied} braces as SUP_OPEN/SUP_CLOSE,
    so extract_inline can turn them into offsets. table[(ch, key)] holds, per
    verse ("1", "2", ... and "0" for a Psalm title before verse 1):
      orig:  [[content, strong, morph, occurrence], ...]  unique per (content, occurrence)
      words: [[origIdx, ...], ...]   one entry per \w in document order
      lex:   {strong_base: lemma}
    """
    # 1. drop chunk milestones (wherever they sit); every \v starts a line
    #    (ZEC has "\p\v 6" and "\ts\*\v 8"); join continuation lines.
    text = re.sub(r"\\ts\\\*", "", text)
    text = re.sub(r"[ \t]*(\\v\s)", r"\n\1", text)
    lines: list[str] = []
    for line in text.splitlines():
        st = line.strip()
        if not st:
            continue
        if _LINE_START_RE.match(st) or not lines:
            lines.append(st)
        else:
            lines[-1] = lines[-1] + " " + st
    # A heading such as the acrostic letter (\qa SAMEKH) may carry an aligned
    # word; headings are shown as plain text, so their alignment is dropped.
    lines = [_strip_alignment(ln) if ln.startswith(("\\qa", "\\s", "\\ms", "\\cl", "\\mt", "\\h", "\\toc")) else ln for ln in lines]
    joined = _PARA_V_RE.sub(lambda m: m.group(1) + "\n" + m.group(2), "\n".join(lines))

    table: dict = {}
    out: list[str] = []
    ch = 0
    key: str | None = None
    stack: list[int] = []
    last = 0

    def entry() -> dict:
        k = (ch, key or "0")
        if k not in table:
            table[k] = {"orig": [], "index": {}, "words": [], "lex": {}}
        return table[k]

    for m in _ALIGN_TOKEN_RE.finditer(joined):
        kind = m.lastgroup
        if kind in ("zs", "ze", "w", "brace"):
            out.append(joined[last:m.start()])
        else:
            out.append(joined[last:m.end()])
        last = m.end()
        if m.group("c"):
            ch, key, stack = int(m.group("cn")), None, []
        elif m.group("v"):
            key, stack = m.group("vn"), []
        elif m.group("d"):
            if key is None:
                key = "0"
        elif m.group("zs"):
            a = dict(_ATTR_RE.findall(m.group("attrs")))
            e = entry()
            content = unicodedata.normalize("NFC", a.get("x-content", "")).replace("\u2060", "")
            occ = int(a.get("x-occurrence") or 1)
            ident = (content, occ)
            if ident not in e["index"]:
                e["index"][ident] = len(e["orig"])
                e["orig"].append([content, a.get("x-strong", ""), a.get("x-morph", ""), occ])
                base = strong_base(a.get("x-strong", ""))
                if base and a.get("x-lemma"):
                    e["lex"].setdefault(base, unicodedata.normalize("NFC", a["x-lemma"]))
            stack.append(e["index"][ident])
        elif m.group("ze"):
            if stack:
                stack.pop()
        elif m.group("w"):
            entry()["words"].append(list(stack))
            out.append(WORD_OPEN + m.group("word").strip() + WORD_CLOSE)
        elif m.group("brace"):
            out.append(SUP_OPEN if m.group("brace") == "{" else SUP_CLOSE)
    out.append(joined[last:])
    usfm = "".join(out)
    if re.search(r"\\(?:zaln-[se]|w\s)", usfm):
        raise UsfmError("alignment markup left after the pre-pass")
    for e in table.values():
        del e["index"]
    return usfm, table


def build_alignment(book: dict, table: dict) -> tuple[dict, int]:
    """Pair parsed verses' word ranges with the pre-pass table.

    Returns ({ch: {"lex": {...}, "<v>": {"o", "a", "d"?}, "0"?: {...}}}, mismatches).
    Spans are [start, end, [origIdx, ...]] into verse.text (or the title).
    """
    out: dict = {}
    bad = 0
    for chapter in book["chapters"]:
        c = chapter["n"]
        chap: dict = {"lex": {}}
        for v in chapter["verses"]:
            text_words = v.pop("_words", [])
            sup_words = v.pop("_sup_words", [])
            inline = v.pop("_sup_inline", False)
            if sup_words and not inline:
                t0 = table.get((c, "0"))
                if t0 and len(t0["words"]) == len(sup_words):
                    chap["0"] = {"o": t0["orig"], "a": [[s, e, w] for (s, e), w in zip(sup_words, t0["words"])]}
                    chap["lex"].update(t0["lex"])
                elif t0:
                    bad += 1
                sup_words = []
            t = table.get((c, str(v["n"])))
            if not t:
                continue
            words = t["words"]
            if len(words) != len(sup_words) + len(text_words):
                bad += 1
                continue
            entry = {"o": t["orig"], "a": [[s, e, w] for (s, e), w in zip(text_words, words[len(sup_words):])]}
            if sup_words:
                entry["d"] = [[s, e, w] for (s, e), w in zip(sup_words, words[:len(sup_words)])]
            chap[str(v["n"])] = entry
            chap["lex"].update(t["lex"])
        out[c] = chap
    return out, bad


# Character styles that only change the look (italic, bold italic,
# transliterated words): the text is kept, the markers are dropped.
_LOOK_ONLY_RE = re.compile(r"\\(?:it|bdit|bd|em|tl|sc)\*|\\(?:it|bdit|bd|em|tl|sc)\s")
# A verse or a poetry line that starts in the middle of a line (Punjabi IRV
# has "… text \v 5 more text" and "… \q next line").
_MIDLINE_V_RE = re.compile(r"[ \t]+(\\v\s)")
_MIDLINE_Q_RE = re.compile(r"(?<=\S)[ \t]+(\\q\d?\s)")


def normalize_usfm(text: str) -> str:
    """Put every \\v and \\q at the start of a line and drop look-only character styles."""
    text = re.sub(r"\\\+([a-z0-9]+\*?)", r"\\\1", text)  # nested markers (\+wj …\+wj*) read as plain ones
    text = _LOOK_ONLY_RE.sub("", text)
    text = re.sub(r"(?m)^[ \t]+(?=\\)", "", text)  # indented marker lines
    text = _MIDLINE_V_RE.sub(lambda m: "\n" + m.group(1), text)
    return _MIDLINE_Q_RE.sub(lambda m: "\n" + m.group(1), text)


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
        if data["supplied"]:
            verse["supplied"] = data["supplied"]
        verse["_words"] = data["words"]
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
        elif marker in IGNORED_MARKERS or marker == "usfm":
            continue
        elif marker in HEADER_MARKERS:
            book["names"]["mt" if marker == "mt1" else marker] = plain(rest)
        elif marker in INTRO_MARKERS:
            book["intro"].append({"kind": marker, "text": plain(rest)})
        elif marker == CHAPTER_MARKER:
            close_verse()
            num = int(rest.strip().split()[0])
            chapter = {"n": num, "verses": []}
            book["chapters"].append(chapter)
            pending_heading = {}
            current_style = "p"
        elif marker in HEADING_MARKERS:
            if marker in ("ms", "ms1", "mr"):
                continue  # "அத்தியாயம் N" / "சங்கீதம் N" / "Book One": the chapter number already says this
            if verse is not None and marker in ("s", "s1", "s2", "sp", "r", "qa"):
                close_verse()
            key = {"s": "heading", "s1": "heading", "s2": "heading", "sp": "heading", "qa": "heading",
                   "r": "parallel", "d": "superscription"}[marker]
            if marker == "d":
                sup = extract_inline(rest, book["code"], abbr_map)
                target = verse if verse is not None else pending_heading
                # a superscription after verse text (rare) is attached to that verse
                target["superscription"] = sup["text"]
                target["_sup_words"] = sup["words"]
                target["_sup_inline"] = verse is not None
            else:
                pending_heading[key] = plain(rest)
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
            if vtext.lstrip().startswith("\\d "):
                # a Psalm title inside verse 1 (aligned USFM): \v 1 \d Of David
                sup = extract_inline(vtext.lstrip()[3:], book["code"], abbr_map)
                verse["superscription"] = sup["text"]
                verse["_sup_words"] = sup["words"]
                verse["_sup_inline"] = True
                continue
            verse_raw.append((current_style, vtext))
        elif marker in TEXT_PARA_MARKERS:
            style = PARA_STYLE.get(marker, marker)
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
                pending_heading["lead"] = clean_spaces(pending_heading["lead"] + " " + plain(rest))
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


def translation_info(args, verse_count: int) -> dict:
    """The entry for translations.json; the manifest repeats it with the books added."""
    info = {
        "id": args.id,
        "lang": args.lang,
        "name": args.name,
        "nameEn": args.name_en,
        "abbr": args.abbr,
        "verseCount": verse_count,
    }
    if args.script:
        info["script"] = args.script
    if args.dir != "ltr":
        info["dir"] = args.dir
    if args.publisher:
        info["publisher"] = args.publisher
    if args.licence:
        info["licence"] = {"name": args.licence}
        if args.licence_url:
            info["licence"]["url"] = args.licence_url
    return info


def update_translations(out: Path, info: dict) -> list:
    """Add or replace this translation in translations.json, keeping the others' order."""
    path = out / "translations.json"
    entries: list = []
    if path.exists():
        with path.open(encoding="utf-8") as fh:
            entries = json.load(fh)
    entries = [e for e in entries if e.get("id") != info["id"]] + [info]
    dump(path, entries)
    return entries


def refresh_study_flags(out: Path) -> None:
    """Recompute which shared study data every listed translation can use.

    Run after any build, so a translation built earlier (the IRV) gains the
    Translation Notes flag without being re-parsed. A translation built with
    --no-study (other versification) keeps everything off.
    """
    has_xrefs = any((out / "xrefs").glob("*.json"))
    has_words = any((out / "words").glob("*/*.json"))
    has_notes = any((out / "tn").glob("*/*.json")) and (out / "tw" / "index.json").exists()
    path = out / "translations.json"
    if not path.exists():
        return
    entries = json.loads(path.read_text(encoding="utf-8"))
    for e in entries:
        mpath = out / e["id"] / "manifest.json"
        if not mpath.exists():
            continue
        manifest = json.loads(mpath.read_text(encoding="utf-8"))
        old = manifest.get("study") or {}
        off = old.get("off") is True
        study = {"xrefs": has_xrefs and not off, "words": has_words and not off, "notes": has_notes and not off}
        if off:
            study["off"] = True
        manifest["study"] = study
        e["study"] = study
        dump(mpath, manifest)
    dump(path, entries)


def draft_codes(usfm_dir: Path) -> tuple[set[str], str]:
    """Books taken from an unreleased commit, as recorded by tools/fetch_uw.py."""
    src = usfm_dir.parent / "SOURCES.json"
    if not src.exists():
        return set(), ""
    info = json.loads(src.read_text(encoding="utf-8")).get(usfm_dir.name, {})
    codes = {re.sub(r"^\d+-|\.usfm$", "", f).upper() for f in info.get("draftFiles", [])}
    return codes, info.get("draftRef", "")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--usfm", "--irv", dest="usfm", type=Path, default=Path(r"D:\Claude Lab\IRV Tamil"),
                    help="folder of 66 USFM/SFM books")
    ap.add_argument("--xrefs", type=Path, default=None, help="OpenBible cross_references.txt")
    ap.add_argument("--step", type=Path, default=None, help="STEPBible 'Translators Amalgamated OT+NT' folder")
    ap.add_argument("--out", type=Path, default=Path(__file__).resolve().parents[1] / "public" / "data")
    ap.add_argument("--inventory", action="store_true", help="print the marker inventory and exit")

    tr = ap.add_argument_group("translation")
    tr.add_argument("--id", default="ta-irv", help="folder name under data/, e.g. ta-irv, hi-irv")
    tr.add_argument("--lang", default="ta", help="BCP 47 tag of the Scripture text")
    tr.add_argument("--script", default="Taml", help="ISO 15924 script code ('' to omit)")
    tr.add_argument("--dir", default="ltr", choices=["ltr", "rtl"])
    tr.add_argument("--name", default="தமிழ் IRV", help="name in its own language")
    tr.add_argument("--name-en", default="Tamil IRV")
    tr.add_argument("--abbr", default="IRV", help="short label after a shared verse")
    tr.add_argument("--publisher", default="Bridge Connectivity Solutions")
    tr.add_argument("--licence", default="CC BY-SA 4.0")
    tr.add_argument("--licence-url", default="https://creativecommons.org/licenses/by-sa/4.0/")
    tr.add_argument("--no-study", action="store_true",
                    help="this text does not follow English versification: hide the shared xrefs/words")
    tr.add_argument("--attribution", default="", help="attribution sentence the licence asks for")
    tr.add_argument("--changes", default="", help="what was changed from the source (CC BY-SA)")
    tr.add_argument("--release", default="", help="source release, e.g. v91")

    uw = ap.add_argument_group("unfoldingWord helps (shared; need the aligned ULT in the same run)")
    uw.add_argument("--tn", type=Path, default=None, help="en_tn folder (tn_<BOOK>.tsv)")
    uw.add_argument("--twl", type=Path, default=None, help="en_twl folder (twl_<BOOK>.tsv)")
    uw.add_argument("--tw", type=Path, default=None, help="en_tw folder (bible/kt|names|other)")
    uw.add_argument("--ta", type=Path, default=None, help="en_ta folder (titles and articles the notes cite)")
    args = ap.parse_args(argv)

    if args.inventory:
        inventory(args.usfm)
        return 0

    all_files = sorted(args.usfm.glob("*.SFM")) + sorted(args.usfm.glob("*.usfm"))

    # Pass 1: book names, so cross-reference abbreviations can be resolved.
    # Files whose \id is not a canon book (front matter) are skipped.
    texts: dict[str, str] = {}
    abbr_map: dict[str, str] = {}
    files = []
    for f in all_files:
        t = f.read_text(encoding="utf-8-sig")
        code = re.search(r"^\\id (\S+)", t, re.M).group(1)[:3].upper()
        if code not in CANON:
            continue
        files.append(f)
        texts[code] = t
        for mk in ("toc3", "toc2", "h"):
            mm = re.search(r"^\\" + mk + r" (.*)$", t, re.M)
            if mm:
                abbr_map.setdefault(mm.group(1).strip().replace(" ", ""), code)
    missing = [c for c in CANON if c not in texts]
    if missing:
        print(f"books missing from {args.usfm}: {missing}", file=sys.stderr)
        return 2

    # Pass 2: parse.
    out = args.out
    tdir = out / args.id
    aligned = any("\\zaln-s" in t for t in texts.values())
    drafts, draft_ref = draft_codes(args.usfm)
    align: dict[str, dict] = {}
    if aligned and (tdir / "align").exists():
        shutil.rmtree(tdir / "align")
    books_meta = []
    total_verses = 0
    sample = ""
    unresolved = collections.Counter()
    for code in CANON:
        if aligned:
            usfm, table = normalize_aligned_usfm(texts[code])
            book = parse_book(usfm, abbr_map)
            book_align, bad = build_alignment(book, table)
            if bad:
                print(f"  {code}: {bad} verses without alignment (word counts differ)", file=sys.stderr)
            align[code] = book_align
            for ch, data in book_align.items():
                dump(tdir / "align" / code / f"{ch}.json", data)
        else:
            book = parse_book(normalize_usfm(texts[code]), abbr_map)
            for ch in book["chapters"]:
                for v in ch["verses"]:
                    for k in ("_words", "_sup_words", "_sup_inline"):
                        v.pop(k, None)
        if book["code"] != code:
            raise SystemExit(f"{code}: \\id says {book['code']}")
        chapters = [len(ch["verses"]) for ch in book["chapters"]]
        last_verse = [max((v.get("end", v["n"]) for v in ch["verses"]), default=0) for ch in book["chapters"]]
        total_verses += sum(chapters)
        if code == "GEN" and book["chapters"] and book["chapters"][0]["verses"]:
            sample = book["chapters"][0]["verses"][0]["text"].replace("\n", " ")
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
            **({"draft": True} if code in drafts else {}),
        })
        dump(tdir / "books" / f"{code}.json", {
            "code": code,
            "names": names,
            "intro": book["intro"],
            "chapters": book["chapters"],
        })
        print(f"  {code}: {len(chapters)} chapters, {sum(chapters)} verses", file=sys.stderr)
    if unresolved:
        print(f"  unresolved cross-reference book abbreviations: {dict(unresolved.most_common(20))}", file=sys.stderr)

    info = translation_info(args, total_verses)
    manifest = {
        "version": 2,
        **info,
        "books": books_meta,
        "sample": sample,
        "source": {
            "text": {
                "name": args.name_en,
                **({"attribution": args.attribution} if args.attribution else {}),
                **({"changes": args.changes} if args.changes else {}),
                **({"release": args.release} if args.release else {}),
                **({"aligned": True} if aligned else {}),
                "files": [{
                    "name": f.name,
                    "sha256": sha256_of(f),
                    **({"ref": draft_ref} if re.sub(r"^\d+-|\..*$", "", f.name).upper() in drafts and draft_ref else {}),
                } for f in files],
            }
        },
    }

    # OpenBible cross-references (shared between translations)
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

    # STEP Bible words (shared between translations)
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

    # unfoldingWord Translation Words / Academy / Words Links / Notes (shared)
    if args.tw or args.tn or args.twl:
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        import uw_study
        uw_study.CANON_SET = set(CANON)
        print("unfoldingWord helps:", file=sys.stderr)
        if (args.tn or args.twl) and not align:
            print("  (no aligned ULT in this run: notes are stored without word highlights)", file=sys.stderr)
        for sub in ("tn", "twl", "tw", "ta"):
            if getattr(args, sub) and (out / sub).exists():
                shutil.rmtree(out / sub)
        ta_titles: dict[str, str] = {}
        if args.tw:
            uw_study.build_tw(args.tw, out, dump)
        if args.ta and args.tn:
            ta_titles = uw_study.build_ta(args.ta, out, uw_study.ta_ids_in_notes(args.tn), dump)
        if args.twl:
            uw_study.build_twl(args.twl, out, align, dump)
        if args.tn:
            uw_study.build_tn(args.tn, out, align, ta_titles, dump)

    # Which shared study data this translation can use (refreshed for all below).
    manifest["study"] = {"off": True} if args.no_study else {}
    info["study"] = manifest["study"]

    dump(tdir / "manifest.json", manifest)
    entries = update_translations(out, info)
    refresh_study_flags(out)
    print(f"wrote {tdir} — {len(books_meta)} books, {total_verses} verses; "
          f"translations.json now lists {[e['id'] for e in entries]}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
