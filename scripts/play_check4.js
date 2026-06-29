/**
 * UI 重叠检查 v4——跳过剧情后检查地图 UI
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

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(err.message));

  let shotIdx = 200;
  async function shot(label) {
    const fname = path.join(SHOT_DIR, `frame_${String(shotIdx).padStart(3, '0')}_${label}.png`);
    await page.screenshot({ path: fname, fullPage: false });
    console.log(`📸 [${shotIdx}] ${label}`);
    shotIdx++;
  }
  async function wait(ms) { await page.waitForTimeout(ms); }

  async function tryClick(sel, timeout = 3000) {
    try {
      const el = page.locator(sel).first();
      await el.waitFor({ state: 'visible', timeout });
      await el.click({ force: true });
      console.log(`👆 点击: ${sel}`);
      return true;
    } catch (e) {
      console.log(`❌ ${sel}: ${e.message.slice(0, 80)}`);
      return false;
    }
  }

  async function checkOverlap() {
    return await page.evaluate(() => {
      function getRect(el) {
        if (!el) return null;
        if (el.hidden) return null;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return null;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return null;
        return { name: el.id || el.className, x: r.x, y: r.y, w: r.width, h: r.height };
      }
      function overlap(a, b) {
        return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
      }
      const ids = ['worldmap-canvas', 'worldmap-svg', 'worldmap-pins', 'worldmap-labels',
                   'avatar-pin', 'journey-status', 'action-dock', 'scene-stage',
                   'modal-overlay', 'sheet-overlay', 'story-overlay'];
      const classes = ['.layout', '.topbar', '.mid-col', '.side-rail', '.stage-col',
                       '.zoom-controls', '.worldmap-hint', '.action-buttons'];
      const elems = [];
      ids.forEach(id => { const r = getRect(document.getElementById(id)); if (r) elems.push(r); });
      classes.forEach(c => document.querySelectorAll(c).forEach(el => {
        const r = getRect(el); if (r) elems.push(r);
      }));
      const overlaps = [];
      for (let i = 0; i < elems.length; i++)
        for (let j = i + 1; j < elems.length; j++)
          if (overlap(elems[i], elems[j]))
            overlaps.push(`${elems[i].name} ↔ ${elems[j].name}`);
      return { visible: elems.map(e => e.name), overlaps: [...new Set(overlaps)] };
    });
  }

  console.log('=== UI 重叠检查 v4 ===\n');

  // 拦截 ver.txt 防重载
  await page.route('**/ver.txt*', async route => {
    await route.fulfill({ status: 200, body: '222', contentType: 'text/plain' });
  });

  // 1. 打开 + 测灵根 + 进入
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await wait(2000);
  await shot('title');

  await tryClick('#btn-test-root');
  await wait(2000);
  await shot('lingen');

  await tryClick('#btn-start');
  await wait(3000);
  await shot('entered');

  // 2. 跳过开场剧情
  console.log('\n--- 跳过剧情 ---');
  // 点跳过按钮
  const skipped = await tryClick('#story-skip', 3000);
  if (skipped) {
    await wait(1000);
    // 可能有多段剧情，继续跳过
    for (let i = 0; i < 10; i++) {
      const stillVisible = await page.locator('#story-overlay').isVisible().catch(() => false);
      if (!stillVisible) break;
      await tryClick('#story-skip', 1000);
      await wait(800);
    }
  }
  // 也可能需要点 narrative overlay
  await tryClick('#narrative-overlay', 1000);
  await wait(500);
  await shot('after_skip');

  // 3. 检查游戏主界面
  console.log('\n--- 游戏主界面 ---');
  let ov = await checkOverlap();
  console.log('  可见:', ov.visible);
  console.log('  重叠:', ov.overlaps);
  await shot('game_main');

  // 4. 打开地图
  console.log('\n--- 打开地图 ---');
  await tryClick('#btn-atlas');
  await wait(2000);
  await shot('map_open');
  ov = await checkOverlap();
  console.log('  可见:', ov.visible);
  console.log('  重叠:', ov.overlaps);

  // 5. 缩放测试
  console.log('\n--- 放大 ---');
  await tryClick('#zoom-in');
  await wait(1000);
  await shot('zoom_in');
  ov = await checkOverlap();
  console.log('  可见:', ov.visible);
  console.log('  重叠:', ov.overlaps);

  await tryClick('#zoom-in');
  await wait(1000);
  await shot('zoom_in2');
  ov = await checkOverlap();
  console.log('  可见:', ov.visible);
  console.log('  重叠:', ov.overlaps);

  console.log('\n--- 缩小 ---');
  await tryClick('#zoom-out');
  await wait(1000);
  await shot('zoom_out');
  ov = await checkOverlap();
  console.log('  可见:', ov.visible);
  console.log('  重叠:', ov.overlaps);

  await tryClick('#zoom-out');
  await wait(1000);
  await shot('zoom_out2');
  ov = await checkOverlap();
  console.log('  可见:', ov.visible);
  console.log('  重叠:', ov.overlaps);

  // 6. 回场景
  console.log('\n--- 回场景 ---');
  await tryClick('#btn-atlas');
  await wait(1500);
  await shot('back_scene');
  ov = await checkOverlap();
  console.log('  可见:', ov.visible);
  console.log('  重叠:', ov.overlaps);

  // 7. 检查行动按钮区
  console.log('\n--- 行动按钮 ---');
  const btnCount = await page.locator('.btn-action, [data-action]').count();
  console.log(`  行动按钮数: ${btnCount}`);
  await shot('actions');

  console.log('\n=== 检查完成 ===');
  console.log(`JS错误 (${consoleErrors.length}):`);
  consoleErrors.slice(0, 10).forEach(e => console.log(`  - ${e.slice(0, 120)}`));

  console.log('\n浏览器保持打开 90 秒供观察...');
  await wait(90000);
  await browser.close();
})();
