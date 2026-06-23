/**
 * test-modao.js — 魔道争锋篇改造后自动化测试
 * 加载测试存档 → 触发三组对位群架 → 测试血侍差异化 → 拖时布阵（阵旗）→ 阵成决战（手动相位）
 * 
 * 用法：node scripts/test-modao.js
 */
const { chromium } = require("playwright");
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SAVE_FILE = path.join(ROOT, 'promo', 'test-save.json');
const SHOT_DIR = path.join(ROOT, 'promo', 'raw');
const SERVER = 'http://localhost:3000';

fs.mkdirSync(SHOT_DIR, { recursive: true });

let shotN = 0;
async function shot(page, label) {
  const name = `modao_${String(++shotN).padStart(3, '0')}_${label}.png`;
  await page.screenshot({ path: path.join(SHOT_DIR, name) });
  console.log(`  📸 ${name}`);
  return name;
}

async function evalPage(page, code) {
  return await page.evaluate(code);
}

async function waitMs(ms) { return new Promise(r => setTimeout(r, ms)); }

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

  // 注入测试存档
  const saveJson = fs.readFileSync(SAVE_FILE, 'utf8');
  await context.addInitScript((data) => {
    try { localStorage.setItem('frxxz_save_v1', data); } catch (e) {}
  }, saveJson);

  const page = await context.newPage();
  await page.goto(SERVER, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitMs(2000);

  // 加载存档并进入游戏
  await page.evaluate(() => {
    if (typeof State !== 'undefined' && State.hasSave()) {
      State.load();
      if (typeof Main !== 'undefined') Main.enterGame();
    }
  });
  await waitMs(1500);

  // 触发 checkStory（storyStage=63 = modao_e4_santuan，cond 应满足）
  await page.evaluate(() => {
    try { Engine.checkStory(); } catch (e) { console.error('checkStory err:', e); }
  });
  await waitMs(1500);
  await shot(page, 'checkstory');

  // 检查状态
  let status = await evalPage(page, () => JSON.stringify({
    stage: State.data.storyStage,
    pending: State.data.pendingEvent,
    loc: State.data.location,
    realm: State.realm().name,
    combat: !!State.data.combat,
  }));
  console.log('Status after checkStory:', status);

  // 读取当前画面文字
  let text = await evalPage(page, () =>
    [...document.querySelectorAll('.story-line,.narr,.choice,button,.tc-title,.story-speaker')]
      .filter(e => e.offsetParent !== null && e.textContent.trim())
      .map(e => (e.className || e.tagName) + ': ' + e.textContent.trim().substring(0, 200))
      .join('\n')
  );
  console.log('Text on screen:\n', text);

  // 推进剧情到战斗
  console.log('\n=== 推进剧情到三组对位群架 ===');
  for (let i = 0; i < 10; i++) {
    const hasChoice = await page.evaluate(() => {
      const ch = [...document.querySelectorAll('.choice')].filter(c => c.offsetParent !== null && c.textContent.trim());
      return ch.length;
    });
    if (hasChoice > 0) {
      console.log(`  Step ${i}: Found ${hasChoice} choices`);
      const choices = await page.evaluate(() =>
        [...document.querySelectorAll('.choice')].filter(c => c.offsetParent !== null)
          .map(c => c.textContent.trim().substring(0, 100))
      );
      console.log('  Choices:', choices);
      // 点第一个选择（触发战斗）
      await page.evaluate(() => {
        const ch = [...document.querySelectorAll('.choice')].filter(c => c.offsetParent !== null);
        if (ch.length > 0) UI.storyChoose(0);
      });
      await waitMs(2000);
      await shot(page, `choose_${i}`);
      break;
    }
    // 推进对话
    await page.evaluate(() => {
      if (UI._story && UI._story.typing) { UI._typeFinish(); }
      try { UI.storyAdvance(); } catch (e) {}
    });
    await waitMs(800);
  }

  // 检查是否进入战斗
  let inCombat = await evalPage(page, () => !!State.data.combat);
  console.log('In combat:', inCombat);
  await shot(page, 'combat_check');

  if (inCombat) {
    // === 测试1：三组对位群架 - 血侍差异化 ===
    console.log('\n=== 测试1：三组对位群架 - 血侍差异化 ===');
    let combatInfo = await evalPage(page, () => {
      const c = Engine._combat;
      if (!c) return null;
      return JSON.stringify({
        enemies: c.enemies.map(e => ({
          name: e.name, hp: e.hp, hpMax: e.hpMax, armor: e.armor,
          agility: e.agility, move: e.move, speed: e.speed,
          alive: e.alive, pos: e.pos,
          attacks: (e.attacks || []).map(a => ({ name: a.name, range: a.range, kind: a.kind }))
        })),
        sides: (c.sides || []).map(s => ({ name: s.name, hp: s.hp, hpMax: s.hpMax })),
        W: c.W, round: c.round, status: c.status,
        fieldManual: c.fieldManual,
      });
    });
    console.log('Combat info:', combatInfo);

    // 验证血侍差异化
    let parsed = JSON.parse(combatInfo);
    console.log('\n血侍差异化验证:');
    parsed.enemies.forEach((e, i) => {
      console.log(`  敌${i}: ${e.name} | HP:${e.hp}/${e.hpMax} | 甲:${e.armor} | 敏:${e.agility} | 速:${e.speed} | 移:${e.move}`);
      console.log(`    招式: ${e.attacks.map(a => `${a.name}(${a.range[0]}~${a.range[1]}格,${a.kind})`).join(', ')}`);
    });

    const xsA = parsed.enemies[0]; // 铁壁
    const xsB = parsed.enemies[1]; // 高闪
    const xsC = parsed.enemies[2]; // 远程

    const checks = [];
    checks.push({ name: '斧奴(铁壁)高甲≥6', pass: xsA.armor >= 6 });
    checks.push({ name: '斧奴(铁壁)高血≥150', pass: xsA.hpMax >= 150 });
    checks.push({ name: '斧奴(铁壁)低速≤12', pass: xsA.speed <= 12 });
    checks.push({ name: '刺奴(高闪)高敏≥18', pass: xsB.agility >= 18 });
    checks.push({ name: '刺奴(高闪)低血≤100', pass: xsB.hpMax <= 100 });
    checks.push({ name: '刺奴(高闪)高移≥3', pass: xsB.move >= 3 });
    checks.push({ name: '链奴(远程)射程≥2', pass: xsC.attacks.some(a => a.range[1] >= 2) });
    checks.push({ name: '链奴(远程)中血~110', pass: xsC.hpMax >= 90 && xsC.hpMax <= 130 });
    checks.push({ name: '三敌名称不同', pass: parsed.enemies.map(e => e.name).filter((v, i, a) => a.indexOf(v) === i).length === 3 });

    checks.forEach(c => console.log(`  ${c.pass ? '✓' : '✗'} ${c.name}`));

    // 模拟战斗：使用 autoResolve 快速完成
    console.log('\n  自动战斗中...');
    const result = await page.evaluate(() => {
      const c = Engine._combat;
      if (!c) return 'no combat';
      c.autoResolve();
      return JSON.stringify({ status: c.status, round: c.round, log: c.log.slice(-5) });
    });
    console.log('  战斗结果:', result);
    await waitMs(1000);
    await shot(page, 'santuan_result');

    // 结算战斗（直接调用 _finishCombat 跳过 UI outro 交互）
    await page.evaluate(() => {
      try { Engine._finishCombat(); } catch (e) { console.error('finishCombat err:', e); }
    });
    await waitMs(1000);
    await shot(page, 'santuan_after');
  }

  // === 测试2：拖时布阵战 - 阵旗拾取 ===
  console.log('\n=== 测试2：拖时布阵战 - 阵旗拾取 ===');
  
  // 先结算并推进完所有剩余剧情对话
  for (let i = 0; i < 30; i++) {
    const hasChoice = await page.evaluate(() => {
      const ch = [...document.querySelectorAll('.choice')].filter(c => c.offsetParent !== null && c.textContent.trim());
      return ch.length;
    });
    if (hasChoice > 0) {
      await page.evaluate(() => {
        const ch = [...document.querySelectorAll('.choice')].filter(c => c.offsetParent !== null);
        if (ch.length > 0) UI.storyChoose(0);
      });
      await waitMs(1500);
      // 检查是否进入战斗
      const inCombatNow = await evalPage(page, () => !!State.data.combat);
      if (inCombatNow) break;
      continue;
    }
    // 检查是否有剧情对话
    const hasDialog = await page.evaluate(() => {
      const sl = document.querySelector('.story-line');
      return sl && sl.offsetParent !== null;
    });
    if (hasDialog) {
      await page.evaluate(() => {
        if (UI._story && UI._story.typing) { UI._typeFinish(); }
        try { UI.storyAdvance(); } catch (e) {}
      });
      await waitMs(600);
      // 检查是否进入战斗
      const inCombatNow = await evalPage(page, () => !!State.data.combat);
      if (inCombatNow) break;
    } else {
      // 没有对话也没有选择，尝试 checkStory
      await page.evaluate(() => { try { Engine.checkStory(); } catch(e) {} });
      await waitMs(1000);
      const inCombatNow = await evalPage(page, () => !!State.data.combat);
      if (inCombatNow) break;
    }
  }

  // 如果没有自动进入拖时战，直接调用
  let inCombatTuoshi = await evalPage(page, () => !!State.data.combat);
  if (!inCombatTuoshi) {
    console.log('  剧情未自动触发拖时战，直接调用 startTuoshiFight()');
    // 设置所需 flags
    await page.evaluate(() => {
      State.setFlag('modao_e4_xuwang_done');
      State.setFlag('modao_e4_liujing_done');
      State.data.flags.modao_e4b_due = State.absMonth();
    });
    await page.evaluate(() => { try { Engine.startTuoshiFight(); } catch(e) { console.error('tuoshi err:', e); } });
    await waitMs(1500);
  }

  inCombatTuoshi = await evalPage(page, () => !!State.data.combat);
  console.log('In combat (tuoshi):', inCombatTuoshi);

  if (inCombatTuoshi) {
    let tuoshiInfo = await evalPage(page, () => {
      const c = Engine._combat;
      if (!c) return null;
      return JSON.stringify({
        hotspots: (c.hotspots || []).map(h => ({ id: h.id, name: h.name, pos: h.pos, taken: h.taken })),
        objective: c.objective,
        maxRounds: c.maxRounds,
        W: c.W,
        enemy: c.enemies[0] ? { name: c.enemies[0].name, hp: c.enemies[0].hp, hpMax: c.enemies[0].hpMax } : null,
        playerPos: c.player.pos,
        flagsTaken: c._flagsTaken,
      });
    });
    console.log('Tuoshi info:', tuoshiInfo);
    await shot(page, 'tuoshi_start');

    // 验证阵旗存在
    let parsed = JSON.parse(tuoshiInfo);
    console.log('\n阵旗验证:');
    console.log(`  阵旗数量: ${parsed.hotspots.length} (期望3)`);
    console.log(`  阵旗位置: ${parsed.hotspots.map(h => `${h.name}@${h.pos}`).join(', ')}`);
    console.log(`  目标: ${JSON.stringify(parsed.objective)}`);
    console.log(`  最大回合: ${parsed.maxRounds}`);
    console.log(`  玩家位置: ${parsed.playerPos}`);

    const flagChecks = [];
    flagChecks.push({ name: '有3面阵旗', pass: parsed.hotspots.length === 3 });
    flagChecks.push({ name: '阵旗位置不同', pass: new Set(parsed.hotspots.map(h => h.pos)).size === 3 });
    flagChecks.push({ name: '有survive目标', pass: parsed.objective && parsed.objective.kind === 'survive' });
    flagChecks.forEach(c => console.log(`  ${c.pass ? '✓' : '✗'} ${c.name}`));

    // 模拟拖时战斗 - autoResolve
    console.log('\n  自动战斗中（拖时）...');
    const tuoshiResult = await page.evaluate(() => {
      const c = Engine._combat;
      if (!c) return 'no combat';
      c.autoResolve();
      return JSON.stringify({
        status: c.status,
        round: c.round,
        flagsTaken: c._flagsTaken,
        hotspots: (c.hotspots || []).map(h => ({ name: h.name, taken: h.taken })),
        log: c.log.slice(-8),
      });
    });
    console.log('  拖时结果:', tuoshiResult);
    await waitMs(1000);
    await shot(page, 'tuoshi_result');

    // 结算
    await page.evaluate(() => {
      try { Engine._finishCombat(); } catch (e) {}
    });
    await waitMs(1000);
  }

  // === 测试3：阵成决战 - 手动相位选择 ===
  console.log('\n=== 测试3：阵成决战 - 手动相位选择 ===');
  
  // 直接调用 startXuwangFight（跳过中间剧情）
  console.log('  直接调用 startXuwangFight()');
  await page.evaluate(() => {
    State.setFlag('modao_e4b_tuoshi_done');
    try { Engine.startXuwangFight(); } catch(e) { console.error('xuwang err:', e); }
  });
  await waitMs(1500);

  let inCombatXuwang = await evalPage(page, () => !!State.data.combat);
  console.log('In combat (xuwang_final):', inCombatXuwang);

  if (inCombatXuwang) {
    let xuwangInfo = await evalPage(page, () => {
      const c = Engine._combat;
      if (!c) return null;
      return JSON.stringify({
        fieldManual: c.fieldManual,
        fieldCycle: (c.fieldCycle || []).map((ph, i) => ({
          idx: i, name: ph.name, suppress: ph.suppress,
          hasExpose: !!ph.expose, hasPlayer: !!ph.player,
        })),
        fieldUsed: c._fieldUsed,
        fieldPhaseApplied: c._fieldPhaseApplied,
        enemy: c.enemies[0] ? { name: c.enemies[0].name, hp: c.enemies[0].hp, hpMax: c.enemies[0].hpMax } : null,
        hasWaves: !!(c._pendingEnemyWaves && c._pendingEnemyWaves.length),
        maxRounds: c.maxRounds,
      });
    });
    console.log('Xuwang info:', xuwangInfo);
    await shot(page, 'xuwang_start');

    let parsed = JSON.parse(xuwangInfo);
    console.log('\n手动相位验证:');
    console.log(`  fieldManual: ${parsed.fieldManual} (期望true)`);
    console.log(`  相位数量: ${parsed.fieldCycle.length} (期望6)`);
    parsed.fieldCycle.forEach(ph => {
      console.log(`    ${ph.idx}: ${ph.name} | suppress:${ph.suppress} | expose:${ph.hasExpose} | player:${ph.hasPlayer}`);
    });
    console.log(`  有二阶段waves: ${parsed.hasWaves}`);

    const xuwangChecks = [];
    xuwangChecks.push({ name: 'fieldManual=true', pass: parsed.fieldManual === true });
    xuwangChecks.push({ name: '有6个相位', pass: parsed.fieldCycle.length === 6 });
    xuwangChecks.push({ name: '有万象星河相位', pass: parsed.fieldCycle.some(p => p.name.includes('万象星河')) });
    xuwangChecks.push({ name: '有二阶段waves', pass: parsed.hasWaves });
    xuwangChecks.forEach(c => console.log(`  ${c.pass ? '✓' : '✗'} ${c.name}`));

    // 测试手动选相位
    console.log('\n  测试手动选相位...');
    const phaseResult = await page.evaluate(() => {
      const c = Engine._combat;
      if (!c) return 'no combat';
      // 选第一个相位
      const r1 = c.chooseFieldPhase(0);
      // 尝试再选（应该失败 - 本回合已激活）
      const r2 = c.chooseFieldPhase(1);
      return JSON.stringify({
        r1: r1,
        r2: r2,
        fieldUsed: c._fieldUsed,
        fieldPhaseApplied: c._fieldPhaseApplied,
        fieldPhase: c._fieldPhase ? c._fieldPhase.name : null,
      });
    });
    console.log('  选相位结果:', phaseResult);

    let phaseParsed = JSON.parse(phaseResult);
    const phaseChecks = [];
    phaseChecks.push({ name: '第一次选相位成功', pass: phaseParsed.r1.ok === true });
    phaseChecks.push({ name: '同回合再选失败', pass: phaseParsed.r2.ok === false });
    phaseChecks.push({ name: '已用相位记录正确', pass: phaseParsed.fieldUsed.includes(0) });
    phaseChecks.push({ name: '当前相位已设', pass: !!phaseParsed.fieldPhase });
    phaseChecks.forEach(c => console.log(`  ${c.pass ? '✓' : '✗'} ${c.name}`));

    // 检查 UI 是否渲染了相位按钮
    const fcVisible = await page.evaluate(() => {
      const fc = document.getElementById('combat-fieldcycle');
      return fc && !fc.hidden && fc.innerHTML.length > 0;
    });
    console.log(`  相位UI可见: ${fcVisible ? '✓' : '✗'}`);
    await shot(page, 'xuwang_phase_selected');

    // autoResolve 完成战斗
    console.log('\n  自动完成战斗...');
    const xuwangResult = await page.evaluate(() => {
      const c = Engine._combat;
      if (!c) return 'no combat';
      c.autoResolve();
      return JSON.stringify({
        status: c.status,
        round: c.round,
        fieldUsed: c._fieldUsed,
        log: c.log.slice(-5),
      });
    });
    console.log('  决战结果:', xuwangResult);
    await waitMs(1000);
    await shot(page, 'xuwang_result');
  }

  // 输出总结
  console.log('\n========== 测试总结 ==========');
  console.log('截图已保存到 promo/raw/modao_*.png');

  await waitMs(2000);
  await browser.close();
  console.log('Done.');
})();
