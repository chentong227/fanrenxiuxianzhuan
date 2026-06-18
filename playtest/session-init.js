#!/usr/bin/env node
/*
 * playtest/session-init.js — one-command session bootstrap for playtesting.
 *
 * Brings a fresh session straight to the committed checkpoint, so any agent
 * "lands at the repo save point" on arrival (the防丢加固 / 开局一键起服 from
 * docs/playtest-experience-guide.md §11):
 *
 *   1. start scripts/_serve.js (skips if the port is already serving)
 *   2. open / reuse a Chrome game tab via CDP (localhost:29229)
 *   3. restore the repo checkpoint into localStorage (savetool.js load)
 *
 * Usage:
 *   node playtest/session-init.js                 # serve 8011 + open + restore default save
 *   node playtest/session-init.js --port 8011     # custom port
 *   node playtest/session-init.js --save playtest/save-qixuan.json
 *   node playtest/session-init.js --no-restore    # serve + open only (fresh game)
 *
 * Env overrides: PORT, CDP_URL (default http://localhost:29229), SAVE_FILE.
 * Zero external deps (the repo is build-less). Cross-platform (no shell builtins).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const repoRoot = path.join(__dirname, '..');
const args = process.argv.slice(2);
function flag(name) { return args.includes(name); }
function opt(name, def) { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : def; }

const PORT = parseInt(opt('--port', process.env.PORT || '8011'), 10);
const CDP_URL = (process.env.CDP_URL || 'http://localhost:29229').replace(/\/$/, '');
const SAVE_FILE = opt('--save', process.env.SAVE_FILE || path.join('playtest', 'save-qixuan.json'));
const NO_RESTORE = flag('--no-restore');
const GAME_URL = `http://127.0.0.1:${PORT}/`;

const sleep = ms => new Promise(r => setTimeout(r, ms));

function getJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

function getText(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.setTimeout(2000, () => req.destroy(new Error('timeout')));
  });
}

// CDP HTTP endpoint: open a new page tab loading `url`.
function cdpNewTab(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(CDP_URL + '/json/new?' + url);
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: 'PUT' }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { resolve({ raw: d }); } });
    });
    req.on('error', reject);
    req.end();
  });
}

async function serverUp() {
  try { const r = await getText(`${GAME_URL}ver.txt`); return r.status === 200; } catch (e) { return false; }
}

async function ensureServer() {
  if (await serverUp()) { console.log(`[serve] already up on ${GAME_URL} (ver ${(await getText(GAME_URL + 'ver.txt')).body.trim()})`); return; }
  const logPath = path.join(repoRoot, 'playtest', '_serve.log');
  const out = fs.openSync(logPath, 'a');
  const child = spawn(process.execPath, [path.join('scripts', '_serve.js'), String(PORT)],
    { cwd: repoRoot, detached: true, stdio: ['ignore', out, out] });
  child.unref();
  for (let i = 0; i < 40; i++) { if (await serverUp()) { console.log(`[serve] started on ${GAME_URL} (log: playtest/_serve.log)`); return; } await sleep(250); }
  throw new Error(`server did not come up on ${GAME_URL} within 10s — see playtest/_serve.log`);
}

function isGamePage(t) {
  return t.type === 'page' && new RegExp(`(127\\.0\\.0\\.1|localhost):${PORT}`).test(t.url || '');
}

async function ensureGameTab() {
  let targets = [];
  try { targets = await getJSON(`${CDP_URL}/json`); } catch (e) {
    console.log(`[cdp] ${CDP_URL} unreachable (${e.message}); skip auto-open — open ${GAME_URL} in the browser yourself.`);
    return false;
  }
  if (targets.some(isGamePage)) { console.log(`[cdp] game tab already open (${GAME_URL})`); return true; }
  await cdpNewTab(GAME_URL);
  for (let i = 0; i < 20; i++) {
    await sleep(250);
    try { targets = await getJSON(`${CDP_URL}/json`); } catch (e) {}
    if (targets.some(isGamePage)) { console.log(`[cdp] opened game tab ${GAME_URL}`); return true; }
  }
  console.log(`[cdp] could not confirm game tab; open ${GAME_URL} in the browser yourself.`);
  return false;
}

function restoreSave() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join('playtest', 'savetool.js'), 'load', SAVE_FILE],
      { cwd: repoRoot, stdio: 'inherit', env: { ...process.env, CDP_URL } });
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`savetool load exited ${code}`)));
    child.on('error', reject);
  });
}

(async () => {
  await ensureServer();
  const haveTab = await ensureGameTab();
  if (NO_RESTORE) { console.log('[done] server + tab ready (--no-restore: fresh game, no checkpoint loaded).'); return; }
  if (!haveTab) { console.log('[skip] no game tab — open the game then run: node playtest/savetool.js load'); return; }
  if (!fs.existsSync(path.join(repoRoot, SAVE_FILE))) { console.log(`[skip] save file ${SAVE_FILE} not found — fresh game.`); return; }
  await restoreSave();
  console.log(`[done] landed at checkpoint ${SAVE_FILE}. In the game tab click "读取存档" to enter; switch to iPhone 14 Pro Max viewport before playing.`);
})().catch(e => { console.error('[ERR]', e.message); process.exit(1); });
