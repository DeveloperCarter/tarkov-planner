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


class SitePipelineTests(unittest.TestCase):
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
