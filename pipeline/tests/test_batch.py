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


if __name__ == "__main__":
    unittest.main()
