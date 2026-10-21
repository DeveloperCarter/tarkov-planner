/* Profile/mode/wipe progress. Pure UMD; callers own storage and the selected Logs folder. */
(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./eft-log-tracker.js") : root.EftLogs,
    typeof module === "object" && module.exports ? require("./quest-progress.js") : root.QuestProgress);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ProgressStore = api;
})(typeof self !== "undefined" ? self : this, function (Logs, Progress) {
  "use strict";
  const STORAGE_KEY = "eft-progress:v2";
  const empty = () => ({ version: 2, active: {}, scopes: {}, journal: {} });
  const scopeKey = ({ profile, mode, start, label }) => JSON.stringify([profile, mode, start, label]);

  function createScope(store, { profile, mode, start = null, label, evidence = "Confirmed by player" }) {
    profile = String(profile || "").trim(); label = String(label || "").trim();
    if (/^[0-9a-f]{24}$/i.test(profile)) profile = profile.toLowerCase();
    if (!profile || !label || !["regular", "pve"].includes(mode) || (start !== null && !Number.isFinite(start))) {
      throw new Error("Enter a profile, wipe name and valid start time (or leave the time empty for manual progress).");
    }
    const key = scopeKey({ profile, mode, start, label });
    if (!store.scopes[key]) store.scopes[key] = { profile, mode, start, label, evidence, manual: {}, membership: {} };
    store.active[mode] = key;
    return key;
  }

  function accepts(scope, event, meta) {
    return scope.start !== null && !meta.identityConflict && meta.profileId === scope.profile &&
      meta.mode === scope.mode && Number.isFinite(event.at) && event.at >= scope.start &&
      (scope.end == null || event.at < scope.end);
  }

  function windowFor(store, key) {
    const scope = store.scopes[key];
    if (!scope) return null;
    const later = Object.values(store.scopes).filter(s => s.profile === scope.profile && s.mode === scope.mode &&
      s.start !== null && scope.start !== null && s.start > scope.start).map(s => s.start);
    return { ...scope, end: later.length ? Math.min(...later) : null };
  }

  // Keep history separate from scope-specific deduplication, including unidentified sessions.
  function ingest(store, events, meta = {}) {
    for (const event of events) {
      const key = JSON.stringify([meta.session || null, event.key]);
      store.journal[key] = { event: { ...event }, meta: { ...meta } };
    }
  }

  function derive(store, key) {
    const state = Logs.emptyState();
    const scope = windowFor(store, key);
    if (!scope) return state;
    const events = Object.values(store.journal).filter(r => accepts(scope, r.event, r.meta)).map(r => r.event)
      .sort((a, b) => a.at - b.at || (a.logged || 0) - (b.logged || 0) || String(a.key).localeCompare(String(b.key)))
      .map((event, seq) => ({ ...event, seq })); // input path/read order cannot change equal-time replay
    Logs.applyEvents(state, events);
    for (const [id, manual] of Object.entries(scope.manual)) {
      if (!state.statuses[id] || manual.at >= state.statuses[id].at) state.statuses[id] = { ...manual };
    }
    return state;
  }

  function setManual(store, key, id, status, at = Date.now()) {
    const scope = store.scopes[key];
    if (!scope) throw new Error("Choose a progress scope first.");
    if (!status) delete scope.manual[id];
    else scope.manual[id] = { status, at, source: "manual" };
    for (const membership of Object.values(scope.membership)) delete membership[id];
  }

  // A confirmed map list corrects membership without fabricating completion/failure of extras.
  function confirmCurrent(store, key, mapIds, currentIds, at = Date.now(), map = "all") {
    const scope = store.scopes[key];
    if (!scope) throw new Error("Choose a progress scope first.");
    const wanted = new Set(currentIds);
    if (!scope.membership[map]) scope.membership[map] = {};
    for (const id of mapIds) {
      scope.membership[map][id] = { current: wanted.has(id), at };
      if (wanted.has(id)) scope.manual[id] = { status: "started", source: "manual", at };
    }
  }

  function isCurrent(scope, id, status, map = "all") {
    if (!scope || status?.status !== "started") return false;
    const membership = scope.membership[map]?.[id];
    return !membership || status.at > membership.at || membership.current;
  }

  function evaluate(store, key, progression, options) {
    const scope = store.scopes[key];
    const state = derive(store, key);
    const result = Progress.evaluate(progression, state.statuses, options);
    for (const [id, quest] of Object.entries(result.quests)) {
      quest.current = isCurrent(scope, id, state.statuses[id], options?.map);
      if (quest.current) {
        quest.status = "started"; quest.inferred = false; quest.completed = false;
        result.statuses[id] = { ...state.statuses[id] };
      }
      quest.possible = !!scope && quest.possible && !quest.current;
    }
    return result;
  }

  function previewLegacy(legacy, scope) {
    const entries = Object.entries(legacy?.statuses || {});
    return { total: entries.length, eligible: entries.filter(([, s]) => scope && scope.start !== null &&
      Number.isFinite(s.at) && s.at >= scope.start && (scope.end == null || s.at < scope.end)).map(([id]) => id) };
  }

  function migrateLegacy(store, key, legacy) {
    const scope = windowFor(store, key);
    if (!scope) throw new Error("Choose a progress scope first.");
    for (const id of previewLegacy(legacy, scope).eligible) {
      // Explicitly reviewed old entries become manual evidence; never override newer corrections.
      const value = legacy.statuses[id];
      if (!scope.manual[id] || scope.manual[id].at < value.at) scope.manual[id] = { ...value, source: "manual" };
    }
  }

  // Profiles in the log history for one mode, offered to the player to set up a scope.
  // Sessions without a profile or mode, or with mixed identities, are counted but never offered.
  function detectedProfiles(store, mode) {
    const found = new Map();
    let unusable = 0;
    for (const { event, meta } of Object.values(store.journal)) {
      if (meta.identityConflict || !meta.profileId || !meta.mode) { unusable++; continue; }
      if (meta.mode !== mode || !Number.isFinite(event.at)) continue;
      const p = found.get(meta.profileId) || { profileId: meta.profileId, mode, events: 0, first: event.at, last: event.at };
      p.events++; p.first = Math.min(p.first, event.at); p.last = Math.max(p.last, event.at);
      found.set(meta.profileId, p);
    }
    return { profiles: [...found.values()].sort((a, b) => b.last - a.last), unusable };
  }

  // The player confirms a log boundary for a manual-only scope. Manual edits and map lists carry over.
  function setBoundary(store, key, start, evidence) {
    const old = store.scopes[key];
    if (!old) throw new Error("Choose a progress scope first.");
    if (!Number.isFinite(start)) throw new Error("Choose a valid start time.");
    const next = createScope(store, { profile: old.profile, mode: old.mode, start, label: old.label, evidence: evidence || old.evidence });
    if (next === key) return key;
    const target = store.scopes[next];
    for (const [id, m] of Object.entries(old.manual)) {
      if (!target.manual[id] || target.manual[id].at < m.at) target.manual[id] = m;
    }
    for (const [map, rows] of Object.entries(old.membership)) {
      target.membership[map] = target.membership[map] || {};
      for (const [id, m] of Object.entries(rows)) {
        if (!target.membership[map][id] || target.membership[map][id].at < m.at) target.membership[map][id] = m;
      }
    }
    delete store.scopes[key];
    return next;
  }

  function historyCounts(store, key, legacy) {
    const scope = windowFor(store, key);
    const rows = Object.values(store.journal);
    return { included: rows.filter(r => scope && accepts(scope, r.event, r.meta)).length,
      excluded: rows.filter(r => !scope || !accepts(scope, r.event, r.meta)).length,
      unscoped: Object.keys(legacy?.statuses || {}).length };
  }

  function resolveNames(text, tasks) {
    const names = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const ids = [], errors = [];
    for (const name of names) {
      const matches = tasks.filter(q => q.name.toLowerCase() === name.toLowerCase());
      if (matches.length !== 1) errors.push(`${name}: ${matches.length ? "ambiguous; use the quest card" : "not found on this map"}`);
      else ids.push(matches[0].bsgId || matches[0].id);
    }
    return { ids: [...new Set(ids)], errors };
  }
  return { STORAGE_KEY, empty, createScope, accepts, windowFor, ingest, derive, setManual, confirmCurrent, isCurrent, evaluate,
    previewLegacy, migrateLegacy, historyCounts, resolveNames, detectedProfiles, setBoundary };
});
