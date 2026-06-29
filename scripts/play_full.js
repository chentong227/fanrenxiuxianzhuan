/**
 * 完整游戏流程测试 v1——模拟真实玩家操作，逐步截图，记录所有 UI/游戏性问题
 * 
 * 流程：标题 → 灵根选择 → 进入游戏 → 跳过剧情 → 逐月推进 → 开地图 → 行动 → 旅途
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:3000';
const SHOT_DIR = path.join(__dirname, '..', 'promo', 'ui-check');

(async () => {
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  fs.mkdirSync(SHOT_DIR, { recursive: true });

  const issues = [];
  const failedReqs = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') issues.push(`Console Error: ${msg.text()}`);
  });
  page.on('pageerror', err => issues.push(`Page Error: ${err.message}`));
  page.on('response', resp => {
    if (resp.status() >= 400) failedReqs.push(`${resp.status()} ${resp.url()}`);
  });

  let shotIdx = 500;
  async function shot(label) {
    const fname = path.join(SHOT_DIR, `frame_${String(shotIdx).padStart(3, '0')}_${label}.png`);
    await page.screenshot({ path: fname, fullPage: false });
    console.log(`📸 [${shotIdx}] ${label}`);
    shotIdx++;
  }
  async function wait(ms) { await page.waitForTimeout(ms); }
  async function evalJS(code) { 
    try { return await page.evaluate(code); } 
    catch(e) { issues.push(`Eval Error: ${e.message}`); return null; }
  }
  async function tryClick(sel, timeout = 3000) {
    try {
      const el = page.locator(sel).first();
      await el.waitFor({ state: 'visible', timeout });
      await el.click({ force: true });
      return true;
    } catch (e) { return false; }
  }

  // 辅助：获取当前 UI 状态快照
  async function uiSnapshot() {
    return await evalJS(() => {
      const visible = [];
      const ids = ['story-overlay', 'stage-overlay', 'worldmap-canvas', 'scene-stage', 
                   'action-dock', 'action-buttons', 'modal', 'sheet', 'toast',
                   'story-choices', 'story-skip', 'story-cue',
                   'topbar', 'panel', 'layout', 'mid-col', 'side-rail',
                   'narrative-log', 'objective', 'inventory',
                   'worldmap-pins', 'worldmap-labels', 'avatar-pin', 'zoom-controls',
                   'journey-status', 'worldmap-hint', 'hud-toggle',
                   'mobile-tabs', 'exmap-overlay', 'bottle-overlay'];
      ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const cs = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        if (el.hidden || cs.display === 'none' || cs.visibility === 'hidden' || rect.width === 0) return;
        visible.push(id);
      });
      // 也检查 class-based 可见元素
      ['modal.show', 'sheet.show', '.btn-action', '.choice', '.scene-hotspot', '.toast-msg'].forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) visible.push(sel);
        });
      });
      const s = window.State ? window.State.data : null;
      return {
        visible: [...new Set(visible)],
        state: s ? {
          location: s.location,
          month: s.month, year: s.year, age: s.age,
          storyStage: s.storyStage,
          pendingEvent: s.pendingEvent,
          combat: s.combat,
          journey: s.journey,
          realm: s.realm,
          spirit: s.spirit,
        } : null
      };
    });
  }

  // 辅助：检测元素重叠（只检测不该重叠的元素对）
  async function checkOverlaps() {
    return await evalJS(() => {
      const problems = [];
      const pairs = [
        ['action-dock', 'action-buttons'],
        ['action-dock', 'mid-col'],
        ['modal', 'sheet'],
        ['worldmap-canvas', 'modal'],
        ['worldmap-canvas', 'sheet'],
        ['story-overlay', 'worldmap-canvas'],
        ['stage-overlay', 'worldmap-canvas'],
      ];
      pairs.forEach(([a, b]) => {
        const ea = document.getElementById(a);
        const eb = document.getElementById(b);
        if (!ea || !eb) return;
        if (ea.hidden || eb.hidden) return;
        const ra = ea.getBoundingClientRect();
        const rb = eb.getBoundingClientRect();
        const csA = getComputedStyle(ea);
        const csB = getComputedStyle(eb);
        if (csA.display === 'none' || csB.display === 'none') return;
        if (ra.width === 0 || rb.width === 0) return;
        const overlap = !(ra.right < rb.left || ra.left > rb.right || ra.bottom < rb.top || ra.top > rb.bottom);
        if (overlap) problems.push(`${a} ↔ ${b}`);
      });
      return problems;
    });
  }

  console.log('=== 完整游戏流程测试 ===\n');

  await page.route('**/ver.txt*', async route => {
    await route.fulfill({ status: 200, body: '222', contentType: 'text/plain' });
  });

  // ========== 1. 标题屏 ==========
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await wait(2000);
  await shot('title');
  const titleSnap = await uiSnapshot();
  console.log('  标题屏:', JSON.stringify(titleSnap?.state));

  // ========== 2. 灵根选择 ==========
  await tryClick('#btn-test-root');
  await wait(2000);
  await shot('lingen');
  
  // 检查灵根选择界面
  const lingenInfo = await evalJS(() => {
    const buttons = document.querySelectorAll('#screen-lingen button, #screen-create button');
    return Array.from(buttons).map(b => ({ text: b.textContent.trim().substring(0, 30), id: b.id, visible: b.offsetParent !== null }));
  });
  console.log('  灵根按钮:', JSON.stringify(lingenInfo?.slice(0, 5)));

  // ========== 3. 开始游戏 ==========
  await tryClick('#btn-start');
  await wait(3000);
  await shot('entered');
  const enteredSnap = await uiSnapshot();
  console.log('  进入游戏:', JSON.stringify(enteredSnap?.state));

  // ========== 4. 跳过开场剧情 ==========
  let skipCount = 0;
  for (let i = 0; i < 30; i++) {
    const snap = await uiSnapshot();
    if (!snap?.visible?.includes('story-overlay')) break;
    
    // 尝试跳过
    await evalJS(() => { if (window.UI && UI.storySkip) UI.storySkip(); });
    await wait(500);
    
    // 检查是否有选择按钮
    const hasChoices = await evalJS(() => {
      const box = document.getElementById('story-choices');
      if (!box || box.hidden) return 0;
      return box.querySelectorAll('button.choice, button').length;
    });
    
    if (hasChoices > 0) {
      // 点第一个选择
      await evalJS(() => {
        const box = document.getElementById('story-choices');
        if (box) { const btn = box.querySelector('button.choice, button'); if (btn) btn.click(); }
      });
      await wait(1000);
    }
    skipCount++;
  }
  await shot('after_story');
  const afterStorySnap = await uiSnapshot();
  console.log(`  跳过剧情(${skipCount}次):`, JSON.stringify(afterStorySnap?.state));

  // 检查剧情后重叠
  let overlaps = await checkOverlaps();
  if (overlaps.length) issues.push(`剧情后重叠: ${overlaps.join(', ')}`);

  // ========== 5. 主界面检查 ==========
  await wait(1000);
  await shot('main_ui');
  const mainSnap = await uiSnapshot();
  console.log('  主界面:', JSON.stringify(mainSnap?.visible));

  // 检查行动按钮
  const actionBtns = await evalJS(() => {
    const box = document.getElementById('action-buttons');
    if (!box) return { count: 0, texts: [] };
    const btns = box.querySelectorAll('button');
    return { count: btns.length, texts: Array.from(btns).map(b => b.textContent.trim().substring(0, 20)) };
  });
  console.log('  行动按钮:', JSON.stringify(actionBtns));

  // ========== 6. 打开地图 ==========
  await evalJS(() => { if (window.UI) UI.toggleWorldmap(); });
  await wait(2000);
  await shot('map_z3');
  const mapSnap = await uiSnapshot();
  console.log('  地图Z3:', JSON.stringify(mapSnap?.visible));
  
  overlaps = await checkOverlaps();
  if (overlaps.length) issues.push(`地图Z3重叠: ${overlaps.join(', ')}`);

  // 检查地图背景
  const mapBg = await evalJS(() => {
    const bg = document.getElementById('worldmap-bg');
    if (!bg) return null;
    return getComputedStyle(bg).backgroundImage;
  });
  console.log('  地图背景:', mapBg);

  // ========== 7. 缩放到 Z4 ==========
  await evalJS(() => { if (window.UI) UI._mapZoomIn(); });
  await wait(1500);
  await shot('map_z4');
  const z4Snap = await uiSnapshot();
  console.log('  地图Z4:', JSON.stringify(z4Snap?.visible));

  // ========== 8. 缩放到 Z5（回场景） ==========
  await evalJS(() => { if (window.UI) UI._mapZoomIn(); });
  await wait(1500);
  await shot('map_z5_scene');
  const z5Snap = await uiSnapshot();
  console.log('  Z5场景:', JSON.stringify(z5Snap?.visible));
  
  overlaps = await checkOverlaps();
  if (overlaps.length) issues.push(`Z5场景重叠: ${overlaps.join(', ')}`);

  // 检查 action-dock 是否出现
  if (z5Snap?.visible?.includes('action-dock')) {
    issues.push('Z5场景: action-dock 不应出现（应使用常规 layout 行动按钮）');
  }

  // ========== 9. 回地图 ==========
  await evalJS(() => { if (window.UI) UI.toggleWorldmap(); });
  await wait(2000);
  await shot('back_to_map');

  // ========== 10. 缩小到 Z2 ==========
  await evalJS(() => { if (window.UI) UI._mapZoomOut(); });
  await wait(1000);
  await shot('map_z2');
  const z2Snap = await uiSnapshot();
  console.log('  地图Z2:', JSON.stringify(z2Snap?.visible));

  // ========== 11. 缩小到 Z1 ==========
  await evalJS(() => { if (window.UI) UI._mapZoomOut(); });
  await wait(1000);
  await shot('map_z1');
  const z1Snap = await uiSnapshot();
  console.log('  地图Z1:', JSON.stringify(z1Snap?.visible));

  // ========== 12. 回到 Z3 ==========
  await evalJS(() => { if (window.UI) UI._mapZoomIn(); });
  await wait(1000);
  await shot('map_z3_again');

  // ========== 13. 回场景 ==========
  await evalJS(() => { if (window.UI) UI.toggleWorldmap(); });
  await wait(1500);
  await shot('back_scene');

  // ========== 14. 尝试执行行动 ==========
  // 先检查有什么行动可用
  const actions = await evalJS(() => {
    const box = document.getElementById('action-buttons');
    if (!box) return [];
    const btns = box.querySelectorAll('[data-action]');
    return Array.from(btns).map(b => ({ action: b.dataset.action, text: b.textContent.trim().substring(0, 20) }));
  });
  console.log('  可用行动:', JSON.stringify(actions));

  if (actions.length > 0) {
    // 执行第一个行动
    const firstAction = actions[0].action;
    console.log(`  执行行动: ${firstAction}`);
    await evalJS((a) => { if (window.Engine) Engine.doAction(a); }, firstAction);
    await wait(2000);
    await shot(`action_${firstAction}`);
    const afterActionSnap = await uiSnapshot();
    console.log(`  行动后:`, JSON.stringify(afterActionSnap?.state));
    
    // 检查是否有弹窗
    if (afterActionSnap?.visible?.includes('modal')) {
      await shot(`action_${firstAction}_modal`);
      console.log('  行动弹出了 modal');
      // 关闭 modal
      await evalJS(() => { if (window.UI) UI.closeModal(); });
      await wait(500);
    }
    if (afterActionSnap?.visible?.includes('sheet')) {
      await shot(`action_${firstAction}_sheet`);
      console.log('  行动弹出了 sheet');
      await evalJS(() => { if (window.UI) UI.closeSheet(); });
      await wait(500);
    }
  }

  // ========== 15. 推进几个月 ==========
  console.log('\n--- 推进时间 ---');
  for (let i = 0; i < 5; i++) {
    // 尝试闭关修炼
    const snap = await uiSnapshot();
    if (snap?.visible?.includes('story-overlay')) {
      // 有剧情，跳过
      await evalJS(() => { if (window.UI) UI.storySkip(); });
      await wait(800);
      const hasChoices = await evalJS(() => {
        const box = document.getElementById('story-choices');
        if (!box || box.hidden) return 0;
        return box.querySelectorAll('button.choice, button').length;
      });
      if (hasChoices > 0) {
        await evalJS(() => {
          const box = document.getElementById('story-choices');
          if (box) { const btn = box.querySelector('button.choice, button'); if (btn) btn.click(); }
        });
        await wait(1000);
      }
      await shot(`month_${i}_story`);
      continue;
    }
    
    if (snap?.visible?.includes('modal')) {
      await evalJS(() => { if (window.UI) UI.closeModal(); });
      await wait(500);
    }
    if (snap?.visible?.includes('sheet')) {
      await evalJS(() => { if (window.UI) UI.closeSheet(); });
      await wait(500);
    }

    // 执行闭关修炼
    const acted = await evalJS(() => {
      const box = document.getElementById('action-buttons');
      if (!box) return false;
      const btn = box.querySelector('[data-action="cultivate"], [data-action="rest"], [data-action="gather"]');
      if (btn) { btn.click(); return btn.dataset.action; }
      // 尝试任意按钮
      const any = box.querySelector('[data-action]');
      if (any) { any.click(); return any.dataset.action; }
      return false;
    });
    
    if (acted) {
      console.log(`  月${i+1}: 执行 ${acted}`);
      await wait(1500);
      
      // 关闭可能的弹窗
      await evalJS(() => { 
        if (window.UI) { UI.closeModal(); UI.closeSheet(); }
      });
      await wait(500);
    }
    
    await shot(`month_${i+1}`);
    const monthSnap = await uiSnapshot();
    console.log(`  月${i+1}状态:`, JSON.stringify(monthSnap?.state));
    
    overlaps = await checkOverlaps();
    if (overlaps.length) issues.push(`月${i+1}重叠: ${overlaps.join(', ')}`);
  }

  // ========== 16. 再次开地图检查 ==========
  await evalJS(() => { if (window.UI) UI.toggleWorldmap(); });
  await wait(2000);
  await shot('final_map');
  const finalMapSnap = await uiSnapshot();
  console.log('\n最终地图:', JSON.stringify(finalMapSnap?.visible));

  // ========== 17. 检查底栏 tabs ==========
  const tabsInfo = await evalJS(() => {
    const tabs = document.querySelectorAll('#mobile-tabs .tab, .mobile-tabs .tab');
    return Array.from(tabs).map(t => ({ text: t.textContent.trim().substring(0, 10), id: t.id, visible: t.offsetParent !== null }));
  });
  console.log('  底栏tabs:', JSON.stringify(tabsInfo));

  // ========== 报告 ==========
  console.log('\n=== 问题报告 ===');
  if (issues.length === 0) console.log('  无问题');
  else issues.forEach((iss, i) => console.log(`  ${i+1}. ${iss}`));
  
  console.log('\n=== 404请求 ===');
  if (failedReqs.length === 0) console.log('  无');
  else failedReqs.forEach(r => console.log(`  - ${r}`));

  console.log('\n浏览器保持打开 60 秒...');
  await wait(60000);
  await browser.close();
})();
