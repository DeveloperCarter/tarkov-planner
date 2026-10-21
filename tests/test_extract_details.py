"""Small extraction-table fixtures; tests never fetch wiki pages."""
import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import etl_tarkov_dev as etl


def table(*rows, faction=True):
    headers = ['Extraction', 'Name'] + (['Faction'] if faction else []) + ['Always available', 'Single-Use', 'Requirements', 'Notes']
    out = '==Extractions==\n{| class="wikitable"\n!' + '\n!'.join(headers) + '\n'
    for name, side, available, requirement in rows:
        out += '|-\n![[File:fixture.png|240px]]\n! style="text-align:left" |' + name + '\n'
        if faction: out += '|' + side + '\n'
        out += '|' + available + '\n|✘\n| ' + requirement + '\n|\n'
    return out + '|}\n==Maps==\n'


class ExtractTests(unittest.TestCase):
    def build(self, key, entries, text, switches=None):
        norm = etl.Normalizer.__new__(etl.Normalizer)
        norm.tr, norm.mode = etl.Tr({'vehicle': 'Dorms V-Ex'}), 'regular'
        m = {'normalizedName': key, 'wiki': 'https://escapefromtarkov.fandom.com/wiki/Fixture',
             'extracts': [{'name': name, 'faction': side, 'position': {'x': 10, 'z': 20}, **extra}
                          for name, side, extra in entries], 'switches': switches or []}
        frame = etl.Frame([(0, 0), (100, 100)], pad=0)
        page = {'parse': {'wikitext': {'*': text}}}
        # Production overrides are read locally; the wiki source is always a fixture.
        with patch.object(etl, 'fetch_extract_wiki', return_value=page):
            with contextlib.redirect_stderr(io.StringIO()):
                return norm.build_extracts(m, frame, lambda p: (p['x'], p['z']))

    def test_customs_paid_crossroads_coop_and_repeated_wrong_switch_reference(self):
        text = table(('Dorms V-Ex', 'PMC', '✘', '[[File:5000 Roubles.png|link=Roubles]] per player'),
                     ('Crossroads', 'All', '✔', '-'),
                     ('Boiler Room Basement (Co-op)', 'All', '✔', '[[Scav]] + PMC'))
        rows = self.build('customs', [('vehicle','pmc',{'switch':'wrong'}),
                         ('Crossroads','pmc',{'switch':'wrong'}),
                         ('Boiler Room Basement (Co-op)','shared',{'switch':'wrong'})], text)
        self.assertEqual((rows[0]['name'], rows[0]['requirement'], rows[0]['cost']), ('Dorms V-Ex','paid',5000))
        self.assertIs(rows[0]['alwaysOpen'], False)
        self.assertEqual((rows[1]['type'],rows[1]['requirement'],rows[1]['alwaysOpen']),('pmc','none',True))
        self.assertNotIn('switch',rows[1], 'a map-wide switch must not power-gate Crossroads')
        self.assertEqual((rows[2]['type'],rows[2]['requirement']),('coop','coop'))
        self.assertEqual(rows[2]['sides'],['USEC','BEAR'])

    def test_reserve_d2_uses_reviewed_power_switch_in_frame_coordinates(self):
        text = table(('D-2','PMC','✔','Turn on power with a lever; press the button.'))
        switch = {'id':'9cad024bc31223f02f7296c3cb1834c5f6fa2fe2', 'name':'D2_LEVER', 'position':{'x':25,'z':60}}
        result = self.build('reserve',[('D-2','pmc',{})],text,[switch])[0]
        self.assertEqual(result['requirement'],'switch')
        self.assertEqual((result['switch']['x'],result['switch']['y']),(250,400))
        self.assertIn('D-2',result['switch']['name'])
        self.assertNotIn('unclassified',result)

    def test_flare_indicator_is_not_a_fired_flare_and_scav_availability_differs(self):
        text = table(('Old Gas Station','All','PMC: ✘<br/>Scav: ✔','Green flares = Open for PMCs'))
        results = self.build('customs',[('Old Gas Station','pmc',{}),('Old Gas Station','scav',{})],text)
        self.assertEqual([r['requirement'] for r in results],['other','none'])
        self.assertEqual([r['alwaysOpen'] for r in results],[False,True])
        fired = etl.classify_extract_row({'requirements':'Shoot a green flare into the sky','always available':'✔'},'pmc')
        self.assertEqual(fired['requirement'],'flare')

    def test_cliff_items_unknowns_side_restrictions_and_missing_switches(self):
        row = etl.classify_extract_row({'requirements':'[[Red Rebel ice pick]]<br/>[[Paracord]]<br/>No armor vest equipped',
                                       'always available':'✔'},'pmc')
        self.assertEqual(row['requirement'],'cliff')
        self.assertIn('Paracord',row['item'])
        result=self.build('fixture',[('Unknown','pmc',{})],'')[0]
        self.assertEqual(result['requirement'],'other')
        self.assertIsNone(result['alwaysOpen'])
        self.assertTrue(result['unclassified'])
        row=etl.classify_extract_row({'requirements':'USEC only','always available':'✔'},'pmc')
        self.assertEqual(row['sides'],['USEC'])
        self.assertIn('unclassified', row)

    def test_tables_without_faction_and_with_omitted_trailing_notes(self):
        text=table(('Cargo Elevator','PMC','✔','Restore power in the basement.'),faction=False)
        rows=etl.parse_extract_tables(text)
        self.assertEqual(len(rows),1)
        self.assertEqual(etl.classify_extract_row(rows[0],'shared')['requirement'],'switch')
        text=table(('Coop','All','✔','[[Scav]] + PMC')).replace('[[Scav]] + PMC\n|\n','[[Scav]] + PMC\n')
        self.assertEqual(len(etl.parse_extract_tables(text)),1)

    def test_distinct_raw_switch_link_conflicting_with_wiki_is_not_silently_discarded(self):
        result=self.build('fixture',[('Gate','pmc',{'switch':'power'})],table(('Gate','PMC','✔','-')),
                          [{'id':'power','name':'Power','position':{'x':1,'z':1}}])[0]
        self.assertEqual(result['requirement'],'other')
        self.assertIn('Switch link conflicts with wiki requirements',result['unclassified'])

    def test_transits_keep_transit_type_coordinates_and_explicit_delay(self):
        norm=etl.Normalizer.__new__(etl.Normalizer)
        norm.tr,norm.mode=etl.Tr({'to-woods':'Transit to Woods'}),'regular'
        m={'normalizedName':'fixture','wiki':'https://escapefromtarkov.fandom.com/wiki/Fixture','extracts':[],
           'transits':[{'id':'7','description':'to-woods','position':{'x':10,'z':20}}]}
        text=table(('Transit to Woods','All','✔','Only available 1 min after raid start')).replace('Extractions','Transits')
        with patch.object(etl,'fetch_extract_wiki',return_value={'parse':{'wikitext':{'*':text}}}):
            result=norm.build_extracts(m,etl.Frame([(0,0),(100,100)],pad=0),lambda p:(p['x'],p['z']))[0]
        self.assertEqual((result['type'],result['requirement'],result['alwaysOpen']),('transit','other',True))
        self.assertEqual((result['x'],result['y']),(100,800))
        self.assertIn('after 1 minute',result['note'])

    def test_cache_shared_raw_response_refresh_is_explicit_network_failures_retry_and_offline_has_no_network(self):
        with tempfile.TemporaryDirectory() as folder:
            cache=Path(folder)
            body=json.dumps({'parse':{'wikitext':{'*':table(('Crossroads','All','✔','-'))}}}).encode()
            with patch.object(etl.urllib.request,'urlopen',side_effect=lambda *a,**k: io.BytesIO(body)) as fetch, \
                    patch.object(etl.time,'sleep') as sleep, patch.object(etl.time,'monotonic',return_value=100), \
                    patch.object(etl,'_EXTRACT_LAST_REQUEST',0):
                etl.fetch_extract_wiki('Customs',cache=cache)
                etl.fetch_extract_wiki('Customs',cache=cache)
                self.assertEqual(fetch.call_count,1)
                self.assertEqual((cache/'customs.json').read_bytes(),body)
                etl.fetch_extract_wiki('Customs',cache=cache,refresh=True)
                self.assertEqual(fetch.call_count,2)
                self.assertEqual(sleep.call_args.args,(1,))
                etl.fetch_extract_wiki('Reserve',cache=cache,offline=True)
                self.assertEqual(fetch.call_count,2)
            with patch.object(etl.urllib.request,'urlopen',side_effect=OSError('offline')) as fetch, patch.object(etl.time,'sleep'):
                self.assertIn('error',etl.fetch_extract_wiki('Missing',cache=cache))
                self.assertIn('error',etl.fetch_extract_wiki('Missing',cache=cache))
                # CI never refreshes, so a network failure must not be cached: each run retries it.
                self.assertEqual(fetch.call_count,2)
                self.assertFalse((cache/'missing.json').exists())


if __name__ == '__main__':
    unittest.main()
