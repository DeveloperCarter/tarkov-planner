// LogWatcher against an in-memory stand-in for a File System Access directory. Run: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const L = require("../page/eft-log-tracker.js");
const S = require("../page/progress-store.js");

const SAMPLE = fs.readFileSync(path.join(__dirname, "fixtures", "sample push-notifications_000.log"), "utf8").replace(/\r?\n$/, "");
const TAIL_REST = `1",\n      "data": []\n    },\n    "hasRewards": true,\n    "maxStorageTime": 172800\n  }\n}\n`;

class MockFile {
  constructor(name, text = "") {
    this.kind = "file";
    this.name = name;
    this.bytes = Buffer.from(text, "utf8");
  }
  append(textOrBytes) {
    this.bytes = Buffer.concat([this.bytes, Buffer.isBuffer(textOrBytes) ? textOrBytes : Buffer.from(textOrBytes, "utf8")]);
  }
  replace(text) {
    this.bytes = Buffer.from(text, "utf8");
  }
  async getFile() {
    return new Blob([this.bytes]);
  }
}

class MockDir {
  constructor(name, children = []) {
    this.kind = "directory";
    this.name = name;
    this.children = new Map(children.map((c) => [c.name, c]));
  }
  add(child) {
    this.children.set(child.name, child);
    return child;
  }
  async *entries() {
    for (const entry of this.children) yield entry;
  }
  async getDirectoryHandle(name) {
    const d = this.children.get(name);
    if (!d || d.kind !== "directory") throw Object.assign(new Error(name), { name: "NotFoundError" });
    return d;
  }
}

function session(folder, notifText, appText = "2026-10-20 11:15:33.978|1.2.5.0.48146|Info|application|Session mode: Regular\n") {
  const stamp = folder.replace(/^log_/, "");
  const notif = new MockFile(`${stamp} push-notifications_000.log`, notifText);
  const dir = new MockDir(folder, [notif, new MockFile(`${stamp} application_000.log`, appText), new MockFile(`${stamp} output_000.log`, "noise")]);
  return { dir, notif };
}

async function until(cond, ms = 2000) {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error("timed out waiting");
    await new Promise((r) => setTimeout(r, 5));
  }
}

function harness() {
  const got = [];
  const statuses = [];
  const w = new L.LogWatcher({
    pollMs: 10,
    rotateMs: 40,
    onEvents: (events, meta) => got.push(...events.map((e) => ({ ...e, ...meta }))),
    onStatus: (s) => statuses.push(s),
  });
  return { w, got, statuses };
}

test("watches the newest session, picks up appended text, and finishes a half-written entry", async () => {
  const older = session("log_2026.10.20_1-25-41_1.2.5.0.48146", "");
  const newer = session("log_2026.10.20_13-17-26_1.2.5.0.48146", SAMPLE); // newer, though it sorts first by name
  const logs = new MockDir("Logs", [older.dir, newer.dir]);
  const { w, got, statuses } = harness();
  await w.watch(logs);
  try {
    await until(() => got.length >= 5);
    assert.equal(statuses.at(-1).state, "watching");
    assert.equal(statuses.at(-1).folder, newer.dir.name);
    assert.equal(got[0].mode, "regular");
    assert.ok(!got.some((e) => e.key === "aaaaaaaaaaaaaaaaaaaa0007"), "half-written entry held back");
    newer.notif.append(TAIL_REST);
    await until(() => got.some((e) => e.key === "aaaaaaaaaaaaaaaaaaaa0007"));
  } finally {
    w.stop();
  }
});

test("switches to a new session folder when the game restarts", async () => {
  const first = session("log_2026.10.20_9-00-00_1.2.5.0.48146", "");
  const logs = new MockDir("Logs", [first.dir]);
  const { w, got, statuses } = harness();
  await w.watch(logs);
  try {
    const restart = session("log_2026.10.20_10-00-00_1.2.5.0.48146", SAMPLE + TAIL_REST);
    logs.add(restart.dir);
    await until(() => statuses.at(-1).folder === restart.dir.name && got.length >= 6);
    assert.equal(got.at(-1).session, restart.dir.name);
  } finally {
    w.stop();
  }
});

test("starts over when the file gets smaller (replaced)", async () => {
  const s = session("log_2026.10.20_9-00-00_1.2.5.0.48146", SAMPLE + TAIL_REST);
  const { w, got } = harness();
  await w.watch(new MockDir("Logs", [s.dir]));
  try {
    await until(() => got.length >= 6);
    const before = got.length;
    s.notif.replace(SAMPLE.split("2026-10-20 13:40:11.600")[0]); // shorter: only the first quest start
    await until(() => got.length > before);
    assert.equal(got.at(-1).key, "aaaaaaaaaaaaaaaaaaaa0003", "re-read from the start");
  } finally {
    w.stop();
  }
});

test("a multi-byte character split across two reads decodes correctly", async () => {
  const entry = `2026-10-20 15:00:00.000|1.2.5.0.48146|Info|push-notifications|Got notification | ChatMessageReceived
{
  "eventId": "bbbbbbbbbbbbbbbbbbbb0001",
  "message": { "type": 10, "dt": 1792540000, "text": "задание принято", "templateId": "5969f9e986f7741dde183a50 description" }
}
`;
  const bytes = Buffer.from(entry, "utf8");
  const cut = bytes.indexOf(Buffer.from("а", "utf8")) + 1; // inside a 2-byte Cyrillic letter
  const s = session("log_2026.10.20_15-00-00_1.2.5.0.48146", "");
  s.notif.append(bytes.subarray(0, cut));
  const { w, got } = harness();
  await w.watch(new MockDir("Logs", [s.dir]));
  try {
    await new Promise((r) => setTimeout(r, 40));
    s.notif.append(bytes.subarray(cut));
    await until(() => got.length === 1);
    assert.equal(got[0].questId, "5969f9e986f7741dde183a50");
  } finally {
    w.stop();
  }
});

test("waits when there are no sessions yet, then attaches once one appears", async () => {
  const logs = new MockDir("Logs");
  const { w, statuses } = harness();
  await w.watch(logs);
  try {
    assert.equal(statuses.at(-1).state, "waiting");
    const s = session("log_2026.10.20_16-00-00_1.2.5.0.48146", "");
    logs.add(s.dir);
    await until(() => statuses.at(-1).state === "watching");
  } finally {
    w.stop();
  }
});

test("scanPast reads every session oldest first", async () => {
  const a = session("log_2026.10.19_22-00-00_1.2.5.0.48146", SAMPLE.split("2026-10-20 13:40:11.600")[0]);
  const b = session("log_2026.10.20_9-00-00_1.2.5.0.48146", SAMPLE + TAIL_REST, "Session mode: Pve\n");
  const { w, got } = harness();
  w.dir = new MockDir("Logs", [b.dir, a.dir]);
  const r = await w.scanPast();
  assert.equal(r.sessions, 2);
  assert.equal(got[0].session, a.dir.name);
  assert.equal(got.at(-1).mode, "pve");
});

test("one-time import from a webkitdirectory file list", async () => {
  const fake = (rel, text) => ({ name: rel.split("/").pop(), webkitRelativePath: rel, text: async () => text });
  const files = [
    fake("Logs/log_2026.10.20_9-00-00_1.2.5.0.48146/2026.10.20_9-00-00_1.2.5.0.48146 push-notifications_000.log", SAMPLE + TAIL_REST),
    fake("Logs/log_2026.10.20_9-00-00_1.2.5.0.48146/2026.10.20_9-00-00_1.2.5.0.48146 application_000.log", "Session mode: Regular\n"),
    fake("Logs/log_2026.10.20_9-00-00_1.2.5.0.48146/2026.10.20_9-00-00_1.2.5.0.48146 output_000.log", "noise"),
  ];
  const seen = [];
  const r = await L.importFileList(files, (events, meta) => seen.push(...events.map((e) => ({ ...e, ...meta }))));
  assert.deepEqual(r, { sessions: 1, events: 6 });
  assert.equal(seen[0].mode, "regular");
});

test("live watching, overlapping past scans and import give identical scoped results across a boundary", async () => {
  const profile = "a".repeat(24), quest = "c".repeat(24), extra = "d".repeat(24);
  const appText = `Session mode: Regular\nPrepareSelectedProfileLocally ProfileId:${profile}`;
  const make = (id, type, dt) => `2026-10-20 10:00:00.000|Info|push-notifications|Got notification | ChatMessageReceived\n{"eventId":"${id}-${type}-${dt}","message":{"type":${type},"dt":${dt},"templateId":"${id}"}}\n`;
  const first = session("log_2026.10.19_9-00-00_v", make(quest, 12, 10), appText);
  const second = session("log_2026.10.20_9-00-00_v", make(quest, 12, 99) + make(quest, 10, 100), appText);
  second.dir.add(new MockFile("push-notifications_001.log", make(extra, 10, 101)));
  const root = new MockDir("Logs", [first.dir, second.dir]);
  const live = S.empty(), scanned = S.empty(), imported = S.empty();
  const keys = [live, scanned, imported].map(s => S.createScope(s, { profile, mode: "regular", start: 100000, label: "Current" }));
  const w = new L.LogWatcher({ onEvents: (events, meta) => S.ingest(live, events, meta) });
  await w.watch(root);
  try {
    const scan = new L.LogWatcher({ onEvents: (events, meta) => S.ingest(scanned, events, meta) });
    scan.dir = root; await scan.scanPast(); await scan.scanPast();
    const files = [];
    for (const sess of [first, second]) for await (const [name, handle] of sess.dir.entries()) {
      files.push({ name, webkitRelativePath: `Logs/${sess.dir.name}/${name}`, text: async () => (await handle.getFile()).text() });
    }
    await L.importFileList(files, (events, meta) => S.ingest(imported, events, meta));
    const a = S.derive(live, keys[0]), b = S.derive(scanned, keys[1]), c = S.derive(imported, keys[2]);
    assert.deepEqual(a, b); assert.deepEqual(b, c);
    assert.equal(a.statuses[quest].status, "started");
    assert.equal(a.statuses[extra].status, "started");
    assert.equal(Object.keys(a.seen).length, 2);
  } finally { w.stop(); }
});

test("a late identity is re-read and a subsequently mixed profile is quarantined", async () => {
  const profile = "a".repeat(24), other = "b".repeat(24);
  const s = session("log_2026.10.20_9-00-00_v", SAMPLE + TAIL_REST, "");
  const store = S.empty(), key = S.createScope(store, { profile, mode: "regular", start: 0, label: "Current" });
  const w = new L.LogWatcher({ pollMs: 10, onEvents: (ev, meta) => S.ingest(store, ev, meta) });
  await w.watch(new MockDir("Logs", [s.dir]));
  try {
    assert.deepEqual(S.derive(store, key).statuses, {});
    const app = [...s.dir.children.values()].find(f => L.isApplicationLog(f.name));
    app.append(`Session mode: Regular\nPrepareSelectedProfileLocally ProfileId:${profile}\n`);
    await until(() => Object.keys(S.derive(store, key).statuses).length > 0);
    app.append(`PrepareSelectedProfileLocally ProfileId:${other}\n`);
    await until(() => Object.values(store.journal).every(r => r.meta.identityConflict));
    assert.deepEqual(S.derive(store, key).statuses, {});
  } finally { w.stop(); }
});
