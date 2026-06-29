/**
 * 完整游戏流程测试 v2——修复元素检测 + 热点交互 + 更深入流程
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
    if (msg.type() === 'error') issues.push(`Console: ${msg.text()}`);
  });
  page.on('pageerror', err => issues.push(`PageError: ${err.message}`));
  page.on('response', resp => {
    if (resp.status() >= 400) failedReqs.push(`${resp.status()} ${resp.url()}`);
  });

  let shotIdx = 600;
  async function shot(label) {
    const fname = path.join(SHOT_DIR, `frame_${String(shotIdx).padStart(3, '0')}_${label}.png`);
    await page.screenshot({ path: fname, fullPage: false });
    console.log(`📸 [${shotIdx}] ${label}`);
    shotIdx++;
  }
  async function wait(ms) { await page.waitForTimeout(ms); }
  async function evalJS(code, ...args) { 
    try { return await page.evaluate(code, ...args); } 
    catch(e) { issues.push(`Eval: ${e.message}`); return null; }
  }

  // 改进：用 selector 检测可见元素（class + id 都支持）
  async function uiSnapshot() {
    return await evalJS(() => {
      const checks = [
        { name: 'story-overlay', sel: '#story-overlay' },
        { name: 'stage-overlay', sel: '#stage-overlay' },
        { name: 'worldmap-canvas', sel: '#worldmap-canvas' },
        { name: 'scene-stage', sel: '#scene-stage' },
        { name: 'action-dock', sel: '#action-dock' },
        { name: 'action-buttons', sel: '#action-buttons' },
        { name: 'modal', sel: '#modal' },
        { name: 'topbar', sel: '.topbar' },
        { name: 'layout', sel: '.layout' },
        { name: 'side-rail', sel: '.side-rail' },
        { name: 'mid-col', sel: '.mid-col' },
        { name: 'stage-col', sel: '.stage-col' },
        { name: 'narrative', sel: '#narrative' },
        { name: 'objective-bar', sel: '#objective-bar' },
        { name: 'recent-log', sel: '#recent-log' },
        { name: 'inventory', sel: '#inventory' },
        { name: 'mobile-tabs', sel: '#mobile-tabs' },
        { name: 'worldmap-pins', sel: '#worldmap-pins' },
        { name: 'worldmap-labels', sel: '#worldmap-labels' },
        { name: 'avatar-pin', sel: '#avatar-pin' },
        { name: 'zoom-controls', sel: '.zoom-controls' },
        { name: 'worldmap-hint', sel: '#worldmap-hint' },
        { name: 'journey-status', sel: '#journey-status' },
        { name: 'scene-hotspots', sel: '#scene-hotspots' },
        { name: 'scene-pins', sel: '#scene-pins' },
        { name: 'locals', sel: '#locals' },
        { name: 'loc-name', sel: '#loc-name' },
      ];
      const visible = [];
      checks.forEach(({ name, sel }) => {
        const el = document.querySelector(sel);
        if (!el) return;
        const cs = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        if (el.hidden || cs.display === 'none' || cs.visibility === 'hidden' || rect.width === 0 || rect.height === 0) return;
        visible.push(name);
      });
      // 额外检查
      const hotspotCount = document.querySelectorAll('.scene-hotspot:not([style*="display:none"])').length;
      const actionBtnCount = document.querySelectorAll('#action-buttons [data-action]').length;
      const mtabCount = document.querySelectorAll('#mobile-tabs .mtab').length;
      const narrativeText = (document.getElementById('narrative')?.textContent || '').trim().substring(0, 80);
      const recentLogText = (document.getElementById('recent-log')?.textContent || '').trim().substring(0, 80);
      const topbarText = (document.querySelector('.topbar')?.textContent || '').trim().substring(0, 80);
      const locName = document.getElementById('loc-name')?.textContent || '';
      
      const s = window.State ? window.State.data : null;
      return {
        visible,
        hotspotCount, actionBtnCount, mtabCount,
        narrativeText, recentLogText, topbarText, locName,
        state: s ? {
          location: s.location, month: s.month, year: s.year, age: s.age,
          storyStage: s.storyStage, pendingEvent: s.pendingEvent,
          combat: s.combat, journey: s.journey, realm: s.realm,
          spirit: s.spirit, cul: s.cul,
        } : null
      };
    });
  }

  async function checkOverlaps() {
    return await evalJS(() => {
      const problems = [];
      const pairs = [
        ['#action-dock', '#action-buttons'],
        ['#action-dock', '.mid-col'],
        ['#modal', '#worldmap-canvas'],
        ['#worldmap-canvas', '#scene-stage'],
        ['#story-overlay', '#worldmap-canvas'],
      ];
      pairs.forEach(([a, b]) => {
        const ea = document.querySelector(a);
        const eb = document.querySelector(b);
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

  // 跳过剧情
  async function skipStory(maxSteps = 30) {
    for (let i = 0; i < maxSteps; i++) {
      const snap = await uiSnapshot();
      if (!snap?.visible?.includes('story-overlay')) return true;
      await evalJS(() => { if (window.UI && UI.storySkip) UI.storySkip(); });
      await wait(500);
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
    }
    return false;
  }

  // 关闭所有弹窗
  async function closeAllPopups() {
    await evalJS(() => { 
      if (window.UI) { UI.closeModal(); UI.closeSheet(); }
    });
    await wait(500);
  }

  console.log('=== 完整游戏流程测试 v2 ===\n');

  await page.route('**/ver.txt*', async route => {
    await route.fulfill({ status: 200, body: '222', contentType: 'text/plain' });
  });

  // ========== 1. 标题 → 进入 ==========
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await wait(2000);
  await shot('title');

  await page.locator('#btn-test-root').click({ force: true });
  await wait(1500);
  await page.locator('#btn-start').click({ force: true });
  await wait(3000);
  await shot('entered');

  // ========== 2. 跳过剧情 ==========
  await skipStory();
  await wait(1000);
  await shot('after_story');
  let snap = await uiSnapshot();
  console.log('剧情后:', JSON.stringify(snap?.state));
  console.log('  可见:', snap?.visible);
  console.log('  顶栏:', snap?.topbarText);
  console.log('  地点:', snap?.locName);
  console.log('  热点数:', snap?.hotspotCount);
  console.log('  行动按钮数:', snap?.actionBtnCount);
  console.log('  见闻:', snap?.narrativeText);
  console.log('  日志:', snap?.recentLogText);

  // ========== 3. 主界面详细检查 ==========
  await wait(1000);
  await shot('main_ui');
  snap = await uiSnapshot();
  console.log('\n主界面:', snap?.visible);
  console.log('  顶栏:', snap?.topbarText);

  // 检查 topbar 是否有内容
  if (snap?.visible?.includes('topbar')) {
    if (!snap.topbarText || snap.topbarText.length < 5) {
      issues.push('顶栏文字为空——可能未渲染');
    }
  } else {
    issues.push('顶栏不可见');
  }

  // 检查 layout 是否可见
  if (!snap?.visible?.includes('layout')) {
    issues.push('layout 不可见——手机端布局可能有问题');
  }

  // 检查 narrative 是否有内容
  if (snap?.visible?.includes('narrative')) {
    if (!snap.narrativeText) {
      issues.push('见闻日志为空——可能未渲染');
    }
  }

  // ========== 4. 测试热点点击 ==========
  console.log('\n--- 热点测试 ---');
  const hotspots = await evalJS(() => {
    return Array.from(document.querySelectorAll('.scene-hotspot')).map(h => ({
      action: h.getAttribute('onclick')?.match(/doAction\('(\w+)'\)/)?.[1],
      label: h.querySelector('.sh-label')?.textContent,
      icon: h.querySelector('.sh-icon')?.textContent,
    }));
  });
  console.log('  热点:', JSON.stringify(hotspots));

  if (hotspots && hotspots.length > 0) {
    // 点击闭关修炼
    const cultivate = hotspots.find(h => h.action === 'cultivate');
    if (cultivate) {
      console.log(`  点击热点: ${cultivate.label} (${cultivate.action})`);
      await evalJS(() => {
        const hs = document.querySelectorAll('.scene-hotspot');
        for (const h of hs) {
          const onclick = h.getAttribute('onclick') || '';
          if (onclick.includes("doAction('cultivate')")) { h.click(); break; }
        }
      });
      await wait(2000);
      await shot('cultivate_clicked');
      const afterCult = await uiSnapshot();
      console.log('  闭关后:', JSON.stringify(afterCult?.state));
      
      // 闭关可能弹出了 openSeclusion
      if (afterCult?.visible?.includes('modal')) {
        console.log('  闭关弹出了 modal');
        await shot('seclusion_modal');
        // 检查 modal 内容
        const modalInfo = await evalJS(() => {
          const m = document.getElementById('modal');
          if (!m || m.hidden) return null;
          return { text: m.textContent.trim().substring(0, 100), buttons: m.querySelectorAll('button').length };
        });
        console.log('  Modal:', JSON.stringify(modalInfo));
        await closeAllPopups();
      }
    }
  } else {
    issues.push('场景无热点——yaolu 应有热点按钮');
  }

  // ========== 5. 用 Engine.doAction 直接执行 ==========
  console.log('\n--- 行动测试 ---');
  const locInfo = await evalJS(() => {
    const s = State.data;
    const loc = WORLD.locations.find(l => l.id === s.location);
    return { id: loc?.id, name: loc?.name, actions: loc?.actions, scene: loc?.scene, home: loc?.home };
  });
  console.log('  当前地点:', JSON.stringify(locInfo));

  // 测试每个可用行动
  if (locInfo?.actions) {
    for (const action of locInfo.actions) {
      console.log(`  执行: ${action}`);
      const beforeState = await evalJS(() => { const s = State.data; return { month: s.month, year: s.year, spirit: s.spirit, cul: s.cul }; });
      
      await evalJS((a) => { Engine.doAction(a); }, action);
      await wait(1500);
      
      const afterState = await evalJS(() => { const s = State.data; return { month: s.month, year: s.year, spirit: s.spirit, cul: s.cul }; });
      const afterSnap = await uiSnapshot();
      
      console.log(`    前: ${JSON.stringify(beforeState)} → 后: ${JSON.stringify(afterState)}`);
      
      // 检查是否有弹窗需要关闭
      if (afterSnap?.visible?.includes('modal')) {
        await shot(`action_${action}_modal`);
        const modalText = await evalJS(() => document.getElementById('modal')?.textContent.trim().substring(0, 80));
        console.log(`    Modal: ${modalText}`);
        await closeAllPopups();
      }
      if (afterSnap?.visible?.includes('stage-overlay')) {
        await shot(`action_${action}_stage`);
        console.log(`    Stage overlay 出现`);
        // 跳过舞台
        await evalJS(() => { if (window.UI) UI.storySkip(); });
        await wait(1000);
      }
      if (afterSnap?.visible?.includes('story-overlay')) {
        await shot(`action_${action}_story`);
        console.log(`    Story overlay 出现`);
        await skipStory(5);
        await wait(500);
      }
      
      // 检查状态是否变化
      if (JSON.stringify(beforeState) === JSON.stringify(afterState)) {
        // 可能是弹窗型行动（如 cultivate/breakthrough/bottle）
        if (!['cultivate', 'breakthrough', 'bottle', 'alchemy'].includes(action)) {
          issues.push(`行动 ${action}: 状态未变化（月/灵力/修为都没动）`);
        }
      }
      
      await closeAllPopups();
      await wait(300);
    }
  }

  // ========== 6. 地图测试 ==========
  console.log('\n--- 地图测试 ---');
  await evalJS(() => { if (window.UI) UI.toggleWorldmap(); });
  await wait(2000);
  await shot('map_z3');
  snap = await uiSnapshot();
  console.log('Z3:', snap?.visible);
  
  // 检查地图元素
  if (!snap?.visible?.includes('worldmap-pins')) issues.push('Z3: pins 不可见');
  if (!snap?.visible?.includes('worldmap-labels')) issues.push('Z3: labels 不可见');
  if (!snap?.visible?.includes('avatar-pin')) issues.push('Z3: avatar-pin 不可见');
  if (!snap?.visible?.includes('zoom-controls')) issues.push('Z3: zoom-controls 不可见');
  if (!snap?.visible?.includes('worldmap-hint')) issues.push('Z3: hint 不可见');
  if (!snap?.visible?.includes('topbar')) issues.push('Z3: topbar 不可见');

  // Z4
  await evalJS(() => { if (window.UI) UI._mapZoomIn(); });
  await wait(1500);
  await shot('map_z4');
  snap = await uiSnapshot();
  console.log('Z4:', snap?.visible);

  // Z5 (回场景)
  await evalJS(() => { if (window.UI) UI._mapZoomIn(); });
  await wait(1500);
  await shot('map_z5');
  snap = await uiSnapshot();
  console.log('Z5:', snap?.visible);
  if (snap?.visible?.includes('action-dock')) issues.push('Z5: action-dock 不应出现');
  
  let overlaps = await checkOverlaps();
  if (overlaps.length) issues.push(`Z5重叠: ${overlaps.join(', ')}`);

  // 回地图
  await evalJS(() => { if (window.UI) UI.toggleWorldmap(); });
  await wait(2000);

  // Z2
  await evalJS(() => { if (window.UI) UI._mapZoomOut(); });
  await wait(1000);
  await shot('map_z2');
  snap = await uiSnapshot();
  console.log('Z2:', snap?.visible);

  // Z1
  await evalJS(() => { if (window.UI) UI._mapZoomOut(); });
  await wait(1000);
  await shot('map_z1');
  snap = await uiSnapshot();
  console.log('Z1:', snap?.visible);

  // ========== 7. 底栏 tab 切换 ==========
  console.log('\n--- Tab 切换 ---');
  await evalJS(() => { if (window.UI) UI.toggleWorldmap(); });
  await wait(1500);
  
  const tabs = await evalJS(() => {
    return Array.from(document.querySelectorAll('#mobile-tabs .mtab')).map(t => ({
      text: t.textContent.trim(), dataTab: t.dataset.tab, active: t.classList.contains('active')
    }));
  });
  console.log('  Tabs:', JSON.stringify(tabs));

  // 切到"行动"
  await evalJS(() => { if (window.UI) UI.switchMobileTab('mid'); });
  await wait(500);
  await shot('tab_mid');
  snap = await uiSnapshot();
  console.log('  行动Tab:', snap?.visible);

  // 切到"韩立"
  await evalJS(() => { if (window.UI) UI.switchMobileTab('hero'); });
  await wait(500);
  await shot('tab_hero');
  snap = await uiSnapshot();
  console.log('  韩立Tab:', snap?.visible);

  // 切回"见闻"
  await evalJS(() => { if (window.UI) UI.switchMobileTab('stage'); });
  await wait(500);
  await shot('tab_stage');
  snap = await uiSnapshot();
  console.log('  见闻Tab:', snap?.visible);

  // ========== 8. 推进几个月（用热点） ==========
  console.log('\n--- 推进时间 ---');
  for (let i = 0; i < 6; i++) {
    const beforeSnap = await uiSnapshot();
    
    // 跳过剧情
    if (beforeSnap?.visible?.includes('story-overlay')) {
      console.log(`  月${i+1}: 有剧情，跳过`);
      await skipStory(5);
      await wait(500);
      await shot(`month_${i+1}_story`);
      continue;
    }
    
    await closeAllPopups();
    
    // 尝试点热点
    const clicked = await evalJS(() => {
      const hs = document.querySelectorAll('.scene-hotspot');
      for (const h of hs) {
        const onclick = h.getAttribute('onclick') || '';
        if (onclick.includes("doAction('gather')")) { h.click(); return 'gather'; }
      }
      for (const h of hs) {
        const onclick = h.getAttribute('onclick') || '';
        if (onclick.includes("doAction('rest')")) { h.click(); return 'rest'; }
      }
      // 退而求其次：直接调 Engine
      if (window.Engine) { Engine.doAction('gather'); return 'gather(engine)'; }
      return false;
    });
    
    if (clicked) {
      console.log(`  月${i+1}: ${clicked}`);
      await wait(1500);
      await closeAllPopups();
      await wait(300);
    }
    
    const afterSnap = await uiSnapshot();
    await shot(`month_${i+1}`);
    console.log(`  月${i+1}状态:`, JSON.stringify(afterSnap?.state));
    
    overlaps = await checkOverlaps();
    if (overlaps.length) issues.push(`月${i+1}重叠: ${overlaps.join(', ')}`);
  }

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
