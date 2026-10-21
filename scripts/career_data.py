"""Compact all-quest facts shared by the Keep and Kappa views; no network requests."""
from etl_tarkov_dev import Tr


def keep_requirements(task, items, translate):
    """A find/hand-over pair consumes one set. Alternative items remain one choice."""
    objectives = [o for o in task.get('objectives', []) if not o.get('optional')
                  and o.get('type') in ('findItem', 'giveItem') and o.get('items')]
    signature = lambda o: tuple(sorted(set(o['items'])))
    gives = {signature(o) for o in objectives if o['type'] == 'giveItem'}
    finds = {signature(o) for o in objectives if o['type'] == 'findItem' and o.get('foundInRaid')}
    results = []
    for o in objectives:
        key = signature(o)
        if o['type'] == 'findItem' and key in gives:
            continue
        if not o.get('foundInRaid') and key not in finds:
            continue
        count = o.get('count')
        results.append({'id': o['id'], 'count': count if isinstance(count, (int, float)) and count > 0 else None,
                        'items': [{'id': iid, 'name': translate(items[iid]['name']) if iid in items else iid}
                                  for iid in key],
                        'note': translate(o.get('description', ''))})
    return results


def catalog(mode, raw, search, progression, wiki_flag):
    translate = Tr(raw['lang'])
    tasks = raw['tasks']['tasks']
    rows = []
    for row in search:
        task = tasks.get(row['id'], {})
        rows.append({**{k: row[k] for k in ('id', 'name', 'trader', 'faction', 'minLevel', 'wiki', 'maps')},
                     # No fallback: an absent wiki page must remain reviewable, not silently counted.
                     'kappa': wiki_flag(row['id']),
                     'collector': task.get('normalizedName') == 'collector',
                     'keep': keep_requirements(task, raw['items']['items'], translate)})
    return {'mode': mode, 'tasks': rows, 'progression': progression}
