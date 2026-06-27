/**
 * Playwright 验证脚本 V2：更完整地跳过开场剧情
 */
const { chromium } = require('playwright');

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
  page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => consoleLogs.push(`[ERROR] ${err.message}`));

  const results = [];
  function check(name, ok, detail) {
    results.push({ name, ok, detail: detail || '' });
    console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
  }

  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    // 测试灵根
    const testBtn = page.locator('text=测试灵根').first();
    if (await testBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await testBtn.click();
      await page.waitForTimeout(300);
    }
    const enterBtn = page.locator('text=踏入此界').first();
    if (await enterBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await enterBtn.click();
      await page.waitForTimeout(500);
    }

    // 更完整地跳过剧情
    for (let i = 0; i < 60; i++) {
      const storyOv = page.locator('#story-overlay');
      if (await storyOv.isHidden()) break;

      // 题字卡
      const titlecard = page.locator('#story-titlecard.show');
      if (await titlecard.isVisible({ timeout: 100 }).catch(() => false)) {
        await titlecard.click();
        await page.waitForTimeout(150);
        continue;
      }

      // 对话框推进
      const dialog = page.locator('#story-dialog');
      if (await dialog.isVisible({ timeout: 100 }).catch(() => false)) {
        await dialog.click();
        await page.waitForTimeout(150);
        continue;
      }

      // 选项
      const choices = page.locator('#story-choices .choice, #story-choices button');
      const count = await choices.count();
      if (count > 0) {
        await choices.first().click();
        await page.waitForTimeout(300);
        continue;
      }

      // 跳过按钮
      const skipBtn = page.locator('#story-skip');
      if (await skipBtn.isVisible({ timeout: 100 }).catch(() => false)) {
        await skipBtn.click();
        await page.waitForTimeout(300);
        continue;
      }

      await page.waitForTimeout(200);
    }

    await page.waitForTimeout(500);

    // 检查游戏状态
    const gameState = await page.evaluate(() => {
      const sceneVisible = !document.getElementById('scene-stage').hidden;
      const storyVisible = !document.getElementById('story-overlay').hidden;
      const hotspotsLayer = document.getElementById('scene-hotspots');
      const hotspotsContent = hotspotsLayer ? hotspotsLayer.innerHTML : 'N/A';
      const worldmapHidden = document.getElementById('worldmap-canvas').hidden;
      const bgm = (typeof Sfx !== 'undefined' && Sfx.curBgm) ? Sfx.curBgm() : 'N/A';
      const state = (typeof State !== 'undefined' && State.data) ? {
        location: State.data.location,
        storyStage: State.data.storyStage,
        combat: State.data.combat,
        pendingEvent: State.data.pendingEvent,
      } : null;
      return { sceneVisible, storyVisible, hotspotsContent, worldmapHidden, bgm, state };
    });

    check('场景层可见', gameState.sceneVisible);
    check('剧情层已关闭', !gameState.storyVisible);
    check('worldmap-canvas 隐藏', gameState.worldmapHidden);
    check('scene-hotspots-layer 存在且为空', gameState.hotspotsContent !== 'N/A' && gameState.hotspotsContent.trim() === '', `content: "${gameState.hotspotsContent.substring(0, 80)}"`);
    check('游戏状态可读', gameState.state !== null, JSON.stringify(gameState.state));
    check('BGM 状态可查询', gameState.bgm !== 'N/A', `curBgm: ${gameState.bgm}`);

    // 检查无 JS 错误
    const errors = consoleLogs.filter(l => l.startsWith('[ERROR]'));
    check('无 JS 运行时错误', errors.length === 0, errors.length ? errors.slice(0, 3).join('; ') : '');

    // 检查 console warnings 中无 BGM 相关
    const bgmWarnings = consoleLogs.filter(l => l.includes('BGM') || l.includes('bgm'));
    check('无 BGM 相关 console 警告', bgmWarnings.length === 0, bgmWarnings.length ? bgmWarnings.slice(0, 3).join('; ') : '');

    await page.screenshot({ path: 'promo/ux-test/verify-fixes-v2.png' });
    check('截图完成', true);

  } catch (e) {
    check('脚本执行', false, e.message);
  }

  console.log('\n========== 验证结果 ==========');
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
