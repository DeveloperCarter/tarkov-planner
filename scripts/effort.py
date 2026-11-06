"""Effort facts per quest for "easy win" scoring (page/quest-effort.js judges them with the
player's level). Built from every map file of one mode, so multi-map quests count all their
spots once. No network; facts only, no judgement."""
import json
import re
from pathlib import Path

# Kill targets a quick raid can handle; anything else (PMCs, bosses, guards, Rogues, Raiders) is hard.
EASY_TARGETS = {"scav", "scavs", "sniper", "any target"}
# What the quest filter's kind chips ask about. A findItem without a zone is general looting, not a pickup.
PLACING = {"mark", "plantItem", "plantQuestItem"}
# Objectives done at a place: without a zone, the player has to find it themselves.
PLACED = {"visit", "mark", "plantItem", "plantQuestItem", "findQuestItem"}
TRADER_CASH = re.compile(r"^[A-Z][A-Za-z ]+ LL\d: [\d,]+")
TRADER_TRADE = re.compile(r"^[A-Z][A-Za-z ]+ LL\d barter:")


def effort_facts(map_files: list[Path]) -> dict:
    """{task id: {spots, unlocated, extracts, maps, kills, hardKills, fir, streak, grind, kinds, keys, items}}

    keys and items: [{id, name, qty, fleaLevel, trader, barter}], the required keys and items to bring.
    trader: a trader sells it for cash; barter: a trader barter or a craft makes it. Weapons are left out:
    their needs list any of many guns, which the data can't price."""
    facts, seen, buy = {}, set(), {}
    sources = [json.loads(p.read_text(encoding="utf-8")) for p in map_files]
    for data in sources:
        for a in data.get("acquisition", []):
            if a.get("kind") in ("key", "item"):
                buy[a["itemId"]] = {"fleaLevel": a.get("fleaLevel"),
                                    "trader": any(TRADER_CASH.match(s) for s in a.get("sources", [])),
                                    "barter": any(TRADER_TRADE.match(s) for s in a.get("sources", []))}
    for data in sources:
        key = data.get("meta", {}).get("key")
        for q in data.get("quests", []):
            tid = q.get("bsgId") or q["id"]
            f = facts.setdefault(tid, {"spots": 0, "unlocated": 0, "extracts": 0, "maps": 0, "kills": 0, "hardKills": False, "fir": False,
                                       "streak": False, "grind": False, "kinds": [], "keys": [], "items": []})
            located = False
            for o in q.get("objectives", []):
                if o.get("optional"):
                    continue
                zones = o.get("zone") or []
                for z in zones:
                    if (tid, key, z) not in seen:
                        seen.add((tid, key, z)); f["spots"] += 1
                located = located or bool(zones)
                if o.get("id") in seen:
                    continue
                seen.add(o.get("id"))
                t = o.get("type")
                kind = "combat" if t == "shoot" else "place" if t in PLACING else "pickup" if t == "findQuestItem" or (t == "findItem" and zones) else None
                if kind and kind not in f["kinds"]:
                    f["kinds"].append(kind)
                if t in PLACED and not zones:
                    f["unlocated"] += 1  # a place to go that the map data doesn't show
                if t == "shoot":
                    targets = {str(x).lower() for x in o.get("targets") or []}
                    if targets and targets <= EASY_TARGETS:
                        f["kills"] += o.get("count") or 1
                    else:
                        f["hardKills"] = True
                elif t in ("giveItem", "findItem") and o.get("foundInRaid"):
                    f["fir"] = True
                elif t == "extract":
                    f["extracts"] += 1
                    f["streak"] = f["streak"] or (o.get("count") or 1) > 1
                elif t in ("experience", "skill", "traderLevel", "traderStanding"):
                    f["grind"] = True
            if located:
                f["maps"] += 1
            for n in q.get("needs", []):
                group = {"key": "keys", "item": "items"}.get(n.get("kind"))
                if group and not n.get("optional") and not any(k["name"] == n["item"] for k in f[group]):
                    ids = n.get("itemIds") or [None]
                    info = next((buy[i] for i in ids if i in buy), {"fleaLevel": None, "trader": False, "barter": False})
                    f[group].append({"id": ids[0], "name": n["item"], "qty": n.get("qty") or 1, **info})
    return facts
