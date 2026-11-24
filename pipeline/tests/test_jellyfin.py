import unittest

from pipeline import jellyfin


class JellyfinTests(unittest.TestCase):
    def test_canonical_role_strips_nicknames_and_voice_suffixes(self):
        self.assertEqual(jellyfin.canonical_role('Obi-Wan "Ben" Kenobi'), "OBI-WAN KENOBI")
        self.assertEqual(jellyfin.canonical_role("Dobby (voice)"), "DOBBY")
        self.assertEqual(jellyfin.canonical_role("Anakin Skywalker / Darth Vader"), "ANAKIN SKYWALKER")

    def test_select_best_subtitle_prefers_sdh_and_skips_commentary(self):
        media_source = {
            "MediaStreams": [
                {"Index": 1, "Type": "Subtitle", "Language": "eng", "IsTextSubtitleStream": False, "DisplayTitle": "English PGS"},
                {"Index": 2, "Type": "Subtitle", "Language": "eng", "IsTextSubtitleStream": True, "IsDefault": True, "DisplayTitle": "English Commentary"},
                {"Index": 3, "Type": "Subtitle", "Language": "eng", "IsTextSubtitleStream": True, "IsDefault": False, "DisplayTitle": "English-SRT"},
                {"Index": 4, "Type": "Subtitle", "Language": "eng", "IsTextSubtitleStream": True, "IsDefault": False, "DisplayTitle": "English-SDH-SRT"},
            ]
        }
        chosen = jellyfin.select_best_subtitle(media_source, prefer_sdh=True)
        self.assertEqual(chosen["Index"], 4)
        non_sdh = jellyfin.select_best_subtitle(media_source, prefer_sdh=False)
        self.assertEqual(non_sdh["Index"], 3)

    def test_extract_movie_metadata_builds_normalized_roster(self):
        item = {
            "Id": "abc123",
            "Name": "Star Wars",
            "ProductionYear": 1977,
            "OfficialRating": "PG",
            "RunTimeTicks": int(121 * 60 * 1e7),
            "Genres": ["Action", "Adventure"],
            "ProviderIds": {"Imdb": "tt0076759"},
            "People": [
                {"Type": "Director", "Name": "George Lucas"},
                {"Type": "Actor", "Name": "Mark Hamill", "Role": "Luke Skywalker"},
                {"Type": "Actor", "Name": "Alec Guinness", "Role": 'Obi-Wan "Ben" Kenobi'},
            ],
            "MediaSources": [{"Id": "ms1", "MediaStreams": []}],
        }
        meta = jellyfin.extract_movie_metadata(item)
        self.assertEqual(meta["slug"], "star-wars-1977")
        self.assertEqual(meta["imdbId"], "tt0076759")
        self.assertEqual(meta["director"], "George Lucas")
        self.assertEqual(meta["runtime"], "121 min")
        self.assertEqual([c["canonical"] for c in meta["cast"]], ["LUKE SKYWALKER", "OBI-WAN KENOBI"])

    def test_select_best_subtitle_never_falls_back_to_foreign_or_signs(self):
        ms_foreign = {
            "MediaStreams": [
                {"Index": 2, "Type": "Subtitle", "IsTextSubtitleStream": True, "Language": "ara", "DisplayTitle": "Arabic - SUBRIP"},
                {"Index": 3, "Type": "Subtitle", "IsTextSubtitleStream": True, "Language": "eng", "DisplayTitle": "Signs & Songs - English - ASS"},
            ]
        }
        self.assertIsNone(jellyfin.select_best_subtitle(ms_foreign, prefer_sdh=True))

    def test_select_best_audio_stream_prefers_english_surround_over_foreign_default(self):
        ms = {
            "MediaStreams": [
                {"Index": 1, "Type": "Audio", "Language": "jpn", "Channels": 6, "IsDefault": True, "DisplayTitle": "Japanese 5.1"},
                {"Index": 2, "Type": "Audio", "Language": "ita", "Channels": 6, "IsDefault": False, "DisplayTitle": "Italian 5.1"},
                {"Index": 3, "Type": "Audio", "Language": "eng", "Channels": 6, "IsDefault": False, "DisplayTitle": "English 5.1"},
                {"Index": 4, "Type": "Audio", "Language": "eng", "Channels": 2, "IsDefault": False, "DisplayTitle": "English Commentary"},
            ]
        }
        chosen = jellyfin.select_best_audio_stream(ms)
        self.assertEqual(chosen["Index"], 3)


if __name__ == "__main__":
    unittest.main()
