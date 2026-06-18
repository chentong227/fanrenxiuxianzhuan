#!/usr/bin/env node
/*
 * playtest/savetool.js — sync the game save between this repo file and the
 * browser's localStorage, via the Chrome DevTools Protocol.
 *
 *   node playtest/savetool.js load [file]   repo JSON  -> localStorage frxxz_save_v1 -> reload page
 *   node playtest/savetool.js dump [file]   localStorage frxxz_save_v1 -> repo JSON (pretty, UTF-8)
 *
 * Zero external deps (the repo is build-less / dependency-free): a minimal
 * RFC6455 WebSocket client is implemented inline on top of node's `net`.
 *
 * Defaults (override via env):
 *   CDP_URL   = http://localhost:29229      Chrome remote-debugging endpoint
 *   file arg  = <this dir>/save-qixuan.json the checkpoint that travels with the repo
 *
 * The target page is auto-detected: the first http://127.0.0.1 / localhost page
 * (the locally-served game), falling back to the first non-chrome page.
 */
const http = require('http');
const net = require('net');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const MODE = process.argv[2] || 'dump';
const FILE = process.argv[3] || path.join(__dirname, 'save-qixuan.json');
const CDP_URL = process.env.CDP_URL || 'http://localhost:29229';
const KEY = 'frxxz_save_v1';

function getJSON(p) {
  return new Promise((resolve, reject) => {
    http.get(CDP_URL + p, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

// ---- minimal RFC6455 client (text frames only, client-masked) ----
function wsConnect(wsUrl) {
  return new Promise((resolve, reject) => {
    const u = new URL(wsUrl);
    const key = crypto.randomBytes(16).toString('base64');
    const sock = net.connect(u.port || 80, u.hostname, () => {
      sock.write(
        `GET ${u.pathname}${u.search} HTTP/1.1\r\n` +
        `Host: ${u.host}\r\n` +
        `Upgrade: websocket\r\nConnection: Upgrade\r\n` +
        `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`
      );
    });
    let handshook = false, buf = Buffer.alloc(0);
    const handlers = [];
    sock.on('error', reject);
    sock.on('data', chunk => {
      buf = Buffer.concat([buf, chunk]);
      if (!handshook) {
        const i = buf.indexOf('\r\n\r\n');
        if (i < 0) return;
        if (!/ 101 /.test(buf.slice(0, i).toString())) return reject(new Error('ws handshake failed'));
        handshook = true; buf = buf.slice(i + 4);
        resolve({
          send(obj) {
            const payload = Buffer.from(JSON.stringify(obj));
            const mask = crypto.randomBytes(4);
            const len = payload.length;
            let header;
            if (len < 126) header = Buffer.from([0x81, 0x80 | len]);
            else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 0x80 | 126; header.writeUInt16BE(len, 2); }
            else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 0x80 | 127; header.writeBigUInt64BE(BigInt(len), 2); }
            const masked = Buffer.alloc(len);
            for (let k = 0; k < len; k++) masked[k] = payload[k] ^ mask[k & 3];
            sock.write(Buffer.concat([header, mask, masked]));
          },
          onMessage(fn) { handlers.push(fn); },
          close() { try { sock.destroy(); } catch (e) {} }
        });
      }
      // parse as many complete frames as buffered (server frames are unmasked)
      for (;;) {
        if (buf.length < 2) break;
        const opcode = buf[0] & 0x0f;
        const len0 = buf[1] & 0x7f;
        let off = 2, plen = len0;
        if (len0 === 126) { if (buf.length < 4) break; plen = buf.readUInt16BE(2); off = 4; }
        else if (len0 === 127) { if (buf.length < 10) break; plen = Number(buf.readBigUInt64BE(2)); off = 10; }
        if (buf.length < off + plen) break;
        const payload = buf.slice(off, off + plen);
        buf = buf.slice(off + plen);
        if (opcode === 0x1 || opcode === 0x0) { // text or continuation
          try { handlers.forEach(fn => fn(payload.toString())); } catch (e) {}
        } // ignore ping/pong/close control frames
      }
    });
  });
}

(async () => {
  const targets = await getJSON('/json');
  const page = targets.find(t => t.type === 'page' && /(127\.0\.0\.1|localhost):\d+/.test(t.url) && !/github\.com/.test(t.url))
            || targets.find(t => t.type === 'page' && !/^chrome:\/\//.test(t.url) && !/github\.com/.test(t.url));
  if (!page) { console.error('no game page target — open the game (http://127.0.0.1:8011/) in the browser first'); process.exit(1); }

  const ws = await wsConnect(page.webSocketDebuggerUrl);
  let id = 0; const pend = {};
  ws.onMessage(txt => { let o; try { o = JSON.parse(txt); } catch (e) { return; } if (o.id && pend[o.id]) { pend[o.id](o.result); delete pend[o.id]; } });
  const send = (method, params) => new Promise(r => { const i = ++id; pend[i] = r; ws.send({ id: i, method, params: params || {} }); });

  await send('Runtime.enable');

  if (MODE === 'load') {
    const obj = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    const val = JSON.stringify(obj);
    const expr = `(function(){localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(val)}); return 'OK len='+${val.length};})()`;
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    console.log('SET', r && r.result && r.result.value, 'on', page.url);
    await send('Page.enable');
    await send('Page.reload', { ignoreCache: true });
    console.log('reloaded — click "读取存档" to enter the loaded state');
    setTimeout(() => { ws.close(); process.exit(0); }, 1200);
  } else {
    const r = await send('Runtime.evaluate', { expression: `localStorage.getItem(${JSON.stringify(KEY)})`, returnByValue: true });
    const val = r && r.result && r.result.value;
    if (!val) { console.error('no', KEY, 'in localStorage on', page.url, '— load + enter a game first'); process.exit(2); }
    const obj = JSON.parse(val);
    fs.writeFileSync(FILE, Buffer.from(JSON.stringify(obj, null, 2), 'utf8'));
    const d = obj.data || obj;
    console.log('DUMPED', val.length, 'chars ->', FILE);
    console.log('  storyStage', d.storyStage, '| loc', d.location, '| realm', d.realmIndex, '| cult', d.cultivation, '| y' + d.year + 'm' + d.month);
    ws.close(); process.exit(0);
  }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
