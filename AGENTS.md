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
page/raid-suggest.js           suggested raids: groups current quests by area, for an aim (pure UMD, tested)
page/map-home.js               home-page counts using the same scoped quest evaluation
page/quest-career.js           all-quest keep list and Kappa progress for a scope (pure UMD, tested)
page/quest-career.template.js  the site bar's Keep/Kappa dialog and home/map views; fetches career-data.json
scripts/career_data.py         dist/career-data.json rows: Kappa flag, Collector, keep requirements
page/site-search.js            quest browser ranking, trader/map filters and paging over dist/search-index.json (pure, tested)
page/quest-filter.js           the one site-wide quest filter (lists and suggestions only, never the selection), its chips and session storage (tested)
page/quest-focus.js            focus mode: quest order, the path through what's left, next two quests, doors (pure UMD, tested)
page/quest-focus.template.js   focus mode's map overlay, expanded card, toggle and clicks; inlined into each map page
page/settings-dialog.template.html, settings-map.template.html   the one Settings dialog; the second part is map-only corrections
page/settings.template.js      Settings controller and the log connection, shared by the home and map pages
page/quest-effort.js           easy wins, gear status (have/flea/trader/barter/find), gear ready and the per-quest todo line (tested)
page/map-floors.js             which area names, extracts and keycard doors show on the chosen floor (pure, tested)
scripts/effort.py              per-quest effort facts (spots, kills, hand-ins, keys and items and how to get them) for every page
page/site-search.template.js   the site bar's search box (Ctrl K); inlined into every page with the site bar
scripts/refresh_site.py        both-mode refresh, cached wiki comparisons, release build and validation
scripts/check_site.py          inline-script parsing and relative navigation validation
data/pve/                     PvE maps, task index and progression (never reuse PvP gates)
.github/workflows/pages.yml    daily refresh and GitHub Pages deployment
data/customs-quests.json       hand-built Customs plan; the reference result for the raid bundler
data/placeholder-quests.json   hand-kept quests seen in logs that tarkov.dev doesn't list yet (no player data)
data/hand-quests.json          hand-written quests with objectives, in tarkov.dev's task shape, for when a placeholder isn't enough
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
- 1.x unlocks (checked 2026-10-31): many reworked quests have no `taskRequirements` in tarkov.dev and
  a blank wiki `previous`. They unlock by the giver's loyalty level and a count of that trader's
  completed quests at that level: the wiki infobox's `LL requirement` and `LL quests` ("LL2 quests
  completed: 4"). `build_progression.py` stores them as `loyalty: {trader, level, quests?}` and fills a
  missing trader level gate. QuestProgress locks a quest until enough quests with the same trader and
  level are completed. On real logs this count matched 33 of 36 starts, most of them exactly. The
  3 misses were Therapist LL3 quests, likely counting a quest tarkov.dev lacks. `[PVP ZONE]` variants
  are marked `counted: false`: counting Easy Money - Part 1 [PVP ZONE] would open Supplements and
  Friend From the West, which the game still hid. The game also groups some quests as "Essential
  tasks"; that flag isn't in either source.
- Logs decide availability (checked 2026-11-01 against in-game lists for Prapor, Jaeger, Ragman, Mechanic,
  Peacekeeper and Ref): every quest the game listed had a logged start (64 of 64), and none of about 72
  quests the rules called open but that never started were listed. So with logs back to First in Line,
  `ProgressStore.evaluate` locks an unstarted quest with reason `notOffered`; a manual status wins and
  `startLogged: false` (BTR Driver) opts out. Wiki page facts from `page_facts`: `removed` ("was a
  Quest"; 33, dropped from Kappa and keep counts unless started), `story` ("[[Boreas]] story chapter"),
  `edition` ("Edge of Darkness" edition), and "Must be level N" raising a lower `minLevel`. The wiki's
  `{{Seasonal change}}` banner is unreliable (To Great Heights! - Part 4 is still offered); don't use it.

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
  Map pages mark wiki answers with `kappaSource: "wiki"`.
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
- Spots and pins (2026-11-01): `cluster` merges objective positions within 3% of the map's size (45 m on
  Shoreline), except two objectives of one quest more than `SAME_QUEST_SPOT` (15 m) apart: those are two
  places (Health Care Privacy - Part 1's ambulances are 43 m apart). This added 1-6 spots on 6 of 12 maps.
  A shared pin shows the lead quest's number (the focused one, else the first) and the others beside
  it (`RaidFocus.pinNumbers`, five before a count). An area name under a quest pin moves to the nearest
  free side within 40 px (`MapFloors.besidePin`), else it hides: further off, West Wing landed east of East Wing.
- `RaidRoute.route(data,selectedIds,start,{done})` uses selected quest IDs/bsgIds, merges shared
  zones, drops completed/optional objectives and ignores objectives without zones. `done` is an objective-ID
  Set, or a Map/object with booleans, numeric counters or `{count}`; counters finish at objective.count.
  `start` is `{gx,gz}`, a spawn-area ID (member centroid), or a previous output stop for rerouting.
  Stops include zone,x,y,gx,gz,quests,objectives. Exact generalized Held–Karp handles up to ten
  independent requirements or candidate stops, including global choice among alternative zones;
  larger problems use deterministic nearest-neighbour and open-path 2-opt with approximate:true.
  Identical/subsumed requirements are reduced first. No extracts are added.

**M3 UI integration and raid presets (2026-10-21)**
- build_page.py inlines RaidRoute, RaidSession and RaidSuggest. Manual spawn selection is available
  before and during raid mode. Matching live raid events use ProgressStore.accepts for the current
  profile/mode/wipe; they never change quest status. No spawn/raid positions are persisted.
- A missing or unmatched spawn prompts for an area after ten seconds (immediately if unmatched).
  Manual choice wins over late automatic detection. Another map's loading event clears the prior
  route and shows a notice; it does not navigate automatically. The route never includes an extract.
- Marking a prefix of stops done reroutes from the last completed one. Checking a later stop out of
  order drops its objective without teleporting the route start. Counters need their full quantity.
- Suggested raids (2026-11-03) replaced the presets, in the plan panel and raid mode's picker alike.
  `RaidSuggest.plan` puts each current quest in one place: a raid (2+ quests with a spot within 100 m of
  one spot), any raid (no fixed spot left), or elsewhere. Choosing a raid replaces spot quests but keeps
  chosen flexible ones. On real logs "finish here" was often a minority (2 of 8 on Shoreline's Resort),
  so a card always says how many finish. Optional keys don't count. Key ownership is unknown.
  Clear stays empty; current scope/map persistence continues through RaidFocus.
- The filter never hides selected quests, pins or route stops (it used to, with "hidden by the filter").
  It lasts for the tab's session, in `sessionStorage`. The bar is a Filter button, the active filters as
  removable chips, and a panel grouped as Show only (Gear ready, Finishes here, Easy, Kappa, No keys), Objective and Trader.
  Finishes here (`RaidSuggest.finishable`): not multi-map, and all unfinished located work has a spot within one
  100 m area. It only means something on a map, so site search neither shows nor applies it (`MAP_FLAGS`); with
  it on, raid cards hold only quests their area finishes (`plan({whole})`), and home counts per map card.
- Gear (2026-11-06): `effort.keys`/`effort.items` list required keys and items with `fleaLevel`, `trader`
  (sold for cash) and `barter`; weapons are left out (any of many guns). `QuestEffort.gear` ranks have >
  flea at your level > trader > barter > find; `readiness` sets each page's `q.ready`. "Have" ticks are
  `scope.gear[itemId]`, for every map, carried over by `setBoundary`. Trader loyalty isn't known, so a
  trader source counts as buyable and names its LL. At level 28 almost every key is on the flea; the
  blockers are flea-banned items and ones whose flea level is above yours. The Keys & items tab lists gear
  for all current quests on the map or only this raid, can't-buy first, each naming its quests.
  The home page reads `dist/raid-areas.json` (and `pve/`) to rank maps by best raid.
- Clicking card titles or ordinary text opens details; checkboxes/buttons/links/selects retain
  their actions. Raid-mode Map is a separate control. On localhost, source merges require a fresh
  build of dist/ and page reload: an older local dist caused the reported missing card interaction.

**Focus mode and Settings (2026-11-09)**
- Focus mode is a toggle on the map, remembered in `eft-quest-focus`. `QuestFocus.plan` picks the open quest at hand and walks what it has left
  with `RaidRoute.route` over frame coordinates (uniform scale; works without spawns, so the hand-built plan focuses too). The path runs on to the
  next two quests; other selected quests are faint unnumbered dots. Any-of spots the route doesn't walk (random item locations) are rings. Ticking the
  last required objective moves to whichever quest was next. It steps aside for a scav run. Never edits selection or progress.
- `doors` (each map) are tarkov.dev locks for keys that map's quests need; all 67 required quest keys on PvP had one (2026-11-09). A key can have several
  doors; `QuestFocus.doors` picks the closest to the quest's spots. Nothing says which objective a key is for, so a quest shows its doors until it's done.
- Focus keys (2026-11-09): plain Left/Right swap photos; Page Down ticks the outlined objective or adds one to its counter, Page Up undoes. Held keys don't repeat.
  The extension sends the same four actions. Chrome requires Ctrl or Alt in a command and allows four suggested keys (global ones only Ctrl+Shift+digit), so undo and previous photo are
  unbound by default. A tick writes the map's checklist only, never a quest's status.
- All settings live in one dialog opened from the site bar, home included: logs, profile and wipe, level, focus, raid mode, theme. Home also tails the
  logs through the same controller. Manual scopes, history and quest list corrections need a map's quests, so only map pages show them.

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
  Its content script bridges only direction commands and four named focus actions (`QuestFocus.ACTIONS`) to the page on allowlisted planner
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
  Extracts are too: every extract and transit carries raw game `gx`/`gz` and height `gy` (0.1 m), and
  `MapFloors.floorOf` assigns them like tarkov.dev's layers: the first floor whose `extents` (height
  [low, high), optional `bounds` boxes in game x/z) hold the point, else the `base` floor. The Lab's
  Second Level box covers only the north-west block, so Hangar and Parking Gate (above 3 m) stay on
  the ground floor and only Cargo Elevator is on the second level. Opening an extract from the raid
  panel turns the map to its floor.
  Keycard doors (`keycards`, every map) are tarkov.dev locks whose key's name contains "keycard",
  with the same `gx`/`gz`/`gy`, so `MapFloors.pointsOn` puts them on floors like extracts. The page
  draws a small card in the card's colour (Lab colours; others neutral). `data/keycard-doors.json`
  adds doors seen in game that tarkov.dev lacks (Offices #2 took the Black keycard, reported
  2026-10-29, room only); they're drawn dashed, and the ETL says when tarkov.dev lists a door for
  the same keycard within 10 m so the entry can go.
- Best keys for loot (`data/loot-keys.json`, ranked by hand 2026-11-08): the ETL joins each pick to today's price and uses, and counts
  Bitcoin, LEDX, graphics cards, Labs keycards and marked keys at loose spots within 7 m and 2.2 m of height of its doors, plus containers.
  No room outlines exist, so hallways can count. tarkov.dev's `lootLoose` holds no ammo at all: ammo picks need the wiki's Behind the Lock,
  a dated player source or the containers. Many rooms changed at 1.0, so check a wiki page's last edit before trusting it.
  Places (`places`) are hand-listed spots tarkov.dev has no label for, from `data/map-places.json`, drawn as a
  named ring. Woods' Marked Circle Bunker uses Hindsight 20/20's `Bunker_enter` zone: same bunker (checked 2026-11-01).
  Ways in (`waysIn` in the same file) become an extract's `ways: {routes, spots}`. No source lists unlocked doors or
  windows, so they're hand-listed. Keep them subtle: faint unnamed dots only while that extract's popup is open, the words in the popup.
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
- tarkov.dev has lagged the game: on 2026-11-03 it still listed 503 tasks, without 1.3's To the Light chain past Getting
  Acquainted. `load_snapshot` adds `data/hand-quests.json` to the raw tasks, so the maps, progression and search treat them
  alike. A hand quest needs its real ID from a logged start, or tracking can't match it and `notOffered` locks it.

## Writing style for UI text

Plain and specific, in the player's terms: "Connect logs folder", "Reconnect logs folder".
Error text says what happened and what to do. No exclamation marks, no filler.
