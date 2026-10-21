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
scripts/compare_wiki.py        tarkov.dev vs wiki disagreements -> reports/
page/customs-raid-plan.template.html   the one page template (vanilla JS, no framework, no bundler)
page/eft-log-tracker.js        log parser + watcher; inlined by build_page.py; loaded by Node tests
page/progress-store.js         profile/mode/wipe scopes, replay history and current-list corrections
page/raid-focus.js             manual raid selection, shared locations/items and filtered plan projection
page/map-home.js               home-page counts using the same scoped quest evaluation
page/site-search.js            site-wide quest search ranking over dist/search-index.json (pure, tested)
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
  uniform, and Labs/Labyrinth have no SVG: they keep the schematic.

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

**Map art and spot photos**
- SVG maps: the-hideout/tarkov-dev-svg-maps, CC BY-NC-SA 4.0 (non-commercial; credit and same
  licence for modified copies; no use in cheats). `fetch_art.py` keeps only the ground floor; the page
  drops the SVG's own `<style>` and recolours its classes (land, trees, water, building, road_*, ...).
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
- `PrepareSelectedProfileLocally ProfileId:<24 hex>` identifies the profile. Retain no account ID.
  Missing identity or mixed profiles/modes stays in history, never guessed into a wipe.
- A First in Line (`657315ddab5a49b71f098853`) event means the logs reach the character's start,
  so replaying them gives the full quest history. Completions were reliable in 47 real sessions.
- BTR Driver quests are accepted in raid and leave no start event. Repeatable (daily/weekly)
  templates reuse one ID and complete repeatedly; new 1.2.5 quests may be missing from tarkov.dev.

## Writing style for UI text

Plain and specific, in the player's terms: "Connect logs folder", "Reconnect logs folder".
Error text says what happened and what to do. No exclamation marks, no filler.
