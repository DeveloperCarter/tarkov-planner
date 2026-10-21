"""Inject a map's quest data into the page template.

Works for the hand-built plan (data/customs-quests.json) and for any generated map
(data/maps/<map>.json). Profile options tailor a generated map to one player.

Usage:
    python scripts/build_page.py                                   # hand-built Customs plan
    python scripts/build_page.py data/maps/woods.json dist/woods.html --level 24 --faction USEC
    python scripts/build_page.py --all --level 24 --faction USEC   # every generated map -> dist/maps/
"""
import argparse
import datetime as dt
import html as html_lib
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "page" / "customs-raid-plan.template.html"
PROGRESS = ROOT / "page" / "quest-progress.js"
PROGRESSION = ROOT / "data" / "progression.json"
TRACKER = ROOT / "page" / "eft-log-tracker.js"
STORE = ROOT / "page" / "progress-store.js"
FOCUS = ROOT / "page" / "raid-focus.js"
TASKS_INDEX = ROOT / "data" / "tasks-index.json"


def relative_url(target: Path, page: Path) -> str:
    return os.path.relpath(target, page.parent).replace(os.sep, "/")


def navigation(out_path: Path, mode: str, key: str = "customs") -> str:
    home = relative_url(ROOT / "dist" / "index.html", out_path)
    links = [("All maps", home + "?mode=" + mode),
             ("PvP", relative_url(ROOT / "dist" / "maps" / f"{key}.html", out_path)),
             ("PvE", relative_url(ROOT / "dist" / "pve" / "maps" / f"{key}.html", out_path))]
    return '<nav class="site-nav" aria-label="Maps and mode">' + ''.join(
        f'<a href="{html_lib.escape(url, quote=True)}"' +
        (' aria-current="true"' if label == ('PvE' if mode == 'pve' else 'PvP') else '') +
        f'>{label}</a>' for label, url in links) + '<button class="btn" id="themeToggle" type="button">Theme: system</button></nav>'


def styles() -> str:
    return TEMPLATE.read_text(encoding="utf-8").split('<style>', 1)[1].split('</style>', 1)[0]


def theme_script() -> str:
    return (ROOT / 'page' / 'theme.template.js').read_text(encoding='utf-8')


def build(data_path: Path, out_path: Path, level: int | None = None, faction: str | None = None) -> None:
    data = json.loads(data_path.read_text(encoding="utf-8"))
    apply_profile(data, level, faction)
    attach_task_ids(data)
    validate(data)
    if not PROGRESSION.exists():
        sys.exit("data/progression.json missing; run python scripts/build_progression.py first")
    mode = data["meta"].get("gameMode", "regular")
    progression_path = PROGRESSION if mode == "regular" else ROOT / "data" / "pve" / "progression.json"
    progression = json.loads(progression_path.read_text(encoding="utf-8"))
    # All tasks are needed: a started quest on another map can imply this map's history.
    data["progression"] = {tid: {**t, "requirements": [
        {k: v for k, v in r.items() if k != "source"} for r in t["requirements"]]}
        for tid, t in progression.items()}
    missing = [q["name"] for q in data["quests"] if (q.get("bsgId") or q["id"]) not in progression]
    if missing:
        sys.exit("quests missing progression: " + ", ".join(missing))
    data["meta"]["sources"].append({"name": "Escape from Tarkov Wiki progression (CC BY-SA)",
        "url": "https://escapefromtarkov.fandom.com/wiki/Quests", "use": "Prerequisite facts; merged with tarkov.dev"})
    for t in data["progression"].values():
        if not t.get("unresolved"): t.pop("unresolved", None)
        if not t["requirements"]: del t["requirements"]
        if not t["traderRequirements"]: del t["traderRequirements"]
        if not t["restartable"]: del t["restartable"]
        if t["faction"] == "Any": del t["faction"]
        if t["minLevel"] == 1: del t["minLevel"]
    # "</" inside a JSON string would close the <script> tag early.
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    html = TEMPLATE.read_text(encoding="utf-8")
    html = html.replace("<title>Customs Raid Plan</title>", f"<title>{data['meta']['map']} Raid Plan</title>", 1)
    html = html.replace("/*__TRACKER__*/", TRACKER.read_text(encoding="utf-8").replace("</", "<\\/"), 1)
    html = html.replace("/*__STORE__*/", STORE.read_text(encoding="utf-8").replace("</", "<\\/"), 1)
    html = html.replace("/*__FOCUS__*/", FOCUS.read_text(encoding="utf-8").replace("</", "<\\/"), 1)
    html = html.replace("/*__PROGRESS__*/", PROGRESS.read_text(encoding="utf-8").replace("</", "<\\/"), 1)
    html = html.replace("/*__DATA__*/null", payload, 1)
    html = html.replace("<!--__SITE_NAV__-->", navigation(out_path, mode, data['meta'].get('key', 'customs')), 1)
    html = html.replace("/*__THEME__*/", theme_script(), 1)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(html, encoding="utf-8")
    print(f"wrote {out_path.relative_to(ROOT) if out_path.is_relative_to(ROOT) else out_path} ({len(html) // 1024} KB)")


def apply_profile(data: dict, level: int | None, faction: str | None) -> None:
    """Set build defaults; availability and faction gating happen in the browser."""
    player = data["meta"].setdefault("player", {})
    if level is not None:
        player["level"] = level
    player.setdefault("level", 1)
    if faction:
        player["faction"] = faction.upper()
    player.setdefault("faction", "USEC")


def attach_task_ids(data: dict) -> None:
    """Log tracking keys on BSG quest IDs. Generated maps already use them; the hand-built plan
    uses short IDs, so match those by name. Also ship every task's name for the event list."""
    index_path = TASKS_INDEX if data['meta'].get('gameMode', 'regular') == 'regular' else ROOT / 'data' / 'pve' / 'tasks-index.json'
    if not index_path.exists():
        print("note: data/tasks-index.json missing; run the ETL so log tracking can name quests", file=sys.stderr)
        return
    index = json.loads(index_path.read_text(encoding="utf-8"))
    data["taskNames"] = {tid: t["name"] for tid, t in index.items()}
    # Quests from the logs that tarkov.dev doesn't list yet: no map, so the page lists them apart.
    data["placeholders"] = {tid: t["trader"] for tid, t in index.items() if t.get("placeholder") and not t.get("repeatable")}
    side = data["meta"].get("player", {}).get("faction")
    by_name = {}
    for tid, t in index.items():
        if t["faction"] in ("Any", side) or side is None:
            by_name.setdefault(t["name"].lower(), tid)
    for q in data["quests"]:
        if q["id"] in index:
            continue
        tid = by_name.get(q["name"].lower())
        if tid:
            q["bsgId"] = tid
        else:
            print(f"note: no BSG ID for {q['name']!r}; log tracking can't update it", file=sys.stderr)


def validate(data: dict) -> None:
    """Catch broken references before they become blank spots on the page."""
    zones = set(data["zones"])
    extracts = {e["id"] for e in data["extracts"]}
    quests = {q["id"] for q in data["quests"]}
    objectives = {o["id"] for q in data["quests"] for o in q["objectives"]}
    errors = []
    for q in data["quests"]:
        for o in q["objectives"]:
            errors += [f"{o['id']}: unknown zone {z}" for z in o.get("zone", []) if z not in zones]
    for r in data["raids"]:
        errors += [f"raid {r['id']}: unknown quest {q}" for q in r["quests"] if q not in quests]
        errors += [f"raid {r['id']}: unknown extract {e}" for e in r["extract"] if e not in extracts]
        for s in r["stops"]:
            if s["zone"] not in zones:
                errors.append(f"raid {r['id']}: unknown zone {s['zone']}")
            errors += [f"raid {r['id']}: unknown objective {o}" for o in s["obj"] if o not in objectives]
    for a in data["acquisition"]:
        errors += [f"{a['item']}: unknown quest {q}" for q in a["for"] if q not in quests]
    if errors:
        sys.exit("data errors:\n  " + "\n  ".join(errors))


def build_home(level: int, faction: str, max_age_hours: float | None = None) -> None:
    data = {"built": dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'),
            "player": {"level": level, "faction": faction.upper()}, "modes": {}}
    for mode in ('regular', 'pve'):
        base = ROOT / 'data' / ('' if mode == 'regular' else 'pve')
        index = json.loads((base / 'maps' / 'index.json').read_text(encoding='utf-8'))
        if index['mode'] != mode:
            raise ValueError(f'{mode}: mismatched map index mode')
        at = dt.datetime.fromisoformat(index['snapshot'])
        if max_age_hours is not None and (dt.datetime.now(dt.timezone.utc) - at).total_seconds() > max_age_hours * 3600:
            raise ValueError(f'{mode}: cached snapshot is older than {max_age_hours:g} hours; refusing to publish stale data')
        maps = []
        for row in sorted(index['maps'], key=lambda r: r['name']):
            source = json.loads((base / 'maps' / row['file']).read_text(encoding='utf-8'))
            if source['meta']['gameMode'] != mode or source['meta']['snapshot'] != index['snapshot']:
                raise ValueError(f'{mode}/{row["key"]}: snapshot or mode does not match the index')
            maps.append({"name": row['name'], "key": row['key'], "ids": [q.get('bsgId', q['id']) for q in source['quests']],
                         "onMap": [q.get('bsgId', q['id']) for q in source['quests'] if q.get('onMap', True)],
                         "href": ('' if mode == 'regular' else 'pve/') + 'maps/' + row['key'] + '.html'})
        data['modes'][mode] = {"snapshot": index['snapshot'], "maps": maps,
                               "progression": json.loads((base / 'progression.json').read_text(encoding='utf-8'))}
    text = (ROOT / 'page' / 'home.template.html').read_text(encoding='utf-8')
    for marker, path in [('TRACKER', TRACKER), ('PROGRESS', PROGRESS), ('STORE', STORE), ('HOME', ROOT / 'page' / 'map-home.js')]:
        text = text.replace('/*__' + marker + '__*/', path.read_text(encoding='utf-8').replace('</', '<\\/'), 1)
    text = text.replace('/*__STYLES__*/', styles(), 1).replace('/*__THEME__*/', theme_script(), 1)
    text = text.replace('/*__DATA__*/null', json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/'), 1)
    (ROOT / 'dist').mkdir(exist_ok=True)
    (ROOT / 'dist' / 'index.html').write_text(text, encoding='utf-8')
    (ROOT / 'dist' / '.nojekyll').touch()
    print('wrote dist/index.html (PvP + PvE)')


def build_maps(mode: str, level: int | None, faction: str | None) -> None:
    base = '' if mode == 'regular' else 'pve'
    for path in sorted((ROOT / 'data' / base / 'maps').glob('*.json')):
        if path.name != 'index.json':
            build(path, ROOT / 'dist' / base / 'maps' / f'{path.stem}.html', level, faction)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("data", nargs="?", default=str(ROOT / "data" / "customs-quests.json"))
    ap.add_argument("out", nargs="?", default=str(ROOT / "dist" / "customs-raid-plan.html"))
    ap.add_argument("--all", action="store_true", help="build every map in data/maps into dist/maps")
    ap.add_argument("--mode", default="regular", choices=["regular", "pve"])
    ap.add_argument("--site", action="store_true", help="build the home page and all PvP/PvE map pages")
    ap.add_argument("--max-age-hours", type=float, help="with --site, refuse snapshots older than this")
    ap.add_argument("--level", type=int)
    ap.add_argument("--faction", choices=["USEC", "BEAR", "usec", "bear"])
    args = ap.parse_args()
    if args.site:
        build_home(args.level or 1, args.faction or 'USEC', args.max_age_hours)
        for mode in ('regular', 'pve'):
            build_maps(mode, args.level, args.faction)
    elif args.all:
        build_maps(args.mode, args.level, args.faction)
    else:
        build(Path(args.data), Path(args.out), args.level, args.faction)
