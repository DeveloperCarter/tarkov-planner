// Shared DOM fragment, injected into the page templates.
let siteTheme = "system";
try { siteTheme = localStorage.getItem("eft-theme") || "system"; } catch(e) {}
function applyTheme() {
  if (!["system", "light", "dark"].includes(siteTheme)) siteTheme = "system";
  if (siteTheme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.dataset.theme = siteTheme;
  document.getElementById("themeToggle").textContent = `Theme: ${siteTheme}`;
}
document.getElementById("themeToggle").addEventListener("click", () => {
  siteTheme = {system:"light", light:"dark", dark:"system"}[siteTheme];
  try {localStorage.setItem("eft-theme", siteTheme);} catch(e) {}
  applyTheme();
});
applyTheme();
