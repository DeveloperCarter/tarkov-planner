"use strict";
const status = document.getElementById("status"), arm = document.getElementById("arm"), stop = document.getElementById("stop");
let candidate = null;
async function render() {
  try {
    const { target } = await chrome.storage.session.get("target");
    stop.disabled = !target;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    let probe;
    try { probe = await chrome.tabs.sendMessage(tab.id, { type: "planner-probe" }); } catch (_) {}
    candidate = probe?.supported ? { id: tab.id, url: probe.url, title: probe.title } : null;
    arm.disabled = !candidate;
    status.textContent = target ? `Shortcuts enabled for ${target.title}.${candidate?.id === target.id && !probe.ready ? " Select quests and turn on Focus or raid mode to use them. Close any dialogs first." : ""}`
      : candidate ? "Choose this tab to receive shortcuts, even while Tarkov has focus." : "Open a planner map page, reload it after installing this extension, then choose this tab.";
  } catch (_) { status.textContent = "Could not read extension settings. Reopen this popup to try again."; }
}
arm.addEventListener("click", async () => {
  try { if (candidate) await chrome.storage.session.set({ target: candidate }); await render(); }
  catch (_) { status.textContent = "Could not enable shortcuts. Reopen this popup to try again."; }
});
stop.addEventListener("click", async () => {
  try { await chrome.storage.session.remove("target"); await render(); }
  catch (_) { status.textContent = "Could not stop shortcuts. Disable the extension in your browser settings."; }
});
// What's bound right now, since the player can change any of it.
chrome.commands.getAll(commands => {
  document.getElementById("keys").replaceChildren(...commands.filter(c => c.description).map(c => {
    const row = document.createElement("p"), key = document.createElement("b");
    key.textContent = c.shortcut || "Not set";
    row.append(key, ` · ${c.description.replace(/^Focus mode: /, "")}`);
    return row;
  }));
});
document.getElementById("change").addEventListener("click", () => chrome.tabs.create({ url: "chrome://extensions/shortcuts" }));
render();
