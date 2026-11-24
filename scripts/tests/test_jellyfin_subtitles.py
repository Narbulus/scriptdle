import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))

from jellyfin_subtitles import select_subtitle_stream, subtitle_endpoint, subtitle_label


class JellyfinSubtitleSelectionTests(unittest.TestCase):
    def setUp(self):
        self.source = {
            "MediaStreams": [
                {"Type": "Subtitle", "Index": 2, "IsTextSubtitleStream": True, "Language": "eng"},
                {"Type": "Subtitle", "Index": 4, "IsTextSubtitleStream": True,
                 "IsDefault": True, "Language": "spa", "DisplayTitle": "Spanish"},
                {"Type": "Subtitle", "Index": 6, "IsTextSubtitleStream": False, "IsDefault": True},
            ]
        }

    def test_prefers_jellyfin_default_text_track(self):
        self.assertEqual(select_subtitle_stream(self.source)["Index"], 4)

    def test_allows_a_specific_text_stream(self):
        self.assertEqual(select_subtitle_stream(self.source, 2)["Language"], "eng")
        self.assertIsNone(select_subtitle_stream(self.source, 6))

    def test_constructs_an_srt_endpoint_for_the_selected_media_source(self):
        self.assertEqual(
            subtitle_endpoint("https://jellyfin.example/", "item", "source", 4),
            "https://jellyfin.example/Videos/item/source/Subtitles/4/0/Stream.srt",
        )
        self.assertEqual(subtitle_label(self.source["MediaStreams"][1]), "spa (Spanish)")

