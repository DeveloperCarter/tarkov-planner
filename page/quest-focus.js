/* Focus mode: one quest at a time. Which open quest comes next, the path through what it has left, the
   two quests after it, and the doors its keys open. Pure UMD; never edits selection or progress.
   Works in frame coordinates, so pages without spawns (the hand-built Customs plan) focus too. */
(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./raid-route.js") : root.RaidRoute);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.QuestFocus = api;
})(typeof self !== "undefined" ? self : this, function (Route) {
  "use strict";
  const KEY = "eft-quest-focus";
  const id = q => q.bsgId || q.id;
  const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  // The frame is a uniform scale of the game's x/z, so frame distances order stops the same way.
  const frameZones = zones => Object.fromEntries(Object.entries(zones || {}).filter(([, z]) => Number.isFinite(z?.x) && Number.isFinite(z?.y))
    .map(([k, z]) => [k, { x: z.x, y: z.y, gx: z.x, gz: z.y }]));

  // Required objectives decide; a quest listing only optional ones stays open until they're ticked.
  function isOpen(q, done = {}) {
    const all = q.objectives || [], required = all.filter(o => !o.optional);
    return (required.length ? required : all).some(o => !Route.isDone(done, o));
  }
  const openSpots = (q, zones, done) => (q.objectives || []).filter(o => !o.optional && !Route.isDone(done, o) && (o.zone || []).some(z => zones[z]));

  /** The shortest way through what a quest has left. stops: the spots to walk to, in order. alts: the other
   *  spots an any-of objective could be at, such as a quest item's random locations. */
  function leg(q, zones, from, done) {
    const spots = openSpots(q, zones, done);
    if (!spots.length) return { stops: [], alts: [] };
    const trimmed = { ...q, objectives: spots.map(o => ({ ...o, zone: o.zone.filter(z => zones[z]) })) };
    const every = [...new Set(trimmed.objectives.flatMap(o => o.zone))];
    const start = from ? { gx: from.x, gz: from.y } : { gx: every.reduce((s, z) => s + zones[z].x, 0) / every.length, gz: every.reduce((s, z) => s + zones[z].y, 0) / every.length };
    const { stops } = Route.route({ quests: [trimmed], zones }, [id(q)], start, { done });
    const used = new Set(stops.map(s => s.zone));
    return { stops: stops.map(s => ({ zone: s.zone, x: s.x, y: s.y, objectives: s.objectives })), alts: every.filter(z => !used.has(z)) };
  }

  /** Open quests in the order to do them: from where you are (or the first listed), the closest next each
   *  time. Quests with nothing at a fixed spot follow, since they fit anywhere in the raid. */
  function sequence(data, quests, { from = null, done = {} } = {}) {
    const zones = frameZones(data.zones), pending = quests.filter(q => isOpen(q, done));
    const left = pending.filter(q => openSpots(q, zones, done).length), order = [];
    let at = from;
    while (left.length) {
      let pick = 0;
      if (at) {
        const away = q => Math.min(...openSpots(q, zones, done).flatMap(o => o.zone.filter(z => zones[z]).map(z => gap(at, zones[z]))));
        left.forEach((q, i) => { if (away(q) < away(left[pick])) pick = i; });
      }
      const [q] = left.splice(pick, 1);
      order.push(id(q));
      const { stops } = leg(q, zones, at, done);
      if (stops.length) at = stops[stops.length - 1];
    }
    return [...order, ...pending.filter(q => !openSpots(q, zones, done).length).map(id)];
  }

  /** The door each required key opens, the closest to the quest's spots when a key has several. */
  function doors(data, q, spots = []) {
    const scale = data.meta?.frame?.scale, away = l => spots.length ? Math.min(...spots.map(s => gap(s, l))) : 0;
    return (q.needs || []).filter(n => n.kind === "key" && !n.optional).flatMap(n => {
      const found = (data.doors || []).filter(l => (n.itemIds || []).includes(l.keyId));
      if (!found.length) return [];
      const best = found.slice().sort((a, b) => away(a) - away(b) || String(a.id).localeCompare(String(b.id)))[0];
      return [{ ...best, need: n.item, metres: spots.length && scale > 0 ? Math.round(away(best) / scale) : null }];
    });
  }

  /** What focus mode draws. now, next and after each hold { id, quest, from, stops, alts }; now adds its doors
   *  and also (other quests with work at its stops). out: spots of every other open quest, for faint dots. */
  function plan(data, quests, { focused = null, from = null, done = {} } = {}) {
    const zones = frameZones(data.zones), order = sequence(data, quests, { from, done }), byId = new Map(quests.map(q => [id(q), q]));
    const index = Math.max(0, order.indexOf(focused)), legs = [];
    let at = from;
    for (const qid of order.slice(index, index + 3)) {
      const q = byId.get(qid), l = leg(q, zones, at, done);
      legs.push({ id: qid, quest: q, from: at, ...l });
      if (l.stops.length) at = l.stops[l.stops.length - 1];
    }
    const [now = null, next = null, after = null] = legs;
    const others = quests.filter(q => isOpen(q, done) && !legs.some(l => l.quest === q));
    const shown = new Set(legs.flatMap((l, i) => [...l.stops.map(s => s.zone), ...(i ? [] : l.alts)]));
    const out = [...new Set(others.flatMap(q => openSpots(q, zones, done).flatMap(o => o.zone)))].filter(z => zones[z] && !shown.has(z));
    if (now) {
      const here = new Set(now.stops.map(s => s.zone));
      now.doors = doors(data, now.quest, [...now.stops, ...now.alts.map(z => zones[z])]);
      now.also = quests.filter(q => q !== now.quest && isOpen(q, done))
        .map(q => ({ id: id(q), quest: q, zones: [...new Set(openSpots(q, zones, done).flatMap(o => o.zone.filter(z => here.has(z))))] })).filter(a => a.zones.length);
    }
    return { order, index, from, now, next, after, out };
  }

  /** Which quest stays in focus after progress changes: the same one while it's open, else whichever was next. */
  function advance(before, after, focused) {
    if (after.includes(focused)) return focused;
    const i = before.indexOf(focused);
    if (i >= 0) for (const qid of before.slice(i + 1)) if (after.includes(qid)) return qid;
    return after[0] ?? null;
  }

  /** The objective the progress key acts on: this quest's, in walking order, then those with no spot. Optional
   *  ones wait unless the quest has nothing else, the same rule isOpen uses. */
  function nextObjective(now, done = {}) {
    if (!now) return null;
    const all = now.quest.objectives || [], required = all.filter(o => !o.optional);
    const stopOf = new Map(now.stops.flatMap((s, i) => s.objectives.map(o => [o, i])));
    const rank = o => stopOf.has(o.id) ? stopOf.get(o.id) : Infinity;
    return (required.length ? required : all).filter(o => !Route.isDone(done, o)).map((o, i) => [o, i])
      .sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1])[0]?.[0] ?? null;
  }
  // One press: a tick, or one more on a counter.
  const objectiveValue = (o, done = {}) => o.count ? Math.min(o.count, (Number(done[o.id]) || 0) + 1) : true;

  // What the page's plain keys do in focus mode. A held key doesn't repeat, so one press is one objective.
  const ACTIONS = ["photo-previous", "photo-next", "objective-undo", "objective-next"];
  const KEYS = { ArrowLeft: "photo-previous", ArrowRight: "photo-next", PageUp: "objective-undo", PageDown: "objective-next" };
  const keyAction = e => e.repeat || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey ? null : KEYS[e.key] || null;

  // The toggle is remembered for this browser. Storage may be blocked, so a failed read means off.
  function load() { try { return localStorage.getItem(KEY) === "1"; } catch (e) { return false; } }
  function save(on) { try { localStorage.setItem(KEY, on ? "1" : "0"); } catch (e) {} }

  return { KEY, ACTIONS, isOpen, sequence, doors, plan, advance, nextObjective, objectiveValue, keyAction, load, save };
});
