/* The Settings dialog and the log connection, shared by the home and map pages. Each page supplies
   activeScope(), setText(), handleEvents(events, meta), handleRaidEvent(event, meta) and afterTracker(state),
   then calls renderTracker() and watcher.restore() once it's ready. Reads only the Logs folder the player picks. */
const settingsDialog = document.getElementById("settingsDialog");
function openSettings() { if (settingsDialog.open) return; if (typeof closePop === "function") closePop(); settingsDialog.showModal(); }
document.addEventListener("click", e => { if (e.target.closest("[data-open-settings]")) openSettings(); });
document.getElementById("settingsClose").addEventListener("click", () => settingsDialog.close());
settingsDialog.addEventListener("click", e => { if (e.target === settingsDialog) settingsDialog.close(); }); // backdrop

function autoRaidOn() { try { return localStorage.getItem("eft-auto-raid") !== "0"; } catch (e) { return true; } }
document.getElementById("autoRaid").checked = autoRaidOn();
document.getElementById("autoRaid").addEventListener("change", e => { try { localStorage.setItem("eft-auto-raid", e.target.checked ? "1" : "0"); } catch (_) {} });
document.getElementById("focusSetting").checked = QuestFocus.load();
document.getElementById("focusSetting").addEventListener("change", e => { QuestFocus.save(e.target.checked); window.dispatchEvent(new Event("eft-quest-focus-change")); });

const fmtDay = ms => new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
// Saved scopes first, then profiles found in the logs that have no log-backed scope yet.
function scopeOptions(store, mode, key) {
  const saved = Object.entries(store.scopes).filter(([, s]) => s.mode === mode);
  const found = ProgressStore.detectedProfiles(store, mode);
  const tracked = new Set(saved.filter(([, s]) => s.start !== null).map(([, s]) => s.profile));
  const offers = found.profiles.filter(p => !tracked.has(p.profileId));
  const placeholder = saved.length ? "Choose a profile and wipe" : offers.length ? "Choose your profile from your logs" : "Scan or import logs to find your profile";
  return `<option value="">${placeholder}</option>` +
    (saved.length ? `<optgroup label="Saved">${saved.map(([k, s]) =>
      `<option value="${esc(k)}" ${k === key ? "selected" : ""}>${esc(s.label)} · ${esc(s.profile)} · ${s.mode === "pve" ? "PvE" : "PvP"}</option>`).join("")}</optgroup>` : "") +
    (offers.length ? `<optgroup label="Found in your logs">${offers.map(p =>
      `<option value="detect:${esc(p.profileId)}">Profile …${esc(p.profileId.slice(-6))} · ${p.events} quest events · ${p.fromStart ? "from character start" : "from " + fmtDay(p.first)} – ${fmtDay(p.last)}</option>`).join("")}</optgroup>` : "");
}

const trk = { note: "", fallback: false };
const STATE_TEXT = {
  unsupported: "Live tracking isn't available here", "not-connected": "Not connected",
  "needs-permission": "Logs folder needs permission again", waiting: "Waiting for game", watching: "Watching", error: "Stopped",
};
const ACTIONS = {
  unsupported: [["import", "Import logs folder", true]],
  "not-connected": [["connect", "Connect logs folder", true]],
  "needs-permission": [["reconnect", "Reconnect logs folder", true]],
  waiting: [["scan", "Scan past sessions"], ["connect", "Change folder"]],
  watching: [["scan", "Scan past sessions"], ["connect", "Change folder"]],
  error: [["reconnect", "Reconnect logs folder", true], ["connect", "Choose folder"]],
};
const watcher = new EftLogs.LogWatcher({ onRaid: handleRaidEvent, onEvents: handleEvents, onStatus: () => renderTracker() });

function renderTracker() {
  const s = watcher.status, state = trk.fallback ? "unsupported" : s.state;
  document.getElementById("trkDot").dataset.state = document.getElementById("settingsDot").dataset.state = state;
  const summary = state === "watching" ? "Logs live" : STATE_TEXT[state] || state, button = document.querySelector("[data-open-settings].site-settings");
  button.title = `Settings · ${summary}`; button.setAttribute("aria-label", button.title);
  setText("trkState", state === "watching" ? `Watching ${s.folder}` : STATE_TEXT[state] || state);
  const bits = [];
  if (state === "unsupported") bits.push("Live tracking needs Chrome or Edge, opened over https or localhost. Import reads the folder once.");
  if (s.detail && !trk.fallback) bits.push(s.detail);
  if (state === "needs-permission" && s.folder) bits.push(`Folder: ${s.folder}`);
  if (s.mode && !trk.fallback) bits.push(`${s.mode === "pve" ? "PvE" : "PvP"} session`);
  if (s.lastRead && state === "watching") bits.push(`last update ${new Date(s.lastRead).toLocaleTimeString()}`);
  if (trk.note) bits.push(trk.note);
  setText("trkDetail", bits.join(" · "));
  const actions = [...(ACTIONS[state] || [])];
  if (!actions.some(([act]) => act === "import")) actions.push(["import", "Import logs folder"]);
  document.getElementById("trkActions").innerHTML = actions.map(([act, label, primary]) =>
    `<button class="btn${primary ? " primary" : ""}" type="button" id="trk-${act}" data-act="${act}">${label}</button>`).join("");
  afterTracker(state, summary);
}
document.getElementById("trkActions").addEventListener("click", async e => {
  const act = e.target.closest("button")?.dataset.act;
  if (!act) return;
  trk.note = "";
  try {
    if (act === "import") return document.getElementById("trkImport").click();
    if (act === "connect") await watcher.connect();          // the picker opens inside this click
    if (act === "reconnect") await watcher.reconnect();      // so does the permission prompt
    if (act === "scan") {
      trk.note = "Scanning past sessions…"; renderTracker();
      const r = await watcher.scanPast();
      trk.note = `Scanned ${r.sessions} sessions, ${r.events} quest events` + (activeScope() ? "" : ". Choose your profile under Profile and wipe to see them");
    }
  } catch (err) {
    if (err.name === "AbortError") return; // closed the picker
    if (err.name === "SecurityError") {
      trk.fallback = true; // e.g. inside an embedded frame that may not open folders
      trk.note = "This page can't open folders where it's running. Import the folder instead, or open the page from localhost.";
    } else trk.note = err.message;
  }
  renderTracker();
});
document.getElementById("trkImport").addEventListener("change", async e => {
  if (!e.target.files.length) return;
  trk.note = "Reading logs…"; renderTracker();
  try {
    const r = await EftLogs.importFileList(e.target.files, handleEvents);
    trk.note = r.sessions ? `Imported ${r.events} quest events from ${r.sessions} sessions` + (activeScope() ? "" : ". Choose your profile under Profile and wipe to see them") : "No log_… session folders found. Pick the Logs folder inside your EFT install.";
  } catch (err) { trk.note = err.message; }
  e.target.value = "";
  renderTracker();
});
