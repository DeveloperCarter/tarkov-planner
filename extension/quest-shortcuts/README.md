# Quest shortcuts for Tarkov Planner

An optional Chrome/Edge extension. It sends commands to one planner map tab while Tarkov has focus:
step between quests, swap quest photos, and tick objectives. It does not read game input, game
files, logs or inventory. It does not send anything to a server. Chrome itself registers the
global shortcuts.

## Install

1. Download `downloads/quest-shortcuts.zip` from the planner and extract it into a permanent folder.
2. Open `chrome://extensions` (Edge: `edge://extensions`), enable Developer mode, choose **Load
   unpacked**, and select the extracted `quest-shortcuts` folder containing `manifest.json`.
3. Reload the planner map page. Open this extension's toolbar button and choose **Use this planner
   tab**. Open PMC raid mode and select quests.
4. Defaults, which work with the browser in the background:

   | Key | Action |
   | --- | --- |
   | Ctrl + Shift + 9 / 0 | Previous / next quest |
   | Ctrl + Shift + 8 | Focus mode: tick the outlined objective, or add one to its counter |
   | Ctrl + Shift + 7 | Focus mode: next photo |
   | Not set | Focus mode: undo the last tick, previous photo |

   Chrome allows four default shortcuts, so assign the last two yourself. Use the popup's **Change
   keys** button (Edge: `edge://extensions/shortcuts`), and keep each one set to **Global**. Every
   shortcut needs Ctrl or Alt, so plain arrows or Page Down can't work while Tarkov has focus. Alt +
   Page Down, Alt + Page Up and Alt + Left / Right are good candidates. Conflicting OS or game
   shortcuts need another binding.

The site also has Previous/Next buttons and Ctrl + Shift + Left/Right while the page has focus. In
Focus mode, plain Left/Right swap photos, Page Down ticks and Page Up undoes while the page has focus.
Use **Stop shortcuts** in the popup to disarm the extension. Closing the chosen tab, switching its
map/mode URL or restarting the browser clears the choice. Reloading the same page keeps it.
Only the chosen tab receives commands; opening the popup on another tab does not change it.
Quest stepping pauses outside PMC raid mode and Focus mode. Photos and ticks need Focus mode. All of
them pause with no selected quests or while any dialog is open.
Minimized/sleeping browser tabs may respond late; keep the planner open on your second screen.

## What the controls do

They move the highlighted card through selected quests in the site's current route order, frame
its map locations, and scroll the checklist to that card. They wrap around at either end.
Quests without a fixed location still get a highlighted card and leave the map view in place.
Stepping never completes objectives, changes quest status, changes raid selection, or advances the
calculated route.

The tick command acts on the objective outlined in the Focus card, in walking order, and only on
this browser's checklist, the same as clicking it. It never changes a quest's status. Ticking a
quest's last objective moves on to the next quest. Holding a key doesn't repeat on the page.

## Access and updates

The only explicit API permission is extension `storage`, used to remember one tab for the browser
session. A content script runs only on planner map URLs under DeveloperCarter's GitHub Pages site
and `/maps/*.html` or `/pve/maps/*.html` on localhost/127.0.0.1. No all-sites, keyboard-logging,
native helper, game injection or network permission is used. It never brings the planner to the
foreground.

This is an unpacked developer extension, not a Chrome Web Store release. To update it, replace
the extracted files, click Reload on its extension card, reload the planner and choose its tab again.
Browser shortcuts reference: https://developer.chrome.com/docs/extensions/reference/api/commands
