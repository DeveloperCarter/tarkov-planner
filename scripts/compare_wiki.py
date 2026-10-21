"""List where tarkov.dev data and the wiki disagree about the same quests.

Neither source is always right after a patch, so disagreements are reported, not resolved.

Usage: python scripts/compare_wiki.py data/maps/customs.json raw/customs-wiki.json > reports/customs-conflicts.md
"""
import json
import re
import sys


def numbers(text: str) -> set[int]:
    return {int(n) for n in re.findall(r"\b(\d+)\b", text) if int(n) > 1}


def compare(gen: dict, wiki: dict) -> list[str]:
    rows = []
    if wiki.get("trader") and wiki["trader"] != gen["trader"]:
        rows.append(f"Giver: wiki **{wiki['trader']}**, tarkov.dev **{gen['trader']}**")
    if wiki.get("kappa") != gen["kappa"]:
        rows.append(f"Kappa: wiki **{'yes' if wiki.get('kappa') else 'no'}**, tarkov.dev **{'yes' if gen['kappa'] else 'no'}**")
    wiki_faction = "USEC" if wiki.get("usecOnly") else "BEAR" if wiki.get("bearOnly") else "Any"
    if wiki_faction != gen["faction"]:
        rows.append(f"Faction: wiki **{wiki_faction}**, tarkov.dev **{gen['faction']}**")
    # Counts: tarkov.dev keeps them in `count`, the wiki writes them into the sentence.
    wiki_nums = set().union(*(numbers(o["text"]) for o in wiki.get("objectives", []))) if wiki.get("objectives") else set()
    for o in gen["objectives"]:
        if o.get("count") and wiki_nums and o["count"] not in wiki_nums:
            rows.append(f"Count for \"{o['text']}\": wiki says {', '.join(map(str, sorted(wiki_nums)))}, tarkov.dev **{o['count']}**")
    wiki_required = [o for o in wiki.get("objectives", []) if not o["optional"]]
    gen_required = [o for o in gen["objectives"] if not o["optional"]]
    if wiki_required and len(wiki_required) != len(gen_required):
        rows.append(f"Required objectives: wiki {len(wiki_required)}, tarkov.dev {len(gen_required)}")
    return rows


def main(map_path: str, wiki_path: str) -> None:
    gen = json.load(open(map_path, encoding="utf-8"))
    wiki = json.load(open(wiki_path, encoding="utf-8"))
    by_name = {q["name"].lower(): q for q in gen["quests"]}
    print(f"# {gen['meta']['map']}: tarkov.dev vs wiki\n")
    print(f"tarkov.dev snapshot {gen['meta']['snapshot']}. Check anything listed here against the in-game task screen.\n")
    clean = []
    for w in wiki:
        if "error" in w:
            print(f"- **{w['name']}**: wiki fetch failed ({w['error']})")
            continue
        g = by_name.get(w["name"].lower())
        if not g:
            print(f"- **{w['name']}**: not found in tarkov.dev data for this map")
            continue
        rows = compare(g, w)
        if rows:
            print(f"## {w['name']}\n")
            print("\n".join(f"- {r}" for r in rows) + "\n")
        else:
            clean.append(w["name"])
    if clean:
        print(f"**Agree:** {', '.join(clean)}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
