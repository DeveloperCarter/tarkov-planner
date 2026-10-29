import datetime as dt
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import etl_tarkov_dev as etl
import build_page as pages
import refresh_site as refresh
import fetch_art


class SitePipelineTests(unittest.TestCase):
    def test_map_art_keeps_only_the_ground_floor(self):
        svg = (b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><style>.land{}</style>'
               b'<g id="Ground_Level"><rect/></g><g id="Underground"><rect/></g><g id="Ramps" data-keep-with-group="Ground_Level"/><g><rect/></g></svg>')
        out = fetch_art.ground_layer(svg, 'Ground_Level').decode()
        self.assertIn('Ground_Level', out)
        self.assertIn('Ramps', out)
        self.assertNotIn('Underground', out)
        self.assertIn('<style>', out, 'only floors are removed; the page drops the style itself')

    def test_art_rect_follows_rotation_and_requires_a_uniform_transform(self):
        frame = etl.Frame([(0, 0), (100, 50)], pad=0)
        en = lambda p: etl.rotate(p, 180)
        site = {'svgPath': 'x.svg', 'transform': [2, 0, 2, 0], 'bounds': [[0, 0], [-100, -50]]}
        self.assertEqual(etl.art_rect(site, frame, en), {'x': 0, 'y': 0, 'w': 1000.0, 'h': 500.0})
        self.assertIsNone(etl.art_rect({**site, 'transform': [2, 0, 3, 0]}, frame, en))
        self.assertIsNone(etl.art_rect({**site, 'svgPath': None}, frame, en))
        tiled = {**site, 'svgPath': None, 'tilePath': 'https://example/{z}/{x}/{y}.png'}
        self.assertEqual(etl.art_rect(tiled, frame, en), {'x': 0, 'y': 0, 'w': 1000.0, 'h': 500.0},
                         'tiled maps (The Lab) place our own floor art over their bounds')
        narrow = etl.art_rect({**site, 'svgBounds': [[-50, 0], [-100, -50]]}, frame, en)
        self.assertEqual(narrow['x'], 500.0, 'svgBounds wins over bounds')

    def test_build_ships_cached_art_and_photos_and_drops_what_is_missing(self):
        with tempfile.TemporaryDirectory() as folder:
            root, art = Path(folder), Path(folder) / 'cache' / 'art'
            (art / 'maps').mkdir(parents=True)
            (art / 'spots').mkdir()
            (art / 'maps' / 'woods.svg').write_text('<svg/>')
            (art / 'spots' / 'a.webp').write_bytes(b'img')
            (art / 'manifest.json').write_text(json.dumps({'maps': {'woods': {'file': 'maps/woods.svg', 'author': 'A'}},
                'spots': {'q1': [{'file': 'spots/a.webp', 'caption': 'Here'}, {'file': 'spots/gone.webp', 'caption': 'x'}]}}))
            data = {'meta': {'key': 'woods', 'art': {'x': 0, 'y': 0, 'w': 1, 'h': 1}, 'sources': []},
                    'quests': [{'id': 'q1', 'objectives': []}, {'id': 'q2', 'objectives': []}]}
            with patch.object(pages, 'ROOT', root), patch.object(pages, 'ART', art):
                pages.attach_art(data, root / 'dist' / 'maps' / 'woods.html')
                self.assertEqual(data['meta']['art']['href'], '../art/maps/woods.svg')
                self.assertEqual(data['quests'][0]['photos'], [{'src': '../art/spots/a.webp', 'caption': 'Here'}])
                self.assertNotIn('photos', data['quests'][1])
                self.assertTrue((root / 'dist' / 'art' / 'spots' / 'a.webp').exists())
                bare = {'meta': {'key': 'labs', 'art': None, 'sources': []}, 'quests': []}
                pages.attach_art(bare, root / 'dist' / 'maps' / 'labs.html')
                self.assertNotIn('art', bare['meta'])

    def test_build_ships_our_floor_plans_first_floor_by_default(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            floors, art = root / 'data' / 'art', root / 'cache' / 'art'
            (floors / 'the-lab').mkdir(parents=True)
            art.mkdir(parents=True)
            for f in ('1st', 'technical'):
                (floors / 'the-lab' / f'{f}.png').write_bytes(b'png')
            (floors / 'the-lab.json').write_text(json.dumps({'floors': [
                {'id': '1st', 'label': '1st', 'name': 'Ground floor', 'file': 'the-lab/1st.png', 'height': [-0.9, 3]},
                {'id': '2nd', 'label': '2nd', 'name': 'Second level', 'file': 'the-lab/2nd.png'},
                {'id': 'technical', 'label': 'Technical', 'name': 'Technical level', 'file': 'the-lab/technical.png'}]}))
            data = {'meta': {'key': 'the-lab', 'art': {'x': -45.7, 'y': 13, 'w': 1117.5, 'h': 814.5}, 'sources': []}, 'quests': []}
            with patch.object(pages, 'ROOT', root), patch.object(pages, 'ART', art), patch.object(pages, 'FLOOR_ART', floors):
                pages.attach_art(data, root / 'dist' / 'pve' / 'maps' / 'the-lab.html')
                self.assertEqual(data['meta']['art']['href'], '../../art/the-lab/1st.png')
                self.assertEqual([f['id'] for f in data['meta']['art']['floors']], ['1st', 'technical'], 'a missing file is left out')
                self.assertEqual(data['meta']['art']['floors'][1]['label'], 'Technical')
                self.assertEqual(data['meta']['art']['floors'][0]['height'], [-0.9, 3], 'the page picks area names by height')
                self.assertNotIn('height', data['meta']['art']['floors'][1])
                self.assertTrue((root / 'dist' / 'art' / 'the-lab' / 'technical.png').exists())
                self.assertEqual(data['meta']['sources'], [], 'our own plans need no third-party credit')
                bare = {'meta': {'key': 'the-lab', 'art': None, 'sources': []}, 'quests': []}
                pages.attach_art(bare, root / 'dist' / 'maps' / 'the-lab.html')
                self.assertNotIn('art', bare['meta'], 'no rectangle, no floor plans')

    def test_placeholders_name_unlisted_quests_and_never_override_tarkov_dev(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'placeholder-quests.json'
            path.write_text(json.dumps({'quests': [
                {'id': 'new', 'trader': 'Therapist', 'name': None, 'kind': 'quest'},
                {'id': 'daily', 'trader': 'Various', 'name': 'Daily or weekly task', 'kind': 'repeatable'},
                {'id': 'known', 'trader': 'Prapor', 'name': 'Stale name'},
                {'id': 'pvp-only', 'trader': 'Ref', 'modes': ['regular']}]}))
            tasks = {'known': {'name': 'Debut', 'trader': 'Prapor', 'faction': 'Any'}}
            with patch.object(etl, 'PLACEHOLDERS', path):
                etl.add_placeholders(tasks, 'pve')
            self.assertEqual(tasks['known']['name'], 'Debut')
            self.assertEqual(tasks['new']['name'], 'New Therapist quest (name pending)')
            self.assertTrue(tasks['new']['placeholder'] and tasks['daily']['repeatable'])
            self.assertNotIn('pvp-only', tasks)

    def test_partial_refresh_cannot_overwrite_last_complete_snapshot(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(etl, 'ROOT', Path(folder)):
            old = Path(folder) / 'snapshot' / 'regular' / '2020-01-01'
            old.mkdir(parents=True)
            (old / 'manifest.json').write_text('{}')
            (old / 'tasks.json').write_text('original')
            with patch.object(etl, 'fetch', side_effect=[b'{}', OSError('offline')]):
                with self.assertRaises(OSError):
                    etl.take_snapshot('regular')
            self.assertEqual(etl.latest_snapshot('regular'), old)
            self.assertEqual((old / 'tasks.json').read_text(), 'original')
            self.assertFalse(any(p.name == 'manifest.json' for p in old.parent.glob('pending-*/*')))

    def test_successful_same_day_refreshes_are_distinct_and_pruning_keeps_both_modes(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(etl, 'ROOT', Path(folder)), patch.object(refresh, 'ROOT', Path(folder)), patch.object(etl, 'fetch', return_value=b'{}'):
            first = etl.take_snapshot('regular')
            second = etl.take_snapshot('regular')
            pve = etl.take_snapshot('pve')
            self.assertNotEqual(first, second)
            self.assertEqual(etl.latest_snapshot('regular'), second)
            self.assertEqual(json.loads((pve / 'manifest.json').read_text())['mode'], 'pve')
            refresh.prune_snapshots()
            self.assertFalse(first.exists())
            self.assertTrue(second.exists() and pve.exists())

    def test_release_rejects_stale_snapshot_even_when_built_today(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(pages, 'ROOT', Path(folder)):
            base = Path(folder) / 'data' / 'maps'
            base.mkdir(parents=True)
            (base / 'index.json').write_text(json.dumps({'mode':'regular','snapshot':'2020-01-01T00:00:00+00:00','maps':[]}))
            with self.assertRaisesRegex(ValueError, 'refusing to publish stale'):
                pages.build_home(1,'USEC',24)

    def test_mode_mismatch_cannot_publish_pvp_data_as_pve(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(pages, 'ROOT', Path(folder)):
            base = Path(folder) / 'data' / 'maps'
            base.mkdir(parents=True)
            (base / 'index.json').write_text(json.dumps({'mode':'pve','snapshot':dt.datetime.now(dt.timezone.utc).isoformat(),'maps':[]}))
            with self.assertRaisesRegex(ValueError, 'mismatched map index mode'):
                pages.build_home(1,'USEC')

    def test_navigation_supports_nested_modes_and_github_project_prefix(self):
        pvp = pages.navigation(pages.ROOT / 'dist' / 'maps' / 'customs.html','regular','customs')
        pve = pages.navigation(pages.ROOT / 'dist' / 'pve' / 'maps' / 'woods.html','pve','woods')
        self.assertIn('href="../index.html?mode=regular"', pvp)
        self.assertIn('href="../pve/maps/customs.html"', pvp)
        self.assertIn('href="../../index.html?mode=pve"', pve)
        self.assertIn('href="../../maps/woods.html"', pve)
        self.assertNotIn('href="/', pve)


if __name__ == '__main__':
    unittest.main()
