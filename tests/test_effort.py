"""Effort facts from synthetic map files; no live data."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from effort import effort_facts  # noqa: E402


def quest(qid, objectives, needs=()):
    return {'id': qid, 'name': qid, 'objectives': objectives, 'needs': list(needs)}


class EffortTests(unittest.TestCase):
    def test_facts_count_spots_kills_keys_and_maps_once(self):
        key = lambda name, iid: {'item': name, 'itemIds': [iid], 'kind': 'key', 'qty': 1, 'optional': False}
        customs = {'meta': {'key': 'customs'}, 'acquisition': [
            {'itemId': 'k1', 'kind': 'key', 'fleaLevel': 25, 'sources': ['Mechanic LL1: 14,594']},
            {'itemId': 'k2', 'kind': 'key', 'fleaLevel': 30, 'sources': ['No trader, barter or craft source. Find it in raid.']}],
            'quests': [
                quest('easy', [{'id': 'v', 'type': 'visit', 'zone': ['a']}, {'id': 's', 'type': 'shoot', 'count': 3, 'targets': ['Scav']}], [key('Shop key', 'k1')]),
                quest('hard', [{'id': 'p', 'type': 'shoot', 'count': 1, 'targets': ['any PMC operatives']},
                               {'id': 'f', 'type': 'giveItem', 'foundInRaid': True},
                               {'id': 'x', 'type': 'findQuestItem', 'zone': []},
                               {'id': 'e', 'type': 'extract', 'count': 3}], [key('Keycard', 'k2')]),
                quest('shared', [{'id': 'm1', 'type': 'mark', 'zone': ['a', 'b']}])]}
        woods = {'meta': {'key': 'woods'}, 'quests': [quest('shared', [{'id': 'm2', 'type': 'mark', 'zone': ['a']}])]}
        with tempfile.TemporaryDirectory() as tmp:
            paths = []
            for name, data in [('customs', customs), ('woods', woods)]:
                path = Path(tmp) / f'{name}.json'; path.write_text(json.dumps(data)); paths.append(path)
            facts = effort_facts(paths)
        self.assertEqual(facts['easy']['spots'], 1)
        self.assertEqual(facts['easy']['kills'], 3)
        self.assertEqual(facts['easy']['keys'], [{'name': 'Shop key', 'fleaLevel': 25, 'trader': True}])
        hard = facts['hard']
        self.assertTrue(hard['hardKills'] and hard['fir'] and hard['streak'])
        self.assertEqual(hard['unlocated'], 1)
        self.assertEqual(hard['keys'], [{'name': 'Keycard', 'fleaLevel': 30, 'trader': False}])
        self.assertEqual((facts['shared']['spots'], facts['shared']['maps']), (3, 2), 'zone a counts on both maps')


if __name__ == '__main__':
    unittest.main()
