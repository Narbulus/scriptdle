import unittest

from pipeline import export


class ExportTests(unittest.TestCase):
    def test_contiguous_runs_preserve_genuine_adjacent_context(self):
        items = [
            # Valid 4-line contiguous run
            {"speaker": "LUKE", "text": "Look at the size of that thing.", "start": 1.0, "end": 3.0, "conf": 0.96},
            {"speaker": "HAN", "text": "Cut the chatter, Red Two.", "start": 3.5, "end": 5.0, "conf": 0.95},
            {"speaker": "LUKE", "text": "I'm on the leader now.", "start": 5.5, "end": 7.0, "conf": 0.94},
            {"speaker": "LEIA", "text": "Good luck down there, Luke.", "start": 7.5, "end": 9.0, "conf": 0.92},
            # Low-confidence break
            {"speaker": "OTHER", "text": "Stay on target!", "start": 9.5, "end": 11.0, "conf": 0.40},
            # Short 2-line run (< min_run_length=4) must be dropped so it can't stitch across break
            {"speaker": "HAN", "text": "Almost there.", "start": 11.5, "end": 12.5, "conf": 0.95},
            {"speaker": "LUKE", "text": "Use the Force, Luke.", "start": 13.0, "end": 14.5, "conf": 0.95},
        ]
        filtered = export.filter_contiguous_runs(items, min_conf=0.85, min_run_length=4)
        self.assertEqual(len(filtered), 4)
        self.assertEqual([r["character"] for r in filtered], ["LUKE", "HAN", "LUKE", "LEIA"])

    def test_build_and_validate_scriptle_script(self):
        speakers = ["LUKE", "HAN", "LEIA", "OBI-WAN", "C-3PO"]
        items = []
        t = 0.0
        for i in range(80):
            spk = speakers[i % len(speakers)]
            items.append({
                "speaker": spk,
                "text": f"This is a genuine five word dialogue quote number {i}.",
                "start": t,
                "end": t + 2.0,
                "conf": 0.96,
                "clean": True,
            })
            t += 2.5

        meta = {
            "slug": "star-wars-episode-iv-a-new-hope",
            "title": "Star Wars: Episode IV - A New Hope",
            "year": 1977,
            "imdbId": "tt0076759",
            "poster": "https://example.com/poster.jpg",
            "rated": "PG",
            "runtime": "121 min",
            "genre": "Action, Adventure, Fantasy",
            "director": "George Lucas",
        }
        doc = export.build_scriptle_script(items, meta, min_conf=0.85, merge_turns=False)
        report = export.validate_scriptle_script(doc, min_words=5)
        self.assertTrue(report["valid"])
        self.assertEqual(doc["lineCount"], 80)
        self.assertEqual(set(doc["topSpeakingCast"]), set(speakers))
        # Padding excludes idx 0 and last 3 indices -> 76 eligible targets
        self.assertEqual(report["eligibleTargets"], 76)
        self.assertEqual(report["nonCharacterLeaks"], 0)

    def test_context_roles_kept_for_clues_but_excluded_from_targets_and_cast(self):
        self.assertTrue(export.is_generic_context_role("STORMTROOPER"))
        self.assertTrue(export.is_generic_context_role("IMPERIAL OFFICER"))
        self.assertTrue(export.is_generic_context_role("REBEL PILOT 2"))
        self.assertFalse(export.is_guessable_character("STORMTROOPER"))
        # Named titles must remain guessable characters!
        self.assertTrue(export.is_guessable_character("GENERAL TAGGE"))
        self.assertTrue(export.is_guessable_character("CAPTAIN AMERICA"))
        self.assertTrue(export.is_guessable_character("DOCTOR STRANGE"))

        items = [
            # Scene 0: Obi-Wan talking to Stormtrooper (kept intact!)
            {"speaker": "STORMTROOPER", "text": "How long have you had these droids?", "start": 10.0, "end": 12.0, "conf": 0.95},
            {"speaker": "LUKE SKYWALKER", "text": "About three or four seasons.", "start": 12.5, "end": 14.5, "conf": 0.96},
            {"speaker": "OBI-WAN KENOBI", "text": "These aren't the droids you're looking for.", "start": 15.0, "end": 17.5, "conf": 0.99},
            {"speaker": "STORMTROOPER", "text": "These aren't the droids we're looking for.", "start": 18.0, "end": 20.0, "conf": 0.97},
            # >12s gap -> Scene 1!
            {"speaker": "HAN SOLO", "text": "She may not look like much, kid.", "start": 45.0, "end": 47.5, "conf": 0.98},
            {"speaker": "LUKE SKYWALKER", "text": "What a piece of junk!", "start": 48.0, "end": 49.5, "conf": 0.98},
            {"speaker": "HAN SOLO", "text": "She's got it where it counts, kid.", "start": 50.0, "end": 52.0, "conf": 0.98},
            # Pure stormtrooper-only scene must be dropped (no guessable named character)
            {"speaker": "STORMTROOPER", "text": "Look sir, droids over there.", "start": 90.0, "end": 92.0, "conf": 0.95},
            {"speaker": "STORMTROOPER 2", "text": "Move along, nothing to see here.", "start": 92.5, "end": 94.5, "conf": 0.95},
            {"speaker": "IMPERIAL OFFICER", "text": "Check the next sector immediately.", "start": 95.0, "end": 97.0, "conf": 0.95},
        ]
        filtered = export.filter_contiguous_runs(items, min_conf=0.85, min_run_length=3, max_scene_gap=12.0)
        self.assertEqual(len(filtered), 7)
        self.assertEqual([r["scene"] for r in filtered], [0, 0, 0, 0, 1, 1, 1])
        self.assertIn("STORMTROOPER", [r["character"] for r in filtered])

        # Verify generate-daily-puzzles.py respects scene boundaries and excludes STORMTROOPER
        import importlib.util
        from pathlib import Path
        spec = importlib.util.spec_from_file_location(
            "gen_daily", Path(__file__).resolve().parents[2] / "scripts" / "generate-daily-puzzles.py"
        )
        gen_mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(gen_mod)
        gen = gen_mod.PuzzleGenerator(Path("."))
        script = {
            "id": "test-sw",
            "title": "Star Wars",
            "year": 1977,
            "topSpeakingCast": ["LUKE SKYWALKER", "OBI-WAN KENOBI", "HAN SOLO"],
            "lines": [{"character": r["character"], "text": r["text"], "scene": r["scene"]} for r in filtered],
        }
        all_lines = gen.flatten_lines({"test-sw": script})
        idx_map = gen.build_significant_lines_index({"test-sw": script}, all_lines, min_words=5)
        # Line 2 (OBI-WAN) is 2nd-to-last in scene 0, so idx+2 crosses into scene 1 -> MUST be excluded!
        # Line 1 (LUKE, scene 0) has idx+1 (OBI-WAN, scene 0) and idx+2 (STORMTROOPER, scene 0) -> MUST be included!
        self.assertEqual(idx_map.get("test-sw"), [1])


if __name__ == "__main__":
    unittest.main()
