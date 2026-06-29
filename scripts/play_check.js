/**
 * UI 重叠检查脚本——有头模式，截图+点击，模拟真实玩家操作
 * 用法: node scripts/play_check.js
 */
const { chromium } = require('playwright');
const path = require('path');

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
  let shotIdx = 0;

  async function shot(label) {
    const fname = path.join(SHOT_DIR, `frame_${String(shotIdx).padStart(3, '0')}_${label}.png`);
    await page.screenshot({ path: fname, fullPage: false });
    console.log(`📸 [${shotIdx}] ${label} → ${fname}`);
    shotIdx++;
    return fname;
  }

  async function clickText(text) {
    const el = await page.locator(`text="${text}"`).first();
    if (await el.isVisible({ timeout: 2000 })) {
      await el.click();
      console.log(`👆 点击: "${text}"`);
      return true;
    }
    console.log(`❌ 找不到可见的: "${text}"`);
    return false;
  }

  async function clickSelector(sel) {
    const el = await page.locator(sel).first();
    if (await el.isVisible({ timeout: 2000 })) {
      await el.click();
      console.log(`👆 点击: ${sel}`);
      return true;
    }
    console.log(`❌ 找不到可见的: ${sel}`);
    return false;
  }

  async function wait(ms) { await page.waitForTimeout(ms); }

  // 检查 UI 重叠
  async function checkOverlap() {
    const overlaps = await page.evaluate(() => {
      const results = [];
      const worldmap = document.getElementById('worldmap-canvas');
      const layout = document.querySelector('.layout');
      const topbar = document.querySelector('.topbar');
      const sceneStage = document.getElementById('scene-stage');
      const actionDock = document.getElementById('action-dock');
      const modal = document.getElementById('modal-overlay');
      const sheet = document.getElementById('sheet-overlay');

      function getRect(el) {
        if (!el || el.hidden || el.style.display === 'none') return null;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return null;
        return { id: el.id || el.className, x: r.x, y: r.y, w: r.width, h: r.height };
      }

      function overlap(a, b) {
        if (!a || !b) return false;
        return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
      }

      const elems = [
        { el: worldmap, name: 'worldmap-canvas' },
        { el: layout, name: 'layout' },
        { el: topbar, name: 'topbar' },
        { el: sceneStage, name: 'scene-stage' },
        { el: actionDock, name: 'action-dock' },
        { el: modal, name: 'modal-overlay' },
        { el: sheet, name: 'sheet-overlay' },
      ].map(e => ({ ...e, rect: getRect(e.el) })).filter(e => e.rect);

      for (let i = 0; i < elems.length; i++) {
        for (let j = i + 1; j < elems.length; j++) {
          if (overlap(elems[i].rect, elems[i].rect)) continue;
          if (overlap(elems[i].rect, elems[j].rect)) {
            results.push(`${elems[i].name} ↔ ${elems[j].name}`);
          }
        }
      }
      return { visible: elems.map(e => e.name), overlaps: results };
    });
    return overlaps;
  }

  console.log('=== UI 重叠检查开始 ===\n');

  // 1. 打开游戏
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await wait(1500);
  await shot('01_title');
  const overlap1 = await checkOverlap();
  console.log('  可见元素:', overlap1.visible);
  console.log('  重叠:', overlap1.overlaps);

  // 2. 测灵根
  await clickText('测灵根');
  await wait(1000);
  await shot('02_lingen');

  // 3. 踏入此界
  await clickText('踏入此界');
  await wait(2000);
  await shot('03_enter');

  // 4. 开场剧情
  for (let i = 0; i < 5; i++) {
    await clickSelector('#narrative-overlay, .narrative-overlay, .narrative, .modal-overlay, [class*="narrative"]');
    await wait(800);
  }
  await shot('04_opening');
  const overlap2 = await checkOverlap();
  console.log('  可见元素:', overlap2.visible);
  console.log('  重叠:', overlap2.overlaps);

  // 5. 尝试打开地图
  await clickSelector('#btn-atlas');
  await wait(1500);
  await shot('05_map');
  const overlap3 = await checkOverlap();
  console.log('  可见元素:', overlap3.visible);
  console.log('  重叠:', overlap3.overlaps);

  // 6. 缩放
  await clickSelector('#zoom-in');
  await wait(800);
  await shot('06_zoom_in');
  const overlap4 = await checkOverlap();
  console.log('  可见元素:', overlap4.visible);
  console.log('  重叠:', overlap4.overlaps);

  await clickSelector('#zoom-out');
  await wait(800);
  await shot('07_zoom_out');

  // 7. 回到场景
  await clickSelector('#btn-atlas');
  await wait(1000);
  await shot('08_back');

  // 8. 检查行动按钮
  const actionBtns = await page.locator('.btn-action, [data-action]').count();
  console.log(`  行动按钮数: ${actionBtns}`);
  await shot('09_actions');
  const overlap5 = await checkOverlap();
  console.log('  可见元素:', overlap5.visible);
  console.log('  重叠:', overlap5.overlaps);

  console.log('\n=== 检查完成 ===');
  console.log('浏览器保持打开，手动查看效果。按 Ctrl+C 退出。');

  // 保持浏览器打开 60 秒供观察
  await wait(60000);
  await browser.close();
})();
