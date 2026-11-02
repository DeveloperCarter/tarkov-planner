"""Objective clustering: python -m unittest discover -s tests -p 'test_*.py'."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from etl_tarkov_dev import Normalizer


class Frame:
    metres = 1500  # a 45 m clustering radius

    @staticmethod
    def xy(en):
        return en


def cluster(*rows):
    points = [{'pid': f'{o}:{i}', 'en': en, 'hint': None, 'quest': q, 'objective': o} for i, (q, o, en) in enumerate(rows)]
    zones, zone_of = Normalizer.cluster(None, points, [], Frame)
    return len(zones), [zone_of[p['pid']] for p in points]


class ClusterTests(unittest.TestCase):
    def test_other_quests_nearby_share_a_spot(self):
        count, _ = cluster(('a', 'a1', (0, 0)), ('b', 'b1', (43, 0)))
        self.assertEqual(count, 1)

    def test_two_objectives_of_one_quest_apart_get_their_own_spots(self):
        count, zones = cluster(('a', 'a1', (0, 0)), ('a', 'a2', (43, 0)))
        self.assertEqual(count, 2)
        self.assertNotEqual(zones[0], zones[1])

    def test_objectives_of_one_quest_at_the_same_place_share_a_spot(self):
        count, _ = cluster(('a', 'a1', (0, 0)), ('a', 'a2', (10, 0)), ('a', 'a3', (0, 0)))
        self.assertEqual(count, 1)

    def test_one_objective_keeps_its_close_alternatives_together(self):
        count, _ = cluster(('a', 'a1', (0, 0)), ('a', 'a1', (43, 0)))
        self.assertEqual(count, 1)


if __name__ == '__main__':
    unittest.main()
