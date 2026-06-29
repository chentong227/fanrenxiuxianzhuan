/**
 * UI 重叠检查 v2——载入存档，直接进游戏检查地图 UI
 * 用法: node scripts/play_check2.js
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
  let shotIdx = 0;

  // 确保截图目录存在
  fs.mkdirSync(SHOT_DIR, { recursive: true });

  async function shot(label) {
    const fname = path.join(SHOT_DIR, `frame_${String(shotIdx).padStart(3, '0')}_${label}.png`);
    await page.screenshot({ path: fname, fullPage: false });
    console.log(`📸 [${shotIdx}] ${label}`);
    shotIdx++;
    return fname;
  }

  async function clickSel(sel, timeout = 3000) {
    try {
      const el = page.locator(sel).first();
      await el.waitFor({ state: 'visible', timeout });
      await el.click();
      console.log(`👆 点击: ${sel}`);
      return true;
    } catch (e) {
      console.log(`❌ 找不到: ${sel} (${e.message.slice(0, 60)})`);
      return false;
    }
  }

  async function clickText(text, timeout = 3000) {
    try {
      const el = page.locator(`text=${text}`).first();
      await el.waitFor({ state: 'visible', timeout });
      await el.click();
      console.log(`👆 点击: "${text}"`);
      return true;
    } catch (e) {
      console.log(`❌ 找不到文字: "${text}"`);
      return false;
    }
  }

  async function wait(ms) { await page.waitForTimeout(ms); }

  async function checkOverlap() {
    return await page.evaluate(() => {
      const results = [];
      const ids = ['worldmap-canvas', 'worldmap-svg', 'worldmap-pins', 'worldmap-labels',
                   'avatar-pin', 'journey-status', 'action-dock', 'scene-stage',
                   'modal-overlay', 'sheet-overlay'];
      const classes = ['.layout', '.topbar', '.mid-col', '.side-rail', '.stage-col',
                       '.zoom-controls', '.worldmap-hint'];

      function getRect(el) {
        if (!el) return null;
        if (el.hidden) return null;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return null;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return null;
        return { name: el.id || el.className, x: r.x, y: r.y, w: r.width, h: r.height };
      }

      function overlap(a, b) {
        if (!a || !b) return false;
        return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
      }

      const elems = [];
      ids.forEach(id => {
        const el = document.getElementById(id);
        const r = getRect(el);
        if (r) elems.push(r);
      });
      classes.forEach(c => {
        document.querySelectorAll(c).forEach(el => {
          const r = getRect(el);
          if (r) elems.push(r);
        });
      });

      for (let i = 0; i < elems.length; i++) {
        for (let j = i + 1; j < elems.length; j++) {
          if (overlap(elems[i], elems[j])) {
            // 排除父子关系
            results.push(`${elems[i].name} ↔ ${elems[j].name}`);
          }
        }
      }
      return { visible: elems.map(e => e.name), overlaps: [...new Set(results)] };
    });
  }

  // 读取存档
  const savePath = path.join(__dirname, '..', 'promo', 'gamesave.json');
  const saveData = JSON.parse(fs.readFileSync(savePath, 'utf8'));
  console.log(`存档: stage=${saveData.stage}, loc=${saveData.location}, year=${saveData.year}`);

  console.log('\n=== UI 重叠检查 v2 ===\n');

  // 1. 打开游戏
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await wait(2000);
  await shot('01_title');

  // 2. 注入存档
  await page.evaluate((data) => {
    localStorage.setItem('fanren_save', JSON.stringify(data));
  }, saveData);
  console.log('✅ 存档已注入 localStorage');

  // 3. 刷新页面让存档生效
  await page.reload({ waitUntil: 'networkidle' });
  await wait(2000);
  await shot('02_loaded');

  // 4. 点击"读取存档"
  await clickText('读取存档', 3000);
  await wait(2000);
  await shot('03_in_game');

  // 5. 检查初始 UI 状态
  let ov = await checkOverlap();
  console.log('  可见元素:', ov.visible);
  console.log('  重叠:', ov.overlaps);

  // 6. 打开地图
  console.log('\n--- 打开地图 ---');
  await clickSel('#btn-atlas', 3000);
  await wait(2000);
  await shot('04_map_open');
  ov = await checkOverlap();
  console.log('  可见元素:', ov.visible);
  console.log('  重叠:', ov.overlaps);

  // 7. 放大
  console.log('\n--- 放大 ---');
  await clickSel('#zoom-in', 2000);
  await wait(1000);
  await shot('05_zoom_in');
  ov = await checkOverlap();
  console.log('  可见元素:', ov.visible);
  console.log('  重叠:', ov.overlaps);

  // 8. 再放大
  await clickSel('#zoom-in', 2000);
  await wait(1000);
  await shot('06_zoom_in2');
  ov = await checkOverlap();
  console.log('  可见元素:', ov.visible);
  console.log('  重叠:', ov.overlaps);

  // 9. 缩小
  console.log('\n--- 缩小 ---');
  await clickSel('#zoom-out', 2000);
  await wait(1000);
  await shot('07_zoom_out');
  ov = await checkOverlap();
  console.log('  可见元素:', ov.visible);
  console.log('  重叠:', ov.overlaps);

  // 10. 再缩小
  await clickSel('#zoom-out', 2000);
  await wait(1000);
  await shot('08_zoom_out2');
  ov = await checkOverlap();
  console.log('  可见元素:', ov.visible);
  console.log('  重叠:', ov.overlaps);

  // 11. 回到场景
  console.log('\n--- 回到场景 ---');
  await clickSel('#btn-atlas', 2000);
  await wait(1500);
  await shot('09_back_scene');
  ov = await checkOverlap();
  console.log('  可见元素:', ov.visible);
  console.log('  重叠:', ov.overlaps);

  console.log('\n=== 检查完成，浏览器保持打开 120 秒 ===');
  await wait(120000);
  await browser.close();
})();
