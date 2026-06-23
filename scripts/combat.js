// combat.js — 战斗自动化脚本
// 用法：node scripts/combat.js [maxRounds]
// 在单个浏览器会话中完成整个战斗
const { chromium } = require("playwright");
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SHOT_FILE = path.join(ROOT, 'promo', 'shot.png');
const SAVE_FILE = path.join(ROOT, 'promo', 'gamesave.json');
const SERVER = 'http://localhost:3000';

const maxRounds = parseInt(process.argv[2] || '30', 10);

const STUBS = `
window.Fx={ensure(){},warm(){},at(){return{x:0,y:0}},launch(){},strike(){},burst(){},fadeOut(){},shake(){},haptic(){},glow(){},ring(){},beam(){},flash(){},ripple(){},particle(){},sparks(){},trail(){},slash(){},stab(){},crush(){},smash(){},sweep(){},ambient(){},motes(){},clear(){},detach(){}};
window.Cutscene={clear(){},resetCam(){},hasStaging(){return false},play(){},stop(){}};
`;

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  });

  // 注入存档
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
  await page.evaluate(STUBS);

  // 加载存档
  if (saveJson) {
    await page.evaluate(() => {
      if (typeof State !== 'undefined' && State.hasSave()) {
        State.load();
        if (typeof Main !== 'undefined') Main.enterGame();
      }
    });
    await page.waitForTimeout(1000);
  }

  // 检查是否有待处理的剧情
  const status = await page.evaluate(() => {
    return JSON.stringify({
      pending: State.data.pendingEvent,
      combat: State.data.combat,
      stage: State.data.storyStage,
    });
  });
  console.log('Status:', status);

  // 如果有 pendingEvent（showdown），触发战斗
  const pendingResult = await page.evaluate(() => {
    if (State.data.pendingEvent === 'showdown') {
      // 恢复剧情卡
      const stage = STORY.find(st => st.id === 'showdown');
      if (stage) {
        try { UI.renderStory(stage); } catch(e) {}
        return 'showdown story rendered';
      }
    }
    return 'pending=' + State.data.pendingEvent;
  });
  console.log('Pending:', pendingResult);

  // 推进剧情到选项，然后选择进入战斗
  const advanceResult = await page.evaluate(async () => {
    // 消除题字卡
    if (UI._story && UI._story.titling) {
      const card = document.getElementById('story-titlecard');
      if (card) card.classList.remove('show');
      UI._story.titling = false;
      UI.storyAdvance();
      await new Promise(r => setTimeout(r, 500));
    }
    // 推进到选项
    for (let i = 0; i < 15; i++) {
      const choices = [...document.querySelectorAll('.choice')].filter(c => c.offsetParent !== null && c.textContent.trim());
      if (choices.length > 0) return 'choices: ' + choices.map(c => c.textContent.trim().substring(0, 80)).join(' | ');
      if (UI._story && UI._story.typing) { UI._typeFinish(); await new Promise(r => setTimeout(r, 300)); }
      UI.storyAdvance();
      await new Promise(r => setTimeout(r, 700));
    }
    return 'no choices found';
  });
  console.log('Advance:', advanceResult);

  // 选择进入战斗
  const fightResult = await page.evaluate(() => {
    const stage = STORY[State.data.storyStage];
    if (!stage || !stage.choices) return 'no choices';
    const choice = stage.choices[0];
    if (choice.resolve === 'showdown_win' || choice.resolve === 'showdown_risk') {
      State.data.pendingEvent = null;
      Engine.startShowdownFight();
      return 'showdown fight started';
    }
    return 'resolve=' + choice.resolve;
  });
  console.log('Fight:', fightResult);

  await page.waitForTimeout(2000);
  await page.screenshot({ path: SHOT_FILE, fullPage: false });
  fs.copyFileSync(SHOT_FILE, path.join(ROOT, 'promo', 'raw', 'frame_015_combat_start.png'));

  // 战斗自动化
  const combatLog = await page.evaluate(async (maxR) => {
    const log = [];
    for (let r = 0; r < maxR; r++) {
      if (!Engine._combat) { log.push({ r, msg: 'combat ended' }); break; }
      const c = Engine._combat;
      const playerHp = c.player.hp;
      const enemies = c.enemies.map(e => ({ name: e.name, hp: e.hp }));
      log.push({ r, playerHp, enemies });

      // 尝试攻击：优先用法术/技能
      try {
        // 检查可用行动
        const actions = [];
        if (c.player.mp >= 5) actions.push('cast');
        actions.push('attack');
        actions.push('end');

        // 简单策略：有法术就放，否则普攻
        if (c.player.mp >= 5 && c.player.spells && c.player.spells.length > 0) {
          // 尝试施法
          const spell = c.player.spells[0];
          try {
            Engine.combatCast(spell.id || spell, 0);
            log.push({ r, action: 'cast', spell: spell.id || spell });
          } catch(e) {
            // 施法失败，普攻
            try { Engine.combatCastAt(0, 0); log.push({ r, action: 'attack' }); }
            catch(e2) { Engine.combatEndRound(); log.push({ r, action: 'end' }); }
          }
        } else {
          try { Engine.combatCastAt(0, 0); log.push({ r, action: 'attack' }); }
          catch(e) { Engine.combatEndRound(); log.push({ r, action: 'end' }); }
        }
      } catch(e) {
        log.push({ r, error: e.message });
        break;
      }
      await new Promise(r => setTimeout(r, 500));
    }
    return JSON.stringify(log);
  }, maxRounds);

  // 输出战斗日志
  try {
    const log = JSON.parse(combatLog);
    log.forEach(entry => {
      if (entry.msg) console.log(`[round ${entry.r}] ${entry.msg}`);
      else if (entry.error) console.log(`[round ${entry.r}] ERROR: ${entry.error}`);
      else if (entry.action) console.log(`[round ${entry.r}] ${entry.action} | HP=${entry.playerHp} | enemies=${JSON.stringify(entry.enemies)}`);
      else console.log(`[round ${entry.r}] HP=${entry.playerHp} | enemies=${JSON.stringify(entry.enemies)}`);
    });
  } catch(e) {
    console.log('Combat log parse error:', e.message);
    console.log(combatLog);
  }

  await page.screenshot({ path: SHOT_FILE, fullPage: false });
  fs.copyFileSync(SHOT_FILE, path.join(ROOT, 'promo', 'raw', 'frame_016_combat_end.png'));

  // 检查战斗结果
  const result = await page.evaluate(() => {
    return JSON.stringify({
      combat: State.data.combat,
      pending: State.data.pendingEvent,
      stage: State.data.storyStage,
      realm: State.realm().name,
      hp: State.data.hp,
    });
  });
  console.log('Result:', result);

  // 保存存档
  try {
    const save = await page.evaluate(() => {
      try { if (State.data) { State.save(); return localStorage.getItem('frxxz_save_v1'); } } catch(e) {}
      return null;
    });
    if (save) fs.writeFileSync(SAVE_FILE, save);
  } catch(e) {}

  await browser.close();
})();
