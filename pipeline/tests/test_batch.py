import unittest

from pipeline import batch


class BatchTests(unittest.TestCase):
    def test_pick_top_rated_episodes_returns_highest_rated_in_season_order(self):
        eps = [
            {"IndexNumber": 1, "Name": "Pilot", "CommunityRating": 7.8},
            {"IndexNumber": 2, "Name": "Filler", "CommunityRating": 6.9},
            {"IndexNumber": 3, "Name": "Classic", "CommunityRating": 9.1},
            {"IndexNumber": 4, "Name": "Mid", "CommunityRating": 7.4},
            {"IndexNumber": 5, "Name": "Finale", "CommunityRating": 8.9},
        ]
        picked = batch.pick_top_rated_episodes(eps, 3)
        self.assertEqual([e["IndexNumber"] for e in picked], [1, 3, 5])

    def test_pick_top_rated_episodes_falls_back_to_spaced_when_unrated(self):
        eps = [{"IndexNumber": i, "Name": f"Ep {i}"} for i in range(1, 10)]
        picked = batch.pick_top_rated_episodes(eps, 3)
        self.assertEqual([e["IndexNumber"] for e in picked], [1, 5, 9])

    def test_clean_episode_title_and_summary(self):
        self.assertEqual(
            batch.clean_episode_title(
                "Sozin's Comet: The Phoenix King (1) / Sozin's Comet: The Old Masters (2) / "
                "Sozin's Comet: Into the Inferno (3) / Sozin's Comet: Avatar Aang (4)"
            ),
            "Sozin's Comet (Parts 1-4)",
        )
        summary = batch.clean_episode_summary(
            "Walt and Jesse face the deadly consequences of their actions. "
            "Skyler deals with a puzzling disappearance while Marie tries to help Hank recover. "
            "Meanwhile Gus makes an unforgettable point in the superlab that rattles everyone."
        )
        self.assertLessEqual(len(summary), 210)
        self.assertTrue(summary.endswith("."))


if __name__ == "__main__":
    unittest.main()
