/**
 * play-game.js — Playwright 游戏控制器
 * 用法：node scripts/play-game.js  （后台运行）
 * 通信：promo/cmd.json → 执行 → promo/shot.png + promo/result.json
 * 命令格式：
 *   {"action":"screenshot"}
 *   {"action":"click","x":100,"y":200}
 *   {"action":"clickText","text":"开始游戏"}
 *   {"action":"clickSel","selector":"#btn-start"}
 *   {"action":"wait","ms":1500}
 *   {"action":"eval","code":"State.save()"}
 *   {"action":"loadSave","file":"playtest/save-qixuan.json"}
 *   {"action":"scroll","y":300}
 *   {"action":"quit"}
 */
const { chromium } = require("playwright");
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CMD_FILE = path.join(ROOT, 'promo', 'cmd.json');
const SHOT_FILE = path.join(ROOT, 'promo', 'shot.png');
const RESULT_FILE = path.join(ROOT, 'promo', 'result.json');
const PROFILE_DIR = path.join(ROOT, 'promo', 'browser-profile');
const SERVER = 'http://localhost:3000';

fs.mkdirSync(path.join(ROOT, 'promo'), { recursive: true });
fs.mkdirSync(path.dirname(SHOT_FILE), { recursive: true });

(async () => {
  const browser = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: true,
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  });
  const page = browser.pages()[0] || await browser.newPage();
  await page.goto(SERVER, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  console.log('Browser opened at ' + SERVER);

  // 清除命令文件
  try { fs.unlinkSync(CMD_FILE); } catch(e) {}

  let running = true;
  while (running) {
    // 等待命令文件出现
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
          await new Promise(r => setTimeout(r, cmd.delay || 800));
          await page.screenshot({ path: SHOT_FILE, fullPage: false });
          result.msg = `clicked (${cmd.x},${cmd.y})`;
          break;

        case 'clickText': {
          // 尝试多种方式找到包含文本的可点击元素
          const el = await page.evaluateHandle((text) => {
            const all = [...document.querySelectorAll('*')];
            // 精确匹配
            let found = all.find(e => e.textContent.trim() === text && e.offsetParent !== null);
            if (found) return found;
            // 包含匹配（最短匹配优先）
            found = all.filter(e => e.textContent.includes(text) && e.offsetParent !== null && e.children.length === 0)
                        .sort((a,b) => a.textContent.length - b.textContent.length)[0];
            return found || null;
          }, cmd.text);
          if (el && await el.asElement()) {
            await el.asElement().click();
            await new Promise(r => setTimeout(r, cmd.delay || 800));
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
          await new Promise(r => setTimeout(r, cmd.delay || 800));
          await page.screenshot({ path: SHOT_FILE, fullPage: false });
          result.msg = `clicked selector "${cmd.selector}"`;
          break;

        case 'wait':
          await new Promise(r => setTimeout(r, cmd.ms));
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

        case 'loadSave': {
          const saveData = fs.readFileSync(path.join(ROOT, cmd.file), 'utf8');
          await page.evaluate((data) => {
            localStorage.setItem('frxxz_save_v1', data);
          }, saveData);
          await page.reload({ waitUntil: 'networkidle' });
          await new Promise(r => setTimeout(r, 1000));
          await page.screenshot({ path: SHOT_FILE, fullPage: false });
          result.msg = `loaded save: ${cmd.file}`;
          break;
        }

        case 'scroll':
          await page.evaluate((y) => window.scrollBy(0, y), cmd.y);
          await new Promise(r => setTimeout(r, 500));
          await page.screenshot({ path: SHOT_FILE, fullPage: false });
          result.msg = `scrolled ${cmd.y}`;
          break;

        case 'html': {
          const html = await page.content();
          result.html = html.substring(0, 5000);
          await page.screenshot({ path: SHOT_FILE, fullPage: false });
          result.msg = 'html captured';
          break;
        }

        case 'advance': {
          // 自动推进剧情：反复点击叙事区域，收集所有文字
          // 遇到选择按钮时停下，返回选项
          // cmd.maxClicks: 最多点击次数（默认20）
          // cmd.dir: 截图保存目录（默认 promo/raw）
          const maxClicks = cmd.maxClicks || 20;
          const dir = cmd.dir || 'raw';
          const shotDir = path.join(ROOT, 'promo', dir);
          fs.mkdirSync(shotDir, { recursive: true });
          const log = [];
          for (let i = 0; i < maxClicks; i++) {
            // 读取当前画面文字
            const text = await page.evaluate(() => {
              const lines = [...document.querySelectorAll('.story-line,.choice,button')];
              return lines.filter(e => e.offsetParent !== null && e.textContent.trim())
                          .map(e => (e.className || e.tagName) + ': ' + e.textContent.trim().substring(0, 300))
                          .join('\n');
            });
            // 检查是否有选择按钮
            const hasChoice = await page.evaluate(() => {
              const c = document.querySelector('.choice');
              return c && c.offsetParent !== null;
            });
            // 截图
            const shotPath = path.join(shotDir, `frame_${String(i).padStart(3,'0')}.png`);
            await page.screenshot({ path: shotPath, fullPage: false });
            log.push({ frame: i, text, hasChoice, shot: `promo/${dir}/frame_${String(i).padStart(3,'0')}.png` });
            if (hasChoice) {
              result.msg = `stopped at choice (frame ${i})`;
              break;
            }
            // 点击叙事区域推进
            const pos = await page.evaluate(() => {
              const el = document.querySelector('.story-text') || document.querySelector('.story-line');
              if (!el) return null;
              const r = el.getBoundingClientRect();
              return { x: r.left + r.width/2, y: r.top + r.height/2 };
            });
            if (!pos) { result.msg = `no story element at frame ${i}`; break; }
            await page.mouse.click(pos.x, pos.y);
            await new Promise(r => setTimeout(r, 1200));
            // 检查文字是否变化（如果没变，可能剧情结束或需要其他操作）
            const newText = await page.evaluate(() => {
              const lines = [...document.querySelectorAll('.story-line')];
              return lines.filter(e => e.offsetParent !== null && e.textContent.trim())
                          .map(e => e.textContent.trim()).join('');
            });
            if (newText === log[log.length-1].text?.replace(/^(story-line narr|story-line|narr):\s*/,'').split('\n')[0]) {
              // 文字没变，可能需要点击别的地方
              log.push({ frame: i+1, note: 'text unchanged, trying click elsewhere' });
            }
            if (i === maxClicks - 1) result.msg = `reached max clicks (${maxClicks})`;
          }
          result.log = log;
          // 最后截一张到主 shot.png
          await page.screenshot({ path: SHOT_FILE, fullPage: false });
          break;
        }

        case 'choose': {
          // 点击选择按钮（index 默认 0）
          const idx = cmd.index || 0;
          const choices = await page.$$('.choice');
          if (choices[idx]) {
            await choices[idx].click();
            await new Promise(r => setTimeout(r, cmd.delay || 2000));
            await page.screenshot({ path: SHOT_FILE, fullPage: false });
            result.msg = `chose option ${idx}`;
          } else {
            result.ok = false;
            result.msg = `no choice at index ${idx}`;
          }
          break;
        }

        case 'grind': {
          // 自动闭关+突破到指定境界
          // cmd.targetRealm: 目标 realmIndex（默认3=练气四层）
          // cmd.maxRounds: 最大循环次数（默认30）
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
            if (st.pe) { result.msg = `event triggered at round ${round}: ${st.pe}`; break; }

            // 切到行动面板
            await page.evaluate(() => {
              const mtab = [...document.querySelectorAll('.mtab')].find(t => t.textContent.includes('行动'));
              if (mtab) mtab.click();
            });
            await new Promise(r => setTimeout(r, 500));

            // 点闭关修炼
            await page.evaluate(() => {
              const bg = [...document.querySelectorAll('.btn-action')].find(b => b.textContent.includes('闭关'));
              if (bg) bg.click();
            });
            await new Promise(r => setTimeout(r, 500));

            // 选闭关一年
            await page.evaluate(() => {
              const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('闭关一年') && x.offsetParent !== null);
              if (b) b.click();
            });
            await new Promise(r => setTimeout(r, 2500));

            // 检查是否需要突破
            const needBreakthrough = await page.evaluate(() => {
              const b = [...document.querySelectorAll('.btn-action')].find(x => x.textContent.includes('突破'));
              if (b) { b.click(); return true; }
              return false;
            });
            if (needBreakthrough) {
              await new Promise(r => setTimeout(r, 800));
              // 点顺势冲关
              await page.evaluate(() => {
                const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('顺势冲关') && x.offsetParent !== null);
                if (b) b.click();
              });
              await new Promise(r => setTimeout(r, 2000));
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

    // 写结果，删命令文件
    fs.writeFileSync(RESULT_FILE, JSON.stringify(result, null, 2));
    try { fs.unlinkSync(CMD_FILE); } catch(e) {}
    console.log(`[${result.action}] ${result.ok ? 'OK' : 'FAIL'}: ${result.msg}`);
  }

  await browser.close();
  console.log('Browser closed.');
})();
