/**
 * UI 检查 v3——先诊断加载问题
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

  // 收集控制台错误
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.log(`❌ JS错误: ${msg.text().slice(0, 120)}`);
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push(err.message);
    console.log(`💥 页面异常: ${err.message.slice(0, 120)}`);
  });

  let shotIdx = 100;
  async function shot(label) {
    const fname = path.join(SHOT_DIR, `frame_${String(shotIdx).padStart(3, '0')}_${label}.png`);
    await page.screenshot({ path: fname, fullPage: false });
    console.log(`📸 [${shotIdx}] ${label}`);
    shotIdx++;
  }

  console.log('=== UI 检查 v3 ===\n');

  // 1. 打开游戏，拦截 ver.txt 请求防止自动重载
  await page.route('**/ver.txt*', async route => {
    await route.fulfill({ status: 200, body: '222', contentType: 'text/plain' });
  });

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await shot('100_title');

  // 检查页面 HTML 内容
  const html = await page.content();
  console.log(`HTML 长度: ${html.length}`);
  console.log(`body 内容前 200 字: ${html.slice(html.indexOf('<body'), html.indexOf('<body') + 300)}`);

  // 检查 #screen-create 是否可见
  const createVisible = await page.locator('#screen-create').isVisible();
  console.log(`#screen-create 可见: ${createVisible}`);

  // 检查 #app 是否可见
  const appVisible = await page.locator('#app').isVisible();
  console.log(`#app 可见: ${appVisible}`);

  // 检查 CSS 是否加载
  const cssLoaded = await page.evaluate(() => {
    const sheets = document.styleSheets;
    return Array.from(sheets).map(s => {
      try { return { href: s.href, rules: s.cssRules ? s.cssRules.length : -1 }; }
      catch(e) { return { href: s.href, rules: 'CORS blocked' }; }
    });
  });
  console.log(`CSS sheets: ${JSON.stringify(cssLoaded).slice(0, 200)}`);

  // 检查 JS 是否有错误
  console.log(`\n控制台错误 (${consoleErrors.length}):`);
  consoleErrors.forEach(e => console.log(`  - ${e.slice(0, 150)}`));

  // 2. 尝试测灵根
  console.log('\n--- 尝试测灵根 ---');
  const btnTest = page.locator('#btn-test-root');
  const btnTestVisible = await btnTest.isVisible();
  console.log(`#btn-test-root 可见: ${btnTestVisible}`);
  if (btnTestVisible) {
    await btnTest.click();
    await page.waitForTimeout(2000);
    await shot('101_lingen');
  }

  // 3. 踏入此界
  const btnStart = page.locator('#btn-start');
  const btnStartVisible = await btnStart.isVisible();
  const btnStartDisabled = await btnStart.isDisabled();
  console.log(`#btn-start 可见: ${btnStartVisible}, disabled: ${btnStartDisabled}`);
  if (btnStartVisible && !btnStartDisabled) {
    await btnStart.click();
    await page.waitForTimeout(3000);
    await shot('102_enter');
  }

  // 4. 检查游戏界面
  const screenGame = page.locator('#screen-game');
  const gameVisible = await screenGame.isVisible().catch(() => false);
  console.log(`#screen-game 可见: ${gameVisible}`);
  await shot('103_game');

  if (gameVisible) {
    // 5. 打开地图
    console.log('\n--- 打开地图 ---');
    const btnAtlas = page.locator('#btn-atlas');
    const atlasVisible = await btnAtlas.isVisible().catch(() => false);
    console.log(`#btn-atlas 可见: ${atlasVisible}`);
    if (atlasVisible) {
      await btnAtlas.click();
      await page.waitForTimeout(2000);
      await shot('104_map');
    }
  }

  console.log('\n=== 诊断完成，保持 60 秒 ===');
  await page.waitForTimeout(60000);
  await browser.close();
})();
