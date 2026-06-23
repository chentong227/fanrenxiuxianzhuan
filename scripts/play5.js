/**
 * play5.js — 单次执行 + 手动存档注入
 * 每次调用：启动浏览器 → 注入存档 → 执行命令 → 保存存档 → 退出
 * 用法：node scripts/play5.js <action> [args...]
 * 存档：promo/gamesave.json（游戏 State.data 的 JSON）
 */
const { chromium } = require("playwright");
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SHOT_FILE = path.join(ROOT, 'promo', 'shot.png');
const SAVE_FILE = path.join(ROOT, 'promo', 'gamesave.json');
const SERVER = 'http://localhost:3000';

const STUBS = `
window.Fx={ensure(){},warm(){},at(){return{x:0,y:0}},launch(){},strike(){},burst(){},fadeOut(){},shake(){},haptic(){},glow(){},ring(){},beam(){},flash(){},ripple(){},particle(){},sparks(){},trail(){},slash(){},stab(){},crush(){},smash(){},sweep(){},ambient(){},motes(){},clear(){},detach(){}};
window.Cutscene={clear(){},resetCam(){},hasStaging(){return false},play(){},stop(){}};
`;

const action = process.argv[2] || 'screenshot';
const args = process.argv.slice(3);

(async () => {
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
  });

  // 注入存档到 localStorage（在页面加载前）
  let saveJson = null;
  if (fs.existsSync(SAVE_FILE)) {
    saveJson = fs.readFileSync(SAVE_FILE, 'utf8');
  }
  if (saveJson) {
    await context.addInitScript((data) => {
      try { localStorage.setItem('frxxz_save_v1', data); } catch(e) {}
    }, saveJson);
  }

  const page = await context.newPage();
  await page.goto(SERVER, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // 注入 Fx/Cutscene stubs
  await page.evaluate(STUBS);

  // 如果有存档，加载游戏
  if (saveJson) {
    await page.evaluate(() => {
      if (typeof State !== 'undefined' && State.hasSave()) {
        State.load();
        if (typeof Main !== 'undefined') Main.enterGame();
        // 恢复 pendingEvent 的剧情卡
        if (State.data && State.data.pendingEvent) {
          const stage = STORY.find(st => st.id === State.data.pendingEvent);
          if (stage && typeof UI !== 'undefined') {
            try { UI.renderStory(stage); } catch(e) {}
          }
        }
      }
    });
    await page.waitForTimeout(1000);
  }

  const result = { ok: true, action, time: new Date().toISOString() };

  try {
    switch (action) {
      case 'screenshot':
        await page.screenshot({ path: SHOT_FILE, fullPage: false });
        result.msg = 'screenshot saved';
        break;

      case 'eval': {
        const val = await page.evaluate(args[0] || 'undefined');
        result.value = val;
        await page.screenshot({ path: SHOT_FILE, fullPage: false });
        break;
      }

      case 'text': {
        const text = await page.evaluate(() => {
          return [...document.querySelectorAll('.story-line,.narr,.choice,button,.scene-line,.story-speaker,.tc-title,.loc-name,.btn-action')]
            .filter(e => e.offsetParent !== null && e.textContent.trim())
            .map(e => (e.className || e.tagName) + ': ' + e.textContent.trim().substring(0, 300))
            .join('\n');
        });
        result.text = text;
        await page.screenshot({ path: SHOT_FILE, fullPage: false });
        break;
      }

      case 'status': {
        const val = await page.evaluate(() => {
          return JSON.stringify({
            stage: State.data.storyStage, pending: State.data.pendingEvent,
            loc: State.data.location, name: State.data.name,
            realm: State.realm().name, year: State.data.year, month: State.data.month,
            cult: State.data.cultivation, hp: State.data.hp + '/' + State.data.hpMax
          });
        });
        result.value = val;
        break;
      }

      case 'advance': {
        const maxSteps = parseInt(args[0] || '15', 10);
        const val = await page.evaluate(async (max) => {
          // 先消除题字卡（headless 下 timer 可能不触发）
          if (UI._story && UI._story.titling) {
            const card = document.getElementById('story-titlecard');
            if (card) card.classList.remove('show');
            UI._story.titling = false;
            UI.storyAdvance();
            await new Promise(r => setTimeout(r, 500));
          }
          const results = [];
          for (let i = 0; i < max; i++) {
            try { State.save(); } catch(e) {}
            const choices = [...document.querySelectorAll('.choice')].filter(c => c.offsetParent !== null && c.textContent.trim());
            if (choices.length > 0) {
              results.push({ step: i, type: 'choice', choices: choices.map(c => c.textContent.trim().substring(0, 100)) });
              break;
            }
            // 如果正在打字，先完成打字
            if (UI._story && UI._story.typing) { UI._typeFinish(); await new Promise(r => setTimeout(r, 300)); }
            try { UI.storyAdvance(); } catch(e) { results.push({ step: i, type: 'error', msg: e.message }); break; }
            await new Promise(r => setTimeout(r, 700));
            const line = document.querySelector('.story-line');
            const speaker = document.querySelector('.story-speaker');
            const text = (speaker ? speaker.textContent.trim() + ': ' : '') + (line ? line.textContent.trim() : '');
            results.push({ step: i, type: 'text', text: text.substring(0, 200) });
          }
          return JSON.stringify(results);
        }, maxSteps);
        result.value = val;
        await page.screenshot({ path: SHOT_FILE, fullPage: false });
        break;
      }

      case 'choose': {
        const idx = parseInt(args[0] || '0', 10);
        const val = await page.evaluate((i) => {
          const stage = STORY[State.data.storyStage];
          if (!stage || !stage.choices || i >= stage.choices.length) return 'invalid choice';
          const choice = stage.choices[i];
          if (choice.effect) { try { const r = choice.effect(State.data) || {}; if (r.text) Engine.log(r.text, r.kind || 'event'); } catch(e) {} }
          State.data.pendingEvent = null;
          State.data.storyStage += 1;
          if (choice.next === 'end') { Engine.endArc(); return 'end arc'; }
          try { UI.clearStory(); } catch(e) {}
          State.save();
          try { UI.renderAll(); } catch(e) {}
          try { Engine.checkStory(); } catch(e) { return 'checkStory err: ' + e.message; }
          return 'ok: stage=' + State.data.storyStage + ' pending=' + State.data.pendingEvent;
        }, idx);
        result.value = val;
        await page.screenshot({ path: SHOT_FILE, fullPage: false });
        break;
      }

      case 'cultivate': {
        const months = parseInt(args[0] || '1', 10);
        const val = await page.evaluate(async (m) => {
          const log = [];
          for (let i = 0; i < m; i++) {
            try { State.save(); } catch(e) {}
            try { Engine.doAction('cultivate'); } catch(e) { log.push({ i, err: e.message }); break; }
            log.push({ i, year: State.data.year, month: State.data.month, stage: State.data.storyStage, pending: State.data.pendingEvent, realm: State.realm().name, cult: State.data.cultivation });
            if (State.data.pendingEvent) { log.push({ i, msg: 'event: ' + State.data.pendingEvent }); break; }
            if (State.data.combat) { log.push({ i, msg: 'combat' }); break; }
          }
          return JSON.stringify(log);
        }, months);
        result.value = val;
        await page.screenshot({ path: SHOT_FILE, fullPage: false });
        break;
      }

      case 'save': {
        const save = await page.evaluate(() => {
          try { State.save(); return localStorage.getItem('frxxz_save_v1'); } catch(e) { return null; }
        });
        if (save) {
          fs.writeFileSync(SAVE_FILE, save);
          result.msg = 'save written to gamesave.json';
        } else {
          result.ok = false;
          result.msg = 'no save data';
        }
        break;
      }

      case 'setstage': {
        const stage = parseInt(args[0], 10);
        const cult = parseInt(args[1] || '0', 10);
        await page.evaluate((s, c) => {
          State.data.pendingEvent = null;
          State.data.storyStage = s;
          if (c > 0) State.data.cultivation = c;
          State.save();
          try { UI.clearStory(); } catch(e) {}
          try { UI.renderAll(); } catch(e) {}
          try { Engine.checkStory(); } catch(e) {}
        }, stage, cult);
        result.msg = `set stage=${stage} cult=${cult}`;
        await page.screenshot({ path: SHOT_FILE, fullPage: false });
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

  // 保存游戏存档到文件
  try {
    const save = await page.evaluate(() => {
      try { if (State.data) { State.save(); return localStorage.getItem('frxxz_save_v1'); } } catch(e) {}
      return null;
    });
    if (save) fs.writeFileSync(SAVE_FILE, save);
  } catch(e) {}

  // 输出结果
  if (result.value !== undefined) {
    try {
      const parsed = JSON.parse(result.value);
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
    } catch(e2) {
      console.log(result.value);
    }
  } else if (result.text) {
    console.log(result.text);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }

  await browser.close();
})();
