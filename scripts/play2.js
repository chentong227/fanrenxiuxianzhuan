/**
 * play2.js — 简化版 Playwright 控制器（无持久化 profile，避免崩溃）
 * 通信机制同 play-game.js：promo/cmd.json → promo/shot.png + promo/result.json
 */
const { chromium } = require("playwright");
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CMD_FILE = path.join(ROOT, 'promo', 'cmd.json');
const SHOT_FILE = path.join(ROOT, 'promo', 'shot.png');
const RESULT_FILE = path.join(ROOT, 'promo', 'result.json');
const SERVER = 'http://localhost:3000';

fs.mkdirSync(path.join(ROOT, 'promo'), { recursive: true });

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--disable-features=site-per-process', '--disable-web-security'],
  });
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  });
  let page = await context.newPage();
  // 页面崩溃时自动恢复
  page.on('crash', async () => {
    console.log('Page crashed, recreating...');
    try { await page.close(); } catch(e) {}
    page = await context.newPage();
    await page.goto(SERVER, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
  });
  await page.goto(SERVER, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  console.log('Browser opened at ' + SERVER);

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

        case 'click':
          await page.mouse.click(cmd.x, cmd.y);
          await page.waitForTimeout(cmd.delay || 800);
          await page.screenshot({ path: SHOT_FILE, fullPage: false });
          result.msg = `clicked (${cmd.x},${cmd.y})`;
          break;

        case 'clickText': {
          const el = await page.evaluateHandle((text) => {
            const all = [...document.querySelectorAll('*')];
            let found = all.find(e => e.textContent.trim() === text && e.offsetParent !== null);
            if (found) return found;
            found = all.filter(e => e.textContent.includes(text) && e.offsetParent !== null && e.children.length === 0)
                        .sort((a,b) => a.textContent.length - b.textContent.length)[0];
            return found || null;
          }, cmd.text);
          if (el && await el.asElement()) {
            await el.asElement().click();
            await page.waitForTimeout(cmd.delay || 800);
            await page.screenshot({ path: SHOT_FILE, fullPage: false });
            result.msg = `clicked text "${cmd.text}"`;
          } else {
            result.ok = false;
            result.msg = `text not found: "${cmd.text}"`;
          }
          break;
        }

        case 'clickSel':
          await page.click(cmd.selector);
          await page.waitForTimeout(cmd.delay || 800);
          await page.screenshot({ path: SHOT_FILE, fullPage: false });
          result.msg = `clicked selector "${cmd.selector}"`;
          break;

        case 'wait':
          await page.waitForTimeout(cmd.ms);
          await page.screenshot({ path: SHOT_FILE, fullPage: false });
          result.msg = `waited ${cmd.ms}ms`;
          break;

        case 'eval': {
          const val = await page.evaluate(cmd.code);
          result.msg = 'eval done';
          result.value = val;
          await page.screenshot({ path: SHOT_FILE, fullPage: false });
          break;
        }

        case 'scroll':
          await page.evaluate((y) => window.scrollBy(0, y), cmd.y);
          await page.waitForTimeout(500);
          await page.screenshot({ path: SHOT_FILE, fullPage: false });
          result.msg = `scrolled ${cmd.y}`;
          break;

        case 'html': {
          const html = await page.content();
          result.html = html.substring(0, 8000);
          result.msg = 'html captured';
          break;
        }

        case 'text': {
          const text = await page.evaluate(() => {
            const lines = [...document.querySelectorAll('.story-line,.narr,.choice,button,.btn,h1,h2,h3,p,span')];
            return lines.filter(e => e.offsetParent !== null && e.textContent.trim())
                        .map(e => (e.className || e.tagName) + ': ' + e.textContent.trim().substring(0, 500))
                        .join('\n');
          });
          result.text = text;
          result.msg = 'text captured';
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
            if (hasChoice) {
              result.msg = `stopped at choice (frame ${i})`;
              break;
            }
            const pos = await page.evaluate(() => {
              const el = document.querySelector('.story-text') || document.querySelector('.story-line') || document.querySelector('.narr');
              if (!el) return null;
              const r = el.getBoundingClientRect();
              return { x: r.left + r.width/2, y: r.top + r.height/2 };
            });
            if (!pos) { result.msg = `no story element at frame ${i}`; break; }
            await page.mouse.click(pos.x, pos.y);
            await page.waitForTimeout(1200);
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
          await page.evaluate((data) => {
            localStorage.setItem('frxxz_save_v1', data);
          }, saveData);
          await page.reload({ waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(1500);
          await page.screenshot({ path: SHOT_FILE, fullPage: false });
          result.msg = `loaded save: ${cmd.file}`;
          break;
        }

        case 'grind': {
          const targetRealm = cmd.targetRealm || 3;
          const maxRounds = cmd.maxRounds || 30;
          const grindLog = [];
          for (let round = 0; round < maxRounds; round++) {
            const state = await page.evaluate(() => JSON.stringify({
              ri: State.data.realmIndex, c: State.data.cultivation,
              pe: State.data.pendingEvent, y: State.data.year, m: State.data.month,
              realm: State.realm().name
            }));
            const st = JSON.parse(state);
            grindLog.push({ round, ...st });
            if (st.ri >= targetRealm) { result.msg = `reached target realm ${targetRealm} at round ${round}`; break; }
            if (st.pe) { result.msg = `event at round ${round}: ${st.pe}`; break; }

            await page.evaluate(() => {
              const mtab = [...document.querySelectorAll('.mtab')].find(t => t.textContent.includes('行动'));
              if (mtab) mtab.click();
            });
            await page.waitForTimeout(500);
            await page.evaluate(() => {
              const bg = [...document.querySelectorAll('.btn-action')].find(b => b.textContent.includes('闭关'));
              if (bg) bg.click();
            });
            await page.waitForTimeout(500);
            await page.evaluate(() => {
              const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('闭关一年') && x.offsetParent !== null);
              if (b) b.click();
            });
            await page.waitForTimeout(2500);
            const needBreakthrough = await page.evaluate(() => {
              const b = [...document.querySelectorAll('.btn-action')].find(x => x.textContent.includes('突破'));
              if (b) { b.click(); return true; }
              return false;
            });
            if (needBreakthrough) {
              await page.waitForTimeout(800);
              await page.evaluate(() => {
                const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('顺势冲关') && x.offsetParent !== null);
                if (b) b.click();
              });
              await page.waitForTimeout(2000);
            }
            if (round === maxRounds - 1) result.msg = `reached max rounds (${maxRounds})`;
          }
          result.grindLog = grindLog;
          await page.screenshot({ path: SHOT_FILE, fullPage: false });
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

    fs.writeFileSync(RESULT_FILE, JSON.stringify(result, null, 2));
    try { fs.unlinkSync(CMD_FILE); } catch(e) {}
    console.log(`[${result.action}] ${result.ok ? 'OK' : 'FAIL'}: ${result.msg}`);
  }

  await browser.close();
  console.log('Browser closed.');
})();
