"""Draw The Lab's floor plans (data/art/the-lab/*.png) from tarkov.dev's tiled map.

An authoring tool, run by hand when the Lab's layout changes; the build and CI never run it.
It needs Pillow (pip install pillow), unlike the pipeline, which is standard library only.

For each floor it fetches one zoom level of tiles (about 50 requests, cached in cache/lab-tiles/),
stitches them and crops to the map's `bounds`. The ETL places that rectangle (meta.art), so the
plan lines up with pins by construction. The tiles store walls as thin transparent lines; the
plan keeps those walls and the footprint, gives each walled room one flat tone from its average
floor colour, and adds planters and large dark fixtures. Textures and clutter are left out.

Usage:
    python tools/draw_floor_art.py            # all three floors
    python tools/draw_floor_art.py 2nd        # one floor
"""
import math
import sys
import time
import urllib.request
from collections import defaultdict
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
TILES = ROOT / "cache" / "lab-tiles"
OUT = ROOT / "data" / "art" / "the-lab"
# From snapshot/regular/<date>/site-maps.json, the-lab's interactive map.
TRANSFORM, ROTATION, TILE_SIZE = (0.575, 281.2, 0.575, 193.7), 270, 175
BOUNDS = ((-80, -477), (-287, -193))
FLOORS = {"1st": "1st", "2nd": "2nd", "technical": "technical"}
TILE_URL = "https://assets.tarkov.dev/maps/labs_v4/{floor}/{z}/{x}/{y}.png"
ZOOM, TILE_PX = 3, 256  # tiles are 256 px images drawn at TILE_SIZE

WALL, PLANTER, PLANTER_EDGE, FIXTURE, FIXTURE_EDGE = (0x3f, 0x48, 0x42), (0x9f, 0xae, 0x8e), (0x84, 0x94, 0x74), (0x8f, 0x99, 0x90), (0x6c, 0x76, 0x6e)


def pixel(x: float, z: float) -> tuple[float, float]:
    """Game (x, z) -> tarkov.dev's pixel at ZOOM (Leaflet CRS: rotation, then the transform)."""
    r = math.radians(ROTATION)
    e, n = x * math.cos(r) - z * math.sin(r), x * math.sin(r) + z * math.cos(r)
    a, b, c, d = TRANSFORM
    return 2 ** ZOOM * (a * e + b), 2 ** ZOOM * (-c * n + d)


def stitch(floor: str) -> Image.Image:
    (x0, x1), (y0, y1) = (sorted(v) for v in zip(*(pixel(*c) for c in BOUNDS)))
    k = TILE_PX / TILE_SIZE
    cols, rows = range(int(x0 // TILE_SIZE), int(x1 // TILE_SIZE) + 1), range(int(y0 // TILE_SIZE), int(y1 // TILE_SIZE) + 1)
    sheet = Image.new("RGBA", ((cols[-1] + 1) * TILE_PX, (rows[-1] + 1) * TILE_PX))
    TILES.mkdir(parents=True, exist_ok=True)
    for tx in cols:
        for ty in rows:
            path = TILES / f"{floor}-{ZOOM}-{tx}-{ty}.png"
            if not path.exists():
                url = TILE_URL.format(floor=FLOORS[floor], z=ZOOM, x=tx, y=ty)
                try:
                    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "tarkov-planner"}), timeout=60) as r:
                        path.write_bytes(r.read())
                except Exception as exc:  # tiles outside the building may not exist
                    print(f"  {url}: {exc}", file=sys.stderr)
                    continue
                time.sleep(0.1)
            sheet.paste(Image.open(path).convert("RGBA"), (tx * TILE_PX, ty * TILE_PX))
    return sheet.crop((round(x0 * k), round(y0 * k), round(x1 * k), round(y1 * k)))


def tone(r: float, g: float, b: float) -> tuple[int, int, int]:
    lum = (r * 3 + g * 6 + b) / 10
    if b > r + 14:
        return (0xa9, 0xb6, 0xb8)  # tiled (blue) floors: medical, showers
    if r > b + 12 and r >= g:
        return (0xc0, 0xc4, 0xb5)  # timber and warm floors
    if lum < 80:
        return (0xa3, 0xab, 0xa1)  # dark floors: garages, plant rooms
    if lum > 125:
        return (0xc6, 0xcc, 0xc1)  # light floors: offices
    return (0xb2, 0xba, 0xaf)      # concrete


def draw(src: Image.Image) -> Image.Image:
    W, H = src.size
    raw = src.getchannel("A").point(lambda v: 255 if v > 128 else 0)
    # The footprint with thin walls closed over; real voids (courtyards, outside) stay open.
    foot = raw.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.MinFilter(7))
    foot = foot.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    walls = ImageChops.subtract(foot, raw).filter(ImageFilter.MaxFilter(3))
    ring = ImageChops.subtract(foot, foot.filter(ImageFilter.MinFilter(7)))
    floor = ImageChops.subtract(foot, ImageChops.lighter(walls, ring))
    rgb = Image.composite(src.convert("RGB"), Image.new("RGB", src.size, (128, 130, 128)), raw)

    # One tone per walled room: label connected floor at half size (eroded so door gaps don't leak).
    hs = (W // 2, H // 2)
    lab = Image.new("I", hs, 0)
    lab.paste(-1, (0, 0, *hs), floor.resize(hs, Image.NEAREST).filter(ImageFilter.MinFilter(3)))
    lp, n = lab.load(), 0
    for y in range(hs[1]):
        for x in range(hs[0]):
            if lp[x, y] == -1:
                n += 1
                ImageDraw.floodfill(lab, (x, y), n, thresh=0)
    half = rgb.resize(hs, Image.BOX)
    hp, acc = half.load(), defaultdict(lambda: [0, 0, 0, 0])
    for y in range(hs[1]):
        for x in range(hs[0]):
            if (k := lp[x, y]) > 0:
                a, (r, g, b) = acc[k], hp[x, y]
                a[0] += r; a[1] += g; a[2] += b; a[3] += 1
    colour = {k: tone(a[0] / a[3], a[1] / a[3], a[2] / a[3]) for k, a in acc.items()}
    rooms = Image.new("RGB", hs, tone(128, 130, 128))
    rp = rooms.load()
    for y in range(hs[1]):
        for x in range(hs[0]):
            if (k := lp[x, y]) > 0:
                rp[x, y] = colour[k]
    out = rooms.filter(ImageFilter.MaxFilter(3)).resize((W, H), Image.NEAREST).convert("RGBA")

    # Planters and large dark fixtures, classified on a de-noised half-size copy.
    med = half.filter(ImageFilter.MedianFilter(5)).load()
    green, fixt = Image.new("L", hs, 0), Image.new("L", hs, 0)
    gp, fp = green.load(), fixt.load()
    for y in range(hs[1]):
        for x in range(hs[0]):
            if lp[x, y] > 0:
                r, g, b = med[x, y]
                if g > r + 6 and g > b + 10 and g > 60:
                    gp[x, y] = 255
                elif (r * 3 + g * 6 + b) / 10 < 48:
                    fp[x, y] = 255
    clean = lambda m, k: m.filter(ImageFilter.MinFilter(k)).filter(ImageFilter.MaxFilter(k)).filter(ImageFilter.ModeFilter(5))
    up = lambda m: ImageChops.multiply(m.resize((W, H), Image.BILINEAR).point(lambda v: 255 if v > 127 else 0), floor)
    edge = lambda m: ImageChops.multiply(m.filter(ImageFilter.FIND_EDGES).point(lambda v: 255 if v else 0), floor)
    green = up(clean(green.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5)), 3))
    fixt = up(clean(fixt, 5))
    paint = lambda m, c: out.paste(Image.new("RGBA", (W, H), c + (255,)), (0, 0), m)
    paint(fixt, FIXTURE); paint(edge(fixt), FIXTURE_EDGE)
    paint(green, PLANTER); paint(edge(green), PLANTER_EDGE)
    out.putalpha(foot)
    paint(walls, WALL); paint(ring, WALL)
    return out


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for floor in sys.argv[1:] or FLOORS:
        plan = draw(stitch(floor))
        plan.save(OUT / f"{floor}.png", optimize=True)
        print(f"  {floor}: {plan.size[0]}x{plan.size[1]} -> {(OUT / f'{floor}.png').relative_to(ROOT)}", file=sys.stderr)


if __name__ == "__main__":
    main()
