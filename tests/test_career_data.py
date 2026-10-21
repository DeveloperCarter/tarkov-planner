import json
import sys
import unittest
import tempfile
from unittest.mock import patch
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from career_data import keep_requirements, catalog
import build_page as pages
import check_site


class CareerDataTests(unittest.TestCase):
    def test_build_writes_separate_mode_catalogs_with_global_unmapped_items_and_checks_links(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(pages, 'ROOT', Path(folder)):
            root = Path(folder)
            for mode in ('regular', 'pve'):
                prefix = '' if mode == 'regular' else 'pve'
                base = root / 'data' / prefix
                (base / 'maps').mkdir(parents=True)
                (base / 'tasks-index.json').write_text(json.dumps({
                    'a': {'name': 'Alpha', 'trader': 'Fence', 'faction': 'Any'},
                    'collector': {'name': 'Collector', 'trader': 'Fence', 'faction': 'Any'}}))
                (base / 'progression.json').write_text(json.dumps({'a': {'minLevel': 1}, 'collector': {'minLevel': 1}}))
                (base / 'maps/index.json').write_text(json.dumps({'maps': [
                    {'key': 'woods', 'name': 'Woods', 'file': 'woods.json'}]}))
                (base / 'maps/woods.json').write_text(json.dumps({'meta': {'gameMode': mode},
                    'quests': [{'id': 'a', 'onMap': True}]}))
                target = root / 'dist' / prefix / 'maps/woods.html'
                target.parent.mkdir(parents=True)
                target.write_text('<html/>')
                raw = {'lang': {'badge': 'Silver badge'}, 'items': {'items': {'item': {'name': 'badge'}}},
                       'tasks': {'tasks': {'collector': {'normalizedName': 'collector', 'objectives': [
                           {'id': 'give', 'type': 'giveItem', 'items': ['item'], 'count': 1 if mode == 'regular' else 2, 'foundInRaid': True}]}}}}
                with patch.object(pages, 'latest_snapshot', return_value=root), patch.object(pages, 'load_snapshot', return_value=raw), patch.object(pages, 'wiki_kappa', side_effect=lambda tid: True if tid == 'a' else None):
                    pages.build_career_data(mode)
                data = json.loads((root / 'dist' / prefix / 'career-data.json').read_text())
                self.assertEqual(data['mode'], mode)
                self.assertTrue(data['tasks'][0]['kappa'])
                self.assertIsNone(data['tasks'][1]['kappa'])
                self.assertEqual(data['tasks'][1]['keep'][0]['items'][0]['name'], 'Silver badge')
                self.assertEqual(data['tasks'][1]['keep'][0]['count'], 1 if mode == 'regular' else 2)
                self.assertEqual(data['tasks'][1]['maps'], [])
            check_site.check_career_data(root / 'dist')
            (root / 'dist/pve/maps/woods.html').unlink()
            with self.assertRaisesRegex(ValueError, 'broken career href'):
                check_site.check_career_data(root / 'dist')

    def test_find_hand_over_pair_counts_once_and_alternatives_keep_one_quantity(self):
        items = {'a': {'name': 'Medicine'}, 'b': {'name': 'Bandage'}}
        task = {'objectives': [
            {'id': 'find', 'type': 'findItem', 'count': 3, 'items': ['a'], 'foundInRaid': True},
            {'id': 'give', 'type': 'giveItem', 'count': 3, 'items': ['a'], 'foundInRaid': True},
            {'id': 'choice', 'type': 'giveItem', 'count': 5, 'items': ['b', 'a'], 'foundInRaid': True},
            {'id': 'cash', 'type': 'giveItem', 'count': 50, 'items': ['cash'], 'foundInRaid': False},
            {'id': 'optional', 'type': 'giveItem', 'items': ['a'], 'foundInRaid': True, 'optional': True}]}
        result = keep_requirements(task, items, lambda s: s)
        self.assertEqual([r['id'] for r in result], ['give', 'choice'])
        self.assertEqual([r['count'] for r in result], [3, 5])
        self.assertEqual(result[1]['items'], [{'id': 'a', 'name': 'Medicine'}, {'id': 'b', 'name': 'Bandage'}])

    def test_fir_find_and_nonfir_handover_share_one_need_unknown_count_is_not_invented(self):
        task = {'objectives': [
            {'id': 'find', 'type': 'findItem', 'count': None, 'items': ['a'], 'foundInRaid': True},
            {'id': 'give', 'type': 'giveItem', 'count': None, 'items': ['a']},
            {'id': 'find-only', 'type': 'findItem', 'count': 2, 'items': ['b'], 'foundInRaid': True}]}
        result = keep_requirements(task, {}, lambda s: s)
        self.assertEqual([r['id'] for r in result], ['give', 'find-only'])
        self.assertIsNone(result[0]['count'])
        self.assertEqual(result[1]['count'], 2)

    def test_catalog_keeps_unmapped_collector_and_missing_wiki_as_unknown_in_both_modes(self):
        raw = {'lang': {}, 'items': {'items': {'a': {'name': 'Badge'}}}, 'tasks': {'tasks': {
            'collector': {'normalizedName': 'collector', 'objectives': [
                {'id': 'hand-in', 'type': 'giveItem', 'items': ['a'], 'count': 1, 'foundInRaid': True}]}}}}
        rows = [{'id': tid, 'name': tid, 'trader': 'Fence', 'faction': 'Any', 'minLevel': 1,
                 'wiki': None, 'maps': [], 'kappa': True} for tid in ('collector', 'unknown')]
        for mode in ('regular', 'pve'):
            data = catalog(mode, raw, rows, {}, lambda tid: False if tid == 'collector' else None)
            self.assertEqual(data['mode'], mode)
            self.assertTrue(data['tasks'][0]['collector'])
            self.assertEqual(len(data['tasks'][0]['keep']), 1)
            self.assertEqual(data['tasks'][0]['maps'], [])
            self.assertIsNone(data['tasks'][1]['kappa'], 'never silently fall back to tarkov.dev')

    def test_current_mode_task_lists_match_cached_wiki_counts_and_expose_missing_coverage(self):
        # Uses committed caches, not snapshots or live fetches. Flags are checked task by task.
        for mode in ('regular', 'pve'):
            base = pages.ROOT / 'data' / ('' if mode == 'regular' else 'pve')
            tasks = json.loads((base / 'tasks-index.json').read_text(encoding='utf-8'))
            rows = [{'id': tid, 'name': t['name'], 'trader': t['trader'], 'faction': t['faction'],
                     'minLevel': None, 'wiki': None, 'maps': []} for tid, t in tasks.items()]
            data = catalog(mode, {'lang': {}, 'tasks': {'tasks': {}}, 'items': {'items': {}}}, rows, {}, pages.wiki_kappa)
            expected = {tid: pages.wiki_kappa(tid) for tid in tasks}
            actual = {t['id']: t['kappa'] for t in data['tasks']}
            self.assertEqual(actual, expected)
            self.assertGreater(sum(flag is True for flag in actual.values()), 100)
            self.assertGreater(sum(flag is None for flag in actual.values()), 0)


if __name__ == '__main__':
    unittest.main()
