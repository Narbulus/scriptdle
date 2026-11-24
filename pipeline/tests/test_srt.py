import tempfile
import unittest
from pathlib import Path

from pipeline import srt


class SrtTests(unittest.TestCase):
    def test_two_named_speakers_in_one_cue_become_two_turns(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "track.srt"
            path.write_text(
                "1\n00:00:10,000 --> 00:00:12,000\n"
                "MARTY: Yo.\nDOC: Marty, is that you?\n"
            )
            cues = srt.load_dialogue(path)

        self.assertEqual(len(cues), 2)
        self.assertEqual(
            [(cue.speaker_label, cue.text) for cue in cues],
            [("MARTY", "Yo."), ("DOC", "Marty, is that you?")],
        )

    def test_microdvd_disguised_as_srt_is_parsed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "track.srt"
            path.write_text(
                "{1}{1}25.000\n"
                "{50}{100}HARRY: Hello there.|How are you?\n"
            )
            cues = srt.load_dialogue(path)

        self.assertEqual(len(cues), 1)
        self.assertEqual(cues[0].speaker_label, "HARRY")
        self.assertEqual(cues[0].text, "Hello there. How are you?")
        self.assertEqual(cues[0].start, 2.0)
        self.assertEqual(cues[0].end, 4.0)

    def test_mixed_case_sdh_labels_and_radio_qualifiers(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "track.srt"
            path.write_text(
                "1\n00:00:10,000 --> 00:00:12,000\n"
                "Han over comlink: Loud and clear, kid.\n\n"
                "2\n00:00:13,000 --> 00:00:15,000\n"
                "Darth Vader: You've found something?\n\n"
                "3\n00:00:16,000 --> 00:00:18,000\n"
                "Note: Do not treat ordinary prefixes as speakers.\n"
            )
            cues = srt.load_dialogue(path)

        self.assertEqual(
            [(c.speaker_label, c.text) for c in cues],
            [
                ("HAN", "Loud and clear, kid."),
                ("DARTH VADER", "You've found something?"),
                (None, "Note: Do not treat ordinary prefixes as speakers."),
            ],
        )
