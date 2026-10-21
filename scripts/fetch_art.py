"""Download the third-party art the pages show, into cache/art/ (never committed; CI caches it).

- Map art: tarkov.dev's SVG maps (Shebuka et al., CC BY-NC-SA 4.0), reduced to the ground layer
  the way tarkov.dev shows them. Other floors are removed; that's our only modification.
- Spot photos: the screenshots in each quest's wiki <gallery>, as 640px thumbnails, with captions.

Only missing files are fetched, unless --refresh; --budget caps the time spent on photos, so the
first runs in CI fill the cache over several days. Failures are reported and skipped so a release
never depends on these. Writes cache/art/manifest.json, which build_page.py reads.

Usage:
    python scripts/fetch_art.py              # fetch what's missing
    python scripts/fetch_art.py --maps-only  # skip the ~1,200 wiki photos
"""
import argparse
import hashlib
import json
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from etl_tarkov_dev import ROOT, UA, latest_snapshot, load_snapshot  # noqa: E402
from fetch_wiki_quests import strip_links  # noqa: E402

ART = ROOT / "cache" / "art"
WIKI_API = "https://escapefromtarkov.fandom.com/api.php"
SVG_NS = "http://www.w3.org/2000/svg"
PHOTO_WIDTH = 640


def get(url: str, referer: str | None = None) -> tuple[bytes, str]:
    headers = {"User-Agent": UA, **({"Referer": referer} if referer else {})}
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=60) as r:
        return r.read(), r.headers.get_content_type()


def ground_layer(svg: bytes, layer: str | None) -> bytes:
    """Keep only the base floor: top-level groups with an id are floors or overlays."""
    ET.register_namespace("", SVG_NS)
    ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")
    root = ET.fromstring(svg)
    if layer:
        for g in [c for c in root if c.tag == f"{{{SVG_NS}}}g" and c.get("id")]:
            if g.get("id") != layer and g.get("data-keep-with-group") != layer:
                root.remove(g)
    return ET.tostring(root, encoding="utf-8")


def fetch_maps(refresh: bool) -> dict:
    raw = load_snapshot(latest_snapshot("regular"))
    out = {}
    for group in raw["siteMaps"]:
        site = next((m for m in group.get("maps", []) if m.get("projection") == "interactive"), None)
        if not site or not site.get("svgPath"):
            continue
        key, path = group["normalizedName"], ART / "maps" / f"{group['normalizedName']}.svg"
        if refresh or not path.exists():
            try:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(ground_layer(get(site["svgPath"])[0], site.get("svgLayer")))
                print(f"  map {key}", file=sys.stderr)
            except Exception as exc:  # a missing map falls back to the schematic
                print(f"  map {key} failed: {exc}", file=sys.stderr)
                continue
        out[key] = {"file": f"maps/{key}.svg", "source": site["svgPath"], "author": site.get("author")}
    return out


def galleries() -> dict:
    """Task ID -> [(file title, caption)] from the cached wiki pages (raw/wiki/<task id>.json)."""
    out = {}
    for f in sorted((ROOT / "raw" / "wiki").glob("*.json")):
        page = json.loads(f.read_text(encoding="utf-8")).get("parse")
        if not page:
            continue  # the folder also holds an index
        text = page.get("wikitext", {}).get("*", "")
        shots = []
        for gallery in re.findall(r"<gallery[^>]*>(.*?)</gallery>", text, flags=re.S):
            for line in gallery.strip().splitlines():
                name, _, caption = line.strip().partition("|")
                name = name.strip()
                if not name:
                    continue
                if not re.match(r"(?i)(file|image):", name):
                    name = "File:" + name
                shots.append(("File:" + name.split(":", 1)[1].strip(), strip_links(caption).strip()))
        if shots:
            out[f.stem] = shots
    return out


def thumb_urls(titles: list[str]) -> dict:
    """File title -> thumbnail URL, 50 titles per API call at about one call a second."""
    urls = {}
    for i in range(0, len(titles), 50):
        q = urllib.parse.urlencode({"action": "query", "titles": "|".join(titles[i:i + 50]), "prop": "imageinfo",
                                    "iiprop": "url", "iiurlwidth": PHOTO_WIDTH, "format": "json", "redirects": 1})
        data = json.loads(get(f"{WIKI_API}?{q}")[0])
        alias = {n["to"]: n["from"] for n in data["query"].get("normalized", []) + data["query"].get("redirects", [])}
        for p in data["query"]["pages"].values():
            info = (p.get("imageinfo") or [{}])[0]
            if info.get("thumburl") or info.get("url"):
                title = p["title"]
                urls[alias.get(alias.get(title, title), alias.get(title, title))] = info.get("thumburl") or info["url"]
                urls[title] = urls.get(title) or info.get("thumburl") or info["url"]
        time.sleep(1)
    return urls


EXT = {"image/webp": "webp", "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif"}


def saved(title: str) -> Path | None:
    """A photo's file is named after its title; Fandom serves WebP whatever the name says, so the
    extension comes from the response and any extension counts as already downloaded."""
    return next((ART / "spots").glob(hashlib.sha1(title.encode()).hexdigest()[:16] + ".*"), None)


def fetch_photos(refresh: bool, budget: float | None) -> dict:
    shots = galleries()
    titles = sorted({t for s in shots.values() for t, _ in s})
    manifest_path = ART / "manifest.json"
    old = json.loads(manifest_path.read_text(encoding="utf-8")).get("urls", {}) if manifest_path.exists() else {}
    (ART / "spots").mkdir(parents=True, exist_ok=True)
    todo = [t for t in titles if refresh or not saved(t)]
    missing = [t for t in todo if refresh or t not in old]
    urls = {**old, **(thumb_urls(missing) if missing else {})}
    deadline = time.monotonic() + budget if budget else None
    got = 0
    for t in todo:
        if t not in urls:
            continue
        if deadline and time.monotonic() > deadline:
            print(f"  time budget reached; {len(todo) - got} photos left for the next run", file=sys.stderr)
            break
        try:
            body, kind = get(urls[t], referer="https://escapefromtarkov.fandom.com/")
            if (old_file := saved(t)):
                old_file.unlink()
            (ART / "spots" / f"{hashlib.sha1(t.encode()).hexdigest()[:16]}.{EXT.get(kind, 'jpg')}").write_bytes(body)
            got += 1
            time.sleep(0.2)
        except Exception as exc:
            print(f"  photo {t} failed: {exc}", file=sys.stderr)
    print(f"  photos: {len(titles)} listed, {got} downloaded, {sum(1 for t in titles if t not in urls)} not found",
          file=sys.stderr)
    spots = {tid: [{"file": f"spots/{p.name}", "caption": c} for t, c in s if (p := saved(t))] for tid, s in shots.items()}
    return {"spots": {k: v for k, v in spots.items() if v}, "urls": urls}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--refresh", action="store_true", help="download everything again")
    ap.add_argument("--maps-only", action="store_true", help="skip the wiki photos")
    ap.add_argument("--budget", type=float, help="stop downloading photos after this many seconds; the next run continues")
    args = ap.parse_args()
    ART.mkdir(parents=True, exist_ok=True)
    path = ART / "manifest.json"
    manifest = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    manifest.pop("files", None)
    manifest["maps"] = fetch_maps(args.refresh)
    if not args.maps_only:
        manifest.update(fetch_photos(args.refresh, args.budget))
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
