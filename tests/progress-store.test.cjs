const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const S = require("../page/progress-store.js");
const P = require("../page/quest-progress.js");
const L = require("../page/eft-log-tracker.js");
const profile = "a".repeat(24), other = "b".repeat(24);
const meta = { profileId: profile, mode: "regular", session: "log_2026.10.20_9-00-00_v" };
const scope = (s, start = 100, mode = "regular", id = profile) => S.createScope(s, { profile: id, mode, start, label: `Wipe ${start}` });
const event = (questId, status, at, key = `${questId}-${at}-${status}`) => ({ questId, status, at, key });
const tree = { a: {}, b: { requirements: [{ task: "a", statuses: ["complete"] }] }, c: { minLevel: 99 } };

test("two wipes isolate old completions, unfinished starts, deduplication and inferred chains", () => {
  const s = S.empty(), old = scope(s, 0), now = scope(s, 100);
  const events = [event("a", "completed", 10), event("c", "started", 20), event("b", "started", 110)];
  S.ingest(s, events, meta); S.ingest(s, events, meta);
  assert.deepEqual(Object.keys(S.derive(s, now).statuses), ["b"]);
  assert.equal(S.evaluate(s, now, tree).statuses.a.source, "inferred");
  assert.equal(S.evaluate(s, now, tree).quests.c.current, false);
  assert.equal(S.derive(s, old).statuses.c.status, "started");
  assert.equal(S.derive(s, old).statuses.b, undefined, "later wipe must not appear when switching back");
  assert.equal(Object.keys(S.derive(s, now).seen).length, 1);
  assert.equal(Object.keys(s.journal).length, 3);
});

test("boundary uses event timestamp within a session, not session date or log arrival", () => {
  const s = S.empty(), k = scope(s);
  S.ingest(s, [event("a", "completed", 99), event("a", "started", 100), { ...event("b", "started", 90), logged: 150 }], meta);
  assert.deepEqual(Object.keys(S.derive(s, k).statuses), ["a"]);
  assert.equal(S.derive(s, k).statuses.a.status, "started");
});

test("equal-time replay is deterministic across scan/import ordering", () => {
  const a = S.empty(), b = S.empty(), ka = scope(a), kb = scope(b);
  const events = [event("a", "started", 110, "00"), event("a", "completed", 110, "01")];
  S.ingest(a, events.map((e, seq) => ({ ...e, seq })), meta);
  S.ingest(b, [...events].reverse().map((e, seq) => ({ ...e, seq })), meta);
  assert.deepEqual(S.derive(a, ka), S.derive(b, kb));
});

test("profile, mode, missing identity and mixed sessions cannot leak into the scope", () => {
  const s = S.empty(), k = scope(s);
  for (const [i, m] of [{ ...meta, profileId: other }, { ...meta, mode: "pve" }, { ...meta, mode: null },
    { ...meta, profileId: null }, { ...meta, identityConflict: true }].entries()) {
    S.ingest(s, [event("a", "started", 110, `unknown-${i}`)], m);
  }
  assert.deepEqual(S.derive(s, k).statuses, {});
  assert.equal(S.historyCounts(s, k).excluded, 5);
});

test("detected profiles come only from identified sessions in the page's mode", () => {
  const s = S.empty();
  S.ingest(s, [event("a", "started", 300), event("b", "completed", 200)], meta);
  S.ingest(s, [event("c", "started", 500)], { ...meta, profileId: other, session: "s2" });
  S.ingest(s, [event("d", "started", 400)], { ...meta, mode: "pve", session: "s3" });
  S.ingest(s, [event("e", "started", 400)], { ...meta, mode: null, session: "s4" });
  S.ingest(s, [event("f", "started", 400)], { ...meta, identityConflict: true, session: "s5" });
  const found = S.detectedProfiles(s, "regular");
  assert.deepEqual(found.profiles.map(p => [p.profileId, p.events, p.first, p.last]), [[other, 1, 500, 500], [profile, 2, 200, 300]]);
  assert.equal(found.unusable, 2, "missing mode and mixed identity are counted, never offered");
  assert.deepEqual(S.detectedProfiles(s, "pve").profiles.map(p => p.profileId), [profile]);
  assert.deepEqual(S.detectedProfiles(S.empty(), "regular"), { profiles: [], unusable: 0 });
});

test("a player-confirmed boundary turns a manual scope into a log scope and keeps manual edits", () => {
  const s = S.empty(), k = scope(s, null);
  S.ingest(s, [event("b", "started", 110), event("c", "started", 50)], meta);
  S.setManual(s, k, "a", "started", 120);
  S.confirmCurrent(s, k, ["a", "b"], ["a"], 130, "Customs");
  const next = S.setBoundary(s, k, 100, "First logged quest event; confirmed by player");
  assert.notEqual(next, k);
  assert.equal(s.scopes[k], undefined, "the manual-only scope is replaced, not duplicated");
  assert.equal(s.active.regular, next);
  assert.deepEqual(Object.keys(S.derive(s, next).statuses).sort(), ["a", "b"], "events before the boundary stay out");
  assert.equal(s.scopes[next].membership.Customs.a.current, true);
  assert.throws(() => S.setBoundary(s, next, NaN), /valid start/);
});

test("manual-only scope ignores all log history until a boundary is confirmed", () => {
  const s = S.empty(), k = scope(s, null);
  S.ingest(s, [event("b", "started", 110)], meta);
  S.setManual(s, k, "a", "started", 120);
  assert.deepEqual(Object.keys(S.derive(s, k).statuses), ["a"]);
  assert.equal(S.evaluate(s, k, tree).quests.b.current, false);
});

test("manual corrections survive overlapping replays; later real events update them; clearing restores evidence", () => {
  const s = S.empty(), k = scope(s);
  S.ingest(s, [event("a", "started", 110)], meta);
  S.setManual(s, k, "a", "not-started", 120);
  S.ingest(s, [event("a", "started", 110)], meta);
  assert.equal(S.derive(s, k).statuses.a.status, "not-started");
  S.setManual(s, k, "a", null);
  assert.equal(S.derive(s, k).statuses.a.status, "started");
  S.setManual(s, k, "a", "started", 120);
  S.ingest(s, [event("a", "completed", 130)], meta);
  assert.equal(S.derive(s, k).statuses.a.status, "completed");
});

test("map reconciliation suppresses extras without faking completion or failure; later starts restore membership", () => {
  const s = S.empty(), k = scope(s);
  S.ingest(s, [event("a", "started", 110), event("b", "started", 111)], meta);
  S.confirmCurrent(s, k, ["a", "b", "c"], ["b"], 120);
  let r = S.evaluate(s, k, tree);
  assert.equal(S.derive(s, k).statuses.a.status, "started");
  assert.equal(r.quests.a.current, false);
  assert.equal(r.quests.b.current, true);
  S.ingest(s, [event("a", "started", 130), event("b", "completed", 140)], meta);
  r = S.evaluate(s, k, tree);
  assert.equal(r.quests.a.current, true);
  assert.equal(r.quests.b.current, false);
});

test("current membership remains distinct from predicted unlocks and static gate disagreements", () => {
  const s = S.empty(), k = scope(s);
  S.setManual(s, k, "c", "started", 120);
  const r = S.evaluate(s, k, tree, { level: 1 });
  assert.equal(P.visible(r.quests.c, "current"), true);
  assert.equal(P.visible(r.quests.c, "possible"), false);
  assert.equal(r.quests.c.locked, true); // reported, but never hides an accepted quest
  assert.equal(P.visible(r.quests.a, "possible"), true);
  assert.equal(P.visible(r.quests.a, "current"), false);
  assert.equal(S.evaluate(s, "", tree).quests.a.possible, false);
});

test("scope switching and JSON persistence preserve separate manual histories", () => {
  const s = S.empty(), a = scope(s, 0), b = scope(s, 100), pve = scope(s, 100, "pve"), second = scope(s, 100, "regular", other);
  S.setManual(s, a, "a", "completed", 90); S.setManual(s, b, "a", "started", 120);
  const loaded = JSON.parse(JSON.stringify(s));
  assert.equal(S.derive(loaded, a).statuses.a.status, "completed");
  assert.equal(S.derive(loaded, b).statuses.a.status, "started");
  assert.deepEqual(S.derive(loaded, pve).statuses, {});
  assert.deepEqual(S.derive(loaded, second).statuses, {});
});

test("a confirmed map list only governs quests located on that map", () => {
  const s = S.empty(), k = scope(s);
  S.ingest(s, [event("a", "started", 110), event("b", "started", 111)], meta);
  S.confirmCurrent(s, k, ["a", "b"], [], 120, "Customs"); // an earlier list that covered every quest
  const r = S.evaluate(s, k, tree, { map: "Customs", listed: new Set(["a"]) });
  assert.equal(r.quests.a.current, false, "located quest left off the in-game list");
  assert.equal(r.quests.b.current, true, "multi-map quest keeps its logged start");
  assert.equal(S.evaluate(s, k, tree, { map: "Customs" }).quests.b.current, false, "without a located set, old behaviour");
});

test("onboarding from logs replays full history and says whether it reaches the character's start", () => {
  const s = S.empty(), first = "657315ddab5a49b71f098853";
  S.ingest(s, [event(first, "completed", 50), event("b", "started", 300)], meta);
  S.ingest(s, [event("c", "started", 400)], { ...meta, profileId: other, session: "s2" });
  const found = S.detectedProfiles(s, "regular").profiles;
  assert.deepEqual(found.map(p => [p.profileId, p.fromStart]), [[other, false], [profile, true]]);
  const k = S.scopeFromLogs(s, "regular", profile);
  assert.equal(s.scopes[k].start, 50);
  assert.match(s.scopes[k].evidence, /first quest/);
  assert.equal(S.derive(s, k).statuses.b.status, "started");
  assert.equal(S.derive(s, k).statuses.c, undefined, "another profile never leaks in");
  assert.match(s.scopes[S.scopeFromLogs(s, "regular", other)].evidence, /logs start after/);
  assert.throws(() => S.scopeFromLogs(s, "pve", profile), /no quest events/);
});

test("current membership corrections are specific to the map", () => {
  const s = S.empty(), k = scope(s);
  S.ingest(s, [event("a", "started", 110)], meta);
  S.confirmCurrent(s, k, ["a"], [], 120, "Customs");
  assert.equal(S.evaluate(s, k, tree, { map: "Customs" }).quests.a.current, false);
  assert.equal(S.evaluate(s, k, tree, { map: "Woods" }).quests.a.current, true);
});

test("legacy preview/migration is explicit, boundary-filtered, nondestructive and preserves newer manual edits", () => {
  const s = S.empty(), k = scope(s);
  const legacy = { statuses: { a: { status: "completed", at: 10 }, b: { status: "started", at: 110 }, c: { status: "started" } } };
  const before = JSON.stringify(legacy);
  assert.deepEqual(S.derive(s, k).statuses, {});
  assert.deepEqual(S.previewLegacy(legacy, s.scopes[k]), { total: 3, eligible: ["b"] });
  assert.deepEqual(S.previewLegacy(legacy), { total: 3, eligible: [] });
  S.setManual(s, k, "b", "not-started", 120);
  S.migrateLegacy(s, k, legacy);
  assert.equal(S.derive(s, k).statuses.b.status, "not-started");
  assert.equal(JSON.stringify(legacy), before);
  assert.deepEqual(S.previewLegacy(legacy, s.scopes[scope(s, null)]).eligible, []);
});

test("identity parser uses verified profile marker, rejects mixed profiles/modes, and ignores account IDs", () => {
  assert.deepEqual(L.sessionIdentity(`PrepareSelectedProfileLocally ProfileId:${profile} AccountId:private\nSession mode: Regular`),
    { profileId: profile, mode: "regular", identityConflict: false });
  assert.equal(L.sessionIdentity(`ProfileId:${profile}`).profileId, null);
  assert.equal(L.sessionIdentity(`PrepareSelectedProfileLocally ProfileId:${profile}\nPrepareSelectedProfileLocally ProfileId:${other}`).identityConflict, true);
  assert.equal(L.sessionIdentity("Session mode: Pve\nSession mode: Regular").identityConflict, true);
});

test("screenshot baseline reconciles exactly 12 current Customs quests, with no extras", () => {
  const tasks = require("../data/maps/customs.json").quests;
  const progression = require("../data/progression.json");
  const names = require("./fixtures/current-customs.json");
  const resolved = S.resolveNames(names.join("\n"), tasks.filter(q => progression[q.id].faction !== "BEAR"));
  assert.deepEqual(resolved.errors, []);
  assert.equal(resolved.ids.length, 12);
  const s = S.empty(), k = scope(s, 0);
  // Every map quest previously started; only explicit current membership is authoritative now.
  S.ingest(s, tasks.map(q => event(q.id, "started", 110)), meta);
  S.confirmCurrent(s, k, tasks.map(q => q.id), resolved.ids, 120);
  const result = S.evaluate(s, k, progression, { level: 24, faction: "USEC" });
  const current = tasks.filter(q => result.quests[q.id].current).map(q => q.name).sort();
  assert.deepEqual(current, [...names].sort());
  assert.equal(tasks.filter(q => result.quests[q.id].current && result.quests[q.id].completed).length, 0);
});

test("manual name reconciliation reports unknown and ambiguous names instead of silently omitting them", () => {
  assert.deepEqual(S.resolveNames("a\nmissing", [{ id: "1", name: "a" }, { id: "2", name: "a" }]).ids, []);
  assert.equal(S.resolveNames("a\nmissing", [{ id: "1", name: "a" }, { id: "2", name: "a" }]).errors.length, 2);
});

test("store exports in the browser with no CommonJS", () => {
  const context = { EftLogs: L, QuestProgress: P }; context.self = context;
  vm.runInNewContext(fs.readFileSync(require.resolve("../page/progress-store.js"), "utf8"), context);
  assert.equal(typeof context.ProgressStore.createScope, "function");
});
