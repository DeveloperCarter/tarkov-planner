import json
from pathlib import Path
import sys
import tempfile
import unittest
import zipfile
from unittest.mock import patch
import shutil

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import build_page


class QuestShortcutsTests(unittest.TestCase):
    def test_download_contains_only_installable_extension_and_instructions(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            shutil.copytree(build_page.ROOT / 'extension', root / 'extension')
            (root / 'extension' / 'quest-shortcuts' / 'private.local').write_text('not publishable')
            with patch.object(build_page, 'ROOT', root):
                archive = build_page.build_shortcuts()
            with zipfile.ZipFile(archive) as package:
                self.assertEqual(set(package.namelist()), {
                    'quest-shortcuts/' + name for name in
                    ('manifest.json', 'background.js', 'content.js', 'popup.html', 'popup.css', 'popup.js', 'README.md')})
                manifest = json.loads(package.read('quest-shortcuts/manifest.json'))
                for source in [manifest['background']['service_worker'], manifest['action']['default_popup'],
                               *manifest['content_scripts'][0]['js']]:
                    self.assertIn('quest-shortcuts/' + source, package.namelist())


if __name__ == '__main__':
    unittest.main()
