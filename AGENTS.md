# Agent guide: tarkov-planner

A static site for Escape from Tarkov players: available quests per map, raid plans, keys and items,
and quest status read from the game's own log files. The plan is in `ROADMAP.md`; work through
it in order and don't start a milestone until the one before it meets its "Done when".

## Layout

```
scripts/etl_tarkov_dev.py      json.tarkov.dev snapshot -> data/maps/<map>.json, data/tasks-index.json
scripts/build_page.py          data file -> dist/ page (--all, --level, --faction); validates references
scripts/fetch_wiki_quests.py   Fandom wiki quest pages -> JSON (objectives, rewards, spot captions)
scripts/fetch_art.py           tarkov.dev SVG maps + wiki spot photos -> cache/art/ (gitignored; CI caches it)
data/art/<map>.json, <map>/    our own floor plans (The Lab: 1st, 2nd, Technical PNGs); committed, shipped by build_page.py
tools/draw_floor_art.py        redraws the Lab plans from tarkov.dev's tiles (Pillow; run by hand, never by CI)
scripts/compare_wiki.py        tarkov.dev vs wiki disagreements -> reports/
page/customs-raid-plan.template.html   the one page template (vanilla JS, no framework, no bundler)
page/eft-log-tracker.js        log parser + watcher; inlined by build_page.py; loaded by Node tests
page/progress-store.js         profile/mode/wipe scopes, replay history and current-list corrections
page/raid-focus.js             manual raid selection, shared locations/items and filtered plan projection
page/raid-route.js             spawn matching and shortest open objective route (pure UMD; no extracts)
page/raid-session.js           transient spawn/start/completion state (pure UMD)
page/raid-presets.js           current-quest raid focus presets (pure UMD)
page/map-home.js               home-page counts using the same scoped quest evaluation
page/quest-career.js           all-quest keep list and Kappa progress for a scope (pure UMD, tested)
page/quest-career.template.js  the site bar's Keep/Kappa dialog and home/map views; fetches career-data.json
scripts/career_data.py         dist/career-data.json rows: Kappa flag, Collector, keep requirements
page/site-search.js            quest browser ranking, trader/map filters and paging over dist/search-index.json (pure, tested)
page/quest-filter.js           the one site-wide quest filter (traders widen, Kappa and Easy narrow), its chips and storage (tested)
page/quest-effort.js           easy-win judgement of a quest's effort facts with the player's level (tested)
page/map-floors.js             which area names show on the chosen floor, by height range (pure, tested)
scripts/effort.py              per-quest effort facts (spots, kills, hand-ins, keys and how to buy them) for every page
page/site-search.template.js   the site bar's search box (Ctrl K); inlined into every page with the site bar
scripts/refresh_site.py        both-mode refresh, cached wiki comparisons, release build and validation
scripts/check_site.py          inline-script parsing and relative navigation validation
data/pve/                     PvE maps, task index and progression (never reuse PvP gates)
.github/workflows/pages.yml    daily refresh and GitHub Pages deployment
data/customs-quests.json       hand-built Customs plan; the reference result for the raid bundler
data/placeholder-quests.json   hand-kept quests seen in logs that tarkov.dev doesn't list yet (no player data)
tests/                         node:test files (*.test.cjs) + fixtures
snapshot/ dist/                generated; never commit (.gitignore)
```

## Commands

```
python scripts/etl_tarkov_dev.py --offline        # rebuild data from the newest snapshot (no network)
python scripts/etl_tarkov_dev.py                  # fetch a fresh snapshot first
python scripts/build_page.py                      # hand-built Customs page
python scripts/build_page.py --all --level 24 --faction USEC
python scripts/build_page.py --site --level 24 --faction USEC  # home + both modes
python scripts/refresh_site.py --offline --level 24          # validate the cached release
python scripts/check_site.py
node --test tests/log-tracker.test.cjs tests/log-watcher.test.cjs
python -m http.server 8765 --directory dist      # live log tracking needs localhost or https
```

Python 3.10+ (standard library only). Node 18+ (tests only; nothing to install).

## Definition of done for any change

1. All Node tests pass, and any new logic has tests.
2. `python scripts/build_page.py` and `--all` both succeed. The validator fails the build on broken
   zone, quest or extract references.
3. The inline scripts in a built page parse (`node --check` on the extracted `<script>` contents).
4. Load a built page over localhost with no console errors, in both light and dark themes, at
   ~400px width as well as desktop.

## Hard constraints

- **Log tracking is read-only and touches only the Logs folder the user picks.** Never read game
  memory, network traffic, other game files, or talk to BSG servers.
- **No GPL code.** TarkovMonitor, tarkov-api and tarkov-data-manager are GPL-3.0; use them as
  references only. The tarkov-dev site repo is MIT; its `src/data/maps.json` is used for labels
  and coordinate rotation.
- **Wiki text is CC BY-SA.** Use facts and links; don't paste prose into the UI.
- **Pure logic goes in `page/*.js` modules** using the existing UMD pattern (`module.exports` in
  Node, a global in the browser) so tests can load it. Keep DOM code in the template.
- **Browser storage:** current progress lives in `localStorage` under `eft-progress:v2`, scoped
  by profile/mode/wipe and shared across map pages. Preserve `eft-quest-status:<mode>` as
  read-only legacy evidence; never silently migrate it. The folder handle lives in IndexedDB.
  Wrap every storage access in try/catch. Checklists and player levels are scoped too.
  Raid selections use each scope's `raidFocus[map]`; an explicit empty selection stays empty.
  Selection never changes quest statuses or current membership.
- **Publishing:** only `dist/` is hosted. Never publish game logs, browser state or progress fixtures
  containing a real profile. Keep `snapshot/` ignored; CI caches only the latest complete snapshot
  per mode. Daily refreshes never pass wiki `--refresh`. A release refuses snapshots over 24 hours old;
  a failed refresh preserves the previous public deployment and reports its actual age in the UI.
- **Mode paths:** PvP uses `data/maps/`, PvE `data/pve/maps/`; their task indexes and progression
  files are separate. Public pages use `maps/` and `pve/maps/`. Keep navigation relative so the
  GitHub Pages project prefix works. Do not silently migrate progress between origins.

## Data facts (verified 2026-10-20; don't re-derive)

**json.tarkov.dev**
- `json.tarkov.dev/<mode>/<dataset>` and `<dataset>_en` work. `api.tarkov.dev` (GraphQL) was down.
- Requests need a full browser User-Agent, or Cloudflare returns an HTML bot-check page.
- Text fields are translation keys; look them up in the `_en` files.

**tarkov.dev quirks**
- `kappaRequired` is true for only 13 of 503 tasks. Don't trust it; use the wiki for Kappa.
- `taskRequirements` is incomplete for 1.0 (see ROADMAP M1).
- Objective `count` can be null.
- An objective listing several `items` means any one of them works.
- Some names repeat as faction variants. Key by task ID, never by name.
- A task's own `map` is what the in-game map filter uses; it's null for quests spanning several
  maps. Map data keeps every quest with an objective on the map and marks `onMap` from the task
  map. A player's confirmed map list only governs `onMap` quests. Verified on real logs: grouping
  this way reproduced the player's 12 Customs quests exactly.
- Wiki prerequisites are often outdated (progression was loosened in 1.x); real accept order
  contradicted about a dozen of them. Prefer tarkov.dev requirements and the logged order.

**Coordinates**
- Map position = game `(x, z)` rotated by `coordinateRotation`, the same formula as tarkov.dev's
  `applyRotation`. Checked by eye on Customs, Ground Zero, Reserve (180°) and Factory (90°).
- tarkov.dev stretches each SVG map over the projected corners of `svgBounds` (else `bounds`), both
  given as `[x, z]`. With a uniform `transform` (x and y scales equal) that's a scale of our frame, so
  the ETL stores the art's rectangle in frame units as `meta.art`. Icebreaker's transform isn't
  uniform. The Lab and the Labyrinth have tiles (`tilePath`) instead of an SVG; `meta.art` is their
  `bounds` rectangle. The Lab draws our own floor plans there; the Labyrinth has none, so the build
  drops its rectangle and it keeps the schematic.

**Extract details (verified 2026-10-21)**
- Extracts retain their IDs, translated names, faction and frame coordinates. New fields are
  `type` (pmc/scav/shared/coop/transit), `requirement` (none/paid/flare/switch/item/coop/cliff/other),
  `alwaysOpen` (boolean or null), `sides`, and a short factual `note`. `cost` is the wiki's base
  fare per player in roubles; Scav karma can change it. `item` can describe several required items.
- `alwaysOpen` follows the wiki's "Always available" column (available each raid), not whether
  the player has already fulfilled a switch, item, flare, co-op or timing requirement.
- The snapshot repeats the same switch list on all Customs and Labs extracts, but omits switch
  links for Reserve D-2 and Bunker Hermetic Door. Never infer a power requirement from a repeated
  map-wide list. Reviewed `data/extract-rules.json` mappings identify verified switches; their
  `switch: {id,name,x,y}` uses the same rotation and Frame as the exit. Missing positions are reported.
- A green flare described as an "open" indicator is different from firing a signal flare. Customs
  Old Gas Station also has different PMC/Scav availability. Reviewed overrides handle these cases.
- Some paid/item data appears as `transferItem`, but its quantity is not necessarily the wiki's
  per-player fare (Customs vehicles list 20,000 versus the wiki's 5,000 base fee). Do not silently
  substitute that quantity for a per-player price. Icebreaker also requires 2,400 euros alongside
  a flare: retain the currency in the note rather than inventing a rouble conversion.
- Map extraction/transit wikitext responses are cached under `raw/wiki/extracts/` (committed, like
  the quest pages), including the wiki's own errors but never network failures, at one request per second. Only explicit `etl_tarkov_dev.py --refresh` refetches; `--offline`
  reads the cache without networking. Unknown/ambiguous rules keep `alwaysOpen: null` and/or
  `unclassified` reasons and print `UNCLASSIFIED` lines. No missing rule becomes an unrestricted exit.
- Search indexes are generated by `build_page.py --site` at `dist/search-index.json` and
  `dist/pve/search-index.json`. Each task ID is included once, even without map objectives;
  placeholder level/wiki can be null when unknown. All map hrefs are relative to the site root,
  including hrefs inside the PvE index. Kappa comes from the cached wiki quest page when there is one,
  as on the map pages (`build_page.wiki_kappa`); tarkov.dev's flag marks only a handful of tasks.
- `dist/career-data.json` (and `pve/`) holds every task in the mode for the Keep and Kappa views.
  Its `kappa` is the wiki's answer or null; null quests are listed for review, never counted.
  Map pages mark wiki answers with `kappaSource: "wiki"`; the Kappa preset and filter need it.
  Collector hand-ins aren't in the logs; they're ticked by hand into `scope.collector`.

**Spawn areas and objective routes (2026-10-21)**
- `map.nameId` in both cached snapshots supplies game location IDs. `bigmap` -> customs;
  `TarkovStreets` -> streets-of-tarkov; `Woods`, `Shoreline`, `Lighthouse`, `Interchange`, `Icebreaker`,
  `Terminal` -> their lower-case keys; `RezervBase` -> reserve; `laboratory`/`laboratory_dark` -> the-lab;
  `factory4_day`/`factory4_night` -> factory; `Labyrinth` -> the-labyrinth;
  `Sandbox`/`Sandbox_high`/`Sandbox_start` -> ground-zero. Unknown locations remain null.
- PMC player spawns have `sides` containing pmc or all and `categories` containing player. Store
  `spawns: [{x,y,gx,gz,area}]`: x/y are the existing rotated Frame, gx/gz raw game x/z rounded to 0.1 m.
  `spawnAreas: [{id,name,x,y,count}]` are deterministic single-linkage components. The threshold is
  150 game metres, except Woods at 175 m: this produces Customs 120/4, Woods 140/10, Shoreline 130/4
  spawns/areas in the cached snapshot. A common threshold could not produce 4–10 on all three.
  Dense maps can chain into one large area; these labels are coarse manual fallbacks, not spawn IDs.
- Names use the closest PMC/shared (including co-op) extract to the area centroid, with compass
  suffixes for duplicate names and stable numbers for same-direction ties. Terminal has no eligible
  extract, so its area is explicitly unnamed. No exit planning or exit eligibility is implied.
- `etl_tarkov_dev.match_spawn` and `RaidRoute.matchSpawn(data,gx,gz)` return the closest spawn,
  its area and distance only within 30 m (inclusive). Ties sort by raw coordinates, then area ID.
- An objective's multi-zone list is alternatives, not a checklist. Verified in the snapshot:
  Abandoned Cargo marks any of seven cargo boxes, Tigr Safari any of three vehicles, and Steady
  Signal any of five weather stations. Multiple visit volumes can also describe one target;
  work at distinct required targets appears as separate objective IDs. `possibleLocations` are
  random quest-item locations, also alternatives: a route cannot know which currently holds the item.
  ETL marks multi-zone objectives `zoneMode: "any"`; the route also supports explicit "all".
- Objective zones retain raw centroid `gx/gz` (0.1 m) and frame x/y. `meta.frame.scale` is frame units
  per game metre. Distances use the x/z plane, ignore walls, paths, elevations, enemies and keys,
  and end at the last objective. These are geometric routes, not guaranteed walkable paths.
- `RaidRoute.route(data,selectedIds,start,{done})` uses selected quest IDs/bsgIds, merges shared
  zones, drops completed/optional objectives and ignores objectives without zones. `done` is an objective-ID
  Set, or a Map/object with booleans, numeric counters or `{count}`; counters finish at objective.count.
  `start` is `{gx,gz}`, a spawn-area ID (member centroid), or a previous output stop for rerouting.
  Stops include zone,x,y,gx,gz,quests,objectives. Exact generalized Held–Karp handles up to ten
  independent requirements or candidate stops, including global choice among alternative zones;
  larger problems use deterministic nearest-neighbour and open-path 2-opt with approximate:true.
  Identical/subsumed requirements are reduced first. No extracts are added.

**M3 UI integration and raid presets (2026-10-21)**
- build_page.py inlines RaidRoute, RaidSession and RaidPresets. Manual spawn selection is available
  before and during raid mode. Matching live raid events use ProgressStore.accepts for the current
  profile/mode/wipe; they never change quest status. No spawn/raid positions are persisted.
- A missing or unmatched spawn prompts for an area after ten seconds (immediately if unmatched).
  Manual choice wins over late automatic detection. Another map's loading event clears the prior
  route and shows a notice; it does not navigate automatically. The route never includes an extract.
- Marking a prefix of stops done reroutes from the last completed one. Checking a later stop out of
  order drops its objective without teleporting the route start. Counters need their full quantity.
- Raid mode contains a collapsible quest picker and All current, Key raids, No required keys,
  Quest-item pickups, Mark & place, and Combat presets. Presets replace only raid selection from
  current quests on this page, including multi-map quests. Optional keys don't qualify as required.
  Objective presets ignore done/optional objectives; general loot handovers aren't located pickups.
  Key ownership is unknown. Counts and checkboxes show exactly which quests will be selected.
  Clear stays empty; current scope/map persistence continues through RaidFocus.
- Clicking card titles or ordinary text opens details; checkboxes/buttons/links/selects retain
  their actions. Raid-mode Map is a separate control. On localhost, source merges require a fresh
  build of dist/ and page reload: an older local dist caused the reported missing card interaction.

**Quest navigation and optional global shortcuts (2026-10-25)**
- `page/quest-navigation.js` is pure UMD: supplied selected-quest order, stable IDs, wraparound and
  local key mapping. The template controller highlights a raid card and its pins, frames locations,
  and scrolls that card into view. Focus never writes progress, selection or route completion.
- The controller pauses outside PMC raid mode, with no selected quests, in inputs or with a dialog
  open. Local keys ignore inputs. Ctrl+Shift+Left/Right works with page focus; buttons offer the same action.
- `extension/quest-shortcuts/` is an optional unpacked MV3 Chrome/Edge extension, packaged by
  `build_page.build_shortcuts` into `dist/downloads/quest-shortcuts.zip`. Commands are global,
  default Ctrl+Shift+9/0 (Chrome restricts suggested global keys); users may remap to modified arrows.
- Extension storage.session retains exactly one explicitly chosen map tab. It clears on browser
  restart, tab close or map/mode URL change, and survives a same-page reload or worker suspension.
  Its content script bridges only direction commands to the visual controller on allowlisted planner
  map URLs. No game/log/progress reading, native host, network calls or tab activation is used.

**Map art and spot photos**
- SVG maps: the-hideout/tarkov-dev-svg-maps, CC BY-NC-SA 4.0 (non-commercial; credit and same
  licence for modified copies; no use in cheats). `fetch_art.py` keeps only the ground floor; the page
  drops the SVG's own `<style>` and recolours its classes (land, trees, water, building, road_*, ...).
- Lab floor plans (`data/art/the-lab/`, 2026-10-28): drawn by `tools/draw_floor_art.py` from
  tarkov.dev's zoom-3 tiles (`labs_v4`, last modified 2025-01-20), cropped to `bounds` so they line up
  by construction. The tiles store walls as thin transparent lines; the plans keep only walls, room
  tones, planters and large fixtures. Image models redrawing the reference drifted 50–200 px in three
  attempts; don't use them for map geometry. Floors aren't assigned to pins: zones carry no height.
  Area names are: the ETL keeps tarkov.dev's label `top`/`bottom` (metres) where given (Lab, Factory,
  Interchange, Reserve, Shoreline, some Ground Zero), each floor in `data/art/the-lab.json` has the
  layer's `height` range, and `page/map-floors.js` shows labels whose open range overlaps the floor's.
  build_page.py prefers these plans over cached art and ships them as `meta.art.floors`
  (first = default); the page swaps the `<image>` with the floor buttons and darkens it in dark theme.
- Spot photos: each quest's wiki `<gallery>` (game screenshots; Battlestate Games' copyright, no
  licence). Thumbnails need a `Referer` header or the image server answers 403, and arrive as WebP
  whatever the file name says. Free, non-commercial use only; revisit before anything paid.

**Game logs (EFT 1.2.5)**
- Session folders: `log_YYYY.M.D_H-MM-SS_<version>`. Hours aren't zero-padded, so sort by the
  parsed time, never by name.
- Quest events are in `<prefix> push-notifications_000.log`.
- Use `message.type` only: 10 = started, 12 = completed, 11 = failed (11 not yet seen in real
  logs). `message.text` is unreliable.
- Quest ID = first word of `message.templateId`, and it equals the tarkov.dev task ID.
- `eventId` is always present. Use `message.dt` (Unix seconds) for ordering.
- The application log line `Session mode: Regular|Pve` gives the mode.
- Supplied verification over 120 EFT 1.2.5 raids: application_000.log has `TRACE-NetworkGameCreate
  profileStatus: ... Location: bigmap, ...` at matching end, and `GameStarted:...` at raid start.
  Incidental `Reason:PacketsQueue|Lift|Speed, Position:(x,y,z), ...` lines sometimes follow in 2–5 s.
  This Position line is undocumented and may disappear. Provided samples had positions in Customs
  5/10, Woods 4/7, Shoreline 3/9 and Streets 37/58 raids; Labs, Factory and Labyrinth had none.
  Some Streets positions were up to 95 m from a spawn; reject matches over 30 m and ask for an area.
- `EftLogs.RaidParser` is a pure streaming line parser; raidEventsFromText is its complete-text helper.
  Events are raid-loading {location,map,at}, raid-started {map,at}, and spawn-position
  {map,x,y,z,at,secondsAfterStart,reason}, each with kind. at is epoch milliseconds; only the first
  qualifying Position within ten seconds (inclusive) after GameStarted is emitted per raid.
  A loading event resets the raid. Events retain no profile/account IDs, IPs, Sid or shortId.
- Optional `new LogWatcher({onRaid(event,meta)})` tails application files incrementally with UTF-8
  split-chunk handling, session/file rotations and truncation detection. Initial application history
  and replaced-file history prime context silently; scanPast/importFileList never emit raid events.
  Identity re-reads never replay raids. The callback uses the existing session identity metadata;
  the event itself has only the whitelist above. Log access remains read-only in the picked folder.

- `PrepareSelectedProfileLocally ProfileId:<24 hex>` identifies the profile. Retain no account ID.
  Missing identity or mixed profiles/modes stays in history, never guessed into a wipe.
- A First in Line (`657315ddab5a49b71f098853`) event means the logs reach the character's start,
  so replaying them gives the full quest history. Completions were reliable in 47 real sessions.
- BTR Driver quests are accepted in raid and leave no start event. Repeatable (daily/weekly)
  templates reuse one ID and complete repeatedly; new 1.2.5 quests may be missing from tarkov.dev.

## Writing style for UI text

Plain and specific, in the player's terms: "Connect logs folder", "Reconnect logs folder".
Error text says what happened and what to do. No exclamation marks, no filler.
