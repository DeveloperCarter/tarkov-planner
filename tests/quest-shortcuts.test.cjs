const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const root = path.join(__dirname, '../extension/quest-shortcuts');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

test('extension permissions and global defaults are limited; all packaged scripts parse', () => {
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.equal(manifest.host_permissions, undefined);
  for (const cmd of Object.values(manifest.commands)) {
    assert.equal(cmd.global, true); assert.match(cmd.suggested_key.default, /^Ctrl\+Shift\+[09]$/);
  }
  assert.equal(manifest.content_scripts[0].matches.some(s => s.includes('<all_urls>') || s.startsWith('*://')), false);
  for (const file of ['background.js', 'content.js', 'popup.js']) new vm.Script(fs.readFileSync(path.join(root, file), 'utf8'));
});

test('background routes only to explicitly chosen tab across worker restarts; clears closed/navigated targets', async () => {
  const listeners = {}, sent = []; let target = null, fail = false;
  const chrome = { runtime: { onInstalled: { addListener: fn => { listeners.installed = fn; } } },
    storage: { session: { async get() { return { target }; }, async remove() { target = null; }, async clear() { target = null; } } },
    commands: { onCommand: { addListener: fn => { listeners.command = fn; } } },
    tabs: { async sendMessage(id, message) { if (fail) throw Error('tab closed'); sent.push({ id, message }); return { supported: true }; },
      onRemoved: { addListener: fn => { listeners.removed = fn; } }, onUpdated: { addListener: fn => { listeners.updated = fn; } } } };
  const boot = () => vm.runInNewContext(fs.readFileSync(path.join(root, 'background.js'), 'utf8'), { chrome });
  boot(); await listeners.command('next-quest'); assert.equal(sent.length, 0);
  target = { id: 7, url: 'https://developercarter.github.io/tarkov-planner/maps/customs.html' };
  await listeners.command('next-quest'); assert.equal(sent[0].id, 7); assert.equal(sent[0].message.direction, 1);
  boot(); await listeners.command('previous-quest'); assert.equal(sent[1].message.direction, -1);
  await listeners.command('complete-quest'); assert.equal(sent.length, 2);
  await listeners.updated(8, { url: 'https://elsewhere.example' }); assert.equal(target.id, 7);
  await listeners.updated(7, { url: target.url + '#raid' }); assert.equal(target.id, 7);
  await listeners.updated(7, { url: 'https://developercarter.github.io/tarkov-planner/pve/maps/customs.html' }); assert.equal(target, null);
  target = { id: 7 }; await listeners.removed(7); assert.equal(target, null);
  target = { id: 7 }; fail = true; await listeners.command('next-quest'); assert.equal(target, null);
});

test('content bridge only dispatches allowed visual directions on a ready planner page', () => {
  let receive; const events = [], replies = [], dataset = {};
  vm.runInNewContext(fs.readFileSync(path.join(root, 'content.js'), 'utf8'), {
    chrome: { runtime: { onMessage: { addListener: fn => { receive = fn; } } } },
    document: { documentElement: { dataset }, title: 'Customs', dispatchEvent: e => events.push(e) },
    location: { href: 'http://localhost:8765/maps/customs.html#raid' }, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } } });
  const send = message => receive({ url: 'http://localhost:8765/maps/customs.html', ...message }, {}, reply => replies.push(reply));
  send({ type: 'planner-probe' }); assert.equal(replies.at(-1).supported, false);
  dataset.questNavigation = '1'; send({ type: 'planner-step', direction: 1 }); assert.equal(events.length, 0);
  dataset.questNavigationReady = '1'; send({ type: 'planner-step', direction: -1 });
  assert.equal(events.length, 1); assert.equal(events[0].detail, '-1');
  assert.equal(events[0].type, 'eft-quest-focus');
  send({ type: 'planner-step', direction: 1, url: 'http://localhost:8765/maps/woods.html' });
  assert.equal(replies.at(-1).wrongPage, true); assert.equal(events.length, 1, 'a map change pauses the old binding even if the worker missed navigation');
  send({ type: 'planner-step', direction: 2 }); send({ type: 'complete-quest' }); assert.equal(events.length, 1);
});
