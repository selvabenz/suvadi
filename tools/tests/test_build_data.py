"""Unit tests for tools/build_data.py. Run: python -m unittest discover -s tools/tests -v"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import build_data as b  # noqa: E402

ABBR = {"ஆதி": "GEN", "யாத்": "EXO", "1நாளா": "1CH", "சங்": "PSA", "அப்": "ACT", "ஏசா": "ISA"}

SAMPLE = """\\id LUK Tamil IRV
\\ide UTF-8
\\h லூக்கா
\\toc1 லூக்கா எழுதின நற்செய்தி
\\toc2 லூக்கா
\\toc3 லூக்
\\mt லூக்கா
\\is ஆசிரியர்
\\ip லூக்கா \\k மருத்துவர் \\k* ஆவார்.
\\c 1
\\s யோவான் ஸ்நானனின் பிறப்பு
\\r (1நாளா 24:10)
\\p
\\v 1 முதல் வசனம்.
\\v 2 இரண்டாம்\\f + \\fr 1:2 \\fq இரண்டாம் \\ft குறிப்பு.\\f* வசனம்.\\x + \\xo 1:2 \\xt யாத் 30:7; அப் 4:25,26; 136:1\\x*
\\q
\\v 3 \\wj முதல் வரி,\\wj*
\\q2 \\wj இரண்டாம் வரி \\wj*
\\b
\\q
\\v 4 மூன்றாம் \\qs (சேலா) \\qs*
\\c 2
\\p
\\v 1-2 இணைந்த வசனம்.
\\s தலைப்பு
\\p
\\v 3 பிந்தைய வசனம்.
"""


class ParseBookTests(unittest.TestCase):
    def setUp(self):
        self.book = b.parse_book(SAMPLE, ABBR)

    def test_header_and_intro(self):
        self.assertEqual(self.book["code"], "LUK")
        self.assertEqual(self.book["names"]["toc2"], "லூக்கா")
        self.assertEqual(self.book["intro"][1]["text"], "லூக்கா மருத்துவர் ஆவார்.")

    def test_heading_and_parallel_attach_to_next_verse(self):
        v1 = self.book["chapters"][0]["verses"][0]
        self.assertEqual(v1["heading"], "யோவான் ஸ்நானனின் பிறப்பு")
        self.assertEqual(v1["parallel"], "(1நாளா 24:10)")
        self.assertEqual(v1["text"], "முதல் வசனம்.")

    def test_footnote_and_xref_extracted_with_offsets(self):
        v2 = self.book["chapters"][0]["verses"][1]
        self.assertEqual(v2["text"], "இரண்டாம் வசனம்.")
        fn = v2["footnotes"][0]
        self.assertEqual((fn["ref"], fn["quote"], fn["text"]), ("1:2", "இரண்டாம்", "குறிப்பு."))
        self.assertEqual(v2["text"][: fn["pos"]], "இரண்டாம்")
        x = v2["xrefs"][0]
        self.assertEqual(x["pos"], len(v2["text"]))
        self.assertEqual(x["targets"], [
            {"book": "EXO", "ch": 30, "v": 7},
            {"book": "ACT", "ch": 4, "v": 25},
            {"book": "ACT", "ch": 4, "v": 26},
            {"book": "ACT", "ch": 136, "v": 1},
        ])

    def test_poetry_lines_and_words_of_jesus(self):
        v3 = self.book["chapters"][0]["verses"][2]
        self.assertEqual(v3["text"], "முதல் வரி,\nஇரண்டாம் வரி")
        self.assertEqual(v3["styles"], ["q", "q2"])
        spans = [v3["text"][a:c] for a, c in v3["wj"]]
        self.assertEqual(spans, ["முதல் வரி,", "இரண்டாம் வரி"])

    def test_selah_marker_stripped_text_kept(self):
        v4 = self.book["chapters"][0]["verses"][3]
        self.assertEqual(v4["text"], "மூன்றாம் (சேலா)")
        self.assertNotIn("wj", v4)

    def test_verse_bridge(self):
        v = self.book["chapters"][1]["verses"][0]
        self.assertEqual((v["n"], v["id"], v["end"]), (1, "1-2", 2))

    def test_heading_mid_chapter(self):
        v = self.book["chapters"][1]["verses"][1]
        self.assertEqual(v["heading"], "தலைப்பு")
        self.assertEqual(v["n"], 3)

    def test_unknown_marker_is_an_error(self):
        with self.assertRaises(b.UsfmError):
            b.parse_book(SAMPLE + "\\zz unknown\n", ABBR)
        with self.assertRaises(b.UsfmError):
            b.parse_book(SAMPLE.replace("\\qs (சேலா) \\qs*", "\\nd (சேலா) \\nd*"), ABBR)


class TargetTests(unittest.TestCase):
    def test_whole_chapter_and_bare_number(self):
        self.assertEqual(b.parse_tamil_targets("சங் 57; 142", "1SA", ABBR), [
            {"book": "PSA", "ch": 57}, {"book": "PSA", "ch": 142},
        ])

    def test_range_across_chapters(self):
        self.assertEqual(b.parse_tamil_targets("ஏசா 15:1-16:14", "JOL", ABBR), [
            {"book": "ISA", "ch": 15, "v": 1, "vEnd": 14, "chEnd": 16},
        ])

    def test_range_within_chapter(self):
        self.assertEqual(b.parse_tamil_targets("ஆதி 6:1-7", "GEN", ABBR), [
            {"book": "GEN", "ch": 6, "v": 1, "vEnd": 7},
        ])

    def test_unknown_abbreviation_stays_raw(self):
        self.assertEqual(b.parse_tamil_targets("ஜாபாஸ் 1:1", "GEN", ABBR), [{"raw": "ஜாபாஸ் 1:1"}])


class OpenBibleTests(unittest.TestCase):
    def test_osis(self):
        self.assertEqual(b.parse_osis("Ps.134.3"), ("PSA", 134, 3))
        self.assertEqual(b.parse_osis("1Kgs.2.1"), ("1KI", 2, 1))
        self.assertIsNone(b.parse_osis("Tob.1.1"))

    def test_build_xrefs_sorts_and_limits(self):
        import tempfile
        rows = ["From Verse\tTo Verse\tVotes\t#hdr"]
        for i in range(20):
            rows.append(f"Gen.1.1\tRev.{i + 1}.1\t{i}")
        rows.append("Gen.1.1\tCol.1.16-Col.1.17\t175")
        rows.append("Gen.1.1\tJohn.1.1\t-3")
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "x.txt"
            p.write_text("\n".join(rows) + "\n", encoding="utf-8")
            out = b.build_xrefs(p, per_verse_limit=5)
        lst = out["GEN"]["1:1"]
        self.assertEqual(len(lst), 5)
        self.assertEqual(lst[0], ["COL", 1, 16, 17, 175])
        self.assertTrue(all(lst[i][4] >= lst[i + 1][4] for i in range(4)))
        self.assertFalse(any(t[0] == "JHN" for t in lst))


class StepTests(unittest.TestCase):
    def test_nt_row(self):
        import tempfile
        line = "Mat.1.1#03=NKO\tἸησοῦ (Iēsou)\tof Jesus\tG2424G=N-GSM-P\tἸησοῦς=Jesus/Joshua\tNA28\t\t\tde Jesús\tJesus\t#03\tG2424\t\t\t\t\t"
        k_only = "Mat.1.1#04=K\tΧριστοῦ (Christou)\tChrist\tG5547=N-GSM-T\tΧριστός=Christ\tTR\t\t\tUngido\tChrist\t#04\tG5547\t\t\t\t\t"
        o_only = "Mat.1.1#05=O\tυἱοῦ (huiou)\tson\tG5207=N-GSM\tυἱός=son\tWH\t\t\thijo\tson\t#05\tG5207\t\t\t\t\t"
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "TAGNT.txt"
            p.write_text("hdr\n" + "\n".join([line, k_only, o_only]) + "\n", encoding="utf-8")
            rows = list(b.iter_step_words(p, "nt"))
        self.assertEqual(rows[0], ("MAT", 1, 1, ["Ἰησοῦ", "Iēsou", "of Jesus", "G2424G", "N-GSM-P", ""]))
        self.assertEqual(rows[1][3][5], "k")
        self.assertEqual(len(rows), 2)

    def test_ot_row_uses_root_strong_and_english_versification(self):
        import tempfile
        line = "Psa.3.1(3.2)#04=L\tצָרָ֑/י\ttza.Ra/i\topponents/ my\t{H6862C}/H9020\tHNcmpc/Sp1bs\t\t\tH6862C\t\t\t{H6862C=צַר=enemy}/H9020=Ps1c=my\t\t\t\t\t"
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "TAHOT.txt"
            p.write_text(line + "\n", encoding="utf-8")
            rows = list(b.iter_step_words(p, "ot"))
        self.assertEqual(rows[0], ("PSA", 3, 1, ["צָרָ֑י", "tza.Rai", "opponents my", "H6862C", "HNcmpc/Sp1bs", ""]))


if __name__ == "__main__":
    unittest.main()


class OtherIrvMarkers(unittest.TestCase):
    """Markers met in the Hindi, Malayalam and Punjabi IRV."""

    def parse(self, body: str) -> dict:
        return b.parse_book(b.normalize_usfm("\\id SNG\n\\rem Copyright\n\\h X\n\\c 1\n" + body), {})

    def test_midline_verse_and_poetry_line(self):
        book = self.parse("\\q \\v 1 one line \\q second line \\v 2 two")
        vs = book["chapters"][0]["verses"]
        self.assertEqual([v["text"] for v in vs], ["one line\nsecond line", "two"])

    def test_look_only_styles_are_dropped(self):
        book = self.parse("\\p \\v 1 a \\it word\\it* and \\bdit bold\\bdit* \\tl abba\\tl*.\\f + \\fr 1:1 \\ft see \\it this\\it*\\f*")
        v = book["chapters"][0]["verses"][0]
        self.assertEqual(v["text"], "a word and bold abba.")
        self.assertEqual(v["footnotes"][0]["text"], "see this")

    def test_speaker_subheading_rem_mr_io_q4(self):
        book = self.parse("\\mr Psalms 1-41\n\\sp Bride\n\\q4 \\v 1 deep line\n\\s2 Part two\n\\p \\v 2 more")
        vs = book["chapters"][0]["verses"]
        self.assertEqual(vs[0]["heading"], "Bride")
        self.assertEqual(vs[0]["styles"], ["q3"])
        self.assertEqual(vs[1]["heading"], "Part two")
