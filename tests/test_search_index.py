import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import build_page as pages
import check_site


class SearchIndexTests(unittest.TestCase):
    def fixture(self, root, mode):
        prefix = '' if mode == 'regular' else 'pve'
        base = root / 'data' / prefix
        (base / 'maps').mkdir(parents=True)
        tasks = {'a': {'name':'Alpha','trader':'Prapor','faction':'Any'},
                 'multi': {'name':'Shared quest','trader':'Therapist','faction':'Any'},
                 'unmapped': {'name':'No map quest','trader':'Skier','faction':'BEAR'},
                 'placeholder': {'name':'New quest','trader':'Various','faction':'Any','placeholder':True}}
        (base / 'tasks-index.json').write_text(json.dumps(tasks))
        rows=[]
        for key,name in [('customs','Customs'),('woods','Woods')]:
            quests=[{'id':'multi','name':'Shared quest','onMap':False,'minLevel':10,'kappa':False}]
            if key=='customs': quests.append({'id':'short-id','bsgId':'a','onMap':True,'minLevel':5,'kappa':True})
            data={'meta':{'gameMode':mode},'quests':quests}
            (base / 'maps' / (key+'.json')).write_text(json.dumps(data))
            rows.append({'key':key,'name':name,'file':key+'.json'})
            target=root/'dist'/prefix/'maps'/(key+'.html')
            target.parent.mkdir(parents=True,exist_ok=True)
            target.write_text('<html/>')
        (base/'maps'/'index.json').write_text(json.dumps({'maps':rows,'mode':mode}))
        return {'a':{'minPlayerLevel':5,'kappaRequired':True,'lightkeeperRequired':False,'wikiLink':'https://example.com/alpha'},
                'multi':{'minPlayerLevel':10,'kappaRequired':False,'lightkeeperRequired':True,'wikiLink':'https://example.com/multi'},
                'unmapped':{'minPlayerLevel':24,'factionName':'BEAR','wikiLink':'https://example.com/unmapped',
                            'kappaRequired':False,'lightkeeperRequired':True}}

    def test_two_map_build_preserves_all_tasks_metadata_and_membership_in_both_modes(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(pages,'ROOT',Path(folder)):
            root=Path(folder)
            for mode in ['regular','pve']:
                raw=self.fixture(root,mode)
                if mode=='pve':raw['a']['minPlayerLevel']=42
                rows=pages.build_search_index(mode,raw)
                self.assertEqual(len(rows),4)
                self.assertEqual([r['name'] for r in rows],['Alpha','New quest','No map quest','Shared quest'])
                by_id={r['id']:r for r in rows}
                self.assertEqual(set(rows[0]), {'id','name','trader','kappa','lightkeeper','minLevel','faction','wiki','placeholder','effort','maps'})
                self.assertEqual(by_id['a']['minLevel'],42 if mode=='pve' else 5)
                self.assertTrue(by_id['a']['kappa'])
                self.assertEqual(by_id['a']['wiki'],'https://example.com/alpha')
                self.assertTrue(by_id['a']['maps'][0]['onMap'])
                multi=by_id['multi']
                self.assertEqual([m['key'] for m in multi['maps']],['customs','woods'])
                self.assertTrue(all(not m['onMap'] for m in multi['maps']))
                self.assertTrue(multi['lightkeeper'])
                self.assertEqual(by_id['unmapped']['maps'],[])
                self.assertEqual(by_id['unmapped']['minLevel'],24)
                self.assertEqual(by_id['unmapped']['faction'],'BEAR')
                self.assertTrue(by_id['placeholder']['placeholder'])
                self.assertEqual(by_id['placeholder']['maps'],[])
                self.assertIsNone(by_id['placeholder']['wiki'])
                self.assertIsNone(by_id['placeholder']['minLevel'])
                prefix='' if mode=='regular' else 'pve/'
                self.assertEqual(multi['maps'][0]['href'],prefix+'maps/customs.html')
                body=(root/'dist'/prefix/'search-index.json').read_text()
                self.assertNotIn('\n',body)
                self.assertEqual(json.loads(body),rows)
            self.assertEqual(json.loads((root/'dist/search-index.json').read_text())[0]['minLevel'],5)
            check_site.check_search_indexes(root/'dist')

    def test_search_checker_requires_both_indexes_and_rejects_invalid_json_and_bad_links(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            with self.assertRaisesRegex(ValueError,'missing'):check_site.check_search_indexes(root)
            (root/'search-index.json').write_text('[]')
            (root/'pve').mkdir()
            (root/'pve/search-index.json').write_text('not JSON')
            with self.assertRaisesRegex(ValueError,'invalid search JSON'):check_site.check_search_indexes(root)
            for href in ['maps/missing.html','../escape.html','/absolute.html','https://example.com/index.html','%2e%2e/escape.html']:
                (root/'pve/search-index.json').write_text(json.dumps([{'id':'a','maps':[{'href':href}]}]))
                with self.assertRaisesRegex(ValueError,'broken search href'):check_site.check_search_indexes(root)

    def test_search_rejects_wrong_mode_map_data(self):
        with tempfile.TemporaryDirectory() as folder,patch.object(pages,'ROOT',Path(folder)):
            root=Path(folder);raw=self.fixture(root,'pve')
            path=root/'data/pve/maps/customs.json'
            data=json.loads(path.read_text());data['meta']['gameMode']='regular';path.write_text(json.dumps(data))
            with self.assertRaisesRegex(ValueError,'mode mismatch'):pages.build_search_index('pve',raw)


if __name__ == '__main__':
    unittest.main()
