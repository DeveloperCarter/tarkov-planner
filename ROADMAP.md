# Roadmap

The product in one line: connect your EFT Logs folder, and the site shows which quests you can do
on each map right now, plans the raids, and tells you what to bring and what to keep.

The order is by return on effort. Each milestone ships something usable on its own.
M1A is implemented and checked against the supplied 12-quest Customs reference.
M1B is implemented and validated. M2 is deployed and its live HTTPS acceptance check passes.
The public Chrome tab watches the real Logs folder. Its Customs list has been reconciled
with the confirmed 12-quest reference, level 24, and a three-quest raid focus.
M3 spawn routing, UI integration and raid focus presets are implemented and tested.
M4 (real maps, spot photos, quest details) shipped ahead of it.

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

## M2 · Ship it on https  (implemented; live-folder check passed)

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
**Live check passed:** the player's public Chrome tab watches the real session
`log_2026.10.20_19-42-17_1.2.5.0.48146`, reports PvP and continues polling. Its past-session
scan reads 46 sessions / 182 quest events. The new origin initially had 21 historical starts,
level 1 and an empty selection because the earlier localhost correction was not present.
The same supplied 12-quest Customs reference was explicitly confirmed through the UI;
level 24 was restored. Chemical Experiments, Tigr Safari and Pharmacist are selected for a
readable quick test: 3 selected / 12 current, 5 spots, 1 required key. The nine extra starts
remain history; none was falsely completed or failed. Existing local progress is preserved.
No DNS records or other personal-site content were changed.

**Usability finding from the player's screenshot:** a connected folder does not reconstruct
an exact current quest list from incomplete historical logs. Current-list confirmation and
player level are too easy to miss below the map. The blank schematic with tiny labels and
all extracts is still difficult to use as a raid map, even after selecting quests. Real
terrain remains M4 and generated routes remain M3; neither is claimed complete here.
Phone transfer/sync work was cancelled by the player and is not included.
After reconciling the live public state, all 64 Node tests and 13 Python tests pass; both
default builds succeed and all 130 inline scripts / local navigation links pass. The public
tab has no console warnings/errors and remains connected while changing raid selections.

## M3 · Spawn-based objective routes and raid focus presets (implemented)

Route through the player's selected current quests from M1B, starting at the actual spawn.
The route ends at the last objective. Extract planning, automatic key-based raid grouping and
splitting the selection into several raids are outside this design.

1. **Live raid events** — `page/eft-log-tracker.js` parses the application log's matching result,
   GameStarted and incidental Position lines. `onRaid(event,meta)` receives only live lines, never
   an old raid from initial connection, scans or imports. Map names use snapshot nameId values;
   unknown locations stay unknown. Never retain identity/network details in raid events.
2. **Spawn areas** — the offline ETL emits PMC player spawns in frame and game coordinates and
   deterministic named areas near extracts. Single-linkage uses 150 m (175 m on Woods), giving
   4 Customs, 10 Woods and 4 Shoreline areas. Matching accepts the closest individual spawn within
   30 m. Dense maps may have one broad area; coarse areas are a manual fallback.
3. **Objective route** — `page/raid-route.js` is pure UMD, tested in Node. Selected objectives with
   zones become stops; shared zones merge, done objectives drop, unfinished counters remain.
   Multi-zone objectives are alternatives (including random item search spots), not all required
   targets. Choose alternatives globally with the order. Up to ten independent requirements or
   candidate stops use exact Held–Karp; larger cases use nearest-neighbour plus 2-opt and report
   approximate:true. Distances are straight lines in game metres, not terrain-aware paths.
4. **UI integration** — prompt for the spawn area if no usable Position arrives
   within ten seconds, or it is over 30 m from a known spawn. Offer manual correction and reroute
   from the last completed stop. A raid-loading event can prepare the map during loading;
   raid-started begins the wait. Missing/unknown maps must never select an unrelated map silently.
   Show the route for the selected quests only, with its approximation/search-location caveats.

5. **Raid focus presets** — choose quests inside raid mode using All current, Key raids, No required
   keys, Quest-item pickups, Mark & place or Combat. Show counts, describe each preset, and allow
   checkbox adjustments and Clear. Apply only current quests; never alter statuses or assume key
   ownership. Preset selections use the existing scoped raid-focus persistence.

**Foundation checks:** synthetic fixtures cover multi-raid/split-chunk parsing, live-only watcher
callbacks, rotations, spawn filtering and matching, brute-force route optimality, alternative zones,
shared stops, counters, rerouting, determinism and the large-route approximation flag. Both modes
regenerate offline. The integrated UI draws numbered routes, offers manual spawn selection, prompts when live logs lack
a usable position, and reroutes on objective completion. Key and pickup presets are covered by
synthetic tests; desktop/mobile interaction checks cover cards, selection, routes and both themes.

**Done when:** the foundation tests/build checks pass and the integrated UI handles a
live raid, manual area selection when the log lacks a position, quest selection changes and
completion-based rerouting. No extract recommendation is part of this milestone.

**Quest focus shortcuts (2026-10-25):** PMC raid mode can browse the selected quests in route
order with Previous/Next or Ctrl+Shift+Left/Right while focused. The optional unpacked Chrome/Edge
extension supplies global commands to one explicitly chosen map tab while Tarkov has focus. The
controls highlight cards/pins and frame locations without checking objectives or changing selection.

## M4 · Real maps, spot photos and quest details  (implemented)

The schematic dots were hard to use without terrain, and players wanted to see each spot.

- **Map art:** tarkov.dev's SVG maps (CC BY-NC-SA 4.0), ground floor only, recoloured to the
  site palette in both themes. Ten maps have art; Icebreaker, Labs and Labyrinth keep the schematic.
  Checked by eye on Customs, Ground Zero, Reserve and Factory (90°).
- **Map viewer:** drag, pinch and Ctrl + scroll to zoom; Fit frames the selected spots; full screen.
  Each selected quest has a colour and number shared by its pins and its picker entry. Tapping a pin
  shows the quests there, their objectives at that spot and a photo. A plain wheel still scrolls the
  page, and one-finger drags scroll it until you zoom in.
- **Quest detail panel:** opened from a card title or thumbnail, the picker, a pin or a prerequisite.
  Spot photos with captions (swipe, full-screen viewer), where with Show on map, objectives, gear,
  tips, status and unlock requirements, and the wiki link. Back or Esc closes it.
- **Spot photos:** the wiki's quest galleries, ~1,180 images for 272 quests, downloaded by
  `scripts/fetch_art.py` into a cache CI keeps; nothing is committed.

**Licensing (decided by the owner, 2026-10-21):** fine while the site is free and non-commercial.
Before any paid tier: get permission from the map authors or replace the art, and replace the wiki
screenshots (Battlestate Games' images) with our own.

## M5 · FIR keep list  (implemented)

A Keep tab listing the found-in-raid items needed by your active and available quests, with
quantities and which quest needs each. It also flags items that locked quests further down the
chain will need.

**Status:** a Keep tab on every map page and a section on the home page, built from
`dist/career-data.json` (all quests in the mode, not just this map). Find and hand-over pairs for
the same items count once, alternative items share one quantity, and checklist counters reduce
what's outstanding. Rows split into current quests, possible unlocks and later quests.

## M6 · Kappa tracker  (implemented)

How far you are from the Kappa container, and what to do next to get closer. Builds on what
exists: the wiki's Kappa flags (`build_page.wiki_kappa`, already on the map pages and in the
search index) and the scoped quest statuses from the logs.

- **Progress:** "Kappa: 87 / 195 quests" for the chosen profile, mode and wipe, on the home page and
  in the site bar, with a per-trader breakdown. PvP and PvE count separately.
- **What's next:** the Kappa quests you can do now, ordered by how many other Kappa quests each one
  unlocks, then by level. Each shows its map, and maps get a "Kappa quests here" count, so
  the raid picker can favour them.
- **What's blocking:** Kappa quests locked behind level, trader loyalty or earlier quests, with the
  nearest blocker named ("needs level 35", "after Setup"). Failed or missed Kappa quests get a
  warning, since some can't be restarted.
- **The Collector:** the found-in-raid items it needs, shared with the M5 keep list. The logs don't
  record hand-ins, so items are ticked by hand and saved per scope.
- **Checks:** a test that the Kappa count matches the cached wiki pages for the current task list,
  and that quests the wiki doesn't cover are listed for review instead of counted silently.

**Done when:** the home page and every map page show the same Kappa progress for the chosen
scope, the next and blocked lists match the progression data, and The Collector's items can be
ticked off and survive a reload.

**Status:** a "Kappa: n / total" button in the site bar opens Keep and Kappa views; the home page
shows the same, and map cards and the raid picker show "Kappa quests here". Only wiki-confirmed
flags count, and quests without wiki coverage are listed for review. Accepted quests lead What's
next. Collector hand-ins are saved per scope and carried over when a wipe boundary is confirmed.
The map and raid-mode quest pickers have a Kappa-only filter and a Kappa quests preset.

## M7 · Scav mode  (implemented; auto-switch not done)

A short, phone-friendly list of the found-in-raid items your quests still need, for scav runs.
It reuses the M5 keep list (`QuestCareer.evaluate`); scav runs are about loot, not objectives.

- **Where:** a Scav toggle in raid mode swaps the checklist and route for the item list and keeps
  the map and clock. Auto-switch only if the logs reliably mark a scav raid (check whether the scav
  profile ID differs from the PMC one in real logs first); until then the toggle is manual.
- **What:** items for current quests, then possible unlocks, then The Collector, with the count still
  needed and which quests want each. Exclude quest-only pickups (`findQuestItem`) and anything
  handed in or ticked. Sort by count still needed.
- **Found this raid:** + / − counters per row, saved per profile, mode and wipe as a stash count kept
  apart from hand-ins ("need 3 · have 2 in stash"). Leaving scav mode gives a short summary
  ("Found 4 items for 3 quests").
- **Later, if a source holds up:** where needed items tend to spawn on this map, only from
  tarkov.dev loot-container data, never guessed. Hideout found-in-raid items need a hideout tracker first.
- **Checks:** tests that quest-only items are excluded, stash counts reduce what's still needed without
  completing quests, and shared items count once. Browser check at phone width and desktop, light and
  dark, with counters surviving a reload.

**Done when:** raid mode can switch to Scav and show only items a scav can bring back for your
quests, and counting them updates the Keep list on every page.

**Status:** a Scav toggle in the raid mode header swaps the checklist and route for the item list
(current quests open; possible unlocks and The Collector folded) and lists scav extracts. + and −
change a stash count saved per scope (`ProgressStore.setStash`, `QuestCareer.scavList`); the Keep
list shows it. Turning Scav off or leaving raid mode shows a short summary. Stash counts are not
cleared when a quest is handed in; lower them with −. Not done: auto-switch from the logs, map hints.

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
5. **Map art and photos (decided):** use tarkov.dev's maps and the wiki's spot photos while the site
   is free; replace both before anything is paid. See M4.
