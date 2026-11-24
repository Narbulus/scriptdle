import tempfile
import unittest
from pathlib import Path

from pipeline import srt
from pipeline.subtitle_merge import merge


class SubtitleMergeTests(unittest.TestCase):
    def test_multi_speaker_reference_cue_is_split_from_labeled_source(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            reference = root / "reference.srt"
            labels = root / "labels.srt"
            reference.write_text(
                "1\n00:00:10,000 --> 00:00:12,000\n"
                "Where have you been? Working.\n"
            )
            labels.write_text(
                "1\n00:00:05,000 --> 00:00:06,000\n"
                "MARTY: Where have you been?\nDOC: Working.\n"
            )

            cues, report = merge(reference, labels)

        self.assertEqual(
            [(cue.speaker_label, cue.text) for cue in cues],
            [("MARTY", "Where have you been?"), ("DOC", "Working.")],
        )
        self.assertEqual(report["multiSpeakerCuesSplit"], 1)

    def test_labels_transfer_without_using_source_timing(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            reference = root / "reference.srt"
            labels = root / "labels.srt"
            reference.write_text(
                "1\n00:00:10,000 --> 00:00:12,000\nHello there.\n\n"
                "2\n00:00:20,000 --> 00:00:22,000\nGeneral Kenobi.\n"
            )
            labels.write_text(
                "1\n00:00:05,000 --> 00:00:06,000\nALICE: Hello there.\n\n"
                "2\n00:00:10,000 --> 00:00:11,000\nBOB: General Kenobi.\n"
            )

            cues, report = merge(reference, labels)

        self.assertEqual([cue.speaker_label for cue in cues], ["ALICE", "BOB"])
        self.assertEqual([cue.start for cue in cues], [10.0, 20.0])
        self.assertEqual(report["labelsTransferred"], 2)
