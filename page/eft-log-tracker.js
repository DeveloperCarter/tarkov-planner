/* EFT log tracker: quest status (started / failed / completed) from Escape from Tarkov's Logs folder.
 *
 * Read-only, and only the Logs folder the user picks. Written from scratch; the log format was
 * checked against real 1.2.5 logs (see README). The parser and reducer are pure so Node tests can
 * load this file; LogWatcher needs a browser with the File System Access API.
 *
 * Format notes from real logs:
 * - Session folders look like log_2026.10.20_1-25-41_1.2.5.0.48146. Hours aren't zero-padded,
 *   so folders are sorted by the parsed timestamp, never by name.
 * - Quest events are in "<prefix> push-notifications_000.log".
 * - message.text says "quest started" even on completions; only message.type is reliable.
 * - templateId can carry extra words ("<questId> successMessageText <traderId> 0").
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.EftLogs = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const HEADER_RE = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}\.\d{3})( [+-]\d{2}:\d{2})?\|(.+)$/;
  const SESSION_RE = /log_(\d+)\.(\d+)\.(\d+)_(\d+)-(\d+)-(\d+)/;
  const QUEST_TYPES = { 10: "started", 11: "failed", 12: "completed" };
  const CHAT_MESSAGE = "Got notification | ChatMessageReceived";

  // ------------------------------------------------------------------ names

  function parseSessionFolder(name) {
    const m = SESSION_RE.exec(name);
    if (!m) return null;
    const [y, mo, d, h, mi, s] = m.slice(1).map(Number);
    return {
      name,
      sortKey: ((((y * 100 + mo) * 100 + d) * 100 + h) * 100 + mi) * 100 + s,
      started: new Date(y, mo - 1, d, h, mi, s).getTime(),
    };
  }

  const isNotificationsLog = (name) => /notifications(_\d+)?\.log$/.test(name);
  const isApplicationLog = (name) => /(^|[\s_])application(_\d+)?\.log$/.test(name);

  // ------------------------------------------------------------------ entries

  /** Streaming parser. push() text as it arrives; it returns only complete entries and keeps the
   *  rest (a half-written line or JSON block) until more text, the next header, or flush(). */
  class EntryParser {
    constructor() {
      this.partial = "";
      this.entry = null;
    }

    push(text) {
      const out = [];
      const lines = (this.partial + text).split("\n");
      this.partial = lines.pop(); // no newline yet, so the line may still be growing
      for (const line of lines) this._line(line.replace(/\r$/, ""), out);
      return out;
    }

    /** End of input (one-shot imports, a session that ended). Emits whatever is complete. */
    flush() {
      const out = [];
      if (this.partial) this._line(this.partial.replace(/\r$/, ""), out);
      this.partial = "";
      this._close(out);
      return out;
    }

    _line(line, out) {
      const m = HEADER_RE.exec(line);
      if (m) {
        this._close(out); // a new header ends the previous entry, finished or not
        this.entry = { date: m[1], time: m[2], offset: m[3] ? m[3].trim() : null, header: m[4], json: null, _json: null };
        return;
      }
      const e = this.entry;
      if (!e) return; // text before the first header
      if (e._json === null) {
        if (!line.startsWith("{")) return; // continuation of the header text; not needed
        e._json = [line];
        if (line.trim().endsWith("}") && tryParse(line) !== undefined) this._close(out); // one-line JSON
        return;
      }
      e._json.push(line);
      if (line === "}") this._close(out);
    }

    _close(out) {
      const e = this.entry;
      if (!e) return;
      this.entry = null;
      if (e._json) {
        const done = e._json[e._json.length - 1] === "}" || e._json.length === 1;
        const parsed = done ? tryParse(e._json.join("\n")) : undefined;
        if (parsed === undefined) e.malformed = true;
        else e.json = parsed;
      }
      delete e._json;
      out.push(e);
    }
  }

  function tryParse(text) {
    try {
      return JSON.parse(text);
    } catch (_) {
      return undefined;
    }
  }

  function entryTime(entry) {
    const t = Date.parse(`${entry.date}T${entry.time}${entry.offset || ""}`); // no offset = local time
    return Number.isNaN(t) ? null : t;
  }

  // ------------------------------------------------------------------ events

  /** A quest status change, or null if the entry isn't one. */
  function questEvent(entry) {
    if (!entry.json || !entry.header.includes(CHAT_MESSAGE)) return null;
    const msg = entry.json.message;
    if (!msg) return null;
    const status = QUEST_TYPES[msg.type];
    if (!status) return null; // 1 chat, 2/8 insurance, 4 flea, 13 Twitch drops, ...
    const questId = String(msg.templateId || "").split(" ")[0];
    if (!/^[0-9a-f]{24}$/i.test(questId)) return null;
    const logged = entryTime(entry);
    const at = typeof msg.dt === "number" ? msg.dt * 1000 : logged;
    return {
      questId,
      status,
      type: msg.type,
      at,
      logged,
      key: entry.json.eventId || `${at}|${questId}|${msg.type}`,
    };
  }

  /** Quest events from complete text: a whole notifications log, read once. */
  function eventsFromText(text) {
    const p = new EntryParser();
    return [...p.push(text), ...p.flush()].map(questEvent).filter(Boolean);
  }

  /** "regular" or "pve" from an application log, or null if it doesn't say. Last mention wins. */
  function sessionMode(appText) {
    const all = [...String(appText || "").matchAll(/Session mode: (\w+)/g)];
    return all.length ? all[all.length - 1][1].toLowerCase() : null;
  }

  /** Distinct identities, rather than a guessed profile or a last-profile-wins replay.
   * Mixed-profile/mode sessions are quarantined for review. No account IDs are retained. */
  function sessionIdentity(appText) {
    const text = String(appText || "");
    const profiles = [...new Set([...text.matchAll(/PrepareSelectedProfileLocally ProfileId:([0-9a-f]{24})\b/gi)].map(m => m[1].toLowerCase()))];
    const modes = [...new Set([...text.matchAll(/Session mode: (\w+)/g)].map(m => m[1].toLowerCase()))];
    return { profileId: profiles.length === 1 ? profiles[0] : null,
      mode: modes.length === 1 ? modes[0] : null, identityConflict: profiles.length > 1 || modes.length > 1 };
  }

  // Snapshot map.nameId -> canonical planner map, including layout variants.
  const RAID_LOCATIONS = Object.freeze({
    bigmap: "customs", tarkovstreets: "streets-of-tarkov", woods: "woods", shoreline: "shoreline",
    laboratory: "the-lab", laboratory_dark: "the-lab", factory4_day: "factory", factory4_night: "factory",
    labyrinth: "the-labyrinth", interchange: "interchange", rezervbase: "reserve", lighthouse: "lighthouse",
    sandbox: "ground-zero", sandbox_high: "ground-zero", sandbox_start: "ground-zero",
    icebreaker: "icebreaker", terminal: "terminal",
  });
  function raidMap(location) { return RAID_LOCATIONS[String(location || "").toLowerCase()] || null; }

  /** Application lines are independent of notification JSON. Only complete lines are consumed;
   * headers/identity/network fields are discarded, never copied into emitted events. */
  class RaidParser {
    constructor(state = { map: null, started: null, positioned: false }) {
      this.state = state;
      this.partial = "";
    }
    push(text) {
      const lines = (this.partial + text).split("\n");
      this.partial = lines.pop();
      return lines.flatMap(line => this.line(line.replace(/\r$/, "")));
    }
    flush() {
      const events = this.partial ? this.line(this.partial.replace(/\r$/, "")) : [];
      this.partial = "";
      return events;
    }
    line(line) {
      const h = HEADER_RE.exec(line);
      if (!h) return [];
      const at = entryTime({ date: h[1], time: h[2], offset: h[3]?.trim() });
      if (at === null) return [];
      const state = this.state;
      const loading = /TRACE-NetworkGameCreate\b.*?\bLocation:\s*([^,\s']+)/.exec(h[4]);
      if (loading) {
        const location = loading[1];
        state.map = raidMap(location); state.started = null; state.positioned = false;
        return [{ kind: "raid-loading", location, map: state.map, at }];
      }
      if (/\bGameStarted:/.test(h[4])) {
        state.started = at; state.positioned = false;
        return [{ kind: "raid-started", map: state.map, at }];
      }
      const pos = /\bReason:(PacketsQueue|Lift|Speed),\s*Position:\(\s*([+\-\d.eE]+),\s*([+\-\d.eE]+),\s*([+\-\d.eE]+)\s*\)/.exec(h[4]);
      if (!pos || state.started === null || state.positioned) return [];
      const secondsAfterStart = (at - state.started) / 1000;
      if (secondsAfterStart < 0 || secondsAfterStart > 10) return [];
      const [x, y, z] = pos.slice(2).map(Number);
      if (![x, y, z].every(Number.isFinite)) return [];
      state.positioned = true;
      return [{ kind: "spawn-position", map: state.map, x, y, z, at, secondsAfterStart, reason: pos[1] }];
    }
  }
  function raidEventsFromText(text) {
    const parser = new RaidParser();
    return [...parser.push(text), ...parser.flush()];
  }

  // ------------------------------------------------------------------ status store

  function emptyState() {
    return { statuses: {}, seen: {}, recent: [] };
  }

  function byTime(a, b) {
    return a.at - b.at || (a.logged || 0) - (b.logged || 0) || (a.seq || 0) - (b.seq || 0);
  }

  /** Apply events oldest first. Duplicates (same key) are skipped, and an event older than what's
   *  already recorded for that quest (say, a manual edit) doesn't overwrite it. Returns the changes. */
  function applyEvents(state, events, maxRecent = 15) {
    const changes = [];
    for (const e of events.slice().sort(byTime)) {
      if (state.seen[e.key]) continue; // also catches a duplicate within this same batch
      state.seen[e.key] = 1;
      const cur = state.statuses[e.questId];
      if (cur && cur.at > e.at) continue;
      state.statuses[e.questId] = { status: e.status, at: e.at, source: "log" };
      changes.push(e);
      state.recent.push({ questId: e.questId, status: e.status, at: e.at });
    }
    state.recent.sort((a, b) => b.at - a.at);
    state.recent.length = Math.min(state.recent.length, maxRecent);
    return changes;
  }

  /** A hand-set status. Stamped "now", so replaying older logs won't undo it. */
  function setManual(state, questId, status, now = Date.now()) {
    if (!status) delete state.statuses[questId];
    else state.statuses[questId] = { status, at: now, source: "manual" };
  }

  // ------------------------------------------------------------------ browser watcher

  const IDB_NAME = "eft-log-tracker";
  const IDB_STORE = "handles";

  function idb(mode, fn) {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open(IDB_NAME, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(IDB_STORE);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction(IDB_STORE, mode);
        const req = fn(tx.objectStore(IDB_STORE));
        tx.oncomplete = () => resolve(req && req.result);
        tx.onerror = () => reject(tx.error);
      };
    });
  }

  async function listSessions(dir) {
    const sessions = [];
    for await (const [name, handle] of dir.entries()) {
      const s = handle.kind === "directory" && parseSessionFolder(name);
      if (s) sessions.push({ ...s, handle });
    }
    return sessions.sort((a, b) => a.sortKey - b.sortKey);
  }

  async function findFile(dir, test) {
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind === "file" && test(name)) return handle;
    }
    return null;
  }

  async function readIdentity(sessionDir) {
    try {
      const texts = [];
      for await (const [name, handle] of sessionDir.entries()) {
        if (handle.kind === "file" && isApplicationLog(name)) texts.push(await (await handle.getFile()).text());
      }
      return sessionIdentity(texts.join("\n"));
    } catch (_) {
      return { mode: null, profileId: null, identityConflict: false };
    }
  }

  /** The user may pick the install folder or build\ instead of Logs; look one or two levels down. */
  async function resolveLogsDir(dir) {
    if ((await listSessions(dir)).length) return dir;
    for (const path of [["Logs"], ["build", "Logs"]]) {
      try {
        let d = dir;
        for (const part of path) d = await d.getDirectoryHandle(part);
        if ((await listSessions(d)).length) return d;
      } catch (_) {
        /* not there */
      }
    }
    return dir; // a fresh install may have no sessions yet; watch it anyway
  }

  /**
   * Status values: unsupported | not-connected | needs-permission | waiting | watching | error.
   * onEvents gets quest history/live changes; onRaid(event, meta) gets only live application lines.
   * onStatus(info) gets status changes. Initial application history, scans and imports never fire onRaid.
   */
  class LogWatcher {
    constructor({ onEvents, onStatus, onRaid, pollMs = 4000, rotateMs = 30000 } = {}) {
      this.onEvents = onEvents || (() => {});
      this.onStatus = onStatus || (() => {});
      this.onRaid = onRaid || (() => {});
      this.pollMs = pollMs;
      this.rotateMs = rotateMs;
      this.dir = null;
      this.timer = null;
      this.busy = false;
      this.seq = 0;
      this.status = { state: LogWatcher.supported() ? "not-connected" : "unsupported" };
    }

    static supported() {
      return typeof window !== "undefined" && "showDirectoryPicker" in window && window.isSecureContext;
    }

    _set(state, extra = {}) {
      this.status = { state, ...extra };
      this.onStatus(this.status);
    }

    /** On page load: reuse a saved folder if the browser still allows it. Never prompts. */
    async restore() {
      if (!LogWatcher.supported()) return this._set("unsupported");
      let handle = null;
      try {
        handle = await idb("readonly", (s) => s.get("logs"));
      } catch (_) {
        /* storage blocked */
      }
      if (!handle) return this._set("not-connected");
      this.dir = handle;
      if ((await handle.queryPermission({ mode: "read" })) === "granted") return this._start();
      this._set("needs-permission", { folder: handle.name });
    }

    /** Must run inside a click. */
    async connect() {
      const picked = await window.showDirectoryPicker({ id: "eft-logs", mode: "read" });
      const dir = await resolveLogsDir(picked);
      try {
        await idb("readwrite", (s) => s.put(dir, "logs"));
      } catch (_) {
        /* works for this visit only */
      }
      return this.watch(dir);
    }

    /** Start watching a Logs directory handle (anything with entries() and file handles). */
    async watch(dir) {
      this.dir = dir;
      return this._start();
    }

    /** Must run inside a click. */
    async reconnect() {
      if (!this.dir) return this.connect();
      if ((await this.dir.requestPermission({ mode: "read" })) !== "granted") {
        return this._set("needs-permission", { folder: this.dir.name });
      }
      return this._start();
    }

    stop() {
      clearInterval(this.timer);
      this.timer = null;
    }

    async _start() {
      this.stop();
      await this._attachNewest();
      let sinceRotate = 0;
      this.timer = setInterval(async () => {
        if (this.busy) return;
        this.busy = true;
        try {
          sinceRotate += this.pollMs;
          if (sinceRotate >= this.rotateMs) {
            sinceRotate = 0;
            await this._checkRotation();
          }
          await this._tick();
        } catch (err) {
          this._fail(err);
        } finally {
          this.busy = false;
        }
      }, this.pollMs);
    }

    async _attachNewest() {
      try {
        const sessions = await listSessions(this.dir);
        const newest = sessions[sessions.length - 1];
        if (!newest) return this._set("waiting", { folder: this.dir.name, detail: "No game sessions in this folder yet" });
        await this._attach(newest, false);
        await this._tick();
      } catch (err) {
        this._fail(err);
      }
    }

    async _attach(session, live = true) {
      this.session = session;
      this.file = await findFile(session.handle, isNotificationsLog);
      this.offset = 0; // read the session from the start; duplicates are dropped by the store
      this.parser = new EntryParser();
      this.decoder = new TextDecoder("utf-8");
      this.extraReaders = new Map();
      this.identity = await readIdentity(session.handle);
      this.mode = this.identity.mode;
      this.appReaders = new Map();
      this.raidState = { map: null, started: null, positioned: false };
      // First connection primes context silently. Subsequent sessions are live rotations.
      await this._readApplications(live);
      this._report();
    }

    _report() {
      if (!this.file) return this._set("waiting", { folder: this.session.name, mode: this.mode, detail: "Waiting for the game to write quest notifications" });
      this._set("watching", { folder: this.session.name, mode: this.mode, lastRead: this.lastRead });
    }

    async _checkRotation() {
      const sessions = await listSessions(this.dir);
      const newest = sessions[sessions.length - 1];
      if (newest && (!this.session || newest.sortKey > this.session.sortKey)) {
        if (this.session) await this._readApplications(true);
        if (this.parser) this._emit(this.parser.flush()); // finish the old session first
        for (const reader of this.extraReaders?.values() || []) this._emit(reader.parser.flush());
        await this._attach(newest);
      }
    }

    async _tick() {
      if (!this.session) return;
      // Identity can be written after the notifications file first appears.
      const identity = await readIdentity(this.session.handle);
      if (JSON.stringify(identity) !== JSON.stringify(this.identity)) {
        this.offset = 0; this.parser = new EntryParser(); this.decoder = new TextDecoder("utf-8");
        this.extraReaders = new Map();
      }
      this.identity = identity;
      this.mode = this.identity.mode;
      await this._readApplications(true);
      if (!this.file) {
        this.file = await findFile(this.session.handle, isNotificationsLog);
        if (!this.file) return;
        this._report();
      }
      const file = await this.file.getFile();
      if (file.size < this.offset) {
        // Smaller than what we've read: the file was replaced. Start over.
        this.offset = 0;
        this.parser = new EntryParser();
        this.decoder = new TextDecoder("utf-8");
      }
      if (file.size > this.offset) {
        const bytes = await file.slice(this.offset).arrayBuffer();
        this.offset = file.size;
        // stream:true keeps a multi-byte character that's split across reads intact
        this._emit(this.parser.push(this.decoder.decode(bytes, { stream: true })));
        this.lastRead = Date.now();
        this._report();
      }
      // Rotated notification files use the same parser and identity as scans/imports.
      for await (const [name, handle] of this.session.handle.entries()) {
        if (handle.kind !== "file" || !isNotificationsLog(name) || name === this.file.name) continue;
        let reader = this.extraReaders.get(name);
        const next = await handle.getFile();
        if (!reader || next.size < reader.offset) {
          reader = { offset: 0, parser: new EntryParser(), decoder: new TextDecoder("utf-8") };
          this.extraReaders.set(name, reader);
        }
        if (next.size > reader.offset) {
          const bytes = await next.slice(reader.offset).arrayBuffer(); reader.offset = next.size;
          this._emit(reader.parser.push(reader.decoder.decode(bytes, { stream: true })));
        }
      }
    }

    async _readApplications(live) {
      const files = [];
      for await (const [name, handle] of this.session.handle.entries()) {
        if (handle.kind === "file" && isApplicationLog(name)) files.push([name, handle]);
      }
      files.sort((a, b) => a[0].localeCompare(b[0], "en", { numeric: true }));
      for (const [name, handle] of files) {
        const file = await handle.getFile();
        let reader = this.appReaders.get(name);
        const replaced = reader && file.size < reader.offset;
        if (!reader || replaced) {
          // A replaced file is primed silently; otherwise a rewrite could replay an old raid.
          if (replaced) Object.assign(this.raidState, { map: null, started: null, positioned: false });
          reader = { offset: 0, parser: new RaidParser(this.raidState), decoder: new TextDecoder("utf-8") };
          this.appReaders.set(name, reader);
        }
        if (file.size > reader.offset) {
          const bytes = await file.slice(reader.offset).arrayBuffer();
          reader.offset = file.size;
          const events = reader.parser.push(reader.decoder.decode(bytes, { stream: true }));
          if (live && !replaced) for (const event of events) {
            this.onRaid(event, { ...this.identity, session: this.session.name });
          }
        }
      }
    }

    _emit(entries) {
      const events = entries.map(questEvent).filter(Boolean);
      for (const e of events) e.seq = ++this.seq;
      if (events.length) this.onEvents(events, { ...this.identity, session: this.session && this.session.name });
    }

    _fail(err) {
      this.stop();
      if (err && err.name === "NotAllowedError") return this._set("needs-permission", { folder: this.dir && this.dir.name });
      if (err && err.name === "NotFoundError") return this._set("error", { detail: "The logs folder or session folder disappeared. Connect it again." });
      this._set("error", { detail: (err && err.message) || String(err) });
    }

    /** Read every session oldest to newest, to catch up on progress made while the page was closed. */
    async scanPast() {
      const sessions = await listSessions(this.dir);
      let found = 0;
      for (const s of sessions) {
        const events = [];
        for await (const [name, handle] of s.handle.entries()) {
          if (handle.kind === "file" && isNotificationsLog(name)) events.push(...eventsFromText(await (await handle.getFile()).text()));
        }
        for (const e of events) e.seq = ++this.seq;
        found += events.length;
        if (events.length) this.onEvents(events, { ...await readIdentity(s.handle), session: s.name });
      }
      return { sessions: sessions.length, events: found };
    }
  }

  /** Fallback for browsers without showDirectoryPicker: a one-time import from
   *  <input type="file" webkitdirectory>. Calls onEvents per session, oldest first. */
  async function importFileList(fileList, onEvents) {
    const groups = new Map();
    for (const f of fileList) {
      const parts = (f.webkitRelativePath || f.name).split("/");
      const folder = parts.slice(0, -1).reverse().find((p) => parseSessionFolder(p));
      if (!folder) continue;
      if (!groups.has(folder)) groups.set(folder, { ...parseSessionFolder(folder), notif: [], app: [] });
      const g = groups.get(folder);
      if (isNotificationsLog(f.name)) g.notif.push(f);
      else if (isApplicationLog(f.name)) g.app.push(f);
    }
    const sessions = [...groups.values()].sort((a, b) => a.sortKey - b.sortKey);
    let found = 0;
    let seq = 0;
    for (const s of sessions) {
      const events = (await Promise.all(s.notif.map(async f => eventsFromText(await f.text())))).flat();
      for (const e of events) e.seq = ++seq;
      found += events.length;
      if (events.length) onEvents(events, { ...sessionIdentity((await Promise.all(s.app.map(f => f.text()))).join("\n")), session: s.name });
    }
    return { sessions: sessions.length, events: found };
  }

  return {
    EntryParser,
    RaidParser,
    raidMap,
    raidEventsFromText,
    RAID_LOCATIONS,
    parseSessionFolder,
    isNotificationsLog,
    isApplicationLog,
    questEvent,
    eventsFromText,
    sessionMode,
    sessionIdentity,
    emptyState,
    applyEvents,
    setManual,
    LogWatcher,
    importFileList,
  };
});
