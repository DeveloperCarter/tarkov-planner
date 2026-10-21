"""Pull quest pages from the EFT Fandom wiki and parse them into JSON.

This is the scraping half of the data layer: tarkov.dev's GraphQL API should be the
primary source (objectives, coordinates, needed keys), and the wiki fills in guide
text and the per-spot captions under each quest's screenshots.

Usage: python scripts/fetch_wiki_quests.py "Pharmacist" "Work Smarter" > raw/quests.json
"""
import json
import re
import sys
import urllib.parse
import urllib.request

API = "https://escapefromtarkov.fandom.com/api.php"
# Fandom rejects the default urllib user agent with a 403.
UA = "Mozilla/5.0 (compatible; tarkov-planner/0.1; personal raid planning)"


def fetch_wikitext(title: str) -> dict:
    query = urllib.parse.urlencode({
        "action": "parse", "page": title, "prop": "wikitext", "redirects": 1, "format": "json",
    })
    req = urllib.request.Request(f"{API}?{query}", headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = json.load(resp)
    if "error" in body:
        raise LookupError(f"{title}: {body['error'].get('info')}")
    return {"title": body["parse"]["title"], "wikitext": body["parse"]["wikitext"]["*"]}


def strip_links(text: str) -> str:
    text = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", text)  # [[target|label]] -> label
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"'''?", "", text)
    return text.strip()


def section(wikitext: str, name: str) -> str:
    m = re.search(rf"==\s*{name}\s*==[ \t]*\n(.*?)(?=\n==[^=]|\Z)", wikitext, flags=re.S)
    return m.group(1) if m else ""


def bullets(block: str) -> list[dict]:
    out = []
    for line in block.splitlines():
        m = re.match(r"(\*+)\s*(.*)", line)
        if m:
            text = strip_links(m.group(2))
            out.append({
                "depth": len(m.group(1)),
                "optional": text.startswith("(Optional)"),
                "text": text.removeprefix("(Optional)").strip(),
            })
    return out


def infobox(wikitext: str) -> dict:
    box = re.search(r"\{\{Infobox quest(.*?)\n\}\}", wikitext, flags=re.S)
    fields = {}
    for line in (box.group(1) if box else "").splitlines():
        m = re.match(r"\|\s*([^=]+?)\s*=\s*(.*)", line)
        if m and m.group(2).strip():
            fields[m.group(1)] = strip_links(m.group(2))
    return fields


def spots(wikitext: str) -> list[str]:
    """Gallery captions, which is where the wiki says *exactly* where each thing is."""
    caps = []
    for gallery in re.findall(r"<gallery[^>]*>(.*?)</gallery>", wikitext, flags=re.S):
        for line in gallery.strip().splitlines():
            if "|" in line:
                caps.append(strip_links(line.split("|", 1)[1]))
    return caps


def parse(page: dict) -> dict:
    w = page["wikitext"]
    box = infobox(w)
    requirements = strip_links(section(w, "Requirements"))
    guide = re.sub(r"\{\|.*?\|\}|<gallery.*?</gallery>", "", section(w, "Guide"), flags=re.S)
    return {
        "name": page["title"],
        "wiki": "https://escapefromtarkov.fandom.com/wiki/" + page["title"].replace(" ", "_"),
        "trader": box.get("given by"),
        "location": box.get("location"),
        "kappa": "Yes" in box.get("reqkappa", ""),
        "usecOnly": "only obtainable by USEC" in requirements,
        "bearOnly": "only obtainable by BEAR" in requirements,
        "previous": box.get("previous"),
        "objectives": bullets(section(w, "Objectives")),
        "rewards": [b["text"] for b in bullets(section(w, "Rewards")) if b["depth"] == 1],
        "guide": re.sub(r"\n{2,}", "\n", strip_links(guide)),
        "spots": spots(w),
    }


if __name__ == "__main__":
    titles = sys.argv[1:] or sys.exit(__doc__)
    results = []
    for t in titles:
        try:
            results.append(parse(fetch_wikitext(t)))
        except Exception as exc:  # keep going; one renamed quest shouldn't sink the batch
            results.append({"name": t, "error": str(exc)})
    json.dump(results, sys.stdout, ensure_ascii=False, indent=2)
