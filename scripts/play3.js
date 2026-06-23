/**
 * play3.js — 单次执行版 Playwright 控制器
 * 每次调用独立启动浏览器、执行一个命令、截图、退出
 * 用法：node scripts/play3.js <action> [args...]
 *   node scripts/play3.js screenshot
 *   node scripts/play3.js click 100 200
 *   node scripts/play3.js clickText "踏入此界"
 *   node scripts/play3.js eval "State.data.storyStage"
 *   node scripts/play3.js text
 *   node scripts/play3.js save
 *   node scripts/play3.js load playtest/save-xxx.json
 * 
 * 状态保存在 promo/state.json（localStorage 快照）
 */
const { chromium } = require("playwright");
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SHOT_FILE = path.join(ROOT, 'promo', 'shot.png');
const STATE_FILE = path.join(ROOT, 'promo', 'state.json');
const SERVER = 'http://localhost:3000';

fs.mkdirSync(path.join(ROOT, 'promo'), { recursive: true });

const action = process.argv[2] || 'screenshot';
const args = process.argv.slice(3);

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  });

  // 恢复 localStorage 状态
  if (fs.existsSync(STATE_FILE)) {
    await context.addInitScript((stateJson) => {
      try {
        const items = JSON.parse(stateJson);
        for (const [k, v] of Object.entries(items)) {
          localStorage.setItem(k, v);
        }
      } catch(e) {}
    }, fs.readFileSync(STATE_FILE, 'utf8'));
  }

  const page = await context.newPage();
  await page.goto(SERVER, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  const result = { ok: true, action, time: new Date().toISOString() };

  try {
    switch (action) {
      case 'screenshot':
        await page.screenshot({ path: SHOT_FILE, fullPage: false });
        result.msg = 'screenshot saved';
        break;

      case 'click': {
        const x = parseInt(args[0], 10);
        const y = parseInt(args[1], 10);
        await page.mouse.click(x, y);
        await page.waitForTimeout(1500);
        await page.screenshot({ path: SHOT_FILE, fullPage: false });
        result.msg = `clicked (${x},${y})`;
        break;
      }

      case 'clickText': {
        const text = args[0];
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
          await page.waitForTimeout(2000);
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
        const sel = args[0];
        await page.click(sel);
        await page.waitForTimeout(2000);
        await page.screenshot({ path: SHOT_FILE, fullPage: false });
        result.msg = `clicked selector "${sel}"`;
        break;
      }

      case 'eval': {
        const code = args[0];
        const val = await page.evaluate(code);
        result.msg = 'eval done';
        result.value = val;
        await page.screenshot({ path: SHOT_FILE, fullPage: false });
        break;
      }

      case 'text': {
        const text = await page.evaluate(() => {
          const lines = [...document.querySelectorAll('.story-line,.narr,.choice,button,.btn,h1,h2,h3,p,span,.npc-name,.loc-name')];
          return lines.filter(e => e.offsetParent !== null && e.textContent.trim())
                      .map(e => (e.className || e.tagName) + ': ' + e.textContent.trim().substring(0, 500))
                      .join('\n');
        });
        result.text = text;
        result.msg = 'text captured';
        await page.screenshot({ path: SHOT_FILE, fullPage: false });
        break;
      }

      case 'save': {
        const state = await page.evaluate(() => {
          const items = {};
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            items[k] = localStorage.getItem(k);
          }
          return items;
        });
        fs.writeFileSync(STATE_FILE, JSON.stringify(state));
        result.msg = 'state saved';
        await page.screenshot({ path: SHOT_FILE, fullPage: false });
        break;
      }

      case 'load': {
        // load save file into localStorage before navigation
        const saveFile = args[0];
        const saveData = fs.readFileSync(path.join(ROOT, saveFile), 'utf8');
        await page.evaluate((data) => {
          localStorage.setItem('frxxz_save_v1', data);
        }, saveData);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);
        await page.screenshot({ path: SHOT_FILE, fullPage: false });
        result.msg = `loaded save: ${saveFile}`;
        break;
      }

      case 'html': {
        const html = await page.content();
        result.html = html.substring(0, 8000);
        result.msg = 'html captured';
        break;
      }

      case 'scroll': {
        const y = parseInt(args[0], 10) || 300;
        await page.evaluate((yv) => window.scrollBy(0, yv), y);
        await page.waitForTimeout(500);
        await page.screenshot({ path: SHOT_FILE, fullPage: false });
        result.msg = `scrolled ${y}`;
        break;
      }

      default:
        result.ok = false;
        result.msg = `unknown action: ${action}`;
    }
  } catch(e) {
    result.ok = false;
    result.msg = e.message;
    try { await page.screenshot({ path: SHOT_FILE, fullPage: false }); } catch(e2) {}
  }

  // 保存状态快照
  try {
    const state = await page.evaluate(() => {
      const items = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        items[k] = localStorage.getItem(k);
      }
      return items;
    });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state));
  } catch(e) {}

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
