"""Parser regression checks: python -m unittest discover -s tests -p 'test_*.py'."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from build_progression import previous_field, previous_links, key, resolve_cycles


class WikiPreviousTests(unittest.TestCase):
    def test_multiline_infobox_keeps_links_and_labels(self):
        text = '{{Infobox quest\n|previous = [[A|A label]]<br/>\n[[B]]\n|leads to = [[C]]\n}}'
        self.assertEqual(previous_links(previous_field(text)), [('A', ['complete']), ('B', ['complete'])])

    def test_accept_and_complete_scopes(self):
        self.assertEqual(previous_links('Accept [[A]]<br/>[[B]]; Accept [[C|label]]'),
                         [('A', ['active', 'complete']), ('B', ['complete']), ('C', ['active', 'complete'])])

    def test_several_links_on_one_line(self):
        self.assertEqual(previous_links('[[A]] and [[B]]'), [('A', ['complete']), ('B', ['complete'])])
        self.assertEqual(previous_links('Accept [[A]] and [[B]]'), [('A', ['active', 'complete']), ('B', ['active', 'complete'])])

    def test_titles_decode_and_strip_quest_disambiguation(self):
        self.assertEqual(key('Immunity_(quest)'), key('Immunity'))
        self.assertEqual(key('What%E2%80%99s_on_the_Flash_Drive%3F'), key('What’s on the Flash Drive?'))

    def test_cycle_excludes_only_the_conflicting_dev_edge(self):
        edge = lambda target, source: {'task': target, 'statuses': ['complete'], 'source': source}
        tasks = {'a': {'requirements': [edge('b', 'wiki')]},
                 'b': {'requirements': [edge('c', 'tarkov.dev')]},
                 'c': {'requirements': [edge('a', 'both')]}}
        conflicts = resolve_cycles(tasks, {'a': 'A', 'b': 'B', 'c': 'C'})
        self.assertEqual(tasks['b']['requirements'], [])
        self.assertEqual(len(tasks['a']['requirements']), 1)
        self.assertEqual(len(conflicts), 1)

    def test_cycle_without_a_dev_only_edge_fails_for_review(self):
        tasks = {'a': {'requirements': [{'task': 'a', 'statuses': ['complete'], 'source': 'both'}]}}
        with self.assertRaisesRegex(ValueError, 'cycle'):
            resolve_cycles(tasks, {'a': 'A'})

    def test_no_previous(self):
        self.assertEqual(previous_field('{{Infobox quest\n|previous =\n|next = [[B]]\n}}'), '')
        self.assertEqual(previous_links('None'), [])


if __name__ == '__main__':
    unittest.main()
