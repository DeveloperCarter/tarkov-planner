"""Bring-list quantities must cover every selected placement objective."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from etl_tarkov_dev import Normalizer, Tr


class RaidNeedsTests(unittest.TestCase):
    def test_separate_placements_sum_but_alternative_items_and_reusable_weapons_do_not(self):
        norm = Normalizer.__new__(Normalizer)
        norm.tr = Tr({})
        norm.items = {name: {'name': name} for name in ['Camera', 'Pack A', 'Pack B', 'Rifle']}
        norm.quest_items, norm.traders, norm.task_names, norm.base_map = {}, {}, {}, {}
        objectives = [{'id': f'camera-{i}', 'type': 'plantItem', 'items': ['Camera']} for i in range(4)]
        objectives += [{'id': 'ammo', 'type': 'plantItem', 'items': ['Pack A', 'Pack B'], 'count': 2}]
        objectives += [{'id': f'kills-{i}', 'type': 'shoot', 'usingWeapon': ['Rifle'], 'count': 10} for i in range(2)]
        task = {'id': 'q', 'name': 'Quest', 'trader': 'Trader', 'map': 'customs', 'objectives': objectives}
        quest = norm.build_quest(task, 'customs', lambda p: p)
        self.assertTrue(quest['onMap'])
        multi = {**task, 'map': None, 'objectives': [{**o, 'maps': ['customs']} for o in objectives]}
        self.assertFalse(norm.build_quest(multi, 'customs', lambda p: p)['onMap'], 'multi-map quests have no task map')
        needs = quest['needs']
        # Rewards for sorting: dollars at their trader rate, items at their recent flea price.
        norm.items.update({'5696686a4bdc2da3298b456a': {'name': 'Dollars', 'basePrice': 122},
                           'Case': {'name': 'Case', 'avg24hPrice': 1000, 'basePrice': 5}})
        paid = norm.build_quest({**task, 'experience': 5000, 'finishRewards': {'items': [{'item': '5696686a4bdc2da3298b456a', 'count': 100},
            {'item': 'Case', 'count': 2}], 'traderStanding': [{'trader': 'T', 'standing': 0.1}]}}, 'customs', lambda p: p)
        self.assertEqual(paid['rewards'], {'xp': 5000, 'roubles': 12200, 'itemValue': 2000, 'rep': [{'trader': 'T', 'standing': 0.1}]})
        self.assertEqual({n['item']: n['qty'] for n in needs},
                         {'Camera': 4, 'Any of: Pack A, Pack B': 2, 'Rifle': 1})
