import unittest

from pipeline import benchmark
from pipeline.srt import Cue


class BenchmarkTests(unittest.TestCase):
    def test_speakers_match_handles_aliases_and_rejects_collisions(self):
        # True positives
        self.assertTrue(benchmark.speakers_match("LUKE SKYWALKER", "LUKE"))
        self.assertTrue(benchmark.speakers_match("OBI-WAN KENOBI", "BEN"))
        self.assertTrue(benchmark.speakers_match("C-3PO", "THREEPIO"))
        self.assertTrue(benchmark.speakers_match("EMMETT BROWN", "DOC"))
        self.assertTrue(benchmark.speakers_match("GRAND MOFF TARKIN", "TARKIN"))
        self.assertTrue(benchmark.speakers_match("HARRY POTTER", "HARRY'S VOICE"))
        self.assertTrue(benchmark.speakers_match("DARTH VADER", "VADER"))

        # Must NOT collide on shared family surnames or generic titles/roles
        self.assertFalse(benchmark.speakers_match("RON WEASLEY", "GINNY WEASLEY"))
        self.assertFalse(benchmark.speakers_match("MARTY MCFLY", "GEORGE MCFLY"))
        self.assertFalse(benchmark.speakers_match("DARTH VADER", "DARTH SIDIOUS"))
        self.assertFalse(benchmark.speakers_match("RED LEADER", "GOLD LEADER"))
        self.assertFalse(benchmark.speakers_match("STORMTROOPER", "OFFICER"))

    def test_score_sdh_anchors_computes_precision_by_confidence_tier(self):
        cues = [
            Cue(0, 1.0, 3.0, "Line one.", speaker_label="LUKE"),
            Cue(1, 4.0, 6.0, "Line two.", speaker_label="HAN"),
            Cue(2, 7.0, 9.0, "Line three.", speaker_label="LEIA"),
            Cue(3, 10.0, 12.0, "Line four.", speaker_label="VADER"),
        ]
        items = [
            {"id": 0, "speaker": "LUKE SKYWALKER", "conf": 0.97},  # correct, >=0.95
            {"id": 1, "speaker": "HAN SOLO", "conf": 0.92},        # correct, >=0.90
            {"id": 2, "speaker": "PRINCESS LEIA", "conf": 0.86},   # correct, >=0.85
            {"id": 3, "speaker": "TARKIN", "conf": 0.70},          # wrong, low conf
        ]
        res = benchmark.score_sdh_anchors(items, cues)
        self.assertEqual(res["tiers"]["0.00"]["precisionPct"], 75.0)
        self.assertEqual(res["tiers"]["0.85"]["precisionPct"], 100.0)
        self.assertEqual(res["tiers"]["0.85"]["anchorCoveragePct"], 75.0)
        self.assertEqual(res["tiers"]["0.95"]["precisionPct"], 100.0)
        self.assertEqual(res["tiers"]["0.95"]["scored"], 1)

    def test_score_puzzle_windows_measures_3_line_accuracy(self):
        speakers = ["LUKE", "HAN", "LEIA", "OBI-WAN"]
        ref_lines = [
            {"character": speakers[i % 4], "text": f"Here is spoken dialogue line number {i} in the scene."}
            for i in range(24)
        ]
        items = [
            {
                "id": i,
                "start": i * 3.0,
                "end": i * 3.0 + 2.0,
                "speaker": speakers[i % 4] if i != 10 else "LUKE",
                "text": ref_lines[i]["text"],
                "conf": 0.95,
                "clean": True,
            }
            for i in range(24)
        ]
        meta = {"slug": "test", "title": "Test", "year": 1977}
        res = benchmark.score_puzzle_windows(items, meta, ref_lines, min_conf=0.85)
        self.assertEqual(res["exportedLines"], 24)
        # 1 wrong line out of 20 eligible targets -> 19/20 = 95.0%
        self.assertEqual(res["targetPrecisionPct"], 95.0)
        # Error at idx=10 breaks windows starting at idx 8, 9, 10 -> 17/20 = 85.0%
        self.assertEqual(res["window3PrecisionPct"], 85.0)


if __name__ == "__main__":
    unittest.main()
