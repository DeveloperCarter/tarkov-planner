"""Snapshot tarkov.dev's data and normalize it into one planner JSON per map.

Source: json.tarkov.dev, the static JSON the tarkov.dev site itself reads. It stays up
when the GraphQL API (api.tarkov.dev) is down. Map labels and coordinate rotation come
from the tarkov-dev repo's src/data/maps.json (MIT).

Each run saves the raw files under snapshot/<mode>/<date>/ with a manifest. If fetching
fails, the newest complete snapshot is used instead, so the pipeline still runs offline.

Usage:
    python scripts/etl_tarkov_dev.py                 # fetch today's snapshot, write data/maps/*.json
    python scripts/etl_tarkov_dev.py --offline       # use the newest saved snapshot
    python scripts/etl_tarkov_dev.py --mode pve
"""
import argparse
import datetime as dt
import hashlib
import json
import math
import re
import tempfile
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
JSON_HOST = "https://json.tarkov.dev"
SITE_MAPS = "https://raw.githubusercontent.com/the-hideout/tarkov-dev/main/src/data/maps.json"
# Cloudflare serves a bot-check page to bare or short user agents.
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
DATASETS = ["tasks", "maps", "items", "traders", "barters", "crafts", "hideout"]
TRANSLATED = ["tasks", "maps", "items", "traders", "hideout"]
# Maps that share another map's layout and quests; skip them as separate outputs.
SKIP_MAPS = {"night-factory", "ground-zero-21", "ground-zero-tutorial", "the-lab-dark"}
FRAME_W = 1000
FRAME_MAX_H = 1400


# ---------------------------------------------------------------- snapshot

def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=90) as resp:
        body = resp.read()
    if not body.lstrip().startswith((b"{", b"[")):
        raise ValueError(f"{url} did not return JSON (bot check or outage?)")
    return body


def take_snapshot(mode: str) -> Path:
    day = dt.date.today().isoformat()
    base = ROOT / "snapshot" / mode
    base.mkdir(parents=True, exist_ok=True)
    # Never overwrite the last complete snapshot while a refresh is in flight.
    out = Path(tempfile.mkdtemp(prefix="pending-", dir=base))
    targets = {f"{n}.json": f"{JSON_HOST}/{mode}/{n}" for n in DATASETS}
    targets |= {f"{n}_en.json": f"{JSON_HOST}/{mode}/{n}_en" for n in TRANSLATED}
    targets["site-maps.json"] = SITE_MAPS
    files = {}
    for name, url in targets.items():
        body = fetch(url)
        (out / name).write_bytes(body)
        files[name] = {"url": url, "bytes": len(body), "sha256": hashlib.sha256(body).hexdigest()}
        print(f"  {name:20} {len(body) // 1024:>7} KB", file=sys.stderr)
    manifest = {"mode": mode, "fetchedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "files": files}
    # The manifest is written last, so its presence marks a complete snapshot.
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    target = base / (day + "T" + dt.datetime.now(dt.timezone.utc).strftime("%H%M%S%f"))
    out.rename(target)
    return target


def latest_snapshot(mode: str) -> Path:
    base = ROOT / "snapshot" / mode
    complete = sorted(p for p in base.glob("*") if not p.name.startswith("pending-") and (p / "manifest.json").exists()) if base.exists() else []
    if not complete:
        sys.exit(f"no complete snapshot under {base}; run once without --offline")
    return complete[-1]


def load_snapshot(path: Path) -> dict:
    def read(name):
        return json.loads((path / name).read_text(encoding="utf-8"))
    raw = {n: read(f"{n}.json")["data"] for n in DATASETS}
    raw["lang"] = {}
    for n in TRANSLATED:
        raw["lang"].update(read(f"{n}_en.json")["data"])
    raw["siteMaps"] = read("site-maps.json")
    raw["manifest"] = read("manifest.json")
    return raw


# ---------------------------------------------------------------- helpers

class Tr:
    """tarkov.dev ships text as translation keys. Look a key up, falling back to the key."""

    def __init__(self, lang: dict):
        self.lang = lang

    def __call__(self, key):
        if key is None:
            return None
        value = self.lang.get(key)
        return value if value else key


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def compass(origin: tuple[float, float], target: tuple[float, float]) -> str:
    angle = math.degrees(math.atan2(target[0] - origin[0], target[1] - origin[1])) % 360
    return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][round(angle / 45) % 8]


def rotate(pos: dict, rotation: int) -> tuple[float, float]:
    """Game (x, z) -> (east, north). Checked against Customs, which uses 180 degrees.
    90/270 maps (Factory, Labs, Labyrinth) follow the same formula but were not eyeballed."""
    x, z = pos["x"], pos["z"]
    r = math.radians(rotation)
    return x * math.cos(r) - z * math.sin(r), x * math.sin(r) + z * math.cos(r)


class Frame:
    """Fits a map's points into a FRAME_W-wide box, north up, for the schematic SVG."""

    def __init__(self, points: list[tuple[float, float]], pad: float = 0.03):
        es, ns = [p[0] for p in points], [p[1] for p in points]
        self.e0, self.e1, self.n0, self.n1 = min(es), max(es), min(ns), max(ns)
        span_e, span_n = (self.e1 - self.e0) or 1, (self.n1 - self.n0) or 1
        # Fit the width, but keep very tall maps (Lighthouse, Icebreaker) within FRAME_MAX_H.
        self.scale = min(FRAME_W * (1 - 2 * pad) / span_e, FRAME_MAX_H * (1 - 2 * pad) / span_n)
        self.pad = FRAME_W * pad
        self.w = round(span_e * self.scale + 2 * self.pad)
        self.h = round(span_n * self.scale + 2 * self.pad)
        self.metres = max(span_e, span_n)

    def xy(self, en: tuple[float, float]) -> tuple[int, int]:
        e, n = en
        return round(self.pad + (e - self.e0) * self.scale), round(self.pad + (self.n1 - n) * self.scale)


# ---------------------------------------------------------------- normalize

class Normalizer:
    def __init__(self, raw: dict, mode: str):
        self.raw, self.mode = raw, mode
        self.tr = Tr(raw["lang"])
        self.items = raw["items"]["items"]
        self.traders = {tid: self.tr(t["name"]) for tid, t in raw["traders"].items()}
        self.stations = {sid: self.tr(s["name"]) for sid, s in raw["hideout"].items()}
        self.quest_items = raw["tasks"]["questItems"]
        self.tasks = raw["tasks"]["tasks"]
        self.maps = raw["maps"]["maps"]
        self.task_names = {tid: self.tr(t["name"]) for tid, t in self.tasks.items()}
        self.site_maps = {}
        for group in raw["siteMaps"]:
            for m in group.get("maps", []):
                if m.get("projection") == "interactive":
                    self.site_maps.setdefault(group["normalizedName"], m)
        self.barters_by_item, self.crafts_by_item = {}, {}
        for b in raw["barters"]:
            self.barters_by_item.setdefault(b["offeredItem"]["item"], []).append(b)
        for c in raw["crafts"]:
            for r in c.get("rewardItems", []):
                self.crafts_by_item.setdefault(r["item"], []).append(c)

    def item_name(self, iid: str) -> str:
        if iid in self.items:
            return self.tr(self.items[iid]["name"])
        if iid in self.quest_items:
            return self.tr(self.quest_items[iid]["name"])
        return iid

    def options_name(self, ids, style: str) -> str:
        names = [self.item_name(i) for i in ids]
        if len(names) == 1:
            return names[0]
        if style == "or":
            return " or ".join(names)
        shown = ", ".join(names[:3])
        return f"Any of: {shown}" + (f" (+{len(names) - 3} more)" if len(names) > 3 else "")

    # -- per map --------------------------------------------------------

    def build_map(self, m: dict) -> dict:
        key = m["normalizedName"]
        site = self.site_maps.get(key, {})
        rot = site.get("coordinateRotation", m.get("coordinateToCardinalRotation", 180))
        en = lambda p: rotate(p, rot)

        frame_pts = [en(s["position"]) for s in m["spawns"]] + [en(e["position"]) for e in m["extracts"]]
        frame_pts += [en(c["position"]) for c in m.get("lootContainers", [])]
        labels = [{"text": l["text"], "en": en({"x": l["position"][0], "z": l["position"][1]})}
                  for l in site.get("labels", []) if isinstance(l.get("position"), list) and l.get("text")]
        frame_pts += [l["en"] for l in labels]
        if not frame_pts:
            raise ValueError(f"{key}: no positions to frame")
        frame = Frame(frame_pts)

        quests, points = [], []
        for t in self.tasks.values():
            q = self.build_quest(t, m["id"], en)
            if q:
                quests.append(q)
                points += [p for p in q.pop("_points")]
        zones, zone_of = self.cluster(points, labels, frame)
        for q in quests:
            for o in q["objectives"]:
                o["zone"] = sorted({zone_of[pid] for pid in o.pop("_pids")})
        quests.sort(key=lambda q: (q["minLevel"], q["trader"], q["name"]))

        return {
            "meta": {
                "map": self.tr(m["name"]),
                "mapId": m["id"],
                "key": key,
                "gameMode": self.mode,
                "generated": dt.date.today().isoformat(),
                "snapshot": self.raw["manifest"]["fetchedAt"],
                "raidMinutes": m.get("raidDuration"),
                "players": m.get("players"),
                "frame": {"w": frame.w, "h": frame.h, "metres": round(frame.metres)},
                "rotation": rot,
                "wiki": m.get("wiki"),
                "sources": [
                    {"name": "tarkov.dev data (json.tarkov.dev)", "url": "https://tarkov.dev", "use": "Tasks, objectives, positions, keys, items, traders, barters, crafts, flea levels"},
                    {"name": "tarkov-dev map labels (MIT)", "url": "https://github.com/the-hideout/tarkov-dev", "use": "Area names and coordinate rotation"},
                ],
                "caveats": [
                    "Generated automatically. Raids aren't planned yet; that's the planner's job.",
                    "tarkov.dev marks only a handful of tasks as Kappa (13 of 503 in the 2026-10-20 snapshot), so its Kappa flag is incomplete. Use the wiki for Kappa.",
                    "Zone names come from the nearest tarkov.dev map label plus a compass direction, so check them on the map.",
                ],
            },
            "zones": zones,
            "extracts": self.build_extracts(m, frame, en),
            "bosses": self.build_bosses(m),
            "quests": quests,
            "acquisition": self.build_acquisition(quests, m),
            "raids": [],
        }

    def build_quest(self, t: dict, map_id: str, en) -> dict | None:
        objs = []
        on_map = t.get("map") == map_id
        for o in t["objectives"]:
            maps = o.get("maps") or []
            if maps and map_id not in maps:
                continue  # belongs to another map
            on_map |= map_id in maps
            objs.append(o)
        if not on_map:
            return None

        points, out_objs, keys, bring = [], [], {}, {}
        for o in objs:
            pids = []
            for z in o.get("zones") or []:
                if z.get("map") == map_id and z.get("position"):
                    pid = f"{o['id']}:{len(points)}"
                    points.append({"pid": pid, "en": en(z["position"]), "hint": self.tr(z.get("name")) if z.get("name") else None})
                    pids.append(pid)
            for loc in o.get("possibleLocations") or []:
                if loc.get("map") == map_id:
                    for pos in loc.get("positions", []):
                        pid = f"{o['id']}:{len(points)}"
                        points.append({"pid": pid, "en": en(pos), "hint": None})
                        pids.append(pid)
            for alts in o.get("requiredKeys") or []:
                keys.setdefault(tuple(alts), []).append(o.get("optional", False))
            if o["type"] in ("plantItem", "mark", "plantQuestItem"):
                # Several items listed means any one of them works ("any 7.62x51 pack").
                options = [o["markerItem"]] if o.get("markerItem") else (o.get("items") or [])
                if options:
                    # Separate placements consume separate items (e.g. four WI-FI cameras).
                    item_key = (tuple(sorted(options)), "item")
                    bring[item_key] = bring.get(item_key, 0) + (o.get("count") or 1)
            if o["type"] == "shoot" and o.get("usingWeapon"):
                bring.setdefault((tuple(o["usingWeapon"]), "weapon"), 1)
            out_objs.append(self.build_objective(o, pids))
        # neededKeys repeats the objective keys as one combined list; keep only keys it adds.
        seen = {k for alts in keys for k in alts}
        for nk in t.get("neededKeys") or []:
            if nk.get("map") == map_id and not seen.intersection(nk["keys"]):
                keys.setdefault(tuple(nk["keys"]), [])

        needs = [{"item": self.options_name(alts, "or"), "itemIds": list(alts), "qty": 1, "kind": "key",
                  "optional": bool(flags) and all(flags)} for alts, flags in keys.items()]
        needs += [{"item": self.options_name(ids, "any"), "itemIds": list(ids), "qty": n, "kind": kind}
                  for (ids, kind), n in bring.items()]

        fin = t.get("finishRewards") or {}
        reward = [f"{t.get('experience', 0):,} XP"]
        reward += [f"{r['count']:,}x {self.item_name(r['item'])}" if r["count"] > 1 and r["item"] not in CURRENCIES
                   else f"{r['count']:,} {CURRENCIES[r['item']]}" if r["item"] in CURRENCIES
                   else self.item_name(r["item"]) for r in fin.get("items", [])]
        return {
            "id": t["id"],
            "name": self.tr(t["name"]),
            "trader": self.traders.get(t["trader"], t["trader"]),
            "kappa": t.get("kappaRequired", False),
            "lightkeeper": t.get("lightkeeperRequired", False),
            "faction": t.get("factionName", "Any"),
            "usecOnly": t.get("factionName") == "USEC",
            "bearOnly": t.get("factionName") == "BEAR",
            "minLevel": t.get("minPlayerLevel", 0),
            "requires": [self.task_names.get(r["task"], r["task"]) for r in t.get("taskRequirements", [])],
            "wiki": t.get("wikiLink"),
            "type": ",".join(sorted({o["type"] for o in out_objs})),
            "raid": None,
            "objectives": out_objs,
            "needs": needs,
            "tips": [],
            "reward": ", ".join(reward),
            "_points": points,
        }

    def build_objective(self, o: dict, pids: list) -> dict:
        obj = {
            "id": o["id"],
            "text": self.tr(o.get("description")),
            "type": o["type"],
            "optional": o.get("optional", False),
            "_pids": pids,
        }
        if (o.get("count") or 1) > 1 and o["type"] in ("shoot", "findItem", "giveItem", "plantItem", "extract", "mark", "useItem"):
            obj["count"] = o["count"]
        if o["type"] == "findQuestItem" or (o["type"] == "findItem" and o.get("foundInRaid")):
            obj["mustExtract"] = True
        if o["type"] == "shoot":
            obj["targets"] = [self.tr(n) for n in o.get("targetNames") or []]
            if o.get("usingWeapon"):
                obj["weapons"] = [self.item_name(w) for w in o["usingWeapon"]]
        if o["type"] in ("giveItem", "findItem") and o.get("items"):
            obj["items"] = [self.item_name(i) for i in o["items"][:6]]
            obj["foundInRaid"] = bool(o.get("foundInRaid"))
        if o["type"] == "extract" and o.get("exitName"):
            obj["exit"] = self.tr(o["exitName"])
        return obj

    def cluster(self, points: list, labels: list, frame: Frame):
        """Group objective positions that sit close together into named zones."""
        radius = max(8.0, frame.metres * 0.03)
        clusters = []
        for p in points:
            for c in clusters:
                if math.dist(c["en"], p["en"]) <= radius:
                    c["members"].append(p)
                    n = len(c["members"])
                    c["en"] = tuple((c["en"][i] * (n - 1) + p["en"][i]) / n for i in range(2))
                    break
            else:
                clusters.append({"en": p["en"], "members": [p]})
        zones, zone_of, used = {}, {}, {}
        for c in clusters:
            near = min(labels, key=lambda l: math.dist(l["en"], c["en"])) if labels else None
            if near:
                d = math.dist(near["en"], c["en"])
                # On top of the label: use it as is. Otherwise say which side of it the spot is.
                name = near["text"] if d <= radius * 0.6 else f"{near['text']} {compass(near['en'], c['en'])}"
                if d > radius * 2.5:
                    name = f"{compass(near['en'], c['en'])} of {near['text']}"
            else:
                name = next((m["hint"] for m in c["members"] if m["hint"]), "Unnamed spot")
            base = slug(name) or "spot"
            used[base] = used.get(base, 0) + 1
            zid = base if used[base] == 1 else f"{base}-{used[base]}"
            if used[base] == 2:  # the first one also needs its number once there's a second
                zones[f"{base}-1"] = zones.pop(base)
                zones[f"{base}-1"]["name"] += " (1)"
                for k, v in zone_of.items():
                    if v == base:
                        zone_of[k] = f"{base}-1"
            x, y = frame.xy(c["en"])
            zones[zid] = {"name": name if used[base] == 1 else f"{name} ({used[base]})", "x": x, "y": y,
                          "hints": sorted({m["hint"] for m in c["members"] if m["hint"]})[:4]}
            for mbr in c["members"]:
                zone_of[mbr["pid"]] = zid
        return zones, zone_of

    def build_extracts(self, m: dict, frame: Frame, en) -> list:
        out = []
        for e in m["extracts"]:
            x, y = frame.xy(en(e["position"]))
            out.append({"id": slug(e["name"]), "name": self.tr(e["name"]), "faction": e.get("faction"),
                        "x": x, "y": y, "rule": f"{(e.get('faction') or 'any').upper()} extract"})
        for t in m.get("transits", []):
            x, y = frame.xy(en(t["position"]))
            out.append({"id": f"transit-{t['id']}", "name": self.tr(t["description"]), "faction": "shared",
                        "x": x, "y": y, "rule": "Transit to another map"})
        return out

    def build_bosses(self, m: dict) -> list:
        # Some bosses (Raiders, Rogues) come as several spawn groups; fold them into one entry.
        out = {}
        for b in m.get("bosses", []):
            name = self.tr(b.get("mob"))
            entry = out.setdefault(name, {"name": name, "spawnChance": 0, "groups": 0, "locations": [], "escorts": set()})
            entry["groups"] += 1
            entry["spawnChance"] = max(entry["spawnChance"], b.get("spawnChance") or 0)
            for loc in b.get("spawnLocations", []):
                loc_name = self.tr(loc.get("name"))
                if loc_name not in [x["name"] for x in entry["locations"]]:
                    entry["locations"].append({"name": loc_name, "chance": loc.get("chance")})
            entry["escorts"].update(self.tr(e.get("mob")) for e in b.get("escorts", []))
        return [{**e, "escorts": sorted(e["escorts"])} for e in out.values()]

    def build_acquisition(self, quests: list, m: dict) -> list:
        want = {}
        for q in quests:
            for n in q["needs"]:
                if len(n["itemIds"]) > 4:
                    continue  # a long "any of" list; listing sources for each option is noise
                for iid in n["itemIds"]:
                    w = want.setdefault(iid, {"kind": n["kind"], "for": [], "required": False})
                    w["required"] |= not n.get("optional", False)
                    if q["id"] not in w["for"]:
                        w["for"].append(q["id"])
        locks = {}
        for lock in m.get("locks", []):
            if lock.get("key"):
                locks.setdefault(lock["key"], []).append(lock)
        out = []
        for iid, w in want.items():
            item = self.items.get(iid)
            if not item:  # quest-only items are handed to you; nothing to acquire
                continue
            no_flea = "noFlea" in item.get("types", []) or not item.get("minLevelForFlea")
            sources = []
            for b in item.get("buyFromTrader", []):
                unlock = f", after {self.task_names.get(b['taskUnlock'], b['taskUnlock'])}" if b.get("taskUnlock") else ""
                sources.append(f"{self.traders.get(b['trader'], b['trader'])} LL{b.get('minTraderLevel', 1)}: {b['price']:,} {b['currency']}{unlock}")
            for b in self.barters_by_item.get(iid, []):
                req = " + ".join(f"{r['count']:g}x {self.item_name(r['item'])}" for r in b["requiredItems"])
                sources.append(f"{self.traders.get(b['trader'], b['trader'])} LL{b.get('minTraderLevel', 1)} barter: {req}")
            for c in self.crafts_by_item.get(iid, []):
                req = " + ".join(f"{r['count']:g}x {self.item_name(r['item'])}" for r in c["requiredItems"])
                sources.append(f"Craft at {self.stations.get(c['station'], c['station'])} L{c.get('level', '?')}: {req}")
            if not sources:
                sources.append("No trader, barter or craft source. Find it in raid.")
            out.append({
                "item": self.tr(item["name"]),
                "itemId": iid,
                "kind": w["kind"],
                "for": w["for"],
                "required": w["required"],
                "fleaLevel": None if no_flea else item["minLevelForFlea"],
                "flea": "not on flea" if no_flea else f"flea from level {item['minLevelForFlea']}",
                "price": item.get("avg24hPrice") or None,
                "lockCount": len(locks.get(iid, [])),
                "sources": sources,
            })
        out.sort(key=lambda a: (a["kind"] != "key", a["item"]))
        return out


CURRENCIES = {"5449016a4bdc2d6f028b456f": "RUB", "5696686a4bdc2da3298b456a": "USD", "569668774bdc2da2298b4568": "EUR",
              "5d235b4d86f7742e017bc88a": "GP coins"}


# ---------------------------------------------------------------- main

def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--mode", default="regular", choices=["regular", "pve"])
    ap.add_argument("--offline", action="store_true", help="skip fetching; use the newest saved snapshot")
    ap.add_argument("--out", help="map output directory (defaults to the selected mode)")
    args = ap.parse_args()

    if args.offline:
        snap = latest_snapshot(args.mode)
    else:
        try:
            print(f"fetching {args.mode} snapshot from {JSON_HOST}", file=sys.stderr)
            snap = take_snapshot(args.mode)
        except Exception as exc:
            print(f"fetch failed ({exc}); falling back to the newest saved snapshot", file=sys.stderr)
            snap = latest_snapshot(args.mode)
    print(f"using snapshot {snap.relative_to(ROOT)}", file=sys.stderr)

    norm = Normalizer(load_snapshot(snap), args.mode)
    out = Path(args.out) if args.out else ROOT / "data" / ("" if args.mode == "regular" else "pve") / "maps"
    out.mkdir(parents=True, exist_ok=True)
    index = []
    for m in norm.maps.values():
        if m["normalizedName"] in SKIP_MAPS:
            continue
        data = norm.build_map(m)
        if not data["quests"]:
            print(f"  {m['normalizedName']:18} no tasks, skipped", file=sys.stderr)
            continue
        path = out / f"{m['normalizedName']}.json"
        path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        keys = sum(1 for a in data["acquisition"] if a["kind"] == "key")
        index.append({"key": m["normalizedName"], "name": data["meta"]["map"], "file": path.name,
                      "quests": len(data["quests"]), "zones": len(data["zones"]), "keys": keys})
        print(f"  {m['normalizedName']:18} {len(data['quests']):>3} tasks  {len(data['zones']):>3} zones  {keys:>2} keys", file=sys.stderr)
    (out / "index.json").write_text(json.dumps({"snapshot": norm.raw["manifest"]["fetchedAt"], "mode": args.mode,
                                                "maps": index}, indent=1), encoding="utf-8")
    # Every task by BSG ID (the ID the game's logs use), including tasks with no map.
    tasks = {tid: {"name": norm.task_names[tid], "trader": norm.traders.get(t["trader"], t["trader"]),
                   "faction": t.get("factionName", "Any")} for tid, t in norm.tasks.items()}
    (out.parent / "tasks-index.json").write_text(json.dumps(tasks, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
