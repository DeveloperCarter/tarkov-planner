const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const F = require("../page/raid-focus.js");
const S = require("../page/progress-store.js");
const root = require("node:path").join(__dirname, "..");
const load = path => JSON.parse(fs.readFileSync(`${root}/${path}`, "utf8"));
const data = {
  quests: [
    { id: "a", bsgId: "task-a", objectives: [{ id: "a1", zone: ["shared"], mustExtract: true, text: "Get A" }],
      needs: [{ item: "Marker", qty: 1 }, { item: "Key", qty: 1, kind: "key" }] },
    { id: "b", bsgId: "task-b", objectives: [{ id: "b1", zone: ["shared", "b-only"], text: "Mark B" }],
      needs: [{ item: "Marker", qty: 2 }, { item: "Key", qty: 1, kind: "key" }] },
    { id: "c", objectives: [{ id: "c1", zone: ["c-only"], text: "Visit C" }], needs: [] }
  ],
  acquisition: [{ item: "Key", for: ["a", "b"] }, { item: "Other", for: ["c"] }],
  raids: [{ id: "A", quests: ["a", "b", "c"], bring: ["Mixed prose"],
    stops: [{ zone: "shared", obj: ["a1", "b1"], do: "Get A and B" },
      { zone: "c-only", obj: ["c1"] }, { zone: "unrelated-key-hunt", obj: [] }] }]
};
const current = ["task-a", "task-b", "c"];

test("Select all, Clear and individual toggles only select current quests, with empty staying empty", () => {
  assert.deepEqual(F.reconcile(null, current), [], "a map with no saved selection starts empty");
  let chosen = F.choose(null, current, "clear");
  assert.deepEqual(chosen, []);
  assert.deepEqual(F.reconcile(chosen, [...current, "new-start"]), []);
  chosen = F.choose(chosen, current, "include", "task-b");
  assert.deepEqual(chosen, ["task-b"]);
  assert.deepEqual(F.choose(chosen, current, "include", "locked"), chosen);
  assert.deepEqual(F.choose(chosen, current, "exclude", "task-b"), []);
  assert.deepEqual(F.choose(chosen, current, "all"), current);
});

test("shared zones/items survive removing one consumer and disappear after the last", () => {
  const source = JSON.stringify(data);
  let result = F.project(data, ["task-a", "task-b"]);
  assert.deepEqual(result.zones, ["shared", "b-only"]);
  assert.deepEqual(result.acquisition[0].for, ["a", "b"]);
  assert.equal(result.bring.find(n => n.item === "Marker").qty, 3);
  assert.equal(result.bring.find(n => n.item === "Key").qty, 1);
  result = F.project(data, ["task-b"]);
  assert.deepEqual(result.zones, ["shared", "b-only"]);
  assert.deepEqual(result.acquisition[0].for, ["b"]);
  assert.equal(result.bring.find(n => n.item === "Marker").qty, 2);
  result = F.project(data, []);
  for (const values of Object.values(result)) assert.deepEqual(values, []);
  assert.equal(JSON.stringify(data), source, "projection must not mutate map data");
});

test("hand-built routes keep authored order but omit unrelated stops and mixed quest prose", () => {
  const result = F.project(data, ["task-b"]);
  assert.deepEqual(result.raids[0].quests, ["b"]);
  assert.equal(result.raids[0].stops.length, 1);
  assert.deepEqual(result.raids[0].stops[0].obj, ["b1"]);
  assert.deepEqual(result.raids[0].stops[0].objectives.map(o => o.text), ["Mark B"]);
  assert.equal(result.raids[0].stops[0].do, undefined);
});

test("shared weapons are reusable and a required key stays required when another quest lists it as optional", () => {
  const copy = JSON.parse(JSON.stringify(data));
  copy.quests[0].needs[1].optional = true;
  for (const q of copy.quests.slice(0, 2)) q.needs.push({ item: "Rifle", qty: 1, kind: "weapon" });
  const result = F.project(copy, ["task-a", "task-b"]);
  assert.equal(result.bring.find(n => n.item === "Key").optional, false);
  assert.equal(result.bring.find(n => n.item === "Rifle").qty, 1);
});

test("selection persists per map, wipe, profile and mode without editing status/history", () => {
  let store = S.empty();
  const make = (profile, mode, start) => S.createScope(store, { profile, mode, start, label: `Wipe ${start}` });
  const keys = [make("one", "regular", 0), make("one", "regular", 100),
    make("two", "regular", 100), make("one", "pve", 100)];
  for (const key of keys) {
    S.setManual(store, key, "task-a", "started", 101);
    F.sync(store.scopes[key], "Customs", current, current, "all");
  }
  const statuses = JSON.stringify(keys.map(k => S.derive(store, k)));
  F.sync(store.scopes[keys[0]], "Customs", current, current, "clear");
  F.sync(store.scopes[keys[1]], "Customs", current, current, "exclude", "task-b");
  F.sync(store.scopes[keys[1]], "Woods", current, current, "clear");
  store = JSON.parse(JSON.stringify(store));
  assert.deepEqual(F.read(store.scopes[keys[0]], "Customs", current), []);
  assert.deepEqual(F.read(store.scopes[keys[1]], "Customs", current), ["task-a", "c"]);
  assert.deepEqual(F.read(store.scopes[keys[1]], "Woods", current), []);
  for (const key of keys.slice(2)) assert.deepEqual(F.read(store.scopes[key], "Customs", current), current);
  assert.equal(JSON.stringify(keys.map(k => S.derive(store, k))), statuses);
});

test("completed/failed quests leave focus; reopening them or accepting a new quest does not select them", () => {
  const store = S.empty(), key = S.createScope(store, { profile: "one", mode: "regular", label: "Now" });
  const scope = store.scopes[key], tree = { "task-a": {}, "task-b": { restartable: true }, c: {} };
  const currentIds = () => Object.entries(S.evaluate(store, key, tree, { map: "Customs" }).quests)
    .filter(([, q]) => q.current).map(([id]) => id);
  S.setManual(store, key, "task-a", "started", 1); S.setManual(store, key, "task-b", "started", 1);
  F.sync(scope, "Customs", currentIds(), current);
  S.setManual(store, key, "task-a", "completed", 2); S.setManual(store, key, "task-b", "failed", 2);
  assert.deepEqual(F.sync(scope, "Customs", currentIds(), current), []);
  S.setManual(store, key, "task-b", "started", 3); S.setManual(store, key, "c", "started", 3);
  assert.deepEqual(F.sync(scope, "Customs", currentIds(), current), []);
  assert.deepEqual(scope.raidFocus.Customs, []);
});

test("empty scope waits for first current list; a smaller hand-built page preserves undisplayed selections", () => {
  const scope = {};
  F.sync(scope, "Customs", [], current);
  assert.equal(scope.raidFocus, undefined);
  F.sync(scope, "Customs", current, current);
  assert.deepEqual(scope.raidFocus.Customs, []);
  F.sync(scope, "Customs", current, current, "all");
  F.sync(scope, "Customs", ["task-a"], ["task-a"], "clear");
  assert.deepEqual(F.read(scope, "Customs", current), ["task-b", "c"]);
  assert.deepEqual(F.read(null, "Customs", current), []);
});

test("real 12-quest baseline can focus three quests with exact locations and gear", () => {
  const map = load("data/maps/customs.json");
  const names = ["Chemical Experiments", "Tigr Safari", "Pharmacist"];
  const quests = map.quests.filter(q => names.includes(q.name));
  const result = F.project(map, quests.map(F.taskId));
  assert.equal(result.quests.length, 3);
  assert.deepEqual(new Set(result.zones), new Set(["crackhouse", "depot-sw", "military-checkpoint", "old-construction-e", "dorms-w"]));
  assert.deepEqual(new Set(result.bring.map(n => n.item)), new Set(["Corrugated hose", "MS2000 Marker", "Dorm room 114 key"]));
  assert.equal(F.facts(quests.find(q => q.name === "Pharmacist")).extraction, true);
  assert.equal(F.facts(quests.find(q => q.name === "Chemical Experiments")).extraction, false);
  const withoutTigr = F.project(map, quests.filter(q => q.name !== "Tigr Safari").map(F.taskId));
  assert.ok(withoutTigr.zones.includes("military-checkpoint"), "Pharmacist still shares the checkpoint");
  assert.ok(!withoutTigr.zones.includes("depot-sw"));
  assert.ok(!withoutTigr.bring.some(n => n.item === "MS2000 Marker"));
});

test("browser UMD export works without CommonJS", () => {
  const context = {};
  vm.runInNewContext(fs.readFileSync(`${root}/page/raid-focus.js`, "utf8"), context);
  assert.equal(typeof context.RaidFocus.project, "function");
});
