// Run: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const L = require("../page/eft-log-tracker.js");

// The fixture stops mid-line, the way a read lands while the game is still writing; editors
// add a final newline, so strip it.
const SAMPLE = fs.readFileSync(path.join(__dirname, "fixtures", "sample push-notifications_000.log"), "utf8").replace(/\r?\n$/, "");
const PHARMACIST = "5969f9e986f7741dde183a50";
const DEBUT = "59674eb386f774539f14813a";
const TAIL_QUEST = "5967733e86f774602332fc84"; // its completion is the half-written block at the end

// The tail block finished, as the game would write it a moment later.
const TAIL_REST = `1",
      "data": []
    },
    "hasRewards": true,
    "maxStorageTime": 172800
  }
}
`;

function events(text) {
  const p = new L.EntryParser();
  return p.push(text).map(L.questEvent).filter(Boolean);
}

test("reads quest events and ignores other notification types", () => {
  const ev = events(SAMPLE);
  assert.deepEqual(ev.map((e) => [e.questId, e.status]), [
    [PHARMACIST, "started"],
    [PHARMACIST, "completed"],
    [PHARMACIST, "completed"], // duplicate eventId; the store drops it
    [DEBUT, "failed"],
    [DEBUT, "started"],
  ]);
  assert.equal(ev[0].key, "aaaaaaaaaaaaaaaaaaaa0003");
  assert.equal(ev[0].at, 1792530125 * 1000, "uses message.dt");
});

test("templateId with extra words still yields the quest ID", () => {
  const completed = events(SAMPLE).find((e) => e.status === "completed");
  assert.equal(completed.questId, PHARMACIST);
});

test("holds back a half-written JSON block until it is finished", () => {
  const p = new L.EntryParser();
  const first = p.push(SAMPLE).map(L.questEvent).filter(Boolean);
  assert.ok(!first.some((e) => e.questId === TAIL_QUEST), "tail not emitted yet");
  const later = p.push(TAIL_REST).map(L.questEvent).filter(Boolean);
  assert.deepEqual(later.map((e) => [e.questId, e.status, e.key]), [[TAIL_QUEST, "completed", "aaaaaaaaaaaaaaaaaaaa0007"]]);
});

test("same events no matter how the text is chunked", () => {
  const full = SAMPLE + TAIL_REST;
  const expected = events(full).map((e) => e.key);
  for (const size of [1, 7, 64, 333, 4096]) {
    const p = new L.EntryParser();
    const got = [];
    for (let i = 0; i < full.length; i += size) got.push(...p.push(full.slice(i, i + size)));
    got.push(...p.flush());
    assert.deepEqual(got.map(L.questEvent).filter(Boolean).map((e) => e.key), expected, `chunk size ${size}`);
  }
});

test("CRLF line endings parse the same", () => {
  const crlf = SAMPLE.replace(/\n/g, "\r\n");
  assert.deepEqual(events(crlf).map((e) => e.key), events(SAMPLE).map((e) => e.key));
});

test("an unfinished JSON block followed by a new header is dropped, not glued on", () => {
  const p = new L.EntryParser();
  const cut = SAMPLE + "\n2026-10-20 14:10:00.000|1.2.5.0.48146|Info|push-notifications|Got notification | UserConfirmed\n";
  const entries = [...p.push(cut), ...p.flush()];
  const broken = entries.find((e) => e.malformed);
  assert.ok(broken, "the cut-off entry is marked malformed");
  assert.equal(L.questEvent(broken), null);
  assert.equal(entries[entries.length - 1].header.endsWith("UserConfirmed"), true);
});

test("header without a timezone offset and with one", () => {
  const p = new L.EntryParser();
  const entries = [...p.push(SAMPLE), ...p.flush()];
  assert.equal(entries[0].offset, null);
  assert.ok(entries.some((e) => e.offset === "-04:00"));
});

test("session folders sort by time even though hours aren't zero-padded", () => {
  const names = [
    "log_2026.10.20_13-17-26_1.2.5.0.48146",
    "log_2026.10.20_1-25-41_1.2.5.0.48146",
    "log_2026.10.20_11-15-18_1.2.5.0.48146",
    "log_2026.9.30_23-59-59_1.2.4.0.47000",
  ];
  const sorted = names.map(L.parseSessionFolder).sort((a, b) => a.sortKey - b.sortKey).map((s) => s.name);
  assert.deepEqual(sorted, [names[3], names[1], names[2], names[0]]);
  assert.equal(L.parseSessionFolder("not a log folder"), null);
});

test("file name matching", () => {
  assert.ok(L.isNotificationsLog("2026.10.20_13-17-26_1.2.5.0.48146 push-notifications_000.log"));
  assert.ok(L.isNotificationsLog("notifications.log"));
  assert.ok(!L.isNotificationsLog("2026.10.20_13-17-26_1.2.5.0.48146 network-messages_000.log"));
  assert.ok(L.isApplicationLog("2026.10.20_13-17-26_1.2.5.0.48146 application_000.log"));
  assert.ok(!L.isApplicationLog("backend_000.log"));
});

test("session mode from the application log", () => {
  const app = "2026-10-20 11:15:33.978|1.2.5.0.48146|Info|application|Session mode: Regular\n";
  assert.equal(L.sessionMode(app), "regular");
  assert.equal(L.sessionMode(app + app.replace("Regular", "Pve")), "pve");
  assert.equal(L.sessionMode("nothing here"), null);
});

test("store: dedupes, applies in time order, latest wins, fail then restart", () => {
  const s = L.emptyState();
  const ev = events(SAMPLE + TAIL_REST);
  const changes = L.applyEvents(s, ev.slice().reverse()); // arrival order shouldn't matter
  assert.equal(changes.length, 5, "6 events, 1 duplicate");
  assert.equal(s.statuses[PHARMACIST].status, "completed");
  assert.equal(s.statuses[DEBUT].status, "started", "failed then restarted in the same second");
  assert.equal(s.statuses[TAIL_QUEST].status, "completed");
  assert.equal(L.applyEvents(s, ev).length, 0, "replaying a session changes nothing");
  assert.equal(s.recent[0].questId, TAIL_QUEST, "newest first");
});

test("store: a manual edit isn't undone by replaying older logs", () => {
  const s = L.emptyState();
  L.setManual(s, PHARMACIST, "started", 1792540000000);
  L.applyEvents(s, events(SAMPLE));
  assert.equal(s.statuses[PHARMACIST].status, "started");
  assert.equal(s.statuses[PHARMACIST].source, "manual");
  L.setManual(s, PHARMACIST, null);
  assert.equal(s.statuses[PHARMACIST], undefined);
});
