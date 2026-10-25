# Quest shortcuts for Tarkov Planner

An optional Chrome/Edge extension. It sends previous/next commands to one planner map tab while
Tarkov has focus. It does not read game input, game files, logs, inventory or quest progress.
It does not send anything to a server. Chrome itself registers the two global shortcuts.

## Install

1. Download `downloads/quest-shortcuts.zip` from the planner and extract it into a permanent folder.
2. Open `chrome://extensions` (Edge: `edge://extensions`), enable Developer mode, choose **Load
   unpacked**, and select the extracted `quest-shortcuts` folder containing `manifest.json`.
3. Reload the planner map page. Open this extension's toolbar button and choose **Use this planner
   tab**. Open PMC raid mode and select quests.
4. Previous is **Ctrl + Shift + 9**; Next is **Ctrl + Shift + 0**. They work with the browser in
   the background. In `chrome://extensions/shortcuts` (Edge: `edge://extensions/shortcuts`), keep
   both set to **Global**. You can remap them to **Ctrl + Shift + Left / Right** or another free
   combination. Bare arrows are not supported. Conflicting OS/game shortcuts need another binding.

The site also has Previous/Next buttons and Ctrl + Shift + Left/Right while the page has focus.
Use **Stop shortcuts** in the popup to disarm the extension. Closing the chosen tab, switching its
map/mode URL or restarting the browser clears the choice. Reloading the same page keeps it.
Only the chosen tab receives commands; opening the popup on another tab does not change it.
The commands pause outside PMC raid mode, with no selected quests, or while any dialog is open.
Minimized/sleeping browser tabs may respond late; keep the planner open on your second screen.

## What the controls do

They move the highlighted card through selected quests in the site's current route order, frame
its map locations, and scroll the checklist to that card. They wrap around at either end.
Quests without a fixed location still get a highlighted card and leave the map view in place.
Browsing never completes objectives, changes quest status, changes raid selection, or advances
the calculated route. Use the existing checklist or real game-log completions for that.

## Access and updates

The only explicit API permission is extension `storage`, used to remember one tab for the browser
session. A content script runs only on planner map URLs under DeveloperCarter's GitHub Pages site
and `/maps/*.html` or `/pve/maps/*.html` on localhost/127.0.0.1. No all-sites, keyboard-logging,
native helper, game injection or network permission is used. It never brings the planner to the
foreground.

This is an unpacked developer extension, not a Chrome Web Store release. To update it, replace
the extracted files, click Reload on its extension card, reload the planner and choose its tab again.
Browser shortcuts reference: https://developer.chrome.com/docs/extensions/reference/api/commands
