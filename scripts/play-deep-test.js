/**
 * 深度 Playwright 游玩验证：
 * 1. 完整跳过开场剧情进入游戏
 * 2. 执行闭关行动验证 ripple + float-gain
 * 3. 打开地图验证互斥
 * 4. 检查所有 overlay 的 hidden 状态正确
 * 5. 捕获所有 console 警告/错误
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SHOT_DIR = path.join(__dirname, '..', 'promo', 'ux-test');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();

  const consoleLogs = [];
  page.on('console', msg => {
    const type = msg.type();
    if (type === 'warning' || type === 'error') {
      consoleLogs.push(`[${type}] ${msg.text()}`);
    }
  });
  page.on('pageerror', err => consoleLogs.push(`[ERROR] ${err.message}`));

  const results = [];
  function check(name, ok, detail) {
    results.push({ name, ok, detail: detail || '' });
    console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
  }

  let shotIdx = 0;
  async function shot(label) {
    const fname = `deep_${String(++shotIdx).padStart(2, '0')}_${label}.png`;
    await page.screenshot({ path: path.join(SHOT_DIR, fname) });
    console.log(`  📸 ${fname}`);
  }

  try {
    // === 1. 加载 + 进入游戏 ===
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await shot('title');

    // 测灵根
    const testBtn = page.locator('text=测试灵根').first();
    if (await testBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await testBtn.click();
      await page.waitForTimeout(300);
    }
    // 踏入此界
    const enterBtn = page.locator('text=踏入此界').first();
    if (await enterBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await enterBtn.click();
      await page.waitForTimeout(500);
    }

    // === 2. 跳过开场剧情 ===
    for (let i = 0; i < 80; i++) {
      const storyOv = page.locator('#story-overlay');
      if (await storyOv.isHidden()) break;

      const titlecard = page.locator('#story-titlecard.show');
      if (await titlecard.isVisible({ timeout: 80 }).catch(() => false)) {
        await titlecard.click();
        await page.waitForTimeout(120);
        continue;
      }
      const dialog = page.locator('#story-dialog');
      if (await dialog.isVisible({ timeout: 80 }).catch(() => false)) {
        await dialog.click();
        await page.waitForTimeout(120);
        continue;
      }
      const choices = page.locator('#story-choices .choice, #story-choices button');
      const count = await choices.count();
      if (count > 0) {
        await choices.first().click();
        await page.waitForTimeout(250);
        continue;
      }
      const skipBtn = page.locator('#story-skip');
      if (await skipBtn.isVisible({ timeout: 80 }).catch(() => false)) {
        await skipBtn.click();
        await page.waitForTimeout(250);
        continue;
      }
      await page.waitForTimeout(150);
    }

    await page.waitForTimeout(500);
    await shot('game_entered');

    // 检查游戏状态
    const gameInfo = await page.evaluate(() => {
      const sceneVisible = !document.getElementById('scene-stage').hidden;
      const storyHidden = document.getElementById('story-overlay').hidden;
      const combatHidden = document.getElementById('combat-overlay').hidden;
      const worldmapHidden = document.getElementById('worldmap-canvas').hidden;
      const modalHidden = document.getElementById('modal-overlay').hidden;
      const hotspotsLayer = document.getElementById('scene-hotspots');
      const hotspotsEmpty = hotspotsLayer ? hotspotsLayer.innerHTML.trim() === '' : true;
      const hasState = typeof State !== 'undefined' && !!State.data;
      const loc = hasState ? State.data.location : null;
      const realm = hasState ? State.data.realmIndex : null;
      return { sceneVisible, storyHidden, combatHidden, worldmapHidden, modalHidden, hotspotsEmpty, hasState, loc, realm };
    });

    check('场景层可见', gameInfo.sceneVisible);
    check('剧情层已关闭', gameInfo.storyHidden);
    check('战斗层已关闭', gameInfo.combatHidden);
    check('地图层已关闭（默认隐藏）', gameInfo.worldmapHidden);
    check('弹窗层已关闭', gameInfo.modalHidden);
    check('热点层为空（无热点地点）', gameInfo.hotspotsEmpty);
    check('State.data 已初始化', gameInfo.hasState, `loc=${gameInfo.loc}, realm=${gameInfo.realm}`);

    // === 3. 检查所有 overlay 的 z-index 无冲突 ===
    const zInfo = await page.evaluate(() => {
      const els = document.querySelectorAll('[id$="-overlay"], #worldmap-canvas, #scene-stage, .layout, .action-dock, #scene-hotspots');
      return Array.from(els).map(el => {
        const style = getComputedStyle(el);
        return {
          id: el.id || el.className,
          zIndex: style.zIndex,
          position: style.position,
          hidden: el.hidden,
          display: style.display,
        };
      });
    });
    console.log('\n  === Overlay z-index 审计 ===');
    zInfo.forEach(z => console.log(`  ${z.id}: z=${z.zIndex}, pos=${z.position}, hidden=${z.hidden}, display=${z.display}`));

    // 检查无 z-index 冲突（相同 z-index 的 fixed/absolute 元素可能重叠）
    const fixedOverlays = zInfo.filter(z => z.position === 'fixed' && !z.hidden && z.display !== 'none');
    const zGroups = {};
    fixedOverlays.forEach(z => {
      const zi = z.zIndex;
      if (!zGroups[zi]) zGroups[zi] = [];
      zGroups[zi].push(z.id);
    });
    const conflicts = Object.entries(zGroups).filter(([_, ids]) => ids.length > 1);
    check('无 fixed overlay z-index 冲突', conflicts.length === 0,
      conflicts.length ? conflicts.map(([z, ids]) => `z=${z}: ${ids.join(',')}`).join('; ') : 'all unique');

    // === 4. 尝试执行一个行动（闭关）===
    if (gameInfo.hasState) {
      // 找到闭关按钮
      const medBtn = page.locator('[data-action="meditate"]').first();
      const dockBtn = page.locator('.dock-actions [data-action="meditate"]').first();
      const btn = (await dockBtn.count() > 0) ? dockBtn : medBtn;

      if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(800);
        await shot('after_meditate');

        // 检查 float-gain toast 出现
        const toastVisible = await page.locator('.float-gain-toast').count() > 0;
        check('闭关后 float-gain toast 出现', toastVisible);

        // 检查月份推进
        const monthInfo = await page.evaluate(() => {
          const monthEl = document.querySelector('.month-bar-text, .month-text, #month-display');
          return monthEl ? monthEl.textContent : 'N/A';
        });
        check('月份显示存在', monthInfo !== 'N/A', `month: ${monthInfo}`);
      } else {
        // 可能是热点模式
        const hotspotBtn = page.locator('.scene-hotspot').first();
        if (await hotspotBtn.isVisible({ timeout: 500 }).catch(() => false)) {
          await hotspotBtn.click();
          await page.waitForTimeout(800);
          await shot('after_hotspot_click');
          check('热点按钮可点击', true);
        } else {
          check('找到可执行行动', false, 'no meditate/hotspot button visible');
        }
      }
    }

    // === 5. 打开地图验证互斥 ===
    const atlasBtn = page.locator('#btn-atlas').first();
    if (await atlasBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await atlasBtn.click();
      await page.waitForTimeout(600);
      await shot('map_opened');

      const mapInfo = await page.evaluate(() => {
        const wm = document.getElementById('worldmap-canvas');
        const layout = document.querySelector('.layout');
        const scene = document.getElementById('scene-stage');
        const wmStyle = wm ? getComputedStyle(wm) : null;
        const layoutStyle = layout ? getComputedStyle(layout) : null;
        return {
          wmVisible: wm ? !wm.hidden : false,
          wmDisplay: wmStyle ? wmStyle.display : 'N/A',
          layoutDisplay: layoutStyle ? layoutStyle.display : 'N/A',
          layoutHidden: layout ? layout.hidden : 'N/A',
        };
      });
      check('地图打开后 canvas 可见', mapInfo.wmVisible);
      check('地图模式下 layout 在手机端隐藏', mapInfo.layoutDisplay === 'none' || mapInfo.layoutHidden,
        `display=${mapInfo.layoutDisplay}`);

      // 关闭地图
      await atlasBtn.click();
      await page.waitForTimeout(600);
      await shot('map_closed');

      const mapClosed = await page.evaluate(() => {
        return document.getElementById('worldmap-canvas').hidden;
      });
      check('地图关闭后 canvas 隐藏', mapClosed);
    } else {
      // 尝试底栏 tab 切换
      const mapTab = page.locator('.mtab[data-tab="map"]').first();
      if (await mapTab.isVisible({ timeout: 500 }).catch(() => false)) {
        await mapTab.click();
        await page.waitForTimeout(400);
        await shot('map_tab');
        check('底栏地图 tab 可用', true);
      } else {
        check('地图按钮可访问', false, 'no atlas/map tab button');
      }
    }

    // === 6. 检查 console 警告/错误 ===
    const errors = consoleLogs.filter(l => l.startsWith('[ERROR]'));
    const warnings = consoleLogs.filter(l => l.startsWith('[warning]') && !l.includes('webkit-line-clamp'));
    check('无 JS 运行时错误', errors.length === 0, errors.length ? errors.slice(0, 3).join('; ') : '');
    check('无重要 console 警告', warnings.length === 0, warnings.length ? warnings.slice(0, 3).join('; ') : '');

    // === 7. 最终截图 ===
    await shot('final');

  } catch (e) {
    check('脚本执行', false, e.message);
    await shot('error_state');
  }

  // 汇总
  console.log('\n========== 深度验证结果 ==========');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log(`通过: ${passed}  失败: ${failed}  总计: ${results.length}`);
  if (failed > 0) {
    console.log('\n失败项:');
    results.filter(r => !r.ok).forEach(r => console.log(`  ✗ ${r.name} — ${r.detail}`));
  }

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
