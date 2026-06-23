// combat2.js — 改进版战斗自动化
// 用法：node scripts/combat2.js
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

  let saveJson = null;
  if (fs.existsSync(SAVE_FILE)) saveJson = fs.readFileSync(SAVE_FILE, 'utf8');
  if (saveJson) {
    await context.addInitScript((data) => { try { localStorage.setItem('frxxz_save_v1', data); } catch(e) {} }, saveJson);
  }

  const page = await context.newPage();
  await page.goto(SERVER, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.evaluate(STUBS);

  if (saveJson) {
    await page.evaluate(() => {
      if (State.hasSave()) { State.load(); Main.enterGame(); }
    });
    await page.waitForTimeout(1000);
  }

  // 触发决战
  console.log('Starting showdown fight...');
  await page.evaluate(() => {
    State.data.pendingEvent = null;
    Engine.startShowdownFight();
  });
  await page.waitForTimeout(2000);

  // 战斗自动化
  const combatLog = await page.evaluate(async () => {
    const log = [];
    for (let r = 0; r < 50; r++) {
      if (!Engine._combat) { log.push({ r, msg: 'combat ended' }); break; }
      const c = Engine._combat;
      if (c.status !== 'ongoing') { log.push({ r, msg: 'status=' + c.status }); break; }
      
      const playerHp = c.player.hp;
      const playerMp = c.player.mp;
      const playerPos = c.player.pos;
      const enemies = c.enemies.map(e => ({ name: e.name, hp: e.hp, pos: e.pos, dead: e.dead }));
      const affordable = c.affordableSpells();
      
      log.push({ r, playerHp, playerMp, playerPos, enemies, affordable });

      // 策略：优先远程高伤法术，再近战
      const attackSpells = ['feizhen', 'zhenhun', 'weidu', 'zhayan', 'jujian_shu'];
      const supportSpells = ['tuna', 'huti', 'ningshen'];
      
      let acted = false;
      
      // 先尝试攻击法术
      for (const sp of attackSpells) {
        if (!affordable.includes(sp)) continue;
        // 尝试对每个敌人施放
        for (let ti = 0; ti < c.enemies.length; ti++) {
          if (c.enemies[ti].dead) continue;
          const result = c.cast(sp, ti);
          if (result.ok) {
            log.push({ r, action: 'cast', spell: sp, target: ti, result: 'ok' });
            if (c.status !== 'ongoing') { log.push({ r, msg: 'combat ended after cast' }); acted = true; break; }
            acted = true;
            break;
          } else {
            log.push({ r, action: 'castFail', spell: sp, target: ti, reason: result.reason });
          }
        }
        if (acted) break;
      }
      
      // 如果没有攻击法术可用，尝试移动靠近敌人然后结束回合
      if (!acted) {
        const aliveEnemies = c.enemies.filter(e => !e.dead);
        if (aliveEnemies.length > 0) {
          const nearest = aliveEnemies.reduce((a, b) => Math.abs(b.pos - c.player.pos) < Math.abs(a.pos - c.player.pos) ? b : a);
          const dist = Math.abs(nearest.pos - c.player.pos);
          // 移动靠近
          if (dist > 1) {
            const dir = nearest.pos > c.player.pos ? 1 : -1;
            const moveTarget = c.player.pos + dir * Math.min(c.player.move || 1, dist - 1);
            try { 
              Engine.combatMove(moveTarget); 
              log.push({ r, action: 'move', to: moveTarget, from: c.player.pos });
              // 移动后重新检查能否攻击
              for (const sp of attackSpells) {
                if (!affordable.includes(sp)) continue;
                for (let ti = 0; ti < c.enemies.length; ti++) {
                  if (c.enemies[ti].dead) continue;
                  const result = c.cast(sp, ti);
                  if (result.ok) {
                    log.push({ r, action: 'castAfterMove', spell: sp, target: ti });
                    acted = true;
                    break;
                  }
                }
                if (acted) break;
              }
            } catch(e) { log.push({ r, action: 'moveFail', err: e.message }); }
          }
        }
      }
      
      // 如果还是没行动，尝试支持法术
      if (!acted) {
        for (const sp of supportSpells) {
          if (!affordable.includes(sp)) continue;
          const result = c.cast(sp, 0);
          if (result.ok) {
            log.push({ r, action: 'support', spell: sp, result: 'ok' });
            acted = true;
            break;
          }
        }
      }
      
      // 结束回合（让敌人行动）
      if (!acted) {
        Engine.combatEndRound();
        log.push({ r, action: 'endRound' });
      } else {
        // 攻击后也要结束回合
        if (c.status === 'ongoing') {
          Engine.combatEndRound();
          log.push({ r, action: 'endRoundAfterAction' });
        }
      }
      
      // 检查战斗状态
      if (c.status !== 'ongoing') { log.push({ r, msg: 'combat ended: ' + c.status }); break; }
      
      await new Promise(r => setTimeout(r, 300));
    }
    return JSON.stringify(log);
  });

  try {
    const log = JSON.parse(combatLog);
    log.forEach(entry => {
      if (entry.msg) console.log(`[R${entry.r}] ${entry.msg}`);
      else if (entry.action) console.log(`[R${entry.r}] ${entry.action} ${entry.spell || ''} ${entry.target != null ? '→ enemy[' + entry.target + ']' : ''} | HP=${entry.playerHp || '?'} MP=${entry.playerMp || '?'} | enemies=${JSON.stringify(entry.enemies || [])}`);
      else console.log(`[R${entry.r}] HP=${entry.playerHp} MP=${entry.playerMp} pos=${entry.playerPos} | enemies=${JSON.stringify(entry.enemies)} | affordable=${JSON.stringify(entry.affordable)}`);
    });
  } catch(e) {
    console.log('Parse error:', e.message);
    console.log(combatLog.substring(0, 2000));
  }

  await page.screenshot({ path: SHOT_FILE, fullPage: false });
  fs.copyFileSync(SHOT_FILE, path.join(ROOT, 'promo', 'raw', 'frame_015_combat.png'));

  const result = await page.evaluate(() => JSON.stringify({
    combat: State.data.combat, pending: State.data.pendingEvent,
    stage: State.data.storyStage, realm: State.realm().name, hp: State.data.hp
  }));
  console.log('Result:', result);

  // 保存
  try {
    const save = await page.evaluate(() => { try { if (State.data) { State.save(); return localStorage.getItem('frxxz_save_v1'); } } catch(e) {} return null; });
    if (save) fs.writeFileSync(SAVE_FILE, save);
  } catch(e) {}

  await browser.close();
})();
