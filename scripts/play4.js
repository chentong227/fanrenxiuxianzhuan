/**
 * play4.js — 稳定版 Playwright 控制器（launch + storageState 持久化）
 * 通信：promo/cmd.json → promo/shot.png + promo/result.json
 * 状态：promo/storage.json（context storage state，含 localStorage）
 */
const { chromium } = require("playwright");
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CMD_FILE = path.join(ROOT, 'promo', 'cmd.json');
const SHOT_FILE = path.join(ROOT, 'promo', 'shot.png');
const RESULT_FILE = path.join(ROOT, 'promo', 'result.json');
const STORAGE_FILE = path.join(ROOT, 'promo', 'storage.json');
const SERVER = 'http://localhost:3000';

fs.mkdirSync(path.join(ROOT, 'promo'), { recursive: true });

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  // 恢复 storage state
  let storageState = undefined;
  if (fs.existsSync(STORAGE_FILE)) {
    try { storageState = JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf8')); } catch(e) {}
  }

  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    storageState,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  });

  // 注入：禁用 Fx 模块（WebGL canvas 在 headless 下崩溃）
  await context.addInitScript(() => {
    Object.defineProperty(window, 'Fx', { value: { ensure(){}, warm(){}, at(){return {x:0,y:0}}, launch(){}, strike(){}, burst(){}, fadeOut(){}, shake(){}, haptic(){} }, writable: false });
  });

  let page = await context.newPage();
  
  // 页面崩溃/关闭自动恢复
  async function reloadPage() {
    try { await page.close(); } catch(e) {}
    page = await context.newPage();
    await page.goto(SERVER, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    // 恢复游戏状态
    try {
      await page.evaluate(() => {
        if (typeof State !== 'undefined' && State.hasSave()) {
          State.load();
          if (typeof Main !== 'undefined') Main.enterGame();
          // 恢复 pendingEvent 的剧情卡
          if (State.data && State.data.pendingEvent) {
            const stage = STORY.find(st => st.id === State.data.pendingEvent);
            if (stage && typeof UI !== 'undefined') UI.renderStory(stage);
          }
        }
      });
    } catch(e) { console.log('Restore failed: ' + e.message); }
    console.log('Page reloaded and state restored');
  }
  page.on('crash', reloadPage);
  page.on('close', async () => {
    console.log('Page closed unexpectedly');
  });
  
  await page.goto(SERVER, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  console.log('Browser opened at ' + SERVER);

  // 保存 storage state（每次操作后都保存）
  async function saveState() {
    try {
      await page.waitForTimeout(500);
      await page.evaluate(() => { try { if (typeof State !== 'undefined' && State.data) State.save(); } catch(e) {} });
      const state = await context.storageState();
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(state));
    } catch(e) {}
  }

  try { fs.unlinkSync(CMD_FILE); } catch(e) {}

  let running = true;
  while (running) {
    await new Promise(r => setTimeout(r, 200));
    let cmd;
    try {
      cmd = JSON.parse(fs.readFileSync(CMD_FILE, 'utf8'));
    } catch(e) { continue; }

    let result = { ok: true, action: cmd.action, time: new Date().toISOString() };
    try {
      switch (cmd.action) {
        case 'screenshot':
          await page.screenshot({ path: SHOT_FILE, fullPage: false });
          result.msg = 'screenshot saved';
          break;

        case 'click': {
          await page.mouse.click(cmd.x, cmd.y);
          await page.waitForTimeout(cmd.delay || 1500);
          await page.screenshot({ path: SHOT_FILE, fullPage: false });
          result.msg = `clicked (${cmd.x},${cmd.y})`;
          break;
        }

        case 'clickText': {
          const text = cmd.text;
          const el = await page.evaluateHandle((t) => {
            const all = [...document.querySelectorAll('*')];
            let found = all.find(e => e.textContent.trim() === t && e.offsetParent !== null);
            if (found) return found;
            found = all.filter(e => e.textContent.includes(t) && e.offsetParent !== null && e.children.length === 0)
                        .sort((a,b) => a.textContent.length - b.textContent.length)[0];
            return found || null;
          }, text);
          if (el && await el.asElement()) {
            await el.asElement().click();
            await page.waitForTimeout(cmd.delay || 2000);
            await page.screenshot({ path: SHOT_FILE, fullPage: false });
            result.msg = `clicked text "${text}"`;
          } else {
            result.ok = false;
            result.msg = `text not found: "${text}"`;
            await page.screenshot({ path: SHOT_FILE, fullPage: false });
          }
          break;
        }

        case 'clickSel': {
          await page.click(cmd.selector);
          await page.waitForTimeout(cmd.delay || 2000);
          await page.screenshot({ path: SHOT_FILE, fullPage: false });
          result.msg = `clicked selector "${cmd.selector}"`;
          break;
        }

        case 'wait':
          await page.waitForTimeout(cmd.ms);
          await page.screenshot({ path: SHOT_FILE, fullPage: false });
          result.msg = `waited ${cmd.ms}ms`;
          break;

        case 'eval': {
          try {
            const val = await page.evaluate(cmd.code);
            result.msg = 'eval done';
            result.value = val;
            if (cmd.screenshot !== false) await page.screenshot({ path: SHOT_FILE, fullPage: false });
          } catch(evErr) {
            // 页面可能崩溃，尝试恢复
            if (String(evErr.message).includes('closed')) {
              await reloadPage();
              try {
                const val = await page.evaluate(cmd.code);
                result.msg = 'eval done (after reload)';
                result.value = val;
                if (cmd.screenshot !== false) await page.screenshot({ path: SHOT_FILE, fullPage: false });
              } catch(evErr2) {
                result.ok = false;
                result.msg = evErr2.message;
              }
            } else {
              throw evErr;
            }
          }
          break;
        }

        case 'text': {
          const text = await page.evaluate(() => {
            const lines = [...document.querySelectorAll('.story-line,.narr,.choice,button,.btn,h1,h2,h3,p,span,.npc-name,.loc-name,.sr-result,.sr-label,.hint,.subtitle,.title-seal')];
            return lines.filter(e => e.offsetParent !== null && e.textContent.trim())
                        .map(e => (e.className || e.tagName) + ': ' + e.textContent.trim().substring(0, 500))
                        .join('\n');
          });
          result.text = text;
          result.msg = 'text captured';
          await page.screenshot({ path: SHOT_FILE, fullPage: false });
          break;
        }

        case 'scroll': {
          await page.evaluate((y) => window.scrollBy(0, y), cmd.y);
          await page.waitForTimeout(500);
          await page.screenshot({ path: SHOT_FILE, fullPage: false });
          result.msg = `scrolled ${cmd.y}`;
          break;
        }

        case 'advance': {
          const maxClicks = cmd.maxClicks || 20;
          const dir = cmd.dir || 'raw';
          const shotDir = path.join(ROOT, 'promo', dir);
          fs.mkdirSync(shotDir, { recursive: true });
          const log = [];
          for (let i = 0; i < maxClicks; i++) {
            const text = await page.evaluate(() => {
              const lines = [...document.querySelectorAll('.story-line,.choice,button')];
              return lines.filter(e => e.offsetParent !== null && e.textContent.trim())
                          .map(e => (e.className || e.tagName) + ': ' + e.textContent.trim().substring(0, 300))
                          .join('\n');
            });
            const hasChoice = await page.evaluate(() => {
              const c = document.querySelector('.choice');
              return c && c.offsetParent !== null;
            });
            const shotPath = path.join(shotDir, `frame_${String(i).padStart(3,'0')}.png`);
            await page.screenshot({ path: shotPath, fullPage: false });
            log.push({ frame: i, text, hasChoice, shot: `promo/${dir}/frame_${String(i).padStart(3,'0')}.png` });
            if (hasChoice) { result.msg = `stopped at choice (frame ${i})`; break; }
            const pos = await page.evaluate(() => {
              const el = document.querySelector('.story-text') || document.querySelector('.story-line') || document.querySelector('.narr');
              if (!el) return null;
              const r = el.getBoundingClientRect();
              return { x: r.left + r.width/2, y: r.top + r.height/2 };
            });
            if (!pos) { result.msg = `no story element at frame ${i}`; break; }
            await page.mouse.click(pos.x, pos.y);
            await page.waitForTimeout(1500);
            if (i === maxClicks - 1) result.msg = `reached max clicks (${maxClicks})`;
          }
          result.log = log;
          await page.screenshot({ path: SHOT_FILE, fullPage: false });
          break;
        }

        case 'choose': {
          const idx = cmd.index || 0;
          const choices = await page.$$('.choice');
          if (choices[idx]) {
            await choices[idx].click();
            await page.waitForTimeout(cmd.delay || 2000);
            await page.screenshot({ path: SHOT_FILE, fullPage: false });
            result.msg = `chose option ${idx}`;
          } else {
            result.ok = false;
            result.msg = `no choice at index ${idx}`;
          }
          break;
        }

        case 'loadSave': {
          const saveData = fs.readFileSync(path.join(ROOT, cmd.file), 'utf8');
          await page.evaluate((data) => { localStorage.setItem('frxxz_save_v1', data); }, saveData);
          await page.reload({ waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(2000);
          await page.screenshot({ path: SHOT_FILE, fullPage: false });
          result.msg = `loaded save: ${cmd.file}`;
          break;
        }

        case 'save': {
          const save = await page.evaluate(() => localStorage.getItem('frxxz_save_v1'));
          result.save = save ? save.substring(0, 200) : null;
          result.msg = save ? 'save exists' : 'no save';
          break;
        }

        case 'reload': {
          await page.reload({ waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(2000);
          await page.screenshot({ path: SHOT_FILE, fullPage: false });
          result.msg = 'page reloaded';
          break;
        }

        case 'quit':
          running = false;
          result.msg = 'quitting';
          break;

        default:
          result.ok = false;
          result.msg = `unknown action: ${cmd.action}`;
      }
    } catch(e) {
      result.ok = false;
      result.msg = e.message;
      try { await page.screenshot({ path: SHOT_FILE, fullPage: false }); } catch(e2) {}
    }

    await saveState();
    fs.writeFileSync(RESULT_FILE, JSON.stringify(result, null, 2));
    try { fs.unlinkSync(CMD_FILE); } catch(e) {}
    console.log(`[${result.action}] ${result.ok ? 'OK' : 'FAIL'}: ${result.msg}`);
  }

  await browser.close();
  console.log('Browser closed.');
})();
