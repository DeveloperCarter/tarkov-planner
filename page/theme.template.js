// Shared DOM fragment, injected into the page templates. The control is in Settings.
let siteTheme = "system";
try { siteTheme = localStorage.getItem("eft-theme") || "system"; } catch(e) {}
function applyTheme() {
  if (!["system", "light", "dark"].includes(siteTheme)) siteTheme = "system";
  if (siteTheme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.dataset.theme = siteTheme;
  document.getElementById("themeSelect").value = siteTheme;
}
document.getElementById("themeSelect").addEventListener("change", e => {
  siteTheme = e.target.value;
  try {localStorage.setItem("eft-theme", siteTheme);} catch(e) {}
  applyTheme();
});
applyTheme();
