# tarkov-planner (v1 data pipeline)

Public site: **https://developercarter.github.io/tarkov-planner/**
The build and deployment passed, and the public HTTPS home and map pages load in Chrome
without console errors. The real-folder live check passes: Chrome watches the player's
PvP session and has scanned 46 sessions / 182 quest events. The owner-approved removal of
the retired `carterbrown.dev` CNAME restored the default Pages addresses. Localhost progress
remains preserved. A new browser still needs its own level and current-list confirmation;
historical starts alone do not establish the exact active list. No phone sync is included.

M2 adds a map home page and separate PvP/PvE planners. Current counts use the chosen
profile/mode/wipe; possible unlocks are counted separately as estimates. A quest with
objectives on several maps can appear on several cards. Manual raid selection remains M1B;
automatic raid bundling is still M3.

Next steps are in [ROADMAP.md](ROADMAP.md). Guidance for coding agents is in [AGENTS.md](AGENTS.md).

Turns an EFT task list into raids for each map. v0 was a hand-built Customs plan. v1 adds the
data pipeline: every map's tasks, objective spots, keys, items, bosses and extracts, normalized
into the same schema the page renders.

```
scripts/etl_tarkov_dev.py       snapshot json.tarkov.dev -> data/maps/<map>.json (+ index.json)
scripts/build_progression.py    snapshot + cached wiki -> progression.json + conflict report
scripts/build_page.py           data file -> page; --all builds every map; --level/--faction tailor it
scripts/compare_wiki.py         where tarkov.dev and the wiki disagree -> reports/<map>-conflicts.md
scripts/fetch_wiki_quests.py    pull and parse quest pages from the Fandom wiki
page/quest-progress.js          pure availability + prerequisite inference
page/eft-log-tracker.js         quest status from the game's Logs folder (inlined into every page)
tests/                          node --test tests/*.test.cjs
data/tasks-index.json           every task by BSG ID (the ID the game logs use)
data/customs-quests.json        hand-built Customs plan (raids, routes, curated spot notes)
data/maps/*.json                generated, one per map (raids empty until the planner exists)
snapshot/<mode>/<date>/         raw source files + manifest.json (sha256 per file); large, don't commit
page/...template.html           the page; renders hand-built or generated data
```

## Run it

    python scripts/etl_tarkov_dev.py                    # fetch today's snapshot and regenerate data/maps
    python scripts/etl_tarkov_dev.py --offline          # rebuild from the newest saved snapshot
    python scripts/etl_tarkov_dev.py --mode pve
    python scripts/build_progression.py               # one-time wiki crawl, cached; --refresh to refetch
    python scripts/build_page.py --all --level 24 --faction USEC
    python scripts/build_page.py --site --level 24 --faction USEC  # home + 24 map pages
    python scripts/refresh_site.py --offline --level 24           # both cached modes + reports + checks
    python scripts/fetch_wiki_quests.py "Pharmacist" "Work Smarter" > raw/some-quests.json
    python scripts/compare_wiki.py data/maps/customs.json raw/customs-wiki.json > reports/customs-conflicts.md

## Data source

PvP outputs remain in `data/maps/`; `--mode pve` now defaults to `data/pve/maps/`.
Each mode has its own task index and merged progression. Build progression once per mode
before `--site`; the raw wiki cache is shared by URL and never refetched without `--refresh`.

## Hosting and daily refresh (M2)

GitHub Pages publishes only `dist/`, through `.github/workflows/pages.yml`. The workflow runs
on main pushes, manual dispatch and daily at 08:23 UTC. It tests, fetches both modes (falling
back to the newest complete cached snapshot), builds both progression trees, runs the cached
Customs wiki comparison per mode, builds and checks the site, and deploys it. Source conflict
reports are downloadable workflow artifacts. The curated objective comparison covers its
named reference quests; progression conflicts cover each mode's full task set.

Snapshots are downloaded to a temporary directory and become eligible for fallback only
after the complete manifest is written. The cache retains the latest complete snapshot per
mode plus wiki responses; `snapshot/` is never committed. CI refuses to deploy source data
older than 24 hours. On a failed refresh, the previous site stays live and its source-date
warning becomes visible as it ages. GitHub scheduled runs can be delayed; freshness is
reported from the source timestamp, never the build timestamp.

For a new repository, enable Pages with **GitHub Actions** as the publishing source. The
workflow needs `pages: write` and `id-token: write` only in the deploy job. It uses GitHub's
[custom Pages workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
No separate hosting token is needed.

Open the public site directly in Chrome or Edge, choose a map and use **Connect logs folder**.
Folder access is local and read-only. HTTPS is a different origin from localhost: reconnect
the folder and choose/confirm your profile and wipe there. Localhost progress is preserved;
it is not silently copied to the new address. PvE scopes never consume PvP events.

The home page and all map pages share a theme switch and relative navigation. Existing
`maps/<map>.html` URLs remain PvP; PvE uses `pve/maps/<map>.html`.

## Snapshot source

`api.tarkov.dev` (GraphQL) was down during the build. The pipeline reads `json.tarkov.dev`
instead, which holds the static JSON the tarkov.dev site loads. It's the same data and has
stayed up while the GraphQL API was down. Requests need a full browser User-Agent, or
Cloudflare returns a bot-check page; the script detects that and falls back to the newest
complete snapshot. Map labels and coordinate rotation come from the tarkov-dev repo
(`src/data/maps.json`, MIT). tarkov-api and tarkov-data-manager are GPL-3.0; this project
uses their published data but none of their code.

## What the generated files carry

- **Quests**: giver, level, faction, prerequisites, wiki link, rewards, and objectives with
  type, count, weapons, targets, FIR and must-extract flags, and the zone each one happens in.
- **Zones**: objective positions within ~3% of the map's width of each other are clustered
  and named from the nearest tarkov.dev label plus a compass direction ("Big Red NW").
- **Acquisition**: every key or item a quest needs, with its own flea level (`minLevelForFlea`),
  trader offers with LL, price and quest unlock, barters, and hideout crafts.
- **Bosses**: spawn chance per location and escorts. **Extracts and transits** with positions.

## Quest tracking from game logs

Every page has a tracking panel on its Quests tab. Connect the EFT `Logs` folder once
(`C:\Escape From Tarkov\Logs` on this PC). The page then reads the newest session's
`push-notifications_000.log` every 4 s, switches to a new session folder within 30 s of a
game restart, and updates each quest's status (started / failed / completed).

- **Read-only.** It reads only the folder the user picks: no game memory, network or other files.
  It was written from scratch; TarkovMonitor was used only as a description of the log format.
- **Checked against real logs** (45 sessions, client 1.1.5–1.2.5): 293 chat notifications,
  130 started (type 10) and 52 completed (type 12), 0 malformed. 125 of 134 quest IDs are
  tarkov.dev task IDs; the rest are event/Arena tasks. Type 11 (failed) never appeared in
  these logs, so it's unverified. `message.text` says "quest started" even on completions, so
  only `message.type` is used. Session folder hours aren't zero-padded, so sessions are sorted by
  parsed time.
- **What logs can't do:** no kill counts or hand-ins, and no snapshot of existing progress.
  Set older quests with each card's status menu, or use *Scan past sessions*. A manual edit is
  stamped with the time it was made, so replaying older logs won't undo it.
- **Storage:** scopes, manual corrections and replayable event history live in `localStorage`
  (`eft-progress:v2`) and are shared by every map on the same origin. Profile, mode and wipe
  remain separate. The older `eft-quest-status:<mode>` key is preserved as unscoped evidence;
  migration requires a preview and explicit review. The folder handle lives in IndexedDB. If the browser drops permission, the panel
  shows *Reconnect logs folder*.
- **Where live tracking works:** Chrome or Edge over https or localhost
  (`python -m http.server 8765 --directory dist`). Other browsers, and pages embedded in a
  frame that may not open folders (such as the published artifact), fall back to *Import logs
  folder*, a one-time read through `<input webkitdirectory>`.

## Known gaps

- **Kappa flags:** tarkov.dev marks only 13 of 503 tasks as Kappa, so the flag is incomplete. Use the wiki for Kappa.
- **Rotation check:** the coordinate rotation was checked on Customs (180°) only. Factory, Labs and Labyrinth use 90°/270° and haven't been checked by eye.
- **Terminal:** it has no tasks in the data, so no file is generated for it.
- **Raids:** generated files have `raids: []`. The bundler/router (v2) fills them.
- **Log tracking:** a log file replaced by one of equal or larger size isn't detected as replaced. The quest-failed type (11) hasn't been seen in real logs yet.

## Available quests (M1)

Build progression after the ETL, before building pages. The progression builder reads the
newest local snapshot, requests each unique task wiki page at most once per second, and
stores the raw API responses in `raw/wiki/` (with a task-to-response index). Subsequent runs
use the cache, including cached errors; only `--refresh` refetches it. Review
`reports/progression-conflicts.md` after a rebuild. On overlapping edges, tarkov.dev's
structured statuses win; wiki-only edges fill missing history. A dev-only edge that
creates a completion cycle with the wiki chain is excluded and reported; cycles without
a dev-only edge fail the build for review. Explicit wiki alternatives
are grouped as either/or, as are mutually exclusive faction variants. Duplicate names use
structured task IDs where available; unresolved wiki prerequisites stay locked for review.
Self-links to wiki requirement sections do not become completion edges. Unknown globalVariable
conditions are reported and not guessed.

The Quests tab starts in **Current quests**, with **Possible unlocks (estimates)** and **All** views. All shows
locked reasons and **completed (implied)** history. Starting or completing a quest implies
its mandatory complete-only prerequisites recursively; active/failed alternatives do not
prove completion. Manual statuses win, including **Not started**. **Clear manual status**
removes that override so inference can apply again; scanning logs can restore recorded events.
Failed quests are unavailable unless restartable. Trader loyalty is annotated only.

The tracker panel's player level defaults to `--level` (the hand-built plan uses its own
level, or generated pages default to 1). It persists under `eft-player-level:<scope>`;
checklists use `eft-checklist:<scope>:<map>`. Older mode-only progress remains untouched. The build faction defaults
to USEC and can be changed with `--faction`. Faction variants retain their task IDs.
Map objective dots, gear and flea item rows follow the separate raid selection (M1B).

## Current-wipe accuracy (M1A)

Add a scope in the tracker panel: profile ID, game mode (from the page), a wipe name and a
player-confirmed local start time. Scan/import shows profile IDs and event date ranges as
evidence, but never chooses a reset automatically. Later confirmed wipe starts close the
previous wipe's interval for that profile/mode. Event timestamps decide inclusion even inside
a session. Live watching, scanning and importing all use the same journal and scope reducer.
Missing or mixed profile/mode evidence stays out of current progress. Old scopes remain
available in the selector. Clear manual status restores the scoped log evidence immediately.

Leaving the boundary empty creates a manual-only scope. Confirm a map's current list by
pasting one exact quest name per line, or edit individual statuses in All. This is current
membership, not raid selection: omitted historical starts retain their statuses and stay
reviewable in All. The correction is map-specific; a newer real start can add a quest back,
and a newer completion removes it. Manual-only scopes ignore logs until a dated scope is
chosen. Inference proves only earlier completion, never a new accepted quest.

The player's wipe-calendar screenshot gives 2025-11-15 as the public PvP wipe start. All 45
available sessions (182 events) are later, so that date alone does not resolve the discrepancy.
The raw history has 21 Customs starts: all 12 screenshot quests and nine extras. The confirmed
12-quest map list removes those extras from Current quests without fabricating completions.
Multi-map objectives and missing completion history remain possible explanations. A separate
character reset has not been established. This reference is a test fixture and a browser
correction, never a hard-coded universal quest list. M1B raid selection is implemented independently of this current-list correction.

Validation:

    node --test tests/*.test.cjs
    python -m unittest discover -s tests -p 'test_*.py'
    python scripts/build_page.py
    python scripts/build_page.py --all


## Manual raid focus (M1B)

One quest filter is shared by the whole site and remembered per browser: **Kappa** and trader
chips on the home page, the Quests tab, the raid picker, raid mode and search. Traders widen and
Kappa narrows, so Prapor + Kappa shows Prapor's Kappa quests. Past five traders the rest fold
behind **+n more** / **Fewer**. The filter decides what you see: the list, map pins, route and raid
mode show selected quests that pass it, and the count says how many selected quests it hides.
A map starts with no quests selected. **Select all** / **Select these n** and **Clear** /
**Unselect these** act on the shown quests, with **Undo**. **Include this raid** adjusts one quest; the Quests tab's **Show → Selected only**
compares a small set while browsing. The count shows selected versus current quests. Keys,
items, locations, and extraction requirements are listed for comparison; an absent requirement
means it is not listed in the dataset, rather than a guarantee about the game.

Selections live in `eft-progress:v2` under each scope's `raidFocus[map]`, using task IDs.
The first nonempty current list starts selected. Clear remains empty after reload; subsequent
new starts and reopened quests are not automatically added. Completion, failure, or removal
from the confirmed current list removes a quest from focus when the page evaluates it.
Changing selection never changes status, checklist progress, or log history. Map, profile,
mode and wipe selections remain separate. The smaller hand-built Customs page preserves
selections for quests that only the generated Customs page contains.

The map, its labels, bring list, gear acquisition cards and item flea rows use only selected
quests, regardless of the quest review filter. Shared locations/items stay until their last
selected consumer is removed. Consumable quantities sum; keys and weapons can be reused.
The ETL sums separate placement requirements (four WI-FI cameras, rather than one).
Quantities are full listed requirements, not remaining progress read from logs.

Hand-built routes retain authored stop order and show selected objective text in place of
mixed quest instructions. Unlinked optional detours are omitted; key sources remain in
Keys & items. This is manual focus, with no route optimization or automatic difficulty rank.


## Quest focus shortcuts

In PMC raid mode, Previous / Next highlights a selected quest card and its map locations in route
order. Ctrl + Shift + Left / Right does the same while the planner has focus. Browsing never checks
off objectives, edits quest status or changes the selected quests.

For shortcuts while Tarkov has focus, download `downloads/quest-shortcuts.zip` from the raid panel's
Keyboard shortcuts section. Extract it and follow its README to load the optional Chrome/Edge
extension. Use its toolbar button to explicitly choose one planner tab. Global defaults are
Ctrl + Shift + 9 / 0; change them to modified arrows in the browser's extension shortcut settings.
The extension has no game or log access and sends no data to a server. Closing/changing the map
or restarting the browser disarms it. This is an unpacked developer extension, not a store release.
