/* A narrow DOM bridge. No logs, progress storage, game access or network calls. */
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  const supported = document.documentElement.dataset.questNavigation === "1";
  const url = location.href.split("#")[0];
  const wrongPage = message.type === "planner-step" && message.url !== url;
  const ready = supported && !wrongPage && document.documentElement.dataset.questNavigationReady === "1";
  if (message.type === "planner-probe") {
    reply({ supported, ready, title: document.title, url });
  } else if (message.type === "planner-step" && [-1, 1].includes(message.direction)) {
    if (ready) document.dispatchEvent(new CustomEvent("eft-quest-focus", { detail: String(message.direction) }));
    reply({ supported, ready, wrongPage });
  }
});
