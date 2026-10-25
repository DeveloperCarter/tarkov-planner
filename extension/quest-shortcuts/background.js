/* One explicitly armed tab, remembered for this browser session only. */
chrome.runtime.onInstalled.addListener(() => chrome.storage.session.clear());
async function disarm(target) {
  const saved = (await chrome.storage.session.get("target")).target;
  if (saved?.id === target?.id && saved?.url === target?.url) await chrome.storage.session.remove("target");
}
chrome.commands.onCommand.addListener(async command => {
  const direction = command === "next-quest" ? 1 : command === "previous-quest" ? -1 : 0;
  if (!direction) return;
  let target;
  try {
    ({ target } = await chrome.storage.session.get("target"));
    if (!target) return;
    const reply = await chrome.tabs.sendMessage(target.id, { type: "planner-step", direction, url: target.url });
    if (!reply?.supported || reply.wrongPage) await disarm(target);
  } catch (_) { try { if (target) await disarm(target); } catch (_) {} }
});
chrome.tabs.onRemoved.addListener(async id => {
  const { target } = await chrome.storage.session.get("target");
  if (target?.id === id) await chrome.storage.session.remove("target");
});
chrome.tabs.onUpdated.addListener(async (id, change) => {
  if (!change.url && change.status !== "complete") return;
  const { target } = await chrome.storage.session.get("target");
  if (target?.id !== id) return;
  try {
    // Probe rather than requesting tabs or all-site permissions to read the URL.
    const url = change.url || (await chrome.tabs.sendMessage(id, { type: "planner-probe" }))?.url;
    if (url?.split("#")[0] !== target.url) await disarm(target);
  } catch (_) { await disarm(target); }
});
