"""Tests for the aligned-USFM (ULT) path and the unfoldingWord helps builders.

Run: python -m unittest discover -s tools/tests -v
Fixtures are small inline USFM/TSV/Markdown strings; no network.
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import build_data as b  # noqa: E402
import uw_study as u  # noqa: E402

u.CANON_SET = set(b.CANON)


def zs(content: str, strong: str, occ: int = 1, lemma: str = "x") -> str:
    return (f'\\zaln-s |x-strong="{strong}" x-lemma="{lemma}" x-morph="Gr,N" '
            f'x-occurrence="{occ}" x-occurrences="{occ}" x-content="{content}"\\*')


def w(word: str) -> str:
    return f'\\w {word}|x-occurrence="1" x-occurrences="1"\\w*'


ZE = "\\zaln-e\\*"


def parse(usfm: str):
    text, table = b.normalize_aligned_usfm(usfm)
    book = b.parse_book(text, {})
    al, bad = b.build_alignment(book, table)
    return book, al, bad


HEAD = "\\id TIT EN_ULT\n\\usfm 3.0\n\\h Titus\n\\mt1 Titus\n\n\\ts\\*\n\\c 1\n"


class AlignedUsfm(unittest.TestCase):
    def test_text_spans_and_nesting(self):
        usfm = HEAD + "\\p\n\\v 1 " + "\n".join([
            zs("A", "G00010") + w("In") + ZE,
            zs("B", "G00020") + zs("C", "G00030") + w("the") + "\n" + w("heavens") + ZE + ZE + ",",
            zs("D", "G00040") + w("God") + ZE + ".",
        ])
        book, al, bad = parse(usfm)
        v = book["chapters"][0]["verses"][0]
        self.assertEqual(v["text"], "In the heavens, God.")
        self.assertEqual(bad, 0)
        a = al[1]["1"]["a"]
        self.assertEqual([v["text"][s:e] for s, e, _ in a], ["In", "the", "heavens", "God"])
        # nested zaln: "the" and "heavens" are aligned to both B and C
        self.assertEqual(a[1][2], [1, 2])
        self.assertEqual(a[2][2], [1, 2])
        self.assertNotIn("_words", v)

    def test_same_orig_twice_is_one_token(self):
        usfm = HEAD + "\\p\n\\v 1 " + zs("X", "G00050") + w("of") + ZE + " " + w("the") + " " + zs("X", "G00050") + w("chosen") + ZE
        _, al, _ = parse(usfm)
        self.assertEqual(len(al[1]["1"]["o"]), 1)
        self.assertEqual([x[2] for x in al[1]["1"]["a"]], [[0], [], [0]])

    def test_supplied_braces_become_offsets(self):
        usfm = HEAD + "\\p\n\\v 1 " + w("darkness") + " {" + w("was") + "} " + w("over")
        book, _, _ = parse(usfm)
        v = book["chapters"][0]["verses"][0]
        self.assertEqual(v["text"], "darkness was over")
        self.assertEqual(v["supplied"], [[9, 12]])

    def test_para_v_on_one_line_and_milestones_anywhere(self):
        usfm = HEAD + "\\q1 \\v 1 " + w("One") + "\n\\q2 " + w("two") + "\n\\p\\v 2 " + w("Three") + "\n\\ts\\*\\v 3 " + w("Four")
        book, _, bad = parse(usfm)
        vs = book["chapters"][0]["verses"]
        self.assertEqual([v["text"] for v in vs], ["One\ntwo", "Three", "Four"])
        self.assertEqual(vs[0]["styles"], ["q", "q2"])
        self.assertEqual(bad, 0)

    def test_footnote_with_fqa_and_selah(self):
        usfm = HEAD + "\\q1\n\\v 1 " + w("lying") + "\\f + \\ft A few manuscripts do not include \\fqa lying.\\fqa*\\f*\n\\qs " + w("Selah") + "\\qs*"
        book, _, bad = parse(usfm)
        v = book["chapters"][0]["verses"][0]
        self.assertEqual(v["text"], "lying Selah")
        self.assertEqual(v["footnotes"][0]["text"], "A few manuscripts do not include \u201clying\u201d.")
        self.assertEqual(bad, 0)

    def test_standalone_psalm_title_is_key_zero(self):
        usfm = "\\id PSA EN_ULT\n\\c 3\n\\d " + zs("T", "H40000") + w("A") + " " + w("psalm") + ZE + "\n\\q1\n\\v 1 " + w("Yahweh")
        book, al, bad = parse(usfm)
        v = book["chapters"][0]["verses"][0]
        self.assertEqual(v["superscription"], "A psalm")
        self.assertEqual(v["text"], "Yahweh")
        self.assertIn("0", al[3])
        self.assertEqual(len(al[3]["0"]["a"]), 2)
        self.assertEqual(bad, 0)

    def test_title_inside_verse_one(self):
        usfm = "\\id PSA EN_ULT\n\\c 11\n\\q1 \\v 1 \\d " + w("Of") + " " + w("David") + "\n\\q1 " + w("In") + " " + w("Yahweh")
        book, al, bad = parse(usfm)
        v = book["chapters"][0]["verses"][0]
        self.assertEqual(v["superscription"], "Of David")
        self.assertEqual(v["text"], "In Yahweh")
        self.assertEqual(len(al[11]["1"]["d"]), 2)
        self.assertEqual(len(al[11]["1"]["a"]), 2)
        self.assertEqual(bad, 0)

    def test_aligned_word_in_acrostic_heading_is_dropped(self):
        usfm = HEAD + "\\qa " + zs("S", "H00010") + w("SAMEKH") + ZE + "\n\\q1\n\\v 1 " + w("The") + " " + w("Lord")
        book, al, bad = parse(usfm)
        v = book["chapters"][0]["verses"][0]
        self.assertEqual(v["heading"], "SAMEKH")
        self.assertEqual(bad, 0)

    def test_unknown_marker_still_fails(self):
        with self.assertRaises(b.UsfmError):
            b.parse_book(HEAD + "\\zz odd\n\\v 1 text", {})


class Strongs(unittest.TestCase):
    def test_strong_base(self):
        for raw, base in [("b:H7225", "H7225"), ("H1254a", "H1254"), ("G23160", "G2316"), ("G41775", "G4177"),
                          ("H0430", "H0430"), ("c:d:H1254a", "H1254"), ("l", ""), ("c:b", ""), ("", "")]:
            self.assertEqual(b.strong_base(raw), base, raw)
            self.assertEqual(u.strong_base(raw), base, raw)


ENTRY = {
    # Paul, a servant of God and an apostle ... of God
    "o": [["Παῦλος", "G39720", "", 1], ["δοῦλος", "G14010", "", 1], ["Θεοῦ", "G23160", "", 1],
          ["καὶ", "G25320", "", 1], ["ἀπόστολος", "G06520", "", 1], ["Θεοῦ", "G23160", "", 2]],
    "a": [[0, 4, [0]], [6, 7, [1]], [8, 15, [1]], [16, 18, [2]], [19, 22, [2]], [23, 26, [3]],
          [27, 29, [4]], [30, 37, [4]], [42, 44, [5]], [45, 48, [5]]],
}


class Quotes(unittest.TestCase):
    def test_single_token_occurrences(self):
        self.assertEqual(u.resolve_quote(ENTRY, "Θεοῦ", 1)["hl"], [[16, 22]])
        self.assertEqual(u.resolve_quote(ENTRY, "Θεοῦ", 2)["hl"], [[42, 48]])
        self.assertEqual(u.resolve_quote(ENTRY, "Θεοῦ", -1)["hl"], [[16, 22], [42, 48]])

    def test_multi_token_and_punctuation(self):
        r = u.resolve_quote(ENTRY, "δοῦλος Θεοῦ,", 1)
        self.assertEqual(r["hl"], [[6, 22]])
        self.assertFalse(r["partial"])

    def test_discontinuous_quote(self):
        r = u.resolve_quote(ENTRY, "Παῦλος & ἀπόστολος", 1)
        self.assertEqual(r["hl"], [[0, 4], [27, 37]])

    def test_unaccented_fallback_and_partial(self):
        r = u.resolve_quote(ENTRY, "Παυλος ἄγνωστος", 1)
        self.assertEqual(r["hl"], [[0, 4]])
        self.assertTrue(r["partial"])

    def test_general_note_and_no_alignment(self):
        self.assertIsNone(u.resolve_quote(ENTRY, "Θεοῦ", 0))
        self.assertIsNone(u.resolve_quote(None, "Θεοῦ", 1))

    def test_refs(self):
        self.assertEqual(u.parse_uw_ref("1:1"), ("1", "1", ""))
        self.assertEqual(u.parse_uw_ref("1:1-2"), ("1", "1", "1:1-2"))
        self.assertEqual(u.parse_uw_ref("3:front"), ("3", "0", ""))
        self.assertEqual(u.parse_uw_ref("front:intro"), ("front", "intro", ""))


class Articles(unittest.TestCase):
    def test_tw_article(self):
        md = "\n".join([
            "# grace, gracious", "", "## Definition:", "", "The word **grace** refers to help.",
            "", "(See also: [mercy](../kt/mercy.md), [kind](../other/kind.md))", "",
            "## Translation Suggestions:", "", "* See [Metaphor](rc://*/ta/man/translate/figs-metaphor).",
            "", "## Bible References:", "", "* [Acts 4:33](rc://en/tn/help/act/04/33)", "",
            "## Examples from the Bible stories:", "", "* story", "",
            "## Word Data:", "", "* Strong’s: H2580, G54850",
        ])
        a = u.parse_tw_article(md, "grace", "kt")
        self.assertEqual(a["title"], "grace, gracious")
        self.assertEqual(a["strongs"], ["H2580", "G5485"])
        self.assertEqual(a["see"], ["mercy", "kind"])
        self.assertEqual(a["refs"], [["ACT", 4, 33]])
        self.assertIn("[Metaphor](ta:figs-metaphor)", a["body"])
        self.assertNotIn("story", a["body"])
        self.assertNotIn("See also", a["body"])

    def test_note_links(self):
        md = u.rewrite_links("See: [[rc://*/ta/man/translate/figs-metaphor]] and [1:3](../01/03.md)\\nNext", {"figs-metaphor": "Metaphor"})
        self.assertEqual(md, "See: [Metaphor](ta:figs-metaphor) and 1:3\nNext")


if __name__ == "__main__":
    unittest.main()
