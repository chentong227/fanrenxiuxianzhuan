/**
 * play6.js — 持久化有头浏览器控制器
 * 浏览器窗口保持打开，支持连续命令、截图、录屏
 * 
 * 用法：
 *   node scripts/play6.js start          — 启动浏览器（窗口可见）
 *   node scripts/play6.js cmd <action> [args]  — 发送命令
 *   node scripts/play6.js shot [name]    — 截图保存到 promo/raw/
 *   node scripts/play6.js stop           — 关闭浏览器
 * 
 * 命令通过 promo/pcmd.json 传递，结果通过 promo/presult.json 返回
 * 浏览器进程持续运行，直到 stop 或手动关闭
 */
const { chromium } = require("playwright");
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SHOT_FILE = path.join(ROOT, 'promo', 'shot.png');
const SAVE_FILE = path.join(ROOT, 'promo', 'gamesave.json');
const CMD_FILE = path.join(ROOT, 'promo', 'pcmd.json');
const RESULT_FILE = path.join(ROOT, 'promo', 'presult.json');
const RAW_DIR = path.join(ROOT, 'promo', 'raw');
const SERVER = 'http://localhost:3000';
const LOCK_FILE = path.join(ROOT, 'promo', 'play6.lock');

fs.mkdirSync(RAW_DIR, { recursive: true });

const mode = process.argv[2] || 'start';

// --- 启动模式：持久化浏览器 ---
if (mode === 'start') {
  (async () => {
    // 检查是否已在运行
    if (fs.existsSync(LOCK_FILE)) {
      const pid = fs.readFileSync(LOCK_FILE, 'utf8').trim();
      try {
        process.kill(parseInt(pid), 0);
        console.log('Browser already running (PID ' + pid + ')');
        return;
      } catch(e) { /* 进程不存在，继续启动 */ }
    }

    const browser = await chromium.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const context = await browser.newContext({
      viewport: { width: 430, height: 932 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      // recordVideo: { dir: path.join(ROOT, 'promo', 'videos'), size: { width: 430, height: 932 } },
    });

    // 注入存档
    let saveJson = null;
    if (fs.existsSync(SAVE_FILE)) saveJson = fs.readFileSync(SAVE_FILE, 'utf8');
    if (saveJson) {
      await context.addInitScript((data) => { try { localStorage.setItem('frxxz_save_v1', data); } catch(e) {} }, saveJson);
    }

    const page = await context.newPage();
    await page.goto(SERVER, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // 加载存档
    if (saveJson) {
      await page.evaluate(() => {
        if (typeof State !== 'undefined' && State.hasSave()) {
          State.load();
          if (typeof Main !== 'undefined') Main.enterGame();
          if (State.data && State.data.pendingEvent) {
            const stage = STORY.find(st => st.id === State.data.pendingEvent);
            if (stage && typeof UI !== 'undefined') { try { UI.renderStory(stage); } catch(e) {} }
          }
        }
      });
      await page.waitForTimeout(1000);
    }

    // 写入 PID 锁
    fs.writeFileSync(LOCK_FILE, String(process.pid));

    // 初始截图
    await page.screenshot({ path: SHOT_FILE, fullPage: false });
    fs.writeFileSync(RESULT_FILE, JSON.stringify({ ok: true, msg: 'browser started', pid: process.pid }));
    console.log('Browser started (PID ' + process.pid + ') — window visible, video recording enabled');

    // 命令轮询循环
    let lastCmdTime = 0;
    let cmdCount = 0;
    const pollInterval = setInterval(async () => {
      try {
        if (!fs.existsSync(CMD_FILE)) return;
        const stat = fs.statSync(CMD_FILE);
        if (stat.mtimeMs <= lastCmdTime) return;
        lastCmdTime = stat.mtimeMs;

        const cmd = JSON.parse(fs.readFileSync(CMD_FILE, 'utf8'));
        cmdCount++;
        const result = { ok: true, cmdId: cmdCount, time: new Date().toISOString() };

        try {
          switch (cmd.action) {
            case 'screenshot':
              await page.screenshot({ path: SHOT_FILE, fullPage: false });
              if (cmd.name) fs.copyFileSync(SHOT_FILE, path.join(RAW_DIR, cmd.name + '.png'));
              result.msg = 'screenshot saved';
              break;

            case 'eval':
              result.value = await page.evaluate(cmd.code);
              if (cmd.screenshot !== false) {
                await page.screenshot({ path: SHOT_FILE, fullPage: false });
                if (cmd.name) fs.copyFileSync(SHOT_FILE, path.join(RAW_DIR, cmd.name + '.png'));
              }
              break;

            case 'click':
              if (cmd.selector) {
                const e = await page.$(cmd.selector);
                if (e) { await e.click(); await page.waitForTimeout(cmd.wait || 1000); result.msg = 'clicked: ' + cmd.selector; }
                else { result.ok = false; result.msg = 'not found: ' + cmd.selector; }
              } else {
                const e = await page.$('text=' + cmd.text);
                if (e) { await e.click(); await page.waitForTimeout(cmd.wait || 1000); result.msg = 'clicked: ' + cmd.text; }
                else { result.ok = false; result.msg = 'not found: ' + cmd.text; }
              }
              await page.screenshot({ path: SHOT_FILE, fullPage: false });
              if (cmd.name) fs.copyFileSync(SHOT_FILE, path.join(RAW_DIR, cmd.name + '.png'));
              break;

            case 'clickText':
              const elHandle = await page.evaluateHandle((text) => {
                const all = [...document.querySelectorAll('button,.btn,.choice,.mtab,[onclick],.spell-btn')];
                return all.find(e => e.offsetParent !== null && e.textContent.includes(text));
              }, cmd.text);
              const elElem = elHandle.asElement();
              if (elElem) { await elElem.click(); await page.waitForTimeout(cmd.wait || 1000); result.msg = 'clicked: ' + cmd.text; }
              else { result.ok = false; result.msg = 'not found: ' + cmd.text; }
              await page.screenshot({ path: SHOT_FILE, fullPage: false });
              if (cmd.name) fs.copyFileSync(SHOT_FILE, path.join(RAW_DIR, cmd.name + '.png'));
              break;

            case 'save':
              const save = await page.evaluate(() => { try { if (State.data) { State.save(); return localStorage.getItem('frxxz_save_v1'); } } catch(e) {} return null; });
              if (save) { fs.writeFileSync(SAVE_FILE, save); result.msg = 'saved'; }
              else { result.ok = false; result.msg = 'no save'; }
              break;

            case 'status':
              result.value = await page.evaluate(() => JSON.stringify({
                stage: State.data.storyStage, pending: State.data.pendingEvent,
                loc: State.data.location, name: State.data.name,
                realm: State.realm().name, year: State.data.year, month: State.data.month,
                cult: State.data.cultivation, hp: State.data.hp + '/' + State.data.hpMax,
                combat: !!State.data.combat
              }));
              break;

            case 'text':
              result.value = await page.evaluate(() =>
                [...document.querySelectorAll('.story-line,.narr,.choice,button,.scene-line,.story-speaker,.tc-title,.loc-name,.btn-action')]
                  .filter(e => e.offsetParent !== null && e.textContent.trim())
                  .map(e => (e.className || e.tagName) + ': ' + e.textContent.trim().substring(0, 300))
                  .join('\n')
              );
              break;

            // 真实点击：推进剧情对话（点击 #story-dialog）
            case 'tap': {
              try {
                const h = await page.evaluateHandle(() => document.getElementById('story-dialog'));
                const e = h.asElement();
                if (e) { await e.click(); await page.waitForTimeout(cmd.wait || 1500); result.msg = 'tapped dialog'; }
                else { result.ok = false; result.msg = 'tap: #story-dialog not found'; }
              } catch(e) {
                result.ok = false;
                result.msg = 'tap failed: ' + e.message;
              }
              await page.screenshot({ path: SHOT_FILE, fullPage: false });
              if (cmd.name) fs.copyFileSync(SHOT_FILE, path.join(RAW_DIR, cmd.name + '.png'));
              break;
            }

            // 真实点击：行动按钮（data-action）
            case 'tapAction': {
              try {
                const sel = `[data-action="${cmd.act}"]`;
                const e = await page.$(sel);
                if (e) { await e.click(); await page.waitForTimeout(cmd.wait || 1500); result.msg = 'clicked action: ' + cmd.act; }
                else { result.ok = false; result.msg = 'tapAction: not found ' + cmd.act; }
              } catch(e) {
                result.ok = false;
                result.msg = 'tapAction failed: ' + e.message;
              }
              await page.screenshot({ path: SHOT_FILE, fullPage: false });
              if (cmd.name) fs.copyFileSync(SHOT_FILE, path.join(RAW_DIR, cmd.name + '.png'));
              break;
            }

            // 真实点击：选项按钮（.choice）
            case 'tapChoice': {
              try {
                const idx = parseInt(cmd.index || '0', 10);
                const choices = await page.$$('.choice');
                if (choices.length > idx) {
                  await choices[idx].click();
                  await page.waitForTimeout(cmd.wait || 2000);
                  result.msg = 'clicked choice ' + idx;
                } else {
                  result.ok = false;
                  result.msg = `choice ${idx} not found (only ${choices.length} choices)`;
                }
              } catch(e) {
                result.ok = false;
                result.msg = 'tapChoice failed: ' + e.message;
              }
              await page.screenshot({ path: SHOT_FILE, fullPage: false });
              if (cmd.name) fs.copyFileSync(SHOT_FILE, path.join(RAW_DIR, cmd.name + '.png'));
              break;
            }

            // 真实点击：跳过剧情
            case 'tapSkip': {
              try {
                await page.click('#story-skip', { timeout: 3000 });
                await page.waitForTimeout(cmd.wait || 1500);
                result.msg = 'clicked skip';
              } catch(e) {
                result.ok = false;
                result.msg = 'tapSkip failed: ' + e.message;
              }
              await page.screenshot({ path: SHOT_FILE, fullPage: false });
              if (cmd.name) fs.copyFileSync(SHOT_FILE, path.join(RAW_DIR, cmd.name + '.png'));
              break;
            }

            // 真实点击：底部导航标签
            case 'tapTab': {
              try {
                const e = await page.$(`[data-tab] >> text=${cmd.text || cmd.tab}`);
                if (e) {
                  await e.click();
                  await page.waitForTimeout(cmd.wait || 1000);
                  result.msg = 'clicked tab: ' + (cmd.text || cmd.tab);
                } else {
                  result.ok = false;
                  result.msg = 'tab not found: ' + (cmd.text || cmd.tab);
                }
              } catch(e) {
                result.ok = false;
                result.msg = 'tapTab failed: ' + e.message;
              }
              await page.screenshot({ path: SHOT_FILE, fullPage: false });
              if (cmd.name) fs.copyFileSync(SHOT_FILE, path.join(RAW_DIR, cmd.name + '.png'));
              break;
            }

            // 真实点击：模态框内按钮（按文本匹配）
            case 'tapModal': {
              try {
                const elH = await page.evaluateHandle((text) => {
                  const modal = document.getElementById('modal-overlay') || document.querySelector('.modal');
                  if (!modal || modal.hidden) return null;
                  const btns = [...modal.querySelectorAll('button, .btn')];
                  return btns.find(e => e.offsetParent !== null && e.textContent.includes(text));
                }, cmd.text);
                const elE = elH.asElement();
                if (elE) {
                  await elE.click();
                  await page.waitForTimeout(cmd.wait || 2000);
                  result.msg = 'clicked modal: ' + cmd.text;
                } else {
                  result.ok = false;
                  result.msg = 'modal button not found: ' + cmd.text;
                }
              } catch(e) {
                result.ok = false;
                result.msg = 'tapModal failed: ' + e.message;
              }
              await page.screenshot({ path: SHOT_FILE, fullPage: false });
              if (cmd.name) fs.copyFileSync(SHOT_FILE, path.join(RAW_DIR, cmd.name + '.png'));
              break;
            }

            // 真实点击：战斗中的法术按钮
            case 'tapSpell': {
              try {
                const elH = await page.evaluateHandle((text) => {
                  const ov = document.getElementById('combat-overlay');
                  if (!ov) return null;
                  const btns = [...ov.querySelectorAll('button, .btn, .spell-btn')];
                  return btns.find(e => e.offsetParent !== null && e.textContent.includes(text));
                }, cmd.text);
                const elE = elH.asElement();
                if (elE) {
                  await elE.click();
                  await page.waitForTimeout(cmd.wait || 1000);
                  result.msg = 'clicked spell: ' + cmd.text;
                } else {
                  result.ok = false;
                  result.msg = 'spell not found: ' + cmd.text;
                }
              } catch(e) {
                result.ok = false;
                result.msg = 'tapSpell failed: ' + e.message;
              }
              await page.screenshot({ path: SHOT_FILE, fullPage: false });
              if (cmd.name) fs.copyFileSync(SHOT_FILE, path.join(RAW_DIR, cmd.name + '.png'));
              break;
            }

            // 真实点击：结束回合
            case 'tapEndRound': {
              try {
                await page.click('#combat-endround', { timeout: 3000 });
                await page.waitForTimeout(cmd.wait || 2000);
                result.msg = 'clicked end round';
              } catch(e) {
                result.ok = false;
                result.msg = 'tapEndRound failed: ' + e.message;
              }
              await page.screenshot({ path: SHOT_FILE, fullPage: false });
              if (cmd.name) fs.copyFileSync(SHOT_FILE, path.join(RAW_DIR, cmd.name + '.png'));
              break;
            }

            // 关闭模态框
            case 'closeModal': {
              try {
                await page.click('#modal-overlay', { timeout: 3000 });
                await page.waitForTimeout(cmd.wait || 500);
                result.msg = 'closed modal';
              } catch(e) {
                result.ok = false;
                result.msg = 'closeModal failed: ' + e.message;
              }
              await page.screenshot({ path: SHOT_FILE, fullPage: false });
              if (cmd.name) fs.copyFileSync(SHOT_FILE, path.join(RAW_DIR, cmd.name + '.png'));
              break;
            }

            case 'advance': {
              const maxSteps = parseInt(cmd.maxSteps || '15', 10);
              result.value = await page.evaluate(async (max) => {
                if (UI._story && UI._story.titling) {
                  const card = document.getElementById('story-titlecard');
                  if (card) card.classList.remove('show');
                  UI._story.titling = false;
                  UI.storyAdvance();
                  await new Promise(r => setTimeout(r, 800));
                }
                const results = [];
                for (let i = 0; i < max; i++) {
                  try { State.save(); } catch(e) {}
                  const choices = [...document.querySelectorAll('.choice')].filter(c => c.offsetParent !== null && c.textContent.trim());
                  if (choices.length > 0) {
                    results.push({ step: i, type: 'choice', choices: choices.map(c => c.textContent.trim().substring(0, 100)) });
                    break;
                  }
                  if (UI._story && UI._story.typing) { UI._typeFinish(); await new Promise(r => setTimeout(r, 300)); }
                  try { UI.storyAdvance(); } catch(e) { results.push({ step: i, type: 'error', msg: e.message }); break; }
                  await new Promise(r => setTimeout(r, 800));
                  const line = document.querySelector('.story-line');
                  const speaker = document.querySelector('.story-speaker');
                  const text = (speaker ? speaker.textContent.trim() + ': ' : '') + (line ? line.textContent.trim() : '');
                  results.push({ step: i, type: 'text', text: text.substring(0, 200) });
                }
                return JSON.stringify(results);
              }, maxSteps);
              await page.screenshot({ path: SHOT_FILE, fullPage: false });
              if (cmd.name) fs.copyFileSync(SHOT_FILE, path.join(RAW_DIR, cmd.name + '.png'));
              break;
            }

            case 'choose': {
              const idx = parseInt(cmd.index || '0', 10);
              // 用 UI.storyChoose 走完整选路逻辑（隐藏 overlay、清理 story、调用 Engine.chooseStory）
              await page.evaluate((i) => {
                if (UI._story) { UI.storyChoose(i); return 'storyChoose done'; }
                // fallback：没有 _story 时手动走
                const stage = STORY[State.data.storyStage];
                if (!stage || !stage.choices || i >= stage.choices.length) return 'invalid choice';
                const choice = stage.choices[i];
                if (choice.effect) { try { const r = choice.effect(State.data) || {}; if (r.text) Engine.log(r.text, r.kind || 'event'); } catch(e) {} }
                State.data.pendingEvent = null;
                State.data.storyStage += 1;
                if (choice.next === 'end') { Engine.endArc(); return 'end arc'; }
                // 隐藏 overlay
                var ov = document.getElementById('story-overlay');
                if (ov) ov.hidden = true;
                document.body.classList.remove('story-on');
                UI._story = null;
                State.save();
                try { UI.renderAll(); } catch(e) {}
                try { Engine.checkStory(); } catch(e) { return 'checkStory err: ' + e.message; }
                return 'ok: stage=' + State.data.storyStage + ' pending=' + State.data.pendingEvent;
              }, idx);
              await page.waitForTimeout(1500);
              // 读取结果状态
              result.value = await page.evaluate(() => 'ok: stage=' + State.data.storyStage + ' pending=' + State.data.pendingEvent);
              await page.screenshot({ path: SHOT_FILE, fullPage: false });
              if (cmd.name) fs.copyFileSync(SHOT_FILE, path.join(RAW_DIR, cmd.name + '.png'));
              break;
            }

            case 'stop':
              clearInterval(pollInterval);
              fs.unlinkSync(LOCK_FILE);
              await page.screenshot({ path: SHOT_FILE, fullPage: false });
              // 保存存档
              try {
                const s = await page.evaluate(() => { try { if (State.data) { State.save(); return localStorage.getItem('frxxz_save_v1'); } } catch(e) {} return null; });
                if (s) fs.writeFileSync(SAVE_FILE, s);
              } catch(e) {}
              result.msg = 'stopping';
              fs.writeFileSync(RESULT_FILE, JSON.stringify(result));
              await browser.close();
              console.log('Browser stopped');
              process.exit(0);

            default:
              result.ok = false;
              result.msg = 'unknown action: ' + cmd.action;
          }
        } catch(e) {
          result.ok = false;
          result.msg = e.message;
          try { await page.screenshot({ path: SHOT_FILE, fullPage: false }); } catch(e2) {}
        }

        fs.writeFileSync(RESULT_FILE, JSON.stringify(result));
      } catch(e) {
        // 命令解析失败
        fs.writeFileSync(RESULT_FILE, JSON.stringify({ ok: false, msg: e.message }));
      }
    }, 500);

    // 浏览器关闭时清理
    browser.on('disconnected', () => {
      clearInterval(pollInterval);
      try { fs.unlinkSync(LOCK_FILE); } catch(e) {}
      console.log('Browser closed');
      process.exit(0);
    });

    console.log('Polling for commands in promo/pcmd.json...');
  })();

} else if (mode === 'cmd' || mode === 'shot' || mode === 'stop') {
  // --- 命令模式：写入命令文件，等待结果 ---
  let cmd = {};
  
  if (mode === 'shot') {
    cmd = { action: 'screenshot', name: process.argv[3] };
  } else if (mode === 'stop') {
    cmd = { action: 'stop' };
  } else {
    const action = process.argv[3] || 'status';
    cmd = { action };
    if (action === 'eval') cmd.code = process.argv[4];
    if (action === 'clickText') cmd.text = process.argv[4];
    if (action === 'advance') cmd.maxSteps = process.argv[4] || '15';
    if (action === 'choose') cmd.index = process.argv[4] || '0';
    if (action === 'screenshot') cmd.name = process.argv[4];
    // 最后一个参数如果是 name=xxx 格式，作为截图名
    const lastArg = process.argv[process.argv.length - 1];
    if (lastArg && lastArg.startsWith('name=')) {
      cmd.name = lastArg.substring(5);
    }
  }

  fs.writeFileSync(CMD_FILE, JSON.stringify(cmd));

  // 等待结果
  const waitMs = cmd.action === 'advance' ? (parseInt(cmd.maxSteps || '15') * 1000 + 5000) : 10000;
  setTimeout(() => {
    try {
      const r = JSON.parse(fs.readFileSync(RESULT_FILE, 'utf8'));
      if (r.value !== undefined) {
        try {
          const parsed = JSON.parse(r.value);
          if (Array.isArray(parsed)) {
            parsed.forEach(item => {
              if (item.type === 'choice') console.log(`[step ${item.step}] CHOICE: ${item.choices.join(' | ')}`);
              else if (item.type === 'text') console.log(`[step ${item.step}] ${item.text}`);
              else if (item.err) console.log(`[month ${item.i}] ERROR: ${item.err}`);
              else if (item.msg) console.log(`[month ${item.i}] ${item.msg}`);
              else if (item.year) console.log(`[month ${item.i}] ${item.year}.${item.month} | ${item.realm} | stage=${item.stage} | pending=${item.pending} | cult=${item.cult}`);
              else console.log(`[step ${item.step}] ${JSON.stringify(item)}`);
            });
          } else {
            console.log(JSON.stringify(parsed, null, 2));
          }
        } catch(e2) { console.log(r.value); }
      } else {
        console.log(JSON.stringify(r, null, 2));
      }
    } catch(e) { console.log('No result: ' + e.message); }
  }, waitMs);

} else {
  console.log('Usage: node scripts/play6.js [start|cmd <action> [args]|shot [name]|stop]');
  console.log('Actions: screenshot, eval <code>, clickText <text>, advance [maxSteps], choose [index], save, status, text, stop');
}
