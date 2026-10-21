"""Build quest progression from the local tarkov.dev snapshot and cached wiki responses.

Every unique wiki URL is requested once, at most once per second. Cached responses
(including errors) are never refetched without --refresh. Python standard library only.
"""
import argparse
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path
from etl_tarkov_dev import ROOT, UA, latest_snapshot, load_snapshot, Tr


def previous_field(wikitext):
    box = re.search(r'\{\{Infobox quest\b(.*?)\n\}\}', wikitext, re.S | re.I)
    if not box:
        return ''
    field = re.search(r'^\|\s*previous\s*=(.*?)(?=^\|\s*[^\n=]+\s*=|\Z)', box[1], re.S | re.M | re.I)
    return field[1].strip() if field else ''


def previous_links(field):
    """Keep link targets, including multiline/labelled links; Accept applies per clause."""
    result = []
    for clause in re.split(r'<br\s*/?>|\n|;', field, flags=re.I):
        end = 0
        accept = False
        for match in re.finditer(r'\[\[([^\]|]+)(?:\|([^\]]*))?\]\]', clause):
            prefix = re.sub(r'<[^>]+>', '', clause[end:match.start()])
            if re.search(r'\baccept\b', prefix, re.I):
                accept = True
            elif re.search(r'\bcomplete\b', prefix, re.I):
                accept = False
            label = match[2] or ''
            result.append((match[1].split('#')[0].strip(), ['active', 'complete'] if accept or re.search(r'\baccept\b', label, re.I) else ['complete']))
            end = match.end()
    return result


def key(name):
    name = urllib.parse.unquote(name).replace('_', ' ').strip().casefold()
    return re.sub(r'\s+\(quest\)$', '', name)


def resolve_cycles(tasks, names):
    """Wiki completion chains can expose stale dev-only edges. Never ship a cycle."""
    conflicts = []
    while True:
        visited, path, edges = set(), [], []
        def visit(tid):
            if tid in path:
                return edges[path.index(tid):]
            if tid in visited:
                return None
            visited.add(tid)
            path.append(tid)
            for requirement in tasks[tid]['requirements']:
                if requirement.get('anyOf') or requirement['statuses'] != ['complete']:
                    continue
                edges.append((tid, requirement))
                found = visit(requirement['task'])
                if found:
                    return found
                edges.pop()
            path.pop()
            return None
        cycle = next((cycle for tid in tasks if (cycle := visit(tid))), None)
        if not cycle:
            return conflicts
        removable = [(tid, r) for tid, r in cycle if r['source'] == 'tarkov.dev']
        if not removable:
            raise ValueError('Completion cycle without a dev-only edge; review wiki data: ' +
                             ' -> '.join(names[tid] for tid, r in cycle))
        tid, requirement = removable[0]
        tasks[tid]['requirements'].remove(requirement)
        conflicts.append((names[tid], 'completion cycle: excluded dev-only edge',
                          names[requirement['task']] + ': complete; cycle: ' +
                          ' -> '.join(names[i] for i, r in cycle) + ' -> ' + names[cycle[0][0]]))


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--refresh', action='store_true')
    ap.add_argument('--mode', default='regular', choices=['regular', 'pve'])
    ap.add_argument('--out', type=Path, help='progression output (defaults to the selected mode)')
    ap.add_argument('--report', type=Path, help='conflict report output')
    args = ap.parse_args()
    snapshot = latest_snapshot(args.mode)
    raw = load_snapshot(snapshot)
    tr = Tr(raw['lang'])
    tasks = raw['tasks']['tasks']
    cache = ROOT / 'raw' / 'wiki'
    cache.mkdir(parents=True, exist_ok=True)
    index_path = cache / 'index.json'
    cached_index = json.loads(index_path.read_text(encoding='utf-8')) if index_path.exists() else {}
    response_by_url = {row['url']: row['response'] for row in cached_index.values()}
    used_responses = {}
    pages, last_request = {}, 0
    urls = {}
    for tid, task in tasks.items():
        urls.setdefault(task.get('wikiLink') or 'https://escapefromtarkov.fandom.com/wiki/' + tr(task['name']).replace(' ', '_'), []).append(tid)
    for number, (url, ids) in enumerate(urls.items(), 1):
        # A PvE task may use a different ID for the same wiki URL. Share its raw response.
        path = cache / response_by_url.get(url, ids[0] + '.json')
        used_responses[url] = path.name
        if args.refresh or not path.exists():
            time.sleep(max(0, 1 - (time.monotonic() - last_request)))
            title = urllib.parse.unquote(url.split('/wiki/')[-1]).replace('_', ' ')
            query = urllib.parse.urlencode({'action': 'parse', 'page': title, 'prop': 'wikitext', 'redirects': 1, 'format': 'json'})
            last_request = time.monotonic()
            try:
                request = urllib.request.Request('https://escapefromtarkov.fandom.com/api.php?' + query, headers={'User-Agent': UA})
                with urllib.request.urlopen(request, timeout=30) as response:
                    body = response.read()
                # Store the raw response, without stripping or rewriting its wikitext.
                path.write_bytes(body)
            except Exception as exc:
                path.write_text(json.dumps({'error': {'info': str(exc)}}), encoding='utf-8')
            print(f'wiki {number}/{len(urls)}: {title}', flush=True)
        try:
            page = json.loads(path.read_text(encoding='utf-8'))
        except (ValueError, UnicodeError):
            page = {'error': {'info': 'Cached response is not JSON; inspect raw/wiki and use --refresh to retry'}}
        for tid in ids:
            pages[tid] = page
    cached_index.update({tid: {'url': url, 'response': used_responses[url]}
        for url, ids in urls.items() for tid in ids})
    index_path.write_text(json.dumps(cached_index, indent=1), encoding='utf-8')
    names = {}
    for tid, task in tasks.items():
        for name in [tr(task['name']), task.get('wikiLink', '').split('/wiki/')[-1], pages[tid].get('parse', {}).get('title', '')]:
            if name:
                names.setdefault(key(name), set()).add(tid)
    conflicts, output = [], {}
    for tid, task in tasks.items():
        name = tr(task['name'])
        page = pages[tid]
        if 'error' in page:
            conflicts.append((name, 'wiki fetch error', str(page['error'])))
        field = previous_field(page.get('parse', {}).get('wikitext', {}).get('*', ''))
        wiki, groups, unresolved = {}, {}, []
        dev = {r['task']: r['status'] for r in task.get('taskRequirements', [])}
        # A standalone "or" is an alternative group, not two mandatory completions.
        alternative = bool(re.search(r'\bor\b', re.sub(r'\[\[.*?\]\]', '', field), re.I))
        for target, statuses in previous_links(field):
            candidates = names.get(key(target), set())
            compatible = [i for i in candidates if tasks[i].get('factionName', 'Any') in ('Any', task.get('factionName', 'Any'))]
            candidates = compatible or list(candidates)
            # Exact task IDs from the structured source disambiguate duplicate names.
            matched_dev = set(candidates) & dev.keys()
            if len(candidates) > 1 and len(matched_dev) == 1:
                candidates = list(matched_dev)
            if set(candidates) == {tid}:
                unresolved.append(target + ' (see wiki requirements)')
                conflicts.append((name, 'wiki section requirement', target + ': self-link is a section pointer, not a prerequisite'))
                continue
            if len(candidates) > 1 and {tasks[i].get('factionName') for i in candidates} == {'USEC', 'BEAR'}:
                for candidate in sorted(candidates):
                    wiki[candidate] = statuses
                    groups[candidate] = 'faction:' + key(target)
                conflicts.append((name, 'wiki faction variants', target + ': either faction-specific task ID'))
                continue
            if len(candidates) != 1:
                unresolved.append(target)
                conflicts.append((name, 'unresolved wiki link', target + f' ({len(candidates)} matching IDs); kept locked for review'))
                continue
            wiki[candidates[0]] = statuses
        requirements = []
        for reqid in sorted(dev.keys() | wiki.keys()):
            source = 'both' if reqid in dev and reqid in wiki else 'tarkov.dev' if reqid in dev else 'wiki'
            # Structured dev statuses preserve active/failed branching. Wiki fills missing edges.
            statuses = dev.get(reqid, wiki.get(reqid))
            requirement = {'task': reqid, 'statuses': statuses, 'source': source}
            if reqid in groups:
                requirement['anyOf'] = groups[reqid]
            elif alternative and reqid in wiki:
                requirement['anyOf'] = 'wiki-previous'
            requirements.append(requirement)
            reqname = tr(tasks[reqid]['name']) if reqid in tasks else reqid
            if source != 'both':
                conflicts.append((name, source + '-only prerequisite', f'{reqname}: {", ".join(statuses)}'))
            elif set(dev[reqid]) != set(wiki[reqid]):
                conflicts.append((name, 'status disagreement', f'{reqname}: tarkov.dev {dev[reqid]}, wiki {wiki[reqid]}; using tarkov.dev'))
        unknown = [r for r in task.get('otherRequirements', []) if r.get('type') == 'globalVariable']
        if unknown:
            conflicts.append((name, 'opaque globalVariable', f'{len(unknown)} condition(s); no unlock meaning supplied, not used as a gate'))
        traders = []
        for r in task.get('traderRequirements', []):
            trader = r['trader']
            traders.append({'trader': tr(raw['traders'][trader]['name']), 'type': r['requirementType'], 'value': r['value'], 'compare': r['compareMethod']})
        output[tid] = {'requirements': requirements, 'unresolved': unresolved, 'minLevel': task.get('minPlayerLevel', 1), 'traderRequirements': traders,
                       'faction': task.get('factionName', 'Any'), 'restartable': task.get('restartable', False)}
    conflicts += resolve_cycles(output, {tid: tr(t['name']) for tid, t in tasks.items()})
    output_path = args.out or ROOT / 'data' / ('' if args.mode == 'regular' else 'pve') / 'progression.json'
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(output, ensure_ascii=False, indent=1), encoding='utf-8')
    lines = ['# Progression conflicts', '', f'Snapshot: {snapshot.name} ({args.mode}). {len(tasks)} tasks, {len(urls)} cached wiki responses.', '',
             'Policy: add missing wiki edges; keep tarkov.dev statuses on overlapping edges (active/failed branches). A dev-only completion edge is excluded if it creates a cycle with the wiki chain. Other completion cycles fail the build for review. Trader loyalty is annotation only. Opaque globalVariable gates are reported, not guessed. Unresolved wiki prerequisites stay locked for review; self-links to requirement sections are not completion edges.', '',
             '| Quest | Conflict | Detail |', '|---|---|---|']
    lines += ['| ' + ' | '.join(str(v).replace('|', '\\|').replace('\n', ' ') for v in row) + ' |' for row in conflicts]
    report_path = args.report or ROOT / 'reports' / ('progression-conflicts.md' if args.mode == 'regular' else 'progression-conflicts-pve.md')
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(f'Built {len(output)} tasks; {len(conflicts)} conflicts')


if __name__ == '__main__':
    main()
