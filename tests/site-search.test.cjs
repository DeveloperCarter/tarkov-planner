const test = require("node:test");
const assert = require("node:assert");
const S = require("../page/site-search.js");

const map = (key, onMap) => ({ key, name: key[0].toUpperCase() + key.slice(1), onMap, href: `maps/${key}.html` });
const entries = [
  { id: "a", name: "Delivery from the Past", trader: "Prapor", kappa: true, maps: [map("customs", true), map("factory", false)] },
  { id: "b", name: "Debut", trader: "Prapor", kappa: true, maps: [map("customs", true)] },
  { id: "c", name: "The Survivalist Path - Unprotected but Dangerous", trader: "Jaeger", maps: [map("woods", false), map("customs", false)] },
  { id: "d", name: "Shipping Delay - Part 2", trader: "BTR Driver", maps: [] },
  { id: "e", name: "Café Délivery", trader: "Ref", maps: [map("streets", true)] },
];
const names = list => list.map(e => e.name);

test("whole-name and prefix matches rank first; every word must match", () => {
  assert.deepStrictEqual(names(S.search(entries, "debut")), ["Debut"]);
  assert.strictEqual(S.search(entries, "de")[0].name, "Debut", "shorter prefix match wins the tie");
  assert.deepStrictEqual(names(S.search(entries, "delivery past")), ["Delivery from the Past"]);
  assert.deepStrictEqual(S.search(entries, "delivery nowhere"), []);
});

test("accents fold, and trader or map names find quests too", () => {
  assert.deepStrictEqual(names(S.search(entries, "cafe delivery")), ["Café Délivery"]);
  assert.deepStrictEqual(names(S.search(entries, "jaeger")), ["The Survivalist Path - Unprotected but Dangerous"]);
  assert.ok(names(S.search(entries, "woods")).includes("The Survivalist Path - Unprotected but Dangerous"));
});

test("started quests rise, finished ones sink, and the empty box lists started quests", () => {
  assert.deepStrictEqual(names(S.search(entries, "prapor")), ["Debut", "Delivery from the Past"]);
  assert.deepStrictEqual(names(S.search(entries, "prapor", { statuses: { a: "started" } })), ["Delivery from the Past", "Debut"]);
  assert.deepStrictEqual(names(S.search(entries, "prapor", { statuses: { b: "completed" } })), ["Delivery from the Past", "Debut"]);
  assert.strictEqual(S.search(entries, "delivery", { statuses: { e: "started" } })[0].name, "Delivery from the Past", "a prefix match still beats a started quest");
  const statuses = { a: "completed", e: "started" };
  assert.deepStrictEqual(names(S.search(entries, "", { statuses })), ["Café Délivery"]);
  assert.deepStrictEqual(names(S.search(entries, "", { statuses, filters: { kappa: true } })), ["Debut", "Delivery from the Past"]);
  assert.deepStrictEqual(names(S.search(entries, "delivery", { statuses, filters: { active: true } })), ["Café Délivery"]);
});

test("a result opens on this map when it can, else where the in-game list shows it", () => {
  assert.strictEqual(S.primaryMap(entries[0], "factory").key, "factory");
  assert.strictEqual(S.primaryMap(entries[0], "woods").key, "customs");
  assert.strictEqual(S.primaryMap(entries[2], null).key, "woods", "multi-map: first map with objectives");
  assert.strictEqual(S.primaryMap(entries[3], "customs"), null);
});

test("trader and map filters list every match without typing; map 'none' finds quests without map objectives", () => {
  const all = S.browse(entries, "", { filters: { trader: "Prapor" } });
  assert.deepStrictEqual(all.items.map(e => e.name), ["Debut", "Delivery from the Past"]);
  assert.deepStrictEqual(names(S.search(entries, "", { filters: { trader: "Prapor", map: "factory" } })), ["Delivery from the Past"],
    "a multi-map quest matches every map where it has objectives");
  assert.deepStrictEqual(names(S.search(entries, "", { filters: { map: "woods" } })), ["The Survivalist Path - Unprotected but Dangerous"]);
  assert.deepStrictEqual(names(S.search(entries, "", { filters: { map: "none" } })), ["Shipping Delay - Part 2"]);
  assert.deepStrictEqual(names(S.search(entries, "delivery", { filters: { map: "streets" } })), ["Café Délivery"]);
  assert.deepStrictEqual(names(S.search(entries, "", { filters: { map: "customs" }, statuses: { b: "completed" } })),
    ["Delivery from the Past", "The Survivalist Path - Unprotected but Dangerous", "Debut"], "listed here before passing through; finished last");
});

test("results report the full count past the limit, and placeholders sink below real quests", () => {
  const many = Array.from({ length: 45 }, (_, i) => ({ id: "m" + i, name: `Task ${String(i).padStart(2, "0")}`, trader: "Prapor", maps: [] }));
  const page = S.browse(many, "", { filters: { trader: "Prapor" } });
  assert.strictEqual(page.items.length, 40); assert.strictEqual(page.total, 45);
  assert.strictEqual(S.browse(many, "", { filters: { trader: "Prapor" }, limit: 80 }).items.length, 45);
  const withNew = [{ id: "p", name: "New Therapist quest (name pending)", trader: "Therapist", placeholder: true, maps: [] },
    { id: "r", name: "Sanitary Standards", trader: "Therapist", maps: [map("customs", true)] }];
  assert.deepStrictEqual(names(S.search(withNew, "therapist")), ["Sanitary Standards", "New Therapist quest (name pending)"]);
  assert.deepStrictEqual(names(S.search(withNew, "", { filters: { trader: "Therapist" } })), ["Sanitary Standards", "New Therapist quest (name pending)"]);
  assert.deepStrictEqual(S.facets(entries).traders, ["BTR Driver", "Jaeger", "Prapor", "Ref"]);
  assert.deepStrictEqual(S.facets(entries).maps.map(m => m.key), ["customs", "factory", "streets", "woods"]);
});

test("the map filter decides where a result opens", () => {
  assert.strictEqual(S.primaryMap(entries[0], "customs", "factory").key, "factory");
  assert.strictEqual(S.primaryMap(entries[0], "customs", "woods").key, "customs", "a filter map without objectives is ignored");
});

test("the other faction's quests sink below yours", () => {
  const side = [{ id: "u", name: "Gunsmith - MPX", trader: "Mechanic", faction: "USEC", maps: [] },
                { id: "b", name: "Gunsmith - AKM", trader: "Mechanic", faction: "BEAR", maps: [] },
                { id: "n", name: "Gunsmith - Part 1", trader: "Mechanic", faction: "Any", maps: [] }];
  assert.deepStrictEqual(names(S.search(side, "gunsmith", { faction: "USEC" })), ["Gunsmith - MPX", "Gunsmith - Part 1", "Gunsmith - AKM"]);
});

test("a map name finds quests the in-game map list shows before ones that pass through", () => {
  assert.deepStrictEqual(names(S.search(entries, "customs")).slice(0, 2), ["Debut", "Delivery from the Past"]);
  assert.strictEqual(names(S.search(entries, "customs")).at(-1), "The Survivalist Path - Unprotected but Dangerous");
});
