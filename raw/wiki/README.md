# Cached wiki responses

Raw MediaWiki API responses from the Escape from Tarkov Wiki. Original page URLs and their
response filenames are recorded in `index.json`. Wikitext remains under the wiki's CC BY-SA
terms; see the [wiki](https://escapefromtarkov.fandom.com/wiki/Quests) and its licensing footer.
These files are build inputs, not published site assets. UI output uses prerequisite facts
and source links rather than copying guide prose. Cached errors are retained too; only an
explicit `--refresh` retries an existing response. New pages are requested at one per second.
