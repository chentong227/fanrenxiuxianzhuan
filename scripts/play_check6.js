/**
 * UI 检查 v6——捕获 404 URL + 更详细截图
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

  const failedRequests = [];
  page.on('requestfailed', req => {
    failedRequests.push(`${req.url()} - ${req.failure().errorText}`);
  });
  page.on('response', resp => {
    if (resp.status() >= 400) {
      failedRequests.push(`${resp.status()} ${resp.url()}`);
    }
  });

  let shotIdx = 400;
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
    } catch (e) { return false; }
  }
  async function evalJS(code) { return await page.evaluate(code); }

  console.log('=== UI 检查 v6 ===\n');

  await page.route('**/ver.txt*', async route => {
    await route.fulfill({ status: 200, body: '222', contentType: 'text/plain' });
  });

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await wait(2000);
  await shot('title');

  await tryClick('#btn-test-root');
  await wait(2000);
  await shot('lingen');

  await tryClick('#btn-start');
  await wait(3000);
  await shot('entered');

  // Skip story
  for (let i = 0; i < 20; i++) {
    const storyActive = await evalJS(() => {
      const ov = document.getElementById('story-overlay');
      return ov && !ov.hidden;
    });
    if (!storyActive) break;
    await evalJS(() => { if (window.UI && UI.storySkip) UI.storySkip(); });
    await wait(800);
    const hasChoices = await evalJS(() => {
      const box = document.getElementById('story-choices');
      if (!box) return 0;
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
  await shot('after_skip');

  // Open map
  await evalJS(() => { if (window.UI) UI.toggleWorldmap(); });
  await wait(2000);
  await shot('map_open');

  // Check bg image
  const bgInfo = await evalJS(() => {
    const bg = document.getElementById('worldmap-bg');
    if (!bg) return null;
    const cs = getComputedStyle(bg);
    return { bgImage: cs.backgroundImage, opacity: cs.opacity, w: bg.getBoundingClientRect().width, h: bg.getBoundingClientRect().height };
  });
  console.log('  背景图:', JSON.stringify(bgInfo));

  // Zoom in to Z4
  await evalJS(() => { if (window.UI) UI._mapZoomIn(); });
  await wait(1000);
  await shot('zoom_z4');

  const bgInfoZ4 = await evalJS(() => {
    const bg = document.getElementById('worldmap-bg');
    if (!bg) return null;
    return getComputedStyle(bg).backgroundImage;
  });
  console.log('  Z4背景图:', bgInfoZ4);

  // Zoom in to Z5 (scene)
  await evalJS(() => { if (window.UI) UI._mapZoomIn(); });
  await wait(1500);
  await shot('zoom_z5');

  // Check action buttons
  const actCount = await evalJS(() => {
    return document.querySelectorAll('.btn-action, [data-action], .mid-col .btn-action').length;
  });
  console.log('  Z5行动按钮数:', actCount);

  // Back to map
  await evalJS(() => { if (window.UI) UI.toggleWorldmap(); });
  await wait(2000);
  await shot('back_to_map');

  // Zoom out to Z2
  await evalJS(() => { if (window.UI) UI._mapZoomOut(); });
  await wait(1000);
  await shot('zoom_z2');

  // Zoom out to Z1
  await evalJS(() => { if (window.UI) UI._mapZoomOut(); });
  await wait(1000);
  await shot('zoom_z1');

  console.log('\n=== 404/失败请求 ===');
  failedRequests.forEach(r => console.log(`  - ${r}`));

  console.log('\n浏览器保持打开 60 秒...');
  await wait(60000);
  await browser.close();
})();
