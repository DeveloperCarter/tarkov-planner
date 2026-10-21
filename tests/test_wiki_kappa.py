"""Kappa comes from the cached wiki page; tarkov.dev's flag is kept when there's no page."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import build_page  # noqa: E402


def page(infobox: str) -> dict:
    return {'parse': {'wikitext': {'*': '{{Infobox quest\n' + infobox + '\n}}\nText'}}}


class WikiKappaTests(unittest.TestCase):
    def test_wiki_decides_kappa_when_it_has_the_page(self):
        with tempfile.TemporaryDirectory() as tmp:
            wiki = Path(tmp) / 'raw' / 'wiki'
            wiki.mkdir(parents=True)
            (wiki / 'a.json').write_text(json.dumps(page('|reqkappa = <font color="green">Yes</font>')), encoding='utf-8')
            (wiki / 'b.json').write_text(json.dumps(page('|reqkappa = <font color="red">No</font>')), encoding='utf-8')
            (wiki / 'c.json').write_text(json.dumps(page('|location = [[Customs]]')), encoding='utf-8')
            data = {'quests': [{'id': 'a', 'kappa': False}, {'id': 'x', 'bsgId': 'b', 'kappa': True},
                               {'id': 'c', 'kappa': True}, {'id': 'd', 'kappa': True}]}
            with mock.patch.object(build_page, 'ROOT', Path(tmp)):
                build_page.attach_wiki_flags(data)
        self.assertEqual([q['kappa'] for q in data['quests']], [True, False, False, True],
                         'a and b follow the wiki; c has a page without the field; d has no page')


if __name__ == '__main__':
    unittest.main()
