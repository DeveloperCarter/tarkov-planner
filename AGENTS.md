# Agent guide: tarkov-planner

A static site for Escape from Tarkov players: available quests per map, raid plans, keys and items,
and quest status read from the game's own log files. The plan is in `ROADMAP.md`; work through
it in order and don't start a milestone until the one before it meets its "Done when".

## Layout

```
scripts/etl_tarkov_dev.py      json.tarkov.dev snapshot -> data/maps/<map>.json, data/tasks-index.json
scripts/build_page.py          data file -> dist/ page (--all, --level, --faction); validates references
scripts/fetch_wiki_quests.py   Fandom wiki quest pages -> JSON (objectives, rewards, spot captions)
scripts/compare_wiki.py        tarkov.dev vs wiki disagreements -> reports/
page/customs-raid-plan.template.html   the one page template (vanilla JS, no framework, no bundler)
page/eft-log-tracker.js        log parser + watcher; inlined by build_page.py; loaded by Node tests
page/progress-store.js         profile/mode/wipe scopes, replay history and current-list corrections
page/raid-focus.js             manual raid selection, shared locations/items and filtered plan projection
page/map-home.js               home-page counts using the same scoped quest evaluation
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
- Map position = game `(x, z)` rotated by `coordinateRotation`. Checked on Customs (180°) only.

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
