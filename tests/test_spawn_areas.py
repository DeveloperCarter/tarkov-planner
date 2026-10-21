"""Synthetic spawn fixtures only; no live sources or player data."""
import json
import math
from pathlib import Path
import subprocess
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import etl_tarkov_dev as etl


class SpawnTests(unittest.TestCase):
    def fixture(self):
        def spawn(x, z, sides=['pmc'], categories=['player']):
            return {'position': {'x': x, 'z': z}, 'sides': sides, 'categories': categories}
        m = {'normalizedName': 'fixture', 'spawns': [spawn(0, 0), spawn(140, 0), spawn(280, 0),
              spawn(0, 400), spawn(5, 5, ['scav']), spawn(5, 5, ['pmc'], ['bot']), spawn(10, 410, ['all'])]}
        frame = etl.Frame([(-100, -100), (500, 500)])
        en = lambda p: etl.rotate(p, 90)
        x, y = frame.xy(en({'x': 0, 'z': 200}))
        return m, frame, en, [{'id': 'exit', 'name': 'Gate', 'type': 'shared', 'x': x, 'y': y}]

    def test_single_linkage_in_metres_and_deterministic_names_frames(self):
        m, frame, en, extracts = self.fixture()
        spawns, areas = etl.build_spawns(m, frame, en, extracts)
        self.assertEqual(len(spawns), 5)
        self.assertEqual(sorted(a['count'] for a in areas), [2, 3])
        self.assertEqual(len({a['name'] for a in areas}), 2)
        self.assertTrue(all(a['name'].startswith('Near Gate (') for a in areas))
        self.assertEqual([a['id'] for a in areas], ['spawn-1', 'spawn-2'])
        for s in spawns:
            self.assertEqual((s['x'], s['y']), frame.xy(en({'x': s['gx'], 'z': s['gz']})))
        m['spawns'].reverse()
        self.assertEqual(etl.build_spawns(m, frame, en, extracts), (spawns, areas))

    def test_match_spawn_and_js_mirror(self):
        m, frame, en, extracts = self.fixture()
        spawns, areas = etl.build_spawns(m, frame, en, extracts)
        data = {'spawns': spawns, 'spawnAreas': areas}
        for gx, gz in [(0, 0), (-30, 0), (-30.01, 0), (70, 0), (10, 411)]:
            expected = etl.match_spawn(data, gx, gz)
            script = 'const R=require("./page/raid-route.js");process.stdout.write(JSON.stringify(R.matchSpawn(' + json.dumps(data) + ',' + str(gx) + ',' + str(gz) + ')));'
            actual = json.loads(subprocess.check_output(['node', '-e', script], cwd=Path(__file__).resolve().parents[1]))
            self.assertEqual(actual, expected)
        self.assertIsNone(etl.match_spawn(data, math.nan, 0))
        self.assertIsNone(etl.match_spawn({}, 0, 0))

    def test_no_spawns_or_no_extracts_are_explicit(self):
        m, frame, en, _ = self.fixture()
        self.assertTrue(all(a['name'] == 'Unnamed spawn area' or a['name'].startswith('Unnamed spawn area ')
                            for a in etl.build_spawns(m, frame, en, [])[1]))
        m['spawns'] = []
        self.assertEqual(etl.build_spawns(m, frame, en, []), ([], []))

    def test_snapshot_location_mapping_is_complete(self):
        # Committed data verifies canonical maps without depending on ignored snapshots.
        root = Path(__file__).resolve().parents[1]
        script = 'const L=require("./page/eft-log-tracker.js");process.stdout.write(JSON.stringify(Object.values(L.RAID_LOCATIONS)));'
        mapped = set(json.loads(subprocess.check_output(['node', '-e', script], cwd=root)))
        for p in (root / 'data/maps').glob('*.json'):
            if p.name != 'index.json':
                self.assertIn(p.stem, mapped)


if __name__ == '__main__':
    unittest.main()
