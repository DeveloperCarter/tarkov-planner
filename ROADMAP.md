# Roadmap

The product in one line: connect your EFT Logs folder, and the site shows which quests you can do
on each map right now, plans the raids, and tells you what to bring and what to keep.

The order is by return on effort. Each milestone ships something usable on its own.
M1A is implemented and checked against the supplied 12-quest Customs reference.
M1B is implemented and validated. M2 is deployed and public HTTPS access is verified.
The final real-folder live-tracking check awaits the player's Chrome folder selection;
M2 is not yet accepted as complete.
M3 remains unstarted.

## Where things stand (2026-10-20)

| Built | Where |
|---|---|
| Hand-built Customs plan: 3 raids, routes, keys, flea locks | `data/customs-quests.json`, published artifact |
| Data for every map from tarkov.dev, with a snapshot fallback | `scripts/etl_tarkov_dev.py` → `data/maps/*.json` |
| A page for any map, tailored by level and faction | `scripts/build_page.py --all --level 24 --faction USEC` |
| Quest status from game logs: live watching, past-session scan, import fallback, manual edits | `page/eft-log-tracker.js`, 19 tests |
| Wiki fetcher and a tarkov.dev-vs-wiki conflict report | `scripts/fetch_wiki_quests.py`, `scripts/compare_wiki.py` |
| M1 progression tree, prerequisite inference, level/faction gates and quest views | `scripts/build_progression.py`, `page/quest-progress.js`, page template |
| M1A profile/mode/wipe scopes, current-list reconciliation and preserved legacy history | `page/progress-store.js`, log identity metadata, tracker panel |
| M1B manual raid focus, shared locations/items and filtered hand-built routes | `page/raid-focus.js`, map-side picker, Selected only |
| M2 home page, separate mode data/builds, source freshness and daily Pages workflow | `page/map-home.js`, `scripts/refresh_site.py`, `.github/workflows/pages.yml` |

**Current accuracy gap:** the generated Customs page shows 34 predicted available quests;
the player's screenshots show 12 current Customs quests. The previous check established
that all 12 were included, but did not establish that the extra quests belonged in the list.
"Started sometime in the logs", "possibly unlocked", and "currently active in game" must
be separate concepts. The player's later wipe-calendar screenshot gives 2025-11-15 as the
public PvP wipe start. All 45 available sessions are later, and identified sessions share one
profile; a public-wipe cutoff alone therefore does not explain the discrepancy. A separate
character reset is unknown. Raw history contains 21 Customs starts (12 expected plus nine
extras). Map associations and missing completion history remain unresolved. M1A uses the
explicitly confirmed 12-quest map list without fabricating completions for those extras.

## Dropped, and why

- **Automatic screenshot / OCR import.** Still deferred. User-provided screenshots can serve
  as a manual reconciliation reference; logs and inference alone cannot establish which
  wipe an older event belongs to.
- **TarkovTracker import as the main input.** Same reason. Two-way sync is in Later.
- **Wiki as the main data source.** tarkov.dev is structured and has positions. The wiki is still
  used for three things: the progression tree (M1), Kappa flags, and spot descriptions.
- **Hand-written plans for each map.** The raid bundler (M3) produces them. Customs stays as the
  reference result the bundler is tested against.
- **Progress tracking and freshness flags as their own features.** Both exist now. Freshness
  becomes a scheduled job in M2.

## M1 · Progression foundation  (implemented; accuracy follow-up required)

Everything after this depends on knowing which quests are available, so it comes first.
The foundation below is implemented. Its original acceptance check was insufficient:
including all expected quests does not prove that the other displayed quests are current.
M1A and M1B below supersede the default-view and state assumptions
in this initial foundation.

**What we found:** tarkov.dev's prerequisites are incomplete for 1.0. 300 of 503 tasks list
none, including quests the wiki says have one (Trophy → Secured Perimeter, Angry Watchman →
Forest Cleaning, Work Smarter → Acquaintance). Another 168 tasks are gated by a `globalVariable`
requirement that doesn't say what unlocks it. tarkov.dev does have `minPlayerLevel`, trader
loyalty requirements, faction, and `restartable`.

1. **Progression tree** — `scripts/build_progression.py` → `data/progression.json`
   - Fetch every task's wiki page once and cache it under `raw/wiki/`. That's about 500
     requests at 1 per second; reruns read the cache.
   - Parse the infobox `previous` field. It can hold several links. "Accept X" means X must be
     active or complete; a plain link means X must be complete.
   - Merge with tarkov.dev's `taskRequirements` (statuses: complete / active / failed),
     `minPlayerLevel`, `traderRequirements`, `factionName` and `restartable`.
   - Keep the source of every requirement (`tarkov.dev`, `wiki`, or `both`) and write
     disagreements to `reports/progression-conflicts.md`.
2. **Unlock logic** — new pure module `page/quest-progress.js`, inlined like the tracker and
   tested in Node.
   - A quest is *available* when all of these hold: it isn't completed, every prerequisite
     status is met, your level ≥ its minimum level, and the faction matches.
   - A failed quest stays hidden unless it's `restartable`.
   - **Inference:** if a quest is started or completed, every prerequisite it needs to be
     *complete* is complete too, following the chain all the way back. This fills in history
     from before your logs began. Show these as "completed (implied)" and let a manual edit
     override them.
   - Trader loyalty is unknown, so don't hide on it. Show "needs Therapist LL2". Optionally,
     let the user enter their loyalty levels.
3. **Page**
   - Default view: **Available now**. Completed and locked quests are hidden automatically.
     Also offer *Active only* and *All*. In *All*, locked quests say why they're locked.
   - A level input in the tracker panel, saved in the browser. It replaces the `--level` baked
     in at build time.
   - The map dots and the Keys & items tab follow the visible quests, and the counts line says
     how many quests are shown versus hidden.

**Foundation checks (passed; not proof of current-list accuracy):**
- Tests cover chains, active and failed prerequisites, inference and restartable quests.
- With the statuses from the real logs, all 12 of your active Customs quests show up, and quests
  you've completed don't.
- `progression-conflicts.md` exists and has been read.

## M1A · Match the current wipe and quest list  (implemented)

Establish trustworthy current state before adding more planning behavior. Do not infer a
wipe boundary from a game version or a missing completion event alone.

1. **Explicit progress scope**
   - Identify the active profile, game mode and wipe/reset boundary. Let the player confirm
     a start date/time or first session; display the chosen scope and the evidence for it.
     Use known evidence to suggest a boundary, but do not silently guess one.
   - Scope statuses, manual overrides, inferred history and event deduplication to that
     profile/mode/wipe. Earlier wipes must not leak started or completed quests into it.
   - Apply the same boundary to live watching, Scan past sessions and folder import. Use
     event timestamps, including when a session straddles the boundary.
   - Preserve existing browser data. Treat the legacy mode-only store as unscoped history;
     preview any migration and do not silently import it as current-wipe truth. Switching
     wipes must restore each wipe's own progress, without deleting or editing game logs.
2. **Separate current quests from predicted unlocks**
   - Default to **Current quests**: accepted, unfinished quests supported by current-wipe
     events or explicit player confirmation. Prerequisite inference may establish earlier
     completions within this scope; it must not invent active quests.
   - Put unaccepted, predicted unlocks in **Possible unlocks**, clearly marked as estimates.
     Opaque progression conditions mean they are not proof that a quest is offered in game.
     Keep **All** for reviewing history, locked reasons and manual corrections.
   - Counts must distinguish current quests, possible unlocks and older/unscoped history.
     Correcting current membership must not falsely mark an old quest completed or failed.
3. **Reconcile against the player's screenshots**
   - Reference list: The Huntsman Path - Trophy; Chemical Experiments; Abandoned Cargo;
     Pharmacist; Tigr Safari; Private Club; The Punisher - Part 1; Provide Viewership;
     Break the Deal; Shaking Up the Teller; The Huntsman Path - Angry Watchman; Work Smarter.
   - Replay only the confirmed current scope, then compare both missing quests and extras
     against this 12-quest baseline. Explain every discrepancy, including any broad map
     association that differs from the in-game Customs filter. Do not hard-code this list
     as every player's permanent quest list.
   - Allow a manually confirmed current list when logs are incomplete. New starts and
     completions in the current scope must update it without replaying old history over it.

**Done when:**
- Tests replay the same quest IDs across two wipes, including an old completion, an old
  unfinished start, overlapping scans, a boundary inside a session, and manual overrides.
- Live watching, past-session scanning and importing produce the same scoped result.
- At the provided screenshot baseline, the confirmed Customs list matches the 12 quests;
  neither the previous 34 predictions nor stale starts are presented as confirmed current.
  Any remaining mismatch is explicitly reported rather than hidden behind a coverage count.
- Wipe switching and legacy-data migration preserve progress and keep inference isolated.

**Checked 2026-10-20:** 47 Node tests and seven Python tests pass; both page builds succeed;
52 inline scripts parse. Live watching, scan and import agree in fixtures, including a boundary
inside a session and late/mixed identity. A real browser import reads 182 events from 45
sessions. The public wipe reference preserves all of them; reconciling with the screenshot
list gives exactly 12 current Customs quests, zero missing and zero extras. The nine earlier
starts remain reviewable. Legacy mode-only storage is preserved, with previewed migration;
levels and checklists also use the selected scope. Public wipe date is supplied evidence,
not proof of an individual reset or of every historical start still being active.
Light/dark checks at 1440px and 400px have no console errors or page overflow, including
expanded scope/history controls. Current quests, estimates, All, map dots and gear agree.

## M1B · Select quests for this raid  (implemented)

Make it easy to focus on a small, manageable subset before building an automatic bundler.

- Add an **Include this raid** checkbox for each current quest, plus Select all and Clear.
  Selection is separate from quest status: deselecting never completes, fails or abandons it.
- Provide a compact quest picker beside the map, including while viewing Raid plan, so the
  player can select and unselect without switching between long quest cards and the visual.
- Offer **Selected only**, and show **N selected / M current**. Preserve selections for the
  active map and progress scope; completing a quest removes it from the active raid focus.
- Map dots, objective labels, the bring list and Keys & items must follow the selected set.
  Shared locations and items remain while at least one selected quest needs them. With no
  quests selected, show a clear empty state instead of falling back to all map objectives.
- Show practical comparison facts: needed keys/items, objective locations, and whether the
  objective requires extraction. Let the player choose an easy combination; do not claim
  an automatic easiest-route ranking while the bundler is still unimplemented.
- If the hand-built plan is shown, hide unrelated stops and quest references for the chosen
  subset. Do not recalculate or claim an optimized route as part of this manual-focus phase.

**Done when:**
- A player can start with the confirmed 12 Customs quests, choose two or three, and see only
  their relevant map locations and gear. Toggling one quest updates the view immediately.
- Select all, Clear, shared dots/items, reload persistence, wipe/profile/mode isolation and
  completion of a selected quest are covered by tests. Selection never alters quest status.
- The picker and selected map are comprehensible at desktop and about 400px, in both themes,
  with no console errors. All existing tests and both page builds still pass.

**Checked 2026-10-20:** 56 Node tests and eight Python tests pass. Both builds succeed;
65 inline scripts parse across 13 pages. The 12-quest reference can select Chemical Experiments,
Tigr Safari and Pharmacist to show exactly five locations and three gear items. Shared locations
and items survive until their last selected quest is removed. Clear stays empty after reload;
completion removes selection, and reopening or accepting a quest does not automatically add it.
Selections are isolated by map/profile/mode/wipe and never edit progress. The first nonempty
current list is selected by default. A smaller hand-built page preserves selections for quests
it does not contain. Separate consumable placements now sum correctly in the ETL (four cameras).
Browser checks cover light/dark at 1440px and 400px with no console warnings/errors or page
overflow, plus completion, card/picker synchronization, Selected only, All, empty gear, reload,
and filtered hand-built routes. Read-only replay now finds 46 sessions and 182 quest events;
the M1A screenshot-confirmed baseline still has exactly 12 Customs quests, no missing or extra.
The nine additional historical starts remain an accuracy limitation, preserved for review.
No automatic bundling, ranking, deployment, or M2 work was added.

## M2 · Ship it on https  (public HTTPS verified; live-folder check pending)

Start only after M1A and M1B pass their acceptance checks.

The artifact's frame blocks the folder picker. A real https host makes live tracking work in
Chrome or Edge for anyone.

1. **Front door** — `dist/index.html`: one card per map showing current quests in the chosen
   profile/mode/wipe, with possible unlocks counted separately, plus a nav bar on every page.
2. **PvP and PvE** — run the ETL with `--mode pve` and build both sets. Statuses are already kept
   separately per mode, and the logs already say which mode a session was.
3. **Deploy** — static hosting for `dist/` on Cloudflare Pages or GitHub Pages.
4. **Scheduled refresh** — a daily job: ETL (falls back to the last snapshot), build `--all`,
   `compare_wiki`, deploy. Never commit `snapshot/`; keep the latest snapshot as a cache.

**Done when:** a public URL connects a real Logs folder live, data is at most a day old, and
the PvE pages track PvE sessions only.

**Implementation:** the home page uses the same `ProgressStore.evaluate` result as each map,
including map-specific current-list corrections and the saved scoped player level. It shows
current quests separately from possible unlock estimates. PvP retains `maps/` URLs; PvE uses
`pve/maps/`, its own task index, progression and snapshot. Shared relative navigation supports
the GitHub Pages project prefix. Both modes share local browser storage but never scope events
from the other mode into progress. Theme controls are present on the home and map pages.

The daily GitHub Actions workflow refreshes both modes, rebuilds progression using the shared
wiki cache without `--refresh`, compares the curated wiki reference, checks tests/scripts/links
and publishes `dist/`. Only the latest complete snapshot per mode is cached, never committed.
Partial downloads cannot overwrite fallback snapshots. Releases reject data more than 24 hours
old; the previous public site remains live and displays its actual source age after a failure.

**Local checks:** 62 Node tests and 13 Python tests pass. Default, `--all` and `--site` builds
succeed; 130 inline scripts and navigation links pass across 26 local pages (the release has
25 pages; the extra local page is the hand-built Customs reference). Both-mode offline refresh,
cached comparisons and snapshot pruning pass. Browser and live HTTPS results are recorded
after publication. No M3 work is included.

**Publication check:** the public repository is `DeveloperCarter/tarkov-planner`. GitHub Actions
run `39532750613` passes all 62 Node and 13 Python tests, refreshes both snapshots, checks 25
release pages / 125 scripts / relative links, saves the fallback cache and deploys successfully.
Browser checks on localhost cover the home and both mode pages in light/dark at 1440px/400px,
with no console warnings/errors or horizontal overflow. Home Customs agrees with the confirmed
12 current quests and 14 separate unlock estimates; PvE has no selected scope and shows zero.

**Domain issue resolved with owner approval:** the personal Pages site's retired
`carterbrown.dev` CNAME was removed in commit `3dfa494ee33f8c9795689392d3d32ded2bb1e1dc`.
GitHub automatically cleared its custom-domain setting. After the personal site rebuilt, the
planner's standard HTTPS URL returned HTTP 200 with no redirect to the retired domain. The
public home and Customs tracker load directly in Chrome with no console warnings/errors.
HTTP redirects to HTTPS, and the Pages API confirms HTTPS enforcement. The deployed home,
PvP and PvE pages also pass light/dark at 1440px/400px without console errors or overflow.
The tracker offers Connect logs folder; a real native folder selection is still required
before marking the live-folder acceptance check complete. HTTPS has a separate browser store
from localhost; the existing local scope/corrections remain preserved. No DNS records or
other personal-site content were changed.

## M3 · Raid bundler v1  (M–L, what sets this apart)

Turns the player's selected current quests from M1B into the `raids` structure the page
already renders. Do not silently add every predicted unlock or unselected quest.

- **Route stops:** placement, visit, mark and fetch objectives become stops in their zones.
  Kill and counter objectives become "every raid" notes, not stops.
- **Grouping:** first a raid with no keys, then raids gated by keys (only for keys you've marked
  as owned or that are obtainable). Cap each raid at about 6–8 stops, and group the
  must-extract items onto one survivable route.
- **Order:** nearest-neighbour from the spawn side, ending at the nearest PMC extract that's
  always open. Paid, flare and note-gated extracts only when you meet the condition.
- **Testing:** golden test against `data/customs-quests.json`, where the hand-built plan is the
  reference. It must cover every placement objective in at most 3 raids, with the key-gated work
  in a separate raid.

**Done when:** every map with selected quests gets raids covering that selection, changing
the selection updates the plan, Customs passes the golden test, and the bundler is a pure
module with unit tests.

## M4 · Real map backgrounds  (M)

The schematic dots are hard to use without terrain.

- Use tarkov.dev's SVG maps (`svgPath` in their `maps.json`) and copy them into `dist/`.
  **Check the license of the-hideout/tarkov-dev-svg-maps before shipping.**
- Place spots with the existing coordinate rotation, and check the 90°/270° maps (Factory, Labs,
  Labyrinth) by eye.
- Keep the schematic as the fallback.

## M5 · FIR keep list  (S)

A Keep tab listing the found-in-raid items needed by your active and available quests, with
quantities and which quest needs each. It also flags items that locked quests further down the
chain will need.

## Later (after people are using it)

Squad merge (shared stops, who carries what) · TarkovTracker two-way sync · Boss and ammo brief ·
In-raid second-screen view · Ask-the-planner (Claude reads the plan and progress) · Hideout items
in the keep list · Paid tier (only once usage is proven)

## Decisions for you

1. **Hosting and repo (decided):** GitHub Pages with a public repository, selected for M2.
2. **Wipe boundary:** the supplied public PvP wipe date is 2025-11-15. A separate character
   reset is unknown; scopes allow an explicit correction. Historical starts are not proof of
   current membership, so the player-confirmed 12-quest Customs list remains authoritative.
3. **Already decided for M1:** wiki pages are cached at 1 request/second and refetched only
   with explicit `--refresh`; trader loyalty annotates only; player level is saved in-browser
   and defaults to the build's `--level`.
4. **PvE (decided):** included in M2 with separate mode snapshots and progression.
5. **Map art:** if the SVG license doesn't allow reuse, keep the schematic or look for other art?
