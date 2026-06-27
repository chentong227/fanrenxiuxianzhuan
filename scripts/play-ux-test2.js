const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SHOT_DIR = path.join(__dirname, '..', 'promo', 'ux-test');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });
const shot = (page, name) => page.screenshot({ path: path.join(SHOT_DIR, name) });

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  });
  const page = await ctx.newPage();
  const log = (msg) => console.log(`[${new Date().toISOString().slice(11,19)}] ${msg}`);

  // 打开 + 进入
  log('打开游戏...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  log('测灵根...');
  await page.click('#btn-test-root');
  await page.waitForTimeout(600);
  await page.click('#btn-start');
  await page.waitForTimeout(1000);

  // 跳过剧情
  log('跳过剧情...');
  for (let i = 0; i < 60; i++) {
    const vis = await page.evaluate(() => { const el = document.getElementById('story-overlay'); return el && !el.hidden; });
    if (!vis) break;
    const tc = await page.$('#story-titlecard.show');
    if (tc) { await tc.click().catch(()=>{}); await page.waitForTimeout(400); continue; }
    const ch = await page.$('.story-choices .choice');
    if (ch && await ch.isVisible().catch(()=>false)) { await ch.click(); await page.waitForTimeout(300); continue; }
    const sk = await page.$('#story-skip');
    if (sk && await sk.isVisible().catch(()=>false)) { await sk.click(); await page.waitForTimeout(300); continue; }
    await page.evaluate(() => { if (typeof UI !== 'undefined' && UI.storySkip) UI.storySkip(); }).catch(()=>{});
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(500);
  log('剧情结束');
  await shot(page, 'a01_scene.png');

  // 检查热点
  const hs = await page.$$('.scene-hotspot');
  log(`热点: ${hs.length}`);
  const pins = await page.$$('.scene-pin');
  log(`pins: ${pins.length}`);
  const dockBtns = await page.$$('#dock-actions .btn-action');
  log(`dock 按钮: ${dockBtns.length}`);
  const actionBtns = await page.$$('#action-buttons .btn-action');
  log(`action-buttons 按钮: ${actionBtns.length}`);

  // 检查 worldmap-canvas 是否 hidden
  const wmHidden = await page.evaluate(() => document.getElementById('worldmap-canvas').hidden);
  log(`worldmap-canvas hidden: ${wmHidden}`);

  // 检查 scene-stage 是否 visible
  const stageDisplay = await page.evaluate(() => getComputedStyle(document.getElementById('scene-stage')).display);
  log(`scene-stage display: ${stageDisplay}`);

  await shot(page, 'a02_hotspots.png');

  // 切到地图
  log('切到地图...');
  await page.evaluate(() => UI.toggleWorldmap());
  await page.waitForTimeout(800);
  await shot(page, 'a03_map.png');

  // 检查地图状态下 scene-stage 是否隐藏
  const stageDisplay2 = await page.evaluate(() => getComputedStyle(document.getElementById('scene-stage')).display);
  log(`地图模式下 scene-stage display: ${stageDisplay2}`);
  const wmHidden2 = await page.evaluate(() => document.getElementById('worldmap-canvas').hidden);
  log(`地图模式下 worldmap-canvas hidden: ${wmHidden2}`);
  const layoutDisplay = await page.evaluate(() => getComputedStyle(document.querySelector('.layout')).display);
  log(`地图模式下 layout display: ${layoutDisplay}`);

  // 切回场景
  log('切回场景...');
  await page.evaluate(() => UI.toggleWorldmap());
  await page.waitForTimeout(800);
  await shot(page, 'a04_back_scene.png');

  const stageDisplay3 = await page.evaluate(() => getComputedStyle(document.getElementById('scene-stage')).display);
  log(`切回后 scene-stage display: ${stageDisplay3}`);
  const wmHidden3 = await page.evaluate(() => document.getElementById('worldmap-canvas').hidden);
  log(`切回后 worldmap-canvas hidden: ${wmHidden3}`);

  // 点闭关热点
  log('点闭关热点...');
  await page.evaluate(() => {
    const h = document.querySelector('.scene-hotspot[title="闭关"]');
    if (h) h.click();
  });
  await page.waitForTimeout(400);
  const sheetOpen = await page.evaluate(() => !document.getElementById('sheet-overlay').hidden);
  log(`Sheet 打开: ${sheetOpen}`);
  await shot(page, 'a05_sheet.png');

  // 闭关一月
  log('闭关一月...');
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(b => b.textContent.includes('闭关一月'));
    if (b) b.click();
  });
  await page.waitForTimeout(600);
  await shot(page, 'a06_cultivated.png');

  // 检查 toast
  const toast = await page.$('.float-gain-toast');
  log(`float-gain: ${toast ? '✓' : '已消失'}`);

  // 月历条
  const mb = await page.$('.month-bar');
  log(`月历条: ${mb ? '✓' : '✗'}`);

  // NPC
  const npcs = await page.$$('.local-npc');
  log(`NPC: ${npcs.length}`);
  if (npcs.length > 0) {
    await npcs[0].click();
    await page.waitForTimeout(400);
    const npcSheet = await page.evaluate(() => !document.getElementById('sheet-overlay').hidden);
    log(`NPC sheet: ${npcSheet}`);
    await shot(page, 'a07_npc.png');
    await page.evaluate(() => UI.closeSheet());
  }

  // 最终
  await shot(page, 'a08_final.png');

  log('\n===== 汇总 =====');
  log(`热点: ${hs.length}, pins: ${pins.length}, dock: ${dockBtns.length}, action-btns: ${actionBtns.length}`);
  log(`地图模式 scene-stage 隐藏: ${stageDisplay2 === 'none' ? '✓' : '✗ ('+stageDisplay2+')'}`);
  log(`Sheet: ${sheetOpen ? '✓' : '✗'}`);
  log(`float-gain: ${toast ? '✓' : '消失'}`);
  log(`月历条: ${mb ? '✓' : '✗'}`);
  log(`NPC sheet: ${npcs.length > 0 ? '✓' : '无NPC'}`);
  log('=================');

  await page.waitForTimeout(5000);
  await browser.close();
  log('完成');
})();
